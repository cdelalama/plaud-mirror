import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";

import fastifyStatic from "@fastify/static";
import Fastify from "fastify";

import { loadServerEnvironment, type ServerEnvironment } from "./runtime/environment.js";
import { Scheduler } from "./runtime/scheduler.js";
import { SecretStore } from "./runtime/secrets.js";
import { PlaudMirrorService, type RuntimeServiceDependencies } from "./runtime/service.js";
import { RuntimeStore } from "./runtime/store.js";

export interface CreateAppOptions extends RuntimeServiceDependencies {
  environment?: ServerEnvironment;
  service?: PlaudMirrorService;
}

export async function createApp(options: CreateAppOptions = {}) {
  const environment = options.environment ?? loadServerEnvironment();
  const ownsService = !options.service;
  const service = options.service ?? new PlaudMirrorService(
    environment,
    new RuntimeStore({
      dbPath: join(environment.dataDir, "app.db"),
      dataDir: environment.dataDir,
      recordingsDir: environment.recordingsDir,
      defaultSyncLimit: environment.defaultSyncLimit,
    }),
    new SecretStore(join(environment.dataDir, "secrets.enc"), environment.masterKey),
    options,
  );

  await service.initialize();

  // Phase 3 scheduler (D-012). Activated only when the environment opts in
  // (`schedulerIntervalMs > 0`). The fallback in environment.ts is 0
  // (disabled), so an operator who upgrades from 0.4.x without setting
  // PLAUD_MIRROR_SCHEDULER_INTERVAL_MS keeps Phase 2 manual-only behavior.
  const scheduler = environment.schedulerIntervalMs > 0
    ? new Scheduler({
        intervalMs: environment.schedulerIntervalMs,
        runTick: async () => {
          // Two-layer anti-overlap (documented in 0.5.0 but only fully
          // implemented in 0.5.1):
          //   1. Service-layer: runScheduledSync consults
          //      store.getActiveSyncRun() and returns `started: false`
          //      when a manual or scheduled run is already mid-flight,
          //      without inserting into sync_runs.
          //   2. Scheduler-level: the inflight flag on Scheduler.executeTick
          //      stops two ticks from this same scheduler from running
          //      concurrently.
          // When the service absorbs the tick, surface that as `skipped`
          // in the health response — `completed` would mislead operators.
          const { started } = await service.runScheduledSync();
          if (!started) {
            return { skipped: true, reason: "another sync run was already in flight" };
          }
        },
      })
    : null;
  if (scheduler) {
    service.setSchedulerStatusProvider(() => scheduler.status());
    scheduler.start();
  }

  const app = Fastify({
    logger: false,
  });

  // Stop the scheduler on shutdown so SIGTERM does not leave a half-fired
  // tick or a dangling timer when the process unwinds.
  if (scheduler) {
    app.addHook("onClose", async () => {
      scheduler.stop();
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    const statusCode = "statusCode" in normalizedError && typeof normalizedError.statusCode === "number"
      ? normalizedError.statusCode
      : 500;

    reply.code(statusCode).send({
      error: normalizedError.name,
      message: normalizedError.message,
    });
  });

  app.get("/api/health", async () => service.getHealth());

  app.get("/api/config", async () => service.getConfig());

  app.put("/api/config", async (request) => service.updateConfig(request.body));

  app.get("/api/auth/status", async () => service.getAuthStatus());

  app.post("/api/auth/token", async (request) => service.saveAccessToken(request.body));

  app.post("/api/sync/run", async (request, reply) => {
    const handle = await service.runSync(request.body);
    reply.code(202);
    return handle;
  });

  app.post("/api/backfill/run", async (request, reply) => {
    const handle = await service.runBackfill(request.body);
    reply.code(202);
    return handle;
  });

  // Dry-run preview: same filter pipeline as a real backfill, but returns
  // the matching recordings annotated with their current local state instead
  // of downloading anything. Query params: from, to, serialNumber, scene,
  // previewLimit.
  app.get("/api/backfill/candidates", async (request) => {
    const query = request.query as {
      from?: string;
      to?: string;
      serialNumber?: string;
      scene?: string | number;
      previewLimit?: string | number;
    };
    return service.previewBackfillCandidates({
      from: query.from ? query.from : null,
      to: query.to ? query.to : null,
      serialNumber: query.serialNumber ? query.serialNumber : null,
      scene: parseOptionalInt(query.scene),
      previewLimit: parsePreviewLimit(query.previewLimit),
    });
  });

  app.get("/api/sync/runs/:id", async (request) => {
    const id = (request.params as { id: string }).id;
    return service.getSyncRunStatus(id);
  });

  app.get("/api/devices", async () => {
    return { devices: service.listDevices() };
  });

  app.get("/api/recordings", async (request) => {
    const query = request.query as {
      limit?: string | number;
      skip?: string | number;
      includeDismissed?: string | boolean;
    };
    const limit = parseLimit(query.limit);
    const skip = parseSkip(query.skip);
    const includeDismissed = parseBoolean(query.includeDismissed);
    return service.listRecordings(limit, { includeDismissed, skip });
  });

  app.get("/api/recordings/:id/audio", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const { path, contentType, size, filename } = await service.getRecordingAudio(id);

    reply.header("accept-ranges", "bytes");
    reply.header("cache-control", "private, max-age=0, must-revalidate");
    // Content-Disposition controls the default filename when the operator
    // uses the browser's native `<audio>` → "Download" menu. Without it the
    // browser derives the name from the URL's last segment ("audio") and
    // saves a file with no extension. We emit both `filename=` (quoted,
    // ASCII-safe) and `filename*=UTF-8''<encoded>` per RFC 5987 so non-ASCII
    // titles still resolve correctly on browsers that honour the encoded
    // form. `inline` — not `attachment` — so the browser still renders the
    // audio element by default; the filename only applies to the explicit
    // download action.
    reply.header("content-disposition", buildContentDisposition(filename));
    reply.type(contentType);

    const rangeHeader = request.headers.range;
    if (!rangeHeader) {
      reply.header("content-length", String(size));
      return reply.send(createReadStream(path));
    }

    const parsed = parseByteRange(rangeHeader, size);
    if (!parsed) {
      reply.code(416);
      reply.header("content-range", `bytes */${size}`);
      return reply.send();
    }

    const { start, end } = parsed;
    reply.code(206);
    reply.header("content-range", `bytes ${start}-${end}/${size}`);
    reply.header("content-length", String(end - start + 1));
    return reply.send(createReadStream(path, { start, end }));
  });

  app.delete("/api/recordings/:id", async (request) => {
    const id = (request.params as { id: string }).id;
    return service.deleteRecording(id);
  });

  app.post("/api/recordings/:id/restore", async (request) => {
    const id = (request.params as { id: string }).id;
    return service.restoreRecording(id);
  });

  if (await pathExists(environment.webDistDir)) {
    await app.register(fastifyStatic, {
      root: environment.webDistDir,
      prefix: "/",
      index: false,
      wildcard: false,
    });

    app.get("/", async (_request, reply) => reply.sendFile("index.html"));
    app.get("/*", async (request, reply) => {
      const wildcardPath = String((request.params as { "*": string })["*"] ?? "");
      if (wildcardPath.startsWith("api/")) {
        reply.code(404);
        return {
          error: "Not Found",
          message: "Unknown API route",
        };
      }

      return reply.sendFile("index.html");
    });
  }

  app.addHook("onClose", async () => {
    if (ownsService) {
      service.close();
    }
  });

  return app;
}

export async function startServer(options: CreateAppOptions = {}) {
  const app = await createApp(options);
  const environment = options.environment ?? loadServerEnvironment();
  await app.listen({
    host: environment.host,
    port: environment.port,
  });
  return app;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseLimit(input: string | number | undefined): number {
  if (input === undefined) {
    return 50;
  }

  const value = Number(input);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid limit value: ${input}`);
  }

  return Math.min(value, 200);
}

export function buildContentDisposition(filename: string): string {
  // RFC 5987: the unquoted `filename=` is limited to ASCII, so we build a
  // fallback by stripping anything outside printable ASCII and guarding
  // against quote injection. The `filename*=` form carries the full UTF-8
  // name percent-encoded, which modern browsers prefer when present.
  const asciiFallback = filename
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeRFC5987(filename);
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

function encodeRFC5987(value: string): string {
  // Per RFC 5987, encode everything that isn't in the `attr-char` set.
  return encodeURIComponent(value)
    .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, "%2A")
    // `encodeURIComponent` leaves `!` unescaped but it's fine under RFC 5987.
    .replace(/%(?:7C|60|5E)/g, (pct) => pct.toLowerCase());
}

function parseSkip(input: string | number | undefined): number {
  if (input === undefined) {
    return 0;
  }
  const value = Number(input);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid skip value: ${input}`);
  }
  return value;
}

function parseOptionalInt(input: string | number | undefined): number | null {
  if (input === undefined || input === "") {
    return null;
  }
  const value = Number(input);
  if (!Number.isInteger(value)) {
    throw new Error(`Invalid integer value: ${input}`);
  }
  return value;
}

function parsePreviewLimit(input: string | number | undefined): number {
  if (input === undefined || input === "") {
    return 200;
  }
  const value = Number(input);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid previewLimit value: ${input}`);
  }
  return Math.min(value, 500);
}

function parseBoolean(input: string | boolean | undefined): boolean {
  if (input === undefined) {
    return false;
  }
  if (typeof input === "boolean") {
    return input;
  }
  const normalized = input.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

// Parses a single-range RFC 7233 `Range: bytes=start-end` header against a
// resource of the given total size. Returns inclusive [start, end] within
// [0, size - 1], or null if the header is malformed or unsatisfiable.
// Multipart/byterange (comma-separated ranges) is intentionally not supported —
// audio elements only ever ask for a single range.
export function parseByteRange(headerValue: string, size: number): { start: number; end: number } | null {
  if (size <= 0) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(headerValue.trim());
  if (!match) {
    return null;
  }

  const rawStart = match[1];
  const rawEnd = match[2];

  let start: number;
  let end: number;

  if (rawStart === "" && rawEnd !== "") {
    // Suffix form: last N bytes.
    const suffix = Number(rawEnd);
    if (!Number.isInteger(suffix) || suffix <= 0) {
      return null;
    }
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else if (rawStart !== "" && rawEnd === "") {
    start = Number(rawStart);
    end = size - 1;
  } else if (rawStart !== "" && rawEnd !== "") {
    start = Number(rawStart);
    end = Number(rawEnd);
  } else {
    return null;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
    return null;
  }

  if (start >= size) {
    return null;
  }

  if (end >= size) {
    end = size - 1;
  }

  return { start, end };
}
