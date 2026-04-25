import { z } from "zod";

export const RuntimeAuthStateSchema = z.enum([
  "missing",
  "healthy",
  "degraded",
  "invalid",
]);

export const AuthStatusSchema = z.object({
  mode: z.literal("manual-token"),
  configured: z.boolean(),
  state: RuntimeAuthStateSchema,
  resolvedApiBase: z.string().nullable(),
  lastValidatedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  userSummary: z.record(z.string(), z.unknown()).nullable(),
}).strict();

export const RuntimeConfigSchema = z.object({
  dataDir: z.string(),
  recordingsDir: z.string(),
  webhookUrl: z.string().nullable(),
  hasWebhookSecret: z.boolean(),
  defaultSyncLimit: z.number().int().positive(),
  // Continuous-sync scheduler interval in milliseconds (D-012). 0 = disabled
  // (manual-only behaviour). When >0, must be >= 60_000ms (1 minute) — the
  // floor is enforced at the request boundary in `updateConfig`. Persisted
  // in SQLite from v0.5.2 onwards so the operator can change it from the
  // panel without restarting the container; the
  // `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` env var seeds the initial value on
  // a fresh database, then the SQLite-backed value wins.
  schedulerIntervalMs: z.number().int().nonnegative().default(0),
}).strict();

export const UpdateRuntimeConfigRequestSchema = z.object({
  webhookUrl: z.string().trim().url().nullable().optional(),
  webhookSecret: z.string().trim().min(1).nullable().optional(),
  // Same semantics as `RuntimeConfigSchema.schedulerIntervalMs`. Optional
  // (omit to leave unchanged); explicit `0` disables the scheduler.
  schedulerIntervalMs: z.number().int().nonnegative().optional(),
}).strict();

export const SaveAccessTokenRequestSchema = z.object({
  accessToken: z.string().trim().min(1),
}).strict();

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const SyncFiltersSchema = z.object({
  from: isoDateSchema.nullable().optional(),
  to: isoDateSchema.nullable().optional(),
  serialNumber: z.string().trim().min(1).nullable().optional(),
  scene: z.number().int().nullable().optional(),
  // limit=0 is intentionally accepted: it means "do everything except download"
  // (refresh listing, update plaudTotal, recompute sequence numbers). Operators
  // also use the dedicated "Refresh server stats" UI button which posts limit=0.
  limit: z.number().int().nonnegative().max(1000).default(100),
  forceDownload: z.boolean().default(false),
}).strict();

export const RecordingMirrorSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string().nullable(),
  durationSeconds: z.number().nonnegative(),
  serialNumber: z.string().nullable(),
  scene: z.number().nullable(),
  localPath: z.string().nullable(),
  contentType: z.string().nullable(),
  bytesWritten: z.number().int().nonnegative(),
  mirroredAt: z.string().nullable(),
  lastWebhookStatus: z.enum(["skipped", "success", "failed"]).nullable(),
  lastWebhookAttemptAt: z.string().nullable(),
  dismissed: z.boolean().default(false),
  dismissedAt: z.string().nullable().default(null),
  // Stable 1-based rank of the recording in the operator's full Plaud timeline,
  // sorted oldest-first. `#1` is the oldest recording ever made on the device,
  // `#N` is the newest. Updated at every sync; null on rows that predate v0.4.8
  // or that have never been seen in a post-0.4.8 listing.
  sequenceNumber: z.number().int().positive().nullable().default(null),
}).strict();

export const RecordingListResponseSchema = z.object({
  recordings: z.array(RecordingMirrorSchema),
  total: z.number().int().nonnegative(),
  skip: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
}).strict();

export const RecordingDeleteResultSchema = z.object({
  id: z.string(),
  dismissed: z.literal(true),
  dismissedAt: z.string(),
  localFileRemoved: z.boolean(),
}).strict();

export const RecordingRestoreResultSchema = z.object({
  id: z.string(),
  dismissed: z.literal(false),
}).strict();

// Domain representation of a Plaud hardware device, decoupled from the wire
// shape returned by `/device/list` (which uses `sn`, `version_number`, etc.).
// Plaud Mirror code, the REST API, and the web panel all see this type; only
// the Plaud client module is aware of the snake_case wire fields.
export const DeviceSchema = z.object({
  serialNumber: z.string().min(1),
  // User-set nickname from the Plaud mobile app. May be empty string if the
  // operator never renamed the device, in which case the UI falls back to the
  // serial. Never null — normalized to "" at parse time so consumers can rely
  // on string concatenation without optional chaining.
  displayName: z.string().default(""),
  // Short model code returned by Plaud (e.g. "888"). We keep it as the raw
  // string because we have no authoritative mapping to marketing names
  // ("PLAUD NOTE", "NotePin") and inventing one risks drifting from Plaud's
  // own nomenclature.
  model: z.string().default(""),
  // Firmware version as an integer (matches Plaud's `version_number`). Kept
  // so upstream drift is observable; not rendered in the UI yet.
  firmwareVersion: z.number().int().nullable().default(null),
  // When we last saw this device in a `/device/list` response. Used to surface
  // devices that have been removed from the account without losing them from
  // the UI dropdown (the operator may still want to filter historical
  // recordings that belonged to a retired device).
  lastSeenAt: z.string(),
}).strict();

export const DeviceListResponseSchema = z.object({
  devices: z.array(DeviceSchema),
}).strict();

// A single row in the backfill-preview response. `state` tells the UI how the
// recording would be treated if the operator hit "Run backfill" right now:
// - "missing": not on disk; will be downloaded.
// - "mirrored": already local; would be skipped (unless forceDownload is on).
// - "dismissed": operator dismissed it locally; would be skipped.
export const BackfillCandidateStateSchema = z.enum(["missing", "mirrored", "dismissed"]);

export const BackfillCandidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string().nullable(),
  durationSeconds: z.number().nonnegative(),
  serialNumber: z.string().nullable(),
  scene: z.number().nullable(),
  sequenceNumber: z.number().int().positive().nullable().default(null),
  state: BackfillCandidateStateSchema,
}).strict();

// Filters accepted by `GET /api/backfill/candidates`. Same shape as
// `SyncFiltersSchema` minus `limit` (which in the sync context is "how many
// to download" — preview has its own response cap instead) and minus
// `forceDownload` (previews never download anything).
export const BackfillPreviewFiltersSchema = z.object({
  from: isoDateSchema.nullable().optional(),
  to: isoDateSchema.nullable().optional(),
  serialNumber: z.string().trim().min(1).nullable().optional(),
  scene: z.number().int().nullable().optional(),
  // Response-size cap only: how many candidates to include in `recordings`.
  // `matched` always reflects the true total before truncation so the UI can
  // render "Showing first N of M".
  previewLimit: z.number().int().positive().max(500).default(200),
}).strict();

export const BackfillPreviewResponseSchema = z.object({
  // Total recordings in Plaud (from listEverything's authoritative count).
  plaudTotal: z.number().int().nonnegative(),
  // Recordings that match the filters (before response truncation).
  matched: z.number().int().nonnegative(),
  // How many of `matched` would actually be downloaded (state === "missing").
  missing: z.number().int().nonnegative(),
  // Response cap that was applied to `recordings`.
  previewLimit: z.number().int().positive(),
  // Candidate rows, newest-first, truncated to `previewLimit`.
  recordings: z.array(BackfillCandidateSchema),
}).strict();

export const SyncRunModeSchema = z.enum(["sync", "backfill"]);
export const SyncRunStatusSchema = z.enum(["running", "completed", "failed"]);

export const SyncRunSummarySchema = z.object({
  id: z.string(),
  mode: SyncRunModeSchema,
  status: SyncRunStatusSchema,
  startedAt: z.string(),
  // null while status === "running"; populated once the worker calls finishSyncRun.
  finishedAt: z.string().nullable(),
  examined: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  downloaded: z.number().int().nonnegative(),
  delivered: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  // Total recordings reported by Plaud's `data_file_total` on the first page of
  // the listing. Independent of `examined` (which is capped by the caller's
  // `limit`) and `matched` (which is after local filters). Present only on
  // runs captured at or after v0.4.6; older rows read this as null.
  plaudTotal: z.number().int().nonnegative().nullable().default(null),
  filters: SyncFiltersSchema,
  error: z.string().nullable(),
}).strict();

export const StartSyncRunResponseSchema = z.object({
  id: z.string(),
  status: z.literal("running"),
}).strict();

/**
 * Scheduler observability surface (D-014, partial — scheduler subset only).
 * v0.5.0 ships this minimum; outbox + last-errors arrive in v0.5.1 / v0.5.2.
 *
 * - `enabled === false` means the scheduler is disabled (Phase 2 manual-only
 *   mode), either because `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS=0` or because
 *   the runtime never instantiated one. UI should show "Scheduler off".
 * - `lastTickStatus` of `null` means no tick has fired yet in this process
 *   (fresh boot, first interval not elapsed).
 * - All timestamps are ISO 8601 strings; `null` means "not applicable".
 */
export const SchedulerStatusSchema = z.object({
  enabled: z.boolean(),
  intervalMs: z.number().int().nonnegative(),
  nextTickAt: z.string().nullable(),
  lastTickAt: z.string().nullable(),
  lastTickStatus: z.enum(["completed", "failed", "skipped"]).nullable(),
  lastTickError: z.string().nullable(),
}).strict();

export const ServiceHealthSchema = z.object({
  version: z.string(),
  phase: z.string(),
  auth: AuthStatusSchema,
  // Most recent COMPLETED run (status === "completed" | "failed"). Stats shown
  // in the UI ("Plaud total", "Last run", hero metric) read from this field so
  // they do not flicker to zeroes while a new run is in flight.
  lastSync: SyncRunSummarySchema.nullable(),
  // The currently-running run, if any. Set only while status === "running";
  // cleared once the background worker finalizes the row. The panel uses this
  // for its progress banner and to decide when to stop polling.
  activeRun: SyncRunSummarySchema.nullable().default(null),
  // Phase 3 scheduler observability (D-014 partial). Default is "disabled"
  // so older clients reading the response when the scheduler is off see a
  // sane shape, and pre-Phase-3 backends that have not yet started emitting
  // the field still parse via Zod's default.
  scheduler: SchedulerStatusSchema.default({
    enabled: false,
    intervalMs: 0,
    nextTickAt: null,
    lastTickAt: null,
    lastTickStatus: null,
    lastTickError: null,
  }),
  recordingsCount: z.number().int().nonnegative(),
  dismissedCount: z.number().int().nonnegative().default(0),
  webhookConfigured: z.boolean(),
  warnings: z.array(z.string()),
}).strict();

export const WebhookPayloadSchema = z.object({
  event: z.literal("recording.synced"),
  source: z.literal("plaud-mirror"),
  recording: z.object({
    id: z.string(),
    title: z.string(),
    createdAt: z.string().nullable(),
    localPath: z.string(),
    format: z.string(),
    contentType: z.string(),
    bytesWritten: z.number().int().nonnegative(),
  }).strict(),
  sync: z.object({
    syncedAt: z.string(),
    deliveryAttempt: z.number().int().positive(),
    mode: SyncRunModeSchema,
  }).strict(),
}).strict();

export type RuntimeAuthState = z.infer<typeof RuntimeAuthStateSchema>;
export type AuthStatus = z.infer<typeof AuthStatusSchema>;
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;
export type UpdateRuntimeConfigRequest = z.infer<typeof UpdateRuntimeConfigRequestSchema>;
export type SaveAccessTokenRequest = z.infer<typeof SaveAccessTokenRequestSchema>;
export type SyncFilters = z.infer<typeof SyncFiltersSchema>;
export type RecordingMirror = z.infer<typeof RecordingMirrorSchema>;
export type RecordingListResponse = z.infer<typeof RecordingListResponseSchema>;
export type RecordingDeleteResult = z.infer<typeof RecordingDeleteResultSchema>;
export type RecordingRestoreResult = z.infer<typeof RecordingRestoreResultSchema>;
export type Device = z.infer<typeof DeviceSchema>;
export type DeviceListResponse = z.infer<typeof DeviceListResponseSchema>;
export type BackfillCandidateState = z.infer<typeof BackfillCandidateStateSchema>;
export type BackfillCandidate = z.infer<typeof BackfillCandidateSchema>;
export type BackfillPreviewFilters = z.infer<typeof BackfillPreviewFiltersSchema>;
export type BackfillPreviewResponse = z.infer<typeof BackfillPreviewResponseSchema>;
export type SyncRunMode = z.infer<typeof SyncRunModeSchema>;
export type SyncRunStatus = z.infer<typeof SyncRunStatusSchema>;
export type SyncRunSummary = z.infer<typeof SyncRunSummarySchema>;
export type StartSyncRunResponse = z.infer<typeof StartSyncRunResponseSchema>;
export type SchedulerStatus = z.infer<typeof SchedulerStatusSchema>;
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
