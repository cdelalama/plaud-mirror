import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createApp } from "./server.js";
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

  const app = await createApp({ environment });

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
  });
  sideStore.close();

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

  const audioMissingAfterDelete = await app.inject({
    method: "GET",
    url: "/api/recordings/rec-http/audio",
  });
  assert.equal(audioMissingAfterDelete.statusCode, 404);

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
