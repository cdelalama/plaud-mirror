<!-- doc-version: 0.1.0 -->
# LLM Work Handoff

This file is the current operational snapshot. Long-form rationale lives in `docs/llm/DECISIONS.md`. Archived review commentary lives in `docs/llm/REVIEWS.md`.

## Current Status

- Last Updated: 2026-04-22 - Codex GPT-5
- Session Focus: Leave the next engineering step unambiguous after the documentation review loop; the next real work is the Phase 1 Plaud spike on `dev-vm`
- Status: Planning is converged enough to start implementation. D-003 now frames auth as manual-token-first with automatic re-login later; D-009 captures the operator-only TOS posture; and `plaud-mirror` is registered in `home-infra` as a planning-stage project. The first usable release still targets `dev-vm` and includes a small product UI, encrypted persisted manual-token auth, filtered historical backfill, and a generic webhook with HMAC signing. The next real engineering step is the Phase 1 Plaud spike on `dev-vm`. `v0.1.0` remains a documentation/bootstrap baseline and runtime implementation has not started yet.

## Project Summary

Plaud Mirror is a planned self-hosted service that:
- stays authenticated against Plaud
- polls for new recordings
- mirrors audio locally
- exposes a small operational web UI
- notifies downstream systems that perform STT or indexing

Direct inspirations:
- `rsteckler/applaud` for service shape, poller split, and operational UI ideas
- `iiAtlas/plaud-recording-downloader` for token and regional heuristics
- `JamesStuder/Plaud_API` and `JamesStuder/Plaud_BulkDownloader` for endpoint and download-flow reference

License boundary:
- MIT upstreams can be reused with review and attribution
- AGPL and no-license repos are reference-only until a documented decision changes that

## Recent Governance Changes

- D-003 was amended to a phased auth strategy: manual bearer token first, automatic re-login later.
- D-009 was added to document the operator-only TOS posture.
- `plaud-mirror` was registered in `~/src/home-infra/docs/PROJECTS.md` as a planning-stage project.
- The roadmap second-opinion pass was merged; the review notes are archived in `docs/llm/REVIEWS.md`.
- **Review archival convention adopted (2026-04-22).** When a review generates non-trivial pushback, `REVIEWS.md` entries now use an enriched structure — Points of Agreement, Points Raised (with Resolution + Rationale per point), Summary Outcome, Follow-Through Landed — so future sessions can reconstruct *why* each decision was made, not only *what* was decided. Simple sign-offs can stay as a one-paragraph note. The full template is at the top of `REVIEWS.md`. The 2026-04-22 Roadmap Review has been rewritten under this structure as the reference example.
- **Owner shorthand documented.** The owner uses **HO** as shorthand for **HANDOFF** (this file). Documented in `docs/llm/README.md` under "Glossary / Owner Shorthand" so any LLM working on this project sees it without needing to re-ask.

## Top Priorities

1. Execute the Phase 1 Plaud spike on `dev-vm`: validate manual-token auth, list recordings, download real audio, and measure artifact size/format/rate.
2. Lock the implementation stack and minimum filter set from spike results. The current recommendation remains TypeScript monorepo plus Fastify, React/Vite, SQLite, and Zod.
3. Create the Doppler project `plaud-mirror` before Phase 2 work and scaffold `apps/api/`, `apps/web/`, and `packages/shared/`.
4. Build the first usable vertical slice: small product UI, encrypted persisted token storage, filtered historical backfill, durable webhook outbox, and HMAC-signed generic webhook delivery.
5. Add scheduler, resumable backfill, retries, and health/status surfaces before tackling automatic re-login.

## Open Questions

- Which backfill filters beyond date range are reliably supported by Plaud listing metadata?
- Can `credentials-relogin` be implemented without browser automation?
- What safe defaults for backfill concurrency and webhook retry avoid flooding the downstream?

## Confirmed Product Direction

- First target is the owner's infrastructure, starting on `dev-vm`; NAS rollout comes later.
- The first usable release must include a small product-style web panel, not just an operator console.
- Manual bearer-token auth is acceptable for the first slice, but the token must be encrypted at rest and survive restarts.
- Historical backfill is required from day 1 and should expose filters at least by date range; other filters depend on stable Plaud metadata.
- Downstream delivery is a generic webhook. `youtube2text` remains an external consumer, not a built-in dependency.
- Automatic re-login remains mandatory on the roadmap, but it is not a blocker for the first usable slice.
- Browser automation is not part of the planned path; it remains only a de-prioritized last-resort option that would require fresh approval if direct renewal proves too brittle.

## Proposed Runtime Shape

- Recommended stack: TypeScript monorepo
- `apps/api/`: Fastify service for Plaud adapter, session/auth management, sync/backfill orchestration, webhook outbox, and admin API
- `apps/web/`: React/Vite product panel for setup, sync control, auth state, recordings, and error visibility
- `packages/shared/`: shared Zod schemas and TypeScript types for config, API responses, recordings, jobs, and webhook payloads
- Persistence: SQLite for config/state/jobs/delivery attempts plus filesystem storage for mirrored recordings
- Secrets: encrypted local blob derived from `PLAUD_MIRROR_MASTER_KEY`; no plaintext token or credentials on disk
- Configuration source: standard environment variables in the app, with Doppler supplying those env vars in the owner's `dev-vm` and later deployment environments
- Queueing model: same-process jobs first; no Redis or external queue in v1

## Proposed Roadmap

1. Phase 1 - Plaud spike and data-model proof
   - Validate the manual-token flow
   - List recordings and inspect available metadata
   - Download at least one real audio artifact
   - Measure artifact size, format, and rough arrival rate to validate local-storage assumptions
   - Decide the minimal filter set and artifact metadata shape
   - Exit criteria: one real recording mirrored locally from `dev-vm`
2. Phase 2 - First usable internal release
   - Scaffold API, web, and shared package
   - Add encrypted persisted manual-token auth
   - Wire the local dev flow around environment variables provided via Doppler in this infrastructure
   - Add a small product UI for setup, health, sync/backfill controls, and recordings list
   - Add manual sync and historical backfill with the required filters
   - Add generic webhook delivery with a durable outbox, retry state, and HMAC signing
   - Exit criteria: paste token in the UI, run a filtered backfill, mirror files locally, and emit signed webhook events
3. Phase 3 - Continuous sync and resilience
   - Add a configurable scheduler with a conservative default target of 15 minutes
   - Add resumable backfill, checkpointing, and harder dedupe guarantees
   - Add auth degradation states, retry policy, and improved health/status reporting
   - Exit criteria: multi-day unattended run on `dev-vm` using manual-token mode
4. Phase 4 - Optional automatic re-login
   - Define `SessionProvider` modes with `manual-token` and `credentials-relogin` as the intended paths
   - Implement the least brittle renewal path first
   - Treat browser-assisted renewal as de-prioritized research only; do not add it without explicit new approval
   - Exit criteria: an explicit renewal strategy is documented and at least one automatic mode is implemented or rejected with rationale
5. Phase 5 - Deployment hardening and NAS rollout
   - Finish Docker packaging, secrets handling, backups/restore, and deploy/rollback runbooks
   - Validate the stack on NAS after `dev-vm` success
   - Exit criteria: repeatable deployment on both `dev-vm` and NAS
6. Phase 6 - OSS preparation
   - Sanitize docs, examples, and configuration
   - Publish a usable quickstart
   - Tighten the public contract and contributor expectations
   - Exit criteria: the repository is understandable and usable without private infrastructure context

## Historical Backfill Delivery Choice

- Selected default: historical backfill should emit the same `recording.synced` webhook as ongoing sync so the downstream sees one consistent contract
- Reason: it is the simplest mental model and best fits future `youtube2text` integration
- Alternative to preserve for later: a "mirror-only backfill" mode that downloads historical audio without emitting downstream webhooks, useful when the operator wants archive hydration without flooding consumers

## Review Outcome (2026-04-22)

- Keep the vertical-slice roadmap as the base.
- Adopt the useful second-opinion additions: Phase 2 webhook HMAC, Phase 1 storage measurement, D-009 TOS posture, conservative 15-minute scheduler default, and `home-infra` follow-through.
- Do not move historical backfill out of the first usable release.
- Treat Doppler as an infrastructure convention, not a product dependency.
- Keep browser-assisted renewal off the planned path; only revisit it with fresh user approval.
- See `docs/llm/REVIEWS.md` for the archived review notes.

## Next Session

- Run the Phase 1 Plaud spike.
- Confirm the minimal filter set and artifact metadata shape from real Plaud responses.
- Decide whether the recommended TypeScript stack stands after the spike; if yes, scaffold Phase 2.
- Create Doppler project `plaud-mirror` before Phase 2 scaffold begins.
- Add D-009 posture copy to `README.md` and `LLM_START_HERE.md` during Phase 2, not before, to avoid churn.

## Testing Notes

- `dotnet` is not installed on this machine, so the original C# downloader was only inspected, not executed.
- Plaud Mirror runtime does not exist yet, so no Plaud sync code or deployment flow has been validated beyond repository/documentation tooling.
- This cleanup session only reorganized handoff/review documentation; no runtime code was created.

## Key Decisions (Links)

- D-001: Plaud Mirror is an audio-first mirror, not an STT product
- D-002: The project is server-first with a web UI, not browser-only
- D-003: Auth strategy is phased — manual bearer-token first, automatic re-login deferred to Phase 4, browser-assisted renewal disfavored (amended 2026-04-22)
- D-004: Upstream-watch discipline is mandatory for auth and download resilience
- D-005: MIT remains the intended license boundary
- D-007: Reuse strategy is composite, not a single-upstream fork
- D-008: Core auth and download logic must stay auditable in-repo
- D-009: Operator-only TOS posture — personal use against the operator's own Plaud account; not a hosted service; no redistribution

See `docs/llm/DECISIONS.md` for rationale.

## Do Not Touch

- `config/upstreams.tsv` without documenting why the baseline changed
- `docs/UPSTREAMS.md` licensing boundaries without explicit user approval
- `.dockit-config.yml` external-context paths unless the infra-doc repository moved
