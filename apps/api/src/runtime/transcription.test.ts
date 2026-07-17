import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import type { RecordingMirror, TranscriptionIntakeRequest, TranscriptionStatusEvent } from "@plaud-mirror/shared";

import { SecretStore } from "./secrets.js";
import { RuntimeStore } from "./store.js";
import { buildTranscriptionStatusSignature } from "./transcription-auth.js";
import { TranscriptionService } from "./transcription-service.js";
import { TranscriptionWorker } from "./transcription-worker.js";

const CAPABILITIES = {
  schemaVersion: "transcription.intake-capabilities.v1",
  provider: { name: "Reference Transcriber", version: "1.0.0" },
  intakeContract: "transcription.intake.v1",
  statusContract: "transcription.intake-status.v1",
  statusPush: true,
  statusPull: true,
};

test("neutral transcription canary pins audio, admits it, and applies a signed terminal status", async (t) => {
  let intakePayload: TranscriptionIntakeRequest | null = null;
  const harness = await createHarness(t, async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/intake-capabilities")) {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer intake-credential-value");
      return jsonResponse(CAPABILITIES);
    }
    if (url.endsWith("/v1/intakes")) {
      intakePayload = JSON.parse(String(init?.body)) as TranscriptionIntakeRequest;
      return jsonResponse({
        schemaVersion: "transcription.intake-admission.v1",
        intakeId: "intake-one",
        status: "accepted",
        deduplicated: false,
      }, 202);
    }
    throw new Error(`Unexpected transcription request: ${url}`);
  });

  const created = await configureDestination(harness.service);
  assert.equal((await harness.service.testDestination(created.destination.id)).ok, true);
  await harness.service.updateDestination(created.destination.id, { enabled: true });
  assert.deepEqual(await harness.service.enqueue(created.destination.id, { limit: 1 }), {
    selected: 1,
    enqueued: 1,
    skipped: 0,
    failed: 0,
    errors: [],
  });

  await harness.worker.runTick();
  assert.ok(intakePayload);
  const payload = intakePayload as TranscriptionIntakeRequest;
  assert.equal(payload.source.authority, "plaud-mirror");
  assert.equal(payload.source.artifactRevision, `sha256:${payload.artifact.sha256}`);
  assert.equal(payload.artifact.url.includes("?"), false);
  assert.equal(JSON.stringify(payload).includes(harness.recording.localPath!), false);
  assert.equal(JSON.stringify(payload).includes(created.artifactAccessToken), false);

  const admitted = harness.service.listDeliveries(created.destination.id)[0]!;
  assert.equal(admitted.state, "accepted");
  assert.equal(admitted.retryable, false);
  const artifact = harness.store.getMediaArtifact(admitted.sha256)!;
  await unlink(harness.recording.localPath!);
  assert.equal(
    (await harness.service.authorizeArtifact(
      created.destination.id,
      admitted.sha256,
      `Bearer ${created.artifactAccessToken}`,
    )).path,
    artifact.path,
    "the delivery lease must survive deletion of the mirror source",
  );

  await harness.service.updateDestination(created.destination.id, { enabled: false });
  await harness.service.authorizeArtifact(
    created.destination.id,
    admitted.sha256,
    `Bearer ${created.artifactAccessToken}`,
  );

  const event = makeStatusEvent(payload, "intake-one", "transcribed");
  const timestamp = new Date().toISOString();
  const headers = {
    timestamp,
    signature: buildTranscriptionStatusSignature(event, timestamp, "status-signing-secret"),
  };
  const applied = await harness.service.receiveStatus(created.destination.id, event, headers);
  assert.equal(applied.delivery.state, "transcribed");
  assert.equal(applied.delivery.transcriptId, "transcript-one");
  assert.equal(applied.delivery.transcriptRecordSha256, "f".repeat(64));
  assert.equal(applied.deduplicated, false);
  assert.equal((await harness.service.receiveStatus(created.destination.id, event, headers)).deduplicated, true);
  await assert.rejects(() => access(artifact.path), /ENOENT/);
});

test("status regression rolls back its event id so a corrected replay can succeed", async (t) => {
  let intakePayload: TranscriptionIntakeRequest | null = null;
  const harness = await createHarness(t, async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/intake-capabilities")) return jsonResponse(CAPABILITIES);
    if (url.endsWith("/v1/intakes")) {
      intakePayload = JSON.parse(String(init?.body)) as TranscriptionIntakeRequest;
      return jsonResponse({
        schemaVersion: "transcription.intake-admission.v1",
        intakeId: "intake-regression",
        status: "processing",
        deduplicated: false,
      }, 202);
    }
    throw new Error(`Unexpected transcription request: ${url}`);
  });
  const created = await configureDestination(harness.service);
  await harness.service.testDestination(created.destination.id);
  await harness.service.updateDestination(created.destination.id, { enabled: true });
  await harness.service.enqueue(created.destination.id, { limit: 1 });
  await harness.worker.runTick();
  const payload = intakePayload!;
  const eventId = "22222222-2222-4222-8222-222222222222";
  const regressing = makeStatusEvent(payload, "intake-regression", "accepted", eventId);
  await assert.rejects(
    () => sendStatus(harness.service, created.destination.id, regressing),
    (error: Error & { statusCode?: number }) => error.statusCode === 409 && /regress/.test(error.message),
  );
  const corrected = makeStatusEvent(payload, "intake-regression", "processing", eventId);
  assert.equal((await sendStatus(harness.service, created.destination.id, corrected)).deduplicated, false);
});

test("secret read failures return a claimed delivery to retry_waiting", async (t) => {
  const harness = await createHarness(t, async (input) => {
    if (String(input).endsWith("/v1/intake-capabilities")) return jsonResponse(CAPABILITIES);
    throw new Error(`Unexpected transcription request: ${String(input)}`);
  });
  const created = await configureDestination(harness.service);
  await harness.service.testDestination(created.destination.id);
  await harness.service.updateDestination(created.destination.id, { enabled: true });
  await harness.service.enqueue(created.destination.id, { limit: 1 });

  const errors: string[] = [];
  const worker = new TranscriptionWorker({
    store: harness.store,
    secrets: { load: async () => { throw new Error("secrets unreadable"); } } as unknown as SecretStore,
    recordingsDir: harness.recordingsDir,
    requestTimeoutMs: 1_000,
    now: () => new Date("2026-07-16T12:00:00.000Z"),
    onError: ({ message }) => errors.push(message),
  });
  await worker.runTick();
  const delivery = harness.service.listDeliveries(created.destination.id)[0]!;
  assert.equal(delivery.state, "pending");
  assert.match(delivery.lastError ?? "", /secrets unreadable/);
  assert.equal(harness.store.recoverOrphanedMediaDeliveries(), 0, "no row may remain delivering");
  assert.deepEqual(errors, ["secrets unreadable"]);
});

test("admission conflicts are retryable but downstream transcription failures are not", async (t) => {
  let mode: "conflict" | "accepted" = "conflict";
  let intakePayload: TranscriptionIntakeRequest | null = null;
  const harness = await createHarness(t, async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/intake-capabilities")) return jsonResponse(CAPABILITIES);
    if (url.endsWith("/v1/intakes")) {
      intakePayload = JSON.parse(String(init?.body)) as TranscriptionIntakeRequest;
      if (mode === "conflict") return jsonResponse({ error: "conflict" }, 409);
      return jsonResponse({
        schemaVersion: "transcription.intake-admission.v1",
        intakeId: "intake-failure",
        status: "accepted",
        deduplicated: false,
      }, 202);
    }
    throw new Error(`Unexpected transcription request: ${url}`);
  });
  const created = await configureDestination(harness.service);
  await harness.service.testDestination(created.destination.id);
  await harness.service.updateDestination(created.destination.id, { enabled: true });
  await harness.service.enqueue(created.destination.id, { limit: 1 });
  await harness.worker.runTick();
  let delivery = harness.service.listDeliveries(created.destination.id)[0]!;
  assert.equal(delivery.state, "conflict");
  assert.equal(delivery.failureStage, "admission");
  assert.equal(delivery.retryable, true);

  mode = "accepted";
  await harness.service.retryDelivery(delivery.id);
  await harness.worker.runTick();
  const failed = makeStatusEvent(intakePayload!, "intake-failure", "failed");
  delivery = (await sendStatus(harness.service, created.destination.id, failed)).delivery;
  assert.equal(delivery.failureStage, "processing");
  assert.equal(delivery.retryable, false);
  await assert.rejects(() => harness.service.retryDelivery(delivery.id), /not retryable/);
});

test("transcription coverage and replay preview are not capped at 1000 recordings", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-transcription-scale-"));
  const store = new RuntimeStore({
    dbPath: join(root, "data", "app.db"),
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    defaultSyncLimit: 100,
  });
  t.after(() => store.close());
  const ids: string[] = [];
  for (let index = 0; index < 1001; index += 1) {
    const id = `scale-${index}`;
    ids.push(id);
    store.upsertRecording(makeRecording(id, join(root, "recordings", `${id}.mp3`)));
  }
  store.commitUpstreamInventory(ids, ids, "2026-07-16T10:00:00.000Z", ids.length);
  const destinationId = "33333333-3333-4333-8333-333333333333";
  saveDestination(store, destinationId);
  assert.equal(store.countEligibleTranscriptionRecordings(), 1001);
  assert.deepEqual(store.getTranscriptionReplayPreview(destinationId), {
    eligible: 1001,
    alreadyTracked: 0,
    remaining: 1001,
    bytes: 4004,
    durationSeconds: 3003,
  });
});

async function createHarness(
  t: TestContext,
  fetchImpl: typeof fetch,
) {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-transcription-"));
  const recordingsDir = join(root, "recordings");
  await mkdir(recordingsDir, { recursive: true });
  const recording = makeRecording("recording-one", join(recordingsDir, "recording-one.mp3"));
  await writeFile(recording.localPath!, Buffer.from("immutable audio bytes"));
  recording.bytesWritten = Buffer.byteLength("immutable audio bytes");
  const store = new RuntimeStore({
    dbPath: join(root, "data", "app.db"),
    dataDir: join(root, "data"),
    recordingsDir,
    defaultSyncLimit: 100,
  });
  const secrets = new SecretStore(join(root, "data", "secrets.enc"), "test-master-key");
  store.upsertRecording(recording);
  store.commitUpstreamInventory([recording.id], [recording.id], "2026-07-16T10:00:00.000Z", 1);
  const service = new TranscriptionService({
    store,
    secrets,
    recordingsDir,
    requestTimeoutMs: 2_000,
    fetchImpl,
  });
  const worker = new TranscriptionWorker({
    store,
    secrets,
    recordingsDir,
    requestTimeoutMs: 2_000,
    fetchImpl,
  });
  t.after(() => store.close());
  return { root, recordingsDir, recording, store, secrets, service, worker };
}

async function configureDestination(service: TranscriptionService) {
  return service.createDestination({
    name: "Reference Transcriber",
    baseUrl: "http://127.0.0.1:4400",
    artifactBaseUrl: "http://127.0.0.1:3040",
    intakeCredential: "intake-credential-value",
    statusSigningSecret: "status-signing-secret",
    enabled: false,
    primary: true,
  });
}

function makeRecording(id: string, localPath: string): RecordingMirror {
  return {
    id,
    title: `Recording ${id}`,
    createdAt: "2026-07-16T09:00:00.000Z",
    durationSeconds: 3,
    serialNumber: "PLAUD-1",
    scene: null,
    localPath,
    contentType: "audio/mpeg",
    bytesWritten: 4,
    mirroredAt: "2026-07-16T09:01:00.000Z",
    lastWebhookStatus: "skipped",
    lastWebhookAttemptAt: null,
    dismissed: false,
    dismissedAt: null,
    upstreamDeletedAt: null,
    upstreamDeletion: null,
    sequenceNumber: null,
  };
}

function saveDestination(store: RuntimeStore, id: string): void {
  const now = "2026-07-16T10:00:00.000Z";
  store.saveTranscriptionDestination({
    id,
    name: "Scale destination",
    kind: "transcription-intake-v1",
    baseUrl: "https://media.example",
    artifactBaseUrl: "https://mirror.example",
    enabled: false,
    primary: true,
    hasIntakeCredential: false,
    hasStatusSigningSecret: false,
    hasArtifactAccessToken: false,
    providerName: null,
    providerVersion: null,
    lastTestedAt: null,
    lastTestError: null,
    createdAt: now,
    updatedAt: now,
  });
}

function makeStatusEvent(
  payload: TranscriptionIntakeRequest,
  intakeId: string,
  status: "accepted" | "processing" | "transcribed" | "failed",
  eventId = "44444444-4444-4444-8444-444444444444",
): TranscriptionStatusEvent {
  return {
    schemaVersion: "transcription.intake-status.v1",
    eventId,
    idempotencyKey: `status:${eventId}`,
    eventType: "intake.status",
    intakeId,
    source: payload.source,
    status,
    occurredAt: new Date().toISOString(),
    transcriptId: status === "transcribed" ? "transcript-one" : null,
    recordSha256: "f".repeat(64),
    error: status === "failed" ? { code: "transcription_failed" } : null,
  };
}

async function sendStatus(
  service: TranscriptionService,
  destinationId: string,
  event: TranscriptionStatusEvent,
) {
  const timestamp = new Date().toISOString();
  return service.receiveStatus(destinationId, event, {
    timestamp,
    signature: buildTranscriptionStatusSignature(event, timestamp, "status-signing-secret"),
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
