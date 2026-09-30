<!-- doc-version: 0.16.9 -->
# LLM Start Guide - Plaud Mirror

- Last Updated: 2026-09-30 - Codex
- Tooling update: see `docs/llm/DOCKIT_ADOPTION.md`; historical project status below is preserved.

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
- Canonical engineering documentation, code identifiers, comments and file names: English.
- Conversation with Carlos and all operator-facing prose: Spanish.
- Product copy includes UI labels, dialogs, accessibility text, dashboards,
  reports and every human-readable field in a Dossier projection. This rule
  also applies when that content is stored in JSON or generated from English
  technical documents. Translate its meaning before capture/publication.
- Keep product names, exact commands, code literals, paths, schema keys, IDs,
  enum values, hashes and source bytes unchanged. Source titles and explanatory
  summaries shown to the operator are Spanish; technical source files remain English.
- A language correction creates a newly dated revision. Preserve original
  observations, immutable historical revisions, status, evidence and permissions.
- Before delivery, review every visible field and inspect the real reader in
  Spanish. Schema validation alone does not prove language or translation quality.

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
- HISTORY format defaults to `any`: either `- YYYY-MM-DD - <LLM_NAME> - ...` or `YYYY-MM-DD - <LLM_NAME> - ...` is accepted. Set top-level `history_format: dash` or `history_format: no-dash` in `.dockit-config.yml` when a project wants strict enforcement.
- Projects with a phase-based roadmap can opt into semantic phase drift checks with `.dockit-config.yml` `orientation_drift.enabled: true`; this fails when entry docs describe a completed roadmap phase as "next".
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
- Supported manifest marker types are `version-file`, `changelog`, `html-comment`, `json-version`, `yaml-info-version`, and `package-lock-version`.
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

- Last Updated: 2026-09-30 - Codex
- Source 0.16.9 records M0 preparation and completes minor audit documentation;
  it adds no runtime behavior. Applicable DocKit 4.18.1 is adopted from published
  main. DocKit release-tag baseline: v4.17.0 (4.18.1 has no release tag).
- Portal 0.33.4 serves the Spanish Plaud L5/S5 Dossier: 28 milestones, 29
  decisions (28 accepted and one proposed), 22 changes and 35 pinned sources.
  Original L1/S1 through L4/S4 remain immutable and readable. Delivery receipt:
  docs/operations/M0_READING_PREPARATION_2026-09-30.json.
- Local capture submission: deferred and explicit shared publication are separate
  facts. Preserve native receipts; see docs/operations/DOSSIER.md.
- Plaud NAS runtime remains 0.16.1; Media2Text remains 0.39.3. Read-only Docker
  inspection on September 30 confirmed healthy containers and September 19
  start times. This correction does not deploy, replay or invoke a provider.
- September 29 counts (770 mirrored; 76 transcribed, 72 failed, 622 not sent)
  remain historical observations, not fresh production counts.
- D-004 records the September 30 watch-only review of OpenPlaud/Riffado and
  plaud-toolkit. D-019 cookie/session adaptation remains open; no upstream
  implementation is imported. Report CI and Upstream Watch separately.
- Existing delivery follow-ups: re-measure complete-history reads above 20 s;
  broader product localization remains separate from the delivered Dossier.
- Scope and verification: docs/operations/DOSSIER_AUDIT_CLOSURE_2026-09-30.md.
  The historical partial-onboarding spot-check does not supply a current GO.
- M0: Carlos selected desktop and mobile. Media2Text owns offline Markdown
  preparation; private transfer and actual reading/search acceptance remain
  open. Next are separately scoped M1 new recording, M2 reliability and M3
  Cortex. Phase 3/5/6 acceptance and independent recovery stay open.


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

Every substantive assistant turn in a DocKit-governed session must begin with
a compact `Trace` header, then continue with the normal explanation in prose.
This includes execution, audit, design opinions, recommendations,
brainstorming, clarifying questions, status reports, and go/no-go calls.

A turn is substantive if the operator might need to find it when returning to
a multi-window workflow: it contains a decision, opinion, recommendation,
status, audit, action, or clarifying question. Non-substantive turns such as a
pure acknowledgement under 50 characters do not require Trace, but emitting
Trace is always safe. The header is for orientation; it does not replace the
message.

Required chat header fields:
- `Role`: `executor`, `auditor`, or `advisor`
- `Sent`: `YYYY-MM-DD HH:MM:SS <local-tz> (HH:MM:SS UTC)`. The order and
  precision are mandatory: local time first, UTC second in parentheses, seconds
  included on both sides.
- `Subject`: current task, question, recommendation, or commit hash/title being implemented or audited
- `Resulting state`: what this message leaves true after it is sent
- `Repo state`: local branch vs origin and worktree status verified now
- `Validation`: checks run and result
- `Next gate`: who/what should act next

Time verification:
- Verify `Sent` before writing it; do not infer or mentally convert the time.
- If shell access is available, run both:
  ```sh
  date -u '+%Y-%m-%d %H:%M:%S UTC'
  TZ=Europe/Madrid date '+%Y-%m-%d %H:%M:%S %Z'
  ```
- Replace `Europe/Madrid` with `trace_protocol.local_timezone` from
  `.dockit-config.yml` when the project sets one.
- If the agent cannot verify the clock, write:
  `Sent: unverified client time YYYY-MM-DD HH:MM:SS <claimed-tz>`.
- Prefer generating the close-out scaffold immediately before sending it:
  ```sh
  scripts/dockit-trace-status.sh --role executor --subject "<commit/task>" \
    --validation "<checks>" --next "<next gate>"
  ```
  This prints current HEAD, local/upstream state, worktree cleanliness, version,
  and verified local/UTC time from git/date instead of relying on memory.

Recommended `Resulting state` shape:

```text
Resulting state: HEAD=<hash|unchanged (hash)>; version=<version|none>; gate=<opened|cleared|blocked|superseded|next-slice>; <short note>
```

Examples:

```text
Resulting state: HEAD=01f90bb; version=4.9.1; gate=cleared; supersedes audit of d6fc816
Resulting state: HEAD=unchanged (01f90bb); version=none; gate=cleared; ready for next slice
Resulting state: HEAD=unchanged (d6fc816); version=none; gate=blocked; requires executor patch DocKit 4.9.1
```

Use clear prose after the header. Explain what changed, why it matters, what
was verified, and what risk remains.

When reading an older Trace block, do not treat its `Repo state` as current
without checking the tree again. If the `Sent` time is more than a few minutes
old, or another LLM/operator may have acted since it was written, verify
`git status`, `git log -1`, and the current clock before acting on the report.

When `trace_protocol.enabled: true` is set in `.dockit-config.yml`, the durable
half is enforced by `scripts/dockit-validate-session.sh --check trace-protocol`:
- `docs/llm/HANDOFF.md` must contain a `## Trace Anchor` section.
- HANDOFF Trace Anchor commit times may use `YYYY-MM-DD HH:MM:SS UTC` or
  `YYYY-MM-DD HH:MM UTC`.
- A committed HANDOFF Trace Anchor is a durable repo-side anchor, not a
  guaranteed live HEAD pointer. Prefer neutral labels such as `Subject:` or
  `Trace target:`. Projects can set
  `trace_protocol.reject_current_anchor_label: true` to fail anchors labelled
  `Current target:` or `Current audit target:`.
- `docs/llm/HISTORY.md` entries dated on or after `trace_protocol.since` that
  reference backtick-quoted commit hashes must end with an inline footer:
  `Trace: role=executor|auditor|advisor; commits=hash1,hash2; state=...; validation=...; next=...`
- `commits=` contains only commits from the current repository. When the same
  HISTORY entry names a backtick-quoted commit from another repository, insert
  `external=repo@hash[,repo@hash];` immediately after `commits=...;`. The exact
  external hash must also appear in backticks in the entry. Example:
  `Trace: role=executor; commits=abc1234; external=forgeos@def5678; state=...; validation=...; next=...`

Projects can set the local timezone used in `Sent` with:

```yaml
trace_protocol:
  local_timezone: Europe/Madrid
```

Projects that do not use Trace-oriented LLM windows can disable the chat-side
convention with:

```yaml
trace_protocol:
  enabled: false
```
<!-- DOCKIT-TEMPLATE:END trace-protocol -->

<!-- DOCKIT-TEMPLATE:START independent-review-policy -->
### Independent Review Policy

The operator-wide Claude default is Opus 5.5, exact model
`claude-opus-5-5`, with high effort. This applies to Claude advisory/coauthor
work and independent source review unless the operator explicitly selects a
different model for the task. The operator's 2026-09-23 decision supersedes the
previous inherited Fable-first / quota-only Opus fallback preference.

1. Select the exact model explicitly for non-interactive review; do not use a
   floating `opus`, `best` or `default` alias as audit provenance.
2. Record effective model, effort, command, candidate revision/tree and validation
   packet in `docs/llm/REVIEWS.md` when present, otherwise the audited revision's
   HISTORY entry. Verify returned model metadata; a self-reported model name in
   the answer is not evidence. Do not silently substitute Fable, older Opus,
   Sonnet, Haiku or another model. If the selected model is unavailable or the
   provider changes it, preserve the packet and keep the required review gate
   open; continue only authorized work that does not depend on that verdict.
3. When durable Trace is enabled, keep non-commit object IDs such as tree hashes
   as plain text in HISTORY and HANDOFF Trace Anchors. Backtick-quoted hashes are
   reserved for commit provenance and must resolve as commits. Never remove
   backticks from a commit to bypass validation; classify a cross-repository
   commit with the Trace `external=repo@hash` field instead.

The auditor is independent and read-only: it reads primary files and evidence,
does not edit the candidate, and returns evidence-backed findings. The executor
must verify each finding, reconcile disagreements with the same auditor session
where practical, and preserve explicit unresolved disagreement for the operator.
A review verdict does not authorize build, deployment, runtime, secrets,
infrastructure, lifecycle or acceptance changes.

This synchronized section changes the model preference, not other project review
requirements. Explicit task-specific operator choices remain authoritative. A documented
operator-approved project model exception remains an exception until explicitly
superseded; exclusion alone is not approval of a different model. Other project
review constraints remain in force. Projects that exclude this section through
`.dockit-config.yml` must keep the exception and its authority visible.
The source policy belongs to LLM-DocKit; Claude Code's user `model` setting is a
separate runtime default and does not prove that project copies were synchronized.
<!-- DOCKIT-TEMPLATE:END independent-review-policy -->

<!-- DOCKIT-TEMPLATE:START footer -->
---

Every change must be documented. If you are unsure about a rule, ask the user before proceeding.
<!-- DOCKIT-TEMPLATE:END footer -->


<!-- DOCKIT-TEMPLATE:START delivery-evidence -->
## Optional Delivery Controls

For repeated delivery/infrastructure attempts, adopt `docs/DELIVERY_CONTRACT.md`
in the actual project mutation command. The project runs the real prerequisite
probe, records its observation, and calls `scripts/dockit-delivery-record.sh begin`
immediately before mutation; it records outcome and recovery afterward.

Copying scripts or a passing session validator is not integration. Require the
project's rerunnable negative test to demonstrate zero mutation calls for a failed
prerequisite, plus a current candidate-bound integration receipt. The journal
preserves attempt/review counts across sessions and versions. Repeating a failed
causal state or exhausting a budget requires bounded reassessment, never automatic
approval. Existing independent review and operational authority still apply.
Recovery must remain available independently of ordinary delivery checks.

Keep source publication, deployment and actual user acceptance separate. A short
HANDOFF names the observed result, current blocker and next concrete step.
<!-- DOCKIT-TEMPLATE:END delivery-evidence -->

<!-- DOCKIT-TEMPLATE:START workspace-ownership -->
### Parent-owned task workspaces

The source root contains admitted primary projects. Tasks, experiments, reviews,
disk investigations and delivery branches belong to an existing project; their
folder names never make them independent projects. A new top-level project needs
an explicit operator purpose and `devenv admission add PROJECT` after validating
its canonical repository. Visibility is independent from lifecycle and sessions.

On managed hosts use `task-workspace create --project OWNER --task ID --purpose
"Specific result"`. Worktrees live under the host's hidden worktree root and
host-local locations stay out of portable project records. Start by reading
`docs/llm/WORK_INDEX.md` when present and `task-workspace status --project .`.
After adoption or completion, export the validated `docs/llm/work/*.json` records
and index into a reviewed task checkout, update the parent's handoff/history,
validate, commit and safely publish. Record a disposition and next step even when
work is paused or incomplete. An export does not prove publication; verify the
records against a freshly fetched `refs/remotes/origin/*` reference.

Never infer deletion eligibility from age, a clean Git status, a merged branch,
or a closed task. Ignored evidence, untracked material and active processes need
separate custody checks. Preserve unknown, dirty, unpublished and active work.
Do not create task-named siblings under the source root or auto-admit directories.
The PATH guard protects supported CLI workflows; direct Git binaries and other
clients can bypass it, so project admission and reconciliation remain essential.
<!-- DOCKIT-TEMPLATE:END workspace-ownership -->
