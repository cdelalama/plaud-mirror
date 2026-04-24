import { randomUUID } from "node:crypto";

import {
  DeviceSchema,
  PlaudDeviceListResponseSchema,
  PlaudFileDetailResponseSchema,
  PlaudListResponseSchema,
  PlaudTempUrlResponseSchema,
  PlaudUserResponseSchema,
  type Device,
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

  // Paginate the full Plaud listing until a page comes back shorter than
  // `pageSize` (signal of the last page). Returns every recording plus the
  // authoritative total. Note that Plaud's `data_file_total` field is NOT the
  // account's grand total — it just mirrors the length of the current page —
  // so pagination-until-partial is the only way to learn the real count.
  async listEverything(pageSize = 500): Promise<{ recordings: PlaudListResponse["data_file_list"]; total: number }> {
    const all: PlaudListResponse["data_file_list"] = [];
    let skip = 0;
    while (true) {
      const page = await this.listRecordings({ skip, limit: pageSize });
      all.push(...page.data_file_list);
      if (page.data_file_list.length < pageSize) {
        break;
      }
      skip += page.data_file_list.length;
    }
    return { recordings: all, total: all.length };
  }

  async listAllRecordings(
    pageSize = 100,
    totalLimit = 200,
  ): Promise<{ recordings: PlaudListResponse["data_file_list"]; totalAvailable: number }> {
    const recordings: PlaudListResponse["data_file_list"] = [];
    let totalAvailable = 0;
    let skip = 0;

    while (recordings.length < totalLimit) {
      const remaining = totalLimit - recordings.length;
      const page = await this.listRecordings({
        skip,
        limit: Math.min(pageSize, remaining),
      });

      // The first page reports how many recordings exist in the Plaud account
      // (irrespective of the page size or totalLimit we're using). Capture it
      // so callers can distinguish "how many we pulled" from "how many exist".
      if (skip === 0) {
        totalAvailable = Number(page.data_file_total) || 0;
      }

      if (page.data_file_list.length === 0) {
        break;
      }

      recordings.push(...page.data_file_list);

      if (page.data_file_list.length < Math.min(pageSize, remaining)) {
        break;
      }

      skip += page.data_file_list.length;
    }

    return { recordings, totalAvailable };
  }

  // Returns every hardware device bound to the account. The Plaud wire response
  // uses `sn`, `name`, `model`, `version_number`; we translate to the project's
  // domain type here so the service/store/UI only deal with `Device`. Devices
  // never seen before carry a fresh `lastSeenAt`; this is bumped on every
  // successful call so the store can distinguish "currently connected" from
  // "historical / retired".
  async listDevices(): Promise<Device[]> {
    const response = await this.fetchJson("/device/list", PlaudDeviceListResponseSchema);
    const now = new Date().toISOString();
    return response.data_devices
      .filter((raw) => typeof raw.sn === "string" && raw.sn.trim().length > 0)
      .map((raw) =>
        DeviceSchema.parse({
          serialNumber: raw.sn.trim(),
          displayName: (raw.name ?? "").trim(),
          model: (raw.model ?? "").trim(),
          firmwareVersion: typeof raw.version_number === "number" ? raw.version_number : null,
          lastSeenAt: now,
        }),
      );
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

export function extractTempUrl(response: PlaudTempUrlResponse, recordingId: string): string {
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
