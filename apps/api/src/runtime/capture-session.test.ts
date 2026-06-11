import assert from "node:assert/strict";
import test from "node:test";

import { CaptureSessionStore } from "./capture-session.js";

test("CaptureSessionStore: a freshly minted id consumes exactly once", () => {
  const store = new CaptureSessionStore(10_000);
  const t0 = new Date("2026-06-11T00:00:00.000Z");
  const { captureId } = store.start(t0);

  assert.equal(store.consume(captureId, t0), true, "first consume succeeds");
  assert.equal(store.consume(captureId, t0), false, "second consume fails (single-use)");
});

test("CaptureSessionStore: unknown id and expired id both fail", () => {
  const store = new CaptureSessionStore(10_000);
  const t0 = new Date("2026-06-11T00:00:00.000Z");
  assert.equal(store.consume("never-minted", t0), false);

  const { captureId } = store.start(t0);
  const tooLate = new Date(t0.getTime() + 10_001);
  assert.equal(store.consume(captureId, tooLate), false, "consume after TTL fails");
});

test("CaptureSessionStore: distinct ids are independent", () => {
  const store = new CaptureSessionStore(10_000);
  const t0 = new Date("2026-06-11T00:00:00.000Z");
  const a = store.start(t0).captureId;
  const b = store.start(t0).captureId;
  assert.notEqual(a, b);
  assert.equal(store.consume(a, t0), true);
  assert.equal(store.consume(b, t0), true);
});
