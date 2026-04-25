import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";

import {
  AuthStatusSchema,
  DeviceSchema,
  RecordingMirrorSchema,
  RuntimeConfigSchema,
  SyncFiltersSchema,
  SyncRunSummarySchema,
  type AuthStatus,
  type Device,
  type RecordingMirror,
  type RuntimeConfig,
  type SyncFilters,
  type SyncRunMode,
  type SyncRunSummary,
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
  last_webhook_status: "skipped" | "success" | "failed" | null;
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
        skipped,
        error_message
      ) VALUES (?, ?, 'running', ?, ?, NULL, 0, 0, 0, 0, 0, NULL)
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
    progress: { examined?: number; matched?: number; downloaded?: number; delivered?: number; skipped?: number; plaudTotal?: number },
  ): void {
    const sets: string[] = [];
    const values: Array<number> = [];
    if (progress.examined !== undefined) { sets.push("examined = ?"); values.push(progress.examined); }
    if (progress.matched !== undefined) { sets.push("matched = ?"); values.push(progress.matched); }
    if (progress.downloaded !== undefined) { sets.push("downloaded = ?"); values.push(progress.downloaded); }
    if (progress.delivered !== undefined) { sets.push("delivered = ?"); values.push(progress.delivered); }
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
    skipped: row.skipped,
    plaudTotal: row.plaud_total,
    filters: SyncFiltersSchema.parse(JSON.parse(row.filters_json)),
    error: row.error_message,
  });
}
