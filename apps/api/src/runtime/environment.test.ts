import assert from "node:assert/strict";
import test from "node:test";

import { loadServerEnvironment } from "./environment.js";

// Regression test for the v0.5.0 default-on scheduler bug. The 0.4.x →
// 0.5.x minor bump must NOT silently change runtime behavior for an
// operator who upgrades without setting PLAUD_MIRROR_SCHEDULER_INTERVAL_MS.
// v0.5.0 shipped with a 15-minute fallback that violated this; v0.5.1
// reverts the fallback to 0 (disabled).
test("loadServerEnvironment leaves the scheduler disabled when PLAUD_MIRROR_SCHEDULER_INTERVAL_MS is unset", () => {
  const env = loadServerEnvironment({
    PLAUD_MIRROR_MASTER_KEY: "x",
  });
  assert.equal(env.schedulerIntervalMs, 0);
});

test("loadServerEnvironment treats an empty value as 'not set' (still disabled)", () => {
  const env = loadServerEnvironment({
    PLAUD_MIRROR_MASTER_KEY: "x",
    PLAUD_MIRROR_SCHEDULER_INTERVAL_MS: "",
  });
  assert.equal(env.schedulerIntervalMs, 0);
});

test("loadServerEnvironment honours an explicit positive interval", () => {
  const env = loadServerEnvironment({
    PLAUD_MIRROR_MASTER_KEY: "x",
    PLAUD_MIRROR_SCHEDULER_INTERVAL_MS: "900000",
  });
  assert.equal(env.schedulerIntervalMs, 900_000);
});

test("loadServerEnvironment honours an explicit 0 (operator opts out)", () => {
  const env = loadServerEnvironment({
    PLAUD_MIRROR_MASTER_KEY: "x",
    PLAUD_MIRROR_SCHEDULER_INTERVAL_MS: "0",
  });
  assert.equal(env.schedulerIntervalMs, 0);
});

test("loadServerEnvironment rejects a positive value below the 60s floor", () => {
  assert.throws(
    () =>
      loadServerEnvironment({
        PLAUD_MIRROR_MASTER_KEY: "x",
        PLAUD_MIRROR_SCHEDULER_INTERVAL_MS: "1000",
      }),
    /below the 60_000ms floor/,
  );
});

test("loadServerEnvironment rejects negative or non-integer values", () => {
  assert.throws(
    () =>
      loadServerEnvironment({
        PLAUD_MIRROR_MASTER_KEY: "x",
        PLAUD_MIRROR_SCHEDULER_INTERVAL_MS: "-5",
      }),
    /non-negative integer/,
  );
  assert.throws(
    () =>
      loadServerEnvironment({
        PLAUD_MIRROR_MASTER_KEY: "x",
        PLAUD_MIRROR_SCHEDULER_INTERVAL_MS: "abc",
      }),
    /non-negative integer/,
  );
});
