<!-- doc-version: 0.5.4 -->
# LLM Start Guide - Plaud Mirror

## Read This First (Mandatory)

Welcome to Plaud Mirror. This repository is building a self-hosted Plaud audio mirror with Docker deployment, a local web UI, automatic session renewal, and an upstream-watch discipline. Read the documents in the order below before making changes.

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
- Last Updated: 2026-04-26 - Claude Opus 4.7
- Working on: `v0.5.4` ships the **Layer-1 doc-drift enforcement** (D-016) — `scripts/check-prose-drift.sh` plus `prose-drift` validator check (eighth check, `WARN` during v0.5.4, `FAIL` from v0.5.5), global meta-rule in `~/.claude/CLAUDE.md` + PostToolUse hook in `~/.claude/hooks/check-passive-rule.sh`, DF-028 upstream to LLM-DocKit framing this as first empirical demand for CE_V2 P0. Patch release; product surface unchanged. D-014 full pushed to v0.5.5.
- Previous focus (v0.5.3 release): durable webhook outbox (D-013). Webhook delivery is decoupled from sync: each successfully-mirrored recording pushes its payload into a new `webhook_outbox` SQLite table with an explicit FSM (`pending → delivering → delivered | retry_waiting → permanently_failed`), and a dedicated `OutboxWorker` retries with exponential backoff (30s → 8h, 8 attempts, ~16h cumulative window) before escalating. The HMAC signature is recomputed at delivery time so a rotated `webhookSecret` is honoured for items still in the queue. New routes `GET /api/outbox` (failed list) and `POST /api/outbox/:id/retry`. New `health.outbox` block. New `SyncRunSummary.enqueued` counter; `delivered` keeps its original semantic and structurally stays at 0 from now on. Panel gets a new "Webhook outbox" card (counters + permanently-failed list + Retry button per row). Test count: 102 → 113 (102 backend + 11 web).
- Previous focus (v0.5.2 release, 2026-04-25): `v0.5.2` adds **panel-driven scheduler configuration**. The user explicitly asked for the scheduler to be configurable from the UI ("no me interesa que esté en el .env"), so the scheduler interval moves from "env-var only" to "persisted in SQLite, settable via `PUT /api/config`, hot-applied with no restart." The env var is downgraded to a one-time seed for fresh installs. Tercer roadmap shift en `0.5.x`: outbox (D-013) → `v0.5.3`, full health (D-014) → `v0.5.4`.
- Status: `v0.5.2` shipped. Code: new module `apps/api/src/runtime/scheduler-manager.ts` with `SchedulerManager.applyInterval(ms)` (start / stop / swap-cadence in place, idempotent for unchanged values, throws below the 60 000 ms floor); `RuntimeConfig.schedulerIntervalMs` and `UpdateRuntimeConfigRequest.schedulerIntervalMs?` added to the shared schema (`.default(0)` so older clients still parse); `RuntimeStore.seedSchedulerDefaults(ms)` writes the env-var bootstrap value only when the SQLite row is absent; `RuntimeStore.saveConfig` accepts the new field and persists via the existing `settings` key/value table; `service.updateConfig` validates the floor at the request boundary (HTTP 400 for sub-floor positives), persists, then calls a new reconfigure hook so the live `Scheduler` is started / stopped / swapped via the manager; `service.setSchedulerReconfigureHook(fn)` mirrors `setSchedulerStatusProvider`; `apps/api/src/server.ts` now constructs a `SchedulerManager` unconditionally, wires both hooks, and applies the persisted interval after `service.initialize()` (env-var seed runs first); the inline `Scheduler` instantiation in `createApp` is gone. Web: new "Continuous sync scheduler" card on the Configuration tab with a live status block (state, interval, next/last tick, last reason) and a form (`Interval (minutes, 0 disables)`); helpers `formatSchedulerInput` / `parseSchedulerInput` round-trip minutes ↔ ms; `handleSaveScheduler` posts to `PUT /api/config { schedulerIntervalMs }`. Tests: 9 new (1 store round-trip + seed-only-once, 7 in the new `scheduler-manager.test.ts`, 1 service `updateConfig`). Test totals: **102** (91 backend + 11 web), up from 93 at `v0.5.1`. Doc sweep: CHANGELOG `[0.5.2]` filled (Added/Changed/Notes); ROADMAP "Current target" → `v0.5.2` and entry note rewritten to mention panel-driven config + push outbox to `v0.5.3` and full-health to `v0.5.4`; PROJECT_CONTEXT current-status rewritten to lead with the panel UX win; ARCHITECTURE status header + "What Phase 3 Adds" / "Continuous sync scheduler" / "Next Architectural Step" all updated to describe the SchedulerManager + SQLite-as-source-of-truth flow + the env var as a one-time seed; AUTH_AND_SYNC env-var matrix replaced with a unified value matrix that applies regardless of source (panel or seed) plus an explicit "to take an existing install back to disabled, set the value to 0 in the panel — removing the env var no longer changes anything" warning; API_CONTRACT route table + `PUT /api/config` example + Phase Boundary Note all updated; HOW_TO_USE "Configuring the scheduler" rewritten to lead with panel steps and demote env-var to "Optional: bootstrap from the env var" subsection; test count bumped to 102 with breakdown. HANDOFF / LLM_START_HERE kept in sync. Next session: `v0.5.3` for the durable webhook outbox per D-013.

Keep this section synchronized with the "Current Status" block in docs/llm/HANDOFF.md.

<!-- DOCKIT-TEMPLATE:START checklist -->
## Getting Started Checklist
- [ ] Read this entire file
- [ ] Review docs/PROJECT_CONTEXT.md
- [ ] Review docs/UPSTREAMS.md
- [ ] Review docs/operations/AUTH_AND_SYNC.md
- [ ] Review docs/VERSIONING_RULES.md
- [ ] Read the current docs/llm/HANDOFF.md
- [ ] Install pre-commit hook: `cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`
- [ ] Run `scripts/check-version-sync.sh` to verify version markers
- [ ] Confirm scope with the user
- [ ] Complete the work
- [ ] Update docs/llm/HANDOFF.md
- [ ] Add an entry to docs/llm/HISTORY.md
<!-- DOCKIT-TEMPLATE:END checklist -->

## Customization Notes for Maintainers
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

<!-- DOCKIT-TEMPLATE:START footer -->
---

Every change must be documented. If you are unsure about a rule, ask the user before proceeding.
<!-- DOCKIT-TEMPLATE:END footer -->
