<!-- doc-version: 0.4.5 -->
# Plaud Mirror Roadmap

This document is the canonical phase boundary for Plaud Mirror. If implementation scope starts to cross a phase boundary, update this document before claiming the work is part of the current phase.

## Roadmap Rules

- Phases are additive, not fuzzy labels.
- "Current phase" means the minimum scope that must exist before the next phase starts.
- If a feature depends on the next phase's guarantees, it belongs to the next phase.
- Handoff, README, and architecture docs must point back here when there is any doubt about scope.

## Current Target

- Current delivery target: `v0.4.5`
- Current phase: **Phase 2 - first usable internal slice (extended through 0.4.x)**
- Deployment target: `dev-vm` first

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

## Why Phase 2 Was Extended Through 0.4.x

The original table assigned one minor version per phase (`0.3.x` = Phase 2, `0.4.x` = Phase 3). During Phase 2 development the owner requested an inline audio player plus a local-only "delete from mirror" flow with restore — a product-surface increment that extends Phase 2's contract ("first usable manual vertical slice") rather than crossing into Phase 3's scope (scheduler, outbox, unattended operation).

Rather than dilute the phase boundary, the roadmap was re-cut: Phase 2 covers both `0.3.x` (initial slice) and `0.4.x` (curation UX on top of that slice), and every subsequent phase shifts by one minor version. SemVer (minor = new user-visible feature) stays authoritative; phase labels follow.

## Why Phase 2 Was Re-cut

Phase 2 now means "first usable manual vertical slice", not "everything operational forever." The reason is simple: the earlier roadmap bundled UI, Docker, scheduler, retry logic, and deployment hardening tightly enough that it became easy to drift back into a CLI-only state while still speaking as if the first product slice had landed.

The corrected rule is:

- **Phase 2 proves the product surface exists.**
- **Phase 3 proves it can run unattended and recover cleanly.**

That separation is intentional and should not be collapsed casually.
