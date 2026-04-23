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
  limit: z.number().int().positive().max(1000).default(100),
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
}).strict();

export const RecordingListResponseSchema = z.object({
  recordings: z.array(RecordingMirrorSchema),
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

export const SyncRunModeSchema = z.enum(["sync", "backfill"]);
export const SyncRunStatusSchema = z.enum(["completed", "failed"]);

export const SyncRunSummarySchema = z.object({
  id: z.string(),
  mode: SyncRunModeSchema,
  status: SyncRunStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string(),
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

export const ServiceHealthSchema = z.object({
  version: z.string(),
  phase: z.string(),
  auth: AuthStatusSchema,
  lastSync: SyncRunSummarySchema.nullable(),
  recordingsCount: z.number().int().nonnegative(),
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
export type SyncRunMode = z.infer<typeof SyncRunModeSchema>;
export type SyncRunStatus = z.infer<typeof SyncRunStatusSchema>;
export type SyncRunSummary = z.infer<typeof SyncRunSummarySchema>;
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
