import {
  TranscriptionIntakeAdmissionSchema,
  TranscriptionIntakeStatusSchema,
} from "@plaud-mirror/shared";

import { OUTBOX_BACKOFF_SCHEDULE_MS, OUTBOX_MAX_ATTEMPTS } from "./outbox-worker.js";
import { Scheduler, type TickRunResult } from "./scheduler.js";
import type { SecretStore } from "./secrets.js";
import type { ClaimedMediaOutboxItem, RuntimeStore } from "./store.js";
import { removePinnedArtifact } from "./transcription-artifacts.js";

export const TRANSCRIPTION_WORKER_INTERVAL_MS = 5_000;
const RECONCILIATION_INTERVAL_MS = 5 * 60_000;

export interface TranscriptionWorkerDependencies {
  store: RuntimeStore;
  secrets: SecretStore;
  recordingsDir: string;
  requestTimeoutMs: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  onError?: (info: { deliveryId: string; message: string; escalation: "retry" | "permanent" | "reconcile" }) => void;
}

export class TranscriptionWorker {
  private readonly store: RuntimeStore;
  private readonly secrets: SecretStore;
  private readonly recordingsDir: string;
  private readonly requestTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly onError: TranscriptionWorkerDependencies["onError"];
  private scheduler: Scheduler | null = null;
  private inflightTick: Promise<TickRunResult | void> | null = null;

  constructor(dependencies: TranscriptionWorkerDependencies) {
    this.store = dependencies.store;
    this.secrets = dependencies.secrets;
    this.recordingsDir = dependencies.recordingsDir;
    this.requestTimeoutMs = dependencies.requestTimeoutMs;
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
    this.now = dependencies.now ?? (() => new Date());
    this.onError = dependencies.onError;
  }

  start(): void {
    if (this.scheduler) {
      return;
    }
    this.scheduler = new Scheduler({
      intervalMs: TRANSCRIPTION_WORKER_INTERVAL_MS,
      runTick: () => this.runTrackedTick(),
    });
    this.scheduler.start();
  }

  async stop(graceMs = this.requestTimeoutMs + 5_000): Promise<boolean> {
    this.scheduler?.stop();
    this.scheduler = null;
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

  async runTick(): Promise<TickRunResult | void> {
    const claimed = this.store.claimMediaDeliveryOutbox(this.now());
    if (claimed) {
      await this.deliver(claimed);
      return;
    }

    const reconciliation = this.store.claimMediaDeliveryForReconciliation(this.now());
    if (reconciliation) {
      await this.reconcile(reconciliation.id);
      return;
    }
    return { skipped: true, reason: "transcription queue empty" };
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

  private async deliver(claimed: ClaimedMediaOutboxItem): Promise<void> {
    try {
      const destination = this.store.getTranscriptionDestination(claimed.destinationId);
      if (!destination) {
        const message = "Transcription destination no longer exists";
        const delivery = this.store.markMediaDeliveryPermanentlyFailed(claimed.id, message);
        this.onError?.({ deliveryId: delivery.id, message, escalation: "permanent" });
        await this.releaseArtifactIfTerminal(delivery.sha256);
        return;
      }
      if (!destination.enabled) {
        this.scheduleRetry(claimed, "Transcription destination was disabled while the delivery was being claimed");
        return;
      }
      const secrets = (await this.secrets.load()).transcriptionDestinations[claimed.destinationId];
      if (!secrets?.intakeCredential) {
        const message = "Transcription destination intake credential is missing";
        const delivery = this.store.markMediaDeliveryPermanentlyFailed(claimed.id, message);
        this.onError?.({ deliveryId: delivery.id, message, escalation: "permanent" });
        await this.releaseArtifactIfTerminal(delivery.sha256);
        return;
      }
      const response = await this.fetchImpl(new URL("/v1/intakes", destination.baseUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${secrets.intakeCredential}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(claimed.payload),
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });

      if (response.status === 409) {
        const message = "Transcription destination returned HTTP 409 idempotency conflict";
        const delivery = this.store.markMediaDeliveryPermanentlyFailed(claimed.id, message, true);
        this.onError?.({ deliveryId: delivery.id, message, escalation: "permanent" });
        await this.releaseArtifactIfTerminal(delivery.sha256);
        return;
      }
      if (!response.ok) {
        const message = `Transcription destination returned HTTP ${response.status}`;
        if (isPermanentHttpFailure(response.status) || claimed.attempts + 1 >= OUTBOX_MAX_ATTEMPTS) {
          const delivery = this.store.markMediaDeliveryPermanentlyFailed(claimed.id, message);
          this.onError?.({ deliveryId: delivery.id, message, escalation: "permanent" });
          await this.releaseArtifactIfTerminal(delivery.sha256);
          return;
        }
        this.scheduleRetry(claimed, message);
        return;
      }

      const admission = TranscriptionIntakeAdmissionSchema.parse(await response.json());
      const delivery = this.store.markMediaDeliveryAdmitted(claimed.id, {
        intakeId: admission.intakeId,
        state: admission.status,
      }, this.now());
      if (delivery.terminalAt) {
        await this.releaseArtifactIfTerminal(delivery.sha256);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (claimed.attempts + 1 >= OUTBOX_MAX_ATTEMPTS) {
        const delivery = this.store.markMediaDeliveryPermanentlyFailed(claimed.id, message);
        this.onError?.({ deliveryId: delivery.id, message, escalation: "permanent" });
        await this.releaseArtifactIfTerminal(delivery.sha256);
        return;
      }
      this.scheduleRetry(claimed, message);
    }
  }

  private scheduleRetry(claimed: ClaimedMediaOutboxItem, message: string): void {
    const backoff = OUTBOX_BACKOFF_SCHEDULE_MS[claimed.attempts] ?? OUTBOX_BACKOFF_SCHEDULE_MS.at(-1)!;
    const delivery = this.store.markMediaDeliveryRetry(
      claimed.id,
      new Date(this.now().getTime() + backoff),
      message,
    );
    this.onError?.({ deliveryId: delivery.id, message, escalation: "retry" });
  }

  private async reconcile(deliveryId: string): Promise<void> {
    const delivery = this.store.getMediaDelivery(deliveryId);
    if (!delivery?.intakeId) {
      return;
    }
    try {
      const destination = this.store.getTranscriptionDestination(delivery.destinationId);
      const secrets = (await this.secrets.load()).transcriptionDestinations[delivery.destinationId];
      if (!destination?.enabled || !secrets?.intakeCredential) {
        this.store.rescheduleMediaReconciliation(
          deliveryId,
          new Date(this.now().getTime() + RECONCILIATION_INTERVAL_MS),
          "Destination disabled or intake credential missing",
        );
        return;
      }
      const response = await this.fetchImpl(
        new URL(`/v1/intakes/${encodeURIComponent(delivery.intakeId)}`, destination.baseUrl),
        {
          headers: { authorization: `Bearer ${secrets.intakeCredential}`, accept: "application/json" },
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        },
      );
      if (!response.ok) {
        throw new Error(`Status reconciliation returned HTTP ${response.status}`);
      }
      const status = TranscriptionIntakeStatusSchema.parse(await response.json());
      if (
        status.intakeId !== delivery.intakeId
        || status.source.authority !== "plaud-mirror"
        || status.source.collectionId !== this.store.getOrCreateTranscriptionCollectionId()
        || status.source.itemId !== delivery.recordingId
        || status.source.artifactRevision !== delivery.artifactRevision
        || (status.recordSha256 && status.recordSha256 !== delivery.sha256)
      ) {
        throw new Error("Status reconciliation identity does not match the admitted delivery");
      }
      const updated = this.store.updateMediaDeliveryStatus({
        deliveryId,
        state: status.status,
        transcriptId: status.transcriptId ?? null,
        error: status.error?.code ?? null,
        occurredAt: status.occurredAt,
      });
      if (updated.terminalAt) {
        await this.releaseArtifactIfTerminal(updated.sha256);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.rescheduleMediaReconciliation(
        deliveryId,
        new Date(this.now().getTime() + RECONCILIATION_INTERVAL_MS),
        message,
      );
      this.onError?.({ deliveryId, message, escalation: "reconcile" });
    }
  }

  private async releaseArtifactIfTerminal(sha256: string): Promise<void> {
    if (this.store.isMediaArtifactRequired(sha256)) {
      return;
    }
    const artifact = this.store.getMediaArtifact(sha256);
    if (artifact) {
      await removePinnedArtifact(artifact.path, this.recordingsDir);
    }
  }
}

function isPermanentHttpFailure(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}
