import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { SecretStore } from "./secrets.js";

test("SecretStore encrypts values on disk and loads them back", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-secrets-"));
  const filePath = join(root, "data", "secrets.enc");
  const store = new SecretStore(filePath, "local-test-master-key");

  await store.save({
    accessToken: "token-value",
    webhookSecret: "hook-secret",
  });

  const raw = await readFile(filePath, "utf8");
  assert.doesNotMatch(raw, /token-value/);
  assert.doesNotMatch(raw, /hook-secret/);

  assert.deepEqual(await store.load(), {
    accessToken: "token-value",
    webhookSecret: "hook-secret",
  });
});

test("SecretStore update merges and clears individual values", async () => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-secrets-"));
  const filePath = join(root, "data", "secrets.enc");
  const store = new SecretStore(filePath, "local-test-master-key");

  await store.save({
    accessToken: "token-value",
    webhookSecret: "hook-secret",
  });

  await store.update({
    webhookSecret: null,
  });

  assert.deepEqual(await store.load(), {
    accessToken: "token-value",
    webhookSecret: null,
  });
});
