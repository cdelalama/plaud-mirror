import assert from "node:assert/strict";
import test from "node:test";

import { buildPlaudMirrorProtocolStatus, PLAUD_MIRROR_SYNC_JOB_ID } from "./protocol-status.js";
import type { ServiceHealth } from "@plaud-mirror/shared";

function createHealth(overrides: Partial<ServiceHealth> = {}): ServiceHealth {
  const base: ServiceHealth = {
    version: "0.10.0-test",
    phase: "Phase 2 - first usable slice",
    auth: {
      mode: "manual-token",
      configured: true,
      state: "healthy",
      resolvedApiBase: "https://api-euc1.plaud.ai",
      lastValidatedAt: "2026-06-21T10:00:00.000Z",
      lastError: null,
      userSummary: { email: "operator@example.com" },
    },
    lastSync: {
      id: "run-1",
      mode: "sync",
      status: "completed",
      startedAt: "2026-06-21T10:01:00.000Z",
      finishedAt: "2026-06-21T10:02:00.000Z",
      examined: 10,
      matched: 2,
      downloaded: 2,
      delivered: 0,
      enqueued: 0,
      skipped: 0,
      failed: 0,
      plaudTotal: 10,
      filters: { limit: 2, forceDownload: false },
      error: null,
    },
    activeRun: null,
    scheduler: {
      enabled: false,
      intervalMs: 0,
      nextTickAt: null,
      lastTickAt: null,
      lastTickStatus: null,
      lastTickError: null,
    },
    outbox: {
      pending: 0,
      delivering: 0,
      retryWaiting: 0,
      permanentlyFailed: 0,
      oldestPendingAgeMs: null,
    },
    lastErrors: [],
    recentSyncRuns: [],
    recordingsCount: 10,
    dismissedCount: 0,
    coverage: {
      observedAt: "2026-06-21T10:02:00.000Z",
      remoteTotal: 10,
      mirrored: 10,
      dismissed: 0,
      missing: 0,
      localOnly: 0,
      upstreamDeleted: 0,
    },
    webhookConfigured: false,
    warnings: [],
  };

  return { ...base, ...overrides };
}

test("buildPlaudMirrorProtocolStatus maps healthy complete sync to ok snapshot", () => {
  const snapshot = buildPlaudMirrorProtocolStatus(createHealth());

  assert.equal(snapshot.job_id, PLAUD_MIRROR_SYNC_JOB_ID);
  assert.equal(snapshot.observed_at, "2026-06-21T10:02:00.000Z");
  assert.equal(snapshot.condition, "ok");
  assert.equal(snapshot.severity, "none");
  assert.deepEqual(snapshot.counts, {
    plaud_total: 10,
    mirrored: 10,
    dismissed: 0,
    missing: 0,
    local_only: 0,
    upstream_deleted: 0,
  });
});

test("buildPlaudMirrorProtocolStatus publishes scheduler-owned next_run_at", () => {
  const snapshot = buildPlaudMirrorProtocolStatus(createHealth({
    scheduler: {
      enabled: true,
      intervalMs: 900_000,
      nextTickAt: "2026-06-21T10:17:00.000Z",
      lastTickAt: "2026-06-21T10:02:00.000Z",
      lastTickStatus: "completed",
      lastTickError: null,
    },
  }));

  assert.equal(snapshot.next_run_at, "2026-06-21T10:17:00.000Z");
});

test("buildPlaudMirrorProtocolStatus omits next_run_at when scheduler has no plan", () => {
  const snapshot = buildPlaudMirrorProtocolStatus(createHealth());

  assert.equal("next_run_at" in snapshot, false);
});

test("buildPlaudMirrorProtocolStatus excludes tombstones from remote coverage", () => {
  const snapshot = buildPlaudMirrorProtocolStatus(createHealth({
    recordingsCount: 10,
    dismissedCount: 1,
    coverage: {
      observedAt: "2026-06-21T10:02:00.000Z",
      remoteTotal: 11,
      mirrored: 10,
      dismissed: 0,
      missing: 1,
      localOnly: 0,
      upstreamDeleted: 1,
    },
  }));

  assert.equal(snapshot.condition, "degraded");
  assert.equal((snapshot.counts as { missing: number }).missing, 1);
  assert.equal((snapshot.counts as { upstream_deleted: number }).upstream_deleted, 1);
});

test("buildPlaudMirrorProtocolStatus degrades when Plaud auth is unhealthy", () => {
  const snapshot = buildPlaudMirrorProtocolStatus(createHealth({
    auth: {
      mode: "manual-token",
      configured: true,
      state: "invalid",
      resolvedApiBase: "https://api-euc1.plaud.ai",
      lastValidatedAt: "2026-06-21T10:00:00.000Z",
      lastError: "Plaud GET /user/me failed with HTTP 403",
      userSummary: null,
    },
  }));

  assert.equal(snapshot.condition, "degraded");
  assert.equal(snapshot.severity, "warning");
  assert.ok(snapshot.summary.includes("auth is invalid"));
});

test("buildPlaudMirrorProtocolStatus does not publish raw sync errors", () => {
  const snapshot = buildPlaudMirrorProtocolStatus(createHealth({
    lastSync: {
      id: "run-failed",
      mode: "sync",
      status: "failed",
      startedAt: "2026-06-21T10:01:00.000Z",
      finishedAt: "2026-06-21T10:02:00.000Z",
      examined: 10,
      matched: 2,
      downloaded: 1,
      delivered: 0,
      enqueued: 0,
      skipped: 0,
      failed: 1,
      plaudTotal: 10,
      filters: { limit: 2, forceDownload: false },
      error: "secret-bearing upstream body token=abc123",
    },
  }));

  const latestSync = snapshot.latest_sync as { error_present: boolean };
  assert.equal(snapshot.condition, "degraded");
  assert.equal(latestSync.error_present, true);
  assert.equal(JSON.stringify(snapshot).includes("abc123"), false);
});

test("buildPlaudMirrorProtocolStatus preserves active-run progress", () => {
  const snapshot = buildPlaudMirrorProtocolStatus(createHealth({
    activeRun: {
      id: "run-active",
      mode: "sync",
      status: "running",
      startedAt: "2026-06-21T10:05:00.000Z",
      finishedAt: null,
      examined: 100,
      matched: 25,
      downloaded: 4,
      delivered: 0,
      enqueued: 0,
      skipped: 0,
      failed: 0,
      plaudTotal: 100,
      filters: { limit: 25, forceDownload: false },
      error: null,
    },
  }));

  assert.equal(snapshot.observed_at, "2026-06-21T10:05:00.000Z");
  assert.deepEqual(snapshot.active_sync, {
    id: "run-active",
    mode: "sync",
    started_at: "2026-06-21T10:05:00.000Z",
    examined: 100,
    matched: 25,
    downloaded: 4,
  });
});
