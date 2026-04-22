# Changelog

All notable changes to Plaud Mirror are documented in this file.

This project follows Semantic Versioning (SemVer): MAJOR.MINOR.PATCH.

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
