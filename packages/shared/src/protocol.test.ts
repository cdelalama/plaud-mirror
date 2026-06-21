import assert from "node:assert/strict";
import test from "node:test";

import { ProtocolStatusSnapshotSchema } from "./protocol.js";

test("ProtocolStatusSnapshotSchema accepts home-infra-protocol status snapshots", () => {
  const snapshot = ProtocolStatusSnapshotSchema.parse({
    observed_at: "2026-06-21T10:15:30.000Z",
    condition: "ok",
    severity: "none",
    summary: "Plaud Mirror sync ok",
    checks: [
      {
        name: "latest-sync",
        condition: "ok",
        severity: "none",
        summary: "Latest sync completed",
      },
    ],
    job_id: "plaud-mirror-recordings-sync",
  });

  assert.equal(snapshot.condition, "ok");
  assert.equal(snapshot.job_id, "plaud-mirror-recordings-sync");
});

test("ProtocolStatusSnapshotSchema requires UTC observed_at", () => {
  assert.throws(() => ProtocolStatusSnapshotSchema.parse({
    observed_at: "2026-06-21T10:15:30.000+02:00",
    condition: "ok",
    severity: "none",
    summary: "offset timestamp is not a snapshot anchor",
  }));
});
