<!-- doc-version: 0.9.4 -->
# LLM Start Guide - Plaud Mirror

## Read This First (Mandatory)

Welcome to Plaud Mirror. This repository is building a self-hosted Plaud audio mirror with Docker deployment, a local operator UI, browser-assisted session renewal, and an upstream-watch discipline. Read the documents in the order below before making changes.

Recommended reading order:
1. This file
2. [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md)
3. [docs/ROADMAP.md](docs/ROADMAP.md)
4. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
5. [docs/UPSTREAMS.md](docs/UPSTREAMS.md)
6. [docs/operations/AUTH_AND_SYNC.md](docs/operations/AUTH_AND_SYNC.md)
7. [docs/VERSIONING_RULES.md](docs/VERSIONING_RULES.md)
8. [docs/llm/HANDOFF.md](docs/llm/HANDOFF.md)
9. [docs/llm/DECISIONS.md](docs/llm/DECISIONS.md)
10. [docs/llm/README.md](docs/llm/README.md) — index of LLM working memory, owner shorthand glossary (e.g. **HO** → `HANDOFF.md`), and the enriched review-entry convention used by `docs/llm/REVIEWS.md`

## Critical Rules (Non-Negotiable)

### Language Policy
- All code and documentation: English
- Conversation with the user: Spanish
- Comments in code: English
- File names: English

### Project-Specific Rules
- Do not introduce plaintext storage for Plaud passwords, tokens, or master keys.
- Do not print secrets to logs, CLI output, or debug traces.
- Prefer MIT-licensed upstream code with attribution. AGPL or no-license repositories are reference-only unless the user explicitly approves a licensing change.
- Any change to auth, token renewal, sync cadence, storage layout, or upstream baselines must update `docs/ARCHITECTURE.md`, `docs/UPSTREAMS.md`, and `docs/operations/AUTH_AND_SYNC.md` in the same session.
- Phase boundaries live in `docs/ROADMAP.md`. Do not silently pull next-phase scope into the current phase.
- Every new runtime case must come with explicit tests in the same session. If behavior changes, update or add the tests that prove that case.
- Runtime work is not done until the relevant test suite passes locally. At the current stage that means at least `npm test`, plus any narrower smoke check for the touched entrypoint.
- Plaud Mirror is audio-first. Transcript and summary features are intentionally out of the critical path for v1 unless the user explicitly changes scope.

<!-- DOCKIT-TEMPLATE:START doc-update-rules -->
### Documentation Update Rules
- Update docs/llm/HANDOFF.md every time you make a change.
- Append an entry to docs/llm/HISTORY.md in every session.
- HISTORY format: YYYY-MM-DD - <LLM_NAME> - <Brief summary> - Files: [list] - Version impact: [yes/no + details]
- Put long-form rationale in docs/llm/DECISIONS.md and link to it from HANDOFF.
- Prefer ASCII-only in docs/llm/* to avoid Windows encoding issues.
<!-- DOCKIT-TEMPLATE:END doc-update-rules -->

<!-- DOCKIT-TEMPLATE:START doc-sync-rules -->
### Documentation Sync Rules
- Keep this file's "Current Focus" section synchronized with docs/llm/HANDOFF.md "Current Status".
- Keep docs/STRUCTURE.md synchronized with the actual repository file tree.
- Keep docs/PROJECT_CONTEXT.md synchronized with architectural reality.
- Version markers (`<!-- doc-version: X.Y.Z -->`) in documentation files are managed by `scripts/bump-version.sh`. See `docs/version-sync-manifest.yml` for the full list of tracked files.
<!-- DOCKIT-TEMPLATE:END doc-sync-rules -->

<!-- DOCKIT-TEMPLATE:START commit-policy -->
### Commit Message Policy
- Every response that includes code or documentation changes must end with suggested commit information:
  - **Title:** under 72 characters
  - **Description:** under 200 characters, focused on user impact and why the change matters
- Format:
  `
  ## Commit Info
  **Title:** <concise title>
  **Description:** <short explanation of what changed and why>
  `
<!-- DOCKIT-TEMPLATE:END commit-policy -->

<!-- DOCKIT-TEMPLATE:START version-management -->
### Version Management
- Every commit that changes code/config files MUST include a version bump. The pre-commit hook enforces this.
- For version bumps, run `scripts/bump-version.sh <new_version>`; do not edit version strings manually.
- The bump script reads `docs/version-sync-manifest.yml` to update all tracked files atomically.
- Validate sync with `scripts/check-version-sync.sh` (also available as pre-commit hook).
- Do not bump versions without consulting docs/VERSIONING_RULES.md for impact level (patch/minor/major).
- Do NOT batch multiple code commits without versioning. No exceptions.
<!-- DOCKIT-TEMPLATE:END version-management -->

<!-- DOCKIT-TEMPLATE:START env-policy -->
### Environment Files (If Applicable)
- Do not edit generated .env.example files directly.
- Never change or remove existing credentials in .env or equivalent secret stores.
- If a new variable is needed, document it in the relevant README and ask the user to add it manually.
<!-- DOCKIT-TEMPLATE:END env-policy -->

## Current Focus (Snapshot)

Source of truth: docs/llm/HANDOFF.md.
- Last Updated: 2026-06-18 - Codex GPT-5
- Working on: **v0.9.4 (patch) — Library playback and scrolling fixed in the redesigned panel.** The `v0.9.0` Library had two operator-visible regressions in the full-viewport shell: Compact Play only toggled React state and did not start the native audio element, and the recordings list did not own a reliable scroll area. v0.9.4 keeps the backend and data contracts unchanged while making each playable row keep a real `<audio>` in the DOM, calling `audio.play()` inside the compact button's user gesture, pausing stale rows when another row starts, widening Full-mode player rows on desktop, and giving Library a table-owned scroll region under its fixed header/toolbar/pagebar. Tests: 153 (127 Node/integration + 26 web). Runtime state after deploy: auth healthy, EU API base, catalog complete at 517/517, operator lock armed.
- Previous (v0.9.3): DocKit trace protocol merged without losing local guardrails. A raw LLM-DocKit sync had landed in the working tree after v0.9.2 and added trace-protocol scaffolding, but also removed Plaud Mirror's local governance protections: `handoff-start-here-sync`, `prose-drift`, `unabsorbed-artifact`, and `json-version` package-manifest handling. v0.9.3 keeps the useful upstream pieces (`LLM_START_HERE.md` Trace Protocol section, bootstrap Trace guidance, validator `trace-protocol` check, read-only skip refinement, and smoke tests) while restoring the local extensions. `scripts/check-version-sync.sh` again checks 21 targets, and `scripts/dockit-validate-session.sh --human` reports 12 checks: the previous 11 plus trace-protocol, skipped unless explicitly enabled in `.dockit-config.yml`. `scripts/test-validator.sh` passes 17/17.
- Previous (v0.9.2): Main sync action now downloads the displayed missing count. Live investigation showed the Main cockpit button inherited the Historical Backfill form's conservative draft `limit=1`, so a click could examine the full Plaud catalog while downloading only one missing recording. `apps/web/src/App.tsx` decouples Main from the Backfill draft: Main computes the displayed missing count from health, sends that count to `POST /api/sync/run` capped at the existing 1000-item backend ceiling, forces `forceDownload:false`, labels the button with the exact count (`Descargar N` / `Download N`), and asks for confirmation at 25+ downloads. Backfill keeps its own `limit=1` default because it is an advanced filtered tool. Tests: 151 (127 Node/integration + 24 web). Operational full sync run `5a970a84-3f44-4602-b727-3d1d12179349` completed with `examined=514`, `matched=165`, `downloaded=165`, `skipped=165` (webhook skipped because no webhook is configured), `enqueued=0`, and no error; health/SQLite show `recordingsCount=514`, `plaudTotal=514`, missing `0`.
- Previous (v0.9.1): full-viewport operator shell + documentation drift cleanup. The `v0.9.0` redesign copied the standalone reference frame too literally, rendering production as a centered 1240px card on a grey presentation canvas. `apps/web/src/styles.css` removed the outer card frame (`max-width`, page padding, border, radius, shadow), made the operator frame fill `100vh`/`100%`, kept the 212px rail pinned to the left edge on desktop, and let `.operator-content` own vertical scrolling. Existing screens, components, copy, endpoints, auth/reconnect flows, and mobile breakpoints stayed intact. Tests: 150 (127 Node/integration + 23 web).
- Previous (v0.9.0): reference-driven operator panel redesign. Absorbed `docs/design/reference/plaud-mirror-panel-standalone.html` into the real React/Vite panel without backend API changes or secret/env edits. The panel now uses the dense light-console visual system from the reference (212px rail, Archivo/Space Grotesk/JetBrains Mono, green accent, state colors) and real five-screen navigation: Main, Library, Backfill, Configuration, Operations. Existing capabilities stay wired: operator login, health/status, Chrome-extension reconnect + manual token fallback, scheduler/webhook config, sync/backfill, recordings playback/dismiss/restore, outbox retry, and errors/runs. Added ES/EN operator chrome persisted in localStorage. Tests 148 -> 150 (127 Node + 23 web).
- Previous (v0.8.1): backend Plaud validation fingerprint aligned with Plaud Web. The operator proved the extension-captured EU user token is valid in the Plaud Web console, while the backend received an HTML `403` from Plaud/Cloudflare. Diagnosis: token and region were correct; the stale server-side Plaud request context was the mismatch (`Origin/Referer: https://app.plaud.ai` plus custom `plaud-mirror-phase1/...` user-agent). Fix: `PlaudClient` now sends `Origin/Referer: https://web.plaud.ai`, a browser-like Chrome UA, and browser `sec-fetch-*` headers. Extension flow unchanged. Tests 147 -> 148. v0.8.0 below.
- Previous (v0.8.0): definitive Phase 4 delivery path: local Chrome extension. Post-diagnosis confirmed the v0.7.x draggable bookmarklet path is broken as a recommended UX because React replaces `javascript:` hrefs with a defensive throw before Chrome stores the bookmark. Product decision: stop patching draggable bookmarklets as the main path. v0.8.0 adds `apps/chrome-extension/` ("Plaud Mirror Connector"), a local unpacked Manifest V3 extension that reads the active Plaud tab's user bearer (`pld_tokenstr` first, storage scan fallback), injects in Chrome's `MAIN` world, stores only the mirror origin, and redirects to the existing `/connect#token=...` capture handshake. Panel UX is extension-first; bookmarklet is copy-only fallback. Phase 4 spans `0.7.x`-`0.8.x` at that point. Tests 145 -> 147 (126 Node + 21 web). v0.7.6 below.
- Previous (v0.7.6): bookmarklet no longer fails silently. Operator tried the "Reconectar Plaud Mirror" bookmarklet on app.plaud.ai and saw no visible action. Fix: `buildBookmarklet` is short (<2 KB), focuses on `pld_tokenstr`, scans storage as fallback, and shows a Plaud Mirror alert for every outcome. Tests 145. This path is now fallback only.
- Previous (v0.7.5): friendly rejection for masked/redacted token pastes. Operator hit `Cannot convert argument to a ByteString... index 7 value 9679`; `9679` is `●`, so the pasted value was `Bearer ●●●...`. `saveAccessToken` now rejects mask characters and other header-unsafe token characters before building the Plaud `Authorization` header, returning a clear 400. Deploy follow-up: Dockerfile switched from a hanging `npm prune --omit=dev` to a `prod-deps` stage (`npm ci --omit=dev`) for the runtime image. Tests 144. Live dev-vm verified on `0.7.5`, with operator auth armed and EU API base set. v0.7.4 (PII/info-leak fix) below.
- Previous (v0.7.4): closed the PII/info-leak from v0.7.3: Plaud's raw error body was reaching the public `/api/health` via `auth.lastError`/`lastSync.error`/`lastErrors`; the `PlaudApiError.message` is generic again and the body is surfaced only on the authenticated token-save response. Also fixed stale `plaud-token.ts` comments. Tests 143. Dated 2026-06-13 per explicit operator request. v0.7.3 (validation 403 fix) below.
- Previous (v0.7.3): fixed the 403 on token validation: root cause was wrong token type (the capture grabbed the per-workspace token, but `/user/me` wants the global user token `pld_tokenstr`) on top of a region mismatch (account is EU → `PLAUD_MIRROR_API_BASE=https://api-euc1.plaud.ai` in Doppler). Extractor now prefers `pld_tokenstr`; `saveAccessToken` normalizes messy pastes; Plaud's rejection body is surfaced. Tests 142. Operator still needs to re-run reconnect to validate. v0.7.2 (bookmarklet encoding fix) below.
- Previous (v0.7.2): fixed the bookmarklet that silently did nothing (`buildBookmarklet` was percent-encoding the whole body → browser ran encoded text → syntax error; now raw executable `javascript:`, regression-guarded). Plus `window.open` null-check and a rewritten, numbered reconnect card (the operator didn't know the bookmarks bar and clicked instead of dragging). 141 tests. Operator still needs to run the now-working reconnect to fix the Plaud token (degraded since 2026-05-13). Earlier patch (v0.7.1) below.
- Previous focus (v0.7.0): **Phase 4 entered: browser-assisted Plaud re-auth (D-019).** Google-SSO account = no password possible (credentials-login out); official OAuth/MCP deferred-watch. Chosen: capture the browser's existing bearer via a panel-initiated single-use capture session + a bookmarklet (extraction adapted from MIT `iiAtlas`, attributed). Routes `/api/connect/start` + `/api/connect/complete`; `/connect` landing (`ConnectPlaud`); `apps/web/src/plaud-token.ts`. ~300-day token → ~once-a-year tap. Manual paste stays fallback; Telegram is NOT a capture channel. Tests 130 → 141. Next: re-validate the Plaud token (degraded since 2026-05-13) via the new flow; observability UI + soak still pending. Earlier patch (v0.6.3) below.
- Previous focus (v0.6.3 patch): trap-based terminal-state restore in `scripts/set-admin-passphrase.sh` (low finding from the operator's audit of v0.6.2; Ctrl-C mid-prompt could leave the terminal without echo). No runtime change. Residual operativo: armar D-018 ejecutando el helper + `doppler run -- docker compose up -d`, luego verificar 401 en `/api/config` sin cookie. Previous day below.
- Previous focus (2026-06-10 - Claude Fable 5): **v0.6.0 — Phase 3 hardening release** from the 2026-06-10 security review (findings C1/H1/H3, operator-confirmed). Operator access control (D-018): `PLAUD_MIRROR_ADMIN_PASSPHRASE` + signed HttpOnly session cookie gates every `/api/*` route; new `apps/api/src/runtime/operator-auth.ts`, session routes with login throttle, `LoginGate` in the panel, PII redaction on the public `/api/health`; backward compatible (unset = open + warning) — **operator must add the env var to the dev-vm `.env` to arm it**. Startup crash recovery (D-013 amendment): orphaned `running` sync runs failed at boot (they deadlocked the anti-overlap guard forever), orphaned `delivering` outbox rows re-queued at-least-once with backoff budget intact. Plaud client timeouts: `AbortSignal.timeout` on every API call (30 s) and audio download (10 min). ROADMAP re-cut: Phase 3 = `0.5.x`–`0.6.x`, Phase 4 (re-login) → `0.7.x`. Tests 116 → 130 (116 backend + 14 web). Closed same session as patch **v0.6.1**: dockit-sync to LLM-DocKit 4.8.2 (validator merged preserving local guardrails; smoke suite 9/9). Patch **v0.6.2** adds `scripts/set-admin-passphrase.sh` (operator-run, stores the D-018 passphrase in Doppler `plaud-mirror/dev`, creates the Doppler project on first run). Queued next (HANDOFF Open Work): observability UI in the panel, scrypt KDF upgrade, Phase 4 spike of Plaud credentials login, DF to LLM-DocKit about clobber-on-sync.
- Previous focus (2026-05-14 - Claude Opus 4.7): closed the pending LLM-DocKit 4.8 sync and infra-exposure docs from the 2026-05-13 Codex session as patch release **v0.5.6** (governance/sync; no runtime change); local guardrails (`json-version`, D-016, D-017) preserved through the sync.
- Previous focus (2026-05-13 - Codex): Infra exposure + DocKit sync hygiene. `home-infra` is registering Plaud Mirror as an operator-visible service at `https://plaud.lamanoriega.com/` through NAS `edge-caddy` to the dev-vm backend `http://10.0.0.110:3040`. Local runtime was verified alive on dev-vm: `/api/health` returns version `0.5.5`, auth `healthy`, scheduler disabled, `recordingsCount: 345`, `plaudTotal: 391`, last sync completed at `2026-05-13T17:56:16.859Z`. LLM-DocKit upstream is `4.8.0`; this repo now has the 4.8 SessionStart hook and `scripts/dockit-bootstrap-context.sh`, while preserving project-specific `json-version`, `prose-drift` (D-016), and `unabsorbed-artifact` (D-017) guardrails that the upstream template does not carry.
- Previous focus (v0.5.3 release): durable webhook outbox (D-013). Webhook delivery is decoupled from sync: each successfully-mirrored recording pushes its payload into a new `webhook_outbox` SQLite table with an explicit FSM (`pending → delivering → delivered | retry_waiting → permanently_failed`), and a dedicated `OutboxWorker` retries with exponential backoff (30s → 8h, 8 attempts, ~16h cumulative window) before escalating. The HMAC signature is recomputed at delivery time so a rotated `webhookSecret` is honoured for items still in the queue. New routes `GET /api/outbox` (failed list) and `POST /api/outbox/:id/retry`. New `health.outbox` block. New `SyncRunSummary.enqueued` counter; `delivered` keeps its original semantic and structurally stays at 0 from now on. Panel gets a new "Webhook outbox" card (counters + permanently-failed list + Retry button per row). Test count: 102 → 113 (102 backend + 11 web).
- Previous focus (v0.5.2 release, 2026-04-25): `v0.5.2` adds **panel-driven scheduler configuration**. The user explicitly asked for the scheduler to be configurable from the UI ("no me interesa que esté en el .env"), so the scheduler interval moves from "env-var only" to "persisted in SQLite, settable via `PUT /api/config`, hot-applied with no restart." The env var is downgraded to a one-time seed for fresh installs. Tercer roadmap shift en `0.5.x`: outbox (D-013) → `v0.5.3`, full health (D-014) → `v0.5.4`.
- Status: `v0.5.2` shipped. Code: new module `apps/api/src/runtime/scheduler-manager.ts` with `SchedulerManager.applyInterval(ms)` (start / stop / swap-cadence in place, idempotent for unchanged values, throws below the 60 000 ms floor); `RuntimeConfig.schedulerIntervalMs` and `UpdateRuntimeConfigRequest.schedulerIntervalMs?` added to the shared schema (`.default(0)` so older clients still parse); `RuntimeStore.seedSchedulerDefaults(ms)` writes the env-var bootstrap value only when the SQLite row is absent; `RuntimeStore.saveConfig` accepts the new field and persists via the existing `settings` key/value table; `service.updateConfig` validates the floor at the request boundary (HTTP 400 for sub-floor positives), persists, then calls a new reconfigure hook so the live `Scheduler` is started / stopped / swapped via the manager; `service.setSchedulerReconfigureHook(fn)` mirrors `setSchedulerStatusProvider`; `apps/api/src/server.ts` now constructs a `SchedulerManager` unconditionally, wires both hooks, and applies the persisted interval after `service.initialize()` (env-var seed runs first); the inline `Scheduler` instantiation in `createApp` is gone. Web: new "Continuous sync scheduler" card on the Configuration tab with a live status block (state, interval, next/last tick, last reason) and a form (`Interval (minutes, 0 disables)`); helpers `formatSchedulerInput` / `parseSchedulerInput` round-trip minutes ↔ ms; `handleSaveScheduler` posts to `PUT /api/config { schedulerIntervalMs }`. Tests: 9 new (1 store round-trip + seed-only-once, 7 in the new `scheduler-manager.test.ts`, 1 service `updateConfig`). Test totals: **102** (91 backend + 11 web), up from 93 at `v0.5.1`. Doc sweep: CHANGELOG `[0.5.2]` filled (Added/Changed/Notes); ROADMAP "Current target" → `v0.5.2` and entry note rewritten to mention panel-driven config + push outbox to `v0.5.3` and full-health to `v0.5.4`; PROJECT_CONTEXT current-status rewritten to lead with the panel UX win; ARCHITECTURE status header + "What Phase 3 Adds" / "Continuous sync scheduler" / "Next Architectural Step" all updated to describe the SchedulerManager + SQLite-as-source-of-truth flow + the env var as a one-time seed; AUTH_AND_SYNC env-var matrix replaced with a unified value matrix that applies regardless of source (panel or seed) plus an explicit "to take an existing install back to disabled, set the value to 0 in the panel — removing the env var no longer changes anything" warning; API_CONTRACT route table + `PUT /api/config` example + Phase Boundary Note all updated; HOW_TO_USE "Configuring the scheduler" rewritten to lead with panel steps and demote env-var to "Optional: bootstrap from the env var" subsection; test count bumped to 102 with breakdown. HANDOFF / LLM_START_HERE kept in sync. Next session: `v0.5.3` for the durable webhook outbox per D-013.

Keep this section synchronized with the "Current Status" block in docs/llm/HANDOFF.md.

<!-- DOCKIT-TEMPLATE:START checklist -->
## Getting Started Checklist
- [ ] Read this entire file and update placeholders
- [ ] Review docs/PROJECT_CONTEXT.md
- [ ] Review docs/VERSIONING_RULES.md
- [ ] Read the current docs/llm/HANDOFF.md
- [ ] Install pre-commit hook: `cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`
- [ ] Run `scripts/check-version-sync.sh` to verify version markers
- [ ] Confirm scope with the user
- [ ] Complete the work
- [ ] Update docs/llm/HANDOFF.md
- [ ] Add an entry to docs/llm/HISTORY.md
<!-- DOCKIT-TEMPLATE:END checklist -->

## Maintainer Notes
- Keep the DocKit sections with markers intact so downstream sync from `LLM-DocKit` remains possible.
- Treat `.dockit-config.yml` as project configuration, not as a generated artifact.
- If external context changes, regenerate `LLM_START_HERE.md` with `scripts/dockit-generate-external-context.sh --apply --claude-rules --project .`.

## Quick Navigation
- Project Overview: docs/PROJECT_CONTEXT.md
- Architecture: docs/ARCHITECTURE.md
- Roadmap: docs/ROADMAP.md
- Upstream Matrix: docs/UPSTREAMS.md
- Auth and Sync: docs/operations/AUTH_AND_SYNC.md
- Upstream Watch: docs/operations/UPSTREAM_WATCH.md
- Version Rules: docs/VERSIONING_RULES.md
- Version Sync Manifest: docs/version-sync-manifest.yml
- LLM Docs Index: docs/llm/README.md
- Current Work State: docs/llm/HANDOFF.md
- Change History: docs/llm/HISTORY.md
- Decision Rationale: docs/llm/DECISIONS.md
- Reviews (optional): docs/llm/REVIEWS.md
- Runbooks: docs/operations/

<!-- DOCKIT-TEMPLATE:START llm-communication -->
## LLM-to-LLM Communication
When handing off to another LLM:
1. Update docs/llm/HANDOFF.md with the current state and next steps.
2. Append an entry to docs/llm/HISTORY.md following the required format.
3. Ensure the snapshot in this file matches the latest status.
<!-- DOCKIT-TEMPLATE:END llm-communication -->

<!-- DOCKIT-TEMPLATE:START do-not-touch -->
## Do Not Touch Zones
Use the Do Not Touch section in docs/llm/HANDOFF.md to flag any files or areas that must remain unchanged without explicit approval from the user.
<!-- DOCKIT-TEMPLATE:END do-not-touch -->

<!-- DOCKIT-EXTERNAL-CONTEXT:START -->
### External Context

**Source:** /home/cdelalama/src/home-infra

**Read these files at the start of every session:**
1. README.md
2. docs/PROJECTS.md
3. docs/SERVICES.md
4. docs/CONVENTIONS.md

**Update triggers** -- when you modify files matching these patterns, update the corresponding external doc:
| Local file pattern | External doc to update |
|--------------------|------------------------|
| docs/PROJECT_CONTEXT.md | docs/PROJECT_CONTEXT.md |
| docs/ARCHITECTURE.md | docs/ARCHITECTURE.md |
| docs/operations/AUTH_AND_SYNC.md | docs/operations/AUTH_AND_SYNC.md |
| docs/operations/DEPLOY_PLAYBOOK.md | docs/operations/DEPLOY_PLAYBOOK.md |
<!-- DOCKIT-EXTERNAL-CONTEXT:END -->

<!-- DOCKIT-TEMPLATE:START trace-protocol -->
## Trace Protocol

For execution or audit work, begin each substantive execution report or audit
verdict with a compact `Trace` header, then write the normal explanation in
prose. The header is for orientation; it does not replace the message.

Required chat header fields:
- `Role`: `executor` or `auditor`
- `Sent`: `YYYY-MM-DD HH:MM <local-tz> (HH:MM UTC)`. The order is mandatory:
  local time first, UTC second in parentheses.
- `Subject`: current task, or commit hash/title being implemented or audited
- `Resulting state`: what this message leaves true after it is sent
- `Repo state`: local branch vs origin and worktree status verified now
- `Validation`: checks run and result
- `Next gate`: who/what should act next

Time verification:
- Verify `Sent` before writing it; do not infer or mentally convert the time.
- If shell access is available, run both:
  ```sh
  date -u '+%Y-%m-%d %H:%M UTC'
  TZ=Europe/Madrid date '+%Y-%m-%d %H:%M %Z'
  ```
- Replace `Europe/Madrid` with `trace_protocol.local_timezone` from
  `.dockit-config.yml` when the project sets one.
- If the agent cannot verify the clock, write:
  `Sent: unverified client time YYYY-MM-DD HH:MM <claimed-tz>`.

Recommended `Resulting state` shape:

```text
Resulting state: HEAD=<hash|unchanged (hash)>; version=<version|none>; gate=<opened|cleared|blocked|superseded|next-slice>; <short note>
```

Examples:

```text
Resulting state: HEAD=01f90bb; version=<version>; gate=cleared; supersedes audit of d6fc816
Resulting state: HEAD=unchanged (01f90bb); version=none; gate=cleared; ready for next slice
Resulting state: HEAD=unchanged (d6fc816); version=none; gate=blocked; requires executor patch in the next release
```

Use clear prose after the header. Explain what changed, why it matters, what
was verified, and what risk remains.

When `trace_protocol.enabled: true` is set in `.dockit-config.yml`, the durable
half is enforced by `scripts/dockit-validate-session.sh --check trace-protocol`:
- `docs/llm/HANDOFF.md` must contain a `## Trace Anchor` section.
- HANDOFF Trace Anchor commit times may use `YYYY-MM-DD HH:MM:SS UTC` or
  `YYYY-MM-DD HH:MM UTC`.
- `docs/llm/HISTORY.md` entries dated on or after `trace_protocol.since` that
  reference backtick-quoted commit hashes must end with an inline footer:
  `Trace: role=executor|auditor; commits=hash1,hash2; state=...; validation=...; next=...`

Projects can set the local timezone used in `Sent` with:

```yaml
trace_protocol:
  local_timezone: Europe/Madrid
```

Projects that do not use executor/auditor windows can disable the chat-side
convention with:

```yaml
trace_protocol:
  enabled: false
```
<!-- DOCKIT-TEMPLATE:END trace-protocol -->

<!-- DOCKIT-TEMPLATE:START footer -->
---

Every change must be documented. If you are unsure about a rule, ask the user before proceeding.
<!-- DOCKIT-TEMPLATE:END footer -->
