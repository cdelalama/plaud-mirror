import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { RuntimeStore } from "../runtime/store.js";
import { seedDevelopmentSamples } from "./development-seed.js";

test("development seed verifies audio and creates isolated recording rows", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-development-seed-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dataDir = join(root, "data");
  const recordingsDir = join(root, "recordings");
  const sampleDir = join(recordingsDir, "sample-1");
  await mkdir(sampleDir, { recursive: true });
  const audio = Buffer.from("representative audio bytes");
  await writeFile(join(sampleDir, "audio.ogg"), audio);
  const manifestPath = join(root, "samples.json");
  await writeFile(manifestPath, JSON.stringify({
    schema: "plaud-mirror.development-samples.v1",
    generatedAt: "2026-09-15T09:00:00Z",
    source: "nas-production-sample",
    samples: [{
      id: "sample-1",
      title: "Development sample",
      createdAt: "2026-09-14T09:00:00Z",
      durationSeconds: 12,
      relativePath: "sample-1/audio.ogg",
      contentType: "audio/ogg",
      bytes: audio.length,
      sha256: createHash("sha256").update(audio).digest("hex"),
    }],
  }));

  assert.deepEqual(await seedDevelopmentSamples({
    manifestPath,
    dataDir,
    recordingsDir,
    defaultSyncLimit: 10,
  }), { inserted: 1, retired: 0, total: 1 });

  const store = new RuntimeStore({
    dbPath: join(dataDir, "app.db"),
    dataDir,
    recordingsDir,
    defaultSyncLimit: 10,
  });
  t.after(() => store.close());
  const recording = store.getRecording("sample-1");
  assert.equal(recording?.title, "Development sample");
  assert.equal(recording?.serialNumber, null);
  assert.equal(recording?.lastWebhookStatus, null);
  assert.equal(store.getConfig(false).schedulerIntervalMs, 0);
  assert.deepEqual(await readFile(recording!.localPath!), audio);

  const replacementDir = join(recordingsDir, "sample-2");
  await mkdir(replacementDir, { recursive: true });
  const replacementAudio = Buffer.from("replacement representative audio bytes");
  await writeFile(join(replacementDir, "audio.ogg"), replacementAudio);
  await writeFile(manifestPath, JSON.stringify({
    schema: "plaud-mirror.development-samples.v1",
    generatedAt: "2026-09-15T10:00:00Z",
    source: "nas-production-sample",
    samples: [{
      id: "sample-2",
      title: "Replacement sample",
      createdAt: "2026-09-15T09:00:00Z",
      durationSeconds: 30,
      relativePath: "sample-2/audio.ogg",
      contentType: "audio/ogg",
      bytes: replacementAudio.length,
      sha256: createHash("sha256").update(replacementAudio).digest("hex"),
    }],
  }));
  assert.deepEqual(await seedDevelopmentSamples({
    manifestPath,
    dataDir,
    recordingsDir,
    defaultSyncLimit: 10,
  }), { inserted: 1, retired: 1, total: 1 });
  assert.equal(store.getRecording("sample-1")?.dismissed, true);
  assert.equal(store.getRecording("sample-1")?.localPath, null);
  assert.equal(store.getRecording("sample-2")?.dismissed, false);
});

test("development seed rejects a digest mismatch before inserting the row", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-development-bad-seed-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dataDir = join(root, "data");
  const recordingsDir = join(root, "recordings");
  await mkdir(join(recordingsDir, "sample-1"), { recursive: true });
  await writeFile(join(recordingsDir, "sample-1", "audio.ogg"), "wrong bytes");
  const manifestPath = join(root, "samples.json");
  await writeFile(manifestPath, JSON.stringify({
    schema: "plaud-mirror.development-samples.v1",
    generatedAt: "2026-09-15T09:00:00Z",
    source: "nas-production-sample",
    samples: [{
      id: "sample-1",
      title: "Development sample",
      createdAt: null,
      durationSeconds: 12,
      relativePath: "sample-1/audio.ogg",
      contentType: "audio/ogg",
      bytes: 11,
      sha256: "0".repeat(64),
    }],
  }));

  await assert.rejects(
    seedDevelopmentSamples({
      manifestPath,
      dataDir,
      recordingsDir,
      defaultSyncLimit: 10,
    }),
    /SHA-256/,
  );
});

test("development seed rejects a sample directory that resolves outside its audio root", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-development-symlink-seed-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dataDir = join(root, "data");
  const recordingsDir = join(root, "recordings");
  const outsideDir = join(root, "outside");
  await mkdir(recordingsDir, { recursive: true });
  await mkdir(outsideDir);
  const audio = Buffer.from("audio outside the recordings root");
  await writeFile(join(outsideDir, "audio.ogg"), audio);
  await symlink(outsideDir, join(recordingsDir, "sample-1"), "dir");
  const manifestPath = join(root, "samples.json");
  await writeFile(manifestPath, JSON.stringify({
    schema: "plaud-mirror.development-samples.v1",
    generatedAt: "2026-09-15T09:00:00Z",
    source: "nas-production-sample",
    samples: [{
      id: "sample-1",
      title: "Development sample",
      createdAt: null,
      durationSeconds: 12,
      relativePath: "sample-1/audio.ogg",
      contentType: "audio/ogg",
      bytes: audio.length,
      sha256: createHash("sha256").update(audio).digest("hex"),
    }],
  }));

  await assert.rejects(
    seedDevelopmentSamples({ manifestPath, dataDir, recordingsDir, defaultSyncLimit: 10 }),
    /resolves outside the recordings root/,
  );
});
