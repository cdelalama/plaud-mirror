<!-- doc-version: 0.4.8 -->
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
- Last Updated: 2026-04-23 - Claude Opus 4.7
- Working on: two operator-reported issues — library only showed the first 50 of 100 mirrored (no pagination), and the `#N` badge was the visual page index (so a new recording would push every existing `#1` `#2`... down). Ship `v0.4.8` with classic Prev/Next pagination + stable `#N` ranks anchored to each recording's position in Plaud's full timeline.
- Status: `v0.4.8` adds (a) full pagination: backend `?skip=N` query param, response `{recordings, total, skip, limit}`, frontend Prev/Next + "Showing X-Y of Z (page A of B)" + per-page selector (25/50/100/200, default 50). Toggling Show dismissed or changing page size resets to page 0. (b) Stable sequence numbers: SQLite `sequence_number` column (additive migration), `store.updateSequenceNumbers(map)` bulk method, `runMirror` computes `plaudTotal − index` for each recording from the full `listEverything` listing and bulk-updates after the candidate loop so freshly-inserted rows also get their rank. UI badge `#N` reads from `recording.sequenceNumber` with `?` fallback for rows that predate v0.4.8 (clears after first sync). Pre-0.4.8 DBs migrate transparently. 40/40 tests pass — store fixtures and server fixtures updated to include the new field.

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
