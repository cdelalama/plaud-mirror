import assert from "node:assert/strict";
import test from "node:test";

import { SchedulerManager } from "./scheduler-manager.js";

test("SchedulerManager.applyInterval(0) leaves the manager disabled", () => {
  const manager = new SchedulerManager({ runTick: async () => undefined });
  manager.applyInterval(0);
  const status = manager.status();
  assert.equal(status.enabled, false);
  assert.equal(status.intervalMs, 0);
  manager.stop();
});

test("SchedulerManager.applyInterval(>=60000) starts the scheduler with that cadence", () => {
  const manager = new SchedulerManager({ runTick: async () => undefined });
  manager.applyInterval(60_000);
  const status = manager.status();
  assert.equal(status.enabled, true);
  assert.equal(status.intervalMs, 60_000);
  assert.ok(status.nextTickAt, "nextTickAt should be populated when enabled");
  manager.stop();
});

test("SchedulerManager.applyInterval is idempotent for the same value", () => {
  const manager = new SchedulerManager({ runTick: async () => undefined });
  manager.applyInterval(120_000);
  const firstNext = manager.status().nextTickAt;
  manager.applyInterval(120_000);
  const secondNext = manager.status().nextTickAt;
  assert.equal(secondNext, firstNext, "the scheduler must not reset its cadence on a no-op apply");
  manager.stop();
});

test("SchedulerManager.applyInterval(newValue) swaps to a fresh scheduler with the new cadence", () => {
  const manager = new SchedulerManager({ runTick: async () => undefined });
  manager.applyInterval(60_000);
  manager.applyInterval(300_000);
  const status = manager.status();
  assert.equal(status.enabled, true);
  assert.equal(status.intervalMs, 300_000);
  manager.stop();
});

test("SchedulerManager.applyInterval(0) on a running scheduler stops it", () => {
  const manager = new SchedulerManager({ runTick: async () => undefined });
  manager.applyInterval(60_000);
  assert.equal(manager.status().enabled, true);
  manager.applyInterval(0);
  const status = manager.status();
  assert.equal(status.enabled, false);
  assert.equal(status.intervalMs, 0);
  assert.equal(status.nextTickAt, null);
  manager.stop();
});

test("SchedulerManager.applyInterval rejects sub-floor positive values", () => {
  const manager = new SchedulerManager({ runTick: async () => undefined });
  assert.throws(() => manager.applyInterval(1_000), /below the 60_000ms floor/);
  manager.stop();
});

test("SchedulerManager.applyInterval rejects negative values", () => {
  const manager = new SchedulerManager({ runTick: async () => undefined });
  assert.throws(() => manager.applyInterval(-1), /non-negative integer/);
  manager.stop();
});
