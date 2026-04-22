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
