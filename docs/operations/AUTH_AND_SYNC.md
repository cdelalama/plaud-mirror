<!-- doc-version: 0.5.0 -->
# Authentication and Sync Operations

This runbook defines the live behavior of Plaud Mirror's auth and sync surface. Phase 2 (manual sync/backfill, immediate HMAC webhook) is fully shipped. Phase 3 is in progress: `v0.5.0` adds the in-process continuous sync scheduler (D-012); the durable webhook outbox (D-013) and full health observability (D-014, `lastErrors` + outbox backlog) are scheduled for `v0.5.1` / `v0.5.2`.

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

#### Continuous sync scheduler — shipped in `v0.5.0`

The scheduler is **opt-in**. It is governed by the `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` environment variable:

| Value                        | Behavior                                                          |
|------------------------------|-------------------------------------------------------------------|
| unset / absent               | Scheduler **disabled** — Phase 2 manual-only behavior preserved.  |
| `0`                          | Scheduler **disabled** explicitly. Same as unset.                 |
| any positive number `< 60000`| Rejected — minimum interval is 60 000 ms (60 s).                  |
| any positive number `≥ 60000`| Scheduler **enabled**, fires `runSync({ limit: defaultSyncLimit })` every `intervalMs` from previous fire. |
| non-numeric / empty string   | Falls back to default 15 minutes (900 000 ms).                    |

Operational properties:

- **Anti-overlap (two layers).** The scheduler tracks an `inflight` flag: if the previous tick has not resolved when the timer fires, the new fire is recorded as `lastTickStatus = "skipped"` and discarded. Independently, `service.runSync` serializes via `getActiveSyncRun` and rejects when a run (manual or scheduled) is mid-flight, returning the existing `id`. A scheduled tick that lands while the operator has a manual sync in progress will therefore record `skipped` — this is expected and benign.
- **Cadence is from-fire, not from-completion.** The next tick is scheduled before the current tick is awaited, so a slow run does not push the cadence back; anti-overlap absorbs the case where work outlasts the interval.
- **Observability.** `/api/health` exposes the scheduler block — `enabled`, `intervalMs`, `nextTickAt` (ISO), `lastTickAt` (ISO), `lastTickStatus` (`completed` / `failed` / `skipped` / `null`), `lastTickError` (string or `null`). When the scheduler is enabled, `health.phase` reads `"Phase 3 - unattended operation"`; when disabled, it falls back to `"Phase 2 - manual sync"`.
- **Shutdown.** Fastify's `onClose` hook stops the scheduler so SIGTERM does not leave a half-fired tick or a dangling timer.

#### Still later in `0.5.x`

- **`v0.5.1`:** durable webhook outbox with explicit FSM (`pending` / `delivering` / `delivered` / `retry_waiting` / `permanently_failed`) and exponential-backoff retry policy (D-013).
- **`v0.5.2`:** full health observability — `lastErrors` ring buffer + outbox backlog counters surfaced through `/api/health` (D-014, full).
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
