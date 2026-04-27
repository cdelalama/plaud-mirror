<!-- doc-version: 0.5.5 -->
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

## Current Status (2026-04-27)

Plaud Mirror `v0.5.5` ships **D-014 full** — full health observability. `GET /api/health` now also returns a `lastErrors` ring buffer (cross-subsystem error history, in-memory, capped at 20 entries, most-recent-first) and `recentSyncRuns` (last 5 finished sync runs from SQLite, `finished_at DESC`). The scheduler-manager `onTick` callback, the outbox-worker `onDeliveryError` callback, and the service `runSync` catch path all feed `service.recordError(subsystem, message, context?)`, so the operator sees a unified chronology without checking three different surfaces. Plus governance: `prose-drift` validator hardened from `WARN` to `FAIL` after one calibration release; new `check_unabsorbed_artifact()` ninth validator check (D-017) detecting local scripts/rules not present upstream in LLM-DocKit, with a baseline classifying `check-prose-drift.sh` as transient (`df_id: DF-028`) and `check-upstreams.sh` plus `external-context-triggers.md` as permanent project-specific. Test count: 113 → 116 (105 backend + 11 web).

`v0.5.4` was governance-only: Layer-1 doc-drift enforcement (D-016). New `scripts/check-prose-drift.sh` (POSIX sh, four rules, `--strict` / `--review` / `--update-baseline` modes, auditable baseline file with `transient_until` enforcement) wired as the eighth `dockit-validate-session` check; global meta-rule in `~/.claude/CLAUDE.md` ("Before adding a passive rule") + PostToolUse hook in `~/.claude/hooks/check-passive-rule.sh` complete the cross-project enforcement layer.

The runtime baseline `v0.5.5` carries from `v0.5.3` is the **durable webhook outbox** (D-013): each successfully-mirrored recording pushes its `recording.synced` payload into a `webhook_outbox` SQLite table, a dedicated worker retries with exponential backoff (30 s → 8 h across 8 attempts, ~16 h cumulative window) before escalating to `permanently_failed`. The Configuration tab has a "Webhook outbox" card with live counters (`pending` / `retry_waiting` / `permanently_failed` / `oldestPendingAgeMs`), a list of permanently-failed items, and a per-row Retry button. The HMAC signature is recomputed at delivery time so rotating `webhookSecret` mid-flight is honoured. Routes: `GET /api/outbox` (failed list only) and `POST /api/outbox/:id/retry`.

The earlier `0.5.x` baseline still applies: in-process continuous sync scheduler (D-012, stabilized in `v0.5.1`, panel-driven from `v0.5.2`), two-layer anti-overlap, SQLite-persisted scheduler config. `SyncRunSummary.enqueued` counts webhook payloads pushed to the outbox during the run; `delivered` keeps its original semantic ("delivered synchronously inside this run") and structurally stays at 0 from `v0.5.3` onwards.

Operators upgrading from `0.4.x` should skip `v0.5.0` (scheduler default-on regression + missing service-layer anti-overlap) and go directly to `v0.5.5`.

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
