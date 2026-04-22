import { z } from "zod";

export const Phase1FilterRecommendationSchema = z.object({
  id: z.string(),
  supported: z.boolean(),
  reason: z.string(),
});

export const Phase1RecordingStatsSchema = z.object({
  examined: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  earliestStartTime: z.string().nullable(),
  latestStartTime: z.string().nullable(),
  averageDurationSeconds: z.number().nonnegative(),
  totalFilesizeBytes: z.number().nonnegative(),
  uniqueSerialNumbers: z.array(z.string()),
  uniqueScenes: z.array(z.number()),
  recordingsWithSummary: z.number().int().nonnegative(),
  recordingsWithTranscript: z.number().int().nonnegative(),
  trashCount: z.number().int().nonnegative(),
});

export const Phase1DownloadedArtifactSchema = z.object({
  recordingId: z.string(),
  localPath: z.string(),
  contentType: z.string(),
  extension: z.string(),
  bytesWritten: z.number().int().nonnegative(),
  tempUrlHost: z.string(),
});

export const Phase1ProbeReportSchema = z.object({
  generatedAt: z.string(),
  packageVersion: z.string(),
  resolvedApiBase: z.string(),
  requestedApiBase: z.string(),
  userSummary: z.record(z.string(), z.unknown()),
  stats: Phase1RecordingStatsSchema,
  filterRecommendations: z.array(Phase1FilterRecommendationSchema),
  sampleRecordingIds: z.array(z.string()),
  selectedRecordingId: z.string().nullable(),
  detailSnapshot: z.record(z.string(), z.unknown()).nullable(),
  downloadedArtifact: Phase1DownloadedArtifactSchema.nullable(),
  reportPath: z.string(),
}).strict();

export type Phase1FilterRecommendation = z.infer<typeof Phase1FilterRecommendationSchema>;
export type Phase1RecordingStats = z.infer<typeof Phase1RecordingStatsSchema>;
export type Phase1DownloadedArtifact = z.infer<typeof Phase1DownloadedArtifactSchema>;
export type Phase1ProbeReport = z.infer<typeof Phase1ProbeReportSchema>;
