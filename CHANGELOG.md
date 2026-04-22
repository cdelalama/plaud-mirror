# Changelog

All notable changes to Plaud Mirror are documented in this file.

This project follows Semantic Versioning (SemVer): MAJOR.MINOR.PATCH.

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
