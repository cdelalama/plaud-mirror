import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const CONTRACTS = [
  ["transcription-intake.v1.schema.json", "transcription.intake.v1"],
  ["transcription-intake-admission.v1.schema.json", "transcription.intake-admission.v1"],
  ["transcription-intake-capabilities.v1.schema.json", "transcription.intake-capabilities.v1"],
  ["transcription-intake-status.v1.schema.json", "transcription.intake-status.v1"],
  ["transcription-intake-status-event.v1.schema.json", "transcription.intake-status.v1"],
];

test("published transcription contract schemas are valid JSON with frozen version constants", async () => {
  for (const [filename, schemaVersion] of CONTRACTS) {
    const schema = JSON.parse(await readFile(new URL(`../../docs/contracts/${filename}`, import.meta.url), "utf8"));
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(schema.properties.schemaVersion.const, schemaVersion);
    assert.equal(schema.additionalProperties, false);
  }

  const intake = JSON.parse(await readFile(
    new URL("../../docs/contracts/transcription-intake.v1.schema.json", import.meta.url),
    "utf8",
  ));
  assert.deepEqual(
    intake.$defs.source.required,
    ["authority", "collectionId", "itemId", "artifactRevision"],
  );
  assert.equal(intake.$defs.artifact.properties.accessProfile.const, "bearer");

  const statusEvent = JSON.parse(await readFile(
    new URL("../../docs/contracts/transcription-intake-status-event.v1.schema.json", import.meta.url),
    "utf8",
  ));
  assert.equal(statusEvent.properties.eventType.const, "intake.status");
  assert.equal(statusEvent.additionalProperties, false);
});

test("published transcription contract manifest pins every schema byte for consumers", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../../docs/contracts/manifest.v1.json", import.meta.url),
    "utf8",
  ));
  assert.equal(manifest.profile, "plaud-mirror.transcription-intake.v1");
  assert.deepEqual(Object.keys(manifest.schemas).sort(), CONTRACTS.map(([filename]) => filename).sort());
  for (const [filename] of CONTRACTS) {
    const bytes = await readFile(new URL(`../../docs/contracts/${filename}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.schemas[filename].sha256);
    assert.equal(bytes.byteLength, manifest.schemas[filename].bytes);
  }
});
