#!/usr/bin/env node

import { startServer } from "../server.js";

try {
  const app = await startServer();
  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    process.stderr.write(`Received ${signal}; shutting down gracefully\n`);
    const hardStop = setTimeout(() => process.exit(1), 75_000);
    hardStop.unref();
    try {
      await app.close();
      clearTimeout(hardStop);
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Graceful shutdown failed: ${message}\n`);
      process.exit(1);
    }
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
