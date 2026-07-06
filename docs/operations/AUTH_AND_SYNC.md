<!-- doc-version: 0.10.6 -->
# Authentication and Sync Operations

This runbook defines the live behavior of Plaud Mirror's auth and sync surface. Phase 2 is fully shipped. Phase 3 added the scheduler, durable outbox, health observability, and access/recovery timeouts. `v0.10.3` makes artifact integrity truthful; `v0.10.4` makes scheduler completion, runtime ceilings, outbox recovery, pagination, and shutdown truthful before the soak. Resumable backfill and fully unattended re-login stay deferred.

## Operator Access Control (D-018, v0.6.0)

Two distinct auth surfaces exist from v0.6.0 — do not conflate them:

1. **Plaud auth** (this service → Plaud): the encrypted bearer token described below.
2. **Operator auth** (you → this service): `PLAUD_MIRROR_ADMIN_PASSPHRASE`.

When `PLAUD_MIRROR_ADMIN_PASSPHRASE` is set, the panel shows a login screen and every `/api/*` route except `GET /api/health` and `/api/session*` requires the signed session cookie issued by `POST /api/session/login` (HttpOnly, SameSite=Lax, 30-day TTL). Unauthenticated `/api/health` responses redact `auth.userSummary` (the Plaud account email/uid). Failed logins are throttled (5/minute). Rotating the passphrase — or the master key — invalidates every outstanding session immediately.

Storage convention (v0.6.2): the passphrase lives in Doppler at `plaud-mirror/dev/PLAUD_MIRROR_ADMIN_PASSPHRASE`, per the home-infra secrets convention. Store or rotate it with `scripts/set-admin-passphrase.sh` (interactive; reads the value silently, double-prompts, pipes it to the Doppler CLI via stdin so it never touches argv, history, or disk). Inject it at launch with `doppler run --project plaud-mirror --config dev -- docker compose up -d` (process env overrides `.env` in compose substitution), or copy it into the gitignored `.env` manually.

When the variable is unset, the API runs open (pre-0.6.0 behavior) and `health.warnings` carries "Operator access control is disabled — set PLAUD_MIRROR_ADMIN_PASSPHRASE..." so the gap is never silent. Given the service is published through `edge-caddy` at `https://plaud.lamanoriega.com/` and `compose.yml` binds `3040:3040` on the LAN, running without the passphrase is NOT recommended.

## Auth Mode

### Current Mode: Manual Bearer Token

- Operator pastes a Plaud bearer token in the web UI.
- API validates it against Plaud before storing it.
- Token is encrypted at rest in `data/secrets.enc`.
- If Plaud later rejects the token, the service moves into a degraded auth state and requires operator action.

### Browser-assisted re-auth (D-019, v0.7.0; Chrome extension in v0.8.0)

Because the operator's Plaud account is Google SSO (no password, and Plaud forbids adding one to an SSO account), and the official OAuth/MCP is deferred, re-auth captures the bearer the browser already holds instead of pasting it by hand:

1. Install the local Chrome extension once: open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `apps/chrome-extension`. Pin **Plaud Mirror Connector** in the toolbar.
2. In the panel Configuration screen, **Reconectar Plaud** → the backend mints a one-time `captureId` (TTL 10 min), the panel stores it in mirror `localStorage`, and the panel opens `app.plaud.ai`.
3. Log into Plaud normally (Google). In that Plaud tab, press **Plaud Mirror Connector** → **Send token to mirror**.
4. The extension reads the bearer from Plaud's browser storage and navigates the tab to the mirror's `/connect#token=...` page, which completes the capture against the live `captureId`. The token is validated against Plaud and stored.

The Plaud bearer lasts ~300 days, so this is a roughly-once-a-year, no-DevTools, no-password action. Manual paste remains the universal fallback. The bookmarklet is now copy-only fallback, not the recommended path: dragging a React-rendered `javascript:` link proved unreliable because React replaces it with a defensive throw before Chrome stores it. Telegram is **not** a capture channel — it cannot read browser storage; it is only a possible future notification surface.

Two things the capture must get right (both fixed in v0.7.3):

- **Token type:** the captured token must be the global **user token** (`localStorage.pld_tokenstr`), not Plaud's per-workspace token. `/user/me` (the validation endpoint) rejects the workspace token with 403. The Chrome extension prefers `pld_tokenstr` and scans storage as a fallback.
- **Region:** the bearer is region-bound. Set `PLAUD_MIRROR_API_BASE` to the account's regional API domain (`https://api-euc1.plaud.ai` for EU, `https://api.plaud.ai` for US). A wrong region returns a hard 403 that the `-302` regional-retry path does not catch. This deployment is EU (set in Doppler `plaud-mirror/dev`).
- **Request fingerprint:** from `v0.8.1`, Plaud API calls use Plaud Web's browser context (`Origin` / `Referer` `https://web.plaud.ai`, browser-like Chrome user agent, and browser `sec-fetch-*` headers). This was required after the operator proved the captured EU user token returned `200` from Plaud Web's own console while the backend's old `app.plaud.ai` + custom-user-agent request received an HTML 403 from Plaud/Cloudflare.
- The panel normalizes a pasted token (strips surrounding quotes and a leading `Bearer ` prefix). Plaud rejection details are surfaced only on authenticated token-save/connect responses; the public `/api/health` keeps generic error strings.

### Later Mode: Fully automatic re-login

Fully unattended re-login (no operator tap at all) remains a roadmap item. For a Google-SSO account it is only reachable via Plaud's official OAuth/MCP, which is deferred/watch (see D-019); for an email+password account the private `POST /auth/access-token` endpoint would enable it (also documented in D-019) but does not apply here. It is not part of the current deployment contract.

## Auth State

The service exposes:

- whether a token is configured
- current auth state: `missing`, `healthy`, `degraded`, or `invalid`
- resolved Plaud API base when known
- last successful validation timestamp
- last auth error

## Sync Behavior

### Phase 2

- Sync is operator-triggered only.
- Backfill is operator-triggered only.
- Supported filters (backend schema `SyncFiltersSchema`):
  - date range (`from`, `to`) — surfaced in the web UI.
  - `serialNumber` — surfaced in the web UI as a device selector fed by `/api/devices`.
  - `scene` — accepted for programmatic callers only; the web UI no longer exposes it because the raw integer values are opaque to operators (see CHANGELOG 0.4.12).
- Existing mirrored recordings are skipped unless `forceDownload` is requested,
  but only after the file is verified to exist, be non-empty, and match the
  persisted byte count. Missing or wrong-sized files are re-downloaded.
- Webhook delivery: through `v0.5.2` it was synchronous inside `executeMirror`. From `v0.5.3` onwards it is **enqueued to the durable outbox** and delivered asynchronously by the worker (see "Webhook outbox" below).
- Delivery attempts are persisted even when the webhook call fails (`webhook_deliveries` audit log, append-only, unchanged across releases).
- `SyncRunSummary.skipped` is a sync-work counter, not a webhook-delivery
  counter. From `v0.10.1`, a downloaded recording with no webhook configured
  still records `lastWebhookStatus="skipped"` on the recording row, but it does
  not increase the run's `skipped` field.
- `SyncRunSummary.failed` counts candidate processing failures. One bad Plaud
  recording does not block later candidates, but any non-zero `failed` closes
  the run as `failed` with recording-id context in `error`.

### Phase 3 (in progress, `0.5.x` line)

#### Continuous sync scheduler — introduced in `v0.5.0`, stabilized in `v0.5.1`, panel-driven from `v0.5.2`

The live source of truth for the scheduler interval is **the SQLite `config.schedulerIntervalMs` row**, set from the Configuration screen of the web panel (`PUT /api/config { schedulerIntervalMs }`). The same rules apply regardless of whether the value comes from the panel or the env-var seed:

| Value                          | Behavior                                                                                                       |
|--------------------------------|----------------------------------------------------------------------------------------------------------------|
| `0`                            | Scheduler **disabled** — Phase 2 manual-only behavior preserved exactly.                                       |
| any positive integer `< 60000` | Rejected at the request boundary (HTTP 400 from `PUT /api/config`) and at startup if it slipped in via env.    |
| any positive integer `≥ 60000` | Scheduler **enabled**, fires `runScheduledSync()` every `intervalMs` measured from the previous fire.          |

A panel save round-trips through `PUT /api/config`, validates server-side, persists to SQLite, then hot-applies via the `SchedulerManager` reconfigure hook — no container restart, no env-var edit. The `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` env var still has a role on **fresh installs only**: `service.initialize()` calls `RuntimeStore.seedSchedulerDefaults(env.schedulerIntervalMs)`, which writes the env value to SQLite **only when the row is absent**. After the operator has touched the panel even once (or after the seed has run), the env var is irrelevant on every subsequent boot. To take an existing install back to "disabled," set the value to `0` in the panel — do not rely on removing the env var, that no longer changes anything.

Recommended starting point when enabling for the first time: `15` minutes (`900000` ms on the wire). The recommendation lives in this doc and in the panel placeholder, not in code; the runtime never picks a non-zero scheduler without an explicit operator action.

Operational properties:

- **Anti-overlap (two layers).** Both layers ship in `v0.5.1` (the second was promised but missing in `v0.5.0`):
  1. **Service-layer.** `runScheduledSync()` and public `runSync` reuse an active run without creating another row. `runBackfill` is intentionally different: it returns HTTP 409 when a run is active, because reusing the existing id would silently discard the operator's filters. The scheduler tick variant returns `started: false` so the timer can record `lastTickStatus = "skipped"` honestly.
  2. **Scheduler-level.** The `inflight` flag on `Scheduler.executeTick` stops two ticks from this same scheduler from running concurrently. This case is rare in practice (it requires a tick to take longer than `intervalMs`), but it is the second guardrail that protects against a silent backlog if Plaud responses degrade.
- **Cadence is from-fire, not from-completion.** The next tick is scheduled before the current tick is awaited, so a slow run does not push the cadence back; anti-overlap absorbs the case where work outlasts the interval.
- **Observability.** `/api/health` exposes the scheduler block — `enabled`, `intervalMs`, `nextTickAt` (ISO), `lastTickAt` (ISO), `lastTickStatus` (`completed` / `failed` / `skipped` / `null`), `lastTickError` (string or `null`). From `v0.10.4`, a started tick stays in-flight until its mirror run finishes: `completed` no longer means merely dispatched. Absorbed active runs remain `skipped` with an operator-readable reason.
- **Whole-run ceiling.** `PLAUD_MIRROR_SYNC_MAX_RUNTIME_MS` defaults to `3600000` (one hour). Its abort signal reaches Plaud API calls and audio streams; timeout closes the durable run as failed.
- **Shutdown.** SIGTERM/SIGINT stop new ticks, await the outbox, cancel and await active sync work, and close SQLite last. The CLI has a 75-second hard-stop guard.

#### Webhook outbox — shipped in `v0.5.3`

Each successfully-mirrored recording pushes its `recording.synced` payload into `webhook_outbox` (SQLite). The recording's `lastWebhookStatus` is set to `"queued"` immediately. A dedicated `OutboxWorker` runs every 5 seconds in the background, atomically claims one due row, recomputes the HMAC at delivery time (so a rotated secret is honoured), POSTs to the configured URL, and either:

- **2xx** → row state `delivered`; the audit log records a `success`.
- **non-2xx or thrown error** → row state `retry_waiting`, `attempts` incremented, `next_attempt_at = now + backoff[attempts]`. Audit log records a `failed`.
- After eight retry windows, the **ninth failed attempt** → row state `permanently_failed`. Operator sees the row in the panel's "Webhook outbox" card and can press **Retry** to reset it to `pending` (`attempts = 0`).

Backoff schedule: `30 s, 2 m, 10 m, 30 m, 1 h, 2 h, 4 h, 8 h`. All eight waits are reachable; cumulative wait is about 15 h 42 m before the ninth/final attempt.

Operational properties:

- **Independent of the sync scheduler.** The two share SQLite, not state. A long sync run does not block delivery; a stuck downstream does not block sync.
- **HMAC at delivery time.** Rotating `webhookSecret` from the panel takes effect on the next worker tick — items already in the queue get re-signed with the new secret.
- **Mode rotation.** `executeMirror` stamps the run's mode (`sync` / `backfill`) into the payload at enqueue time so the downstream sees the original context, not the worker's tick context.
- **Atomic claim.** The transition `pending|retry_waiting → delivering` is a guarded UPDATE; two concurrent claims (worker tick + panel-triggered Retry) cannot both pick the same row.
- **In-process claim recovery.** Secret decryption and payload parsing are inside the failure boundary. If either throws after claim, the attempt is audited and the row returns to `retry_waiting`; `health.outbox.delivering` makes any active claim visible.
- **No web-config short-circuit.** When the operator clears the webhook URL while items are in the queue, the worker escalates them to `permanently_failed` with `last_error = "webhook not configured"` rather than silently dropping or retrying forever. The operator must reconfigure and Retry.

#### Full health observability — shipped in `v0.5.5`

`/api/health` now also exposes:

- **`lastErrors`** — cross-subsystem ring buffer (capped at 20 entries, most-recent-first, in-memory). Each entry: `occurredAt` (ISO), `subsystem` (`scheduler` | `outbox` | `sync` | `auth`), `message`, `context` (string→string map). Failed scheduler ticks, outbox delivery errors (both retry and permanent escalations), and failed sync runs all feed this buffer through `service.recordError`. The buffer resets per container restart by design — durable failures live in `outbox.permanentlyFailed` or `lastSync.error`.
- **`recentSyncRuns`** — last 5 finished sync runs (`finished_at DESC`) from SQLite. Distinct from `lastSync` (single most-recent finished run) — this is the operator-facing audit signal for "are recent runs succeeding or failing?". Active runs are intentionally excluded; they remain on `activeRun`.

#### Home Infra Protocol status snapshot — shipped in `v0.10.0`

Plaud Mirror now exposes the Plaud recording sync as a
`home-infra-protocol` sync job:

- Contract: `infra.contract.yml`, job id `plaud-mirror-recordings-sync`.
- Human contract doc: `docs/INFRA_CONTRACT.md`.
- Public sanitized status URL:
  `/api/protocol/sync-jobs/plaud-mirror-recordings-sync/status`.
- Alias: `/api/protocol/status`.

The endpoint returns `schemas/status-snapshot.schema.json` shape:
`observed_at`, `condition`, `severity`, `summary`, and `checks[]`. It is public
like `/api/health` so Infra Portal can read it without an operator session, but
it is sanitized: no Plaud account summary, no bearer, no webhook secret, and no
raw Plaud rejection body.

The snapshot is built from existing `/api/health` runtime truth:

- Plaud auth -> `plaud-auth` check.
- Latest/active sync -> `latest-sync` check.
- Plaud/local/dismissed/missing counts -> `coverage` check.
- Scheduler state -> `scheduler` check.
- Durable webhook outbox -> `webhook-outbox` check.

`observed_at` is deliberately anchored to sync evidence rather than the HTTP
request time: active run `startedAt`, latest sync `finishedAt`, auth validation
time, then current time only as first-boot fallback. Consumers derive freshness
by joining this timestamp with `infra.contract.yml` `stale_after`.

The contract currently declares `schedule.mode: manual` with `stale_after:
P1D`, because the live scheduler is disabled until the Phase 3 soak is
deliberately started. When the scheduler becomes normal operation, change the
contract to `internal-loop`, add `cadence`, and keep `stale_after > cadence`.

#### Startup crash recovery — shipped in `v0.6.0` (D-013 amendment)

A process that dies mid-flight (SIGKILL, OOM, host reboot) used to leave two kinds of permanent orphans. From `v0.6.0`, `service.initialize()` sweeps both at every boot:

- **`sync_runs` stuck in `running`** → marked `failed` with `error = "recovered after process restart: ..."`. Without this, `getActiveSyncRun()` kept returning the dead run and the anti-overlap guard blocked every future sync until manual SQLite surgery.
- **`webhook_outbox` rows stuck in `delivering`** → re-queued as `retry_waiting` due immediately, `attempts` unchanged (full backoff budget preserved). The delivery outcome at crash time is unknown, so this accepts **at-least-once** delivery: the downstream may see a duplicate `recording.synced` and must treat `recording.id` as its idempotency key.

Both sweeps log a warning and surface in `health.lastErrors` (subsystems `sync` / `outbox`).

#### Plaud request timeouts — shipped in `v0.6.0`

Every Plaud API call carries `AbortSignal.timeout(PLAUD_MIRROR_REQUEST_TIMEOUT_MS)` (default 30 s); audio-artifact downloads carry a longer fixed ceiling (10 min, sized for large files on a modest uplink). From `v0.10.4`, both are combined with the one-hour whole-run signal. A hung connection now fails the run instead of leaving `activeRun` wedged forever.

Resumable backfill remains deferred (no firm release target).

## Failure Modes

| Failure | Current response | Operator action |
|---------|------------------|-----------------|
| Missing token | UI shows `missing` auth state | Paste and validate a token |
| Invalid token | UI/API show `invalid` or `degraded` state | Replace token |
| Plaud download failure | Request fails, sync summary records failure | Re-run after checking logs or upstream drift |
| Plaud request hangs | Aborted at the timeout; run recorded as failed with a `timed out` error | Re-run; check network/Plaud status if it repeats |
| Webhook delivery failure | Attempt stored as failed, mirrored file kept locally | Fix webhook target/secret and re-run |
| Process crash mid-run | Orphaned run/outbox rows recovered at next boot; entries in `health.lastErrors` | None required; review `recentSyncRuns` for the failed run |
| Lost operator passphrase | Panel/API return 401 | Set a new `PLAUD_MIRROR_ADMIN_PASSPHRASE` and restart the container (old sessions invalidate automatically) |

## Security Rules

- Never log bearer tokens or webhook secrets.
- Never log full Plaud temp URLs.
- `PLAUD_MIRROR_MASTER_KEY` is mandatory for runtime startup.
- `PLAUD_MIRROR_ADMIN_PASSPHRASE` is strongly recommended on any deployment reachable beyond localhost; error messages remain visible to unauthenticated LAN callers through the public `/api/health`, so they must never carry secrets.

## Operational Signals

The UI and `/api/health` should make it obvious:

- whether auth is usable
- whether webhook configuration is complete
- when the last sync ran
- how many recordings are already mirrored
