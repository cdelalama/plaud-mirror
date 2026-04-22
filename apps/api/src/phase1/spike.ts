import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import {
  Phase1ProbeReportSchema,
  type Phase1DownloadedArtifact,
  type Phase1FilterRecommendation,
  type PlaudRawRecording,
} from "@plaud-mirror/shared";

import { PlaudClient } from "../plaud/client.js";
import { API_PACKAGE_VERSION } from "../version.js";

export interface SpikeEnvironment {
  accessToken: string;
  apiBase?: string;
}

export interface ProbeOptions {
  limit: number;
  from?: number;
  to?: number;
  serialNumber?: string;
  scene?: number;
  detailId?: string;
  downloadId?: string;
  downloadFirst?: boolean;
  opus?: boolean;
  recordingsDir: string;
  reportPath: string;
}

export interface DetailResult {
  recordingId: string;
  detail: Record<string, unknown>;
}

const DEFAULT_REPORT_PATH = ".state/phase1/latest-report.json";
const DEFAULT_RECORDINGS_DIR = "recordings";

export function loadSpikeEnvironment(env: NodeJS.ProcessEnv = process.env): SpikeEnvironment {
  const accessToken = env.PLAUD_MIRROR_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error("PLAUD_MIRROR_ACCESS_TOKEN is required for the Phase 1 spike");
  }

  const apiBase = env.PLAUD_MIRROR_API_BASE?.trim();
  if (apiBase) {
    return {
      accessToken,
      apiBase,
    };
  }

  return { accessToken };
}

export function getDefaultReportPath(): string {
  return DEFAULT_REPORT_PATH;
}

export function getDefaultRecordingsDir(): string {
  return DEFAULT_RECORDINGS_DIR;
}

export function applyLocalFilters(recordings: PlaudRawRecording[], options: ProbeOptions): PlaudRawRecording[] {
  return recordings.filter((recording) => {
    if (options.from !== undefined && recording.start_time < options.from) {
      return false;
    }
    if (options.to !== undefined && recording.start_time > options.to) {
      return false;
    }
    if (options.serialNumber && recording.serial_number !== options.serialNumber) {
      return false;
    }
    if (options.scene !== undefined && recording.scene !== options.scene) {
      return false;
    }
    return true;
  });
}

export async function runProbe(environment: SpikeEnvironment, options: ProbeOptions) {
  const client = createPlaudClient(environment);

  const user = await client.getCurrentUser();
  const recordings = await client.listAllRecordings(100, options.limit);
  const filteredRecordings = applyLocalFilters(recordings, options);

  const selectedRecordingId =
    options.detailId ??
    options.downloadId ??
    (options.downloadFirst ? filteredRecordings[0]?.id : filteredRecordings[0]?.id) ??
    null;

  const detailSnapshot = selectedRecordingId
    ? await client.getFileDetail(selectedRecordingId)
    : null;

  const downloadedArtifact = options.downloadId || options.downloadFirst
    ? await downloadAudioArtifact(
        client,
        options.downloadId ?? filteredRecordings[0]?.id ?? null,
        options.recordingsDir,
        detailSnapshot,
        options.opus ?? false,
      )
    : null;

  const report = Phase1ProbeReportSchema.parse({
    generatedAt: new Date().toISOString(),
    packageVersion: API_PACKAGE_VERSION,
    resolvedApiBase: client.getResolvedApiBase(),
    requestedApiBase: environment.apiBase ?? "https://api.plaud.ai",
    userSummary: buildUserSummary(user.data ?? {}),
    stats: buildRecordingStats(recordings, filteredRecordings),
    filterRecommendations: buildFilterRecommendations(recordings),
    sampleRecordingIds: filteredRecordings.slice(0, 10).map((recording) => recording.id),
    selectedRecordingId,
    detailSnapshot,
    downloadedArtifact,
    reportPath: options.reportPath,
  });

  await writeJson(options.reportPath, report);

  return {
    report,
    recordings: filteredRecordings,
  };
}

export async function runValidate(environment: SpikeEnvironment) {
  const client = createPlaudClient(environment);

  const user = await client.getCurrentUser();
  return {
    resolvedApiBase: client.getResolvedApiBase(),
    userSummary: buildUserSummary(user.data ?? {}),
  };
}

export async function runList(environment: SpikeEnvironment, options: ProbeOptions) {
  const client = createPlaudClient(environment);

  const recordings = await client.listAllRecordings(100, options.limit);
  return {
    resolvedApiBase: client.getResolvedApiBase(),
    recordings: applyLocalFilters(recordings, options),
  };
}

export async function runDetail(environment: SpikeEnvironment, recordingId: string) {
  const client = createPlaudClient(environment);

  return {
    resolvedApiBase: client.getResolvedApiBase(),
    detail: await client.getFileDetail(recordingId),
  };
}

export async function runDownload(
  environment: SpikeEnvironment,
  recordingId: string,
  recordingsDir: string,
  opus = false,
) {
  const client = createPlaudClient(environment);

  const detail = await client.getFileDetail(recordingId);
  return downloadAudioArtifact(client, recordingId, recordingsDir, detail, opus);
}

function createPlaudClient(environment: SpikeEnvironment): PlaudClient {
  if (environment.apiBase) {
    return new PlaudClient({
      accessToken: environment.accessToken,
      apiBase: environment.apiBase,
    });
  }

  return new PlaudClient({
    accessToken: environment.accessToken,
  });
}

function buildUserSummary(userData: Record<string, unknown>): Record<string, unknown> {
  const keysOfInterest = [
    "uid",
    "user_id",
    "email",
    "nickname",
    "name",
    "region",
    "country_code",
  ];

  const summary: Record<string, unknown> = {};
  for (const key of keysOfInterest) {
    if (userData[key] !== undefined) {
      summary[key] = userData[key];
    }
  }

  return summary;
}

export function buildRecordingStats(allRecordings: PlaudRawRecording[], filteredRecordings: PlaudRawRecording[]) {
  const matchedDurations = filteredRecordings.map((recording) => recording.duration / 1000);
  const totalFilesizeBytes = filteredRecordings.reduce((sum, recording) => sum + recording.filesize, 0);
  const uniqueSerialNumbers = uniqueStrings(filteredRecordings.map((recording) => recording.serial_number));
  const uniqueScenes = uniqueNumbers(
    filteredRecordings
      .map((recording) => recording.scene)
      .filter((value): value is number => typeof value === "number"),
  );

  return {
    examined: allRecordings.length,
    matched: filteredRecordings.length,
    earliestStartTime: filteredRecordings.length === 0
      ? null
      : toIsoOrNull(Math.min(...filteredRecordings.map((recording) => recording.start_time))),
    latestStartTime: filteredRecordings.length === 0
      ? null
      : toIsoOrNull(Math.max(...filteredRecordings.map((recording) => recording.start_time))),
    averageDurationSeconds: matchedDurations.length === 0
      ? 0
      : Number((matchedDurations.reduce((sum, value) => sum + value, 0) / matchedDurations.length).toFixed(2)),
    totalFilesizeBytes,
    uniqueSerialNumbers,
    uniqueScenes,
    recordingsWithSummary: filteredRecordings.filter((recording) => recording.is_summary).length,
    recordingsWithTranscript: filteredRecordings.filter((recording) => recording.is_trans).length,
    trashCount: filteredRecordings.filter((recording) => recording.is_trash).length,
  };
}

export function buildFilterRecommendations(recordings: PlaudRawRecording[]): Phase1FilterRecommendation[] {
  const recommendations: Phase1FilterRecommendation[] = [];

  recommendations.push({
    id: "date_range",
    supported: recordings.every((recording) => Number.isFinite(recording.start_time)),
    reason: recordings.length === 0
      ? "No recordings returned yet; date filters need a real sample"
      : "Every sampled recording includes start_time, so client-side date filtering is viable from listing metadata",
  });

  const serialNumbers = uniqueStrings(recordings.map((recording) => recording.serial_number));
  recommendations.push({
    id: "serial_number",
    supported: serialNumbers.length > 0,
    reason: serialNumbers.length > 1
      ? `${serialNumbers.length} unique serial numbers observed in the sampled listings`
      : serialNumbers.length === 1
        ? "Only one serial number observed so far, but the field is populated"
        : "No serial number populated in the sampled listings",
  });

  const scenes = uniqueNumbers(
    recordings
      .map((recording) => recording.scene)
      .filter((value): value is number => typeof value === "number"),
  );
  recommendations.push({
    id: "scene",
    supported: scenes.length > 0,
    reason: scenes.length > 1
      ? `${scenes.length} scene values observed in the sampled listings`
      : scenes.length === 1
        ? "Only one scene value observed so far, but the field is populated"
        : "No scene values populated in the sampled listings",
  });

  recommendations.push({
    id: "trash_state",
    supported: recordings.some((recording) => recording.is_trash) || recordings.length > 0,
    reason: "The list endpoint exposes is_trash, so the spike can distinguish active vs trash content",
  });

  return recommendations;
}

async function downloadAudioArtifact(
  client: PlaudClient,
  recordingId: string | null,
  recordingsDir: string,
  detailSnapshot: Record<string, unknown> | null,
  opus: boolean,
): Promise<Phase1DownloadedArtifact | null> {
  if (!recordingId) {
    return null;
  }

  const tempUrl = await client.getAudioTempUrl(recordingId, opus);
  const response = await fetch(tempUrl);
  if (!response.ok) {
    throw new Error(`Plaud temp URL fetch failed with HTTP ${response.status} for recording ${recordingId}`);
  }
  if (!response.body) {
    throw new Error(`Plaud temp URL fetch returned an empty body for recording ${recordingId}`);
  }

  const extension = resolveAudioExtension(tempUrl, response.headers.get("content-type"));
  const destinationDirectory = join(recordingsDir, recordingId);
  const destinationPath = join(destinationDirectory, `audio${extension}`);

  await mkdir(destinationDirectory, { recursive: true });

  const output = createWriteStream(destinationPath);
  await pipeline(Readable.fromWeb(response.body as never), output);

  const bytesWritten = Number(response.headers.get("content-length") ?? 0);
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const tempUrlHost = new URL(tempUrl).host;

  await writeJson(join(destinationDirectory, "metadata.json"), {
    generatedAt: new Date().toISOString(),
    recordingId,
    detailSnapshot,
    contentType,
    tempUrlHost,
    outputFile: relative(process.cwd(), destinationPath),
    bytesWritten,
  });

  return {
    recordingId,
    localPath: relative(process.cwd(), destinationPath),
    contentType,
    extension,
    bytesWritten,
    tempUrlHost,
  };
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const directory = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".";
  await mkdir(directory, { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function resolveAudioExtension(tempUrl: string, contentType: string | null): string {
  const pathname = new URL(tempUrl).pathname;
  const fromUrl = extname(basename(pathname));
  if (fromUrl) {
    return fromUrl.toLowerCase();
  }

  switch ((contentType ?? "").split(";")[0]?.trim()) {
    case "audio/mpeg":
      return ".mp3";
    case "audio/mp4":
    case "audio/x-m4a":
      return ".m4a";
    case "audio/wav":
    case "audio/x-wav":
      return ".wav";
    case "audio/ogg":
      return ".ogg";
    case "audio/opus":
      return ".opus";
    case "audio/webm":
      return ".webm";
    default:
      return ".bin";
  }
}

function toIsoOrNull(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return new Date(value).toISOString();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort((left, right) => left.localeCompare(right));
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}
