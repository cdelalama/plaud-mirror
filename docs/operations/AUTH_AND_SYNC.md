<!-- doc-version: 0.5.1 -->
# Authentication and Sync Operations

This runbook defines the live behavior of Plaud Mirror's auth and sync surface. Phase 2 (manual sync/backfill, immediate HMAC webhook) is fully shipped. Phase 3 is in progress: `v0.5.0` introduced the in-process continuous sync scheduler (D-012); `v0.5.1` corrects two regressions in that release (scheduler default-on without opt-in, and a service-layer anti-overlap claim that was documented but not implemented — see CHANGELOG `[0.5.1]`). The durable webhook outbox (D-013) and full health observability (D-014, `lastErrors` + outbox backlog) are scheduled for `v0.5.2` / `v0.5.3`.

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

#### Continuous sync scheduler — introduced in `v0.5.0`, fixed in `v0.5.1`

The scheduler is **opt-in**. It is governed by the `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` environment variable. From `v0.5.1` onward:

| Value                          | Behavior                                                                                                       |
|--------------------------------|----------------------------------------------------------------------------------------------------------------|
| unset / absent                 | Scheduler **disabled** — Phase 2 manual-only behavior preserved exactly. (Fixed in `v0.5.1`; `v0.5.0` arranged a 15-minute default here, which was a regression — see CHANGELOG `[0.5.1]`.) |
| empty string                   | Treated as unset. Scheduler **disabled**.                                                                      |
| `0`                            | Scheduler **disabled** explicitly. Same as unset.                                                              |
| any positive number `< 60000`  | Rejected at startup — minimum interval is 60 000 ms (60 s) to protect Plaud from over-polling.                 |
| any positive number `≥ 60000`  | Scheduler **enabled**, fires `runScheduledSync()` every `intervalMs` measured from the previous fire (not from the previous completion). |
| negative or non-integer string | Rejected at startup with an explicit error. (`v0.5.0` silently fell back to 15 min in this case; this was also fixed.) |

Recommended starting point when enabling: `900000` (15 minutes). The cadence is documented here, not baked into the code, so an operator never gets a non-zero scheduler without typing the value themselves.

Operational properties:

- **Anti-overlap (two layers).** Both layers ship in `v0.5.1` (the second was promised but missing in `v0.5.0`):
  1. **Service-layer.** `runScheduledSync()` (and the public `runSync` / `runBackfill`) consult `store.getActiveSyncRun()` before inserting a new `sync_runs` row. If a run is already mid-flight (manual or scheduled, no distinction), the call returns the existing run's id without creating a second row or dispatching `executeMirror` again. The scheduler tick variant additionally returns `started: false` so the timer can record `lastTickStatus = "skipped"` honestly instead of mislabelling absorbed ticks as `completed`.
  2. **Scheduler-level.** The `inflight` flag on `Scheduler.executeTick` stops two ticks from this same scheduler from running concurrently. This case is rare in practice (it requires a tick to take longer than `intervalMs`), but it is the second guardrail that protects against a silent backlog if Plaud responses degrade.
- **Cadence is from-fire, not from-completion.** The next tick is scheduled before the current tick is awaited, so a slow run does not push the cadence back; anti-overlap absorbs the case where work outlasts the interval.
- **Observability.** `/api/health` exposes the scheduler block — `enabled`, `intervalMs`, `nextTickAt` (ISO), `lastTickAt` (ISO), `lastTickStatus` (`completed` / `failed` / `skipped` / `null`), `lastTickError` (string or `null`). When a tick is absorbed by an active run, `lastTickStatus = "skipped"` and `lastTickError` carries an operator-readable reason like `"another sync run was already in flight"` (it is not actually an error; the field is reused for context). When the scheduler is enabled, `health.phase` reads `"Phase 3 - unattended operation"`; when disabled, it falls back to `"Phase 2 - first usable slice"`.
- **Shutdown.** Fastify's `onClose` hook stops the scheduler so SIGTERM does not leave a half-fired tick or a dangling timer.

#### Still later in `0.5.x`

- **`v0.5.2`:** durable webhook outbox with explicit FSM (`pending` / `delivering` / `delivered` / `retry_waiting` / `permanently_failed`) and exponential-backoff retry policy (D-013). Pushed back one patch slot because `v0.5.1` was consumed by the scheduler regression fix.
- **`v0.5.3`:** full health observability — `lastErrors` ring buffer + outbox backlog counters surfaced through `/api/health` (D-014, full).
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
