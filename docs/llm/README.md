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
