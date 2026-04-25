<!-- doc-version: 0.5.2 -->
# Project Context - Plaud Mirror

## Vision

Build a self-hosted Plaud mirror that gets the original audio artifact out of Plaud and into local infrastructure with low operator friction.

## Objectives

- Persist mirrored audio locally in a predictable layout.
- Offer a small web panel for auth, visibility, and manual control.
- Deliver a generic webhook that downstream systems can consume.
- Keep auth and download behavior auditable in-repo.
- Track upstream changes that can break or improve the Plaud path.

## Architectural Summary

Plaud Mirror is a server-first product with two runtime surfaces:

- `apps/api/`: Fastify API plus same-process worker logic
- `apps/web/`: React/Vite operator panel served by the API runtime

Persistence is split between SQLite for state/indexes and the filesystem for mirrored audio artifacts. Secrets are encrypted at rest with a master key supplied by the surrounding deployment.

## Current Status (2026-04-25)

Plaud Mirror `v0.5.2` makes the Phase 3 scheduler **operator-controllable from the web panel**: the Configuration tab now has a "Continuous sync scheduler" card showing the live status (`enabled`, `interval`, `next tick`, `last tick`, `last tick reason`) and a form to set the interval in minutes. The interval persists in SQLite, hot-applies via a new `SchedulerManager` (no container restart), and survives restarts. The `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` env var is downgraded to a **bootstrap-only seed** that pre-populates the SQLite row on a fresh database — once the operator touches the panel, the env var is irrelevant on every subsequent boot. The release also carries forward everything `v0.5.1` stabilized: the in-process continuous sync scheduler (D-012), the partial health observability surface (D-014, scheduler subset), and the two-layer anti-overlap (service-level via `startOrReuseMirror` consulting `getActiveSyncRun`, scheduler-level via the `inflight` flag). `GET /api/health` reports the same `scheduler` block as before; the `phase` string flips to `"Phase 3 - unattended operation"` when the scheduler is enabled.

Operators upgrading from `0.4.x` should skip `v0.5.0` (scheduler default-on regression + missing service-layer anti-overlap) and go directly to `v0.5.2`. Webhook outbox (D-013) and full health observability (lastErrors buffer, outbox backlog) are now deferred to `v0.5.3` / `v0.5.4` — pushed back one more slot because the `v0.5.2` UX work absorbed the slot the outbox was holding.

The Phase 2 slice it inherits: a live Fastify API, a web panel for token setup, webhook configuration, sync/backfill controls, recordings visibility with inline audio playback, encrypted persisted manual bearer-token auth, manual sync and filtered historical backfill (async-202, with a `limit=0` "refresh server stats" path), SQLite-backed recording and delivery state (including `dismissed` / `dismissed_at` columns for local curation), immediate HMAC-signed webhook delivery with persisted attempt logging, a confirmed local-only dismiss/restore flow that never touches Plaud, Docker packaging for `dev-vm` running as non-root `USER 1000:1000`, and the original Phase 1 spike CLI for direct Plaud probing. Concretely:

- a live Fastify API
- a web panel for token setup, webhook configuration, sync/backfill controls, and recordings visibility
- encrypted persisted manual bearer-token auth
- manual sync and filtered historical backfill (async: 202-then-poll, with a `limit=0` "refresh server stats" path)
- SQLite-backed recording and delivery state (including `dismissed`/`dismissed_at` columns for local curation)
- immediate HMAC-signed webhook delivery with persisted attempt logging
- inline audio playback per recording, with a confirmed local-only dismiss/restore flow that never touches Plaud
- Docker packaging for `dev-vm`, running as non-root `USER 1000:1000`
- the original Phase 1 spike CLI for direct Plaud probing

What it still does not have:

- durable webhook outbox with retry/backoff (next: v0.5.3)
- full health observability surface (`lastErrors` ring buffer, outbox backlog) (next: v0.5.4)
- resumable backfill
- automatic re-login
- NAS validation

## Phase Boundaries

The roadmap is normative. See [docs/ROADMAP.md](ROADMAP.md).

Short version:

1. Phase 1 proved the Plaud path.
2. Phase 2 ships the first manual usable product slice.
3. Phase 3 adds unattended operation and resilience.
4. Phase 4 revisits automatic re-login.
5. Phase 5 hardens deployment and validates NAS.
6. Phase 6 prepares public OSS fit and finish.

## References

- [docs/ROADMAP.md](ROADMAP.md)
- [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/operations/API_CONTRACT.md](operations/API_CONTRACT.md)
- [docs/operations/AUTH_AND_SYNC.md](operations/AUTH_AND_SYNC.md)
