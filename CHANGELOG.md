# Changelog

All notable changes to Plaud Mirror are documented in this file.

This project follows Semantic Versioning (SemVer): MAJOR.MINOR.PATCH.

## [0.11.0] - 2026-07-14

### Added

- Dismissed Library rows now offer an explicit `Delete from Plaud` action. A
  single confirmation names the irreversible Plaud-account consequence before
  the authenticated API performs the request.
- `DELETE /api/recordings/:id/plaud` implements Plaud's observed two-step
  trash-then-delete flow and records a durable `upstream_deleted_at` tombstone.
- Root `PRODUCT.md` and `DESIGN.md` plus the Impeccable design sidecar capture
  the operator-panel product and visual rules for future UI work.

### Changed

- Local dismiss remains the required first step and remains reversible. A
  successful permanent Plaud deletion removes Restore, keeps the local row as
  an auditable tombstone, and makes later sync UPSERTs unable to erase it.
- Phase 6 begins with operator-facing fit and finish while the independent
  Phase 3 soak and live webhook exit gate remain open.

### Fixed

- The Plaud mutation client rejects explicit non-zero application statuses and
  handles both empty success responses and normal Plaud envelopes.
- Web UI tests use a repository-level 15-second limit so full App integration
  cases remain stable on the shared dev VM without weakening assertions.
- The anti-overlap service test now drains its captured background callbacks
  instead of leaking a one-hour runtime timer after its assertions complete.

### Notes

- Validation uses mocks only for the destructive endpoint. No real Plaud
  recording is deleted as part of automated or deployment verification.
- Deploying this runtime restarts the continuous process. Existing soak
  evidence remains historical evidence, but Phase 3 exit is not claimed until
  the post-deploy observation window and live webhook drill are complete.
## [0.10.8] - 2026-07-13

### Changed

- Upstream baselines refreshed after the overdue D-004 review (applaud
  v0.5.11, iiAtlas 1.4.3, openplaud v0.5.4, plaud-toolkit 810c7ceb,
  obsidian-sync 1.0.1). This stops the daily `upstream-watch` failure
  emails that started on 2026-07-11.
- D-019 gains a 2026-07-13 amendment: Plaud is retiring localStorage
  `pld_tokenstr` for new/migrated accounts in favor of `pld_ut`/`pld_urt`
  cookies plus a refresh endpoint (facts from MIT applaud v0.5.11 PR #32).
  The capture-path adaptation is queued in HANDOFF Open Work.

### Notes

- Governance/documentation-only patch; no runtime behavior change and no
  deployment. The dev-vm runtime deliberately stays on `v0.10.7` while the
  Phase 3 soak accumulates evidence (running since 2026-07-10).
- `docs/llm/REVIEWS.md` records the pre-soak execution audit and the corrected
  provenance of the operator-requested July 6 backdating on
  `2f38024..a791e0a`; published history remains unchanged.

## [0.10.7] - 2026-07-10

### Added

### Changed

- **Soak schedule contract activated.** The project contract now declares
  `internal-loop` at `PT15M` with `stale_after: PT2H`, aligned with the one-hour
  runtime ceiling. Its header now references Home Infra Protocol 0.7.1 and
  removes the obsolete pre-ingestion note.

### Fixed

## [0.10.6] - 2026-07-10

### Added

### Changed

- **Node 20 whole-run timeout evidence.** The service-level max-runtime test
  now owns the same short event-loop keepalive as the request-timeout test,
  allowing the intentionally unref'ed production timer to fire under Node 20.

### Fixed

## [0.10.5] - 2026-07-10

### Added

### Changed

- **Node 20 timeout-test portability.** The hung-request regression test keeps
  the event loop alive long enough for Node 20's unref'ed
  `AbortSignal.timeout()` timer to fire. Runtime timeout behavior is unchanged;
  the evidence gate now measures it consistently on CI and local Node 24.

### Fixed

## [0.10.4] - 2026-07-10

### Added

- **Whole-run runtime ceiling.** Sync/backfill work defaults to one hour
  (`PLAUD_MIRROR_SYNC_MAX_RUNTIME_MS`) and propagates cancellation into Plaud
  requests and streamed audio downloads.
- **Container liveness.** Compose probes the public `/api/health` endpoint.

### Changed

- **Scheduler telemetry awaits the run.** `lastTickStatus=completed` now means
  the mirror run finished, not merely that background work was dispatched.
- **Bounded pagination and graceful shutdown.** Full Plaud listings reject
  repeated pages and stop after 100 pages; SIGTERM/SIGINT drain active work
  before SQLite closes.
- **Dependency security refresh.** Fastify Static 9, Vitest 4, and patched
  transitives leave both full and production `npm audit` clean.

### Fixed

- **Outbox retry off-by-one.** All eight backoff windows, including the final
  8-hour wait, are reachable before a ninth failed attempt becomes permanent.
- **Outbox claims recover in-process.** Secret/payload setup failures now audit
  the attempt and return the claim to `retry_waiting`; health counts active
  `delivering` rows.

## [0.10.3] - 2026-07-10

### Added

- **Candidate failure accounting.** `SyncRunSummary.failed` is persisted in
  SQLite (additive migration, default 0 for older rows) and rendered in live
  progress plus the Operations run table.

### Changed

- **Candidate selection reconciles SQLite with disk.** A row counts as mirrored
  only when its file exists, is non-empty, and matches `bytesWritten`; missing
  or wrong-sized artifacts re-enter sync/backfill selection and preview as
  missing.
- **Poisoned recordings no longer block older candidates.** Candidate failures
  are recorded individually, processing continues, and any partial run closes
  as `failed` with durable per-recording error context instead of a false green.
- **Concurrent backfills are explicit conflicts.** `POST /api/backfill/run`
  returns 409 while another sync is active instead of reusing that run id and
  silently discarding the requested filters.

### Fixed

- **Audio replacement is atomic.** Downloads stream into a unique temporary
  file, `fsync` it, and rename it over the destination only after success; an
  interrupted force-download or restore preserves the previous valid audio and
  cleans up the partial file.

## [0.10.2] - 2026-07-10

### Added

- **Repository CI gate.** GitHub Actions now runs the supported Node 20 build,
  web typecheck, Node/integration tests, and Vitest suite on pushes to `main`
  and pull requests.
- **Automatic Node test discovery.** `scripts/run-node-tests.mjs` recursively
  finds compiled unit and integration tests, so a new test file cannot be
  silently omitted from the root suite.

### Changed

- **The root test gate now typechecks the panel.** `npm test` runs
  `tsc -p apps/web/tsconfig.json --noEmit`; Vite transpilation is no longer the
  only compiler check for React code.
- **Idle panels observe scheduler work.** The panel polls health every 30
  seconds while idle and switches to the existing 2-second run polling loop
  when it discovers a sync started outside the current tab.

### Fixed

- **Docker build context no longer includes secrets or host build output.**
  `.env*`, nested `node_modules`, `dist`, `.tsbuildinfo`, and Vite caches are
  excluded, preventing secret exposure and stale host artifacts from affecting
  image builds.
- **Library layout test no longer races initial loading.** The Full-player test
  waits for its recording before changing mode, removing timing-dependent CI
  failures.

## [0.10.1] - 2026-06-29

### Added

- Nothing.

### Changed

- Nothing.

### Fixed

- **Sync progress no longer counts disabled-webhook decisions as skipped sync
  candidates.** A normal sync with no webhook configured could show
  `downloaded 20` and `skipped 20` for the same 20 recordings because
  `SyncRunSummary.skipped` was incremented from the recording-level
  `lastWebhookStatus="skipped"` state. The run summary now treats webhook
  skipped as delivery state only; downloaded candidates keep `skipped=0` while
  the recording row still records that no webhook was configured.
- Tests: runtime test count unchanged; `apps/api/src/runtime/service.test.ts`
  now asserts the split between sync skipped candidates and webhook skipped
  delivery state.

## [0.10.0] - 2026-06-21

### Added

- **Home Infra Protocol sync-job adoption.** `infra.contract.yml` now declares
  `plaud-mirror-recordings-sync` as a `home-infra-protocol` `sync_jobs[]`
  producer for Plaud recording mirroring.
- **Protocol status snapshot endpoint.** `GET
  /api/protocol/sync-jobs/plaud-mirror-recordings-sync/status` and alias
  `/api/protocol/status` publish a public sanitized `status-snapshot` for Infra
  Portal/Hermes consumers.
- **Protocol schemas and mapper.** `packages/shared/src/protocol.ts` models the
  status-snapshot contract, and `apps/api/src/runtime/protocol-status.ts` maps
  `ServiceHealth` into protocol checks for auth, latest sync, coverage,
  scheduler, and outbox.
- **Infra contract docs.** `docs/INFRA_CONTRACT.md` documents the
  producer/consumer boundary and explains why the contract starts as
  `schedule.mode: manual`.

### Changed

- **Phase 5 entered for infra/protocol integration.** The sync engine is
  unchanged, but Plaud Mirror now participates in the shared Home Infra sync
  protocol; NAS rollout and multi-day soak remain pending.
- **Public allowlist extended safely.** The protocol status routes are public
  like `/api/health`, but return only sanitized operational status and no Plaud
  account PII, bearer tokens, webhook secrets, or raw Plaud error bodies.

### Fixed

- Nothing.

## [0.9.6] - 2026-06-19

### Added

- **LLM-DocKit 4.9.6 guardrails adopted.** Version tooling now supports upstream `yaml-info-version` and `package-lock-version` marker handlers in addition to the existing Plaud Mirror `json-version` handling.
- **Package-lock version sync.** `package-lock.json` is now tracked by `docs/version-sync-manifest.yml`, and both its top-level `version` and `packages[""].version` are checked and bumped with the rest of the release markers.
- **Expanded validator smoke coverage.** `scripts/test-validator.sh` now covers flexible HISTORY formats, Trace footer handling for dash/no-dash HISTORY entries, and version marker drift for JSON, YAML, and package-lock files.

### Changed

- **Trace Protocol v1.3 chat guidance.** `LLM_START_HERE.md` and `scripts/dockit-bootstrap-context.sh` now require seconds in chat `Sent` headers on both local and UTC timestamps, and instruct readers to re-check git status, `git log -1`, and the current clock before acting on stale Trace reports.
- **HISTORY validation follows upstream 4.9.6.** The validator accepts both dash and no-dash HISTORY entry formats by default, with strict `history_format: dash` / `history_format: no-dash` available through `.dockit-config.yml`.
- **DocKit sync merged manually.** The upstream 4.9.6 updates were applied while preserving Plaud Mirror's local `handoff-start-here-sync`, `prose-drift`, and `unabsorbed-artifact` validator checks.

### Fixed

- **Prevented another raw-sync clobber.** The first post-apply validator dropped from 12 checks to 9 after upstream copied `scripts/dockit-validate-session.sh`; the local guardrails were reinserted before commit.
- **Removed stale lockfile version drift.** `package-lock.json` had remained at `0.9.0`; the new `package-lock-version` target updates it to `0.9.6`.
- Tests: runtime tests unchanged; governance checks now expect 22 version targets, `scripts/dockit-validate-session.sh --human` reports 12 checks, and `scripts/test-validator.sh` reports 32 smoke cases.

## [0.9.5] - 2026-06-19

### Added

- **Labeled mobile view selector.** The mobile rail now exposes a native view selector labeled `Vista` / `View`, so navigation is not an icon-only strip at the top of the phone screen.

### Changed

- **Mobile status is compact.** The desktop status strip is replaced on mobile by a single horizontally-scrollable row of compact chips, keeping Auth, Sync, Scheduler, Outbox, and Errors visible without consuming the main viewport.
- **Mobile rail is a real header.** The mobile shell now keeps the brand/version, view selector, language toggle, and logout in a compact top header instead of a five-icon pseudo-sidebar.

### Fixed

- **Library mobile row actions stay on the right.** Dismiss/restore buttons are explicitly anchored to the top-right grid cell on narrow screens instead of dropping under the row content.
- Tests: 153 -> 154 (127 Node/integration tests + 27 web tests).

## [0.9.4] - 2026-06-18

### Added

- Nothing.

### Changed

- **Library Full mode now earns its toggle.** Full playback rows use a wider, flexible native-audio column on desktop so the scrubber reaches much farther left instead of staying as a narrow right-side control.
- **Library owns its list scroll.** The Library screen now keeps its header/toolbar/pagebar fixed inside the operator content area and scrolls the recordings table itself, so 50/100/150-row pages remain reachable in the full-viewport shell.

### Fixed

- **Compact Library playback.** Compact Play now controls the real row `<audio>` element inside the user click gesture instead of only toggling React state and waiting for a newly-rendered audio control. The playing compact row still expands to the native scrubber.
- Tests: 151 -> 153 (127 Node/integration tests + 26 web tests).

## [0.9.3] - 2026-06-18

### Added

- **Trace Protocol governance support from LLM-DocKit.** Session onboarding now documents the Trace header convention, `dockit-bootstrap-context.sh` surfaces it during startup, and `dockit-validate-session.sh` includes a durable `trace-protocol` check that stays skipped unless a project explicitly enables it in `.dockit-config.yml`.
- **Validator smoke coverage for Trace Protocol.** `scripts/test-validator.sh` now covers the skip path, valid anchors, minute/second commit times, missing HISTORY footers, pre-activation history, missing anchors, invalid hashes, and missing `since` configuration.

### Changed

- **Merged the DocKit sync manually instead of accepting the raw overwrite.** The upstream trace-protocol additions were kept while restoring Plaud Mirror's local validator extensions.
- **Read-only DocKit hook skips are now explicit.** The Claude hook runs the validator with `DOCKIT_ALLOW_READ_ONLY_SKIP=1`, preserving the upstream maintenance refinement without weakening dirty-session enforcement.

### Fixed

- **Local guardrails were restored after a raw DocKit sync clobbered them.** `handoff-start-here-sync`, `prose-drift`, `unabsorbed-artifact`, and `json-version` handling in the version bump/check scripts are active again. The validator now reports 12 checks instead of dropping to 9.
- Tests: runtime tests unchanged at 151. Governance checks: `scripts/dockit-validate-session.sh --human` passes 12/12; `scripts/test-validator.sh` passes 17/17.

## [0.9.2] - 2026-06-18

### Added

- Nothing.

### Changed

- **Main sync now downloads the displayed missing count.** The Main cockpit action no longer borrows the Historical Backfill form's conservative `limit=1`. When Main says recordings are missing, its button now sends the visible missing count as the sync limit, capped at the existing backend safety ceiling of 1000.
- **High-volume Main syncs require confirmation.** If the Main action would download 25 or more recordings, the panel asks the operator to confirm before starting the run.

### Fixed

- **Misleading "Sync missing" behavior.** A Main click could examine the full Plaud catalog but download only one recording because it inherited the Backfill draft limit. The button label now says exactly how many recordings it will download.
- Tests: 150 -> 151 (127 Node/integration tests + 24 web tests).

## [0.9.1] - 2026-06-17

### Added

- Nothing.

### Changed

- **Operator panel now uses the full viewport.** The `v0.9.0` redesign copied the standalone reference frame too literally: the production shell rendered as a centered 1240px card on a grey presentation canvas. The app shell now fills the viewport, keeps the 212px rail pinned to the left edge, and lets the main content scroll inside the remaining width/height.
- **Mobile rail stays compact.** The desktop full-height rail is overridden at the existing mobile breakpoint so the single-column layout keeps a compact sticky top rail instead of a 100vh block.

### Fixed

- **Wide desktop wasted space.** Large monitors no longer show broad grey margins around the operator panel; the frame border, shadow, outer radius, max-width, and page padding were removed from the production shell.
- Tests: 150 (127 Node/integration tests + 23 web tests).

## [0.9.0] - 2026-06-16

### Added

- **Reference-driven operator panel redesign.** The React/Vite panel now absorbs the visual and interaction direction from `docs/design/reference/plaud-mirror-panel-standalone.html`: 212px operator rail, dense light-console layout, five real screens (Main, Library, Backfill, Configuration, Operations), status strip, next-action card, KPI coverage, recent errors, recent runs, outbox retry surface, and a mobile-aware reconnect flow.
- **Operator language toggle.** The panel chrome now switches live between Spanish and English and persists the chosen language in local storage. Raw log content, recording titles, and Plaud/backend error text stay verbatim.
- **Library controls.** Recordings now have live search, compact/full player modes, 50/100/150 pagination, and dismissed-recording visibility integrated into the new Library screen.

### Changed

- **Panel visual system.** Replaced the previous card-heavy UI with the reference design system: Archivo UI type, Space Grotesk headings, JetBrains Mono labels/data, green accent `#0f7a5a`, light page surface `#d7d9dd`, tight status tones, and responsive rail-to-mobile navigation. Backend routes and data contracts are unchanged.
- **Backfill preview and Operations are first-class.** Existing endpoints are reorganized into dedicated screens: Backfill recalculates the dry-run preview as filters change, while Operations surfaces recent sync runs, outbox counters/retry, and `health.lastErrors` without needing curl.
- **Configuration keeps the current auth model.** Operator login, Chrome extension reconnect, copy-only bookmarklet fallback, manual token paste, webhook settings, scheduler settings, and read-only technical state remain wired to the existing API. No secrets or `.env` files are touched.

### Fixed

- **Observability gap.** `health.warnings`, `lastErrors`, `recentSyncRuns`, scheduler state, and outbox state are now visible in the panel's Main/Operations surfaces instead of existing only in `/api/health`.
- Tests: 148 -> 150 (127 Node tests + 23 web tests). New web coverage validates the expanded tab model and persisted ES/EN language preference.

## [0.8.1] - 2026-06-16

### Changed

- **Plaud API requests now mimic Plaud Web's request context.** The backend now validates and syncs with `Origin`/`Referer: https://web.plaud.ai`, a browser-like Chrome user agent, and the browser `sec-fetch-*` headers instead of the old custom `plaud-mirror-phase1/...` user agent and `app.plaud.ai` origin.

### Fixed

- **Extension-captured tokens no longer fail backend validation because of the backend request fingerprint.** The operator proved the captured EU user token returns `200` from Plaud Web's own console, while the backend received an HTML `403` from Plaud/Cloudflare. The token and region were correct; the stale server-side Plaud request context was the remaining mismatch.
- Tests: 147 -> 148 (new Plaud client header-regression test).

## [0.8.0] - 2026-06-16

### Added

- **Local Chrome companion extension for Plaud re-auth.** `apps/chrome-extension/` now ships an unpacked Manifest V3 extension ("Plaud Mirror Connector") that reads the active `app.plaud.ai` / `web.plaud.ai` tab's user bearer (`pld_tokenstr` first, storage scan fallback) and redirects that tab to Plaud Mirror's `/connect#token=...` handshake. It uses only `activeTab` + `scripting`, injects in Chrome's `MAIN` world, stores only the mirror origin, and never stores or logs the Plaud token.
- **Extension contract tests.** New integration smoke test verifies the extension manifest permissions, Plaud/mirror host coverage, `/connect#token=` redirect, `MAIN`-world script injection, and no token-material persistence in extension `localStorage`.

### Changed

- **Reconnect UX is extension-first.** The Configuration tab now presents the Chrome extension as the recommended path and demotes the bookmarklet to a copy-only fallback. This resolves the React/Chrome failure mode where a draggable `javascript:` `href` rendered by React becomes `javascript:throw new Error('React has blocked...')`, so the installed bookmarklet contains no real capture code.
- **Phase 4 remains active through `0.8.x`.** `v0.8.0` is a SemVer minor because it adds a new operator-facing re-auth delivery mechanism. It is still Phase 4 scope, so Phase 5 shifts to `0.9.x` and Phase 6 to `0.10.x+`.

### Fixed

- **Reconnect ready-state copy.** "Reconectar Plaud" now opens Plaud synchronously for popup-blocker compatibility, then only tells the operator to use the connector once `/api/connect/start` has returned and the `captureId` is stored in mirror `localStorage`.
- Tests: 145 → 147 (126 Node tests + 21 web tests). New: Chrome extension manifest/contract smoke tests.

## [0.7.6] - 2026-06-16

### Changed

- **Bookmarklet made shorter and visible.** The browser-assisted reconnect marker no longer carries the full workspace-token heuristic. It now focuses on the known user-token key (`pld_tokenstr`), scans storage as a fallback, and stays under 2 KB to reduce bookmark truncation risk.
- **Reconnect instructions now state the expected browser behavior.** Pressing the marker on `app.plaud.ai` should show a Plaud Mirror alert and then return to `/connect`; if no alert appears, the marker is not installed/executing correctly.

### Fixed

- **Bookmarklet failure is no longer silent.** The marker now shows an alert for every outcome: wrong page, token not found, token found, or capture error. This is intentionally less elegant but much easier to debug for an operator.

### Notes

- Tests 144 → 145 (new: bookmarklet size guard; web tests 20 → 21).

## [0.7.5] - 2026-06-16

### Fixed

- **Masked token paste now fails with a clear 400 instead of a ByteString crash.** Pasting a redacted/hidden token value such as `Bearer ●●●●` made the backend try to build `Authorization: Bearer ●...`; the bullet character is not legal in a Fetch `ByteString` header, so the operator saw `Cannot convert argument to a ByteString... index 7`. `saveAccessToken` now rejects mask characters and other non-header-safe token characters before constructing the Plaud client, with a message that tells the operator to copy the real `localStorage` token instead of a hidden/redacted field.
- **Docker image build no longer depends on `npm prune`.** The v0.7.5 deploy exposed a local build hang in `corepack npm prune --omit=dev`; the Dockerfile now uses a separate `prod-deps` stage with `npm ci --omit=dev` and copies those production dependencies into the runtime image.

### Notes

- Tests 143 → 144 (new: masked-token guard rejects before any Plaud request is built).
- Live deploy verified on dev-vm: container and `/api/health` report `0.7.5`, operator auth is armed, and `PLAUD_MIRROR_API_BASE=https://api-euc1.plaud.ai`.

## [0.7.4] - 2026-06-13

Closes the PII/info-leak introduced by v0.7.3 and fixes stale comments. No new feature.

### Fixed

- **Plaud's raw error body no longer leaks to public `/api/health` (medium).** v0.7.3 put a slice of Plaud's response body into `PlaudApiError.message`, which flows into `auth.lastError`, `lastSync.error`, and `lastErrors` — all exposed on the unauthenticated `/api/health`. The message is now generic again (`... failed with HTTP <code>`); the body stays in `bodySnippet` and is surfaced **only** on the authenticated `POST /api/auth/token` / `/api/connect/complete` response (so the operator still sees *why* a token was rejected, in the panel, without exposing it publicly).
- **Stale comments in `apps/web/src/plaud-token.ts`** still said "workspace token first" / "Prefer it", contradicting the v0.7.3 priority change. Updated to "user token (`pld_tokenstr`) first; workspace token is the fallback", with the iiAtlas divergence noted.

### Notes

- Tests 142 → 143 (new: `saveAccessToken` keeps `auth.lastError` generic for public health but enriches the thrown, authenticated error with Plaud's reason).

## [0.7.3] - 2026-06-12

Fixes the persistent 403 when validating a captured Plaud token: it was the wrong token type, on top of a region mismatch.

### Fixed

- **403 on token validation — wrong token type.** The extractor (and bookmarklet) inherited iiAtlas's "workspace token first" priority, but Plaud Mirror validates against `/user/me`, a user-scoped endpoint that rejects the per-workspace token with 403. `extractPlaudToken` / the bookmarklet now prefer the global **user token** (`pld_tokenstr`) first and use the workspace token only as a fallback.
- **Region:** the operator's account is EU, so `PLAUD_MIRROR_API_BASE=https://api-euc1.plaud.ai` is now set (in Doppler `plaud-mirror/dev`). A US base returned a hard 403 that the `-302` regional-retry path did not catch.
- **Messy paste tolerated.** `saveAccessToken` strips surrounding quotes and a leading `Bearer `/`bearer ` prefix before validating/storing, so pasting the raw localStorage value (`"bearer eyJ..."`) works instead of becoming `Bearer "bearer eyJ..."` → 403.
- **Plaud rejection reason surfaced.** `PlaudApiError` now includes a short slice of Plaud's response body in its message, so a 403/4xx shows the operator *why* in the panel instead of a bare HTTP code.

### Notes

- Tests 141 → 142 (122 backend + 20 web): extractor priority flipped (user token wins; workspace fallback), `saveAccessToken` normalization test.

## [0.7.2] - 2026-06-12

Fixes the v0.7.0/v0.7.1 browser-assisted re-auth (D-019) so the bookmarklet actually runs, after the operator reported "I drag it, tap it on Plaud, and nothing happens".

### Fixed

- **Bookmarklet did nothing (the real blocker).** `buildBookmarklet` wrapped the whole script body in `encodeURIComponent`, so the browser executed percent-encoded text (`%7B`, `%28`, …) → a silent syntax error. The bookmarklet now emits the raw, executable `javascript:` source (origin single-quoted to keep the href clean; no whole-body encoding). Regression-guarded in `plaud-token.test.ts` (asserts no `%7B`/`%28`).
- **"Reconectar Plaud" popup not null-checked.** If the browser blocks the tab, the panel now shows "abre app.plaud.ai manualmente …" instead of falsely reporting success; the capture session is still minted so a manual open works.

### Changed

- **Reconnect card rewritten** for clarity: numbered "Paso 1 — instalar (una vez)" vs "Paso 2 — usarlo", explicit desktop (`Ctrl+Shift+B` + drag) vs mobile (copy) install, and clarifying that the purple link is dragged (not clicked) while "Reconectar Plaud" is the button pressed in the panel. Clicking the link now shows a friendly "arrástrame, no me pulses" hint instead of Chrome's scary `javascript:`-blocked error.

## [0.7.1] - 2026-06-12

UX fixes to the v0.7.0 browser-assisted re-auth (D-019), from the operator's post-release audit. No security-model change.

### Fixed

- **Reconnect popup-blocker (medium).** "Reconectar Plaud" now opens the app.plaud.ai tab synchronously inside the click handler and mints the `captureId` in parallel, instead of opening it after `await`. Opening a tab after an await loses the user-gesture context and mobile/popup blockers reject it — exactly the "from the phone" path this feature targets. The captureId only needs to reach mirror localStorage before the operator taps the bookmarklet (seconds later), so the parallel mint is race-free.

### Added

- **"Copiar marcador (móvil)" button.** Copies the bookmarklet to the clipboard via the Clipboard API (with a `window.prompt` fallback in insecure contexts), since dragging to a bookmarks bar is unavailable on mobile and long-pressing a `javascript:` link is unreliable.

## [0.7.0] - 2026-06-11

Opens Phase 4 (re-auth). Browser-assisted Plaud re-auth so the operator refreshes the ~300-day bearer in one tap — no DevTools, no stored password — chosen over credentials-login (not applicable: Google-SSO account) and the official OAuth/MCP (deferred/watch). See D-019.

### Added

- **Browser-assisted Plaud re-auth (D-019).** New panel card "Reconectar Plaud": `POST /api/connect/start` mints a single-use `captureId` (in-memory `CaptureSessionStore`, TTL 10 min); the operator logs into app.plaud.ai (Google) and taps a bookmarklet that reads the bearer from Plaud's `localStorage` (extraction adapted from the MIT `iiAtlas` upstream, with attribution) and bounces it to the mirror's new `/connect` page (`ConnectPlaud`), which completes via `POST /api/connect/complete { token, captureId }`. The captureId binds the swap to operator intent (token-fixation defence); the bearer is validated against Plaud before storing and only ever travels in a URL fragment (never logged) + one same-origin authenticated POST. New module `apps/web/src/plaud-token.ts` (`extractPlaudToken`, `buildBookmarklet`). Both connect routes require the operator session.

### Notes

- The manual token paste (`POST /api/auth/token`) stays as the universal fallback. Telegram is explicitly not a capture channel.
- Auth-provider evaluation recorded in D-019: official partner API (enterprise-only, rejected), official CLI/MCP (deferred/watch, not disproven — its docs mention `presigned_url`), private email+password login (real endpoint, but not applicable to a Google-SSO account), browser-assisted capture (chosen).
- Attribution: token-location logic adapted from MIT `iiAtlas/plaud-recording-downloader` (Copyright (c) 2025 Atlas Wegman); see `docs/UPSTREAMS.md` Phase 4 adoption and the header of `apps/web/src/plaud-token.ts`.
- Tests: 130 → 141 (121 backend + 20 web). New: `capture-session.test.ts`, connect-flow server tests (start/complete/replay/forged), `plaud-token.test.ts` (extraction + bookmarklet shape).

## [0.6.3] - 2026-06-11

### Fixed

- `scripts/set-admin-passphrase.sh`: save the terminal state (`stty -g`) and restore it via `trap` on EXIT/INT/TERM, so a Ctrl-C between `stty -echo` and `stty echo` can no longer leave the operator's terminal without echo (low-severity UX finding from the operator's post-release audit of v0.6.2). No runtime change.

## [0.6.2] - 2026-06-10

Patch: operator tooling for D-018. No runtime change.

### Added

- `scripts/set-admin-passphrase.sh` — interactive helper the operator runs on dev-vm to store `PLAUD_MIRROR_ADMIN_PASSPHRASE` in Doppler (`plaud-mirror/dev`, project auto-created on first run, closing the "create Doppler project plaud-mirror" item open since Phase 2 planning). Silent double prompt, minimum 8 characters, value piped to the Doppler CLI via stdin so it never reaches argv, shell history, or disk. Prints the arm-and-verify steps (`doppler run ... -- docker compose up -d`).

### Changed

- `docs/operations/DEPLOY_PLAYBOOK.md` + `docs/operations/AUTH_AND_SYNC.md` document Doppler as the source of truth for the operator passphrase, with the `doppler run` launch path (process env overrides `.env` in compose substitution).
- `scripts/.unabsorbed-artifact-baseline.json`: new permanent entry for the helper (D-017 protocol).

## [0.6.1] - 2026-06-10

Patch governance/sync release: adopt LLM-DocKit **4.8.2** (upstream moved past the previously-adopted 4.8.0 on 2026-05-17). No runtime code or API change; the pre-commit hook requires the bump because `scripts/*` is versioned governance surface (same precedent as v0.5.4–v0.5.6).

### Added

- `scripts/test-validator.sh` (upstream 4.8.2): POSIX smoke-test runner for `dockit-validate-session.sh`. Passes 9/9 against the merged local validator.

### Changed

- `scripts/dockit-validate-session.sh`: merged the upstream 4.8.1/4.8.2 refinements — `is_zero_diff_read_only_session()` honoring `DOCKIT_ALLOW_READ_ONLY_SKIP=1` (DF-039: read-only sessions like `/brief` skip handoff-date/history-entry only when the working tree is zero-diff) and the glob-character filter in the orientation path extraction — while preserving the local guardrails the blind template copy had removed (`handoff-start-here-sync`, `prose-drift` D-016, `unabsorbed-artifact` D-017).

### Notes

- The raw `dockit-sync --apply` clobbered three scripts by overwriting local additions (`json-version` support in `bump-version.sh`/`check-version-sync.sh`, the three local checks in the validator); they were restored and hand-merged in the same session. This is the second occurrence of the clobber-on-sync pattern (first: 2026-05-13) — candidate feedback for LLM-DocKit (`merge` strategy for scripts with local extensions).
- Tests: 130/130 unchanged; validator smoke suite 9/9.

## [0.6.0] - 2026-06-10

Phase 3 hardening release, forced by the 2026-06-10 full-code security review before any unattended soak. The roadmap was re-cut: Phase 3 now spans `0.5.x`–`0.6.x`, Phase 4 (auto re-login) moves to `0.7.x` (see ROADMAP "Why Phase 3 Was Extended Through 0.6.x").

### Added

- **Operator access control (D-018).** New `PLAUD_MIRROR_ADMIN_PASSPHRASE` env var. When set, every `/api/*` route requires a signed HttpOnly session cookie (`plaud_mirror_session`, SameSite=Lax, 30-day TTL) obtained via the new `POST /api/session/login`; the public allowlist is `GET /api/health` (with `auth.userSummary` redacted for unauthenticated callers) and the `/api/session*` routes. New module `apps/api/src/runtime/operator-auth.ts` (HMAC session tokens keyed by master key + passphrase, constant-time passphrase comparison, in-memory login throttle: 5 failures/minute → 429). New routes `GET /api/session` and `POST /api/session/logout`. The web panel boots through a login gate and gains a Log out button; any mid-session 401 returns to the gate. When the env var is unset the API stays open (pre-0.6.0 behavior) and `health.warnings` + the boot log say so explicitly.
- **Startup crash recovery (D-013 amendment).** `service.initialize()` now sweeps orphans left by a dead process: `sync_runs` stuck in `running` are marked `failed` (they used to deadlock the anti-overlap guard forever), and `webhook_outbox` rows stuck in `delivering` are re-queued as `retry_waiting` due immediately with `attempts` preserved (at-least-once delivery accepted; downstreams must key idempotency on `recording.id`). Both sweeps surface in `health.lastErrors`.
- **Plaud request timeouts.** Every `PlaudClient` call carries `AbortSignal.timeout(PLAUD_MIRROR_REQUEST_TIMEOUT_MS)` (default 30 s) and fails with a clear `timed out after Nms` error; audio-artifact downloads carry a 10-minute ceiling (`AUDIO_DOWNLOAD_TIMEOUT_MS`). A hung connection can no longer wedge `activeRun` permanently.

### Changed

- `compose.yml` passes `PLAUD_MIRROR_ADMIN_PASSPHRASE` through to the container (empty = disabled + warning).
- `GET /api/health` redacts `auth.userSummary` (Plaud account email/uid) for unauthenticated callers when access control is enabled.

### Notes

- Backward compatible: deployments without the new env var behave exactly as v0.5.6, plus a visible warning.
- Test count: 116 → 130 (116 backend + 14 web). New: operator-auth unit suite, server-level gate/login/throttle/redaction tests, orphan-recovery store + service tests, Plaud client timeout test, download abort-signal test, LoginGate component tests.
- Known hardening debt deliberately left for the 0.6.x line: scrypt KDF upgrade for `data/secrets.enc` (current: single-pass SHA-256 of the master key), panel UI for `health.warnings` / `lastErrors` / `recentSyncRuns`.

## [0.5.6] - 2026-05-14

Patch governance/sync release. No runtime code or API change; pre-commit hook bumped this because `scripts/*` and `.claude/settings.json` count as versioned governance surface (same pattern as `v0.5.4` and `v0.5.5`).

### Added

- New `scripts/dockit-bootstrap-context.sh` from LLM-DocKit 4.8 sync — companion to the SessionStart hook for orienting a fresh agent into the external `home-infra` context.

### Changed

- `.claude/settings.json` — adopted the LLM-DocKit 4.8 SessionStart hook so new sessions load the external context block automatically.
- `scripts/dockit-validate-session.sh` — extended with the upstream 4.8 orientation/template-residue checks while preserving the local `prose-drift` (D-016), `unabsorbed-artifact` (D-017), and `json-version` checks.
- `docs/version-sync-manifest.yml` — yaml-merged with the 4.8 upstream schema; project entries preserved.
- `LLM_START_HERE.md` — section-merged with the 4.8 upstream templates; project-specific blocks intact.
- `docs/llm/HANDOFF.md` + `docs/llm/HISTORY.md` — rotated the Session Focus chain so the 2026-05-13 Codex session is preserved as Previous Session Focus, today's entry records the closure, and `Open Work` reflects that the home-infra control-plane exposure landed earlier today as `cdelalama/home-infra` commit `dec374f`.

### Notes

- The 2026-05-13 Codex session prepared the sync + HANDOFF/HISTORY content but did not commit; this release closes that pending work as the proper patch release (the pre-commit hook correctly refused a `Version impact: no` commit that touched governance surface).
- No `npm` build, no container rebuild, no test changes — `116/116` from v0.5.5 still holds. Validators `scripts/check-version-sync.sh` and `scripts/dockit-validate-session.sh --human` both PASS.

## [0.5.5] - 2026-04-27

### Added

- **D-014 full — full health observability.** `GET /api/health` now also returns:
  - `lastErrors`: cross-subsystem error ring buffer (in-memory, capped at `LAST_ERRORS_CAP=20`, most-recent-first). Each entry has `occurredAt` (ISO), `subsystem` (`scheduler` | `outbox` | `sync` | `auth`), `message`, `context` (string→string map). Failed scheduler ticks, outbox delivery errors (both retry and permanent escalations), and failed sync runs all feed it through `service.recordError`. The buffer resets per container restart by design — durable failures live in `outbox.permanentlyFailed` or `lastSync.error`.
  - `recentSyncRuns`: last 5 finished sync runs from SQLite (`finished_at DESC`). Distinct from `lastSync` (single most-recent finished run) — operator-facing audit signal for "are recent runs succeeding or failing?". Active runs excluded; they remain on `activeRun`.
- New `LastErrorEntrySchema` and `LAST_ERRORS_CAP` exports in `@plaud-mirror/shared`.
- New `RuntimeStore.getRecentSyncRuns(limit)` query.
- New `service.recordError(subsystem, message, context?)` method.
- New `SchedulerManagerOptions.onTick` callback, used by the runtime to feed failed ticks into the ring buffer.
- New `OutboxWorkerDependencies.onDeliveryError` callback, used by the runtime to feed both retry and permanent-failure escalations into the ring buffer.
- 3 new tests in `apps/api/src/runtime/service.test.ts` (ring buffer cap+ordering+cross-subsystem; sync error feeds lastErrors; recentSyncRuns surfaces last 5 most-recent finished).
- **D-017 — new `check_unabsorbed_artifact()` validator check (ninth check, WARN-level non-blocking).** New `scripts/check-unabsorbed-artifact.sh` (POSIX sh, filename-only comparison) detects local artifacts in `scripts/` and `.claude/rules/` whose filename does not exist in the LLM-DocKit upstream template (`$HOME/src/LLM-DocKit/`). New `scripts/.unabsorbed-artifact-baseline.json` ships with three entries:
  - `scripts/check-prose-drift.sh` — transient (`df_id: DF-028`), candidate-for-absorption upstream
  - `scripts/check-upstreams.sh` — permanent project-specific (watches plaud-specific upstreams)
  - `.claude/rules/external-context-triggers.md` — permanent project-specific (glob list is local data; the rule template lives upstream)

### Changed

- **`prose-drift` validator hardened from WARN to FAIL** in `scripts/dockit-validate-session.sh` per D-016 plan. One calibration release (v0.5.4) was sufficient — operator workflow is rephrase-or-baseline. False positives caught during today's drift sweep (parens/backticks separating planning phrase from version literal) were resolved by rewording, not by relaxing the regex; the script remains a structural check, the operator's task is to phrase prose so the regex sees a recognised planning phrase on the same line as the version literal.
- D-014 status in `docs/llm/DECISIONS.md` updated from "partially implemented" to "fully implemented in v0.5.5".
- D-016 status updated to acknowledge the WARN→FAIL transition shipped in v0.5.5.
- `OutboxHealthSchema` doc-comment cleaned up (was pointing at a non-existent v0.5.4 D-014 landing).
- `SchedulerStatusSchema` doc-comment cleaned up similarly.
- `docs/operations/AUTH_AND_SYNC.md` "Still later in 0.5.x" section replaced with "Full health observability — shipped in v0.5.5" (resumable backfill remains deferred).
- `docs/operations/API_CONTRACT.md` `/api/health` description updated to describe the new fields and mark D-014 full as of v0.5.5.

### Notes

- Test count: 113 → 116 (105 backend + 11 web). Backend gained the 3 D-014 tests; web suite unchanged.
- POSIX-shell bugs caught and worth recording (per D-017 §"Revisions"):
  1. `$'\t'` ANSI-C quoting is bash-only. Under `#!/bin/sh` it is treated as a literal `$\t` and silently fails. Fix: define `TAB=$(printf '\t')` once, interpolate as `"${TAB}"`. Same shape that hit `check-prose-drift.sh` in v0.5.4.
  2. `grep -c X file 2>/dev/null || echo 0` produces a multi-line value when there are zero matches: grep prints "0" AND exits nonzero, so the fallback also runs. Fix: `grep X file 2>/dev/null | wc -l | tr -d ' '`.
  3. sed-based JSON merge in `--update-baseline` mode breaks on `/` literals in path strings. Fix: delegate JSON read-modify-write to Python3 (already a documented dependency via `~/.claude/hooks/check-passive-rule.sh`).
- The `check_unabsorbed_artifact()` validator check generates the structural anchor for `DF-028` upstream: every `dockit-validate-session.sh --human` run on a tree where DF-028 is still un-absorbed will emit a baseline-suppressed transient entry, reminding the operator that the upstream story is open.
- `/api/health.lastErrors` is in-memory and resets per container restart by design. This is the right shape for a transient observability surface — durable failures already live in `outbox.permanentlyFailed` and `lastSync.error`, where they survive a restart.

## [0.5.4] - 2026-04-26

### Added
- **Layer-1 doc-drift enforcement (D-016).** New `scripts/check-prose-drift.sh` (POSIX sh, ~290 lines, zero external deps) catches the prose-drift class that has hit plaud-mirror six times across `v0.4.x → v0.5.3` despite a passive auto-memory rule that was extended four times and never enforced anything. Four rules:
  - `R1-current-state-stale-version` — "Current"-context lines (`Version:`, `Current delivery target:`) that don't match `VERSION`.
  - `R1-future-version-without-planning-phrase` — `vX.Y.Z > current` mentioned without a planning phrase (`next:`, `scheduled for`, `lands in v`, `from v`, etc.).
  - `R3-future-claim-already-shipped` — phrases like "deferred to vX.Y.Z" / "still later in vX.Y.Z" that cite a version `<= current` (i.e., a "future" claim about something already shipped). Adjacency-aware: only flags the version literal immediately following the phrase, not unrelated versions later in the same line.
  - `R4-decision-status-stale` — `D-XXX` entries whose `Status:` says "designed/lands during" while `CHANGELOG.md` mentions them as shipped.
  Three modes: `--strict` (default; exit 1 on drift, used by the validator wrapper), `--review` (JSON output for the future agent-based check, on-ramp to Layer 2), `--update-baseline --note "<reason>" [--transient-until vX.Y.Z]` (deliberate operation that records auditable acceptances). The baseline file `scripts/.prose-drift-baseline.json` carries `{id, literal, file, rule, reason, commit_sha, created_at, transient_until?}` per entry and is enforced (when `current VERSION >= transient_until`, the entry is reported as expired with a remediation message).
- **`prose-drift` check** in `scripts/dockit-validate-session.sh` (eighth check). Thin wrapper that invokes the standalone script in `--strict --quiet` mode and translates exit code → `add_result`. Severity `WARN` during v0.5.4 (calibration window — assumes false positives in the first release using the script). Promoted to `FAIL` from v0.5.5 once the baseline shape settles. Per the Layer-1/Layer-2 architecture from `~/src/LLM-DocKit/docs/HOOKS_ENFORCEMENT_PROPOSAL.md` (RFC, draft).
- **Decision D-016** in `docs/llm/DECISIONS.md` documenting the regex-paliativo / semantic-deferred two-layer cascade. Explicit acknowledgment that the script is not the full closure of the doc-drift class — Optional Enhancement B of `HOOKS_ENFORCEMENT_PROPOSAL.md` (agent-based Stop hook reading code + docs) is the closure path. The `--review` JSON output of the script is the explicit on-ramp to that future agent.
- **Global meta-rule** in `~/.claude/CLAUDE.md` ("Before adding a passive rule") plus a `PostToolUse` hook in `~/.claude/hooks/check-passive-rule.sh` that nudges whenever a write lands in `~/.claude/projects/*/memory/*`. The nudge is the meta-enforcement; the heuristic in `CLAUDE.md` is the rationale. Both are global because auto-memory is global infrastructure (`~/.claude/projects/*/memory/`) — a per-project rule cannot reach it.
- **`docs/llm/D-013` and `docs/llm/D-014` Status fields rewritten** to reflect shipped reality (caught immediately by the new R4 rule on the script's first run — the script paid for itself before its own commit).
- **`scripts/.prose-drift-baseline.json`** with two permanent entries for `docs/UPSTREAMS.md` (`v0.5.10` for `rsteckler/applaud`, `v1.4.1` for `iiAtlas/plaud-recording-downloader`). These are external upstream package versions, not plaud-mirror's, and drift independently from the `VERSION` file. The baseline reason is recorded in the entry itself for future auditability.
- **DF-028** in `~/src/LLM-DocKit/docs/DOWNSTREAM_FEEDBACK.md` (separate commit, separate repo) framing this episode as the first empirical demand for `LLM_DOCKIT_CE_V2_PROPOSAL.md` P0 #1 ("Manifest = intención, CI = evidencia"). Status `candidate, awaiting validation`. Resolution path explicit: `candidate → validated → tracked → adopted`.

### Changed
- `scripts/dockit-validate-session.sh` registers the new `check_prose_drift` function in the run list (now 8 checks; was 7).
- `~/.claude/settings.json` gains a `PostToolUse` hook entry alongside the existing `SessionStart`, `Stop`, `Notification`, and `PostToolUseFailure` hooks.

### Notes
- This is a **patch** release (0.5.3 → 0.5.4). The product surface is unchanged — no new runtime behavior, no new HTTP routes, no schema changes. What changes is the **governance enforcement layer**: a class of doc-drift bug that has been recurrent in this project is now caught structurally instead of by LLM discipline. Operators upgrading from `v0.5.3` see no behavior change.
- D-014 full (`lastErrors` ring buffer + extended outbox/sync history) is pushed back to **`v0.5.5`** to absorb this governance work. The roadmap shift (the fourth in `0.5.x`) is small in scope: v0.5.4 absorbs only the script + check + meta-rule, leaving D-014 as the only remaining Phase 3 piece for v0.5.5.
- Test totals are unchanged: 113 (102 backend + 11 web). The script does not have its own test suite yet — it is smoke-tested by running against the live tree (and immediately found two real drifts on first invocation, which is the strongest test possible). A formal harness for the script is deferred to the moment it is upstreamed into LLM-DocKit per DF-028.
- The `prose-drift` check is in `WARN` severity during this release. Operators who run the validator will see `[WARN] prose-drift: ...` if drift is detected, but commits and pushes are not blocked. From v0.5.5 onwards, `[FAIL]` will block. Use `scripts/check-prose-drift.sh --update-baseline --note "<reason>"` between now and v0.5.5 to record any legitimate exceptions before the gate hardens.

### Fixed
- (No bug fixes in this release — the new check fixed two stale `Status:` lines in `D-012` and `D-014` on its first run, but those weren't bugs in the runtime sense; they were doc drift caught by the new tool. They are listed under "Added" because the fix was a side effect of building the tool.)

## [0.5.3] - 2026-04-26

### Added
- **Durable webhook outbox (D-013).** Webhook delivery is now decoupled from sync: each successfully-mirrored recording pushes its `recording.synced` payload into a new SQLite table `webhook_outbox`, and a dedicated `OutboxWorker` (5-second cadence, anti-overlap reusing the existing `Scheduler`) walks the queue, retries with exponential backoff, and either delivers (`→ delivered`) or escalates to `permanently_failed` after 8 attempts. Backoff schedule: 30 s, 2 m, 10 m, 30 m, 1 h, 2 h, 4 h, 8 h — cumulative ~16 hours, sized to ride out an overnight downstream outage on a home-infra box. The HMAC signature is recomputed at delivery time (not at enqueue), so rotating `webhookSecret` mid-flight is honoured for items still in the queue.
- **`webhook_outbox` SQLite table** with FSM `pending → delivering → delivered | retry_waiting → permanently_failed`. Atomic claim via `UPDATE ... WHERE id = ? AND state = ?` so a worker tick and a panel-triggered retry cannot pick the same row twice. Index on `(state, next_attempt_at)` for cheap polling. `webhook_deliveries` (the existing append-only audit log) keeps every individual attempt record.
- **New routes**:
  - `GET /api/outbox` returns `{ items: OutboxItem[] }`, **only `permanently_failed` rows**. The pending and retry-waiting backlog is visible only as counters (see below) so the panel does not become a queue browser.
  - `POST /api/outbox/:id/retry` resets a `permanently_failed` row to `pending` (clears `attempts` and `last_error`); 409 when the item is in any other state, 404 when unknown, 400 when the id shape is unsafe.
- **`/api/health.outbox` block** with `pending`, `retryWaiting`, `permanentlyFailed`, and `oldestPendingAgeMs` (ms age of the oldest queued or retrying row, null when both states are empty). Visible in every health response from now on.
- **`SyncRunSummary.enqueued`** new counter — number of webhook payloads pushed to the outbox during a run. Coexists with `delivered`, which keeps its original semantic ("delivered synchronously inside this run") and now stays at 0 for runs executed by the outbox-aware service.
- **New "Webhook outbox" card on the Configuration tab** of the panel: live counters from `health.outbox`, oldest-pending age, list of `permanently_failed` rows with a Retry button per row. StatusPill colour: green when empty, amber when there is anything pending or retrying, red when there is at least one permanently-failed item.
- New shared schema types: `OutboxState`, `OutboxItem`, `OutboxHealth`, `OutboxListResponse`, `OutboxRetryResponse`. New `RuntimeStore` methods: `enqueueOutboxItem`, `claimOutboxItem`, `markOutboxDelivered`, `markOutboxRetry`, `markOutboxPermanentlyFailed`, `forceOutboxRetry`, `getOutboxHealth`, `listFailedOutboxItems`, `getOutboxPayload`, `getOutboxItem`, plus `seedSchedulerDefaults`-style additive migration on `sync_runs.enqueued`. New module `apps/api/src/runtime/outbox-worker.ts`. New module `apps/api/src/runtime/webhook-signature.ts` extracting `buildWebhookSignature` so the worker and the legacy code path can share the HMAC code without duplication.

### Changed
- **Webhook delivery is no longer synchronous.** `service.processRecording` calls a new private `enqueueOrSkipWebhook(recording, mode)` that pushes a payload into the outbox and writes `lastWebhookStatus = "queued"` on the recording row. The legacy synchronous `deliverWebhook` method is removed. Every operator-visible HTTP POST to the configured webhook URL now comes from the outbox worker, not from `executeMirror`.
- **`RecordingMirror.lastWebhookStatus` enum extended** with `"queued"` (the new normal state right after a sync) alongside the legacy `"skipped"` / `"success"` / `"failed"` values. Older rows in long-lived databases keep their original value; new rows finalised by v0.5.3 carry `"queued"` (or `"skipped"` when the webhook is not configured).
- `apps/api/src/server.ts` constructs an `OutboxWorker` unconditionally during boot and registers an `onClose` hook to stop it, alongside the existing scheduler manager.
- `apps/web/src/App.tsx` wires `failedOutboxItems` state, `handleRetryOutboxItem` handler, and the new card. The existing manual-sync metrics block is unchanged in this release; a follow-up will surface `enqueued` next to `delivered`.
- `package.json#scripts.test` chains the new `apps/api/dist/runtime/outbox-worker.test.js` alongside the existing scheduler / manager / environment tests.

### Notes
- This is a **patch** release (0.5.2 → 0.5.3) because the HTTP contract additions are strictly additive (new fields default-fill in older clients via Zod's `.default(...)` and `.default(0)`; new routes do not affect existing ones). Operator-visible behaviour does change — webhook delivery is now async — but the _shape_ of the payload, the HMAC scheme, and every existing route remain identical, so a downstream that was working with v0.5.2 keeps working without code changes.
- `delivered` in `SyncRunSummary` is now structurally always 0 for new runs. Dashboards that read it as "successful webhook deliveries during this run" will start showing 0 — that is the correct value, because deliveries no longer happen during the run. Use the `enqueued` field for the equivalent v0.5.3+ count, and `health.outbox.pending + retryWaiting` for "what is waiting to be delivered right now."
- For an operator who already had `lastWebhookStatus: "success"` rows in their database from before v0.5.3: those rows are NOT re-enqueued. The outbox is fed by `executeMirror`, not by a backfill scan of historical recordings. If you want the new audit-trail-by-outbox semantics for a recording that pre-dates v0.5.3, force a re-mirror via the existing `forceDownload` path.
- Test totals: 102 → 113 (102 backend + 11 web). 11 new tests: 4 in `store.test.ts` (outbox enqueue/claim/markDelivered + retry transitions + permanently_failed + force-retry rejection from non-failed states), 6 in `outbox-worker.test.ts` (empty-queue skip, success path, transient-failure retry with backoff, monotonic deliveryAttempt across retries, MAX_ATTEMPTS escalation, unconfigured-webhook escalation), 1 server test (HTTP shape: empty list, list, retry success, 409 on non-failed, 404 on unknown, 400 on bad id).

### Fixed
- (No bug fixes in this release — the in-flight `lastWebhookStatus = "queued"` value is a new state, not a fix to an existing bug.)

## [0.5.2] - 2026-04-25

### Added
- **Panel-driven scheduler configuration.** The continuous sync scheduler is now configured from the Configuration tab of the web UI: a new "Continuous sync scheduler" card shows the live status (`enabled` / `interval` / `next tick` / `last tick` / `last tick reason`) and an "Interval (minutes, 0 disables)" form that posts to `PUT /api/config`. The interval persists in SQLite (the same `settings` key/value table the webhook URL already uses), so changes survive container restarts and the operator never has to touch `.env`. The `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` env var is downgraded to a **bootstrap-only seed** — it pre-populates the SQLite row on a fresh database, then the SQLite-backed value wins on every subsequent boot, ignoring any later env-var changes.
- **Hot reconfigure without restart.** New `SchedulerManager` (`apps/api/src/runtime/scheduler-manager.ts`) wraps the `Scheduler` class and exposes `applyInterval(ms)` with start / stop / swap-cadence semantics. `service.updateConfig` calls back into the manager via a new reconfigure hook, so a panel save takes effect immediately — the existing `Scheduler` is `stop()`ed and a fresh one is started with the new cadence in the same tick. Idempotent for unchanged values (no cadence reset on a no-op save).
- New shared schema field `RuntimeConfig.schedulerIntervalMs` (with `.default(0)` so older clients still parse) and `UpdateRuntimeConfigRequest.schedulerIntervalMs?` (optional, omit to leave unchanged). `GET /api/config` now reports the persisted value; `PUT /api/config` accepts and validates it (must be `0` or `≥ 60_000`) and persists via `RuntimeStore.saveConfig`.
- New `RuntimeStore.seedSchedulerDefaults(ms)` method called on `service.initialize()`. Only writes the env-var value to SQLite when the row is absent — once the operator has touched the panel even once, the env var is irrelevant on subsequent boots.

### Changed
- `SchedulerManager` replaces the inline `Scheduler` instantiation that lived in `apps/api/src/server.ts`. The runtime now always constructs a manager (regardless of the persisted interval); `manager.applyInterval(0)` is a no-op so a freshly-installed container with no env var and no panel save stays disabled exactly like `v0.5.1`.
- `PlaudMirrorService` gains a `setSchedulerReconfigureHook(hook)` API alongside the existing `setSchedulerStatusProvider` so the runtime can wire bidirectional integration with the manager: read live status into `getHealth`, push interval changes from `updateConfig`.
- `apps/web/src/App.tsx` adds the scheduler card under the existing Webhook card on the Configuration tab. Helpers `formatSchedulerInput` / `parseSchedulerInput` round-trip between the operator-facing minutes and the wire-format milliseconds.

### Notes
- This is a **minor** release (0.5.1 → 0.5.2) because the panel surface gains a new operator-visible feature. The HTTP contract is additive (a new optional field on `PUT /api/config`, a new field on `GET /api/config` and `RuntimeConfig`); existing callers that ignore the field continue to work.
- For operators who already had `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` set in `.env`: the value seeds SQLite on the first `v0.5.2` boot, after which the panel is the source of truth. You can safely remove the env var; it does nothing once the SQLite row exists.
- Phase 3 sequencing pushed back one slot again to absorb this UX work: `v0.5.3` is now the durable webhook outbox (D-013), `v0.5.4` is the full health observability surface (D-014, complete). This is the third roadmap shift in `0.5.x`; the pattern is finally settling because the scheduler subsystem is now operator-controllable end-to-end.
- Test totals: 93 → 102 (91 backend + 11 web). 9 new tests: 1 in `store.test.ts` (round-trip + seed-only-once semantics), 7 in the new `scheduler-manager.test.ts` (start / stop / reconfigure / idempotency / floor / sub-floor rejection), 1 in `service.test.ts` (validation + persistence + hook dispatch on `updateConfig`).

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
