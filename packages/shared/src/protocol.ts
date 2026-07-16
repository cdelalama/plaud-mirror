import { z } from "zod";

export const ProtocolStatusConditionSchema = z.enum(["ok", "degraded"]);
export const ProtocolCheckConditionSchema = z.enum(["ok", "degraded", "down"]);
export const ProtocolSeveritySchema = z.enum(["none", "info", "watch", "warning", "critical"]);

export const ProtocolStatusCheckSchema = z.object({
  name: z.string().min(1),
  condition: ProtocolCheckConditionSchema,
  severity: ProtocolSeveritySchema.optional(),
  summary: z.string().optional(),
}).passthrough();

export const ProtocolStatusSnapshotSchema = z.object({
  observed_at: z.string().datetime({ offset: true }).regex(/Z$/),
  next_run_at: z.string().datetime({ offset: true }).regex(/Z$/).optional(),
  condition: ProtocolStatusConditionSchema,
  severity: ProtocolSeveritySchema,
  summary: z.string().min(1),
  checks: z.array(ProtocolStatusCheckSchema).optional(),
}).passthrough();

export type ProtocolStatusCondition = z.infer<typeof ProtocolStatusConditionSchema>;
export type ProtocolCheckCondition = z.infer<typeof ProtocolCheckConditionSchema>;
export type ProtocolSeverity = z.infer<typeof ProtocolSeveritySchema>;
export type ProtocolStatusCheck = z.infer<typeof ProtocolStatusCheckSchema>;
export type ProtocolStatusSnapshot = z.infer<typeof ProtocolStatusSnapshotSchema>;
