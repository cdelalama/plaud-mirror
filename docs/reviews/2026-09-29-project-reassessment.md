# Plaud Mirror and ecosystem reassessment

Date: 2026-09-29 UTC. Scope: source/contract review, read-only production
observations, current roadmap, and separately authorized local DocKit/Dossier
adoption. This is not exhaustive penetration testing or a deployment approval.

## Conclusion

Plaud Mirror is a working audio mirror with a proven optional transcription
transport. Its main unfinished work is recovery and operation of that existing
connection, not a new transport implementation. Keep the current product
boundaries and finish a usable, bounded flow before adding abstractions.

## Source and deployment evidence

Remote main revisions were checked with `git ls-remote`; worktrees were inspected
without switching dirty branches. Source and deployed versions are separate.

| Project | Published main examined | Source version | Runtime evidence |
| --- | --- | --- | --- |
| Plaud Mirror | 85f624f | 0.16.4 before this tooling candidate | NAS 0.16.1, Docker healthy |
| Media2Text / youtube2text | 7f97e83 | 0.40.3 | NAS API/web 0.39.3, Docker healthy |
| LLM-DocKit | d065a38 | 4.17.0 | Source tooling; no application deploy |
| ForgeOS | 13a4972 | 0.28.1 | Shared Dossier engine; primary checkout is an older dirty Live Now branch |
| Infra Portal | 10f7aa2 | 0.32.2 | NAS 0.32.2; primary checkout is 13 commits behind |
| Home Infra | a4e0153 | 0.45.0 | Catalog/provenance consumer; local Home Infra Dossier adopted today |

The separate Plaud agent-development worktree at 61a1fc6 remains distinct
from published main. Its prior review/infra publication gates are not silently
closed by the new Opus default or by this local adoption.

### Observed production state

HTTPS health/status and Portal reads began at 14:38 UTC; subsequent authenticated
Plaud GETs and read-only receiver SQLite queries refined the counts. No sync,
enqueue, retry, provider invocation, credential rotation or deployment was run.

- Plaud's current inventory reports 770 remote and 770 physically verified
  mirrored items, no missing/dismissed/local-only items, and one historical
  upstream tombstone outside that partition. This is application verification
  evidence, not a new independent all-byte filesystem audit.
- Plaud authentication is healthy; the scheduler runs every 15 minutes. The
  generic webhook is unconfigured and its outbox is empty.
- The primary Media2Text destination is enabled. Plaud's authenticated coverage
  is **770 = 622 not sent + 76 transcribed + 72 failed**, with zero in-flight
  deliveries. Two failed deliveries are reviewed as resolved; 70 require review.
- Replay preview still contains exactly 622 items, 8,991,692,398 bytes and
  2,188,826.7 seconds (608.0074 hours). The older backlog count happens to remain
  correct; older success/failure counts do not.
- Plaud retains three additional admission-stage failures from August 26-27;
  its admission outbox has 145 delivered and three permanently failed. This
  explains the 72 versus 69 failure-count difference without merging stages.
- Media2Text has 76 completed and 69 failed Plaud intakes. All failures expose
  the generic `transcription_failed` code. Exact application error-prefix
  classification identifies 36 per-item duration refusals, 30 rolling monthly
  dollar-cap refusals and one daily source cap refusal. Two cases remain
  unclassified by that query. This is not individual operator review or proof
  of provider invocation for every historical job.
- Media2Text retains 76 pending Transcript Ready obligations, zero delivered;
  the output URL is unset. Its source-status outbox has 435 delivered and none
  pending. The YouTube scheduler is disabled, which does not disable Plaud intake.
- Live receiver limits are enforced: 180 minutes/item, 300/run, 600/source/day,
  3,000 total minutes/30 days and USD 25/30 days. The configured Deepgram estimate
  is USD 0.552/hour; it is not a newly verified vendor quote or spending approval.
- Portal independently reports fresh Plaud `ok/none` and Media2Text
  `degraded/warning`, with no provenance warnings. A healthy mirror therefore
  does not imply that all recordings are transcribed or delivered to Cortex.
- Existing runbooks leave independent audio backup/restore unverified. This
  review did not audit backup archives and must not claim no backup exists.

## Ownership that should remain

| Concern | Owner |
| --- | --- |
| Original audio, Plaud inventory, leases, admission and source coverage | Plaud Mirror |
| Admission, audio normalization, provider execution, spend caps and transcript store | Media2Text |
| Semantic ingestion/retrieval after Transcript Ready | Cortex, a separate downstream hop |
| Hosts, storage placement, ingress and observed deployment catalog | Home Infra |
| Read-only operational and Dossier presentation | Infra Portal |
| Cross-project coordination and shared Dossier implementation | ForgeOS |
| Portable governance, onboarding and deterministic session checks | LLM-DocKit |

Keep the network contract even though both products run on one NAS: immutable
audio identity, authenticated fetch, durable idempotent admission, signed status
and pull reconciliation. Do not introduce shared volumes, a second transcription
engine inside Plaud, or a universal protocol repository before D-024's second
structurally different processing profile exists.

## Findings and recommended order

1. **Recoverability is not demonstrated.** Obtain project-scoped backup coverage
   for audio, coherent SQLite, encrypted secrets and recoverable key custody;
   restore to isolation and compare source identities. A same-NAS snapshot is
   useful recovery evidence but not independent physical custody. Retain the
   old control-state seed until its replacement is actually verified.
2. **The existing connection accumulates terminal failures.** Reconcile the
   three admission failures and 69 processing failures by identity, classify each,
   and confirm current usage headroom. Review is metadata, not retry authority.
   Plaud exposes Retry for the three admission failures: that re-admits work
   with the same deterministic key and may incur provider spend, so first check
   eligibility and headroom. Its 69 processing failures are not retryable there.
   Do not blindly replay a terminal idempotency key: that deduplicates instead
   of retranscribing. Define receiver-owned recovery and how its result becomes
   visible without regressing the frozen producer terminal state.
3. **Economic policy is a product workflow gap.** An enabled destination sends
   new recordings automatically; a disabled YouTube scheduler does not stop it.
   Expose receiver-owned eligibility, headroom and quote before new batches.
   Duration/budget refusal should be understandable and deliberately recoverable,
   not an invitation to increase limits blindly. Preserve hard enforcement at
   the provider boundary. The 608-hour backlog exceeds both rolling 30-day
   ceilings: 50 hours by duration and approximately 45.3 hours under USD 25 at
   the configured rate, before any existing consumption. The dollar ceiling
   binds first. The backlog needs its own budget and selected scope.
4. **Finish bilateral provisioning.** D-026 in Plaud and D-024 in Media2Text
   already ratify the direction. Media2Text still reads profiles from
   `Y2T_TRANSCRIPTION_INTAKE_PROFILES_JSON` on demand; mutable encrypted profile
   storage, authenticated admin API/UI and one-time seed migration are absent.
   Freeze request/grant schemas and negative cases before implementing them.
   Then implement the receiver half and Plaud import/export, persisted canary
   kind, policy/evidence/health dimensions and deliberate pause/rotation/
   disconnect/archive. Follow Plaud 0.17/0.18 and receiver 0.41/0.42 scope splits
   according to actual release contents, not stale version assignments.
5. **Treat Cortex as a separate deliverable.** The exact Transcript Ready pin
   was ratified in the producer/consumer records; Media2Text's corresponding
   source is ahead of deployed 0.39.3. Current Cortex runtime was not inspected
   here. Coordinate its owner and the receiver deployment before enabling that
   hop. Pending obligations are not delivered knowledge. Plaud transcription
   acceptance can be demonstrated independently of semantic retrieval.
6. **Close stability with evidence.** Preserve the existing joint final-release,
   canary, first automatic tick and five-day freeze rule. Current uptime and
   happy-path health do not close it. The generic-webhook drill remains a
   distinct written requirement. If that optional feature is no longer wanted,
   amend the requirement explicitly; do not keep an irrelevant gate forever or
   silently call transcription its substitute.
7. **Address renewal and secret persistence next.** The extension still reads
   browser storage; cookie/refresh capture is queued. Applaud's current primary
   README still documents the cookie/token distinction, corroborating the
   existing upstream risk (https://github.com/rsteckler/applaud#how-it-works).
   The user's current legacy bearer works; this review did not test refresh.
   Pair refresh-token support with recoverable secret-store migration and
   scrypt. `SecretStore.save` currently writes the live encrypted file directly,
   without an atomic replacement or serialization across read/modify/write
   operations; review crash/concurrent-update behavior before growing credential
   administration. This is a code risk, not evidence of observed corruption.
8. **Polish after the vertical slice works.** Improve setup/recovery copy and
   focused component boundaries rather than rewrite the product. Current
   `store.ts` has 2,685 lines, `service.ts` 1,601 and `App.tsx` 2,407. Size alone
   is not a defect; extract only boundaries touched by the next verified change.
   Finish standalone onboarding and resumable backfill according to actual need.

## Roadmap and governance corrections

The product has delivered slices from phases 3 through 6 concurrently. A single
phase number or completion percentage conceals missing acceptance. Track each
capability with separate source, deployment, runtime, recovery and operator
evidence instead. Preserve the existing normative phase boundaries.

HANDOFF had 513 lines, multiple dates and contradictory present-tense statements;
the eight-wave brief still names superseded DocKit and Plaud release ranges.
The baseline validator passed 12 checks with two skips and a length warning,
yet did not identify those semantic contradictions. Its PASS cannot substitute
for reading the source/runtime evidence. This change prepends a current synopsis
and labels old snapshots as history; it does not delete forensic material.

DocKit 4.17 adds inert Dossier discovery. Existing adopters are not automatically
enrolled. This local adoption uses the current shared ForgeOS offline tool and
Plaud's actual registry identity. No engine is copied, private session transcript
is exported, shared reader is enabled or runtime changed.

The shared reader API returned only `llm-dockit`; Plaud returned 404. Published
Portal source hardcodes that identity in configuration, SSH request, DTO and
route. ForgeOS's installed transport is likewise narrowly scoped. Multi-project
delivery therefore needs a coordinated ForgeOS/Portal/Home Infra slice; a
DocKit update alone cannot make Plaud appear there.

## Validation scope

The frozen Plaud schema manifest passes all five byte pins; source version sync
passes 25 targets before changes. This tooling candidate must additionally pass
local validator regressions, session/version checks, inert discovery, the shared
tool self-test, declaration/registry validation, capture retry/no_change and exact
export Trace. No runtime code is changed and no paid conformance probe is run.
Final checks, independent review and actual local capture belong in the adoption
receipt and `docs/llm/REVIEWS.md`; planned checks are not claimed as passed here.
