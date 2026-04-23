# Changelog

All notable changes to Plaud Mirror are documented in this file.

This project follows Semantic Versioning (SemVer): MAJOR.MINOR.PATCH.

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
