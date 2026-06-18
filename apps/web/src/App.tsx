import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";

import { buildBookmarklet, PLAUD_WEB_APP_URL } from "./plaud-token.js";
import { readLanguage, readTab, STORAGE_KEYS, type ActiveTab, type OperatorLanguage } from "./storage.js";

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
  type BackfillCandidateState,
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

const TAB_ORDER: ActiveTab[] = ["main", "library", "backfill", "config", "ops"];
const MAIN_SYNC_CONFIRM_THRESHOLD = 25;
const MAX_SYNC_DOWNLOAD_LIMIT = 1000;

const COPY = {
  es: {
    loadingSession: "Comprobando sesión…",
    apiUnreachable: "No se puede alcanzar la API",
    operatorLogin: "Login de operador",
    loginBody: "Este panel está protegido. Introduce la passphrase de operador para continuar.",
    passphrase: "Passphrase",
    passphrasePlaceholder: "Passphrase de operador",
    showPassphrase: "Mostrar passphrase",
    enterPassphrase: "Introduce la passphrase de operador.",
    signingIn: "Entrando…",
    signIn: "Entrar",
    connectTitle: "Reconectar Plaud",
    connectWorking: "Conectando con Plaud…",
    connectNoToken: "No llegó ningún token. Vuelve al panel y pulsa \"Reconectar Plaud\" para empezar de nuevo.",
    connectOkPrefix: "Token de Plaud guardado y validado",
    connectOk: "Listo. Ya puedes volver al panel.",
    connectError: "No se pudo guardar el token.",
    connectWait: "Un momento…",
    backToPanel: "Volver al panel",
    navMain: "Main",
    navLibrary: "Library",
    navBackfill: "Backfill",
    navConfig: "Configuration",
    navOps: "Operations",
    selfHosted: "self-hosted",
    logout: "Salir",
    statusAuth: "Auth",
    statusSync: "Sync",
    statusScheduler: "Scheduler",
    statusOutbox: "Outbox",
    statusErrors: "Errores",
    healthy: "Healthy",
    invalid: "Invalid",
    degraded: "Degraded",
    noToken: "Sin token",
    idle: "Reposo",
    running: "Corriendo…",
    off: "Off",
    on: "ON",
    authBannerTitle: "Plaud rechazó el token — la sincronización está parada",
    authBannerBody: "Reconecta para reanudar. No se ha perdido nada local.",
    reconnect: "Reconectar Plaud",
    resultReady: "Sesión de captura lista. En la pestaña de Plaud, inicia sesión si hace falta y pulsa la extensión \"Plaud Mirror Connector\".",
    resultReadyManual: "Sesión de captura lista. Abre app.plaud.ai manualmente, inicia sesión si hace falta y pulsa la extensión \"Plaud Mirror Connector\".",
    popupBlocked: "Tu navegador bloqueó la pestaña. Preparando la sesión de captura para que abras app.plaud.ai manualmente.",
    tabOpened: "Pestaña de Plaud abierta. Preparando la sesión de captura...",
    copyPrompt: "Copia esta dirección y pégala como URL de un marcador nuevo:",
    copied: "Copiado",
    mainSubtitleLive: "Estados en vivo · auto-refresh cada 2 s",
    mainSubtitleEmpty: "Sin conexión con Plaud todavía",
    refreshStats: "Refrescar stats",
    refreshTitle: "Re-cuenta el catálogo de Plaud · no descarga audio",
    syncing: "Sincronizando…",
    nextAction: "Siguiente acción",
    missingAction: "grabaciones están en Plaud pero aún no en tu espejo local.",
    syncMissing: "Sincronizar faltantes",
    connectPlaud: "Conectar Plaud",
    emptyTitle: "Aún no hay nada espejado",
    emptyBody: "Conecta tu cuenta de Plaud para empezar a guardar el audio original localmente, de forma fiable y auditable.",
    emptyMeta: "0 grabaciones locales · sin token configurado",
    inPlaud: "En Plaud",
    local: "Local",
    missing: "Faltan",
    dismissed: "Descartadas",
    coverage: "Cobertura del espejo local",
    lastSync: "Último sync",
    completed: "completado",
    noneYet: "ninguno todavía",
    examined: "examinadas",
    downloaded: "bajadas",
    skipped: "saltadas",
    queued: "en cola",
    recentErrors: "Errores recientes",
    noRecentErrors: "Sin errores recientes.",
    librarySubtitle: "grabaciones locales",
    searchPlaceholder: "Buscar por título o id…",
    scanPlaud: "Escanear Plaud",
    showDismissed: "Ver descartadas",
    perPage: "por página",
    of: "de",
    play: "Reproducir",
    pause: "Pausar",
    localBadge: "local",
    dismissedBadge: "descartada",
    noLocalCopy: "sin copia local",
    noResults: "Sin resultados para esta búsqueda.",
    restore: "Restaurar",
    dismiss: "Descartar",
    pagePrev: "Anterior",
    pageNext: "Siguiente",
    playerCompact: "compacto",
    playerFull: "completo",
    backfillTitle: "Backfill histórico",
    backfillIntro: "Elige un rango y dispositivo, previsualiza lo que se descargaría y ejecútalo. Mismo comportamiento que el sync: baja las que faltan, salta las ya espejadas o descartadas.",
    filters: "Filtros",
    from: "Desde",
    to: "Hasta",
    device: "Dispositivo",
    anyDevice: "Cualquier dispositivo",
    downloadLimit: "Límite de descarga",
    forceDownload: "Forzar descarga aunque exista",
    runBackfill: "Ejecutar backfill filtrado",
    preview: "Previsualización",
    wouldDownload: "se bajarían",
    match: "coinciden",
    missingCol: "faltan",
    alreadyLocal: "ya local",
    tableTitle: "Título",
    tableDate: "Fecha",
    tableState: "Estado",
    stateMissing: "falta",
    stateMirrored: "ya local",
    stateDismissed: "descartada",
    showing: "mostrando",
    noBackfillMatch: "Ninguna grabación coincide con estos filtros.",
    previewUnavailable: "Previsualización no disponible",
    loadingPreview: "Cargando previsualización…",
    configTitle: "Configuration",
    reconnectTitle: "Reconectar Plaud",
    authPlaudToken: "Auth · Plaud token",
    step1: "Instala el marcador o extensión (una vez)",
    step2: "Pulsa «Reconectar Plaud»",
    step3: "Inicia sesión en Plaud (Google)",
    step4: "En la pestaña de Plaud, pulsa la extensión o el marcador",
    step5: "Vuelve: estado healthy",
    connectorPrimary: "Plaud Mirror Connector",
    connectorBody: "La extensión local es el camino recomendado. El bookmarklet queda como fallback para móvil o navegadores sin extensión.",
    dragBookmarklet: "Reconectar Plaud Mirror",
    dragHint: "arrástrame",
    copyMobile: "Copiar marcador",
    pasteManual: "Pegar token a mano (avanzado)",
    pastePlaceholder: "Pega el bearer token de Plaud",
    saveValidate: "Guardar y validar",
    configured: "configurado",
    missingConfig: "sin configurar",
    targetUrl: "URL destino",
    hmacSecret: "Secreto HMAC",
    saveWebhook: "Guardar webhook",
    schedulerContinuous: "Scheduler continuo",
    intervalLabel: "Intervalo (min · 0 desactiva)",
    save: "Guardar",
    schedulerInfo: "ticks concurrentes → «skipped»",
    technical: "Ajustes técnicos (solo lectura)",
    versionRow: "versión",
    dataDir: "data dir",
    recordingsDir: "recordings dir",
    secrets: "secrets",
    apiBase: "api base",
    defaultSyncLimit: "default sync limit",
    recentRuns: "Sync runs recientes",
    mode: "Modo",
    duration: "Duración",
    when: "Cuándo",
    attempts: "intentos",
    retry: "Reintentar",
    lastErrorsTitle: "Últimos errores",
    noFailedOutbox: "No hay filas permanentemente fallidas.",
    noRuns: "Sin runs recientes.",
    pendingShort: "pend",
    retryShort: "retry",
    failShort: "fail",
    tokenRequired: "Pega un bearer token de Plaud antes de guardar.",
    tokenSaved: "Bearer token guardado y validado.",
    webhookUpdated: "Configuración de webhook actualizada.",
    schedulerDisabled: "Scheduler continuo desactivado.",
    schedulerSet: "Scheduler continuo configurado a",
    syncNow: "Run sync now",
    forceFresh: "Forzar descarga fresca aunque el archivo ya exista",
    syncLimit: "Sync limit (0 = refrescar stats, no descarga)",
    refreshOnlyHint: "0 refresca el catálogo de Plaud sin descargar audio.",
    loadingState: "Cargando estado actual…",
    noRecordings: "No hay grabaciones locales todavía.",
    noRecordingsView: "No hay grabaciones en esta vista.",
    deleteConfirmPrefix: "¿Eliminar el espejo local de",
    deleteConfirmBody: "Esto borra el archivo de audio local y marca la grabación como descartada. Plaud mantiene la grabación en tu cuenta.",
    dismissedResult: "Descartada",
    restoredResult: "Restaurada y re-descargada",
  },
  en: {
    loadingSession: "Checking session…",
    apiUnreachable: "Cannot reach the API",
    operatorLogin: "Operator login",
    loginBody: "This panel is protected. Enter the operator passphrase to continue.",
    passphrase: "Passphrase",
    passphrasePlaceholder: "Operator passphrase",
    showPassphrase: "Show passphrase",
    enterPassphrase: "Enter the operator passphrase.",
    signingIn: "Signing in…",
    signIn: "Sign in",
    connectTitle: "Reconnect Plaud",
    connectWorking: "Connecting to Plaud…",
    connectNoToken: "No token arrived. Return to the panel and press \"Reconnect Plaud\" to start again.",
    connectOkPrefix: "Plaud token saved and validated",
    connectOk: "Done. You can return to the panel.",
    connectError: "The token could not be saved.",
    connectWait: "One moment…",
    backToPanel: "Back to panel",
    navMain: "Main",
    navLibrary: "Library",
    navBackfill: "Backfill",
    navConfig: "Configuration",
    navOps: "Operations",
    selfHosted: "self-hosted",
    logout: "Log out",
    statusAuth: "Auth",
    statusSync: "Sync",
    statusScheduler: "Scheduler",
    statusOutbox: "Outbox",
    statusErrors: "Errors",
    healthy: "Healthy",
    invalid: "Invalid",
    degraded: "Degraded",
    noToken: "No token",
    idle: "Idle",
    running: "Running…",
    off: "Off",
    on: "ON",
    authBannerTitle: "Plaud rejected the token — sync is stopped",
    authBannerBody: "Reconnect to resume. Nothing local was lost.",
    reconnect: "Reconnect Plaud",
    resultReady: "Capture session ready. In the Plaud tab, sign in if needed and press the \"Plaud Mirror Connector\" extension.",
    resultReadyManual: "Capture session ready. Open app.plaud.ai manually, sign in if needed and press the \"Plaud Mirror Connector\" extension.",
    popupBlocked: "Your browser blocked the tab. Preparing the capture session so you can open app.plaud.ai manually.",
    tabOpened: "Plaud tab opened. Preparing the capture session...",
    copyPrompt: "Copy this address and paste it as the URL of a new bookmark:",
    copied: "Copied",
    mainSubtitleLive: "Live status · auto-refresh every 2 s",
    mainSubtitleEmpty: "Not connected to Plaud yet",
    refreshStats: "Refresh stats",
    refreshTitle: "Re-counts the Plaud catalog · no audio download",
    syncing: "Syncing…",
    nextAction: "Next action",
    missingAction: "recordings are in Plaud but not yet in your local mirror.",
    syncMissing: "Sync missing",
    connectPlaud: "Connect Plaud",
    emptyTitle: "Nothing mirrored yet",
    emptyBody: "Connect your Plaud account to start saving the original audio locally, reliably and auditably.",
    emptyMeta: "0 local recordings · no token configured",
    inPlaud: "In Plaud",
    local: "Local",
    missing: "Missing",
    dismissed: "Dismissed",
    coverage: "Local mirror coverage",
    lastSync: "Last sync",
    completed: "completed",
    noneYet: "none yet",
    examined: "examined",
    downloaded: "downloaded",
    skipped: "skipped",
    queued: "queued",
    recentErrors: "Recent errors",
    noRecentErrors: "No recent errors.",
    librarySubtitle: "local recordings",
    searchPlaceholder: "Search by title or id…",
    scanPlaud: "Scan Plaud",
    showDismissed: "Show dismissed",
    perPage: "per page",
    of: "of",
    play: "Play",
    pause: "Pause",
    localBadge: "local",
    dismissedBadge: "dismissed",
    noLocalCopy: "no local copy",
    noResults: "No results for this search.",
    restore: "Restore",
    dismiss: "Dismiss",
    pagePrev: "Previous",
    pageNext: "Next",
    playerCompact: "compact",
    playerFull: "full",
    backfillTitle: "Historical backfill",
    backfillIntro: "Pick a range and device, preview what would be downloaded, and run it. Same behavior as sync: downloads what's missing, skips already-mirrored or dismissed ones.",
    filters: "Filters",
    from: "From",
    to: "To",
    device: "Device",
    anyDevice: "Any device",
    downloadLimit: "Download limit",
    forceDownload: "Force download even if it exists",
    runBackfill: "Run filtered backfill",
    preview: "Preview",
    wouldDownload: "would download",
    match: "match",
    missingCol: "missing",
    alreadyLocal: "already local",
    tableTitle: "Title",
    tableDate: "Date",
    tableState: "State",
    stateMissing: "missing",
    stateMirrored: "already local",
    stateDismissed: "dismissed",
    showing: "showing",
    noBackfillMatch: "No recordings match these filters.",
    previewUnavailable: "Preview unavailable",
    loadingPreview: "Loading preview…",
    configTitle: "Configuration",
    reconnectTitle: "Reconnect Plaud",
    authPlaudToken: "Auth · Plaud token",
    step1: "Install the bookmarklet or extension (once)",
    step2: "Tap “Reconnect Plaud”",
    step3: "Sign in to Plaud (Google)",
    step4: "In the Plaud tab, press the extension or bookmarklet",
    step5: "Come back: status healthy",
    connectorPrimary: "Plaud Mirror Connector",
    connectorBody: "The local extension is the recommended path. The bookmarklet remains a fallback for mobile or browsers without extensions.",
    dragBookmarklet: "Reconnect Plaud Mirror",
    dragHint: "drag me",
    copyMobile: "Copy bookmarklet",
    pasteManual: "Paste token manually (advanced)",
    pastePlaceholder: "Paste the Plaud bearer token",
    saveValidate: "Save and validate",
    configured: "configured",
    missingConfig: "missing",
    targetUrl: "Target URL",
    hmacSecret: "HMAC secret",
    saveWebhook: "Save webhook",
    schedulerContinuous: "Continuous scheduler",
    intervalLabel: "Interval (min · 0 disables)",
    save: "Save",
    schedulerInfo: "concurrent ticks → “skipped”",
    technical: "Technical settings (read-only)",
    versionRow: "version",
    dataDir: "data dir",
    recordingsDir: "recordings dir",
    secrets: "secrets",
    apiBase: "api base",
    defaultSyncLimit: "default sync limit",
    recentRuns: "Recent sync runs",
    mode: "Mode",
    duration: "Duration",
    when: "When",
    attempts: "attempts",
    retry: "Retry",
    lastErrorsTitle: "Last errors",
    noFailedOutbox: "No permanently-failed items.",
    noRuns: "No recent runs.",
    pendingShort: "pend",
    retryShort: "retry",
    failShort: "fail",
    tokenRequired: "Paste a Plaud bearer token before saving.",
    tokenSaved: "Bearer token saved and validated.",
    webhookUpdated: "Webhook configuration updated.",
    schedulerDisabled: "Continuous sync scheduler disabled.",
    schedulerSet: "Continuous sync scheduler set to",
    syncNow: "Run sync now",
    forceFresh: "Force a fresh download even if the file already exists",
    syncLimit: "Sync limit (0 = refresh stats only, no download)",
    refreshOnlyHint: "0 refreshes the Plaud catalog without downloading audio.",
    loadingState: "Loading current state…",
    noRecordings: "No local recordings yet.",
    noRecordingsView: "No recordings match the current view.",
    deleteConfirmPrefix: "Delete local mirror of",
    deleteConfirmBody: "This removes the local audio file and marks the recording as dismissed. Plaud keeps the recording in your account.",
    dismissedResult: "Dismissed",
    restoredResult: "Restored and re-downloaded",
  },
} satisfies Record<OperatorLanguage, Record<string, string>>;

type Copy = typeof COPY.es;
type Tone = "good" | "warn" | "bad" | "muted" | "info";

function formatMainSyncButton(language: OperatorLanguage, limit: number, total: number): string {
  if (language === "es") {
    return limit === total ? `Descargar ${total}` : `Descargar ${limit} de ${total}`;
  }
  return limit === total ? `Download ${total}` : `Download ${limit} of ${total}`;
}

function formatMainSyncConfirm(language: OperatorLanguage, limit: number, total: number): string {
  if (language === "es") {
    return limit === total
      ? `Vas a descargar ${total} grabaciones faltantes. Puede tardar varios minutos y ocupar espacio local.\n\n¿Continuar?`
      : `Hay ${total} grabaciones faltantes. Este run descargará las primeras ${limit} por el límite de seguridad actual; puedes repetirlo después.\n\n¿Continuar?`;
  }
  return limit === total
    ? `You are about to download ${total} missing recordings. This can take several minutes and use local disk space.\n\nContinue?`
    : `There are ${total} missing recordings. This run will download the first ${limit} because of the current safety limit; you can run it again afterwards.\n\nContinue?`;
}

// Session gate (D-018, v0.6.0). The panel boots by asking the server
// whether operator auth is required; when it is and there is no valid
// session cookie, the login screen replaces the panel entirely. The
// gated <Panel> only mounts after authentication, so none of its
// mount-time API calls fire as 401 noise.
export function App() {
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const t = COPY[readLanguage()];

  // Assisted-reconnect landing (D-019). The Chrome extension and fallback
  // bookmarklet navigate here as `/connect#token=...`. Capture the token from
  // the fragment ONCE, then strip it from the URL/history immediately so the
  // bearer never lingers in the address bar or browser history. Held in state
  // so it survives the login gate (if the operator must sign in first, the
  // token is not lost).
  const isConnect = typeof window !== "undefined" && window.location.pathname === "/connect";
  const [connectToken] = useState<string | null>(() => {
    if (!isConnect || typeof window === "undefined") {
      return null;
    }
    const match = window.location.hash.match(/(?:^#|&)token=([^&]+)/);
    const token = match?.[1] ? decodeURIComponent(match[1]) : null;
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
        <Banner tone="error" message={`${t.apiUnreachable}: ${sessionError}`} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="shell">
        <p className="muted">{t.loadingSession}</p>
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

// Landing page for browser-assisted re-auth (D-019). Reads the captureId the
// panel stashed in localStorage, posts it together with the captured bearer to
// /api/connect/complete, and reports the outcome. The token arrived in the URL
// fragment (already stripped by App) and is never sent anywhere except this
// same-origin, operator-authenticated POST.
export function ConnectPlaud({ token }: { token: string | null }) {
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const t = COPY[readLanguage()];
  const [message, setMessage] = useState<string>(t.connectWorking);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!token) {
        setState("error");
        setMessage(t.connectNoToken);
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
        setMessage(`${t.connectOkPrefix} (estado: ${auth.state}).`);
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
          <h1>{t.connectTitle}</h1>
        </div>
      </div>
      {state === "working" ? <Banner tone="info" message={message} /> : null}
      {state === "ok" ? <Banner tone="success" message={message} /> : null}
      {state === "error" ? <Banner tone="error" message={message} /> : null}
      <section className="card">
        <p className="muted">
          {state === "ok"
            ? t.connectOk
            : state === "error"
              ? t.connectError
              : t.connectWait}
        </p>
        <a href="/" className="button-row" style={{ textDecoration: "none" }}>
          <button type="button">{t.backToPanel}</button>
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
  const t = COPY[readLanguage()];

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!passphrase.trim()) {
      setError(t.enterPassphrase);
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
          <h1>{t.operatorLogin}</h1>
          <p className="lede">{t.loginBody}</p>
        </div>
      </div>
      {error ? <Banner tone="error" message={error} /> : null}
      <section className="card">
        <form className="stack" onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>{t.passphrase}</span>
            <input
              type={showPassphrase ? "text" : "password"}
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder={t.passphrasePlaceholder}
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
            <span>{t.showPassphrase}</span>
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? t.signingIn : t.signIn}
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
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => readTab());
  const [language, setLanguage] = useState<OperatorLanguage>(() => readLanguage());
  const t = COPY[language];
  const [libraryQuery, setLibraryQuery] = useState("");
  const [playerMode, setPlayerMode] = useState<"compact" | "full">("compact");
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage?.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab);
    } catch {
      // localStorage may be unavailable (private browsing, sandbox). Non-fatal.
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      window.localStorage?.setItem(STORAGE_KEYS.LANGUAGE, language);
    } catch {
      // same
    }
  }, [language]);

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
      `${t.deleteConfirmPrefix} "${recording.title}"?\n\n` +
      `${t.deleteConfirmBody} (${sizeMb} MB)`,
    );
    if (!confirmed) {
      return;
    }

    await runOperation(async () => {
      await requestJson<unknown>(`/api/recordings/${encodeURIComponent(recording.id)}`, {
        method: "DELETE",
      });
      await refreshSnapshot();
      return `${t.dismissedResult} "${recording.title}".`;
    });
  }

  async function handleRestoreRecording(recording: RecordingMirror): Promise<void> {
    await runOperation(async () => {
      await requestJson<unknown>(`/api/recordings/${encodeURIComponent(recording.id)}/restore`, {
        method: "POST",
      });
      await refreshSnapshot();
      return `${t.restoredResult} "${recording.title}".`;
    });
  }

  async function handleSaveToken(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!tokenInput.trim()) {
      setOperationError(t.tokenRequired);
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
      return t.tokenSaved;
    });
  }

  // Assisted reconnect (D-019): open Plaud's web app and mint a one-time
  // capture id in parallel. The window.open MUST run synchronously inside the
  // click handler; opening a tab after an `await` loses the user-gesture
  // context and mobile/popup blockers reject it. The captureId only needs to
  // reach the mirror's localStorage before the operator presses the connector
  // extension in the Plaud tab, so minting it in the background is race-free.
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
      window.prompt(t.copyPrompt, bookmarklet);
    }
  }

  function handleReconnectPlaud(): void {
    const opened = window.open(PLAUD_WEB_APP_URL, "_blank", "noopener");
    if (opened) {
      setOperationResult(t.tabOpened);
    } else {
      // Some browsers still block the popup; the capture session is minted
      // anyway, so the operator can open Plaud by hand and press the extension.
      setOperationError(t.popupBlocked);
    }
    void requestJson<{ captureId: string }>("/api/connect/start", { method: "POST" })
      .then(({ captureId }) => {
        try {
          window.localStorage?.setItem(CAPTURE_ID_KEY, captureId);
        } catch {
          // non-fatal; /connect will report "no live capture session"
        }
        setOperationResult(
          opened
            ? t.resultReady
            : t.resultReadyManual,
        );
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
      return t.webhookUpdated;
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
        ? t.schedulerDisabled
        : `${t.schedulerSet} ${intervalMs / 60_000} min.`;
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

  async function handleRunMissingFromMain(): Promise<void> {
    if (missingCount == null || missingCount <= 0) {
      return;
    }
    const limit = Math.min(missingCount, MAX_SYNC_DOWNLOAD_LIMIT);
    if (limit >= MAIN_SYNC_CONFIRM_THRESHOLD && !window.confirm(formatMainSyncConfirm(language, limit, missingCount))) {
      return;
    }
    await startBackgroundRun("/api/sync/run", {
      limit,
      forceDownload: false,
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

  const activeRun = health?.activeRun ?? null;
  const syncRunning = Boolean(activeRun && activeRun.status === "running");
  const authState = auth?.state ?? health?.auth.state ?? "missing";
  const authConfigured = auth?.configured ?? health?.auth.configured ?? false;
  const authInvalid = authState === "invalid" || authState === "degraded";
  const authMissing = !authConfigured || authState === "missing";
  const localCount = health?.recordingsCount ?? recordings.length;
  const dismissedCount = health?.dismissedCount ?? 0;
  const plaudTotal = health?.lastSync?.plaudTotal ?? null;
  const missingCount = plaudTotal == null ? null : Math.max(0, plaudTotal - localCount - dismissedCount);
  const coverage = plaudTotal && plaudTotal > 0 ? Math.max(0, Math.min(100, (localCount / plaudTotal) * 100)) : 0;
  const coverageLabel = plaudTotal == null ? "--" : coverage.toFixed(1) + "%";
  const outboxTotal = (health?.outbox.pending ?? 0) + (health?.outbox.retryWaiting ?? 0) + (health?.outbox.permanentlyFailed ?? 0);
  const outboxProblem = (health?.outbox.permanentlyFailed ?? 0) > 0 || (health?.outbox.retryWaiting ?? 0) > 0;
  const recentErrors = health?.lastErrors ?? [];
  const recentRuns = health?.recentSyncRuns ?? (lastRun ? [lastRun] : []);
  const firstRunEmpty = !loading && localCount === 0 && !authConfigured;
  const deviceCatalog = useMemo(() => new Map(devices.map((device) => [device.serialNumber, device])), [devices]);
  const filteredRecordings = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase().replace(/^#/, "");
    if (!query) {
      return recordings;
    }
    return recordings.filter((recording) => {
      const sequence = recording.sequenceNumber == null ? "" : String(recording.sequenceNumber);
      return recording.title.toLowerCase().includes(query) || recording.id.toLowerCase().includes(query) || sequence.includes(query);
    });
  }, [libraryQuery, recordings]);
  const pageStart = totalRecordings === 0 ? 0 : page * pageSize + 1;
  const pageEnd = page * pageSize + recordings.length;
  const totalPages = Math.max(1, Math.ceil(totalRecordings / pageSize));

  return (
    <div className={"operator-page" + (busy ? " working" : "")}>
      <div className="operator-frame">
        <aside className="operator-rail">
          <div className="rail-brand">
            <span className="rail-logo" aria-hidden="true">↻</span>
            <div>
              <div className="rail-title">Plaud Mirror</div>
              <div className="rail-subtitle mono">{t.selfHosted} · v{health?.version ?? "..."}</div>
            </div>
          </div>

          <nav className="rail-nav" aria-label="Plaud Mirror">
            {TAB_ORDER.map((tab) => (
              <button
                key={tab}
                type="button"
                className={"rail-link" + (activeTab === tab ? " rail-link-active" : "")}
                onClick={() => setActiveTab(tab)}
              >
                <span className="nav-glyph" aria-hidden="true">{tabGlyph(tab)}</span>
                <span>{tabLabel(tab, t)}</span>
              </button>
            ))}
          </nav>

          <div className="rail-footer">
            <div className="language-toggle" aria-label="Language">
              <button
                type="button"
                className={language === "es" ? "active" : ""}
                onClick={() => setLanguage("es")}
              >ES</button>
              <button
                type="button"
                className={language === "en" ? "active" : ""}
                onClick={() => setLanguage("en")}
              >EN</button>
            </div>
            {authRequired ? (
              <button type="button" className="rail-logout" onClick={() => void handleLogout()}>
                <span className="nav-glyph" aria-hidden="true">⇥</span>
                <span>{t.logout}</span>
              </button>
            ) : null}
          </div>
        </aside>

        <main className="operator-main">
          <section className="status-strip" aria-label="Runtime status">
            <StatusSegment
              label={t.statusAuth}
              value={authMissing ? t.noToken : authState === "healthy" ? t.healthy : authState === "degraded" ? t.degraded : t.invalid}
              tone={authMissing ? "muted" : authInvalid ? "bad" : "good"}
              onClick={() => setActiveTab("config")}
            />
            <StatusSegment
              label={t.statusSync}
              value={syncRunning ? t.running : t.idle}
              tone={syncRunning ? "info" : "muted"}
              spinning={syncRunning}
            />
            <StatusSegment
              label={t.statusScheduler}
              value={health?.scheduler.enabled ? schedulerStatusLabel(health.scheduler, t) : t.off}
              tone={health?.scheduler.enabled ? "good" : "muted"}
            />
            <StatusSegment
              label={t.statusOutbox}
              value={String(outboxTotal)}
              tone={outboxProblem ? "warn" : outboxTotal > 0 ? "info" : "muted"}
              onClick={() => setActiveTab("ops")}
            />
            <StatusSegment
              label={t.statusErrors}
              value={String(recentErrors.length)}
              tone={recentErrors.length > 0 ? "warn" : "muted"}
              onClick={() => setActiveTab("ops")}
            />
          </section>

          {authInvalid && !firstRunEmpty ? (
            <section className="auth-banner">
              <span className="banner-icon" aria-hidden="true">!</span>
              <div>
                <h2>{t.authBannerTitle}</h2>
                <p>{auth?.lastError ?? health?.auth.lastError ?? t.authBannerBody}</p>
              </div>
              <button type="button" className="danger-button" onClick={() => setActiveTab("config")}>{t.reconnect}</button>
            </section>
          ) : null}

          <div className="feedback-stack">
            {busy ? <Banner tone="info" message={describeBusy(activeRunId, activeRun)} /> : null}
            {operationError ? <Banner tone="error" message={operationError} /> : null}
            {operationResult ? <Banner tone="success" message={operationResult} /> : null}
          </div>

          <div className="operator-content">
            {activeTab === "main" ? (
              <section>
                <HeaderRow
                  title={t.navMain}
                  subtitle={firstRunEmpty ? t.mainSubtitleEmpty : t.mainSubtitleLive}
                  action={syncRunning ? (
                    <button type="button" className="ghost-button info" disabled>{t.syncing}</button>
                  ) : (
                    <button type="button" className="ghost-button" title={t.refreshTitle} disabled={busy} onClick={() => void handleRefreshServerStats()}>{t.refreshStats}</button>
                  )}
                />

                {firstRunEmpty ? (
                  <section className="empty-panel">
                    <span className="empty-icon" aria-hidden="true">♪</span>
                    <h2>{t.emptyTitle}</h2>
                    <p>{t.emptyBody}</p>
                    <button type="button" onClick={() => setActiveTab("config")}>{t.connectPlaud}</button>
                    <span className="mono empty-meta">{t.emptyMeta}</span>
                  </section>
                ) : (
                  <>
                    {syncRunning ? (
                      <section className="next-card sync-running-card">
                        <div className="spinner" aria-hidden="true" />
                        <div>
                          <strong>{describeBusy(activeRunId, activeRun)}</strong>
                          <span className="mono">{runMeta(activeRun, t)}</span>
                        </div>
                        <ProgressBar value={progressForRun(activeRun)} tone="info" />
                      </section>
                    ) : missingCount != null && missingCount > 0 && !authInvalid ? (
                      <section className="next-card">
                        <span className="next-icon" aria-hidden="true">↓</span>
                        <div>
                          <span className="mono next-label">{t.nextAction}</span>
                          <strong>{missingCount} {t.missingAction}</strong>
                        </div>
                        <button type="button" disabled={busy} onClick={() => void handleRunMissingFromMain()}>{formatMainSyncButton(language, Math.min(missingCount, MAX_SYNC_DOWNLOAD_LIMIT), missingCount)}</button>
                      </section>
                    ) : null}

                    <div className="metric-grid">
                      <MetricTile label={t.inPlaud} value={plaudTotal == null ? "--" : formatInteger(plaudTotal)} />
                      <MetricTile label={t.local} value={formatInteger(localCount)} tone="good" />
                      <MetricTile label={t.missing} value={missingCount == null ? "--" : formatInteger(missingCount)} tone="warn" />
                      <MetricTile label={t.dismissed} value={formatInteger(dismissedCount)} tone="muted" />
                    </div>

                    <section className="panel-card coverage-card">
                      <div className="split-row">
                        <strong>{t.coverage}</strong>
                        <span className="mono">{coverageLabel} · {formatRecordingsMetric(localCount, plaudTotal)}</span>
                      </div>
                      <ProgressBar value={coverage} />
                    </section>

                    <div className="main-lower-grid">
                      <section className="panel-card table-card">
                        <div className="card-title-row">
                          <strong>{t.lastSync}</strong>
                          <StatePill tone={lastRun?.status === "failed" ? "bad" : "good"} label={lastRun?.status ?? t.noneYet} />
                        </div>
                        <p className="mono subdued">{lastRun ? formatRunLine(lastRun) : t.noneYet}</p>
                        <RunStats run={lastRun} t={t} />
                      </section>
                      <section className="panel-card">
                        <div className="card-title-row"><strong>{t.recentErrors}</strong></div>
                        <ErrorList errors={recentErrors.slice(0, 3)} emptyLabel={t.noRecentErrors} />
                      </section>
                    </div>
                  </>
                )}
              </section>
            ) : null}

            {activeTab === "library" ? (
              <section>
                <HeaderRow
                  title={t.navLibrary}
                  subtitle={formatInteger(totalRecordings) + " " + t.librarySubtitle + " · " + formatInteger(dismissedCount) + " " + t.dismissed.toLowerCase()}
                  action={<button type="button" className="ghost-button" disabled={busy} onClick={() => void handleRefreshServerStats()}>{t.scanPlaud}</button>}
                />
                <div className="library-toolbar">
                  <label className="search-field">
                    <span aria-hidden="true">⌕</span>
                    <input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder={t.searchPlaceholder} />
                  </label>
                  <label className="inline-control"><input type="checkbox" checked={showDismissed} onChange={(event) => { setShowDismissed(event.target.checked); setPage(0); }} /> {t.showDismissed}</label>
                  <label className="inline-control mono">{t.perPage}
                    <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={150}>150</option>
                    </select>
                  </label>
                  <div className="segmented-control" aria-label="Player mode">
                    <button type="button" className={playerMode === "compact" ? "active" : ""} onClick={() => setPlayerMode("compact")}>{t.playerCompact}</button>
                    <button type="button" className={playerMode === "full" ? "active" : ""} onClick={() => setPlayerMode("full")}>{t.playerFull}</button>
                  </div>
                  <span className="mono toolbar-count">{filteredRecordings.length} {t.of} {recordings.length}</span>
                </div>
                <div className="library-pagebar">
                  <span className="mono">{pageStart}-{pageEnd} {t.of} {totalRecordings}</span>
                  <div className="page-buttons">
                    <button type="button" className="icon-button" disabled={loading || busy || page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} aria-label={t.pagePrev}>‹</button>
                    <span className="mono">{page + 1} / {totalPages}</span>
                    <button type="button" className="icon-button" disabled={loading || busy || pageEnd >= totalRecordings} onClick={() => setPage((current) => current + 1)} aria-label={t.pageNext}>›</button>
                  </div>
                </div>
                {loading ? <p className="muted small">{t.loadingState}</p> : null}
                {!loading && filteredRecordings.length === 0 ? <div className="empty-list mono">{libraryQuery ? t.noResults : showDismissed ? t.noRecordingsView : t.noRecordings}</div> : null}
                <div className="recording-table">
                  {filteredRecordings.map((recording) => (
                    <RecordingRow
                      key={recording.id}
                      recording={recording}
                      deviceLabel={formatDeviceShortName(recording.serialNumber, deviceCatalog)}
                      playerMode={playerMode}
                      isPlaying={playingRecordingId === recording.id}
                      onPlay={() => setPlayingRecordingId((current) => current === recording.id ? null : recording.id)}
                      onDismiss={() => void handleDeleteRecording(recording)}
                      onRestore={() => void handleRestoreRecording(recording)}
                      busy={busy}
                      t={t}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {activeTab === "backfill" ? (
              <section>
                <HeaderRow title={t.backfillTitle} subtitle={t.backfillIntro} />
                <div className="backfill-grid">
                  <form className="panel-card backfill-filters" onSubmit={(event) => void handleRunBackfill(event)}>
                    <div className="mono form-kicker">{t.filters}</div>
                    <div className="field-grid two">
                      <label className="field compact"><span>{t.from}</span><input type="date" value={backfill.from} onChange={(event) => setBackfill((current) => ({ ...current, from: event.target.value }))} /></label>
                      <label className="field compact"><span>{t.to}</span><input type="date" value={backfill.to} onChange={(event) => setBackfill((current) => ({ ...current, to: event.target.value }))} /></label>
                    </div>
                    <label className="field compact"><span>{t.device}</span><select value={backfill.serialNumber} onChange={(event) => setBackfill((current) => ({ ...current, serialNumber: event.target.value }))}><option value="">{t.anyDevice}</option>{devices.map((device) => <option key={device.serialNumber} value={device.serialNumber}>{formatDeviceLabel(device)}</option>)}</select></label>
                    <label className="field compact"><span>{t.downloadLimit}</span><input type="number" min="0" max="1000" value={backfill.limit} onChange={(event) => setBackfill((current) => ({ ...current, limit: event.target.value }))} /></label>
                    <label className="inline-control"><input type="checkbox" checked={backfill.forceDownload} onChange={(event) => setBackfill((current) => ({ ...current, forceDownload: event.target.checked }))} /> {t.forceDownload}</label>
                    <button type="submit" disabled={busy}>{t.runBackfill}</button>
                  </form>
                  <BackfillPreview
                    filters={{ from: backfill.from, to: backfill.to, serialNumber: backfill.serialNumber }}
                    devices={devices}
                    t={t}
                  />
                </div>
              </section>
            ) : null}

            {activeTab === "config" ? (
              <section>
                <HeaderRow title={t.configTitle} />
                <section className="panel-card reconnect-card">
                  <div className="card-title-row">
                    <div><div className="mono form-kicker">{t.authPlaudToken}</div><strong>{t.reconnectTitle}</strong></div>
                    <StatePill tone={authState === "healthy" ? "good" : authInvalid ? "bad" : "muted"} label={authState === "healthy" ? t.healthy : authMissing ? t.noToken : t.invalid} />
                  </div>
                  <div className="step-grid">
                    {[t.step1, t.step2, t.step3, t.step4, t.step5].map((step, index) => <StepBox key={step} number={index + 1} label={step} />)}
                  </div>
                  <p className="muted small">{t.connectorBody}</p>
                  <div className="reconnect-actions">
                    <button type="button" disabled={busy} onClick={() => handleReconnectPlaud()}>{t.reconnect}</button>
                    <span className="connector-pill">{t.connectorPrimary}</span>
                    <button type="button" className="bookmarklet-chip" onClick={() => void handleCopyBookmarklet()}>🔖 {t.dragBookmarklet} <span>{bookmarkletCopied ? t.copied : t.copyMobile}</span></button>
                  </div>
                  <details className="manual-token-details">
                    <summary>{t.pasteManual}</summary>
                    <form className="token-form" onSubmit={(event) => void handleSaveToken(event)}>
                      <input type="password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} placeholder={t.pastePlaceholder} autoComplete="off" />
                      <button type="submit" className="ghost-button" disabled={busy}>{t.saveValidate}</button>
                    </form>
                  </details>
                </section>

                <div className="config-grid">
                  <section className="panel-card">
                    <div className="card-title-row"><div><div className="mono form-kicker">Delivery</div><strong>Webhook</strong></div><StatePill tone={config?.webhookUrl ? "good" : "muted"} label={config?.webhookUrl ? t.configured : t.missingConfig} /></div>
                    <form className="stack compact" onSubmit={(event) => void handleSaveConfig(event)}>
                      <label className="field compact"><span>{t.targetUrl}</span><input type="url" value={webhookUrlInput} onChange={(event) => setWebhookUrlInput(event.target.value)} placeholder="https://example.internal/hooks/plaud" /></label>
                      <label className="field compact"><span>{t.hmacSecret}</span><input type="password" value={webhookSecretInput} onChange={(event) => setWebhookSecretInput(event.target.value)} placeholder="••••••••••••" autoComplete="off" /></label>
                      <button type="submit" className="ghost-button" disabled={busy}>{t.saveWebhook}</button>
                    </form>
                  </section>
                  <section className="panel-card">
                    <div className="card-title-row"><div><div className="mono form-kicker">Automation</div><strong>{t.schedulerContinuous}</strong></div><StatePill tone={health?.scheduler.enabled ? "good" : "muted"} label={health?.scheduler.enabled ? t.on : t.off} /></div>
                    <form className="scheduler-form" onSubmit={(event) => void handleSaveScheduler(event)}>
                      <label className="field compact"><span>{t.intervalLabel}</span><input type="number" min={0} step={1} value={schedulerMinutesInput} onChange={(event) => setSchedulerMinutesInput(event.target.value)} /></label>
                      <button type="submit" className="ghost-button" disabled={busy}>{t.save}</button>
                    </form>
                    <p className="mono subdued">{schedulerDetail(health?.scheduler ?? null, t)}</p>
                  </section>
                  <section className="panel-card technical-card">
                    <div className="mono form-kicker">{t.technical}</div>
                    <TechnicalGrid config={config} health={health} auth={auth} t={t} />
                  </section>
                </div>
              </section>
            ) : null}

            {activeTab === "ops" ? (
              <section>
                <HeaderRow title={t.navOps} />
                <OperationsRuns runs={recentRuns} t={t} />
                <div className="ops-grid">
                  <OperationsOutbox items={failedOutboxItems} health={health} busy={busy} onRetry={(item) => void handleRetryOutboxItem(item)} t={t} />
                  <section className="panel-card">
                    <div className="card-title-row"><strong>{t.lastErrorsTitle}</strong></div>
                    <ErrorList errors={recentErrors} emptyLabel={t.noRecentErrors} />
                  </section>
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function tabLabel(tab: ActiveTab, t: Copy): string {
  switch (tab) {
    case "main": return t.navMain;
    case "library": return t.navLibrary;
    case "backfill": return t.navBackfill;
    case "config": return t.navConfig;
    case "ops": return t.navOps;
  }
}

function tabGlyph(tab: ActiveTab): string {
  switch (tab) {
    case "main": return "▦";
    case "library": return "♪";
    case "backfill": return "⌗";
    case "config": return "⚙";
    case "ops": return "⌁";
  }
}

function HeaderRow({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="view-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="mono">{subtitle}</p> : null}
      </div>
      {action ? <div className="view-actions">{action}</div> : null}
    </div>
  );
}

function StatusSegment({
  label,
  value,
  tone,
  spinning = false,
  onClick,
}: {
  label: string;
  value: string;
  tone: Tone;
  spinning?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={"status-dot tone-" + tone + (spinning ? " spinning" : "")} aria-hidden="true" />
      <span>
        <span className="mono status-label">{label}</span>
        <strong>{value}</strong>
      </span>
    </>
  );
  return onClick ? (
    <button type="button" className={"status-segment tone-" + tone} onClick={onClick}>{content}</button>
  ) : (
    <div className={"status-segment tone-" + tone}>{content}</div>
  );
}

function StatePill({ tone, label }: { tone: Tone; label: string }) {
  return <span className={"state-pill tone-" + tone}>{label}</span>;
}

function MetricTile({ label, value, tone = "muted" }: { label: string; value: string; tone?: Tone }) {
  return (
    <section className="metric-tile">
      <span className="mono">{label}</span>
      <strong className={"tone-text-" + tone}>{value}</strong>
    </section>
  );
}

function ProgressBar({ value, tone = "good" }: { value: number; tone?: Tone }) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className="progress-track" aria-hidden="true">
      <div className={"progress-fill tone-" + tone} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function StepBox({ number, label }: { number: number; label: string }) {
  return (
    <div className="step-box">
      <span>{number}</span>
      <p>{label}</p>
    </div>
  );
}

function RunStats({ run, t }: { run: SyncRunSummary | null; t: Copy }) {
  const values = run
    ? [
        [t.examined, run.examined],
        [t.downloaded, run.downloaded],
        [t.skipped, run.skipped],
        [t.queued, run.enqueued],
      ]
    : [
        [t.examined, 0],
        [t.downloaded, 0],
        [t.skipped, 0],
        [t.queued, 0],
      ];
  return (
    <div className="run-stats">
      {values.map(([label, value]) => (
        <div key={label}>
          <strong className="mono">{formatInteger(Number(value))}</strong>
          <span className="mono">{label}</span>
        </div>
      ))}
    </div>
  );
}

function ErrorList({ errors, emptyLabel }: { errors: ServiceHealth["lastErrors"]; emptyLabel: string }) {
  if (errors.length === 0) {
    return <p className="mono empty-list compact">{emptyLabel}</p>;
  }
  return (
    <div className="error-list">
      {errors.map((error, index) => (
        <div key={`${error.occurredAt}-${error.subsystem}-${index}`} className="error-row">
          <span className={"error-subsystem subsystem-" + error.subsystem}>{error.subsystem}</span>
          <div>
            <p className="mono">{error.message}</p>
            <span className="mono">{formatDateTime(error.occurredAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecordingRow({
  recording,
  deviceLabel,
  playerMode,
  isPlaying,
  onPlay,
  onDismiss,
  onRestore,
  busy,
  t,
}: {
  recording: RecordingMirror;
  deviceLabel: string;
  playerMode: "compact" | "full";
  isPlaying: boolean;
  onPlay: () => void;
  onDismiss: () => void;
  onRestore: () => void;
  busy: boolean;
  t: Copy;
}) {
  const canPlay = Boolean(recording.localPath) && !recording.dismissed;
  return (
    <article className={"recording-line" + (recording.dismissed ? " dismissed" : "")}>
      <span className="mono recording-sequence">#{recording.sequenceNumber ?? "?"}</span>
      <div className="recording-copy">
        <strong>{recording.title}</strong>
        <span className="mono">
          {formatDateTime(recording.createdAt)} · {formatDuration(recording.durationSeconds)} · {deviceLabel} · {formatBytes(recording.bytesWritten)}
        </span>
      </div>
      <div className="recording-player">
        {canPlay ? (
          playerMode === "full" || isPlaying ? (
            <audio
              controls
              preload="none"
              className="recording-audio-inline"
              src={`/api/recordings/${encodeURIComponent(recording.id)}/audio`}
              onPlay={onPlay}
            />
          ) : (
            <button type="button" className="play-button" onClick={onPlay} title={t.play}>▶ <span className="mono">{formatDuration(recording.durationSeconds)}</span></button>
          )
        ) : (
          <span className="mono no-copy">{t.noLocalCopy}</span>
        )}
      </div>
      <StatePill tone={recording.dismissed ? "warn" : "good"} label={recording.dismissed ? t.dismissedBadge : t.localBadge} />
      {recording.dismissed ? (
        <button type="button" className="icon-button good" disabled={busy} onClick={onRestore} title={t.restore}>↻</button>
      ) : (
        <button type="button" className="icon-button danger" disabled={busy || !recording.localPath} onClick={onDismiss} title={t.dismiss}>×</button>
      )}
    </article>
  );
}

function OperationsRuns({ runs, t }: { runs: SyncRunSummary[]; t: Copy }) {
  return (
    <section className="panel-card table-card">
      <div className="card-title-row"><strong>{t.recentRuns}</strong></div>
      {runs.length === 0 ? <p className="mono empty-list compact">{t.noRuns}</p> : (
        <table className="ops-table">
          <thead>
            <tr>
              <th>{t.tableState}</th>
              <th>{t.mode}</th>
              <th>{t.examined}</th>
              <th>{t.downloaded}</th>
              <th>{t.duration}</th>
              <th>{t.when}</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td><StatePill tone={run.status === "failed" ? "bad" : run.status === "running" ? "info" : "good"} label={run.status} /></td>
                <td className="mono">{run.mode}</td>
                <td className="mono">{formatInteger(run.examined)}</td>
                <td className="mono tone-text-good">{formatInteger(run.downloaded)}</td>
                <td className="mono">{formatRunDuration(run)}</td>
                <td className="mono muted-cell">{formatDateTime(run.finishedAt ?? run.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function OperationsOutbox({
  items,
  health,
  busy,
  onRetry,
  t,
}: {
  items: OutboxItem[];
  health: ServiceHealth | null;
  busy: boolean;
  onRetry: (item: OutboxItem) => void;
  t: Copy;
}) {
  return (
    <section className="panel-card outbox-card">
      <div className="card-title-row">
        <strong>Webhook outbox</strong>
        <span className="mono subdued">
          {health?.outbox.pending ?? 0} {t.pendingShort} · {health?.outbox.retryWaiting ?? 0} {t.retryShort} · {health?.outbox.permanentlyFailed ?? 0} {t.failShort}
        </span>
      </div>
      {items.length === 0 ? <p className="mono empty-list compact">{t.noFailedOutbox}</p> : (
        <div className="outbox-list">
          {items.map((item) => (
            <div key={item.id} className="outbox-row">
              <div>
                <strong className="mono">{item.recordingId} · {item.attempts} {t.attempts}</strong>
                <span className="mono">{item.lastError ?? "no error message"}</span>
              </div>
              <button type="button" className="ghost-button compact" disabled={busy} onClick={() => onRetry(item)}>{t.retry}</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TechnicalGrid({ config, health, auth, t }: { config: RuntimeConfig | null; health: ServiceHealth | null; auth: AuthStatus | null; t: Copy }) {
  const rows = [
    [t.dataDir, config?.dataDir ?? "--"],
    [t.recordingsDir, config?.recordingsDir ?? "--"],
    [t.secrets, "data/secrets.enc"],
    [t.apiBase, auth?.resolvedApiBase ?? health?.auth.resolvedApiBase ?? "--"],
    [t.defaultSyncLimit, String(config?.defaultSyncLimit ?? "--")],
    [t.versionRow, `${health?.version ?? "--"} · ${health?.phase ?? "Phase"}`],
  ];
  return (
    <div className="technical-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong className="mono">{value}</strong>
        </div>
      ))}
    </div>
  );
}

function schedulerStatusLabel(scheduler: ServiceHealth["scheduler"], t: Copy): string {
  if (!scheduler.enabled) {
    return t.off;
  }
  const minutes = scheduler.intervalMs / 60_000;
  return `${t.on} · ${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)}m`;
}

function schedulerDetail(scheduler: ServiceHealth["scheduler"] | null, t: Copy): string {
  if (!scheduler?.enabled) {
    return t.off;
  }
  const next = scheduler.nextTickAt ? formatDateTime(scheduler.nextTickAt) : "--";
  const last = scheduler.lastTickStatus ? `${scheduler.lastTickStatus} · ${formatDateTime(scheduler.lastTickAt)}` : "--";
  return `next: ${next} · last: ${last} · ${t.schedulerInfo}`;
}

function runMeta(run: SyncRunSummary | null, t: Copy): string {
  if (!run) {
    return "";
  }
  return `${run.mode} · ${t.examined} ${run.examined} · ${t.downloaded} ${run.downloaded} · ${t.skipped} ${run.skipped}`;
}

function progressForRun(run: SyncRunSummary | null): number {
  if (!run || run.matched <= 0) {
    return 0;
  }
  return (run.downloaded / run.matched) * 100;
}

function formatRunLine(run: SyncRunSummary): string {
  return `${run.mode} · ${formatDateTime(run.finishedAt ?? run.startedAt)} · ${formatRunDuration(run)}`;
}

function formatRunDuration(run: SyncRunSummary): string {
  if (!run.finishedAt) {
    return "--";
  }
  const start = Date.parse(run.startedAt);
  const end = Date.parse(run.finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return "--";
  }
  return formatDuration(Math.round((end - start) / 1000));
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(value).replace(/,/g, " ");
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
  t,
}: {
  filters: BackfillPreviewFilters;
  devices: Device[];
  t: Copy;
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
      <div className="panel-card preview-card">
        <p className="muted small">{t.previewUnavailable}: {error}</p>
      </div>
    );
  }

  if (loading && !preview) {
    return (
      <div className="panel-card preview-card">
        <p className="muted small">{t.loadingPreview}</p>
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  const shown = preview.recordings.length;
  const truncated = preview.matched > shown;
  const localCount = preview.matched - preview.missing;

  return (
    <div className="panel-card preview-card">
      <div className="card-title-row">
        <strong>{t.preview}</strong>
        <span className="mono subdued">{preview.matched} {t.match} · <span className="tone-text-warn">{preview.missing} {t.wouldDownload}</span>{loading ? " · ..." : ""}</span>
      </div>
      <div className="preview-metrics">
        <MetricTile label={t.match} value={formatInteger(preview.matched)} />
        <MetricTile label={t.missingCol} value={formatInteger(preview.missing)} tone="warn" />
        <MetricTile label={t.alreadyLocal} value={formatInteger(localCount)} tone="muted" />
      </div>
      {preview.recordings.length === 0 ? (
        <p className="muted small">{t.noBackfillMatch}</p>
      ) : (
        <>
          <div className="preview-table-wrap">
            <table className="preview-table">
              <colgroup>
                <col className="col-rank" />
                <col />
                <col className="col-date" />
                <col className="col-state" />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.tableTitle}</th>
                  <th>{t.tableDate}</th>
                  <th>{t.tableState}</th>
                </tr>
              </thead>
              <tbody>
                {preview.recordings.map((row) => (
                  <tr key={row.id}>
                    <td className="preview-rank">#{row.sequenceNumber ?? "?"}</td>
                    <td className="preview-title">{row.title}</td>
                    <td className="mono">
                      {formatDateTime(row.createdAt)} · {formatDuration(row.durationSeconds)} · {formatDeviceShortName(row.serialNumber, deviceBySerial)}
                    </td>
                    <td><BackfillStatePill state={row.state} t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {truncated ? (
            <p className="muted small">
              {t.showing} {shown} {t.of} {preview.matched}.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function BackfillStatePill({ state, t }: { state: BackfillCandidateState; t: Copy }) {
  const label = state === "missing" ? t.stateMissing : state === "mirrored" ? t.stateMirrored : t.stateDismissed;
  const tone: Tone = state === "missing" ? "warn" : state === "mirrored" ? "muted" : "warn";
  return <StatePill tone={tone} label={label} />;
}

function Banner({ tone, message }: { tone: "success" | "error" | "info"; message: string }) {
  return <div className={`banner banner-${tone}`}>{message}</div>;
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
