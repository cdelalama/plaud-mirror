<!-- doc-version: 0.3.1 -->
# Repository Structure Guide

This document describes the actual Plaud Mirror repository layout as of the first usable Phase 2 slice.

## Top-Level Layout

```text
plaud-mirror/
+- README.md
+- LLM_START_HERE.md
+- VERSION
+- CHANGELOG.md
+- Dockerfile
+- compose.yml
+- package.json
+- package-lock.json
+- tsconfig.base.json
+- apps/
|  +- api/
|  |  +- package.json
|  |  +- tsconfig.json
|  |  +- src/
|  |     +- cli/
|  |     +- phase1/
|  |     +- plaud/
|  |     +- runtime/
|  |     +- server.ts
|  +- web/
|     +- package.json
|     +- index.html
|     +- src/
+- packages/
|  +- shared/
+- docs/
|  +- PROJECT_CONTEXT.md
|  +- ROADMAP.md
|  +- ARCHITECTURE.md
|  +- STRUCTURE.md
|  +- VERSIONING_RULES.md
|  +- UPSTREAMS.md
|  +- llm/
|  +- operations/
+- scripts/
+- tests/
|  +- integration/
```

## Directory Descriptions

| Path | Purpose | Notes |
|------|---------|-------|
| `apps/api/` | Fastify API, Plaud adapter, encrypted secret handling, manual sync/backfill orchestration | Phase 2 runtime backend |
| `apps/web/` | React + Vite operator panel | Served by the API container |
| `packages/shared/` | Shared Zod schemas and TypeScript contracts | Source of truth for Plaud and runtime payloads |
| `tests/integration/` | Post-build integration smoke tests | Exercises built API and web artifacts |
| `docs/ROADMAP.md` | Canonical phase boundary document | Use this when scope questions appear |
| `Dockerfile` | Single-container production image | Builds API and panel together |
| `compose.yml` | Local `dev-vm` launch path | Mounts `runtime/data` and `runtime/recordings` |

## Runtime Directories

These paths are expected at runtime and should remain uncommitted:

- `data/` - SQLite DB and encrypted secrets blob
- `recordings/` - mirrored Plaud artifacts
- `.state/` - spike reports and optional local state
- `runtime/` - Docker bind mounts for local compose usage

## Key Runtime Modules

- `apps/api/src/plaud/`
  Plaud API client and region-retry logic.
- `apps/api/src/phase1/`
  The original spike utilities. Still useful for live probing and regression checks.
- `apps/api/src/runtime/`
  SQLite store, encrypted secret storage, sync/backfill service, and runtime tests.
- `apps/api/src/server.ts`
  Fastify app factory and static web serving.
- `apps/web/src/App.tsx`
  Product panel for token setup, webhook config, manual sync, backfill, and recordings list.

## Onboarding Notes

Read in this order before changing runtime scope:

1. `README.md`
2. `LLM_START_HERE.md`
3. `docs/PROJECT_CONTEXT.md`
4. `docs/ROADMAP.md`
5. `docs/ARCHITECTURE.md`
6. `docs/operations/AUTH_AND_SYNC.md`
