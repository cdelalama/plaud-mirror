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
    schedulerIntervalMs: 0,
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
    enqueued: 0,
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

test("RuntimeStore persists schedulerIntervalMs through saveConfig and only seeds once", async () => {
  // Regression test for v0.5.2: the panel-driven scheduler config has to
  // round-trip through SQLite, and `seedSchedulerDefaults` must NOT
  // overwrite an operator's previous choice on subsequent boots.
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-store-sched-"));
  const store = new RuntimeStore({
    dbPath: join(root, "data", "app.db"),
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    defaultSyncLimit: 100,
  });

  // Fresh DB → seed bootstraps from the env-var value.
  store.seedSchedulerDefaults(900_000);
  assert.equal(store.getConfig(false).schedulerIntervalMs, 900_000);

  // Operator changes the value from the panel.
  store.saveConfig({ schedulerIntervalMs: 600_000 });
  assert.equal(store.getConfig(false).schedulerIntervalMs, 600_000);

  // A subsequent seed (e.g. process restart with a different env var) must
  // be a no-op — the operator's choice wins.
  store.seedSchedulerDefaults(900_000);
  assert.equal(store.getConfig(false).schedulerIntervalMs, 600_000);

  // Explicit 0 disables the scheduler and survives further seeds.
  store.saveConfig({ schedulerIntervalMs: 0 });
  assert.equal(store.getConfig(false).schedulerIntervalMs, 0);
  store.seedSchedulerDefaults(900_000);
  assert.equal(store.getConfig(false).schedulerIntervalMs, 0);

  store.close();
});

test("RuntimeStore webhook_outbox: enqueue → claim → markDelivered round-trips and updates counters", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-store-outbox-"));
  const store = new RuntimeStore({
    dbPath: join(root, "data", "app.db"),
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    defaultSyncLimit: 100,
  });

  const payload = {
    event: "recording.synced" as const,
    source: "plaud-mirror" as const,
    recording: {
      id: "rec-1",
      title: "Weekly sync",
      createdAt: "2026-04-26T10:00:00.000Z",
      localPath: "recordings/rec-1/audio.mp3",
      format: "mp3",
      contentType: "audio/mpeg",
      bytesWritten: 1024,
    },
    sync: {
      syncedAt: "2026-04-26T10:00:30.000Z",
      deliveryAttempt: 1,
      mode: "sync" as const,
    },
  };

  const enqueued = store.enqueueOutboxItem({ recordingId: "rec-1", payload });
  assert.equal(enqueued.state, "pending");
  assert.equal(enqueued.attempts, 0);
  assert.equal(enqueued.nextAttemptAt, null);
  assert.equal(enqueued.recordingId, "rec-1");

  // Counters reflect the pending item. Use a definitively-future "now" so
  // oldestPendingAgeMs is positive.
  const beforeClaim = store.getOutboxHealth(new Date(Date.now() + 60_000));
  assert.equal(beforeClaim.pending, 1);
  assert.equal(beforeClaim.retryWaiting, 0);
  assert.equal(beforeClaim.permanentlyFailed, 0);
  assert.ok(beforeClaim.oldestPendingAgeMs !== null && beforeClaim.oldestPendingAgeMs > 0);

  const claimed = store.claimOutboxItem();
  assert.ok(claimed, "the pending row should claim");
  assert.equal(claimed.id, enqueued.id);
  assert.equal(claimed.state, "delivering");

  // Payload round-trips intact.
  const persistedPayload = store.getOutboxPayload(enqueued.id);
  assert.deepEqual(persistedPayload, payload);

  // A second claim with the row still in 'delivering' returns null — no
  // worker/UI race can pick the same item twice.
  const reClaim = store.claimOutboxItem();
  assert.equal(reClaim, null, "an in-flight delivering row must not be re-claimed");

  const delivered = store.markOutboxDelivered(enqueued.id);
  assert.equal(delivered.state, "delivered");
  assert.equal(delivered.attempts, 1);

  // Counters drop to zero (delivered is a terminal state, not counted).
  const afterDelivered = store.getOutboxHealth();
  assert.equal(afterDelivered.pending, 0);
  assert.equal(afterDelivered.retryWaiting, 0);
  assert.equal(afterDelivered.permanentlyFailed, 0);
  assert.equal(afterDelivered.oldestPendingAgeMs, null);

  store.close();
});

test("RuntimeStore webhook_outbox: markOutboxRetry transitions delivering → retry_waiting and respects nextAttemptAt", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-store-outbox-retry-"));
  const store = new RuntimeStore({
    dbPath: join(root, "data", "app.db"),
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    defaultSyncLimit: 100,
  });

  const item = store.enqueueOutboxItem({
    recordingId: "rec-2",
    payload: makeMinimalPayload("rec-2"),
  });
  store.claimOutboxItem();

  const future = new Date("2026-04-26T11:00:00.000Z");
  const afterRetry = store.markOutboxRetry(item.id, future, "boom");
  assert.equal(afterRetry.state, "retry_waiting");
  assert.equal(afterRetry.attempts, 1);
  assert.equal(afterRetry.nextAttemptAt, future.toISOString());
  assert.equal(afterRetry.lastError, "boom");

  // claimOutboxItem must NOT pick a retry_waiting row whose nextAttemptAt
  // is still in the future.
  const tooEarly = store.claimOutboxItem(new Date("2026-04-26T10:30:00.000Z"));
  assert.equal(tooEarly, null);

  // After the deadline passes, the same row is claimable again.
  const due = store.claimOutboxItem(new Date("2026-04-26T11:00:01.000Z"));
  assert.ok(due, "row must be claimable once nextAttemptAt has passed");
  assert.equal(due.id, item.id);
  assert.equal(due.state, "delivering");

  // Failing again bumps attempts to 2 (it's the second delivery attempt
  // by the worker; the count tracks attempts executed, not retries
  // scheduled).
  const failedAgain = store.markOutboxRetry(item.id, new Date("2026-04-26T12:00:00.000Z"), "boom2");
  assert.equal(failedAgain.attempts, 2);

  store.close();
});

test("RuntimeStore webhook_outbox: markOutboxPermanentlyFailed terminal + forceOutboxRetry recovers it", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-store-outbox-perm-"));
  const store = new RuntimeStore({
    dbPath: join(root, "data", "app.db"),
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    defaultSyncLimit: 100,
  });

  const item = store.enqueueOutboxItem({
    recordingId: "rec-3",
    payload: makeMinimalPayload("rec-3"),
  });
  store.claimOutboxItem();
  const failed = store.markOutboxPermanentlyFailed(item.id, "max attempts exhausted");
  assert.equal(failed.state, "permanently_failed");
  assert.equal(failed.lastError, "max attempts exhausted");
  assert.equal(failed.nextAttemptAt, null);

  // Counters now reflect a permanently failed item, not pending or retry_waiting.
  const counts = store.getOutboxHealth();
  assert.equal(counts.permanentlyFailed, 1);
  assert.equal(counts.pending, 0);
  assert.equal(counts.retryWaiting, 0);

  // listFailedOutboxItems surfaces the failed item.
  const failedList = store.listFailedOutboxItems();
  assert.equal(failedList.length, 1);
  assert.equal(failedList[0]?.id, item.id);

  // Worker tick must NOT re-claim a permanently_failed row.
  assert.equal(store.claimOutboxItem(), null);

  // forceOutboxRetry from the panel resets attempts and re-arms it as pending.
  const recovered = store.forceOutboxRetry(item.id);
  assert.equal(recovered.state, "pending");
  assert.equal(recovered.attempts, 0);
  assert.equal(recovered.lastError, null);

  // After recovery, the worker can claim it again.
  const reClaim = store.claimOutboxItem();
  assert.ok(reClaim);
  assert.equal(reClaim.id, item.id);
  assert.equal(reClaim.state, "delivering");

  store.close();
});

test("RuntimeStore webhook_outbox: forceOutboxRetry rejects items that are not permanently_failed", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-store-outbox-reject-"));
  const store = new RuntimeStore({
    dbPath: join(root, "data", "app.db"),
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    defaultSyncLimit: 100,
  });

  const pending = store.enqueueOutboxItem({
    recordingId: "rec-4",
    payload: makeMinimalPayload("rec-4"),
  });

  assert.throws(() => store.forceOutboxRetry(pending.id), /not in 'permanently_failed' state/);

  store.claimOutboxItem();
  assert.throws(() => store.forceOutboxRetry(pending.id), /not in 'permanently_failed' state/);

  store.markOutboxDelivered(pending.id);
  assert.throws(() => store.forceOutboxRetry(pending.id), /not in 'permanently_failed' state/);

  store.close();
});

function makeMinimalPayload(recordingId: string) {
  return {
    event: "recording.synced" as const,
    source: "plaud-mirror" as const,
    recording: {
      id: recordingId,
      title: `Title for ${recordingId}`,
      createdAt: null,
      localPath: `recordings/${recordingId}/audio.mp3`,
      format: "mp3",
      contentType: "audio/mpeg",
      bytesWritten: 1024,
    },
    sync: {
      syncedAt: "2026-04-26T10:00:00.000Z",
      deliveryAttempt: 1,
      mode: "sync" as const,
    },
  };
}

test("RuntimeStore splits last completed run from active running run", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-store-active-"));
  const store = new RuntimeStore({
    dbPath: join(root, "data", "app.db"),
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    defaultSyncLimit: 100,
  });

  const firstRun = store.startSyncRun("sync", { limit: 5, forceDownload: false });
  store.finishSyncRun({
    id: firstRun.id,
    mode: "sync",
    status: "completed",
    startedAt: firstRun.startedAt,
    finishedAt: "2026-04-24T10:00:00.000Z",
    examined: 308,
    matched: 5,
    downloaded: 5,
    delivered: 0,
    enqueued: 0,
    skipped: 0,
    plaudTotal: 308,
    filters: { limit: 5, forceDownload: false },
    error: null,
  });

  // Second run starts but never finishes: still status='running', no finished_at.
  const secondRun = store.startSyncRun("sync", { limit: 25, forceDownload: false });

  // getLastSyncRun must return the FINISHED first run, not the in-flight second.
  const lastRun = store.getLastSyncRun();
  assert.equal(lastRun?.id, firstRun.id);
  assert.equal(lastRun?.status, "completed");
  assert.equal(lastRun?.plaudTotal, 308);

  // getActiveSyncRun must return the in-flight second run with status='running'.
  const activeRun = store.getActiveSyncRun();
  assert.equal(activeRun?.id, secondRun.id);
  assert.equal(activeRun?.status, "running");
  assert.equal(activeRun?.finishedAt, null);

  // Once the second run completes, getActiveSyncRun must return null and
  // getLastSyncRun must surface the newer completed row.
  store.finishSyncRun({
    id: secondRun.id,
    mode: "sync",
    status: "completed",
    startedAt: secondRun.startedAt,
    finishedAt: "2026-04-24T10:05:00.000Z",
    examined: 308,
    matched: 25,
    downloaded: 25,
    delivered: 0,
    enqueued: 0,
    skipped: 0,
    plaudTotal: 308,
    filters: { limit: 25, forceDownload: false },
    error: null,
  });
  assert.equal(store.getActiveSyncRun(), null);
  assert.equal(store.getLastSyncRun()?.id, secondRun.id);

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

test("RuntimeStore upsertDevices rewrites existing rows and listDevices orders by last seen", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-store-devices-"));
  const store = new RuntimeStore({
    dbPath: join(root, "data", "app.db"),
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    defaultSyncLimit: 100,
  });

  // First refresh: seed two devices.
  store.upsertDevices([
    {
      serialNumber: "PLAUD-ABC",
      displayName: "Office",
      model: "888",
      firmwareVersion: 131339,
      lastSeenAt: "2026-04-24T10:00:00.000Z",
    },
    {
      serialNumber: "PLAUD-XYZ",
      displayName: "Travel",
      model: "888",
      firmwareVersion: 131339,
      lastSeenAt: "2026-04-24T10:00:00.000Z",
    },
  ]);

  assert.equal(store.listDevices().length, 2);

  // Second refresh: rename one device, bump its firmware, and sweep a newer
  // lastSeenAt for the one still connected. The retired device keeps its old
  // row so historical recordings can still resolve their name.
  store.upsertDevices([
    {
      serialNumber: "PLAUD-ABC",
      displayName: "Office (renamed)",
      model: "888",
      firmwareVersion: 131400,
      lastSeenAt: "2026-04-24T11:00:00.000Z",
    },
  ]);

  const devices = store.listDevices();
  assert.equal(devices.length, 2, "retired device stays in table for historical lookup");
  // Ordering: most recently seen first, then by serial ascending for ties.
  assert.equal(devices[0]?.serialNumber, "PLAUD-ABC");
  assert.equal(devices[0]?.displayName, "Office (renamed)");
  assert.equal(devices[0]?.firmwareVersion, 131400);
  assert.equal(devices[1]?.serialNumber, "PLAUD-XYZ");
  assert.equal(devices[1]?.lastSeenAt, "2026-04-24T10:00:00.000Z");

  const direct = store.getDevice("PLAUD-ABC");
  assert.equal(direct?.displayName, "Office (renamed)");
  assert.equal(store.getDevice("PLAUD-UNKNOWN"), null);

  store.close();
});

test("RuntimeStore upsertDevices is a no-op for an empty array", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-store-devices-empty-"));
  const store = new RuntimeStore({
    dbPath: join(root, "data", "app.db"),
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    defaultSyncLimit: 100,
  });
  assert.equal(store.upsertDevices([]), 0);
  assert.equal(store.listDevices().length, 0);
  store.close();
});
