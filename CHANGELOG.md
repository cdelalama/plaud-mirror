# Changelog

All notable changes to Plaud Mirror are documented in this file.

This project follows Semantic Versioning (SemVer): MAJOR.MINOR.PATCH.

## [0.5.1] - 2026-04-25

### Fixed
- **`v0.5.0` shipped the scheduler default-on without an opt-in.** `parseSchedulerInterval` was called with a 15-minute fallback in `apps/api/src/runtime/environment.ts`, so any operator who upgraded from `0.4.x` to `0.5.0` without setting `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` got automatic sync ticks every 15 minutes silently. Both the SemVer minor-bump contract ("no behavior change without opt-in") and every doc in the `0.5.0` release (CHANGELOG, HOW_TO_USE, AUTH_AND_SYNC, ARCHITECTURE, HANDOFF, HISTORY) explicitly promised "0/unset = disabled, Phase 2 manual-only behavior preserved" — the code did the opposite. Verified live: the post-`0.5.0` rebuild on `dev-vm` reported `scheduler.enabled: true, intervalMs: 900000` even though `.env`, `compose.yml`, and the container's environment had no such variable. The fallback in `environment.ts:46` is now `0` (disabled) and the recommended starting value (15 min) lives in `HOW_TO_USE.md` and `AUTH_AND_SYNC.md`, never in code. Six new regression tests in `apps/api/src/runtime/environment.test.ts` cover the full env-var matrix.
- **`v0.5.0` documented service-layer anti-overlap that did not exist in code.** CHANGELOG `[0.5.0]`, `AUTH_AND_SYNC.md`, `ARCHITECTURE.md`, and `HISTORY.md` all stated *"`service.runSync` serializes via `getActiveSyncRun` (rejects mid-flight, returns the existing run id)"*. `apps/api/src/runtime/service.ts:520` `startMirror` simply called `this.store.startSyncRun(...)` directly with no `getActiveSyncRun` consultation. A manual sync and a scheduled tick that fired concurrently both inserted into `sync_runs` and both dispatched `executeMirror`, racing on the recordings UPSERT path and leaving two `running` rows the panel poll could not interpret. The only real protection in `0.5.0` was the scheduler's own `inflight` flag, which only stops two ticks of the same scheduler from overlapping — not manual+scheduled. New private helper `startOrReuseMirror` now consults `getActiveSyncRun` before allocating a new row; when a run is active, it returns the existing run's id with `started: false`. `runSync` / `runBackfill` map this to the public `{ id, status: "running" }` shape (REST callers can't tell the difference because their contract is "poll until done"). New `runScheduledSync` returns `{ id, started: boolean }` for the scheduler tick. One new regression test in `apps/api/src/runtime/service.test.ts` proves concurrent calls reuse the active run id and dispatch only one `executeMirror`, plus dispatch a fresh run only after the active one finishes.
- **Scheduler `lastTickStatus` now reports anti-overlap absorption honestly.** In `0.5.0`, when the (then-missing) service-level reuse would have absorbed a tick, the tick still labelled itself `completed` because `runSync` did not signal "no work happened." `0.5.1` extends `Scheduler.runTick`'s contract to accept a `{ skipped: true, reason?: string }` return value: when present, the scheduler records `lastTickStatus = "skipped"` and `lastTickError = reason` (the field is reused for operator-readable context, not just errors). `server.ts` maps `runScheduledSync()`'s `started: false` to this shape. Two new tests in `apps/api/src/runtime/scheduler.test.ts` cover the new path (skip via runTick result + reason surfaced, void / non-skip-shaped object stays `completed`).

### Notes
- `v0.5.0` is broken and superseded. **Operators upgrading from `0.4.x` should skip `0.5.0` and go directly to `0.5.1`.** No need to roll back if `0.5.0` was deployed: the only persistent state changes were extra `sync_runs` rows from the missing anti-overlap (each one harmless on its own — Plaud listings are idempotent and recordings UPSERT by id). On reboot with `0.5.1`, the active-run reuse takes over and no further duplicate rows are created.
- This is a **patch** release (0.5.0 → 0.5.1) because the surface contract is unchanged; the pre-existing API shape (`/api/health`, `/api/sync/run` semantics, the `scheduler` block) all stay the same. What changed is the actual behavior matching the documentation.
- Phase 3 sequencing is pushed back one slot to absorb this fix: `v0.5.2` is now the durable webhook outbox (D-013), `v0.5.3` is the full health observability surface (D-014, complete).
- This release continues to be backend-only; web-side test count is unchanged at 11. Backend test count: 73 (`v0.5.0`) → 82 (`v0.5.1`); grand total: **93**.

### Changed
- `parseSchedulerInterval` fallback in `apps/api/src/runtime/environment.ts` is now `0` instead of `15 * 60 * 1000`. JSDoc on `ServerEnvironment.schedulerIntervalMs` rewritten to reflect the corrected contract.
- `PlaudMirrorService` gains a private `startOrReuseMirror(mode, filters)` helper used by `runSync`, `runBackfill`, and the new `runScheduledSync`. Public REST routes are unchanged in shape.
- `Scheduler.SchedulerOptions.runTick` return type widened from `Promise<unknown>` to `Promise<TickRunResult | void>` to support the external-skip path. New exported interface `TickRunResult { skipped: boolean; reason?: string }`. The `inflight`-flag anti-overlap path is unchanged.
- `apps/api/src/server.ts` scheduler `runTick` now calls `service.runScheduledSync()` (instead of `service.runSync(...)`), inspects `started`, and returns `{ skipped: true, reason }` to the scheduler when an existing run absorbed the tick.
- `package.json#scripts.test` chains the new `apps/api/dist/runtime/environment.test.js` ahead of `service.test.js`.

### Added
- `apps/api/src/runtime/environment.test.ts` (6 regression tests for the env-var matrix).
- `apps/api/src/runtime/service.test.ts` regression test for concurrent-run reuse.
- `apps/api/src/runtime/scheduler.test.ts` regression tests for the `runTick → { skipped: true }` path and for non-skip return values staying `completed`.
- New public method `PlaudMirrorService.runScheduledSync()` and new exported scheduler type `TickRunResult` in `apps/api/src/runtime/scheduler.ts`. No HTTP route surface change.

## [0.5.0] - 2026-04-25

### Added
- **Phase 3 begins.** In-process continuous sync scheduler — opt-in via `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` (`0` or unset → disabled, Phase 2 manual-only behavior preserved; positive values enforce a 60 000 ms floor; default when set to a non-numeric/empty string is 15 minutes). Implementation: `apps/api/src/runtime/scheduler.ts` (217 lines). The scheduler is a single `setTimeout` loop with two layers of anti-overlap protection — an `inflight` flag at the scheduler level (records `lastTickStatus = "skipped"` when a tick fires while the previous one has not resolved) plus the existing `service.runSync` serialization via `getActiveSyncRun` (rejects mid-flight, returns the existing run id). Cadence is from-fire, not from-completion: the next tick is scheduled before the current tick is awaited, so a slow run does not push subsequent ticks back. Wired into `createApp` in `apps/api/src/server.ts`; Fastify's `onClose` hook stops the scheduler so SIGTERM cleanly cancels the pending timer. Locks the contract from **D-012** (`docs/llm/DECISIONS.md`).
- Health observability surface — partial **D-014** (scheduler subset). `GET /api/health` now includes a `scheduler` block (`enabled`, `intervalMs`, `nextTickAt`, `lastTickAt`, `lastTickStatus` ∈ `"completed"` / `"failed"` / `"skipped"` / `null`, `lastTickError`). When the scheduler is enabled, `health.phase` flips to `"Phase 3 - unattended operation"`; otherwise it stays `"Phase 2 - manual sync"`. Older clients reading the response when the scheduler is off see the disabled-shape default thanks to Zod's `.default(...)` on `ServiceHealthSchema.scheduler`. Webhook outbox backlog and `lastErrors` ring buffer arrive in `v0.5.1` / `v0.5.2`.
- New shared schema + type: `SchedulerStatusSchema` and `SchedulerStatus` in `packages/shared/src/runtime.ts`. Strict Zod object enforcing the wire shape; reused by `getHealth()` and the panel's TypeScript imports.
- New environment variable parsed in `apps/api/src/runtime/environment.ts` via a new `parseSchedulerInterval()` helper. Validates the 60 000 ms floor, normalizes `0` and unset to disabled, and falls back to a 900 000 ms default when given malformed input. Exposed as `ServerEnvironment.schedulerIntervalMs`.
- New service hook `setSchedulerStatusProvider(provider)` on `PlaudMirrorService` so the runtime can register a live scheduler-status function without coupling the service to the scheduler module. `getHealth()` calls it (or returns the disabled default) when assembling the response.
- New test file `apps/api/src/runtime/scheduler.test.ts` (7 tests, ~264 lines): `fireOnce` with completed and failed cases (error message captured), anti-overlap skip semantics, `start`/`stop` with a deterministic injected timer harness, `start` idempotency (a second `start()` does not double the cadence), constructor input validation (rejects non-positive `intervalMs`), and `status()` reflecting the last result with `nextTickAt` cleared on stop.

### Changed
- `apps/api/src/runtime/service.ts` `getHealth()` now reports the scheduler status and dynamically selects the `phase` string. `apps/api/src/server.ts` instantiates the `Scheduler` and registers the status provider when `environment.schedulerIntervalMs > 0`. Test environments in `apps/api/src/runtime/service.test.ts` and `apps/api/src/server.test.ts` now include `schedulerIntervalMs: 0` to keep the existing manual-only test surface intact.
- `packages/shared/src/formatting.test.ts` `withPlaudTotal` fixture now includes the new `scheduler` field on its `ServiceHealth` literal so the strict shape continues to compile.
- `package.json#scripts.test` chains the new `apps/api/dist/runtime/scheduler.test.js` into the Node `--test` invocation. Total backend tests: 73 (up from 66 in `v0.4.19`); web-side tests: 11 (unchanged); grand total: **84**.

### Notes
- This release is the **first Phase 3 release**. The roadmap's "Current phase" pointer flips from Phase 2 to Phase 3, and the version table now reads `0.5.x` → Phase 3 in progress. The remaining Phase 3 increments — durable webhook outbox (`v0.5.1`, locks **D-013**) and full health observability (`v0.5.2`, completes **D-014**) — are queued; the scheduler shipped here is enough to validate "does the service run unattended?" with the existing immediate-webhook path.
- Default behavior is unchanged: containers without `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` set get the disabled scheduler and behave exactly like `v0.4.19`. Operators who want continuous sync set the env var (recommended starting point: 900000 = 15 minutes) and the panel's health card will start showing `nextTickAt` / `lastTickAt`.
- DF-026 in `~/src/LLM-DocKit/docs/DOWNSTREAM_FEEDBACK.md` (UI tests gap) status is unchanged: still `partially implemented` — the new tests in this release are backend-only.

## [0.4.19] - 2026-04-25

### Added
- Web-side test framework: Vitest + jsdom + @testing-library/react + @testing-library/jest-dom installed in `apps/web`. Decision recorded as **D-015** in `docs/llm/DECISIONS.md` (Vitest reuses Vite's pipeline, jsdom is the de facto reference DOM-in-Node, @testing-library/react is the React-team-recommended assertion vocabulary, the alternatives — Jest, happy-dom, Enzyme, hand-rolled rendering — were considered and explicitly rejected with rationale). New `apps/web/vitest.config.ts` + `apps/web/src/test-setup.ts` + `apps/web/package.json#scripts.test`. The root `npm test` chains a new `npm run test:web` step after the backend suite.
- New module `apps/web/src/storage.ts` exporting `readTab`, `readBackfillExpanded`, and a `STORAGE_KEYS` constant. The two helpers were previously local to `App.tsx`; extracting them lets the test file exercise localStorage roundtrips without mounting React. `STORAGE_KEYS.ACTIVE_TAB` / `STORAGE_KEYS.BACKFILL_EXPANDED` deduplicate the literal key names that production code and tests would otherwise both repeat.
- New component `apps/web/src/components/StateBadge.tsx` extracted from `App.tsx`. Same render behaviour, now testable in isolation (the prop type is now imported from `@plaud-mirror/shared` as `BackfillCandidateState`).
- Two new test files: `apps/web/src/storage.test.ts` (8 tests covering default / "config" / "main" / corrupt-value branches for both helpers + a STORAGE_KEYS sanity assertion) and `apps/web/src/components/StateBadge.test.tsx` (3 tests covering all three state values, the "mirrored → already local" label remap, and class-name correctness). Total: 11 web-side tests.
- Four new decisions in `docs/llm/DECISIONS.md`:
  - **D-012** — Continuous sync scheduler runs in-process with anti-overlap protection. Locks the contract before scheduler code lands in v0.5.x.
  - **D-013** — Webhook outbox is a separate SQLite table with explicit state transitions (`pending` / `delivering` / `delivered` / `retry_waiting` / `permanently_failed`) and exponential-backoff retry policy.
  - **D-014** — Health endpoint surfaces operational state (scheduler status, outbox backlog, last errors), not just configuration state.
  - **D-015** — Web UI tests use Vitest + jsdom + @testing-library/react.
- New "Beyond Phase 6: Multi-tenant variant (out of scope for this repo)" section in `docs/ROADMAP.md` (committed earlier today) capturing the three viable paths (instance-per-tenant deployment, in-place refactor, new sibling project) for the operator's future multi-tenant interest, with explicit reference to D-009 as the current scope-limiting decision. D-009 gained a matching Implications bullet pointing back at the ROADMAP section.

### Changed
- `apps/web/src/App.tsx` no longer carries local copies of `readTab`, `readBackfillExpanded`, or `<StateBadge>`. Imports them from the new modules. Inline localStorage `setItem` calls now reference `STORAGE_KEYS.ACTIVE_TAB` and `STORAGE_KEYS.BACKFILL_EXPANDED` to keep production and test code in sync on the literal key names.

### Notes
- This release is the **Phase 3 prerequisite**, not Phase 3 itself. The roadmap's Phase 3 scope (continuous sync scheduler, webhook outbox, stronger health surfaces) lands in `v0.5.x` next; this release sets up the testing foundation and freezes the design contracts (D-012/013/014) before code is written. Test count: 53 (pre-helper-extract baseline at v0.4.16) → 66 (after D-015's first half + helper-level coverage) → 77 (after this release's web-side component-level coverage).
- DF-026 in `~/src/LLM-DocKit/docs/DOWNSTREAM_FEEDBACK.md` (UI tests gap) is now `partially implemented (plaud-mirror v0.4.19)` on the helper+component-level axis. Component tests for `<App>`-level interaction (tabs, collapse, BackfillPreview lifecycle) remain a future patch — they need either App-decomposition or a fetch-mocking pattern that is non-trivial to set up. The current batch deliberately targets small extractable pieces first.

## [0.4.18] - 2026-04-25

### Fixed
- **`v0.4.17` was unbuildable from a fresh clone.** This release ships the two source files that should have been part of `v0.4.17` but were never staged: `packages/shared/src/formatting.ts` and `packages/shared/src/formatting.test.ts`. Root cause: the `v0.4.17` commit was prepared with `git add -u`, which stages MODIFIED tracked files only — not new untracked files. The two newly-created files stayed `??` in `git status` and were silently omitted. The local workspace passed 66/66 tests and the container at the time reported `version: "0.4.17"` because `tsc` + `COPY . .` both read from the filesystem, not from git. The published commit (`d1bc317` on `origin/main`) referenced the missing module from `package.json:19` (test runner path), `packages/shared/src/index.ts:1` (`export * from "./formatting.js"`), `apps/web/src/App.tsx` (helper imports), and `apps/api/src/runtime/service.ts` (`buildDownloadFilename` import) — so a fresh clone of `v0.4.17` would have failed `npm install && npm run build && npm test` at the import-resolution step. GPT-5 caught it on 2026-04-25; before that, the only signals were `git status` post-commit (untouched) and the commit's own stat line (`128 insertions, 183 deletions` for a release whose narrative claimed ~500 added lines of helpers + tests — net negative is incompatible with that claim). Force-push to amend `v0.4.17` was considered and rejected (project rule against destructive history rewrites on `main`). This release is the forward-fix: `v0.4.17` stays in history as a known-broken tag, `v0.4.18` is the first commit on `origin/main` that is actually buildable from clean.

### Notes
- The actual code shipped here — `formatting.ts` (10 helpers) and `formatting.test.ts` (12 tests covering them) — is identical to what the `v0.4.17` CHANGELOG entry described. No new features land in this release; it is purely the missing files plus the version bump plus this entry. The narrative in the `v0.4.17` CHANGELOG remains accurate as a description of what `v0.4.17` *intended to ship*, but only `v0.4.18` actually ships it on `origin/main`.
- Companion DocKit work (queued, separate repo): `DF-027` in `~/src/LLM-DocKit/docs/DOWNSTREAM_FEEDBACK.md` to formalise the failure mode ("LLM uses `git add -u` and silently skips new files"), and a stretch pre-commit hook check that grep-verifies imports in the staged tree resolve to staged files — would catch this exact pattern mechanically.

## [0.4.17] - 2026-04-24

### Added
- `packages/shared/src/formatting.ts`: pure formatting helpers shared between the web panel and the API (`formatDuration`, `formatBytes`, `formatRecordingsMetric`, `computeMissing`, `formatDeviceLabel`, `formatDeviceShortName`, `coerceNonNegativeInteger`, `summarizeRun`, `describeBusy`, `buildDownloadFilename`). All deterministic, no side effects, no DOM, no fetch — exercisable by `node --test` alongside the rest of the backend suite.
- `packages/shared/src/formatting.test.ts`: 12 new tests covering every helper, including the duration buckets, byte unit shifts, missing-recordings clamp on stale `plaudTotal`, device label fallbacks, and 11 cases for `buildDownloadFilename` (extension extraction, sanitisation, length cap, fallback to recording id, every extension Plaud ships).
- `apps/api/src/server.ts` `buildContentDisposition()` helper: builds an RFC 5987 `Content-Disposition` header with both ASCII-fallback `filename=` and UTF-8 `filename*=` for non-ASCII titles. Tested with quotation/backslash escaping and accented characters.
- `apps/api/src/server.test.ts`: extended audio-route test asserts the new `Content-Disposition: inline; filename="..."; filename*=UTF-8''...` header is emitted; new unit test for `buildContentDisposition` covers ASCII fallback, UTF-8 encoding, and quote/backslash escaping.

### Changed
- `apps/web/src/App.tsx` no longer carries local copies of `formatDuration`, `formatBytes`, `formatRecordingsMetric`, `computeMissing`, `formatDeviceLabel`, `formatDeviceShortName`, `coerceNonNegativeInteger`, `summarizeRun`, `describeBusy`. They now import from `@plaud-mirror/shared`. Behavior is preserved except where the test caught a latent edge case (see Fixed below). `readTab`, `readBackfillExpanded`, and `toErrorMessage` stay local because they touch `localStorage` / `Error` instanceof checks that are web-runtime-specific.
- `apps/api/src/runtime/service.ts` `getRecordingAudio()` return shape now includes `filename: string`, derived from `buildDownloadFilename(title, localPath, id)`. Server route uses it.
- `HOW_TO_USE.md` body referenced `v0.4.15` and `53/53 tests at v0.4.15` — both stale at v0.4.16. Now reflects the current `v0.4.17` reality and `66/66 tests` (12 new helper tests + 1 new server-header test added on top of the 53). Same prose-drift class GPT-5 caught for the third time; tracked in DOWNSTREAM_FEEDBACK as DF-006.
- CHANGELOG `[0.4.16]` Fixed paragraph clarified: the verification phrase "`GET /api/health` returns `200` with `version: "0.4.15"`" was technically correct (verification ran against the in-progress working tree BEFORE the bump) but read as an inconsistency for a reader of the v0.4.16 entry. The clarified text now spells out the timeline.

### Fixed
- Browser native `<audio>` "More options → Download" menu now saves a sensible filename. Previously the download landed as a file literally named `audio` with no extension, because our `/api/recordings/:id/audio` endpoint emitted no `Content-Disposition` and the browser fell back to the URL's last segment. Now the response carries `Content-Disposition: inline; filename="<safe-title>.<ext>"; filename*=UTF-8''<encoded>` with extension derived from the on-disk `localPath` (mp3, ogg, m4a, wav). Title sanitisation: replace anything outside `[A-Za-z0-9_.-]` with `_`, collapse repeats, trim edges, cap at 80 chars; empty/whitespace title falls back to the recording id. Reported by the operator on 2026-04-24.
- `coerceNonNegativeInteger("", fallback)` returned `0` because `Number("")` is `0` (a JS quirk), so clearing the sync-limit input silently downgraded the next run to refresh-only. Now returns the fallback when the input is empty or whitespace-only. Operator can still type `0` explicitly when they want a refresh-only run; clearing the field reverts to `defaultSyncLimit`. Caught by the new helper test.

## [0.4.16] - 2026-04-24

### Changed
- `Dockerfile` drops the `SHELL ["/bin/bash", "-lc"]` directive from both the build and runtime stages. Docker's default `/bin/sh -c` is now used, which is POSIX-portable and works on Alpine (busybox `ash`), Debian/Ubuntu (`dash`), and any sane Linux base. The directive was unnecessary — none of the existing `RUN` commands use bash-specific syntax (no arrays, no `[[`, no process substitution, no `set -o pipefail` inside pipes; just `&&`, `command -v`, `mkdir -p`, `chown`, `corepack npm`).

### Fixed
- Documented Docker fallback `node:20-alpine` was not actually executable at v0.4.15 because the Dockerfile forced `SHELL ["/bin/bash", "-lc"]` and Alpine doesn't ship bash — an operator following `docs/operations/DEPLOY_PLAYBOOK.md` would have hit a build error, contradicting README and HANDOFF claims that alpine is a valid substitute. Removing the SHELL directive closes the contradiction: verified end-to-end locally by building with `--build-arg BUILD_BASE_IMAGE=node:20-alpine --build-arg RUNTIME_BASE_IMAGE=node:20-alpine`, running the resulting container, and confirming `GET /api/health` returns `200` (the verification was performed against the in-progress v0.4.15 working tree before the bump to v0.4.16; the same container path was re-built at v0.4.16 after the bump and container `cat /app/VERSION` returns `0.4.16` on `dev-vm`). Default `node:20-bookworm-slim` build also re-verified green. GPT-5 flagged this on 2026-04-24 as the residual Docker contradiction after the v0.4.15 playbook rewrite.

## [0.4.15] - 2026-04-24

### Changed
- `docs/operations/DEPLOY_PLAYBOOK.md` fallback block rewritten. The previous runbook carried a bash block that exported `PLAUD_MIRROR_DOCKER_BUILD_IMAGE="vxcontrol/kali-linux:latest"` as a Docker-Hub-timeout workaround — directly contradicting the policy documented in README and HANDOFF. Replaced with the list of acceptable substitutes (Node slim/alpine locally cached, `docker save`/`docker load`, or a pull-through registry mirror), an example using `node:20-alpine`, and an explicit rejection paragraph for pentesting or general-purpose distro bases.
- `HOW_TO_USE.md` rewritten end to end. The previous body claimed "v0.1.0 is a design-and-governance baseline" and that the repository "does not yet give you the runnable Plaud sync service"; both statements were false at v0.4.14. The new file describes v0.4.15 reality (Docker + local Node run instructions, backfill preview, device catalog, tabs, phase boundary), and references the DOWNSTREAM_FEEDBACK flow for protocol observations.
- `docs/version-sync-manifest.yml` now tracks `HOW_TO_USE.md` (20 targets, up from 19). This closes a real orphan-marker gap — the file previously had a `<!-- doc-version -->` marker but sat outside the manifest, so nothing enforced its freshness.
- `docs/llm/HANDOFF.md` "Verified Runtime State" updated from v0.4.13 to v0.4.15. Current Status no longer carries "Next: rebuild + push" boilerplate now that the rebuild+push actually happened. `LLM_START_HERE.md` Current Focus re-synced.

### Fixed
- Three concrete drifts flagged by a second GPT-5 review on 2026-04-24 are closed in this release rather than merely logged. This is the fix that accompanies DF-001 (DEPLOY_PLAYBOOK), DF-002 (HOW_TO_USE orphan) and DF-003 (HANDOFF stale "Next:") in `~/src/LLM-DocKit/docs/DOWNSTREAM_FEEDBACK.md`; previously those entries described the failure modes without actually repairing the specific instances.

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
