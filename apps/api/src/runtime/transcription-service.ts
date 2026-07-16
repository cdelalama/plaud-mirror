import { createHash, randomBytes, randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";

import {
  CreateTranscriptionDestinationRequestSchema,
  EnqueueTranscriptionRequestSchema,
  EnqueueTranscriptionResultSchema,
  TranscriptionCapabilitiesSchema,
  TranscriptionConnectionTestSchema,
  TranscriptionDestinationCreatedSchema,
  TranscriptionDestinationSchema,
  TranscriptionIntakeRequestSchema,
  TranscriptionOverviewSchema,
  TranscriptionReplayPreviewSchema,
  TranscriptionStatusEventSchema,
  UpdateTranscriptionDestinationRequestSchema,
  type EnqueueTranscriptionResult,
  type MediaDelivery,
  type RecordingMirror,
  type TranscriptionConnectionTest,
  type TranscriptionDestination,
  type TranscriptionDestinationCreated,
  type TranscriptionIntakeRequest,
  type TranscriptionOverview,
  type TranscriptionReplayPreview,
  type TranscriptionStatusEvent,
} from "@plaud-mirror/shared";

import type { SecretStore, TranscriptionDestinationSecrets } from "./secrets.js";
import type { EligibleTranscriptionRecording, MediaArtifactRecord, RuntimeStore } from "./store.js";
import { pinRecordingArtifact, removePinnedArtifact, verifyPinnedArtifact } from "./transcription-artifacts.js";
import { verifyBearerToken, verifyTranscriptionStatusSignature } from "./transcription-auth.js";

export interface TranscriptionServiceDependencies {
  store: RuntimeStore;
  secrets: SecretStore;
  recordingsDir: string;
  requestTimeoutMs: number;
  fetchImpl?: typeof fetch;
}

export class TranscriptionService {
  private readonly store: RuntimeStore;
  private readonly secrets: SecretStore;
  private readonly recordingsDir: string;
  private readonly requestTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(dependencies: TranscriptionServiceDependencies) {
    this.store = dependencies.store;
    this.secrets = dependencies.secrets;
    this.recordingsDir = dependencies.recordingsDir;
    this.requestTimeoutMs = dependencies.requestTimeoutMs;
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  async createDestination(input: unknown): Promise<TranscriptionDestinationCreated> {
    const parsed = CreateTranscriptionDestinationRequestSchema.parse(input);
    if (parsed.enabled) {
      throw createHttpError(409, "Test the transcription destination before enabling it");
    }
    const id = randomUUID();
    const artifactAccessToken = randomBytes(32).toString("base64url");
    await this.secrets.updateTranscriptionDestination(id, {
      intakeCredential: parsed.intakeCredential,
      statusSigningSecret: parsed.statusSigningSecret,
      artifactAccessToken,
    });
    try {
      const now = new Date().toISOString();
      const destination = this.store.saveTranscriptionDestination(TranscriptionDestinationSchema.parse({
        id,
        name: parsed.name,
        kind: "transcription-intake-v1",
        baseUrl: parsed.baseUrl,
        artifactBaseUrl: parsed.artifactBaseUrl,
        enabled: false,
        primary: parsed.primary,
        hasIntakeCredential: true,
        hasStatusSigningSecret: true,
        hasArtifactAccessToken: true,
        providerName: null,
        providerVersion: null,
        lastTestedAt: null,
        lastTestError: null,
        createdAt: now,
        updatedAt: now,
      }));
      return TranscriptionDestinationCreatedSchema.parse({ destination, artifactAccessToken });
    } catch (error) {
      await this.secrets.deleteTranscriptionDestination(id).catch(() => undefined);
      throw error;
    }
  }

  async updateDestination(id: string, input: unknown): Promise<TranscriptionDestination> {
    const current = this.requireDestination(id);
    const parsed = UpdateTranscriptionDestinationRequestSchema.parse(input);
    let destinationSecrets = await this.getDestinationSecrets(id);
    if (parsed.intakeCredential !== undefined || parsed.statusSigningSecret !== undefined) {
      destinationSecrets = await this.secrets.updateTranscriptionDestination(id, {
        ...(parsed.intakeCredential !== undefined ? { intakeCredential: parsed.intakeCredential } : {}),
        ...(parsed.statusSigningSecret !== undefined ? { statusSigningSecret: parsed.statusSigningSecret } : {}),
      });
    }
    const enabling = parsed.enabled === true && !current.enabled;
    if (enabling) {
      if (!current.lastTestedAt || current.lastTestError) {
        throw createHttpError(409, "Test the transcription destination successfully before enabling it");
      }
      if (!destinationSecrets.intakeCredential || !destinationSecrets.statusSigningSecret || !destinationSecrets.artifactAccessToken) {
        throw createHttpError(409, "Transcription destination credentials are incomplete");
      }
    }
    const endpointChanged = parsed.baseUrl !== undefined && parsed.baseUrl !== current.baseUrl;
    const intakeCredentialChanged = parsed.intakeCredential !== undefined;
    const now = new Date().toISOString();
    return this.store.saveTranscriptionDestination(TranscriptionDestinationSchema.parse({
      ...current,
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.baseUrl !== undefined ? { baseUrl: parsed.baseUrl } : {}),
      ...(parsed.artifactBaseUrl !== undefined ? { artifactBaseUrl: parsed.artifactBaseUrl } : {}),
      ...(parsed.enabled !== undefined ? { enabled: parsed.enabled } : {}),
      ...(parsed.primary !== undefined ? { primary: parsed.primary } : {}),
      hasIntakeCredential: Boolean(destinationSecrets.intakeCredential),
      hasStatusSigningSecret: Boolean(destinationSecrets.statusSigningSecret),
      hasArtifactAccessToken: Boolean(destinationSecrets.artifactAccessToken),
      ...(endpointChanged || intakeCredentialChanged ? {
        providerName: null,
        providerVersion: null,
        lastTestedAt: null,
        lastTestError: null,
        enabled: false,
      } : {}),
      updatedAt: now,
    }));
  }

  async rotateArtifactAccessToken(id: string): Promise<{ destination: TranscriptionDestination; artifactAccessToken: string }> {
    const current = this.requireDestination(id);
    const artifactAccessToken = randomBytes(32).toString("base64url");
    const destinationSecrets = await this.secrets.updateTranscriptionDestination(id, { artifactAccessToken });
    const destination = this.store.saveTranscriptionDestination({
      ...current,
      hasArtifactAccessToken: Boolean(destinationSecrets.artifactAccessToken),
      updatedAt: new Date().toISOString(),
    });
    return { destination, artifactAccessToken };
  }

  getOverview(): TranscriptionOverview {
    return TranscriptionOverviewSchema.parse({
      destinations: this.store.listTranscriptionDestinations().map((destination) => ({
        destination,
        coverage: this.store.getTranscriptionCoverage(destination.id),
      })),
    });
  }

  listDeliveries(destinationId: string, limit = 100): MediaDelivery[] {
    this.requireDestination(destinationId);
    return this.store.listMediaDeliveries(destinationId, limit);
  }

  listRecordingDeliveries(destinationId: string, recordingIds: string[]): MediaDelivery[] {
    this.requireDestination(destinationId);
    return this.store.listLatestMediaDeliveriesForRecordings(destinationId, recordingIds);
  }

  getReplayPreview(destinationId: string): TranscriptionReplayPreview {
    this.requireDestination(destinationId);
    return TranscriptionReplayPreviewSchema.parse(this.store.getTranscriptionReplayPreview(destinationId));
  }

  async testDestination(destinationId: string): Promise<TranscriptionConnectionTest> {
    const destination = this.requireDestination(destinationId);
    const destinationSecrets = await this.getDestinationSecrets(destinationId);
    const testedAt = new Date().toISOString();
    try {
      if (!destinationSecrets.intakeCredential) {
        throw new Error("Intake credential is missing");
      }
      const response = await this.fetchImpl(new URL("/v1/intake-capabilities", destination.baseUrl), {
        headers: {
          authorization: `Bearer ${destinationSecrets.intakeCredential}`,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
      if (!response.ok) {
        throw new Error(`Capability probe returned HTTP ${response.status}`);
      }
      const capabilities = TranscriptionCapabilitiesSchema.parse(await response.json());
      this.store.recordTranscriptionDestinationTest(destinationId, {
        providerName: capabilities.provider.name,
        providerVersion: capabilities.provider.version,
        error: null,
        testedAt,
      });
      return TranscriptionConnectionTestSchema.parse({
        ok: true,
        providerName: capabilities.provider.name,
        providerVersion: capabilities.provider.version,
        error: null,
        testedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.recordTranscriptionDestinationTest(destinationId, {
        providerName: null,
        providerVersion: null,
        error: message,
        testedAt,
      });
      return TranscriptionConnectionTestSchema.parse({
        ok: false,
        providerName: null,
        providerVersion: null,
        error: message,
        testedAt,
      });
    }
  }

  async enqueue(destinationId: string, input: unknown): Promise<EnqueueTranscriptionResult> {
    const destination = this.requireEnabledDestination(destinationId);
    const parsed = EnqueueTranscriptionRequestSchema.parse(input);
    const recordings = this.store.listEligibleTranscriptionRecordings(parsed.limit, parsed.recordingIds);
    const result = { selected: recordings.length, enqueued: 0, skipped: 0, failed: 0, errors: [] as string[] };
    for (const recording of recordings) {
      try {
        const created = await this.enqueueRecording(destination, recording);
        if (created) {
          result.enqueued += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.failed += 1;
        result.errors.push(`${recording.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return EnqueueTranscriptionResultSchema.parse(result);
  }

  async enqueueRecordingForEnabledDestinations(
    recording: RecordingMirror,
    forceRevisionCheck = false,
  ): Promise<void> {
    if (recording.dismissed || !recording.localPath || recording.upstreamDeletion || recording.upstreamDeletedAt) {
      return;
    }
    const eligible: EligibleTranscriptionRecording = {
      id: recording.id,
      title: recording.title,
      createdAt: recording.createdAt,
      durationSeconds: recording.durationSeconds,
      localPath: recording.localPath,
      contentType: recording.contentType ?? "application/octet-stream",
      bytesWritten: recording.bytesWritten,
    };
    const errors: string[] = [];
    for (const destination of this.store.listEnabledTranscriptionDestinations()) {
      try {
        if (!forceRevisionCheck && this.store.hasMediaDeliveryForRecording(destination.id, recording.id)) {
          continue;
        }
        await this.enqueueRecording(destination, eligible);
      } catch (error) {
        errors.push(`${destination.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (errors.length > 0) {
      throw new Error(`Transcription enqueue failed for ${errors.join("; ")}`);
    }
  }

  async retryDelivery(deliveryId: string): Promise<MediaDelivery> {
    const delivery = this.store.getMediaDelivery(deliveryId);
    if (!delivery) {
      throw createHttpError(404, `Media delivery ${deliveryId} not found`);
    }
    if (!delivery.retryable) {
      throw createHttpError(409, `Media delivery ${deliveryId} is not retryable`);
    }
    const artifact = this.store.getMediaArtifact(delivery.sha256);
    if (!artifact || !await verifyPinnedArtifact(artifact)) {
      const recording = this.store.getRecording(delivery.recordingId);
      if (!recording?.localPath || recording.dismissed) {
        throw createHttpError(409, "The source audio is no longer eligible for retry");
      }
      this.store.saveMediaArtifact(await pinRecordingArtifact(recording, this.recordingsDir));
    }
    try {
      return this.store.forceMediaDeliveryRetry(deliveryId);
    } catch (error) {
      throw createHttpError(409, error instanceof Error ? error.message : String(error));
    }
  }

  async authorizeArtifact(
    destinationId: string,
    sha256: string,
    authorization: string | undefined,
  ): Promise<MediaArtifactRecord> {
    const destination = this.store.getTranscriptionDestination(destinationId);
    if (!destination) {
      throw createHttpError(404, "Transcription artifact not found");
    }
    const destinationSecrets = await this.getDestinationSecrets(destinationId);
    if (!verifyBearerToken(destinationSecrets.artifactAccessToken, authorization)) {
      throw createHttpError(401, "Valid artifact bearer token required");
    }
    if (!this.store.hasActiveMediaDelivery(destinationId, sha256)) {
      throw createHttpError(404, "Transcription artifact not found or no longer leased");
    }
    const artifact = this.store.getMediaArtifact(sha256);
    if (!artifact || !await verifyPinnedArtifact(artifact)) {
      throw createHttpError(404, "Transcription artifact is missing");
    }
    const file = await stat(artifact.path);
    if (file.size !== artifact.bytes) {
      throw createHttpError(409, "Transcription artifact size no longer matches its revision");
    }
    return artifact;
  }

  async receiveStatus(
    destinationId: string,
    input: unknown,
    headers: { timestamp?: string; signature?: string },
  ): Promise<{ accepted: true; deduplicated: boolean; delivery: MediaDelivery }> {
    const destination = this.requireDestination(destinationId);
    const event = TranscriptionStatusEventSchema.parse(input);
    const destinationSecrets = await this.getDestinationSecrets(destinationId);
    if (!destinationSecrets.statusSigningSecret || !verifyTranscriptionStatusSignature({
      payload: event,
      timestamp: headers.timestamp,
      signature: headers.signature,
      secret: destinationSecrets.statusSigningSecret,
    })) {
      throw createHttpError(401, "Invalid transcription status signature");
    }
    const delivery = this.store.getMediaDeliveryByIntake(destination.id, event.intakeId);
    if (!delivery) {
      throw createHttpError(404, `No delivery found for intake ${event.intakeId}`);
    }
    if (
      event.source.authority !== "plaud-mirror"
      || event.source.collectionId !== this.store.getOrCreateTranscriptionCollectionId()
      || event.source.itemId !== delivery.recordingId
      || event.source.artifactRevision !== delivery.artifactRevision
      || (event.recordSha256 && event.recordSha256 !== delivery.sha256)
    ) {
      throw createHttpError(409, "Status event identity conflicts with the admitted delivery");
    }
    const receivedAt = new Date().toISOString();
    let applied: ReturnType<RuntimeStore["applyTranscriptionStatusEvent"]>;
    try {
      applied = this.store.applyTranscriptionStatusEvent({
        eventId: event.eventId,
        destinationId,
        deliveryId: delivery.id,
        payload: event,
        receivedAt,
        state: event.status,
        transcriptId: event.transcriptId ?? null,
        error: event.error?.code ?? null,
        occurredAt: event.occurredAt,
      });
    } catch (error) {
      throw createHttpError(409, error instanceof Error ? error.message : String(error));
    }
    if (applied.delivery.terminalAt) {
      await this.releaseArtifactIfTerminal(applied.delivery.sha256);
    }
    return { accepted: true, deduplicated: applied.deduplicated, delivery: applied.delivery };
  }

  private async enqueueRecording(
    destination: TranscriptionDestination,
    recording: EligibleTranscriptionRecording,
  ): Promise<boolean> {
    const fullRecording = this.store.getRecording(recording.id);
    if (!fullRecording?.localPath || fullRecording.dismissed || fullRecording.upstreamDeletion || fullRecording.upstreamDeletedAt) {
      throw new Error("Recording is no longer eligible for transcription");
    }
    const artifact = this.store.saveMediaArtifact(
      await pinRecordingArtifact(fullRecording, this.recordingsDir),
    );
    try {
      const payload = this.buildIntakeRequest(destination, recording, artifact);
      const result = this.store.enqueueMediaDelivery({ destinationId: destination.id, recording, artifact, payload });
      if (!result.created) {
        await this.releaseArtifactIfTerminal(artifact.sha256);
      }
      return result.created;
    } catch (error) {
      await this.releaseArtifactIfTerminal(artifact.sha256).catch(() => undefined);
      throw error;
    }
  }

  private buildIntakeRequest(
    destination: TranscriptionDestination,
    recording: EligibleTranscriptionRecording,
    artifact: MediaArtifactRecord,
  ): TranscriptionIntakeRequest {
    const collectionId = this.store.getOrCreateTranscriptionCollectionId();
    const identity = `${destination.id}\0${collectionId}\0${recording.id}\0${artifact.sha256}`;
    const idempotencyKey = `plaud-mirror:${createHash("sha256").update(identity).digest("hex")}`;
    return TranscriptionIntakeRequestSchema.parse({
      schemaVersion: "transcription.intake.v1",
      eventId: randomUUID(),
      idempotencyKey,
      correlationId: idempotencyKey,
      source: {
        authority: "plaud-mirror",
        collectionId,
        itemId: recording.id,
        artifactRevision: `sha256:${artifact.sha256}`,
      },
      artifact: {
        url: new URL(`/api/transcription/artifacts/${destination.id}/${artifact.sha256}`, destination.artifactBaseUrl).toString(),
        accessProfile: "bearer",
        sha256: artifact.sha256,
        bytes: artifact.bytes,
        contentType: artifact.contentType,
        filename: artifact.filename,
        durationSeconds: artifact.durationSeconds,
      },
      callback: {
        url: new URL(`/api/transcription/status/${destination.id}`, destination.artifactBaseUrl).toString(),
        authentication: "hmac-sha256-v1",
      },
      title: recording.title,
      createdAt: recording.createdAt,
    });
  }

  private requireDestination(id: string): TranscriptionDestination {
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw createHttpError(400, "Transcription destination id is invalid");
    }
    const destination = this.store.getTranscriptionDestination(id);
    if (!destination) {
      throw createHttpError(404, `Transcription destination ${id} not found`);
    }
    return destination;
  }

  private requireEnabledDestination(id: string): TranscriptionDestination {
    const destination = this.requireDestination(id);
    if (!destination.enabled) {
      throw createHttpError(409, "Transcription destination is disabled");
    }
    return destination;
  }

  private async getDestinationSecrets(id: string): Promise<TranscriptionDestinationSecrets> {
    return (await this.secrets.load()).transcriptionDestinations[id] ?? {
      intakeCredential: null,
      statusSigningSecret: null,
      artifactAccessToken: null,
    };
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

function createHttpError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}
