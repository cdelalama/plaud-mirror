# Changelog

All notable changes to Plaud Mirror are documented in this file.

This project follows Semantic Versioning (SemVer): MAJOR.MINOR.PATCH.

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
