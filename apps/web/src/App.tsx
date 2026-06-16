import { FormEvent, useEffect, useState } from "react";

import { StateBadge } from "./components/StateBadge.js";
import { buildBookmarklet, PLAUD_WEB_APP_URL } from "./plaud-token.js";
import { readBackfillExpanded, readTab, STORAGE_KEYS } from "./storage.js";

// localStorage key (mirror origin) where the panel stashes the one-time
// captureId between "Reconectar Plaud" and the /connect completion (D-019).
const CAPTURE_ID_KEY = "plaud_mirror_capture_id";

import {
  coerceNonNegativeInteger,
  computeMissing,
  describeBusy,
  formatBytes,
  formatDeviceLabel,
  formatDeviceShortName,
  formatDuration,
  formatRecordingsMetric,
  summarizeRun,
  type AuthStatus,
  type BackfillPreviewResponse,
  type Device,
  type OutboxItem,
  type RecordingMirror,
  type RuntimeConfig,
  type ServiceHealth,
  type SessionStatus,
  type SyncRunSummary,
} from "@plaud-mirror/shared";

interface ApiErrorResponse {
  message?: string;
}

interface BackfillDraft {
  from: string;
  to: string;
  serialNumber: string;
  limit: string;
  forceDownload: boolean;
}

const DEFAULT_BACKFILL_DRAFT: BackfillDraft = {
  from: "",
  to: "",
  serialNumber: "",
  // Conservative default: a single recording. Operator can raise this before
  // clicking sync/backfill. An accidental click with limit=100 would bulk-download
  // 100 recordings with no abort path.
  limit: "1",
  forceDownload: false,
};

// Session gate (D-018, v0.6.0). The panel boots by asking the server
// whether operator auth is required; when it is and there is no valid
// session cookie, the login screen replaces the panel entirely. The
// gated <Panel> only mounts after authentication, so none of its
// mount-time API calls fire as 401 noise.
export function App() {
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Assisted-reconnect landing (D-019). The bookmarklet navigates here as
  // `/connect#token=...`. Capture the token from the fragment ONCE, then strip
  // it from the URL/history immediately so the bearer never lingers in the
  // address bar or browser history. Held in state so it survives the login
  // gate (if the operator must sign in first, the token is not lost).
  const isConnect = typeof window !== "undefined" && window.location.pathname === "/connect";
  const [connectToken] = useState<string | null>(() => {
    if (!isConnect || typeof window === "undefined") {
      return null;
    }
    const match = window.location.hash.match(/(?:^#|&)token=([^&]+)/);
    const token = match ? decodeURIComponent(match[1]) : null;
    if (window.location.hash) {
      window.history.replaceState(null, "", "/connect");
    }
    return token;
  });

  async function loadSession(): Promise<void> {
    try {
      setSession(await requestJson<SessionStatus>("/api/session"));
      setSessionError(null);
    } catch (error) {
      setSessionError(toErrorMessage(error));
    }
  }

  useEffect(() => {
    void loadSession();
  }, []);

  if (sessionError) {
    return (
      <div className="shell">
        <Banner tone="error" message={`Cannot reach the API: ${sessionError}`} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="shell">
        <p className="muted">Checking session…</p>
      </div>
    );
  }

  if (session.authRequired && !session.authenticated) {
    return (
      <LoginGate
        onAuthenticated={() => setSession({ authRequired: true, authenticated: true })}
      />
    );
  }

  if (isConnect) {
    return <ConnectPlaud token={connectToken} />;
  }

  return (
    <Panel
      authRequired={session.authRequired}
      onUnauthorized={() => setSession({ authRequired: true, authenticated: false })}
    />
  );
}

// Landing page for the bookmarklet (D-019). Reads the captureId the panel
// stashed in localStorage, posts it together with the captured bearer to
// /api/connect/complete, and reports the outcome. The token arrived in the
// URL fragment (already stripped by App) and is never sent anywhere except
// this same-origin, operator-authenticated POST.
export function ConnectPlaud({ token }: { token: string | null }) {
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState<string>("Conectando con Plaud…");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!token) {
        setState("error");
        setMessage("No llegó ningún token. Vuelve al panel y pulsa \"Reconectar Plaud\" para empezar de nuevo.");
        return;
      }
      let captureId = "";
      try {
        captureId = window.localStorage?.getItem(CAPTURE_ID_KEY) ?? "";
      } catch {
        captureId = "";
      }
      try {
        const auth = await requestJson<AuthStatus>("/api/connect/complete", {
          method: "POST",
          body: JSON.stringify({ token, captureId }),
        });
        try {
          window.localStorage?.removeItem(CAPTURE_ID_KEY);
        } catch {
          // non-fatal
        }
        if (cancelled) {
          return;
        }
        setState("ok");
        setMessage(`Token de Plaud guardado y validado (estado: ${auth.state}).`);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setState("error");
        setMessage(toErrorMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="shell">
      <div className="hero">
        <div>
          <p className="eyebrow">Plaud Mirror</p>
          <h1>Reconectar Plaud</h1>
        </div>
      </div>
      {state === "working" ? <Banner tone="info" message={message} /> : null}
      {state === "ok" ? <Banner tone="success" message={message} /> : null}
      {state === "error" ? <Banner tone="error" message={message} /> : null}
      <section className="card">
        <p className="muted">
          {state === "ok"
            ? "Listo. Ya puedes volver al panel."
            : state === "error"
              ? "No se pudo guardar el token."
              : "Un momento…"}
        </p>
        <a href="/" className="button-row" style={{ textDecoration: "none" }}>
          <button type="button">Volver al panel</button>
        </a>
      </section>
    </div>
  );
}

// Minimal, phone-friendly login screen. One field, one button, clear
// error states (wrong passphrase vs throttled vs network).
export function LoginGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!passphrase.trim()) {
      setError("Enter the operator passphrase.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await requestJson<SessionStatus>("/api/session/login", {
        method: "POST",
        body: JSON.stringify({ passphrase: passphrase.trim() }),
      });
      setPassphrase("");
      onAuthenticated();
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="shell">
      <div className="hero">
        <div>
          <p className="eyebrow">Plaud Mirror</p>
          <h1>Operator login</h1>
          <p className="lede">
            This panel is protected. Enter the operator passphrase
            (PLAUD_MIRROR_ADMIN_PASSPHRASE) to continue.
          </p>
        </div>
      </div>
      {error ? <Banner tone="error" message={error} /> : null}
      <section className="card">
        <form className="stack" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>Passphrase</span>
            <input
              type={showPassphrase ? "text" : "password"}
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Operator passphrase"
              autoComplete="current-password"
              autoFocus
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={showPassphrase}
              onChange={(event) => setShowPassphrase(event.target.checked)}
            />
            <span>Show passphrase</span>
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}

function Panel({
  authRequired,
  onUnauthorized,
}: {
  authRequired: boolean;
  onUnauthorized: () => void;
}) {
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [recordings, setRecordings] = useState<RecordingMirror[]>([]);
  const [tokenInput, setTokenInput] = useState("");
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [webhookSecretInput, setWebhookSecretInput] = useState("");
  // Scheduler interval input is in minutes for operator ergonomics; the
  // wire format is milliseconds. 0 disables the scheduler.
  const [schedulerMinutesInput, setSchedulerMinutesInput] = useState("0");
  // Permanently-failed outbox rows for the Configuration > Outbox card.
  // The pending / retry_waiting counters live in `health.outbox` and do
  // not need a separate state slot.
  const [failedOutboxItems, setFailedOutboxItems] = useState<OutboxItem[]>([]);
  const [bookmarkletCopied, setBookmarkletCopied] = useState(false);
  const [backfill, setBackfill] = useState<BackfillDraft>(DEFAULT_BACKFILL_DRAFT);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [operationResult, setOperationResult] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<SyncRunSummary | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalRecordings, setTotalRecordings] = useState(0);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  // Tab state persists so a page refresh keeps the operator in whichever
  // surface they were using. Default "main" on first load.
  const [activeTab, setActiveTab] = useState<"main" | "config">(() => readTab());
  // Historical backfill defaults COLLAPSED because expanding triggers a
  // /api/backfill/candidates call against Plaud; a fresh page load should
  // not hit the wire until the operator asks for the backfill surface.
  const [backfillExpanded, setBackfillExpanded] = useState<boolean>(() => readBackfillExpanded());

  useEffect(() => {
    try {
      window.localStorage?.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab);
    } catch {
      // localStorage may be unavailable (private browsing, sandbox). Non-fatal.
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      window.localStorage?.setItem(STORAGE_KEYS.BACKFILL_EXPANDED, String(backfillExpanded));
    } catch {
      // same
    }
  }, [backfillExpanded]);

  useEffect(() => {
    void refreshSnapshot();
  }, [showDismissed, page, pageSize]);

  // Polling loop while a sync is in flight. Polls /api/health every 2s and
  // refreshes the library list so newly-mirrored recordings appear without an
  // explicit Refresh click. `health.activeRun` carries the in-flight counters;
  // `health.lastSync` stays pinned to the most recent COMPLETED run so the
  // stats ("Plaud total", "Last run", hero metric) do not flicker to zeroes
  // during a run. When `activeRun` becomes null and `lastSync.id` matches our
  // `activeRunId`, the background work has finished — stop polling and post
  // the success/error banner.
  useEffect(() => {
    if (!activeRunId) {
      return;
    }
    let cancelled = false;
    const tick = async () => {
      if (cancelled) {
        return;
      }
      try {
        const h = await requestJson<ServiceHealth>("/api/health");
        if (cancelled) {
          return;
        }
        setHealth(h);
        setLastRun(h.lastSync);

        const params = new URLSearchParams({
          limit: String(pageSize),
          skip: String(page * pageSize),
        });
        if (showDismissed) {
          params.set("includeDismissed", "true");
        }
        const recordingsResponse = await requestJson<{ recordings: RecordingMirror[]; total: number; skip: number; limit: number }>(
          `/api/recordings?${params.toString()}`,
        );
        if (cancelled) {
          return;
        }
        setRecordings(recordingsResponse.recordings);
        setTotalRecordings(recordingsResponse.total);

        const ourRunStillActive = h.activeRun && h.activeRun.id === activeRunId;
        if (!ourRunStillActive) {
          const finalSummary = h.lastSync && h.lastSync.id === activeRunId
            ? h.lastSync
            : await requestJson<SyncRunSummary>(`/api/sync/runs/${activeRunId}`).catch(() => null);
          cancelled = true;
          setActiveRunId(null);
          setBusy(false);
          // A successful sync refreshes the device catalog on the server, so
          // pull the updated list before posting the completion banner.
          try {
            const devicesResponse = await requestJson<{ devices: Device[] }>("/api/devices");
            setDevices(devicesResponse.devices);
          } catch {
            // Devices are a convenience; a transient failure here is fine.
          }
          if (finalSummary && finalSummary.status === "completed") {
            setOperationResult(summarizeRun(finalSummary.mode === "backfill" ? "Backfill" : "Sync", finalSummary));
          } else if (finalSummary && finalSummary.status === "failed") {
            setOperationError(`Sync failed: ${finalSummary.error ?? "unknown error"}`);
          }
        }
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          // Session expired mid-run — hand control back to the login gate.
          cancelled = true;
          onUnauthorized();
          return;
        }
        // Swallow other polling errors — the next tick will retry. A
        // persistent failure surfaces when the operator manually refreshes.
        void error;
      }
    };
    void tick();
    const interval = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeRunId, page, pageSize, showDismissed]);

  async function refreshSnapshot(): Promise<void> {
    setLoading(true);
    setOperationError(null);

    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        skip: String(page * pageSize),
      });
      if (showDismissed) {
        params.set("includeDismissed", "true");
      }
      const [healthResponse, configResponse, authResponse, recordingsResponse, devicesResponse, outboxResponse] = await Promise.all([
        requestJson<ServiceHealth>("/api/health"),
        requestJson<RuntimeConfig>("/api/config"),
        requestJson<AuthStatus>("/api/auth/status"),
        requestJson<{ recordings: RecordingMirror[]; total: number; skip: number; limit: number }>(
          `/api/recordings?${params.toString()}`,
        ),
        requestJson<{ devices: Device[] }>("/api/devices"),
        requestJson<{ items: OutboxItem[] }>("/api/outbox"),
      ]);

      setHealth(healthResponse);
      setConfig(configResponse);
      setAuth(authResponse);
      setRecordings(recordingsResponse.recordings);
      setTotalRecordings(recordingsResponse.total);
      setWebhookUrlInput(configResponse.webhookUrl ?? "");
      setSchedulerMinutesInput(formatSchedulerInput(configResponse.schedulerIntervalMs));
      setLastRun(healthResponse.lastSync);
      setDevices(devicesResponse.devices);
      setFailedOutboxItems(outboxResponse.items);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      setOperationError(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout(): Promise<void> {
    try {
      await requestJson<SessionStatus>("/api/session/logout", { method: "POST" });
    } catch {
      // Cookie clearing failed server-side is unlikely; fall through to the
      // gate either way so the operator is not stuck.
    }
    onUnauthorized();
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
      return `Restored and re-downloaded "${recording.title}".`;
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

  // Assisted reconnect (D-019): open Plaud's web app and mint a one-time
  // capture id in parallel. The window.open MUST run synchronously inside the
  // click handler — opening a tab after an `await` loses the user-gesture
  // context and mobile/popup blockers reject it. The captureId only needs to
  // reach the mirror's localStorage before the operator taps the bookmarklet
  // (seconds/minutes later), so minting it in the background is race-free.
  // Copy the bookmarklet to the clipboard — the only reliable install path on
  // mobile, where dragging to a bookmarks bar is not available and long-press
  // on a javascript: link is inconsistent.
  async function handleCopyBookmarklet(): Promise<void> {
    const bookmarklet = buildBookmarklet(window.location.origin);
    try {
      await navigator.clipboard.writeText(bookmarklet);
      setBookmarkletCopied(true);
      window.setTimeout(() => setBookmarkletCopied(false), 2500);
    } catch {
      // Clipboard API unavailable (insecure context / old browser): fall back
      // to a prompt the operator can copy from manually.
      window.prompt("Copia esta dirección y pégala como URL de un marcador nuevo:", bookmarklet);
    }
  }

  function handleReconnectPlaud(): void {
    const opened = window.open(PLAUD_WEB_APP_URL, "_blank", "noopener");
    if (opened) {
      setOperationResult("Pestaña de Plaud abierta. Inicia sesión si hace falta y pulsa allí el marcador \"Reconectar Plaud Mirror\".");
    } else {
      // Some browsers still block the popup; the capture session is minted
      // anyway, so the operator can open Plaud by hand and tap the bookmarklet.
      setOperationError("Tu navegador bloqueó la pestaña. Abre app.plaud.ai manualmente, inicia sesión y pulsa allí el marcador \"Reconectar Plaud Mirror\".");
    }
    void requestJson<{ captureId: string }>("/api/connect/start", { method: "POST" })
      .then(({ captureId }) => {
        try {
          window.localStorage?.setItem(CAPTURE_ID_KEY, captureId);
        } catch {
          // non-fatal; /connect will report "no live capture session"
        }
      })
      .catch((error) => {
        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }
        setOperationError(toErrorMessage(error));
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

  async function handleRetryOutboxItem(item: OutboxItem): Promise<void> {
    await runOperation(async () => {
      await requestJson<{ item: OutboxItem }>(`/api/outbox/${item.id}/retry`, {
        method: "POST",
      });
      // Refresh the failed list and the health counters from the server
      // rather than mutating local state — the worker may already have
      // re-claimed the row by the time the next poll lands.
      const [outboxResponse, healthResponse] = await Promise.all([
        requestJson<{ items: OutboxItem[] }>("/api/outbox"),
        requestJson<ServiceHealth>("/api/health"),
      ]);
      setFailedOutboxItems(outboxResponse.items);
      setHealth(healthResponse);
      return `Webhook for ${item.recordingId} re-queued.`;
    });
  }

  async function handleSaveScheduler(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    await runOperation(async () => {
      const intervalMs = parseSchedulerInput(schedulerMinutesInput);
      const nextConfig = await requestJson<RuntimeConfig>("/api/config", {
        method: "PUT",
        body: JSON.stringify({ schedulerIntervalMs: intervalMs }),
      });

      setConfig(nextConfig);
      setSchedulerMinutesInput(formatSchedulerInput(nextConfig.schedulerIntervalMs));
      await refreshSnapshot();
      return intervalMs === 0
        ? "Continuous sync scheduler disabled."
        : `Continuous sync scheduler set to ${intervalMs / 60_000} min.`;
    });
  }

  async function startBackgroundRun(path: "/api/sync/run" | "/api/backfill/run", body: unknown): Promise<void> {
    setBusy(true);
    setOperationError(null);
    setOperationResult(null);
    try {
      const handle = await requestJson<{ id: string; status: "running" }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setActiveRunId(handle.id);
      // The polling effect (above) takes over from here. It clears
      // activeRunId, busy, and posts the success/error banner when the row
      // flips to completed/failed.
    } catch (error) {
      setBusy(false);
      setOperationError(toErrorMessage(error));
    }
  }

  async function handleRunSync(): Promise<void> {
    await startBackgroundRun("/api/sync/run", {
      limit: coerceNonNegativeInteger(backfill.limit, config?.defaultSyncLimit ?? 100),
      forceDownload: backfill.forceDownload,
    });
  }

  async function handleRefreshServerStats(): Promise<void> {
    // Same code path as a sync, but with limit=0 so the worker only refreshes
    // Plaud's listing (plaudTotal + sequence numbers) without downloading
    // anything. Cheap way to bring the hero "Plaud total" / Missing counts
    // up to date.
    await startBackgroundRun("/api/sync/run", { limit: 0, forceDownload: false });
  }

  async function handleRunBackfill(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await startBackgroundRun("/api/backfill/run", {
      from: backfill.from || null,
      to: backfill.to || null,
      serialNumber: backfill.serialNumber.trim() || null,
      // scene is intentionally omitted — the UI no longer exposes it. The
      // backend schema still accepts it (optional/nullable) for programmatic
      // callers. Not sending it means "no scene filter", which is the
      // default behavior.
      limit: coerceNonNegativeInteger(backfill.limit, config?.defaultSyncLimit ?? 100),
      forceDownload: backfill.forceDownload,
    });
  }

  async function runOperation(operation: () => Promise<string>): Promise<void> {
    setBusy(true);
    setOperationError(null);
    setOperationResult(null);

    try {
      setOperationResult(await operation());
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      setOperationError(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`shell${busy ? " working" : ""}`}>
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
          <Metric
            label="Recordings"
            value={formatRecordingsMetric(
              health?.recordingsCount ?? recordings.length,
              health?.lastSync?.plaudTotal ?? null,
            )}
          />
          {authRequired ? (
            <button type="button" className="secondary" onClick={() => void handleLogout()}>
              Log out
            </button>
          ) : null}
        </div>
      </div>

      <div className="tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "main"}
          className={activeTab === "main" ? "tab tab-active" : "tab"}
          onClick={() => setActiveTab("main")}
        >
          Main
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "config"}
          className={activeTab === "config" ? "tab tab-active" : "tab"}
          onClick={() => setActiveTab("config")}
        >
          Configuration
        </button>
      </div>

      {busy ? <Banner tone="info" message={describeBusy(activeRunId, health?.activeRun ?? null)} /> : null}
      {operationError ? <Banner tone="error" message={operationError} /> : null}
      {operationResult ? <Banner tone="success" message={operationResult} /> : null}

      {activeTab === "config" ? (
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

          <div className="reconnect-block">
            <p className="kicker">Reconexión fácil (recomendado)</p>
            <p className="muted">
              En vez de pegar el token a mano. Son dos pasos: primero instalas un
              "marcador" en tu navegador (una sola vez), luego lo usas cuando haga
              falta. El token de Plaud dura ~300 días, así que esto es ~1 vez al año.
            </p>

            <p className="muted small"><strong>Paso 1 — instalar el marcador (una sola vez):</strong></p>
            <ul className="muted small" style={{ marginTop: 0 }}>
              <li>
                <strong>Escritorio:</strong> muestra la barra de marcadores con
                <code> Ctrl+Shift+B</code> (la tira bajo la barra de direcciones) y
                <strong> arrastra</strong> el botón morado de abajo hasta ella. No lo
                pulses aquí — solo arrástralo.
              </li>
              <li>
                <strong>Móvil:</strong> pulsa "Copiar marcador", crea un marcador
                nuevo en tu navegador y pega lo copiado como su dirección/URL.
              </li>
            </ul>
            <p>
              <a
                className="bookmarklet-link"
                href={buildBookmarklet(window.location.origin)}
                onClick={(event) => {
                  event.preventDefault();
                  setOperationResult("No me pulses aquí — arrástrame a la barra de marcadores (Ctrl+Shift+B). Solo funciono cuando me pulsas estando en app.plaud.ai.");
                }}
                title="Arrástrame a la barra de marcadores (no me pulses)"
              >
                🔖 Reconectar Plaud Mirror — arrástrame
              </a>
            </p>
            <div className="button-row">
              <button type="button" className="secondary" onClick={() => void handleCopyBookmarklet()}>
                {bookmarkletCopied ? "¡Copiado!" : "Copiar marcador (móvil)"}
              </button>
            </div>

            <p className="muted small"><strong>Paso 2 — usarlo:</strong> pulsa
              "Reconectar Plaud" (abre la web de Plaud) → inicia sesión si hace falta
              → y <strong>en la pestaña de Plaud</strong> pulsa el marcador que
              instalaste en el paso 1. Debe aparecer un aviso de Plaud Mirror; al
              cerrarlo volverás al panel y el token se guardará solo. Si no aparece
              ningún aviso, el marcador no quedó bien instalado: bórralo e instala
              de nuevo el de esta pantalla.</p>
            <div className="button-row">
              <button type="button" disabled={busy} onClick={() => handleReconnectPlaud()}>
                Reconectar Plaud
              </button>
            </div>
          </div>
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

        <section className="card">
          <header className="card-header">
            <div>
              <p className="kicker">Automation</p>
              <h2>Continuous sync scheduler</h2>
            </div>
            <StatusPill state={health?.scheduler.enabled ? "healthy" : "missing"} />
          </header>

          <p className="muted">
            When enabled, the service runs a sync automatically every N
            minutes. Concurrent runs are absorbed (a tick that fires while
            a manual or scheduled run is still in flight is recorded as
            <code>skipped</code>). 0 disables the scheduler; the floor when
            enabled is 1 minute.
          </p>

          <dl className="details">
            <Detail
              label="State"
              value={health?.scheduler.enabled ? "enabled" : "disabled"}
            />
            <Detail
              label="Interval"
              value={
                health?.scheduler.enabled
                  ? `${(health.scheduler.intervalMs / 60_000).toString()} min`
                  : "—"
              }
            />
            <Detail
              label="Next tick"
              value={formatDateTime(health?.scheduler.nextTickAt)}
            />
            <Detail
              label="Last tick"
              value={
                health?.scheduler.lastTickStatus
                  ? `${health.scheduler.lastTickStatus} (${formatDateTime(health.scheduler.lastTickAt)})`
                  : "no ticks yet"
              }
            />
            {health?.scheduler.lastTickError ? (
              <Detail label="Last tick reason" value={health.scheduler.lastTickError} />
            ) : null}
          </dl>

          <form className="stack" onSubmit={(event) => void handleSaveScheduler(event)}>
            <label className="field">
              <span>Interval (minutes, 0 disables)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={schedulerMinutesInput}
                onChange={(event) => setSchedulerMinutesInput(event.target.value)}
                placeholder="0 = disabled · 15 = every 15 min"
              />
            </label>
            <button type="submit" disabled={busy}>
              Save scheduler settings
            </button>
          </form>
        </section>

        <section className="card">
          <header className="card-header">
            <div>
              <p className="kicker">Delivery queue</p>
              <h2>Webhook outbox</h2>
            </div>
            <StatusPill state={outboxPillState(health, failedOutboxItems.length)} />
          </header>

          <p className="muted">
            Each successful sync enqueues one webhook payload here. The
            worker retries with exponential backoff (30s, 2m, 10m, 30m, 1h,
            2h, 4h, 8h) and escalates to <code>permanently_failed</code>
            after 8 attempts. Failed items are listed below with a Retry
            button — Retry resets the row to <code>pending</code>; the
            worker picks it up on its next tick.
          </p>

          <dl className="details">
            <Detail label="Pending" value={String(health?.outbox.pending ?? 0)} />
            <Detail label="Retry waiting" value={String(health?.outbox.retryWaiting ?? 0)} />
            <Detail label="Permanently failed" value={String(health?.outbox.permanentlyFailed ?? 0)} />
            <Detail
              label="Oldest pending age"
              value={
                health?.outbox.oldestPendingAgeMs != null
                  ? formatDuration(Math.round(health.outbox.oldestPendingAgeMs / 1000))
                  : "—"
              }
            />
          </dl>

          {failedOutboxItems.length === 0 ? (
            <p className="muted">No permanently-failed items.</p>
          ) : (
            <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
              {failedOutboxItems.map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.5rem 0",
                    borderTop: "1px solid var(--border-color, #ddd)",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div><strong>{item.recordingId}</strong> · {item.attempts} attempts</div>
                    <div className="muted" style={{ fontSize: "0.85em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.lastError ?? "no error message"}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRetryOutboxItem(item)}
                  >
                    Retry
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      ) : null}

      {activeTab === "main" ? (
      <>
      <div className="stack-sections">
        <section className="card">
          <header className="card-header">
            <div>
              <p className="kicker">Controls</p>
              <h2>Manual sync</h2>
            </div>
          </header>
          <p className="muted">
            Download up to N recordings that are missing from your local mirror,
            newest first. Skips recordings that are already mirrored or that
            you&apos;ve dismissed. Force download overrides the "already
            mirrored" check.
          </p>
          <dl className="details">
            <Detail
              label="Last run"
              value={lastRun ? summarizeRun("", lastRun).trim().replace(/^:\s*/, "") : "none yet"}
            />
            <Detail
              label="Plaud total"
              value={lastRun?.plaudTotal != null ? String(lastRun.plaudTotal) : "unknown until first sync"}
            />
            <Detail
              label="Mirrored locally"
              value={String(health?.recordingsCount ?? recordings.length)}
            />
            <Detail
              label="Dismissed"
              value={String(health?.dismissedCount ?? 0)}
            />
            <Detail
              label="Missing"
              value={computeMissing(health)}
            />
          </dl>
          <div className="stack">
            <label className="field">
              <span>Sync limit (0 = refresh stats only, no download)</span>
              <input
                type="number"
                min="0"
                max="1000"
                value={backfill.limit}
                onChange={(event) =>
                  setBackfill((current) => ({ ...current, limit: event.target.value }))
                }
              />
            </label>
            <p className="muted small">
              Default is 1 recording per click to avoid accidental bulk downloads. Raise this
              value deliberately before running a larger sync. Set to 0 (or use the dedicated
              button below) to refresh Plaud counts without downloading anything.
            </p>
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
            <div className="button-row">
              <button type="button" disabled={busy} onClick={() => void handleRunSync()}>
                {busy ? "Running…" : "Run sync now"}
              </button>
              <button type="button" className="secondary" disabled={busy} onClick={() => void handleRefreshServerStats()}>
                Refresh server stats
              </button>
            </div>
            {activeRunId && health?.activeRun?.id === activeRunId ? (
              <p className="inline-status">{describeBusy(activeRunId, health.activeRun)}</p>
            ) : null}
          </div>
        </section>

        <section className={`card${backfillExpanded ? "" : " card-collapsed"}`}>
          <header
            className="card-header card-header-collapsible"
            role="button"
            tabIndex={0}
            aria-expanded={backfillExpanded}
            onClick={() => setBackfillExpanded((v) => !v)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setBackfillExpanded((v) => !v);
              }
            }}
          >
            <div>
              <p className="kicker">Controls</p>
              <h2>Historical backfill</h2>
            </div>
            <span className="collapse-caret" aria-hidden="true">
              {backfillExpanded ? "▼" : "▶"}
            </span>
          </header>
          {backfillExpanded ? (
          <>
          <p className="muted">
            Same behavior as Manual sync (download up to N missing, newest
            first), but only from recordings that match the filters below.
          </p>

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

            <label className="field">
              <span>Device</span>
              <select
                value={backfill.serialNumber}
                onChange={(event) =>
                  setBackfill((current) => ({ ...current, serialNumber: event.target.value }))
                }
              >
                <option value="">Any device</option>
                {devices.map((device) => (
                  <option key={device.serialNumber} value={device.serialNumber}>
                    {formatDeviceLabel(device)}
                  </option>
                ))}
              </select>
              {devices.length === 0 ? (
                <span className="muted small">
                  No devices detected yet — run a sync to populate this list.
                </span>
              ) : null}
            </label>

            <BackfillPreview
              filters={{
                from: backfill.from,
                to: backfill.to,
                serialNumber: backfill.serialNumber,
              }}
              devices={devices}
            />

            <button type="submit" disabled={busy}>
              Run filtered backfill
            </button>
            {activeRunId && health?.activeRun?.id === activeRunId ? (
              <p className="inline-status">{describeBusy(activeRunId, health.activeRun)}</p>
            ) : null}
          </form>
          </>
          ) : null}
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
                onChange={(event) => {
                  setShowDismissed(event.target.checked);
                  setPage(0);
                }}
              />
              <span>Show dismissed</span>
            </label>
            <label className="checkbox">
              <span>Per page</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(0);
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </label>
            <button type="button" className="secondary" disabled={busy || loading} onClick={() => void refreshSnapshot()}>
              Refresh
            </button>
          </div>
        </header>

        <PageBar
          page={page}
          pageSize={pageSize}
          total={totalRecordings}
          shown={recordings.length}
          onPrev={() => setPage((current) => Math.max(0, current - 1))}
          onNext={() => setPage((current) => current + 1)}
          disabled={loading || busy}
        />

        {loading ? <p className="muted">Loading current state…</p> : null}
        {!loading && recordings.length === 0 ? (
          <p className="muted">
            {showDismissed ? "No recordings match the current view." : "No local recordings yet."}
          </p>
        ) : null}

        {recordings.length > 0 ? (
          <div className="recordings-list">
            {recordings.map((recording, index) => (
              <article
                className={`recording-row${recording.dismissed ? " recording-row-dismissed" : ""}`}
                key={recording.id}
              >
                <div className="recording-main">
                  <p className="recording-title">
                    <span className="recording-index">
                      #{recording.sequenceNumber ?? "?"}
                    </span>
                    {recording.title}
                  </p>
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
                        Restore (re-download now)
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
      </>
      ) : null}
    </div>
  );
}

interface BackfillPreviewFilters {
  from: string;
  to: string;
  serialNumber: string;
}

// Shows the operator what a backfill with the current filters would touch,
// BEFORE they click "Run filtered backfill". Calls the dry-run endpoint
// debounced by 500 ms so rapid filter edits don't spam Plaud. The component
// owns its own state — the parent only hands it the current filter draft
// and the device catalog so each row can render the device's friendly name
// instead of the raw serial.
function BackfillPreview({
  filters,
  devices,
}: {
  filters: BackfillPreviewFilters;
  devices: Device[];
}) {
  // Map once per render. Cheap and the catalog rarely exceeds a handful.
  const deviceBySerial = new Map(devices.map((device) => [device.serialNumber, device]));
  const [preview, setPreview] = useState<BackfillPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const params = new URLSearchParams({ previewLimit: "200" });
          if (filters.from) params.set("from", filters.from);
          if (filters.to) params.set("to", filters.to);
          if (filters.serialNumber) params.set("serialNumber", filters.serialNumber);
          const data = await requestJson<BackfillPreviewResponse>(
            `/api/backfill/candidates?${params.toString()}`,
          );
          if (!cancelled) {
            setPreview(data);
          }
        } catch (caught) {
          if (!cancelled) {
            setError(toErrorMessage(caught));
            setPreview(null);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      })();
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters.from, filters.to, filters.serialNumber]);

  if (error) {
    return (
      <div className="preview-panel">
        <p className="muted small">Preview unavailable: {error}</p>
      </div>
    );
  }

  if (loading && !preview) {
    return (
      <div className="preview-panel">
        <p className="muted small">Loading preview…</p>
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  const shown = preview.recordings.length;
  const truncated = preview.matched > shown;

  return (
    <div className="preview-panel">
      <p className="preview-summary">
        <strong>{preview.matched}</strong> recording{preview.matched === 1 ? "" : "s"} match —{" "}
        <strong>{preview.missing}</strong> would be downloaded{" "}
        <span className="muted">(of {preview.plaudTotal} total in Plaud)</span>
        {loading ? <span className="muted small"> · refreshing…</span> : null}
      </p>
      {preview.recordings.length === 0 ? (
        <p className="muted small">No recordings match these filters.</p>
      ) : (
        <>
          <div className="preview-table-wrap">
            <table className="preview-table">
              <colgroup>
                <col className="col-rank" />
                <col />
                <col className="col-date" />
                <col className="col-duration" />
                <col className="col-device" />
                <col className="col-state" />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Device</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {preview.recordings.map((row) => (
                  <tr key={row.id}>
                    <td className="preview-rank">#{row.sequenceNumber ?? "?"}</td>
                    <td className="preview-title">{row.title}</td>
                    <td>{formatDateTime(row.createdAt)}</td>
                    <td>{formatDuration(row.durationSeconds)}</td>
                    <td className="preview-device">
                      {formatDeviceShortName(row.serialNumber, deviceBySerial)}
                    </td>
                    <td><StateBadge state={row.state} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {truncated ? (
            <p className="muted small">
              Showing first {shown} of {preview.matched}. Narrow the filters to see more detail.
            </p>
          ) : null}
        </>
      )}
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

function Banner({ tone, message }: { tone: "success" | "error" | "info"; message: string }) {
  return <div className={`banner banner-${tone}`}>{message}</div>;
}

function PageBar({
  page,
  pageSize,
  total,
  shown,
  onPrev,
  onNext,
  disabled,
}: {
  page: number;
  pageSize: number;
  total: number;
  shown: number;
  onPrev: () => void;
  onNext: () => void;
  disabled: boolean;
}) {
  if (total === 0 && shown === 0) {
    return null;
  }
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = page * pageSize + shown;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = page + 1;
  return (
    <div className="page-bar">
      <span className="muted small">
        Showing {start}–{end} of {total} (page {currentPage} of {totalPages})
      </span>
      <div className="page-bar-controls">
        <button type="button" className="secondary" disabled={disabled || page === 0} onClick={onPrev}>
          ← Prev
        </button>
        <button type="button" className="secondary" disabled={disabled || end >= total} onClick={onNext}>
          Next →
        </button>
      </div>
    </div>
  );
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

// Thrown by requestJson on HTTP 401 so callers can distinguish "session
// expired, return to the login gate" from ordinary operation errors.
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init.body !== null;
  const callerHeaders = (init?.headers as Record<string, string> | undefined) ?? {};
  // Only send `content-type: application/json` when we actually have a JSON
  // body. Otherwise Fastify's default body parser rejects the request with 400
  // ("Body cannot be empty when content-type is set to 'application/json'"),
  // which is what was breaking DELETE / POST-without-body routes from the UI.
  const headers: Record<string, string> = hasBody
    ? { "content-type": "application/json", ...callerHeaders }
    : { ...callerHeaders };

  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({} as ApiErrorResponse));
    const message = payload.message || `Request failed with HTTP ${response.status}`;
    // 401 on the login route itself means "wrong passphrase" — that is an
    // ordinary form error, not a session expiry.
    if (response.status === 401 && !path.startsWith("/api/session")) {
      throw new UnauthorizedError(message);
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "not available";
  }

  return new Date(value).toLocaleString();
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

// Scheduler input helpers. The wire format is milliseconds (matches the
// env var and `/api/config` shape) but the panel exposes minutes because
// that is what operators actually think about.
function formatSchedulerInput(intervalMs: number): string {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return "0";
  }
  // Whole minutes when possible; fallback to a decimal so a custom value
  // like 90_000ms (1.5 min — sub-floor, but the field will still render
  // it as 1.5) does not silently round to an unrelated cadence.
  const minutes = intervalMs / 60_000;
  return Number.isInteger(minutes) ? String(minutes) : minutes.toString();
}

// StatusPill state for the Webhook outbox card. Order matters:
//   - any permanently-failed item → "missing" (red): operator must act.
//   - any pending or retry-waiting item → "degraded" (amber): in flight.
//   - empty queue + no failures → "healthy" (green).
function outboxPillState(health: ServiceHealth | null, failedListLength: number): string {
  if (failedListLength > 0 || (health?.outbox.permanentlyFailed ?? 0) > 0) {
    return "missing";
  }
  if ((health?.outbox.pending ?? 0) > 0 || (health?.outbox.retryWaiting ?? 0) > 0) {
    return "degraded";
  }
  return "healthy";
}

function parseSchedulerInput(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return 0;
  }
  const minutes = Number(trimmed);
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new Error(`Scheduler interval must be 0 (disabled) or a positive number of minutes; received: ${raw}`);
  }
  if (minutes === 0) {
    return 0;
  }
  if (minutes < 1) {
    throw new Error(`Scheduler interval must be at least 1 minute when enabled; received: ${raw}`);
  }
  // Round to whole minutes — sub-minute precision would only confuse the
  // operator and the floor on the server side is 60_000ms anyway.
  return Math.round(minutes) * 60_000;
}
