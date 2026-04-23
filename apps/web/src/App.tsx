import { FormEvent, useEffect, useState } from "react";

import type {
  AuthStatus,
  RecordingMirror,
  RuntimeConfig,
  ServiceHealth,
  SyncRunSummary,
} from "@plaud-mirror/shared";

interface ApiErrorResponse {
  message?: string;
}

interface BackfillDraft {
  from: string;
  to: string;
  serialNumber: string;
  scene: string;
  limit: string;
  forceDownload: boolean;
}

const DEFAULT_BACKFILL_DRAFT: BackfillDraft = {
  from: "",
  to: "",
  serialNumber: "",
  scene: "",
  limit: "100",
  forceDownload: false,
};

export function App() {
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [recordings, setRecordings] = useState<RecordingMirror[]>([]);
  const [tokenInput, setTokenInput] = useState("");
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [webhookSecretInput, setWebhookSecretInput] = useState("");
  const [backfill, setBackfill] = useState<BackfillDraft>(DEFAULT_BACKFILL_DRAFT);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [operationResult, setOperationResult] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<SyncRunSummary | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => {
    void refreshSnapshot();
  }, [showDismissed]);

  async function refreshSnapshot(): Promise<void> {
    setLoading(true);
    setOperationError(null);

    try {
      const recordingsQuery = showDismissed
        ? "/api/recordings?limit=50&includeDismissed=true"
        : "/api/recordings?limit=50";
      const [healthResponse, configResponse, authResponse, recordingsResponse] = await Promise.all([
        requestJson<ServiceHealth>("/api/health"),
        requestJson<RuntimeConfig>("/api/config"),
        requestJson<AuthStatus>("/api/auth/status"),
        requestJson<{ recordings: RecordingMirror[] }>(recordingsQuery),
      ]);

      setHealth(healthResponse);
      setConfig(configResponse);
      setAuth(authResponse);
      setRecordings(recordingsResponse.recordings);
      setWebhookUrlInput(configResponse.webhookUrl ?? "");
      setLastRun(healthResponse.lastSync);
    } catch (error) {
      setOperationError(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteRecording(recording: RecordingMirror): Promise<void> {
    const sizeMb = (recording.bytesWritten / (1024 * 1024)).toFixed(1);
    const confirmed = window.confirm(
      `Delete local mirror of "${recording.title}"?\n\n` +
      `This removes the audio file (${sizeMb} MB) and marks the recording as dismissed, ` +
      `so future syncs will not re-download it. Plaud keeps the recording in your account. ` +
      `You can restore it later from the "Show dismissed" view.`,
    );
    if (!confirmed) {
      return;
    }

    await runOperation(async () => {
      await requestJson<unknown>(`/api/recordings/${encodeURIComponent(recording.id)}`, {
        method: "DELETE",
      });
      await refreshSnapshot();
      return `Dismissed "${recording.title}". Local file removed.`;
    });
  }

  async function handleRestoreRecording(recording: RecordingMirror): Promise<void> {
    await runOperation(async () => {
      await requestJson<unknown>(`/api/recordings/${encodeURIComponent(recording.id)}/restore`, {
        method: "POST",
      });
      await refreshSnapshot();
      return `Restored "${recording.title}". The next sync will mirror it again.`;
    });
  }

  async function handleSaveToken(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!tokenInput.trim()) {
      setOperationError("Paste a Plaud bearer token before saving.");
      return;
    }

    await runOperation(async () => {
      const nextAuth = await requestJson<AuthStatus>("/api/auth/token", {
        method: "POST",
        body: JSON.stringify({
          accessToken: tokenInput.trim(),
        }),
      });

      setAuth(nextAuth);
      setTokenInput("");
      await refreshSnapshot();
      return "Bearer token saved and validated.";
    });
  }

  async function handleSaveConfig(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    await runOperation(async () => {
      const nextConfig = await requestJson<RuntimeConfig>("/api/config", {
        method: "PUT",
        body: JSON.stringify({
          webhookUrl: webhookUrlInput.trim() || null,
          webhookSecret: webhookSecretInput.trim() || undefined,
        }),
      });

      setConfig(nextConfig);
      setWebhookSecretInput("");
      await refreshSnapshot();
      return "Webhook configuration updated.";
    });
  }

  async function handleRunSync(): Promise<void> {
    await runOperation(async () => {
      const summary = await requestJson<SyncRunSummary>("/api/sync/run", {
        method: "POST",
        body: JSON.stringify({
          limit: coercePositiveInteger(backfill.limit, config?.defaultSyncLimit ?? 100),
          forceDownload: backfill.forceDownload,
        }),
      });

      setLastRun(summary);
      await refreshSnapshot();
      return summarizeRun("Sync", summary);
    });
  }

  async function handleRunBackfill(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    await runOperation(async () => {
      const summary = await requestJson<SyncRunSummary>("/api/backfill/run", {
        method: "POST",
        body: JSON.stringify({
          from: backfill.from || null,
          to: backfill.to || null,
          serialNumber: backfill.serialNumber.trim() || null,
          scene: backfill.scene ? Number(backfill.scene) : null,
          limit: coercePositiveInteger(backfill.limit, config?.defaultSyncLimit ?? 100),
          forceDownload: backfill.forceDownload,
        }),
      });

      setLastRun(summary);
      await refreshSnapshot();
      return summarizeRun("Backfill", summary);
    });
  }

  async function runOperation(operation: () => Promise<string>): Promise<void> {
    setBusy(true);
    setOperationError(null);
    setOperationResult(null);

    try {
      setOperationResult(await operation());
    } catch (error) {
      setOperationError(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <div className="hero">
        <div>
          <p className="eyebrow">Plaud Mirror</p>
          <h1>Manual-token sync panel</h1>
          <p className="lede">
            This is the first usable slice: bearer-token auth, manual sync and
            filtered backfill, local mirroring, and signed webhook delivery.
          </p>
        </div>
        <div className="hero-status">
          <Metric label="Version" value={health?.version ?? "loading"} />
          <Metric label="Auth" value={auth?.state ?? "unknown"} />
          <Metric label="Recordings" value={String(health?.recordingsCount ?? recordings.length)} />
        </div>
      </div>

      {operationError ? <Banner tone="error" message={operationError} /> : null}
      {operationResult ? <Banner tone="success" message={operationResult} /> : null}

      <div className="grid two-up">
        <section className="card">
          <header className="card-header">
            <div>
              <p className="kicker">Auth</p>
              <h2>Plaud token</h2>
            </div>
            <StatusPill state={auth?.state ?? "missing"} />
          </header>

          <dl className="details">
            <Detail label="Configured" value={auth?.configured ? "yes" : "no"} />
            <Detail label="Resolved API" value={auth?.resolvedApiBase ?? "not validated yet"} />
            <Detail label="Last validated" value={formatDateTime(auth?.lastValidatedAt)} />
          </dl>

          <form className="stack" onSubmit={(event) => void handleSaveToken(event)}>
            <label className="field">
              <span>Bearer token</span>
              <input
                type="password"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="Paste the Plaud bearer token"
                autoComplete="off"
              />
            </label>
            <button type="submit" disabled={busy}>
              Save and validate token
            </button>
          </form>
        </section>

        <section className="card">
          <header className="card-header">
            <div>
              <p className="kicker">Delivery</p>
              <h2>Webhook</h2>
            </div>
            <StatusPill state={config?.webhookUrl ? "healthy" : "missing"} />
          </header>

          <dl className="details">
            <Detail label="Target" value={config?.webhookUrl ?? "disabled"} />
            <Detail label="HMAC secret" value={config?.hasWebhookSecret ? "configured" : "missing"} />
            <Detail label="Last run" value={lastRun ? summarizeRun("Last run", lastRun) : "none yet"} />
          </dl>

          <form className="stack" onSubmit={(event) => void handleSaveConfig(event)}>
            <label className="field">
              <span>Webhook URL</span>
              <input
                type="url"
                value={webhookUrlInput}
                onChange={(event) => setWebhookUrlInput(event.target.value)}
                placeholder="https://example.internal/hooks/plaud"
              />
            </label>
            <label className="field">
              <span>Webhook HMAC secret</span>
              <input
                type="password"
                value={webhookSecretInput}
                onChange={(event) => setWebhookSecretInput(event.target.value)}
                placeholder="Only sent when you update it"
                autoComplete="off"
              />
            </label>
            <button type="submit" disabled={busy}>
              Save webhook settings
            </button>
          </form>
        </section>
      </div>

      <div className="grid two-up">
        <section className="card">
          <header className="card-header">
            <div>
              <p className="kicker">Controls</p>
              <h2>Manual sync</h2>
            </div>
          </header>
          <p className="muted">
            Run a sync against the latest Plaud listings. Existing mirrored
            recordings are skipped unless you force a new download.
          </p>
          <div className="stack">
            <label className="field">
              <span>Sync limit</span>
              <input
                type="number"
                min="1"
                max="1000"
                value={backfill.limit}
                onChange={(event) =>
                  setBackfill((current) => ({ ...current, limit: event.target.value }))
                }
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={backfill.forceDownload}
                onChange={(event) =>
                  setBackfill((current) => ({ ...current, forceDownload: event.target.checked }))
                }
              />
              <span>Force a fresh download even if the file already exists</span>
            </label>
            <button type="button" disabled={busy} onClick={() => void handleRunSync()}>
              Run sync now
            </button>
          </div>
        </section>

        <section className="card">
          <header className="card-header">
            <div>
              <p className="kicker">Controls</p>
              <h2>Historical backfill</h2>
            </div>
          </header>

          <form className="stack" onSubmit={(event) => void handleRunBackfill(event)}>
            <div className="grid compact-grid">
              <label className="field">
                <span>From</span>
                <input
                  type="date"
                  value={backfill.from}
                  onChange={(event) =>
                    setBackfill((current) => ({ ...current, from: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>To</span>
                <input
                  type="date"
                  value={backfill.to}
                  onChange={(event) =>
                    setBackfill((current) => ({ ...current, to: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="grid compact-grid">
              <label className="field">
                <span>Serial number</span>
                <input
                  type="text"
                  value={backfill.serialNumber}
                  onChange={(event) =>
                    setBackfill((current) => ({ ...current, serialNumber: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Scene</span>
                <input
                  type="number"
                  value={backfill.scene}
                  onChange={(event) =>
                    setBackfill((current) => ({ ...current, scene: event.target.value }))
                  }
                />
              </label>
            </div>

            <button type="submit" disabled={busy}>
              Run filtered backfill
            </button>
          </form>
        </section>
      </div>

      <section className="card">
        <header className="card-header">
          <div>
            <p className="kicker">Library</p>
            <h2>Mirrored recordings</h2>
          </div>
          <div className="library-actions">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={showDismissed}
                onChange={(event) => setShowDismissed(event.target.checked)}
              />
              <span>Show dismissed</span>
            </label>
            <button type="button" className="secondary" disabled={busy || loading} onClick={() => void refreshSnapshot()}>
              Refresh
            </button>
          </div>
        </header>

        {loading ? <p className="muted">Loading current state…</p> : null}
        {!loading && recordings.length === 0 ? (
          <p className="muted">
            {showDismissed ? "No recordings match the current view." : "No local recordings yet."}
          </p>
        ) : null}

        {recordings.length > 0 ? (
          <div className="recordings-list">
            {recordings.map((recording) => (
              <article
                className={`recording-row${recording.dismissed ? " recording-row-dismissed" : ""}`}
                key={recording.id}
              >
                <div className="recording-main">
                  <p className="recording-title">{recording.title}</p>
                  <p className="recording-meta">
                    {formatDateTime(recording.createdAt)} · {formatDuration(recording.durationSeconds)}
                  </p>
                  {recording.dismissed ? (
                    <p className="recording-meta">
                      Dismissed {formatDateTime(recording.dismissedAt)}
                    </p>
                  ) : recording.localPath ? (
                    <audio
                      controls
                      preload="none"
                      className="recording-audio"
                      src={`/api/recordings/${encodeURIComponent(recording.id)}/audio`}
                    />
                  ) : null}
                </div>
                <div className="recording-side">
                  <div className="recording-badges">
                    <span className="badge">{recording.contentType ?? "unknown"}</span>
                    <span className="badge">{formatBytes(recording.bytesWritten)}</span>
                    <span className={`badge badge-${recording.lastWebhookStatus ?? "neutral"}`}>
                      webhook {recording.lastWebhookStatus ?? "pending"}
                    </span>
                    {recording.dismissed ? <span className="badge badge-dismissed">dismissed</span> : null}
                  </div>
                  <div className="recording-controls">
                    {recording.dismissed ? (
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => void handleRestoreRecording(recording)}
                      >
                        Restore (re-mirror on next sync)
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="danger"
                        disabled={busy || !recording.localPath}
                        onClick={() => void handleDeleteRecording(recording)}
                      >
                        Delete local mirror
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Banner({ tone, message }: { tone: "success" | "error"; message: string }) {
  return <div className={`banner banner-${tone}`}>{message}</div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function StatusPill({ state }: { state: string }) {
  return <span className={`status-pill status-${state}`}>{state}</span>;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({} as ApiErrorResponse));
    throw new Error(payload.message || `Request failed with HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "not available";
  }

  return new Date(value).toLocaleString();
}

function summarizeRun(label: string, summary: SyncRunSummary): string {
  return `${label}: ${summary.status}, matched ${summary.matched}, downloaded ${summary.downloaded}, delivered ${summary.delivered}`;
}

function coercePositiveInteger(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "0s";
  }

  const seconds = Math.round(totalSeconds);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;
  const paddedSeconds = String(remainderSeconds).padStart(2, "0");

  if (seconds < 3600) {
    return `${minutes}:${paddedSeconds}`;
  }

  const hours = Math.floor(seconds / 3600);
  const remainderMinutes = minutes % 60;
  const paddedMinutes = String(remainderMinutes).padStart(2, "0");

  return `${hours}:${paddedMinutes}:${paddedSeconds}`;
}

function formatBytes(value: number): string {
  if (value <= 0) {
    return "0 B";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  const kb = value / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${(mb / 1024).toFixed(2)} GB`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
