// Durable webhook outbox worker (D-013, v0.5.3). Walks the queue, claims
// one item per tick, recomputes the HMAC signature at delivery time so a
// rotated `webhookSecret` is honoured, and either delivers (`→ delivered`)
// or retries with exponential backoff (`→ retry_waiting` /
// `→ permanently_failed`). Independent of the sync scheduler — the two
// `Scheduler`s share SQLite but not state, so a long-running sync does
// not block delivery and a stuck downstream does not block sync.

import type { OutboxItem, WebhookPayload } from "@plaud-mirror/shared";

import { Scheduler, type SchedulerStatus, type TickRunResult } from "./scheduler.js";
import type { RuntimeStore } from "./store.js";
import type { SecretStore } from "./secrets.js";
import { buildWebhookSignature } from "./webhook-signature.js";

/**
 * Backoff schedule applied per failed attempt (1-indexed). Eight retry
 * windows lead to a ninth and final delivery attempt. The cumulative window is
 * ~16 hours, chosen to ride out an overnight downstream outage on a
 * home-infra box without paging the operator.
 *
 * After attempt 1 fails → wait 30s before next attempt.
 * After attempt 2 fails → 2 min.
 * ... up to attempt 8.
 */
export const OUTBOX_BACKOFF_SCHEDULE_MS = [
  30_000,            // after attempt 1
  2 * 60_000,        // after attempt 2
  10 * 60_000,       // after attempt 3
  30 * 60_000,       // after attempt 4
  60 * 60_000,       // after attempt 5
  2 * 60 * 60_000,   // after attempt 6
  4 * 60 * 60_000,   // after attempt 7
  8 * 60 * 60_000,   // after attempt 8 — last retry window before permanent failure
];

/** Initial delivery plus one attempt after each of the eight retry windows. */
export const OUTBOX_MAX_ATTEMPTS = OUTBOX_BACKOFF_SCHEDULE_MS.length + 1;

/** How often the worker polls the queue when no event is pending. */
export const OUTBOX_TICK_INTERVAL_MS = 5_000;

export interface OutboxWorkerDependencies {
  store: RuntimeStore;
  secrets: SecretStore;
  webhookFetchImpl?: typeof fetch;
  requestTimeoutMs: number;
  /** Override for tests; defaults to wall-clock `new Date()`. */
  now?: () => Date;
  /**
   * Optional observer fired when a delivery attempt fails. Wired to
   * `service.recordError` for the cross-subsystem ring buffer (D-014 full,
   * v0.5.5). Both `escalation: "retry"` (the row goes back to retry_waiting)
   * and `escalation: "permanent"` (the row escalates to permanently_failed)
   * are reported so operators see the trail of attempts in `lastErrors`,
   * not just the final permanent failure.
   */
  onDeliveryError?: (
    info: {
      outboxId: string;
      attempt: number;
      escalation: "retry" | "permanent";
      message: string;
    },
  ) => void;
}

export class OutboxWorker {
  private readonly store: RuntimeStore;
  private readonly secrets: SecretStore;
  private readonly webhookFetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;
  private readonly now: () => Date;
  private readonly onDeliveryError: OutboxWorkerDependencies["onDeliveryError"];
  private scheduler: Scheduler | null = null;
  private inflightTick: Promise<TickRunResult | void> | null = null;

  constructor(dependencies: OutboxWorkerDependencies) {
    this.store = dependencies.store;
    this.secrets = dependencies.secrets;
    this.webhookFetchImpl = dependencies.webhookFetchImpl ?? fetch;
    this.requestTimeoutMs = dependencies.requestTimeoutMs;
    this.now = dependencies.now ?? (() => new Date());
    this.onDeliveryError = dependencies.onDeliveryError;
  }

  /**
   * Start the polling loop. Idempotent — a second `start()` is a no-op
   * (mirrors `Scheduler.start`).
   */
  start(): void {
    if (this.scheduler !== null) {
      return;
    }
    this.scheduler = new Scheduler({
      intervalMs: OUTBOX_TICK_INTERVAL_MS,
      runTick: () => this.runTrackedTick(),
    });
    this.scheduler.start();
  }

  async stop(graceMs = this.requestTimeoutMs + 5_000): Promise<boolean> {
    if (this.scheduler !== null) {
      this.scheduler.stop();
      this.scheduler = null;
    }
    if (!this.inflightTick) {
      return true;
    }
    return Promise.race([
      this.inflightTick.then(() => true, () => true),
      new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), graceMs);
        timer.unref();
      }),
    ]);
  }

  status(): SchedulerStatus {
    return this.scheduler
      ? this.scheduler.status()
      : {
          enabled: false,
          intervalMs: OUTBOX_TICK_INTERVAL_MS,
          nextTickAt: null,
          lastTickAt: null,
          lastTickStatus: null,
          lastTickError: null,
        };
  }

  /**
   * Process a single deliverable item. Public for tests so they can drive
   * the worker without spinning up timers; production callers go through
   * `start()` which schedules ticks via the `Scheduler`.
   *
   * Returns `{ skipped: true }` when the queue is empty (so the
   * Scheduler's tick honesty path records the tick as `skipped` instead
   * of mislabelling no-op ticks as `completed`). Returns `void` after a
   * delivery / retry / permanent-fail decision so the tick is recorded
   * as `completed`. Throws only on internal corruption — every
   * downstream-induced failure is caught and recorded in the FSM.
   */
  async runTick(): Promise<TickRunResult | void> {
    const claimed = this.store.claimOutboxItem(this.now());
    if (!claimed) {
      return { skipped: true, reason: "outbox empty" };
    }

    let webhookUrl: string | null = null;
    let secrets: Awaited<ReturnType<SecretStore["load"]>>;
    let payload: WebhookPayload | null = null;
    try {
      const config = this.store.getConfig(false);
      webhookUrl = config.webhookUrl;
      secrets = await this.secrets.load();
      payload = this.store.getOutboxPayload(claimed.id);
    } catch (error) {
      this.recordFailedAttempt(
        claimed,
        webhookUrl,
        "{}",
        error instanceof Error ? error.message : String(error),
      );
      return;
    }

    if (!webhookUrl || !secrets.webhookSecret) {
      // The operator removed the webhook configuration after this item
      // was enqueued. There is nothing useful to retry — escalate
      // immediately so the row stops blocking the queue and the panel
      // surfaces it as failed (the operator can re-configure and force-
      // retry from the UI).
      this.store.markOutboxPermanentlyFailed(claimed.id, "webhook not configured");
      return;
    }

    if (!payload) {
      this.store.markOutboxPermanentlyFailed(claimed.id, "payload missing");
      return;
    }

    const result = await this.deliver(claimed, payload, webhookUrl, secrets.webhookSecret);

    if (result.ok) {
      this.store.markOutboxDelivered(claimed.id);
      this.store.recordDeliveryAttempt({
        recordingId: claimed.recordingId,
        status: "success",
        webhookUrl,
        httpStatus: result.httpStatus,
        errorMessage: null,
        payloadJson: result.body,
        attemptedAt: this.now().toISOString(),
      });
      return;
    }

    this.recordFailedAttempt(claimed, webhookUrl, result.body, result.errorMessage, result.httpStatus);
  }

  private runTrackedTick(): Promise<TickRunResult | void> {
    const tick = this.runTick();
    this.inflightTick = tick;
    void tick.finally(() => {
      if (this.inflightTick === tick) {
        this.inflightTick = null;
      }
    }).catch(() => undefined);
    return tick;
  }

  private recordFailedAttempt(
    claimed: OutboxItem,
    webhookUrl: string | null,
    body: string,
    errorMessage: string,
    httpStatus: number | null = null,
  ): void {
    const newAttemptCount = claimed.attempts + 1;
    this.store.recordDeliveryAttempt({
      recordingId: claimed.recordingId,
      status: "failed",
      webhookUrl,
      httpStatus,
      errorMessage,
      payloadJson: body,
      attemptedAt: this.now().toISOString(),
    });

    if (newAttemptCount >= OUTBOX_MAX_ATTEMPTS) {
      this.store.markOutboxPermanentlyFailed(claimed.id, errorMessage);
      this.onDeliveryError?.({
        outboxId: claimed.id,
        attempt: newAttemptCount,
        escalation: "permanent",
        message: errorMessage,
      });
      return;
    }

    const backoffMs = OUTBOX_BACKOFF_SCHEDULE_MS[newAttemptCount - 1]!;
    this.store.markOutboxRetry(
      claimed.id,
      new Date(this.now().getTime() + backoffMs),
      errorMessage,
    );
    this.onDeliveryError?.({
      outboxId: claimed.id,
      attempt: newAttemptCount,
      escalation: "retry",
      message: errorMessage,
    });
  }

  private async deliver(
    item: OutboxItem,
    payload: WebhookPayload,
    webhookUrl: string,
    webhookSecret: string,
  ): Promise<DeliveryAttemptResult> {
    // Stamp the delivery attempt number into the payload at delivery
    // time so the downstream sees a monotonically increasing
    // `sync.deliveryAttempt` across retries. Recompute body + signature
    // every attempt because (a) attempt count changed and (b) the
    // operator may have rotated the secret since the item was enqueued.
    const stampedPayload: WebhookPayload = {
      ...payload,
      sync: { ...payload.sync, deliveryAttempt: item.attempts + 1 },
    };
    const body = JSON.stringify(stampedPayload);
    const signature = buildWebhookSignature(body, webhookSecret);

    try {
      const response = await this.webhookFetchImpl(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-plaud-mirror-signature-256": signature,
        },
        body,
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
      if (response.ok) {
        return { ok: true, httpStatus: response.status, body, errorMessage: "" };
      }
      return {
        ok: false,
        httpStatus: response.status,
        body,
        errorMessage: `Webhook returned HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        ok: false,
        httpStatus: null,
        body,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

interface DeliveryAttemptResult {
  ok: boolean;
  httpStatus: number | null;
  body: string;
  errorMessage: string;
}
