<!-- doc-version: 0.1.0 -->
# LLM Work Handoff

This file is the current operational snapshot. Long-form rationale lives in `docs/llm/DECISIONS.md`.

## Current Status

- Last Updated: 2026-04-22 - Codex GPT-5
- Session Focus: Publish the initial Plaud Mirror repository and leave the bootstrap state ready for new sessions
- Status: `v0.1.0` is in place, the public GitHub repository exists at `cdelalama/plaud-mirror`, and the initial bootstrap commit is published on `origin/main`. Core docs, upstream baseline tracking, external-context config, and an upstream-watch script/workflow stub are present. Runtime implementation has not started.

## Project Summary

Plaud Mirror is a planned self-hosted service that:
- stays authenticated against Plaud
- polls for new recordings
- mirrors audio locally
- exposes a small operational web UI
- notifies downstream systems that perform STT or indexing

Direct inspirations:
- `rsteckler/applaud` for service shape, poller split, and operational UI ideas
- `iiAtlas/plaud-recording-downloader` for token and regional heuristics
- `JamesStuder/Plaud_API` and `JamesStuder/Plaud_BulkDownloader` for endpoint and download-flow reference

License boundary:
- MIT upstreams can be reused with review and attribution
- AGPL and no-license repos are reference-only until a documented decision changes that

## Top Priorities

1. Build the backend skeleton in `apps/api/`
2. Implement Auth Manager with token-first mode and optional credential re-login
3. Implement recording discovery plus audio download to the canonical local layout
4. Add the first web UI settings/status shell in `apps/web/`
5. Wire Docker deployment and local smoke tests

## Open Questions

- Final runtime stack is still open, although a TypeScript monorepo shape is implied by the current folder structure.
- Whether v1 should include automatic browser-profile token import, or only pasted bearer token plus credentials.
- Whether to keep original audio format only, or add optional local transcode in the first milestone.

## Testing Notes

- `dotnet` is not installed on this machine, so the original C# downloader was only inspected, not executed.
- Plaud Mirror runtime does not exist yet, so only documentation, repository structure, GitHub wiring, and repository validation were checked in this session.

## Key Decisions (Links)

- D-001: Plaud Mirror is an audio-first mirror, not an STT product
- D-002: The project is server-first with a web UI, not browser-only
- D-003: Auth strategy is dual-mode: token-first plus optional credential-based renewal
- D-004: Upstream-watch discipline is mandatory for auth and download resilience
- D-005: MIT remains the intended license boundary

See `docs/llm/DECISIONS.md` for rationale.

## Do Not Touch

- `config/upstreams.tsv` without documenting why the baseline changed
- `docs/UPSTREAMS.md` licensing boundaries without explicit user approval
- `.dockit-config.yml` external-context paths unless the infra-doc repository moved
