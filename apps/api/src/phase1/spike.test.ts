import test from "node:test";
import assert from "node:assert/strict";

import type { PlaudRawRecording } from "@plaud-mirror/shared";

import {
  applyLocalFilters,
  buildFilterRecommendations,
  buildRecordingStats,
  loadSpikeEnvironment,
  resolveAudioExtension,
} from "./spike.js";

function createRecording(overrides: Partial<PlaudRawRecording> = {}): PlaudRawRecording {
  return {
    id: "rec-1",
    filename: "Weekly sync",
    fullname: "Weekly sync",
    filesize: 2048,
    file_md5: "",
    start_time: 1713780000000,
    end_time: 1713780300000,
    duration: 300000,
    version: 1,
    version_ms: 1,
    edit_time: 1713780400000,
    is_trash: false,
    is_trans: true,
    is_summary: false,
    serial_number: "PLAUD-1",
    filetype: "m4a",
    timezone: 0,
    zonemins: 0,
    scene: 7,
    filetag_id_list: [],
    is_markmemo: false,
    wait_pull: 0,
    ...overrides,
  };
}

test("loadSpikeEnvironment trims token and keeps optional api base", () => {
  const environment = loadSpikeEnvironment({
    PLAUD_MIRROR_ACCESS_TOKEN: "  token-value  ",
    PLAUD_MIRROR_API_BASE: " https://api-apne1.plaud.ai ",
  });

  assert.deepEqual(environment, {
    accessToken: "token-value",
    apiBase: "https://api-apne1.plaud.ai",
  });
});

test("loadSpikeEnvironment rejects missing tokens", () => {
  assert.throws(
    () => loadSpikeEnvironment({}),
    /PLAUD_MIRROR_ACCESS_TOKEN is required/,
  );
});

test("applyLocalFilters honors date range, serial number, and scene", () => {
  const recordings = [
    createRecording({
      id: "rec-1",
      start_time: 1713780000000,
      serial_number: "PLAUD-1",
      scene: 7,
    }),
    createRecording({
      id: "rec-2",
      start_time: 1713866400000,
      serial_number: "PLAUD-2",
      scene: 9,
    }),
  ];

  const filtered = applyLocalFilters(recordings, {
    limit: 100,
    from: 1713780000000,
    to: 1713800000000,
    serialNumber: "PLAUD-1",
    scene: 7,
    recordingsDir: "recordings",
    reportPath: ".state/phase1/latest-report.json",
  });

  assert.deepEqual(filtered.map((recording) => recording.id), ["rec-1"]);
});

test("buildRecordingStats handles empty filtered sets", () => {
  const stats = buildRecordingStats([createRecording()], []);

  assert.equal(stats.examined, 1);
  assert.equal(stats.matched, 0);
  assert.equal(stats.earliestStartTime, null);
  assert.equal(stats.latestStartTime, null);
  assert.equal(stats.averageDurationSeconds, 0);
  assert.equal(stats.totalFilesizeBytes, 0);
});

test("buildFilterRecommendations reflects sampled metadata availability", () => {
  const emptyRecommendations = buildFilterRecommendations([]);
  assert.equal(emptyRecommendations.find((entry) => entry.id === "date_range")?.supported, true);
  assert.match(
    emptyRecommendations.find((entry) => entry.id === "date_range")?.reason ?? "",
    /No recordings returned yet/,
  );

  const populatedRecommendations = buildFilterRecommendations([
    createRecording({ serial_number: "PLAUD-1", scene: 7 }),
    createRecording({ id: "rec-2", serial_number: "PLAUD-2", scene: 9, is_trash: true }),
  ]);

  assert.equal(populatedRecommendations.find((entry) => entry.id === "serial_number")?.supported, true);
  assert.match(
    populatedRecommendations.find((entry) => entry.id === "scene")?.reason ?? "",
    /scene values observed/,
  );
  assert.equal(populatedRecommendations.find((entry) => entry.id === "trash_state")?.supported, true);
});

test("resolveAudioExtension prefers the url suffix and falls back to content type", () => {
  assert.equal(
    resolveAudioExtension("https://storage.example.com/audio/file.MP3?signature=1", "audio/mpeg"),
    ".mp3",
  );
  assert.equal(
    resolveAudioExtension("https://storage.example.com/audio/file", "audio/x-m4a"),
    ".m4a",
  );
  assert.equal(
    resolveAudioExtension("https://storage.example.com/audio/file", null),
    ".bin",
  );
});
