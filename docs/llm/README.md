# LLM Docs Index

This folder is the durable working memory for Plaud Mirror.

## Files

- `docs/llm/HANDOFF.md`
  Current operational snapshot, next steps, and high-priority warnings.
- `docs/llm/HISTORY.md`
  Append-only session log. Every code or documentation session adds one entry.
- `docs/llm/DECISIONS.md`
  Stable rationale for product, architecture, auth, storage, and licensing choices.
- `docs/llm/REVIEWS.md`
  Review notes, quality gates, and follow-up checks. Entries with non-trivial pushback use the enriched structure documented at the top of that file (Points of Agreement / Points Raised / Summary Outcome / Follow-Through Landed) so the reasoning behind each decision survives future sessions.

## Rules of Thumb

- If it is "what is happening now": `HANDOFF.md`
- If it is "what changed this session": `HISTORY.md`
- If it is "why the project is shaped this way": `DECISIONS.md`
- If it is "what still needs formal review": `REVIEWS.md`

## Enforced Sync Rules

Some sync rules between these files and the repository are enforced by `scripts/dockit-validate-session.sh` (exit code 1 on failure, also wired through the pre-commit hook and CI):

- `handoff-date` — HANDOFF "Last Updated" must match today's date.
- `history-entry` — HISTORY.md must have an entry for today.
- `decisions-referenced` — every `D-xxx` ID referenced in HANDOFF must exist in `DECISIONS.md`.
- `handoff-start-here-sync` — HANDOFF "Current Status" → `Last Updated:` must equal the matching line in `LLM_START_HERE.md` "Current Focus (Snapshot)". If you change one, change the other in the same session.
- `version-sync` — all tracked doc-version markers must equal the project `VERSION`.
- `external-context` — files declared under `external_context.read` in `.dockit-config.yml` must exist.

Other rules (e.g. keeping `STRUCTURE.md` aligned with the repo tree, keeping `ARCHITECTURE.md` in sync with external infra docs) are documented in `LLM_START_HERE.md` "doc-sync-rules" but are not yet mechanically enforced.

## Required Companion Docs

For Plaud Mirror, LLMs should usually read these alongside the LLM docs:
- `docs/PROJECT_CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/UPSTREAMS.md`
- `docs/operations/AUTH_AND_SYNC.md`

## Encoding

Keep `docs/llm/*` ASCII-only when possible.

## Glossary / Owner Shorthand

The project owner uses a few abbreviations in conversation. Treat them as equivalent to the full names when reading instructions:

- **HO** → `docs/llm/HANDOFF.md` (the handoff). E.g. "escribe en el HO" = "update HANDOFF.md".

When in doubt, confirm the expansion in a single sentence before acting rather than guessing.
