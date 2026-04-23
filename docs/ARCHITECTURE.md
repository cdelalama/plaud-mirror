<!-- doc-version: 0.4.1 -->
# Plaud Mirror Architecture

> Version: 0.4.1
> Last Updated: 2026-04-23
> Status: Phase 2 vertical slice (extended through 0.4.x with local curation)

## Overview

Plaud Mirror is a single-operator, server-first service that:

1. stores an encrypted Plaud bearer token,
2. validates and uses that token against Plaud,
3. mirrors audio artifacts into `recordings/<recording-id>/`,
4. records local state in SQLite,
5. emits a signed webhook for each mirrored recording,
6. serves a local web panel for setup and manual control.

## Runtime Shape

- **Backend:** Fastify in `apps/api`
- **Panel:** React + Vite in `apps/web`
- **Shared contracts:** Zod schemas in `packages/shared`
- **State store:** SQLite at `data/app.db`
- **Secrets:** encrypted JSON blob at `data/secrets.enc`
- **Artifacts:** filesystem under `recordings/<recording-id>/`
- **Packaging:** single Docker container serving both API and panel

## What Phase 2 Actually Means

Phase 2 is the first usable manual slice. It includes:

- token save + validation
- manual sync
- filtered historical backfill
- recordings list
- webhook configuration
- HMAC-signed delivery attempts
- Docker launch on `dev-vm`

Phase 2 does **not** include:

- scheduler-driven unattended sync
- resumable backfill
- durable retry outbox
- automatic re-login

Those belong to [Phase 3 and Phase 4](ROADMAP.md).

## Key Flows

### Auth

1. Operator pastes a Plaud bearer token in the web panel.
2. API validates it with `/user/me`.
3. Token is encrypted with `PLAUD_MIRROR_MASTER_KEY` and stored at rest.
4. Auth status is exposed through `/api/auth/status` and `/api/health`.

### Sync / Backfill

1. Operator triggers `/api/sync/run` or `/api/backfill/run`.
2. Service validates the stored token.
3. Plaud listing data is fetched from `/file/simple/web`.
4. Local filters are applied for date range, serial number, and scene.
5. Each selected recording resolves detail and temp URL, downloads the artifact, and writes:
   - `recordings/<recording-id>/audio.<ext>`
   - `recordings/<recording-id>/metadata.json`
6. Recording state is upserted into SQLite.

### Webhook

1. After mirroring, the service builds a `recording.synced` payload.
2. If a webhook URL and secret are configured, it signs the payload with HMAC-SHA256.
3. Delivery result is persisted in SQLite, even when the request fails.

### Local curation (audition then dismiss)

1. The operator auditions an audio file inline in the web panel via `GET /api/recordings/<id>/audio`, which streams the local file with its original content-type. Recording ids are validated against a strict character allowlist before any filesystem access, and the resolved path is confirmed to stay inside the configured recordings directory.
2. The operator may issue `DELETE /api/recordings/<id>`. The service unlinks the local audio file, clears `localPath` and `bytesWritten` on the SQLite row, and sets `dismissed=true` with a `dismissedAt` timestamp. Plaud itself is not touched.
3. Subsequent sync/backfill runs detect `dismissed=true` and skip the recording without attempting to re-download it.
4. The operator can restore a dismissed recording via `POST /api/recordings/<id>/restore`, which clears `dismissed` and allows the next sync to mirror the audio again.

## Storage Layout

- `data/app.db`
  SQLite state for config, auth metadata, recordings (including `dismissed` / `dismissed_at` columns for local-only curation), sync runs, and webhook delivery attempts
- `data/secrets.enc`
  Encrypted secret blob containing the Plaud token and optional webhook secret
- `recordings/<recording-id>/audio.<ext>`
  Original downloaded audio
- `recordings/<recording-id>/metadata.json`
  Mirror metadata written at download time
- `.state/phase1/latest-report.json`
  Optional spike artifact from the Phase 1 CLI

## Security Notes

- Tokens and webhook secrets are never stored in plaintext.
- Temporary Plaud download URLs must not be logged in full.
- This remains a single-operator service; external auth is out of scope for now.

## Next Architectural Step

The next architectural jump is Phase 3:

- scheduler loop
- resumable backfill
- explicit retry/outbox flow for webhooks
- more robust degraded-state handling
