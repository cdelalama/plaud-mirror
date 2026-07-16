import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, link, mkdir, open, rename, stat, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import { buildDownloadFilename, type RecordingMirror } from "@plaud-mirror/shared";

import type { MediaArtifactRecord } from "./store.js";

export async function pinRecordingArtifact(
  recording: RecordingMirror,
  recordingsDir: string,
): Promise<MediaArtifactRecord> {
  if (!recording.localPath) {
    throw new Error(`Recording ${recording.id} has no local audio path`);
  }
  const sourcePath = isAbsolute(recording.localPath)
    ? recording.localPath
    : resolve(process.cwd(), recording.localPath);
  assertPathInsideRecordings(sourcePath, recordingsDir);

  const source = await stat(sourcePath);
  if (!source.isFile() || source.size <= 0) {
    throw new Error(`Recording ${recording.id} audio is missing or empty`);
  }
  if (recording.bytesWritten > 0 && source.size !== recording.bytesWritten) {
    throw new Error(
      `Recording ${recording.id} audio size changed: expected ${recording.bytesWritten}, found ${source.size}`,
    );
  }

  const sha256 = await hashFile(sourcePath);
  const pinDirectory = join(resolve(recordingsDir), ".delivery-artifacts");
  const pinnedPath = join(pinDirectory, sha256);
  await mkdir(pinDirectory, { recursive: true });
  await ensurePinnedCopy(sourcePath, pinnedPath, source.size);

  return {
    sha256,
    path: pinnedPath,
    bytes: source.size,
    contentType: normalizeAudioContentType(recording.contentType, recording.localPath),
    filename: buildDownloadFilename(recording.title, recording.localPath, recording.id),
    durationSeconds: Math.max(recording.durationSeconds, 0.001),
    createdAt: new Date().toISOString(),
  };
}

export async function removePinnedArtifact(path: string, recordingsDir: string): Promise<void> {
  assertPathInsideDeliveryArtifacts(path, recordingsDir);
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function verifyPinnedArtifact(artifact: MediaArtifactRecord): Promise<boolean> {
  try {
    const pinned = await stat(artifact.path);
    return pinned.isFile() && pinned.size === artifact.bytes && pinned.size > 0;
  } catch {
    return false;
  }
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

async function ensurePinnedCopy(sourcePath: string, pinnedPath: string, expectedBytes: number): Promise<void> {
  try {
    const existing = await stat(pinnedPath);
    if (!existing.isFile() || existing.size !== expectedBytes) {
      throw new Error(`Pinned artifact ${basename(pinnedPath)} has an unexpected size`);
    }
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  try {
    await link(sourcePath, pinnedPath);
    return;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      const existing = await stat(pinnedPath);
      if (existing.isFile() && existing.size === expectedBytes) {
        return;
      }
      throw new Error(`Pinned artifact ${basename(pinnedPath)} has an unexpected size`);
    }
    if (code !== "EXDEV" && code !== "EPERM" && code !== "EACCES") {
      throw error;
    }
  }

  const temporaryPath = join(dirname(pinnedPath), `.${basename(pinnedPath)}.${randomUUID()}.partial`);
  try {
    await copyFile(sourcePath, temporaryPath);
    const handle = await open(temporaryPath, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, pinnedPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

function assertPathInsideRecordings(path: string, recordingsDir: string): void {
  const root = resolve(recordingsDir);
  const candidate = resolve(path);
  const relativePath = relative(root, candidate);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Recording audio path escapes the configured recordings directory");
  }
}

function assertPathInsideDeliveryArtifacts(path: string, recordingsDir: string): void {
  const root = join(resolve(recordingsDir), ".delivery-artifacts");
  const candidate = resolve(path);
  const relativePath = relative(root, candidate);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Pinned artifact path escapes the delivery-artifacts directory");
  }
}

function normalizeAudioContentType(contentType: string | null, localPath: string): string {
  if (contentType?.startsWith("audio/")) {
    return contentType;
  }
  const extension = localPath.split(".").pop()?.toLowerCase();
  if (extension === "mp3") {
    return "audio/mpeg";
  }
  if (extension === "ogg") {
    return "audio/ogg";
  }
  if (extension === "wav") {
    return "audio/wav";
  }
  if (extension === "m4a") {
    return "audio/mp4";
  }
  throw new Error(`Recording artifact ${localPath} has no supported audio content type`);
}
