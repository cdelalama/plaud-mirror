<!-- doc-version: 0.11.2 -->
# Repository Structure Guide

This document describes the actual Plaud Mirror repository layout as of the first usable Phase 2 slice.

## Top-Level Layout

```text
plaud-mirror/
+- README.md
+- PRODUCT.md
+- DESIGN.md
+- LLM_START_HERE.md
+- VERSION
+- CHANGELOG.md
+- infra.contract.yml
+- Dockerfile
+- compose.yml
+- package.json
+- package-lock.json
+- .github/workflows/ci.yml
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
|  +- visual-gates/
|  |  +- 0.11.0/
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
| `apps/web/` | React + Vite operator panel | Served by the API container; v0.9.0 five-screen operator shell with the v0.9.1 full-viewport production frame and v0.9.2 Main sync UX fix. v0.9.3 is governance-only. |
| `PRODUCT.md` | Durable product brief | Single-operator audience, purpose, voice, and interaction principles |
| `DESIGN.md` | Current design system | Visual tokens, hierarchy, components, mobile rules, and destructive-action treatment |
| `.impeccable/design.json` | Machine-readable design sidecar | Mirrors the durable visual system for future frontend sessions |
| `apps/chrome-extension/` | Local Chrome companion extension for Plaud re-auth capture | Unpacked extension; sends the active Plaud tab's bearer through `/connect` |
| `packages/shared/` | Shared Zod schemas and TypeScript contracts | Source of truth for Plaud, runtime payloads, and protocol status snapshots |
| `infra.contract.yml` | Home Infra Protocol project contract | Declares `plaud-mirror-recordings-sync` for Home Infra / Infra Portal consumers |
| `docs/INFRA_CONTRACT.md` | Human explanation of `infra.contract.yml` | Explains producer/consumer boundary and status snapshot semantics |
| `docs/design/reference/` | Visual reference artifacts | `plaud-mirror-panel-standalone.html` is the v0.9.0 operator-panel source reference |
| `docs/visual-gates/0.11.0/` | Deployed UI evidence | Desktop and Android captures of the dismissed-only permanent Plaud deletion action; no action was invoked during capture |
| `tests/integration/` | Post-build integration smoke tests | Exercises built API and web artifacts |
| `scripts/run-node-tests.mjs` | Automatic Node/integration test discovery | Recursively runs every compiled `*.test.js` and integration `*.test.mjs` file |
| `.github/workflows/ci.yml` | Repository CI gate | Runs `npm test` on Node 20 for `main` and pull requests |
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
- `packages/shared/src/protocol.ts`
  Minimal `home-infra-protocol` `status-snapshot` Zod schemas used by the Plaud Mirror protocol endpoint.
- `apps/api/src/plaud/`
  Plaud API client: auth headers, region-retry on `-302`, `listEverything` pagination, `listDevices`, `getFileDetail`, `getAudioTempUrl`, and the observed trash/permanent-delete mutations. Wire-to-domain translation lives here.
- `apps/api/src/phase1/`
  The original spike utilities (probe CLI). `applyLocalFilters` is reused by both the real sync path and the backfill preview.
- `apps/api/src/runtime/`
  SQLite store (recordings, devices, sync_runs, webhook_deliveries, webhook_outbox), encrypted secret storage, sync/backfill service with pluggable scheduler, scheduler + outbox worker, operator access control primitives (`operator-auth.ts`: signed session cookies, login throttle), browser-assisted re-auth capture sessions (`capture-session.ts`, D-019), and runtime tests.
- `apps/api/src/runtime/protocol-status.ts`
  Maps `ServiceHealth` to the sanitized `home-infra-protocol` status snapshot for `plaud-mirror-recordings-sync`.
- `apps/api/src/server.ts`
  Fastify app factory: operator-session gate on `/api/*` (D-018) + session routes, public sanitized protocol status routes (`/api/protocol/status`, `/api/protocol/sync-jobs/plaud-mirror-recordings-sync/status`), browser-assisted re-auth routes (`/api/connect/start` + `/api/connect/complete`, D-019), auth, config, sync (`POST /api/sync/run` returns 202), backfill, `GET /api/sync/runs/:id`, `GET /api/devices`, `GET /api/backfill/candidates`, recordings listing + audio streaming with HTTP Range, local dismiss/restore, authenticated dismissed-only permanent Plaud deletion, and outbox admin.
- `apps/web/src/App.tsx`
  Product panel behind a session gate (`LoginGate` when operator auth is enabled) plus the `/connect` capture landing (`ConnectPlaud`, D-019). The full-viewport five-screen shell includes Main, Library, Backfill, Configuration, Operations, ES/EN operator chrome, live sync progress, playback, local dismiss/restore, outbox retry, and local-storage UI preferences. Since v0.11.0, a text-labelled permanent Plaud deletion action appears only on dismissed rows, requires one explicit confirmation, and becomes a neutral tombstone state after success. The Configuration screen starts the re-auth capture session and points the operator at the local Chrome extension; copy-only bookmarklet fallback + token extraction live in `apps/web/src/plaud-token.ts` (adapted from MIT iiAtlas).
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
