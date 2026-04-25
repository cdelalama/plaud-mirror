import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDownloadFilename,
  coerceNonNegativeInteger,
  computeMissing,
  describeBusy,
  formatBytes,
  formatDeviceLabel,
  formatDeviceShortName,
  formatDuration,
  formatRecordingsMetric,
  summarizeRun,
} from "./formatting.js";
import type { Device, ServiceHealth, SyncRunSummary } from "./runtime.js";

test("formatDuration buckets short / medium / long durations", () => {
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatDuration(42), "42s");
  assert.equal(formatDuration(59.4), "59s");
  assert.equal(formatDuration(60), "1:00");
  assert.equal(formatDuration(185), "3:05");
  assert.equal(formatDuration(3599), "59:59");
  assert.equal(formatDuration(3600), "1:00:00");
  assert.equal(formatDuration(3665), "1:01:05");
  assert.equal(formatDuration(36000), "10:00:00");
});

test("formatDuration normalises invalid inputs to zero", () => {
  assert.equal(formatDuration(Number.NaN), "0s");
  assert.equal(formatDuration(Number.POSITIVE_INFINITY), "0s");
  assert.equal(formatDuration(-5), "0s");
});

test("formatBytes scales up through KB/MB/GB and rejects non-positive", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(-100), "0 B");
  assert.equal(formatBytes(Number.NaN), "0 B");
  assert.equal(formatBytes(500), "500 B");
  assert.equal(formatBytes(1024), "1.0 KB");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(1024 * 1024), "1.0 MB");
  assert.equal(formatBytes(5_500_000), "5.2 MB");
  assert.equal(formatBytes(1024 * 1024 * 1024), "1.0 GB");
});

test("formatRecordingsMetric shows local/remote when both are known", () => {
  assert.equal(formatRecordingsMetric(10, null), "10");
  assert.equal(formatRecordingsMetric(215, 308), "215 / 308");
  assert.equal(formatRecordingsMetric(0, 0), "0 / 0");
});

test("computeMissing clamps negative arithmetic and surfaces staleness", () => {
  const withPlaudTotal = (plaudTotal: number | null, recordingsCount: number, dismissedCount: number): ServiceHealth => ({
    version: "test",
    phase: "Phase 2",
    auth: {
      mode: "manual-token",
      configured: true,
      state: "healthy",
      resolvedApiBase: null,
      lastValidatedAt: null,
      lastError: null,
      userSummary: null,
    },
    lastSync: plaudTotal === null ? null : {
      id: "run-1",
      mode: "sync",
      status: "completed",
      startedAt: "2026-04-24T10:00:00.000Z",
      finishedAt: "2026-04-24T10:01:00.000Z",
      examined: plaudTotal,
      matched: 0,
      downloaded: 0,
      delivered: 0,
      skipped: 0,
      plaudTotal,
      filters: { limit: 0, forceDownload: false },
      error: null,
    },
    activeRun: null,
    recordingsCount,
    dismissedCount,
    webhookConfigured: false,
    warnings: [],
  });

  assert.equal(computeMissing(null), "unknown until first sync");
  assert.equal(computeMissing(withPlaudTotal(null, 10, 0)), "unknown until first sync");
  assert.equal(computeMissing(withPlaudTotal(308, 215, 0)), "93");
  assert.equal(computeMissing(withPlaudTotal(308, 215, 12)), "81");
  // plaud deleted a recording after our last sync → arithmetic goes negative.
  assert.equal(computeMissing(withPlaudTotal(10, 20, 0)), "0 (last sync may be stale)");
});

test("formatDeviceLabel prefers nickname with model tail, falls back sensibly", () => {
  const base: Device = {
    serialNumber: "PLAUD-ABCDEF123456",
    displayName: "",
    model: "",
    firmwareVersion: null,
    lastSeenAt: "2026-04-24T10:00:00.000Z",
  };
  assert.equal(
    formatDeviceLabel({ ...base, displayName: "Office", model: "888" }),
    "Office — 888 (#123456)",
  );
  assert.equal(
    formatDeviceLabel({ ...base, displayName: "Office", model: "" }),
    "Office (#123456)",
  );
  assert.equal(
    formatDeviceLabel({ ...base, displayName: "", model: "888" }),
    "PLAUD 888 (#123456)",
  );
  assert.equal(
    formatDeviceLabel({ ...base, displayName: "", model: "" }),
    "PLAUD-123456",
  );
  // Serial shorter than 6 chars (unlikely but possible) uses the whole thing.
  assert.equal(
    formatDeviceLabel({ ...base, serialNumber: "SN12", displayName: "Tiny", model: "" }),
    "Tiny (#SN12)",
  );
});

test("formatDeviceShortName uses the catalog and falls back for unknown serials", () => {
  const catalog = new Map<string, Device>([
    [
      "PLAUD-ABCDEF123456",
      {
        serialNumber: "PLAUD-ABCDEF123456",
        displayName: "Office",
        model: "888",
        firmwareVersion: null,
        lastSeenAt: "2026-04-24T10:00:00.000Z",
      },
    ],
    [
      "PLAUD-NONAMED000001",
      {
        serialNumber: "PLAUD-NONAMED000001",
        displayName: "",
        model: "888",
        firmwareVersion: null,
        lastSeenAt: "2026-04-24T10:00:00.000Z",
      },
    ],
  ]);
  assert.equal(formatDeviceShortName("PLAUD-ABCDEF123456", catalog), "Office");
  assert.equal(formatDeviceShortName("PLAUD-NONAMED000001", catalog), "PLAUD 888");
  // Unknown serial → "PLAUD-<last-6-chars>".
  assert.equal(formatDeviceShortName("PLAUD-NOTINCATALOG00", catalog), "PLAUD-ALOG00");
  assert.equal(formatDeviceShortName("PLAUD-UNKNOWN456789", catalog), "PLAUD-456789");
  assert.equal(formatDeviceShortName(null, catalog), "—");
});

test("coerceNonNegativeInteger accepts 0 and clamps invalid to fallback", () => {
  assert.equal(coerceNonNegativeInteger("0", 100), 0);
  assert.equal(coerceNonNegativeInteger("25", 100), 25);
  assert.equal(coerceNonNegativeInteger("1000", 100), 1000);
  assert.equal(coerceNonNegativeInteger("", 100), 100);
  assert.equal(coerceNonNegativeInteger("abc", 100), 100);
  assert.equal(coerceNonNegativeInteger("3.14", 100), 100);
  assert.equal(coerceNonNegativeInteger("-1", 100), 100);
});

test("summarizeRun prefixes with label when given, omits prefix when empty", () => {
  const summary: SyncRunSummary = {
    id: "run-1",
    mode: "sync",
    status: "completed",
    startedAt: "2026-04-24T10:00:00.000Z",
    finishedAt: "2026-04-24T10:01:00.000Z",
    examined: 308,
    matched: 5,
    downloaded: 5,
    delivered: 0,
    skipped: 0,
    plaudTotal: 308,
    filters: { limit: 5, forceDownload: false },
    error: null,
  };
  assert.equal(
    summarizeRun("Sync", summary),
    "Sync: completed, matched 5, downloaded 5, delivered 0",
  );
  assert.equal(
    summarizeRun("", summary),
    "completed, matched 5, downloaded 5, delivered 0",
  );
});

test("describeBusy returns progress text when run is live and generic text otherwise", () => {
  const live: SyncRunSummary = {
    id: "run-active",
    mode: "sync",
    status: "running",
    startedAt: "2026-04-24T10:00:00.000Z",
    finishedAt: null,
    examined: 308,
    matched: 25,
    downloaded: 7,
    delivered: 0,
    skipped: 0,
    plaudTotal: 308,
    filters: { limit: 25, forceDownload: false },
    error: null,
  };
  assert.equal(
    describeBusy("run-active", live),
    "Sync running: downloaded 7 of 25 candidates so far (examined 308 / 308 in Plaud).",
  );
  // Examined but no candidates matched yet.
  assert.match(
    describeBusy("run-active", { ...live, matched: 0, downloaded: 0 }),
    /picking candidates…/,
  );
  // Fresh start, nothing examined yet.
  assert.match(
    describeBusy("run-active", { ...live, matched: 0, downloaded: 0, examined: 0 }),
    /fetching Plaud listing…/,
  );
  // Mismatch: banner is visible but not because of this run (e.g. token save).
  assert.match(describeBusy(null, null), /Working…/);
  assert.match(describeBusy("run-active", { ...live, id: "other-run" }), /Working…/);
});

test("buildDownloadFilename derives extension from localPath and sanitises the title", () => {
  // Normal case: safe title + mp3 extension.
  assert.equal(
    buildDownloadFilename("Weekly meeting", "recordings/abc/audio.mp3", "abc"),
    "Weekly_meeting.mp3",
  );
  // Title with punctuation gets collapsed and trimmed of edges.
  assert.equal(
    buildDownloadFilename("Weekly/meeting:  notes!", "recordings/abc/audio.mp3", "abc"),
    "Weekly_meeting_notes.mp3",
  );
  // Accents and non-ASCII are replaced (conservative — avoids filesystem quirks).
  assert.equal(
    buildDownloadFilename("Reunión mañana", "recordings/abc/audio.mp3", "abc"),
    "Reuni_n_ma_ana.mp3",
  );
  // Empty / whitespace title falls back to the recording id.
  assert.equal(
    buildDownloadFilename("", "recordings/abc/audio.mp3", "abc"),
    "abc.mp3",
  );
  assert.equal(
    buildDownloadFilename("   ", "recordings/abc/audio.mp3", "abc"),
    "abc.mp3",
  );
  // Title that sanitises down to empty also falls back to id.
  assert.equal(
    buildDownloadFilename("!!!", "recordings/abc/audio.mp3", "abc-fallback"),
    "abc-fallback.mp3",
  );
  // Title longer than 80 chars is truncated.
  const longTitle = "a".repeat(120);
  const out = buildDownloadFilename(longTitle, "recordings/abc/audio.mp3", "abc");
  assert.equal(out.length, 80 + ".mp3".length);
  assert.equal(out.slice(-4), ".mp3");
});

test("buildDownloadFilename handles every extension we've actually seen from Plaud", () => {
  for (const ext of ["mp3", "ogg", "m4a", "wav"]) {
    assert.equal(
      buildDownloadFilename("clip", `recordings/x/audio.${ext}`, "x"),
      `clip.${ext}`,
    );
  }
  // Uppercase extensions are normalised to lowercase (predictability across OSes).
  assert.equal(
    buildDownloadFilename("clip", "recordings/x/audio.MP3", "x"),
    "clip.mp3",
  );
  // No extension on disk → no extension on download (still useful: the
  // contentType header will usually let the browser recognise the type).
  assert.equal(
    buildDownloadFilename("clip", "recordings/x/audio", "x"),
    "clip",
  );
  assert.equal(
    buildDownloadFilename("clip", null, "x"),
    "clip",
  );
  // Pathological extension rejected (not [A-Za-z0-9]{1,8}).
  assert.equal(
    buildDownloadFilename("clip", "recordings/x/audio.😀", "x"),
    "clip",
  );
});
