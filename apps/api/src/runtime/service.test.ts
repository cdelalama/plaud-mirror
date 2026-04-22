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
