// Pure formatting helpers shared between `apps/web` (UI) and, where useful,
// `apps/api` (server-produced filenames and similar string ops). Kept in
// `packages/shared` so they can be exercised by `node --test` alongside the
// rest of the backend suite without pulling in a React test runner.
//
// No side effects, no DOM, no fetch. Every function here must be
// deterministic given its inputs.

import type { Device, ServiceHealth, SyncRunSummary } from "./runtime.js";

/**
 * Render a recording's duration as a human string.
 * - < 1 minute:      "42s"
 * - < 1 hour:        "3:45"
 * - >= 1 hour:       "1:02:45"
 * Non-finite or negative input is normalised to 0.
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "0s";
  }
  const total = Math.round(totalSeconds);
  if (total < 60) {
    return `${total}s`;
  }
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hours === 0) {
    return `${minutes}:${pad(seconds)}`;
  }
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

/**
 * Hero-metric line: "local / remote" when both are known, just local
 * otherwise. Renders `remoteTotal === null` as the local count alone (we
 * have no authoritative remote figure yet, typically pre-first-sync).
 */
export function formatRecordingsMetric(
  localCount: number,
  remoteTotal: number | null,
): string {
  if (remoteTotal === null) {
    return String(localCount);
  }
  return `${localCount} / ${remoteTotal}`;
}

/**
 * "Missing recordings" figure for the Manual sync card. plaudTotal at the
 * last sync minus what we have locally (mirrored + dismissed). Reads from
 * the health payload directly so callers don't rewire the shape.
 *
 * If plaudTotal is stale (Plaud deleted a recording after our last sync),
 * the arithmetic can go negative; we clamp and surface the staleness in
 * the rendered text rather than showing a misleading minus number.
 */
export function computeMissing(health: ServiceHealth | null): string {
  const plaudTotal = health?.lastSync?.plaudTotal ?? null;
  if (plaudTotal === null) {
    return "unknown until first sync";
  }
  const mirrored = health?.recordingsCount ?? 0;
  const dismissed = health?.dismissedCount ?? 0;
  const missing = plaudTotal - mirrored - dismissed;
  if (missing < 0) {
    return "0 (last sync may be stale)";
  }
  return String(missing);
}

/**
 * Dropdown label for a device in the backfill form. Prefers the
 * operator-set nickname (usually short and unique: "Office", "Travel"),
 * falls back to "PLAUD <model>" when the nickname is empty, or a serial
 * slug "PLAUD-<tail6>" when neither is available.
 *
 * Always appends `(#tail6)` so two devices sharing a nickname can still be
 * disambiguated by their last 6 serial chars.
 */
export function formatDeviceLabel(device: Device): string {
  const tail = device.serialNumber.length > 6
    ? device.serialNumber.slice(-6)
    : device.serialNumber;
  const tailSuffix = ` (#${tail})`;
  if (device.displayName) {
    return device.model
      ? `${device.displayName} — ${device.model}${tailSuffix}`
      : `${device.displayName}${tailSuffix}`;
  }
  if (device.model) {
    return `PLAUD ${device.model}${tailSuffix}`;
  }
  return `PLAUD-${tail}`;
}

/**
 * Short display for a device inside dense UI (e.g. a table row). Drops the
 * tail suffix and model to save space, preferring just the nickname.
 * Falls back to "PLAUD <model>" or "PLAUD-<tail6>" when neither is set,
 * and "—" for a null serial (loose recording with no device reference).
 */
export function formatDeviceShortName(
  serialNumber: string | null,
  catalog: Map<string, Device>,
): string {
  if (!serialNumber) {
    return "—";
  }
  const tail = serialNumber.length > 6 ? serialNumber.slice(-6) : serialNumber;
  const device = catalog.get(serialNumber);
  if (device?.displayName) {
    return device.displayName;
  }
  if (device?.model) {
    return `PLAUD ${device.model}`;
  }
  return `PLAUD-${tail}`;
}

/**
 * Parse a string form input as a non-negative integer, returning the
 * fallback when the value is not a valid integer >= 0. Used by the sync
 * limit input — `limit=0` is legal (refresh only, no download), but an
 * empty input means "operator cleared the field, use the default" rather
 * than "limit=0", since `Number("")` is 0 and that JS quirk would silently
 * downgrade clears to refresh-only runs.
 */
export function coerceNonNegativeInteger(value: string, fallback: number): number {
  if (value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * One-line sync-run summary for banner display: "Sync: completed, matched 5,
 * downloaded 5, delivered 0". `label` is the user-facing mode name
 * ("Sync" / "Backfill" / "").
 */
export function summarizeRun(label: string, summary: SyncRunSummary): string {
  const prefix = label ? `${label}: ` : "";
  return `${prefix}${summary.status}, matched ${summary.matched}, downloaded ${summary.downloaded}, delivered ${summary.delivered}`;
}

/**
 * Live-progress banner text while a sync run is in flight. Reads the
 * in-flight `activeRun` from health and surfaces `downloaded X of Y` style
 * progress. Returns a generic "Working…" message when the banner is
 * visible for other reasons (token save, restore, delete).
 */
export function describeBusy(
  activeRunId: string | null,
  activeRun: SyncRunSummary | null,
): string {
  if (activeRunId && activeRun?.id === activeRunId && activeRun.status === "running") {
    const matched = activeRun.matched;
    const downloaded = activeRun.downloaded;
    const examined = activeRun.examined;
    const plaudTotal = activeRun.plaudTotal;
    if (matched > 0) {
      return `Sync running: downloaded ${downloaded} of ${matched} candidates so far (examined ${examined}${plaudTotal ? ` / ${plaudTotal} in Plaud` : ""}).`;
    }
    if (examined > 0) {
      return `Sync running: examined ${examined}${plaudTotal ? ` / ${plaudTotal} in Plaud` : ""}, picking candidates…`;
    }
    return "Sync running: fetching Plaud listing…";
  }
  return "Working… the panel will refresh when the operation completes.";
}

/**
 * Build a safe download filename for a mirrored recording. The browser's
 * default behaviour on `<audio controls>` → "More options" → "Download"
 * uses the URL's last path segment when no `Content-Disposition` header
 * is present; our endpoint ends with `/audio` so every download landed as
 * a file literally named `audio` with no extension.
 *
 * Strategy:
 *  - Extension is read from `localPath` (what we actually wrote to disk,
 *    so it always matches the bytes Plaud served).
 *  - Base name comes from `title` if available, sanitised to
 *    `[A-Za-z0-9_.-]` (collapsing repeats, trimming length to 80 chars).
 *  - Empty / whitespace-only titles fall back to the recording id.
 */
export function buildDownloadFilename(
  title: string | null | undefined,
  localPath: string | null | undefined,
  id: string,
): string {
  const ext = extractExtension(localPath);
  const rawBase = (title ?? "").trim() || id;
  const sanitised = sanitiseFilenameBase(rawBase);
  // Fallback if sanitisation stripped everything (e.g. title was pure
  // punctuation that all mapped to `_`, then collapsed and trimmed away).
  const base = sanitised || id;
  return ext ? `${base}${ext}` : base;
}

function extractExtension(localPath: string | null | undefined): string {
  if (!localPath) {
    return "";
  }
  const lastDot = localPath.lastIndexOf(".");
  const lastSep = Math.max(localPath.lastIndexOf("/"), localPath.lastIndexOf("\\"));
  if (lastDot === -1 || lastDot <= lastSep) {
    return "";
  }
  const ext = localPath.slice(lastDot);
  // Reject pathological extensions with non-ASCII letters; trust simple
  // alphanumeric ones we've actually seen from Plaud (mp3, ogg, m4a, wav).
  return /^\.[A-Za-z0-9]{1,8}$/.test(ext) ? ext.toLowerCase() : "";
}

function sanitiseFilenameBase(raw: string): string {
  // Whitespace-only remains empty after replacement; drop the leading
  // dot trick that could create dotfiles.
  const replaced = raw.replace(/[^A-Za-z0-9_.-]+/g, "_");
  const collapsed = replaced.replace(/_{2,}/g, "_");
  const trimmed = collapsed.replace(/^[._-]+|[._-]+$/g, "");
  if (!trimmed) {
    return "";
  }
  return trimmed.length > 80 ? trimmed.slice(0, 80) : trimmed;
}
