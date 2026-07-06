import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildContentDisposition, createApp, parseByteRange } from "./server.js";
import type { ServerEnvironment } from "./runtime/environment.js";

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
    webDistDir: join(root, "missing-web-dist"),
    defaultSyncLimit: 100,
    requestTimeoutMs: 5_000,
    schedulerIntervalMs: 0,
  };
}

test("createApp wires auth and config routes", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-server-"));
  const environment = createEnvironment(root);
  const app = await createApp({
    environment,
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

      throw new Error(`Unexpected Plaud fetch: ${url}`);
    },
  });

  const healthResponse = await app.inject({
    method: "GET",
    url: "/api/health",
  });
  assert.equal(healthResponse.statusCode, 200);

  const configResponse = await app.inject({
    method: "PUT",
    url: "/api/config",
    payload: {
      webhookUrl: "https://hooks.example/plaud",
      webhookSecret: "secret-value",
    },
  });
  assert.equal(configResponse.statusCode, 200);
  assert.equal(configResponse.json().webhookUrl, "https://hooks.example/plaud");

  const tokenResponse = await app.inject({
    method: "POST",
    url: "/api/auth/token",
    payload: {
      accessToken: "token-value",
    },
  });
  assert.equal(tokenResponse.statusCode, 200);
  assert.equal(tokenResponse.json().state, "healthy");

  const authStatusResponse = await app.inject({
    method: "GET",
    url: "/api/auth/status",
  });
  assert.equal(authStatusResponse.statusCode, 200);
  assert.equal(authStatusResponse.json().configured, true);

  await app.close();
});

test("createApp exposes outbox routes: list shows only permanently_failed; force-retry rejects non-failed items", async () => {
  // The HTTP surface for D-013: GET /api/outbox returns the failed
  // backlog so the panel can render Retry buttons; POST /api/outbox/:id/retry
  // resurrects a permanently_failed row, and refuses to touch any other
  // state (panel must not bypass the FSM).
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-server-outbox-"));
  const environment = createEnvironment(root);
  const app = await createApp({
    environment,
    plaudFetchImpl: async () => {
      throw new Error("Unexpected Plaud fetch in outbox-route test");
    },
  });

  // Empty queue → empty list.
  const emptyList = await app.inject({ method: "GET", url: "/api/outbox" });
  assert.equal(emptyList.statusCode, 200);
  assert.deepEqual(emptyList.json(), { items: [] });

  // Reach into the same SQLite file the app uses to seed a
  // permanently_failed row directly. This avoids spinning up a real
  // sync just to populate the outbox; the FSM path is already covered
  // exhaustively by store.test.ts and outbox-worker.test.ts. The point
  // here is the HTTP shape.
  const { RuntimeStore } = await import("./runtime/store.js");
  const store = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  const item = store.enqueueOutboxItem({
    recordingId: "rec-failed",
    payload: {
      event: "recording.synced",
      source: "plaud-mirror",
      recording: {
        id: "rec-failed",
        title: "Title",
        createdAt: null,
        localPath: "recordings/rec-failed/audio.mp3",
        format: "mp3",
        contentType: "audio/mpeg",
        bytesWritten: 1,
      },
      sync: { syncedAt: "2026-04-26T10:00:00.000Z", deliveryAttempt: 1, mode: "sync" },
    },
  });
  store.claimOutboxItem();
  store.markOutboxPermanentlyFailed(item.id, "synthetic failure for the test");
  store.close();

  const listResponse = await app.inject({ method: "GET", url: "/api/outbox" });
  assert.equal(listResponse.statusCode, 200);
  const listed = listResponse.json().items;
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, item.id);
  assert.equal(listed[0].state, "permanently_failed");

  // Successful force-retry: 200 + the row now reads `pending`.
  const retryResponse = await app.inject({
    method: "POST",
    url: `/api/outbox/${item.id}/retry`,
  });
  assert.equal(retryResponse.statusCode, 200);
  assert.equal(retryResponse.json().item.id, item.id);
  assert.equal(retryResponse.json().item.state, "pending");
  assert.equal(retryResponse.json().item.attempts, 0);

  // After recovery, the item is no longer in the failed list.
  const afterRetry = await app.inject({ method: "GET", url: "/api/outbox" });
  assert.deepEqual(afterRetry.json(), { items: [] });

  // Trying to retry the now-pending row returns 409 (the FSM guard).
  const conflictResponse = await app.inject({
    method: "POST",
    url: `/api/outbox/${item.id}/retry`,
  });
  assert.equal(conflictResponse.statusCode, 409);

  // Unknown id → 404.
  const unknownResponse = await app.inject({
    method: "POST",
    url: "/api/outbox/this-id-does-not-exist/retry",
  });
  assert.equal(unknownResponse.statusCode, 404);

  // Bad id shape → 400 (the panel must never reach the store with junk).
  const badIdResponse = await app.inject({
    method: "POST",
    url: "/api/outbox/has%20a%20space/retry",
  });
  assert.equal(badIdResponse.statusCode, 400);

  await app.close();
});

test("createApp exposes audio streaming, delete, and restore routes for mirrored recordings", async () => {
  const { mkdir, writeFile } = await import("node:fs/promises");

  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-server-recordings-"));
  const environment = createEnvironment(root);
  await mkdir(environment.dataDir, { recursive: true });
  await mkdir(environment.recordingsDir, { recursive: true });

  const recordingDir = join(environment.recordingsDir, "rec-http");
  await mkdir(recordingDir, { recursive: true });
  const audioPath = join(recordingDir, "audio.mp3");
  await writeFile(audioPath, "AUDIO_BYTES");

  const app = await createApp({
    environment,
    plaudFetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/user/me")) {
        return createJsonResponse({ status: 0, data: { uid: "user-1" } });
      }
      if (url.endsWith("/file/detail/rec-http")) {
        return createJsonResponse({
          status: 0,
          data: {
            file_id: "rec-http",
            file_name: "HTTP probe",
            duration: 12000,
            serial_number: "PLAUD-1",
          },
        });
      }
      if (url.endsWith("/file/temp-url/rec-http")) {
        return createJsonResponse({
          status: 0,
          temp_url: "https://storage.example.com/audio/rec-http.mp3",
        });
      }
      throw new Error(`Unexpected Plaud fetch: ${url}`);
    },
    artifactFetchImpl: async () => new Response("RESTORED_BYTES", {
      status: 200,
      headers: { "content-type": "audio/mpeg" },
    }),
  });

  // Seed a recording directly through the exposed service by posting token + running nothing.
  // Since the service doesn't expose a public seed, we reach in through the store instance it created
  // by accessing it via a no-op route: just list, then write directly via a separate RuntimeStore
  // instance that shares the same sqlite file. This mirrors what a real run would do.
  const { RuntimeStore } = await import("./runtime/store.js");
  const sideStore = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  sideStore.upsertRecording({
    id: "rec-http",
    title: "HTTP probe",
    createdAt: "2026-04-22T10:00:00.000Z",
    durationSeconds: 12,
    serialNumber: "PLAUD-1",
    scene: null,
    localPath: audioPath,
    contentType: "audio/mpeg",
    bytesWritten: 11,
    mirroredAt: "2026-04-22T10:05:00.000Z",
    lastWebhookStatus: "success",
    lastWebhookAttemptAt: "2026-04-22T10:05:02.000Z",
    dismissed: false,
    dismissedAt: null,
    sequenceNumber: null,
  });
  sideStore.close();

  // Save a token so restore's immediate re-download path can call the mocked Plaud client.
  const tokenSave = await app.inject({
    method: "POST",
    url: "/api/auth/token",
    payload: { accessToken: "token-value" },
  });
  assert.equal(tokenSave.statusCode, 200);

  const listResponse = await app.inject({ method: "GET", url: "/api/recordings?limit=10" });
  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().recordings.length, 1);

  const audioResponse = await app.inject({ method: "GET", url: "/api/recordings/rec-http/audio" });
  assert.equal(audioResponse.statusCode, 200);
  assert.equal(audioResponse.headers["content-type"], "audio/mpeg");
  assert.equal(audioResponse.body, "AUDIO_BYTES");

  const deleteResponse = await app.inject({ method: "DELETE", url: "/api/recordings/rec-http" });
  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(deleteResponse.json().dismissed, true);
  assert.equal(deleteResponse.json().localFileRemoved, true);

  const listAfterDelete = await app.inject({ method: "GET", url: "/api/recordings?limit=10" });
  assert.equal(listAfterDelete.json().recordings.length, 0);

  const listIncludingDismissed = await app.inject({
    method: "GET",
    url: "/api/recordings?limit=10&includeDismissed=true",
  });
  assert.equal(listIncludingDismissed.json().recordings.length, 1);
  assert.equal(listIncludingDismissed.json().recordings[0].dismissed, true);

  const restoreResponse = await app.inject({
    method: "POST",
    url: "/api/recordings/rec-http/restore",
  });
  assert.equal(restoreResponse.statusCode, 200);
  assert.equal(restoreResponse.json().dismissed, false);

  // Restore now triggers an immediate re-download, so the audio route should
  // serve the freshly-mirrored bytes instead of 404.
  const audioAfterRestore = await app.inject({
    method: "GET",
    url: "/api/recordings/rec-http/audio",
  });
  assert.equal(audioAfterRestore.statusCode, 200);
  assert.equal(audioAfterRestore.body, "RESTORED_BYTES");

  await app.close();
});

test("buildContentDisposition emits ASCII + UTF-8 filenames and escapes unsafe chars", () => {
  assert.equal(
    buildContentDisposition("Weekly_meeting.mp3"),
    `inline; filename="Weekly_meeting.mp3"; filename*=UTF-8''Weekly_meeting.mp3`,
  );
  // Non-ASCII source: ASCII fallback replaces each outside-printable char
  // with `_`; the UTF-8 form carries the full encoded value.
  const disp = buildContentDisposition("Reunión.mp3");
  assert.match(disp, /filename="Reuni_n\.mp3"/);
  assert.match(disp, /filename\*=UTF-8''Reuni%C3%B3n\.mp3/);
  // Quote and backslash are collapsed in the ASCII fallback so they can't
  // break out of the quoted string.
  const danger = buildContentDisposition('a"b\\c.mp3');
  assert.match(danger, /filename="a_b_c\.mp3"/);
});

test("parseByteRange handles the four RFC 7233 single-range shapes and rejects garbage", () => {
  assert.deepEqual(parseByteRange("bytes=0-999", 5000), { start: 0, end: 999 });
  assert.deepEqual(parseByteRange("bytes=500-", 5000), { start: 500, end: 4999 });
  assert.deepEqual(parseByteRange("bytes=-100", 5000), { start: 4900, end: 4999 });
  assert.deepEqual(parseByteRange("bytes=4000-999999", 5000), { start: 4000, end: 4999 });

  assert.equal(parseByteRange("bytes=5000-6000", 5000), null);
  assert.equal(parseByteRange("bytes=abc-100", 5000), null);
  assert.equal(parseByteRange("items=0-100", 5000), null);
  assert.equal(parseByteRange("bytes=100-50", 5000), null);
  assert.equal(parseByteRange("bytes=-", 5000), null);
  assert.equal(parseByteRange("bytes=-0", 5000), null);
  assert.equal(parseByteRange("bytes=0-999", 0), null);
});

test("audio endpoint supports HTTP Range requests with 206 Partial Content", async () => {
  const { mkdir, writeFile } = await import("node:fs/promises");

  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-server-range-"));
  const environment = createEnvironment(root);
  await mkdir(environment.dataDir, { recursive: true });
  await mkdir(environment.recordingsDir, { recursive: true });

  const recordingDir = join(environment.recordingsDir, "rec-range");
  await mkdir(recordingDir, { recursive: true });
  const audioPath = join(recordingDir, "audio.mp3");
  const fileBody = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"; // 36 bytes
  await writeFile(audioPath, fileBody);

  const app = await createApp({ environment });

  const { RuntimeStore } = await import("./runtime/store.js");
  const sideStore = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  sideStore.upsertRecording({
    id: "rec-range",
    title: "Range probe",
    createdAt: "2026-04-23T10:00:00.000Z",
    durationSeconds: 5,
    serialNumber: "PLAUD-1",
    scene: null,
    localPath: audioPath,
    contentType: "audio/mpeg",
    bytesWritten: fileBody.length,
    mirroredAt: "2026-04-23T10:05:00.000Z",
    lastWebhookStatus: "success",
    lastWebhookAttemptAt: "2026-04-23T10:05:02.000Z",
    dismissed: false,
    dismissedAt: null,
    sequenceNumber: null,
  });
  sideStore.close();

  const fullResponse = await app.inject({ method: "GET", url: "/api/recordings/rec-range/audio" });
  assert.equal(fullResponse.statusCode, 200);
  assert.equal(fullResponse.headers["accept-ranges"], "bytes");
  assert.equal(fullResponse.headers["content-length"], String(fileBody.length));
  assert.equal(fullResponse.headers["content-type"], "audio/mpeg");
  const disposition = fullResponse.headers["content-disposition"];
  assert.ok(typeof disposition === "string", "content-disposition must be present");
  assert.match(disposition as string, /^inline;/);
  // Title is "Range probe" → sanitised to "Range_probe.mp3".
  assert.match(disposition as string, /filename="Range_probe\.mp3"/);
  assert.match(disposition as string, /filename\*=UTF-8''Range_probe\.mp3/);
  assert.equal(fullResponse.body, fileBody);

  const rangedResponse = await app.inject({
    method: "GET",
    url: "/api/recordings/rec-range/audio",
    headers: { range: "bytes=10-19" },
  });
  assert.equal(rangedResponse.statusCode, 206);
  assert.equal(rangedResponse.headers["content-range"], `bytes 10-19/${fileBody.length}`);
  assert.equal(rangedResponse.headers["content-length"], "10");
  assert.equal(rangedResponse.body, fileBody.slice(10, 20));

  const suffixResponse = await app.inject({
    method: "GET",
    url: "/api/recordings/rec-range/audio",
    headers: { range: "bytes=-6" },
  });
  assert.equal(suffixResponse.statusCode, 206);
  assert.equal(suffixResponse.body, fileBody.slice(-6));

  const unsatisfiable = await app.inject({
    method: "GET",
    url: "/api/recordings/rec-range/audio",
    headers: { range: "bytes=9999-" },
  });
  assert.equal(unsatisfiable.statusCode, 416);
  assert.equal(unsatisfiable.headers["content-range"], `bytes */${fileBody.length}`);

  await app.close();
});

test("createApp returns 202 from POST /api/sync/run and exposes status via GET /api/sync/runs/:id", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-server-async-"));
  const environment = createEnvironment(root);
  const app = await createApp({
    environment,
    plaudFetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/user/me")) {
        return createJsonResponse({ status: 0, data: { uid: "user-1" } });
      }
      if (url.includes("/file/simple/web")) {
        // Empty Plaud account so the sync completes immediately with no work.
        return createJsonResponse({ status: 0, data_file_total: 0, data_file_list: [] });
      }
      throw new Error(`Unexpected Plaud fetch: ${url}`);
    },
  });

  const tokenResponse = await app.inject({
    method: "POST",
    url: "/api/auth/token",
    payload: { accessToken: "token-value" },
  });
  assert.equal(tokenResponse.statusCode, 200);

  const startResponse = await app.inject({
    method: "POST",
    url: "/api/sync/run",
    payload: { limit: 0 },
  });
  assert.equal(startResponse.statusCode, 202, "POST /api/sync/run returns 202 for accepted-but-async");
  const { id, status } = startResponse.json();
  assert.equal(status, "running");
  assert.match(id, /^[0-9a-f-]+$/);

  // Poll the dedicated status endpoint until the worker (kicked off via
  // setImmediate) marks the row as completed.
  let runJson: { status: string } | null = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const statusResponse = await app.inject({ method: "GET", url: `/api/sync/runs/${id}` });
    assert.equal(statusResponse.statusCode, 200);
    runJson = statusResponse.json() as { status: string };
    if (runJson?.status !== "running") {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(runJson?.status, "completed");

  const unknownResponse = await app.inject({ method: "GET", url: "/api/sync/runs/does-not-exist" });
  assert.equal(unknownResponse.statusCode, 404);

  await app.close();
});

test("createApp rejects a backfill that collides with an active sync", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-server-backfill-conflict-"));
  const environment = createEnvironment(root);
  const queued: Array<() => Promise<unknown>> = [];
  const app = await createApp({
    environment,
    scheduler: (work) => {
      queued.push(work);
    },
  });

  const syncResponse = await app.inject({
    method: "POST",
    url: "/api/sync/run",
    payload: { limit: 1 },
  });
  assert.equal(syncResponse.statusCode, 202);

  const backfillResponse = await app.inject({
    method: "POST",
    url: "/api/backfill/run",
    payload: { from: "2024-01-01", to: "2024-01-31", limit: 10 },
  });
  assert.equal(backfillResponse.statusCode, 409);
  assert.match(backfillResponse.json().message, /Cannot start backfill/);
  assert.equal(queued.length, 1, "conflicting backfill must not dispatch background work");

  await app.close();
});

test("createApp rejects audio requests for unsafe ids", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-server-unsafe-"));
  const environment = createEnvironment(root);
  const app = await createApp({ environment });

  const response = await app.inject({
    method: "GET",
    url: "/api/recordings/..%2Fsecrets/audio",
  });
  assert.equal(response.statusCode, 400);

  await app.close();
});

test("createApp exposes GET /api/devices populated by a sync refresh", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-server-devices-"));
  const environment = createEnvironment(root);
  const app = await createApp({
    environment,
    plaudFetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/user/me")) {
        return createJsonResponse({ status: 0, data: { uid: "user-1" } });
      }
      if (url.endsWith("/device/list")) {
        return createJsonResponse({
          status: 0,
          data_devices: [
            { sn: "PLAUD-OFFICE", name: "Office", model: "888", version_number: 131400 },
            { sn: "PLAUD-FIELD", name: "Field rig", model: "888", version_number: 131400 },
          ],
        });
      }
      if (url.includes("/file/simple/web")) {
        return createJsonResponse({ status: 0, data_file_total: 0, data_file_list: [] });
      }
      throw new Error(`Unexpected Plaud fetch: ${url}`);
    },
  });

  // Pre-sync: catalog empty, endpoint returns an empty array (not 404 or 500).
  const beforeResponse = await app.inject({ method: "GET", url: "/api/devices" });
  assert.equal(beforeResponse.statusCode, 200);
  assert.deepEqual(beforeResponse.json(), { devices: [] });

  // Seed a token so sync can run.
  const tokenResponse = await app.inject({
    method: "POST",
    url: "/api/auth/token",
    payload: { accessToken: "token-value" },
  });
  assert.equal(tokenResponse.statusCode, 200);

  // Fire a limit=0 sync (refresh-only path) and poll until it lands.
  const syncResponse = await app.inject({
    method: "POST",
    url: "/api/sync/run",
    payload: { limit: 0 },
  });
  assert.equal(syncResponse.statusCode, 202);
  const { id } = syncResponse.json() as { id: string };

  let runStatus = "running";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const statusResponse = await app.inject({ method: "GET", url: `/api/sync/runs/${id}` });
    runStatus = (statusResponse.json() as { status: string }).status;
    if (runStatus !== "running") {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(runStatus, "completed");

  const afterResponse = await app.inject({ method: "GET", url: "/api/devices" });
  assert.equal(afterResponse.statusCode, 200);
  const afterJson = afterResponse.json() as { devices: Array<{ serialNumber: string; displayName: string; model: string; firmwareVersion: number | null; lastSeenAt: string }> };
  assert.equal(afterJson.devices.length, 2);
  const office = afterJson.devices.find((d) => d.serialNumber === "PLAUD-OFFICE");
  assert.equal(office?.displayName, "Office");
  assert.equal(office?.model, "888");
  assert.equal(office?.firmwareVersion, 131400);
  assert.equal(typeof office?.lastSeenAt, "string");

  await app.close();
});

test("createApp GET /api/backfill/candidates previews recordings with state annotations", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-server-preview-"));
  const environment = createEnvironment(root);
  const app = await createApp({
    environment,
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
              id: "rec-new",
              filename: "new.mp3",
              fullname: "New recording",
              filesize: 500,
              start_time: 1713780000000,
              end_time: 1713780300000,
              duration: 300,
              edit_time: 1713780310000,
              is_trash: false,
              is_trans: true,
              is_summary: false,
              serial_number: "PLAUD-X",
              scene: 1,
            },
            {
              id: "rec-old",
              filename: "old.mp3",
              fullname: "Old recording",
              filesize: 500,
              start_time: 1713693600000,
              end_time: 1713693900000,
              duration: 300,
              edit_time: 1713693910000,
              is_trash: false,
              is_trans: true,
              is_summary: false,
              serial_number: "PLAUD-Y",
              scene: 2,
            },
          ],
        });
      }
      throw new Error(`Unexpected Plaud fetch: ${url}`);
    },
  });

  // Seed a token so preview can validate.
  const tokenResponse = await app.inject({
    method: "POST",
    url: "/api/auth/token",
    payload: { accessToken: "token-value" },
  });
  assert.equal(tokenResponse.statusCode, 200);

  // No filters.
  const fullResponse = await app.inject({
    method: "GET",
    url: "/api/backfill/candidates",
  });
  assert.equal(fullResponse.statusCode, 200);
  const full = fullResponse.json() as {
    plaudTotal: number;
    matched: number;
    missing: number;
    previewLimit: number;
    recordings: Array<{ id: string; state: string; serialNumber: string | null; sequenceNumber: number | null }>;
  };
  assert.equal(full.plaudTotal, 2);
  assert.equal(full.matched, 2);
  assert.equal(full.missing, 2, "nothing mirrored yet — both are missing");
  assert.equal(full.previewLimit, 200);
  assert.equal(full.recordings.length, 2);
  assert.ok(full.recordings.every((r) => r.state === "missing"));

  // Device filter narrows to one.
  const filteredResponse = await app.inject({
    method: "GET",
    url: "/api/backfill/candidates?serialNumber=PLAUD-X&previewLimit=10",
  });
  assert.equal(filteredResponse.statusCode, 200);
  const filtered = filteredResponse.json() as {
    matched: number;
    missing: number;
    previewLimit: number;
    recordings: Array<{ id: string; serialNumber: string | null }>;
  };
  assert.equal(filtered.matched, 1);
  assert.equal(filtered.missing, 1);
  assert.equal(filtered.previewLimit, 10);
  assert.equal(filtered.recordings[0]?.id, "rec-new");
  assert.equal(filtered.recordings[0]?.serialNumber, "PLAUD-X");

  await app.close();
});

test("operator auth disabled: routes stay open, session reports authRequired=false, health warns", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-server-noauth-"));
  const environment = createEnvironment(root);
  const app = await createApp({
    environment,
    plaudFetchImpl: async () => {
      throw new Error("Unexpected Plaud fetch in auth-disabled test");
    },
  });

  const session = await app.inject({ method: "GET", url: "/api/session" });
  assert.equal(session.statusCode, 200);
  assert.deepEqual(session.json(), { authRequired: false, authenticated: true });

  const config = await app.inject({ method: "GET", url: "/api/config" });
  assert.equal(config.statusCode, 200);

  const health = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(health.statusCode, 200);
  const warnings = (health.json() as { warnings: string[] }).warnings;
  assert.ok(
    warnings.some((warning) => warning.includes("PLAUD_MIRROR_ADMIN_PASSPHRASE")),
    "health must surface the disabled access control so the gap is visible",
  );

  await app.close();
});

test("operator auth enabled: gates /api, login issues a session cookie, throttles brute force, redacts health PII", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-server-auth-"));
  const environment: ServerEnvironment = {
    ...createEnvironment(root),
    adminPassphrase: "correct-horse",
  };
  const app = await createApp({
    environment,
    plaudFetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/user/me")) {
        return createJsonResponse({ status: 0, data: { uid: "user-1", email: "op@example.com" } });
      }
      throw new Error(`Unexpected Plaud fetch: ${url}`);
    },
  });

  // Every non-public /api route is gated.
  const blocked = await app.inject({ method: "GET", url: "/api/config" });
  assert.equal(blocked.statusCode, 401);
  const blockedSync = await app.inject({ method: "POST", url: "/api/sync/run", payload: {} });
  assert.equal(blockedSync.statusCode, 401);

  // Health stays public for status probes, without the disabled-warning.
  const publicHealth = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(publicHealth.statusCode, 200);
  const publicWarnings = (publicHealth.json() as { warnings: string[] }).warnings;
  assert.ok(!publicWarnings.some((warning) => warning.includes("PLAUD_MIRROR_ADMIN_PASSPHRASE")));

  // Session status without a cookie.
  const anonSession = await app.inject({ method: "GET", url: "/api/session" });
  assert.deepEqual(anonSession.json(), { authRequired: true, authenticated: false });

  // Wrong passphrase is a 401 form error.
  const badLogin = await app.inject({
    method: "POST",
    url: "/api/session/login",
    payload: { passphrase: "wrong" },
  });
  assert.equal(badLogin.statusCode, 401);

  // Right passphrase issues an HttpOnly SameSite=Lax cookie.
  const goodLogin = await app.inject({
    method: "POST",
    url: "/api/session/login",
    payload: { passphrase: "correct-horse" },
  });
  assert.equal(goodLogin.statusCode, 200);
  const setCookie = String(goodLogin.headers["set-cookie"]);
  assert.match(setCookie, /plaud_mirror_session=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  const cookie = setCookie.split(";")[0]!;

  // The cookie unlocks gated routes and the full health payload.
  const allowed = await app.inject({ method: "GET", url: "/api/config", headers: { cookie } });
  assert.equal(allowed.statusCode, 200);

  const tokenSave = await app.inject({
    method: "POST",
    url: "/api/auth/token",
    headers: { cookie },
    payload: { accessToken: "token-value" },
  });
  assert.equal(tokenSave.statusCode, 200);

  const authedHealth = await app.inject({ method: "GET", url: "/api/health", headers: { cookie } });
  const authedSummary = (authedHealth.json() as { auth: { userSummary: unknown } }).auth.userSummary;
  assert.ok(authedSummary, "authenticated health keeps the Plaud account summary");

  const anonHealth = await app.inject({ method: "GET", url: "/api/health" });
  const anonSummary = (anonHealth.json() as { auth: { userSummary: unknown } }).auth.userSummary;
  assert.equal(anonSummary, null, "unauthenticated health must redact the Plaud account summary (PII)");

  const cookieSession = await app.inject({ method: "GET", url: "/api/session", headers: { cookie } });
  assert.deepEqual(cookieSession.json(), { authRequired: true, authenticated: true });

  // Logout clears the cookie.
  const logout = await app.inject({ method: "POST", url: "/api/session/logout", headers: { cookie } });
  assert.match(String(logout.headers["set-cookie"]), /Max-Age=0/);

  // Brute force: five failures inside the window block the sixth attempt
  // even with the right passphrase.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failed = await app.inject({
      method: "POST",
      url: "/api/session/login",
      payload: { passphrase: "nope" },
    });
    assert.equal(failed.statusCode, 401);
  }
  const throttled = await app.inject({
    method: "POST",
    url: "/api/session/login",
    payload: { passphrase: "correct-horse" },
  });
  assert.equal(throttled.statusCode, 429);

  await app.close();
});

test("operator auth enabled: protocol status stays public and sanitized", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-server-protocol-public-"));
  const environment: ServerEnvironment = {
    ...createEnvironment(root),
    adminPassphrase: "correct-horse",
  };
  const app = await createApp({
    environment,
    plaudFetchImpl: async () => {
      throw new Error("Unexpected Plaud fetch in protocol status public test");
    },
  });

  const blockedConfig = await app.inject({ method: "GET", url: "/api/config" });
  assert.equal(blockedConfig.statusCode, 401);

  const protocolStatus = await app.inject({
    method: "GET",
    url: "/api/protocol/sync-jobs/plaud-mirror-recordings-sync/status",
  });
  assert.equal(protocolStatus.statusCode, 200);
  assert.equal(protocolStatus.headers["cache-control"], "no-store");

  const body = protocolStatus.json() as {
    job_id: string;
    condition: string;
    severity: string;
    auth?: unknown;
    userSummary?: unknown;
    summary: string;
  };
  assert.equal(body.job_id, "plaud-mirror-recordings-sync");
  assert.equal(body.condition, "degraded");
  assert.equal(body.severity, "critical");
  assert.equal(body.auth, undefined);
  assert.equal(body.userSummary, undefined);
  assert.ok(body.summary.includes("Plaud auth is missing"));

  await app.close();
});

test("connect flow: start mints a captureId, complete validates it and stores the captured token", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-server-connect-"));
  const environment: ServerEnvironment = {
    ...createEnvironment(root),
    adminPassphrase: "correct-horse",
  };
  const app = await createApp({
    environment,
    plaudFetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/user/me")) {
        return createJsonResponse({ status: 0, data: { uid: "user-1" } });
      }
      throw new Error(`Unexpected Plaud fetch: ${url}`);
    },
  });

  // Both connect routes are gated by the operator session.
  const anon = await app.inject({ method: "POST", url: "/api/connect/start" });
  assert.equal(anon.statusCode, 401);

  const login = await app.inject({
    method: "POST",
    url: "/api/session/login",
    payload: { passphrase: "correct-horse" },
  });
  const cookie = String(login.headers["set-cookie"]).split(";")[0]!;

  // Start a capture.
  const start = await app.inject({ method: "POST", url: "/api/connect/start", headers: { cookie } });
  assert.equal(start.statusCode, 200);
  const captureId = start.json().captureId as string;
  assert.ok(captureId);

  // Complete with the live captureId → token validated against Plaud and stored.
  const complete = await app.inject({
    method: "POST",
    url: "/api/connect/complete",
    headers: { cookie },
    payload: { token: "captured-bearer", captureId },
  });
  assert.equal(complete.statusCode, 200);
  assert.equal(complete.json().state, "healthy");

  // The captureId is single-use: replaying it is a 409.
  const replay = await app.inject({
    method: "POST",
    url: "/api/connect/complete",
    headers: { cookie },
    payload: { token: "captured-bearer", captureId },
  });
  assert.equal(replay.statusCode, 409);

  await app.close();
});

test("connect flow: complete without a live captureId is rejected (token-fixation defence)", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-server-connect-nofix-"));
  const environment: ServerEnvironment = {
    ...createEnvironment(root),
    adminPassphrase: "correct-horse",
  };
  const app = await createApp({
    environment,
    plaudFetchImpl: async () => {
      throw new Error("Plaud must NOT be called when the captureId is missing/invalid");
    },
  });

  const login = await app.inject({
    method: "POST",
    url: "/api/session/login",
    payload: { passphrase: "correct-horse" },
  });
  const cookie = String(login.headers["set-cookie"]).split(";")[0]!;

  const forged = await app.inject({
    method: "POST",
    url: "/api/connect/complete",
    headers: { cookie },
    payload: { token: "someone-elses-valid-token", captureId: "not-a-real-capture" },
  });
  assert.equal(forged.statusCode, 409);

  await app.close();
});
