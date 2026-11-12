#!/usr/bin/env node

import { startServer } from "../server.js";
import { loadServerEnvironment } from "../runtime/environment.js";
import { seedDevelopmentSamples } from "./development-seed.js";

if (process.env.PLAUD_MIRROR_ENVIRONMENT !== "development") {
  throw new Error("The development entry point requires PLAUD_MIRROR_ENVIRONMENT=development");
}
if (process.env.PLAUD_MIRROR_STATE_POLICY !== "isolated") {
  throw new Error("The development entry point requires PLAUD_MIRROR_STATE_POLICY=isolated");
}
const manifestPath = process.env.PLAUD_MIRROR_DEVELOPMENT_SAMPLES?.trim();
if (!manifestPath) {
  throw new Error("PLAUD_MIRROR_DEVELOPMENT_SAMPLES is required");
}

const environment = loadServerEnvironment();
await seedDevelopmentSamples({
  manifestPath,
  dataDir: environment.dataDir,
  recordingsDir: environment.recordingsDir,
  defaultSyncLimit: environment.defaultSyncLimit,
});

const app = await startServer({ environment });
let shuttingDown = false;
const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stderr.write(`Received ${signal}; shutting down development runtime\n`);
  const hardStop = setTimeout(() => process.exit(1), 75_000);
  hardStop.unref();
  try {
    await app.close();
    clearTimeout(hardStop);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Development runtime shutdown failed: ${message}\n`);
    process.exit(1);
  }
};
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
