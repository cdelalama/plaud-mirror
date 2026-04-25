import assert from "node:assert/strict";
import test from "node:test";

import { Scheduler, type TickResult } from "./scheduler.js";

// Test harness that simulates the timer surface deterministically. The
// scheduler's `setTimer`/`clearTimer` are injected; the test calls
// `harness.advance()` to fire pending timers as if `intervalMs` had
// elapsed, without waiting on real wall-clock time.
function createTimerHarness() {
  const pending: Array<{ id: number; handler: () => void }> = [];
  let nextId = 1;
  return {
    setTimer(handler: () => void): number {
      const id = nextId++;
      pending.push({ id, handler });
      return id;
    },
    clearTimer(timer: unknown): void {
      const idx = pending.findIndex((p) => p.id === timer);
      if (idx !== -1) {
        pending.splice(idx, 1);
      }
    },
    /**
     * Fires the oldest pending timer (mirrors how setTimeout drains in
     * order). Returns true if a timer fired, false if none was pending.
     */
    advance(): boolean {
      const next = pending.shift();
      if (!next) return false;
      next.handler();
      return true;
    },
    pendingCount(): number {
      return pending.length;
    },
  };
}

test("Scheduler.fireOnce runs the tick and reports completed", async () => {
  let calls = 0;
  const ticks: TickResult[] = [];
  const scheduler = new Scheduler({
    intervalMs: 1000,
    runTick: async () => {
      calls += 1;
    },
    onTick: (r) => ticks.push(r),
  });

  const result = await scheduler.fireOnce();
  assert.equal(result.status, "completed");
  assert.equal(calls, 1);
  assert.equal(ticks.length, 1);
  assert.equal(ticks[0]?.status, "completed");
});

test("Scheduler.fireOnce labels external skip when runTick returns { skipped: true } and surfaces the reason", async () => {
  // External anti-overlap: the runTick callback (e.g. runScheduledSync)
  // detected a manual run already in flight and refused to start a new
  // one. We must not lie in lastTickStatus by saying "completed" — the
  // tick fired, but no work happened.
  let calls = 0;
  const ticks: TickResult[] = [];
  const scheduler = new Scheduler({
    intervalMs: 1000,
    runTick: async () => {
      calls += 1;
      return { skipped: true, reason: "another sync run was already in flight" };
    },
    onTick: (r) => ticks.push(r),
  });

  const result = await scheduler.fireOnce();
  assert.equal(result.status, "skipped");
  assert.equal(result.error, "another sync run was already in flight");
  assert.equal(calls, 1);
  assert.equal(ticks.length, 1);
  assert.equal(ticks[0]?.status, "skipped");

  const status = scheduler.status();
  assert.equal(status.lastTickStatus, "skipped");
  assert.equal(status.lastTickError, "another sync run was already in flight");
});

test("Scheduler.fireOnce treats runTick returning void / non-skip object as completed", async () => {
  // Defensive: only `{ skipped: true }` should flip the label. Plain
  // resolution must stay "completed" so existing callers that return
  // unrelated work products are not silently mislabelled.
  const completedScheduler = new Scheduler({
    intervalMs: 1000,
    runTick: async () => undefined,
  });
  assert.equal((await completedScheduler.fireOnce()).status, "completed");

  const objectScheduler = new Scheduler({
    intervalMs: 1000,
    runTick: async () => ({ skipped: false }),
  });
  assert.equal((await objectScheduler.fireOnce()).status, "completed");
});

test("Scheduler.fireOnce captures runTick failures as 'failed' with error message", async () => {
  const scheduler = new Scheduler({
    intervalMs: 1000,
    runTick: async () => {
      throw new Error("plaud unreachable");
    },
  });

  const result = await scheduler.fireOnce();
  assert.equal(result.status, "failed");
  assert.equal(result.error, "plaud unreachable");

  const status = scheduler.status();
  assert.equal(status.lastTickStatus, "failed");
  assert.equal(status.lastTickError, "plaud unreachable");
});

test("Scheduler skips a tick when the previous one is still inflight (anti-overlap)", async () => {
  let release: (() => void) | null = null;
  const inflightPromise = new Promise<void>((resolve) => {
    release = resolve;
  });
  let tickStartedCount = 0;
  const ticks: TickResult[] = [];

  const scheduler = new Scheduler({
    intervalMs: 1000,
    runTick: async () => {
      tickStartedCount += 1;
      await inflightPromise;
    },
    onTick: (r) => ticks.push(r),
  });

  // First tick starts, blocks on inflightPromise.
  const firstTick = scheduler.fireOnce();
  // Yield to the microtask queue so runTick has a chance to start
  // (and set this.inflight = true) before the second fireOnce is invoked.
  await Promise.resolve();
  // Second tick fires while the first is still running.
  const secondTickResult = await scheduler.fireOnce();
  assert.equal(secondTickResult.status, "skipped", "second tick must be skipped while first is in flight");
  assert.equal(tickStartedCount, 1, "skipped tick must not invoke runTick");

  // Release the first tick and let it resolve.
  release!();
  const firstResult = await firstTick;
  assert.equal(firstResult.status, "completed");
  assert.equal(tickStartedCount, 1);

  // Now a third tick should run normally — the inflight flag is cleared.
  const thirdResult = await scheduler.fireOnce();
  assert.equal(thirdResult.status, "completed");
  assert.equal(tickStartedCount, 2);

  assert.deepEqual(
    ticks.map((t) => t.status),
    ["skipped", "completed", "completed"],
    "tick history sequence must match",
  );
});

test("Scheduler.start schedules ticks via the injected timer; stop cancels", async () => {
  const harness = createTimerHarness();
  let calls = 0;
  const scheduler = new Scheduler({
    intervalMs: 60_000,
    runTick: async () => {
      calls += 1;
    },
    setTimer: harness.setTimer,
    clearTimer: harness.clearTimer,
  });

  // Before start: no timers pending, status reports disabled.
  assert.equal(harness.pendingCount(), 0);
  assert.equal(scheduler.status().enabled, false);
  assert.equal(scheduler.status().nextTickAt, null);

  scheduler.start();
  assert.equal(harness.pendingCount(), 1, "start must schedule the first tick");
  assert.equal(scheduler.status().enabled, true);
  assert.notEqual(scheduler.status().nextTickAt, null);

  // Fire the timer: tick runs, next tick is scheduled.
  harness.advance();
  // Yield so the async runTick + scheduleNext bookkeeping resolves.
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(harness.pendingCount(), 1, "after a tick fires, the next tick must be queued");
  assert.equal(calls, 1);

  // Stop cancels the pending timer.
  scheduler.stop();
  assert.equal(harness.pendingCount(), 0);
  assert.equal(scheduler.status().enabled, false);
  assert.equal(scheduler.status().nextTickAt, null);
});

test("Scheduler.start is idempotent — a second start() does not double the cadence", () => {
  const harness = createTimerHarness();
  const scheduler = new Scheduler({
    intervalMs: 60_000,
    runTick: async () => {},
    setTimer: harness.setTimer,
    clearTimer: harness.clearTimer,
  });

  scheduler.start();
  scheduler.start();
  assert.equal(harness.pendingCount(), 1, "second start() must be a no-op, not schedule a parallel timer");
});

test("Scheduler constructor rejects non-positive intervalMs", () => {
  assert.throws(() => new Scheduler({ intervalMs: 0, runTick: async () => {} }));
  assert.throws(() => new Scheduler({ intervalMs: -1, runTick: async () => {} }));
  assert.throws(() => new Scheduler({ intervalMs: Number.NaN, runTick: async () => {} }));
});

test("Scheduler.status reflects last tick result and clears nextTickAt on stop", async () => {
  const scheduler = new Scheduler({
    intervalMs: 60_000,
    runTick: async () => {},
  });

  await scheduler.fireOnce();
  let status = scheduler.status();
  assert.equal(status.lastTickStatus, "completed");
  assert.notEqual(status.lastTickAt, null);
  // We did not call start(), so nextTickAt is still null.
  assert.equal(status.nextTickAt, null);

  // Now start, then stop, and verify nextTickAt is cleared.
  scheduler.start();
  status = scheduler.status();
  assert.equal(status.enabled, true);
  scheduler.stop();
  status = scheduler.status();
  assert.equal(status.enabled, false);
  assert.equal(status.nextTickAt, null);
  // Last tick state is preserved across stop — operators want to see what happened, not a wiped slate.
  assert.equal(status.lastTickStatus, "completed");
});
