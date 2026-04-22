import { randomUUID } from "node:crypto";

import {
  PlaudFileDetailResponseSchema,
  PlaudListResponseSchema,
  PlaudTempUrlResponseSchema,
  PlaudUserResponseSchema,
  type PlaudFileDetailData,
  type PlaudListResponse,
  type PlaudTempUrlResponse,
  type PlaudUserResponse,
} from "@plaud-mirror/shared";

import { API_PACKAGE_VERSION } from "../version.js";

const DEFAULT_API_BASE = "https://api.plaud.ai";
const DEFAULT_ORIGIN = "https://app.plaud.ai";

export interface PlaudClientConfig {
  accessToken: string;
  apiBase?: string;
  fetchImpl?: typeof fetch;
  userAgent?: string;
}

export interface PlaudListOptions {
  skip?: number;
  limit?: number;
  sortBy?: "start_time" | "edit_time";
  isDesc?: boolean;
  isTrash?: 0 | 1 | 2;
}

interface PlaudResponseBundle {
  response: Response;
  payload: unknown;
  text: string;
}

export class PlaudAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaudAuthError";
  }
}

export class PlaudApiError extends Error {
  public readonly status: number;
  public readonly bodySnippet: string;

  constructor(message: string, status: number, bodySnippet: string) {
    super(message);
    this.name = "PlaudApiError";
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}

export class PlaudClient {
  private readonly accessToken: string;
  private readonly apiBase: string;
  private readonly deviceId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;
  private preferredApiBase: string | null = null;

  constructor(config: PlaudClientConfig) {
    this.accessToken = config.accessToken.trim();
    this.apiBase = normalizeApiBase(config.apiBase ?? DEFAULT_API_BASE) ?? DEFAULT_API_BASE;
    this.deviceId = randomUUID().replaceAll("-", "").slice(0, 16);
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.userAgent = config.userAgent ?? `plaud-mirror-phase1/${API_PACKAGE_VERSION} (+https://github.com/cdelalama/plaud-mirror)`;

    if (!this.accessToken) {
      throw new PlaudAuthError("PLAUD_MIRROR_ACCESS_TOKEN is empty");
    }
  }

  getResolvedApiBase(): string {
    return this.preferredApiBase ?? this.apiBase;
  }

  async getCurrentUser(): Promise<PlaudUserResponse> {
    return this.fetchJson("/user/me", PlaudUserResponseSchema);
  }

  async listRecordings(options: PlaudListOptions = {}): Promise<PlaudListResponse> {
    const query = new URLSearchParams({
      skip: String(options.skip ?? 0),
      limit: String(options.limit ?? 50),
      is_trash: String(options.isTrash ?? 2),
      sort_by: options.sortBy ?? "start_time",
      is_desc: String(options.isDesc ?? true),
    });

    return this.fetchJson(`/file/simple/web?${query.toString()}`, PlaudListResponseSchema);
  }

  async listAllRecordings(pageSize = 100, totalLimit = 200): Promise<PlaudListResponse["data_file_list"]> {
    const recordings: PlaudListResponse["data_file_list"] = [];
    let skip = 0;

    while (recordings.length < totalLimit) {
      const remaining = totalLimit - recordings.length;
      const page = await this.listRecordings({
        skip,
        limit: Math.min(pageSize, remaining),
      });

      if (page.data_file_list.length === 0) {
        break;
      }

      recordings.push(...page.data_file_list);

      if (page.data_file_list.length < Math.min(pageSize, remaining)) {
        break;
      }

      skip += page.data_file_list.length;
    }

    return recordings;
  }

  async getFileDetail(recordingId: string): Promise<PlaudFileDetailData> {
    const response = await this.fetchJson(`/file/detail/${recordingId}`, PlaudFileDetailResponseSchema);
    return response.data;
  }

  async getAudioTempUrl(recordingId: string, opus = false): Promise<string> {
    const suffix = opus ? "?is_opus=1" : "";
    const response = await this.fetchJson(`/file/temp-url/${recordingId}${suffix}`, PlaudTempUrlResponseSchema);
    return extractTempUrl(response, recordingId);
  }

  private async fetchJson<T>(
    path: string,
    parser: { parse(input: unknown): T },
    options: RequestInit = {},
  ): Promise<T> {
    const initialBase = this.getResolvedApiBase();
    let bundle = await this.request(path, initialBase, options);

    const regionalApiBase = extractRegionalApiBase(bundle.payload);
    if (shouldRetryWithRegionalApi(bundle.payload, initialBase, regionalApiBase)) {
      this.preferredApiBase = regionalApiBase;
      bundle = await this.request(path, regionalApiBase!, options);
    }

    if (bundle.response.status === 401) {
      throw new PlaudAuthError("Plaud returned 401; the bearer token is invalid or expired");
    }

    if (!bundle.response.ok) {
      throw new PlaudApiError(
        `Plaud ${options.method ?? "GET"} ${path} failed with HTTP ${bundle.response.status}`,
        bundle.response.status,
        snippet(bundle.text),
      );
    }

    if (bundle.payload === null) {
      throw new PlaudApiError(
        `Plaud ${options.method ?? "GET"} ${path} returned a non-JSON body`,
        bundle.response.status,
        snippet(bundle.text),
      );
    }

    return parser.parse(bundle.payload);
  }

  private async request(path: string, apiBase: string, options: RequestInit): Promise<PlaudResponseBundle> {
    const response = await this.fetchImpl(buildPlaudApiUrl(path, apiBase), {
      ...options,
      headers: this.buildHeaders(options.headers),
    });
    const text = await response.text();

    return {
      response,
      payload: safeParseJson(text),
      text,
    };
  }

  private buildHeaders(input: HeadersInit | undefined): Record<string, string> {
    const headers = new Headers(input);

    headers.set("accept", "application/json, text/plain, */*");
    headers.set("accept-language", "en-US,en;q=0.9");
    headers.set("authorization", `Bearer ${this.accessToken}`);
    headers.set("user-agent", this.userAgent);
    headers.set("app-language", "en");
    headers.set("app-platform", "web");
    headers.set("edit-from", "web");
    headers.set("origin", DEFAULT_ORIGIN);
    headers.set("referer", `${DEFAULT_ORIGIN}/`);
    headers.set("x-request-id", randomUUID().replaceAll("-", "").slice(0, 10));
    headers.set("x-device-id", this.deviceId);
    headers.set("x-pld-tag", this.deviceId);

    return Object.fromEntries(headers.entries());
  }
}

export function buildPlaudApiUrl(path: string, apiBase: string): string {
  const normalizedBase = normalizeApiBase(apiBase) ?? DEFAULT_API_BASE;
  if (!path) {
    return normalizedBase;
  }

  return `${normalizedBase}${path.startsWith("/") ? path : `/${path}`}`;
}

export function normalizeApiBase(candidate: string | null | undefined): string | null {
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (!url.hostname.endsWith(".plaud.ai")) {
      return null;
    }

    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function isRegionMismatchPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;
  if (Number(record.status) === -302) {
    return true;
  }

  const message = `${record.msg ?? record.message ?? ""}`.toLowerCase();
  return message.includes("region mismatch");
}

export function extractRegionalApiBase(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const nestedData = record.data;

  if (nestedData && typeof nestedData === "object") {
    const domains = (nestedData as Record<string, unknown>).domains;
    if (domains && typeof domains === "object") {
      return normalizeApiBase((domains as Record<string, unknown>).api as string | undefined);
    }
  }

  const domains = record.domains;
  if (domains && typeof domains === "object") {
    return normalizeApiBase((domains as Record<string, unknown>).api as string | undefined);
  }

  return null;
}

export function shouldRetryWithRegionalApi(
  payload: unknown,
  currentApiBase: string,
  regionalApiBase: string | null,
): boolean {
  if (!isRegionMismatchPayload(payload) || !regionalApiBase) {
    return false;
  }

  return normalizeApiBase(currentApiBase) !== normalizeApiBase(regionalApiBase);
}

function extractTempUrl(response: PlaudTempUrlResponse, recordingId: string): string {
  const tempUrl = response.temp_url ?? response.data?.temp_url;
  if (!tempUrl) {
    throw new PlaudApiError(`Plaud returned no temp_url for recording ${recordingId}`, 200, "");
  }

  return tempUrl;
}

function safeParseJson(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function snippet(text: string): string {
  return text.slice(0, 500);
}
