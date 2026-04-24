# Changelog

All notable changes to Plaud Mirror are documented in this file.

This project follows Semantic Versioning (SemVer): MAJOR.MINOR.PATCH.

## [0.4.14] - 2026-04-24

### Added
- Tab bar above the card grid with two tabs: **Main** (Manual sync + Historical backfill + Library) and **Configuration** (Plaud token + Webhook delivery). Active tab persists in `localStorage` (`plaud-mirror:active-tab`) so a refresh keeps the operator where they were. Default is **Main**.
- Historical backfill card is now **collapsible**. Header is clickable (plus Enter/Space keyboard support) and shows a caret. Default state is **collapsed** — expanding the card triggers the `/api/backfill/candidates` preview, so keeping it closed on first load avoids hitting Plaud with a preview query nobody asked for. Expanded/collapsed state persists in `localStorage` (`plaud-mirror:backfill-expanded`).

### Changed
- Panel information architecture split into setup (Configuration tab) and day-to-day use (Main tab). Previously everything was on one scroll; the Configuration surface is rarely revisited after first setup and was adding vertical noise.
- `BackfillPreview` component is only mounted when the Historical backfill card is expanded. Its `useEffect` (debounced fetch on filter change) therefore does not fire while the card is collapsed — no wasted Plaud call.

## [0.4.13] - 2026-04-24

### Changed
- Controls section layout. Manual sync and Historical backfill were sharing a two-column grid (`.two-up`), but the backfill preview table couldn't fit in half the viewport and overflowed horizontally. Both cards now stack full-width in the new `.stack-sections` container, giving the preview enough room to render without horizontal scroll.
- Device column in the backfill preview now shows the operator's nickname ("Office", "Travel") pulled from the device catalog instead of the raw serial number. Falls back to `PLAUD <model>` when a device has no nickname and to `PLAUD-<tail6>` when the serial isn't in the catalog (retired device, or preview fired before the first sync). New helper `formatDeviceShortName(serialNumber, catalog)` on the web side; `BackfillPreview` now receives `devices` as a prop.
- Preview table uses `<colgroup>` with fixed widths (`#`, Date, Duration, Device, State) so Title is the only flex column. Combined with `table-layout: fixed` and per-cell `overflow: hidden; text-overflow: ellipsis`, the table fits inside the card without horizontal scroll. Vertical scroll (`max-height: 360px`) is unchanged.

## [0.4.12] - 2026-04-24

### Added
- Backfill preview. New `GET /api/backfill/candidates?from&to&serialNumber&scene&previewLimit` runs the same filter pipeline as a real backfill (`client.listEverything` + `applyLocalFilters`) and returns the matching recordings annotated with their current local state (`"missing"`, `"mirrored"`, `"dismissed"`) WITHOUT downloading anything. Response shape: `{ plaudTotal, matched, missing, previewLimit, recordings: BackfillCandidate[] }`.
- Web panel renders a preview table inside the Historical backfill card, fed by the new endpoint, debounced 500 ms on filter changes. Columns: `#N`, Title, Date, Duration, Device, State (with colored badges). Header shows "X match — Y would be downloaded (of Z total in Plaud)". Truncates to 200 rows with a "Showing first 200 of M" footer when the filter matches more.
- Shared schemas: `BackfillCandidateStateSchema`, `BackfillCandidateSchema`, `BackfillPreviewFiltersSchema`, `BackfillPreviewResponseSchema`.
- Two new tests: service `previewBackfillCandidates` annotates state and respects filters + `previewLimit` cap; server `GET /api/backfill/candidates` returns the right shape and narrows by `serialNumber`.

### Changed
- Scene filter removed from the backfill form. The input was opaque (raw integer like `7` with no in-app mapping to meaning) and operators could not know what to enter. The backend schema still accepts `scene` for programmatic callers (optional, nullable) — only the UI widget is gone. If scene filtering proves useful later, it will be reintroduced with a real dropdown of values present in the account.
- Historical backfill card is now just "Device" (select) + date range, with the live preview below and "Run filtered backfill" at the bottom. The operator sees exactly what a click would do before clicking.

## [0.4.11] - 2026-04-24

### Added
- Device catalog. The Plaud `/device/list` endpoint is now consumed by `client.listDevices()`, translated from wire shape (`sn`, `version_number`) to the domain `Device` type (`serialNumber`, `displayName`, `model`, `firmwareVersion`, `lastSeenAt`), persisted in a new `devices` SQLite table (additive migration), and exposed read-only through `GET /api/devices`. Populated as a side effect of every sync: a failure on the device endpoint is caught and logged without failing the sync itself (`refreshDevices` is best-effort, the run still completes).
- Web panel replaces the "Serial number" text input in the backfill form with a real device selector (`<select>`) populated from `/api/devices`. Labels render as `displayName — model (#abc123)` with fallbacks for devices that never got a nickname, and the dropdown surfaces a hint when no devices have been seen yet so the operator knows a sync will populate it.
- Shared schemas: `PlaudRawDeviceSchema` / `PlaudDeviceListResponseSchema` (wire) and `DeviceSchema` / `DeviceListResponseSchema` (domain) in `packages/shared`. Wire types stay in `plaud.ts`, domain types in `runtime.ts`, and only the Plaud client knows the wire fields — the store, service, server, and UI only see the domain shape.
- Store: `upsertDevice`, `upsertDevices` (single transaction for bulk writes), `listDevices`, `getDevice`. `listDevices` orders by `last_seen_at DESC, serial_number ASC` so the currently-connected device surfaces first but retired devices still appear (useful for historical recordings).
- Seven new tests: two on the client (wire→domain translation; empty-serial guard), two on the store (upsert-rewrites + retired-device retention; empty-array no-op), two on the service (refresh populates catalog; `/device/list` failure does not fail the sync), one end-to-end on the server (`GET /api/devices` returns the refreshed catalog after a `limit=0` sync).

### Changed
- `DEFAULT_BACKFILL_DRAFT.serialNumber` semantics unchanged, but the input it maps to is no longer free-form — it is bound to the `<select>` value, so `""` means "any device" and any other value comes from the device catalog. This avoids typos (previously, a mistyped serial silently returned zero backfill matches).

## [0.4.10] - 2026-04-24

### Added
- Async sync architecture (Option C). `POST /api/sync/run` and `POST /api/backfill/run` now return `202 Accepted` with `{ id, status: "running" }` immediately and schedule the download work in the background via a pluggable scheduler (`defaultScheduler` uses `setImmediate`). New `GET /api/sync/runs/:id` returns the live `SyncRunSummary` for polling. Sync progress (`examined`, `matched`, `downloaded`, `plaudTotal`) is persisted incrementally through `store.updateSyncRunProgress` so the panel sees the numbers climb mid-run instead of waiting for the final result.
- Web panel polls `/api/health` every 2 s while a run is active and shows a dynamic banner ("Sync running: downloaded X of Y candidates so far (examined N / M in Plaud)") instead of the old static "Working…" text. When the run finishes it surfaces a per-mode banner and stops polling.
- "Refresh server stats" button in the Manual sync card. It posts a `limit=0` sync, which walks the full Plaud listing, updates `plaudTotal` + stable ranks, and downloads nothing. This is the non-destructive way to reconcile the hero metric and `#N` badges after external changes without touching the wire.
- `ServiceHealthSchema` gained `activeRun: SyncRunSummary | null` alongside the existing `lastSync`. `lastSync` now holds the last COMPLETED run (used for "Last run" stats, "Plaud total", and the hero metric); `activeRun` holds the in-flight run (used for the progress banner and to decide when to stop polling). This prevents stats from flickering to zeroes while a new sync is in flight — previously the panel showed "running, matched 0, downloaded 0" and "Plaud total: unknown until first sync" as soon as sync started, because `getLastSyncRun` returned the in-progress row.
- Four new tests covering the separation: `store.test.ts` `getLastSyncRun` vs `getActiveSyncRun`, `service.test.ts` limit=0 + `getHealth` payload split, `server.test.ts` 202/polling round-trip.

### Changed
- `SyncFiltersSchema.limit` now accepts `0` (previously required positive). `limit=0` is the refresh-only path: paginate, update ranks and `plaudTotal`, do not download.
- `SyncRunStatusSchema` gained `"running"`; `SyncRunSummarySchema.finishedAt` is now nullable so the status endpoint can surface a run that has not finished yet.
- `runSync` / `runBackfill` return type changed from `Promise<SyncRunSummary>` to `Promise<StartSyncRunResponse>`; callers poll `GET /api/sync/runs/:id` (or `/api/health.lastSync`) for the final summary.
- `store.getLastSyncRun()` now filters `WHERE finished_at IS NOT NULL` and orders by `finished_at DESC`, so only completed runs surface; new `store.getActiveSyncRun()` returns the running row if any.

## [0.4.9] - 2026-04-23

### Fixed
- "Run sync now" with `limit=N` was reporting `matched=N, downloaded=0` and not actually pulling anything when the operator had no webhook configured. The Mode B candidate filter only skipped already-mirrored rows whose `lastWebhookStatus === "success"`. Without a webhook configured every row's status is `"skipped"`, so rows already on disk slipped past the filter, became candidates, and `processRecording` then short-circuited without re-downloading. The candidate filter now skips any row with a non-null `localPath` regardless of webhook status — webhook delivery is unrelated to "is this audio missing locally?". Setting `forceDownload=true` still overrides this. Test in `service.test.ts` updated to seed a row with `lastWebhookStatus: "skipped"` (matching the no-webhook reality) and assert it is skipped from candidates.

## [0.4.8] - 2026-04-23

### Added
- Library now has classic pagination: Prev / Next buttons, "Showing X–Y of Z (page A of B)" status, and a per-page selector (25/50/100/200 default 50). Backend gains `?skip=N` on `GET /api/recordings`, response now carries `{ recordings, total, skip, limit }`. Toggling "Show dismissed" or changing page size resets to page 0 to avoid landing on an empty page.
- Each library row's `#N` badge is now a **stable sequence number** based on the recording's position in the operator's full Plaud timeline (sorted oldest-first). `#1` is the oldest recording on the device; `#N` is the newest. Numbers do not shift when new recordings arrive — a brand-new recording becomes `#N+1`. Stored as `sequence_number` on the `recordings` table (additive migration, nullable) and updated in bulk after every sync from `client.listEverything`'s authoritative ordering.

### Changed
- The hero metric no longer renders a misleading "100 / 1" — once the v0.4.8 sync runs, all 100 of the operator's mirrored recordings get their stable rank from Plaud's full timeline (e.g. ranks 209..308 for the 100 newest of an account with 308 total), and the `Plaud total` reflects the real account size from `listEverything`.

### Fixed
- The `#N` badge no longer reshuffles when a new recording arrives. Previously it was the visual position in the current page, so a new recording at the top would push every existing `#1`, `#2`, ... down by one. Now ranks are anchored to creation date and are stable.

## [0.4.7] - 2026-04-23

### Added
- `client.listEverything(pageSize)` paginates the full Plaud listing until a page arrives shorter than `pageSize`, returning every recording plus the authoritative total. This is the only reliable way to learn the account's true size — Plaud's `data_file_total` field just mirrors the current page's length, it is not the grand total.
- `/api/health` now includes `dismissedCount` alongside `recordingsCount` so the panel can compute a "Missing" figure without a second round-trip.
- Manual-sync card now shows `Plaud total`, `Mirrored locally`, `Dismissed`, and `Missing` (`plaudTotal − mirrored − dismissed`) inline.
- Two new unit tests: `listEverything` pagination boundary + Mode B candidate selection (skip already-mirrored-success + skip dismissed).

### Changed
- **Sync and backfill now use "Mode B" semantics.** Instead of "look at the latest N Plaud recordings and skip those already local" (which silently did nothing when your N newest were all mirrored), the service now fetches every Plaud listing, filters out dismissed and already-mirrored-success recordings, and downloads up to N of the remaining missing ones (newest first). If you ask `limit=5` and the 5 newest are all mirrored, it walks deeper into the past until it finds 5 missing recordings — or stops when Plaud is exhausted. Matches the operator's mental model of "download N that I don't have".
- Library recordings are now ordered by `created_at DESC` (real Plaud recording date) instead of the old `mirrored_at DESC` (when we downloaded them). Previously, everything mirrored in one batch landed at the same `mirrored_at` and the tie-break was by id, producing apparent randomness.
- Backfill card copy clarifies the new semantics: "Same behavior as Manual sync (download up to N missing, newest first), but only from recordings that match the filters below."

### Fixed
- Hero "Recordings" metric no longer shows misleading round numbers like `100 / 1`. After any sync run, `plaudTotal` reflects Plaud's actual account size from pagination, not the capped `examined` count from the page size we requested.

## [0.4.6] - 2026-04-23

### Added
- Each row in the library is prefixed with a `#N` index badge so the operator can keep visual track of position while scrolling the list.
- Sync run summaries now carry Plaud's real `data_file_total` (called `plaudTotal` in the schema and DB). `client.listAllRecordings` returns `{ recordings, totalAvailable }` and the service records the total in the SyncRunSummary. SQLite gains a nullable `plaud_total` column via additive migration.

### Changed
- The hero "Recordings" metric now reads from `lastSync.plaudTotal` instead of `lastSync.examined`. Earlier versions showed the number of recordings the last sync had looked at (which is capped by the caller's `limit` and therefore misleadingly round — if you synced with `limit=100`, the hero showed `X / 100` regardless of the real Plaud total).
- "Manual sync" card now surfaces `Remote total (Plaud)` and a separate `Examined last run (capped by the limit you chose)` line so the operator can tell the two numbers apart.

### Fixed
- Misleading `X / 100` hero metric after a sync with `limit=100`: the UI now shows the real Plaud total, not the limit-capped `examined` count.

## [0.4.5] - 2026-04-23

### Added
- "Working…" info banner shown while any sync / backfill / restore / token operation is in flight, so the operator sees that something is happening instead of just a disabled button.
- Hero "Recordings" metric now renders as `local / remoteTotal` when a sync has run (remoteTotal comes from the last sync's `examined` count), so the operator can tell at a glance how many recordings exist in Plaud vs how many are mirrored locally.
- "Manual sync" card now surfaces `Last run`, `Remote total (at last sync)`, and `Mirrored locally` inline, plus a reminder sentence about the conservative default limit.

### Changed
- **Default sync limit in the web panel is now `1` instead of `100`.** A careless click no longer bulk-downloads 100 recordings; the operator raises the number deliberately before running a larger sync.
- The "Run sync now" button label flips to `Running…` while the request is in flight.

### Fixed
- Disabled buttons no longer show a wait cursor when they are disabled because of state (e.g. "Delete local mirror" on a row with no `localPath`). The wait cursor is now reserved for the window in which a global operation is running, via a `.working` class on the shell; outside of that window disabled buttons show the standard `not-allowed` cursor.

## [0.4.4] - 2026-04-23

### Changed
- `POST /api/recordings/:id/restore` no longer just clears the `dismissed` flag and waits for the next sync. It now also **re-downloads the audio immediately** so the operator sees the recording playable in the library on the same click. If the immediate download fails (e.g. missing or invalid Plaud token), the dismissed flag is still cleared — intent is respected — and the API surfaces the error so the operator can recover the token and let the scheduler pick it up later.
- UI copy updated to match: the Restore button now reads "Restore (re-download now)" and the success banner says "Restored and re-downloaded «title»." instead of referring to a future sync.

### Fixed
- The library used to leave a restored recording in a confusing half-state: no audio player, a disabled Delete button, and no clear indication of what to do next. With the immediate re-download, a Restore click either produces a fully playable row (happy path) or a visible error (auth / network) — no more silent "pending" state.

## [0.4.3] - 2026-04-23

### Fixed
- The "Delete local mirror" and "Restore" buttons in the web panel returned HTTP 400 from Fastify because `requestJson` in `apps/web/src/App.tsx` always sent `Content-Type: application/json` — even on DELETE / POST calls with no body. Fastify's default body parser then rejected the request with "Body cannot be empty when content-type is set to 'application/json'". The helper now only attaches the JSON content-type header when the call actually has a body, so `DELETE /api/recordings/:id` and `POST /api/recordings/:id/restore` work from the UI. The route from `curl` or direct `fetch()` calls without the header had always worked; the bug was only visible from the product panel.

## [0.4.2] - 2026-04-23

### Added
- HTTP Range support on `GET /api/recordings/:id/audio`: responses now advertise `Accept-Ranges: bytes`, include `Content-Length`, and honor `Range: bytes=start-end` (including suffix form `bytes=-N` and open-ended `bytes=start-`). Ranges that overlap the file end are clamped; unsatisfiable ranges return `416` with `Content-Range: bytes */size`. Multipart byteranges are intentionally unsupported (an `<audio>` element never asks for them). Two new tests cover the four RFC 7233 single-range shapes and a happy-path 206 / full 200 pair.
- `formatDuration(totalSeconds)` helper in the web panel that renders short clips as `42s`, medium as `3:06`, and long as `1:02:15`. The "days" bucket is intentionally not implemented until a real recording needs it.

### Fixed
- Audio player scrubbing in the library. Previously the `<audio>` element could not reliably seek mid-playback because the stream had no `Content-Length` and the server did not respond to `Range` requests, so clicking the progress bar would restart from zero or land at the wrong position. With Range support the browser can now jump to any byte range and the UI position matches actual playback.
- Duration display is now human-readable (e.g. `3:06` instead of `186.0s`).

## [0.4.1] - 2026-04-23

### Changed
- `docs/ROADMAP.md` now explicitly extends Phase 2 through both `0.3.x` and `0.4.x` (to cover the curation increment added in `0.4.0`) and every later phase shifts by one minor version; `0.5.x` is now Phase 3, `0.6.x` Phase 4, and so on. SemVer stays authoritative over phase labels.
- `README.md` no longer recommends `vxcontrol/kali-linux:latest` as a Docker fallback. The acceptable substitutes are documented as locally cached Node slim/alpine images, side-loaded `node:20-bookworm-slim` via `docker save`/`docker load`, or a pull-through registry mirror on the operator's infra.
- `docs/llm/HANDOFF.md` replaced its "Roadmap and Drift Status" block (which asserted a clean working tree that aged badly) with a shorter "Roadmap Boundary" block that points the reader at `git status` and the validator for current facts.
- `docs/PROJECT_CONTEXT.md` and `docs/ARCHITECTURE.md` refreshed their prose from `v0.3.0` narrative to the current `v0.4.1` state with local curation noted.
- CHANGELOG `0.3.2` and `0.4.0` sections were backfilled with real user-visible narratives — they were header-only at those releases.

### Fixed
- The hero "Recordings" metric in `apps/web/src/App.tsx` now reads `health?.recordingsCount` from the backend (which excludes dismissed rows) with `recordings.length` as a fallback, instead of always counting the paginated visible array. Previously it undercounted when pagination was involved or when the "Show dismissed" toggle was off.

## [0.4.0] - 2026-04-22

### Added
- Inline `<audio controls preload="none">` player per row in the library, streaming the locally mirrored file via a new `GET /api/recordings/:id/audio` route with the stored content-type
- Confirmed "Delete local mirror" flow: `DELETE /api/recordings/:id` unlinks the audio file, clears `localPath` and `bytesWritten`, and marks the SQLite row `dismissed=true` with a timestamp; the UI confirm dialog reports the size and warns that Plaud is not touched
- "Show dismissed" toggle in the library header plus a per-row "Restore" action (`POST /api/recordings/:id/restore`) so a dismissed recording can be re-mirrored on the next sync
- `dismissed` and `dismissed_at` columns on the `recordings` table with an additive `ALTER TABLE` migration for pre-0.4.0 databases
- 10 new unit tests across store (dismiss/restore + migration of pre-0.4.0 schema), service (delete removes file + marks dismissed, restore clears flag, rejects unsafe recording ids) and server (audio streaming + delete + restore + `?includeDismissed=true` query param + path-traversal rejection)

### Changed
- Sync engine now skips recordings whose `dismissed=true`, so dismiss is permanent curation unless the operator explicitly restores
- `GET /api/recordings` hides dismissed rows by default; pass `?includeDismissed=true` to include them
- `countRecordings()` and the hero "Recordings" metric both reflect the non-dismissed count

### Security
- The new audio streaming route validates recording ids against a strict `[A-Za-z0-9_.-]+` allowlist and confirms the resolved file path stays within the configured recordings directory before serving, so it is not a path-traversal vector

## [0.3.2] - 2026-04-22

### Added
- `handoff-start-here-sync` stayed green throughout a Docker hardening pass; the check now runs on every validator invocation

### Changed
- Dockerfile runtime stage now runs as non-root (`USER 1000:1000`) and `chown -R 1000:1000 /app /var/lib/plaud-mirror` is applied before the `USER` directive, so bind-mounted directories under `./runtime/` no longer end up root-owned on the host
- `compose.yml` now pins `user: "1000:1000"` for explicitness alongside the Dockerfile directive
- HANDOFF "Next Session" and `home-infra` project entry now list acceptable Docker base-image fallbacks (locally cached Node slim/alpine, side-loaded `docker save`/`docker load`, NAS-local registry mirror) and explicitly reject `vxcontrol/kali-linux:latest` as a Node runtime base because it is a pentesting distribution and not appropriate even as an emergency substitute
- `docs/llm/README.md` now documents the full set of mechanically enforced sync rules

### Fixed
- Bind-mount ownership drift on `dev-vm`: after this release, `runtime/data` and `runtime/recordings` are created and owned by UID 1000 rather than root, matching the default host user and unblocking ordinary file operations without `sudo`

## [0.3.1] - 2026-04-22

### Added
- Docker base-image override support for environments that already have a compatible local image cached

### Changed
- `compose.yml` can now pass custom build/runtime base images into the Docker build
- The fallback Docker build now uses `corepack npm` and no longer installs tooling through `apt`
- Deploy docs now document the `vxcontrol/kali-linux:latest` fallback path for this `dev-vm`

### Fixed
- Docker deployment on this `dev-vm` no longer depends on a successful pull from Docker Hub when the cached local fallback image is available
- The local fallback image no longer fails on flaky Kali mirrors just to obtain `npm`
- The fallback path has been verified locally with `docker compose up --build -d` and a healthy `/api/health` response

## [0.3.0] - 2026-04-22

### Added
- Fastify admin API and React/Vite web panel for the first usable Plaud Mirror slice
- Encrypted persisted bearer-token storage backed by `PLAUD_MIRROR_MASTER_KEY`
- SQLite-backed runtime state for recordings, sync runs, and webhook delivery attempts
- Docker packaging via `Dockerfile` and `compose.yml`
- Runtime and integration tests covering secrets, store, service, server, built API, and built web output
- `docs/ROADMAP.md` as the canonical phase-boundary document

### Changed
- Phase 2 is now explicitly the manual usable slice with UI and Docker, while unattended sync and retry resilience move to Phase 3
- The README, architecture, auth, deploy, and handoff docs now describe the live runtime instead of a planned one
- The web workspace is now part of version sync and the build pipeline

### Fixed
- Phase 1 download reporting now measures real written byte count even when Plaud serves chunked responses

## [0.2.1] - 2026-04-22

### Added
- Tests for Phase 1 spike helpers and CLI argument parsing
- Tests for Plaud client error handling (`401`, non-JSON payloads, missing temp URLs)

### Changed
- Project docs now state explicitly that every new runtime case must add or update tests in the same session
- The CLI no longer auto-executes when imported by tests

### Fixed
- Runtime coverage now includes the non-happy-path cases already implemented in the Plaud spike

## [0.2.0] - 2026-04-22

### Added
- npm workspace monorepo bootstrap for `apps/api` and `packages/shared`
- Phase 1 CLI spike for Plaud bearer-token validation, recordings listing, detail lookup, and audio download
- Shared Zod schemas for Plaud responses and the Phase 1 probe report
- Unit tests for Plaud response parsing and regional API retry handling

### Changed
- Version sync now covers tracked package manifests in addition to docs and `VERSION`
- README and runbooks now document the Phase 1 spike workflow and runtime shape

### Fixed
- The repository now enforces its own "package manifests must stay aligned with VERSION" rule once runtime code exists

## [0.1.1] - 2026-04-22

### Added
- `handoff-start-here-sync` validation in `scripts/dockit-validate-session.sh` to catch drift between `docs/llm/HANDOFF.md` and `LLM_START_HERE.md`
- `docs/llm/README.md` section documenting the mechanically enforced sync rules

### Changed
- Stable project docs now match the converged roadmap: manual-token-first auth, filtered historical backfill in the first usable release, HMAC-signed generic webhook delivery, and automatic re-login deferred
- The handoff/runtime-shape split is clearer: implementation stack lives in `docs/ARCHITECTURE.md`, while `docs/llm/HANDOFF.md` stays operational and points to it

### Fixed
- Repeated HANDOFF ↔ `LLM_START_HERE.md` drift is now enforced structurally instead of relying on session discipline

## [0.1.0] - 2026-04-21

### Added
- Initial Plaud Mirror repository scaffold derived from `LLM-DocKit`
- Product documentation for project context, architecture, upstream strategy, and operational runbooks
- `.dockit-enabled` and `.dockit-config.yml` for continued downstream sync from `LLM-DocKit`
- `config/upstreams.tsv` baseline for tracked Plaud ecosystem upstreams
- `scripts/check-upstreams.sh` for local upstream change detection
- `upstream-watch` GitHub Actions workflow stub for scheduled upstream checks

### Changed
- Replaced template-facing documentation with Plaud Mirror project documentation
- Converted repository structure from generic `src/` scaffold to `apps/`, `packages/`, and `config/`

### Notes
- Runtime service implementation has not started yet. This release is the documentation and governance baseline.
