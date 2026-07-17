import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { TranscriptionIntakeRequest, TranscriptionStatusEvent } from "@plaud-mirror/shared";

import { createApp } from "./server.js";
import type { ServerEnvironment } from "./runtime/environment.js";
import { RuntimeStore } from "./runtime/store.js";
import { buildTranscriptionStatusSignature } from "./runtime/transcription-auth.js";

test("transcription HTTP routes separate operator, intake, artifact, and status credentials", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "plaud-mirror-transcription-http-"));
  const environment = createEnvironment(root);
  let intakePayload: TranscriptionIntakeRequest | null = null;
  const app = await createApp({
    environment,
    plaudFetchImpl: async () => { throw new Error("Unexpected Plaud request"); },
    transcriptionFetchImpl: async (input, init) => {
      const url = String(input);
      if (url.endsWith("/v1/intake-capabilities")) {
        assert.ok([
          "Bearer destination-intake-credential",
          "Bearer second-destination-intake-credential",
        ].includes(new Headers(init?.headers).get("authorization") ?? ""));
        return jsonResponse({
          schemaVersion: "transcription.intake-capabilities.v1",
          provider: { name: "HTTP Test Transcriber", version: "1.0.0" },
          intakeContract: "transcription.intake.v1",
          statusContract: "transcription.intake-status.v1",
          statusPush: true,
          statusPull: true,
        });
      }
      if (url.endsWith("/v1/intakes")) {
        intakePayload = JSON.parse(String(init?.body)) as TranscriptionIntakeRequest;
        return jsonResponse({
          schemaVersion: "transcription.intake-admission.v1",
          intakeId: "http-intake-one",
          status: "accepted",
          deduplicated: false,
        }, 202);
      }
      throw new Error(`Unexpected transcription request: ${url}`);
    },
  });
  t.after(async () => app.close());

  assert.equal((await app.inject({ method: "GET", url: "/api/transcription" })).statusCode, 401);
  const login = await app.inject({
    method: "POST",
    url: "/api/session/login",
    payload: { passphrase: "operator-passphrase" },
  });
  assert.equal(login.statusCode, 200);
  const setCookie = login.headers["set-cookie"]!;
  const cookie = (Array.isArray(setCookie) ? setCookie[0]! : setCookie).split(";", 1)[0]!;
  const operatorHeaders = { cookie };

  const empty = await app.inject({ method: "GET", url: "/api/transcription", headers: operatorHeaders });
  assert.deepEqual(empty.json(), { destinations: [] });
  const health = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().warnings.some((warning: string) => /transcription/i.test(warning)), false);

  const createdResponse = await app.inject({
    method: "POST",
    url: "/api/transcription/destinations",
    headers: operatorHeaders,
    payload: {
      name: "HTTP Test Transcriber",
      baseUrl: "http://127.0.0.1:4500",
      artifactBaseUrl: "http://127.0.0.1:3040",
      intakeCredential: "destination-intake-credential",
      statusSigningSecret: "destination-status-secret",
      enabled: false,
      primary: true,
    },
  });
  assert.equal(createdResponse.statusCode, 201);
  const created = createdResponse.json();
  assert.equal(typeof created.artifactAccessToken, "string");
  assert.equal(created.destination.hasArtifactAccessToken, true);

  const testResponse = await app.inject({
    method: "POST",
    url: `/api/transcription/destinations/${created.destination.id}/test`,
    headers: operatorHeaders,
  });
  assert.equal(testResponse.json().ok, true);
  const enabled = await app.inject({
    method: "PATCH",
    url: `/api/transcription/destinations/${created.destination.id}`,
    headers: operatorHeaders,
    payload: { enabled: true },
  });
  assert.equal(enabled.json().enabled, true);

  const secondCreatedResponse = await app.inject({
    method: "POST",
    url: "/api/transcription/destinations",
    headers: operatorHeaders,
    payload: {
      name: "Second HTTP Test Transcriber",
      baseUrl: "http://127.0.0.1:4501",
      artifactBaseUrl: "http://127.0.0.1:3040",
      intakeCredential: "second-destination-intake-credential",
      statusSigningSecret: "second-destination-status-secret",
      enabled: false,
      primary: false,
    },
  });
  assert.equal(secondCreatedResponse.statusCode, 201);
  const secondCreated = secondCreatedResponse.json();
  const secondTest = await app.inject({
    method: "POST",
    url: `/api/transcription/destinations/${secondCreated.destination.id}/test`,
    headers: operatorHeaders,
  });
  assert.equal(secondTest.json().ok, true);
  const unconfirmedSecondEnable = await app.inject({
    method: "PATCH",
    url: `/api/transcription/destinations/${secondCreated.destination.id}`,
    headers: operatorHeaders,
    payload: { enabled: true },
  });
  assert.equal(unconfirmedSecondEnable.statusCode, 409);
  assert.match(unconfirmedSecondEnable.json().message, /duplicate processing costs/);
  const confirmedSecondEnable = await app.inject({
    method: "PATCH",
    url: `/api/transcription/destinations/${secondCreated.destination.id}`,
    headers: operatorHeaders,
    payload: { enabled: true, confirmAdditionalCost: true },
  });
  assert.equal(confirmedSecondEnable.statusCode, 200);
  assert.equal(confirmedSecondEnable.json().enabled, true);

  const audioPath = join(environment.recordingsDir, "http-recording.mp3");
  await mkdir(environment.recordingsDir, { recursive: true });
  await writeFile(audioPath, Buffer.from("http route audio"));
  const store = new RuntimeStore({
    dbPath: join(environment.dataDir, "app.db"),
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  store.upsertRecording({
    id: "http-recording",
    title: "HTTP recording",
    createdAt: "2026-07-16T10:00:00.000Z",
    durationSeconds: 5,
    serialNumber: "PLAUD-HTTP",
    scene: null,
    localPath: audioPath,
    contentType: "audio/mpeg",
    bytesWritten: Buffer.byteLength("http route audio"),
    mirroredAt: "2026-07-16T10:01:00.000Z",
    lastWebhookStatus: "skipped",
    lastWebhookAttemptAt: null,
    dismissed: false,
    dismissedAt: null,
    upstreamDeletedAt: null,
    upstreamDeletion: null,
    sequenceNumber: null,
  });
  store.commitUpstreamInventory(["http-recording"], ["http-recording"], "2026-07-16T10:02:00.000Z", 1);
  store.close();

  const enqueue = await app.inject({
    method: "POST",
    url: `/api/transcription/destinations/${created.destination.id}/enqueue`,
    headers: operatorHeaders,
    payload: { limit: 1 },
  });
  assert.equal(enqueue.statusCode, 202);
  assert.equal(enqueue.json().enqueued, 1);

  const deliveryList = await app.inject({
    method: "GET",
    url: `/api/transcription/destinations/${created.destination.id}/deliveries`,
    headers: operatorHeaders,
  });
  const delivery = deliveryList.json().items[0];
  const artifactUrl = `/api/transcription/artifacts/${created.destination.id}/${delivery.sha256}`;
  assert.equal((await app.inject({ method: "GET", url: artifactUrl })).statusCode, 401);
  const range = await app.inject({
    method: "GET",
    url: artifactUrl,
    headers: { authorization: `Bearer ${created.artifactAccessToken}`, range: "bytes=0-3" },
  });
  assert.equal(range.statusCode, 206);
  assert.equal(range.headers["content-range"], `bytes 0-3/${Buffer.byteLength("http route audio")}`);
  assert.equal(range.rawPayload.toString(), "http");

  await waitFor(() => intakePayload !== null, 7_000);
  const payload = intakePayload!;
  const statusEvent: TranscriptionStatusEvent = {
    schemaVersion: "transcription.intake-status.v1",
    eventId: "55555555-5555-4555-8555-555555555555",
    idempotencyKey: "status:http-one",
    eventType: "intake.status",
    intakeId: "http-intake-one",
    source: payload.source,
    status: "transcribed",
    occurredAt: new Date().toISOString(),
    transcriptId: "http-transcript",
    recordSha256: "f".repeat(64),
    error: null,
  };
  const timestamp = new Date().toISOString();
  const statusResponse = await app.inject({
    method: "POST",
    url: `/api/transcription/status/${created.destination.id}`,
    headers: {
      "x-transcription-timestamp": timestamp,
      "x-transcription-signature": buildTranscriptionStatusSignature(
        statusEvent,
        timestamp,
        "destination-status-secret",
      ),
    },
    payload: statusEvent,
  });
  assert.equal(statusResponse.statusCode, 202);
  assert.equal(statusResponse.json().delivery.state, "transcribed");
  assert.equal(statusResponse.json().delivery.transcriptRecordSha256, "f".repeat(64));
  assert.equal((await app.inject({
    method: "GET",
    url: artifactUrl,
    headers: { authorization: `Bearer ${created.artifactAccessToken}` },
  })).statusCode, 404);
});

function createEnvironment(root: string): ServerEnvironment {
  return {
    port: 3040,
    host: "127.0.0.1",
    apiBase: "https://api.plaud.ai",
    dataDir: join(root, "data"),
    recordingsDir: join(root, "recordings"),
    masterKey: "local-test-master-key",
    adminPassphrase: "operator-passphrase",
    webDistDir: join(root, "missing-web-dist"),
    defaultSyncLimit: 100,
    requestTimeoutMs: 2_000,
    syncMaxRuntimeMs: 60 * 60_000,
    schedulerIntervalMs: 0,
  };
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for transcription worker");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
