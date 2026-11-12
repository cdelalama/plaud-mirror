#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { RecordingMirrorSchema } from "@plaud-mirror/shared";
import { z } from "zod";

import { loadServerEnvironment } from "../runtime/environment.js";
import { RuntimeStore } from "../runtime/store.js";

const DevelopmentSampleSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  title: z.string().max(500),
  createdAt: z.string().datetime({ offset: true }).nullable(),
  durationSeconds: z.number().nonnegative(),
  relativePath: z.string().regex(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/),
  contentType: z.string().min(1).max(100),
  bytes: z.number().int().positive().max(20_000_000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const DevelopmentSeedManifestSchema = z.object({
  schema: z.literal("plaud-mirror.development-samples.v1"),
  generatedAt: z.string().datetime({ offset: true }),
  source: z.literal("nas-production-sample"),
  samples: z.array(DevelopmentSampleSchema).min(1).max(8),
}).strict();

export interface DevelopmentSeedResult {
  inserted: number;
  retired: number;
  total: number;
}

export async function seedDevelopmentSamples(options: {
  manifestPath: string;
  dataDir: string;
  recordingsDir: string;
  defaultSyncLimit: number;
}): Promise<DevelopmentSeedResult> {
  const manifestInfo = await stat(options.manifestPath);
  if (!manifestInfo.isFile() || manifestInfo.size > 64 * 1024) {
    throw new Error("Development sample manifest must be a regular file no larger than 64 KiB");
  }
  const manifest = DevelopmentSeedManifestSchema.parse(
    JSON.parse(await readFile(options.manifestPath, "utf8")),
  );
  const recordingsRoot = resolve(options.recordingsDir);
  const recordingsRootReal = await realpath(recordingsRoot);
  const verifiedSamples = [];
  for (const sample of manifest.samples) {
    const audioPath = resolve(recordingsRoot, sample.relativePath);
    const relativeToRoot = relative(recordingsRoot, audioPath);
    if (relativeToRoot.startsWith("..") || isAbsolute(relativeToRoot)) {
      throw new Error(`Development sample ${sample.id} escapes the recordings root`);
    }
    const audioPathReal = await realpath(audioPath);
    const realRelativeToRoot = relative(recordingsRootReal, audioPathReal);
    if (realRelativeToRoot.startsWith("..") || isAbsolute(realRelativeToRoot)) {
      throw new Error(`Development sample ${sample.id} resolves outside the recordings root`);
    }
    const linkInfo = await lstat(audioPath);
    if (linkInfo.isSymbolicLink()) {
      throw new Error(`Development sample ${sample.id} must not be a symbolic link`);
    }
    const info = await stat(audioPath);
    if (!info.isFile() || info.size !== sample.bytes) {
      throw new Error(`Development sample ${sample.id} does not match its declared byte count`);
    }
    const digest = createHash("sha256").update(await readFile(audioPath)).digest("hex");
    if (digest !== sample.sha256) {
      throw new Error(`Development sample ${sample.id} does not match its declared SHA-256`);
    }
    verifiedSamples.push({ sample, audioPath });
  }

  const store = new RuntimeStore({
    dbPath: resolve(options.dataDir, "app.db"),
    dataDir: resolve(options.dataDir),
    recordingsDir: recordingsRoot,
    defaultSyncLimit: options.defaultSyncLimit,
  });

  try {
    let inserted = 0;
    for (const { sample, audioPath } of verifiedSamples) {
      store.upsertRecording(RecordingMirrorSchema.parse({
        id: sample.id,
        title: sample.title,
        createdAt: sample.createdAt,
        durationSeconds: sample.durationSeconds,
        serialNumber: null,
        scene: null,
        localPath: audioPath,
        contentType: sample.contentType,
        bytesWritten: sample.bytes,
        mirroredAt: manifest.generatedAt,
        lastWebhookStatus: null,
        lastWebhookAttemptAt: null,
        dismissed: false,
        dismissedAt: null,
        upstreamDeletedAt: null,
        upstreamDeletion: null,
        sequenceNumber: null,
      }));
      inserted += 1;
    }
    const retired = store.retireDevelopmentSamplesExcept(
      verifiedSamples.map(({ sample }) => sample.id),
      manifest.generatedAt,
    );
    // Development is not merely seeded disabled: every startup reasserts the
    // no-scheduler invariant in case an older local state predates the runtime
    // policy guard.
    store.saveConfig({ schedulerIntervalMs: 0 });
    return { inserted, retired, total: store.countRecordings() };
  } finally {
    store.close();
  }
}

async function main(): Promise<void> {
  if (process.env.PLAUD_MIRROR_ENVIRONMENT !== "development") {
    throw new Error("Development seeding requires PLAUD_MIRROR_ENVIRONMENT=development");
  }
  if (process.env.PLAUD_MIRROR_STATE_POLICY !== "isolated") {
    throw new Error("Development seeding requires PLAUD_MIRROR_STATE_POLICY=isolated");
  }
  const manifestPath = process.env.PLAUD_MIRROR_DEVELOPMENT_SAMPLES?.trim();
  if (!manifestPath) {
    throw new Error("PLAUD_MIRROR_DEVELOPMENT_SAMPLES is required");
  }
  const environment = loadServerEnvironment();
  const result = await seedDevelopmentSamples({
    manifestPath,
    dataDir: environment.dataDir,
    recordingsDir: environment.recordingsDir,
    defaultSyncLimit: environment.defaultSyncLimit,
  });
  process.stdout.write(
    `Development samples ready: ${result.inserted} seeded, ${result.retired} retired, ${result.total} active\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
