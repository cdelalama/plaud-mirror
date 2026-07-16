<!-- doc-version: 0.14.0 -->
# LLM Work Handoff

This file is the live operational snapshot. Durable rationale lives in `docs/llm/DECISIONS.md`. Phase boundaries live in `docs/ROADMAP.md`.

## Current Status

- Last Updated: 2026-07-16 - GPT-5 Codex
- Session Focus: **v0.14.0 provider-neutral Transcription Intake source is
  implemented but deliberately not deployed.** D-023 supersedes the old
  Media2Text-repository implementation gate without erasing D-022's producer
  review. Plaud Mirror owns `docs/contracts/` and remains complete with no
  destination. Optional destinations use capability test-before-enable,
  separate encrypted intake/artifact/status credentials, content-addressed
  immutable leases, a dedicated durable outbox, monotonic signed/pull status,
  canary and bounded replay, exact coverage, and a dedicated Integrations UI.
  The generic `recording.synced` webhook is unchanged. Media2Text is the first
  intended compatible provider; Cortex consumes its later transcript-ready
  output, and Home Infra is untouched. Runtime v0.13.1 remains deployed during
  its PT15M soak; no destination, live canary, replay, rebuild, restart, deploy,
  or sibling edit occurred in this slice.
- Previous Session Focus: **v0.13.1 shutdown hardening is deployed and reconciled.** The scheduler now
  makes `stop()` terminal for callbacks already queued in the event loop, and
  every HTTP app test registers unconditional cleanup. Production runs clean
  source `d00ca3e`. The protocol snapshot still maps
  the active scheduler's exact `nextTickAt` to optional
  Home Infra Protocol 0.10.0 `next_run_at`, omits it when no plan exists, and
  leaves freshness and severity unchanged. Home Infra 0.6.10 input `015d7ee`
  is synchronized, and Infra Portal 0.20.2 observes the current future
  `nextRunAt` with no provenance warnings.
  Final independent Fable audit returned GO with no blockers and reproduced all
  194 tests. Same-instance stop/start while an old callback is already queued
  remains a theoretical reuse hazard, but production always replaces the
  stopped scheduler instance; harden it only in a separate future patch.
- Previous Session Focus: **v0.12.0 integrity release is deployed and reconciled.** The operator's
  first real deletion on 2026-07-15 exposed that v0.11.2 accepted any HTTP 2xx
  as mutation success and mixed a historical tombstone into current Plaud
  coverage. v0.12.0 accepts only empty or explicit status-zero mutation
  responses, journals deletion operations/events around side effects,
  reconciles uncertain DELETE outcomes before any retry, and blocks Restore
  while an operation is unresolved. Full sync now commits a generation only
  after physical artifact checks, so current remote coverage partitions
  exactly while local-only rows and tombstones remain separately observable.
  The UI exposes a retry-only pending state and keeps destructive controls at
  full contrast. SQLite/API changes are additive and backward compatible.
  Runtime source `8df5c35` passed 190 tests (160 Node/integration + 30 web),
  build/typecheck, dependency audits, visual checks, DocKit, CI, and a
  consistent SQLite backup before Doppler-wrapped deployment. The live
  zero-download full sync reports 626/626 current Plaud rows mirrored, zero
  dismissed/missing/local-only, and one confirmed upstream deletion retained
  as a local tombstone; the legacy row was imported as a confirmed operation
  event. Docker, Plaud auth, PT15M scheduling, SQLite integrity, warnings,
  outbox, and the public protocol snapshot all pass. Home Infra 0.6.6 at
  external commit f161f39 is synchronized to NAS; Infra Portal provenance has
  no warnings and observes `ok/none`, not stale. Home Infra Protocol and Infra
  Portal required no code change. Plaud-first delivery to Media2Text is now
  operator-ratified, but the producer review of Media Intake v1 at Media2Text
  commit `c982ced` returned REQUEST CHANGES before implementation. D-022 and
  the formal review require collection-aware identity, authenticated artifact
  fetch, pinned artifact lifetime, and durable completion/status reconciliation
  back to Plaud Mirror so the product can show exact transcription coverage.
  No adapter, endpoint, canary, runtime change, or additional real deletion was
  invoked.
- Previous Session Focus (2026-07-10, v0.10.7 soak activation): Physical reconciliation examined
  all 619 Plaud recordings with zero candidates/failures. The contract now
  declares Home Infra Protocol 0.7.1, `internal-loop`, `cadence: PT15M`, and
  `stale_after: PT2H`. Runtime v0.10.7 is deployed Docker healthy and the first
  automatic tick completed at `2026-07-10T23:29:46.825Z` only after its sync
  run finished: 619 examined, 0 matched/downloaded/failed, producer `ok/none`,
  Portal `stale=false`. Both Node 20 timeout
  regressions now keep the event loop alive until their unref'ed abort timers
  fire; runtime behavior is unchanged from `v0.10.4`. Scheduled ticks now
  await their mirror run; whole-run cancellation defaults to one hour and
  reaches Plaud calls/audio streams; pagination is bounded; outbox setup errors
  requeue claims and all eight waits precede a ninth final attempt; SIGTERM
  drains work before SQLite closes; compose has a healthcheck; full and
  production dependency audits are clean. The 3-5 day soak is now running.
- Previous Session Focus (v0.10.3 patch): atomic audio replacement, physical
  artifact reconciliation, candidate failure isolation/accounting, and HTTP
  409 for backfills colliding with active sync.
- Previous Session Focus (v0.10.2 patch): evidence gate with Node 20 CI, web
  typechecking, automatic Node/integration test discovery, Docker-context
  hygiene, idle scheduler-run polling, and a timing-stable Library test.
- Previous Session Focus (v0.10.1 patch): sync progress no longer counts
  disabled-webhook delivery as skipped sync candidates. The deployed dev-vm
  runtime reports auth healthy and 606/606 mirrored; the latest corrected run
  records `downloaded=21` and `skipped=0`.
- Previous Session Focus (v0.10.0 minor): Plaud recording sync now publishes the Home Infra Protocol contract/status surface. This did **not** rewrite the Plaud sync engine: the existing scheduler/manual sync/backfill/outbox flow remains the producer. New `infra.contract.yml` declares `plaud-mirror-recordings-sync` as a `home-infra-protocol` `sync_jobs[]` entry; `packages/shared/src/protocol.ts` models the status snapshot; `apps/api/src/runtime/protocol-status.ts` maps existing `ServiceHealth` into protocol checks; and public routes `GET /api/protocol/sync-jobs/plaud-mirror-recordings-sync/status` plus alias `/api/protocol/status` return a sanitized snapshot for Infra Portal/Hermes consumers. Home Infra commit `5df02e3` registers the contract and the NAS portal input sync copied Plaud Mirror contract source `fcbb7d9`; Infra Portal `/api/sync-jobs` now includes `plaud-mirror-recordings-sync`.
- Previous Session Focus (v0.9.6 patch): LLM-DocKit 4.9.6 adopter sync, no runtime deployment. Applied the 4.9.6 sync from `~/src/LLM-DocKit` and kept the useful upstream guardrails: HISTORY format defaults to `any` with strict dash/no-dash opt-in, version tooling supports `json-version`, `yaml-info-version`, and `package-lock-version`, and Trace v1.3 requires seconds in chat `Sent` headers plus stale-read re-verification guidance. The raw sync again dropped Plaud Mirror's local validator checks (`handoff-start-here-sync`, `prose-drift`, `unabsorbed-artifact`) from the copied `scripts/dockit-validate-session.sh`; they were reinserted before commit. `scripts/test-validator.sh` reports 32 smoke cases, including the intentional upstream rule that HANDOFF Trace Anchor commit times may omit seconds while chat `Sent` headers must include seconds. `docs/version-sync-manifest.yml` tracks `package-lock.json` via `package-lock-version`, raising version-sync from 21 to 22 targets and clearing the stale lockfile version.
- Previous Session Focus (v0.9.5 patch): mobile operator shell made usable. The `v0.9.0` redesign and `v0.9.1` full-viewport shell still behaved too much like desktop on phones: the mobile rail hid labels and showed only icons, the status strip occupied too much vertical space, and Library row actions could fall to the lower-left of a mobile row. v0.9.5 keeps backend routes, auth, sync, storage, scheduler, webhook, secrets, and `.env` behavior unchanged while adding a labeled mobile view selector (`Vista` / `View`), replacing the large mobile status strip with one compact chip row, and pinning Library dismiss/restore actions to the top-right on narrow screens. Tests: 154 (127 Node/integration + 27 web). Runtime state after deploy: container and `/api/health` report `0.9.5`, auth healthy, EU API base, catalog complete at 580/580, operator lock armed.
- Previous Session Focus (v0.9.4 patch): Library playback and scrolling fixed in the redesigned panel. The `v0.9.0` Library had two operator-visible regressions in the full-viewport shell: Compact Play only toggled React state and did not start the native audio element, and the recordings list did not own a reliable scroll area. v0.9.4 keeps the backend and data contracts unchanged while making each playable row keep a real `<audio>` in the DOM, calling `audio.play()` inside the compact button's user gesture, pausing stale rows when another row starts, widening Full-mode player rows on desktop, and giving Library a table-owned scroll region under its fixed header/toolbar/pagebar. Tests: 153 (127 Node/integration + 26 web). Runtime state after deploy: auth healthy, EU API base, catalog complete at 517/517, operator lock armed.
- Previous Session Focus (v0.9.3 patch): DocKit trace protocol merged without losing local guardrails. A raw LLM-DocKit sync landed in the working tree after v0.9.2 and added trace-protocol scaffolding, but also removed Plaud Mirror's local governance protections: `handoff-start-here-sync`, `prose-drift`, `unabsorbed-artifact`, and `json-version` package-manifest handling. v0.9.3 keeps the useful upstream pieces (`LLM_START_HERE.md` Trace Protocol section, bootstrap Trace guidance, validator `trace-protocol` check, read-only skip refinement, and smoke tests) while restoring the local extensions. `scripts/check-version-sync.sh` again checks 21 targets, and `scripts/dockit-validate-session.sh --human` reports 12 checks: the previous 11 plus trace-protocol, skipped unless explicitly enabled in `.dockit-config.yml`. `scripts/test-validator.sh` passes 17/17.
- Previous Session Focus (v0.9.2 patch): Main sync action now downloads the displayed missing count. Live investigation showed the Main cockpit button was not broken by Plaud or auth: it inherited the Historical Backfill form's conservative draft `limit=1`, so a click could examine the full Plaud catalog while downloading only one missing recording. `apps/web/src/App.tsx` decouples Main from the Backfill draft: Main computes the displayed missing count from health, sends that count to `POST /api/sync/run` capped at the existing 1000-item backend ceiling, forces `forceDownload:false`, labels the button with the exact count (`Descargar N` / `Download N`), and asks for confirmation at 25+ downloads. Backfill keeps its own `limit=1` default because it is an advanced filtered tool. Tests: 151 (127 Node/integration + 24 web). Operational full sync run `5a970a84-3f44-4602-b727-3d1d12179349` completed with `examined=514`, `matched=165`, `downloaded=165`, `skipped=165` (webhook skipped because no webhook is configured), `enqueued=0`, and no error; health/SQLite show `recordingsCount=514`, `plaudTotal=514`, missing `0`.
- Previous Session Focus (v0.9.1 patch): full-viewport operator shell + documentation drift cleanup. The `v0.9.0` redesign copied the standalone reference frame too literally, rendering production as a centered 1240px card on a grey presentation canvas. `apps/web/src/styles.css` removed the outer card frame (`max-width`, page padding, border, radius, shadow), made the operator frame fill `100vh`/`100%`, kept the 212px rail pinned to the left edge on desktop, and let `.operator-content` own vertical scrolling. Existing screens, components, copy, endpoints, auth/reconnect flows, and mobile breakpoints stayed intact. Tests: 150 (127 Node/integration + 23 web). Follow-up drift cleanup made the docs consistently describe `v0.9.1` as current, left `v0.9.0` only as historical redesign context, and corrected live launch commands to the Doppler-wrapped compose form.
- Previous Session Focus (v0.9.0 minor): reference-driven operator panel redesign. Absorbed `docs/design/reference/plaud-mirror-panel-standalone.html` into the real React/Vite panel without backend API changes or secret/env edits. The panel now uses the dense light-console visual system from the reference (212px rail, Archivo/Space Grotesk/JetBrains Mono, green accent, state colors) and real five-screen navigation: Main, Library, Backfill, Configuration, Operations. Existing capabilities stay wired: operator login, health/status, Chrome-extension reconnect + manual token fallback, scheduler/webhook config, sync/backfill, recordings playback/dismiss/restore, outbox retry, and errors/runs. Added ES/EN operator chrome persisted in localStorage. Tests 148 -> 150 (127 Node + 23 web).
- Previous Session Focus (v0.8.1 patch): backend Plaud validation fingerprint aligned with Plaud Web. The operator proved the extension-captured EU user token is valid in the Plaud Web console, while the backend received an HTML `403` from Plaud/Cloudflare. Diagnosis: token and region were correct; the stale server-side Plaud request context was the mismatch (`Origin/Referer: https://app.plaud.ai` plus custom `plaud-mirror-phase1/...` user-agent). Fix: `PlaudClient` now sends `Origin/Referer: https://web.plaud.ai`, a browser-like Chrome UA, and browser `sec-fetch-*` headers. Extension flow unchanged. Tests 147 -> 148. Earlier v0.8.0 below.
- Previous Session Focus (v0.8.0 minor): definitive Phase 4 delivery path: local Chrome extension. Post-diagnosis confirmed the v0.7.x bookmarklet was not merely flaky: React-rendered `javascript:` hrefs are replaced with `javascript:throw new Error('React has blocked...')`, so Chrome can install a bookmark that contains no Plaud Mirror capture code. Product decision: stop patching draggable bookmarklets as the recommended path. v0.8.0 adds `apps/chrome-extension/` ("Plaud Mirror Connector"), a local unpacked Manifest V3 extension that reads the active Plaud tab's user bearer (`pld_tokenstr` first, storage scan fallback), injects in Chrome's `MAIN` world, stores only the mirror origin, and redirects to the existing `/connect#token=...` capture handshake. Panel UX is now extension-first; bookmarklet is copy-only fallback. Phase 4 spans `0.7.x`-`0.8.x` at that point. Tests 145 -> 147 (126 Node + 21 web). Earlier v0.7.6 below.
- Previous Session Focus (v0.7.6 patch): bookmarklet no longer fails silently. Operator tried the v0.7.5/v0.7.x flow and reported the installed "Reconectar Plaud Mirror" bookmarklet did nothing visible on app.plaud.ai ("no me copia nada"). Fix: `buildBookmarklet` is short (<2 KB), focuses on `pld_tokenstr`, scans storage as fallback, and shows a Plaud Mirror alert for every outcome. Tests 144 → 145. This is now fallback only; v0.8.0 supersedes it as the recommended path.
- Previous Session Focus (v0.7.5 patch): friendly rejection for masked/redacted token pastes. Operator hit `Cannot convert argument to a ByteString because the character at index 7 has a value of 9679` while trying to save a Plaud token. Diagnosis: `9679` is `●`; index 7 is the first character after `Bearer `, so the pasted value was a masked/redacted token (`Bearer ●●●...`), not the real bearer. Fix: `saveAccessToken` now rejects mask characters and other header-unsafe token characters before constructing `PlaudClient` / the `Authorization` header, returning a clear 400 that tells the operator to copy the real Plaud `localStorage` token instead of a hidden/redacted field. Deploy follow-up: the Docker build hung in `npm prune --omit=dev`, so the Dockerfile now uses a separate `prod-deps` stage (`npm ci --omit=dev`) and copies production dependencies into the runtime image. Tests 143 → 144. Live dev-vm verified: container and `/api/health` report `0.7.5`, operator auth is armed, and `PLAUD_MIRROR_API_BASE=https://api-euc1.plaud.ai`. Earlier v0.7.4 below.
- Previous Session Focus (v0.7.4 patch): closed the PII/info-leak that v0.7.3 introduced, fixed stale comments. v0.7.3 put a slice of Plaud's response body into `PlaudApiError.message`, which flows into `auth.lastError` / `lastSync.error` / `lastErrors` — all on the PUBLIC `/api/health`. Reverted the message to generic (`... failed with HTTP <code>`); the body stays in `bodySnippet` and is surfaced ONLY on the authenticated `POST /api/auth/token` / `/api/connect/complete` response (operator still sees why a token was rejected, in the panel, without public exposure). Also fixed `plaud-token.ts` comments that still said "workspace token first". Tests 142 → 143. Dated 2026-06-13 per explicit operator request (commit + docs). Earlier v0.7.3 below.
- Previous Session Focus (v0.7.3 patch): fixed the persistent 403 on token validation (root cause: wrong token type + region). After the bookmarklet was fixed (v0.7.2), validating a captured token still 403'd. Diagnosis with the operator: (1) the account is **EU** — set `PLAUD_MIRROR_API_BASE=https://api-euc1.plaud.ai` (in Doppler `plaud-mirror/dev`); a US base 403s and the `-302` retry doesn't catch it. (2) the captured token was the **per-workspace token**, but `/user/me` (the mirror's validation endpoint) wants the **global user token** (`pld_tokenstr`) — 403 otherwise. Fix: `extractPlaudToken`/bookmarklet now prefer `pld_tokenstr` first, workspace token only as fallback (deliberate divergence from iiAtlas, documented in UPSTREAMS). Also: `saveAccessToken` strips quotes + `Bearer ` prefix from messy pastes, and `PlaudApiError` now includes Plaud's response body so a 403 explains itself in the panel (no more console archaeology). Tests 141 → 142. **Operator still needs to re-run the reconnect (or paste the clean `pld_tokenstr`) to finally validate** — the stored token is still the old degraded one. Earlier v0.7.2 below.
- Previous Session Focus (v0.7.2 patch): fixed the bookmarklet that did nothing (it was percent-encoded → silent syntax error). Operator reported "arrastro el marcador, lo pulso en Plaud, no pasa nada": `buildBookmarklet` wrapped the whole body in `encodeURIComponent`, so the browser ran percent-encoded text (`%7B`/`%28`) and silently syntax-errored. Now emits raw executable `javascript:` (origin single-quoted, no whole-body encode; regression-guarded in `plaud-token.test.ts`). Also: `window.open` null-check on "Reconectar Plaud" (was reporting success even when blocked), and a rewritten reconnect card — numbered Paso 1 (instalar: desktop Ctrl+Shift+B + drag / mobile copy) vs Paso 2 (usar), clicking the link now shows "arrástrame, no me pulses" instead of Chrome's javascript:-blocked error. The operator's earlier confusion (didn't know the bookmarks bar; clicked instead of dragging) drove the rewrite. 141 tests green. Operator still needs to run the (now working) reconnect to fix the Plaud token (degraded since 2026-05-13). Earlier v0.7.1 below.
- Previous Session Focus (v0.7.1 patch): UX fixes to the v0.7.0 re-auth flow from the operator's post-release audit. (1) Popup-blocker (medium): "Reconectar Plaud" now opens the app.plaud.ai tab synchronously in the click handler and mints the captureId in parallel — opening after `await` lost the user-gesture context and mobile/popup blockers rejected it, killing the "from the phone" path. (2) Added a "Copiar marcador (móvil)" button (Clipboard API + window.prompt fallback) since dragging to a bookmarks bar is desktop-only. No security-model change; capture-session handshake unchanged. Tests still 141. The operator still needs to actually run the reconnect to fix the Plaud token (degraded/403 since 2026-05-13). Prior-release focus below.
- Previous Session Focus (2026-06-11, v0.7.0): **Phase 4 entered: browser-assisted Plaud re-auth (D-019).** The operator's Plaud account is Google SSO, so it has no password and Plaud forbids adding one (`forgot-password` → "Account not found"); credentials-login is off the table for this account. The official partner API is enterprise-only; the official CLI/MCP is OAuth/browser and deferred-watch (its docs mention `presigned_url`, NOT disproven — do not claim it can't do audio). Chosen path: capture the bearer the browser already holds. New: `POST /api/connect/start` mints a single-use `captureId` (`CaptureSessionStore`, TTL 10 min); panel "Reconectar Plaud" stashes it in mirror `localStorage` and opens app.plaud.ai; a bookmarklet (extraction adapted from MIT `iiAtlas`, attributed in `apps/web/src/plaud-token.ts` + UPSTREAMS Phase 4) reads `pld_tokenstr`/workspace-token and bounces to `/connect#token=`; `ConnectPlaud` strips the fragment, reads the captureId, and `POST /api/connect/complete` consumes it (token-fixation defence) then validates+stores via `service.saveAccessToken`. Bearer lasts ~300 days → ~once-a-year tap. Manual paste stays as fallback; Telegram explicitly NOT a capture channel. Tests 130 → 141 (121 backend + 20 web). NOTE for next session: this is *assisted* capture, not unattended auto-renewal — full auto-login for an SSO account needs the official OAuth/MCP (deferred). Previous-day work below.
- Previous Session Focus (2026-06-11, v0.6.3 patch): operator's post-release audit of `b5c0028` confirmed C1/H1/H3 closed with no blockers and one low finding: `scripts/set-admin-passphrase.sh` toggled `stty -echo` without a trap, so a Ctrl-C mid-prompt could leave the terminal without echo. Fixed by saving the state (`stty -g`) and restoring via `trap` on EXIT/INT/TERM. No runtime change. The residual remains operational, not code: until the operator runs the helper and restarts with `doppler run --project plaud-mirror --config dev -- docker compose up -d`, the deployment stays open by backward-compatible design (visible in `health.warnings`); verify arming with a 401 on `/api/config` without cookie. Previous day's work below.
- Previous Session Focus (2026-06-10 - Claude Fable 5): **v0.6.0 — Phase 3 hardening release** driven by a same-day full-code security review (operator-confirmed findings C1/H1/H3). (1) **Operator access control (D-018, new):** the panel/API were exposed at `https://plaud.lamanoriega.com/` with zero auth; now `PLAUD_MIRROR_ADMIN_PASSPHRASE` gates every `/api/*` route behind a signed HttpOnly session cookie (30-day TTL; key derived from master key + passphrase so rotating either kills all sessions), new `apps/api/src/runtime/operator-auth.ts`, session routes (`GET /api/session`, `POST /api/session/login` with 5/min throttle, `POST /api/session/logout`), `LoginGate` in the panel, `auth.userSummary` redacted on unauthenticated `/api/health`. Backward compatible: unset = open + loud warning. **The operator still needs to add `PLAUD_MIRROR_ADMIN_PASSPHRASE` to `.env` on dev-vm to activate it** (env policy: agents do not write secrets). (2) **Startup crash recovery (D-013 amendment):** `initialize()` fails orphaned `running` sync runs (they deadlocked the anti-overlap guard permanently) and re-queues orphaned `delivering` outbox rows (`retry_waiting`, due now, attempts preserved — at-least-once accepted). (3) **Plaud client timeouts:** `AbortSignal.timeout` on every API call (30 s) and audio download (10 min). ROADMAP re-cut: Phase 3 = `0.5.x`–`0.6.x`, Phase 4 → `0.7.x`, Phase 5 → `0.8.x`, Phase 6 → `0.9.x+` (new section "Why Phase 3 Was Extended Through 0.6.x"). Tests 116 → 130 (116 backend + 14 web). Same session, separate commit: home-infra catalog got `environment: development` + `exposure.canonical: false` per ADR-0019 (commit `70d0bf9`). Follow-ups queued in Open Work: observability UI, scrypt KDF, Phase 4 spike of Plaud credentials login. **Closed same session as v0.6.1 (patch):** dockit-sync to LLM-DocKit 4.8.2 — new `scripts/test-validator.sh` (smoke suite 9/9), DF-039 read-only-skip + orientation glob filter merged into `scripts/dockit-validate-session.sh` while restoring the local guardrails the raw sync clobbered (`json-version` in bump/check scripts, `handoff-start-here-sync`, `prose-drift`, `unabsorbed-artifact`). Second clobber-on-sync occurrence — DF candidate for LLM-DocKit (`merge` strategy for extended scripts).
- Previous Session Focus (2026-05-14 - Claude Opus 4.7): Closing the pending LLM-DocKit 4.8 sync and infra-exposure docs left uncommitted by the 2026-05-13 Codex session, shipped here as patch release **v0.5.6** (governance/sync; no runtime change). The infra-exposure side landed earlier today as `cdelalama/home-infra` commit `dec374f` (`docs: expose plaud-mirror in infra catalog`), which registered Plaud Mirror in the catalog at the then-current v0.5.5; a follow-up bump of `home-infra/docs/PROJECTS.md` from v0.5.5 to v0.5.6 is owed alongside this release. The v0.5.6 bump itself was triggered by the pre-commit hook, since the dockit-sync output touches `scripts/*` and `.claude/settings.json` (versioned governance surface, same pattern as v0.5.4 and v0.5.5). The 2026-05-13 dockit-sync output stays intact (SessionStart hook in `.claude/settings.json`, new `scripts/dockit-bootstrap-context.sh`, extended `scripts/dockit-validate-session.sh`, yaml-merged `docs/version-sync-manifest.yml`, section-merged `LLM_START_HERE.md`); project-specific guardrails (`json-version`, D-016 `prose-drift`, D-017 `unabsorbed-artifact`) preserved through the sync. Earlier session focus preserved below for continuity.
- Previous Session Focus (2026-05-13 - Codex): Infra exposure + DocKit sync hygiene. `home-infra` is registering Plaud Mirror as an operator-visible service at `https://plaud.lamanoriega.com/` through NAS `edge-caddy` to the dev-vm backend `http://10.0.0.110:3040`. Local runtime was verified alive on dev-vm: `/api/health` returns version `0.5.5`, auth `healthy`, scheduler disabled, `recordingsCount: 345`, `plaudTotal: 391`, last sync completed at `2026-05-13T17:56:16.859Z`. LLM-DocKit upstream is `4.8.0`; this repo now has the 4.8 SessionStart hook and `scripts/dockit-bootstrap-context.sh`, while preserving project-specific `json-version`, `prose-drift` (D-016), and `unabsorbed-artifact` (D-017) guardrails that the upstream template does not carry.
- Previous Session Focus (2026-04-28 calendar tick): Single Q&A turn confirming the project sits in Phase 3 (`0.5.x`). Phase 3 runtime is feature-complete as of `v0.5.5` (continuous sync scheduler D-012, durable webhook outbox D-013, full health observability D-014); the Phase 3 exit gate ("multi-day unattended run on dev-vm with predictable recovery behavior" per ROADMAP) is **pending** — until a soak validates it, the project remains *in* Phase 3, not *past* it. Phase 4 (`0.6.x`, optional auto re-login) is explicitly deferred and may close as "rejected with rationale" if Plaud has no non-browser refresh path.
- Previous Session Focus (2026-04-27 release): `v0.5.5` ships **D-014 full** (full health observability) plus the two governance pieces planned in the morning's cross-session audit. New schema fields on `ServiceHealthSchema`: `lastErrors` (cross-subsystem ring buffer, in-memory, capped at 20 via `LAST_ERRORS_CAP`, most-recent-first) and `recentSyncRuns` (last 5 finished runs from SQLite via new `RuntimeStore.getRecentSyncRuns(limit)`, `finished_at DESC`). New `service.recordError(subsystem, message, context?)` is wired from three sources: `SchedulerManager.onTick` callback (failed ticks), `OutboxWorker.onDeliveryError` callback (both `retry` and `permanent` escalations), and the `service.runSync` catch path. The Phase 3 runtime surface is now feature-complete. Plus governance: `prose-drift` validator wrapper hardened from `WARN` to `FAIL` (one calibration release was sufficient — operator workflow is rephrase-or-baseline). New `check_unabsorbed_artifact()` ninth validator check (D-017) detects local scripts in `scripts/` and rules in `.claude/rules/` not present in `~/src/LLM-DocKit/scripts/` or `.claude/rules/`; baseline file (`scripts/.unabsorbed-artifact-baseline.json`) ships with three entries: `check-prose-drift.sh` transient with `df_id: DF-028`, `check-upstreams.sh` permanent project-specific, `external-context-triggers.md` permanent project-specific. Symmetric `forge audit` CLI lives in ForgeOS, not here. Tests 113 → 116 (102 → 105 backend + 11 web): ring buffer cap+ordering+cross-subsystem, sync-error feeds lastErrors, recentSyncRuns surfaces last 5. POSIX-shell bugs caught during script implementation (per D-017 "Revisions"): `$'\t'` ANSI-C quoting is bash-only (use `TAB=$(printf '\t')`); `grep -c X || echo 0` concatenates two zeros (use `grep X | wc -l`); sed-based JSON templating breaks on `/` literals in path strings (use Python3 read-modify-write).
- Previous Session Focus (2026-04-27 morning planning): cross-session audit with the ForgeOS-context Claude session refined the v0.5.5 scope to the three pieces shipped above, plus a post-Codex prose-drift sweep that closed eight semantic-drift sites the regex did not catch (current==current-version short-circuit). Empirical confirmation that Layer-1 catches mechanical drift but misses "deferred-to-later-version after current-version-bump" — Layer 2 (Optional Enhancement B of HOOKS_ENFORCEMENT_PROPOSAL) remains the closure path.
- Previous Session Focus (2026-04-26 release): `v0.5.4` shipped the **Layer-1 doc-drift enforcement** (D-016) after the same prose-drift class hit plaud-mirror six times in `0.5.x` despite four extensions to a passive auto-memory rule. New `scripts/check-prose-drift.sh` (POSIX sh, four rules, `--strict` / `--review` / `--update-baseline` modes, auditable baseline file with `transient_until` enforcement) is wired as the eighth validator check (`prose-drift`), `WARN` during this release, `FAIL` from v0.5.5. New global meta-rule in `~/.claude/CLAUDE.md` plus `~/.claude/hooks/check-passive-rule.sh` (PostToolUse matcher) nudges whenever a write lands in any project's auto-memory. New D-016 documents the regex-paliativo / semantic-agent two-layer cascade per `~/src/LLM-DocKit/docs/HOOKS_ENFORCEMENT_PROPOSAL.md` (RFC, draft). DF-028 written upstream to LLM-DocKit framing this episode as the first empirical demand for CE_V2 P0 ("Manifest = intención, CI = evidencia"). The script paid for itself: first run caught two real drifts (D-012 and D-014 stale `Status:` lines) — fixed before commit. D-014 full pushed to v0.5.5. Earlier session focus preserved below for continuity.
- Previous Session Focus (2026-04-26 doc-only follow-up): post-`v0.5.3` review caught D-013 + DEPLOY_PLAYBOOK drift; same-day fifth recurrence of the prose-drift class. Trigger for v0.5.4's enforcement layer.
- Session Focus (v0.5.3 release, 2026-04-26): `v0.5.3` ships the **durable webhook outbox** (D-013). Webhook delivery is decoupled from sync: each successfully-mirrored recording pushes its payload into a new `webhook_outbox` SQLite table with an explicit FSM (`pending → delivering → delivered | retry_waiting → permanently_failed`), and a dedicated `OutboxWorker` retries with exponential backoff (30s → 8h, 8 attempts, ~16h cumulative window) before escalating. The HMAC signature is recomputed at delivery time so a rotated `webhookSecret` is honoured for items still in the queue. New routes `GET /api/outbox` (failed list) and `POST /api/outbox/:id/retry`. New `health.outbox` block. New `SyncRunSummary.enqueued` counter; `delivered` keeps its original semantic and structurally stays at 0 from now on. Panel gets a new "Webhook outbox" card (counters + permanently-failed list + Retry button per row). Test count: 102 → 113 (102 backend + 11 web). Earlier session focus preserved below for continuity.
- Previous Session Focus (2026-04-26 doc sweep): same-day prose drift fix after the post-`v0.5.2` review.
- Session Focus (v0.5.2 release, 2026-04-25): `v0.5.2` adds **panel-driven scheduler configuration**. The user explicitly asked for the scheduler to be configurable from the UI ("no me interesa que esté en el .env"), so the scheduler interval moves from "env-var only" to "persisted in SQLite, settable via `PUT /api/config`, hot-applied with no restart." The env var is downgraded to a one-time seed for fresh installs. Tercer roadmap shift en `0.5.x`: outbox (D-013) → `v0.5.3`, full health (D-014) → `v0.5.4`.
- Status: `v0.5.2` shipped. Code: new module `apps/api/src/runtime/scheduler-manager.ts` with `SchedulerManager.applyInterval(ms)` (start / stop / swap-cadence in place, idempotent for unchanged values, throws below the 60 000 ms floor); `RuntimeConfig.schedulerIntervalMs` and `UpdateRuntimeConfigRequest.schedulerIntervalMs?` added to the shared schema (`.default(0)` so older clients still parse); `RuntimeStore.seedSchedulerDefaults(ms)` writes the env-var bootstrap value only when the SQLite row is absent; `RuntimeStore.saveConfig` accepts the new field and persists via the existing `settings` key/value table; `service.updateConfig` validates the floor at the request boundary (HTTP 400 for sub-floor positives), persists, then calls a new reconfigure hook so the live `Scheduler` is started / stopped / swapped via the manager; `service.setSchedulerReconfigureHook(fn)` mirrors `setSchedulerStatusProvider`; `apps/api/src/server.ts` now constructs a `SchedulerManager` unconditionally, wires both hooks, and applies the persisted interval after `service.initialize()` (env-var seed runs first); the inline `Scheduler` instantiation in `createApp` is gone. Web: new "Continuous sync scheduler" card on the Configuration tab with a live status block (state, interval, next/last tick, last reason) and a form (`Interval (minutes, 0 disables)`); helpers `formatSchedulerInput` / `parseSchedulerInput` round-trip minutes ↔ ms; `handleSaveScheduler` posts to `PUT /api/config { schedulerIntervalMs }`. Tests: 9 new (1 store round-trip + seed-only-once, 7 in the new `scheduler-manager.test.ts`, 1 service `updateConfig`). Test totals: **102** (91 backend + 11 web), up from 93 at `v0.5.1`. Doc sweep: CHANGELOG `[0.5.2]` filled (Added/Changed/Notes); ROADMAP "Current target" → `v0.5.2` and entry note rewritten to mention panel-driven config + push outbox to `v0.5.3` and full-health to `v0.5.4`; PROJECT_CONTEXT current-status rewritten to lead with the panel UX win; ARCHITECTURE status header + "What Phase 3 Adds" / "Continuous sync scheduler" / "Next Architectural Step" all updated to describe the SchedulerManager + SQLite-as-source-of-truth flow + the env var as a one-time seed; AUTH_AND_SYNC env-var matrix replaced with a unified value matrix that applies regardless of source (panel or seed) plus an explicit "to take an existing install back to disabled, set the value to 0 in the panel — removing the env var no longer changes anything" warning; API_CONTRACT route table + `PUT /api/config` example + Phase Boundary Note all updated; HOW_TO_USE "Configuring the scheduler" rewritten to lead with panel steps and demote env-var to "Optional: bootstrap from the env var" subsection; test count bumped to 102 with breakdown. HANDOFF / LLM_START_HERE kept in sync. Next session: `v0.5.3` for the durable webhook outbox per D-013.

## What Landed

- `apps/api` now serves the admin API and the built web panel.
- `apps/web` now contains the product panel for token setup, webhook config, sync/backfill controls, and recordings visibility.
- Secrets now persist encrypted at rest via `PLAUD_MIRROR_MASTER_KEY`.
- Runtime state now persists in SQLite.
- Docker launch path now exists via `Dockerfile` and `compose.yml`.
- Docker now supports build/runtime base-image overrides via `PLAUD_MIRROR_DOCKER_BUILD_IMAGE` and `PLAUD_MIRROR_DOCKER_RUNTIME_IMAGE`, so this `dev-vm` can substitute another locally cached Node base when Docker Hub is flaky. The default remains `node:20-bookworm-slim`; pentesting distributions (e.g. `vxcontrol/kali-linux`) are explicitly not an acceptable substitute.
- The fallback Docker path now avoids `apt` entirely and builds with `corepack npm`, which removes the network dependency on distro package mirrors during image build.
- The Phase 2 container has now been built and started successfully on `dev-vm`; the service is reachable on port `3040` and reports the expected "missing token" health state.
- The Phase 1 spike now measures download byte count from the written file, not only `content-length`.
- `docs/ROADMAP.md` now defines the phases explicitly so Phase 2 and Phase 3 do not blur together again.
- The container now runs as non-root (`USER 1000:1000`); bind-mounted directories under `./runtime/` no longer end up root-owned on the host. `compose.yml` also pins `user: "1000:1000"` for explicitness.
- The previous Kali-based Docker fallback recommendation was removed from "Next Session". Kali was only cached on `dev-vm` because of an unrelated project; using a pentesting distribution as a Node runtime base inflates the attack surface and is not an appropriate posture for this service. Acceptable fallbacks are listed in "Next Session" below.
- **Local curation feature set (v0.4.0):** per the owner's request, the web panel now exposes an inline `<audio>` player per mirrored recording (streamed from `GET /api/recordings/:id/audio`), a "Delete local mirror" button with a confirmation dialog, and a "Show dismissed" toggle that reveals dismissed rows with a "Restore" action. Dismiss is **local-only by design** (per D-001 audio-first scope and the conservative posture on upstream mutation): it unlinks the local audio file, clears `localPath`/`bytesWritten`, and sets `dismissed=true` on the SQLite row so future sync/backfill runs skip it. Plaud itself is never called for deletion. Restore clears the flag. Recording ids are validated against a strict allowlist and the resolved audio path is confirmed to stay within the configured recordings directory, so the new streaming route is not a path-traversal vector. Migration is additive (pre-0.4.0 databases gain the `dismissed` and `dismissed_at` columns via `ALTER TABLE` at startup).

## Docker Incident Summary

The Docker failure on `dev-vm` was a chain, not a single bug:

1. The normal base image path (`node:20-bookworm-slim`) failed because Docker Hub blob pulls timed out.
2. A local-image fallback was added with `vxcontrol/kali-linux:latest`, but the first implementation still used `apt-get install npm ...` during the image build.
3. That meant the fallback still depended on network access, this time to Kali package mirrors, and those mirrors also timed out.
4. After removing the `apt` dependency, the build exposed a second problem: the fallback image already had `node` and `corepack`, but not a standalone `npm` binary on `PATH`.
5. Some build steps still invoked scripts that called `npm` internally, so the image build failed even though `corepack npm` itself worked.

The effective fix in [Dockerfile](../../Dockerfile) was:

- keep build/runtime base-image override support,
- stop installing `npm` through `apt`,
- use `corepack npm` directly in the container build,
- call runtime and web builds directly instead of routing through nested scripts that expect `npm` on `PATH`.

This is now verified on the actual `dev-vm`, not assumed.

## Verified Runtime State

- Container `plaud-mirror-plaud-mirror-1` is up and Docker healthy on `dev-vm`, port `3040` bound, running Plaud Mirror 0.13.1 from source `d00ca3e`.
- `GET /api/health` returns `200` with auth healthy against the EU Plaud API, PT15M enabled, `warnings: []`, empty outbox, no active run, and exact coverage `{ remoteTotal: 627, mirrored: 627, dismissed: 0, missing: 0, localOnly: 0, upstreamDeleted: 1 }` after scheduled run `4bc81d89-cb60-44bc-a0b5-02e3aaba0094`.
- `GET /api/protocol/sync-jobs/plaud-mirror-recordings-sync/status` returns `version: "0.13.1"`, a future scheduler-owned `next_run_at`, `condition: "ok"`, `severity: "none"`, and summary "Plaud Mirror sync ok: 627/627 recording(s) mirrored." The historical deletion is reported separately as a confirmed local tombstone.
- SQLite contains one current generation with 627 physically verified artifact rows plus one historical tombstone. `PRAGMA integrity_check` is `ok`; the pre-deploy backup is `runtime/data/app.db.backup-20260716T195327Z-v0131-pre-shutdown-hardening`.
- Home Infra 0.6.10 input release 015d7ee is synchronized to NAS. Infra Portal 0.20.2 provenance reports Home Infra 015d7ee and Plaud Mirror `d00ca3e` with no warnings; the Plaud observation is current `ok/none` at 627/627, not stale, and carries `nextRunAt`.
- Bearer token saved via the web UI, auth validated with `/user/me`, encrypted at rest, survives restarts.
- Manual sync and filtered backfill exercised against live Plaud. Latest confirmed sync run `5a970a84-3f44-4602-b727-3d1d12179349` examined 514 Plaud recordings, matched/downloaded 165 missing local audio files, skipped webhook enqueue because no webhook is configured, and completed without error; `plaudTotal` + stable `#N` ranks populate correctly.
- Device catalog populates after sync via `/device/list`; the backfill selector renders operator nicknames.
- `GET /api/backfill/candidates` returns annotated dry-run results against the live account (`state: "missing" | "mirrored" | "dismissed"`).
- Inline audio playback via `<audio>` + HTTP Range works from the library.
- Async sync (`POST /api/sync/run` → `202 → GET /api/sync/runs/:id` polling) verified: the panel surfaces `downloaded X of Y` live while a run is in flight.
- Persistent paths: `runtime/data` (SQLite + encrypted secrets) and `runtime/recordings` (audio artifacts).

## What Is Still Not Verified

- **Real webhook delivery against a live downstream receiver.** No webhook URL has been configured in this environment yet; all recordings carry `lastWebhookStatus: "skipped"` because the service short-circuits when no URL is set. Once a receiver exists, confirm HMAC signature verification and persisted delivery attempts end-to-end.
- **Post-v0.13.0 multi-day scheduler behavior.** Earlier PT15M soak evidence remains useful, but this protocol release restarted the container. Accumulate another 3-5 days of clean `recentSyncRuns`, Docker health, exact coverage, outbox counters, Portal freshness, and honest next-run advancement before closing the current soak gate.
- **Durable webhook outbox.** Shipped in `v0.5.3` with 11 deterministic tests (FSM transitions, atomic claim, exponential backoff, monotonic `deliveryAttempt`, `MAX_ATTEMPTS` escalation, unconfigured-webhook escalation, HTTP shape including 400 / 404 / 409 guards). Pending: a live multi-day soak run that exercises a real downstream — every test path uses an injected `webhookFetchImpl`.
- **Full health observability — surfaced in v0.9.0.** `/api/health` returns `lastErrors` (cross-subsystem ring buffer, capped at 20) and `recentSyncRuns` (last 5 finished runs), and the redesigned panel now renders those signals in Main/Operations. Pending: a live multi-subsystem failure exercise to verify all three error sources (scheduler tick failure, outbox delivery escalation, sync run failure) feed the buffer in production.
- **Fully unattended SSO renewal.** Browser-assisted re-auth exists, but no background OAuth/MCP auto-renewal has been implemented.
- **Older pre-v0.10.1 sync rows may still carry the old webhook-skipped counter.** The operator-reported latest row was corrected from `skipped=21` to `skipped=0` after backup, but the broader historical table was not mass-migrated.
- **Authenticated operator-device visual smoke.** Automated desktop/mobile v0.12.0 captures verified the pending deletion row, retry-only action, normal Restore/Delete actions, contrast, wrapping, and no overlap. A human pass on the real authenticated monitor and phone remains useful for playback, scrolling, and device-specific interaction.
- **Multi-day stability.** The service has been restarted many times across sessions; no long uninterrupted run has been measured.

## Roadmap Boundary

- The project has **entered Phase 5 at `0.10.0`** per [docs/ROADMAP.md](../ROADMAP.md), specifically for infra/protocol integration: Plaud Mirror now publishes a Home Infra Protocol project contract and sync-job status snapshot. This is not NAS migration yet, and it does not close the Phase 3 soak.
- Phase 5 is `0.10.x` (Home Infra Protocol integration, deployment hardening,
  backups, rollback, NAS validation). Phase 6 is `0.11.x+` (deliberate operator
  workflows, provider-neutral optional transcription integration, and public
  OSS polish). Do not treat protocol adoption as proof that the service
  has been migrated to NAS; the runtime still runs on dev-vm until the NAS
  rollout slice.
- Working-tree cleanliness and validator status are not asserted here — they age badly. Run `git status` and `scripts/dockit-validate-session.sh --human` for the current fact.

## Open Work

- **Transcription provider conformance gate (D-023, v0.14.0 source):** the
  producer changes requested in D-022 are implemented in Plaud Mirror's own
  neutral contract and runtime. No live provider is configured. Media2Text must
  expose the exact capabilities/admission/status surface in `docs/contracts/`,
  then pass one authenticated canary including hash/length verification,
  signed terminal callback, pull reconciliation, duplicate replay, conflict
  handling, and terminal lease release. Only a separate operator GO may enable
  the destination or start historical batches.
- **Adapt the D-019 capture path to Plaud's first-party token model (queued 2026-07-13; do NOT start mid-soak):** when `pld_tokenstr` is absent, the Chrome extension should capture the `pld_ut`/`pld_urt` cookie pair (via the `chrome.cookies` API) and the backend should learn the mint/refresh lifecycle (`POST /user-app/auth/workspace/token/{id}`, `POST /auth/refresh-user-token` — endpoint facts from MIT applaud v0.5.11; see the D-019 amendment). Storing a refresh token pulls the scrypt KDF upgrade (H2, below) into the same slice. Upside: first credible fully-unattended renewal path for the Google-SSO account.
- **D-018 ARMED (2026-06-11).** The operator stored the passphrase via `scripts/set-admin-passphrase.sh` (Doppler `plaud-mirror/dev` in the secondary "Startup Embassy" account; repo dir scoped via `doppler login --scope ~/src/plaud-mirror`; multi-account convention in `~/src/home-infra/docs/CONVENTIONS.md`) and restarted with the doppler-wrapped `up -d`. Verified: `/api/session` → `authRequired: true`, `/api/config` and audio routes → 401 without cookie (local AND through `https://plaud.lamanoriega.com/`), `userSummary` redacted, access-control warning gone from `health.warnings`, panel login works. **Operational rule from now on: every container recreate must be `doppler run --project plaud-mirror --config dev -- docker compose up -d`** — a bare `up -d` disarms the lock (see DEPLOY_PLAYBOOK). Optional future hardening: a gitignored compose override file on this host making the env var required.
- File downstream feedback to LLM-DocKit about the clobber-on-sync pattern: `dockit-sync --apply` overwrites scripts that carry local extensions (`copy` strategy), forcing a manual re-merge every sync (happened 2026-05-13, 2026-06-10 with v0.6.1, 2026-06-18 before v0.9.3, and again during the v0.9.6 sync on 2026-06-19). Proposal: a `merge`/`copy-with-markers` strategy for `scripts/dockit-validate-session.sh` and version scripts, or upstream absorption of the local checks (DF-028 already covers `scripts/check-prose-drift.sh`).
- Home Infra Protocol adoption is registered: `~/src/home-infra/catalog/project-contracts.yml` lists `plaud-mirror`, the NAS portal inputs include a bundled Plaud Mirror contract copy, and Infra Portal reads `plaud-mirror-recordings-sync` from `/api/sync-jobs`.
- Protocol status is current at 627/627 with `condition=ok`, zero missing, and one confirmed upstream tombstone outside the current remote total. Do not mass-backfill older `skipped` counters without a separate data-repair decision.
- Operator visual-smoke `v0.9.5+`: runtime is deployed and health-verified; open the panel in the operator browser and verify Main, Library, Backfill, Configuration, Operations, ES/EN switching, phone width, reconnect copy, Operations outbox/errors, especially that desktop still uses the full viewport, Main labels `Descargar N` / `Download N`, Compact Play starts audio, Full mode uses a wide player, Library pages scroll, mobile navigation has the labeled selector, mobile status uses one compact chip row, and Library mobile actions stay top-right.
- Scrypt KDF upgrade for `data/secrets.enc` (H2 from the 2026-06-10 review): replace `sha256(masterKey)` with scrypt + persisted salt. Deprioritized behind the items above while the master key is strong/random.
- Re-auth path status: the operator has already verified the Chrome extension path and the backend is healthy on the EU base after the v0.8.1 fingerprint fix. Re-test only after extension/auth code changes or after Plaud frontend/API drift.
- Phase 3 exit remains a live soak, not documentation: the scheduler is already PT15M and coverage is 627/627 with missing 0. Observe `/api/health` and Infra Portal for 3-5 days after the v0.13.1 restart, then record the result in `docs/llm/HISTORY.md`.

## Governance Cleanup Landed in 0.4.1

The six items GPT-5 flagged in the 2026-04-23 review are closed:

1. **Roadmap/phase boundary** — `docs/ROADMAP.md` now explicitly covers Phase 2 across `0.3.x` and `0.4.x`; every later phase shifts by one minor so Phase 3 is `0.5.x`, Phase 4 is `0.6.x`, Phase 5 is `0.7.x`, Phase 6 is `0.8.x+`. SemVer stays authoritative over phase labels and the "Why Phase 2 Was Extended Through 0.4.x" note captures the reasoning.
2. **README Kali recommendation** — removed. The README now lists only generic acceptable fallbacks (locally cached slim/alpine, `docker save`/`docker load`, or a pull-through registry mirror) and explicitly rejects `vxcontrol/kali-linux:latest` as a Node runtime base.
3. **CHANGELOG narratives** — `0.3.2` and `0.4.0` entries are now filled with real user-visible bullets instead of header-only skeletons.
4. **Stale drift claim** — the "Roadmap and Drift Status" block in this handoff was replaced with a shorter "Roadmap Boundary" block that does not assert working-tree cleanliness. `git status` and the validator are the source of truth for that.
5. **Stable docs prose refresh** — `docs/PROJECT_CONTEXT.md` and `docs/ARCHITECTURE.md` no longer cite `v0.3.0` in prose; both reflect the current `v0.4.1` state including local curation.
6. **Hero metric fix** — `apps/web/src/App.tsx` now reads `health?.recordingsCount` for the hero "Recordings" metric, falling back to the paginated array length only if health has not loaded yet. This is the only code change in `0.4.1`.

## Top Priorities

0. ~~Arm operator access control~~ — DONE 2026-06-11. ~~Re-validate the Plaud bearer token~~ — DONE 2026-06-16 after Chrome extension capture + EU base + Plaud Web request fingerprint; `/api/health` reported `auth.state: healthy`.
1. ~~Publish and deploy `v0.12.0` with a consistent SQLite backup and verify
   exact coverage plus legacy tombstone migration without another destructive
   call.~~ Done 2026-07-16 from clean source `8df5c35`; Home Infra 0.6.6 and
   live Portal provenance are reconciled.
2. Observe the post-deploy PT15M runtime for 3-5 days through `recentSyncRuns`,
   scheduler status, Docker health, outbox counters, and Infra Portal freshness;
   then run the live webhook drill before claiming the Phase 3 exit gate.
3. Publish v0.14.0 source without deploying it. Give Media2Text the
   Plaud-owned Transcription Intake v1 contract and require provider
   conformance rather than importing Media2Text code or coupling to its repo.
4. After the Phase 3 gate and a conforming provider, authorize exactly one live
   canary. Bulk replay remains a later explicit GO. Keep D-019 cookie/refresh
   adaptation plus scrypt as the next auth hardening slice.

## Open Questions

- What retry and scheduler defaults are safe enough for Phase 3?
- Can fully unattended Google-SSO renewal be implemented through Plaud's official OAuth/MCP without losing audio-first local mirroring?
- If `scene` filtering turns out to be useful with real operator experience, how would we surface it? A smart dropdown of scene values observed in the account (via `SELECT DISTINCT scene FROM recordings`) is one option; another is discovering a Plaud-provided mapping of scene numbers to human labels.

## Confirmed Product Direction

- First deployment target is `dev-vm`; NAS comes later.
- The first usable release must include a small product-style web panel.
- Manual bearer-token auth is acceptable first, but it must be encrypted at rest and survive restarts.
- Historical backfill is required from day 1.
- Generic notifications stay on the existing webhook; transcription admission
  is a separate optional destination type.
- Plaud recordings are the first live transcription source. Success means
  exact reconciliation from eligible Plaud artifact revisions through a
  conforming provider's terminal state, not merely successful HTTP delivery.
- Plaud Mirror remains independently useful and publishable. Media2Text is the
  first intended provider, not a runtime dependency; Cortex remains downstream
  of transcript-ready output.
- Fully unattended re-login stays on the roadmap, but the `0.7.x`-`0.9.x` Phase 4 line deliberately solved the operator-facing refresh path and cockpit through browser-assisted capture plus the redesigned panel.

## Roadmap Pointer

Use [docs/ROADMAP.md](../ROADMAP.md) as the source of truth. The important boundary is:

- **Phase 2:** usable manual slice with UI + Docker
- **Phase 3:** unattended operation and resilience

Do not collapse those phases casually.

## Next Session

- The stack is deployed at v0.13.1 from clean source `d00ca3e`. Rebuild only with
  `doppler run --project plaud-mirror --config dev -- docker compose up -d --build`.
- Do not deploy v0.14.0, enable a transcription destination, run a canary, or
  start replay while v0.13.1's soak is being preserved. After publication,
  wait for provider conformance and a separate operator GO.
- If Docker Hub pulls time out on `dev-vm`, the Dockerfile still accepts `PLAUD_MIRROR_DOCKER_BUILD_IMAGE` and `PLAUD_MIRROR_DOCKER_RUNTIME_IMAGE` build-arg overrides. Valid fallbacks: a locally cached Node slim/alpine image from another project, a home-infra-local registry mirror (see the open registry-mirror item in `~/src/home-infra/docs/PROJECTS.md`), or a side-loaded `node:20-bookworm-slim` via `docker save`/`docker load`. Do **not** substitute a pentesting distribution such as `vxcontrol/kali-linux:latest` — it inflates the attack surface, bloats the image, and ships tooling that has no place in a Plaud mirror's runtime.
- Verify the protocol status endpoint during the soak:
  `curl -fsS http://127.0.0.1:3040/api/protocol/sync-jobs/plaud-mirror-recordings-sync/status`
- Desktop and Android captures for the dismissed-only permanent-delete row are
  stored in `docs/visual-gates/0.11.0/`. Continue the broader human visual smoke
  when using the real operator devices. Re-auth through the Chrome extension
  only if Plaud auth drifts out of `healthy` (manual paste fallback).
- Run a filtered backfill from the panel.
- Inspect:
  - `/api/health`
  - `runtime/recordings/<recording-id>/metadata.json`
  - webhook receiver logs
- Record the live findings before closing Phase 3.

## Testing Notes

- `npm test` passes, including:
  - shared schema tests
  - Plaud client tests
  - Phase 1 spike tests
  - encrypted-secret/store/service/server tests
  - built API/web integration smoke tests
- Current `v0.14.0` source total is 206 runtime tests (174 Node/integration +
  32 web), reproduced by the root suite. The new tests cover the neutral
  contract, encrypted destination secrets, durable admission/status state,
  artifact auth and Range delivery, crash recovery, idempotency conflicts,
  exact coverage beyond 1,000 recordings, HTTP credential separation, and a
  provider-neutral panel. Governance checks report
  `scripts/dockit-validate-session.sh --human` passes all 12 checks with the
  expected external-trigger warning (sibling docs are intentionally deferred
  until an authorized deployment),
  `scripts/check-version-sync.sh` 23 targets, and
  `scripts/test-validator.sh` 32/32 smoke cases.
- A read-only SHA-256 benchmark over 100 real audio artifacts processed
  1,411,854,536 bytes in 62.60 seconds (about 22.6 MB/s) with low I/O/CPU
  priority. The current 8,991,884,414-byte corpus is therefore a bounded
  minutes-scale hash backfill; no Plaud re-download or runtime mutation is
  required. Automated browser gates at 1440x1000 and 390x844 verified the new
  configured/add-destination states, zero horizontal overflow, labelled form
  controls, keyboard tabs, and 44 px mobile integration targets.
- Docker packaging includes a local-base fallback for this `dev-vm`; always verify the live `/api/health.version` after a Doppler-wrapped compose rebuild instead of trusting an older handoff snapshot.
- Live Plaud re-auth through the Chrome extension still requires the operator's Chrome/Plaud session and cannot be completed by an agent without those browser credentials; the operator confirmed it healthy before this UI redesign.

## Trace Anchor

- Role: executor
- Subject: Prepare provider-neutral Transcription Intake v1
- Release target: Plaud Mirror 0.14.0 source; deployment remains 0.13.1.
- Commit: release `c4310ac`.
- Release commit subject: feat: add provider-neutral transcription intake
- Release commit time: 2026-07-16 23:38:15 UTC
- Repo state: source published; no deploy, restart, destination enable,
  canary, replay, or sibling-repository edit occurred.
- Validation: 206/206 tests, build/typecheck, contract JSON, dependency audits,
  version 23/23, validator 32/32, DocKit PASS across 12 checks with the expected
  deferred-sibling warning, diff check, 100-file hash benchmark, and
  desktop/mobile browser gates pass.
- Next gate: publish the clean source while preserving the 0.13.1 soak, then
  require an independent provider to conform to `docs/contracts/`. Only a
  separate operator GO may enable one destination and send one live canary;
  historical replay remains a later explicit gate.

## Key Decisions (Links)

- D-001: audio-first mirror
- D-002: server-first with web UI
- D-003: manual token first, automatic re-login later
- D-004: upstream-watch is mandatory
- D-005: conservative license boundary
- D-006: recording ID is the canonical local key
- D-007: composite reuse strategy
- D-008: critical auth/download path stays auditable in-repo
- D-009: operator-only TOS posture
- D-010: roadmap phases are normative
- D-011: API facts discovered in AGPL upstreams may be adopted; AGPL code may not
- D-012: continuous sync scheduler runs in-process with anti-overlap protection
- D-013: webhook outbox is a separate SQLite table with explicit state transitions (amended v0.6.0: startup crash recovery, at-least-once)
- D-014: health endpoint surfaces operational state, not just configuration state
- D-015: UI tests use Vitest + jsdom + @testing-library/react
- D-016: doc-drift enforcement is layered (regex now, semantic agent later)
- D-017: unabsorbed-artifact detection is local; `forge audit` lives in ForgeOS
- D-018: operator access control is app-level (passphrase + signed session cookie)
- D-019: browser-assisted bearer capture is the Phase 4 re-auth provider
- D-020: Plaud recording sync publishes a Home Infra Protocol contract/status surface
- D-021: permanent Plaud deletion is an explicit post-dismiss operator command
- D-022: Plaud-first Media2Text integration requires closed-loop intake reconciliation
- D-023: Transcription Intake is provider-neutral and optional

## Do Not Touch

- `config/upstreams.tsv` without documenting the baseline change
- `docs/UPSTREAMS.md` licensing boundaries without explicit user approval
- `.dockit-config.yml` external-context paths unless the infra-doc repo moved
