// Continuous-sync scheduler (D-012). In-process, single-host, anti-overlap
// via the existing PlaudMirrorService.getActiveSyncRun() check rather than
// an external lock or a distributed mutex. The first tick fires
// `intervalMs` after `start()` is called — there is no immediate-on-start
// tick, so booting the service does not auto-trigger an unsolicited Plaud
// listing fetch (operators that boot the container in degraded-auth state
// see no spurious failures).
//
// State is intentionally NOT persisted: a process restart loses the
// "next-tick-at" estimate and the buffer of last errors. The next tick
// fires intervalMs after boot. That is acceptable for a single-operator
// always-on service whose product guarantee is "eventually consistent
// with Plaud", not "wall-clock-cadence".
//
// Anti-overlap policy: when a tick is due to fire and the previous tick's
// `runTick` Promise has not resolved yet, the new tick is logged as
// SKIPPED and the timer continues on its normal cadence. This avoids
// stacking parallel runs that would corrupt the shared `sync_runs` row
// the panel polls during a long backfill.

export interface SchedulerOptions {
  /** Tick cadence in milliseconds. Must be > 0. */
  intervalMs: number;
  /**
   * The work the scheduler performs each tick. Should be idempotent under
   * "skipped if previous tick still running" semantics — i.e. it is okay
   * for the scheduler to silently skip a tick rather than queue it.
   *
   * Return value:
   * - `void` / `undefined` / any non-object → tick is labelled `completed`.
   * - `{ skipped: true, reason?: string }` → tick is labelled `skipped`,
   *   reason (if provided) is recorded as `lastTickError` for observability
   *   (it is not actually an error, just operator-readable context like
   *   "a manual sync was already in flight").
   *
   * Throwing makes the tick `failed` regardless of return shape.
   */
  runTick: () => Promise<TickRunResult | void>;
  /**
   * Optional hook for visibility. Called after each tick attempt with the
   * outcome ("completed" | "failed" | "skipped"). Tests use this to
   * assert behavior without parsing logs.
   */
  onTick?: (result: TickResult) => void;
  /**
   * Injection point for testability. Defaults to `setTimeout` /
   * `clearTimeout` from the host environment. Tests pass deterministic
   * implementations that fire on demand.
   */
  setTimer?: (handler: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

/**
 * Optional value `runTick` may return to mark a tick as `skipped` without
 * throwing. Used when an external pre-check (e.g. service-layer
 * `getActiveSyncRun`) absorbs the work — the scheduler did fire on
 * cadence, but no new run was started.
 */
export interface TickRunResult {
  skipped: boolean;
  reason?: string;
}

export interface TickResult {
  /**
   * "completed" — the tick's runTick resolved without throwing.
   * "failed"    — runTick threw; the error message is captured.
   * "skipped"   — either (a) the tick fired while a previous tick from
   *               this scheduler was still in flight (internal anti-
   *               overlap), or (b) runTick resolved with
   *               `{ skipped: true, reason }` (external anti-overlap, e.g.
   *               a manual sync absorbed the tick).
   */
  status: "completed" | "failed" | "skipped";
  startedAt: string;
  finishedAt: string;
  error?: string;
}

export interface SchedulerStatus {
  enabled: boolean;
  intervalMs: number;
  /** Wall-clock estimate of when the next tick will fire, or null when disabled / never started. */
  nextTickAt: string | null;
  /** Wall-clock timestamp of the last tick attempt (any outcome), or null. */
  lastTickAt: string | null;
  lastTickStatus: "completed" | "failed" | "skipped" | null;
  lastTickError: string | null;
}

export class Scheduler {
  private readonly intervalMs: number;
  private readonly runTick: () => Promise<TickRunResult | void>;
  private readonly onTick: (result: TickResult) => void;
  private readonly setTimer: (handler: () => void, ms: number) => unknown;
  private readonly clearTimer: (timer: unknown) => void;

  private timer: unknown = null;
  private inflight = false;
  private nextTickAtMs: number | null = null;
  private lastTickAtMs: number | null = null;
  private lastTickStatus: TickResult["status"] | null = null;
  private lastTickError: string | null = null;

  constructor(options: SchedulerOptions) {
    if (!Number.isFinite(options.intervalMs) || options.intervalMs <= 0) {
      throw new Error(`Scheduler intervalMs must be > 0; received ${options.intervalMs}`);
    }
    this.intervalMs = options.intervalMs;
    this.runTick = options.runTick;
    this.onTick = options.onTick ?? (() => {});
    this.setTimer = options.setTimer ?? defaultSetTimer;
    this.clearTimer = options.clearTimer ?? defaultClearTimer;
  }

  start(): void {
    if (this.timer !== null) {
      // start() is idempotent: a second call is a no-op rather than
      // doubling the cadence.
      return;
    }
    this.scheduleNext();
  }

  stop(): void {
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    this.nextTickAtMs = null;
  }

  status(): SchedulerStatus {
    return {
      enabled: this.timer !== null,
      intervalMs: this.intervalMs,
      nextTickAt: toIsoOrNull(this.nextTickAtMs),
      lastTickAt: toIsoOrNull(this.lastTickAtMs),
      lastTickStatus: this.lastTickStatus,
      lastTickError: this.lastTickError,
    };
  }

  /**
   * Fires a tick immediately. Used by tests to drive the scheduler
   * without waiting for real timers. Production code never calls this —
   * the start() loop drives ticks via setTimer.
   */
  async fireOnce(): Promise<TickResult> {
    return this.executeTick();
  }

  private scheduleNext(): void {
    this.nextTickAtMs = Date.now() + this.intervalMs;
    this.timer = this.setTimer(() => {
      // Schedule the next tick BEFORE awaiting the current one. Otherwise
      // a long-running tick (e.g. backfilling 500 recordings) would delay
      // the next tick by its full duration instead of skipping it. The
      // anti-overlap check inside executeTick handles the actual skip.
      this.scheduleNext();
      void this.executeTick();
    }, this.intervalMs);
  }

  private async executeTick(): Promise<TickResult> {
    const startedAt = new Date();
    if (this.inflight) {
      const result: TickResult = {
        status: "skipped",
        startedAt: startedAt.toISOString(),
        finishedAt: startedAt.toISOString(),
      };
      this.recordTickResult(result, startedAt);
      this.onTick(result);
      return result;
    }

    this.inflight = true;
    try {
      const tickResult = await this.runTick();
      const finishedAt = new Date();
      if (isExternalSkip(tickResult)) {
        const result: TickResult = {
          status: "skipped",
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          ...(tickResult.reason ? { error: tickResult.reason } : {}),
        };
        this.recordTickResult(result, finishedAt);
        this.onTick(result);
        return result;
      }
      const result: TickResult = {
        status: "completed",
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
      };
      this.recordTickResult(result, finishedAt);
      this.onTick(result);
      return result;
    } catch (error) {
      const finishedAt = new Date();
      const message = error instanceof Error ? error.message : String(error);
      const result: TickResult = {
        status: "failed",
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        error: message,
      };
      this.recordTickResult(result, finishedAt);
      this.onTick(result);
      return result;
    } finally {
      this.inflight = false;
    }
  }

  private recordTickResult(result: TickResult, finishedAt: Date): void {
    this.lastTickAtMs = finishedAt.getTime();
    this.lastTickStatus = result.status;
    this.lastTickError = result.error ?? null;
  }
}

function defaultSetTimer(handler: () => void, ms: number): NodeJS.Timeout {
  return setTimeout(handler, ms);
}

function defaultClearTimer(timer: unknown): void {
  if (timer !== null && timer !== undefined) {
    clearTimeout(timer as NodeJS.Timeout);
  }
}

function toIsoOrNull(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  return new Date(value).toISOString();
}

function isExternalSkip(value: TickRunResult | void): value is TickRunResult {
  return typeof value === "object" && value !== null && value.skipped === true;
}
