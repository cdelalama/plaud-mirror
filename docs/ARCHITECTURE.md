<!-- doc-version: 0.5.4 -->
# Plaud Mirror Architecture

> Version: 0.5.4
> Last Updated: 2026-04-27
> Status: Phase 3 in progress. `v0.5.0` introduced the in-process continuous sync scheduler (D-012); `v0.5.1` fixed two regressions; `v0.5.2` made the scheduler panel-driven; `v0.5.3` shipped the **durable webhook outbox** (D-013) — webhook delivery is no longer synchronous inside the sync run, payloads are persisted to a `webhook_outbox` SQLite table and delivered by a dedicated worker with exponential backoff (30 s → 8 h, 8 attempts, ~16 h window) and a Retry-from-panel path for permanently-failed rows. `GET /api/health` gained an `outbox` counters block; `SyncRunSummary` gained an `enqueued` counter; `delivered` keeps its original semantic and structurally stays at 0 from now on. `v0.5.4` (this release) is governance-only: Layer-1 doc-drift enforcement (D-016) — `scripts/check-prose-drift.sh` + `prose-drift` validator check + global meta-rule — with no runtime change. Operators upgrading from `0.4.x` should skip `v0.5.0` and go directly to `v0.5.4`. Full health observability with `lastErrors` ring buffer (D-014, complete) is the only Phase 3 runtime piece left and lands next: v0.5.5.

## Overview

Plaud Mirror is a single-operator, server-first service that:

1. stores an encrypted Plaud bearer token,
2. validates and uses that token against Plaud,
3. mirrors audio artifacts into `recordings/<recording-id>/`,
4. records local state in SQLite,
5. emits a signed webhook for each mirrored recording,
6. serves a local web panel for setup and manual control.

## Runtime Shape

- **Backend:** Fastify in `apps/api`
- **Panel:** React + Vite in `apps/web`
- **Shared contracts:** Zod schemas in `packages/shared`
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

## What Phase 3 Adds (in progress)

Phase 3 turns the manual slice into an unattended service. It is being delivered across the `0.5.x` line:

- **`v0.5.0` (regressed, do not deploy):** introduced the scheduler module and the partial `health.scheduler` block, but with two bugs — the scheduler arranged a 15-minute default when `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` was unset (silently turning on for upgrading operators), and the documented service-level anti-overlap was missing in code (`startMirror` inserted a new `sync_runs` row on every call without consulting `getActiveSyncRun`). See CHANGELOG `[0.5.1]` for the post-mortem.
- **`v0.5.1` (stable Phase 3 entry):** scheduler is genuinely opt-in (default `0` = disabled); `runScheduledSync()` / `runSync` consult `store.getActiveSyncRun()` before inserting and return the existing run id when one is active; the scheduler tick reports `lastTickStatus = "skipped"` (with reason in `lastTickError`) when the service-layer absorbs the tick, instead of mislabelling it as `completed`. 9 regression tests (env-var matrix, concurrent `runSync` reuse, scheduler `runTick → { skipped: true }` path).
- **`v0.5.2`:** panel-driven scheduler configuration. New `RuntimeConfig.schedulerIntervalMs` field (persisted in SQLite via the existing `settings` key/value table, same pattern as `webhookUrl`), new `SchedulerManager` (`apps/api/src/runtime/scheduler-manager.ts`) that swaps the underlying `Scheduler` in place when the interval changes, new "Continuous sync scheduler" card on the Configuration tab. `PUT /api/config` accepts an optional `schedulerIntervalMs`; the env var is downgraded to a one-time seed (`RuntimeStore.seedSchedulerDefaults`). 9 tests covering the new path.
- **`v0.5.3` (this release):** durable webhook outbox (D-013). New SQLite table `webhook_outbox` with FSM `pending → delivering → delivered | retry_waiting → permanently_failed`. New `OutboxWorker` (`apps/api/src/runtime/outbox-worker.ts`, 5-second cadence, reuses the existing `Scheduler` for the timer, recomputes the HMAC at delivery time so a rotated `webhookSecret` is honoured). Exponential backoff `[30s, 2m, 10m, 30m, 1h, 2h, 4h, 8h]` and `OUTBOX_MAX_ATTEMPTS = 8`. `service.processRecording` enqueues instead of POSTing; `lastWebhookStatus` enum gains `"queued"`. New routes `GET /api/outbox` (failed list) and `POST /api/outbox/:id/retry`; new `health.outbox` counters block (`pending` / `retryWaiting` / `permanentlyFailed` / `oldestPendingAgeMs`); new `SyncRunSummary.enqueued` counter. Panel gains a "Webhook outbox" card with counters + failed-list + Retry buttons. 11 new tests covering the FSM, the worker, and the HTTP shape.
- **next: v0.5.5** — full health observability — `lastErrors` ring buffer + extended outbox/sync history surfaced through `/api/health` (D-014, full). (`v0.5.4` was governance-only — Layer-1 doc-drift enforcement, D-016 — with no runtime change.)

Still **not** in Phase 3 scope:

- resumable backfill (deferred; ROADMAP mentions but no firm release target)
- automatic re-login → [Phase 4](ROADMAP.md)
- NAS rollout → [Phase 5](ROADMAP.md)
- public OSS polish → [Phase 6](ROADMAP.md)

## Key Flows

### Auth

1. Operator pastes a Plaud bearer token in the web panel.
2. API validates it with `/user/me`.
3. Token is encrypted with `PLAUD_MIRROR_MASTER_KEY` and stored at rest.
4. Auth status is exposed through `/api/auth/status` and `/api/health`.

### Sync / Backfill (Mode B — download up to N missing, async)

1. Operator triggers `POST /api/sync/run` or `POST /api/backfill/run` with a `limit` (0–1000). The API returns `202 Accepted` with `{ id, status: "running" }` immediately — it does **not** wait for the download work.
2. The service registers a `sync_runs` row (`status = "running"`, no `finished_at`) and hands the actual work to a pluggable scheduler. The default scheduler is `setImmediate`; tests inject a deterministic scheduler that settles on demand.
3. Background work validates the stored token.
4. `client.listEverything()` paginates Plaud's full listing (`/file/simple/web?skip=N&limit=500`) until a page arrives shorter than 500 — signal of the last page. Every recording in the account is captured in date-desc order, plus the authoritative `plaudTotal`. Stable sequence numbers are recomputed from the oldest-first order.
5. Local filters are applied (date range, serial number, scene) if any.
6. Candidate selection walks the filtered list newest-first and keeps a recording when it is **not dismissed** AND (if `forceDownload=false`) **not already mirrored locally** (i.e. `localPath` is null). Webhook delivery status is intentionally NOT part of this filter — a recording on disk is "mirrored" regardless of whether its webhook was delivered or skipped. Stops at `limit` candidates. `limit=0` is legal and means "refresh the listing and ranks, download nothing" (used by the panel's "Refresh server stats" button).
7. Each candidate resolves detail and temp URL, downloads the artifact, writes:
   - `recordings/<recording-id>/audio.<ext>`
   - `recordings/<recording-id>/metadata.json`
   - After each candidate the run row is updated via `store.updateSyncRunProgress` so the panel's poll sees `downloaded` climb in real time.
8. Recording state is upserted into SQLite. Sync summary records `examined` (every recording Plaud returned), `matched` (final candidate count), `downloaded`, `plaudTotal`, and is finalized with `status = "completed"` or `"failed"` and a `finishedAt` timestamp.

The web panel polls `GET /api/health` every 2 s while a run is active. The health payload splits state into two fields: `lastSync` holds the last COMPLETED run (drives "Last run" stats, "Plaud total", and the hero metric) and stays pinned while a new run is in flight; `activeRun` holds the running run (drives the progress banner). Polling stops once `activeRun` becomes `null` — at that point `lastSync.id` matches the run's id and the final summary is surfaced. The pre-0.4.7 semantics ("look at the N newest recordings Plaud has and skip ones that are already mirrored") silently did nothing when the N newest were all already local. Mode B instead walks as deep as needed to find N genuine gaps.

### Webhook (durable outbox, D-013, v0.5.3+)

1. After mirroring, `service.enqueueOrSkipWebhook(recording, mode)` builds the `recording.synced` payload and inserts a row into `webhook_outbox` with `state = 'pending'`. The recording row is updated with `lastWebhookStatus = "queued"`. **No HTTP call happens during the sync run.** When no webhook URL or secret is configured, the helper short-circuits to `lastWebhookStatus = "skipped"` and never enqueues.
2. The `OutboxWorker` runs an independent `setTimeout` loop at 5-second cadence. Each tick atomically claims one row (`pending` or `retry_waiting` whose `next_attempt_at` is due) by transitioning it to `delivering` via a guarded `UPDATE`. The atomic claim ensures a worker tick and a panel-triggered retry cannot pick the same row twice.
3. The worker recomputes the HMAC signature at delivery time using the current `webhookSecret` (so an operator-rotated secret is honoured for items already in the queue) and stamps `sync.deliveryAttempt` to the current attempt number. POSTs to the configured `webhookUrl` with `AbortSignal.timeout(requestTimeoutMs)`.
4. On a 2xx response: `markOutboxDelivered` (state → `delivered`, attempts++) plus a `webhook_deliveries` audit row with status `success`.
5. On a non-2xx response or thrown error: a `webhook_deliveries` row with status `failed` is recorded, then either `markOutboxRetry(id, nextAttemptAt, error)` (state → `retry_waiting`, attempts++, `next_attempt_at = now + backoff[attempts]`) or `markOutboxPermanentlyFailed(id, error)` (state → `permanently_failed`, attempts++) when `attempts >= OUTBOX_MAX_ATTEMPTS`. Backoff schedule: `[30s, 2m, 10m, 30m, 1h, 2h, 4h, 8h]` — cumulative ~16 h before escalating.
6. The panel polls `health.outbox` (`pending` / `retryWaiting` / `permanentlyFailed` / `oldestPendingAgeMs`) and `GET /api/outbox` (the list of `permanently_failed` rows) to render the Webhook outbox card on the Configuration tab. `POST /api/outbox/:id/retry` resets a `permanently_failed` row to `pending` (`attempts = 0`, `last_error = null`) so the worker re-attempts on its next tick.
7. The legacy `webhook_deliveries` table stays as-is (append-only audit log; every attempt records a row regardless of success/failure). The new `webhook_outbox` table holds live retry state — once a row reaches `delivered` or `permanently_failed`, the worker never touches it again.

### Local curation (audition then dismiss)

1. The operator auditions an audio file inline in the web panel via `GET /api/recordings/<id>/audio`, which streams the local file with its original content-type. Recording ids are validated against a strict character allowlist before any filesystem access, and the resolved path is confirmed to stay inside the configured recordings directory.
2. The operator may issue `DELETE /api/recordings/<id>`. The service unlinks the local audio file, clears `localPath` and `bytesWritten` on the SQLite row, and sets `dismissed=true` with a `dismissedAt` timestamp. Plaud itself is not touched.
3. Subsequent sync/backfill runs detect `dismissed=true` and skip the recording without attempting to re-download it.
4. The operator can restore a dismissed recording via `POST /api/recordings/<id>/restore`. The service clears the `dismissed` flag **and immediately re-downloads the audio** (fetching fresh `/file/detail` and `/file/temp-url` from Plaud, then writing the artifact back to `recordings/<id>/audio.<ext>`). If the immediate download fails (e.g. missing or invalid token), the flag is still cleared so the next scheduled sync can retry, and the API surfaces the error so the operator can recover.

### Backfill preview (dry-run)

1. Operator edits the device / date filters in the Historical backfill form. After a 500 ms debounce the panel calls `GET /api/backfill/candidates?from=...&to=...&serialNumber=...&previewLimit=200`.
2. The server runs the same first half of the sync pipeline as `executeMirror`: validate token → `client.listEverything()` → `applyLocalFilters`. No download happens; no `sync_runs` row is created.
3. Each matching recording is annotated with its local state by looking up the current SQLite row:
   - `"missing"` — not on disk, would be downloaded
   - `"mirrored"` — already local, would be skipped (unless `forceDownload`)
   - `"dismissed"` — operator dismissed locally, would be skipped
4. The response includes `plaudTotal`, `matched` (pre-truncation count), `missing` (how many would actually download), `previewLimit`, and the recordings array (newest-first, capped at `previewLimit`, default 200, max 500). The panel renders this as a table with colored state badges and a header summary ("X match — Y would be downloaded").
5. Because the preview reuses the exact same primitives (`listEverything`, `applyLocalFilters`, same date normalization via `toStartTimestamp`/`toEndTimestamp`), it cannot drift from real backfill behavior.

### Continuous sync scheduler (Phase 3, opt-in via env)

1. **Source of truth: SQLite, seeded once from the env var.** From `v0.5.2` onwards, the active scheduler interval is the `config.schedulerIntervalMs` row in the `settings` table (same key/value store the webhook URL already uses). On `service.initialize()`, `RuntimeStore.seedSchedulerDefaults(env.schedulerIntervalMs)` writes the env-var-derived value to SQLite **only if the row is absent** — once the operator has touched the panel even once, the env var is irrelevant on every subsequent boot. `parseSchedulerInterval` (`apps/api/src/runtime/environment.ts`) still applies its rules to the env var (`0`/unset/empty → 0; `≥ 60 000` accepted; `<60 000` positive or non-integer → rejected at startup); but the value it produces is now a seed, not a live setting. (`v0.5.0` arranged a 15-minute fallback here, which broke the opt-in promise of the SemVer minor bump; `v0.5.1` reverts the fallback to `0`; `v0.5.2` keeps that and additionally moves the live knob to SQLite.)
2. **Lifecycle is owned by `SchedulerManager`** (`apps/api/src/runtime/scheduler-manager.ts`). At boot, `createApp` constructs the manager unconditionally and calls `manager.applyInterval(config.schedulerIntervalMs)` after reading the persisted value via `service.getConfig()`. The manager keeps a single underlying `Scheduler` instance: `applyInterval(0)` stops and clears it; `applyInterval(N>=60_000)` constructs a fresh `Scheduler` with that cadence and calls `start()`; `applyInterval(currentValue)` is a no-op (the live cadence is preserved on a no-op save from the panel). Sub-floor positive values throw at the manager level as defence-in-depth — the request boundary in `service.updateConfig` rejects with HTTP 400 first.
3. **Hot reconfigure from the panel.** `service.setSchedulerReconfigureHook(hook)` is wired to `manager.applyInterval` during boot. When `service.updateConfig` accepts a `schedulerIntervalMs` field via `PUT /api/config`, it (a) validates the floor at the request boundary, (b) persists via `store.saveConfig`, and (c) calls the reconfigure hook so the live `Scheduler` is started / stopped / swapped immediately, no container restart needed. `service.setSchedulerStatusProvider(() => manager.status())` is also wired so `getHealth` always reads the live state regardless of which `Scheduler` instance is active.
4. **The tick callback** (defined inline in `createApp` and shared by every `Scheduler` the manager creates) invokes `service.runScheduledSync()`. That method returns `{ id, started: boolean }`: when `started: true`, a fresh run was created; when `started: false`, an existing run absorbed the tick. The callback maps the latter to `{ skipped: true, reason: "another sync run was already in flight" }`, which the scheduler turns into `lastTickStatus = "skipped"` with the reason recorded in `lastTickError`.
3. **Anti-overlap is two layers (`v0.5.1` ships both — `v0.5.0` only had the second):**
   - **Service-layer (first guardrail).** `startOrReuseMirror` (the private helper used by `runSync`, `runBackfill`, and `runScheduledSync`) calls `store.getActiveSyncRun()` before allocating a new `sync_runs` row. If a run is already mid-flight (manual or scheduled, no distinction), the helper returns the existing run's id with `started: false` and dispatches no new background work. Public REST callers see `{ id, status: "running" }` — indistinguishable from a fresh start because their contract is "poll until done." The scheduler tick callback uses `started: false` to label the tick `skipped` honestly.
   - **Scheduler-level (second guardrail).** `Scheduler.executeTick` keeps an `inflight` flag: if the timer fires while the previous tick's promise has not resolved, the new fire is also recorded as `skipped` and discarded. This case is rare in practice (it requires a tick to take longer than `intervalMs`), but it is the second guardrail that protects against a silent backlog if Plaud responses degrade or the service-level reuse fails for some unforeseen reason.
4. The next tick is scheduled **before** the current `runTick` is awaited. This means a long-running tick (large limit, slow Plaud responses) does not push subsequent ticks back; the cadence is always `intervalMs` from the previous fire, regardless of how long the work took. Anti-overlap absorbs the case where the work outlasts the interval.
5. `Scheduler.status()` returns `{ enabled, intervalMs, nextTickAt, lastTickAt, lastTickStatus, lastTickError }`. `getHealth()` calls the registered status provider and includes the result as `scheduler` in the `/api/health` response. When the scheduler is enabled, `phase` reads `"Phase 3 - unattended operation"`; when it is disabled, `phase` falls back to the historical `"Phase 2 - first usable slice"` string. Older clients that read `health.scheduler` get the disabled-shape default `{ enabled: false, intervalMs: 0, nextTickAt: null, lastTickAt: null, lastTickStatus: null, lastTickError: null }` thanks to Zod's `.default(...)` on `ServiceHealthSchema.scheduler`.
6. Shutdown is wired via `app.addHook("onClose", async () => scheduler.stop())` so SIGTERM / Fastify graceful-close cancels the pending timer cleanly without leaving a half-fired tick.

### Device catalog

1. During the background portion of a sync run, the service calls `client.listDevices()` which hits `GET /device/list`. The response is translated from Plaud's wire shape (`sn`, `name`, `model`, `version_number`) into the domain `Device` type (`serialNumber`, `displayName`, `model`, `firmwareVersion`, `lastSeenAt`). The wire format is isolated to `packages/shared/src/plaud.ts`; the rest of the codebase only imports `Device`.
2. Results are bulk-upserted into the `devices` SQLite table inside a single transaction. Rows are never deleted: when a device is unbound from the account, its row stays so historical recordings (which reference `serialNumber` directly) can still resolve a name. `lastSeenAt` is bumped only for devices present in the current response, so the UI can distinguish "active" from "retired".
3. Failures on `/device/list` are caught and logged; they do NOT fail the containing sync. Device metadata is a UX convenience, not a correctness property.
4. `GET /api/devices` returns `{ devices: Device[] }` (read-only, no network call — just reads the cached SQLite table). The web panel's backfill form uses this to render a `<select>` instead of requiring the operator to paste a raw serial number.

## Storage Layout

- `data/app.db`
  SQLite state for config, auth metadata, recordings (including `dismissed` / `dismissed_at` columns for local-only curation), devices (cached from `/device/list`), sync runs, and webhook delivery attempts
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
- This remains a single-operator service; external auth is out of scope for now.

## Next Architectural Step

Phase 3 is in progress (`v0.5.2` adds panel-driven scheduler config on top of the `v0.5.1` stabilization; `v0.5.0` is broken and superseded). The remaining Phase 3 work and Phase 4 horizon:

- **Phase 3 cont.:** full health observability — `lastErrors` ring buffer + extended outbox/sync history surfaced through `/api/health` (D-014, full; lands in v0.5.5)
- Resumable backfill (deferred; ROADMAP mentions but no firm release target)
- **Phase 4:** automatic re-login via a non-browser path if it proves reliable
- More robust degraded-state handling (incremental, threaded through Phase 3 + 4)
