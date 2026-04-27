<!-- doc-version: 0.5.4 -->
# Plaud Mirror Roadmap

This document is the canonical phase boundary for Plaud Mirror. If implementation scope starts to cross a phase boundary, update this document before claiming the work is part of the current phase.

## Roadmap Rules

- Phases are additive, not fuzzy labels.
- "Current phase" means the minimum scope that must exist before the next phase starts.
- If a feature depends on the next phase's guarantees, it belongs to the next phase.
- Handoff, README, and architecture docs must point back here when there is any doubt about scope.

## Current Target

- Current delivery target: `v0.5.4`
- Current phase: **Phase 3 - unattended operation (stable since 0.5.1)**
- Deployment target: `dev-vm` first
- Phase 3 entry: `v0.5.0` introduced the in-process scheduler (D-012) and partial health observability (D-014, scheduler subset) but shipped two regressions; `v0.5.1` fixed both. `v0.5.2` made the scheduler panel-driven (SQLite-persisted, hot-applied via `SchedulerManager`). `v0.5.3` adds the **durable webhook outbox** (D-013): every successful sync enqueues the payload, a worker retries with exponential backoff (30s → 8h, 8 attempts), permanently-failed items are surfaced in the panel with a Retry button, counters land on `/api/health.outbox`. `v0.5.4` is a governance-only release that ships **Layer-1 doc-drift enforcement** (D-016) — `scripts/check-prose-drift.sh` + `prose-drift` validator check + global meta-rule — with no runtime change. Full health observability with `lastErrors` ring buffer (D-014, complete) lands next: v0.5.5. Operators upgrading from `0.4.x` should skip `v0.5.0` and go directly to `v0.5.4`.

## Phase Table

| Phase | Target | Includes | Explicitly does not include | Exit gate |
|------|--------|----------|------------------------------|-----------|
| Phase 0 | `0.1.x` | Repo bootstrap, docs, upstream watch, governance | Runtime code | Stable docs baseline on `main` |
| Phase 1 | `0.2.x` | Plaud spike CLI, shared schemas, live auth/list/detail/download proof, metadata/filter discovery | Web UI, HTTP API, Docker runtime, encrypted persisted token | Real Plaud flow can be exercised from `dev-vm` |
| Phase 2 | `0.3.x` – `0.4.x` | Fastify API, React/Vite panel, encrypted persisted bearer token, manual sync, filtered backfill, local recordings index, immediate HMAC-signed webhook delivery with persisted attempt log, Docker runtime for `dev-vm` running as `USER 1000:1000`, local-only curation (inline audio player, dismiss/restore) | Scheduler, resumable backfill, automatic retry queue/outbox, auto re-login, NAS rollout | Operator can open the UI, save a token, run sync/backfill, audition the recordings inline, dismiss or keep each one locally, and receive signed webhook deliveries |
| Phase 3 | `0.5.x` | Continuous sync scheduler, retry policy, durable webhook outbox, resumable backfill, stronger health/status surfaces | Automatic re-login, NAS rollout, OSS polish | Multi-day unattended run on `dev-vm` with predictable recovery behavior |
| Phase 4 | `0.6.x` | Optional automatic re-login via a non-browser path if it proves reliable | Browser automation as default or silent fallback | Renewal strategy implemented or explicitly rejected with rationale |
| Phase 5 | `0.7.x` | Deployment hardening, backups, rollback, NAS validation, infra playbooks | Public OSS polish | Repeatable deployment on both `dev-vm` and NAS |
| Phase 6 | `0.8.x`+ | Public quickstart, sanitized examples, contributor-facing OSS fit and finish | Hosted or multi-tenant posture | Repo is understandable without private infra context |

## Beyond Phase 6: Multi-tenant variant (out of scope for this repo)

Plaud Mirror's defined scope ends at Phase 6 — single-operator, self-hosted, OSS-polished. Hosting the same code as a multi-tenant public service is **not** a future phase of this repository; it conflicts with [D-009](llm/DECISIONS.md#d-009---operator-only-tos-posture) (operator-only TOS posture) and would require explicitly amending that decision with new rationale around Plaud's TOS, per-user secret handling, and attack surface.

If a multi-tenant variant is pursued, three viable paths exist (in increasing order of effort):

1. **Instance-per-tenant deployment** of plaud-mirror as-is, fronted by an auth proxy (Authentik, Caddy+forward-auth, Traefik+Authelia) that maps each authenticated user to their own container. Each container stays single-user; D-009 stays intact; the operator just runs N of them. Zero plaud-mirror code change. Suitable for 5–50 trusted users.

2. **Refactor plaud-mirror to be tenant-aware in-place** (thread `tenantId` through the codebase, secrets per tenant, paths per tenant). Requires explicit amend of D-009. Significant refactor. Pollutes the single-user codebase with abstractions it does not need today. Not recommended — kills the project's identity.

3. **New sibling project** (working title `plaud-cloud` or similar) built greenfield with tenant-ready architecture from day 1: an `AppContext`/`TenantResolver` interface, identity provider (Better Auth for self-hosted-friendly TS, Clerk/WorkOS for B2B SaaS), per-tenant secrets, isolation tests, an explicit multi-tenant TOS. Could share a Plaud client package extracted from `apps/api/src/plaud/`. Plaud Mirror remains the canonical self-hosted tool; the cloud variant has its own roadmap and decisions.

Recommendation if/when the time comes: **path 1 first** (cheap, fast, no code churn) for early public hosting; migrate to **path 3** if scale or product polish demands it. Avoid path 2.

This section exists so the decision has a place to land when the time comes; it is not a deliverable of this repo.

## Why Phase 2 Was Extended Through 0.4.x

The original table assigned one minor version per phase (`0.3.x` = Phase 2, `0.4.x` = Phase 3). During Phase 2 development the owner requested an inline audio player plus a local-only "delete from mirror" flow with restore — a product-surface increment that extends Phase 2's contract ("first usable manual vertical slice") rather than crossing into Phase 3's scope (scheduler, outbox, unattended operation).

Rather than dilute the phase boundary, the roadmap was re-cut: Phase 2 covers both `0.3.x` (initial slice) and `0.4.x` (curation UX on top of that slice), and every subsequent phase shifts by one minor version. SemVer (minor = new user-visible feature) stays authoritative; phase labels follow.

## Why Phase 2 Was Re-cut

Phase 2 now means "first usable manual vertical slice", not "everything operational forever." The reason is simple: the earlier roadmap bundled UI, Docker, scheduler, retry logic, and deployment hardening tightly enough that it became easy to drift back into a CLI-only state while still speaking as if the first product slice had landed.

The corrected rule is:

- **Phase 2 proves the product surface exists.**
- **Phase 3 proves it can run unattended and recover cleanly.**

That separation is intentional and should not be collapsed casually.
