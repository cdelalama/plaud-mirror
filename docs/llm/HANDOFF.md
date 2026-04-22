<!-- doc-version: 0.2.1 -->
# LLM Work Handoff

This file is the current operational snapshot. Long-form rationale lives in `docs/llm/DECISIONS.md`. Archived review commentary lives in `docs/llm/REVIEWS.md`.

## Current Status

- Last Updated: 2026-04-22 - Codex GPT-5
- Session Focus: Run the new Phase 1 spike harness on `dev-vm` with a real Plaud bearer token and capture the first live report/download
- Status: `v0.2.1` keeps runtime implementation moving and makes the test discipline explicit. The repo has an npm workspace monorepo, shared Zod schemas, a Plaud client with browser-aligned headers plus regional retry, and a Phase 1 CLI spike that can validate `/user/me`, list `/file/simple/web`, inspect `/file/detail/<id>`, download via `/file/temp-url/<id>`, and write local artifacts under `recordings/` plus `.state/phase1/`. The suite now also covers client error cases, spike filtering/report helpers, and CLI argument parsing. Live Plaud validation on `dev-vm` is still pending because no bearer token was provided in-session.

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
- **Documentation consistency fixes (2026-04-22):**
  - D-006 (canonical local layout keyed by Plaud recording ID) is now listed in "Key Decisions (Links)" below; earlier handoff passes had omitted it inconsistently.
  - `LLM_START_HERE.md` now links to `docs/llm/README.md` as step 9 of the mandatory reading order so new LLMs discover the glossary (HO shorthand) and the enriched review convention without having to browse the `docs/llm/` folder.
  - The former "Proposed Runtime Shape" section of this handoff was migrated to `docs/ARCHITECTURE.md` under a new "Implementation Stack" subsection. HO now carries a one-line pointer instead of the full stack description, keeping the handoff operational. The stack content itself is unchanged; only its location moved.
- **Mechanical enforcement of HANDOFF ↔ LLM_START_HERE sync (2026-04-22).** GPT-5 flagged that Claude had repeatedly updated this handoff without propagating the matching snapshot to `LLM_START_HERE.md` "Current Focus", and that a fix via private memory or session discipline is not reliable because it is invisible to co-maintainers and to the validator. A new `handoff-start-here-sync` check was added to `scripts/dockit-validate-session.sh`: it extracts the `Last Updated:` field from both files, compares them, and fails the validator (non-zero exit, pre-commit hook triggers) if they diverge. Positive and negative test runs were executed locally to confirm PASS and FAIL paths. This supersedes the previous procedural mitigation; any drift now surfaces at commit time.
- **Stable docs aligned with the converged roadmap (2026-04-22).** `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/operations/AUTH_AND_SYNC.md`, and `docs/operations/API_CONTRACT.md` now match the actual plan captured in D-003 and the handoff: Phase 1 is a Plaud spike, the first usable release is manual-token-first with filtered backfill and HMAC-signed generic webhooks, and automatic re-login is explicitly deferred to a later phase.
- **Runtime version sync now covers package manifests (2026-04-22).** Once the Phase 1 monorepo landed, `scripts/bump-version.sh`, `scripts/check-version-sync.sh`, and `docs/version-sync-manifest.yml` were extended so `package.json`, `apps/api/package.json`, and `packages/shared/package.json` stay aligned with `VERSION`.
- **Phase 1 spike harness landed (2026-04-22).** `apps/api` now contains a real TypeScript CLI spike and unit tests, and `packages/shared` now contains the Plaud response/report schemas used by the spike. This is the first committed runtime code in the repo.
- **Testing discipline made explicit (2026-04-22).** `LLM_START_HERE.md`, `README.md`, and `docs/VERSIONING_RULES.md` now state that every new runtime case must add or update tests in the same session and that the relevant local suite must pass before the work is considered complete.

## Top Priorities

1. Run `npm run spike -- probe` on `dev-vm` with a real `PLAUD_MIRROR_ACCESS_TOKEN` and capture `.state/phase1/latest-report.json`.
2. Mirror at least one real recording locally and confirm the observed content type, file extension, byte count, and metadata shape.
3. Decide the minimum Phase 2 backfill filters from live results, especially whether `serial_number` and `scene` are worth exposing beside date range.
4. Create the Doppler project `plaud-mirror` before Phase 2 work.
5. Start the Phase 2 vertical slice only after the live spike confirms the current TypeScript stack and Plaud metadata assumptions.

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

Moved to `docs/ARCHITECTURE.md` under "Implementation Stack" (TypeScript monorepo: Fastify API + React/Vite panel + SQLite + Zod shared schemas; same-process jobs; encrypted-blob secrets; Doppler-injected env vars in this infra, plain env vars in the application contract). Subject to confirmation after the Phase 1 spike.

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

- Export a fresh Plaud bearer token on `dev-vm` and run:
  `npm run spike -- probe --limit 100 --download-first`
- Inspect `.state/phase1/latest-report.json` and `recordings/<recording-id>/metadata.json`.
- Confirm the minimal filter set and artifact metadata shape from real Plaud responses.
- Decide whether the recommended TypeScript stack stands after the spike; if yes, start Phase 2.
- Create Doppler project `plaud-mirror` before Phase 2 scaffold begins.
- Add D-009 posture copy to `README.md` and `LLM_START_HERE.md` during Phase 2, not before, to avoid churn.

## Testing Notes

- `dotnet` is not installed on this machine, so the original C# downloader was only inspected, not executed.
- `npm test` passes for the shared Zod schemas, Plaud client regional-retry/error handling, Phase 1 spike helper logic, and CLI argument parsing.
- `npm run spike -- --help` passes as a CLI smoke test.
- No live Plaud API call was executed in-session because no bearer token was available.

## Key Decisions (Links)

- D-001: Plaud Mirror is an audio-first mirror, not an STT product
- D-002: The project is server-first with a web UI, not browser-only
- D-003: Auth strategy is phased — manual bearer-token first, automatic re-login deferred to Phase 4, browser-assisted renewal disfavored (amended 2026-04-22)
- D-004: Upstream-watch discipline is mandatory for auth and download resilience
- D-005: MIT remains the intended license boundary
- D-006: Canonical local layout uses the Plaud recording ID as the dedupe key
- D-007: Reuse strategy is composite, not a single-upstream fork
- D-008: Core auth and download logic must stay auditable in-repo
- D-009: Operator-only TOS posture — personal use against the operator's own Plaud account; not a hosted service; no redistribution

See `docs/llm/DECISIONS.md` for rationale.

## Do Not Touch

- `config/upstreams.tsv` without documenting why the baseline changed
- `docs/UPSTREAMS.md` licensing boundaries without explicit user approval
- `.dockit-config.yml` external-context paths unless the infra-doc repository moved
