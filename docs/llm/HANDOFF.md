<!-- doc-version: 0.7.1 -->
# LLM Work Handoff

This file is the live operational snapshot. Durable rationale lives in `docs/llm/DECISIONS.md`. Phase boundaries live in `docs/ROADMAP.md`.

## Current Status

- Last Updated: 2026-06-12 - Claude Fable 5
- Session Focus: **v0.7.1 (patch) — UX fixes to the v0.7.0 re-auth flow** from the operator's post-release audit. (1) Popup-blocker (medium): "Reconectar Plaud" now opens the app.plaud.ai tab synchronously in the click handler and mints the captureId in parallel — opening after `await` lost the user-gesture context and mobile/popup blockers rejected it, killing the "from the phone" path. (2) Added a "Copiar marcador (móvil)" button (Clipboard API + window.prompt fallback) since dragging to a bookmarks bar is desktop-only. No security-model change; capture-session handshake unchanged. Tests still 141. The operator still needs to actually run the reconnect to fix the Plaud token (degraded/403 since 2026-05-13). Prior-release focus below.
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

- Container `plaud-mirror-plaud-mirror-1` is up on `dev-vm`, port `3040` bound, running as `USER 1000:1000`.
- `GET /api/health` returns `200` with `{ version: "0.5.5", auth.state: "healthy" }` against the operator's real Plaud account. The `scheduler`, `outbox`, `lastErrors`, and `recentSyncRuns` blocks are present in every response. Current live check on 2026-05-13: scheduler disabled, `recordingsCount: 345`, `dismissedCount: 0`, `plaudTotal: 391`, last sync completed at `2026-05-13T17:56:16.859Z`.
- Bearer token saved via the web UI, auth validated with `/user/me`, encrypted at rest, survives restarts.
- Manual sync and filtered backfill exercised against live Plaud. Latest confirmed state: 308 recordings in the account total, 215+ mirrored locally, `plaudTotal` + stable `#N` ranks populating correctly.
- Device catalog populates after sync via `/device/list`; the backfill selector renders operator nicknames.
- `GET /api/backfill/candidates` returns annotated dry-run results against the live account (`state: "missing" | "mirrored" | "dismissed"`).
- Inline audio playback via `<audio>` + HTTP Range works from the library.
- Async sync (`POST /api/sync/run` → `202 → GET /api/sync/runs/:id` polling) verified: the panel surfaces `downloaded X of Y` live while a run is in flight.
- Persistent paths: `runtime/data` (SQLite + encrypted secrets) and `runtime/recordings` (audio artifacts).

## What Is Still Not Verified

- **Real webhook delivery against a live downstream receiver.** No webhook URL has been configured in this environment yet; all recordings carry `lastWebhookStatus: "skipped"` because the service short-circuits when no URL is set. Once a receiver exists, confirm HMAC signature verification and persisted delivery attempts end-to-end.
- **Multi-day scheduler-driven unattended behavior.** The scheduler ships in `v0.5.0` (regressed), `v0.5.1` (regressions fixed), and `v0.5.2` (panel-driven config). Backed by 18 deterministic tests across `scheduler.test.ts`, `scheduler-manager.test.ts`, `environment.test.ts`, and the relevant `service.test.ts` cases, but no live multi-day soak run has been measured yet. Once an operator sets a non-zero interval from the panel, observe the `health.scheduler` block over several ticks before declaring "unattended on `dev-vm` works."
- **Durable webhook outbox.** Shipped in `v0.5.3` with 11 deterministic tests (FSM transitions, atomic claim, exponential backoff, monotonic `deliveryAttempt`, `MAX_ATTEMPTS` escalation, unconfigured-webhook escalation, HTTP shape including 400 / 404 / 409 guards). Pending: a live multi-day soak run that exercises a real downstream — every test path uses an injected `webhookFetchImpl`.
- **Full health observability — shipped in v0.5.5.** `/api/health` returns `lastErrors` (cross-subsystem ring buffer, capped at 20) and `recentSyncRuns` (last 5 finished runs). Pending: a live multi-subsystem failure exercise to verify all three error sources (scheduler tick failure, outbox delivery escalation, sync run failure) feed the buffer in production.
- **Automatic re-login.** Phase 4. No code yet.
- **Multi-day stability.** The service has been restarted many times across sessions; no long uninterrupted run has been measured.

## Roadmap Boundary

- The project is in **Phase 3, extended through `0.6.x`** per [docs/ROADMAP.md](../ROADMAP.md) ("Why Phase 3 Was Extended Through 0.6.x"). The `0.5.x` line delivered the feature surface (scheduler D-012, outbox D-013, health D-014, governance D-016/D-017); `v0.6.0` (this release) delivers the hardening the security review demanded (operator auth D-018, crash recovery, timeouts). Remaining Phase 3: observability UI in the panel, scrypt KDF upgrade, then the multi-day soak that closes the phase.
- Phase 4 (`0.7.x`) scope is still untouched: no automatic re-login, no resumable backfill, no NAS validation, no public OSS polish. The Plaud-login spike must NOT ride along with 0.6.x work (operator decision 2026-06-10).
- Working-tree cleanliness and validator status are not asserted here — they age badly. Run `git status` and `scripts/dockit-validate-session.sh --human` for the current fact.

## Open Work

- **D-018 ARMED (2026-06-11).** The operator stored the passphrase via `scripts/set-admin-passphrase.sh` (Doppler `plaud-mirror/dev` in the secondary "Startup Embassy" account; repo dir scoped via `doppler login --scope ~/src/plaud-mirror`; multi-account convention in `~/src/home-infra/docs/CONVENTIONS.md`) and restarted with the doppler-wrapped `up -d`. Verified: `/api/session` → `authRequired: true`, `/api/config` and audio routes → 401 without cookie (local AND through `https://plaud.lamanoriega.com/`), `userSummary` redacted, access-control warning gone from `health.warnings`, panel login works. **Operational rule from now on: every container recreate must be `doppler run --project plaud-mirror --config dev -- docker compose up -d`** — a bare `up -d` disarms the lock (see DEPLOY_PLAYBOOK). Optional future hardening: a gitignored compose override file on this host making the env var required.
- File downstream feedback to LLM-DocKit about the clobber-on-sync pattern: `dockit-sync --apply` overwrites scripts that carry local extensions (`copy` strategy), forcing a manual re-merge every sync (happened 2026-05-13 and again 2026-06-10 with v0.6.1). Proposal: a `merge`/`copy-with-markers` strategy for `scripts/dockit-validate-session.sh` and version scripts, or upstream absorption of the local checks (DF-028 already covers `scripts/check-prose-drift.sh`).
- Observability UI (next 0.6.x increment): render `health.warnings`, `lastErrors`, and `recentSyncRuns` in the panel — the backend emits them since v0.5.5 but the operator can only see them via curl today. Include a prominent auth-failure banner on the Main tab (`auth.state` invalid/degraded) with a direct path to the token form.
- Scrypt KDF upgrade for `data/secrets.enc` (H2 from the 2026-06-10 review): replace `sha256(masterKey)` with scrypt + persisted salt. Deprioritized behind the items above while the master key is strong/random.
- Phase 4 spike (own session, `0.7.x`): Plaud credentials login without a browser. Evidence it exists: `JamesStuder/Plaud_API` / `Plaud_BulkDownloader` (MIT) authenticate with username+password directly — read their login route, test against the operator's account, then implement-or-reject per D-003.
- Phase 3 exit remains a live soak, not documentation: configure the scheduler from the panel, observe `/api/health`, and record the result in `docs/llm/HISTORY.md`.

## Governance Cleanup Landed in 0.4.1

The six items GPT-5 flagged in the 2026-04-23 review are closed:

1. **Roadmap/phase boundary** — `docs/ROADMAP.md` now explicitly covers Phase 2 across `0.3.x` and `0.4.x`; every later phase shifts by one minor so Phase 3 is `0.5.x`, Phase 4 is `0.6.x`, Phase 5 is `0.7.x`, Phase 6 is `0.8.x+`. SemVer stays authoritative over phase labels and the "Why Phase 2 Was Extended Through 0.4.x" note captures the reasoning.
2. **README Kali recommendation** — removed. The README now lists only generic acceptable fallbacks (locally cached slim/alpine, `docker save`/`docker load`, or a pull-through registry mirror) and explicitly rejects `vxcontrol/kali-linux:latest` as a Node runtime base.
3. **CHANGELOG narratives** — `0.3.2` and `0.4.0` entries are now filled with real user-visible bullets instead of header-only skeletons.
4. **Stale drift claim** — the "Roadmap and Drift Status" block in this handoff was replaced with a shorter "Roadmap Boundary" block that does not assert working-tree cleanliness. `git status` and the validator are the source of truth for that.
5. **Stable docs prose refresh** — `docs/PROJECT_CONTEXT.md` and `docs/ARCHITECTURE.md` no longer cite `v0.3.0` in prose; both reflect the current `v0.4.1` state including local curation.
6. **Hero metric fix** — `apps/web/src/App.tsx` now reads `health?.recordingsCount` for the hero "Recordings" metric, falling back to the paginated array length only if health has not loaded yet. This is the only code change in `0.4.1`.

## Top Priorities

0. ~~Arm operator access control~~ — DONE 2026-06-11. **Re-validate the Plaud bearer token** — `auth.state` has been `degraded` (HTTP 403) since 2026-05-13; nothing syncs until it is replaced. Easiest path now (v0.7.0): Configuration tab → install the "Reconectar Plaud Mirror" bookmarklet once (drag to bookmarks bar / mobile: save bookmark + paste its address), then "Reconectar Plaud" → log into Plaud (Google) → tap the bookmarklet. Verify `auth.state` flips to `healthy`. (Manual paste still works as fallback.)
1. Live-soak the durable outbox: configure a real webhook URL, run sync, watch `/api/health.outbox` counters move from `pending → 0` and the audit-log `webhook_deliveries` rows fill in.
2. Live-soak the scheduler from the panel: set 15 min, observe `health.scheduler.lastTickAt` advancing for several ticks, confirm a manual sync mid-tick is recorded as `lastTickStatus = "skipped"` with a useful `lastTickError` reason.
3. Inject a deliberate downstream failure (point the webhook at a 503 endpoint) and verify the backoff schedule + permanent-fail escalation + Retry-from-panel UX all behave as documented.
4. Multi-day soak run on `dev-vm` to verify the full Phase 3 runtime: scheduler ticks for several days, exercise an outbox failure (point at a 503 endpoint), confirm `lastErrors` populates from all three subsystems (scheduler/outbox/sync), confirm `recentSyncRuns` reflects the last 5.
5. Create the Doppler project `plaud-mirror` before moving past `dev-vm`.

## Open Questions

- What retry and scheduler defaults are safe enough for Phase 3?
- Can automatic re-login be implemented without browser automation?
- If `scene` filtering turns out to be useful with real operator experience, how would we surface it? A smart dropdown of scene values observed in the account (via `SELECT DISTINCT scene FROM recordings`) is one option; another is discovering a Plaud-provided mapping of scene numbers to human labels.

## Confirmed Product Direction

- First deployment target is `dev-vm`; NAS comes later.
- The first usable release must include a small product-style web panel.
- Manual bearer-token auth is acceptable first, but it must be encrypted at rest and survive restarts.
- Historical backfill is required from day 1.
- Downstream delivery stays generic webhook-first.
- Automatic re-login stays on the roadmap but is not a Phase 2 gate.

## Roadmap Pointer

Use [docs/ROADMAP.md](../ROADMAP.md) as the source of truth. The important boundary is:

- **Phase 2:** usable manual slice with UI + Docker
- **Phase 3:** unattended operation and resilience

Do not collapse those phases casually.

## Next Session

- If the stack is not already running, start it with:
  `docker compose up --build -d`
- If Docker Hub pulls time out on `dev-vm`, the Dockerfile still accepts `PLAUD_MIRROR_DOCKER_BUILD_IMAGE` and `PLAUD_MIRROR_DOCKER_RUNTIME_IMAGE` build-arg overrides. Valid fallbacks: a locally cached Node slim/alpine image from another project, a home-infra-local registry mirror (see the open registry-mirror item in `~/src/home-infra/docs/PROJECTS.md`), or a side-loaded `node:20-bookworm-slim` via `docker save`/`docker load`. Do **not** substitute a pentesting distribution such as `vxcontrol/kali-linux:latest` — it inflates the attack surface, bloats the image, and ships tooling that has no place in a Plaud mirror's runtime.
- Open the UI and save a fresh Plaud bearer token.
- Run a filtered backfill from the panel.
- Inspect:
  - `/api/health`
  - `runtime/recordings/<recording-id>/metadata.json`
  - webhook receiver logs
- Record the live findings before planning Phase 3.

## Testing Notes

- `npm test` passes, including:
  - shared schema tests
  - Plaud client tests
  - Phase 1 spike tests
  - encrypted-secret/store/service/server tests
  - built API/web integration smoke tests
- Docker packaging now includes a local-base fallback for this `dev-vm`; `docker compose up --build -d` has been verified locally and `/api/health` responds with the expected "missing token" payload.
- Live Plaud validation still has not happened in-session because no real token was available.

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

## Do Not Touch

- `config/upstreams.tsv` without documenting the baseline change
- `docs/UPSTREAMS.md` licensing boundaries without explicit user approval
- `.dockit-config.yml` external-context paths unless the infra-doc repo moved
