<!-- doc-version: 0.1.0 -->
# Plaud Mirror Architecture

> Version: 0.1.0
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

## Key Flows

### Flow 1: Session Bootstrap and Renewal

1. Operator configures either a Plaud bearer token or Plaud account credentials.
2. Auth Manager validates the token and records `expires_at`, region, and last successful check.
3. If expiry is near and credentials exist, Auth Manager performs a controlled re-login and rotates the stored token.
4. If a Plaud call returns `401`, the service performs one forced re-login and retries the original operation once.
5. Web UI shows the resulting auth state: healthy, expiring soon, degraded, or failed.

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
- Webhook payload for `recording.synced`
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
2. Phase 1 - Backend and UI skeleton with local config
3. Phase 2 - Plaud auth manager plus token renewal
4. Phase 3 - Audio sync, local storage, and webhook delivery
5. Phase 4 - Hardened upstream watch automation and operator UX
