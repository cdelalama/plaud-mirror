import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  formatBytes,
  type EnqueueTranscriptionResult,
  type MediaDelivery,
  type MediaDeliveryFailureCategory,
  type TranscriptionConnectionTest,
  type TranscriptionDestination,
  type TranscriptionDestinationCreated,
  type TranscriptionDestinationSummary,
  type TranscriptionOverview,
  type TranscriptionReplayPreview,
} from "@plaud-mirror/shared";

import { requestJson, UnauthorizedError } from "./api-client.js";
import type { OperatorLanguage } from "./storage.js";

interface Props {
  language: OperatorLanguage;
  onUnauthorized: () => void;
}

interface DestinationDraft {
  name: string;
  baseUrl: string;
  artifactBaseUrl: string;
  intakeCredential: string;
  statusSigningSecret: string;
}

interface FailureReviewDraft {
  category: MediaDeliveryFailureCategory;
  resolution: "active" | "resolved";
  providerInvoked: boolean;
  policyLimitMinutes: string;
}

const COPY = {
  es: {
    title: "Integraciones",
    subtitle: "Destinos de transcripción compatibles",
    add: "Añadir destino",
    close: "Cerrar",
    type: "Protocolo",
    name: "Nombre",
    namePlaceholder: "Servicio de transcripción",
    destinationOrigin: "Origen del transcriptor",
    mirrorOrigin: "Origen público de Plaud Mirror",
    intakeCredential: "Credencial de admisión",
    statusSecret: "Secreto de estados firmados",
    create: "Crear destino",
    creating: "Creando...",
    connected: "Conectado",
    disabled: "Desactivado",
    untested: "Sin probar",
    degraded: "Con error",
    test: "Probar",
    testing: "Probando...",
    enable: "Activar",
    disable: "Desactivar",
    makePrimary: "Hacer principal",
    primary: "Principal",
    rotate: "Rotar acceso del transcriptor al audio",
    canary: "Enviar 1 audio",
    preview: "Preparar replay",
    sendBatch: "Enviar lote",
    batchSize: "Tamaño del lote",
    eligible: "Elegibles",
    notSent: "No enviados",
    pending: "Pendientes",
    delivering: "Enviando",
    accepted: "Aceptados",
    processing: "Procesando",
    transcribed: "Transcritos",
    failed: "Fallidos",
    conflict: "Conflictos",
    requiresReview: "Requieren atención",
    resolvedFailures: "Históricos resueltos",
    recent: "Entregas recientes",
    noDeliveries: "No hay entregas todavía.",
    noDestinations: "No hay destinos configurados.",
    retry: "Reintentar",
    classify: "Clasificar incidencia",
    editReview: "Editar revisión",
    failureCategory: "Tipo de incidencia",
    failureResolution: "Situación",
    categoryDependency: "Dependencia",
    categoryIncompatible: "Audio incompatible",
    categoryPolicy: "Política",
    categoryProvider: "Proveedor",
    resolutionActive: "Activa",
    resolutionResolved: "Resuelta",
    providerInvoked: "El proveedor fue invocado",
    policyLimit: "Límite por audio (minutos)",
    saveReview: "Guardar revisión",
    needsReview: "Requiere revisión",
    historicalResolved: "Incidencia histórica resuelta",
    blockedPolicy: "Bloqueada por política",
    dependencyFailure: "Fallo de dependencia",
    incompatibleArtifact: "Audio incompatible",
    providerFailure: "Fallo del proveedor",
    phase: "Fase",
    cause: "Causa",
    nextAction: "Siguiente acción",
    admissionPhase: "Admisión",
    processingPhase: "Procesamiento",
    unknownPhase: "No determinada",
    unclassifiedCause: "El transcriptor no proporcionó una causa segura suficiente.",
    dependencyCause: "Una dependencia necesaria del transcriptor impidió procesar el audio.",
    incompatibleCause: "El transcriptor rechazó la estructura o el formato de este audio.",
    providerCause: "El proveedor de transcripción devolvió un fallo durante el procesamiento.",
    policyCause: "Bloqueada por el límite de",
    providerNotInvoked: "El proveedor no fue invocado y no se generó coste del proveedor.",
    providerWasInvoked: "El proveedor fue invocado.",
    resolvedEvidence: "El defecto subyacente está marcado como corregido; esta entrega se conserva como evidencia.",
    reviewNext: "Clasifica la incidencia con evidencia del transcriptor.",
    resolvedNext: "Ninguna acción en Plaud Mirror.",
    policyNext: "Revisa el límite y reprocesa desde el transcriptor.",
    dependencyNext: "Corrige o verifica la dependencia y reprocesa desde el transcriptor.",
    incompatibleNext: "Normaliza el audio y reprocesa desde el transcriptor.",
    providerNext: "Revisa el proveedor y reprocesa desde el transcriptor.",
    attempts: "intentos",
    artifactToken: "Token de lectura de audio",
    tokenOnce: "Se muestra una sola vez. Debe provisionarse en el destino.",
    copy: "Copiar",
    copied: "Copiado",
    remaining: "pendientes de replay",
    tracked: "ya registrados",
    provider: "Proveedor",
    saveCredentials: "Actualizar credenciales",
    credentials: "Credenciales",
    destinationTabs: "Destinos de transcripción",
    enqueuedResult: "en cola",
    skippedResult: "omitidos",
    failedResult: "fallidos",
    additionalCostConfirm: "Ya hay otro destino de transcripcion activo. Activar este tambien puede duplicar el coste de procesamiento. Continuar?",
  },
  en: {
    title: "Integrations",
    subtitle: "Compatible transcription destinations",
    add: "Add destination",
    close: "Close",
    type: "Protocol",
    name: "Name",
    namePlaceholder: "Transcription service",
    destinationOrigin: "Transcription service origin",
    mirrorOrigin: "Public Plaud Mirror origin",
    intakeCredential: "Admission credential",
    statusSecret: "Signed status secret",
    create: "Create destination",
    creating: "Creating...",
    connected: "Connected",
    disabled: "Disabled",
    untested: "Not tested",
    degraded: "Error",
    test: "Test",
    testing: "Testing...",
    enable: "Enable",
    disable: "Disable",
    makePrimary: "Make primary",
    primary: "Primary",
    rotate: "Rotate transcriber audio access",
    canary: "Send 1 audio",
    preview: "Prepare replay",
    sendBatch: "Send batch",
    batchSize: "Batch size",
    eligible: "Eligible",
    notSent: "Not sent",
    pending: "Pending",
    delivering: "Delivering",
    accepted: "Accepted",
    processing: "Processing",
    transcribed: "Transcribed",
    failed: "Failed",
    conflict: "Conflicts",
    requiresReview: "Needs attention",
    resolvedFailures: "Historical resolved",
    recent: "Recent deliveries",
    noDeliveries: "No deliveries yet.",
    noDestinations: "No destinations configured.",
    retry: "Retry",
    classify: "Classify incident",
    editReview: "Edit review",
    failureCategory: "Incident type",
    failureResolution: "Status",
    categoryDependency: "Dependency",
    categoryIncompatible: "Incompatible audio",
    categoryPolicy: "Policy",
    categoryProvider: "Provider",
    resolutionActive: "Active",
    resolutionResolved: "Resolved",
    providerInvoked: "The provider was invoked",
    policyLimit: "Per-audio limit (minutes)",
    saveReview: "Save review",
    needsReview: "Needs review",
    historicalResolved: "Historical incident resolved",
    blockedPolicy: "Blocked by policy",
    dependencyFailure: "Dependency failure",
    incompatibleArtifact: "Incompatible audio",
    providerFailure: "Provider failure",
    phase: "Phase",
    cause: "Cause",
    nextAction: "Next action",
    admissionPhase: "Admission",
    processingPhase: "Processing",
    unknownPhase: "Undetermined",
    unclassifiedCause: "The transcriber did not provide enough safe diagnostic detail.",
    dependencyCause: "A required transcriber dependency prevented audio processing.",
    incompatibleCause: "The transcriber rejected this audio's structure or format.",
    providerCause: "The transcription provider failed during processing.",
    policyCause: "Blocked by the per-audio limit of",
    providerNotInvoked: "The provider was not invoked and no provider cost was incurred.",
    providerWasInvoked: "The provider was invoked.",
    resolvedEvidence: "The underlying defect is marked fixed; this delivery remains as audit evidence.",
    reviewNext: "Classify the incident using transcriber evidence.",
    resolvedNext: "No action in Plaud Mirror.",
    policyNext: "Review the limit and reprocess from the transcriber.",
    dependencyNext: "Fix or verify the dependency and reprocess from the transcriber.",
    incompatibleNext: "Normalize the audio and reprocess from the transcriber.",
    providerNext: "Review the provider and reprocess from the transcriber.",
    attempts: "attempts",
    artifactToken: "Audio read token",
    tokenOnce: "Shown once. Provision it in the destination.",
    copy: "Copy",
    copied: "Copied",
    remaining: "remaining for replay",
    tracked: "already tracked",
    provider: "Provider",
    saveCredentials: "Update credentials",
    credentials: "Credentials",
    destinationTabs: "Transcription destinations",
    enqueuedResult: "enqueued",
    skippedResult: "skipped",
    failedResult: "failed",
    additionalCostConfirm: "Another transcription destination is already active. Enabling this one can duplicate processing costs. Continue?",
  },
} as const;

export function TranscriptionIntegrations({ language, onUnauthorized }: Props) {
  const t = COPY[language];
  const [overview, setOverview] = useState<TranscriptionOverview>({ destinations: [] });
  const [deliveries, setDeliveries] = useState<MediaDelivery[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealedToken, setRevealedToken] = useState<{ destinationName: string; value: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<TranscriptionReplayPreview | null>(null);
  const [batchSize, setBatchSize] = useState("25");
  const [credentialDraft, setCredentialDraft] = useState({ intakeCredential: "", statusSigningSecret: "" });
  const [draft, setDraft] = useState<DestinationDraft>(() => ({
    name: "",
    baseUrl: "",
    artifactBaseUrl: window.location.origin,
    intakeCredential: "",
    statusSigningSecret: "",
  }));

  const selected = useMemo(
    () => overview.destinations.find((item) => item.destination.id === selectedId)
      ?? overview.destinations.find((item) => item.destination.primary)
      ?? overview.destinations[0]
      ?? null,
    [overview.destinations, selectedId],
  );

  useEffect(() => {
    setCredentialDraft({ intakeCredential: "", statusSigningSecret: "" });
  }, [selected?.destination.id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await requestJson<TranscriptionOverview>("/api/transcription");
        if (!cancelled) {
          setOverview(next);
          setSelectedId((current) => current ?? next.destinations.find((item) => item.destination.primary)?.destination.id ?? next.destinations[0]?.destination.id ?? null);
        }
      } catch (caught) {
        handleCaught(caught, onUnauthorized, setError);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [onUnauthorized]);

  useEffect(() => {
    if (!selected?.destination.id) {
      setDeliveries([]);
      return;
    }
    let cancelled = false;
    void requestJson<{ items: MediaDelivery[] }>(`/api/transcription/destinations/${selected.destination.id}/deliveries?limit=50`)
      .then((response) => { if (!cancelled) setDeliveries(response.items); })
      .catch((caught) => handleCaught(caught, onUnauthorized, setError));
    return () => { cancelled = true; };
  }, [selected?.destination.id, overview, onUnauthorized]);

  async function refresh(): Promise<void> {
    const next = await requestJson<TranscriptionOverview>("/api/transcription");
    setOverview(next);
    const id = selectedId ?? next.destinations[0]?.destination.id;
    if (id) {
      const response = await requestJson<{ items: MediaDelivery[] }>(`/api/transcription/destinations/${id}/deliveries?limit=50`);
      setDeliveries(response.items);
    }
  }

  async function createDestination(event: FormEvent): Promise<void> {
    event.preventDefault();
    await run("create", async () => {
      const created = await requestJson<TranscriptionDestinationCreated>("/api/transcription/destinations", {
        method: "POST",
        body: JSON.stringify({ ...draft, enabled: false, primary: true }),
      });
      setRevealedToken({ destinationName: created.destination.name, value: created.artifactAccessToken });
      setCopied(false);
      setSelectedId(created.destination.id);
      setShowAdd(false);
      setDraft((current) => ({ ...current, name: "", baseUrl: "", intakeCredential: "", statusSigningSecret: "" }));
      await refresh();
      return `${created.destination.name}: ${t.untested}`;
    });
  }

  async function testDestination(destination: TranscriptionDestination): Promise<void> {
    await run(`test:${destination.id}`, async () => {
      const result = await requestJson<TranscriptionConnectionTest>(`/api/transcription/destinations/${destination.id}/test`, { method: "POST" });
      await refresh();
      if (!result.ok) throw new Error(result.error ?? t.degraded);
      return `${result.providerName} ${result.providerVersion}`;
    });
  }

  async function patchDestination(destination: TranscriptionDestination, patch: Record<string, unknown>, action: string): Promise<void> {
    if (patch.enabled === true && overview.destinations.some((item) => item.destination.id !== destination.id && item.destination.enabled)) {
      if (!window.confirm(t.additionalCostConfirm)) return;
      patch = { ...patch, confirmAdditionalCost: true };
    }
    await run(action, async () => {
      await requestJson(`/api/transcription/destinations/${destination.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await refresh();
      return destination.name;
    });
  }

  async function rotateToken(destination: TranscriptionDestination): Promise<void> {
    await run(`rotate:${destination.id}`, async () => {
      const result = await requestJson<{ destination: TranscriptionDestination; artifactAccessToken: string }>(
        `/api/transcription/destinations/${destination.id}/rotate-artifact-token`,
        { method: "POST" },
      );
      setRevealedToken({ destinationName: destination.name, value: result.artifactAccessToken });
      setCopied(false);
      await refresh();
      return destination.name;
    });
  }

  async function enqueue(destination: TranscriptionDestination, limit: number): Promise<void> {
    await run(`enqueue:${destination.id}`, async () => {
      const result = await requestJson<EnqueueTranscriptionResult>(`/api/transcription/destinations/${destination.id}/enqueue`, {
        method: "POST",
        body: JSON.stringify({ limit }),
      });
      await refresh();
      return `${result.enqueued} ${t.enqueuedResult}, ${result.skipped} ${t.skippedResult}, ${result.failed} ${t.failedResult}`;
    });
  }

  async function loadPreview(destination: TranscriptionDestination): Promise<void> {
    await run(`preview:${destination.id}`, async () => {
      const result = await requestJson<TranscriptionReplayPreview>(`/api/transcription/destinations/${destination.id}/replay-preview`);
      setPreview(result);
      return `${result.remaining} ${t.remaining}`;
    });
  }

  async function retry(delivery: MediaDelivery): Promise<void> {
    await run(`retry:${delivery.id}`, async () => {
      await requestJson(`/api/transcription/deliveries/${delivery.id}/retry`, { method: "POST" });
      await refresh();
      return delivery.recordingTitle;
    });
  }

  async function reviewFailure(delivery: MediaDelivery, draft: FailureReviewDraft): Promise<void> {
    await run(`review:${delivery.id}`, async () => {
      await requestJson(`/api/transcription/deliveries/${delivery.id}/failure-review`, {
        method: "PATCH",
        body: JSON.stringify({
          category: draft.category,
          resolution: draft.resolution,
          providerInvoked: draft.providerInvoked,
          policyLimitMinutes: draft.category === "policy" ? Number(draft.policyLimitMinutes) : null,
        }),
      });
      await refresh();
      return delivery.recordingTitle;
    });
  }

  async function run(key: string, operation: () => Promise<string>): Promise<void> {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      setMessage(await operation());
    } catch (caught) {
      handleCaught(caught, onUnauthorized, setError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <div className="view-header">
        <div><h1>{t.title}</h1><p className="mono">{t.subtitle}</p></div>
        <button type="button" className="ghost-button" onClick={() => setShowAdd((value) => !value)}>{showAdd ? t.close : t.add}</button>
      </div>

      {error ? <div className="banner banner-error" role="alert">{error}</div> : null}
      {message ? <div className="banner banner-success" role="status">{message}</div> : null}
      {revealedToken ? (
        <section className="integration-token" aria-live="polite">
          <div><strong>{t.artifactToken}: {revealedToken.destinationName}</strong><span>{t.tokenOnce}</span></div>
          <code>{revealedToken.value}</code>
          <button type="button" className="ghost-button compact" onClick={() => void navigator.clipboard.writeText(revealedToken.value).then(() => setCopied(true))}>{copied ? t.copied : t.copy}</button>
        </section>
      ) : null}

      {showAdd ? (
        <form className="integration-form" onSubmit={(event) => void createDestination(event)}>
          <div className="form-kicker mono">{t.type}: Transcription Intake v1</div>
          <div className="integration-form-grid">
            <label className="field"><span>{t.name}</span><input placeholder={t.namePlaceholder} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label>
            <label className="field"><span>{t.destinationOrigin}</span><input type="url" placeholder="https://transcriber.internal" value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} required /></label>
            <label className="field"><span>{t.mirrorOrigin}</span><input type="url" value={draft.artifactBaseUrl} onChange={(event) => setDraft({ ...draft, artifactBaseUrl: event.target.value })} required /></label>
            <label className="field"><span>{t.intakeCredential}</span><input type="password" autoComplete="off" value={draft.intakeCredential} onChange={(event) => setDraft({ ...draft, intakeCredential: event.target.value })} required minLength={16} /></label>
            <label className="field"><span>{t.statusSecret}</span><input type="password" autoComplete="off" value={draft.statusSigningSecret} onChange={(event) => setDraft({ ...draft, statusSigningSecret: event.target.value })} required minLength={16} /></label>
          </div>
          <button disabled={busy === "create"}>{busy === "create" ? t.creating : t.create}</button>
        </form>
      ) : null}

      {overview.destinations.length > 1 ? (
        <div className="integration-tabs" role="tablist" aria-label={t.destinationTabs}>
          {overview.destinations.map(({ destination }, index) => (
            <button
              type="button"
              role="tab"
              id={`destination-tab-${destination.id}`}
              aria-controls={`destination-panel-${destination.id}`}
              aria-selected={selected?.destination.id === destination.id}
              tabIndex={selected?.destination.id === destination.id ? 0 : -1}
              className={selected?.destination.id === destination.id ? "active" : ""}
              onClick={() => { setSelectedId(destination.id); setPreview(null); }}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
                event.preventDefault();
                const tabs = overview.destinations;
                const nextIndex = event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
                const next = tabs[nextIndex];
                if (!next) return;
                const parent = event.currentTarget.parentElement;
                setSelectedId(next.destination.id);
                setPreview(null);
                window.requestAnimationFrame(() => parent?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus());
              }}
              key={destination.id}
            >{destination.name}</button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <DestinationView
          summary={selected}
          deliveries={deliveries}
          preview={preview}
          batchSize={batchSize}
          setBatchSize={setBatchSize}
          credentialDraft={credentialDraft}
          setCredentialDraft={setCredentialDraft}
          busy={busy}
          t={t}
          onTest={testDestination}
          onPatch={patchDestination}
          onRotate={rotateToken}
          onEnqueue={enqueue}
          onPreview={loadPreview}
          onRetry={retry}
          onReview={reviewFailure}
          tabbed={overview.destinations.length > 1}
        />
      ) : !showAdd ? <div className="empty-panel compact"><p className="mono subdued">{t.noDestinations}</p></div> : null}
    </section>
  );
}

function DestinationView({
  summary, deliveries, preview, batchSize, setBatchSize, credentialDraft,
  setCredentialDraft, busy, t, onTest, onPatch, onRotate, onEnqueue, onPreview, onRetry, onReview, tabbed,
}: {
  summary: TranscriptionDestinationSummary;
  deliveries: MediaDelivery[];
  preview: TranscriptionReplayPreview | null;
  batchSize: string;
  setBatchSize: (value: string) => void;
  credentialDraft: { intakeCredential: string; statusSigningSecret: string };
  setCredentialDraft: (value: { intakeCredential: string; statusSigningSecret: string }) => void;
  busy: string | null;
  t: typeof COPY.es | typeof COPY.en;
  onTest: (destination: TranscriptionDestination) => Promise<void>;
  onPatch: (destination: TranscriptionDestination, patch: Record<string, unknown>, action: string) => Promise<void>;
  onRotate: (destination: TranscriptionDestination) => Promise<void>;
  onEnqueue: (destination: TranscriptionDestination, limit: number) => Promise<void>;
  onPreview: (destination: TranscriptionDestination) => Promise<void>;
  onRetry: (delivery: MediaDelivery) => Promise<void>;
  onReview: (delivery: MediaDelivery, draft: FailureReviewDraft) => Promise<void>;
  tabbed: boolean;
}) {
  const { destination, coverage } = summary;
  const state = destination.enabled
    ? destination.lastTestError ? t.degraded : t.connected
    : destination.lastTestedAt ? t.disabled : t.untested;
  const tone = destination.enabled && !destination.lastTestError ? "good" : destination.lastTestError ? "bad" : "muted";
  return (
    <div
      className="integration-layout"
      {...(tabbed ? {
        role: "tabpanel",
        id: `destination-panel-${destination.id}`,
        "aria-labelledby": `destination-tab-${destination.id}`,
      } : {})}
    >
      <section className="integration-summary">
        <div className="card-title-row">
          <div><div className="mono form-kicker">Transcription Intake v1</div><strong>{destination.name}</strong></div>
          <span className={`state-pill tone-${tone}`}>{state}</span>
        </div>
        <div className="integration-meta">
          <span><small>{t.destinationOrigin}</small><strong className="mono">{destination.baseUrl}</strong></span>
          <span><small>{t.provider}</small><strong>{destination.providerName ? `${destination.providerName} ${destination.providerVersion ?? ""}` : "--"}</strong></span>
        </div>
        <div className="integration-actions">
          <button type="button" className="ghost-button" disabled={busy !== null} onClick={() => void onTest(destination)}>{busy === `test:${destination.id}` ? t.testing : t.test}</button>
          <button type="button" disabled={busy !== null || (!destination.enabled && (!destination.lastTestedAt || Boolean(destination.lastTestError)))} onClick={() => void onPatch(destination, { enabled: !destination.enabled }, `toggle:${destination.id}`)}>{destination.enabled ? t.disable : t.enable}</button>
          {!destination.primary ? <button type="button" className="ghost-button" disabled={busy !== null} onClick={() => void onPatch(destination, { primary: true }, `primary:${destination.id}`)}>{t.makePrimary}</button> : <span className="connector-pill">{t.primary}</span>}
          <button type="button" className="ghost-button" disabled={busy !== null} onClick={() => void onRotate(destination)}>{t.rotate}</button>
        </div>
        <details className="integration-credentials">
          <summary>{t.credentials}</summary>
          <form onSubmit={(event) => {
            event.preventDefault();
            void onPatch(destination, {
              ...(credentialDraft.intakeCredential ? { intakeCredential: credentialDraft.intakeCredential } : {}),
              ...(credentialDraft.statusSigningSecret ? { statusSigningSecret: credentialDraft.statusSigningSecret } : {}),
            }, `credentials:${destination.id}`).then(() => setCredentialDraft({ intakeCredential: "", statusSigningSecret: "" }));
          }}>
            <div className="integration-form-grid">
              <label className="field"><span>{t.intakeCredential}</span><input type="password" autoComplete="off" value={credentialDraft.intakeCredential} onChange={(event) => setCredentialDraft({ ...credentialDraft, intakeCredential: event.target.value })} /></label>
              <label className="field"><span>{t.statusSecret}</span><input type="password" autoComplete="off" value={credentialDraft.statusSigningSecret} onChange={(event) => setCredentialDraft({ ...credentialDraft, statusSigningSecret: event.target.value })} /></label>
            </div>
            <button type="submit" className="ghost-button" disabled={busy !== null || (!credentialDraft.intakeCredential && !credentialDraft.statusSigningSecret)}>{t.saveCredentials}</button>
          </form>
        </details>
      </section>

      <section className="integration-coverage">
        <div className="coverage-heading"><strong>{t.transcribed}</strong><span className="mono">{coverage.transcribed} / {coverage.eligible}</span></div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${coverage.eligible ? (coverage.transcribed / coverage.eligible) * 100 : 0}%` }} /></div>
        <div className="integration-metrics">
          {[
            [t.eligible, coverage.eligible], [t.notSent, coverage.notSent], [t.pending, coverage.pending],
            [t.accepted, coverage.accepted], [t.processing, coverage.processing], [t.transcribed, coverage.transcribed],
            [t.requiresReview, coverage.requiresReview], [t.resolvedFailures, coverage.resolvedFailures],
            [t.failed, coverage.failed], [t.conflict, coverage.conflict],
          ].map(([label, value]) => <span key={String(label)}><small>{label}</small><strong className="mono">{value}</strong></span>)}
        </div>
        <div className="integration-actions">
          <button type="button" disabled={!destination.enabled || busy !== null} onClick={() => void onEnqueue(destination, 1)}>{t.canary}</button>
          <button type="button" className="ghost-button" disabled={!destination.enabled || busy !== null} onClick={() => void onPreview(destination)}>{t.preview}</button>
        </div>
        {preview ? (
          <div className="replay-tool">
            <span className="mono">{preview.remaining} {t.remaining} · {preview.alreadyTracked} {t.tracked} · {formatBytes(preview.bytes)}</span>
            <label className="field compact"><span>{t.batchSize}</span><input type="number" min="1" max="100" value={batchSize} onChange={(event) => setBatchSize(event.target.value)} /></label>
            <button type="button" disabled={!destination.enabled || busy !== null || preview.remaining === 0} onClick={() => void onEnqueue(destination, Math.max(1, Math.min(100, Number(batchSize) || 1)))}>{t.sendBatch}</button>
          </div>
        ) : null}
      </section>

      <section className="integration-deliveries">
        <div className="card-title-row"><strong>{t.recent}</strong><span className="mono subdued">{deliveries.length}</span></div>
        {deliveries.length === 0 ? <p className="mono empty-list compact">{t.noDeliveries}</p> : (
          <div className="delivery-list">
            {deliveries.map((delivery) => {
              const presentation = deliveryPresentation(delivery, t);
              const isFailure = delivery.state === "failed" || delivery.state === "conflict";
              return (
                <div className="delivery-row" key={delivery.id}>
                  <div className="delivery-identity">
                    <strong>{delivery.recordingTitle}</strong>
                    <span className="mono">
                      {delivery.recordingId} · {formatDeliveryMinutes(delivery.durationSeconds)} min · {delivery.artifactRevision.slice(0, 18)}...
                    </span>
                  </div>
                  <span className={`state-pill tone-${presentation.tone}`}>{presentation.label}</span>
                  {delivery.retryable && delivery.failureReview?.resolution !== "resolved" ? <button type="button" className="ghost-button compact" disabled={busy !== null} onClick={() => void onRetry(delivery)}>{t.retry}</button> : null}
                  {isFailure ? (
                    <div className="delivery-diagnostics">
                      <span><small>{t.phase}</small><strong>{presentation.phase}</strong></span>
                      <span><small>{t.cause}</small><strong>{presentation.cause}</strong></span>
                      <span><small>{t.nextAction}</small><strong>{presentation.nextAction}</strong></span>
                    </div>
                  ) : null}
                  {isFailure ? (
                    <FailureReviewEditor
                      delivery={delivery}
                      busy={busy === `review:${delivery.id}`}
                      disabled={busy !== null}
                      t={t}
                      onReview={onReview}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function FailureReviewEditor({
  delivery,
  busy,
  disabled,
  t,
  onReview,
}: {
  delivery: MediaDelivery;
  busy: boolean;
  disabled: boolean;
  t: typeof COPY.es | typeof COPY.en;
  onReview: (delivery: MediaDelivery, draft: FailureReviewDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<FailureReviewDraft>(() => ({
    category: delivery.failureReview?.category ?? "dependency",
    resolution: delivery.failureReview?.resolution ?? "active",
    providerInvoked: delivery.failureReview?.providerInvoked ?? false,
    policyLimitMinutes: delivery.failureReview?.policyLimitMinutes?.toString() ?? "",
  }));
  const policyLimitValid = draft.category !== "policy" || Number(draft.policyLimitMinutes) > 0;

  return (
    <details className="delivery-review">
      <summary>{delivery.failureReview ? t.editReview : t.classify}</summary>
      <form onSubmit={(event) => {
        event.preventDefault();
        void onReview(delivery, draft);
      }}>
        <label className="field compact">
          <span>{t.failureCategory}</span>
          <select value={draft.category} onChange={(event) => setDraft({
            ...draft,
            category: event.target.value as MediaDeliveryFailureCategory,
            policyLimitMinutes: event.target.value === "policy" ? draft.policyLimitMinutes : "",
          })}>
            <option value="dependency">{t.categoryDependency}</option>
            <option value="incompatible_artifact">{t.categoryIncompatible}</option>
            <option value="policy">{t.categoryPolicy}</option>
            <option value="provider">{t.categoryProvider}</option>
          </select>
        </label>
        <label className="field compact">
          <span>{t.failureResolution}</span>
          <select value={draft.resolution} onChange={(event) => setDraft({ ...draft, resolution: event.target.value as FailureReviewDraft["resolution"] })}>
            <option value="active">{t.resolutionActive}</option>
            <option value="resolved">{t.resolutionResolved}</option>
          </select>
        </label>
        {draft.category === "policy" ? (
          <label className="field compact">
            <span>{t.policyLimit}</span>
            <input type="number" min="0.01" max="100000" step="0.01" required value={draft.policyLimitMinutes} onChange={(event) => setDraft({ ...draft, policyLimitMinutes: event.target.value })} />
          </label>
        ) : null}
        <label className="checkbox-row delivery-provider-check">
          <input type="checkbox" checked={draft.providerInvoked} onChange={(event) => setDraft({ ...draft, providerInvoked: event.target.checked })} />
          <span>{t.providerInvoked}</span>
        </label>
        <button type="submit" className="ghost-button" disabled={disabled || !policyLimitValid}>{busy ? "..." : t.saveReview}</button>
      </form>
    </details>
  );
}

function deliveryPresentation(
  delivery: MediaDelivery,
  t: typeof COPY.es | typeof COPY.en,
): { label: string; tone: "good" | "warn" | "bad" | "info" | "muted"; phase: string; cause: string; nextAction: string } {
  if (delivery.state !== "failed" && delivery.state !== "conflict") {
    return {
      label: deliveryLabel(delivery.state, t),
      tone: deliveryTone(delivery.state),
      phase: t.unknownPhase,
      cause: "",
      nextAction: "",
    };
  }

  const phase = delivery.failureStage === "admission"
    ? t.admissionPhase
    : delivery.failureStage === "processing" ? t.processingPhase : t.unknownPhase;
  const review = delivery.failureReview;
  if (!review) {
    return { label: t.needsReview, tone: "bad", phase, cause: t.unclassifiedCause, nextAction: t.reviewNext };
  }
  if (review.resolution === "resolved") {
    return {
      label: t.historicalResolved,
      tone: "info",
      phase,
      cause: `${categoryCause(review.category, t)} ${t.resolvedEvidence}`,
      nextAction: t.resolvedNext,
    };
  }
  if (review.category === "policy") {
    const limit = review.policyLimitMinutes === null ? "--" : formatNumber(review.policyLimitMinutes, t);
    return {
      label: t.blockedPolicy,
      tone: "warn",
      phase,
      cause: `${t.policyCause} ${limit} min. ${review.providerInvoked ? t.providerWasInvoked : t.providerNotInvoked}`,
      nextAction: t.policyNext,
    };
  }
  const label = review.category === "dependency"
    ? t.dependencyFailure
    : review.category === "incompatible_artifact" ? t.incompatibleArtifact : t.providerFailure;
  const nextAction = review.category === "dependency"
    ? t.dependencyNext
    : review.category === "incompatible_artifact" ? t.incompatibleNext : t.providerNext;
  return { label, tone: "bad", phase, cause: categoryCause(review.category, t), nextAction };
}

function categoryCause(category: MediaDeliveryFailureCategory, t: typeof COPY.es | typeof COPY.en): string {
  switch (category) {
    case "dependency": return t.dependencyCause;
    case "incompatible_artifact": return t.incompatibleCause;
    case "policy": return t.blockedPolicy;
    case "provider": return t.providerCause;
  }
}

function formatDeliveryMinutes(durationSeconds: number): string {
  return (durationSeconds / 60).toFixed(2);
}

function formatNumber(value: number, t: typeof COPY.es | typeof COPY.en): string {
  return value.toLocaleString(t === COPY.es ? "es-ES" : "en-US", { maximumFractionDigits: 2 });
}

function deliveryTone(state: MediaDelivery["state"]): "good" | "warn" | "bad" | "info" | "muted" {
  if (state === "transcribed") return "good";
  if (state === "failed" || state === "conflict") return "bad";
  if (state === "accepted" || state === "processing" || state === "delivering") return "info";
  return "muted";
}

function deliveryLabel(state: MediaDelivery["state"], t: typeof COPY.es | typeof COPY.en): string {
  switch (state) {
    case "pending": return t.pending;
    case "delivering": return t.delivering;
    case "accepted": return t.accepted;
    case "processing": return t.processing;
    case "transcribed": return t.transcribed;
    case "failed": return t.failed;
    case "conflict": return t.conflict;
  }
}

function handleCaught(
  caught: unknown,
  onUnauthorized: () => void,
  setError: (message: string) => void,
): void {
  if (caught instanceof UnauthorizedError) {
    onUnauthorized();
    return;
  }
  setError(caught instanceof Error ? caught.message : String(caught));
}
