<!-- doc-version: 0.5.5 -->
# Authentication and Sync Operations

This runbook defines the live behavior of Plaud Mirror's auth and sync surface. Phase 2 (manual sync/backfill) is fully shipped. Phase 3: the continuous sync scheduler landed in `v0.5.0` (regressed) → `v0.5.1` (fixed) → `v0.5.2` (panel-driven). `v0.5.3` shipped the **durable webhook outbox** (D-013): webhook delivery is no longer synchronous inside a sync run, payloads are persisted to a `webhook_outbox` SQLite table and a dedicated worker retries with exponential backoff (30 s → 8 h, 8 attempts) before escalating. `v0.5.4` was governance-only (Layer-1 doc-drift enforcement, D-016, no runtime change). `v0.5.5` ships **D-014 full**: `lastErrors` ring buffer (cross-subsystem, in-memory, capped at 20) and `recentSyncRuns` (last 5 finished runs from SQLite) on `/api/health`. The Phase 3 runtime surface is now complete; remaining work (resumable backfill, automatic re-login) is deferred.

## Auth Mode

### Current Mode: Manual Bearer Token

- Operator pastes a Plaud bearer token in the web UI.
- API validates it against Plaud before storing it.
- Token is encrypted at rest in `data/secrets.enc`.
- If Plaud later rejects the token, the service moves into a degraded auth state and requires operator action.

### Later Mode: Automatic Re-login

Automatic re-login remains a roadmap item only. It is not part of the current deployment contract.

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
- Existing mirrored recordings are skipped unless `forceDownload` is requested.
- Webhook delivery: through `v0.5.2` it was synchronous inside `executeMirror`. From `v0.5.3` onwards it is **enqueued to the durable outbox** and delivered asynchronously by the worker (see "Webhook outbox" below).
- Delivery attempts are persisted even when the webhook call fails (`webhook_deliveries` audit log, append-only, unchanged across releases).

### Phase 3 (in progress, `0.5.x` line)

#### Continuous sync scheduler — introduced in `v0.5.0`, stabilized in `v0.5.1`, panel-driven from `v0.5.2`

The live source of truth for the scheduler interval is **the SQLite `config.schedulerIntervalMs` row**, set from the Configuration tab of the web panel (`PUT /api/config { schedulerIntervalMs }`). The same rules apply regardless of whether the value comes from the panel or the env-var seed:

| Value                          | Behavior                                                                                                       |
|--------------------------------|----------------------------------------------------------------------------------------------------------------|
| `0`                            | Scheduler **disabled** — Phase 2 manual-only behavior preserved exactly.                                       |
| any positive integer `< 60000` | Rejected at the request boundary (HTTP 400 from `PUT /api/config`) and at startup if it slipped in via env.    |
| any positive integer `≥ 60000` | Scheduler **enabled**, fires `runScheduledSync()` every `intervalMs` measured from the previous fire.          |

A panel save round-trips through `PUT /api/config`, validates server-side, persists to SQLite, then hot-applies via the `SchedulerManager` reconfigure hook — no container restart, no env-var edit. The `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` env var still has a role on **fresh installs only**: `service.initialize()` calls `RuntimeStore.seedSchedulerDefaults(env.schedulerIntervalMs)`, which writes the env value to SQLite **only when the row is absent**. After the operator has touched the panel even once (or after the seed has run), the env var is irrelevant on every subsequent boot. To take an existing install back to "disabled," set the value to `0` in the panel — do not rely on removing the env var, that no longer changes anything.

Recommended starting point when enabling for the first time: `15` minutes (`900000` ms on the wire). The recommendation lives in this doc and in the panel placeholder, not in code; the runtime never picks a non-zero scheduler without an explicit operator action.

Operational properties:

- **Anti-overlap (two layers).** Both layers ship in `v0.5.1` (the second was promised but missing in `v0.5.0`):
  1. **Service-layer.** `runScheduledSync()` (and the public `runSync` / `runBackfill`) consult `store.getActiveSyncRun()` before inserting a new `sync_runs` row. If a run is already mid-flight (manual or scheduled, no distinction), the call returns the existing run's id without creating a second row or dispatching `executeMirror` again. The scheduler tick variant additionally returns `started: false` so the timer can record `lastTickStatus = "skipped"` honestly instead of mislabelling absorbed ticks as `completed`.
  2. **Scheduler-level.** The `inflight` flag on `Scheduler.executeTick` stops two ticks from this same scheduler from running concurrently. This case is rare in practice (it requires a tick to take longer than `intervalMs`), but it is the second guardrail that protects against a silent backlog if Plaud responses degrade.
- **Cadence is from-fire, not from-completion.** The next tick is scheduled before the current tick is awaited, so a slow run does not push the cadence back; anti-overlap absorbs the case where work outlasts the interval.
- **Observability.** `/api/health` exposes the scheduler block — `enabled`, `intervalMs`, `nextTickAt` (ISO), `lastTickAt` (ISO), `lastTickStatus` (`completed` / `failed` / `skipped` / `null`), `lastTickError` (string or `null`). When a tick is absorbed by an active run, `lastTickStatus = "skipped"` and `lastTickError` carries an operator-readable reason like `"another sync run was already in flight"` (it is not actually an error; the field is reused for context). When the scheduler is enabled, `health.phase` reads `"Phase 3 - unattended operation"`; when disabled, it falls back to `"Phase 2 - first usable slice"`.
- **Shutdown.** Fastify's `onClose` hook stops the scheduler so SIGTERM does not leave a half-fired tick or a dangling timer.

#### Webhook outbox — shipped in `v0.5.3`

Each successfully-mirrored recording pushes its `recording.synced` payload into `webhook_outbox` (SQLite). The recording's `lastWebhookStatus` is set to `"queued"` immediately. A dedicated `OutboxWorker` runs every 5 seconds in the background, atomically claims one due row, recomputes the HMAC at delivery time (so a rotated secret is honoured), POSTs to the configured URL, and either:

- **2xx** → row state `delivered`; the audit log records a `success`.
- **non-2xx or thrown error** → row state `retry_waiting`, `attempts` incremented, `next_attempt_at = now + backoff[attempts]`. Audit log records a `failed`.
- After **8 failed attempts** → row state `permanently_failed`. Operator sees the row in the panel's "Webhook outbox" card and can press **Retry** to reset it to `pending` (`attempts = 0`).

Backoff schedule: `30 s, 2 m, 10 m, 30 m, 1 h, 2 h, 4 h, 8 h`. Cumulative ~16 h before escalation, sized to ride out an overnight downstream outage on a home-infra box.

Operational properties:

- **Independent of the sync scheduler.** The two share SQLite, not state. A long sync run does not block delivery; a stuck downstream does not block sync.
- **HMAC at delivery time.** Rotating `webhookSecret` from the panel takes effect on the next worker tick — items already in the queue get re-signed with the new secret.
- **Mode rotation.** `executeMirror` stamps the run's mode (`sync` / `backfill`) into the payload at enqueue time so the downstream sees the original context, not the worker's tick context.
- **Atomic claim.** The transition `pending|retry_waiting → delivering` is a guarded UPDATE; two concurrent claims (worker tick + panel-triggered Retry) cannot both pick the same row.
- **No web-config short-circuit.** When the operator clears the webhook URL while items are in the queue, the worker escalates them to `permanently_failed` with `last_error = "webhook not configured"` rather than silently dropping or retrying forever. The operator must reconfigure and Retry.

#### Full health observability — shipped in `v0.5.5`

`/api/health` now also exposes:

- **`lastErrors`** — cross-subsystem ring buffer (capped at 20 entries, most-recent-first, in-memory). Each entry: `occurredAt` (ISO), `subsystem` (`scheduler` | `outbox` | `sync` | `auth`), `message`, `context` (string→string map). Failed scheduler ticks, outbox delivery errors (both retry and permanent escalations), and failed sync runs all feed this buffer through `service.recordError`. The buffer resets per container restart by design — durable failures live in `outbox.permanentlyFailed` or `lastSync.error`.
- **`recentSyncRuns`** — last 5 finished sync runs (`finished_at DESC`) from SQLite. Distinct from `lastSync` (single most-recent finished run) — this is the operator-facing audit signal for "are recent runs succeeding or failing?". Active runs are intentionally excluded; they remain on `activeRun`.

Resumable backfill remains deferred (no firm release target).

## Failure Modes

| Failure | Current response | Operator action |
|---------|------------------|-----------------|
| Missing token | UI shows `missing` auth state | Paste and validate a token |
| Invalid token | UI/API show `invalid` or `degraded` state | Replace token |
| Plaud download failure | Request fails, sync summary records failure | Re-run after checking logs or upstream drift |
| Webhook delivery failure | Attempt stored as failed, mirrored file kept locally | Fix webhook target/secret and re-run |

## Security Rules

- Never log bearer tokens or webhook secrets.
- Never log full Plaud temp URLs.
- `PLAUD_MIRROR_MASTER_KEY` is mandatory for runtime startup.

## Operational Signals

The UI and `/api/health` should make it obvious:

- whether auth is usable
- whether webhook configuration is complete
- when the last sync ran
- how many recordings are already mirrored
