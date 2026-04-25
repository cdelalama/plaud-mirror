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
  /**
   * Continuous-sync scheduler interval in milliseconds (D-012). When > 0,
   * the runtime ticks `service.runSync({ limit: defaultSyncLimit })` on
   * this cadence with anti-overlap protection. When 0, the scheduler is
   * disabled and Phase 2's manual-only behavior is preserved exactly.
   * Default: 15 minutes.
   */
  schedulerIntervalMs: number;
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
  // Scheduler accepts 0 (= disabled) explicitly, so we cannot use
  // parsePositiveInteger here — that helper rejects 0. The cadence floor
  // for "enabled" is 60_000ms (1 minute) to prevent accidental
  // configuration that would hammer Plaud once per second.
  const schedulerIntervalMs = parseSchedulerInterval(env.PLAUD_MIRROR_SCHEDULER_INTERVAL_MS, 15 * 60 * 1000);

  const resolvedEnvironment: ServerEnvironment = {
    port,
    host,
    dataDir,
    recordingsDir,
    masterKey,
    webDistDir,
    defaultSyncLimit,
    requestTimeoutMs,
    schedulerIntervalMs,
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

function parseSchedulerInterval(input: string | undefined, fallback: number): number {
  if (input === undefined) {
    return fallback;
  }
  const trimmed = input.trim();
  if (trimmed === "") {
    return fallback;
  }

  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`PLAUD_MIRROR_SCHEDULER_INTERVAL_MS must be a non-negative integer; received: ${input}`);
  }
  if (value === 0) {
    // Explicit opt-out: scheduler disabled, manual-only behavior.
    return 0;
  }
  if (value < 60_000) {
    throw new Error(
      `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS=${value} is below the 60_000ms floor; pick at least 1 minute or set 0 to disable.`,
    );
  }
  return value;
}
