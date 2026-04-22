<!-- doc-version: 0.1.1 -->
# Plaud Mirror Architecture

> Version: 0.1.1
> Last Updated: 2026-04-22
> Status: Design
> Authors: Plaud Mirror maintainers

## Overview

Plaud Mirror is a self-hosted service that runs on a server, most likely as Docker containers. It polls Plaud, stays authenticated for as long as possible, downloads new audio recordings, stores them locally, and emits a webhook or other handoff signal so downstream tools can process speech-to-text or archiving.

The intended users are operators running their own infrastructure who care more about reliable mirroring than about reproducing Plaud's full product surface. Primary inputs are Plaud credentials or tokens plus operator configuration. Primary outputs are local audio files, sync metadata, status information, and downstream notifications.

## Non-negotiables

- Plaud Mirror is audio-first. Downloading the audio artifact is the core job.
- Staying logged in is a first-class feature, not an implementation detail.
- Secrets must never be stored or logged in plaintext.
- Upstream changes in auth, token extraction, regional behavior, and export/download flows must be easy to detect and review.
- The core Plaud auth/download path must remain auditable in this repository, even when upstream code informs the design.
- MIT remains the intended project license. AGPL or no-license upstreams are reference-only unless a licensing decision is explicitly documented.

## High-Level Architecture

1. `packages/shared/`
   Shared schemas for config, recording metadata, webhook payloads, and health/status models.
2. `apps/api/`
   Backend service containing the Plaud adapter, auth manager, sync engine, storage coordinator, webhook delivery, and admin API.
3. `apps/web/`
   Operational UI for setup, health, auth visibility, manual sync triggers, and recordings browser.
4. `config/`
   Human-managed configuration assets, including tracked upstream baselines.
5. `scripts/`
   Repo operations: DocKit validation, external-context generation, version sync, and upstream-change detection.

## Implementation Stack

Recommended stack for the first usable release, subject to final confirmation after the Phase 1 Plaud spike:

- **Monorepo:** TypeScript, Node.js, one shared toolchain across `apps/` and `packages/`.
- **`apps/api/`:** Fastify service covering the Plaud adapter, session/auth management, sync and backfill orchestration, webhook outbox, and admin HTTP API.
- **`apps/web/`:** React + Vite product panel for setup, sync/backfill controls, auth state, recordings list, and error visibility. Not just an operator console — it is the product-facing surface for a single operator.
- **`packages/shared/`:** Zod schemas and TypeScript types for config, HTTP responses, recording metadata, jobs, and webhook payloads. Single source of truth for contracts shared between API and web.
- **Persistence:** SQLite for config, recording index, job state, and delivery attempts. Filesystem storage for mirrored audio under `recordings/<recording-id>/`.
- **Queueing model:** same-process jobs. No Redis, no external queue in v1. Revisit only if concurrency or durability pressure demonstrably requires it.
- **Secrets at rest:** encrypted local blob. The encryption key comes from environment (e.g. `PLAUD_MIRROR_MASTER_KEY`), supplied by the surrounding deployment.
- **Configuration source:** plain environment variables at the application boundary. In the owner's infrastructure those env vars are injected by Doppler (workspace Xibstar, project `plaud-mirror`). For OSS users, any env-var mechanism (`.env`, Docker env, systemd `EnvironmentFile`) works equivalently. The application must not depend on Doppler directly.

## Key Flows

### Flow 1: Session Bootstrap and Renewal

1. For the first usable release, the operator configures a Plaud bearer token in the UI.
2. Auth Manager validates the token and records `expires_at`, region, and last successful check.
3. If the token expires or a Plaud call returns `401`, the service moves into a degraded auth state and requires operator action to supply a fresh token.
4. In a later phase, if `credentials-relogin` is implemented, Auth Manager may perform a controlled re-login and rotate the stored token.
5. Web UI shows the resulting auth state: healthy, expiring soon, degraded, or failed, plus the recovery path available in the current phase.

### Flow 2: Audio Mirror Sync

1. Scheduler runs on a configurable interval and asks Plaud for visible recordings.
2. Sync Engine compares remote recordings against local state.
3. New or changed recordings are queued for audio export and download.
4. Plaud Adapter resolves the temporary audio URL and downloads the original audio artifact.
5. Artifact Store writes the file into the canonical layout and records sync metadata.
6. Delivery module emits a webhook so external STT or indexing systems can continue the pipeline.

### Flow 3: Upstream Watch

1. `scripts/check-upstreams.sh` reads `config/upstreams.tsv`.
2. For each tracked upstream, it fetches the current release tag or default-branch commit from GitHub.
3. The result is compared against the repository baseline.
4. Changes are reported as `CHANGED` and trigger human review before the baseline is updated.

## Contracts

Stable contracts planned for v1:
- Admin HTTP API for configuration, health, sync control, and recordings listing
- HMAC-signed webhook payload for `recording.synced`, shared by ongoing sync and historical backfill
- On-disk artifact layout for mirrored recordings
- Internal config schema shared by API and web UI

See [docs/operations/API_CONTRACT.md](operations/API_CONTRACT.md) for the planned surface.

## Storage & Data Layout

Planned runtime layout:
- `data/app.db`
  SQLite database for config metadata, recording index, sync history, and delivery attempts
- `data/secrets.enc`
  Encrypted blob for Plaud credentials and token metadata
- `recordings/<recording-id>/audio.<ext>`
  Mirrored audio artifact in the original downloaded format
- `recordings/<recording-id>/metadata.json`
  Local metadata snapshot derived from Plaud plus mirror state
- `.state/upstream-watch/`
  Optional future cache for generated reports or review state

Retention policy:
- Audio files are durable by default and not auto-deleted.
- Temp download artifacts are disposable.
- Delivery retries keep bounded history in the local database.

## Security & Privacy Notes

- AuthN/AuthZ:
  Single-operator admin model for v1, with local service access only unless explicitly exposed behind another auth layer
- Secrets management:
  Store secrets encrypted at rest, with the encryption key supplied via Docker secret or `PLAUD_MIRROR_MASTER_KEY`
- Third-party dependency policy:
  Upstream code may inform implementation, but the critical auth and download path should not disappear behind an opaque binary or unreviewed client dependency
- Data sensitivity:
  Plaud titles, timestamps, tags, and audio content may contain sensitive personal or business information
- Logging:
  Never log passwords, bearer tokens, or full temporary download URLs

## Roadmap

1. Phase 0 - Documentation and repository bootstrap
2. Phase 1 - Plaud spike and data-model proof on `dev-vm`
3. Phase 2 - First usable internal release: product UI, encrypted persisted manual-token auth, filtered backfill, and HMAC-signed webhook delivery
4. Phase 3 - Continuous sync and resilience: scheduler, resumable backfill, retries, and stronger health/status surfaces
5. Phase 4 - Optional automatic re-login if a reliable non-browser path exists
6. Phase 5 - Deployment hardening and NAS rollout
7. Phase 6 - OSS preparation and public quickstart cleanup
