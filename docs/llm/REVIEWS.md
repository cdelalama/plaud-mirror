# Review Notes

This file archives formal reviews with enough analytical detail to reconstruct *why* each decision was made, not only *what* was decided. Short outcome bullets live in `HANDOFF.md`; stable rationale lives in `DECISIONS.md`; this file preserves the reasoning that connects the two.

## Review Entry Convention

When a review generates non-trivial pushback or a merge pass, the entry should use the structure below. Simple sign-offs (no debate) can stay as a one-paragraph note.

```
## <YYYY-MM-DD> — <Review Name>

**Input:** <what was reviewed>
**Reviewers:** <LLM / human, in order of pass>

### Points of Agreement
- <bullet>

### Points Raised (Pushback / Additions)
1. **<short title>** — <one-line summary of the point>
   - Resolution: Adopted / Amended / Rejected
   - Rationale: <why that resolution, citing user decisions, constraints, or evidence>

### Summary Outcome
- <final merged conclusions>

### Follow-Through Landed
- <concrete actions taken in the same session>
- <actions deferred, with pointer to where they are tracked>
```

The goal is *referenceable analysis*, not full transcripts. If a point is decided without debate, one line is enough. If a point generates disagreement, capture both sides and the resolution so the reasoning survives future sessions and LLM changes.

---

## 2026-04-22 — Roadmap Review

**Input:** Codex GPT-5's post-brainstorm implementation roadmap for the first usable Plaud Mirror release (appended to `HANDOFF.md`).
**Reviewers:** Claude Opus 4.7 (second-opinion pass) → Codex GPT-5 (merge pass).

### Points of Agreement

- **TypeScript monorepo stack** (Fastify API + React/Vite panel + SQLite + Zod). Matches the already-scaffolded `apps/api/`, `apps/web/`, `packages/shared/` layout; Zod-first shared schemas give a single source of truth for API, webhook, and config contracts.
- **Plaud spike before scaffolding.** Original architecture assumes the Plaud flow documented by `iiAtlas/plaud-recording-downloader` still holds; that assumption must be re-validated before committing to a data model or filter set.
- **Manual-token-first, defer auto-relogin.** Shipping a useful mirror without renewal is strictly better than not shipping because renewal isn't solid.
- **dev-vm first, NAS later.** Matches the existing home-infra deployment pattern (`docker save | ssh 10.0.0.220 'docker load'`).
- **Same-process jobs, no Redis.** Right-sized for a personal mirror.
- **Unified webhook contract for backfill + sync.** One contract simplifies downstream integration (e.g. `youtube2text-api`); a "mirror-only backfill" remains worth preserving as a config flag.

### Points Raised (Pushback / Additions)

1. **Browser-assisted renewal should not be on the roadmap as a fallback.**
   - Pushback: Chromium/Playwright adds attack surface inside a service holding Plaud credentials; painful on NAS + QNAP Docker quirks; if direct renewal fails, better to stop and redesign than paper over with browser automation.
   - Resolution: **Amended.** Kept on the roadmap but reclassified as de-prioritized research; not a planned path; requires fresh user approval to revisit. The user had previously accepted it as a non-ideal optional path, so removing it entirely would have over-corrected.
   - Rationale: preserve user's earlier acceptance while ensuring it does not silently become the default.

2. **Doppler integration is missing from the plan.**
   - Pushback: infra convention (`~/src/home-infra/docs/CONVENTIONS.md`) is Doppler for every secret; the scaffold should run under `doppler run --project plaud-mirror --config dev -- ...` from day 1.
   - Resolution: **Amended.** Doppler is adopted as the *infrastructure convention* for this owner's environments, but the *application contract* stays plain environment variables so the project remains portable for OSS users. Doppler injects the env vars; the app never imports a Doppler SDK.
   - Rationale: avoids coupling a portable OSS product to a specific secrets manager while still matching the home-infra convention locally. This amendment is an improvement over the original push, which conflated infra wiring with product dependency.

3. **home-infra docs update is missing from the plan.**
   - Pushback: per global CLAUDE.md, any new service or project must be reflected in `~/src/home-infra/docs/`. Missing here: register `plaud-mirror` in `PROJECTS.md` now; update `SERVICES.md` and `INVENTORY.md` on deployment.
   - Resolution: **Adopted** (as an operational reminder tied to implementation/deployment slices, not to the product core). Landed in this session.

4. **Webhook HMAC signing should be Phase 2, not deferred.**
   - Pushback: cheap to implement (one shared secret + SHA-256); expensive to retrofit once downstream consumers exist.
   - Resolution: **Adopted.** HMAC signing is now a Phase 2 requirement for the first usable release.

5. **Phase 1 spike needs a storage/measurement task.**
   - Pushback: measuring audio artifact size, format, and rough arrival rate drives retention/pruning decisions and validates whether local filesystem storage is adequate before commitment.
   - Resolution: **Adopted.** Added to Phase 1 exit criteria.

6. **Plaud TOS exposure is not addressed.**
   - Pushback: a third-party client that automates authenticated access to Plaud and stores the audio locally occupies grey space relative to Plaud's TOS; the repo should state its operator-only posture before presenting itself as OSS to avoid drifting into looking like a hosted-mirror product.
   - Resolution: **Adopted.** Opened and accepted as D-009 ("Operator-only TOS posture"). Posture statement, not a legal opinion; narrows the claimed use.

7. **Backfill scope in Phase 2 — worth questioning.**
   - Pushback: Phase 2 becomes materially smaller and ships faster if backfill slides to Phase 3; open question whether day-1 backfill is a genuine requirement.
   - Resolution: **Rejected.** The user had already confirmed day-1 historical backfill in the `Confirmed Product Direction` section of the handoff; this reopened a closed decision. Claude's mistake: should have checked confirmed-direction before raising as open. Backfill stays in Phase 2.

8. **Scheduler polling default is unspecified.**
   - Pushback: Phase 3 says "configurable scheduler" but picks no default; Plaud recordings arrive at most a few times/day, so 15–30 min is plenty and faster invites rate-limit or TOS issues.
   - Resolution: **Adopted.** Phase 3 now targets 15-minute default.

### Summary Outcome

- Keep the GPT-5 vertical-slice roadmap as the base.
- Adopt the useful additions: Phase 2 webhook HMAC, Phase 1 storage measurement, D-009 TOS posture, 15-minute scheduler default, home-infra follow-through.
- Do not move historical backfill out of the first usable release.
- Treat Doppler as an infrastructure convention, not a product dependency.
- Keep browser-assisted renewal off the planned path; only revisit it with fresh user approval.

### Follow-Through Landed

- D-003 amended in `docs/llm/DECISIONS.md` (phased auth strategy).
- D-009 added in `docs/llm/DECISIONS.md` (operator-only TOS posture).
- `plaud-mirror` registered in `~/src/home-infra/docs/PROJECTS.md`.
- HANDOFF rewritten as operational snapshot; debate archived in this file.
- D-009 posture copy in `README.md` and `LLM_START_HERE.md` deferred to the Phase 2 implementation window to avoid churn before scaffolding.

---

## 2026-07-13 — Pre-Soak Execution Audit + Upstream Baseline Review

**Input:** GPT-5 Codex's pre-soak execution (06c8518..a791e0a, v0.10.2 → v0.10.7) and the five drifted upstream baselines behind the daily `upstream-watch` workflow failures.
**Reviewers:** Claude Fable 5 (auditor pass with live verification), following the prior cross-audit chain (Claude Fable 5 architecture audit → GPT-5 Codex counter-audit → merged pre-soak plan).

### Points of Agreement

- All twelve claimed pre-soak fixes verified present in code and, where observable, live: atomic download (temp + same-directory rename), physical artifact reconciliation in candidate selection, per-candidate failure isolation without false green (run closes `failed` when any candidate fails), backfill-vs-active-sync HTTP 409, truthful awaitable scheduler tick (live tick/run completion delta of 3 ms), enforced whole-run max-runtime, bounded pagination, recoverable outbox claims with `delivering` in health counters, corrected 9-attempt backoff restoring the designed ~16 h window, SIGTERM drain before SQLite close, compose healthcheck, and the `.dockerignore`/web-typecheck/test-glob/CI evidence gate.
- Runtime v0.10.7 healthy at review time: 619/619 mirrored, scheduler PT15M ticking, outbox all-zero, warnings empty; contract `internal-loop`/PT15M/PT2H on protocol 0.7.1; catalog preview renewed to 2026-07-22. The soak evidence stream is credible.

### Points Raised (Pushback / Additions)

1. **Backdated commit metadata** - all seven pre-soak commits (`2f38024..a791e0a`) carry AuthorDate and CommitDate 2026-07-06 with round, hand-set times (13:00 to 16:30 CEST), while GitHub records the pushes on 2026-07-10 22:15-23:32 UTC and HANDOFF/HISTORY correctly record the execution window. The operator explicitly requested the July 6 dates, and the executor set `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` to comply; that provenance was not recorded in the commits themselves.
   - Resolution: Provenance corrected; history NOT rewritten.
   - Rationale: this was not a sandbox-clock defect. The process error was accepting intentional backdating without first warning that Git would stop being reliable chronological evidence and without recording the operator request in the affected commits. Rewriting published `main` mid-soak would trade that forensic blemish for force-push risk, so GitHub push timestamps plus HANDOFF/HISTORY remain the chronology of record. Any future intentionally backdated commit must carry both `Backdated-By-Operator-Request: true` and `Actual-Execution-Date: YYYY-MM-DD` trailers.
2. **Daily failing `upstream-watch` emails** — working as designed (D-004 forces review on drift), but the review was overdue: the baseline had not been verified since 2026-04-22 and five of eight upstreams had moved, including both primaries.
   - Resolution: Adopted — full baseline review performed this session.
   - Rationale: see `docs/UPSTREAMS.md` "2026-07-13 Baseline Review". The applaud v0.5.11 finding (Plaud first-party `pld_ut`/`pld_urt` token model replacing localStorage `pld_tokenstr` for new accounts) is material to the re-auth strategy and is recorded as a D-019 amendment.

### Summary Outcome

- Execution audit: gate cleared; the soak continues undisturbed through 2026-07-15/16.
- Upstream review: baselines refreshed for the five drifted repos; nothing adopted mid-soak; the D-019 amendment queues the capture-path adaptation, which doubles as the first credible fully-unattended renewal path.

### Follow-Through Landed

- `config/upstreams.tsv` + `docs/UPSTREAMS.md` baselines refreshed (this silences the daily workflow failure emails).
- D-019 amendment (2026-07-13) added in `docs/llm/DECISIONS.md`.
- HANDOFF Open Work gains the first-party token adaptation item, paired with the scrypt KDF upgrade.
- Deferred, tracked in HANDOFF: the capture-path adaptation itself, the App.tsx decomposition branch, and the NAS slice — all post-soak.

---

## 2026-07-14 - Permanent Plaud Deletion Security Audit

**Input:** Plaud Mirror v0.11.0 source and deployed behavior after the
dismissed-to-permanent-delete rollout.
**Reviewers:** Claude Opus 4.8 (read-only backup auditor) -> GPT-5 Codex
(verification and remediation). Claude Fable 5 was requested first but its
CLI quota was exhausted, so no Fable audit is claimed for this release.

### Points of Agreement

- The dismissed-only guard, trash-then-delete order, post-success monotonic
  tombstone, restore 410, sequential idempotence, and no-reimport behavior are
  coherent in the inspected implementation.
- One normal confirmation is the operator's explicit UX decision. The action
  remains a second step shown only after reversible local dismiss.
- Production had operator access control enabled, warnings empty, and anonymous
  deletion rejected; no real Plaud recording was deleted during validation.

### Points Raised (Pushback / Additions)

1. **Irreversible route inherited open-development mode.** With
   `PLAUD_MIRROR_ADMIN_PASSPHRASE` absent, the global API hook allowed the
   permanent upstream route through.
   - Resolution: Adopted in v0.11.1.
   - Rationale: compatibility mode remains useful for non-destructive local
     development, but an irreversible upstream mutation must fail closed.
2. **Single confirmation.** The auditor noted that local dismiss and permanent
   deletion use the same dialog mechanism despite different consequences.
   - Resolution: Retained by operator decision.
   - Rationale: permanent deletion is already a separate post-dismiss action,
     and its copy explicitly names the Plaud-account loss and irreversibility.
3. **Minor code hygiene.** An unused identity helper and a misleading ENOENT
   comment were present.
   - Resolution: Adopted in v0.11.1.
   - Rationale: remove dead code and keep comments aligned with the existing
     `localFileRemoved` contract.

### Summary Outcome

- v0.11.0 was operationally safe in the configured deployment, but v0.11.1
  removes the configuration-dependent authorization gap in code.
- The backup audit could not verify every sibling-repo baseline or execute the
  suites because of its read-only tool limits; Codex owns full local, CI, live,
  and cross-repo verification before closure.

### Follow-Through Landed

- Route-local 403 guard and regression assertion.
- Auth, API, architecture, roadmap, decision, handoff, and history docs updated.
- Full gates, CI, deployment, Home Infra 0.5.7 reconciliation, and final
  warning-free Infra Portal provenance completed in the same execution. No
  real Plaud recording was deleted.
- A final read-only Claude Opus 4.8 pass returned GO with no medium-or-higher
  findings. Its two low suggestions were adopted in v0.11.2: a named reusable
  destructive-route pre-handler and exact anonymous-401 coverage for this
  endpoint. Its informational partial trash/delete state is documented in the
  auth runbook.

---

## 2026-07-16 - First Live Deletion Integrity Re-audit

**Input:** v0.11.2 source, the persisted tombstone created by the operator's
first real Plaud deletion on 2026-07-15, live SQLite/health/protocol state, and
the current Home Infra, Home Infra Protocol, Infra Portal, Cortex, and
Media2Text boundaries.
**Reviewers:** GPT-5 Codex (audit, design, implementation).

### Points of Agreement

- The single-operator Fastify + SQLite architecture remains correctly sized;
  no external queue, distributed transaction, or cross-project redesign is
  justified.
- Home Infra Protocol status details are additive passthrough data, Infra
  Portal does not parse Plaud-private counts, and the Cortex/Media2Text Plaud
  contracts are still drafts. The correction belongs in Plaud Mirror first.
- The real tombstone is valid operational evidence and must be preserved; no
  additional live deletion is appropriate for validation.

### Points Raised (Pushback / Additions)

1. **HTTP 2xx was treated as destructive success.** HTML or unknown JSON could
   authorize a tombstone without proving Plaud accepted the mutation.
   - Resolution: Adopted in v0.12.0. Empty body and explicit status zero are the
     only accepted acknowledgements.
2. **A tombstone polluted current remote coverage.** The mapper subtracted all
   historical dismissed rows from the current Plaud total, producing a
   partition larger than the remote inventory after actual deletion.
   - Resolution: Adopted in v0.12.0. Full sync commits one inventory generation
     after physical artifact verification; local-only and confirmed-deleted
     counts are separate.
3. **Partial deletion state was not durable.** A process/DB failure between
   trash, DELETE, and tombstone persistence could not be reconstructed safely.
   - Resolution: Adopted in v0.12.0. Current operation state and append-only
     events are persisted around side effects; retry reconciles before repeat.
4. **Dismissed-row opacity muted the destructive command.** Parent opacity
   reduced contrast on the control that most needs legibility.
   - Resolution: Adopted. Only passive recording content is muted; actions keep
     full contrast.

### Summary Outcome

- This is a backward-compatible minor capability, not a patch-only cosmetic
  fix: additive persistence and API fields establish explicit recovery and
  coverage contracts.
- Sibling contracts do not require a coordinated protocol or Cortex change.
  Home Infra must only be reconciled after the new runtime is deployed and its
  first complete inventory generation is observed.

---

## 2026-07-16 - Media Intake v1 Producer Review

**Input:** Media2Text `media-intake.v1.schema.json`, contract semantics, and
Stages 3-6 at frozen review input commit
`c982ced959f56dc5ff41efb8e7b1445f5162129a`, contrasted with Plaud Mirror
0.12.0 persistence, outbox, physical coverage, dismiss/restore, and permanent
deletion behavior.
**Reviewers:** GPT-5 Codex (Plaud Mirror producer review), following the
operator-ratified Plaud-first direction from Cortex.

### Points of Agreement

- `POST /v1/intakes` returning 202 only after durable SQLite admission is the
  right boundary. It truthfully means accepted work, not fetched or
  transcribed audio.
- Cross-host HTTPS artifact transfer, exact-origin allowlisting, no shared
  paths/volumes, declared SHA-256/bytes/content type, consumer-side byte/hash
  verification, bounded fetch retries, and 409 conflict semantics are the
  correct foundation.
- Plaud Mirror can perform historical replay from current-generation,
  physically verified local files without contacting Plaud. It will need to
  compute and persist SHA-256 because 0.12.0 currently proves existence and
  byte length, not content digest.
- At-least-once delivery and crash recovery fit Plaud Mirror's existing durable
  outbox model. The new intake payload must be additive; the legacy
  `recording.synced` payload contains `localPath` and is not the intake
  contract.

### Points Raised (Pushback / Additions)

1. **Collection identity is optional in the schema and ignored by the consumer
   uniqueness key.** `source.collectionId` is not required, while Media2Text's
   `intakeId`, lookup, and SQL `UNIQUE` use only `authority + itemId +
   artifactRevision`.
   - Resolution: REQUEST CHANGES.
   - Required change: make `source.collectionId` required; include it in the
     deterministic `intakeId`, lookup predicates, unique index, status lookup,
     and idempotency documentation. Define Plaud's value as a stable,
     pseudonymous account/workspace namespace.
   - Failure example: two Plaud collections expose the same `itemId` and
     revision. The second request is incorrectly deduplicated or receives 409
     even though it is a different source item.

2. **The artifact fetch is not authenticated despite the prose guarantee.**
   The intake API key authenticates Plaud Mirror to Media2Text, but the current
   Media2Text fetch sends only `Accept`; exact-origin allowlisting is not
   authentication.
   - Resolution: REQUEST CHANGES.
   - Required change: add required `artifact.accessProfile` to the schema and
     define it as an identifier for a receiver-side, exact-origin credential.
     For the Plaud profile, Media2Text sends `Authorization: Bearer <separately
     provisioned secret>` to an immutable HTTPS URL. Forbid username/password,
     query credentials, and fragments in `artifact.url`; never serialize the
     secret.
   - Failure example: a correctly protected Plaud artifact endpoint returns
     401. Media2Text classifies that 4xx as permanent and the intake fails
     without ever reading audio.

3. **Revision and cost metadata invariants are underspecified.** The schema can
   accept an `artifactRevision` unrelated to `artifact.sha256`, and
   `filename`/`durationSeconds` are optional even though the Plaud lane has both
   and Stage 6 requires pre-enqueue duration/cost accounting.
   - Resolution: REQUEST CHANGES.
   - Required change: specify and validate
     `source.artifactRevision == "sha256:" + artifact.sha256`; require
     `artifact.filename` and `artifact.durationSeconds` for the
     `source.authority = "plaud-mirror"` profile, with duration strictly
     positive. Re-delivery must preserve an identical canonical request.
   - Failure example: one revision key points at two hashes, so a retry becomes
     a 409 conflict or a permanent hash mismatch instead of deterministic
     deduplication.

4. **A 202 has no closed-loop completion path back to the producer.** The
   response includes `links.self`, but the least-privilege intake credential is
   explicitly denied GET access. `transcript.ready` is currently a separate
   Cortex-facing outbox, so Plaud Mirror cannot determine whether all admitted
   recordings were transcribed.
   - Resolution: REQUEST CHANGES.
   - Required semantic change: add a producer-scoped status read at the
     returned `links.status`/`links.self`, authorized by the intake credential
     only for that producer's rows. Add a durable HMAC-signed producer status
     event with `schemaVersion = media2text.intake-status.v1`,
     `eventType = intake.status`, `eventId`, `idempotencyKey`, `occurredAt`,
     `intakeId`, full `source` identity, terminal status `completed` or
     `failed`, optional `transcriptId`/`recordSha256`, and optional sanitized
     `error.code`. Push is primary; pull is reconciliation.
   - Failure example: Media2Text permanently fails transcription after Plaud
     Mirror records the 202 as delivered. Both dashboards stay green and the
     operator cannot explain why source coverage exceeds transcript coverage.

5. **Artifact lifetime is undefined across dismiss and permanent deletion.**
   Plaud Mirror dismiss unlinks audio immediately. Media2Text fetches only
   after 202, so an accepted event can race a local dismiss and produce a
   permanent 404.
   - Resolution: REQUEST CHANGES.
   - Required semantic change: producer admission must pin an immutable
     delivery copy before enqueue and retain it until Media2Text reports a
     terminal state. Before durable admission, dismiss cancels eligibility.
     After 202, dismiss may hide/remove the library copy but cannot revoke the
     pinned transfer copy; permanent Plaud deletion has no implicit delete or
     cancellation effect in Media2Text.
   - Failure example: enqueue -> 202 -> operator dismisses -> worker GET 404.
     The producer outbox says delivered while no transcript can be produced.

6. **Replay ownership is ambiguous.** Identical redelivery should deduplicate,
   but a true re-transcription of the same artifact revision cannot be
   expressed without conflicting with the unique source revision.
   - Resolution: REQUEST CHANGES.
   - Required semantic change: define Plaud historical replay as first
     admission of locally verified revisions and retry as byte-identical
     redelivery. Define explicit re-transcription as a Media2Text operation
     against the existing `intakeId`, not a mutated producer request under the
     same revision.
   - Failure example: a force replay changes `eventId` under the same revision;
     Media2Text returns 409 rather than starting intentional reprocessing.

7. **Privacy posture is mostly correct but URL secrecy is still ambiguous.**
   The schema excludes local paths and the public status omits origin details,
   but HTTP(S) URLs can still carry query capability tokens and are persisted
   in `request_json`.
   - Resolution: REQUEST CHANGES.
   - Required semantic change: artifact URLs contain no Plaud bearer,
     operator cookie, query secret, fragment, filesystem path, email, or device
     nickname. Logs and public health expose ids, counts, states, and sanitized
     error codes only; titles, filenames, URLs, and transcript content remain
     private product data.

### Summary Outcome

- **REQUEST CHANGES.** The draft is directionally correct, but it cannot be
  frozen for Plaud Mirror while collection identity, authenticated fetch,
  artifact lifetime, and producer completion reconciliation remain open.
- The desired product loop is explicit: Plaud Mirror reports eligible,
  admitted, processing, transcribed, and failed counts per artifact revision;
  Media2Text reports terminal truth; Cortex consumes transcript-ready output.
- No adapter, artifact endpoint, webhook target, canary, replay, runtime change,
  rebuild, restart, or deployment is authorized by this review.

### Follow-Through Landed

- D-022 records the Plaud-first closed-loop product boundary and freeze gate.
- ROADMAP, PROJECT_CONTEXT, ARCHITECTURE, HANDOFF, and HISTORY were aligned to
  deployed 0.12.0 plus this contract-review outcome.
- Version remains 0.12.0 because this is documentation-only producer review;
  the deployed soak is untouched.

## 2026-07-16 - Producer Review Resolution And Independence Amendment

**Trigger:** the operator clarified that Plaud Mirror must remain independently
publishable and connect to any service implementing a stable interface;
Media2Text must not become a product dependency.

**Resolution:** the seven REQUEST CHANGES above remain valid evidence, but the
consumer-repository freeze mechanism is superseded. Plaud Mirror now owns
provider-neutral **Transcription Intake v1** under `docs/contracts/`, and D-023
defines Media2Text as the first intended compatible provider.

The v0.14.0 source resolves the producer-side findings:

- full collection-aware source identity and SHA-bound artifact revision;
- separate intake, artifact, status, operator, and Plaud credentials;
- exact origins with no path/query/fragment/embedded credentials;
- content-addressed pinned audio through terminal state;
- additive durable intake outbox with crash recovery and full retry window;
- atomic HMAC status journaling, monotonic transitions, deduplication, and pull
  reconciliation;
- physically verified local historical replay, dismiss/delete lease safety,
  sanitized error handling, and exact coverage in the operator panel.

This is not retrospective acceptance of Media2Text commit `c982ced`: that
snapshot remains rejected as reviewed. Media2Text must implement the published
Plaud contract or propose a versioned change, then pass the conformance canary.
No live traffic, canary, replay, deploy, or sibling-repository edit is
authorized by the v0.14.0 source implementation.

## Planned Reviews

- Security review before implementing credential storage (recommend invoking `/security-review`).
- Contract review before freezing the first HTTP API and webhook payload.
- Deployment review before publishing the first Docker image.
