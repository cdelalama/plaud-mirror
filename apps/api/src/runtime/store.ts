import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";

import {
  AuthStatusSchema,
  DeviceSchema,
  MediaDeliverySchema,
  MirrorCoverageSchema,
  OutboxItemSchema,
  RecordingMirrorSchema,
  RuntimeConfigSchema,
  SyncFiltersSchema,
  SyncRunSummarySchema,
  TranscriptionDestinationSchema,
  UpstreamDeletionOperationSchema,
  type AuthStatus,
  type Device,
  type MediaDelivery,
  type MediaDeliveryState,
  type MirrorCoverage,
  type OutboxHealth,
  type OutboxItem,
  type OutboxState,
  type RecordingMirror,
  type RuntimeConfig,
  type SyncFilters,
  type SyncRunMode,
  type SyncRunSummary,
  type TranscriptionCoverage,
  type TranscriptionDestination,
  type TranscriptionIntakeRequest,
  type UpstreamDeletionOperation,
  type UpstreamDeletionStage,
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
  failed: number;
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
  upstream_deleted_at: string | null;
  sequence_number: number | null;
  upstream_delete_operation_id: string | null;
  upstream_delete_stage: string | null;
  upstream_delete_requested_at: string | null;
  upstream_delete_updated_at: string | null;
  upstream_delete_attempt_count: number | null;
  upstream_delete_last_error: string | null;
}

interface UpstreamDeletionOperationRow {
  operation_id: string;
  recording_id: string;
  stage: string;
  requested_at: string;
  updated_at: string;
  attempt_count: number;
  last_error: string | null;
}

interface UpstreamInventorySnapshot {
  generation: string;
  observedAt: string;
  total: number;
}

interface TranscriptionDestinationRow {
  id: string;
  name: string;
  kind: string;
  base_url: string;
  artifact_base_url: string;
  enabled: number;
  is_primary: number;
  has_intake_credential: number;
  has_status_signing_secret: number;
  has_artifact_access_token: number;
  provider_name: string | null;
  provider_version: string | null;
  last_tested_at: string | null;
  last_test_error: string | null;
  created_at: string;
  updated_at: string;
}

interface MediaDeliveryRow {
  id: string;
  destination_id: string;
  recording_id: string;
  recording_title: string;
  artifact_revision: string;
  sha256: string;
  bytes: number;
  state: string;
  intake_id: string | null;
  transcript_id: string | null;
  last_error: string | null;
  failure_stage: "admission" | "processing" | null;
  created_at: string;
  updated_at: string;
  terminal_at: string | null;
}

export interface MediaArtifactRecord {
  sha256: string;
  path: string;
  bytes: number;
  contentType: string;
  filename: string;
  durationSeconds: number;
  createdAt: string;
}

export interface ClaimedMediaOutboxItem {
  id: string;
  deliveryId: string;
  destinationId: string;
  payload: TranscriptionIntakeRequest;
  attempts: number;
  createdAt: string;
}

export interface EligibleTranscriptionRecording {
  id: string;
  title: string;
  createdAt: string | null;
  durationSeconds: number;
  localPath: string;
  contentType: string;
  bytesWritten: number;
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

export interface UpstreamDeletionEventRecord {
  eventType: string;
  stage: UpstreamDeletionStage;
  occurredAt: string;
  errorMessage: string | null;
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
    this.db.pragma("foreign_keys = ON");
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

  commitUpstreamInventory(
    remoteRecordingIds: string[],
    artifactVerifiedIds: string[],
    observedAt: string,
    total: number,
  ): { generation: string; coverage: MirrorCoverage } {
    const generation = randomUUID();
    const markSeen = this.db.prepare(`
      UPDATE recordings
      SET upstream_inventory_generation = ?, upstream_last_seen_at = ?
      WHERE id = ?
    `);
    const markVerified = this.db.prepare(`
      UPDATE recordings
      SET artifact_verified_generation = ?
      WHERE id = ?
    `);
    const transaction = this.db.transaction(() => {
      for (const recordingId of remoteRecordingIds) {
        markSeen.run(generation, observedAt, recordingId);
      }
      for (const recordingId of artifactVerifiedIds) {
        markVerified.run(generation, recordingId);
      }
      this.setJsonSetting("upstream.inventory", { generation, observedAt, total });
    });
    transaction();
    return { generation, coverage: this.getCoverage() };
  }

  markRecordingArtifactVerified(recordingId: string, generation: string): void {
    this.db.prepare(`
      UPDATE recordings
      SET upstream_inventory_generation = ?,
          artifact_verified_generation = ?
      WHERE id = ?
    `).run(generation, generation, recordingId);
  }

  getCurrentInventoryGeneration(): string | null {
    return this.getInventorySnapshot()?.generation ?? null;
  }

  getCoverage(): MirrorCoverage {
    const inventory = this.getInventorySnapshot();
    const upstreamDeleted = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM recordings
      WHERE upstream_deleted_at IS NOT NULL
    `).get() as { count: number };

    if (!inventory) {
      return MirrorCoverageSchema.parse({
        observedAt: null,
        remoteTotal: null,
        mirrored: 0,
        dismissed: 0,
        missing: null,
        localOnly: 0,
        upstreamDeleted: upstreamDeleted.count,
      });
    }

    const counts = this.db.prepare(`
      SELECT
        SUM(CASE
          WHEN dismissed = 0
            AND upstream_inventory_generation = @generation
            AND artifact_verified_generation = @generation
          THEN 1 ELSE 0 END) AS mirrored,
        SUM(CASE
          WHEN dismissed = 1
            AND upstream_inventory_generation = @generation
          THEN 1 ELSE 0 END) AS dismissed,
        SUM(CASE
          WHEN dismissed = 0
            AND local_path IS NOT NULL
            AND (upstream_inventory_generation IS NULL OR upstream_inventory_generation != @generation)
          THEN 1 ELSE 0 END) AS local_only
      FROM recordings
    `).get({ generation: inventory.generation }) as {
      mirrored: number | null;
      dismissed: number | null;
      local_only: number | null;
    };
    const mirrored = counts.mirrored ?? 0;
    const dismissed = counts.dismissed ?? 0;

    return MirrorCoverageSchema.parse({
      observedAt: inventory.observedAt,
      remoteTotal: inventory.total,
      mirrored,
      dismissed,
      missing: Math.max(0, inventory.total - mirrored - dismissed),
      localOnly: counts.local_only ?? 0,
      upstreamDeleted: upstreamDeleted.count,
    });
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
    const whereClause = options.includeDismissed ? "" : "WHERE recordings.dismissed = 0";
    const skip = Math.max(0, options.skip ?? 0);

    const totalRow = this.db.prepare(`
      SELECT COUNT(*) AS count FROM recordings ${whereClause}
    `).get() as { count: number };

    const rows = this.db.prepare(`
      SELECT
        recordings.id,
        recordings.title,
        recordings.created_at,
        recordings.duration_seconds,
        recordings.serial_number,
        recordings.scene,
        recordings.local_path,
        recordings.content_type,
        recordings.bytes_written,
        recordings.mirrored_at,
        recordings.last_webhook_status,
        recordings.last_webhook_attempt_at,
        recordings.dismissed,
        recordings.dismissed_at,
        recordings.upstream_deleted_at,
        recordings.sequence_number,
        upstream_deletion_operations.operation_id AS upstream_delete_operation_id,
        upstream_deletion_operations.stage AS upstream_delete_stage,
        upstream_deletion_operations.requested_at AS upstream_delete_requested_at,
        upstream_deletion_operations.updated_at AS upstream_delete_updated_at,
        upstream_deletion_operations.attempt_count AS upstream_delete_attempt_count,
        upstream_deletion_operations.last_error AS upstream_delete_last_error
      FROM recordings
      LEFT JOIN upstream_deletion_operations
        ON upstream_deletion_operations.recording_id = recordings.id
      ${whereClause}
      ORDER BY recordings.created_at DESC, recordings.id DESC
      LIMIT ? OFFSET ?
    `).all(limit, skip) as RecordingRow[];

    return { recordings: rows.map(mapRecordingRow), total: totalRow.count };
  }

  getRecording(recordingId: string): RecordingMirror | null {
    const row = this.db.prepare(`
      SELECT
        recordings.id,
        recordings.title,
        recordings.created_at,
        recordings.duration_seconds,
        recordings.serial_number,
        recordings.scene,
        recordings.local_path,
        recordings.content_type,
        recordings.bytes_written,
        recordings.mirrored_at,
        recordings.last_webhook_status,
        recordings.last_webhook_attempt_at,
        recordings.dismissed,
        recordings.dismissed_at,
        recordings.upstream_deleted_at,
        recordings.sequence_number,
        upstream_deletion_operations.operation_id AS upstream_delete_operation_id,
        upstream_deletion_operations.stage AS upstream_delete_stage,
        upstream_deletion_operations.requested_at AS upstream_delete_requested_at,
        upstream_deletion_operations.updated_at AS upstream_delete_updated_at,
        upstream_deletion_operations.attempt_count AS upstream_delete_attempt_count,
        upstream_deletion_operations.last_error AS upstream_delete_last_error
      FROM recordings
      LEFT JOIN upstream_deletion_operations
        ON upstream_deletion_operations.recording_id = recordings.id
      WHERE recordings.id = ?
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

  markRecordingUpstreamDeleted(recordingId: string, upstreamDeletedAt: string): RecordingMirror | null {
    this.beginUpstreamDeletion(recordingId, upstreamDeletedAt);
    return this.confirmUpstreamDeletion(recordingId, upstreamDeletedAt);
  }

  getUpstreamDeletionOperation(recordingId: string): UpstreamDeletionOperation | null {
    const row = this.db.prepare(`
      SELECT operation_id, recording_id, stage, requested_at, updated_at,
             attempt_count, last_error
      FROM upstream_deletion_operations
      WHERE recording_id = ?
    `).get(recordingId) as UpstreamDeletionOperationRow | undefined;
    return row ? mapUpstreamDeletionOperation(row) : null;
  }

  listUpstreamDeletionEvents(recordingId: string): UpstreamDeletionEventRecord[] {
    const rows = this.db.prepare(`
      SELECT event_type, stage, occurred_at, error_message
      FROM upstream_deletion_events
      WHERE recording_id = ?
      ORDER BY rowid ASC
    `).all(recordingId) as Array<{
      event_type: string;
      stage: string;
      occurred_at: string;
      error_message: string | null;
    }>;
    return rows.map((row) => ({
      eventType: row.event_type,
      stage: row.stage as UpstreamDeletionStage,
      occurredAt: row.occurred_at,
      errorMessage: row.error_message,
    }));
  }

  beginUpstreamDeletion(recordingId: string, nowIso = new Date().toISOString()): UpstreamDeletionOperation {
    const existing = this.getUpstreamDeletionOperation(recordingId);
    if (existing?.stage === "confirmed") {
      return existing;
    }

    if (existing) {
      const transaction = this.db.transaction(() => {
        this.db.prepare(`
          UPDATE upstream_deletion_operations
          SET updated_at = ?, attempt_count = attempt_count + 1, last_error = NULL
          WHERE recording_id = ?
        `).run(nowIso, recordingId);
        this.appendUpstreamDeletionEvent(existing.operationId, recordingId, "retry_started", existing.stage, nowIso, null);
      });
      transaction();
      return this.requireUpstreamDeletionOperation(recordingId);
    }

    const operationId = randomUUID();
    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO upstream_deletion_operations (
          operation_id, recording_id, stage, requested_at, updated_at,
          attempt_count, last_error
        ) VALUES (?, ?, 'requested', ?, ?, 1, NULL)
      `).run(operationId, recordingId, nowIso, nowIso);
      this.appendUpstreamDeletionEvent(operationId, recordingId, "requested", "requested", nowIso, null);
    });
    transaction();
    return this.requireUpstreamDeletionOperation(recordingId);
  }

  advanceUpstreamDeletion(
    recordingId: string,
    stage: Exclude<UpstreamDeletionStage, "requested" | "confirmed">,
    nowIso = new Date().toISOString(),
  ): UpstreamDeletionOperation {
    const operation = this.requireUpstreamDeletionOperation(recordingId);
    const eventType = stage === "trash_attempted"
      ? "trash_attempted"
      : stage === "trash_confirmed"
        ? "trash_confirmed"
        : "delete_attempted";
    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE upstream_deletion_operations
        SET stage = ?, updated_at = ?, last_error = NULL
        WHERE recording_id = ?
      `).run(stage, nowIso, recordingId);
      this.appendUpstreamDeletionEvent(operation.operationId, recordingId, eventType, stage, nowIso, null);
    });
    transaction();
    return this.requireUpstreamDeletionOperation(recordingId);
  }

  failUpstreamDeletion(
    recordingId: string,
    errorMessage: string,
    nowIso = new Date().toISOString(),
  ): UpstreamDeletionOperation {
    const operation = this.requireUpstreamDeletionOperation(recordingId);
    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE upstream_deletion_operations
        SET updated_at = ?, last_error = ?
        WHERE recording_id = ?
      `).run(nowIso, errorMessage, recordingId);
      this.appendUpstreamDeletionEvent(
        operation.operationId,
        recordingId,
        "failed",
        operation.stage,
        nowIso,
        errorMessage,
      );
    });
    transaction();
    return this.requireUpstreamDeletionOperation(recordingId);
  }

  confirmUpstreamDeletion(
    recordingId: string,
    upstreamDeletedAt: string,
  ): RecordingMirror | null {
    const operation = this.requireUpstreamDeletionOperation(recordingId);
    const transaction = this.db.transaction(() => {
      const result = this.db.prepare(`
        UPDATE recordings
        SET dismissed = 1,
            dismissed_at = COALESCE(dismissed_at, ?),
            upstream_deleted_at = COALESCE(upstream_deleted_at, ?)
        WHERE id = ?
      `).run(upstreamDeletedAt, upstreamDeletedAt, recordingId);
      if (result.changes !== 1) {
        throw new Error(`Recording ${recordingId} disappeared while confirming Plaud deletion`);
      }
      this.db.prepare(`
        UPDATE upstream_deletion_operations
        SET stage = 'confirmed', updated_at = ?, last_error = NULL
        WHERE recording_id = ?
      `).run(upstreamDeletedAt, recordingId);
      this.appendUpstreamDeletionEvent(
        operation.operationId,
        recordingId,
        "confirmed",
        "confirmed",
        upstreamDeletedAt,
        null,
      );
    });
    transaction();
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
        upstream_deleted_at,
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
        @upstreamDeletedAt,
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
        upstream_deleted_at = COALESCE(recordings.upstream_deleted_at, excluded.upstream_deleted_at),
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
      upstreamDeletedAt: normalized.upstreamDeletedAt ?? null,
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
        failed,
        error_message
      ) VALUES (?, ?, 'running', ?, ?, NULL, 0, 0, 0, 0, 0, 0, 0, NULL)
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
        failed = ?,
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
      normalized.failed,
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
        failed,
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
        failed,
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

  getRecentSyncRuns(limit: number): SyncRunSummary[] {
    // D-014 full (v0.5.5): return the last `limit` FINISHED runs, most-recent-first.
    // `lastSync` covers the very most recent — this fills in the operator-facing
    // history strip beyond it. Active runs are excluded (see getActiveSyncRun).
    const safeLimit = Math.max(0, Math.min(50, Math.trunc(limit)));
    if (safeLimit === 0) return [];
    const rows = this.db.prepare(`
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
        failed,
        plaud_total,
        error_message
      FROM sync_runs
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT ?
    `).all(safeLimit) as SyncRunRow[];
    return rows.map(mapSyncRunRow);
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
        failed,
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
    progress: { examined?: number; matched?: number; downloaded?: number; delivered?: number; enqueued?: number; skipped?: number; failed?: number; plaudTotal?: number },
  ): void {
    const sets: string[] = [];
    const values: Array<number> = [];
    if (progress.examined !== undefined) { sets.push("examined = ?"); values.push(progress.examined); }
    if (progress.matched !== undefined) { sets.push("matched = ?"); values.push(progress.matched); }
    if (progress.downloaded !== undefined) { sets.push("downloaded = ?"); values.push(progress.downloaded); }
    if (progress.delivered !== undefined) { sets.push("delivered = ?"); values.push(progress.delivered); }
    if (progress.enqueued !== undefined) { sets.push("enqueued = ?"); values.push(progress.enqueued); }
    if (progress.skipped !== undefined) { sets.push("skipped = ?"); values.push(progress.skipped); }
    if (progress.failed !== undefined) { sets.push("failed = ?"); values.push(progress.failed); }
    if (progress.plaudTotal !== undefined) { sets.push("plaud_total = ?"); values.push(progress.plaudTotal); }
    if (sets.length === 0) {
      return;
    }
    this.db.prepare(`UPDATE sync_runs SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
  }

  /**
   * Startup crash recovery, sync side (D-013 amendment, v0.6.0). A run
   * left in 'running' by a dead process would otherwise satisfy
   * getActiveSyncRun forever and block every future sync through the
   * anti-overlap guard. Marks all such rows failed with an explicit
   * recovery message. Returns the number of rows recovered.
   */
  recoverOrphanedSyncRuns(now: Date = new Date()): number {
    const result = this.db.prepare(`
      UPDATE sync_runs
      SET status = 'failed',
          finished_at = ?,
          error_message = 'recovered after process restart: run was still marked running at startup'
      WHERE status = 'running'
    `).run(now.toISOString());
    return result.changes;
  }

  /**
   * Startup crash recovery, outbox side (D-013 amendment, v0.6.0). Rows
   * left in 'delivering' by a dead process are unreachable: the worker
   * only claims pending/retry_waiting. Re-queue them as retry_waiting
   * due immediately, WITHOUT incrementing attempts — the delivery
   * outcome is unknown, so the row keeps its full backoff budget.
   * At-least-once delivery is accepted: the downstream may see a
   * duplicate if the POST landed right before the crash.
   */
  recoverOrphanedOutboxItems(now: Date = new Date()): number {
    const timestamp = now.toISOString();
    const result = this.db.prepare(`
      UPDATE webhook_outbox
      SET state = 'retry_waiting',
          next_attempt_at = ?,
          last_error = 'recovered after process restart: delivery outcome unknown, re-queued',
          updated_at = ?
      WHERE state = 'delivering'
    `).run(timestamp, timestamp);
    return result.changes;
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
      WHERE state IN ('pending','delivering','retry_waiting','permanently_failed')
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
      delivering: byState.get("delivering") ?? 0,
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

  // ─── Provider-neutral transcription destinations ──────────────────────

  saveTranscriptionDestination(destination: TranscriptionDestination): TranscriptionDestination {
    const parsed = TranscriptionDestinationSchema.parse(destination);
    const transaction = this.db.transaction(() => {
      if (parsed.primary) {
        this.db.prepare("UPDATE transcription_destinations SET is_primary = 0 WHERE id != ?").run(parsed.id);
      }
      this.db.prepare(`
        INSERT INTO transcription_destinations (
          id, name, kind, base_url, artifact_base_url, enabled, is_primary,
          has_intake_credential, has_status_signing_secret,
          has_artifact_access_token, provider_name, provider_version,
          last_tested_at, last_test_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          base_url = excluded.base_url,
          artifact_base_url = excluded.artifact_base_url,
          enabled = excluded.enabled,
          is_primary = excluded.is_primary,
          has_intake_credential = excluded.has_intake_credential,
          has_status_signing_secret = excluded.has_status_signing_secret,
          has_artifact_access_token = excluded.has_artifact_access_token,
          provider_name = excluded.provider_name,
          provider_version = excluded.provider_version,
          last_tested_at = excluded.last_tested_at,
          last_test_error = excluded.last_test_error,
          updated_at = excluded.updated_at
      `).run(
        parsed.id,
        parsed.name,
        parsed.kind,
        parsed.baseUrl,
        parsed.artifactBaseUrl,
        parsed.enabled ? 1 : 0,
        parsed.primary ? 1 : 0,
        parsed.hasIntakeCredential ? 1 : 0,
        parsed.hasStatusSigningSecret ? 1 : 0,
        parsed.hasArtifactAccessToken ? 1 : 0,
        parsed.providerName,
        parsed.providerVersion,
        parsed.lastTestedAt,
        parsed.lastTestError,
        parsed.createdAt,
        parsed.updatedAt,
      );
    });
    transaction();
    return this.requireTranscriptionDestination(parsed.id);
  }

  listTranscriptionDestinations(): TranscriptionDestination[] {
    const rows = this.db.prepare(`
      SELECT * FROM transcription_destinations
      ORDER BY is_primary DESC, created_at ASC
    `).all() as TranscriptionDestinationRow[];
    return rows.map(mapTranscriptionDestinationRow);
  }

  listEnabledTranscriptionDestinations(): TranscriptionDestination[] {
    return this.listTranscriptionDestinations().filter((destination) => destination.enabled);
  }

  getTranscriptionDestination(id: string): TranscriptionDestination | null {
    const row = this.db.prepare("SELECT * FROM transcription_destinations WHERE id = ?")
      .get(id) as TranscriptionDestinationRow | undefined;
    return row ? mapTranscriptionDestinationRow(row) : null;
  }

  recordTranscriptionDestinationTest(
    id: string,
    result: { providerName: string | null; providerVersion: string | null; error: string | null; testedAt: string },
  ): TranscriptionDestination {
    const update = this.db.prepare(`
      UPDATE transcription_destinations
      SET provider_name = ?, provider_version = ?, last_tested_at = ?,
          last_test_error = ?, updated_at = ?
      WHERE id = ?
    `).run(
      result.providerName,
      result.providerVersion,
      result.testedAt,
      result.error,
      result.testedAt,
      id,
    );
    if (update.changes === 0) {
      throw new Error(`transcription destination ${id} not found`);
    }
    return this.requireTranscriptionDestination(id);
  }

  getOrCreateTranscriptionCollectionId(): string {
    const current = this.getSetting<string>("transcription.collectionId");
    if (current) {
      return current;
    }
    const collectionId = `plaud-workspace:${randomUUID()}`;
    this.setSetting("transcription.collectionId", collectionId);
    return collectionId;
  }

  listEligibleTranscriptionRecordings(
    limit = 100,
    recordingIds?: string[],
  ): EligibleTranscriptionRecording[] {
    const inventory = this.getInventorySnapshot();
    if (!inventory) {
      return [];
    }
    const safeLimit = Math.max(1, Math.min(1000, limit));
    const ids = recordingIds?.filter(Boolean) ?? [];
    const idFilter = ids.length > 0
      ? `AND recordings.id IN (${ids.map(() => "?").join(",")})`
      : "";
    const rows = this.db.prepare(`
      SELECT recordings.id, recordings.title, recordings.created_at,
             recordings.duration_seconds, recordings.local_path,
             recordings.content_type, recordings.bytes_written
      FROM recordings
      LEFT JOIN upstream_deletion_operations
        ON upstream_deletion_operations.recording_id = recordings.id
      WHERE recordings.dismissed = 0
        AND recordings.upstream_deleted_at IS NULL
        AND recordings.local_path IS NOT NULL
        AND recordings.bytes_written > 0
        AND recordings.upstream_inventory_generation = ?
        AND recordings.artifact_verified_generation = ?
        AND upstream_deletion_operations.operation_id IS NULL
        ${idFilter}
      ORDER BY recordings.created_at ASC, recordings.id ASC
      LIMIT ?
    `).all(inventory.generation, inventory.generation, ...ids, safeLimit) as Array<{
      id: string;
      title: string;
      created_at: string | null;
      duration_seconds: number;
      local_path: string;
      content_type: string | null;
      bytes_written: number;
    }>;
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      durationSeconds: Number(row.duration_seconds),
      localPath: row.local_path,
      contentType: row.content_type ?? "application/octet-stream",
      bytesWritten: row.bytes_written,
    }));
  }

  countEligibleTranscriptionRecordings(): number {
    const inventory = this.getInventorySnapshot();
    if (!inventory) {
      return 0;
    }
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM recordings
      LEFT JOIN upstream_deletion_operations
        ON upstream_deletion_operations.recording_id = recordings.id
      WHERE recordings.dismissed = 0
        AND recordings.upstream_deleted_at IS NULL
        AND recordings.local_path IS NOT NULL
        AND recordings.bytes_written > 0
        AND recordings.upstream_inventory_generation = ?
        AND recordings.artifact_verified_generation = ?
        AND upstream_deletion_operations.operation_id IS NULL
    `).get(inventory.generation, inventory.generation) as { count: number };
    return row.count;
  }

  saveMediaArtifact(artifact: MediaArtifactRecord): MediaArtifactRecord {
    this.db.prepare(`
      INSERT INTO media_artifacts (
        sha256, path, bytes, content_type, filename, duration_seconds, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sha256) DO UPDATE SET
        path = excluded.path,
        bytes = excluded.bytes,
        content_type = excluded.content_type,
        filename = excluded.filename,
        duration_seconds = excluded.duration_seconds
    `).run(
      artifact.sha256,
      artifact.path,
      artifact.bytes,
      artifact.contentType,
      artifact.filename,
      artifact.durationSeconds,
      artifact.createdAt,
    );
    return this.requireMediaArtifact(artifact.sha256);
  }

  getMediaArtifact(sha256: string): MediaArtifactRecord | null {
    const row = this.db.prepare(`
      SELECT sha256, path, bytes, content_type, filename, duration_seconds, created_at
      FROM media_artifacts WHERE sha256 = ?
    `).get(sha256) as {
      sha256: string;
      path: string;
      bytes: number;
      content_type: string;
      filename: string;
      duration_seconds: number;
      created_at: string;
    } | undefined;
    return row ? {
      sha256: row.sha256,
      path: row.path,
      bytes: row.bytes,
      contentType: row.content_type,
      filename: row.filename,
      durationSeconds: Number(row.duration_seconds),
      createdAt: row.created_at,
    } : null;
  }

  enqueueMediaDelivery(input: {
    destinationId: string;
    recording: EligibleTranscriptionRecording;
    artifact: MediaArtifactRecord;
    payload: TranscriptionIntakeRequest;
  }): { delivery: MediaDelivery; created: boolean } {
    const existing = this.db.prepare(`
      SELECT * FROM media_deliveries
      WHERE destination_id = ? AND recording_id = ? AND artifact_revision = ?
    `).get(
      input.destinationId,
      input.recording.id,
      `sha256:${input.artifact.sha256}`,
    ) as MediaDeliveryRow | undefined;
    if (existing) {
      return { delivery: mapMediaDeliveryRow(existing), created: false };
    }

    const now = new Date().toISOString();
    const deliveryId = randomUUID();
    const outboxId = randomUUID();
    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO media_deliveries (
          id, destination_id, recording_id, recording_title,
          artifact_revision, sha256, bytes, state, intake_id, transcript_id,
          last_error, failure_stage, next_reconcile_at, reconcile_attempts,
          created_at, updated_at, terminal_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, NULL, NULL, 0, ?, ?, NULL)
      `).run(
        deliveryId,
        input.destinationId,
        input.recording.id,
        input.recording.title,
        `sha256:${input.artifact.sha256}`,
        input.artifact.sha256,
        input.artifact.bytes,
        now,
        now,
      );
      this.db.prepare(`
        INSERT INTO media_delivery_outbox (
          id, delivery_id, destination_id, payload_json, state, attempts,
          next_attempt_at, last_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'pending', 0, NULL, NULL, ?, ?)
      `).run(outboxId, deliveryId, input.destinationId, JSON.stringify(input.payload), now, now);
    });
    transaction();
    return { delivery: this.requireMediaDelivery(deliveryId), created: true };
  }

  claimMediaDeliveryOutbox(now: Date = new Date()): ClaimedMediaOutboxItem | null {
    const candidate = this.db.prepare(`
      SELECT media_delivery_outbox.id, media_delivery_outbox.state
      FROM media_delivery_outbox
      JOIN transcription_destinations
        ON transcription_destinations.id = media_delivery_outbox.destination_id
      WHERE media_delivery_outbox.state IN ('pending','retry_waiting')
        AND transcription_destinations.enabled = 1
        AND (media_delivery_outbox.next_attempt_at IS NULL OR media_delivery_outbox.next_attempt_at <= ?)
      ORDER BY datetime(COALESCE(media_delivery_outbox.next_attempt_at, media_delivery_outbox.created_at)) ASC,
               media_delivery_outbox.created_at ASC
      LIMIT 1
    `).get(now.toISOString()) as { id: string; state: string } | undefined;
    if (!candidate) {
      return null;
    }
    const transaction = this.db.transaction(() => {
      const updated = this.db.prepare(`
        UPDATE media_delivery_outbox SET state = 'delivering', updated_at = ?
        WHERE id = ? AND state = ?
      `).run(now.toISOString(), candidate.id, candidate.state);
      if (updated.changes === 0) {
        return null;
      }
      this.db.prepare(`
        UPDATE media_deliveries SET state = 'delivering', updated_at = ?
        WHERE id = (SELECT delivery_id FROM media_delivery_outbox WHERE id = ?)
          AND state = 'pending'
      `).run(now.toISOString(), candidate.id);
      return this.db.prepare(`
        SELECT id, delivery_id, destination_id, payload_json, attempts, created_at
        FROM media_delivery_outbox WHERE id = ?
      `).get(candidate.id) as {
        id: string;
        delivery_id: string;
        destination_id: string;
        payload_json: string;
        attempts: number;
        created_at: string;
      };
    });
    const row = transaction();
    return row ? {
      id: row.id,
      deliveryId: row.delivery_id,
      destinationId: row.destination_id,
      payload: JSON.parse(row.payload_json) as TranscriptionIntakeRequest,
      attempts: row.attempts,
      createdAt: row.created_at,
    } : null;
  }

  markMediaDeliveryAdmitted(
    outboxId: string,
    admission: { intakeId: string; state: "accepted" | "processing" | "transcribed" | "failed" },
    now: Date = new Date(),
  ): MediaDelivery {
    const timestamp = now.toISOString();
    const terminal = admission.state === "transcribed" || admission.state === "failed";
    const transaction = this.db.transaction(() => {
      const outbox = this.db.prepare(`
        UPDATE media_delivery_outbox
        SET state = 'delivered', attempts = attempts + 1, next_attempt_at = NULL,
            last_error = NULL, updated_at = ?
        WHERE id = ? AND state = 'delivering'
      `).run(timestamp, outboxId);
      if (outbox.changes === 0) {
        throw new Error(`media_delivery_outbox ${outboxId} is not delivering`);
      }
      this.db.prepare(`
        UPDATE media_deliveries
        SET state = ?, intake_id = ?, last_error = NULL,
            failure_stage = ?, next_reconcile_at = ?, updated_at = ?, terminal_at = ?
        WHERE id = (SELECT delivery_id FROM media_delivery_outbox WHERE id = ?)
      `).run(
        admission.state,
        admission.intakeId,
        admission.state === "failed" ? "processing" : null,
        terminal ? null : new Date(now.getTime() + 5 * 60_000).toISOString(),
        timestamp,
        terminal ? timestamp : null,
        outboxId,
      );
    });
    transaction();
    const row = this.db.prepare(`
      SELECT delivery_id FROM media_delivery_outbox WHERE id = ?
    `).get(outboxId) as { delivery_id: string };
    return this.requireMediaDelivery(row.delivery_id);
  }

  markMediaDeliveryRetry(
    outboxId: string,
    nextAttemptAt: Date,
    errorMessage: string,
  ): MediaDelivery {
    const timestamp = new Date().toISOString();
    const transaction = this.db.transaction(() => {
      const updated = this.db.prepare(`
        UPDATE media_delivery_outbox
        SET state = 'retry_waiting', attempts = attempts + 1,
            next_attempt_at = ?, last_error = ?, updated_at = ?
        WHERE id = ? AND state = 'delivering'
      `).run(nextAttemptAt.toISOString(), errorMessage, timestamp, outboxId);
      if (updated.changes === 0) {
        throw new Error(`media_delivery_outbox ${outboxId} is not delivering`);
      }
      this.db.prepare(`
        UPDATE media_deliveries SET state = 'pending', last_error = ?, failure_stage = NULL, updated_at = ?
        WHERE id = (SELECT delivery_id FROM media_delivery_outbox WHERE id = ?)
      `).run(errorMessage, timestamp, outboxId);
    });
    transaction();
    const row = this.db.prepare("SELECT delivery_id FROM media_delivery_outbox WHERE id = ?")
      .get(outboxId) as { delivery_id: string };
    return this.requireMediaDelivery(row.delivery_id);
  }

  markMediaDeliveryPermanentlyFailed(
    outboxId: string,
    errorMessage: string,
    conflict = false,
  ): MediaDelivery {
    const timestamp = new Date().toISOString();
    const transaction = this.db.transaction(() => {
      const updated = this.db.prepare(`
        UPDATE media_delivery_outbox
        SET state = 'permanently_failed', attempts = attempts + 1,
            next_attempt_at = NULL, last_error = ?, updated_at = ?
        WHERE id = ? AND state = 'delivering'
      `).run(errorMessage, timestamp, outboxId);
      if (updated.changes === 0) {
        throw new Error(`media_delivery_outbox ${outboxId} is not delivering`);
      }
      this.db.prepare(`
        UPDATE media_deliveries
        SET state = ?, last_error = ?, failure_stage = 'admission', updated_at = ?, terminal_at = ?
        WHERE id = (SELECT delivery_id FROM media_delivery_outbox WHERE id = ?)
      `).run(conflict ? "conflict" : "failed", errorMessage, timestamp, timestamp, outboxId);
    });
    transaction();
    const row = this.db.prepare("SELECT delivery_id FROM media_delivery_outbox WHERE id = ?")
      .get(outboxId) as { delivery_id: string };
    return this.requireMediaDelivery(row.delivery_id);
  }

  forceMediaDeliveryRetry(deliveryId: string): MediaDelivery {
    const timestamp = new Date().toISOString();
    const transaction = this.db.transaction(() => {
      const updated = this.db.prepare(`
        UPDATE media_delivery_outbox
        SET state = 'pending', attempts = 0, next_attempt_at = ?,
            last_error = NULL, updated_at = ?
        WHERE delivery_id = ? AND state = 'permanently_failed'
      `).run(timestamp, timestamp, deliveryId);
      if (updated.changes === 0) {
        throw new Error(`media delivery ${deliveryId} is not retryable`);
      }
      this.db.prepare(`
        UPDATE media_deliveries SET state = 'pending', last_error = NULL,
            failure_stage = NULL, terminal_at = NULL, updated_at = ? WHERE id = ?
      `).run(timestamp, deliveryId);
    });
    transaction();
    return this.requireMediaDelivery(deliveryId);
  }

  recoverOrphanedMediaDeliveries(now: Date = new Date()): number {
    const timestamp = now.toISOString();
    const transaction = this.db.transaction(() => {
      const rows = this.db.prepare(`
        SELECT delivery_id FROM media_delivery_outbox WHERE state = 'delivering'
      `).all() as Array<{ delivery_id: string }>;
      if (rows.length === 0) {
        return 0;
      }
      this.db.prepare(`
        UPDATE media_delivery_outbox
        SET state = 'retry_waiting', next_attempt_at = ?,
            last_error = 'recovered after process restart: admission outcome unknown',
            updated_at = ? WHERE state = 'delivering'
      `).run(timestamp, timestamp);
      const updateDelivery = this.db.prepare(`
        UPDATE media_deliveries SET state = 'pending',
            last_error = 'recovered after process restart: admission outcome unknown',
            updated_at = ? WHERE id = ? AND state = 'delivering'
      `);
      for (const row of rows) {
        updateDelivery.run(timestamp, row.delivery_id);
      }
      return rows.length;
    });
    return transaction();
  }

  getMediaDelivery(id: string): MediaDelivery | null {
    const row = this.db.prepare("SELECT * FROM media_deliveries WHERE id = ?")
      .get(id) as MediaDeliveryRow | undefined;
    return row ? mapMediaDeliveryRow(row) : null;
  }

  getMediaDeliveryByIntake(destinationId: string, intakeId: string): MediaDelivery | null {
    const row = this.db.prepare(`
      SELECT * FROM media_deliveries WHERE destination_id = ? AND intake_id = ?
    `).get(destinationId, intakeId) as MediaDeliveryRow | undefined;
    return row ? mapMediaDeliveryRow(row) : null;
  }

  listMediaDeliveries(destinationId: string, limit = 100): MediaDelivery[] {
    const rows = this.db.prepare(`
      SELECT * FROM media_deliveries WHERE destination_id = ?
      ORDER BY updated_at DESC LIMIT ?
    `).all(destinationId, Math.max(1, Math.min(500, limit))) as MediaDeliveryRow[];
    return rows.map(mapMediaDeliveryRow);
  }

  getTranscriptionCoverage(destinationId: string): TranscriptionCoverage {
    const eligible = this.countEligibleTranscriptionRecordings();
    const inventory = this.getInventorySnapshot();
    if (!inventory) {
      return { eligible: 0, notSent: 0, pending: 0, accepted: 0, processing: 0, transcribed: 0, failed: 0, conflict: 0 };
    }
    const rows = this.db.prepare(`
      WITH ranked AS (
        SELECT media_deliveries.state,
               ROW_NUMBER() OVER (
                 PARTITION BY media_deliveries.recording_id
                 ORDER BY media_deliveries.updated_at DESC, media_deliveries.created_at DESC
               ) AS row_number
        FROM media_deliveries
        JOIN recordings ON recordings.id = media_deliveries.recording_id
        LEFT JOIN upstream_deletion_operations
          ON upstream_deletion_operations.recording_id = recordings.id
        WHERE media_deliveries.destination_id = ?
          AND recordings.dismissed = 0
          AND recordings.upstream_deleted_at IS NULL
          AND recordings.upstream_inventory_generation = ?
          AND recordings.artifact_verified_generation = ?
          AND upstream_deletion_operations.operation_id IS NULL
      )
      SELECT state, COUNT(*) AS count FROM ranked
      WHERE row_number = 1 GROUP BY state
    `).all(destinationId, inventory.generation, inventory.generation) as Array<{ state: string; count: number }>;
    const counts = new Map(rows.map((row) => [row.state, row.count]));
    const tracked = rows.reduce((total, row) => total + row.count, 0);
    return {
      eligible,
      notSent: Math.max(0, eligible - tracked),
      pending: (counts.get("pending") ?? 0) + (counts.get("delivering") ?? 0),
      accepted: counts.get("accepted") ?? 0,
      processing: counts.get("processing") ?? 0,
      transcribed: counts.get("transcribed") ?? 0,
      failed: counts.get("failed") ?? 0,
      conflict: counts.get("conflict") ?? 0,
    };
  }

  getTranscriptionReplayPreview(destinationId: string): {
    eligible: number;
    alreadyTracked: number;
    remaining: number;
    bytes: number;
    durationSeconds: number;
  } {
    const inventory = this.getInventorySnapshot();
    if (!inventory) {
      return { eligible: 0, alreadyTracked: 0, remaining: 0, bytes: 0, durationSeconds: 0 };
    }
    const eligible = this.countEligibleTranscriptionRecordings();
    const remaining = this.db.prepare(`
      SELECT COUNT(*) AS count,
             COALESCE(SUM(recordings.bytes_written), 0) AS bytes,
             COALESCE(SUM(recordings.duration_seconds), 0) AS duration_seconds
      FROM recordings
      LEFT JOIN upstream_deletion_operations
        ON upstream_deletion_operations.recording_id = recordings.id
      WHERE recordings.dismissed = 0
        AND recordings.upstream_deleted_at IS NULL
        AND recordings.local_path IS NOT NULL
        AND recordings.bytes_written > 0
        AND recordings.upstream_inventory_generation = ?
        AND recordings.artifact_verified_generation = ?
        AND upstream_deletion_operations.operation_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM media_deliveries
          WHERE media_deliveries.destination_id = ?
            AND media_deliveries.recording_id = recordings.id
        )
    `).get(inventory.generation, inventory.generation, destinationId) as {
      count: number;
      bytes: number;
      duration_seconds: number;
    };
    return {
      eligible,
      alreadyTracked: eligible - remaining.count,
      remaining: remaining.count,
      bytes: remaining.bytes,
      durationSeconds: Number(remaining.duration_seconds),
    };
  }

  applyTranscriptionStatusEvent(input: {
    eventId: string;
    destinationId: string;
    deliveryId: string;
    payload: unknown;
    receivedAt: string;
    state: "accepted" | "processing" | "transcribed" | "failed";
    transcriptId?: string | null;
    error?: string | null;
    occurredAt: string;
  }): { deduplicated: boolean; delivery: MediaDelivery } {
    const transaction = this.db.transaction(() => {
      const existing = this.db.prepare(`
        SELECT destination_id, delivery_id FROM transcription_status_events
        WHERE event_id = ?
      `).get(input.eventId) as { destination_id: string; delivery_id: string } | undefined;
      if (existing) {
        if (existing.destination_id !== input.destinationId || existing.delivery_id !== input.deliveryId) {
          throw new Error(`Transcription status event ${input.eventId} conflicts with an existing event`);
        }
        return { deduplicated: true, delivery: this.requireMediaDelivery(input.deliveryId) };
      }
      this.db.prepare(`
        INSERT INTO transcription_status_events (
          event_id, destination_id, delivery_id, payload_json, received_at
        ) VALUES (?, ?, ?, ?, ?)
      `).run(input.eventId, input.destinationId, input.deliveryId, JSON.stringify(input.payload), input.receivedAt);
      const delivery = this.updateMediaDeliveryStatus({
        deliveryId: input.deliveryId,
        state: input.state,
        ...(input.transcriptId !== undefined ? { transcriptId: input.transcriptId } : {}),
        ...(input.error !== undefined ? { error: input.error } : {}),
        occurredAt: input.occurredAt,
      });
      return { deduplicated: false, delivery };
    });
    return transaction();
  }

  updateMediaDeliveryStatus(input: {
    deliveryId: string;
    state: "accepted" | "processing" | "transcribed" | "failed";
    transcriptId?: string | null;
    error?: string | null;
    occurredAt: string;
  }): MediaDelivery {
    const current = this.requireMediaDelivery(input.deliveryId);
    assertMediaDeliveryTransition(current, input.state);
    const terminal = input.state === "transcribed" || input.state === "failed";
    this.db.prepare(`
      UPDATE media_deliveries
      SET state = ?, transcript_id = COALESCE(?, transcript_id), last_error = ?,
          failure_stage = ?, next_reconcile_at = ?, updated_at = ?, terminal_at = ?
      WHERE id = ?
    `).run(
      input.state,
      input.transcriptId ?? null,
      input.error ?? null,
      input.state === "failed" ? "processing" : null,
      terminal ? null : new Date(new Date(input.occurredAt).getTime() + 5 * 60_000).toISOString(),
      input.occurredAt,
      terminal ? input.occurredAt : null,
      input.deliveryId,
    );
    return this.requireMediaDelivery(input.deliveryId);
  }

  claimMediaDeliveryForReconciliation(now: Date = new Date()): MediaDelivery | null {
    const row = this.db.prepare(`
      SELECT * FROM media_deliveries
      WHERE state IN ('accepted','processing')
        AND intake_id IS NOT NULL
        AND next_reconcile_at IS NOT NULL
        AND next_reconcile_at <= ?
      ORDER BY next_reconcile_at ASC LIMIT 1
    `).get(now.toISOString()) as MediaDeliveryRow | undefined;
    if (!row) {
      return null;
    }
    this.db.prepare(`
      UPDATE media_deliveries
      SET next_reconcile_at = NULL, reconcile_attempts = reconcile_attempts + 1,
          updated_at = ? WHERE id = ? AND next_reconcile_at IS NOT NULL
    `).run(now.toISOString(), row.id);
    return this.getMediaDelivery(row.id);
  }

  rescheduleMediaReconciliation(deliveryId: string, nextAt: Date, error: string | null): void {
    this.db.prepare(`
      UPDATE media_deliveries SET next_reconcile_at = ?, last_error = ?, updated_at = ?
      WHERE id = ? AND state IN ('accepted','processing')
    `).run(nextAt.toISOString(), error, new Date().toISOString(), deliveryId);
  }

  isMediaArtifactRequired(sha256: string): boolean {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count FROM media_deliveries
      WHERE sha256 = ? AND state IN ('pending','delivering','accepted','processing')
    `).get(sha256) as { count: number };
    return row.count > 0;
  }

  hasActiveMediaDelivery(destinationId: string, sha256: string): boolean {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count FROM media_deliveries
      WHERE destination_id = ? AND sha256 = ?
        AND state IN ('pending','delivering','accepted','processing')
    `).get(destinationId, sha256) as { count: number };
    return row.count > 0;
  }

  listLatestMediaDeliveriesForRecordings(
    destinationId: string,
    recordingIds: string[],
  ): MediaDelivery[] {
    if (recordingIds.length === 0) {
      return [];
    }
    const placeholders = recordingIds.map(() => "?").join(",");
    const rows = this.db.prepare(`
      WITH ranked AS (
        SELECT media_deliveries.*,
               ROW_NUMBER() OVER (
                 PARTITION BY recording_id
                 ORDER BY updated_at DESC, created_at DESC
               ) AS row_number
        FROM media_deliveries
        WHERE destination_id = ? AND recording_id IN (${placeholders})
      )
      SELECT * FROM ranked WHERE row_number = 1
    `).all(destinationId, ...recordingIds) as MediaDeliveryRow[];
    return rows.map(mapMediaDeliveryRow);
  }

  hasMediaDeliveryForRecording(destinationId: string, recordingId: string): boolean {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count FROM media_deliveries
      WHERE destination_id = ? AND recording_id = ?
    `).get(destinationId, recordingId) as { count: number };
    return row.count > 0;
  }

  private requireOutboxItem(id: string): OutboxItem {
    const item = this.getOutboxItem(id);
    if (!item) {
      throw new Error(`webhook_outbox ${id} disappeared between write and read`);
    }
    return item;
  }

  private requireTranscriptionDestination(id: string): TranscriptionDestination {
    const destination = this.getTranscriptionDestination(id);
    if (!destination) {
      throw new Error(`transcription destination ${id} not found`);
    }
    return destination;
  }

  private requireMediaArtifact(sha256: string): MediaArtifactRecord {
    const artifact = this.getMediaArtifact(sha256);
    if (!artifact) {
      throw new Error(`media artifact ${sha256} not found`);
    }
    return artifact;
  }

  private requireMediaDelivery(id: string): MediaDelivery {
    const delivery = this.getMediaDelivery(id);
    if (!delivery) {
      throw new Error(`media delivery ${id} not found`);
    }
    return delivery;
  }

  private getInventorySnapshot(): UpstreamInventorySnapshot | null {
    const stored = this.getJsonSetting<UpstreamInventorySnapshot>("upstream.inventory");
    if (
      !stored
      || typeof stored.generation !== "string"
      || typeof stored.observedAt !== "string"
      || !Number.isInteger(stored.total)
      || stored.total < 0
    ) {
      return null;
    }
    return stored;
  }

  private requireUpstreamDeletionOperation(recordingId: string): UpstreamDeletionOperation {
    const operation = this.getUpstreamDeletionOperation(recordingId);
    if (!operation) {
      throw new Error(`Upstream deletion operation for ${recordingId} is missing`);
    }
    return operation;
  }

  private appendUpstreamDeletionEvent(
    operationId: string,
    recordingId: string,
    eventType: string,
    stage: UpstreamDeletionStage,
    occurredAt: string,
    errorMessage: string | null,
  ): void {
    this.db.prepare(`
      INSERT INTO upstream_deletion_events (
        id, operation_id, recording_id, event_type, stage, occurred_at,
        error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), operationId, recordingId, eventType, stage, occurredAt, errorMessage);
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
        upstream_deleted_at TEXT,
        upstream_inventory_generation TEXT,
        upstream_last_seen_at TEXT,
        artifact_verified_generation TEXT,
        sequence_number INTEGER
      );

      CREATE TABLE IF NOT EXISTS upstream_deletion_operations (
        operation_id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL UNIQUE,
        stage TEXT NOT NULL CHECK (stage IN ('requested','trash_attempted','trash_confirmed','delete_attempted','confirmed')),
        requested_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 1,
        last_error TEXT,
        FOREIGN KEY(recording_id) REFERENCES recordings(id)
      );

      CREATE TABLE IF NOT EXISTS upstream_deletion_events (
        id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL,
        recording_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        stage TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        error_message TEXT,
        FOREIGN KEY(operation_id) REFERENCES upstream_deletion_operations(operation_id),
        FOREIGN KEY(recording_id) REFERENCES recordings(id)
      );
      CREATE INDEX IF NOT EXISTS idx_upstream_deletion_events_operation
        ON upstream_deletion_events (operation_id, occurred_at);

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
        failed INTEGER NOT NULL DEFAULT 0,
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

      CREATE TABLE IF NOT EXISTS transcription_destinations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind = 'transcription-intake-v1'),
        base_url TEXT NOT NULL,
        artifact_base_url TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        is_primary INTEGER NOT NULL DEFAULT 0,
        has_intake_credential INTEGER NOT NULL DEFAULT 0,
        has_status_signing_secret INTEGER NOT NULL DEFAULT 0,
        has_artifact_access_token INTEGER NOT NULL DEFAULT 0,
        provider_name TEXT,
        provider_version TEXT,
        last_tested_at TEXT,
        last_test_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_transcription_destinations_primary
        ON transcription_destinations (is_primary) WHERE is_primary = 1;

      CREATE TABLE IF NOT EXISTS media_artifacts (
        sha256 TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        bytes INTEGER NOT NULL,
        content_type TEXT NOT NULL,
        filename TEXT NOT NULL,
        duration_seconds REAL NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS media_deliveries (
        id TEXT PRIMARY KEY,
        destination_id TEXT NOT NULL,
        recording_id TEXT NOT NULL,
        recording_title TEXT NOT NULL,
        artifact_revision TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('pending','delivering','accepted','processing','transcribed','failed','conflict')),
        intake_id TEXT,
        transcript_id TEXT,
        last_error TEXT,
        failure_stage TEXT CHECK (failure_stage IN ('admission','processing') OR failure_stage IS NULL),
        next_reconcile_at TEXT,
        reconcile_attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        terminal_at TEXT,
        UNIQUE(destination_id, recording_id, artifact_revision),
        FOREIGN KEY(destination_id) REFERENCES transcription_destinations(id),
        FOREIGN KEY(sha256) REFERENCES media_artifacts(sha256)
      );
      CREATE INDEX IF NOT EXISTS idx_media_deliveries_destination_state
        ON media_deliveries (destination_id, state, updated_at);
      CREATE INDEX IF NOT EXISTS idx_media_deliveries_intake
        ON media_deliveries (destination_id, intake_id);

      CREATE TABLE IF NOT EXISTS media_delivery_outbox (
        id TEXT PRIMARY KEY,
        delivery_id TEXT NOT NULL UNIQUE,
        destination_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('pending','delivering','delivered','retry_waiting','permanently_failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(delivery_id) REFERENCES media_deliveries(id),
        FOREIGN KEY(destination_id) REFERENCES transcription_destinations(id)
      );
      CREATE INDEX IF NOT EXISTS idx_media_delivery_outbox_state_next
        ON media_delivery_outbox (state, next_attempt_at);

      CREATE TABLE IF NOT EXISTS transcription_status_events (
        event_id TEXT PRIMARY KEY,
        destination_id TEXT NOT NULL,
        delivery_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        received_at TEXT NOT NULL,
        FOREIGN KEY(destination_id) REFERENCES transcription_destinations(id),
        FOREIGN KEY(delivery_id) REFERENCES media_deliveries(id)
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
    if (!columnNames.has("upstream_deleted_at")) {
      this.db.exec("ALTER TABLE recordings ADD COLUMN upstream_deleted_at TEXT");
    }
    if (!columnNames.has("upstream_inventory_generation")) {
      this.db.exec("ALTER TABLE recordings ADD COLUMN upstream_inventory_generation TEXT");
    }
    if (!columnNames.has("upstream_last_seen_at")) {
      this.db.exec("ALTER TABLE recordings ADD COLUMN upstream_last_seen_at TEXT");
    }
    if (!columnNames.has("artifact_verified_generation")) {
      this.db.exec("ALTER TABLE recordings ADD COLUMN artifact_verified_generation TEXT");
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
    // v0.10.3: preserve candidate-local failures while continuing the run.
    if (!syncRunColumnNames.has("failed")) {
      this.db.exec("ALTER TABLE sync_runs ADD COLUMN failed INTEGER NOT NULL DEFAULT 0");
    }

    const mediaDeliveryColumns = this.db.prepare("PRAGMA table_info(media_deliveries)").all() as Array<{ name: string }>;
    if (!mediaDeliveryColumns.some((column) => column.name === "failure_stage")) {
      this.db.exec("ALTER TABLE media_deliveries ADD COLUMN failure_stage TEXT CHECK (failure_stage IN ('admission','processing') OR failure_stage IS NULL)");
    }

    this.seedLegacyUpstreamDeletionOperations();
  }

  private seedLegacyUpstreamDeletionOperations(): void {
    const rows = this.db.prepare(`
      SELECT recordings.id, recordings.upstream_deleted_at
      FROM recordings
      LEFT JOIN upstream_deletion_operations
        ON upstream_deletion_operations.recording_id = recordings.id
      WHERE recordings.upstream_deleted_at IS NOT NULL
        AND upstream_deletion_operations.recording_id IS NULL
    `).all() as Array<{ id: string; upstream_deleted_at: string }>;
    if (rows.length === 0) {
      return;
    }

    const insertOperation = this.db.prepare(`
      INSERT INTO upstream_deletion_operations (
        operation_id, recording_id, stage, requested_at, updated_at,
        attempt_count, last_error
      ) VALUES (?, ?, 'confirmed', ?, ?, 1, NULL)
    `);
    const transaction = this.db.transaction(() => {
      for (const row of rows) {
        const operationId = randomUUID();
        insertOperation.run(
          operationId,
          row.id,
          row.upstream_deleted_at,
          row.upstream_deleted_at,
        );
        this.appendUpstreamDeletionEvent(
          operationId,
          row.id,
          "legacy_tombstone_imported",
          "confirmed",
          row.upstream_deleted_at,
          null,
        );
      }
    });
    transaction();
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

function mapTranscriptionDestinationRow(row: TranscriptionDestinationRow): TranscriptionDestination {
  return TranscriptionDestinationSchema.parse({
    id: row.id,
    name: row.name,
    kind: row.kind,
    baseUrl: row.base_url,
    artifactBaseUrl: row.artifact_base_url,
    enabled: Boolean(row.enabled),
    primary: Boolean(row.is_primary),
    hasIntakeCredential: Boolean(row.has_intake_credential),
    hasStatusSigningSecret: Boolean(row.has_status_signing_secret),
    hasArtifactAccessToken: Boolean(row.has_artifact_access_token),
    providerName: row.provider_name,
    providerVersion: row.provider_version,
    lastTestedAt: row.last_tested_at,
    lastTestError: row.last_test_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapMediaDeliveryRow(row: MediaDeliveryRow): MediaDelivery {
  return MediaDeliverySchema.parse({
    id: row.id,
    destinationId: row.destination_id,
    recordingId: row.recording_id,
    recordingTitle: row.recording_title,
    artifactRevision: row.artifact_revision,
    sha256: row.sha256,
    bytes: row.bytes,
    state: row.state as MediaDeliveryState,
    intakeId: row.intake_id,
    transcriptId: row.transcript_id,
    lastError: row.last_error,
    failureStage: row.failure_stage,
    retryable: row.state === "conflict" || (row.state === "failed" && row.failure_stage === "admission"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    terminalAt: row.terminal_at,
  });
}

function assertMediaDeliveryTransition(
  delivery: MediaDelivery,
  nextState: "accepted" | "processing" | "transcribed" | "failed",
): void {
  const rank: Record<MediaDelivery["state"], number> = {
    pending: 0,
    delivering: 0,
    accepted: 1,
    processing: 2,
    transcribed: 3,
    failed: 3,
    conflict: 3,
  };
  if (
    (delivery.state === "transcribed" || delivery.state === "failed" || delivery.state === "conflict")
    && nextState !== delivery.state
  ) {
    throw new Error(`Terminal delivery state ${delivery.state} cannot transition to ${nextState}`);
  }
  if (rank[nextState] < rank[delivery.state]) {
    throw new Error(`Delivery state ${delivery.state} cannot regress to ${nextState}`);
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
    upstreamDeletedAt: row.upstream_deleted_at,
    upstreamDeletion: row.upstream_delete_operation_id
      ? {
          operationId: row.upstream_delete_operation_id,
          stage: row.upstream_delete_stage,
          requestedAt: row.upstream_delete_requested_at,
          updatedAt: row.upstream_delete_updated_at,
          attemptCount: row.upstream_delete_attempt_count,
          lastError: row.upstream_delete_last_error,
        }
      : null,
    sequenceNumber: row.sequence_number,
  });
}

function mapUpstreamDeletionOperation(
  row: UpstreamDeletionOperationRow,
): UpstreamDeletionOperation {
  return UpstreamDeletionOperationSchema.parse({
    operationId: row.operation_id,
    stage: row.stage as UpstreamDeletionStage,
    requestedAt: row.requested_at,
    updatedAt: row.updated_at,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
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
    failed: row.failed ?? 0,
    plaudTotal: row.plaud_total,
    filters: SyncFiltersSchema.parse(JSON.parse(row.filters_json)),
    error: row.error_message,
  });
}
