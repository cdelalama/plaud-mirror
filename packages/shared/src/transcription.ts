import { z } from "zod";

export const TRANSCRIPTION_INTAKE_CONTRACT = "transcription.intake.v1" as const;
export const TRANSCRIPTION_STATUS_CONTRACT = "transcription.intake-status.v1" as const;
export const TRANSCRIPTION_CAPABILITIES_CONTRACT = "transcription.intake-capabilities.v1" as const;

const identifierSchema = z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9._:@/-]+$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const artifactRevisionSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const ExactOriginSchema = z.string().trim().url().superRefine((value, context) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return;
  }
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) {
    context.addIssue({
      code: "custom",
      message: "Origin must use HTTPS; HTTP is allowed only for loopback development",
    });
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    context.addIssue({
      code: "custom",
      message: "Origin must not contain a path, query, fragment, or credentials",
    });
  }
});

export const TranscriptionDestinationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  kind: z.literal("transcription-intake-v1"),
  baseUrl: ExactOriginSchema,
  artifactBaseUrl: ExactOriginSchema,
  enabled: z.boolean(),
  primary: z.boolean(),
  hasIntakeCredential: z.boolean(),
  hasStatusSigningSecret: z.boolean(),
  hasArtifactAccessToken: z.boolean(),
  providerName: z.string().trim().min(1).max(120).nullable(),
  providerVersion: z.string().trim().min(1).max(80).nullable(),
  lastTestedAt: z.string().nullable(),
  lastTestError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();

export const CreateTranscriptionDestinationRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  baseUrl: ExactOriginSchema,
  artifactBaseUrl: ExactOriginSchema,
  intakeCredential: z.string().trim().min(16).max(2048),
  statusSigningSecret: z.string().trim().min(16).max(2048),
  enabled: z.boolean().default(false),
  primary: z.boolean().default(true),
}).strict();

export const UpdateTranscriptionDestinationRequestSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  baseUrl: ExactOriginSchema.optional(),
  artifactBaseUrl: ExactOriginSchema.optional(),
  intakeCredential: z.string().trim().min(16).max(2048).nullable().optional(),
  statusSigningSecret: z.string().trim().min(16).max(2048).nullable().optional(),
  enabled: z.boolean().optional(),
  primary: z.boolean().optional(),
  confirmAdditionalCost: z.boolean().optional(),
}).strict();

export const TranscriptionDestinationCreatedSchema = z.object({
  destination: TranscriptionDestinationSchema,
  artifactAccessToken: z.string().min(32),
}).strict();

export const TranscriptionArtifactDescriptorSchema = z.object({
  url: z.string().url().refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash;
  }, "Artifact URL must not contain credentials, query parameters, or fragments"),
  accessProfile: z.literal("bearer"),
  sha256: sha256Schema,
  bytes: z.number().int().positive().max(10_737_418_240),
  contentType: z.string().regex(/^audio\/[A-Za-z0-9.+-]+$/),
  filename: z.string().min(1).max(255),
  durationSeconds: z.number().positive(),
}).strict();

export const TranscriptionSourceIdentitySchema = z.object({
  authority: identifierSchema,
  collectionId: identifierSchema,
  itemId: identifierSchema,
  artifactRevision: artifactRevisionSchema,
}).strict();

export const TranscriptionIntakeRequestSchema = z.object({
  schemaVersion: z.literal(TRANSCRIPTION_INTAKE_CONTRACT),
  eventId: z.string().uuid(),
  idempotencyKey: identifierSchema,
  correlationId: identifierSchema.optional(),
  source: TranscriptionSourceIdentitySchema,
  artifact: TranscriptionArtifactDescriptorSchema,
  callback: z.object({
    url: z.string().url().refine((value) => {
      const url = new URL(value);
      return !url.username && !url.password && !url.search && !url.hash;
    }, "Callback URL must not contain credentials, query parameters, or fragments"),
    authentication: z.literal("hmac-sha256-v1"),
  }).strict(),
  title: z.string().min(1).max(500),
  createdAt: z.string().datetime({ offset: true }).nullable(),
}).strict().superRefine((value, context) => {
  if (value.source.artifactRevision !== `sha256:${value.artifact.sha256}`) {
    context.addIssue({
      code: "custom",
      path: ["source", "artifactRevision"],
      message: "artifactRevision must equal sha256:<artifact.sha256>",
    });
  }
});

export const TranscriptionProcessingStatusSchema = z.enum([
  "accepted",
  "processing",
  "transcribed",
  "failed",
]);

export const TranscriptionIntakeAdmissionSchema = z.object({
  schemaVersion: z.literal("transcription.intake-admission.v1"),
  intakeId: identifierSchema,
  status: TranscriptionProcessingStatusSchema,
  deduplicated: z.boolean(),
}).strict();

export const TranscriptionIntakeStatusSchema = z.object({
  schemaVersion: z.literal(TRANSCRIPTION_STATUS_CONTRACT),
  intakeId: identifierSchema,
  source: TranscriptionSourceIdentitySchema,
  status: TranscriptionProcessingStatusSchema,
  occurredAt: z.string().datetime({ offset: true }),
  transcriptId: identifierSchema.nullable().optional(),
  recordSha256: sha256Schema.nullable().optional(),
  error: z.object({
    code: identifierSchema,
  }).strict().nullable().optional(),
}).strict();

export const TranscriptionStatusEventSchema = TranscriptionIntakeStatusSchema.extend({
  eventId: z.string().uuid(),
  idempotencyKey: identifierSchema,
  eventType: z.literal("intake.status"),
}).strict();

export const TranscriptionCapabilitiesSchema = z.object({
  schemaVersion: z.literal(TRANSCRIPTION_CAPABILITIES_CONTRACT),
  provider: z.object({
    name: z.string().trim().min(1).max(120),
    version: z.string().trim().min(1).max(80),
  }).strict(),
  intakeContract: z.literal(TRANSCRIPTION_INTAKE_CONTRACT),
  statusContract: z.literal(TRANSCRIPTION_STATUS_CONTRACT),
  statusPush: z.literal(true),
  statusPull: z.literal(true),
}).strict();

export const MediaDeliveryStateSchema = z.enum([
  "pending",
  "delivering",
  "accepted",
  "processing",
  "transcribed",
  "failed",
  "conflict",
]);

export const MediaDeliverySchema = z.object({
  id: z.string().uuid(),
  destinationId: z.string().uuid(),
  recordingId: z.string(),
  recordingTitle: z.string(),
  artifactRevision: artifactRevisionSchema,
  sha256: sha256Schema,
  bytes: z.number().int().positive(),
  state: MediaDeliveryStateSchema,
  intakeId: identifierSchema.nullable(),
  transcriptId: identifierSchema.nullable(),
  transcriptRecordSha256: sha256Schema.nullable(),
  lastError: z.string().nullable(),
  failureStage: z.enum(["admission", "processing"]).nullable(),
  retryable: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  terminalAt: z.string().nullable(),
}).strict();

export const TranscriptionCoverageSchema = z.object({
  eligible: z.number().int().nonnegative(),
  notSent: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  processing: z.number().int().nonnegative(),
  transcribed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  conflict: z.number().int().nonnegative(),
}).strict();

export const TranscriptionDestinationSummarySchema = z.object({
  destination: TranscriptionDestinationSchema,
  coverage: TranscriptionCoverageSchema,
}).strict();

export const TranscriptionOverviewSchema = z.object({
  destinations: z.array(TranscriptionDestinationSummarySchema),
}).strict();

export const TranscriptionConnectionTestSchema = z.object({
  ok: z.boolean(),
  providerName: z.string().nullable(),
  providerVersion: z.string().nullable(),
  error: z.string().nullable(),
  testedAt: z.string(),
}).strict();

export const EnqueueTranscriptionRequestSchema = z.object({
  limit: z.number().int().positive().max(100).default(1),
  recordingIds: z.array(z.string().min(1)).max(100).optional(),
}).strict();

export const EnqueueTranscriptionResultSchema = z.object({
  selected: z.number().int().nonnegative(),
  enqueued: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  errors: z.array(z.string()),
}).strict();

export const TranscriptionReplayPreviewSchema = z.object({
  eligible: z.number().int().nonnegative(),
  alreadyTracked: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  durationSeconds: z.number().nonnegative(),
}).strict();

export type TranscriptionDestination = z.infer<typeof TranscriptionDestinationSchema>;
export type CreateTranscriptionDestinationRequest = z.infer<typeof CreateTranscriptionDestinationRequestSchema>;
export type UpdateTranscriptionDestinationRequest = z.infer<typeof UpdateTranscriptionDestinationRequestSchema>;
export type TranscriptionDestinationCreated = z.infer<typeof TranscriptionDestinationCreatedSchema>;
export type TranscriptionSourceIdentity = z.infer<typeof TranscriptionSourceIdentitySchema>;
export type TranscriptionIntakeRequest = z.infer<typeof TranscriptionIntakeRequestSchema>;
export type TranscriptionIntakeAdmission = z.infer<typeof TranscriptionIntakeAdmissionSchema>;
export type TranscriptionIntakeStatus = z.infer<typeof TranscriptionIntakeStatusSchema>;
export type TranscriptionStatusEvent = z.infer<typeof TranscriptionStatusEventSchema>;
export type TranscriptionCapabilities = z.infer<typeof TranscriptionCapabilitiesSchema>;
export type MediaDeliveryState = z.infer<typeof MediaDeliveryStateSchema>;
export type MediaDelivery = z.infer<typeof MediaDeliverySchema>;
export type TranscriptionCoverage = z.infer<typeof TranscriptionCoverageSchema>;
export type TranscriptionDestinationSummary = z.infer<typeof TranscriptionDestinationSummarySchema>;
export type TranscriptionOverview = z.infer<typeof TranscriptionOverviewSchema>;
export type TranscriptionConnectionTest = z.infer<typeof TranscriptionConnectionTestSchema>;
export type EnqueueTranscriptionRequest = z.infer<typeof EnqueueTranscriptionRequestSchema>;
export type EnqueueTranscriptionResult = z.infer<typeof EnqueueTranscriptionResultSchema>;
export type TranscriptionReplayPreview = z.infer<typeof TranscriptionReplayPreviewSchema>;
