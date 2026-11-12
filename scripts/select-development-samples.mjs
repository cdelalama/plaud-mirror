#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { basename } from "node:path";

import Database from "better-sqlite3";

const DB_PATH = process.env.PLAUD_MIRROR_SAMPLE_DB ?? "/var/lib/plaud-mirror/data/app.db";
const TARGET_DURATIONS = [30, 300, 1800];

const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
const candidates = db.prepare(`
  SELECT id, title, created_at, duration_seconds, local_path, content_type, bytes_written
  FROM recordings
  WHERE dismissed = 0
    AND local_path IS NOT NULL
    AND bytes_written BETWEEN 100000 AND 20000000
  ORDER BY duration_seconds ASC, id ASC
`).all();
db.close();

if (candidates.length === 0) {
  throw new Error("Production runtime has no bounded recording candidates");
}

const selected = [];
for (const target of TARGET_DURATIONS) {
  const candidate = candidates.reduce((best, item) => (
    Math.abs(item.duration_seconds - target) < Math.abs(best.duration_seconds - target)
      ? item
      : best
  ));
  if (!selected.some((item) => item.id === candidate.id)) selected.push(candidate);
}

const samples = [];
for (const candidate of selected) {
  const filename = basename(candidate.local_path);
  const digest = await sha256(candidate.local_path);
  samples.push({
    id: candidate.id,
    title: candidate.title,
    createdAt: candidate.created_at,
    durationSeconds: candidate.duration_seconds,
    relativePath: `${candidate.id}/${filename}`,
    contentType: contentTypeFor(filename, candidate.content_type),
    bytes: candidate.bytes_written,
    sha256: digest,
  });
}

process.stdout.write(`${JSON.stringify({
  schema: "plaud-mirror.development-samples.v1",
  generatedAt: new Date().toISOString(),
  source: "nas-production-sample",
  samples,
}, null, 2)}\n`);

function contentTypeFor(filename, stored) {
  if (filename.toLowerCase().endsWith(".ogg")) return "audio/ogg";
  if (filename.toLowerCase().endsWith(".mp3")) return "audio/mpeg";
  if (filename.toLowerCase().endsWith(".m4a")) return "audio/mp4";
  return stored === "binary/octet-stream" ? "application/octet-stream" : stored;
}

function sha256(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
