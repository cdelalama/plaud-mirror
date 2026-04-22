import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createApp } from "../../apps/api/dist/server.js";

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function createEnvironment(root) {
  return {
    port: 3040,
    host: "127.0.0.1",
    apiBase: "https://api.plaud.ai",
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    masterKey: "local-test-master-key",
    webDistDir: join(root, "missing-web-dist"),
    defaultSyncLimit: 100,
    requestTimeoutMs: 5000,
  };
}

test("built API serves the health route", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-http-"));
  const app = await createApp({
    environment: createEnvironment(root),
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

  const response = await app.inject({
    method: "GET",
    url: "/api/health",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().phase, "Phase 2 - first usable slice");

  await app.close();
});
