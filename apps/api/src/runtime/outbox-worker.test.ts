import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { WebhookPayload } from "@plaud-mirror/shared";

import {
  OUTBOX_BACKOFF_SCHEDULE_MS,
  OUTBOX_MAX_ATTEMPTS,
  OutboxWorker,
} from "./outbox-worker.js";
import { SecretStore } from "./secrets.js";
import { RuntimeStore } from "./store.js";

function makePayload(recordingId: string): WebhookPayload {
  return {
    event: "recording.synced",
    source: "plaud-mirror",
    recording: {
      id: recordingId,
      title: `Title for ${recordingId}`,
      createdAt: null,
      localPath: `recordings/${recordingId}/audio.mp3`,
      format: "mp3",
      contentType: "audio/mpeg",
      bytesWritten: 1024,
    },
    sync: {
      syncedAt: "2026-04-26T10:00:00.000Z",
      deliveryAttempt: 1,
      mode: "sync",
    },
  };
}

async function setup(now: Date = new Date("2026-04-26T10:00:00.000Z")) {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-outbox-worker-"));
  const store = new RuntimeStore({
    dbPath: join(root, "data", "app.db"),
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    defaultSyncLimit: 100,
  });
  const secrets = new SecretStore(join(root, "data", "secrets.enc"), "test-master-key");
  await secrets.update({ webhookSecret: "shared-secret" });
  store.saveConfig({ webhookUrl: "https://hooks.example/plaud" });
  store.setWebhookSecretPresence(true);

  // Tick clock controlled by tests so backoff calculations are deterministic.
  const clock = { value: now };
  return { root, store, secrets, clock };
}

test("OutboxWorker.runTick on empty queue returns skipped", async () => {
  const { store, secrets, clock } = await setup();
  const worker = new OutboxWorker({
    store,
    secrets,
    requestTimeoutMs: 5_000,
    webhookFetchImpl: async () => new Response("", { status: 200 }),
    now: () => clock.value,
  });

  const result = await worker.runTick();
  assert.deepEqual(result, { skipped: true, reason: "outbox empty" });

  store.close();
});

test("OutboxWorker.runTick delivers a pending item on 2xx and marks it delivered", async () => {
  const { store, secrets, clock } = await setup();
  const item = store.enqueueOutboxItem({
    recordingId: "rec-1",
    payload: makePayload("rec-1"),
  });

  const calls: Array<{ url: string; signature: string; body: string }> = [];
  const worker = new OutboxWorker({
    store,
    secrets,
    requestTimeoutMs: 5_000,
    webhookFetchImpl: async (input, init) => {
      calls.push({
        url: String(input),
        signature: String((init?.headers as Record<string, string>)["x-plaud-mirror-signature-256"]),
        body: String(init?.body),
      });
      return new Response("", { status: 200 });
    },
    now: () => clock.value,
  });

  const result = await worker.runTick();
  assert.equal(result, undefined);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://hooks.example/plaud");
  assert.match(calls[0]?.signature ?? "", /^sha256=[0-9a-f]{64}$/);

  // The body actually POSTed must carry deliveryAttempt = 1 (this was
  // attempt #1) — proves the worker stamps the attempt number at
  // delivery time rather than reusing the value baked in at enqueue.
  const sent = JSON.parse(calls[0]?.body ?? "{}") as WebhookPayload;
  assert.equal(sent.sync.deliveryAttempt, 1);

  // FSM: row is now delivered with attempts=1.
  const persisted = store.getOutboxItem(item.id);
  assert.equal(persisted?.state, "delivered");
  assert.equal(persisted?.attempts, 1);

  store.close();
});

test("OutboxWorker.runTick on transient failure schedules retry with first backoff entry", async () => {
  const baseNow = new Date("2026-04-26T10:00:00.000Z");
  const { store, secrets, clock } = await setup(baseNow);
  const item = store.enqueueOutboxItem({
    recordingId: "rec-2",
    payload: makePayload("rec-2"),
  });

  const worker = new OutboxWorker({
    store,
    secrets,
    requestTimeoutMs: 5_000,
    webhookFetchImpl: async () => new Response("", { status: 503 }),
    now: () => clock.value,
  });

  await worker.runTick();

  const persisted = store.getOutboxItem(item.id);
  assert.equal(persisted?.state, "retry_waiting");
  assert.equal(persisted?.attempts, 1);
  assert.equal(persisted?.lastError, "Webhook returned HTTP 503");

  const expectedNext = new Date(baseNow.getTime() + OUTBOX_BACKOFF_SCHEDULE_MS[0]!);
  assert.equal(persisted?.nextAttemptAt, expectedNext.toISOString());

  store.close();
});

test("OutboxWorker.runTick stamps deliveryAttempt monotonically across retries", async () => {
  const baseNow = new Date("2026-04-26T10:00:00.000Z");
  const { store, secrets, clock } = await setup(baseNow);
  const item = store.enqueueOutboxItem({
    recordingId: "rec-3",
    payload: makePayload("rec-3"),
  });

  const seen: number[] = [];
  let respondOk = false;
  const worker = new OutboxWorker({
    store,
    secrets,
    requestTimeoutMs: 5_000,
    webhookFetchImpl: async (_url, init) => {
      const sent = JSON.parse(String(init?.body)) as WebhookPayload;
      seen.push(sent.sync.deliveryAttempt);
      return new Response("", { status: respondOk ? 200 : 503 });
    },
    now: () => clock.value,
  });

  // Attempt 1: fails.
  await worker.runTick();

  // Advance past the first backoff so the next claim is allowed.
  clock.value = new Date(baseNow.getTime() + OUTBOX_BACKOFF_SCHEDULE_MS[0]! + 1_000);
  // Attempt 2: also fails.
  await worker.runTick();

  // Advance past the second backoff and let it succeed.
  clock.value = new Date(clock.value.getTime() + OUTBOX_BACKOFF_SCHEDULE_MS[1]! + 1_000);
  respondOk = true;
  await worker.runTick();

  assert.deepEqual(seen, [1, 2, 3], "deliveryAttempt must be stamped at delivery time, not at enqueue");
  assert.equal(store.getOutboxItem(item.id)?.state, "delivered");
  assert.equal(store.getOutboxItem(item.id)?.attempts, 3);

  store.close();
});

test("OutboxWorker.runTick escalates to permanently_failed on the OUTBOX_MAX_ATTEMPTS-th failure", async () => {
  const baseNow = new Date("2026-04-26T10:00:00.000Z");
  const { store, secrets, clock } = await setup(baseNow);
  const item = store.enqueueOutboxItem({
    recordingId: "rec-4",
    payload: makePayload("rec-4"),
  });

  const worker = new OutboxWorker({
    store,
    secrets,
    requestTimeoutMs: 5_000,
    webhookFetchImpl: async () => new Response("", { status: 500 }),
    now: () => clock.value,
  });

  // Drive the worker through OUTBOX_MAX_ATTEMPTS failures.
  for (let attempt = 1; attempt <= OUTBOX_MAX_ATTEMPTS; attempt += 1) {
    await worker.runTick();
    if (attempt < OUTBOX_MAX_ATTEMPTS) {
      // Skip the backoff window so the next runTick can claim the row.
      const backoff = OUTBOX_BACKOFF_SCHEDULE_MS[attempt - 1]!;
      clock.value = new Date(clock.value.getTime() + backoff + 1_000);
    }
  }

  const persisted = store.getOutboxItem(item.id);
  assert.equal(persisted?.state, "permanently_failed");
  assert.equal(persisted?.attempts, OUTBOX_MAX_ATTEMPTS);
  assert.equal(persisted?.nextAttemptAt, null);

  // No further claim is possible.
  assert.equal(store.claimOutboxItem(clock.value), null);

  store.close();
});

test("OutboxWorker.runTick escalates immediately when webhook is unconfigured", async () => {
  const baseNow = new Date("2026-04-26T10:00:00.000Z");
  const { root, store, secrets, clock } = await setup(baseNow);
  // Drop the webhook config that setup() seeded so the worker hits the
  // "webhook not configured" branch rather than 503-ing.
  store.saveConfig({ webhookUrl: null });
  await secrets.update({ webhookSecret: null });
  store.setWebhookSecretPresence(false);
  const item = store.enqueueOutboxItem({
    recordingId: "rec-5",
    payload: makePayload("rec-5"),
  });

  let networkCalled = false;
  const worker = new OutboxWorker({
    store,
    secrets,
    requestTimeoutMs: 5_000,
    webhookFetchImpl: async () => {
      networkCalled = true;
      return new Response("", { status: 200 });
    },
    now: () => clock.value,
  });

  await worker.runTick();

  assert.equal(networkCalled, false, "no HTTP call should happen when webhook is unconfigured");
  const persisted = store.getOutboxItem(item.id);
  assert.equal(persisted?.state, "permanently_failed");
  assert.equal(persisted?.lastError, "webhook not configured");

  store.close();
  void root;
});
