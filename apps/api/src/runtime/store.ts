import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";

import {
  AuthStatusSchema,
  DeviceSchema,
  OutboxItemSchema,
  RecordingMirrorSchema,
  RuntimeConfigSchema,
  SyncFiltersSchema,
  SyncRunSummarySchema,
  type AuthStatus,
  type Device,
  type OutboxHealth,
  type OutboxItem,
  type OutboxState,
  type RecordingMirror,
  type RuntimeConfig,
  type SyncFilters,
  type SyncRunMode,
  type SyncRunSummary,
  type WebhookPayload,
} from "@plaud-mirror/shared";

interface SyncRunRow {
  id: string;
  mode: string;
  status: string;
  filters_json: string;
  started_at: string;
  finished_at: string | null;
  examined: number;
  matched: number;
  downloaded: number;
  delivered: number;
  enqueued: number;
  skipped: number;
  plaud_total: number | null;
  error_message: string | null;
}

interface DeviceRow {
  serial_number: string;
  display_name: string;
  model: string;
  firmware_version: number | null;
  last_seen_at: string;
}

interface RecordingRow {
  id: string;
  title: string;
  created_at: string | null;
  duration_seconds: number;
  serial_number: string | null;
  scene: number | null;
  local_path: string | null;
  content_type: string | null;
  bytes_written: number;
  mirrored_at: string | null;
  last_webhook_status: "skipped" | "queued" | "success" | "failed" | null;
  last_webhook_attempt_at: string | null;
  dismissed: number;
  dismissed_at: string | null;
  sequence_number: number | null;
}

export interface DeliveryAttemptRecord {
  recordingId: string;
  status: "skipped" | "success" | "failed";
  webhookUrl: string | null;
  httpStatus: number | null;
  errorMessage: string | null;
  payloadJson: string;
  attemptedAt: string;
}

export interface RuntimeStoreConfig {
  dbPath: string;
  dataDir: string;
  recordingsDir: string;
  defaultSyncLimit: number;
}

const DEFAULT_AUTH_STATUS: AuthStatus = {
  mode: "manual-token",
  configured: false,
  state: "missing",
  resolvedApiBase: null,
  lastValidatedAt: null,
  lastError: null,
  userSummary: null,
};

export class RuntimeStore {
  private readonly db: Database.Database;
  private readonly dataDir: string;
  private readonly recordingsDir: string;
  private readonly defaultSyncLimit: number;

  constructor(config: RuntimeStoreConfig) {
    mkdirSync(dirname(config.dbPath), { recursive: true });
    this.db = new Database(config.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.dataDir = config.dataDir;
    this.recordingsDir = config.recordingsDir;
    this.defaultSyncLimit = config.defaultSyncLimit;
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  seedWebhookDefaults(webhookUrl?: string): void {
    if (webhookUrl && !this.getSetting<string>("config.webhookUrl")) {
      this.setSetting("config.webhookUrl", webhookUrl);
    }
  }

  /**
   * Seed `config.schedulerIntervalMs` from the env-var bootstrap value, but
   * only when the SQLite row is absent. Once the operator touches the
   * panel even once, the SQLite value wins and the env var stops mattering
   * — that is the whole point of moving the knob to the UI in v0.5.2.
   */
  seedSchedulerDefaults(intervalMs: number): void {
    if (this.getSetting<string>("config.schedulerIntervalMs") === null) {
      this.setSetting("config.schedulerIntervalMs", String(intervalMs));
    }
  }

  getConfig(hasWebhookSecret: boolean): RuntimeConfig {
    const rawInterval = this.getSetting<string>("config.schedulerIntervalMs");
    const schedulerIntervalMs = rawInterval === null ? 0 : Number.parseInt(rawInterval, 10);
    return RuntimeConfigSchema.parse({
      dataDir: this.dataDir,
      recordingsDir: this.recordingsDir,
      webhookUrl: this.getSetting<string>("config.webhookUrl") ?? null,
      hasWebhookSecret,
      defaultSyncLimit: this.defaultSyncLimit,
      schedulerIntervalMs: Number.isFinite(schedulerIntervalMs) ? schedulerIntervalMs : 0,
    });
  }

  saveConfig(input: { webhookUrl?: string | null; schedulerIntervalMs?: number }): RuntimeConfig {
    if (input.webhookUrl !== undefined) {
      if (input.webhookUrl) {
        this.setSetting("config.webhookUrl", input.webhookUrl);
      } else {
        this.deleteSetting("config.webhookUrl");
      }
    }

    if (input.schedulerIntervalMs !== undefined) {
      // Always store the value, including 0, so the operator can disable
      // the scheduler from the panel after a non-zero env-var seed without
      // losing the choice on the next boot.
      this.setSetting("config.schedulerIntervalMs", String(input.schedulerIntervalMs));
    }

    return this.getConfig(Boolean(this.getSetting<string>("config.webhookSecretSentinel")));
  }

  setWebhookSecretPresence(hasSecret: boolean): void {
    if (hasSecret) {
      this.setSetting("config.webhookSecretSentinel", "present");
      return;
    }

    this.deleteSetting("config.webhookSecretSentinel");
  }

  getAuthStatus(configured: boolean): AuthStatus {
    const stored = this.getJsonSetting<AuthStatus>("auth.status");
    return AuthStatusSchema.parse({
      ...(stored ?? DEFAULT_AUTH_STATUS),
      configured,
      state: configured ? (stored?.state ?? "degraded") : "missing",
    });
  }

  saveAuthStatus(status: AuthStatus): AuthStatus {
    this.setJsonSetting("auth.status", status);
    return status;
  }

  countRecordings(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM recordings WHERE dismissed = 0").get() as { count: number };
    return row.count;
  }

  countDismissed(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM recordings WHERE dismissed = 1").get() as { count: number };
    return row.count;
  }

  upsertDevice(device: Device): Device {
    const normalized = DeviceSchema.parse(device);
    this.db.prepare(`
      INSERT INTO devices (
        serial_number,
        display_name,
        model,
        firmware_version,
        last_seen_at
      ) VALUES (@serialNumber, @displayName, @model, @firmwareVersion, @lastSeenAt)
      ON CONFLICT(serial_number) DO UPDATE SET
        display_name = excluded.display_name,
        model = excluded.model,
        firmware_version = excluded.firmware_version,
        last_seen_at = excluded.last_seen_at
    `).run({
      serialNumber: normalized.serialNumber,
      displayName: normalized.displayName,
      model: normalized.model,
      firmwareVersion: normalized.firmwareVersion,
      lastSeenAt: normalized.lastSeenAt,
    });
    return normalized;
  }

  // Bulk upsert inside a single transaction so a multi-device refresh is
  // atomic. Returns the count of rows written so the caller can log it.
  upsertDevices(devices: Device[]): number {
    if (devices.length === 0) {
      return 0;
    }
    const insert = this.db.prepare(`
      INSERT INTO devices (
        serial_number,
        display_name,
        model,
        firmware_version,
        last_seen_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(serial_number) DO UPDATE SET
        display_name = excluded.display_name,
        model = excluded.model,
        firmware_version = excluded.firmware_version,
        last_seen_at = excluded.last_seen_at
    `);
    const transaction = this.db.transaction((items: Device[]) => {
      for (const item of items) {
        const normalized = DeviceSchema.parse(item);
        insert.run(
          normalized.serialNumber,
          normalized.displayName,
          normalized.model,
          normalized.firmwareVersion,
          normalized.lastSeenAt,
        );
      }
    });
    transaction(devices);
    return devices.length;
  }

  listDevices(): Device[] {
    const rows = this.db.prepare(`
      SELECT
        serial_number,
        display_name,
        model,
        firmware_version,
        last_seen_at
      FROM devices
      ORDER BY last_seen_at DESC, serial_number ASC
    `).all() as DeviceRow[];
    return rows.map(mapDeviceRow);
  }

  getDevice(serialNumber: string): Device | null {
    const row = this.db.prepare(`
      SELECT
        serial_number,
        display_name,
        model,
        firmware_version,
        last_seen_at
      FROM devices
      WHERE serial_number = ?
    `).get(serialNumber) as DeviceRow | undefined;
    return row ? mapDeviceRow(row) : null;
  }

  listRecordings(
    limit: number,
    options: { includeDismissed?: boolean; skip?: number } = {},
  ): { recordings: RecordingMirror[]; total: number } {
    const whereClause = options.includeDismissed ? "" : "WHERE dismissed = 0";
    const skip = Math.max(0, options.skip ?? 0);

    const totalRow = this.db.prepare(`
      SELECT COUNT(*) AS count FROM recordings ${whereClause}
    `).get() as { count: number };

    const rows = this.db.prepare(`
      SELECT
        id,
        title,
        created_at,
        duration_seconds,
        serial_number,
        scene,
        local_path,
        content_type,
        bytes_written,
        mirrored_at,
        last_webhook_status,
        last_webhook_attempt_at,
        dismissed,
        dismissed_at,
        sequence_number
      FROM recordings
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(limit, skip) as RecordingRow[];

    return { recordings: rows.map(mapRecordingRow), total: totalRow.count };
  }

  getRecording(recordingId: string): RecordingMirror | null {
    const row = this.db.prepare(`
      SELECT
        id,
        title,
        created_at,
        duration_seconds,
        serial_number,
        scene,
        local_path,
        content_type,
        bytes_written,
        mirrored_at,
        last_webhook_status,
        last_webhook_attempt_at,
        dismissed,
        dismissed_at,
        sequence_number
      FROM recordings
      WHERE id = ?
    `).get(recordingId) as RecordingRow | undefined;

    return row ? mapRecordingRow(row) : null;
  }

  updateSequenceNumbers(ranks: Map<string, number>): void {
    if (ranks.size === 0) {
      return;
    }
    const update = this.db.prepare(`
      UPDATE recordings SET sequence_number = ? WHERE id = ?
    `);
    const transaction = this.db.transaction((entries: Array<[string, number]>) => {
      for (const [id, rank] of entries) {
        update.run(rank, id);
      }
    });
    transaction(Array.from(ranks.entries()));
  }

  setRecordingDismissed(recordingId: string, dismissed: boolean): RecordingMirror | null {
    const timestamp = dismissed ? new Date().toISOString() : null;
    this.db.prepare(`
      UPDATE recordings
      SET dismissed = ?, dismissed_at = ?
      WHERE id = ?
    `).run(dismissed ? 1 : 0, timestamp, recordingId);

    return this.getRecording(recordingId);
  }

  upsertRecording(recording: RecordingMirror): RecordingMirror {
    const normalized = RecordingMirrorSchema.parse(recording);
    this.db.prepare(`
      INSERT INTO recordings (
        id,
        title,
        created_at,
        duration_seconds,
        serial_number,
        scene,
        local_path,
        content_type,
        bytes_written,
        mirrored_at,
        last_webhook_status,
        last_webhook_attempt_at,
        dismissed,
        dismissed_at,
        sequence_number
      ) VALUES (
        @id,
        @title,
        @createdAt,
        @durationSeconds,
        @serialNumber,
        @scene,
        @localPath,
        @contentType,
        @bytesWritten,
        @mirroredAt,
        @lastWebhookStatus,
        @lastWebhookAttemptAt,
        @dismissed,
        @dismissedAt,
        @sequenceNumber
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        created_at = excluded.created_at,
        duration_seconds = excluded.duration_seconds,
        serial_number = excluded.serial_number,
        scene = excluded.scene,
        local_path = excluded.local_path,
        content_type = excluded.content_type,
        bytes_written = excluded.bytes_written,
        mirrored_at = excluded.mirrored_at,
        last_webhook_status = excluded.last_webhook_status,
        last_webhook_attempt_at = excluded.last_webhook_attempt_at,
        dismissed = excluded.dismissed,
        dismissed_at = excluded.dismissed_at,
        sequence_number = COALESCE(excluded.sequence_number, recordings.sequence_number)
    `).run({
      id: normalized.id,
      title: normalized.title,
      createdAt: normalized.createdAt,
      durationSeconds: normalized.durationSeconds,
      serialNumber: normalized.serialNumber,
      scene: normalized.scene,
      localPath: normalized.localPath,
      contentType: normalized.contentType,
      bytesWritten: normalized.bytesWritten,
      mirroredAt: normalized.mirroredAt,
      lastWebhookStatus: normalized.lastWebhookStatus,
      lastWebhookAttemptAt: normalized.lastWebhookAttemptAt,
      dismissed: normalized.dismissed ? 1 : 0,
      dismissedAt: normalized.dismissedAt,
      sequenceNumber: normalized.sequenceNumber,
    });

    return normalized;
  }

  startSyncRun(mode: SyncRunMode, filters: SyncFilters): { id: string; startedAt: string } {
    const id = randomUUID();
    const startedAt = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO sync_runs (
        id,
        mode,
        status,
        filters_json,
        started_at,
        finished_at,
        examined,
        matched,
        downloaded,
        delivered,
        enqueued,
        skipped,
        error_message
      ) VALUES (?, ?, 'running', ?, ?, NULL, 0, 0, 0, 0, 0, 0, NULL)
    `).run(id, mode, JSON.stringify(filters), startedAt);

    return { id, startedAt };
  }

  finishSyncRun(summary: SyncRunSummary): SyncRunSummary {
    const normalized = SyncRunSummarySchema.parse(summary);
    this.db.prepare(`
      UPDATE sync_runs
      SET
        status = ?,
        filters_json = ?,
        finished_at = ?,
        examined = ?,
        matched = ?,
        downloaded = ?,
        delivered = ?,
        enqueued = ?,
        skipped = ?,
        plaud_total = ?,
        error_message = ?
      WHERE id = ?
    `).run(
      normalized.status,
      JSON.stringify(normalized.filters),
      normalized.finishedAt,
      normalized.examined,
      normalized.matched,
      normalized.downloaded,
      normalized.delivered,
      normalized.enqueued,
      normalized.skipped,
      normalized.plaudTotal,
      normalized.error,
      normalized.id,
    );

    return normalized;
  }

  getLastSyncRun(): SyncRunSummary | null {
    // Return the most recent FINISHED run. Stats shown in the UI ("Plaud
    // total", "Last run", hero metric) read from this so they stay stable
    // while a new async run is in flight. Running rows are exposed separately
    // via getActiveSyncRun().
    const row = this.db.prepare(`
      SELECT
        id,
        mode,
        status,
        filters_json,
        started_at,
        finished_at,
        examined,
        matched,
        downloaded,
        delivered,
        enqueued,
        skipped,
        plaud_total,
        error_message
      FROM sync_runs
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `).get() as SyncRunRow | undefined;

    if (!row) {
      return null;
    }

    return mapSyncRunRow(row);
  }

  getActiveSyncRun(): SyncRunSummary | null {
    // Return the most recent run that is still `status='running'`. Used by
    // the health endpoint to expose in-flight progress to the UI poller.
    const row = this.db.prepare(`
      SELECT
        id,
        mode,
        status,
        filters_json,
        started_at,
        finished_at,
        examined,
        matched,
        downloaded,
        delivered,
        enqueued,
        skipped,
        plaud_total,
        error_message
      FROM sync_runs
      WHERE status = 'running'
      ORDER BY started_at DESC
      LIMIT 1
    `).get() as SyncRunRow | undefined;

    if (!row) {
      return null;
    }

    return mapSyncRunRow(row);
  }

  getSyncRun(id: string): SyncRunSummary | null {
    const row = this.db.prepare(`
      SELECT
        id,
        mode,
        status,
        filters_json,
        started_at,
        finished_at,
        examined,
        matched,
        downloaded,
        delivered,
        enqueued,
        skipped,
        plaud_total,
        error_message
      FROM sync_runs
      WHERE id = ?
    `).get(id) as SyncRunRow | undefined;

    return row ? mapSyncRunRow(row) : null;
  }

  // Incremental in-progress update from the async worker. Does NOT touch
  // status, finished_at, or error_message — those are owned by finishSyncRun.
  updateSyncRunProgress(
    id: string,
    progress: { examined?: number; matched?: number; downloaded?: number; delivered?: number; enqueued?: number; skipped?: number; plaudTotal?: number },
  ): void {
    const sets: string[] = [];
    const values: Array<number> = [];
    if (progress.examined !== undefined) { sets.push("examined = ?"); values.push(progress.examined); }
    if (progress.matched !== undefined) { sets.push("matched = ?"); values.push(progress.matched); }
    if (progress.downloaded !== undefined) { sets.push("downloaded = ?"); values.push(progress.downloaded); }
    if (progress.delivered !== undefined) { sets.push("delivered = ?"); values.push(progress.delivered); }
    if (progress.enqueued !== undefined) { sets.push("enqueued = ?"); values.push(progress.enqueued); }
    if (progress.skipped !== undefined) { sets.push("skipped = ?"); values.push(progress.skipped); }
    if (progress.plaudTotal !== undefined) { sets.push("plaud_total = ?"); values.push(progress.plaudTotal); }
    if (sets.length === 0) {
      return;
    }
    this.db.prepare(`UPDATE sync_runs SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
  }

  recordDeliveryAttempt(attempt: DeliveryAttemptRecord): void {
    this.db.prepare(`
      INSERT INTO webhook_deliveries (
        id,
        recording_id,
        status,
        webhook_url,
        http_status,
        error_message,
        payload_json,
        attempted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      attempt.recordingId,
      attempt.status,
      attempt.webhookUrl,
      attempt.httpStatus,
      attempt.errorMessage,
      attempt.payloadJson,
      attempt.attemptedAt,
    );
  }

  countDeliveryAttempts(recordingId: string): number {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM webhook_deliveries
      WHERE recording_id = ?
    `).get(recordingId) as { count: number };

    return row.count;
  }

  // ─── Webhook outbox (D-013, v0.5.3) ───────────────────────────────────

  /**
   * Insert a new payload into the outbox in `pending` state. Returns the
   * row that was inserted (with its generated id and timestamps) so the
   * caller can log it or surface the id for tests.
   */
  enqueueOutboxItem(input: { recordingId: string; payload: WebhookPayload }): OutboxItem {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO webhook_outbox (id, recording_id, payload_json, state, attempts, next_attempt_at, last_error, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', 0, NULL, NULL, ?, ?)
    `).run(id, input.recordingId, JSON.stringify(input.payload), now, now);
    return this.requireOutboxItem(id);
  }

  /**
   * Atomically claim the next deliverable item: the oldest row in
   * `pending` or `retry_waiting` whose `next_attempt_at` (when set) has
   * passed. Returns null when the queue is empty or no row is yet due.
   *
   * The transition `→ delivering` is wrapped in a single UPDATE-by-id
   * with a state guard so two concurrent claims (e.g. a tick + a manual
   * UI retry) cannot both pick the same row.
   */
  claimOutboxItem(now: Date = new Date()): OutboxItem | null {
    const candidate = this.db.prepare(`
      SELECT id, state FROM webhook_outbox
      WHERE state IN ('pending','retry_waiting')
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      ORDER BY datetime(COALESCE(next_attempt_at, created_at)) ASC, created_at ASC
      LIMIT 1
    `).get(now.toISOString()) as { id: string; state: string } | undefined;
    if (!candidate) {
      return null;
    }

    const result = this.db.prepare(`
      UPDATE webhook_outbox
      SET state = 'delivering', updated_at = ?
      WHERE id = ? AND state = ?
    `).run(now.toISOString(), candidate.id, candidate.state);
    if (result.changes === 0) {
      // Lost the race — another claimant flipped the row first.
      return null;
    }
    return this.requireOutboxItem(candidate.id);
  }

  /** Mark a `delivering` row as `delivered`. Increments `attempts`. */
  markOutboxDelivered(id: string): OutboxItem {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE webhook_outbox
      SET state = 'delivered',
          attempts = attempts + 1,
          next_attempt_at = NULL,
          last_error = NULL,
          updated_at = ?
      WHERE id = ? AND state = 'delivering'
    `).run(now, id);
    if (result.changes === 0) {
      throw new Error(`webhook_outbox ${id} is not in 'delivering' state`);
    }
    return this.requireOutboxItem(id);
  }

  /**
   * Mark a `delivering` row as `retry_waiting` with the next-attempt
   * deadline applied. Bumps `attempts`. The caller decides the deadline
   * (the worker computes it from the backoff schedule based on the new
   * attempt count).
   */
  markOutboxRetry(id: string, nextAttemptAt: Date, errorMessage: string): OutboxItem {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE webhook_outbox
      SET state = 'retry_waiting',
          attempts = attempts + 1,
          next_attempt_at = ?,
          last_error = ?,
          updated_at = ?
      WHERE id = ? AND state = 'delivering'
    `).run(nextAttemptAt.toISOString(), errorMessage, now, id);
    if (result.changes === 0) {
      throw new Error(`webhook_outbox ${id} is not in 'delivering' state`);
    }
    return this.requireOutboxItem(id);
  }

  /** Mark a `delivering` row as `permanently_failed`. */
  markOutboxPermanentlyFailed(id: string, errorMessage: string): OutboxItem {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE webhook_outbox
      SET state = 'permanently_failed',
          attempts = attempts + 1,
          next_attempt_at = NULL,
          last_error = ?,
          updated_at = ?
      WHERE id = ? AND state = 'delivering'
    `).run(errorMessage, now, id);
    if (result.changes === 0) {
      throw new Error(`webhook_outbox ${id} is not in 'delivering' state`);
    }
    return this.requireOutboxItem(id);
  }

  /**
   * Force a `permanently_failed` row back into `pending` so the worker
   * re-attempts delivery on its next tick. Resets `attempts` to 0 and
   * clears `last_error`. Throws if the row is in any other state — the
   * UI must not be able to retry an in-flight or already-delivered item.
   */
  forceOutboxRetry(id: string): OutboxItem {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE webhook_outbox
      SET state = 'pending',
          attempts = 0,
          next_attempt_at = ?,
          last_error = NULL,
          updated_at = ?
      WHERE id = ? AND state = 'permanently_failed'
    `).run(now, now, id);
    if (result.changes === 0) {
      throw new Error(`webhook_outbox ${id} is not in 'permanently_failed' state (force-retry rejected)`);
    }
    return this.requireOutboxItem(id);
  }

  /** Live counters for `/api/health.outbox`. */
  getOutboxHealth(now: Date = new Date()): OutboxHealth {
    const counts = this.db.prepare(`
      SELECT state, COUNT(*) AS count FROM webhook_outbox
      WHERE state IN ('pending','retry_waiting','permanently_failed')
      GROUP BY state
    `).all() as Array<{ state: string; count: number }>;
    const byState = new Map(counts.map((row) => [row.state, row.count]));

    const oldestRow = this.db.prepare(`
      SELECT MIN(created_at) AS oldest FROM webhook_outbox
      WHERE state IN ('pending','retry_waiting')
    `).get() as { oldest: string | null } | undefined;
    const oldestPendingAgeMs = oldestRow?.oldest
      ? Math.max(0, now.getTime() - new Date(oldestRow.oldest).getTime())
      : null;

    return {
      pending: byState.get("pending") ?? 0,
      retryWaiting: byState.get("retry_waiting") ?? 0,
      permanentlyFailed: byState.get("permanently_failed") ?? 0,
      oldestPendingAgeMs,
    };
  }

  /**
   * Return all `permanently_failed` rows so the panel can render them
   * with a "Retry" button. Newest-first so a flaky downstream that just
   * gave up shows up at the top.
   */
  listFailedOutboxItems(): OutboxItem[] {
    const rows = this.db.prepare(`
      SELECT id, recording_id, state, attempts, next_attempt_at, last_error, created_at, updated_at
      FROM webhook_outbox
      WHERE state = 'permanently_failed'
      ORDER BY updated_at DESC
    `).all() as OutboxRowWithoutPayload[];
    return rows.map((row) => mapOutboxRow(row));
  }

  /** Read the payload for an item that the worker is about to deliver. */
  getOutboxPayload(id: string): WebhookPayload | null {
    const row = this.db.prepare(`
      SELECT payload_json FROM webhook_outbox WHERE id = ?
    `).get(id) as { payload_json: string } | undefined;
    return row ? (JSON.parse(row.payload_json) as WebhookPayload) : null;
  }

  /** Test/diagnostic accessor; not used by production runtime. */
  getOutboxItem(id: string): OutboxItem | null {
    const row = this.db.prepare(`
      SELECT id, recording_id, state, attempts, next_attempt_at, last_error, created_at, updated_at
      FROM webhook_outbox WHERE id = ?
    `).get(id) as OutboxRowWithoutPayload | undefined;
    return row ? mapOutboxRow(row) : null;
  }

  private requireOutboxItem(id: string): OutboxItem {
    const item = this.getOutboxItem(id);
    if (!item) {
      throw new Error(`webhook_outbox ${id} disappeared between write and read`);
    }
    return item;
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recordings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT,
        duration_seconds REAL NOT NULL DEFAULT 0,
        serial_number TEXT,
        scene INTEGER,
        local_path TEXT,
        content_type TEXT,
        bytes_written INTEGER NOT NULL DEFAULT 0,
        mirrored_at TEXT,
        last_webhook_status TEXT,
        last_webhook_attempt_at TEXT,
        dismissed INTEGER NOT NULL DEFAULT 0,
        dismissed_at TEXT,
        sequence_number INTEGER
      );

      CREATE TABLE IF NOT EXISTS sync_runs (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        filters_json TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        examined INTEGER NOT NULL DEFAULT 0,
        matched INTEGER NOT NULL DEFAULT 0,
        downloaded INTEGER NOT NULL DEFAULT 0,
        delivered INTEGER NOT NULL DEFAULT 0,
        enqueued INTEGER NOT NULL DEFAULT 0,
        skipped INTEGER NOT NULL DEFAULT 0,
        plaud_total INTEGER,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS devices (
        serial_number TEXT PRIMARY KEY,
        display_name TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        firmware_version INTEGER,
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL,
        status TEXT NOT NULL,
        webhook_url TEXT,
        http_status INTEGER,
        error_message TEXT,
        payload_json TEXT NOT NULL,
        attempted_at TEXT NOT NULL
      );

      -- Durable webhook outbox (D-013, v0.5.3). Each row is a payload
      -- pending delivery. The worker walks pending + retry_waiting rows
      -- whose next_attempt_at is due, claims one atomically, retries with
      -- exponential backoff, and either delivers it or escalates to
      -- permanently_failed after 8 attempts. webhook_deliveries stays as
      -- the append-only audit log (every attempt records there); this
      -- table holds the live retry state.
      CREATE TABLE IF NOT EXISTS webhook_outbox (
        id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('pending','delivering','delivered','retry_waiting','permanently_failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_outbox_state_next
        ON webhook_outbox (state, next_attempt_at);
      CREATE INDEX IF NOT EXISTS idx_webhook_outbox_recording
        ON webhook_outbox (recording_id);
    `);

    // Additive migration for pre-0.4.0 databases that predate the dismissed columns.
    const columns = this.db.prepare("PRAGMA table_info(recordings)").all() as Array<{ name: string }>;
    const columnNames = new Set(columns.map((column) => column.name));
    if (!columnNames.has("dismissed")) {
      this.db.exec("ALTER TABLE recordings ADD COLUMN dismissed INTEGER NOT NULL DEFAULT 0");
    }
    if (!columnNames.has("dismissed_at")) {
      this.db.exec("ALTER TABLE recordings ADD COLUMN dismissed_at TEXT");
    }
    if (!columnNames.has("sequence_number")) {
      this.db.exec("ALTER TABLE recordings ADD COLUMN sequence_number INTEGER");
    }

    // Additive migration for pre-0.4.6 databases that predate the plaud_total column.
    const syncRunColumns = this.db.prepare("PRAGMA table_info(sync_runs)").all() as Array<{ name: string }>;
    const syncRunColumnNames = new Set(syncRunColumns.map((column) => column.name));
    if (!syncRunColumnNames.has("plaud_total")) {
      this.db.exec("ALTER TABLE sync_runs ADD COLUMN plaud_total INTEGER");
    }
    // Additive migration for pre-0.5.3 databases that predate the
    // outbox-driven `enqueued` counter.
    if (!syncRunColumnNames.has("enqueued")) {
      this.db.exec("ALTER TABLE sync_runs ADD COLUMN enqueued INTEGER NOT NULL DEFAULT 0");
    }
  }

  private getSetting<T = string>(key: string): T | null {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
    return row ? (row.value as T) : null;
  }

  private setSetting(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  private deleteSetting(key: string): void {
    this.db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  }

  private getJsonSetting<T>(key: string): T | null {
    const raw = this.getSetting<string>(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  private setJsonSetting(key: string, value: unknown): void {
    this.setSetting(key, JSON.stringify(value));
  }
}

interface OutboxRowWithoutPayload {
  id: string;
  recording_id: string;
  state: string;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

function mapOutboxRow(row: OutboxRowWithoutPayload): OutboxItem {
  return OutboxItemSchema.parse({
    id: row.id,
    recordingId: row.recording_id,
    state: row.state as OutboxState,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapDeviceRow(row: DeviceRow): Device {
  return DeviceSchema.parse({
    serialNumber: row.serial_number,
    displayName: row.display_name,
    model: row.model,
    firmwareVersion: row.firmware_version,
    lastSeenAt: row.last_seen_at,
  });
}

function mapRecordingRow(row: RecordingRow): RecordingMirror {
  return RecordingMirrorSchema.parse({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    durationSeconds: Number(row.duration_seconds ?? 0),
    serialNumber: row.serial_number,
    scene: row.scene,
    localPath: row.local_path,
    contentType: row.content_type,
    bytesWritten: row.bytes_written ?? 0,
    mirroredAt: row.mirrored_at,
    lastWebhookStatus: row.last_webhook_status,
    lastWebhookAttemptAt: row.last_webhook_attempt_at,
    dismissed: Boolean(row.dismissed),
    dismissedAt: row.dismissed_at,
    sequenceNumber: row.sequence_number,
  });
}

function mapSyncRunRow(row: SyncRunRow): SyncRunSummary {
  return SyncRunSummarySchema.parse({
    id: row.id,
    mode: row.mode,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    examined: row.examined,
    matched: row.matched,
    downloaded: row.downloaded,
    delivered: row.delivered,
    enqueued: row.enqueued ?? 0,
    skipped: row.skipped,
    plaudTotal: row.plaud_total,
    filters: SyncFiltersSchema.parse(JSON.parse(row.filters_json)),
    error: row.error_message,
  });
}
