<!-- doc-version: 0.7.0 -->
# Plaud Mirror Roadmap

This document is the canonical phase boundary for Plaud Mirror. If implementation scope starts to cross a phase boundary, update this document before claiming the work is part of the current phase.

## Roadmap Rules

- Phases are additive, not fuzzy labels.
- "Current phase" means the minimum scope that must exist before the next phase starts.
- If a feature depends on the next phase's guarantees, it belongs to the next phase.
- Handoff, README, and architecture docs must point back here when there is any doubt about scope.

## Current Target

- Current delivery target: `v0.7.0`
- Current phase: **Phase 4 - re-auth (entered at `0.7.0`); Phase 3 exit gate (multi-day soak) still pending**
- Deployment target: `dev-vm` first
- Phase 3 entry: `v0.5.0` introduced the in-process scheduler (D-012) and partial health observability (D-014, scheduler subset) but shipped two regressions; `v0.5.1` fixed both. `v0.5.2` made the scheduler panel-driven (SQLite-persisted, hot-applied via `SchedulerManager`). `v0.5.3` shipped the **durable webhook outbox** (D-013): every successful sync enqueues the payload, a worker retries with exponential backoff (30s → 8h, 8 attempts), permanently-failed items are surfaced in the panel with a Retry button, counters land on `/api/health.outbox`. `v0.5.4` was governance-only: **Layer-1 doc-drift enforcement** (D-016). `v0.5.5` shipped **D-014 full** — `lastErrors` ring buffer and `recentSyncRuns` on `/api/health` — plus `prose-drift` hardened to `FAIL` and the `check_unabsorbed_artifact()` validator check (D-017). `v0.5.6` was governance/sync only (LLM-DocKit 4.8 adoption). `v0.6.0` (current) is the **Phase 3 hardening release** that the 2026-06-10 security review forced before any unattended soak: **operator access control** (D-018 — `PLAUD_MIRROR_ADMIN_PASSPHRASE` + signed HttpOnly session cookie gating every `/api/*` route, login screen in the panel, login throttle, health PII redaction), **startup crash recovery** (D-013 amendment — orphaned `running` sync runs are failed at boot so the anti-overlap guard cannot deadlock; orphaned `delivering` outbox rows are re-queued, at-least-once delivery accepted), and **Plaud client timeouts** (every Plaud API call and audio download carries an abort deadline so a hung connection cannot wedge a sync run forever). `v0.6.1` adopted LLM-DocKit 4.8.2 (validator smoke tests, DF-039 read-only skip; no runtime change), `v0.6.2` added the operator helper `scripts/set-admin-passphrase.sh` that stores the D-018 passphrase in Doppler, and `v0.6.3` fixed terminal-echo restoration in that helper. `v0.7.0` (current) opens **Phase 4** with **browser-assisted Plaud re-auth** (D-019): a panel-initiated capture session + a bookmarklet (token-extraction adapted from the MIT `iiAtlas` upstream) lets the operator refresh the ~300-day bearer in one tap, with no DevTools and no stored password — chosen over credentials-login (not applicable: Google-SSO account) and over the official OAuth/MCP (deferred/watch, not disproven). Operators upgrading from `0.4.x`/`0.5.x` should go directly to `v0.7.0`.

Phase boundary note: `v0.7.0` is filed under Phase 4 because it is re-auth UX work, but it is **assisted manual capture**, not the "automatic re-login via a non-browser path" the Phase 4 exit gate describes. The Phase 4 gate ("renewal strategy implemented or explicitly rejected with rationale") is partially met — D-019 records the rationale for choosing capture over auto-login for an SSO account — but full unattended auto-renewal remains open (and is only reachable via the official OAuth/MCP path, which stays deferred). The Phase 3 exit gate (multi-day unattended soak on dev-vm) is also still pending; the two phases overlap in the `0.7.x` line until the soak runs.

## Phase Table

| Phase | Target | Includes | Explicitly does not include | Exit gate |
|------|--------|----------|------------------------------|-----------|
| Phase 0 | `0.1.x` | Repo bootstrap, docs, upstream watch, governance | Runtime code | Stable docs baseline on `main` |
| Phase 1 | `0.2.x` | Plaud spike CLI, shared schemas, live auth/list/detail/download proof, metadata/filter discovery | Web UI, HTTP API, Docker runtime, encrypted persisted token | Real Plaud flow can be exercised from `dev-vm` |
| Phase 2 | `0.3.x` – `0.4.x` | Fastify API, React/Vite panel, encrypted persisted bearer token, manual sync, filtered backfill, local recordings index, immediate HMAC-signed webhook delivery with persisted attempt log, Docker runtime for `dev-vm` running as `USER 1000:1000`, local-only curation (inline audio player, dismiss/restore) | Scheduler, resumable backfill, automatic retry queue/outbox, auto re-login, NAS rollout | Operator can open the UI, save a token, run sync/backfill, audition the recordings inline, dismiss or keep each one locally, and receive signed webhook deliveries |
| Phase 3 | `0.5.x` – `0.6.x` | Continuous sync scheduler, retry policy, durable webhook outbox, stronger health/status surfaces, operator access control (panel/API auth), startup crash recovery, Plaud client timeouts, observability surfaced in the panel UI; resumable backfill (deferred, no firm target) | Automatic re-login, NAS rollout, OSS polish | Multi-day unattended run on `dev-vm` with predictable recovery behavior |
| Phase 4 | `0.7.x` | Phone-friendly re-auth UX (browser-assisted bearer capture, D-019, shipped v0.7.0); optional automatic re-login via a non-browser path (official OAuth/MCP) if it proves reliable; auth-failure notification | Browser automation (headless Chromium) as default or silent fallback | Renewal strategy implemented or explicitly rejected with rationale |
| Phase 5 | `0.8.x` | Deployment hardening, backups, rollback, NAS validation, infra playbooks | Public OSS polish | Repeatable deployment on both `dev-vm` and NAS |
| Phase 6 | `0.9.x`+ | Public quickstart, sanitized examples, contributor-facing OSS fit and finish | Hosted or multi-tenant posture | Repo is understandable without private infra context |

## Beyond Phase 6: Multi-tenant variant (out of scope for this repo)

Plaud Mirror's defined scope ends at Phase 6 — single-operator, self-hosted, OSS-polished. Hosting the same code as a multi-tenant public service is **not** a future phase of this repository; it conflicts with [D-009](llm/DECISIONS.md#d-009---operator-only-tos-posture) (operator-only TOS posture) and would require explicitly amending that decision with new rationale around Plaud's TOS, per-user secret handling, and attack surface.

If a multi-tenant variant is pursued, three viable paths exist (in increasing order of effort):

1. **Instance-per-tenant deployment** of plaud-mirror as-is, fronted by an auth proxy (Authentik, Caddy+forward-auth, Traefik+Authelia) that maps each authenticated user to their own container. Each container stays single-user; D-009 stays intact; the operator just runs N of them. Zero plaud-mirror code change. Suitable for 5–50 trusted users.

2. **Refactor plaud-mirror to be tenant-aware in-place** (thread `tenantId` through the codebase, secrets per tenant, paths per tenant). Requires explicit amend of D-009. Significant refactor. Pollutes the single-user codebase with abstractions it does not need today. Not recommended — kills the project's identity.

3. **New sibling project** (working title `plaud-cloud` or similar) built greenfield with tenant-ready architecture from day 1: an `AppContext`/`TenantResolver` interface, identity provider (Better Auth for self-hosted-friendly TS, Clerk/WorkOS for B2B SaaS), per-tenant secrets, isolation tests, an explicit multi-tenant TOS. Could share a Plaud client package extracted from `apps/api/src/plaud/`. Plaud Mirror remains the canonical self-hosted tool; the cloud variant has its own roadmap and decisions.

Recommendation if/when the time comes: **path 1 first** (cheap, fast, no code churn) for early public hosting; migrate to **path 3** if scale or product polish demands it. Avoid path 2.

This section exists so the decision has a place to land when the time comes; it is not a deliverable of this repo.

## Why Phase 3 Was Extended Through 0.6.x

The original re-cut table assigned `0.5.x` to Phase 3 and `0.6.x` to Phase 4 (automatic re-login). Two things changed on 2026-06-10:

1. A full-code security review found three findings that invalidate the Phase 3 exit gate as previously understood: the panel/API had **no operator authentication** while being exposed through `edge-caddy` at `https://plaud.lamanoriega.com/`; a process crash could leave `sync_runs` rows in `running` (deadlocking the anti-overlap guard forever) and `webhook_outbox` rows in `delivering` (unreachable by the worker); and the Plaud client had no request timeouts, so a hung connection produced exactly the same deadlock. "Multi-day unattended run with predictable recovery behavior" cannot be claimed while any of those hold.
2. Operator access control is a **new backward-compatible auth capability plus a new configuration option** — per `docs/VERSIONING_RULES.md` that is a minor bump, and `0.6.0` was reserved for Phase 4.

Rather than misversion the hardening as a patch or smuggle Phase 4 scope forward, the roadmap was re-cut the same way it was for Phase 2: Phase 3 now covers `0.5.x` (feature delivery) and `0.6.x` (hardening + soak), and every subsequent phase shifts by one minor version. SemVer stays authoritative; phase labels follow. The Plaud re-login spike explicitly stays in Phase 4 (`0.7.x`) — it must not ride along with the hardening release.

Remaining `0.6.x` work before the Phase 3 exit gate: surface `health.warnings` / `lastErrors` / `recentSyncRuns` in the panel UI, upgrade the secrets KDF from single-pass SHA-256 to scrypt-with-salt (H2 from the same review; deprioritized while the master key is strong and random), and then the multi-day soak itself.

## Why Phase 2 Was Extended Through 0.4.x

The original table assigned one minor version per phase (`0.3.x` = Phase 2, `0.4.x` = Phase 3). During Phase 2 development the owner requested an inline audio player plus a local-only "delete from mirror" flow with restore — a product-surface increment that extends Phase 2's contract ("first usable manual vertical slice") rather than crossing into Phase 3's scope (scheduler, outbox, unattended operation).

Rather than dilute the phase boundary, the roadmap was re-cut: Phase 2 covers both `0.3.x` (initial slice) and `0.4.x` (curation UX on top of that slice), and every subsequent phase shifts by one minor version. SemVer (minor = new user-visible feature) stays authoritative; phase labels follow.

## Why Phase 2 Was Re-cut

Phase 2 now means "first usable manual vertical slice", not "everything operational forever." The reason is simple: the earlier roadmap bundled UI, Docker, scheduler, retry logic, and deployment hardening tightly enough that it became easy to drift back into a CLI-only state while still speaking as if the first product slice had landed.

The corrected rule is:

- **Phase 2 proves the product surface exists.**
- **Phase 3 proves it can run unattended and recover cleanly.**

That separation is intentional and should not be collapsed casually.
