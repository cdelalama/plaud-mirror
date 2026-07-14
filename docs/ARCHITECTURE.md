<!-- doc-version: 0.11.2 -->
# Plaud Mirror Architecture

> Version: 0.11.2
> Last Updated: 2026-07-14
> Status: Phase 6 has an authenticated permanent-Plaud-delete workflow for already-dismissed recordings. v0.11.2 makes its fail-closed guard reusable and pins both 403/401 authorization modes in tests. The PT15M/PT2H protocol contract is unchanged; the independent Phase 3 post-deploy soak and live webhook exit gate remain open.

## Overview

Plaud Mirror is a single-operator, server-first service that:

1. stores an encrypted Plaud bearer token,
2. validates and uses that token against Plaud,
3. mirrors audio artifacts into `recordings/<recording-id>/`,
4. records local state in SQLite,
5. emits a signed webhook for each mirrored recording,
6. serves a local web panel for setup and manual control,
7. publishes sync state through `home-infra-protocol` for infra consumers,
8. optionally performs an explicit operator-authorized permanent deletion from Plaud after local dismissal.

## Runtime Shape

- **Backend:** Fastify in `apps/api`
- **Panel:** React + Vite in `apps/web`; as of `v0.9.0` it uses a reference-driven five-screen operator shell (Main, Library, Backfill, Configuration, Operations) with ES/EN chrome persisted in browser storage
- **Plaud connector:** local unpacked Chrome extension in `apps/chrome-extension`
- **Shared contracts:** Zod schemas in `packages/shared`, including runtime and `home-infra-protocol` status snapshot schemas
- **Infra contract:** `infra.contract.yml` plus `docs/INFRA_CONTRACT.md`
- **State store:** SQLite at `data/app.db`
- **Secrets:** encrypted JSON blob at `data/secrets.enc`
- **Artifacts:** filesystem under `recordings/<recording-id>/`
- **Packaging:** single Docker container serving both API and panel

## What Phase 2 Shipped

Phase 2 was the first usable manual slice. It included:

- token save + validation
- manual sync
- filtered historical backfill
- recordings list
- webhook configuration
- HMAC-signed delivery attempts
- Docker launch on `dev-vm`

## Runtime Evolution Since Phase 3

Phase 3 turns the manual slice into an unattended service. The later `0.7.x`-`0.9.x` line builds the operator re-auth and panel UX around that runtime:

- **`v0.5.0` (regressed, do not deploy):** introduced the scheduler module and the partial `health.scheduler` block, but with two bugs — the scheduler arranged a 15-minute default when `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` was unset (silently turning on for upgrading operators), and the documented service-level anti-overlap was missing in code (`startMirror` inserted a new `sync_runs` row on every call without consulting `getActiveSyncRun`). See CHANGELOG `[0.5.1]` for the post-mortem.
- **`v0.5.1` (stable Phase 3 entry):** scheduler is genuinely opt-in (default `0` = disabled); `runScheduledSync()` / `runSync` consult `store.getActiveSyncRun()` before inserting and return the existing run id when one is active; the scheduler tick reports `lastTickStatus = "skipped"` (with reason in `lastTickError`) when the service-layer absorbs the tick, instead of mislabelling it as `completed`. 9 regression tests (env-var matrix, concurrent `runSync` reuse, scheduler `runTick → { skipped: true }` path).
- **`v0.5.2`:** panel-driven scheduler configuration. New `RuntimeConfig.schedulerIntervalMs` field (persisted in SQLite via the existing `settings` key/value table, same pattern as `webhookUrl`), new `SchedulerManager` (`apps/api/src/runtime/scheduler-manager.ts`) that swaps the underlying `Scheduler` in place when the interval changes, new "Continuous sync scheduler" card on the Configuration tab. `PUT /api/config` accepts an optional `schedulerIntervalMs`; the env var is downgraded to a one-time seed (`RuntimeStore.seedSchedulerDefaults`). 9 tests covering the new path.
- **`v0.5.3` (this release):** durable webhook outbox (D-013). New SQLite table `webhook_outbox` with FSM `pending → delivering → delivered | retry_waiting → permanently_failed`. New `OutboxWorker` (`apps/api/src/runtime/outbox-worker.ts`, 5-second cadence, reuses the existing `Scheduler` for the timer, recomputes the HMAC at delivery time so a rotated `webhookSecret` is honoured). Exponential backoff `[30s, 2m, 10m, 30m, 1h, 2h, 4h, 8h]` and `OUTBOX_MAX_ATTEMPTS = 8`. `service.processRecording` enqueues instead of POSTing; `lastWebhookStatus` enum gains `"queued"`. New routes `GET /api/outbox` (failed list) and `POST /api/outbox/:id/retry`; new `health.outbox` counters block (`pending` / `retryWaiting` / `permanentlyFailed` / `oldestPendingAgeMs`); new `SyncRunSummary.enqueued` counter. Panel gains a "Webhook outbox" card with counters + failed-list + Retry buttons. 11 new tests covering the FSM, the worker, and the HTTP shape.
- **`v0.5.5`:** full health observability — `lastErrors` ring buffer (cross-subsystem, in-memory, cap LAST_ERRORS_CAP=20, most-recent-first) + `recentSyncRuns` (last 5 finished runs from SQLite, `finished_at DESC`) on `/api/health` (D-014, full). New `service.recordError(subsystem, message, context?)` wired from the scheduler-manager `onTick` callback (failed ticks only), the outbox-worker `onDeliveryError` callback (both `retry` and `permanent` escalations), and the service `runSync` catch path. Plus governance: `prose-drift` validator wrapper hardened from `WARN` to `FAIL` after one calibration release; new `check_unabsorbed_artifact()` ninth validator check (D-017) with a baseline file mirroring the prose-drift precedent. 3 new tests (ring buffer cap+ordering+cross-subsystem, sync-error feeds lastErrors, recentSyncRuns surfaces last 5).
- **`v0.6.0` (this release, Phase 3 hardening):** three fixes from the 2026-06-10 security review, all prerequisites for the soak exit gate. (1) **Operator access control** (D-018): `PLAUD_MIRROR_ADMIN_PASSPHRASE` env var; when set, an `onRequest` hook returns 401 for every `/api/*` request without a valid `plaud_mirror_session` cookie (HMAC-signed, key derived from master key + passphrase, 30-day TTL, HttpOnly + SameSite=Lax), with a public allowlist (`/api/health` redacting `auth.userSummary`, `/api/session*`); new module `apps/api/src/runtime/operator-auth.ts`; the panel boots through a `LoginGate`. (2) **Startup crash recovery** (D-013 amendment): `service.initialize()` runs `store.recoverOrphanedSyncRuns()` (running → failed) and `store.recoverOrphanedOutboxItems()` (delivering → retry_waiting due now, attempts preserved, at-least-once accepted); both feed `health.lastErrors`. (3) **Plaud client timeouts**: every `PlaudClient` request carries `AbortSignal.timeout(requestTimeoutMs)` (default 30 s) and surfaces a clear `timed out after Nms` error; audio downloads carry a 10-minute ceiling (`AUDIO_DOWNLOAD_TIMEOUT_MS`). Tests: 116 → 130 (116 backend + 14 web).
- **`v0.9.0`:** reference-driven operator panel redesign. No backend routes or shared runtime schemas changed; the React panel reorganizes the existing contract surface into Main (health/status, next action, KPIs, coverage, latest sync, recent errors), Library (search, compact/full playback controls, dismiss/restore, pagination), Backfill (filters + live dry-run preview), Configuration (operator re-auth, manual token fallback, webhook, scheduler, technical read-only state), and Operations (recent sync runs, outbox retry, error log). The UI chrome supports Spanish/English switching and persists the operator preference in local storage. Tests: 148 → 150.
- **`v0.9.1`:** full-viewport shell patch. The `v0.9.0` visual system stays intact, but the outer presentation frame is no longer production layout: the app removes the centered max-width card, fills the viewport, keeps the 212px rail fixed to the left edge on desktop, and moves vertical scroll into `.operator-content`. No route, schema, storage, auth, or sync behavior changed.
- **`v0.9.2`:** Main sync UX patch. The Main cockpit's "Sync missing" action no longer reads the Historical Backfill draft limit (default `1`). It computes the currently displayed missing count from health (`plaudTotal - local - dismissed`), sends that as the sync limit capped at 1000, and asks for confirmation before high-volume downloads. The Backfill form keeps its conservative default because it is an advanced filtered tool. No backend route, schema, storage, auth, or sync-engine behavior changed.
- **`v0.9.3`:** governance/tooling patch. A raw LLM-DocKit sync added Trace Protocol support but clobbered Plaud Mirror's local validator extensions. The merged result keeps trace-protocol onboarding/bootstrap/validation while restoring `handoff-start-here-sync`, `prose-drift`, `unabsorbed-artifact`, and `json-version` handling. No runtime behavior changed.
- **`v0.9.4`:** Library UX patch. Compact Play now controls the real row audio element instead of only toggling React state; Full mode uses a wider native player column on desktop; and the Library recordings table owns the scroll region under the fixed Library header/toolbar/pagebar. No backend route, schema, storage, auth, or sync-engine behavior changed.
- **`v0.9.5`:** mobile shell UX patch. The mobile operator rail uses a labeled native view selector instead of icon-only navigation, the status strip becomes one compact horizontal chip row, and Library row actions stay top-right on narrow screens. No backend route, schema, storage, auth, sync-engine, scheduler, webhook, secret, or `.env` behavior changed.
- **`v0.9.6`:** governance/tooling patch. LLM-DocKit 4.9.6 is synced with flexible HISTORY format validation, Trace v1.3 chat `Sent` guidance with seconds, expanded version marker handlers, package-lock version enforcement, and Plaud Mirror's local validator guardrails preserved. No backend route, schema, storage, auth, sync-engine, scheduler, webhook, secret, UI runtime behavior, or `.env` behavior changed.
- **`v0.10.0`:** Home Infra Protocol sync-job adoption. The existing Plaud sync engine remains authoritative; no download, outbox, scheduler, storage, secret, or `.env` behavior changes. New shared protocol schemas model `status-snapshot.schema.json`; `apps/api/src/runtime/protocol-status.ts` maps `ServiceHealth` to a sanitized protocol snapshot; `GET /api/protocol/sync-jobs/plaud-mirror-recordings-sync/status` and `/api/protocol/status` expose it publicly with `Cache-Control: no-store`. `infra.contract.yml` declares `plaud-mirror-recordings-sync` under `sync_jobs[]` with `schedule.mode: manual` and `stale_after: P1D`, because the live scheduler is disabled until the soak starts. When scheduler operation becomes the intended mode, change the contract to `internal-loop` and add cadence.
- **`v0.10.3`:** pre-soak integrity patch. Audio replacement uses temporary
  files plus `fsync` and atomic rename; selection and preview reconcile SQLite
  paths against physical size; candidate errors increment a durable `failed`
  counter, preserve recording-id context, continue with later candidates, and
  close the run as failed; concurrent backfill requests return HTTP 409.
- **`v0.10.4`:** pre-soak execution patch. Scheduled ticks await the actual
  sync result; a one-hour whole-run signal cancels Plaud requests and audio
  streams; pagination rejects repeated pages and has a hard page ceiling;
  outbox setup failures return claims to retry and all eight backoff windows
  precede a ninth final attempt; SIGTERM/SIGINT drain active work; compose adds
  `/api/health` liveness; production and full dependency audits are clean.
- **`v0.10.5`:** evidence-only patch. The hung-request timeout test keeps an
  ordinary event-loop handle while awaiting Node 20's unref'ed
  `AbortSignal.timeout()` timer. Runtime behavior and contracts are unchanged.
- **`v0.10.6`:** evidence-only patch. The service whole-run timeout test uses
  the same Node 20 keepalive pattern. Runtime behavior remains unchanged.
- **`v0.10.7`:** soak activation contract. `infra.contract.yml` moves from
  `manual/P1D` to `internal-loop`, `cadence: PT15M`, `stale_after: PT2H`, and
  records Home Infra Protocol 0.9.0. Runtime scheduling remains owned by the
  existing in-process loop.
- **`v0.10.2`:** pre-soak evidence patch. CI runs the complete Node 20 gate,
  the React panel is typechecked, Node/integration tests are discovered rather
  than enumerated, Docker context excludes secrets and host build artifacts,
  and idle panels discover scheduler-started runs before switching to fast
  polling. No backend API, persistence schema, or sync selection changed.
- **`v0.10.1`:** sync-run summary counter patch. `ProcessRecordingResult.skipped` now means candidate-level sync skip only; disabled-webhook delivery still writes `RecordingMirror.lastWebhookStatus = "skipped"` but no longer increments `SyncRunSummary.skipped`. No API shape, sync selection, storage schema, protocol mapper, secret, or `.env` behavior changed.
- **`v0.11.0`:** Phase 6 operator workflow. A dismissed row may issue one
  authenticated permanent-Plaud-delete command after a single explicit
  confirmation. The client performs Plaud's observed trash-then-delete sequence;
  SQLite keeps an irreversible `upstream_deleted_at` tombstone and sync keeps
  skipping the row. The Home Infra Protocol producer surface is unchanged.
- **`v0.11.1`:** security patch. The irreversible upstream route rejects with
  403 before service execution when operator access control is not configured,
  even though non-destructive API routes may stay open for local development.
- **`v0.11.2`:** audit hardening patch. The destructive guard is a reusable
  pre-handler, the configured-auth anonymous 401 has route-specific coverage,
  and the recoverable partial trash/delete state is documented.

Still **not** in Phase 3 scope:

- resumable backfill (deferred; ROADMAP mentions but no firm release target)
- automatic re-login → [Phase 4](ROADMAP.md)
- NAS rollout → [Phase 5](ROADMAP.md)
- public OSS polish → [Phase 6](ROADMAP.md)

## Key Flows

### Operator access control (D-018, v0.6.0)

1. The deployment sets `PLAUD_MIRROR_ADMIN_PASSPHRASE` (same channel as the master key). Unset = open API + explicit `health.warnings` entry.
2. The panel boots via `GET /api/session`; when `authRequired` and not authenticated, a login screen replaces the panel.
3. `POST /api/session/login` validates the passphrase (constant-time over SHA-256 digests, throttled to 5 failures/minute) and sets a stateless HMAC-signed cookie: `<expiresAtMs>.<HMAC>` keyed by `sha256(context : masterKey : passphrase)` — rotating either secret invalidates all sessions.
4. An `onRequest` hook rejects unauthenticated `/api/*` requests (401) except `GET /api/health` (redacted: `auth.userSummary` stripped) and `/api/session*`. Static assets stay public; all data lives behind `/api/*`.

### Auth (operator → Plaud)

1. The operator provides a Plaud bearer token one of two ways:
   - **Manual paste** (fallback): paste the bearer in the panel → `POST /api/auth/token`.
   - **Browser-assisted capture** (D-019, v0.7.0, the for-dummies path): see "Plaud re-auth capture" below.
2. API validates it with `/user/me` (both paths converge on `service.saveAccessToken`). Since `v0.8.1`, Plaud API calls use Plaud Web's browser context (`Origin` / `Referer` `https://web.plaud.ai`, browser-like user agent, and browser `sec-fetch-*` headers); the operator confirmed the same captured token returns `200` from Plaud Web while the old custom server fingerprint returned an HTML 403.
3. Token is encrypted with `PLAUD_MIRROR_MASTER_KEY` and stored at rest.
4. Auth status is exposed through `/api/auth/status` and `/api/health`.

### Plaud re-auth capture (D-019, v0.7.0; extension in v0.8.0)

The operator's account is Google SSO, so there is no Plaud password to store and credentials-login is unavailable; the official OAuth/MCP is deferred. Re-auth therefore captures the bearer the browser already holds, via a panel-initiated handshake that binds the token swap to operator intent (token-fixation defence):

1. Panel "Reconectar Plaud" → `POST /api/connect/start` (operator-session-gated) mints a single-use `captureId` (`CaptureSessionStore`, in-memory, TTL 10 min). The panel stashes it in the mirror's own `localStorage` and opens `app.plaud.ai`.
2. On the Plaud tab (logged in via Google), the operator presses the local **Plaud Mirror Connector** Chrome extension. The extension injects a small storage reader into Chrome's `MAIN` world, extracts the user bearer from Plaud's browser storage (`pld_tokenstr` first, full storage scan fallback), and navigates that tab to `<mirror>/connect#token=...`. The extension uses `activeTab` + `scripting`, stores only the mirror origin, and never stores or logs the Plaud token. The bookmarklet remains copy-only fallback because React/Chrome made a draggable `javascript:` link unreliable.
3. `/connect` (served by the SPA; public path, but its POST is gated) strips the fragment with `history.replaceState`, reads the `captureId` from mirror `localStorage`, and `POST /api/connect/complete { token, captureId }`.
4. The backend consumes the `captureId` (single-use, must be live → else 409), then validates the bearer against Plaud and stores it via `service.saveAccessToken`.

The bearer travels only in a URL fragment (never sent to a server, never logged) and one same-origin authenticated POST. The ~300-day TTL means this is a roughly-once-a-year interaction.

### Operator panel shell (v0.9.0)

The `apps/web` panel is intentionally a single-operator cockpit, not a SaaS dashboard. It absorbs `docs/design/reference/plaud-mirror-panel-standalone.html` as the visual source of truth while keeping the existing React/Vite runtime and API contracts:

1. **Main** reads `GET /api/health` for auth/sync/scheduler/outbox status, Plaud/local counts, coverage, warnings, latest sync, and recent errors. Status segments jump to Operations or Configuration as appropriate.
2. **Library** reads `GET /api/recordings` and `GET /api/recordings/:id/audio`, then calls existing dismiss/restore routes. Search, dismissed visibility, page size, and compact/full player state are local UI concerns.
3. **Backfill** uses `GET /api/devices`, `GET /api/backfill/candidates`, and `POST /api/backfill/run`. The preview recalculates when filters change and shares the server's `BackfillCandidate` states (`missing`, `mirrored`, `dismissed`).
4. **Configuration** uses the existing session-gated auth/config/connect routes: `/api/connect/start`, `/api/auth/token`, `PUT /api/config`, plus the current Chrome extension and copy-only bookmarklet fallback.
5. **Operations** uses `/api/health`, `GET /api/outbox`, `POST /api/outbox/:id/retry`, and `GET /api/sync/runs/:id` polling through the same helpers as Main.

The language selector only translates operator chrome. Recording titles, raw error strings, and log-like content stay verbatim so diagnostics are not rewritten.

### Sync / Backfill (Mode B — download up to N missing, async)

1. Operator triggers `POST /api/sync/run` or `POST /api/backfill/run` with a `limit` (0–1000). The API returns `202 Accepted` with `{ id, status: "running" }` immediately — it does **not** wait for the download work.
2. The service registers a `sync_runs` row (`status = "running"`, no `finished_at`) and hands the actual work to a pluggable scheduler. The default scheduler is `setImmediate`; tests inject a deterministic scheduler that settles on demand.
3. Background work validates the stored token.
4. `client.listEverything()` paginates Plaud's full listing (`/file/simple/web?skip=N&limit=500`) until a page arrives shorter than 500 — signal of the last page. Every recording in the account is captured in date-desc order, plus the authoritative `plaudTotal`. Stable sequence numbers are recomputed from the oldest-first order.
5. Local filters are applied (date range, serial number, scene) if any.
6. Candidate selection walks the filtered list newest-first and keeps a recording when it is **not dismissed** AND (if `forceDownload=false`) lacks a verified local artifact. Verification requires a regular non-empty file whose size matches `bytesWritten`; a stale SQLite `localPath` alone is not coverage. Webhook state remains unrelated. Stops at `limit` candidates. `limit=0` is legal and means "refresh listing and ranks, download nothing."
7. Each candidate resolves detail and temp URL, downloads the artifact, writes:
   - `recordings/<recording-id>/audio.<ext>` via same-directory temporary file,
     file `fsync`, then atomic rename
   - `recordings/<recording-id>/metadata.json`
   - After each candidate the run row is updated via `store.updateSyncRunProgress` so the panel sees `downloaded` and `failed` move in real time.
8. A candidate error is recorded with its recording id and processing continues. Recording state is upserted only after a successful atomic download. The summary records `examined`, `matched`, `downloaded`, `failed`, and `plaudTotal`; any non-zero `failed` finalizes the run as `failed` with a durable error summary, even when later candidates succeeded.

The web panel polls `GET /api/health` every 2 s while a run is active. The health payload splits state into two fields: `lastSync` holds the last COMPLETED run (drives "Last run" stats, "Plaud total", and the hero metric) and stays pinned while a new run is in flight; `activeRun` holds the running run (drives the progress banner). Polling stops once `activeRun` becomes `null` — at that point `lastSync.id` matches the run's id and the final summary is surfaced. The pre-0.4.7 semantics ("look at the N newest recordings Plaud has and skip ones that are already mirrored") silently did nothing when the N newest were all already local. Mode B instead walks as deep as needed to find N genuine gaps.

### Home Infra Protocol sync status (v0.10.0)

Plaud Mirror publishes its Plaud recording sync as a `home-infra-protocol`
`sync_jobs[]` producer. The project contract lives in `infra.contract.yml` and
the human explanation lives in `docs/INFRA_CONTRACT.md`.

The status endpoint is public like `/api/health`, but sanitized:

- `GET /api/protocol/sync-jobs/plaud-mirror-recordings-sync/status`
- `GET /api/protocol/status` (alias)

Both routes return the protocol `status-snapshot` shape: `observed_at`,
`condition`, `severity`, `summary`, and `checks[]`. The snapshot is derived
from existing runtime truth (`ServiceHealth`), not a second database or a new
sync mechanism. It includes Plaud auth state, latest/active sync, coverage
counts, scheduler state, and webhook outbox state.

`observed_at` is anchored to sync evidence rather than request time: active run
`startedAt`, latest sync `finishedAt`, auth validation time, then current time
only as first-boot fallback. Consumers therefore derive freshness from
`observed_at + stale_after` without every HTTP read pretending to be a fresh
source sync.

The soak contract declares `schedule.mode: internal-loop`, `cadence: PT15M`,
and `stale_after: PT2H`. The freshness budget exceeds cadence plus the one-hour
maximum runtime.

### Webhook (durable outbox, D-013, v0.5.3+)

1. After mirroring, `service.enqueueOrSkipWebhook(recording, mode)` builds the `recording.synced` payload and inserts a row into `webhook_outbox` with `state = 'pending'`. The recording row is updated with `lastWebhookStatus = "queued"`. **No HTTP call happens during the sync run.** When no webhook URL or secret is configured, the helper short-circuits to `lastWebhookStatus = "skipped"` and never enqueues.
2. The `OutboxWorker` runs an independent `setTimeout` loop at 5-second cadence. Each tick atomically claims one row (`pending` or `retry_waiting` whose `next_attempt_at` is due) by transitioning it to `delivering` via a guarded `UPDATE`. The atomic claim ensures a worker tick and a panel-triggered retry cannot pick the same row twice.
3. The worker recomputes the HMAC signature at delivery time using the current `webhookSecret` (so an operator-rotated secret is honoured for items already in the queue) and stamps `sync.deliveryAttempt` to the current attempt number. POSTs to the configured `webhookUrl` with `AbortSignal.timeout(requestTimeoutMs)`.
4. On a 2xx response: `markOutboxDelivered` (state → `delivered`, attempts++) plus a `webhook_deliveries` audit row with status `success`.
5. On a non-2xx response or thrown error: a `webhook_deliveries` row with status `failed` is recorded, then either `markOutboxRetry(id, nextAttemptAt, error)` (state → `retry_waiting`, attempts++, `next_attempt_at = now + backoff[attempts]`) or `markOutboxPermanentlyFailed(id, error)` (state → `permanently_failed`, attempts++) when `attempts >= OUTBOX_MAX_ATTEMPTS`. Backoff schedule: `[30s, 2m, 10m, 30m, 1h, 2h, 4h, 8h]` — cumulative ~16 h before escalating.
6. The panel polls `health.outbox` (`pending` / `delivering` / `retryWaiting` / `permanentlyFailed` / `oldestPendingAgeMs`) and `GET /api/outbox` (the list of `permanently_failed` rows) to render the outbox section in Operations. `POST /api/outbox/:id/retry` resets a `permanently_failed` row to `pending` (`attempts = 0`, `last_error = null`) so the worker re-attempts on its next tick.
7. The legacy `webhook_deliveries` table stays as-is (append-only audit log; every attempt records a row regardless of success/failure). The new `webhook_outbox` table holds live retry state — once a row reaches `delivered` or `permanently_failed`, the worker never touches it again.

### Local curation (audition, dismiss, optionally delete upstream)

1. The operator auditions an audio file inline in the web panel via `GET /api/recordings/<id>/audio`, which streams the local file with its original content-type. Recording ids are validated against a strict character allowlist before any filesystem access, and the resolved path is confirmed to stay inside the configured recordings directory.
2. The operator may issue `DELETE /api/recordings/<id>`. The service unlinks the local audio file, clears `localPath` and `bytesWritten` on the SQLite row, and sets `dismissed=true` with a `dismissedAt` timestamp. Plaud itself is not touched by this command.
3. Subsequent sync/backfill runs detect `dismissed=true` and skip the recording without attempting to re-download it.
4. The operator can restore a dismissed recording via `POST /api/recordings/<id>/restore`. The service clears the `dismissed` flag **and immediately re-downloads the audio** (fetching fresh `/file/detail` and `/file/temp-url` from Plaud, then writing the artifact back to `recordings/<id>/audio.<ext>`). If the immediate download fails (e.g. missing or invalid token), the flag is still cleared so the next scheduled sync can retry, and the API surfaces the error so the operator can recover.
5. A dismissed row also offers `DELETE /api/recordings/<id>/plaud`. The panel
   asks once, explicitly stating that the original disappears from Plaud. The
   server re-validates operator auth and dismissed state, places the remote
   recording in Plaud trash when needed, then permanently deletes it.
6. Success sets `upstream_deleted_at`. That tombstone is monotonic: later
   UPSERTs cannot clear it, Restore returns `410`, and the row remains dismissed
   so delayed listings cannot recreate local audio. Repeating the command is
   idempotent and returns the existing tombstone without another Plaud call.

### Backfill preview (dry-run)

1. Operator edits the device / date filters in the Historical backfill form. After a 500 ms debounce the panel calls `GET /api/backfill/candidates?from=...&to=...&serialNumber=...&previewLimit=200`.
2. The server runs the same first half of the sync pipeline as `executeMirror`: validate token → `client.listEverything()` → `applyLocalFilters`. No download happens; no `sync_runs` row is created.
3. Each matching recording is annotated with its local state by looking up the SQLite row and verifying the physical artifact:
   - `"missing"` — not on disk, would be downloaded
   - `"mirrored"` — file exists, is non-empty, and matches `bytesWritten`
   - `"dismissed"` — operator dismissed locally, would be skipped
4. The response includes `plaudTotal`, `matched` (pre-truncation count), `missing` (how many would actually download), `previewLimit`, and the recordings array (newest-first, capped at `previewLimit`, default 200, max 500). The panel renders this as a table with colored state badges and a header summary ("X match — Y would be downloaded").
5. Because the preview reuses the exact same primitives (`listEverything`, `applyLocalFilters`, same date normalization via `toStartTimestamp`/`toEndTimestamp`), it cannot drift from real backfill behavior.

### Continuous sync scheduler (Phase 3, opt-in via env)

1. **Source of truth: SQLite, seeded once from the env var.** From `v0.5.2` onwards, the active scheduler interval is the `config.schedulerIntervalMs` row in the `settings` table (same key/value store the webhook URL already uses). On `service.initialize()`, `RuntimeStore.seedSchedulerDefaults(env.schedulerIntervalMs)` writes the env-var-derived value to SQLite **only if the row is absent** — once the operator has touched the panel even once, the env var is irrelevant on every subsequent boot. `parseSchedulerInterval` (`apps/api/src/runtime/environment.ts`) still applies its rules to the env var (`0`/unset/empty → 0; `≥ 60 000` accepted; `<60 000` positive or non-integer → rejected at startup); but the value it produces is now a seed, not a live setting. (`v0.5.0` arranged a 15-minute fallback here, which broke the opt-in promise of the SemVer minor bump; `v0.5.1` reverts the fallback to `0`; `v0.5.2` keeps that and additionally moves the live knob to SQLite.)
2. **Lifecycle is owned by `SchedulerManager`** (`apps/api/src/runtime/scheduler-manager.ts`). At boot, `createApp` constructs the manager unconditionally and calls `manager.applyInterval(config.schedulerIntervalMs)` after reading the persisted value via `service.getConfig()`. The manager keeps a single underlying `Scheduler` instance: `applyInterval(0)` stops and clears it; `applyInterval(N>=60_000)` constructs a fresh `Scheduler` with that cadence and calls `start()`; `applyInterval(currentValue)` is a no-op (the live cadence is preserved on a no-op save from the panel). Sub-floor positive values throw at the manager level as defence-in-depth — the request boundary in `service.updateConfig` rejects with HTTP 400 first.
3. **Hot reconfigure from the panel.** `service.setSchedulerReconfigureHook(hook)` is wired to `manager.applyInterval` during boot. When `service.updateConfig` accepts a `schedulerIntervalMs` field via `PUT /api/config`, it (a) validates the floor at the request boundary, (b) persists via `store.saveConfig`, and (c) calls the reconfigure hook so the live `Scheduler` is started / stopped / swapped immediately, no container restart needed. `service.setSchedulerStatusProvider(() => manager.status())` is also wired so `getHealth` always reads the live state regardless of which `Scheduler` instance is active.
4. **The tick callback** invokes and awaits `service.runScheduledSync()`. A fresh run keeps the tick promise unresolved until `executeMirror` finishes, so `completed` is end-to-end truth; an existing run returns `started:false` and maps to `skipped` without inserting another row.
3. **Anti-overlap is two layers (`v0.5.1` ships both — `v0.5.0` only had the second):**
   - **Service-layer (first guardrail).** `startOrReuseMirror` checks `store.getActiveSyncRun()` before allocation. Manual sync and scheduler ticks reuse the active id; the scheduler labels that tick skipped. Backfill converts `started:false` into HTTP 409 so date/device filters cannot be silently absorbed by unrelated work.
   - **Scheduler-level (second guardrail).** `Scheduler.executeTick` keeps an `inflight` flag: if the timer fires while the previous tick's promise has not resolved, the new fire is also recorded as `skipped` and discarded. This case is rare in practice (it requires a tick to take longer than `intervalMs`), but it is the second guardrail that protects against a silent backlog if Plaud responses degrade or the service-level reuse fails for some unforeseen reason.
4. The next tick is scheduled **before** the current `runTick` is awaited. This means a long-running tick (large limit, slow Plaud responses) does not push subsequent ticks back; the cadence is always `intervalMs` from the previous fire, regardless of how long the work took. Anti-overlap absorbs the case where the work outlasts the interval.
5. `Scheduler.status()` returns `{ enabled, intervalMs, nextTickAt, lastTickAt, lastTickStatus, lastTickError }`. `getHealth()` calls the registered status provider and includes the result as `scheduler` in the `/api/health` response. When the scheduler is enabled, `phase` reads `"Phase 3 - unattended operation"`; when it is disabled, `phase` falls back to the historical `"Phase 2 - first usable slice"` string. Older clients that read `health.scheduler` get the disabled-shape default `{ enabled: false, intervalMs: 0, nextTickAt: null, lastTickAt: null, lastTickStatus: null, lastTickError: null }` thanks to Zod's `.default(...)` on `ServiceHealthSchema.scheduler`.
6. SIGTERM/SIGINT call `app.close()`. The close hook stops new scheduler/outbox ticks, waits for any outbox request, aborts active sync work through the whole-run signal, waits for it to settle, and only then closes SQLite. The CLI keeps a 75-second hard-stop guard.

### Device catalog

1. During the background portion of a sync run, the service calls `client.listDevices()` which hits `GET /device/list`. The response is translated from Plaud's wire shape (`sn`, `name`, `model`, `version_number`) into the domain `Device` type (`serialNumber`, `displayName`, `model`, `firmwareVersion`, `lastSeenAt`). The wire format is isolated to `packages/shared/src/plaud.ts`; the rest of the codebase only imports `Device`.
2. Results are bulk-upserted into the `devices` SQLite table inside a single transaction. Rows are never deleted: when a device is unbound from the account, its row stays so historical recordings (which reference `serialNumber` directly) can still resolve a name. `lastSeenAt` is bumped only for devices present in the current response, so the UI can distinguish "active" from "retired".
3. Failures on `/device/list` are caught and logged; they do NOT fail the containing sync. Device metadata is a UX convenience, not a correctness property.
4. `GET /api/devices` returns `{ devices: Device[] }` (read-only, no network call — just reads the cached SQLite table). The web panel's backfill form uses this to render a `<select>` instead of requiring the operator to paste a raw serial number.

## Storage Layout

- `data/app.db`
  SQLite state for config, auth metadata, recordings (including `dismissed`, `dismissed_at`, and the irreversible `upstream_deleted_at` tombstone), devices (cached from `/device/list`), sync runs, and webhook delivery attempts
- `data/secrets.enc`
  Encrypted secret blob containing the Plaud token and optional webhook secret
- `recordings/<recording-id>/audio.<ext>`
  Original downloaded audio
- `recordings/<recording-id>/metadata.json`
  Mirror metadata written at download time
- `.state/phase1/latest-report.json`
  Optional spike artifact from the Phase 1 CLI

## Security Notes

- Tokens and webhook secrets are never stored in plaintext.
- Temporary Plaud download URLs must not be logged in full.
- This remains a single-operator service, but from v0.6.0 it protects itself: operator access control (D-018) gates the panel/API when `PLAUD_MIRROR_ADMIN_PASSPHRASE` is set. Network position (LAN, edge-caddy) is no longer the only boundary.
- `/api/health` is public by design (status probes); its `auth.userSummary` is redacted for unauthenticated callers, and error strings surfaced there must never contain secrets.
- Known hardening debt (deliberately sequenced after v0.6.0): the secrets KDF is single-pass SHA-256 of the master key — fine for a high-entropy random key, weak for a human-chosen one; upgrade to scrypt-with-salt remains queued before the unattended-soak exit gate. `webhookUrl` accepts any URL (no private-range allowlist) — acceptable now that only an authenticated operator can set it.

## Next Architectural Step

Phase 4 is in progress, extended through `0.9.x` for the Chrome extension plus operator-panel redesign while the Phase 3 soak remains pending. The remaining work:

- **Phase 3 cont.:** `v0.9.0` now surfaces `health.warnings` / `lastErrors` / `recentSyncRuns` in the panel UI. Remaining hardening before the soak: scrypt KDF upgrade for `data/secrets.enc`, then the multi-day unattended run that closes the phase. Resumable backfill stays deferred (no firm release target).
- **Phase 4 (0.7.x-0.9.x):** browser-assisted re-auth is implemented through `/connect` and the Chrome extension; `v0.9.0` finishes the operator-facing cockpit around that flow. Fully unattended SSO renewal remains deferred/watch behind the official OAuth/MCP path; email+password login is not applicable to this operator account.
- **Phase 5 (0.10.x):** deployment hardening, backups, rollback, NAS validation, infra playbooks.
- More robust degraded-state handling (incremental, threaded through Phase 3 + 4).
