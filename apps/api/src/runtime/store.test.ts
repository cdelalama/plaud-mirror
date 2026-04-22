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
  assert.equal(store.listRecordings(10)[0]?.id, "rec-1");
  assert.equal(store.getLastSyncRun()?.mode, "backfill");

  store.close();
});
