import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { SecretStore } from "./secrets.js";
import { PlaudMirrorService } from "./service.js";
import { RuntimeStore } from "./store.js";
import type { ServerEnvironment } from "./environment.js";

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function createEnvironment(root: string): ServerEnvironment {
  return {
    port: 3040,
    host: "127.0.0.1",
    apiBase: "https://api.plaud.ai",
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    masterKey: "local-test-master-key",
    webDistDir: join(root, "web-dist"),
    defaultSyncLimit: 100,
    requestTimeoutMs: 5_000,
  };
}

test("PlaudMirrorService saves a validated token into encrypted storage", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-service-"));
  const environment = createEnvironment(root);
  const store = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  const secrets = new SecretStore(join(environment.dataDir, "secrets.enc"), environment.masterKey);
  const service = new PlaudMirrorService(environment, store, secrets, {
    plaudFetchImpl: async (input) => {
      assert.match(String(input), /\/user\/me$/);
      return createJsonResponse({
        status: 0,
        data: {
          uid: "user-1",
          region: "eu",
        },
      });
    },
  });

  await service.initialize();

  const auth = await service.saveAccessToken({
    accessToken: " token-value ",
  });

  assert.equal(auth.state, "healthy");
  assert.equal((await secrets.load()).accessToken, "token-value");
  assert.equal((await service.getAuthStatus()).configured, true);

  service.close();
});

test("PlaudMirrorService backfill downloads audio and signs webhook delivery", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-service-"));
  const environment = createEnvironment(root);
  const store = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  const secrets = new SecretStore(join(environment.dataDir, "secrets.enc"), environment.masterKey);
  const webhookCalls: Array<{ headers: Headers; body: string }> = [];

  const service = new PlaudMirrorService(environment, store, secrets, {
    plaudFetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/user/me")) {
        return createJsonResponse({
          status: 0,
          data: {
            uid: "user-1",
          },
        });
      }
      if (url.includes("/file/simple/web")) {
        return createJsonResponse({
          status: 0,
          data_file_total: 1,
          data_file_list: [
            {
              id: "rec-1",
              filename: "Weekly sync",
              fullname: "Weekly sync",
              filesize: 5,
              start_time: 1713780000000,
              end_time: 1713780300000,
              duration: 5000,
              edit_time: 1713780310000,
              is_trash: false,
              is_trans: true,
              is_summary: false,
              serial_number: "PLAUD-1",
              scene: 7,
            },
          ],
        });
      }
      if (url.endsWith("/file/detail/rec-1")) {
        return createJsonResponse({
          status: 0,
          data: {
            file_id: "rec-1",
            file_name: "Weekly sync",
            duration: 5000,
            serial_number: "PLAUD-1",
            scene: 7,
          },
        });
      }
      if (url.endsWith("/file/temp-url/rec-1")) {
        return createJsonResponse({
          status: 0,
          temp_url: "https://storage.example.com/audio/rec-1.mp3",
        });
      }

      throw new Error(`Unexpected Plaud fetch: ${url}`);
    },
    artifactFetchImpl: async (input) => {
      assert.equal(String(input), "https://storage.example.com/audio/rec-1.mp3");
      return new Response("hello", {
        status: 200,
        headers: {
          "content-type": "audio/mpeg",
        },
      });
    },
    webhookFetchImpl: async (_input, init) => {
      webhookCalls.push({
        headers: new Headers(init?.headers),
        body: String(init?.body ?? ""),
      });
      return new Response(null, { status: 204 });
    },
  });

  await service.initialize();
  await service.updateConfig({
    webhookUrl: "https://hooks.example/plaud",
    webhookSecret: "top-secret",
  });
  await service.saveAccessToken({
    accessToken: "token-value",
  });

  const summary = await service.runBackfill({
    limit: 100,
    from: "2024-04-01",
    to: "2024-04-30",
  });

  assert.equal(summary.status, "completed");
  assert.equal(summary.downloaded, 1);
  assert.equal(summary.delivered, 1);
  assert.equal(summary.plaudTotal, 1, "sync summary should carry Plaud's data_file_total");

  const recordings = await service.listRecordings(10);
  assert.equal(recordings.recordings.length, 1);
  assert.equal(recordings.recordings[0]?.bytesWritten, 5);
  assert.equal(recordings.recordings[0]?.lastWebhookStatus, "success");

  assert.equal(webhookCalls.length, 1);
  assert.match(
    webhookCalls[0]?.headers.get("x-plaud-mirror-signature-256") ?? "",
    /^sha256=/,
  );
  assert.match(webhookCalls[0]?.body ?? "", /recording\.synced/);

  service.close();
});

test("PlaudMirrorService runSync skips already-mirrored rows and pulls the first missing one (Mode B)", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-service-modeb-"));
  const environment = createEnvironment(root);
  const store = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  const secrets = new SecretStore(join(environment.dataDir, "secrets.enc"), environment.masterKey);

  const plaudCalls: string[] = [];
  const artifactCalls: string[] = [];
  const service = new PlaudMirrorService(environment, store, secrets, {
    plaudFetchImpl: async (input) => {
      const url = String(input);
      plaudCalls.push(url);
      if (url.endsWith("/user/me")) {
        return createJsonResponse({ status: 0, data: { uid: "user-1" } });
      }
      if (url.includes("/file/simple/web")) {
        // Three recordings in Plaud. The listing fits in one page so
        // listEverything returns them all and reports total=3.
        return createJsonResponse({
          status: 0,
          data_file_total: 3,
          data_file_list: [
            {
              id: "rec-new-1",
              filename: "brand new recording",
              filesize: 5,
              start_time: 1713780200000,
              end_time: 1713780500000,
              duration: 300,
              edit_time: 1713780510000,
              is_trash: false,
              is_trans: true,
              is_summary: false,
              serial_number: "PLAUD-1",
            },
            {
              id: "rec-already-mirrored",
              filename: "already local",
              filesize: 5,
              start_time: 1713780100000,
              end_time: 1713780400000,
              duration: 300,
              edit_time: 1713780410000,
              is_trash: false,
              is_trans: true,
              is_summary: false,
              serial_number: "PLAUD-1",
            },
            {
              id: "rec-dismissed",
              filename: "operator rejected",
              filesize: 5,
              start_time: 1713780000000,
              end_time: 1713780300000,
              duration: 300,
              edit_time: 1713780310000,
              is_trash: false,
              is_trans: true,
              is_summary: false,
              serial_number: "PLAUD-1",
            },
          ],
        });
      }
      if (url.endsWith("/file/detail/rec-new-1")) {
        return createJsonResponse({
          status: 0,
          data: { file_id: "rec-new-1", file_name: "brand new recording", duration: 300, serial_number: "PLAUD-1" },
        });
      }
      if (url.endsWith("/file/temp-url/rec-new-1")) {
        return createJsonResponse({
          status: 0,
          temp_url: "https://storage.example.com/audio/rec-new-1.mp3",
        });
      }
      throw new Error(`Unexpected Plaud fetch: ${url}`);
    },
    artifactFetchImpl: async (input) => {
      artifactCalls.push(String(input));
      return new Response("bytes", {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      });
    },
  });

  await service.initialize();
  await service.saveAccessToken({ accessToken: "token-value" });

  // Seed: one already-mirrored-successfully recording, one dismissed recording.
  store.upsertRecording({
    id: "rec-already-mirrored",
    title: "already local",
    createdAt: new Date(1713780100000).toISOString(),
    durationSeconds: 300,
    serialNumber: "PLAUD-1",
    scene: null,
    localPath: join(environment.recordingsDir, "rec-already-mirrored", "audio.mp3"),
    contentType: "audio/mpeg",
    bytesWritten: 5,
    mirroredAt: new Date().toISOString(),
    lastWebhookStatus: "success",
    lastWebhookAttemptAt: new Date().toISOString(),
    dismissed: false,
    dismissedAt: null,
  });
  // And make sure the file exists so hasLocalArtifact() is true.
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(join(environment.recordingsDir, "rec-already-mirrored"), { recursive: true });
  await writeFile(join(environment.recordingsDir, "rec-already-mirrored", "audio.mp3"), "bytes");

  store.upsertRecording({
    id: "rec-dismissed",
    title: "operator rejected",
    createdAt: new Date(1713780000000).toISOString(),
    durationSeconds: 300,
    serialNumber: "PLAUD-1",
    scene: null,
    localPath: null,
    contentType: null,
    bytesWritten: 0,
    mirroredAt: null,
    lastWebhookStatus: null,
    lastWebhookAttemptAt: null,
    dismissed: true,
    dismissedAt: new Date().toISOString(),
  });

  // Ask for 1 recording: Mode B must pick `rec-new-1` (the only genuinely
  // missing one), skip `rec-already-mirrored` (has success webhook), and
  // skip `rec-dismissed` (operator rejected).
  const summary = await service.runSync({ limit: 1 });

  assert.equal(summary.status, "completed");
  assert.equal(summary.examined, 3, "examined = every recording Plaud returned");
  assert.equal(summary.matched, 1, "matched = 1 candidate after skipping mirrored + dismissed");
  assert.equal(summary.downloaded, 1);
  assert.equal(summary.plaudTotal, 3, "plaudTotal = Plaud's real total (from listEverything)");
  assert.equal(artifactCalls.length, 1, "only the missing recording should be downloaded");
  assert.match(artifactCalls[0] ?? "", /rec-new-1/);

  service.close();
});

test("PlaudMirrorService deleteRecording removes the audio file and marks the row dismissed", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-service-delete-"));
  const environment = createEnvironment(root);
  const store = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  const secrets = new SecretStore(join(environment.dataDir, "secrets.enc"), environment.masterKey);
  const service = new PlaudMirrorService(environment, store, secrets);
  await service.initialize();

  const { mkdir, writeFile, access } = await import("node:fs/promises");
  const recordingDir = join(environment.recordingsDir, "rec-delete");
  await mkdir(recordingDir, { recursive: true });
  const audioPath = join(recordingDir, "audio.mp3");
  await writeFile(audioPath, "fake-audio-bytes");

  store.upsertRecording({
    id: "rec-delete",
    title: "Weekend memo",
    createdAt: "2026-04-22T10:00:00.000Z",
    durationSeconds: 12,
    serialNumber: "PLAUD-1",
    scene: null,
    localPath: audioPath,
    contentType: "audio/mpeg",
    bytesWritten: 16,
    mirroredAt: "2026-04-22T10:05:00.000Z",
    lastWebhookStatus: "success",
    lastWebhookAttemptAt: "2026-04-22T10:05:02.000Z",
    dismissed: false,
    dismissedAt: null,
  });

  const result = await service.deleteRecording("rec-delete");
  assert.equal(result.dismissed, true);
  assert.equal(result.localFileRemoved, true);

  await assert.rejects(access(audioPath), /ENOENT/);
  const stored = store.getRecording("rec-delete");
  assert.equal(stored?.dismissed, true);
  assert.equal(stored?.localPath, null);
  assert.equal(stored?.bytesWritten, 0);

  const visible = await service.listRecordings(10);
  assert.equal(visible.recordings.length, 0);
  const all = await service.listRecordings(10, { includeDismissed: true });
  assert.equal(all.recordings.length, 1);
  assert.equal(all.recordings[0]?.dismissed, true);

  service.close();
});

test("PlaudMirrorService restoreRecording re-downloads the audio and clears the dismissed flag", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-service-restore-"));
  const environment = createEnvironment(root);
  const store = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  const secrets = new SecretStore(join(environment.dataDir, "secrets.enc"), environment.masterKey);
  const service = new PlaudMirrorService(environment, store, secrets, {
    plaudFetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/user/me")) {
        return createJsonResponse({ status: 0, data: { uid: "user-1" } });
      }
      if (url.endsWith("/file/detail/rec-restore")) {
        return createJsonResponse({
          status: 0,
          data: {
            file_id: "rec-restore",
            file_name: "Previously dismissed",
            duration: 12000,
            serial_number: "PLAUD-1",
            scene: 3,
          },
        });
      }
      if (url.endsWith("/file/temp-url/rec-restore")) {
        return createJsonResponse({
          status: 0,
          temp_url: "https://storage.example.com/audio/rec-restore.mp3",
        });
      }
      throw new Error(`Unexpected Plaud fetch: ${url}`);
    },
    artifactFetchImpl: async () => new Response("restored-bytes", {
      status: 200,
      headers: { "content-type": "audio/mpeg" },
    }),
  });
  await service.initialize();
  await service.saveAccessToken({ accessToken: "token-value" });

  store.upsertRecording({
    id: "rec-restore",
    title: "Previously dismissed",
    createdAt: "2026-04-22T10:00:00.000Z",
    durationSeconds: 12,
    serialNumber: "PLAUD-1",
    scene: 3,
    localPath: null,
    contentType: null,
    bytesWritten: 0,
    mirroredAt: null,
    lastWebhookStatus: null,
    lastWebhookAttemptAt: null,
    dismissed: true,
    dismissedAt: "2026-04-22T10:06:00.000Z",
  });

  const result = await service.restoreRecording("rec-restore");
  assert.equal(result.dismissed, false);

  const stored = store.getRecording("rec-restore");
  assert.equal(stored?.dismissed, false);
  assert.equal(stored?.dismissedAt, null);
  assert.ok(stored?.localPath, "restore should repopulate localPath");
  assert.equal(stored?.contentType, "audio/mpeg");
  assert.ok(stored?.bytesWritten && stored.bytesWritten > 0, "restore should record actual bytes written");
  assert.ok(stored?.mirroredAt, "restore should refresh mirroredAt");

  await assert.rejects(service.restoreRecording("rec-restore"), /not dismissed/);

  service.close();
});

test("PlaudMirrorService restoreRecording without a token clears the flag but surfaces the auth error", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-service-restore-notoken-"));
  const environment = createEnvironment(root);
  const store = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  const secrets = new SecretStore(join(environment.dataDir, "secrets.enc"), environment.masterKey);
  const service = new PlaudMirrorService(environment, store, secrets);
  await service.initialize();

  store.upsertRecording({
    id: "rec-no-token",
    title: "Previously dismissed",
    createdAt: "2026-04-22T10:00:00.000Z",
    durationSeconds: 12,
    serialNumber: "PLAUD-1",
    scene: null,
    localPath: null,
    contentType: null,
    bytesWritten: 0,
    mirroredAt: null,
    lastWebhookStatus: null,
    lastWebhookAttemptAt: null,
    dismissed: true,
    dismissedAt: "2026-04-22T10:06:00.000Z",
  });

  await assert.rejects(service.restoreRecording("rec-no-token"), /bearer token/i);

  // The dismissed flag is cleared regardless — operator's intent is respected and
  // a later sync can retry the download once the token is back.
  const stored = store.getRecording("rec-no-token");
  assert.equal(stored?.dismissed, false);
  assert.equal(stored?.localPath, null);

  service.close();
});

test("PlaudMirrorService rejects audio requests for unsafe recording ids", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-service-unsafe-"));
  const environment = createEnvironment(root);
  const store = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  const secrets = new SecretStore(join(environment.dataDir, "secrets.enc"), environment.masterKey);
  const service = new PlaudMirrorService(environment, store, secrets);
  await service.initialize();

  await assert.rejects(service.getRecordingAudio("../etc/passwd"), /unsupported characters/);
  await assert.rejects(service.deleteRecording("../etc/passwd"), /unsupported characters/);

  service.close();
});
