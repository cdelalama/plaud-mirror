<!-- doc-version: 0.9.1 -->
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
|  +- chrome-extension/
|     +- manifest.json
|     +- popup.html
|     +- popup.css
|     +- popup.js
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
+- config/
|  +- upstreams.tsv
+- tests/
|  +- integration/
```

## Directory Descriptions

| Path | Purpose | Notes |
|------|---------|-------|
| `apps/api/` | Fastify API, Plaud adapter, encrypted secret handling, manual sync/backfill orchestration | Phase 2 runtime backend |
| `apps/web/` | React + Vite operator panel | Served by the API container; v0.9.0 five-screen operator shell |
| `apps/chrome-extension/` | Local Chrome companion extension for Plaud re-auth capture | Unpacked extension; sends the active Plaud tab's bearer through `/connect` |
| `packages/shared/` | Shared Zod schemas and TypeScript contracts | Source of truth for Plaud and runtime payloads |
| `docs/design/reference/` | Visual reference artifacts | `plaud-mirror-panel-standalone.html` is the v0.9.0 operator-panel source reference |
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

- `packages/shared/src/plaud.ts`
  Wire-level Zod schemas for Plaud's server responses (`sn`, `data_file_list`, `data_devices`, etc.). Only imported by the Plaud client.
- `packages/shared/src/runtime.ts`
  Domain-level Zod schemas (`RecordingMirror`, `Device`, `SyncRunSummary`, `BackfillCandidate`, `ServiceHealth`, ...) shared by API, store, and web panel.
- `apps/api/src/plaud/`
  Plaud API client: auth headers, region-retry on `-302`, `listEverything` pagination, `listDevices`, `getFileDetail`, `getAudioTempUrl`. Wire→domain translation lives here.
- `apps/api/src/phase1/`
  The original spike utilities (probe CLI). `applyLocalFilters` is reused by both the real sync path and the backfill preview.
- `apps/api/src/runtime/`
  SQLite store (recordings, devices, sync_runs, webhook_deliveries, webhook_outbox), encrypted secret storage, sync/backfill service with pluggable scheduler, scheduler + outbox worker, operator access control primitives (`operator-auth.ts`: signed session cookies, login throttle), browser-assisted re-auth capture sessions (`capture-session.ts`, D-019), and runtime tests.
- `apps/api/src/server.ts`
  Fastify app factory: operator-session gate on `/api/*` (D-018) + session routes, browser-assisted re-auth routes (`/api/connect/start` + `/api/connect/complete`, D-019), auth, config, sync (`POST /api/sync/run` returns 202), backfill, `GET /api/sync/runs/:id`, `GET /api/devices`, `GET /api/backfill/candidates`, recordings listing + audio streaming with HTTP Range, delete/restore, outbox admin.
- `apps/web/src/App.tsx`
  Product panel behind a session gate (`LoginGate` when operator auth is enabled) plus the `/connect` capture landing (`ConnectPlaud`, D-019). The v0.9.0 shell absorbs `docs/design/reference/plaud-mirror-panel-standalone.html`: rail navigation, Main cockpit, Library, Backfill, Configuration, Operations, ES/EN operator chrome, live sync progress, status segments, recent errors/runs, outbox retry, and local-storage UI preferences. The Configuration screen starts the re-auth capture session and points the operator at the local Chrome extension; copy-only bookmarklet fallback + token extraction live in `apps/web/src/plaud-token.ts` (adapted from MIT iiAtlas).
- `apps/chrome-extension/`
  Manifest V3 local extension ("Plaud Mirror Connector"). It injects a storage reader into the active Plaud tab, extracts the user bearer, and redirects to the mirror's `/connect#token=...` page. It stores only the mirror origin, not the token.

## Onboarding Notes

Read in this order before changing runtime scope:

1. `README.md`
2. `LLM_START_HERE.md`
3. `docs/PROJECT_CONTEXT.md`
4. `docs/ROADMAP.md`
5. `docs/ARCHITECTURE.md`
6. `docs/operations/AUTH_AND_SYNC.md`
