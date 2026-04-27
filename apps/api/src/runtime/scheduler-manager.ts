// Scheduler lifecycle wrapper used by the HTTP runtime so the operator can
// start, stop, and re-tune the continuous-sync scheduler from the web
// panel without restarting the container (v0.5.2). The Scheduler class
// itself is intentionally simpler — it only knows how to run a single
// fixed-cadence loop. The manager adds the "swap to a new instance when
// the interval changes" semantics on top.

import { Scheduler, type SchedulerStatus, type TickResult, type TickRunResult } from "./scheduler.js";

const DISABLED_STATUS: SchedulerStatus = {
  enabled: false,
  intervalMs: 0,
  nextTickAt: null,
  lastTickAt: null,
  lastTickStatus: null,
  lastTickError: null,
};

export interface SchedulerManagerOptions {
  /**
   * The work each tick performs. Same contract as `Scheduler.runTick`:
   * resolving with `{ skipped: true, reason }` labels the tick `skipped`
   * (e.g. when an active run absorbs it); resolving with anything else
   * is `completed`; throwing is `failed`.
   */
  runTick: () => Promise<TickRunResult | void>;
  /**
   * Optional observer invoked after each tick result is recorded. The
   * runtime wires this to `service.recordError` for failed ticks so the
   * cross-subsystem `lastErrors` ring buffer (D-014 full, v0.5.5) sees
   * scheduler-side failures alongside outbox/sync ones.
   */
  onTick?: (result: TickResult) => void;
}

export class SchedulerManager {
  private readonly runTick: () => Promise<TickRunResult | void>;
  private readonly onTick: ((result: TickResult) => void) | undefined;
  private current: Scheduler | null = null;
  private currentIntervalMs = 0;

  constructor(options: SchedulerManagerOptions) {
    this.runTick = options.runTick;
    this.onTick = options.onTick;
  }

  /**
   * Apply a new interval. Idempotent — calling with the current interval
   * is a no-op (the live `Scheduler` keeps running, no cadence reset).
   *
   *   intervalMs === 0 → disable (stop any running scheduler)
   *   intervalMs >= 60_000 → enable / reconfigure
   *   any other positive value → throw (the caller is expected to
   *     validate at the request boundary; this is a defence-in-depth
   *     guard so we never end up running below the floor)
   */
  applyInterval(intervalMs: number): void {
    if (!Number.isInteger(intervalMs) || intervalMs < 0) {
      throw new Error(`SchedulerManager.applyInterval: expected non-negative integer, received ${intervalMs}`);
    }
    if (intervalMs > 0 && intervalMs < 60_000) {
      throw new Error(
        `SchedulerManager.applyInterval: ${intervalMs}ms is below the 60_000ms floor; pick at least 1 minute or 0 to disable.`,
      );
    }

    if (intervalMs === this.currentIntervalMs) {
      return;
    }

    if (this.current) {
      this.current.stop();
      this.current = null;
    }

    if (intervalMs === 0) {
      this.currentIntervalMs = 0;
      return;
    }

    this.current = new Scheduler({
      intervalMs,
      runTick: this.runTick,
      ...(this.onTick ? { onTick: this.onTick } : {}),
    });
    this.current.start();
    this.currentIntervalMs = intervalMs;
  }

  status(): SchedulerStatus {
    return this.current ? this.current.status() : { ...DISABLED_STATUS };
  }

  /**
   * Stops the active scheduler (if any). Used on Fastify shutdown so the
   * container can exit cleanly without leaving a half-fired tick.
   */
  stop(): void {
    if (this.current) {
      this.current.stop();
      this.current = null;
    }
    this.currentIntervalMs = 0;
  }
}
