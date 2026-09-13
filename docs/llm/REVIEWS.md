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

## 2026-09-14 - NAS Migration Release Audit

**Input:** Plaud Mirror `v0.16.0` staged migration candidate from base HEAD
`57f1f9b107382750e71f183a02b602aca1a0c6d8`, initial staged tree
`fe6ea19f4775bb626feaba75bb605774fb55d953`, and initial staged binary-diff
SHA-256 `afb592c5e24de697e01e6684419ff831b2fc0792675e9d158405e44b4fb3c327`.

**Reviewers:** exact `claude-fable-5-1` at high effort requested first -> exact
`claude-opus-5[1m]` at high effort after direct quota evidence -> GPT-5 Codex
verification and remediation. Both Claude commands used `--print`,
`--permission-mode plan`, `--permission-prompts none`, `--restricted`, and
JSON output. None was authorized to edit, deploy, use network services, or
spawn subagents.

### Model and evidence record

- Fable result session `a63905f7-999a-469d-8c83-bafcdce366b9` returned HTTP
  429 and the exact message `You've reached your Fable limit.` with zero audit
  output. No Fable review is claimed.
- The permitted fallback used model id `claude-opus-5[1m]`, canonical model
  `claude-opus-5`, high effort, session
  `aea2b76f-c688-49a1-8b66-b9bb6350521a`. It made no repository or runtime
  mutation and spawned no subagent. It read the 36-path candidate snapshot but
  its restricted filesystem interface could not independently decompress Git
  tree objects, so Codex separately reverified HEAD/tree/diff identity and owns
  executable validation.
- Supplied validation was 212/212 tests, build/typecheck, five frozen schemas,
  full and production dependency audits with zero findings, 32/32 validator
  smoke cases, 12/12 DocKit checks, 23/23 version targets, and local container
  build/runtime smoke. Opus treated that evidence as supplied, not reproduced.
- The same Opus session was resumed against remediated tree
  `38ebf3a828294e9adee4f227b7808dfd1b76e5b2`, binary-diff SHA-256
  `1f5aa243149d988c9acd9793bce087c44872b881a03e2c7f133a5cf5e01b1e8e`,
  and 214/214 supplied tests. Pass 2 closed every original HIGH and all seven
  original LOW findings, retained the two declared tradeoffs, and returned
  `REQUEST CHANGES` for one new HIGH plus critical-path medium details.
- Pass 3 reviewed twice-remediated tree
  `75949dd7b707cae9c1b8500944c90d349adcc28e`, binary-diff SHA-256
  `0a0f420cea4c68947c90a45743e87c0afc0c22af5763be2c2b0919e667c7028b`,
  and 215/215 supplied tests. It marked N1-N10 closed and returned `GO` with
  no BLOCKER/HIGH/MEDIUM findings plus two LOW evidence-hardening suggestions.
- Pass 4 reviewed the post-GO hardening tree
  `e44d9f010d4728827f089cd3cdaab7176078a4b7`, binary-diff SHA-256
  `5d9c772bbf3c80607f686d1791ee9303ad84474e1e3201321c9b3bcbffd63715`,
  and 215/215 supplied tests. It closed N11/N12 and returned `GO` with no
  finding at any severity. The auditor retained its prior tool limitation on
  independently decoding Git objects; Codex reverified the frozen identity.

### Points of Agreement

- The split-mount design is compatible with same-directory atomic writes;
  Docker hardening, pinned Doppler bootstrap, old-source retention, horizontal
  Home Infra/Protocol/ForgeOS boundaries, and the documented no-delete path are
  directionally sound.
- Source availability, registry publication, NAS runtime, canonical serving,
  automatic-run evidence, and Home Infra projection remain separate claims.
- The first pass found no BLOCKER, but returned `REQUEST CHANGES` because three
  HIGH operational gaps preceded live cutover.

### Points Raised (Pushback / Additions)

1. **Caddy loopback reachability was asserted but not proved.**
   - Resolution: Adopted.
   - Rationale: live inspection recorded `edge-caddy` network mode `host` and
     availability of in-container `wget`; the runbook now requires both the
     exact mode and an actual proxy-container request to NAS loopback before
     editing Caddy.
2. **Authenticated static/Range validation happened after public cutover.**
   - Resolution: Adopted.
   - Rationale: new `deploy/nas/verify-runtime.mjs` runs inside the candidate
     container before Caddy changes and checks static HTML, armed auth,
     anonymous 401, login, health, protocol, and one-byte authenticated Range
     playback without disclosing the passphrase.
3. **Persistent path guards allowed unsafe override parents.**
   - Resolution: Adopted.
   - Rationale: the launcher now accepts only the two reviewed absolute leaves
     and UID/GID 1000:1000, records prior metadata, rejects symlinks, and
     normalizes the copied tree recursively before startup.
4. **Machine-readable runtime truth moved to NAS prematurely.**
   - Resolution: Adopted.
   - Rationale: `infra.contract.yml` remains `host_id: dev-vm` with `dev`
     secret references until post-serving evidence; the human contract
     explicitly identifies the later post-cutover commit.
5. **Quiescence and exact-copy gates were prose-only.**
   - Resolution: Adopted.
   - Rationale: the runbook now carries literal SQL, checksum dry runs,
     count/byte/hash comparisons, explicit `integrity_check=ok`, and a receipt
     written only after convergence. `start.sh` independently opens the NAS DB
     read-only inside the pinned image and rejects nonzero active work.
6. **Copied file ownership was not guaranteed.**
   - Resolution: Adopted.
   - Rationale: rsync no longer preserves source numeric owners; the exact
     target trees are recursively normalized and checked before the image DB
     probe.
7. **Rollback depended on a Compose env file and the old writer remained
   restart-armed.**
   - Resolution: Adopted.
   - Rationale: full Doppler values now exist only on tmpfs for the launcher
     lifetime. Literal rollback uses the fixed Docker binary, while cutover
     sets the dev-vm container restart policy to `no`; rollback restores the
     policy only after the NAS writer is stopped and state is reconciled.
8. **Secret material, resource ceilings, and logs needed stronger operational
   treatment.**
   - Resolution: Adopted.
   - Rationale: full values are not persisted to the snapshotted share; Compose
     has bounded 10 MB x 3 json-file logs; the first automatic run must retain
     healthy/OOM-free/PID-safe evidence under the 1 GB/256-PID limits.
9. **Deployment asset tests missed likely regressions.**
   - Resolution: Adopted.
   - Rationale: tests now reject a bare `3040:3040`, require every fail-closed
     substitution, logging bounds, exact path guards, image pinning,
     migration receipt/DB checks, and syntax plus semantic surfaces of the
     direct runtime verifier.
10. **The release number appeared inconsistent with the version policy.**
    - Resolution: Amended.
    - Rationale: `v0.16.0` changes physical host/storage placement but preserves
      logical persisted data, schema, HTTP/wire contracts, and hostname with an
      exact rollback. The version policy now states this pre-1.0 minor rule;
      incompatible persisted-data conversion remains major.
11. **The Fable fallback evidence was absent from the reviewed tree.**
    - Resolution: Adopted by this entry.
    - Rationale: quota evidence and exact effective fallback model/effort are
      now durable before the second audit pass.
12. **Dependency modernization and host migration share one release.**
    - Resolution: Retained with explicit risk acceptance.
    - Rationale: the old graph had 12 current advisories, eight high, including
      production Fastify/static paths; shipping it to a new production host is
      not acceptable. The pre-Caddy authenticated static/Range probe now tests
      the surface most affected, all application contracts remain unchanged,
      and the full accepted `v0.15.0` image is retained for rollback. A
      source-only intermediate tag would not reduce production cutover risk.
13. **Seven low-severity drift and robustness details.**
    - Resolution: Adopted or clarified.
    - Rationale: no full-secret temp file persists; empty quoted values fail;
      empty install is documented as scheduler-disabled; CHANGELOG scopes
      loopback to NAS; current Node default is 24; source SQLite integrity is
      an exact assertion; rsync commands start from an absolute repository cwd.
14. **Cutover-grade zero-work checks blocked ordinary launch and crash
    recovery.**
    - Resolution: Adopted.
    - Rationale: SQLite integrity remains unconditional, while a new exact
      `PLAUD_MIRROR_REQUIRE_QUIESCED=true` flag gates zero active work only for
      first migration. Normal `./start.sh` permits retry/processing state and
      lets application initialization recover orphaned rows. The empty-install
      escape remains forbidden for migration and recovery.
15. **The receipt inside the rsynced data tree broke repeat verification.**
    - Resolution: Adopted.
    - Rationale: `.migration-ready-v1` now lives in the dedicated Plaud parent,
      outside the exact-rsynced `data/` tree, so step 5 is idempotent after a
      failed launch.
16. **Compose one-off DB probe could collide with `container_name`.**
    - Resolution: Adopted.
    - Rationale: the probe now uses the fixed Docker binary directly with the
      already-pulled immutable image, no network, read-only root, exact UID,
      resource bounds, and only the data leaf mounted writable for SQLite
      WAL/SHM compatibility. It no longer sends application secrets into the
      probe or depends on QNAP Compose `run` behavior.
17. **Host tmpfs premise was not durable evidence.**
    - Resolution: Adopted.
    - Rationale: live NAS checks returned a 64 MB `tmpfs` for host `/tmp`; the
      runbook records both commands and `start.sh` now refuses secret
      materialization unless `stat -f` still returns `tmpfs`.
18. **Second-pass low-severity executable gaps.**
    - Resolution: Adopted.
    - Rationale: tests assert the application image-pin validator; the
      quiescence SQL includes unconfirmed upstream deletion operations;
      non-POSIX `find -quit` is replaced with checked POSIX `-exec` output;
      `verify-container.sh` makes image/health/OOM/user/root/mount/port/
      memory/PID/log checks executable before and after the first automatic
      run; and launcher stderr/stdout is captured as a durable dated receipt.
      The direct Docker DB probe deliberately keeps the data mount writable so
      SQLite may create WAL/SHM metadata while the connection itself remains
      query-only.
19. **Durable launcher log inherited the invoking shell's umask.**
    - Resolution: Adopted after pass-3 GO.
    - Rationale: the runbook now sets `umask 077`, pre-creates the exact dated
      receipt, and enforces mode 0600 before redirecting launcher output. It
      also documents `docker compose config --quiet` as load-bearing because a
      rendered configuration would write production values to the receipt.
20. **Container verifier omitted four declared hardening properties.**
    - Resolution: Adopted after pass-3 GO.
    - Rationale: its one exact runtime comparison now includes
      `unless-stopped`, `[ALL]` capability drop,
      `[no-new-privileges:true]`, and the precise private `/tmp` mount, using
      Docker-returned values reproduced locally before encoding the gate.

### Summary Outcome

- First- and second-pass verdicts: `REQUEST CHANGES`; pass-3 and pass-4
  verdicts: `GO`.
- All HIGH findings and the actionable MEDIUM/LOW findings are reconciled in
  source; dependency splitting is the one explicitly retained tradeoff.
- The two pass-3 LOW suggestions were adopted before publication and pass 4
  closed both without introducing a new finding. The independent review gate
  is cleared; publication and live cutover remain separate gates.

### Follow-Through Landed

- Exact path/identity allowlists, tmpfs-only full secrets, recursive ownership,
  symlink rejection, migration receipt, image-based SQLite preflight, log
  rotation, direct runtime verifier, exact migration commands, source-writer
  disarm, literal rollback, version-policy clarification, and current-truth
  contract correction.
- Cutover-only quiescence, normal orphan recovery, an idempotent external
  receipt, direct-Docker database probe, verified host tmpfs, upstream-deletion
  gate, POSIX symlink scan, full container-policy verifier, and durable launcher
  log close the second-pass findings.
- No Doppler, NAS persistent path, runtime, Caddy, Home Infra, Protocol,
  ForgeOS, Media2Text, Cortex, replay, or paid-provider mutation occurred while
  reconciling this pass.

## Planned Reviews

- Security review before implementing credential storage (recommend invoking `/security-review`).
- Contract review before freezing the first HTTP API and webhook payload.
- Deployment review before publishing the first Docker image.
