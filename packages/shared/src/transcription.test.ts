import assert from "node:assert/strict";
import test from "node:test";

import {
  ExactOriginSchema,
  TranscriptionCapabilitiesSchema,
  TranscriptionIntakeRequestSchema,
  UpdateMediaDeliveryFailureReviewRequestSchema,
} from "./transcription.js";

test("Transcription Intake accepts exact secure origins and loopback development only", () => {
  assert.equal(ExactOriginSchema.parse("https://media.example"), "https://media.example");
  assert.equal(ExactOriginSchema.parse("http://127.0.0.1:3400"), "http://127.0.0.1:3400");
  assert.throws(() => ExactOriginSchema.parse("http://media.example"), /HTTPS/);
  assert.throws(() => ExactOriginSchema.parse("https://media.example/intake"), /must not contain a path/);
  assert.throws(() => ExactOriginSchema.parse("https://user:pass@media.example"), /must not contain/);
});

test("Transcription Intake binds source revision to the advertised artifact hash", () => {
  const payload = {
    schemaVersion: "transcription.intake.v1",
    eventId: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: "plaud-mirror:one",
    source: {
      authority: "plaud-mirror",
      collectionId: "plaud-workspace:one",
      itemId: "recording-one",
      artifactRevision: `sha256:${"a".repeat(64)}`,
    },
    artifact: {
      url: `https://mirror.example/api/transcription/artifacts/destination/${"b".repeat(64)}`,
      accessProfile: "bearer",
      sha256: "b".repeat(64),
      bytes: 42,
      contentType: "audio/mpeg",
      filename: "recording.mp3",
      durationSeconds: 3,
    },
    callback: {
      url: "https://mirror.example/api/transcription/status/destination",
      authentication: "hmac-sha256-v1",
    },
    title: "Recording",
    createdAt: "2026-07-16T10:00:00.000Z",
  };
  assert.throws(() => TranscriptionIntakeRequestSchema.parse(payload), /artifactRevision/);
  assert.throws(
    () => TranscriptionIntakeRequestSchema.parse({
      ...payload,
      source: { ...payload.source, artifactRevision: `sha256:${"b".repeat(64)}` },
      artifact: { ...payload.artifact, url: `${payload.artifact.url}?token=secret` },
    }),
    /must not contain credentials/,
  );
});

test("Transcription capability discovery is strict and provider-neutral", () => {
  const capabilities = TranscriptionCapabilitiesSchema.parse({
    schemaVersion: "transcription.intake-capabilities.v1",
    provider: { name: "Any Transcript Service", version: "1.2.3" },
    intakeContract: "transcription.intake.v1",
    statusContract: "transcription.intake-status.v1",
    statusPush: true,
    statusPull: true,
  });
  assert.equal(capabilities.provider.name, "Any Transcript Service");
  assert.throws(() => TranscriptionCapabilitiesSchema.parse({ ...capabilities, media2textOnly: true }));
});

test("delivery failure reviews keep policy evidence structured and bounded", () => {
  assert.deepEqual(UpdateMediaDeliveryFailureReviewRequestSchema.parse({
    category: "policy",
    resolution: "active",
    providerInvoked: false,
    policyLimitMinutes: 180,
  }), {
    category: "policy",
    resolution: "active",
    providerInvoked: false,
    policyLimitMinutes: 180,
  });
  assert.throws(() => UpdateMediaDeliveryFailureReviewRequestSchema.parse({
    category: "policy",
    resolution: "active",
    providerInvoked: false,
    policyLimitMinutes: null,
  }), /required/);
  assert.throws(() => UpdateMediaDeliveryFailureReviewRequestSchema.parse({
    category: "dependency",
    resolution: "resolved",
    providerInvoked: false,
    policyLimitMinutes: 180,
  }), /only valid/);
});
