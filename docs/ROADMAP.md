<!-- doc-version: 0.14.2 -->
# Plaud Mirror Roadmap

This document is the canonical phase boundary for Plaud Mirror. If implementation scope starts to cross a phase boundary, update this document before claiming the work is part of the current phase.

## Roadmap Rules

- Phases are additive, not fuzzy labels.
- "Current phase" means the minimum scope that must exist before the next phase starts.
- If a feature depends on the next phase's guarantees, it belongs to the next phase.
- Handoff, README, and architecture docs must point back here when there is any doubt about scope.

## Current Target

- Current deployed release: `v0.14.1` from runtime source
  `d393a0cefa17dfc4788294ef9bb5e5a89ed0f6b4`; the Media2Text destination is
  configured and enabled, while historical replay remains blocked.
- Current operational gate: preserve the deployed runtime while it accumulates
  3-5 days of post-release PT15M evidence, then run the separately authorized
  live webhook drill before closing Phase 3.
- Current product contract gate: `v0.14.2` separates the provider transcript
  record hash from the source audio hash after the first live completion
  exposed the incorrect comparison. Media2Text is the first compatible
  provider, not a Plaud Mirror dependency. Historical replay still requires a
  separate operator-approved duration/cost estimate.
- Pre-soak hardening: `v0.10.2` established trustworthy evidence; `v0.10.3`
  adds atomic downloads, physical reconciliation, per-candidate failure
  isolation, and explicit backfill conflicts. `v0.10.4` completes execution
  hardening with truthful scheduler completion, whole-run cancellation,
  bounded pagination, recoverable outbox claims, graceful shutdown, a Docker
  healthcheck, and clean dependency audits. Deployment, physical reconciliation,
  and scheduler activation are complete; the current gate is the five-day soak
  followed by the live webhook drill.
- `v0.10.5` makes the timeout regression evidence portable to Node 20 CI; it
  does not change runtime behavior.
- `v0.10.6` applies that portability fix to the whole-run timeout test.
- `v0.10.7` activates the PT15M internal-loop contract and starts the soak
  after a 619/619 physical reconciliation.
- `v0.10.8` is a governance-only upstream baseline review and audit record; it
  is intentionally not deployed during the `v0.10.7` soak.
- `v0.11.0` begins Phase 6 with a bounded operator workflow: a locally
  dismissed recording can be permanently removed from Plaud after one explicit
  confirmation. The runtime keeps an irreversible local tombstone. This does
  not change the Home Infra Protocol contract.
- `v0.11.1` makes that irreversible route fail closed with HTTP 403 whenever
  operator access control is disabled. It is a security patch with no protocol
  or UI contract change.
- `v0.11.2` closes the final low audit observations with a reusable destructive
  route guard, route-specific anonymous 401 coverage, and partial-failure retry
  documentation. It does not change the successful API, UI, or protocol.
- `v0.12.0` hardens destructive-operation truth after the first operator-driven
  live deletion: strict mutation acknowledgement, a durable deletion state and
  event journal, reconciliation of uncertain outcomes, and generation-based
  physical coverage. Its SQLite migrations and API additions are additive; the
  Home Infra contract and producer/consumer ownership boundary are unchanged.
- `v0.13.0` adopts Home Infra Protocol 0.10.0 scheduling evidence by publishing
  the live scheduler's authoritative `next_run_at`. It restores truthful
  countdown support for infra consumers without changing cadence, execution,
  stale thresholds, or health semantics.
- `v0.14.0` adds an optional, provider-neutral transcription destination:
  capability discovery, separate machine credentials, immutable artifact
  leases, durable at-least-once admission, signed/pull status reconciliation,
  bounded historical replay, exact coverage, and an Integrations UI. Existing
  standalone and generic-webhook behavior remains unchanged. Media2Text must
  implement this contract before live use.
- `v0.14.1` closes the pre-canary integrity and governance gate with a
  byte-pinned manifest, executable provider probe, full-window delete/restore
  serialization, and explicit second-destination cost confirmation.
- `v0.14.2` fixes transcript-result identity after the first live Media2Text
  completion: `recordSha256` is transcript provenance, while
  `source.artifactRevision` remains the source-audio integrity identity.
- Current phase: **Phase 6; `v0.14.2` is the live-canary compatibility patch,
  while bulk transcription replay and the independent generic-webhook soak
  gate remain pending**
- Deployment target: `dev-vm` first
- Phase 3 entry: `v0.5.0` introduced the in-process scheduler (D-012) and partial health observability (D-014, scheduler subset) but shipped two regressions; `v0.5.1` fixed both. `v0.5.2` made the scheduler panel-driven (SQLite-persisted, hot-applied via `SchedulerManager`). `v0.5.3` shipped the **durable webhook outbox** (D-013). `v0.5.5` shipped **D-014 full** — `lastErrors` ring buffer and `recentSyncRuns` on `/api/health`. `v0.6.0` is the **Phase 3 hardening release** forced by the 2026-06-10 security review: operator access control (D-018), startup crash recovery (D-013 amendment), and Plaud client timeouts. `v0.6.1`–`v0.6.3` were governance/tooling patches. `v0.7.0` opened **Phase 4** with browser-assisted Plaud re-auth (D-019): a panel-initiated capture session plus bookmarklet, chosen over credentials-login (not applicable: Google-SSO account) and over the official OAuth/MCP (deferred/watch, not disproven). `v0.7.1`–`v0.7.6` patched that bookmarklet path (popup timing, copy install, encoding, token type/region, public-error hygiene, masked-token guard, shorter visible marker). The decisive finding after those patches: a draggable `javascript:` `href` rendered by React is not a reliable delivery channel, because React replaces it with a safety throw before Chrome stores it as a bookmark. `v0.8.0` therefore ships a local Chrome companion extension as the recommended Phase 4 delivery surface; `v0.8.1` fixes the backend Plaud Web fingerprint required to validate the captured bearer. `v0.9.0` absorbs the standalone operator-panel reference (`docs/design/reference/plaud-mirror-panel-standalone.html`) into the real React/Vite app: five-screen rail UI, ES/EN operator chrome, Main/Operations observability, Library controls, live Backfill preview, and Configuration re-auth polish. `v0.9.1` keeps that UI but removes the presentation-card shell so the operator panel fills the viewport on wide monitors. `v0.9.2` fixes the Main cockpit's sync action so it downloads the displayed missing count instead of inheriting the Backfill form's conservative `limit=1`. `v0.9.3` is a governance/tooling patch that merges DocKit trace-protocol support while preserving Plaud Mirror's local validator guardrails. `v0.9.4` fixes Library Compact playback, Full-mode player width, and list scrolling inside the full-viewport shell. `v0.9.5` fixes the mobile operator shell: labeled view selector, compact status chips, and right-aligned Library row actions. `v0.9.6` is a governance/tooling sync to LLM-DocKit 4.9.6: Trace v1.3 chat seconds, flexible HISTORY format validation, expanded version marker handlers, preserved local validator guardrails, and package-lock version enforcement. `v0.10.0` opens **Phase 5** by adopting `home-infra-protocol` for Plaud recording sync: `infra.contract.yml` declares `plaud-mirror-recordings-sync`, the API publishes a sanitized status snapshot, and Home Infra can register the job for Infra Portal/Hermes consumers. `v0.10.1` fixes a sync progress summary bug where disabled-webhook delivery state was counted as skipped sync candidates. Operators upgrading from `0.4.x`/`0.5.x` should go directly to `v0.10.1`.

Phase boundary note: `v0.7.0`, `v0.8.0`, the `v0.8.1` validation patch, `v0.9.0`, the `v0.9.1` shell patch, the `v0.9.2` Main sync UX patch, `v0.9.4`, and `v0.9.5` are filed under Phase 4 because they are operator re-auth and operator UX work. The result is **assisted browser capture**, not the "automatic re-login via a non-browser path" originally imagined. D-019 records the rationale: credentials-login is not applicable to the operator's Google-SSO account, official OAuth/MCP stays deferred/watch, and browser capture is the practical strategy. `v0.8.0` is a SemVer minor because the Chrome extension is a new operator-facing delivery mechanism; `v0.9.0` is a SemVer minor because it replaces the operator panel with a new reference-driven UI/i18n surface while preserving backend contracts; `v0.9.1` is a patch because it fixes the production layout shell without changing backend or UI capabilities; `v0.9.2` is a patch because it fixes misleading Main sync behavior without changing backend contracts; `v0.9.3` and `v0.9.6` are patches because they are governance/tooling only; `v0.9.4` and `v0.9.5` are patches because they fix operator-panel UI regressions without changing backend contracts. `v0.10.0` is a SemVer minor because it adds a new public integration contract and status API for `home-infra-protocol` consumers; `v0.10.1` is a patch because it fixes a misleading sync-run counter without changing the API shape, sync selection, storage schema, or protocol contract. `v0.11.0` is a SemVer minor because it adds an authenticated, irreversible operator command and an additive SQLite tombstone. `v0.12.0` is a minor because it adds durable destructive-operation and coverage contracts while keeping storage migrations and existing API/protocol fields backward compatible. `v0.13.0` is a minor because it adds public producer-owned scheduling evidence while preserving execution and freshness semantics. Phase 4 spans `0.7.x`–`0.9.x`; Phase 5 starts at `0.10.0`; Phase 6 starts at `0.11.0`. The Phase 3 exit gate (multi-day unattended soak on dev-vm) is still pending; phases overlap until the post-change soak and webhook drill complete.

## Phase Table

| Phase | Target | Includes | Explicitly does not include | Exit gate |
|------|--------|----------|------------------------------|-----------|
| Phase 0 | `0.1.x` | Repo bootstrap, docs, upstream watch, governance | Runtime code | Stable docs baseline on `main` |
| Phase 1 | `0.2.x` | Plaud spike CLI, shared schemas, live auth/list/detail/download proof, metadata/filter discovery | Web UI, HTTP API, Docker runtime, encrypted persisted token | Real Plaud flow can be exercised from `dev-vm` |
| Phase 2 | `0.3.x` – `0.4.x` | Fastify API, React/Vite panel, encrypted persisted bearer token, manual sync, filtered backfill, local recordings index, immediate HMAC-signed webhook delivery with persisted attempt log, Docker runtime for `dev-vm` running as `USER 1000:1000`, local-only curation (inline audio player, dismiss/restore) | Scheduler, resumable backfill, automatic retry queue/outbox, auto re-login, NAS rollout | Operator can open the UI, save a token, run sync/backfill, audition the recordings inline, dismiss or keep each one locally, and receive signed webhook deliveries |
| Phase 3 | `0.5.x` – `0.6.x` | Continuous sync scheduler, retry policy, durable webhook outbox, stronger health/status surfaces, operator access control (panel/API auth), startup crash recovery, Plaud client timeouts, observability surfaced in the panel UI; resumable backfill (deferred, no firm target) | Automatic re-login, NAS rollout, OSS polish | Multi-day unattended run on `dev-vm` with predictable recovery behavior |
| Phase 4 | `0.7.x` – `0.9.x` | Phone-friendly re-auth UX (browser-assisted bearer capture, D-019, shipped v0.7.0; local Chrome extension shipped v0.8.0); Plaud Web fingerprint fix (v0.8.1); reference-driven operator panel redesign with ES/EN chrome and observability surfaces (v0.9.0); full-viewport operator shell patch (v0.9.1); Main sync UX patch (v0.9.2); DocKit governance merge preserving local guardrails (v0.9.3); Library playback/scroll patch (v0.9.4); mobile shell usability patch (v0.9.5); LLM-DocKit 4.9.6 governance sync and package-lock version enforcement (v0.9.6); optional automatic re-login via a non-browser path (official OAuth/MCP) if it proves reliable | Browser automation (headless Chromium) as default or silent fallback; NAS rollout | Renewal strategy implemented or explicitly rejected with rationale, and the operator panel exposes the health signals needed for the soak |
| Phase 5 | `0.10.x` | Home Infra Protocol project contract + sync-job status snapshot, deployment hardening, backups, rollback, NAS validation, infra playbooks | Public OSS polish | Repeatable deployment on both `dev-vm` and NAS, with sync status visible to infra consumers |
| Phase 6 | `0.11.x`+ | Operator and OSS fit and finish: explicit destructive workflows, optional provider-neutral Transcription Intake v1, closed-loop transcription coverage, public quickstart, sanitized examples, contributor-facing polish | Hosted or multi-tenant posture; transcription inside Plaud Mirror; hard dependency on Media2Text/Cortex/Home Infra; live integration against an unproven provider | Operator workflows are deliberate, every eligible Plaud artifact revision can be reconciled to a conforming provider's terminal state, and the repo is understandable without private infra context |

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

Remaining work before the Phase 3 exit gate: `v0.9.0` surfaces `health.warnings` / `lastErrors` / `recentSyncRuns` in the panel UI, so the remaining hardening item is the secrets KDF upgrade from single-pass SHA-256 to scrypt-with-salt (H2 from the same review; deprioritized while the master key is strong and random), followed by the multi-day soak itself.

## Why Phase 2 Was Extended Through 0.4.x

The original table assigned one minor version per phase (`0.3.x` = Phase 2, `0.4.x` = Phase 3). During Phase 2 development the owner requested an inline audio player plus a local-only "delete from mirror" flow with restore — a product-surface increment that extends Phase 2's contract ("first usable manual vertical slice") rather than crossing into Phase 3's scope (scheduler, outbox, unattended operation).

Rather than dilute the phase boundary, the roadmap was re-cut: Phase 2 covers both `0.3.x` (initial slice) and `0.4.x` (curation UX on top of that slice), and every subsequent phase shifts by one minor version. SemVer (minor = new user-visible feature) stays authoritative; phase labels follow.

## Why Phase 2 Was Re-cut

Phase 2 now means "first usable manual vertical slice", not "everything operational forever." The reason is simple: the earlier roadmap bundled UI, Docker, scheduler, retry logic, and deployment hardening tightly enough that it became easy to drift back into a CLI-only state while still speaking as if the first product slice had landed.

The corrected rule is:

- **Phase 2 proves the product surface exists.**
- **Phase 3 proves it can run unattended and recover cleanly.**

That separation is intentional and should not be collapsed casually.
