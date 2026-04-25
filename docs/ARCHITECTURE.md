<!-- doc-version: 0.5.0 -->
# Plaud Mirror Architecture

> Version: 0.5.0
> Last Updated: 2026-04-25
> Status: Phase 3 in progress — v0.5.0 ships the in-process continuous sync scheduler (D-012) and the partial health observability surface (D-014, scheduler subset). Inherits the entire Phase 2 slice (manual sync/backfill, curation, UX polish, Mode B, classic pagination, sequence numbers, async-202 with live-progress polling, device catalog, backfill dry-run preview, Vitest+jsdom+@testing-library/react test framework). Webhook outbox (D-013) and full health observability (lastErrors, outbox backlog) are deferred to v0.5.1 / v0.5.2.

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

- **`v0.5.0` (this release):** in-process continuous sync scheduler with anti-overlap protection (D-012); partial health observability — scheduler subset only (D-014, partial). Scheduler is opt-in via `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS`; defaults to disabled (Phase 2 manual-only behavior preserved when the variable is absent or `0`).
- **`v0.5.1` (next):** durable webhook outbox with explicit FSM (`pending` / `delivering` / `delivered` / `retry_waiting` / `permanently_failed`) and exponential-backoff retry (D-013).
- **`v0.5.2` (after):** full health observability — `lastErrors` ring buffer + outbox backlog counters surfaced through `/api/health` (D-014, full).

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

### Webhook

1. After mirroring, the service builds a `recording.synced` payload.
2. If a webhook URL and secret are configured, it signs the payload with HMAC-SHA256.
3. Delivery result is persisted in SQLite, even when the request fails.

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

1. At startup, `createApp` reads `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS`. The value is parsed by `parseSchedulerInterval` in `apps/api/src/runtime/environment.ts`: `0` (or unset) means **disabled** — Phase 2 manual-only behavior is preserved. Any positive value enforces a 60 000 ms (60 s) floor; the default when the variable is set to a non-numeric or empty value is 15 minutes.
2. When the interval is positive, `createApp` instantiates a `Scheduler` (`apps/api/src/runtime/scheduler.ts`) whose `runTick` callback invokes `service.runSync({ limit: environment.defaultSyncLimit })`. The scheduler is then `start()`ed and a `service.setSchedulerStatusProvider(() => scheduler.status())` hook is wired so health responses can read live state.
3. The scheduler is a single in-process `setTimeout` loop. Each fire enters `tick()`, which is guarded by an `inflight` flag: if the previous tick has not yet resolved, the new fire records `lastTickStatus = "skipped"` and returns immediately. This is the **scheduler-level anti-overlap** — the second guardrail. The first is `service.runSync` itself, which serializes via `getActiveSyncRun` and rejects if a run is already in flight (returning the existing `id`); a "skipped" tick is therefore the expected outcome whenever a manual operator-triggered run is mid-flight.
4. The next tick is scheduled **before** the current `runTick` is awaited. This means a long-running tick (large limit, slow Plaud responses) does not push subsequent ticks back; the cadence is always `intervalMs` from the previous fire, regardless of how long the work took. Anti-overlap absorbs the case where the work outlasts the interval.
5. `Scheduler.status()` returns `{ enabled, intervalMs, nextTickAt, lastTickAt, lastTickStatus, lastTickError }`. `getHealth()` calls the registered status provider and includes the result as `scheduler` in the `/api/health` response. When the scheduler is enabled, `phase` reads `"Phase 3 - unattended operation"`; when it is disabled, `phase` falls back to the historical `"Phase 2 - manual sync"` string. Older clients that read `health.scheduler` get the disabled-shape default `{ enabled: false, intervalMs: 0, nextTickAt: null, lastTickAt: null, lastTickStatus: null, lastTickError: null }` thanks to Zod's `.default(...)` on `ServiceHealthSchema.scheduler`.
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

Phase 3 is in progress (`v0.5.0` ships the scheduler subset). The remaining Phase 3 work and Phase 4 horizon:

- **Phase 3 cont.:** durable webhook outbox with retry/backoff (D-013 → `v0.5.1`)
- **Phase 3 cont.:** full health observability — `lastErrors` ring buffer + outbox backlog counters surfaced through `/api/health` (D-014, full → `v0.5.2`)
- Resumable backfill (deferred; ROADMAP mentions but no firm release target)
- **Phase 4:** automatic re-login via a non-browser path if it proves reliable
- More robust degraded-state handling (incremental, threaded through Phase 3 + 4)
