<!-- doc-version: 0.8.0 -->
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

## Current Status (2026-06-16, v0.8.0)

Plaud Mirror `v0.8.0` is the current **Phase 4 (re-auth)** release. `v0.7.0` introduced the browser-assisted `/connect` handshake (D-019): a panel-initiated single-use `captureId` lets the operator refresh the ~300-day Plaud bearer with no DevTools and no stored password. It was chosen after confirming the operator's account is Google SSO (so it has no password and Plaud forbids adding one, killing credentials-login) and parking the official OAuth/MCP as deferred/watch (not disproven). `v0.7.1`-`v0.7.6` patched the bookmarklet delivery path (popup timing, copy install, encoding, token type/region, public-error hygiene, masked-token guard, shorter visible marker). The final finding was decisive: React-rendered `javascript:` links are not a reliable way to install a bookmarklet, because React replaces the `href` with a defensive throw before Chrome stores it. `v0.8.0` therefore adds a local Chrome companion extension as the recommended capture surface. The extension reads the active Plaud tab's browser storage (`pld_tokenstr` first, scan fallback), redirects that tab to `/connect#token=...`, stores only the mirror origin, and never stores or logs the token. Manual token paste and copy-only bookmarklet remain fallback paths; Telegram is explicitly not a capture channel.

The `v0.6.x` line this builds on was the **Phase 3 hardening + tooling** sequence, forced by the 2026-06-10 security review: `v0.6.0` operator access control (D-018 — `PLAUD_MIRROR_ADMIN_PASSPHRASE` + signed HttpOnly session cookie gating `/api/*`, login screen, throttle, health PII redaction), startup crash recovery (D-013 amendment — orphaned `running`/`delivering` rows recovered at boot, at-least-once accepted), and Plaud client timeouts; then `v0.6.1` (LLM-DocKit 4.8.2 sync), `v0.6.2` (Doppler passphrase helper `scripts/set-admin-passphrase.sh`), `v0.6.3` (terminal-echo fix). The operator access control is armed in production (passphrase in Doppler, secondary "Startup Embassy" account). Test count: 147 (126 Node + 21 web).

The `v0.5.5` runtime baseline underneath: **D-014 full** health observability (`lastErrors` ring buffer capped at 20, `recentSyncRuns` last 5 finished runs on `/api/health`) plus the D-016/D-017 governance layers (`prose-drift` at FAIL, `unabsorbed-artifact` baseline).

The runtime baseline carried from `v0.5.3` is the **durable webhook outbox** (D-013): each successfully-mirrored recording pushes its `recording.synced` payload into a `webhook_outbox` SQLite table, a dedicated worker retries with exponential backoff (30 s → 8 h across 8 attempts, ~16 h cumulative window) before escalating to `permanently_failed`. The Configuration tab has a "Webhook outbox" card with live counters (`pending` / `retry_waiting` / `permanently_failed` / `oldestPendingAgeMs`), a list of permanently-failed items, and a per-row Retry button. The HMAC signature is recomputed at delivery time so rotating `webhookSecret` mid-flight is honoured. Routes: `GET /api/outbox` (failed list only) and `POST /api/outbox/:id/retry`.

The earlier `0.5.x` baseline still applies: in-process continuous sync scheduler (D-012, stabilized in `v0.5.1`, panel-driven from `v0.5.2`), two-layer anti-overlap, SQLite-persisted scheduler config. `SyncRunSummary.enqueued` counts webhook payloads pushed to the outbox during the run; `delivered` keeps its original semantic ("delivered synchronously inside this run") and structurally stays at 0 from `v0.5.3` onwards.

Operators upgrading from `0.4.x` should skip `v0.5.0` (scheduler default-on regression + missing service-layer anti-overlap) and go directly to `v0.6.0`.

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
- fully unattended re-login
- NAS validation

## Phase Boundaries

The roadmap is normative. See [docs/ROADMAP.md](ROADMAP.md).

Short version:

1. Phase 1 proved the Plaud path.
2. Phase 2 ships the first manual usable product slice.
3. Phase 3 adds unattended operation and resilience.
4. Phase 4 revisits re-auth and renewal strategy.
5. Phase 5 hardens deployment and validates NAS.
6. Phase 6 prepares public OSS fit and finish.

## References

- [docs/ROADMAP.md](ROADMAP.md)
- [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/operations/API_CONTRACT.md](operations/API_CONTRACT.md)
- [docs/operations/AUTH_AND_SYNC.md](operations/AUTH_AND_SYNC.md)
