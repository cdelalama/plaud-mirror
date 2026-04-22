import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";

import { parseArguments } from "./spike.js";

test("parseArguments defaults to the probe command", () => {
  const parsed = parseArguments([]);

  assert.equal(parsed.command, "probe");
  assert.equal(parsed.json, false);
  assert.equal(parsed.options.limit, 200);
  assert.equal(parsed.options.recordingsDir, "recordings");
});

test("parseArguments supports detail command and option parsing", () => {
  const parsed = parseArguments([
    "detail",
    "--id",
    "rec-1",
    "--json",
    "--limit",
    "50",
    "--from",
    "2026-04-01",
    "--to",
    "2026-04-22",
    "--serial-number",
    "PLAUD-1",
    "--scene",
    "7",
    "--recordings-dir",
    "tmp/recordings",
    "--report-path",
    ".state/custom-report.json",
  ]);

  assert.equal(parsed.command, "detail");
  assert.equal(parsed.recordingId, "rec-1");
  assert.equal(parsed.json, true);
  assert.equal(parsed.options.limit, 50);
  assert.equal(parsed.options.serialNumber, "PLAUD-1");
  assert.equal(parsed.options.scene, 7);
  assert.equal(parsed.options.recordingsDir, resolve("tmp/recordings"));
  assert.equal(parsed.options.reportPath, resolve(".state/custom-report.json"));
});

test("parseArguments rejects invalid numeric and unknown arguments", () => {
  assert.throws(
    () => parseArguments(["--limit", "0"]),
    /positive integer/,
  );
  assert.throws(
    () => parseArguments(["--wat"]),
    /unknown argument/,
  );
});
