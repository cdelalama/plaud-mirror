import { z } from "zod";

const numericValueSchema = z.union([
  z.number(),
  z.string().trim().regex(/^-?\d+(\.\d+)?$/).transform(Number),
]);

const booleanValueSchema = z.union([
  z.boolean(),
  z.number().transform((value) => value !== 0),
  z.string().trim().transform((value) => {
    const normalized = value.toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  }),
]);

export const PlaudRawRecordingSchema = z.object({
  id: z.string(),
  filename: z.string().catch(""),
  fullname: z.string().optional().nullable(),
  filesize: numericValueSchema.catch(0),
  file_md5: z.string().optional().catch(""),
  start_time: numericValueSchema,
  end_time: numericValueSchema.catch(0),
  duration: numericValueSchema.catch(0),
  version: numericValueSchema.optional().nullable(),
  version_ms: numericValueSchema.optional().nullable(),
  edit_time: numericValueSchema.catch(0),
  is_trash: booleanValueSchema.catch(false),
  is_trans: booleanValueSchema.catch(false),
  is_summary: booleanValueSchema.catch(false),
  serial_number: z.string().catch(""),
  filetype: z.string().optional().nullable(),
  timezone: numericValueSchema.optional().nullable(),
  zonemins: numericValueSchema.optional().nullable(),
  scene: numericValueSchema.optional().nullable(),
  filetag_id_list: z.array(z.string()).optional().catch([]),
  is_markmemo: booleanValueSchema.optional().nullable(),
  wait_pull: numericValueSchema.optional().nullable(),
}).passthrough();

export const PlaudListResponseSchema = z.object({
  status: numericValueSchema,
  msg: z.string().optional().catch(""),
  request_id: z.string().optional(),
  data_file_total: numericValueSchema.catch(0),
  data_file_list: z.array(PlaudRawRecordingSchema).catch([]),
}).passthrough();

export const PlaudContentListItemSchema = z.object({
  data_id: z.string().optional().catch(""),
  data_type: z.string().optional().catch(""),
  task_status: numericValueSchema.optional().nullable(),
  err_code: z.string().optional().catch(""),
  err_msg: z.string().optional().catch(""),
  data_title: z.string().optional().catch(""),
  data_tab_name: z.string().optional().catch(""),
  data_link: z.string().optional().catch(""),
}).passthrough();

export const PlaudFileDetailDataSchema = z.object({
  file_id: z.string(),
  file_name: z.string().catch(""),
  file_version: numericValueSchema.optional().nullable(),
  duration: numericValueSchema.catch(0),
  is_trash: booleanValueSchema.catch(false),
  start_time: numericValueSchema.catch(0),
  scene: numericValueSchema.optional().nullable(),
  serial_number: z.string().catch(""),
  session_id: numericValueSchema.optional().nullable(),
  filetag_id_list: z.array(z.string()).optional().catch([]),
  content_list: z.array(PlaudContentListItemSchema).optional().catch([]),
}).passthrough();

export const PlaudFileDetailResponseSchema = z.object({
  status: numericValueSchema,
  msg: z.string().optional().catch(""),
  request_id: z.string().optional(),
  data: PlaudFileDetailDataSchema,
}).passthrough();

export const PlaudUserResponseSchema = z.object({
  status: numericValueSchema,
  msg: z.string().optional().catch(""),
  request_id: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional().catch({}),
}).passthrough();

export const PlaudTempUrlResponseSchema = z.object({
  status: numericValueSchema,
  msg: z.string().optional().catch(""),
  request_id: z.string().optional(),
  temp_url: z.string().optional(),
  data: z.object({
    temp_url: z.string().optional(),
    domains: z.object({
      api: z.string().optional(),
    }).partial().optional(),
  }).partial().optional(),
}).passthrough();

export type PlaudRawRecording = z.infer<typeof PlaudRawRecordingSchema>;
export type PlaudListResponse = z.infer<typeof PlaudListResponseSchema>;
export type PlaudFileDetailData = z.infer<typeof PlaudFileDetailDataSchema>;
export type PlaudFileDetailResponse = z.infer<typeof PlaudFileDetailResponseSchema>;
export type PlaudUserResponse = z.infer<typeof PlaudUserResponseSchema>;
export type PlaudTempUrlResponse = z.infer<typeof PlaudTempUrlResponseSchema>;
