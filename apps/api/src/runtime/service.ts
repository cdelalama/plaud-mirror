import { createHmac } from "node:crypto";
import { access, mkdir, stat, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  AuthStatusSchema,
  RecordingDeleteResultSchema,
  RecordingListResponseSchema,
  RecordingMirrorSchema,
  RecordingRestoreResultSchema,
  SaveAccessTokenRequestSchema,
  ServiceHealthSchema,
  SyncFiltersSchema,
  SyncRunSummarySchema,
  UpdateRuntimeConfigRequestSchema,
  WebhookPayloadSchema,
  type AuthStatus,
  type RecordingDeleteResult,
  type RecordingMirror,
  type RecordingRestoreResult,
  type RuntimeConfig,
  type SyncFilters,
  type SyncRunMode,
  type SyncRunSummary,
} from "@plaud-mirror/shared";

import { applyLocalFilters, downloadAudioArtifact } from "../phase1/spike.js";
import { PlaudAuthError, PlaudClient } from "../plaud/client.js";
import { API_PACKAGE_VERSION } from "../version.js";
import { type ServerEnvironment } from "./environment.js";
import { SecretStore, type StoredSecrets } from "./secrets.js";
import { type DeliveryAttemptRecord, RuntimeStore } from "./store.js";

export interface RuntimeServiceDependencies {
  plaudFetchImpl?: typeof fetch;
  artifactFetchImpl?: typeof fetch;
  webhookFetchImpl?: typeof fetch;
}

interface DeliveryResult {
  status: "skipped" | "success" | "failed";
  attemptedAt: string | null;
}

interface ProcessRecordingResult {
  downloaded: boolean;
  delivered: boolean;
  skipped: boolean;
}

interface RemoteRecordingShape {
  id: string;
  filename: string;
  fullname?: string | null | undefined;
  start_time: number;
  duration: number;
  serial_number: string;
  scene?: number | null | undefined;
}

export class PlaudMirrorService {
  private readonly environment: ServerEnvironment;
  private readonly store: RuntimeStore;
  private readonly secrets: SecretStore;
  private readonly plaudFetchImpl: typeof fetch;
  private readonly artifactFetchImpl: typeof fetch;
  private readonly webhookFetchImpl: typeof fetch;

  constructor(
    environment: ServerEnvironment,
    store: RuntimeStore,
    secrets: SecretStore,
    dependencies: RuntimeServiceDependencies = {},
  ) {
    this.environment = environment;
    this.store = store;
    this.secrets = secrets;
    this.plaudFetchImpl = dependencies.plaudFetchImpl ?? fetch;
    this.artifactFetchImpl = dependencies.artifactFetchImpl ?? fetch;
    this.webhookFetchImpl = dependencies.webhookFetchImpl ?? fetch;
  }

  async initialize(): Promise<void> {
    await mkdir(this.environment.dataDir, { recursive: true });
    await mkdir(this.environment.recordingsDir, { recursive: true });
    this.store.seedWebhookDefaults(this.environment.initialWebhookUrl);

    if (this.environment.initialWebhookSecret) {
      const secrets = await this.secrets.load();
      if (!secrets.webhookSecret) {
        await this.secrets.update({ webhookSecret: this.environment.initialWebhookSecret });
      }
    }

    this.store.setWebhookSecretPresence(Boolean((await this.secrets.load()).webhookSecret));
  }

  close(): void {
    this.store.close();
  }

  async getHealth(): Promise<ReturnType<typeof ServiceHealthSchema.parse>> {
    const auth = await this.getAuthStatus();
    const config = await this.getConfig();
    const warnings: string[] = [];

    if (!auth.configured) {
      warnings.push("No Plaud bearer token configured");
    } else if (auth.state !== "healthy") {
      warnings.push(`Auth state is ${auth.state}`);
    }

    if (config.webhookUrl && !config.hasWebhookSecret) {
      warnings.push("Webhook URL is configured but HMAC secret is missing");
    }

    return ServiceHealthSchema.parse({
      version: API_PACKAGE_VERSION,
      phase: "Phase 2 - first usable slice",
      auth,
      lastSync: this.store.getLastSyncRun(),
      recordingsCount: this.store.countRecordings(),
      dismissedCount: this.store.countDismissed(),
      webhookConfigured: Boolean(config.webhookUrl),
      warnings,
    });
  }

  async getConfig(): Promise<RuntimeConfig> {
    const secrets = await this.secrets.load();
    this.store.setWebhookSecretPresence(Boolean(secrets.webhookSecret));
    return this.store.getConfig(Boolean(secrets.webhookSecret));
  }

  async updateConfig(input: unknown): Promise<RuntimeConfig> {
    const parsed = UpdateRuntimeConfigRequestSchema.parse(input);

    if (parsed.webhookSecret !== undefined) {
      const secrets = await this.secrets.update({ webhookSecret: parsed.webhookSecret });
      this.store.setWebhookSecretPresence(Boolean(secrets.webhookSecret));
    }

    const configUpdate: { webhookUrl?: string | null } = {};
    if (parsed.webhookUrl !== undefined) {
      configUpdate.webhookUrl = parsed.webhookUrl;
    }
    this.store.saveConfig(configUpdate);

    return this.getConfig();
  }

  async getAuthStatus(): Promise<AuthStatus> {
    const secrets = await this.secrets.load();
    return this.store.getAuthStatus(Boolean(secrets.accessToken));
  }

  async saveAccessToken(input: unknown): Promise<AuthStatus> {
    const parsed = SaveAccessTokenRequestSchema.parse(input);
    const existingSecrets = await this.secrets.load();
    const client = this.createPlaudClient(parsed.accessToken);

    try {
      const user = await client.getCurrentUser();
      await this.secrets.update({ accessToken: parsed.accessToken });

      return this.store.saveAuthStatus(AuthStatusSchema.parse({
        mode: "manual-token",
        configured: true,
        state: "healthy",
        resolvedApiBase: client.getResolvedApiBase(),
        lastValidatedAt: new Date().toISOString(),
        lastError: null,
        userSummary: user.data ?? {},
      }));
    } catch (error) {
      if (!existingSecrets.accessToken) {
        this.store.saveAuthStatus(AuthStatusSchema.parse({
          mode: "manual-token",
          configured: false,
          state: "invalid",
          resolvedApiBase: client.getResolvedApiBase(),
          lastValidatedAt: null,
          lastError: toErrorMessage(error),
          userSummary: null,
        }));
      }

      throw error;
    }
  }

  async runSync(input: unknown = {}): Promise<SyncRunSummary> {
    const parsed = SyncFiltersSchema.parse({
      limit: this.environment.defaultSyncLimit,
      ...normalizeObject(input),
    });

    return this.runMirror("sync", {
      ...parsed,
      from: null,
      to: null,
      serialNumber: null,
      scene: null,
    });
  }

  async runBackfill(input: unknown = {}): Promise<SyncRunSummary> {
    const parsed = SyncFiltersSchema.parse({
      limit: this.environment.defaultSyncLimit,
      ...normalizeObject(input),
    });

    return this.runMirror("backfill", parsed);
  }

  async listRecordings(
    limit = 50,
    options: { includeDismissed?: boolean; skip?: number } = {},
  ): Promise<ReturnType<typeof RecordingListResponseSchema.parse>> {
    const { recordings, total } = this.store.listRecordings(limit, options);
    return RecordingListResponseSchema.parse({
      recordings,
      total,
      skip: options.skip ?? 0,
      limit,
    });
  }

  async getRecordingAudio(recordingId: string): Promise<{ path: string; contentType: string; size: number }> {
    this.assertSafeRecordingId(recordingId);

    const recording = this.store.getRecording(recordingId);
    if (!recording) {
      throw createHttpError(404, `Recording ${recordingId} is not mirrored locally`);
    }
    if (!recording.localPath) {
      throw createHttpError(404, `Recording ${recordingId} has no local audio file`);
    }

    const absolutePath = isAbsolute(recording.localPath)
      ? recording.localPath
      : resolve(process.cwd(), recording.localPath);

    const recordingsRoot = resolve(this.environment.recordingsDir);
    const relativeFromRoot = relative(recordingsRoot, absolutePath);
    if (relativeFromRoot.startsWith("..") || isAbsolute(relativeFromRoot)) {
      throw createHttpError(400, "Recording audio path is outside the configured recordings directory");
    }

    let size: number;
    try {
      const stats = await stat(absolutePath);
      size = stats.size;
    } catch {
      throw createHttpError(404, `Recording ${recordingId} audio file is missing on disk`);
    }

    return {
      path: absolutePath,
      contentType: recording.contentType ?? "application/octet-stream",
      size,
    };
  }

  async deleteRecording(recordingId: string): Promise<RecordingDeleteResult> {
    this.assertSafeRecordingId(recordingId);

    const recording = this.store.getRecording(recordingId);
    if (!recording) {
      throw createHttpError(404, `Recording ${recordingId} is not mirrored locally`);
    }

    let localFileRemoved = false;
    if (recording.localPath) {
      const absolutePath = isAbsolute(recording.localPath)
        ? recording.localPath
        : resolve(process.cwd(), recording.localPath);

      const recordingsRoot = resolve(this.environment.recordingsDir);
      const relativeFromRoot = relative(recordingsRoot, absolutePath);
      if (!relativeFromRoot.startsWith("..") && !isAbsolute(relativeFromRoot)) {
        try {
          await unlink(absolutePath);
          localFileRemoved = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
          }
          // File already absent — treat as removed for the purpose of the result.
          localFileRemoved = false;
        }
      }
    }

    const dismissedAt = new Date().toISOString();
    this.store.upsertRecording(RecordingMirrorSchema.parse({
      ...recording,
      localPath: null,
      bytesWritten: 0,
      dismissed: true,
      dismissedAt,
    }));

    return RecordingDeleteResultSchema.parse({
      id: recordingId,
      dismissed: true,
      dismissedAt,
      localFileRemoved,
    });
  }

  async restoreRecording(recordingId: string): Promise<RecordingRestoreResult> {
    this.assertSafeRecordingId(recordingId);

    const recording = this.store.getRecording(recordingId);
    if (!recording) {
      throw createHttpError(404, `Recording ${recordingId} is not tracked locally`);
    }
    if (!recording.dismissed) {
      throw createHttpError(409, `Recording ${recordingId} is not dismissed`);
    }

    // Clear the dismissed flag first. Even if the immediate re-download below
    // fails, the operator's intent ("I want this back") is respected and the
    // next scheduled sync (Phase 3) or a manual sync will retry the download.
    this.store.setRecordingDismissed(recordingId, false);

    // Attempt immediate re-download so the operator sees the audio come back
    // in the same click, not on next sync.
    const { client } = await this.loadValidatedClient();
    const detail = await client.getFileDetail(recordingId);
    const artifact = await downloadAudioArtifact(
      client,
      recordingId,
      this.environment.recordingsDir,
      detail,
      false,
      this.artifactFetchImpl,
    );

    if (artifact) {
      const current = this.store.getRecording(recordingId);
      if (current) {
        this.store.upsertRecording(RecordingMirrorSchema.parse({
          ...current,
          localPath: artifact.localPath,
          contentType: artifact.contentType,
          bytesWritten: artifact.bytesWritten,
          mirroredAt: new Date().toISOString(),
        }));
      }
    }

    return RecordingRestoreResultSchema.parse({
      id: recordingId,
      dismissed: false,
    });
  }

  private assertSafeRecordingId(recordingId: string): void {
    if (!/^[A-Za-z0-9_.-]+$/.test(recordingId)) {
      throw createHttpError(400, "Recording id contains unsupported characters");
    }
  }

  private async runMirror(mode: SyncRunMode, filters: SyncFilters): Promise<SyncRunSummary> {
    const normalizedFilters = SyncFiltersSchema.parse(filters);
    const { id, startedAt } = this.store.startSyncRun(mode, normalizedFilters);

    try {
      const { client } = await this.loadValidatedClient();
      // Mode B semantics: paginate the full Plaud listing so we can tell the
      // operator the authoritative total, then pick up to `limit` recordings
      // that are genuinely missing locally (i.e. not dismissed and not already
      // mirrored with a successful webhook delivery, unless forceDownload is
      // on). The previous behavior — fetch the first `limit` recordings from
      // Plaud and skip whatever is already local — silently did nothing if
      // the `limit` newest were all already mirrored, which was confusing.
      const { recordings: remoteRecordings, total: plaudTotal } = await client.listEverything(500);

      // Rank every recording in Plaud's full timeline (sorted newest-first by
      // start_time desc). `#1` is the oldest recording, `#N` is the newest —
      // stable across future syncs unless a recording is deleted from Plaud.
      // The bulk update runs AFTER processRecording so newly-inserted rows
      // also receive their rank.
      const ranks = new Map<string, number>();
      for (let index = 0; index < remoteRecordings.length; index += 1) {
        ranks.set(remoteRecordings[index]!.id, plaudTotal - index);
      }

      const probeFilters: Parameters<typeof applyLocalFilters>[1] = {
        limit: normalizedFilters.limit,
        recordingsDir: this.environment.recordingsDir,
        reportPath: join(this.environment.dataDir, "noop.json"),
      };
      const from = toStartTimestamp(normalizedFilters.from);
      const to = toEndTimestamp(normalizedFilters.to);
      if (from !== undefined) {
        probeFilters.from = from;
      }
      if (to !== undefined) {
        probeFilters.to = to;
      }
      if (normalizedFilters.serialNumber) {
        probeFilters.serialNumber = normalizedFilters.serialNumber;
      }
      if (normalizedFilters.scene !== null && normalizedFilters.scene !== undefined) {
        probeFilters.scene = normalizedFilters.scene;
      }

      const filteredByQuery = applyLocalFilters(remoteRecordings, probeFilters);

      const candidates: typeof filteredByQuery = [];
      for (const recording of filteredByQuery) {
        const existing = this.store.getRecording(recording.id);
        if (existing?.dismissed) {
          continue;
        }
        if (
          !normalizedFilters.forceDownload &&
          existing?.localPath &&
          existing.lastWebhookStatus === "success"
        ) {
          continue;
        }
        candidates.push(recording);
        if (candidates.length >= normalizedFilters.limit) {
          break;
        }
      }

      let downloaded = 0;
      let delivered = 0;
      let skipped = 0;

      for (const recording of candidates) {
        const result = await this.processRecording(client, recording, mode, normalizedFilters.forceDownload);
        if (result.downloaded) {
          downloaded += 1;
        }
        if (result.delivered) {
          delivered += 1;
        }
        if (result.skipped) {
          skipped += 1;
        }
      }

      // Apply ranks last so freshly-inserted rows (from processRecording above)
      // also pick up their stable sequence number.
      this.store.updateSequenceNumbers(ranks);

      return this.store.finishSyncRun(SyncRunSummarySchema.parse({
        id,
        mode,
        status: "completed",
        startedAt,
        finishedAt: new Date().toISOString(),
        examined: remoteRecordings.length,
        matched: candidates.length,
        downloaded,
        delivered,
        skipped,
        plaudTotal,
        filters: normalizedFilters,
        error: null,
      }));
    } catch (error) {
      this.store.finishSyncRun(SyncRunSummarySchema.parse({
        id,
        mode,
        status: "failed",
        startedAt,
        finishedAt: new Date().toISOString(),
        examined: 0,
        matched: 0,
        downloaded: 0,
        delivered: 0,
        skipped: 0,
        filters: normalizedFilters,
        error: toErrorMessage(error),
      }));

      throw error;
    }
  }

  private async processRecording(
    client: PlaudClient,
    recording: RemoteRecordingShape,
    mode: SyncRunMode,
    forceDownload: boolean,
  ): Promise<ProcessRecordingResult> {
    const existing = this.store.getRecording(recording.id);

    if (existing?.dismissed) {
      return {
        downloaded: false,
        delivered: false,
        skipped: true,
      };
    }

    if (existing?.localPath && !forceDownload && await hasLocalArtifact(existing.localPath)) {
      if (existing.lastWebhookStatus === "success") {
        return {
          downloaded: false,
          delivered: false,
          skipped: true,
        };
      }

      const delivery = await this.deliverWebhook(existing, mode);
      const updated = RecordingMirrorSchema.parse({
        ...existing,
        lastWebhookStatus: delivery.status,
        lastWebhookAttemptAt: delivery.attemptedAt,
      });
      this.store.upsertRecording(updated);

      return {
        downloaded: false,
        delivered: delivery.status === "success",
        skipped: delivery.status === "skipped",
      };
    }

    const detail = await client.getFileDetail(recording.id);
    const artifact = await downloadAudioArtifact(
      client,
      recording.id,
      this.environment.recordingsDir,
      detail,
      false,
      this.artifactFetchImpl,
    );

    if (!artifact) {
      throw new Error(`Failed to mirror recording ${recording.id}`);
    }

    const mirrored = RecordingMirrorSchema.parse({
      id: recording.id,
      title: selectRecordingTitle(recording.filename, recording.fullname, detail.file_name),
      createdAt: toIsoOrNull(recording.start_time),
      durationSeconds: Number(((detail.duration || recording.duration || 0) / 1000).toFixed(2)),
      serialNumber: detail.serial_number || recording.serial_number || null,
      scene: detail.scene ?? recording.scene ?? null,
      localPath: artifact.localPath,
      contentType: artifact.contentType,
      bytesWritten: artifact.bytesWritten,
      mirroredAt: new Date().toISOString(),
      lastWebhookStatus: null,
      lastWebhookAttemptAt: null,
    });

    const delivery = await this.deliverWebhook(mirrored, mode);
    const persisted = this.store.upsertRecording({
      ...mirrored,
      lastWebhookStatus: delivery.status,
      lastWebhookAttemptAt: delivery.attemptedAt,
    });

    return {
      downloaded: true,
      delivered: persisted.lastWebhookStatus === "success",
      skipped: persisted.lastWebhookStatus === "skipped",
    };
  }

  private async deliverWebhook(recording: RecordingMirror, mode: SyncRunMode): Promise<DeliveryResult> {
    const secrets = await this.secrets.load();
    const config = this.store.getConfig(Boolean(secrets.webhookSecret));
    const attemptedAt = new Date().toISOString();

    if (!config.webhookUrl) {
      this.store.recordDeliveryAttempt({
        recordingId: recording.id,
        status: "skipped",
        webhookUrl: null,
        httpStatus: null,
        errorMessage: null,
        payloadJson: JSON.stringify({ reason: "webhook disabled" }),
        attemptedAt,
      });
      return {
        status: "skipped",
        attemptedAt,
      };
    }

    if (!secrets.webhookSecret) {
      this.store.recordDeliveryAttempt({
        recordingId: recording.id,
        status: "failed",
        webhookUrl: config.webhookUrl,
        httpStatus: null,
        errorMessage: "Webhook secret is missing",
        payloadJson: JSON.stringify({ reason: "missing webhook secret" }),
        attemptedAt,
      });
      return {
        status: "failed",
        attemptedAt,
      };
    }

    const attemptNumber = this.store.countDeliveryAttempts(recording.id) + 1;
    const payload = WebhookPayloadSchema.parse({
      event: "recording.synced",
      source: "plaud-mirror",
      recording: {
        id: recording.id,
        title: recording.title,
        createdAt: recording.createdAt,
        localPath: recording.localPath ?? "",
        format: extractFormat(recording.localPath),
        contentType: recording.contentType ?? "application/octet-stream",
        bytesWritten: recording.bytesWritten,
      },
      sync: {
        syncedAt: attemptedAt,
        deliveryAttempt: attemptNumber,
        mode,
      },
    });
    const body = JSON.stringify(payload);
    const signature = buildSignature(body, secrets.webhookSecret);

    try {
      const response = await this.webhookFetchImpl(config.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-plaud-mirror-signature-256": signature,
        },
        body,
        signal: AbortSignal.timeout(this.environment.requestTimeoutMs),
      });

      const attempt = createDeliveryAttemptRecord({
        recordingId: recording.id,
        status: response.ok ? "success" : "failed",
        webhookUrl: config.webhookUrl,
        httpStatus: response.status,
        errorMessage: response.ok ? null : `Webhook returned HTTP ${response.status}`,
        payloadJson: body,
        attemptedAt,
      });
      this.store.recordDeliveryAttempt(attempt);

      return {
        status: response.ok ? "success" : "failed",
        attemptedAt,
      };
    } catch (error) {
      this.store.recordDeliveryAttempt(createDeliveryAttemptRecord({
        recordingId: recording.id,
        status: "failed",
        webhookUrl: config.webhookUrl,
        httpStatus: null,
        errorMessage: toErrorMessage(error),
        payloadJson: body,
        attemptedAt,
      }));
      return {
        status: "failed",
        attemptedAt,
      };
    }
  }

  private async loadValidatedClient(): Promise<{ client: PlaudClient; secrets: StoredSecrets }> {
    const secrets = await this.secrets.load();
    if (!secrets.accessToken) {
      throw new PlaudAuthError("No Plaud bearer token is configured");
    }

    const client = this.createPlaudClient(secrets.accessToken);

    try {
      const user = await client.getCurrentUser();
      this.store.saveAuthStatus(AuthStatusSchema.parse({
        mode: "manual-token",
        configured: true,
        state: "healthy",
        resolvedApiBase: client.getResolvedApiBase(),
        lastValidatedAt: new Date().toISOString(),
        lastError: null,
        userSummary: user.data ?? {},
      }));
    } catch (error) {
      const current = this.store.getAuthStatus(true);
      this.store.saveAuthStatus(AuthStatusSchema.parse({
        ...current,
        configured: true,
        state: error instanceof PlaudAuthError ? "invalid" : "degraded",
        resolvedApiBase: client.getResolvedApiBase(),
        lastError: toErrorMessage(error),
      }));
      throw error;
    }

    return { client, secrets };
  }

  private createPlaudClient(accessToken: string): PlaudClient {
    const config: ConstructorParameters<typeof PlaudClient>[0] = {
      accessToken,
      fetchImpl: this.plaudFetchImpl,
    };

    if (this.environment.apiBase) {
      config.apiBase = this.environment.apiBase;
    }

    return new PlaudClient(config);
  }
}

function createDeliveryAttemptRecord(input: DeliveryAttemptRecord): DeliveryAttemptRecord {
  return input;
}

function normalizeObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  return input as Record<string, unknown>;
}

function selectRecordingTitle(
  filename: string,
  fullname: string | null | undefined,
  detailName: string | null | undefined,
): string {
  return detailName?.trim() || fullname?.trim() || filename.trim() || "Untitled recording";
}

function buildSignature(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

function extractFormat(localPath: string | null): string {
  if (!localPath) {
    return "bin";
  }

  const extension = localPath.split(".").pop();
  return extension?.toLowerCase() || "bin";
}

function toStartTimestamp(value: string | null | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T00:00:00.000Z`).getTime();
}

function toEndTimestamp(value: string | null | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T23:59:59.999Z`).getTime();
}

function toIsoOrNull(value: number | null | undefined): string | null {
  if (!value || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value).toISOString();
}

async function hasLocalArtifact(localPath: string): Promise<boolean> {
  try {
    await access(resolve(localPath));
    return true;
  } catch {
    return false;
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function createHttpError(statusCode: number, message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}
