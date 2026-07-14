import { mkdir, stat, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  AuthStatusSchema,
  BackfillPreviewFiltersSchema,
  BackfillPreviewResponseSchema,
  LAST_ERRORS_CAP,
  RecordingDeleteResultSchema,
  RecordingListResponseSchema,
  RecordingMirrorSchema,
  RecordingRestoreResultSchema,
  RecordingUpstreamDeleteResultSchema,
  SaveAccessTokenRequestSchema,
  ServiceHealthSchema,
  SyncFiltersSchema,
  SyncRunSummarySchema,
  UpdateRuntimeConfigRequestSchema,
  WebhookPayloadSchema,
  buildDownloadFilename,
  type AuthStatus,
  type BackfillCandidateState,
  type BackfillPreviewFilters,
  type BackfillPreviewResponse,
  type Device,
  type LastErrorEntry,
  type OutboxItem,
  type RecordingDeleteResult,
  type RecordingMirror,
  type RecordingRestoreResult,
  type RecordingUpstreamDeleteResult,
  type RuntimeConfig,
  type SchedulerStatus,
  type StartSyncRunResponse,
  type SyncFilters,
  type SyncRunMode,
  type SyncRunSummary,
} from "@plaud-mirror/shared";

import { applyLocalFilters, downloadAudioArtifact } from "../phase1/spike.js";
import { PlaudApiError, PlaudAuthError, PlaudClient } from "../plaud/client.js";
import { API_PACKAGE_VERSION } from "../version.js";
import { type ServerEnvironment } from "./environment.js";
import { SecretStore, type StoredSecrets } from "./secrets.js";
import { type DeliveryAttemptRecord, RuntimeStore } from "./store.js";
import { buildWebhookSignature } from "./webhook-signature.js";

export interface RuntimeServiceDependencies {
  plaudFetchImpl?: typeof fetch;
  artifactFetchImpl?: typeof fetch;
  webhookFetchImpl?: typeof fetch;
  // Schedules background work. Default: setImmediate (fire-and-forget). Tests
  // can swap in `(fn) => { inflight.push(fn().catch(...)); }` and then await
  // `Promise.all(inflight)` to wait for the async sync to finish deterministically.
  scheduler?: (work: () => Promise<unknown>) => void;
}

/**
 * Outcome of `enqueueOrSkipWebhook`. Maps directly to the
 * `lastWebhookStatus` written into the `recordings` row.
 *   - `"queued"`  → an outbox row was created; the worker will deliver.
 *   - `"skipped"` → no webhook configured; nothing to deliver.
 */
interface EnqueueDecision {
  status: "queued" | "skipped";
  attemptedAt: string;
}

interface ProcessRecordingResult {
  downloaded: boolean;
  // From v0.5.3 onwards `delivered` reflects only **synchronous**
  // deliveries that happen inside this run. The durable outbox owns
  // retry-eligible deliveries, so the in-flight path enqueues instead of
  // delivering and `delivered` is always false here. The field is kept
  // for the SyncRunSummary contract (see CHANGELOG `[0.5.3]`).
  delivered: boolean;
  // Whether the run pushed a webhook payload into the durable outbox
  // (v0.5.3+). Independent of `downloaded`: a "force re-deliver" path
  // for an already-mirrored recording will set `enqueued=true` /
  // `downloaded=false`.
  enqueued: boolean;
  // Candidate-level skip for the sync summary. Do not use this for webhook
  // "skipped" decisions; those live in RecordingMirror.lastWebhookStatus.
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

interface ActiveMirrorRun {
  id: string;
  completion: Promise<SyncRunSummary>;
  abortController: AbortController;
  workStarted: boolean;
  rejectCompletion: (error: unknown) => void;
  maxRuntimeTimer: NodeJS.Timeout | null;
}

/**
 * Provider for the operational scheduler status surfaced through
 * `/api/health.scheduler` (D-014 partial). The runtime entry point
 * registers a provider after both the service and the Scheduler are
 * constructed; the service itself does not own the Scheduler instance,
 * so health computation goes through this getter to avoid a circular
 * dependency between the two modules.
 */
export type SchedulerStatusProvider = () => SchedulerStatus;

const DISABLED_SCHEDULER_STATUS: SchedulerStatus = {
  enabled: false,
  intervalMs: 0,
  nextTickAt: null,
  lastTickAt: null,
  lastTickStatus: null,
  lastTickError: null,
};

export class PlaudMirrorService {
  private readonly environment: ServerEnvironment;
  private readonly store: RuntimeStore;
  private readonly secrets: SecretStore;
  private readonly plaudFetchImpl: typeof fetch;
  private readonly artifactFetchImpl: typeof fetch;
  private readonly webhookFetchImpl: typeof fetch;
  private readonly scheduler: (work: () => Promise<unknown>) => void;
  private activeMirrorRun: ActiveMirrorRun | null = null;
  private schedulerStatusProvider: SchedulerStatusProvider | null = null;
  private schedulerReconfigureHook: ((intervalMs: number) => void) | null = null;
  // D-014 full (v0.5.5). Cross-subsystem error ring buffer. Most-recent-first;
  // older entries fall off the back when length exceeds LAST_ERRORS_CAP. In-
  // memory by design — errors that need to survive a container restart belong
  // in durable state (`outbox.permanentlyFailed`, `lastSync.error`), not here.
  private readonly lastErrors: LastErrorEntry[] = [];

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
    this.scheduler = dependencies.scheduler ?? defaultScheduler;
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

    // Seed the SQLite-backed scheduler interval from the env var on a
    // fresh database. After this point, the SQLite value is the source
    // of truth — operator changes from the panel persist; the env var
    // is irrelevant on subsequent boots.
    this.store.seedSchedulerDefaults(this.environment.schedulerIntervalMs);

    // Startup crash recovery (D-013 amendment, v0.6.0). A process that
    // died mid-flight can leave two kinds of orphans, both of which are
    // permanent without this sweep:
    //   - sync_runs stuck in 'running' block every future sync through
    //     the getActiveSyncRun anti-overlap guard;
    //   - webhook_outbox rows stuck in 'delivering' are never reclaimed
    //     because claimOutboxItem only selects pending/retry_waiting.
    // Outbox recovery accepts at-least-once delivery: the row may have
    // been POSTed right before the crash, so the downstream can see a
    // duplicate. A recoverable duplicate beats a silently lost webhook.
    const recoveredRuns = this.store.recoverOrphanedSyncRuns();
    if (recoveredRuns > 0) {
      const message = `Recovered ${recoveredRuns} sync run(s) left 'running' by a previous process; marked failed`;
      console.warn(message);
      this.recordError("sync", message, { recovered: String(recoveredRuns) });
    }
    const recoveredOutbox = this.store.recoverOrphanedOutboxItems();
    if (recoveredOutbox > 0) {
      const message = `Recovered ${recoveredOutbox} outbox item(s) left 'delivering' by a previous process; re-queued for immediate retry`;
      console.warn(message);
      this.recordError("outbox", message, { recovered: String(recoveredOutbox) });
    }
  }

  close(): void {
    this.store.close();
  }

  async shutdown(graceMs = 35_000): Promise<boolean> {
    const active = this.activeMirrorRun;
    if (active) {
      active.abortController.abort(new Error("sync cancelled during graceful shutdown"));
      if (!active.workStarted) {
        if (active.maxRuntimeTimer) {
          clearTimeout(active.maxRuntimeTimer);
        }
        active.rejectCompletion(active.abortController.signal.reason);
        this.activeMirrorRun = null;
      }
      const settled = await Promise.race([
        active.completion.then(() => true, () => true),
        new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => resolve(false), graceMs);
          timer.unref();
        }),
      ]);
      if (!settled) {
        return false;
      }
    }
    this.close();
    return true;
  }

  /**
   * Wire the operational scheduler in after both the service and the
   * Scheduler are constructed. Called by `cli/server.ts` during runtime
   * boot. Tests that exercise getHealth without a real scheduler can
   * skip this and the response surfaces a "disabled" SchedulerStatus.
   */
  setSchedulerStatusProvider(provider: SchedulerStatusProvider | null): void {
    this.schedulerStatusProvider = provider;
  }

  /**
   * Wire a hook the service calls when `updateConfig` changes the
   * scheduler interval, so the runtime can start/stop/reconfigure the
   * Scheduler in place without a container restart (v0.5.2).
   */
  setSchedulerReconfigureHook(hook: ((intervalMs: number) => void) | null): void {
    this.schedulerReconfigureHook = hook;
  }

  /**
   * Push an error onto the cross-subsystem ring buffer (D-014 full, v0.5.5).
   * Called from the scheduler tick path (failed ticks), the outbox worker
   * (delivery escalations), and the sync run path (failed runs). The buffer
   * is bounded; the oldest entry is dropped when the cap is reached.
   * Idempotent against duplicate calls — callers may invoke freely.
   */
  recordError(
    subsystem: LastErrorEntry["subsystem"],
    message: string,
    context: Record<string, string> = {},
  ): void {
    const entry: LastErrorEntry = {
      occurredAt: new Date().toISOString(),
      subsystem,
      message,
      context,
    };
    this.lastErrors.unshift(entry);
    if (this.lastErrors.length > LAST_ERRORS_CAP) {
      this.lastErrors.length = LAST_ERRORS_CAP;
    }
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

    if (!this.environment.adminPassphrase) {
      warnings.push(
        "Operator access control is disabled — set PLAUD_MIRROR_ADMIN_PASSPHRASE to protect the panel and API",
      );
    }

    return ServiceHealthSchema.parse({
      version: API_PACKAGE_VERSION,
      phase: this.schedulerStatusProvider !== null && this.schedulerStatusProvider().enabled
        ? "Phase 3 - unattended operation"
        : "Phase 2 - first usable slice",
      auth,
      lastSync: this.store.getLastSyncRun(),
      activeRun: this.store.getActiveSyncRun(),
      scheduler: this.schedulerStatusProvider !== null
        ? this.schedulerStatusProvider()
        : DISABLED_SCHEDULER_STATUS,
      outbox: this.store.getOutboxHealth(),
      lastErrors: this.lastErrors.slice(),
      recentSyncRuns: this.store.getRecentSyncRuns(5),
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

    if (parsed.schedulerIntervalMs !== undefined) {
      // Validate at the request boundary so the panel sees a 4xx error
      // synchronously instead of the operator wondering why /api/health
      // never started reporting `enabled: true`. Floor + 0-disable rule
      // matches the env-var pipeline in environment.ts so the two paths
      // stay consistent.
      const value = parsed.schedulerIntervalMs;
      if (value !== 0 && value < 60_000) {
        throw createHttpError(
          400,
          `schedulerIntervalMs ${value} is below the 60_000ms floor; pick at least 60000 (1 minute) or 0 to disable.`,
        );
      }
    }

    if (parsed.webhookSecret !== undefined) {
      const secrets = await this.secrets.update({ webhookSecret: parsed.webhookSecret });
      this.store.setWebhookSecretPresence(Boolean(secrets.webhookSecret));
    }

    const configUpdate: { webhookUrl?: string | null; schedulerIntervalMs?: number } = {};
    if (parsed.webhookUrl !== undefined) {
      configUpdate.webhookUrl = parsed.webhookUrl;
    }
    if (parsed.schedulerIntervalMs !== undefined) {
      configUpdate.schedulerIntervalMs = parsed.schedulerIntervalMs;
    }
    this.store.saveConfig(configUpdate);

    if (parsed.schedulerIntervalMs !== undefined && this.schedulerReconfigureHook) {
      // Apply the new interval to the live Scheduler. The manager handles
      // start / stop / reconfigure idempotently — no-op when the value did
      // not actually change.
      this.schedulerReconfigureHook(parsed.schedulerIntervalMs);
    }

    return this.getConfig();
  }

  async getAuthStatus(): Promise<AuthStatus> {
    const secrets = await this.secrets.load();
    return this.store.getAuthStatus(Boolean(secrets.accessToken));
  }

  async saveAccessToken(input: unknown): Promise<AuthStatus> {
    const parsed = SaveAccessTokenRequestSchema.parse(input);
    // Normalize a possibly-messy paste: strip surrounding quotes and a leading
    // "Bearer "/"bearer " prefix. Plaud stores the token in localStorage as a
    // JSON string sometimes shaped like `"bearer eyJ..."`, and operators paste
    // it verbatim; without this, the client would send `Bearer "bearer eyJ..."`
    // and Plaud answers 403. (v0.7.3.)
    const accessToken = parsed.accessToken
      .replace(/^"|"$/g, "")
      .replace(/^bearer\s+/i, "")
      .trim();
    assertUsablePlaudAccessToken(accessToken);
    const existingSecrets = await this.secrets.load();
    const client = this.createPlaudClient(accessToken);

    try {
      const user = await client.getCurrentUser();
      await this.secrets.update({ accessToken });

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
          // Generic only — this is read by the PUBLIC /api/health.
          lastError: toErrorMessage(error),
          userSummary: null,
        }));
      }

      // This throw returns to the AUTHENTICATED caller (POST /api/auth/token,
      // /api/connect/complete are operator-session-gated), so it is safe to
      // enrich it with Plaud's rejection body — the operator sees *why* in the
      // panel while public health stays generic (v0.7.4).
      if (error instanceof PlaudApiError && error.bodySnippet) {
        throw createHttpError(
          error.status || 502,
          `${toErrorMessage(error)} — Plaud: ${error.bodySnippet.slice(0, 200)}`,
        );
      }

      throw error;
    }
  }

  async runSync(input: unknown = {}): Promise<StartSyncRunResponse> {
    const parsed = SyncFiltersSchema.parse({
      limit: this.environment.defaultSyncLimit,
      ...normalizeObject(input),
    });

    const { id } = this.startOrReuseMirror("sync", {
      ...parsed,
      from: null,
      to: null,
      serialNumber: null,
      scene: null,
    });
    return { id, status: "running" };
  }

  async runBackfill(input: unknown = {}): Promise<StartSyncRunResponse> {
    const parsed = SyncFiltersSchema.parse({
      limit: this.environment.defaultSyncLimit,
      ...normalizeObject(input),
    });

    const { id, started } = this.startOrReuseMirror("backfill", parsed);
    if (!started) {
      throw createHttpError(409, `Cannot start backfill while sync run ${id} is already active`);
    }
    return { id, status: "running" };
  }

  /**
   * Scheduler tick entry point (D-012). Returns whether the call actually
   * started a new run (`started: true`) or reused an in-flight one
   * (`started: false`). The scheduler uses the second case to label its
   * tick as `skipped` so `health.scheduler.lastTickStatus` honestly
   * reports anti-overlap absorption — public REST routes don't need this
   * distinction (they always say `running` and let the caller poll).
   */
  async runScheduledSync(): Promise<{ id: string; started: boolean }> {
    const filters = SyncFiltersSchema.parse({
      limit: this.environment.defaultSyncLimit,
      forceDownload: false,
    });
    const startedRun = this.startOrReuseMirror("sync", {
      ...filters,
      from: null,
      to: null,
      serialNumber: null,
      scene: null,
    });
    if (startedRun.started && startedRun.completion) {
      await startedRun.completion;
    }
    return { id: startedRun.id, started: startedRun.started };
  }

  getSyncRunStatus(id: string): SyncRunSummary {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      throw createHttpError(400, "Sync run id contains unsupported characters");
    }
    const row = this.store.getSyncRun(id);
    if (!row) {
      throw createHttpError(404, `Sync run ${id} not found`);
    }
    return row;
  }

  // Read-only view of the device catalog populated by the last sync. The web
  // panel uses this to render a "Filter by device" selector instead of making
  // the operator paste a raw serial number. No network call: the table is
  // refreshed as a side-effect of `executeMirror`.
  listDevices(): Device[] {
    return this.store.listDevices();
  }

  // Dry-run version of backfill: walk the full Plaud listing, apply the
  // operator's filters, and return the matching recordings annotated with
  // their current local state (missing / mirrored / dismissed) WITHOUT
  // downloading anything. The web panel uses this to let the operator see
  // exactly what a backfill would do before committing to the download.
  //
  // This reuses the same primitives as `executeMirror` (listEverything +
  // applyLocalFilters + store lookups) so the preview cannot drift from the
  // real filter behavior.
  async previewBackfillCandidates(filters: BackfillPreviewFilters): Promise<BackfillPreviewResponse> {
    const normalized = BackfillPreviewFiltersSchema.parse(filters);

    const { client } = await this.loadValidatedClient();
    const { recordings: remoteRecordings, total: plaudTotal } = await client.listEverything(500);

    const filterOptions: Parameters<typeof applyLocalFilters>[1] = {
      // `limit` is required by ProbeOptions but not used by applyLocalFilters
      // itself (it only filters, does not truncate). Pass previewLimit so
      // the type is satisfied; the real cap is applied below.
      limit: normalized.previewLimit,
      recordingsDir: this.environment.recordingsDir,
      reportPath: join(this.environment.dataDir, "preview.json"),
    };
    const from = toStartTimestamp(normalized.from);
    const to = toEndTimestamp(normalized.to);
    if (from !== undefined) {
      filterOptions.from = from;
    }
    if (to !== undefined) {
      filterOptions.to = to;
    }
    if (normalized.serialNumber) {
      filterOptions.serialNumber = normalized.serialNumber;
    }
    if (normalized.scene !== null && normalized.scene !== undefined) {
      filterOptions.scene = normalized.scene;
    }

    const filtered = applyLocalFilters(remoteRecordings, filterOptions);

    // Ranks mirror the sync path: the full Plaud listing is sorted newest-
    // first, so rank = plaudTotal - indexInFullList. We compute it once
    // against `remoteRecordings` so a filtered row keeps the stable #N the
    // operator sees elsewhere in the UI.
    const ranks = new Map<string, number>();
    for (let index = 0; index < remoteRecordings.length; index += 1) {
      ranks.set(remoteRecordings[index]!.id, plaudTotal - index);
    }

    let missing = 0;
    const annotated: BackfillPreviewResponse["recordings"] = [];
    for (const raw of filtered) {
      const existing = this.store.getRecording(raw.id);
      const state: BackfillCandidateState = existing?.dismissed
        ? "dismissed"
        : existing?.localPath && await hasLocalArtifact(existing.localPath, existing.bytesWritten)
          ? "mirrored"
          : "missing";
      if (state === "missing") {
        missing += 1;
      }
      annotated.push({
        id: raw.id,
        title: selectRecordingTitle(raw.filename, raw.fullname, undefined),
        createdAt: toIsoOrNull(Number(raw.start_time)),
        durationSeconds: Number(raw.duration ?? 0),
        serialNumber: raw.serial_number || null,
        scene: raw.scene === null || raw.scene === undefined ? null : Number(raw.scene),
        sequenceNumber: ranks.get(raw.id) ?? null,
        state,
      });
    }

    const truncated = annotated.slice(0, normalized.previewLimit);

    return BackfillPreviewResponseSchema.parse({
      plaudTotal,
      matched: filtered.length,
      missing,
      previewLimit: normalized.previewLimit,
      recordings: truncated,
    });
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

  async getRecordingAudio(recordingId: string): Promise<{ path: string; contentType: string; size: number; filename: string }> {
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
      filename: buildDownloadFilename(recording.title, recording.localPath, recording.id),
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
    if (recording.upstreamDeletedAt) {
      throw createHttpError(410, `Recording ${recordingId} was permanently deleted from Plaud`);
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

  async permanentlyDeleteRecordingFromPlaud(
    recordingId: string,
  ): Promise<RecordingUpstreamDeleteResult> {
    this.assertSafeRecordingId(recordingId);

    const recording = this.store.getRecording(recordingId);
    if (!recording) {
      throw createHttpError(404, `Recording ${recordingId} is not tracked locally`);
    }
    if (!recording.dismissed) {
      throw createHttpError(409, `Recording ${recordingId} must be dismissed locally before Plaud deletion`);
    }
    if (recording.upstreamDeletedAt) {
      return RecordingUpstreamDeleteResultSchema.parse({
        id: recordingId,
        dismissed: true,
        upstreamDeletedAt: recording.upstreamDeletedAt,
      });
    }

    try {
      const { client } = await this.loadValidatedClient();
      const detail = await client.getFileDetail(recordingId);
      if (!detail.is_trash) {
        await client.trashRecordings([recordingId]);
      }
      await client.permanentlyDeleteRecordings([recordingId]);
    } catch (error) {
      if (error instanceof PlaudAuthError) {
        throw createHttpError(502, "Plaud authentication failed; reconnect Plaud before deleting");
      }
      if (error instanceof PlaudApiError) {
        throw createHttpError(502, `Plaud deletion failed: ${error.message}`);
      }
      throw error;
    }

    const upstreamDeletedAt = new Date().toISOString();
    const updated = this.store.markRecordingUpstreamDeleted(recordingId, upstreamDeletedAt);
    if (!updated) {
      throw new Error(`Recording ${recordingId} disappeared after Plaud deletion`);
    }

    return RecordingUpstreamDeleteResultSchema.parse({
      id: recordingId,
      dismissed: true,
      upstreamDeletedAt,
    });
  }

  private assertSafeRecordingId(recordingId: string): void {
    if (!/^[A-Za-z0-9_.-]+$/.test(recordingId)) {
      throw createHttpError(400, "Recording id contains unsupported characters");
    }
  }

  /**
   * Service-layer anti-overlap (the second guardrail alongside the
   * Scheduler's own `inflight` flag). Before creating a new `sync_runs`
   * row and dispatching `executeMirror`, check whether a run is already
   * mid-flight: if so, return its id with `started: false` so the caller
   * can decide what to surface (REST: `{ id, status: "running" }` —
   * indistinguishable from a fresh start because the caller's contract
   * is "poll until done"; scheduler tick: label `skipped`).
   *
   * Without this guard a manual sync and a scheduled tick that fire
   * concurrently would both insert into `sync_runs`, both paginate Plaud,
   * and race on the recordings UPSERT path. v0.5.0 documented this guard
   * but did not implement it; this is the fix in v0.5.1.
   */
  private startOrReuseMirror(
    mode: SyncRunMode,
    filters: SyncFilters,
  ): { id: string; started: boolean; completion?: Promise<SyncRunSummary> } {
    const active = this.store.getActiveSyncRun();
    if (active) {
      return { id: active.id, started: false };
    }
    const normalizedFilters = SyncFiltersSchema.parse(filters);
    const { id } = this.store.startSyncRun(mode, normalizedFilters);
    const abortController = new AbortController();
    let resolveCompletion!: (summary: SyncRunSummary) => void;
    let rejectCompletion!: (error: unknown) => void;
    const completion = new Promise<SyncRunSummary>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });
    // Manual API callers intentionally do not await this promise. Keep a
    // rejection handler attached while the scheduler path awaits the original.
    void completion.catch(() => undefined);
    const activeRun: ActiveMirrorRun = {
      id,
      completion,
      abortController,
      workStarted: false,
      rejectCompletion,
      maxRuntimeTimer: null,
    };
    this.activeMirrorRun = activeRun;

    const maxRuntimeTimer = setTimeout(() => {
      abortController.abort(
        new Error(`sync exceeded maximum runtime of ${this.environment.syncMaxRuntimeMs}ms`),
      );
      if (!activeRun.workStarted) {
        rejectCompletion(abortController.signal.reason);
        if (this.activeMirrorRun?.id === id) {
          this.activeMirrorRun = null;
        }
      }
    }, this.environment.syncMaxRuntimeMs);
    maxRuntimeTimer.unref();
    activeRun.maxRuntimeTimer = maxRuntimeTimer;

    this.scheduler(async () => {
      try {
        activeRun.workStarted = true;
        abortController.signal.throwIfAborted();
        const summary = await this.executeMirror(id, mode, normalizedFilters, abortController.signal);
        resolveCompletion(summary);
        return summary;
      } catch (error) {
        rejectCompletion(error);
        throw error;
      } finally {
        clearTimeout(maxRuntimeTimer);
        if (this.activeMirrorRun?.id === id) {
          this.activeMirrorRun = null;
        }
      }
    });
    return { id, started: true, completion };
  }

  // Public for tests; production callers go through `runSync` / `runBackfill`
  // which schedule this via `this.scheduler`. Tests can either inject a
  // synchronous scheduler or call `executeMirror` directly after `startSyncRun`.
  async executeMirror(
    id: string,
    mode: SyncRunMode,
    filters: SyncFilters,
    signal?: AbortSignal,
  ): Promise<SyncRunSummary> {
    const normalizedFilters = SyncFiltersSchema.parse(filters);
    const existingRow = this.store.getSyncRun(id);
    if (!existingRow) {
      throw new Error(`sync_runs row ${id} not found`);
    }
    const startedAt = existingRow.startedAt;

    try {
      signal?.throwIfAborted();
      const { client } = await this.loadValidatedClient(signal);
      signal?.throwIfAborted();
      // Mode B semantics: paginate the full Plaud listing so we can tell the
      // operator the authoritative total, then pick up to `limit` recordings
      // that are genuinely missing locally (i.e. not dismissed and not already
      // mirrored with a successful webhook delivery, unless forceDownload is
      // on). The previous behavior — fetch the first `limit` recordings from
      // Plaud and skip whatever is already local — silently did nothing if
      // the `limit` newest were all already mirrored, which was confusing.
      const { recordings: remoteRecordings, total: plaudTotal } = await client.listEverything(500);
      signal?.throwIfAborted();

      // First incremental update: the operator's UI poll picks up `examined`
      // and `plaudTotal` as soon as the listing is in (before any download).
      this.store.updateSyncRunProgress(id, {
        examined: remoteRecordings.length,
        plaudTotal,
      });

      // Refresh the device catalog alongside the recordings listing. Failures
      // here must not fail the sync — the device dropdown is a convenience,
      // not a correctness property. We log and continue.
      try {
        const devices = await client.listDevices();
        if (devices.length > 0) {
          this.store.upsertDevices(devices);
        }
      } catch (error) {
        console.warn(
          `Device listing refresh failed during ${mode} ${id}:`,
          error instanceof Error ? error.message : error,
        );
      }

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
        // limit=0 means "do everything except download" (refresh path) — break
        // immediately. The check is at the top so we never push a candidate
        // we won't process.
        if (candidates.length >= normalizedFilters.limit) {
          break;
        }
        const existing = this.store.getRecording(recording.id);
        if (existing?.dismissed) {
          continue;
        }
        // "Already mirrored" means the audio is on disk. Webhook delivery
        // status is unrelated — a mirrored recording without a successful
        // webhook delivery is still mirrored and should NOT be re-downloaded.
        // Forcing a re-download is what `forceDownload` is for.
        if (
          !normalizedFilters.forceDownload
          && existing?.localPath
          && await hasLocalArtifact(existing.localPath, existing.bytesWritten)
        ) {
          continue;
        }
        candidates.push(recording);
      }

      // Publish `matched` before the loop so the UI shows "0 of 5 downloaded"
      // immediately while it works through the candidates one by one.
      this.store.updateSyncRunProgress(id, { matched: candidates.length });

      let downloaded = 0;
      let delivered = 0;
      let enqueued = 0;
      let skipped = 0;
      let failed = 0;
      const candidateErrors: string[] = [];

      for (const recording of candidates) {
        signal?.throwIfAborted();
        try {
          const result = await this.processRecording(
            client,
            recording,
            mode,
            normalizedFilters.forceDownload,
            signal,
          );
          if (result.downloaded) {
            downloaded += 1;
          }
          if (result.delivered) {
            delivered += 1;
          }
          if (result.enqueued) {
            enqueued += 1;
          }
          if (result.skipped) {
            skipped += 1;
          }
        } catch (error) {
          if (signal?.aborted) {
            throw signal.reason;
          }
          failed += 1;
          const message = toErrorMessage(error);
          candidateErrors.push(`${recording.id}: ${message}`);
          this.recordError("sync", message, {
            runId: id,
            mode,
            recordingId: recording.id,
          });
        }
        // After each candidate so the UI poll sees the counter tick up.
        this.store.updateSyncRunProgress(id, { downloaded, delivered, enqueued, skipped, failed });
      }

      // Apply ranks last so freshly-inserted rows (from processRecording above)
      // also pick up their stable sequence number.
      this.store.updateSequenceNumbers(ranks);

      const candidateErrorSummary = failed > 0
        ? summarizeCandidateErrors(candidateErrors, failed)
        : null;
      return this.store.finishSyncRun(SyncRunSummarySchema.parse({
        id,
        mode,
        status: failed > 0 ? "failed" : "completed",
        startedAt,
        finishedAt: new Date().toISOString(),
        examined: remoteRecordings.length,
        matched: candidates.length,
        downloaded,
        delivered,
        enqueued,
        skipped,
        failed,
        plaudTotal,
        filters: normalizedFilters,
        error: candidateErrorSummary,
      }));
    } catch (error) {
      // Preserve any partial progress already written to the row by
      // updateSyncRunProgress (examined/matched/downloaded/etc may already be
      // non-zero if the failure happened mid-loop). Resetting them to 0 here
      // would discard real signal from the operator's polling UI.
      const partial = this.store.getSyncRun(id);
      const errorMessage = toErrorMessage(error);
      this.store.finishSyncRun(SyncRunSummarySchema.parse({
        id,
        mode,
        status: "failed",
        startedAt,
        finishedAt: new Date().toISOString(),
        examined: partial?.examined ?? 0,
        matched: partial?.matched ?? 0,
        downloaded: partial?.downloaded ?? 0,
        delivered: partial?.delivered ?? 0,
        enqueued: partial?.enqueued ?? 0,
        skipped: partial?.skipped ?? 0,
        failed: partial?.failed ?? 0,
        plaudTotal: partial?.plaudTotal ?? null,
        filters: normalizedFilters,
        error: errorMessage,
      }));
      this.recordError("sync", errorMessage, { runId: id, mode });

      throw error;
    }
  }

  private async processRecording(
    client: PlaudClient,
    recording: RemoteRecordingShape,
    mode: SyncRunMode,
    forceDownload: boolean,
    signal?: AbortSignal,
  ): Promise<ProcessRecordingResult> {
    const existing = this.store.getRecording(recording.id);

    if (existing?.dismissed) {
      return {
        downloaded: false,
        delivered: false,
        enqueued: false,
        skipped: true,
      };
    }

    if (
      existing?.localPath
      && !forceDownload
      && await hasLocalArtifact(existing.localPath, existing.bytesWritten)
    ) {
      if (existing.lastWebhookStatus === "success") {
        return {
          downloaded: false,
          delivered: false,
          enqueued: false,
          skipped: true,
        };
      }

      // Already-mirrored row whose previous webhook delivery did not
      // succeed. Enqueue (or re-enqueue) it for the durable outbox to
      // pick up and update the recording row's `lastWebhookStatus` to
      // reflect the new "in queue" state.
      const enqueueDecision = await this.enqueueOrSkipWebhook(existing, mode);
      const updated = RecordingMirrorSchema.parse({
        ...existing,
        lastWebhookStatus: enqueueDecision.status,
        lastWebhookAttemptAt: enqueueDecision.attemptedAt,
      });
      this.store.upsertRecording(updated);

      return {
        downloaded: false,
        delivered: false,
        enqueued: enqueueDecision.status === "queued",
        skipped: false,
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
      undefined,
      signal,
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

    const enqueueDecision = await this.enqueueOrSkipWebhook(mirrored, mode);
    const persisted = this.store.upsertRecording({
      ...mirrored,
      lastWebhookStatus: enqueueDecision.status,
      lastWebhookAttemptAt: enqueueDecision.attemptedAt,
    });

    return {
      downloaded: true,
      delivered: false,
      enqueued: enqueueDecision.status === "queued",
      skipped: false,
    };
  }

  /**
   * Push the webhook payload for a freshly-mirrored (or re-mirrored)
   * recording into the durable outbox. Returns the status to write into
   * the `recordings` row's `lastWebhookStatus`:
   *   - `"queued"` when an outbox row was created and the worker will
   *     deliver it asynchronously.
   *   - `"skipped"` when no webhook is configured (URL or secret missing)
   *     so there is nothing to enqueue.
   *
   * Note: `lastWebhookStatus` of `"queued"` is a new state introduced in
   * v0.5.3. Older rows may carry the legacy `"success"` / `"failed"`
   * values from before the outbox existed; those are read-only and are
   * not produced by this code path anymore.
   */
  private async enqueueOrSkipWebhook(recording: RecordingMirror, mode: SyncRunMode): Promise<EnqueueDecision> {
    const secrets = await this.secrets.load();
    const config = this.store.getConfig(Boolean(secrets.webhookSecret));
    const attemptedAt = new Date().toISOString();

    if (!config.webhookUrl || !secrets.webhookSecret) {
      this.store.recordDeliveryAttempt({
        recordingId: recording.id,
        status: "skipped",
        webhookUrl: null,
        httpStatus: null,
        errorMessage: null,
        payloadJson: JSON.stringify({ reason: "webhook disabled" }),
        attemptedAt,
      });
      return { status: "skipped", attemptedAt };
    }

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
        // Stamped at delivery time by the outbox worker, not at enqueue
        // time. The schema requires a positive integer here, so seed 1
        // and let the worker overwrite per-attempt.
        syncedAt: attemptedAt,
        deliveryAttempt: 1,
        // sync-vs-backfill labelling at enqueue time. No way to recover
        // it post-hoc once the row sits in the outbox, so capture it now.
        mode,
      },
    });

    this.store.enqueueOutboxItem({ recordingId: recording.id, payload });
    return { status: "queued", attemptedAt };
  }

  // ─── Outbox admin (D-013, v0.5.3) ──────────────────────────────────

  /**
   * List `permanently_failed` outbox items so the panel can render them
   * with a per-row Retry button. Pending and retry-waiting items are NOT
   * included — they are visible only as counters via `health.outbox`.
   */
  listFailedOutboxItems(): OutboxItem[] {
    return this.store.listFailedOutboxItems();
  }

  /**
   * Force a `permanently_failed` row back to `pending` so the worker
   * re-attempts delivery. Validates the id shape, surfaces 404 for
   * unknown rows and 409 for any item not in `permanently_failed`.
   * (The store also rejects, but checking here lets us return a
   * specific HTTP status to the panel.)
   */
  forceOutboxRetry(id: string): OutboxItem {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      throw createHttpError(400, "Outbox id contains unsupported characters");
    }
    const item = this.store.getOutboxItem(id);
    if (!item) {
      throw createHttpError(404, `Outbox item ${id} not found`);
    }
    if (item.state !== "permanently_failed") {
      throw createHttpError(
        409,
        `Outbox item ${id} is in '${item.state}' state; only permanently_failed items can be force-retried`,
      );
    }
    return this.store.forceOutboxRetry(id);
  }

  private async loadValidatedClient(signal?: AbortSignal): Promise<{ client: PlaudClient; secrets: StoredSecrets }> {
    const secrets = await this.secrets.load();
    if (!secrets.accessToken) {
      throw new PlaudAuthError("No Plaud bearer token is configured");
    }

    const client = this.createPlaudClient(secrets.accessToken, signal);

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

  private createPlaudClient(accessToken: string, signal?: AbortSignal): PlaudClient {
    const config: ConstructorParameters<typeof PlaudClient>[0] = {
      accessToken,
      fetchImpl: this.plaudFetchImpl,
      // H3 (v0.6.0): every Plaud API call carries an abort deadline so a
      // hung connection cannot leave a sync run in 'running' forever.
      requestTimeoutMs: this.environment.requestTimeoutMs,
      ...(signal ? { signal } : {}),
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

async function hasLocalArtifact(localPath: string, expectedBytes = 0): Promise<boolean> {
  try {
    const artifact = await stat(resolve(localPath));
    if (!artifact.isFile() || artifact.size <= 0) {
      return false;
    }
    return expectedBytes <= 0 || artifact.size === expectedBytes;
  } catch {
    return false;
  }
}

function summarizeCandidateErrors(errors: string[], failed: number): string {
  const visible = errors.slice(0, 5);
  const remainder = failed - visible.length;
  return `${failed} recording(s) failed: ${visible.join("; ")}${remainder > 0 ? `; and ${remainder} more` : ""}`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function assertUsablePlaudAccessToken(accessToken: string): void {
  if (!accessToken) {
    throw createHttpError(400, "Plaud bearer token is empty after trimming quotes and the Bearer prefix");
  }

  if (/[\u2022\u25cf]/u.test(accessToken)) {
    throw createHttpError(
      400,
      "The pasted Plaud token contains mask characters (●). Copy the real token from Plaud localStorage, not a hidden or redacted field.",
    );
  }

  if (/\s/u.test(accessToken) || /[^\x21-\x7e]/u.test(accessToken)) {
    throw createHttpError(
      400,
      "The pasted Plaud token contains characters that cannot be sent in an Authorization header. Copy the raw Plaud token from localStorage and paste it unchanged.",
    );
  }
}

function createHttpError(statusCode: number, message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

// Default background scheduler: fire-and-forget via setImmediate. The work's
// own `executeMirror` already records failures in the sync_runs row through
// the catch + finishSyncRun path, so a swallowed promise rejection here just
// avoids polluting the process with an unhandled rejection.
function defaultScheduler(work: () => Promise<unknown>): void {
  setImmediate(() => {
    work().catch((error) => {
      // eslint-disable-next-line no-console -- defensive log so a regression in finishSyncRun's catch is visible.
      console.error("Background sync work failed:", error);
    });
  });
}
