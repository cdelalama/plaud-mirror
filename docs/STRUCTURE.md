# Repository Structure Guide

This document describes the actual Plaud Mirror repository layout as of `v0.1.0`.

## Top-Level Layout
```
plaud-mirror/
+- README.md
+- LLM_START_HERE.md
+- VERSION
+- CHANGELOG.md
+- HOW_TO_USE.md
+- .dockit-enabled
+- .dockit-config.yml
+- docs/
|  +- PROJECT_CONTEXT.md
|  +- ARCHITECTURE.md
|  +- UPSTREAMS.md
|  +- STRUCTURE.md
|  +- VERSIONING_RULES.md
|  +- version-sync-manifest.yml
|  +- llm/
|  +- operations/
+- scripts/
|  +- bump-version.sh
|  +- check-version-sync.sh
|  +- check-upstreams.sh
|  +- dockit-generate-external-context.sh
|  +- dockit-validate-session.sh
|  +- pre-commit-hook.sh
+- config/
|  +- upstreams.tsv
+- apps/
|  +- api/
|  +- web/
+- packages/
|  +- shared/
+- tests/
|  +- integration/
+- .claude/
|  +- settings.json
|  +- rules/
|  |  +- require-docs-on-code-change.md
|  |  +- external-context-triggers.md  (generated)
|  +- skills/
|     +- update-docs/
|        +- SKILL.md
+- .github/
|  +- workflows/
|     +- doc-validation.yml
|     +- upstream-watch.yml
```

## Directory Descriptions

| Path | Purpose | Notes |
|------|---------|-------|
| `docs/` | Primary documentation for product, architecture, upstreams, and policy | Required |
| `docs/llm/` | LLM working memory: handoff, history, decisions, reviews | Required |
| `docs/operations/` | Operational runbooks for auth, deploy, contracts, and upstream watch | Required for this project |
| `docs/version-sync-manifest.yml` | Source of truth for doc-version tracking | Required |
| `.dockit-enabled` | Opt-in marker for DocKit sync from the upstream template repo | Required |
| `.dockit-config.yml` | Local DocKit config plus external-context definition | Required |
| `scripts/check-upstreams.sh` | Compares GitHub upstream state against the committed baseline | Project-specific |
| `scripts/dockit-generate-external-context.sh` | Generates local external-context block and Claude rule | Required |
| `scripts/dockit-validate-session.sh` | Validates LLM documentation discipline | Required |
| `config/upstreams.tsv` | Baseline list of tracked Plaud ecosystem upstreams | Required |
| `apps/api/` | Planned backend runtime | Empty placeholder at `v0.1.0` |
| `apps/web/` | Planned operational UI | Empty placeholder at `v0.1.0` |
| `packages/shared/` | Planned shared types/contracts/config package | Empty placeholder at `v0.1.0` |
| `tests/integration/` | Planned end-to-end and integration tests | Empty placeholder at `v0.1.0` |
| `.claude/` | Claude Code rules and skills | Local workflow support |
| `.github/workflows/upstream-watch.yml` | Scheduled upstream drift detection | Project-specific |

## Generated / Runtime Directories

These paths are expected at runtime and should remain uncommitted:
- `data/` - SQLite DB, encrypted secrets blob, internal runtime metadata
- `recordings/` - mirrored Plaud audio artifacts
- `.state/` - optional local watcher or runtime state
- `tmp/downloads/` - transient download workspace

## Custom Modules or Packages

- `apps/api/`
  Planned home for the Plaud adapter, auth manager, sync scheduler, storage coordinator, and admin API.
- `apps/web/`
  Planned home for the Docker-hosted operator UI.
- `packages/shared/`
  Planned home for config schema, webhook contracts, and shared types used by both apps.
- `config/upstreams.tsv`
  Not runtime configuration. This is governance state for tracking useful external projects.

## Naming Conventions

- Repository, directories, and files use English names.
- Environment variables should use the `PLAUD_MIRROR_` prefix.
- Upstream repos are always referenced as `owner/repo`.
- Local mirrored recordings should use the Plaud recording ID as the canonical directory key.

## Onboarding Notes

Start in this order:
1. `README.md`
2. `LLM_START_HERE.md`
3. `docs/PROJECT_CONTEXT.md`
4. `docs/ARCHITECTURE.md`
5. `docs/UPSTREAMS.md`
6. `docs/operations/AUTH_AND_SYNC.md`

Only then start implementation work in `apps/api/` or `apps/web/`.
