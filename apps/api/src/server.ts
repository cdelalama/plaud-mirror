import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";

import fastifyStatic from "@fastify/static";
import Fastify from "fastify";

import { loadServerEnvironment, type ServerEnvironment } from "./runtime/environment.js";
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

  const app = Fastify({
    logger: false,
  });

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

  app.post("/api/sync/run", async (request) => service.runSync(request.body));

  app.post("/api/backfill/run", async (request) => service.runBackfill(request.body));

  app.get("/api/recordings", async (request) => {
    const query = request.query as { limit?: string | number; includeDismissed?: string | boolean };
    const limit = parseLimit(query.limit);
    const includeDismissed = parseBoolean(query.includeDismissed);
    return service.listRecordings(limit, { includeDismissed });
  });

  app.get("/api/recordings/:id/audio", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const { path, contentType } = await service.getRecordingAudio(id);
    reply.type(contentType);
    return reply.send(createReadStream(path));
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
