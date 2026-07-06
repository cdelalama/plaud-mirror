import {
  ProtocolStatusSnapshotSchema,
  type ProtocolSeverity,
  type ProtocolStatusCheck,
  type ProtocolStatusSnapshot,
  type ServiceHealth,
} from "@plaud-mirror/shared";

export const PLAUD_MIRROR_SYNC_JOB_ID = "plaud-mirror-recordings-sync";

const severityRank: Record<ProtocolSeverity, number> = {
  none: 0,
  info: 1,
  watch: 2,
  warning: 3,
  critical: 4,
};

export function buildPlaudMirrorProtocolStatus(
  health: ServiceHealth,
  nowIso = new Date().toISOString(),
): ProtocolStatusSnapshot {
  const plaudTotal = health.lastSync?.plaudTotal ?? null;
  const missingCount = plaudTotal === null
    ? null
    : Math.max(0, plaudTotal - health.recordingsCount - health.dismissedCount);
  const observedAt = health.activeRun?.startedAt
    ?? health.lastSync?.finishedAt
    ?? health.auth.lastValidatedAt
    ?? nowIso;

  const checks: ProtocolStatusCheck[] = [
    buildAuthCheck(health),
    buildSyncCheck(health),
    buildCoverageCheck(plaudTotal, health.recordingsCount, health.dismissedCount, missingCount),
    buildSchedulerCheck(health),
    buildOutboxCheck(health),
  ];

  const severity = maxSeverity(checks);
  const condition = severityRank[severity] >= severityRank.watch ? "degraded" : "ok";
  const summary = buildSummary(health, plaudTotal, missingCount);

  return ProtocolStatusSnapshotSchema.parse({
    observed_at: observedAt,
    condition,
    severity,
    summary,
    project: "plaud-mirror",
    job_id: PLAUD_MIRROR_SYNC_JOB_ID,
    version: health.version,
    source: {
      kind: "plaud",
      authority: "external",
    },
    counts: {
      plaud_total: plaudTotal,
      mirrored: health.recordingsCount,
      dismissed: health.dismissedCount,
      missing: missingCount,
    },
    latest_sync: health.lastSync
      ? {
          id: health.lastSync.id,
          mode: health.lastSync.mode,
          status: health.lastSync.status,
          started_at: health.lastSync.startedAt,
          finished_at: health.lastSync.finishedAt,
          examined: health.lastSync.examined,
          matched: health.lastSync.matched,
          downloaded: health.lastSync.downloaded,
          enqueued: health.lastSync.enqueued,
          skipped: health.lastSync.skipped,
          error_present: Boolean(health.lastSync.error),
        }
      : null,
    active_sync: health.activeRun
      ? {
          id: health.activeRun.id,
          mode: health.activeRun.mode,
          started_at: health.activeRun.startedAt,
          examined: health.activeRun.examined,
          matched: health.activeRun.matched,
          downloaded: health.activeRun.downloaded,
        }
      : null,
    scheduler: {
      enabled: health.scheduler.enabled,
      interval_ms: health.scheduler.intervalMs,
      next_tick_at: health.scheduler.nextTickAt,
      last_tick_at: health.scheduler.lastTickAt,
      last_tick_status: health.scheduler.lastTickStatus,
      last_tick_error_present: Boolean(health.scheduler.lastTickError),
    },
    outbox: {
      webhook_configured: health.webhookConfigured,
      pending: health.outbox.pending,
      retry_waiting: health.outbox.retryWaiting,
      permanently_failed: health.outbox.permanentlyFailed,
      oldest_pending_age_ms: health.outbox.oldestPendingAgeMs,
    },
    checks,
  });
}

function buildAuthCheck(health: ServiceHealth): ProtocolStatusCheck {
  if (health.auth.state === "healthy") {
    return {
      name: "plaud-auth",
      condition: "ok",
      severity: "none",
      summary: "Plaud bearer is configured and validates successfully.",
    };
  }

  return {
    name: "plaud-auth",
    condition: health.auth.configured ? "degraded" : "down",
    severity: health.auth.configured ? "warning" : "critical",
    summary: health.auth.configured
      ? `Plaud auth is ${health.auth.state}; sync cannot be trusted until re-auth succeeds.`
      : "No Plaud bearer is configured; sync cannot run.",
  };
}

function buildSyncCheck(health: ServiceHealth): ProtocolStatusCheck {
  if (health.activeRun) {
    return {
      name: "latest-sync",
      condition: "ok",
      severity: "none",
      summary: `Sync ${health.activeRun.id} is running; downloaded ${health.activeRun.downloaded}/${health.activeRun.matched}.`,
    };
  }

  if (!health.lastSync) {
    return {
      name: "latest-sync",
      condition: "degraded",
      severity: "watch",
      summary: "No completed Plaud sync run has been recorded yet.",
    };
  }

  if (health.lastSync.status === "failed") {
    return {
      name: "latest-sync",
      condition: "degraded",
      severity: "warning",
      summary: "Latest Plaud sync failed; see the authenticated operator panel for details.",
    };
  }

  return {
    name: "latest-sync",
    condition: "ok",
    severity: "none",
    summary: `Latest Plaud sync completed; downloaded ${health.lastSync.downloaded}/${health.lastSync.matched}.`,
  };
}

function buildCoverageCheck(
  plaudTotal: number | null,
  mirrored: number,
  dismissed: number,
  missing: number | null,
): ProtocolStatusCheck {
  if (plaudTotal === null || missing === null) {
    return {
      name: "coverage",
      condition: "degraded",
      severity: "watch",
      summary: "Plaud total is unknown until a sync or refresh has completed.",
    };
  }

  if (missing > 0) {
    return {
      name: "coverage",
      condition: "degraded",
      severity: "watch",
      summary: `${missing} Plaud recording(s) are not mirrored locally.`,
    };
  }

  return {
    name: "coverage",
    condition: "ok",
    severity: "none",
    summary: `Local mirror covers ${mirrored}/${plaudTotal} Plaud recording(s), with ${dismissed} dismissed.`,
  };
}

function buildSchedulerCheck(health: ServiceHealth): ProtocolStatusCheck {
  if (!health.scheduler.enabled) {
    return {
      name: "scheduler",
      condition: "ok",
      severity: "none",
      summary: "Scheduler is disabled; the protocol job currently reflects manual/operator-triggered sync.",
    };
  }

  if (health.scheduler.lastTickStatus === "failed") {
    return {
      name: "scheduler",
      condition: "degraded",
      severity: "warning",
      summary: "Scheduler tick failed; see the authenticated operator panel for details.",
    };
  }

  return {
    name: "scheduler",
    condition: "ok",
    severity: "none",
    summary: `Scheduler is enabled every ${Math.round(health.scheduler.intervalMs / 60_000)} minute(s).`,
  };
}

function buildOutboxCheck(health: ServiceHealth): ProtocolStatusCheck {
  if (health.outbox.permanentlyFailed > 0) {
    return {
      name: "webhook-outbox",
      condition: "degraded",
      severity: "warning",
      summary: `${health.outbox.permanentlyFailed} webhook outbox item(s) are permanently failed.`,
    };
  }

  if (!health.webhookConfigured) {
    return {
      name: "webhook-outbox",
      condition: "ok",
      severity: "none",
      summary: "Webhook is not configured; mirrored recordings stay local and no downstream delivery is expected.",
    };
  }

  return {
    name: "webhook-outbox",
    condition: "ok",
    severity: "none",
    summary: `Webhook outbox has ${health.outbox.pending} pending, ${health.outbox.delivering} delivering, and ${health.outbox.retryWaiting} retry-waiting item(s).`,
  };
}

function maxSeverity(checks: ProtocolStatusCheck[]): ProtocolSeverity {
  return checks.reduce<ProtocolSeverity>((current, check) => {
    const next = check.severity ?? "none";
    return severityRank[next] > severityRank[current] ? next : current;
  }, "none");
}

function buildSummary(
  health: ServiceHealth,
  plaudTotal: number | null,
  missing: number | null,
): string {
  if (health.auth.state !== "healthy") {
    return `Plaud Mirror sync degraded: Plaud auth is ${health.auth.state}.`;
  }

  if (health.activeRun) {
    return `Plaud Mirror sync running: downloaded ${health.activeRun.downloaded}/${health.activeRun.matched}.`;
  }

  if (!health.lastSync) {
    return "Plaud Mirror sync has not completed a run yet.";
  }

  if (health.lastSync.status === "failed") {
    return "Plaud Mirror latest sync failed; operator details are available in the authenticated panel.";
  }

  if (missing !== null && missing > 0) {
    return `Plaud Mirror sync completed, but ${missing} recording(s) are still missing locally.`;
  }

  const denominator = plaudTotal ?? health.recordingsCount;
  return `Plaud Mirror sync ok: ${health.recordingsCount}/${denominator} recording(s) mirrored.`;
}
