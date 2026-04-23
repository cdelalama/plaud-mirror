import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { RuntimeStore } from "./store.js";

test("RuntimeStore persists config, recordings, and sync summaries", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-store-"));
  const store = new RuntimeStore({
    dbPath: join(root, "data", "app.db"),
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    defaultSyncLimit: 100,
  });

  store.seedWebhookDefaults("https://hooks.example/plaud");
  store.setWebhookSecretPresence(true);

  assert.deepEqual(store.getConfig(true), {
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    webhookUrl: "https://hooks.example/plaud",
    hasWebhookSecret: true,
    defaultSyncLimit: 100,
  });

  store.upsertRecording({
    id: "rec-1",
    title: "Weekly sync",
    createdAt: "2026-04-22T10:00:00.000Z",
    durationSeconds: 42,
    serialNumber: "PLAUD-1",
    scene: 7,
    localPath: "recordings/rec-1/audio.mp3",
    contentType: "audio/mpeg",
    bytesWritten: 2048,
    mirroredAt: "2026-04-22T10:05:00.000Z",
    lastWebhookStatus: "success",
    lastWebhookAttemptAt: "2026-04-22T10:05:02.000Z",
    dismissed: false,
    dismissedAt: null,
    sequenceNumber: null,
  });

  const run = store.startSyncRun("backfill", {
    from: "2026-04-01",
    to: "2026-04-22",
    serialNumber: "PLAUD-1",
    scene: 7,
    limit: 100,
    forceDownload: false,
  });

  store.finishSyncRun({
    id: run.id,
    mode: "backfill",
    status: "completed",
    startedAt: run.startedAt,
    finishedAt: "2026-04-22T10:06:00.000Z",
    examined: 10,
    matched: 1,
    downloaded: 1,
    delivered: 1,
    skipped: 0,
    plaudTotal: 42,
    filters: {
      from: "2026-04-01",
      to: "2026-04-22",
      serialNumber: "PLAUD-1",
      scene: 7,
      limit: 100,
      forceDownload: false,
    },
    error: null,
  });

  assert.equal(store.countRecordings(), 1);
  const listResult = store.listRecordings(10);
  assert.equal(listResult.total, 1);
  assert.equal(listResult.recordings[0]?.id, "rec-1");
  assert.equal(listResult.recordings[0]?.dismissed, false);
  const lastRun = store.getLastSyncRun();
  assert.equal(lastRun?.mode, "backfill");
  assert.equal(lastRun?.plaudTotal, 42, "plaudTotal must round-trip through SQLite");

  store.close();
});

test("RuntimeStore can mark recordings dismissed and filter them from the default listing", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-store-dismiss-"));
  const store = new RuntimeStore({
    dbPath: join(root, "data", "app.db"),
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    defaultSyncLimit: 100,
  });

  store.upsertRecording({
    id: "rec-alpha",
    title: "Keeper",
    createdAt: "2026-04-22T10:00:00.000Z",
    durationSeconds: 30,
    serialNumber: "PLAUD-1",
    scene: null,
    localPath: "recordings/rec-alpha/audio.mp3",
    contentType: "audio/mpeg",
    bytesWritten: 1024,
    mirroredAt: "2026-04-22T10:05:00.000Z",
    lastWebhookStatus: "success",
    lastWebhookAttemptAt: "2026-04-22T10:05:02.000Z",
    dismissed: false,
    dismissedAt: null,
    sequenceNumber: null,
  });

  store.upsertRecording({
    id: "rec-beta",
    title: "Curated out",
    createdAt: "2026-04-22T11:00:00.000Z",
    durationSeconds: 30,
    serialNumber: "PLAUD-1",
    scene: null,
    localPath: "recordings/rec-beta/audio.mp3",
    contentType: "audio/mpeg",
    bytesWritten: 2048,
    mirroredAt: "2026-04-22T11:05:00.000Z",
    lastWebhookStatus: "success",
    lastWebhookAttemptAt: "2026-04-22T11:05:02.000Z",
    dismissed: false,
    dismissedAt: null,
    sequenceNumber: null,
  });

  const dismissed = store.setRecordingDismissed("rec-beta", true);
  assert.ok(dismissed?.dismissed);
  assert.ok(dismissed?.dismissedAt);

  // Default listing hides dismissed rows.
  const visible = store.listRecordings(10);
  assert.equal(visible.recordings.length, 1);
  assert.equal(visible.recordings[0]?.id, "rec-alpha");
  assert.equal(visible.total, 1);
  assert.equal(store.countRecordings(), 1);

  // includeDismissed=true brings them back.
  const all = store.listRecordings(10, { includeDismissed: true });
  assert.equal(all.recordings.length, 2);
  assert.equal(all.total, 2);
  const dismissedRow = all.recordings.find((row) => row.id === "rec-beta");
  assert.equal(dismissedRow?.dismissed, true);

  // Restore clears dismissed and timestamp.
  const restored = store.setRecordingDismissed("rec-beta", false);
  assert.equal(restored?.dismissed, false);
  assert.equal(restored?.dismissedAt, null);
  assert.equal(store.countRecordings(), 2);

  store.close();
});

test("RuntimeStore migrates pre-0.4.0 databases by adding the dismissed columns", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-store-migrate-"));
  const dbPath = join(root, "data", "app.db");

  const { default: Database } = await import("better-sqlite3");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(join(root, "data"), { recursive: true });

  // Seed a database with the pre-0.4.0 schema (no dismissed columns).
  const legacy = new Database(dbPath);
  legacy.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE recordings (
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
      last_webhook_attempt_at TEXT
    );
    CREATE TABLE sync_runs (
      id TEXT PRIMARY KEY, mode TEXT NOT NULL, status TEXT NOT NULL,
      filters_json TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT,
      examined INTEGER NOT NULL DEFAULT 0, matched INTEGER NOT NULL DEFAULT 0,
      downloaded INTEGER NOT NULL DEFAULT 0, delivered INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0, error_message TEXT
    );
    CREATE TABLE webhook_deliveries (
      id TEXT PRIMARY KEY, recording_id TEXT NOT NULL, status TEXT NOT NULL,
      webhook_url TEXT, http_status INTEGER, error_message TEXT,
      payload_json TEXT NOT NULL, attempted_at TEXT NOT NULL
    );
  `);
  legacy.prepare(`
    INSERT INTO recordings (id, title, duration_seconds)
    VALUES ('rec-legacy', 'Legacy entry', 10)
  `).run();
  legacy.close();

  // Constructor must add the missing columns and keep existing rows intact.
  const store = new RuntimeStore({
    dbPath,
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    defaultSyncLimit: 100,
  });

  const rows = store.listRecordings(10);
  assert.equal(rows.recordings.length, 1);
  assert.equal(rows.total, 1);
  assert.equal(rows.recordings[0]?.id, "rec-legacy");
  assert.equal(rows.recordings[0]?.dismissed, false);
  assert.equal(rows.recordings[0]?.dismissedAt, null);

  store.close();
});
