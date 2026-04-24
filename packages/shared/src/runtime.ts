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
}).strict();

export const UpdateRuntimeConfigRequestSchema = z.object({
  webhookUrl: z.string().trim().url().nullable().optional(),
  webhookSecret: z.string().trim().min(1).nullable().optional(),
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
export type SyncRunMode = z.infer<typeof SyncRunModeSchema>;
export type SyncRunStatus = z.infer<typeof SyncRunStatusSchema>;
export type SyncRunSummary = z.infer<typeof SyncRunSummarySchema>;
export type StartSyncRunResponse = z.infer<typeof StartSyncRunResponseSchema>;
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
