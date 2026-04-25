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

// Tracks every promise the scheduler has spawned. After kicking off a sync
// the test calls `await sched.settled()` to wait for all background work to
// finish, then queries the store for the final sync_runs row.
function createDeterministicScheduler() {
  const inflight: Promise<unknown>[] = [];
  return {
    scheduler: (work: () => Promise<unknown>) => {
      inflight.push(work().catch((error) => error));
    },
    settled: () => Promise.all(inflight),
  };
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
    schedulerIntervalMs: 0,
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

test("PlaudMirrorService anti-overlap: concurrent runSync / runScheduledSync reuse the active run instead of creating a new one", async () => {
  // Regression test for the v0.5.0 documentation/code mismatch: the
  // CHANGELOG and AUTH_AND_SYNC promised that runSync serialises via
  // getActiveSyncRun, but startMirror inserted a new sync_runs row on
  // every call. v0.5.1 introduces startOrReuseMirror to honour the
  // documented contract.
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-service-"));
  const environment = createEnvironment(root);
  const store = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  const secrets = new SecretStore(join(environment.dataDir, "secrets.enc"), environment.masterKey);

  // Scheduler that captures work but never awaits it: the first run stays
  // `running` in SQLite for the duration of the test, simulating a
  // long-running manual sync.
  const queued: Array<() => Promise<unknown>> = [];
  const service = new PlaudMirrorService(environment, store, secrets, {
    scheduler: (work) => {
      queued.push(work);
    },
  });

  const first = await service.runSync({ limit: 5 });
  const second = await service.runSync({ limit: 5 });
  const tick = await service.runScheduledSync();

  assert.equal(second.id, first.id, "second runSync must reuse the active run id");
  assert.equal(tick.id, first.id, "scheduler tick must reuse the active run id");
  assert.equal(tick.started, false, "scheduler tick must report started=false when a run is active");
  // Only the first call dispatched background work.
  assert.equal(queued.length, 1, "no second executeMirror should have been queued");

  // Finishing the first run unblocks subsequent calls again.
  const activeRow = store.getSyncRun(first.id);
  assert.ok(activeRow, "active row should exist mid-test");
  store.finishSyncRun({
    ...activeRow,
    status: "completed",
    finishedAt: new Date().toISOString(),
    error: null,
  });

  const afterFinish = await service.runSync({ limit: 5 });
  assert.notEqual(afterFinish.id, first.id, "after finish, runSync must start a fresh run");
  assert.equal(queued.length, 2, "the post-finish runSync must dispatch new background work");

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
  const sched = createDeterministicScheduler();

  const service = new PlaudMirrorService(environment, store, secrets, {
    scheduler: sched.scheduler,
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

  const handle = await service.runBackfill({
    limit: 100,
    from: "2024-04-01",
    to: "2024-04-30",
  });
  assert.equal(handle.status, "running", "POST returns immediately with status=running");
  await sched.settled();
  const summary = store.getSyncRun(handle.id)!;

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
  const sched = createDeterministicScheduler();
  const service = new PlaudMirrorService(environment, store, secrets, {
    scheduler: sched.scheduler,
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

  // Seed: one already-mirrored row whose webhook was SKIPPED (no webhook
  // configured). Earlier versions of Mode B incorrectly admitted this row as
  // a candidate because the filter only skipped rows with status="success",
  // which masked any genuinely-missing recording further down the list.
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
    lastWebhookStatus: "skipped",
    lastWebhookAttemptAt: new Date().toISOString(),
    dismissed: false,
    dismissedAt: null,
    sequenceNumber: null,
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
    sequenceNumber: null,
  });

  // Ask for 1 recording: Mode B must pick `rec-new-1` (the only genuinely
  // missing one), skip `rec-already-mirrored` (has success webhook), and
  // skip `rec-dismissed` (operator rejected).
  const handle = await service.runSync({ limit: 1 });
  assert.equal(handle.status, "running");
  await sched.settled();
  const summary = store.getSyncRun(handle.id)!;

  assert.equal(summary.status, "completed");
  assert.equal(summary.examined, 3, "examined = every recording Plaud returned");
  assert.equal(summary.matched, 1, "matched = 1 candidate after skipping mirrored + dismissed");
  assert.equal(summary.downloaded, 1);
  assert.equal(summary.plaudTotal, 3, "plaudTotal = Plaud's real total (from listEverything)");
  assert.equal(artifactCalls.length, 1, "only the missing recording should be downloaded");
  assert.match(artifactCalls[0] ?? "", /rec-new-1/);

  service.close();
});

test("PlaudMirrorService runSync with limit=0 only refreshes ranks and downloads nothing", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-service-refresh-"));
  const environment = createEnvironment(root);
  const store = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  const secrets = new SecretStore(join(environment.dataDir, "secrets.enc"), environment.masterKey);

  const artifactCalls: string[] = [];
  const sched = createDeterministicScheduler();
  const service = new PlaudMirrorService(environment, store, secrets, {
    scheduler: sched.scheduler,
    plaudFetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/user/me")) {
        return createJsonResponse({ status: 0, data: { uid: "user-1" } });
      }
      if (url.includes("/file/simple/web")) {
        return createJsonResponse({
          status: 0,
          data_file_total: 2,
          data_file_list: [
            {
              id: "rec-newest",
              filename: "newest",
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
              id: "rec-oldest",
              filename: "oldest",
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
      throw new Error(`Unexpected Plaud fetch: ${url}`);
    },
    artifactFetchImpl: async (input) => {
      artifactCalls.push(String(input));
      return new Response("bytes", { status: 200, headers: { "content-type": "audio/mpeg" } });
    },
  });

  await service.initialize();
  await service.saveAccessToken({ accessToken: "token-value" });

  const handle = await service.runSync({ limit: 0 });
  assert.equal(handle.status, "running");
  await sched.settled();
  const summary = store.getSyncRun(handle.id)!;

  assert.equal(summary.status, "completed");
  assert.equal(summary.examined, 2, "examined still reflects the full Plaud listing");
  assert.equal(summary.matched, 0, "matched=0 because limit=0 short-circuits the candidate loop");
  assert.equal(summary.downloaded, 0, "no audio is downloaded");
  assert.equal(summary.plaudTotal, 2, "plaudTotal is still captured");
  assert.equal(artifactCalls.length, 0, "no artifact fetch happened");

  // Sequence numbers should still be applied even though no audio downloaded —
  // the row exists in SQLite (created by upsertRecording), and the bulk update
  // should have set the rank. Recording the rows requires a candidate path, so
  // for refresh-only we instead trust that the next non-zero sync will rank
  // them. Validate by querying the store: rows are absent until something
  // creates them.
  assert.equal(store.countRecordings(), 0, "limit=0 does not insert new rows; download path is what creates them");

  service.close();
});

test("PlaudMirrorService previewBackfillCandidates annotates each recording with its local state and respects filters", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-service-preview-"));
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
      if (url.includes("/file/simple/web")) {
        return createJsonResponse({
          status: 0,
          data_file_total: 3,
          data_file_list: [
            {
              id: "rec-newest",
              filename: "newest.mp3",
              fullname: "Newest meeting",
              filesize: 1000,
              start_time: 1713780300000, // 2024-04-22
              end_time: 1713780600000,
              duration: 300,
              edit_time: 1713780610000,
              is_trash: false,
              is_trans: true,
              is_summary: false,
              serial_number: "PLAUD-A",
              scene: 1,
            },
            {
              id: "rec-middle",
              filename: "middle.mp3",
              fullname: "Middle talk",
              filesize: 500,
              start_time: 1713693900000, // 2024-04-21
              end_time: 1713694200000,
              duration: 300,
              edit_time: 1713694210000,
              is_trash: false,
              is_trans: true,
              is_summary: false,
              serial_number: "PLAUD-B",
              scene: 2,
            },
            {
              id: "rec-oldest",
              filename: "oldest.mp3",
              fullname: "Oldest recording",
              filesize: 500,
              start_time: 1713607500000, // 2024-04-20
              end_time: 1713607800000,
              duration: 300,
              edit_time: 1713607810000,
              is_trash: false,
              is_trans: true,
              is_summary: false,
              serial_number: "PLAUD-A",
              scene: 1,
            },
          ],
        });
      }
      throw new Error(`Unexpected Plaud fetch: ${url}`);
    },
  });

  await service.initialize();
  await service.saveAccessToken({ accessToken: "token-value" });

  // Seed: rec-middle already mirrored, rec-oldest dismissed.
  store.upsertRecording({
    id: "rec-middle",
    title: "Middle talk",
    createdAt: "2024-04-21T00:05:00.000Z",
    durationSeconds: 300,
    serialNumber: "PLAUD-B",
    scene: 2,
    localPath: "recordings/rec-middle/audio.mp3",
    contentType: "audio/mpeg",
    bytesWritten: 500,
    mirroredAt: "2024-04-21T00:10:00.000Z",
    lastWebhookStatus: "skipped",
    lastWebhookAttemptAt: "2024-04-21T00:10:02.000Z",
    dismissed: false,
    dismissedAt: null,
    sequenceNumber: 2,
  });
  store.upsertRecording({
    id: "rec-oldest",
    title: "Oldest recording",
    createdAt: "2024-04-20T00:05:00.000Z",
    durationSeconds: 300,
    serialNumber: "PLAUD-A",
    scene: 1,
    localPath: null,
    contentType: null,
    bytesWritten: 0,
    mirroredAt: null,
    lastWebhookStatus: null,
    lastWebhookAttemptAt: null,
    dismissed: true,
    dismissedAt: "2024-04-20T00:06:00.000Z",
    sequenceNumber: 1,
  });

  // No filters: all three recordings come back, state annotated.
  const allPreview = await service.previewBackfillCandidates({ previewLimit: 200 });
  assert.equal(allPreview.plaudTotal, 3);
  assert.equal(allPreview.matched, 3);
  assert.equal(allPreview.missing, 1, "only rec-newest is missing");
  assert.equal(allPreview.recordings.length, 3);
  const newest = allPreview.recordings.find((r) => r.id === "rec-newest");
  assert.equal(newest?.state, "missing");
  assert.equal(newest?.sequenceNumber, 3, "stable rank anchored to full timeline");
  assert.equal(newest?.title, "Newest meeting");
  assert.equal(allPreview.recordings.find((r) => r.id === "rec-middle")?.state, "mirrored");
  assert.equal(allPreview.recordings.find((r) => r.id === "rec-oldest")?.state, "dismissed");

  // Serial filter narrows to 2 of 3 (rec-newest + rec-oldest, both PLAUD-A).
  const serialPreview = await service.previewBackfillCandidates({
    serialNumber: "PLAUD-A",
    previewLimit: 200,
  });
  assert.equal(serialPreview.matched, 2);
  assert.equal(serialPreview.missing, 1, "rec-oldest is dismissed, only rec-newest is missing");
  assert.ok(serialPreview.recordings.every((r) => r.serialNumber === "PLAUD-A"));

  // previewLimit caps the response array but `matched` stays truthful.
  const capped = await service.previewBackfillCandidates({ previewLimit: 1 });
  assert.equal(capped.matched, 3, "matched is the pre-truncation count");
  assert.equal(capped.recordings.length, 1);
  assert.equal(capped.previewLimit, 1);

  service.close();
});

test("PlaudMirrorService refreshes the device catalog during a sync and exposes it read-only", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-service-devices-"));
  const environment = createEnvironment(root);
  const store = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  const secrets = new SecretStore(join(environment.dataDir, "secrets.enc"), environment.masterKey);
  const sched = createDeterministicScheduler();

  const deviceListCalls: string[] = [];
  const service = new PlaudMirrorService(environment, store, secrets, {
    scheduler: sched.scheduler,
    plaudFetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/user/me")) {
        return createJsonResponse({ status: 0, data: { uid: "user-1" } });
      }
      if (url.endsWith("/device/list")) {
        deviceListCalls.push(url);
        return createJsonResponse({
          status: 0,
          data_devices: [
            { sn: "PLAUD-ABC", name: "Office", model: "888", version_number: 131400 },
            { sn: "PLAUD-XYZ", name: "", model: "888", version_number: 131339 },
          ],
        });
      }
      if (url.includes("/file/simple/web")) {
        return createJsonResponse({ status: 0, data_file_total: 0, data_file_list: [] });
      }
      throw new Error(`Unexpected Plaud fetch: ${url}`);
    },
  });

  await service.initialize();
  await service.saveAccessToken({ accessToken: "token-value" });

  // Empty list pre-sync so we can prove the refresh writes into the store.
  assert.equal(service.listDevices().length, 0);

  const handle = await service.runSync({ limit: 0 });
  await sched.settled();
  const summary = store.getSyncRun(handle.id);
  assert.equal(summary?.status, "completed");
  assert.equal(deviceListCalls.length, 1, "sync triggers exactly one /device/list refresh");

  const devices = service.listDevices();
  assert.equal(devices.length, 2);
  // Both rows written with a lastSeenAt in the same refresh, so secondary sort
  // (serial asc) wins: PLAUD-ABC before PLAUD-XYZ.
  assert.equal(devices[0]?.serialNumber, "PLAUD-ABC");
  assert.equal(devices[0]?.displayName, "Office");
  assert.equal(devices[0]?.firmwareVersion, 131400);
  assert.equal(devices[1]?.serialNumber, "PLAUD-XYZ");
  assert.equal(devices[1]?.displayName, "");

  service.close();
});

test("PlaudMirrorService sync completes even when /device/list fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-service-devices-fail-"));
  const environment = createEnvironment(root);
  const store = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  const secrets = new SecretStore(join(environment.dataDir, "secrets.enc"), environment.masterKey);
  const sched = createDeterministicScheduler();

  const service = new PlaudMirrorService(environment, store, secrets, {
    scheduler: sched.scheduler,
    plaudFetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/user/me")) {
        return createJsonResponse({ status: 0, data: { uid: "user-1" } });
      }
      if (url.endsWith("/device/list")) {
        // Simulate a 500 from Plaud for the device endpoint. Sync must keep
        // going because device metadata is a UX convenience, not a hard gate.
        return new Response("plaud exploded", { status: 500 });
      }
      if (url.includes("/file/simple/web")) {
        return createJsonResponse({ status: 0, data_file_total: 0, data_file_list: [] });
      }
      throw new Error(`Unexpected Plaud fetch: ${url}`);
    },
  });

  await service.initialize();
  await service.saveAccessToken({ accessToken: "token-value" });

  const handle = await service.runSync({ limit: 0 });
  await sched.settled();
  const summary = store.getSyncRun(handle.id);
  assert.equal(summary?.status, "completed", "device listing failure does not fail the sync");

  // Device table stays empty; no partial write from a broken response.
  assert.equal(service.listDevices().length, 0);

  service.close();
});

test("PlaudMirrorService getHealth pins lastSync to the last completed run while a new run is active", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-service-health-split-"));
  const environment = createEnvironment(root);
  const store = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  const secrets = new SecretStore(join(environment.dataDir, "secrets.enc"), environment.masterKey);
  const service = new PlaudMirrorService(environment, store, secrets, {
    plaudFetchImpl: async () => createJsonResponse({ status: 0, data: { uid: "user-1" } }),
  });

  await service.initialize();
  await service.saveAccessToken({ accessToken: "token-value" });

  // Seed a completed run so lastSync has something to pin.
  const completed = store.startSyncRun("sync", { limit: 5, forceDownload: false });
  store.finishSyncRun({
    id: completed.id,
    mode: "sync",
    status: "completed",
    startedAt: completed.startedAt,
    finishedAt: "2026-04-24T10:00:00.000Z",
    examined: 308,
    matched: 5,
    downloaded: 5,
    delivered: 0,
    skipped: 0,
    plaudTotal: 308,
    filters: { limit: 5, forceDownload: false },
    error: null,
  });

  // Simulate an in-flight run without actually executing it: just register the
  // row. This mirrors what startMirror does before the scheduler runs.
  const running = store.startSyncRun("sync", { limit: 25, forceDownload: false });

  const health = await service.getHealth();

  assert.equal(
    health.lastSync?.id,
    completed.id,
    "lastSync must stay pinned to the last COMPLETED run so stats do not flicker to zeros mid-run",
  );
  assert.equal(health.lastSync?.plaudTotal, 308);
  assert.equal(
    health.activeRun?.id,
    running.id,
    "activeRun must expose the in-flight run so the UI can drive its progress banner",
  );
  assert.equal(health.activeRun?.status, "running");
  assert.equal(health.activeRun?.finishedAt, null);

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
    sequenceNumber: null,
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
    sequenceNumber: null,
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
    sequenceNumber: null,
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
