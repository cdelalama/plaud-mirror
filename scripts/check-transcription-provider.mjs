import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const baseUrl = requiredEnv("TRANSCRIPTION_PROVIDER_URL").replace(/\/$/, "");
const credential = requiredEnv("TRANSCRIPTION_INTAKE_CREDENTIAL");
const fixturePath = requiredEnv("TRANSCRIPTION_INTAKE_FIXTURE");
const template = JSON.parse(await readFile(fixturePath, "utf8"));
const runId = randomUUID();
const request = {
  ...template,
  eventId: randomUUID(),
  idempotencyKey: `${template.idempotencyKey}:conformance:${runId}`,
  correlationId: `conformance:${runId}`,
  source: { ...template.source, itemId: `${template.source.itemId}:conformance:${runId}` },
};
const headers = { authorization: `Bearer ${credential}` };

const capabilitiesResponse = await fetch(`${baseUrl}/v1/intake-capabilities`, { headers });
assertStatus(capabilitiesResponse, 200, "capability discovery");
const capabilities = await capabilitiesResponse.json();
assertEqual(capabilities.schemaVersion, "transcription.intake-capabilities.v1", "capability schemaVersion");
assertEqual(capabilities.intakeContract, "transcription.intake.v1", "intake contract");
assertEqual(capabilities.statusContract, "transcription.intake-status.v1", "status contract");
assertEqual(capabilities.statusPush, true, "status push support");
assertEqual(capabilities.statusPull, true, "status pull support");

const admitted = await postIntake(request);
if (![200, 201, 202].includes(admitted.response.status)) {
  throw new Error(`initial admission returned HTTP ${admitted.response.status}`);
}
assertEqual(admitted.body.schemaVersion, "transcription.intake-admission.v1", "admission schemaVersion");
assertEqual(admitted.body.deduplicated, false, "initial admission deduplication flag");

const duplicate = await postIntake(request);
if (![200, 201, 202].includes(duplicate.response.status)) {
  throw new Error(`duplicate admission returned HTTP ${duplicate.response.status}`);
}
assertEqual(duplicate.body.intakeId, admitted.body.intakeId, "duplicate intakeId");
assertEqual(duplicate.body.deduplicated, true, "duplicate admission flag");

const conflict = await postIntake({ ...request, title: `${request.title} (conflict probe)` });
assertEqual(conflict.response.status, 409, "conflicting admission status");

const statusResponse = await fetch(`${baseUrl}/v1/intakes/${encodeURIComponent(admitted.body.intakeId)}`, { headers });
assertStatus(statusResponse, 200, "status reconciliation");
const status = await statusResponse.json();
assertEqual(status.schemaVersion, "transcription.intake-status.v1", "status schemaVersion");
assertEqual(status.intakeId, admitted.body.intakeId, "status intakeId");
assertEqual(JSON.stringify(status.source), JSON.stringify(request.source), "status source identity");

console.log(`Provider ${capabilities.provider?.name ?? "unknown"} passed discovery, admission, duplicate, conflict, and pull checks.`);
console.log(`Intake ${admitted.body.intakeId} remains the canary for artifact, callback, terminal, and lease checks.`);

async function postIntake(body) {
  const response = await fetch(`${baseUrl}/v1/intakes`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : {} };
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assertStatus(response, expected, label) {
  assertEqual(response.status, expected, `${label} HTTP status`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
