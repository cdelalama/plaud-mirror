import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ServerEnvironment {
  port: number;
  host: string;
  apiBase?: string;
  dataDir: string;
  recordingsDir: string;
  masterKey: string;
  webDistDir: string;
  defaultSyncLimit: number;
  initialWebhookUrl?: string;
  initialWebhookSecret?: string;
  requestTimeoutMs: number;
}

export function loadServerEnvironment(env: NodeJS.ProcessEnv = process.env): ServerEnvironment {
  const masterKey = env.PLAUD_MIRROR_MASTER_KEY?.trim();
  if (!masterKey) {
    throw new Error("PLAUD_MIRROR_MASTER_KEY is required to encrypt secrets at rest");
  }

  const port = parsePositiveInteger(env.PORT ?? env.PLAUD_MIRROR_PORT, 3040);
  const host = (env.PLAUD_MIRROR_HOST ?? "0.0.0.0").trim() || "0.0.0.0";
  const apiBase = env.PLAUD_MIRROR_API_BASE?.trim() || undefined;
  const dataDir = resolve(env.PLAUD_MIRROR_DATA_DIR?.trim() || "data");
  const recordingsDir = resolve(env.PLAUD_MIRROR_RECORDINGS_DIR?.trim() || "recordings");
  const webDistDir = resolve(env.PLAUD_MIRROR_WEB_DIST_DIR?.trim() || resolveDefaultWebDistDir());
  const defaultSyncLimit = parsePositiveInteger(env.PLAUD_MIRROR_DEFAULT_SYNC_LIMIT, 100);
  const initialWebhookUrl = env.PLAUD_MIRROR_WEBHOOK_URL?.trim() || undefined;
  const initialWebhookSecret = env.PLAUD_MIRROR_WEBHOOK_SECRET?.trim() || undefined;
  const requestTimeoutMs = parsePositiveInteger(env.PLAUD_MIRROR_REQUEST_TIMEOUT_MS, 30_000);

  const resolvedEnvironment: ServerEnvironment = {
    port,
    host,
    dataDir,
    recordingsDir,
    masterKey,
    webDistDir,
    defaultSyncLimit,
    requestTimeoutMs,
  };

  if (apiBase) {
    resolvedEnvironment.apiBase = apiBase;
  }
  if (initialWebhookUrl) {
    resolvedEnvironment.initialWebhookUrl = initialWebhookUrl;
  }
  if (initialWebhookSecret) {
    resolvedEnvironment.initialWebhookSecret = initialWebhookSecret;
  }

  return resolvedEnvironment;
}

function resolveDefaultWebDistDir(): string {
  return fileURLToPath(new URL("../../../web/dist", import.meta.url));
}

function parsePositiveInteger(input: string | undefined, fallback: number): number {
  if (!input) {
    return fallback;
  }

  const value = Number(input);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Expected a positive integer, received: ${input}`);
  }

  return value;
}
