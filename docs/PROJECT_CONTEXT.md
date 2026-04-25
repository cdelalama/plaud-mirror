<!-- doc-version: 0.5.0 -->
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

Plaud Mirror `v0.5.0` is the **first Phase 3 release**: it carries forward everything Phase 2 shipped (manual vertical slice + local-only curation + UX polish + Mode B sync + classic pagination + stable `#N` sequence numbers + async-202 sync with live-progress polling + cached device catalog + backfill dry-run preview) and adds the in-process **continuous sync scheduler** (D-012) plus a partial **health observability surface** (D-014, scheduler subset). The scheduler is opt-in via `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` (0 disables it; defaults to 15 min when set; 60 s floor) and uses an inflight-flag anti-overlap guardrail in addition to the service-level `getActiveSyncRun` serialization. `GET /api/health` now reports a `scheduler` block — `enabled`, `intervalMs`, `nextTickAt`, `lastTickAt`, `lastTickStatus` (`completed` / `failed` / `skipped`), `lastTickError` — alongside the existing fields, and the `phase` string flips to `"Phase 3 - unattended operation"` when the scheduler is enabled. Webhook outbox (D-013) and full health observability (lastErrors buffer, outbox backlog) are deferred to `v0.5.1` / `v0.5.2`.

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

- durable webhook outbox with retry/backoff (next: v0.5.1)
- full health observability surface (`lastErrors` ring buffer, outbox backlog) (next: v0.5.2)
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
