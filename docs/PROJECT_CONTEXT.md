<!-- doc-version: 0.10.0 -->
# Project Context - Plaud Mirror

## Vision

Build a self-hosted Plaud mirror that gets the original audio artifact out of Plaud and into local infrastructure with low operator friction.

## Objectives

- Persist mirrored audio locally in a predictable layout.
- Offer a small web panel for auth, visibility, and manual control.
- Deliver a generic webhook that downstream systems can consume.
- Publish Plaud recording sync status through the shared `home-infra-protocol`
  contract so infra consumers can reason about freshness and health.
- Keep auth and download behavior auditable in-repo.
- Track upstream changes that can break or improve the Plaud path.

## Architectural Summary

Plaud Mirror is a server-first product with two runtime surfaces:

- `apps/api/`: Fastify API plus same-process worker logic
- `apps/web/`: React/Vite operator panel served by the API runtime

Persistence is split between SQLite for state/indexes and the filesystem for mirrored audio artifacts. Secrets are encrypted at rest with a master key supplied by the surrounding deployment.

## Current Status (2026-06-21, v0.10.0)

Plaud Mirror `v0.10.0` opens **Phase 5 infra/protocol integration** while preserving the existing sync engine. It adds `home-infra-protocol` adoption for the Plaud recording sync: `infra.contract.yml` declares `plaud-mirror-recordings-sync`, `docs/INFRA_CONTRACT.md` explains the producer/consumer boundary, and the API publishes a public sanitized status snapshot at `/api/protocol/sync-jobs/plaud-mirror-recordings-sync/status` (alias `/api/protocol/status`). The snapshot maps existing runtime truth (`/api/health`, `sync_runs`, scheduler state, outbox counters) into the protocol's `observed_at`, `condition`, `severity`, `summary`, and `checks[]` shape without exposing Plaud account PII, tokens, webhook secrets, or raw secret-bearing errors.

The sync job is declared as `schedule.mode: manual` because the live scheduler is still disabled until the Phase 3 soak is deliberately started. When the scheduler becomes the normal operating mode, the contract should move to `internal-loop` with a concrete cadence and `stale_after > cadence`. This is not a rewrite of the Plaud sync/download pipeline; it is the protocol surface that lets Home Infra, Infra Portal, Hermes, and future agents consume Plaud Mirror's sync state consistently.

The `v0.9.6` patch underneath keeps the `v0.9.0` reference-driven panel, the `v0.9.1` full-viewport shell, the `v0.9.2` Main cockpit sync fix, the `v0.9.3` DocKit trace-protocol governance merge, the `v0.9.4` Library playback/scroll fix, and the `v0.9.5` mobile shell fix, then syncs LLM-DocKit 4.9.6 governance/tooling: flexible HISTORY format validation, Trace v1.3 chat `Sent` guidance with seconds, expanded version marker handlers, preserved Plaud Mirror local validator guardrails, and `package-lock.json` version enforcement.

The `v0.9.5` patch underneath made the mobile shell usable: phone navigation now has a labeled `Vista` / `View` selector instead of icon-only rail buttons, the status strip collapses to one compact chip row, and Library dismiss/restore actions stay pinned to the top-right of mobile rows.

The `v0.9.4` patch underneath fixed the redesigned Library: Compact Play starts the native row audio, Full mode uses a wider desktop player column, and the recordings table owns its scroll region under the fixed Library header/toolbar/pagebar.

The `v0.9.3` patch underneath absorbed the DocKit trace-protocol sync without losing Plaud Mirror's local guardrails (`handoff-start-here-sync`, `prose-drift`, `unabsorbed-artifact`, and `json-version` package-manifest checking). The validator now runs 12 checks: the previous 11 plus `trace-protocol`, skipped unless explicitly enabled in `.dockit-config.yml`.

The `v0.9.2` patch underneath fixed the Main cockpit sync action: "Sync missing" no longer inherits the Historical Backfill form's conservative `limit=1`; it sends the displayed missing count as the sync limit, capped at the existing backend ceiling of 1000, and asks for confirmation for high-volume downloads. No backend API, auth, sync engine, storage, secret, or `.env` behavior changed.

The `v0.9.1` patch underneath fixed the production shell: the standalone reference frame had been copied too literally as a centered 1240px card on a grey presentation canvas. The real panel now fills the viewport, keeps the 212px rail on the left edge, and lets the main content scroll inside the remaining width and height.

The `v0.9.0` minor release underneath absorbs the standalone design reference at `docs/design/reference/plaud-mirror-panel-standalone.html` into the real React/Vite panel without changing backend APIs: a 212px operator rail, dense light-console visual system, five screens (Main, Library, Backfill, Configuration, Operations), ES/EN chrome toggle, health/status strip, auth-failure banner, next-action card, KPI coverage, live Library search/player controls, live Backfill preview, and Operations visibility for recent runs, outbox retry, and `lastErrors`.

The `v0.8.x` line underneath remains the Phase 4 re-auth foundation. `v0.8.0` added the local Chrome companion extension as the recommended capture surface, and `v0.8.1` fixes the remaining server-side validation mismatch: the operator proved the captured EU user token returns `200` from Plaud Web's own console, while the backend got an HTML `403` from Plaud/Cloudflare. The token and region were correct; the stale backend request fingerprint was not. `PlaudClient` now validates and syncs with Plaud Web's browser context (`https://web.plaud.ai`, browser-like Chrome UA, browser `sec-fetch-*` headers).

`v0.7.0` introduced the browser-assisted `/connect` handshake (D-019): a panel-initiated single-use `captureId` lets the operator refresh the ~300-day Plaud bearer with no DevTools and no stored password. It was chosen after confirming the operator's account is Google SSO (so it has no password and Plaud forbids adding one, killing credentials-login) and parking the official OAuth/MCP as deferred/watch (not disproven). `v0.7.1`-`v0.7.6` patched the bookmarklet delivery path (popup timing, copy install, encoding, token type/region, public-error hygiene, masked-token guard, shorter visible marker). The final finding was decisive: React-rendered `javascript:` links are not a reliable way to install a bookmarklet, because React replaces the `href` with a defensive throw before Chrome stores it. `v0.8.0` therefore added a local Chrome companion extension as the recommended capture surface. The extension reads the active Plaud tab's browser storage (`pld_tokenstr` first, scan fallback), redirects that tab to `/connect#token=...`, stores only the mirror origin, and never stores or logs the token. Manual token paste and copy-only bookmarklet remain fallback paths; Telegram is explicitly not a capture channel.

The `v0.6.x` line this builds on was the **Phase 3 hardening + tooling** sequence, forced by the 2026-06-10 security review: `v0.6.0` operator access control (D-018 — `PLAUD_MIRROR_ADMIN_PASSPHRASE` + signed HttpOnly session cookie gating `/api/*`, login screen, throttle, health PII redaction), startup crash recovery (D-013 amendment — orphaned `running`/`delivering` rows recovered at boot, at-least-once accepted), and Plaud client timeouts; then `v0.6.1` (LLM-DocKit 4.8.2 sync), `v0.6.2` (Doppler passphrase helper `scripts/set-admin-passphrase.sh`), `v0.6.3` (terminal-echo fix). The operator access control is armed in production (passphrase in Doppler, secondary "Startup Embassy" account). Runtime test count: 161 (134 Node + 27 web); validator smoke: 32 checks.

The `v0.5.5` runtime baseline underneath: **D-014 full** health observability (`lastErrors` ring buffer capped at 20, `recentSyncRuns` last 5 finished runs on `/api/health`) plus the D-016/D-017 governance layers (`prose-drift` at FAIL, `unabsorbed-artifact` baseline).

The runtime baseline carried from `v0.5.3` is the **durable webhook outbox** (D-013): each successfully-mirrored recording pushes its `recording.synced` payload into a `webhook_outbox` SQLite table, a dedicated worker retries with exponential backoff (30 s → 8 h across 8 attempts, ~16 h cumulative window) before escalating to `permanently_failed`. The Operations screen has live counters (`pending` / `retry_waiting` / `permanently_failed` / `oldestPendingAgeMs`), a list of permanently-failed items, and a per-row Retry button; webhook URL/secret settings live in Configuration. The HMAC signature is recomputed at delivery time so rotating `webhookSecret` mid-flight is honoured. Routes: `GET /api/outbox` (failed list only) and `POST /api/outbox/:id/retry`.

The earlier `0.5.x` baseline still applies: in-process continuous sync scheduler (D-012, stabilized in `v0.5.1`, panel-driven from `v0.5.2`), two-layer anti-overlap, SQLite-persisted scheduler config. `SyncRunSummary.enqueued` counts webhook payloads pushed to the outbox during the run; `delivered` keeps its original semantic ("delivered synchronously inside this run") and structurally stays at 0 from `v0.5.3` onwards.

Operators upgrading from `0.4.x` should skip `v0.5.0` (scheduler default-on regression + missing service-layer anti-overlap) and go directly to `v0.10.0`.

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
