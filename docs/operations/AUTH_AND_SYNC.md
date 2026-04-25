<!-- doc-version: 0.5.2 -->
# Authentication and Sync Operations

This runbook defines the live behavior of Plaud Mirror's auth and sync surface. Phase 2 (manual sync/backfill, immediate HMAC webhook) is fully shipped. Phase 3 is in progress: `v0.5.0` introduced the in-process continuous sync scheduler (D-012); `v0.5.1` corrected two regressions in that release; `v0.5.2` makes the scheduler **operator-controllable from the web panel** — the interval is persisted in SQLite (`config.schedulerIntervalMs`) and hot-applied via the new `SchedulerManager` without a container restart. The `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` env var is now a one-time seed for fresh installs, not a live knob. The durable webhook outbox (D-013) and full health observability (D-014, `lastErrors` + outbox backlog) are scheduled for `v0.5.3` / `v0.5.4`.

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
- Webhook delivery is attempted immediately after mirroring.
- Delivery attempts are persisted even when the webhook call fails.

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

#### Still later in `0.5.x`

- **`v0.5.3`:** durable webhook outbox with explicit FSM (`pending` / `delivering` / `delivered` / `retry_waiting` / `permanently_failed`) and exponential-backoff retry policy (D-013). Pushed back two patch slots because `v0.5.1` consumed one for the regression fix and `v0.5.2` consumed another for the panel-driven scheduler config.
- **`v0.5.4`:** full health observability — `lastErrors` ring buffer + outbox backlog counters surfaced through `/api/health` (D-014, full).
- Resumable backfill (no firm release target; deferred within Phase 3).

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
