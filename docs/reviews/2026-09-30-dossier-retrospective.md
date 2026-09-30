# Plaud Mirror retrospective for Dossier

Compiled: 2026-09-30. This is a new retrospective, not a backdated capture.
All historical dates below come from retained source documents. The original
local L1 remains immutable. Product source, deployment, acceptance and proposed
work remain separate. No personal audio, transcript or raw session is included.

## Coverage

28 milestones, 28 decisions (27 accepted plus one proposal), 84 detailed historical change entries (grouped into 19 reader change summaries) and 34 source documents. Dossier provides the complete roadmap and technical synthesis; full original files remain in the repository.

## Roadmap and unresolved work

### P0: Phase 0: foundation

Status: done. Repository bootstrap, version policy, documentation and upstream-watch baseline.

Acceptance: Cited evidence: stable documentation baseline on main.

### P1: Phase 1: real Plaud spike

Status: done. CLI proved authentication, listing, detail and download; metadata and filter discovery preceded a UI.

Acceptance: Cited evidence: original real flow and documented API findings.

### P2: Phase 2: usable manual mirror

Status: done. Server API, web panel, encrypted persisted bearer, manual sync/backfill, recording index, immediate signed webhook, container and local dismiss/restore.

Acceptance: Cited evidence: manual end-to-end operator surface and local audio curation.

### P3: Phase 3: continuous operation and stability

Status: in_progress. Scheduler, anti-overlap, durable outbox, retries, health history, authentication, crash recovery and bounded client calls are implemented. The final joint stability window and live generic-webhook drill remain open.

Acceptance: Five uninterrupted days after the final relevant dual-service deployments, approved canary and first automatic run; generic-webhook drill separately evidenced.

### P4: Phase 4: assisted re-authentication and operator UI

Status: done. Browser-assisted capture, Chrome companion extension, Plaud Web fingerprint, mobile controls and the reference-driven six-screen panel shipped. Official non-browser OAuth remains deferred/watch.

Acceptance: Cited evidence: practical renewal strategy and operator health UI; this does not close Phase 3 stability.

### P5: Phase 5: infrastructure and recoverability

Status: in_progress. Home Infra Protocol status and accepted single-writer NAS placement exist. Independent backup/restore remains open. The old dual-host exit wording needs an explicit amendment because dev-vm is development-only.

Acceptance: Prove recoverable NAS custody and repeatable accepted deployment; reconcile obsolete dual-host wording without reactivating a production VM writer.

### P6: Phase 6: deliberate workflows and reusable single-operator product

Status: in_progress. Dismiss-then-confirmed permanent deletion, provider-neutral optional intake, terminal coverage and failure review exist. Bilateral setup, remaining recovery and OSS polish are still open.

Acceptance: Every eligible immutable audio revision reconciles to a conforming provider outcome; deliberate operator actions and a public quickstart that needs no private context.

### W1: Connection wave 1: Operational baseline and durable decisions

Status: done. Accepted mirror/intake baseline, retained failure evidence and durable bilateral-design decisions exist; original version targets are historical.

Acceptance: Cited baseline evidence; this is not later setup-program acceptance.

### W2: Connection wave 2: DocKit alignment

Status: in_progress. Current applicable DocKit 4.18 features are being adopted in Plaud. Media2Text and ForgeOS retain their own source/review authority.

Acceptance: Local checks preserved and exact review recorded; cross-project alignment is not inferred.

### W3: Connection wave 3: Bundle and lifecycle contract

Status: pending. Freeze request/grant schemas, canonicalization, expiry/re-import, partial pairing, rotation, disconnection, in-flight disposition and negative cases.

Acceptance: Owner-reviewed frozen schemas and threat model before runtime implementation.

### W4: Connection wave 4: Media2Text control plane

Status: pending. Encrypted runtime producer profiles, one-time configuration seed, authenticated administration, audit, rotation/revocation, request import and grant export.

Acceptance: Receiver owner validation and deployment; historical release numbers are not a sequence mandate.

### W5: Connection wave 5: Plaud control plane

Status: pending. Request export, grant import, four independent state dimensions, persisted dispatch kind, cost/scope and guided pause/rotate/disconnect/archive.

Acceptance: Producer owner validation; retain neutral transport and explicit in-flight disposition.

### W6: Connection wave 6: Joint operator verification

Status: pending. Pair from empty state, capability test, one approved canary, push/pull agreement, lease release, rotation and non-destructive disconnection checks.

Acceptance: Fresh budget and exact bounded canary approval; both owners verify their halves.

### W7: Connection wave 7: Joint freeze and Phase 3 closure

Status: pending. Five-day joint freeze begins only after final relevant deployments, successful canary and first automatic run. Relevant runtime changes reset the clock; documentation does not.

Acceptance: Both outboxes, coverage, pull recovery, Portal freshness and independent webhook drill pass.

### W8: Connection wave 8: Learn before extracting

Status: pending. Keep online pairing, per-lease tokens and shared pairing protocol deferred until a second real pair proves common vocabulary.

Acceptance: Evidence from a second pair and separate owner-approved extraction; no speculative rewrite.

### RECOVERY: Independent audio and metadata recovery

Status: pending. NAS is the only verified complete audio copy. Same-NAS VM or restore copies do not survive independent hardware loss.

Acceptance: Independent custody plus coherent metadata and bounded restore evidence.

### FAILURES: Reconcile historical intake failures

Status: pending. September 29 observation: 72 producer failures, comprising 3 admission and 69 processing failures; 70 require review. Counts are dated.

Acceptance: Attempt/revision/idempotency mapping before replay; no terminal-state regression and no receiver-complete/producer-failed steady state.

### REPLAY: Historical backlog

Status: blocked. September 29 observation: 622 unsent items, about 608 hours. Historical processing is separate from new daily use.

Acceptance: Fresh receiver-owned cost/scope quote and explicit bounded batch approval before paid work.

### KDF: Salted password-based key derivation

Status: pending. Single-pass SHA-256 key derivation remains in source. H2 proposes scrypt with salt.

Acceptance: Versioned storage migration, recovery and compatibility evidence before runtime adoption.

### RESUME: Resumable backfill

Status: pending. Deferred with no firm target; current manual backfill and cancellation must remain honest.

Acceptance: Explicit bounded design and persistence/retry tests.

### OAUTH: Official Plaud OAuth and MCP watch

Status: pending. Official non-browser access is watched, not disproven. Assisted browser capture remains the delivered path.

Acceptance: A reliable supported operator path and scoped review before replacement.

### OSS: Public quickstart and contributor polish

Status: pending. Finish neutral provider examples, sanitized configuration, contributor instructions and open-source fit.

Acceptance: A new operator can follow documentation without private homelab context.

### SEMANTIC_DOCS: Semantic documentation drift checks

Status: pending. D-016 delivered deterministic drift checks; semantic agent enforcement remains explicitly deferred.

Acceptance: Upstream-owned framework and project validation; preserve local checks.

### DOSSIER: Shared Dossier and project-card entry

Status: in_progress. Preserve native local L1; publish history and current synthesis through the generic ForgeOS coordinator and explicit Home Infra admission.

Acceptance: Visible card link; five sections and four roadmap views; exact history and negative-access checks; coherent same-NAS restore.

### M0: Proposed: use existing transcripts

Status: pending. Read and search existing eligible Markdown on one actual workstation. The September 29 audit found 75 source-verified candidates out of 76 retained records; preserve the excluded historical mismatch.

Acceptance: Choose private destination; count/hash manifest, idempotent export, exclusions and separate human notes; no new transcription.

### M1: Proposed: one new recording end to end

Status: pending. Use the existing Plaud-to-Media2Text path for one selected recording and its reading destination after budget eligibility.

Acceptance: Fresh receiver headroom and approval first; scoped recovery before deployment, automatic arrival, pause and honest blocked state.

### M2: Proposed: reliable daily use

Status: pending. Incremental export, useful failures, bounded repair, last-success/backlog and restart-safe behavior.

Acceptance: No duplicate items or overwritten human edits; natural cycles, with final joint soak retained separately.

### M3: Proposed: Cortex retrieval

Status: pending. Pull canonical transcript records into an owner-reviewed attributed retrieval pilot; lexical broker/MCP before optional measured semantic indexing.

Acceptance: Explicit Cortex plan amendment; unchanged existing acceptance fixtures; no false event acknowledgement or fake V1a closure.

## Decisions and amendments

### D-001: Plaud Mirror is audio-first

Status: accepted.

**Status:** accepted

### Decision
Plaud Mirror's core responsibility is downloading and storing the audio artifact, not providing transcription.

### Rationale
The user's downstream pipeline already owns speech-to-text. Expanding Plaud Mirror into transcript or summary generation would dilute the core problem: reliable mirroring and session durability.

### Implications

- Audio sync is the critical path for v1.
- Transcript and summary support are optional future extensions, not required for the first release.

---

### D-002: Server-first architecture with web UI

Status: accepted.

**Status:** accepted

### Decision
Plaud Mirror is a server-side service with a local operational web UI, not a browser extension and not a one-shot CLI.

### Rationale
The primary use case is an always-on home server or similar self-hosted environment. The operator needs persistence, scheduling, visibility, and configuration more than interactive bulk export.

### Implications

- `apps/api/` and `apps/web/` are first-class planned modules.
- Docker deployment and on-disk durability matter from the start.

---

### D-003: Phased auth strategy: manual token first, automatic re-login later

Status: accepted.

**Status:** accepted (amended 2026-04-22)

### Decision
Plaud Mirror's auth strategy is phased, not simultaneous:

1. **First usable release:** manual bearer-token mode only. Operator pastes a Plaud token in the UI; the service encrypts and persists it, monitors validity, and surfaces a clear degraded state when the token expires.
2. **Later (Phase 4):** introduce automatic re-login via a `SessionProvider` abstraction with `manual-token` and `credentials-relogin` as the intended modes. Implement the least brittle renewal path first; ship the feature only when it is genuinely reliable.
3. **Explicitly disfavored:** browser-assisted renewal (Puppeteer/Playwright). It is not part of the planned path and would require fresh user approval to revisit.

### Rationale
Automatic re-login is the single most fragile component of a third-party Plaud client: auth endpoints and token formats can change without notice, and debugging a broken renewal flow blocks every other feature. Shipping a useful mirror with manual-token-only auth is strictly better than not shipping because the renewal story isn't solid yet. The original version of this decision treated dual-mode as a v1 requirement; experience from the brainstorm and upstream review showed that framing was too ambitious and would stall the first release.

Browser automation is disfavored because it (a) adds a Chromium/Playwright dependency to a service that holds Plaud credentials, (b) enlarges the attack surface, and (c) is painful to operate on NAS-class hardware with QNAP Docker quirks. Keeping it off the planned path prevents it from quietly becoming the default.

### Implications

- Phase 2 (first usable release) only needs to persist and validate a bearer token. No credential storage, no renewal loop.
- Secrets storage layout must still anticipate future credential fields so Phase 4 does not require a destructive migration.
- UI must surface the current auth mode, token expiry (when known), and a clear operator action when the token becomes invalid.
- On `401` in Phase 2, the service transitions to a "degraded auth" state and requires operator intervention; it does not attempt automatic recovery.
- In Phase 4, if `credentials-relogin` proves too brittle to ship reliably, the correct response is to stop and redesign, not to fall back to browser automation.

---

### D-004: Upstream-watch is mandatory

Status: accepted.

**Status:** accepted

### Decision
Changes in relevant upstream repos must be tracked explicitly through `config/upstreams.tsv`, `docs/UPSTREAMS.md`, and `scripts/check-upstreams.sh`.

### Rationale
Plaud integrations depend on unofficial and evolving behavior. Auth keys, region logic, and export endpoints can drift. Silent drift is a product risk.

### Implications

- Primary upstreams are treated as ongoing inputs, not one-time research.
- Baseline changes are governance changes and must be documented.

---

### D-005: License boundary is conservative

Status: accepted.

**Status:** accepted

### Decision
MIT is the intended Plaud Mirror license. MIT upstreams may be reused with attribution. AGPL and no-license upstreams remain reference-only unless a future documented decision changes this.

### Rationale
The project is meant to be publishable as permissive OSS without accidental license contamination or ambiguity.

### Implications

- `openplaud/openplaud` is an idea source, not a copy source.
- Reuse from no-license repos is blocked until license clarity exists.

---

### D-006: Canonical local layout uses Plaud recording ID

Status: accepted.

**Status:** accepted

### Decision
Local mirrored artifacts should be keyed by the Plaud recording ID, not only by title or date.

### Rationale
Titles can change and are not guaranteed unique. The remote ID is the most stable dedupe key.

### Implications

- Default path shape is `recordings/<recording-id>/...`
- Human-readable metadata belongs in filenames only as optional secondary detail

---

### D-007: Reuse strategy is composite, not a single-upstream fork

Status: accepted.

**Status:** accepted

### Decision
Plaud Mirror will combine ideas from multiple upstreams instead of treating one existing project as the canonical base.

### Rationale
No single upstream matches the target product cleanly. `Applaud` is strongest on server shape and operator UX. `iiAtlas` is strongest on fast-moving auth and region heuristics. The Studer projects are strongest as direct endpoint/export references. A composite strategy gives better fit and lowers lock-in.

### Implications

- `Applaud` and `iiAtlas` remain the two highest-priority upstreams to watch.
- Plaud Mirror can evolve its own identity without inheriting another project's full product surface or constraints.

---

### D-008: Core auth and download logic must stay auditable in-repo

Status: accepted.

**Status:** accepted

### Decision
Plaud Mirror should not hide its critical Plaud auth and audio download flow behind an opaque third-party runtime dependency.

### Rationale
Source review of third-party tools is useful but not equivalent to a full trust guarantee. Upstream inspection also surfaced at least one concrete credential-handling flaw in the ecosystem: `JamesStuder/Plaud_BulkDownloader` echoes the password to the console. That finding reinforces the value of keeping the critical path readable and reviewable inside Plaud Mirror itself.

### Implications

- Upstream code can be referenced, adapted, or vendored with review, but the auth/download path should remain understandable from this repository alone.
- Token-first auth remains the preferred operator mode where practical because it reduces password exposure.

---

### D-009: Operator-only TOS posture

Status: accepted.

**Status:** accepted

### Decision
Plaud Mirror is published as open source for **personal/operator use against the operator's own Plaud account only**. It is not a hosted service, not a multi-tenant gateway, and does not redistribute Plaud-sourced audio to third parties. This posture is stated in the README and in operator-facing docs before the first usable release.

### Rationale
A third-party client that automates authenticated access to Plaud and stores the resulting audio locally occupies grey space relative to Plaud's terms of service. The project does not have legal clearance, and pursuing it is not in scope. What is in scope is being explicit about the intended use so the repository does not drift into presenting itself as a general-purpose hosted-mirror product — which would materially increase TOS exposure for both the maintainer and downstream users.

This decision is a **posture statement**, not a legal opinion. It does not claim the project is TOS-compliant; it narrows the claimed use so the reader understands what the project is and is not.

### Implications

- README and `LLM_START_HERE.md` must state the operator-only posture before the first usable release (Phase 2 exit gate).
- Docs and UI copy must not describe Plaud Mirror as a "service for others" or a "hosted mirror."
- Multi-tenant features (per-user tokens, account separation beyond a single operator) are out of scope without a new decision revisiting this posture.
- Redistribution of Plaud-sourced audio by Plaud Mirror itself (e.g. a public gallery, a re-publishing webhook target) is out of scope.
- If Plaud publishes terms or a program that changes this picture, this decision should be revisited explicitly rather than drifted through.
- A multi-tenant variant of the same product (hosted, multiple users) is incompatible with this posture **as currently stated**. If the operator wants that, three paths and their tradeoffs are documented in `docs/ROADMAP.md` ("Beyond Phase 6: Multi-tenant variant"). Path 1 (instance-per-tenant deployment, no code change) keeps D-009 intact. Path 2 (refactor plaud-mirror to be tenant-aware in-place) requires an explicit D-009 amend with new rationale. Path 3 (new sibling project) is the recommended path because it preserves D-009 cleanly and lets the multi-tenant variant carry its own TOS posture.

---

### D-010: Roadmap phases are normative

Status: accepted.

**Status:** accepted

### Decision
The roadmap phases in `docs/ROADMAP.md` are the source of truth for what belongs in each delivery slice. In particular:

- **Phase 2** means the first usable **manual** vertical slice: UI, Docker, encrypted token persistence, manual sync/backfill, local mirroring, and immediate signed webhook delivery.
- **Phase 3** means unattended operation and resilience: scheduler, retry/outbox, resumable backfill, and stronger health behavior.

### Rationale
The project already hit a failure mode where the implementation drifted toward a CLI-heavy spike while the product discussion still assumed the first usable release included a web UI. The fix is not only "remember better"; the phase boundary itself needs to be explicit and treated as binding.

### Implications

- New work must be checked against `docs/ROADMAP.md` before claiming it belongs to the current phase.
- If scope moves across a phase boundary, update the roadmap and handoff before calling the work aligned.
- Phase 2 should not quietly absorb scheduler/outbox work unless the roadmap is deliberately re-cut.

### D-011: API facts discovered in AGPL upstreams may be adopted; AGPL code may not

Status: accepted.

**Status:** accepted

### Decision
When a Plaud API endpoint is documented only in an AGPL-3.0 upstream (currently `openplaud/openplaud`), Plaud Mirror may adopt:

- the endpoint URL, HTTP method, and auth shape,
- the wire field names and types (e.g. `sn`, `name`, `model`, `version_number` on `/device/list`),
- factual response semantics (e.g. "status 0 means success").

Plaud Mirror must NOT adopt:

- copied code (TypeScript types, Zod schemas, client classes, DB schemas, React components) from the AGPL upstream verbatim or with superficial edits,
- project conventions, identifier names, or file structure that only make sense inside that upstream.

The MIT client, store, API, and UI for any such feature must be implemented from scratch in this codebase, traceable to an independent description of the endpoint (usually the research note from the session that discovered it).

### Rationale
An API endpoint URL and its JSON field names describe an external service's behavior — they are facts about Plaud's server, not copyrightable expression. Multiple clients can and do target the same API surface with independently-written code, which is the ordinary case for reverse-engineered private APIs. The AGPL copyleft obligation attaches to the upstream's **code**, not to the shape of the API they happen to have documented first.

The `/device/list` endpoint in `v0.4.11` is the first real exercise of this distinction: openplaud is the only upstream that calls it, and its TypeScript definitions match exactly what Plaud returns — but reusing their `PlaudClient.listDevices()` verbatim would be an AGPL code copy and is forbidden by D-005. Reimplementing against the same facts is fine and is what landed.

### Implications

- Every AGPL-sourced endpoint adoption must leave a trail in `docs/UPSTREAMS.md` (Phase 2 adoption bullet) pointing back to this decision.
- Reviews must check that the implementation is genuinely independent (different Zod schema names, different client method signatures, different storage layout) rather than an import-and-rename of the upstream.
- If an upstream under a restrictive license is the **only** source of *both* the endpoint facts and the meaningful product behavior (e.g. a whole auth dance), stop and ask before proceeding — that may be a case where the "facts, not expression" line is too thin to rely on.

### D-012: Continuous sync scheduler runs in-process with anti-overlap protection

Status: accepted.

**Status:** accepted; **implemented across v0.5.0 → v0.5.2 and shutdown-hardened in v0.13.1** (`apps/api/src/runtime/scheduler.ts`, `apps/api/src/runtime/scheduler-manager.ts`, hot-reconfigure via `service.setSchedulerReconfigureHook`). v0.5.0 introduced the timer + tick path (regressed: default-on without opt-in, missing service-level anti-overlap); v0.5.1 fixed the regressions; v0.5.2 made the interval panel-driven via `RuntimeConfig.schedulerIntervalMs` persisted in SQLite. v0.13.1 makes stop terminal for already-queued callbacks and unrefs runtime timers.

### Decision

Phase 3's continuous-sync mechanism is implemented as an **in-process scheduler** inside the existing Fastify runtime. It does not introduce a separate worker process, an external job queue (BullMQ, Redis), or a cron daemon.

The scheduler:

- Reads its interval from a single configuration value (`PLAUD_MIRROR_SCHEDULER_INTERVAL_MS`, default `15 * 60 * 1000` = 15 minutes). Configurable via env var, optional override via `RuntimeConfig` if the operator wants runtime mutation.
- Runs `service.runSync()` (the same async pipeline manual sync uses) on every tick.
- **Holds an in-process lock** that prevents a tick from firing while a previous tick's `runSync` is still in flight. `service.getActiveSyncRun()` is the source of truth: if a run is `status="running"`, the next tick is skipped (logged, not stacked).
- Persists nothing of its own — its state lives entirely in the existing `sync_runs` table. A restart starts fresh; the next tick fires after `intervalMs` from process boot, not from when the previous tick was supposed to fire.
- Exposes its state via `/api/health` (next-tick estimate, last-tick result, scheduler enabled/disabled flag).
- Can be disabled with `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS=0` (or a similar opt-out), in which case Phase 2's manual-only behavior is preserved.

### Rationale

The product is single-operator, single-process, single-host. An external job queue is over-engineered for this scale and adds operational dependencies (Redis, separate worker container) that conflict with the "single Docker container serves both API and panel" packaging at v0.4.18.

In-process scheduling with anti-overlap via the existing `getActiveSyncRun()` is the smallest change that satisfies Phase 3's exit gate ("multi-day unattended run on dev-vm with predictable recovery behavior"). If the project later needs cross-host scheduling or distributed locks, that's a Phase 5/6 concern when NAS rollout actually demands it.

The interval-from-boot semantics (rather than absolute-cadence wall-clock) is deliberate: a restart resetting the clock is acceptable for a service whose primary value is "eventually consistent with Plaud's account." Cron-like wall-clock cadence would require persisting the next-fire timestamp and recovery logic on boot — extra complexity for a guarantee the product doesn't need.

### Implications

- `RuntimeServiceDependencies` gains an optional `scheduler` injection point already (used by tests). Phase 3's scheduler implementation is a new module that consumes the service via dependency injection — it does not bake the timer into `service.runMirror`.
- The scheduler must be cancellable cleanly on process shutdown so SIGTERM does not leave a half-finished run. `stop()` marks the instance stopped before clearing its timer; a callback already queued by the event loop cannot rearm or execute work. A later explicit `start()` may activate the instance again.
- Anti-overlap protection means an unusually long sync (e.g. backfilling 1000 missing recordings) blocks subsequent ticks until it finishes. That is the correct behavior — overlapping runs would corrupt the `sync_runs` row that polling relies on.
- Test surface: a deterministic scheduler injection (similar to the one already in `service.test.ts`) lets tests fast-forward through ticks without real timers. HTTP app fixtures register `t.after(app.close)` immediately so failed assertions cannot strand background workers.

### D-013: Webhook outbox is a separate SQLite table with explicit state transitions

Status: accepted.

**Status:** accepted; **implemented in v0.5.3** (`apps/api/src/runtime/outbox-worker.ts`, `apps/api/src/runtime/store.ts` `webhook_outbox` methods, `GET /api/outbox` + `POST /api/outbox/:id/retry` in `apps/api/src/server.ts`).

### Decision

The Phase 3 webhook outbox is a **new SQLite table** (`webhook_outbox`), not an extension of the existing `webhook_deliveries` table or of `sync_runs`. The new table tracks pending/in-flight delivery state; `webhook_deliveries` continues to log every attempt as an append-only audit trail.

Schema (additive migration, no destructive changes; final shipped form in `apps/api/src/runtime/store.ts`):

```sql
CREATE TABLE IF NOT EXISTS webhook_outbox (
  id              TEXT PRIMARY KEY,         -- UUID via crypto.randomUUID()
  recording_id    TEXT NOT NULL,            -- FK (logical) to recordings.id (per D-006)
  payload_json    TEXT NOT NULL,            -- payload captured at enqueue time; signature is NOT cached, see Implications
  state           TEXT NOT NULL CHECK (state IN ('pending','delivering','delivered','retry_waiting','permanently_failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,                     -- ISO timestamp; null for delivered / permanently_failed / freshly-pending
  last_error      TEXT,                     -- last HTTP status / error message
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webhook_outbox_state_next ON webhook_outbox (state, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_webhook_outbox_recording  ON webhook_outbox (recording_id);
```

(The original D-013 draft named the column `attempt_count`; the shipped column is `attempts`. Column name is internal; no contract impact.)

State machine (shipped):

```
       enqueue
         ↓
      pending ──(claim)──→ delivering ──(2xx)──→ delivered  [terminal]
         ▲                     │
         │                     ├──(failure, attempts < OUTBOX_MAX_ATTEMPTS)──→ retry_waiting ──(next_attempt_at reached, claim)──→ delivering
         │                     │
   force-retry from UI         └──(failure, attempts >= OUTBOX_MAX_ATTEMPTS)──→ permanently_failed  [terminal until force-retry]
         │
   permanently_failed
```

Retry policy (shipped, **revised from the original draft**):

```ts
// apps/api/src/runtime/outbox-worker.ts
export const OUTBOX_BACKOFF_SCHEDULE_MS = [
  30_000,            // after attempt 1
  2 * 60_000,        // after attempt 2
  10 * 60_000,       // after attempt 3
  30 * 60_000,       // after attempt 4
  60 * 60_000,       // after attempt 5
  2 * 60 * 60_000,   // after attempt 6
  4 * 60 * 60_000,   // after attempt 7
  8 * 60 * 60_000,   // after attempt 8
];
export const OUTBOX_MAX_ATTEMPTS = OUTBOX_BACKOFF_SCHEDULE_MS.length + 1; // 9
```

Cumulative wait before the ninth/final attempt: ~15 hours 42 minutes.

### Revisions from original draft

The original draft (pre-implementation) specified a 5-attempt schedule (`30s, 2m, 10m, 1h, 6h`) and the endpoint `POST /api/webhook-outbox/:id/retry`. During v0.5.3 implementation, both were updated based on review feedback:

- **Backoff schedule extended from 5 to 8 attempts (~7h cumulative → ~16h cumulative).** Reason: home-infra deployments typically experience overnight downstream outages (8–10 hours offline). A 7h window gave up too early — the operator would wake up to a queue full of `permanently_failed` rows that needed manual retry. 16h covers a full overnight window; the curve `30s, 2m, 10m, 30m, 1h, 2h, 4h, 8h` keeps early retries snappy for transient blips and lengthens later retries so a long outage doesn't hammer the downstream when it eventually comes back. Reviewer (GPT-5) explicitly recommended this; adopted without further changes.
- **Endpoint renamed from `/api/webhook-outbox/:id/retry` to `/api/outbox/:id/retry`.** Reason: the new GET-list route had to live somewhere too, and `/api/outbox` reads better as a resource root than `/api/webhook-outbox` (the table name leaks into the URL otherwise). No functional difference.
- **`GET /api/outbox` returns ONLY `permanently_failed` rows.** Pending, delivering, and retry-waiting items are visible as counters via `health.outbox` (`pending`, `delivering`, `retryWaiting`, `permanentlyFailed`, `oldestPendingAgeMs`). Decision driver: keep the panel focused on what needs operator attention, not turn it into a queue browser.

**v0.10.4 amendment — retry ceiling and hot claim recovery.** The original
implementation escalated when `newAttemptCount >= 8`, which made the eighth
8-hour backoff entry unreachable. The corrected policy is eight retry windows
and a ninth final delivery attempt. Secret loading and payload parsing are now
inside the worker failure boundary, so a post-claim setup error returns the row
to `retry_waiting` instead of leaving it in `delivering`; health exposes a
`delivering` counter for direct observability.

The original draft also implied that backoff could include "jitter" — the shipped implementation does NOT add jitter. Single-process, single-tenant home-infra deployment; no thundering-herd risk to mitigate.

**v0.6.0 amendment — startup crash recovery (at-least-once accepted).** The original FSM had a hole: a process that dies between `claimOutboxItem` (state → `delivering`) and the corresponding `markOutbox*` call leaves the row in `delivering` forever, because the claim query only selects `pending`/`retry_waiting` and no sweep existed. The symmetric hole existed on the sync side: a crash mid-run leaves `sync_runs.status = 'running'`, which `getActiveSyncRun()` keeps returning, so the anti-overlap guard blocks every future sync until manual SQLite surgery. From v0.6.0, `service.initialize()` runs two recovery sweeps at boot: `store.recoverOrphanedSyncRuns()` (running → failed, `error_message = 'recovered after process restart: ...'`) and `store.recoverOrphanedOutboxItems()` (delivering → `retry_waiting` with `next_attempt_at = now` and `attempts` UNCHANGED — the delivery outcome is unknown, so the row keeps its full backoff budget). This explicitly accepts **at-least-once** webhook delivery: if the POST landed right before the crash, the downstream sees a duplicate `recording.synced`. A recoverable duplicate beats a silently lost webhook; downstream consumers must treat `recording.id` as the idempotency key (they already should, per the payload contract). Both sweeps surface in `health.lastErrors` (subsystems `sync` / `outbox`) so the operator can see that a recovery happened.

### Rationale

Separate table because:

1. **`webhook_deliveries` is an append-only log** — every attempt creates a row. The outbox is mutable state with explicit transitions. Conflating them would force a schema change to a table whose current shape works.
2. **Different access patterns** — outbox rows are queried by `(state, next_attempt_at)` (worker scan); delivery rows are queried by `recording_id` for audit. Different indices, different read patterns.
3. **Different lifecycle** — delivered outbox rows can be archived or pruned after N days; delivery log rows must persist for audit (or until configured retention).

Explicit named states (rather than booleans like `delivered=true/false`) because the state machine has FIVE distinct positions, and naming them prevents the "what does `failed` mean exactly" drift that bit Mode B sync at v0.4.9.

Exponential backoff over linear because the failure modes we expect (downstream receiver down, network blip, signature mismatch) all benefit from rapid early retries followed by long pauses — linear would either hammer a down receiver or wait too long on a transient error.

### Implications

- `service.processRecording` no longer attempts immediate delivery. It calls `enqueueOrSkipWebhook(recording, mode)` which inserts into `webhook_outbox` with `state = pending` and stamps `lastWebhookStatus = "queued"` on the recording row. The legacy synchronous `deliverWebhook` method is **removed** (not preserved as a fallback).
- A new private `OutboxWorker` (`apps/api/src/runtime/outbox-worker.ts`) drives delivery. It runs an independent `Scheduler` (5-second cadence, reusing the D-012 `Scheduler` class for the timer abstraction) and is started unconditionally from `createApp` — no opt-in. When no webhook is configured, items short-circuit to `permanently_failed` inside the worker tick with `last_error = "webhook not configured"`.
- **HMAC signature is recomputed at delivery time, not cached at enqueue time.** This means the `webhookSecret` at the moment the worker POSTs is the secret used — rotating the secret from the panel takes effect on the next worker tick for items still in the queue. Trade-off accepted: a bad-secret window exists between rotation and the next claim, during which deliveries fail with HTTP 401/403; those failures retry through the normal backoff and eventually succeed once the new secret is fully propagated.
- **Payload IS captured at enqueue time, not recomputed**. The `payload_json` row carries the recording's state at T+0 (the moment of download). If the operator dismisses the recording between enqueue and delivery, the worker still delivers the original payload — the downstream's idempotency contract assumes that `recording.synced` describes "what happened," not "what is true now."
- `SyncRunSummary.delivered` keeps its pre-v0.5.3 semantic (synchronous deliveries inside this run). Because synchronous delivery no longer exists, it structurally stays at 0 from v0.5.3 onwards. A new `SyncRunSummary.enqueued` counter tracks "payloads pushed to the outbox during this run." Dashboards reading `delivered` should switch to `enqueued` plus `health.outbox.pending + retryWaiting` for the v0.5.3+ equivalent.
- `RecordingMirror.lastWebhookStatus` enum is extended with `"queued"` (the new normal state right after a sync). Legacy values `"success"` / `"failed"` still appear on rows that pre-date v0.5.3.
- `/api/health` exposes the outbox backlog (`pending` / `delivering` / `retryWaiting` / `permanentlyFailed` / `oldestPendingAgeMs`) per D-014's first slice and the v0.10.4 observability amendment.
- `POST /api/outbox/:id/retry` allows the operator to recover a `permanently_failed` row from the panel: resets `attempts = 0`, clears `last_error`, transitions back to `pending`. Returns 409 for any other state, 404 for unknown id, 400 for unsafe id shape.
- Atomic claim: the transition `pending|retry_waiting → delivering` is a guarded `UPDATE ... WHERE id = ? AND state = ?` that fails when a concurrent claim has already moved the row. Worker-tick + panel-triggered retry cannot pick the same row twice.
- Backfill at scale creates many outbox rows in one batch. The worker processes them serially (one per 5-second tick) — simplest correctness, no parallel delivery. A 100-recording backfill against a healthy downstream drains in ~8.5 minutes; against a flaky downstream, the queue persists and recovers without operator intervention.

### D-014: Health endpoint surfaces operational state, not just configuration state

Status: accepted.

**Status:** accepted; **fully implemented in v0.5.5**, amended in v0.10.4 with the `outbox.delivering` counter. `/api/health.scheduler` shipped in v0.5.0, `/api/health.outbox` in v0.5.3, and `lastErrors` plus `recentSyncRuns` in v0.5.5.

### Decision

`GET /api/health` at Phase 3 returns operational state suitable for an operator to answer "is this thing running correctly right now?" without checking SQLite or container logs. Specifically the response gains:

- `scheduler`: `{ enabled: boolean, intervalMs: number, nextTickAt: string | null, lastTickAt: string | null, lastTickStatus: "completed" | "failed" | null }`
- `outbox`: `{ pendingCount: number, oldestPendingAgeMs: number | null, permanentlyFailedCount: number }`
- `lastErrors`: array of up to 5 most recent operational errors (sync failure, webhook failure, token validation failure) with timestamp + short message — circular buffer in memory, NOT persisted.

The existing `auth`, `lastSync`, `activeRun`, `recordingsCount`, `dismissedCount`, `webhookConfigured`, `warnings` fields stay unchanged. Backward-compatible additive change.

The web panel surfaces the new fields in a compact "Operational status" card on the Main tab (above Manual sync) — only the highlights, not the full payload. Detail goes in a dedicated `/api/health/detail` if it ever proves needed; v0.5.0 ships only `/api/health`.

### Rationale

Phase 2's `/api/health` answers "what is configured" (auth state, recordings count). Phase 3's exit gate is "multi-day unattended run with predictable recovery behavior" — the operator needs to know "is the scheduler ticking? are webhooks getting through? are there errors stacking up?" without SSH'ing into the host.

In-memory circular buffer for errors (not SQLite) because:

1. Operational errors are high-volume and ephemeral — persisting them costs disk and adds a retention question.
2. The buffer's purpose is "what just went wrong?" not audit. Audit lives in `sync_runs.error` and `webhook_deliveries.error_message`.
3. Survives the lifetime of one process — exactly the scope where "did the scheduler fire correctly in the last hour?" matters.

### Implications

- `ServiceHealthSchema` in `packages/shared/src/runtime.ts` gains the three new sub-objects with `.default(null)` semantics so older clients reading the response don't break.
- The web panel's hero status block can render a compact summary line ("Scheduler: every 15m, next in 8m. Outbox: 0 pending.") that updates on the existing 2s health poll.
- The "lastErrors" buffer is a service-internal concern; the service exposes a method `recordError(category, message)` that the scheduler/outbox/sync code calls.
- Test surface: extending `service.getHealth` test to assert the new fields are present (with sensible defaults when scheduler is disabled).

### D-015: UI tests use Vitest + jsdom + @testing-library/react

Status: accepted.

**Status:** accepted (lands in v0.4.19 as Phase 3 prerequisite)

### Decision

Web-side component testing uses **Vitest** as the test runner, **jsdom** as the DOM environment, and **@testing-library/react** for component-level assertions. Tests live alongside source under `apps/web/src/**/*.test.{ts,tsx}` and are executed by `vitest run` invoked from `apps/web`. The root `npm test` script invokes both the existing `node --test` backend suite and a new `npm run test:web` workspace command.

### Rationale

Choices considered:

- **Vitest vs Jest:** Vitest because the web build is already Vite-based and Vitest reuses Vite's pipeline (no second TypeScript transformer config, no Jest-vs-Vite compatibility shims). Jest would be a parallel toolchain with a parallel config; the duplicated maintenance is not worth the marginal compatibility benefit.
- **jsdom vs happy-dom:** jsdom because it is the de facto reference DOM-in-Node implementation, has the broadest @testing-library compatibility, and is what 90% of community React-test examples target. happy-dom is faster and lighter (~20MB less in node_modules) but its edge-case behaviors diverge in places the library docs do not always cover; debugging "why does this test pass in browser but fail in happy-dom" is paid maintenance the project does not need to take on.
- **@testing-library/react vs Enzyme vs render-and-assert-by-hand:** @testing-library because it is the current React-team-recommended way and the assertion vocabulary (`getByRole`, `getByText`, `findByLabelText`) is what every newer guide uses. Enzyme is unmaintained for React 19. Hand-rolled rendering works but every project that takes that path eventually rebuilds @testing-library badly.

### Implications

- New devDependencies in `apps/web/package.json`: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`. Adds ~80MB to `apps/web/node_modules`.
- New config: `apps/web/vitest.config.ts` (or block in `vite.config.ts`) with `environment: "jsdom"` and a setup file that imports `@testing-library/jest-dom/vitest` for the `toBeInTheDocument`-style matchers.
- New script: `apps/web/package.json#scripts.test` runs `vitest run` (non-watch). The root `npm test` chains to it.
- This decision is **scope-limited to plaud-mirror's web panel**. If a future sibling project (e.g. the multi-tenant variant per the ROADMAP "Beyond Phase 6" section) adopts a different stack (Next.js, Vite-React with different conventions), it can revisit this decision with its own D-NNN.
- Component testability becomes a visible concern: a component that cannot be rendered in jsdom without massive mocking (e.g. `App` in its current shape with mount-time fetches) signals the component should be decomposed. The tests in v0.4.19 deliberately target small extractable pieces (`StateBadge`, storage helpers) before tackling the larger ones; the bigger components are a future patch.

### D-016: Doc-drift enforcement is layered: regex now (paliativo), semantic agent later (full closure)

Status: accepted.

**Status:** accepted; **partially implemented**. `scripts/check-prose-drift.sh` plus `check_prose_drift` wrapper landed in v0.5.4 (WARN-level during the calibration window) and the wrapper was hardened to FAIL in v0.5.5 after empirical confirmation that operator workflow rephrases or baselines false positives without operational pain. The semantic-check half of the layer is explicit deferred work, not hidden debt — it lands when LLM-DocKit's `LLM_DOCKIT_CE_V2_PROPOSAL.md` (currently draft, untracked in `~/src/LLM-DocKit/docs/`) provides the agent-based `Stop` hook framework described in `HOOKS_ENFORCEMENT_PROPOSAL.md` Optional Enhancement B (currently draft, untracked).

### Decision

Documentation drift in this project is enforced by a **two-layer cascade**, not by LLM discipline alone:

1. **Layer 1 (regex, in v0.5.4):** `scripts/check-prose-drift.sh` runs four rules against the documentation tree:
   - `R1-stale-version` — `vX.Y.Z` literals in primary docs that don't match `VERSION` and aren't baselined as historical.
   - `R2-phase-string-mismatch` — `"Phase N - <text>"` literals in docs that don't match the canonical strings emitted by `apps/api/src/runtime/service.ts`.
   - `R3-future-claim-already-shipped` — phrases like "still later", "lands during", "deferred to vX.Y.Z" in `docs/operations/` and `docs/llm/DECISIONS.md` that cite a version `<= VERSION` (i.e. a "this is future" claim about something already shipped).
   - `R4-decision-status-stale` — `D-XXX` entries with `Status: ... designed / lands during ...` in `DECISIONS.md` while `CHANGELOG.md` references that decision as shipped.
   The script ships three modes: `--strict` (default; exit 1 on drift, used by the validator wrapper), `--review` (JSON output of every finding including baselined entries — designed as input for the future agent-based check), and `--update-baseline --note "<reason>"` (deliberate human operation that records a finding as accepted with `id`, `literal`, `file`, `rule`, `reason`, `commit_sha`, `created_at`, optional `transient_until`). The baseline file `scripts/.prose-drift-baseline.json` is auditable: every entry carries the reason it was accepted and optionally a version after which it must disappear. When current `VERSION >= transient_until`, the entry is reported as expired with a remediation message naming the explicit recovery actions.

2. **Layer 2 (semantic, deferred):** a future agent-based `Stop` hook (or equivalent) reads code + docs and detects contradictions that no regex can. This is **Optional Enhancement B** of `HOOKS_ENFORCEMENT_PROPOSAL.md`. The on-ramp from Layer 1 to Layer 2 is the `--review` JSON output: it produces structured findings that an agent can consume directly, plus an exhaustive view of what the regex layer cannot see (false negatives). When the LLM-DocKit team firms up the agent hook framework, plaud-mirror adopts it with no rework on Layer 1 — they coexist (regex is fast and pre-commit; agent is thorough and at session-end).

The `prose-drift` check is wired into `scripts/dockit-validate-session.sh` as the eighth check, following the Layer-1/Layer-2 architecture proposed in the upstream RFC. It runs on every validator invocation; severity is `WARN` during the v0.5.4 calibration window, hardened to `FAIL` from v0.5.5 onwards once the baseline shape settles.

### Rationale

The project hit the same prose-drift class six times across `v0.4.x → v0.5.3` despite an `auto-memory` entry (`feedback_prose_version_drift`) that explicitly described the failure mode and listed the documents to sweep. The rule was extended four times. The pattern recurred each release. Diagnosis: **memory is advisory; the failure mode demanded enforcement.** This matches the principle stated in `HOOKS_ENFORCEMENT_PROPOSAL.md`: "compliance depends on LLM discipline, not on system enforcement."

Why regex first:

- Cheap to write (~250 lines of POSIX sh), zero new dependencies.
- Fast (no LLM round-trip; runs in pre-commit and at every validator invocation).
- Deterministic, machine-auditable, debuggable by the human reviewer.
- Catches the structural / literal subset of drift, which is empirically the majority of what hit this project.

Why regex is not enough:

- Each of the six recurrent drifts had a slightly different shape. Codifying past drifts in regex catches them — and only them. The next drift will be a new shape (current example: a `Status:` field that says "lands during Phase 3" while CHANGELOG mentions the decision as shipped — caught by R4, but only because R4 was written for it). Regex is reactive; the next failure mode will not match yet.
- Semantic contradictions ("we're still designing the ETL phase" when the ETL is implemented; "the worker uses backoff X" when it actually uses backoff Y) require comparing prose to code, which regex cannot do without exploding into thousands of bespoke rules.

Why a separate script with a thin validator wrapper, not a function inside the validator:

- `dockit-validate-session.sh` is intentionally portable POSIX sh with zero external deps and a stable shape (the upstream LLM-DocKit template ships it). Adding a 250-line check function would double its size and entangle the project-specific drift rules with the universal validator core.
- A separate script is reusable upstream: `scripts/check-prose-drift.sh` is exactly the kind of artifact that `~/src/LLM-DocKit/docs/DOWNSTREAM_FEEDBACK.md` `DF-028` proposes to upstream into the DocKit template once it has proven itself across a release cycle here. Keeping it standalone makes that propagation a copy operation, not a refactor.
- The `--review` and `--update-baseline` modes need their own argument parsing and output formats; folding them into the validator's CLI would compromise both surfaces.

Why `WARN` first, `FAIL` later:

- The first activation against an existing codebase is guaranteed to surface findings the project considers acceptable (historical `vX.Y.Z` mentions in legitimate "since vA.B.C" sentences, etc.). Hard-fail from day 1 either blocks the legitimate work or pushes the operator to weaken the regex. Soft-fail with a baseline file lets the project tame the noise deliberately. The rampa to hard-fail is `v0.5.5` once the baseline shape settles.
- The pattern matches industry norm (ESLint, mypy, Ruff): introducing a new linter into a legacy codebase always uses a baseline + advisory-then-strict ramp.

### Implications

- The `auto-memory` entry `feedback_prose_version_drift` no longer claims to enforce anything — it stays as an explanatory pointer to D-016 and to the script. The enforcement vector is the script + validator wrapper; memory is the rationale.
- The global rule **"Before adding a passive rule (auto-memory)"** in `~/.claude/CLAUDE.md` (added in v0.5.4) plus the `~/.claude/hooks/check-passive-rule.sh` `PostToolUse` hook are the meta-enforcement that prevent this project (and any other project sharing the same `~/.claude/`) from accumulating more passive rules without the heuristic check. That layer is global on purpose: `~/.claude/projects/*/memory/` is global infrastructure, so a project-local rule cannot reach it.
- Future projects adopting LLM-DocKit pick up `prose-drift` for free if `scripts/check-prose-drift.sh` is upstreamed via `DF-028`. Until then, plaud-mirror is the canonical reference implementation.
- The `--review` JSON output is the explicit handoff format for any future semantic-check layer (Optional Enhancement B). The schema is documented inside the script itself; do not rename fields without updating the consumer when it lands.
- Adding a new rule (R5+) to the script: function `rule_<name>()`, register it in the run section, write tests if/when the script gets a test harness (currently smoke-tested by running it against the live tree). Rules should be **structural**, not semantic — anything semantic belongs in Layer 2.

### D-017: Unabsorbed-artifact detection is local in plaud-mirror, symmetric `forge audit` lives in ForgeOS

Status: accepted.

**Status:** accepted; **implemented in v0.5.5** (`scripts/check-unabsorbed-artifact.sh` + `scripts/.unabsorbed-artifact-baseline.json` + `check_unabsorbed_artifact` wrapper as the ninth `dockit-validate-session` check, WARN-level non-blocking).

### Decision

plaud-mirror grows a `check_unabsorbed_artifact` validator check that flags local artifacts in `scripts/` and `.claude/rules/` whose filename does not exist in the LLM-DocKit upstream template (`$HOME/src/LLM-DocKit/scripts/` and `~/.claude/rules/`). The check is WARN-level non-blocking. Project-specific artifacts (e.g. `scripts/check-upstreams.sh` watching plaud-specific upstreams) are baselined as `permanent: true` with a reason. In-flight absorption candidates (e.g. `scripts/check-prose-drift.sh` per `DF-028`) are baselined as `permanent: false` with a `df_id` link. Comparison is filename-only, not content match — content divergence is a different drift class and is intentionally out of scope for this check.

The symmetric companion (`forge audit` CLI that automates the cross-repo audit ForgeOS↔plaud-mirror↔LLM-DocKit) lives in `~/src/ForgeOS/` per the cross-session audit on 2026-04-27, and is explicitly **out of scope** for plaud-mirror. plaud-mirror builds the local termómetro; ForgeOS builds the motor.

### Revisions from original draft

The 2026-04-27 plan drafted by the ForgeOS-context Claude session proposed a single piece. During implementation the matiz **"day-one ignore-list"** was made mandatory: without baseline support the check would emit noise on every project-specific script, and operators would learn to ignore the WARN. The baseline file (`scripts/.unabsorbed-artifact-baseline.json`) is required from the first commit, mirroring the precedent of `scripts/.prose-drift-baseline.json` (D-016). Initial baseline ships with three entries: `scripts/check-upstreams.sh` (permanent), `.claude/rules/external-context-triggers.md` (permanent), `scripts/check-prose-drift.sh` (transient, `df_id: DF-028`).

Two POSIX-shell bugs were caught during implementation and worth noting for any future Layer-1 script:
1. `$'\t'` ANSI-C quoting is a bashism and silently fails under `#!/bin/sh`. Use `TAB=$(printf '\t')` and interpolate as `"${TAB}"`. The fix is the same one D-016 §"Empirical history" called out for `check-prose-drift.sh`.
2. `grep -c X file 2>/dev/null || echo 0` concatenates two zeros into a multi-line value when there are zero matches (grep prints "0" AND exits 1, so the fallback also runs). Use `grep X file 2>/dev/null | wc -l | tr -d ' '` instead.

JSON merge in `--update-baseline` mode is delegated to Python3 (already a documented dependency via `~/.claude/hooks/check-passive-rule.sh`). A sed-based templating attempt broke immediately on `/` literals in path strings — the same class of bug, this time in the rewriter rather than the scanner.

### Rationale

The ForgeOS-context session diagnosed (2026-04-27 cross-session audit) that the bucle de aprendizaje LLM-DocKit ↔ downstreams ↔ ForgeOS depends on manual cross-audits to detect deltas that should propagate upstream. With one downstream (plaud-mirror) accumulating artifacts and seven other `.dockit-enabled` downstreams parado, the failure mode is asymmetric: plaud-mirror generates lessons that never become template improvements because no one is watching the deltas systematically. Building the full inverse motor (`dockit-absorb`, template test-suite, automatic DF promotion, LLM-as-judge) on a single-downstream sample is exactly the modo-de-fallo the global rule "Before adding a passive rule" prohibits — design from data, not from speculation. Two minimal pieces generate the data: this check (local termómetro) plus `forge audit` in ForgeOS (cross-repo motor).

The check is intentionally non-blocking (WARN). The DF promotion is a human decision that depends on signals this check cannot evaluate: whether the artifact is generalizable, whether other downstreams will benefit, whether upstream maintainers will accept it. The check's job is to make those candidates **visible** at every `dockit-validate-session` run so the operator does not need to remember to look. Once the upstream framework matures (CE_V2 pilot completes, `forge audit` ships, ≥2 downstreams generate DF candidates), the WARN→FAIL transition becomes defensible. Today, FAIL would block legitimate project-specific artifacts behind a baseline ceremony that is not yet justified by the data.

Why filename-only comparison: content matching is a different problem. A local script may diverge from upstream because the local copy fixed a bug, customised behaviour, or simply ages. Detecting "your local copy is stale relative to upstream" is a `dockit-sync` concern, not an `unabsorbed-artifact` concern. The two checks are complementary; this one answers "do I have something upstream does not?", `dockit-sync` answers "is what we share still in sync?". Confusing the two would create a check that flags every minor edit, defeating the WARN-level signal.

### Implications

- DF-028 has a structural anchor in plaud-mirror's validator output now. Every `dockit-validate-session.sh --human` run on a plaud-mirror tree where DF-028 is still un-absorbed will emit a baseline-suppressed transient entry, reminding the operator that the upstream story is not closed. When LLM-DocKit absorbs the script, the local file gets deleted and the baseline entry removed in the same commit — the check then drops from 1 transient to 0 naturally.
- Future absorption events (DF-XXX upstream → script lands in `~/src/LLM-DocKit/scripts/`) follow the same protocol: delete local file + baseline entry in one commit. The check provides the empirical signal that the absorption is complete (no more "transient" entries for that path).
- `forge audit` in ForgeOS depends on the baseline file format. Treat `scripts/.unabsorbed-artifact-baseline.json` as a public interface for cross-repo tooling: schema changes require coordinated updates with `~/src/ForgeOS/`. Schema is intentionally minimal (`id`, `path`, `permanent`, `reason`, optional `df_id`, `created_at`) to keep both sides cheap to evolve.
- The check shares D-016's regex-paliativo posture: it catches mechanical drift (filename presence) but cannot detect semantic divergence (a local script that has drifted in content or intent from its upstream namesake). Layer 2 (Optional Enhancement B of `HOOKS_ENFORCEMENT_PROPOSAL`) is the closure path for the full picture; this check is a thermometer, not a thermostat.

### D-018: Operator access control is app-level: passphrase plus signed session cookie

Status: accepted.

**Status:** accepted; **implemented in v0.6.0** (`apps/api/src/runtime/operator-auth.ts`, gate hook + session routes in `apps/api/src/server.ts`, login screen in `apps/web/src/App.tsx`).

### Decision

Plaud Mirror protects its own panel and API instead of relying solely on network position. The model is deliberately minimal for a single-operator service:

- One shared passphrase, supplied via `PLAUD_MIRROR_ADMIN_PASSPHRASE` (same deployment-secret channel as `PLAUD_MIRROR_MASTER_KEY`). No user table, no password hash at rest.
- `POST /api/session/login` exchanges the passphrase for a **stateless HMAC-signed session cookie** (`plaud_mirror_session`, value `<expiresAtMs>.<base64url HMAC-SHA256>`), HttpOnly, SameSite=Lax, 30-day TTL. The signing key is derived from master key + passphrase, so rotating either invalidates every outstanding session.
- An `onRequest` hook rejects every `/api/*` request without a valid cookie with 401, except a public allowlist: `/api/health` (status probes) and `/api/session*` (login itself). Static panel assets stay public — the login screen IS the panel; all data lives behind `/api/*`.
- `/api/health` is **redacted** for unauthenticated callers: `auth.userSummary` (Plaud account email/uid) is stripped.
- Failed logins are throttled in-memory (5 per minute, global window) with constant-time passphrase comparison over SHA-256 digests.
- **Backward compatible:** when the env var is unset, the API stays open exactly as pre-0.6.0, but `health.warnings` carries "Operator access control is disabled — set PLAUD_MIRROR_ADMIN_PASSPHRASE..." and the server logs the same at boot. The deployment cannot silently believe it is protected.

### Rationale

The 2026-06-10 review found the panel exposed at `[referenced endpoint]` (edge-caddy → dev-vm `:3040`) with zero authentication: any LAN device could download all mirrored audio, replace the Plaud token, or redirect the webhook (with attacker-chosen secret) via `PUT /api/config` — metadata exfiltration signed by the service itself. The single-operator trust model stopped holding the moment the panel left localhost.

App-level auth was chosen over proxy-only auth (basic auth / forward-auth in Caddy) because `compose.yml` publishes `3040:3040` directly on the LAN — a proxy gate would leave the direct port open, and the repo cannot enforce configuration that lives in another repo's Caddyfile. Proxy auth can still be layered on top later (e.g. ForgeOS's queued `local-auth-better-auth` module or Authentik forward-auth); this decision establishes the in-repo floor.

Cookie sessions were chosen over an API key header because the panel's `<audio>` elements and plain `fetch` calls send cookies automatically; a header scheme would need a token store in the browser and breaks native audio streaming. SameSite=Lax provides the CSRF boundary (cross-site POST/PUT/DELETE never carry the cookie). The `Secure` flag is intentionally NOT set: TLS terminates at edge-caddy and the LAN fallback (`[referenced endpoint]`) must keep working; revisit if the direct-port path is ever closed.

The 30-day TTL is a product decision, not a security compromise: the primary re-auth surface is the operator's phone, and the kill switch is rotating the passphrase (which invalidates all sessions instantly because the signing key derives from it).

### Implications

- `compose.yml` passes `PLAUD_MIRROR_ADMIN_PASSPHRASE` through; the operator must add it to `.env` manually (env policy: agents do not write secrets).
- New shared schemas `SessionStatusSchema` / `SessionLoginRequestSchema`; new routes `GET /api/session`, `POST /api/session/login`, `POST /api/session/logout`.
- The web panel boots through a session gate: `GET /api/session` decides between the login screen and the panel; any 401 mid-session returns the operator to the gate (`UnauthorizedError` plumbing in `requestJson`).
- Phase 4's phone-friendly re-auth UX builds on this: protecting the panel is the precondition for making it MORE reachable (push notifications with deep links, etc.).
- The login throttle is per-process and global, not per-IP. Good enough for a LAN single-operator surface; revisit if the service is ever exposed beyond the LAN/WireGuard boundary (that would also demand `Secure` cookies and likely real identity, per the D-009 posture).
- `/api/health` stays consumable by infra-portal and Docker healthchecks without credentials, at the cost of exposing operational metadata (counts, scheduler state, error strings) to the LAN. Error messages must therefore keep honoring the "no secrets in logs/errors" rule (LLM_START_HERE Critical Rules) — they are now visible to unauthenticated LAN callers by design.

### D-019: Phase 4 auth: browser-assisted bearer capture (provider selection)

Status: accepted.

**Status:** accepted; **implemented in v0.7.0**, with Chrome-extension delivery added in **v0.8.0** (`apps/web/src/plaud-token.ts`, `apps/api/src/runtime/capture-session.ts`, `/api/connect/start` + `/api/connect/complete` in `apps/api/src/server.ts`, `ConnectPlaud` + "Reconectar Plaud" card in `apps/web/src/App.tsx`, `apps/chrome-extension/`).

### Decision

Phase 4's re-auth UX is **browser-assisted capture of the existing Plaud bearer**, not credentials-login and not the official OAuth/MCP. The operator clicks "Reconectar Plaud" in the panel, logs into app.plaud.ai normally (Google SSO), then uses a local Chrome companion extension to read the bearer from the active Plaud tab's browser storage and return it to the mirror via a one-time, panel-initiated capture session. The bearer lasts ~300 days, so this is a roughly-once-a-year, no-DevTools, no-password interaction. The original v0.7.x bookmarklet remains copy-only fallback; it is no longer the recommended delivery mechanism.

This is framed as a **provider selection**, with the candidates evaluated as follows:

1. **Official partner/developer API** (`platform.plaud.ai`, `client_id`/`secret_key`): enterprise/partner only, not available to an individual account. Rejected.
2. **Official CLI/MCP** (`@plaud-ai/mcp`, OAuth browser sign-in): genuinely new in 2026 and *not disproven* — its docs mention `presigned_url`, so it may expose raw audio. **Deferred / watch**, NOT discarded on a transcript/proxy assumption. Not chosen now because: it routes through Plaud's MCP server (a different model than mirroring the original artifact to local disk), it is undocumented enough that adopting it would be a spike rather than a doc-read, and it would replace the working private-API client wholesale. Re-evaluate if the private API breaks or if unattended raw-audio export through MCP is confirmed.
3. **Private API email+password login** (`POST /auth/access-token`): a real endpoint (confirmed reachable from dev-vm; returns `access_token` + `refresh_token`, ~300-day TTL, rate limit 10 logins/hour). **Not applicable to this operator's account**: the account was created with Google SSO, Plaud does not allow adding a password to an SSO-origin account, and the password-reset flow returns "Account not found". For an email+password Plaud account this would be the cleanest auto-login path; it stays documented as the option for that case (and would make the scrypt KDF upgrade mandatory, since storing a password is more sensitive than storing a bearer).
4. **Browser-assisted capture** (chosen): works regardless of SSO (it captures whatever token the browser already holds), needs no password stored, reuses the entire existing private-API client, and is buildable today. The token-location logic is adapted from the MIT `iiAtlas/plaud-recording-downloader` extension (see `docs/UPSTREAMS.md` Phase 4 adoption + D-005/D-007). v0.8.0 adds Plaud Mirror's own minimal Chrome companion extension because a React-rendered draggable `javascript:` link proved unreliable as a bookmarklet distribution channel.

### Rationale

The operator's account is Google SSO, which removes credentials-login from the table for *this* deployment. Between "evaluate an undocumented official MCP" and "capture the bearer the browser already has", the latter is lower-risk, compatible with the audio-first private-API client already built and verified, and stores no new secret. The official MCP is the strategically cleaner long-term path *if* it can deliver unattended raw-audio export, so it is parked as watch rather than killed — avoiding the over-claim that it was "discarded".

### Capture-session design (token-fixation defence)

The naive flow (`/connect#token=...` → `POST /api/auth/token`) is safe against garbage tokens (the bearer is validated against Plaud `/user/me` before storing) but not against *token fixation*: a crafted `/connect#token=<attacker's-valid-token>` link opened by a logged-in operator would silently repoint the mirror at the attacker's account. So capture is a **panel-initiated handshake**:

1. Panel `POST /api/connect/start` → `CaptureSessionStore` mints a single-use `captureId` (in-memory, TTL 10 min). Panel stashes it in the mirror's own `localStorage` and opens app.plaud.ai.
2. Chrome extension (runs only after the operator presses it on app.plaud.ai / web.plaud.ai, carries NO captureId) reads the bearer and navigates to `<mirror>/connect#token=...`. Copy-only bookmarklet fallback uses the same redirect shape.
3. `/connect` strips the fragment immediately (`history.replaceState`), reads the `captureId` from mirror `localStorage`, and `POST /api/connect/complete { token, captureId }`.
4. Backend consumes the `captureId` (single-use, must be live), then validates the bearer against Plaud and stores it via the same path as the manual paste.

Both connect routes require the operator session (D-018); neither is in the public allowlist. The token only ever travels in a URL fragment (never sent to a server, never logged) and one same-origin authenticated POST.

### Implications

- The manual paste path (`POST /api/auth/token`) stays as the universal fallback.
- Telegram is explicitly NOT a capture channel (it cannot read browser storage); it remains a possible future notification/deep-link surface only.
- Storing a Plaud password is avoided entirely for this account, so the scrypt KDF debt (H2) stays "should do" rather than "must do for this feature".
- If Plaud changes its browser token shape, the Chrome extension and fallback bookmarklet extraction are the maintenance surface; the `iiAtlas` upstream is the reference to re-sync against.
- If Plaud changes the request context expected for browser-minted bearers, the backend Plaud client must follow Plaud Web's current fingerprint as well. `v0.8.1` is the first instance: the operator proved the captured EU `pld_tokenstr` was valid in Plaud Web, while the backend's old `app.plaud.ai` + custom-user-agent request got an HTML 403, so `PlaudClient` moved to Plaud Web origin/referer, browser-like UA, and browser `sec-fetch-*` headers.
- The extension does not overturn D-002's server-first architecture. It is a local capture adapter only: no syncing, storage, listing, or download logic moves into the browser.

### Upstream watch amendment (2026-07-13)

The 2026-07-13 baseline review (`docs/UPSTREAMS.md`) surfaced a material change
in Plaud's browser auth model, reported by MIT `rsteckler/applaud` v0.5.11
(PR #32, issue #31): **new/migrated Plaud accounts no longer expose the
long-lived `pld_tokenstr` JWT in localStorage.** The first-party model is a
short-lived cookie pair — `pld_ut` (user token) + `pld_urt` (refresh token,
~30 days) — plus two endpoint facts (adoptable per D-011; the source is MIT so
code may also be adapted with attribution per D-005):

- `POST /user-app/auth/workspace/token/{id}` mints the short-lived workspace
  token used as the API bearer.
- `POST /auth/refresh-user-token` rotates the user token off the refresh token.

Consequences for this decision:

1. The current capture path (extension reads `pld_tokenstr`) keeps working for
   accounts still on the legacy model — the operator's account captured
   successfully on 2026-06-16 and the stored bearer remains healthy — but it
   is living on borrowed time: when Plaud migrates the account, the next
   annual re-auth will find no `pld_tokenstr` to capture.
2. The new model is not only a threat; it is the first credible path to the
   originally-deferred **unattended renewal**: capturing the `pld_ut`/`pld_urt`
   pair once would let the server keep itself authenticated by refreshing the
   user token and re-minting workspace tokens (what applaud PR #32 implements
   server-side). Unlike applaud's on-disk Chromium cookie decryption, Plaud
   Mirror's Chrome extension can read the cookies directly via the
   `chrome.cookies` API — a far smaller change.
3. Queued follow-up (HANDOFF Open Work; deliberately not started mid-soak):
   extend the extension/`/connect` handshake to capture `pld_ut`/`pld_urt`
   when `pld_tokenstr` is absent, and teach the backend the mint/refresh
   lifecycle. Storing a refresh token raises the stakes of the secrets store,
   which pulls the scrypt KDF upgrade (H2) forward into the same slice.

This amendment records facts and intent only; the provider selection above is
unchanged until the adaptation ships.

### D-020: Plaud recording sync adopts Home Infra Protocol as a status contract

Status: accepted.

**Status:** accepted; **implemented in v0.10.0** (`infra.contract.yml`, `docs/INFRA_CONTRACT.md`, `packages/shared/src/protocol.ts`, `apps/api/src/runtime/protocol-status.ts`, public protocol status routes in `apps/api/src/server.ts`).

### Decision

Plaud Mirror's Plaud recording sync is declared as a `home-infra-protocol`
`sync_jobs[]` producer. The project contract lives in `infra.contract.yml` and
declares one job:

```yaml
id: plaud-mirror-recordings-sync
source:
  kind: plaud
  authority: external
schedule:
  mode: manual
stale_after: P1D
runtime:
  host_id: dev-vm
  service_id: plaud-mirror
```

The runtime publishes a sanitized protocol status snapshot at:

```text
GET /api/protocol/sync-jobs/plaud-mirror-recordings-sync/status
GET /api/protocol/status
```

The snapshot conforms to `home-infra-protocol`
`schemas/status-snapshot.schema.json`: `observed_at`, optional `next_run_at`,
`condition`, `severity`, `summary`, and optional shaped `checks[]`, with Plaud
Mirror-specific detail blocks allowed by the protocol's additive schema.

### Rationale

The operator wants Plaud Mirror sync to participate in the same infrastructure
language as other homelab synchronizers, so Infra Portal, Hermes, and future
agents can consume it without bespoke `/api/health` parsing. The right
integration point is a thin status/contract layer over the existing sync
engine, not a rewrite of the Plaud download pipeline.

Plaud Mirror already owns all runtime facts needed for the protocol:

- Plaud auth state.
- Latest and active sync runs.
- Plaud total, local mirrored count, dismissed count, and missing count.
- Scheduler state.
- Durable webhook outbox state.

The protocol layer normalizes those facts into the shared status vocabulary.
Consumers derive freshness and policy from `observed_at + stale_after`; Plaud
Mirror does not self-declare freshness and does not alert by itself.

From v0.13.0, Plaud Mirror also maps the live scheduler's existing
`nextTickAt` to protocol 0.10.0 `next_run_at`. It omits the field when no
authoritative plan exists. This timestamp is scheduling evidence only and does
not change the freshness or severity boundary above.

### Schedule mode

The contract started as `manual` while scheduler operation was not intended.
From `v0.10.7`, the Phase 3 soak makes the existing in-process scheduler normal
operation, so the contract declares `internal-loop`, `cadence: PT15M`, and
`stale_after: PT2H`. The budget exceeds cadence plus `max_runtime: PT1H`.

### Security and exposure

The protocol status route is public like `/api/health` because Infra Portal and
status probes need to read it without an operator session. It must therefore
remain sanitized:

- no Plaud account `userSummary`
- no bearer token
- no webhook secret
- no raw Plaud rejection body
- no filesystem paths beyond already-public mirror metadata semantics

### Implications

- `infra.contract.yml` is now part of the project contract surface and should be
  kept in sync with scheduler reality.
- `home-infra/catalog/project-contracts.yml` should register Plaud Mirror so
  Infra Portal can render `plaud-mirror-recordings-sync`.
- The generic `recording.synced` webhook remains the downstream event delivery
  mechanism; it is separate from the protocol status snapshot.
- YouTube2Text/Media2Text should consume webhook events for work creation and
  expose its own protocol job for transcription/archive state. It should not
  infer Plaud Mirror source freshness from webhook volume alone.

### D-021: Permanent Plaud deletion is an explicit post-dismiss operator command

Status: accepted.

**Status:** accepted; implemented in `v0.11.0`

**Amendment (2026-07-14, `v0.11.1`):** The route-local authorization check is
fail closed. If `PLAUD_MIRROR_ADMIN_PASSPHRASE` is absent, permanent Plaud
deletion returns HTTP 403 before the service or Plaud client runs. The broader
API may retain its open-development compatibility mode, but an irreversible
upstream mutation may not inherit it.

**Amendment (2026-07-14, `v0.11.2`):** The fail-closed rule is implemented as a
named reusable destructive-route pre-handler. Regression coverage pins both
states: 403 before any Plaud call when access control is absent, and 401 for an
anonymous caller when it is configured.

**Amendment (2026-07-16, `v0.12.0`):** Destructive success requires more than
HTTP 2xx. Plaud Mirror accepts only an empty response body or explicit
`{ status: 0 }`, journals intent and transitions before remote side effects,
and treats any uncertain DELETE as a durable retry state. A retry first reads
Plaud detail; 404 after `delete_attempted` confirms the tombstone without a
second DELETE. Restore is blocked while any deletion operation is unresolved.

### Decision

Plaud Mirror may permanently delete a recording from the operator's Plaud
account only when all of these conditions hold:

1. the recording is already dismissed locally;
2. the request is authenticated by the existing operator session;
3. the panel presents one clear confirmation stating that the original will
   disappear from Plaud and cannot be restored;
4. the server performs the mutation and records a durable
   `upstream_deleted_at` tombstone after success.

The command is optional and separate from local dismiss. Local dismiss remains
reversible and still does not mutate Plaud. The permanent command uses the
observed private Plaud flow (`POST /file/trash/` then `DELETE /file/`, both with
an id array), implemented independently from endpoint facts documented by the
MIT-licensed `JamesStuder/Plaud_API` project.

### Rationale

The operator wants to curate locally first, then make a deliberate account-wide
decision only for items already judged disposable. Making the irreversible
action a second, text-labelled command preserves that review step without the
friction of a typed phrase. A normal confirmation is enough for this
single-operator console when its copy names the remote consequence precisely.

Keeping a local tombstone solves two integrity problems: the scheduler cannot
re-download a delayed upstream listing after deletion, and the interface keeps
an audit fact instead of silently losing the row. The tombstone is monotonic;
later UPSERTs cannot clear it, Restore returns 410, and repeating the deletion
returns the stored result without another upstream request.

### Implications

- The browser never calls Plaud directly; all mutation stays behind the
  operator-session-gated API.
- Missing operator access-control configuration blocks this route even when
  compatibility mode leaves non-destructive API routes open.
- Automated and deployment tests use mocks and must not delete a real Plaud
  recording.
- The private endpoint is an upstream risk tracked in `docs/UPSTREAMS.md` and
  `docs/operations/UPSTREAM_WATCH.md`.
- `home-infra-protocol` is unchanged. This is project-local operator behavior,
  not infrastructure status or cross-project policy.
- A failure before durable mutation intent leaves the row normally dismissed.
  Once an operation exists, failure leaves it dismissed in a retry-only state
  and never fabricates a tombstone. Restore cannot race an uncertain remote
  mutation.
- `upstream_deletion_operations` stores current recovery state;
  `upstream_deletion_events` is append-only evidence. Legacy tombstones are
  imported as confirmed operations by an additive migration.
- Current remote coverage is a separate generation-based fact. Historical
  tombstones remain auditable but do not count as dismissed remote rows after
  Plaud no longer lists them.

### D-022: Plaud-first Media2Text integration requires closed-loop intake reconciliation

Status: accepted.

**Status:** accepted product direction and historical producer review.
Media Intake v1 at Media2Text commit `c982ced` returned REQUEST CHANGES.
The repository-SHA implementation gate was superseded by D-023 after the
operator required Plaud Mirror to remain independently publishable.

### Decision

Plaud recordings are the first live media source that must reach Media2Text.
YouTube channels are secondary. The integration is a network contract between
two independently deployed products:

- Plaud Mirror remains authoritative for Plaud inventory and mirrored audio.
- Media2Text owns admission, artifact verification, transcription, transcript
  storage, and completion state.
- Cortex consumes Media2Text's frozen Transcript Ready contract; it does not
  fetch audio from Plaud Mirror.
- Home Infra Protocol observes sanitized status. It does not transport audio or
  product events.

The product is not complete when Plaud Mirror merely receives HTTP 202. It is
complete when Plaud Mirror can reconcile every eligible artifact revision into
an explicit Media2Text state (`not_sent`, `accepted`, `processing`,
`transcribed`, or `failed`) and show exact source-to-transcript coverage.
Durable completion notification is the primary path; a producer-scoped status
read is the recovery path.

The frozen intake contract must therefore guarantee:

1. Identity is the tuple `source.authority + source.collectionId +
   source.itemId + source.artifactRevision`. For this producer, `itemId` is the
   Plaud recording id and `collectionId` is a stable, pseudonymous Plaud
   account/workspace namespace, never an email, local path, or device nickname.
2. `source.artifactRevision` is exactly `sha256:${artifact.sha256}`. Plaud
   Mirror hashes the verified local bytes before enqueue and persists the
   revision used by the event.
3. The artifact is served through an immutable HTTPS URL with a separately
   provisioned, least-privilege fetch credential. No bearer, secret, local
   path, shared volume, URL credential, query token, or fragment enters the
   event body.
4. A durable Plaud-side outbox sends the intake request at least once. Repeated
   delivery uses the same idempotency key and byte-identical request. HTTP 409
   is a permanent integrity conflict, not a transient retry.
5. Media2Text persists the obligation before 202, then reports terminal success
   or failure back to Plaud Mirror through a durable signed status event. Plaud
   Mirror can also read the admitted intake status using a credential limited
   to records created by that producer.
6. Plaud Mirror pins an immutable delivery copy from enqueue until Media2Text
   reaches a terminal state. Local dismiss or permanent Plaud deletion cannot
   make an accepted artifact disappear before Media2Text fetches it.
7. Historical replay hashes and enqueues current-generation, physically
   verified local audio. It does not re-download from Plaud. Dismissed rows,
   unresolved deletion operations, and confirmed tombstones are ineligible.

### Rationale

The existing Media Intake draft gets the main boundary right: 202 means a
durable obligation, transfer crosses hosts, bytes are verified by SHA-256 and
length, and duplicate admission is idempotent. The producer review found that
those guarantees are not yet enough for the operator's actual product goal.
Media2Text currently ignores `collectionId` in its uniqueness key, fetches the
artifact without a service credential, and exposes intake reads only through
the full operator API. Plaud Mirror would therefore be unable to prove that all
of its eligible recordings became transcripts, and a dismiss between 202 and
the asynchronous fetch could turn a green delivery into a permanent 404.

Closed-loop status is deliberately part of the product contract, not a Portal
metric bolted on later. It gives the operator one truthful answer to: "Are all
eligible Plaud recordings transcribed?"

### Implications

- The existing `recording.synced` webhook remains backward compatible. Media
  Intake is an additive destination/payload lane with its own least-privilege
  credential and per-revision identity; it must not serialize `localPath`.
- The existing outbox retry/crash-recovery machinery can be reused, but its
  current rigid payload and single `lastWebhookStatus` field are insufficient
  for both generic webhooks and Media2Text lifecycle state.
- A producer completion status event uses
  `schemaVersion = media2text.intake-status.v1` and
  `eventType = intake.status`, with `eventId`, `idempotencyKey`, `occurredAt`,
  `intakeId`, the full source identity tuple, terminal status `completed` or
  `failed`, optional `transcriptId`/`recordSha256`, and optional sanitized
  `error.code`. It is delivered at least once and HMAC signed; pull status
  remains available for reconciliation.
- An explicit re-transcription of an already completed artifact is a
  Media2Text operation. Reposting the same intake request only deduplicates;
  Plaud Mirror must not manufacture a different request under the same
  artifact revision.
- No adapter, artifact endpoint, receiver, canary, bulk replay, or deployment
  starts until Media2Text publishes the requested revision and the operator
  ratifies a frozen commit SHA.

The final implication above records the gate at the time of the review. D-023
supersedes it: Plaud Mirror now owns a neutral contract, while live traffic
still requires a conforming provider and a separately authorized canary.

### D-023: Transcription Intake is provider-neutral and optional

Status: accepted.

**Status:** accepted by operator on 2026-07-16; implemented in `v0.14.0` source,
not deployed during the `v0.13.1` soak.

### Decision

Plaud Mirror must remain useful and publishable with no Media2Text, Cortex,
Home Infra, shared volume, or sibling repository present. Transcription is an
optional destination type named **Transcription Intake v1**. Plaud Mirror owns
and publishes that contract under `docs/contracts/`; any independently
deployed service may implement it. Media2Text is the first intended reference
provider, not a package, runtime, storage, schema-SHA, or deployment dependency.

The generic `recording.synced` webhook remains a separate notification
feature. It is not renamed, overloaded, or treated as transcription admission.
The transcription lane has its own destinations, secrets, durable outbox,
artifact leases, status journal, reconciliation worker, API, and Integrations
screen.

No configured destination is a healthy standalone state. Plaud sync,
backfill, playback, dismiss/restore, permanent deletion, Home Infra status,
and the generic webhook continue unchanged. A configured provider failure is
reported only on that provider's delivery state and does not make the Plaud
mirror incomplete or stop source synchronization.

### Contract

- A destination is one exact provider origin plus one exact public Plaud Mirror
  origin. Production requires HTTPS; HTTP is loopback-only.
- Capability discovery proves support for `transcription.intake.v1` and
  `transcription.intake-status.v1` before the destination can be enabled.
- Admission uses a provider-scoped bearer. Artifact fetch uses a different,
  producer-generated bearer revealed only at provisioning/rotation. Status
  callbacks use a third HMAC secret. Operator and Plaud credentials are not
  reused.
- Identity is `authority + collectionId + itemId + artifactRevision`, where
  Plaud Mirror publishes `authority=plaud-mirror` and
  `artifactRevision=sha256:<artifact.sha256>`.
- The producer pins content-addressed bytes before durable enqueue. Active
  leases survive local dismiss, source replacement, permanent Plaud deletion,
  and destination disable. Terminal state releases the pinned file.
- Admission is at least once and idempotent. HTTP 409 means conflicting content
  under an existing key/identity. Push status is HMAC signed and deduplicated;
  pull status is the recovery path. State transitions are monotonic.
- Historical replay selects only current-generation, physically verified local
  audio and never re-downloads from Plaud. Canary precedes bounded batches.
- Titles and filenames are intentional operator-data disclosure to the chosen
  provider. Events never contain credentials, Plaud bearers, local paths,
  shared-volume references, query tokens, or transcript content.

### Product Implications

The panel adds an **Integrations** screen rather than adding Media2Text fields
to Configuration. It supports multiple named destinations, one primary
destination, test-before-enable, one-audio canary, replay preview/batches,
credential rotation, exact state coverage, and only valid admission retries.
Main shows the primary pipeline only when configured; Library shows per-audio
state. Media2Text branding may appear as an operator-chosen destination name,
never as a hard dependency or protocol name.

Plaud Mirror does not deliver to Cortex. A compatible transcription provider
owns transcript storage and may emit its separate Transcript Ready contract to
Cortex. Home Infra continues to receive sanitized operational status only.

### Live Gate

`v0.14.0` source may be published while `v0.13.1` remains deployed for its
soak. No provider is enabled and no historical replay begins until a provider
passes capability discovery, one authenticated canary, hash/length
verification, signed terminal status, pull reconciliation, duplicate replay,
conflict handling, and terminal lease release. Media2Text must adapt to the
Plaud-owned contract or negotiate a versioned revision; Plaud Mirror does not
silently code against another repository's draft.

### D-024: Treat Transcription Intake v1 as a compatibility profile and defer neutral extraction

Status: accepted.

**Status:** accepted by operator on 2026-07-17.

### Decision

The contract shipped in D-023 is named **Plaud Mirror Transcription Intake v1
Compatibility Profile**. It is provider-neutral at the transcriber boundary,
but it is not presented as a universal content standard before any real
provider canary has completed.

Its reusable core is immutable source identity, representation hash and byte
length, authenticated transfer, idempotent durable admission, monotonic
status, and pull reconciliation. Audio MIME constraints, transcription states,
and transcript result fields are profile-specific.

A future neutral Content Intake Protocol is the intended extraction direction.
Extraction occurs only after this profile passes a live canary and a second
structurally distinct processing profile, such as OCR, becomes real. A second
audio producer alone does not satisfy that trigger. Until then, Plaud Mirror
publishes a byte-pinned schema manifest and an executable provider conformance
probe; compatible transcribers implement the profile without changes to Plaud
Mirror's core.

### Implications

- No new protocol repository is created in this slice.
- Media2Text may preserve its internal intake domain and expose an additive
  compatibility facade for this profile.
- The eventual neutral protocol does not belong to Home Infra Protocol, whose
  responsibility remains infrastructure discovery, sync status, and sanitized
  operational telemetry rather than content transport.
- Activating a second transcription destination requires explicit operator
  confirmation because simultaneous destinations can duplicate paid work.

### D-025: Keep delivery failure review local and separate from protocol state

Status: accepted.

**Status:** accepted and implemented in `v0.15.0` source on 2026-07-18; not
deployed in this slice.

### Decision

Plaud Mirror treats a transcriber's terminal error code as sanitized transport
evidence, not enough information to infer provider internals. A terminal
`failed` or `conflict` delivery may therefore receive a separate, structured
operator review with:

- category: dependency, incompatible artifact, policy, or provider;
- disposition: active or resolved;
- whether the paid provider was invoked;
- a policy-only per-audio limit; and
- an automatic review timestamp.

Review is local Plaud Mirror metadata. It never changes the frozen
Transcription Intake wire payload, the provider's terminal state, retryability,
artifact-lease lifecycle, or the historical delivery row. There is no free
text field: the review surface cannot become a path for copying credentials,
filesystem paths, provider responses, or operator content into logs/state.

### Rationale

The first live canaries produced three operationally different failures while
the status contract correctly exposed only `transcription_failed`: two
historical implementation incidents later corrected by the provider and one
211.51-minute item blocked by a 180-minute economic policy before provider
invocation. Hard-coding those recording ids, Media2Text versions, or private
error internals into an OSS Plaud Mirror build would violate D-023. Displaying
all three simply as `Failed` would discard known operator evidence.

A second local dimension keeps both truths. Transport history remains
immutable and auditable, while the product can distinguish active attention
from a resolved historical canary and can state the next action without
inventing a retry that Plaud does not own.

### Implications

- `media_deliveries` receives additive duration and review columns. Existing
  rows migrate with no inferred category; the operator classifies them only
  from external evidence after deployment.
- Coverage retains raw `failed` and `conflict` totals and adds
  `requiresReview` plus `resolvedFailures`. A resolved review remains a raw
  terminal failure.
- Integrations shows sanitized phase, cause, and next action. Library uses the
  same reviewed classification for its compact badge.
- Reprocessing downstream failures remains a provider-owned operation. This
  slice adds no replay action, credential change, backlog delivery, or wire
  contract revision.

### D-026: Connection setup is bilateral and separate from content transport

Status: accepted.

**Status:** accepted by operator on 2026-07-20; architecture and V1 operator
mechanism ratified, implementation separately gated.

### Decision

Provisioning a transcription connection is a bilateral control-plane workflow,
not part of Transcription Intake v1 and not a Home Infra Protocol capability.
Plaud Mirror provisions its producer half; the transcriber provisions its
receiver profile. Plaud Mirror never provisions, observes, or reports Cortex.

V1 uses two sensitive portable bundles carried by the authenticated
single-operator user:

1. Plaud exports a `connection-request` containing producer/route/contract
   metadata and its generated artifact-access bearer.
2. Media2Text imports that request into a mutable runtime profile store and
   exports a `connection-grant` containing receiver/capability/limit metadata,
   its intake bearer, and its status-signing HMAC secret.
3. Plaud imports the grant, proves capabilities, and only then permits
   enablement and a bounded canary.

The three secrets retain one issuer and one direction: Plaud issues artifact
access; Media2Text issues admission access and status signing. Bundle schemas
must bind a unique id, request id, issue/expiry timestamps, and the exact
contract version/hashes. Importers persist consumed ids and reject expiry,
re-import, request mismatch, and contract mismatch.

V1 does not add a signing PKI. Its trust bootstrap is operator custody between
two already authenticated product surfaces. A canonical-content hash detects
accidental corruption but is not issuer authentication. Offline copied bytes
cannot honestly be described as strongly single-use, revocable, or single-view.
Those stronger guarantees require future online redemption.

Media2Text runtime provisioning is required from the first real implementation.
An authenticated UI/API backed by encrypted mutable storage is the primary
operator path. The existing environment JSON becomes a seed used only when the
store is empty; a CLI that writes Doppler and recreates the container may exist
only as break-glass tooling, not as the product workflow.

### Product Model

Connection state is four-dimensional rather than a linear stepper:

- configuration: absent, partial, or complete;
- policy: disabled, enabled, primary, or secondary;
- evidence: untested, capability-tested, or canary-proven; and
- health: unknown, healthy, degraded, or action required.

Canary evidence is stored on the delivery as a dispatch kind, not inferred from
a button or a recent success. The operator surface answers how to connect, how
to prove operation, what scope/cost applies, and how to pause/rotate/disconnect/
archive. Manual V1 disconnection is guided bilateral work, not a false atomic
claim. Cutting active work appends revocation evidence and produces a terminal
local projection so exact coverage has no permanently pending rows.

Cost also has two authorities. Plaud owns workload count, duration, bytes, and
duplicate-destination scope. Media2Text owns provider pricing, retry allowance,
and hard economic limits. Plaud-local currency estimates must name the
configured rate and date and must not be presented as provider quotations.

### Deferred Evolution

Online pairing, authenticated redemption, in-band artifact-access provisioning,
and per-lease artifact tokens are deferred together. Extraction of a reusable
pairing protocol waits for a second real service pair. Home Infra records only
deployed versions, digests, secret references, and sanitized health. ForgeOS
may discover the owning roadmap and handoffs but does not duplicate or own this
control plane.

The complete operator brief, negative cases, release splits, soak rule, and
eight-wave roadmap live in
`docs/design/CONNECTIONS_OPERATOR_EXPERIENCE.md`.

### D-027: NAS production uses a single-writer quiesced migration and split storage

Status: accepted.

**Status:** accepted

### Decision

Plaud Mirror production moves from `dev-vm` to the QNAP NAS in `v0.16.0`.
Application behavior, database schema, HTTP API, transcription contract, and
public hostname remain unchanged. The deployment boundary changes as follows:

- images are built on dev-vm, published to the NAS-local registry, and pinned
  in production by release tag plus registry digest;
- NAS HTTP binds only to `[network address]:3040`; `edge-caddy` is the sole operator
  ingress;
- SQLite and encrypted secrets live under
  `[private custody]`, while growing audio and active
  artifact leases live under `[private custody]`;
- production configuration uses `doppler://plaud-mirror/prd` through a
  read-only service token; the historical master key moves without rotation so
  the existing `secrets.enc` remains decryptable, while the full production
  environment is materialized only on NAS tmpfs for one launcher invocation;
  and
- dev-vm is stopped before NAS startup. The two instances are never active
  concurrently because the SQLite-backed in-process scheduler is a
  single-writer design, not a distributed lease.

Recordings may be pre-seeded while the source is live, but this copy has no
authority. Final `runtime/data` and recordings synchronization happens after
`activeRun` and claimed work are absent, the source container is stopped, its
WAL is checkpointed, and SQLite integrity passes. Direct NAS acceptance
precedes the backed-up single-vhost Caddy change. Home Infra records `host_id:
nas` only after the NAS serves; Home Infra Protocol gains no new schema, and
ForgeOS remains a discoverer rather than a deployment owner.

**2026-09-13 cutover amendment:** the first live cutover attempt proved that
QNAP's enforceable storage identity is `uid=1000(the operator),
gid=100(everyone)`. The audited generic image identity 1000:1000 required host
privilege that this deployment account does not possess, and Docker root is
remapped away from the dataset. The attempt stopped before NAS startup and
Caddy mutation, then restored the healthy dev-vm source. `v0.16.1` therefore
pins NAS to 1000:100 while preserving non-root execution, owner-only modes,
paths, data, and every application/wire contract. The image and dev-vm remain
1000:1000; this amendment is QNAP-placement-specific.

**2026-09-14 acceptance amendment:** Docker inspect reports the bind source as
the exact path declared to Docker (`[private custody]` or
`[private custody]`), while QNAP `readlink -f` resolves those aliases to
their backing ZFS dataset paths. Container acceptance therefore compares the
declared, already allowlisted sources and does not mix the two namespaces.
Destination, RW state, filesystem content, and host-path allowlists remain
independent checks.

The corrected `v0.16.2` host asset, direct and canonical checks, and the first
NAS-owned PT15M run passed on 2026-09-14. `v0.16.3` therefore changes the
project-owned contract from `host_id: dev-vm` to `host_id: nas` and its secret
references from Doppler `dev` to `prd`. This is declaration reconciliation,
not another runtime release: immutable `v0.16.1` continues without rebuild or
restart. Home Infra may now project the owner truth; Home Infra Protocol and
ForgeOS still require no schema or artifact change.

That observer projection completed on 2026-09-14: Home Infra `0.34.18`
source `0519d45` and live Infra Portal provenance agree on Plaud contract
source `ffe28e9`, canonical production placement on `nas`, and a current
720/720 sync job without warnings. This is separate evidence from owner
declaration and runtime acceptance; none substitutes for the others.

The original decision retained old dev-vm data as a stopped rollback source
until NAS serving, automatic-run evidence, observation, and recoverable backup
gates passed. On 2026-09-14 the operator explicitly authorized deleting only
the local recording tree after a fresh checksum comparison proved exact parity
for all 1,441 files / 12,209,691,055 bytes. Control state and the quiesced
SQLite backup remain, but dev-vm is no longer a complete rollback source. No
independent NAS backup had been verified, so NAS became the sole verified audio
copy; backup resilience remains an explicit open obligation.

**2026-09-14 lean-development amendment:** the operator subsequently approved
retiring the remaining runnable dev-vm footprint. Exact-target checks and an
independent review authorized deletion of only the rebuildable `node_modules`
tree, the stopped zero-restart Plaud container, and its sole-tagged local image.
The source checkout and `.env` remain so development can resume deliberately.
The 15 MiB `runtime/data` tree also remains in full: NAS contains matching
copies of the quiesced pre-cutover database and encrypted secret blob, but no
independent current NAS snapshot/backup or restore proof exists. Keeping that
small tree is the fail-closed consequence and the only Plaud custody outside
NAS; it is evidence/recovery seed, not authority or a runnable rollback.

### Context

On 2026-09-13 dev-vm's 117 GB root filesystem was 89% used with 13 GB free;
Plaud Mirror's source-owned runtime consumed 12 GB. The normal NAS Container
share had only 22.6 GB free, so copying all recordings there would merely move
the capacity problem. The existing `[private custody]` dataset had about
968 GB free and is the established large project-data surface.

The production `prd` Doppler config was empty, while the required 64-character
master key existed only in the running container environment. Moving hosts
without first escrowing that exact value would make the encrypted bearer and
destination credentials unrecoverable. Starting both instances would risk
duplicate automatic sync and delivery because the scheduler lock is local to
one SQLite database.

### Consequences

- `v0.16.x` is assigned to this deferred Phase 5 host-placement capability;
  D-026 connection-control implementation moves to `v0.17.x` without changing
  its product model or authorization gate.
- The minor version is deliberate under the pre-1.0 rule: physical placement
  changes, while the application schema, logical data, HTTP/wire contracts,
  and public hostname remain backward compatible. The original exact rollback
  source was later retired by the operator-authorized cleanup amendment above.
- Source assets, an image push, container health, canonical ingress, first
  automatic run, and Home Infra projection are recorded as separate evidence.
- SQLite integrity is checked on every launcher invocation, while the strict
  zero-active-work assertion is a one-time migration flag. Normal upgrades
  must allow persisted retry/processing work and application-owned crash
  recovery rather than abusing the empty-install override.
- NAS administrators and the storage host remain inside the trust boundary;
  mode 0700 leaves prevent accidental cross-service access but are not a
  cryptographic boundary.
- Historical transcription replay, new provider work, Cortex delivery,
  connection-control implementation, and paid processing remain out of scope.

### P-OPERATIVE: Operational-first delivery recommendation

Status: proposed.

Consensus reached on September 29 by Codex and exact Opus 5.5 high: existing Markdown value, then one new-recording path, then daily reliability, then Cortex retrieval. This is an agreed recommendation, not a canonical amendment or implementation authorization. Full provisioning and historical backlog leave the first useful slice critical path; original owner gates remain.

## Historical releases and interventions

### 2026-04-21: release 0.1.0

- Initial Plaud Mirror repository scaffold derived from `LLM-DocKit`
- Product documentation for project context, architecture, upstream strategy, and operational runbooks
- `.dockit-enabled` and `.dockit-config.yml` for continued downstream sync from `LLM-DocKit`
- `config/upstreams.tsv` baseline for tracked Plaud ecosystem upstreams
- `scripts/check-upstreams.sh` for local upstream change detection
- `upstream-watch` GitHub Actions workflow stub for scheduled upstream checks


- Replaced template-facing documentation with Plaud Mirror project documentation
- Converted repository structure from generic `src/` scaffold to `apps/`, `packages/`, and `config/`


- Runtime service implementation has not started yet. This release is the documentation and governance baseline.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-22: release 0.1.1

- `handoff-start-here-sync` validation in `scripts/dockit-validate-session.sh` to catch drift between `docs/llm/HANDOFF.md` and `LLM_START_HERE.md`
- `docs/llm/README.md` section documenting the mechanically enforced sync rules


- Stable project docs now match the converged roadmap: manual-token-first auth, filtered historical backfill in the first usable release, HMAC-signed generic webhook delivery, and automatic re-login deferred
- The handoff/runtime-shape split is clearer: implementation stack lives in `docs/ARCHITECTURE.md`, while `docs/llm/HANDOFF.md` stays operational and points to it


- Repeated HANDOFF ↔ `LLM_START_HERE.md` drift is now enforced structurally instead of relying on session discipline

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-22: release 0.2.0

- npm workspace monorepo bootstrap for `apps/api` and `packages/shared`
- Phase 1 CLI spike for Plaud bearer-token validation, recordings listing, detail lookup, and audio download
- Shared Zod schemas for Plaud responses and the Phase 1 probe report
- Unit tests for Plaud response parsing and regional API retry handling


- Version sync now covers tracked package manifests in addition to docs and `VERSION`
- README and runbooks now document the Phase 1 spike workflow and runtime shape


- The repository now enforces its own "package manifests must stay aligned with VERSION" rule once runtime code exists

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-22: release 0.2.1

- Tests for Phase 1 spike helpers and CLI argument parsing
- Tests for Plaud client error handling (`401`, non-JSON payloads, missing temp URLs)


- Project docs now state explicitly that every new runtime case must add or update tests in the same session
- The CLI no longer auto-executes when imported by tests


- Runtime coverage now includes the non-happy-path cases already implemented in the Plaud spike

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-22: release 0.3.0

- Fastify admin API and React/Vite web panel for the first usable Plaud Mirror slice
- Encrypted persisted bearer-token storage backed by `PLAUD_MIRROR_MASTER_KEY`
- SQLite-backed runtime state for recordings, sync runs, and webhook delivery attempts
- Docker packaging via `Dockerfile` and `compose.yml`
- Runtime and integration tests covering secrets, store, service, server, built API, and built web output
- `docs/ROADMAP.md` as the canonical phase-boundary document


- Phase 2 is now explicitly the manual usable slice with UI and Docker, while unattended sync and retry resilience move to Phase 3
- The README, architecture, auth, deploy, and handoff docs now describe the live runtime instead of a planned one
- The web workspace is now part of version sync and the build pipeline


- Phase 1 download reporting now measures real written byte count even when Plaud serves chunked responses

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-22: release 0.3.1

- Docker base-image override support for environments that already have a compatible local image cached


- `compose.yml` can now pass custom build/runtime base images into the Docker build
- The fallback Docker build now uses `corepack npm` and no longer installs tooling through `apt`
- Deploy docs now document the `vxcontrol/kali-linux:latest` fallback path for this `dev-vm`


- Docker deployment on this `dev-vm` no longer depends on a successful pull from Docker Hub when the cached local fallback image is available
- The local fallback image no longer fails on flaky Kali mirrors just to obtain `npm`
- The fallback path has been verified locally with `docker compose up --build -d` and a healthy `/api/health` response

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-22: release 0.3.2

- `handoff-start-here-sync` stayed green throughout a Docker hardening pass; the check now runs on every validator invocation


- Dockerfile runtime stage now runs as non-root (`USER 1000:1000`) and `chown -R 1000:1000 /app /var/lib/plaud-mirror` is applied before the `USER` directive, so bind-mounted directories under `./runtime/` no longer end up root-owned on the host
- `compose.yml` now pins `user: "1000:1000"` for explicitness alongside the Dockerfile directive
- HANDOFF "Next Session" and `home-infra` project entry now list acceptable Docker base-image fallbacks (locally cached Node slim/alpine, side-loaded `docker save`/`docker load`, NAS-local registry mirror) and explicitly reject `vxcontrol/kali-linux:latest` as a Node runtime base because it is a pentesting distribution and not appropriate even as an emergency substitute
- `docs/llm/README.md` now documents the full set of mechanically enforced sync rules


- Bind-mount ownership drift on `dev-vm`: after this release, `runtime/data` and `runtime/recordings` are created and owned by UID 1000 rather than root, matching the default host user and unblocking ordinary file operations without `sudo`

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-22: release 0.4.0

- Inline `<audio controls preload="none">` player per row in the library, streaming the locally mirrored file via a new `GET /api/recordings/:id/audio` route with the stored content-type
- Confirmed "Delete local mirror" flow: `DELETE /api/recordings/:id` unlinks the audio file, clears `localPath` and `bytesWritten`, and marks the SQLite row `dismissed=true` with a timestamp; the UI confirm dialog reports the size and warns that Plaud is not touched
- "Show dismissed" toggle in the library header plus a per-row "Restore" action (`POST /api/recordings/:id/restore`) so a dismissed recording can be re-mirrored on the next sync
- `dismissed` and `dismissed_at` columns on the `recordings` table with an additive `ALTER TABLE` migration for pre-0.4.0 databases
- 10 new unit tests across store (dismiss/restore + migration of pre-0.4.0 schema), service (delete removes file + marks dismissed, restore clears flag, rejects unsafe recording ids) and server (audio streaming + delete + restore + `?includeDismissed=true` query param + path-traversal rejection)


- Sync engine now skips recordings whose `dismissed=true`, so dismiss is permanent curation unless the operator explicitly restores
- `GET /api/recordings` hides dismissed rows by default; pass `?includeDismissed=true` to include them
- `countRecordings()` and the hero "Recordings" metric both reflect the non-dismissed count

### Security
- The new audio streaming route validates recording ids against a strict `[A-Za-z0-9_.-]+` allowlist and confirms the resolved file path stays within the configured recordings directory before serving, so it is not a path-traversal vector

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-23: release 0.4.1

- `docs/ROADMAP.md` now explicitly extends Phase 2 through both `0.3.x` and `0.4.x` (to cover the curation increment added in `0.4.0`) and every later phase shifts by one minor version; `0.5.x` is now Phase 3, `0.6.x` Phase 4, and so on. SemVer stays authoritative over phase labels.
- `README.md` no longer recommends `vxcontrol/kali-linux:latest` as a Docker fallback. The acceptable substitutes are documented as locally cached Node slim/alpine images, side-loaded `node:20-bookworm-slim` via `docker save`/`docker load`, or a pull-through registry mirror on the operator's infra.
- `docs/llm/HANDOFF.md` replaced its "Roadmap and Drift Status" block (which asserted a clean working tree that aged badly) with a shorter "Roadmap Boundary" block that points the reader at `git status` and the validator for current facts.
- `docs/PROJECT_CONTEXT.md` and `docs/ARCHITECTURE.md` refreshed their prose from `v0.3.0` narrative to the current `v0.4.1` state with local curation noted.
- CHANGELOG `0.3.2` and `0.4.0` sections were backfilled with real user-visible narratives — they were header-only at those releases.


- The hero "Recordings" metric in `apps/web/src/App.tsx` now reads `health?.recordingsCount` from the backend (which excludes dismissed rows) with `recordings.length` as a fallback, instead of always counting the paginated visible array. Previously it undercounted when pagination was involved or when the "Show dismissed" toggle was off.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-23: release 0.4.2

- HTTP Range support on `GET /api/recordings/:id/audio`: responses now advertise `Accept-Ranges: bytes`, include `Content-Length`, and honor `Range: bytes=start-end` (including suffix form `bytes=-N` and open-ended `bytes=start-`). Ranges that overlap the file end are clamped; unsatisfiable ranges return `416` with `Content-Range: bytes */size`. Multipart byteranges are intentionally unsupported (an `<audio>` element never asks for them). Two new tests cover the four RFC 7233 single-range shapes and a happy-path 206 / full 200 pair.
- `formatDuration(totalSeconds)` helper in the web panel that renders short clips as `42s`, medium as `3:06`, and long as `1:02:15`. The "days" bucket is intentionally not implemented until a real recording needs it.


- Audio player scrubbing in the library. Previously the `<audio>` element could not reliably seek mid-playback because the stream had no `Content-Length` and the server did not respond to `Range` requests, so clicking the progress bar would restart from zero or land at the wrong position. With Range support the browser can now jump to any byte range and the UI position matches actual playback.
- Duration display is now human-readable (e.g. `3:06` instead of `186.0s`).

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-23: release 0.4.3

- The "Delete local mirror" and "Restore" buttons in the web panel returned HTTP 400 from Fastify because `requestJson` in `apps/web/src/App.tsx` always sent `Content-Type: application/json` — even on DELETE / POST calls with no body. Fastify's default body parser then rejected the request with "Body cannot be empty when content-type is set to 'application/json'". The helper now only attaches the JSON content-type header when the call actually has a body, so `DELETE /api/recordings/:id` and `POST /api/recordings/:id/restore` work from the UI. The route from `curl` or direct `fetch()` calls without the header had always worked; the bug was only visible from the product panel.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-23: release 0.4.4

- `POST /api/recordings/:id/restore` no longer just clears the `dismissed` flag and waits for the next sync. It now also **re-downloads the audio immediately** so the operator sees the recording playable in the library on the same click. If the immediate download fails (e.g. missing or invalid Plaud token), the dismissed flag is still cleared — intent is respected — and the API surfaces the error so the operator can recover the token and let the scheduler pick it up later.
- UI copy updated to match: the Restore button now reads "Restore (re-download now)" and the success banner says "Restored and re-downloaded «title»." instead of referring to a future sync.


- The library used to leave a restored recording in a confusing half-state: no audio player, a disabled Delete button, and no clear indication of what to do next. With the immediate re-download, a Restore click either produces a fully playable row (happy path) or a visible error (auth / network) — no more silent "pending" state.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-23: release 0.4.5

- "Working…" info banner shown while any sync / backfill / restore / token operation is in flight, so the operator sees that something is happening instead of just a disabled button.
- Hero "Recordings" metric now renders as `local / remoteTotal` when a sync has run (remoteTotal comes from the last sync's `examined` count), so the operator can tell at a glance how many recordings exist in Plaud vs how many are mirrored locally.
- "Manual sync" card now surfaces `Last run`, `Remote total (at last sync)`, and `Mirrored locally` inline, plus a reminder sentence about the conservative default limit.


- **Default sync limit in the web panel is now `1` instead of `100`.** A careless click no longer bulk-downloads 100 recordings; the operator raises the number deliberately before running a larger sync.
- The "Run sync now" button label flips to `Running…` while the request is in flight.


- Disabled buttons no longer show a wait cursor when they are disabled because of state (e.g. "Delete local mirror" on a row with no `localPath`). The wait cursor is now reserved for the window in which a global operation is running, via a `.working` class on the shell; outside of that window disabled buttons show the standard `not-allowed` cursor.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-23: release 0.4.6

- Each row in the library is prefixed with a `#N` index badge so the operator can keep visual track of position while scrolling the list.
- Sync run summaries now carry Plaud's real `data_file_total` (called `plaudTotal` in the schema and DB). `client.listAllRecordings` returns `{ recordings, totalAvailable }` and the service records the total in the SyncRunSummary. SQLite gains a nullable `plaud_total` column via additive migration.


- The hero "Recordings" metric now reads from `lastSync.plaudTotal` instead of `lastSync.examined`. Earlier versions showed the number of recordings the last sync had looked at (which is capped by the caller's `limit` and therefore misleadingly round — if you synced with `limit=100`, the hero showed `X / 100` regardless of the real Plaud total).
- "Manual sync" card now surfaces `Remote total (Plaud)` and a separate `Examined last run (capped by the limit you chose)` line so the operator can tell the two numbers apart.


- Misleading `X / 100` hero metric after a sync with `limit=100`: the UI now shows the real Plaud total, not the limit-capped `examined` count.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-23: release 0.4.7

- `client.listEverything(pageSize)` paginates the full Plaud listing until a page arrives shorter than `pageSize`, returning every recording plus the authoritative total. This is the only reliable way to learn the account's true size — Plaud's `data_file_total` field just mirrors the current page's length, it is not the grand total.
- `/api/health` now includes `dismissedCount` alongside `recordingsCount` so the panel can compute a "Missing" figure without a second round-trip.
- Manual-sync card now shows `Plaud total`, `Mirrored locally`, `Dismissed`, and `Missing` (`plaudTotal − mirrored − dismissed`) inline.
- Two new unit tests: `listEverything` pagination boundary + Mode B candidate selection (skip already-mirrored-success + skip dismissed).


- **Sync and backfill now use "Mode B" semantics.** Instead of "look at the latest N Plaud recordings and skip those already local" (which silently did nothing when your N newest were all mirrored), the service now fetches every Plaud listing, filters out dismissed and already-mirrored-success recordings, and downloads up to N of the remaining missing ones (newest first). If you ask `limit=5` and the 5 newest are all mirrored, it walks deeper into the past until it finds 5 missing recordings — or stops when Plaud is exhausted. Matches the operator's mental model of "download N that I don't have".
- Library recordings are now ordered by `created_at DESC` (real Plaud recording date) instead of the old `mirrored_at DESC` (when we downloaded them). Previously, everything mirrored in one batch landed at the same `mirrored_at` and the tie-break was by id, producing apparent randomness.
- Backfill card copy clarifies the new semantics: "Same behavior as Manual sync (download up to N missing, newest first), but only from recordings that match the filters below."


- Hero "Recordings" metric no longer shows misleading round numbers like `100 / 1`. After any sync run, `plaudTotal` reflects Plaud's actual account size from pagination, not the capped `examined` count from the page size we requested.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-23: release 0.4.8

- Library now has classic pagination: Prev / Next buttons, "Showing X–Y of Z (page A of B)" status, and a per-page selector (25/50/100/200 default 50). Backend gains `?skip=N` on `GET /api/recordings`, response now carries `{ recordings, total, skip, limit }`. Toggling "Show dismissed" or changing page size resets to page 0 to avoid landing on an empty page.
- Each library row's `#N` badge is now a **stable sequence number** based on the recording's position in the operator's full Plaud timeline (sorted oldest-first). `#1` is the oldest recording on the device; `#N` is the newest. Numbers do not shift when new recordings arrive — a brand-new recording becomes `#N+1`. Stored as `sequence_number` on the `recordings` table (additive migration, nullable) and updated in bulk after every sync from `client.listEverything`'s authoritative ordering.


- The hero metric no longer renders a misleading "100 / 1" — once the v0.4.8 sync runs, all 100 of the operator's mirrored recordings get their stable rank from Plaud's full timeline (e.g. ranks 209..308 for the 100 newest of an account with 308 total), and the `Plaud total` reflects the real account size from `listEverything`.


- The `#N` badge no longer reshuffles when a new recording arrives. Previously it was the visual position in the current page, so a new recording at the top would push every existing `#1`, `#2`, ... down by one. Now ranks are anchored to creation date and are stable.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-23: release 0.4.9

- "Run sync now" with `limit=N` was reporting `matched=N, downloaded=0` and not actually pulling anything when the operator had no webhook configured. The Mode B candidate filter only skipped already-mirrored rows whose `lastWebhookStatus === "success"`. Without a webhook configured every row's status is `"skipped"`, so rows already on disk slipped past the filter, became candidates, and `processRecording` then short-circuited without re-downloading. The candidate filter now skips any row with a non-null `localPath` regardless of webhook status — webhook delivery is unrelated to "is this audio missing locally?". Setting `forceDownload=true` still overrides this. Test in `service.test.ts` updated to seed a row with `lastWebhookStatus: "skipped"` (matching the no-webhook reality) and assert it is skipped from candidates.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-24: release 0.4.10

- Async sync architecture (Option C). `POST /api/sync/run` and `POST /api/backfill/run` now return `202 Accepted` with `{ id, status: "running" }` immediately and schedule the download work in the background via a pluggable scheduler (`defaultScheduler` uses `setImmediate`). New `GET /api/sync/runs/:id` returns the live `SyncRunSummary` for polling. Sync progress (`examined`, `matched`, `downloaded`, `plaudTotal`) is persisted incrementally through `store.updateSyncRunProgress` so the panel sees the numbers climb mid-run instead of waiting for the final result.
- Web panel polls `/api/health` every 2 s while a run is active and shows a dynamic banner ("Sync running: downloaded X of Y candidates so far (examined N / M in Plaud)") instead of the old static "Working…" text. When the run finishes it surfaces a per-mode banner and stops polling.
- "Refresh server stats" button in the Manual sync card. It posts a `limit=0` sync, which walks the full Plaud listing, updates `plaudTotal` + stable ranks, and downloads nothing. This is the non-destructive way to reconcile the hero metric and `#N` badges after external changes without touching the wire.
- `ServiceHealthSchema` gained `activeRun: SyncRunSummary | null` alongside the existing `lastSync`. `lastSync` now holds the last COMPLETED run (used for "Last run" stats, "Plaud total", and the hero metric); `activeRun` holds the in-flight run (used for the progress banner and to decide when to stop polling). This prevents stats from flickering to zeroes while a new sync is in flight — previously the panel showed "running, matched 0, downloaded 0" and "Plaud total: unknown until first sync" as soon as sync started, because `getLastSyncRun` returned the in-progress row.
- Four new tests covering the separation: `store.test.ts` `getLastSyncRun` vs `getActiveSyncRun`, `service.test.ts` limit=0 + `getHealth` payload split, `server.test.ts` 202/polling round-trip.


- `SyncFiltersSchema.limit` now accepts `0` (previously required positive). `limit=0` is the refresh-only path: paginate, update ranks and `plaudTotal`, do not download.
- `SyncRunStatusSchema` gained `"running"`; `SyncRunSummarySchema.finishedAt` is now nullable so the status endpoint can surface a run that has not finished yet.
- `runSync` / `runBackfill` return type changed from `Promise<SyncRunSummary>` to `Promise<StartSyncRunResponse>`; callers poll `GET /api/sync/runs/:id` (or `/api/health.lastSync`) for the final summary.
- `store.getLastSyncRun()` now filters `WHERE finished_at IS NOT NULL` and orders by `finished_at DESC`, so only completed runs surface; new `store.getActiveSyncRun()` returns the running row if any.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-24: release 0.4.11

- Device catalog. The Plaud `/device/list` endpoint is now consumed by `client.listDevices()`, translated from wire shape (`sn`, `version_number`) to the domain `Device` type (`serialNumber`, `displayName`, `model`, `firmwareVersion`, `lastSeenAt`), persisted in a new `devices` SQLite table (additive migration), and exposed read-only through `GET /api/devices`. Populated as a side effect of every sync: a failure on the device endpoint is caught and logged without failing the sync itself (`refreshDevices` is best-effort, the run still completes).
- Web panel replaces the "Serial number" text input in the backfill form with a real device selector (`<select>`) populated from `/api/devices`. Labels render as `displayName — model (#abc123)` with fallbacks for devices that never got a nickname, and the dropdown surfaces a hint when no devices have been seen yet so the operator knows a sync will populate it.
- Shared schemas: `PlaudRawDeviceSchema` / `PlaudDeviceListResponseSchema` (wire) and `DeviceSchema` / `DeviceListResponseSchema` (domain) in `packages/shared`. Wire types stay in `plaud.ts`, domain types in `runtime.ts`, and only the Plaud client knows the wire fields — the store, service, server, and UI only see the domain shape.
- Store: `upsertDevice`, `upsertDevices` (single transaction for bulk writes), `listDevices`, `getDevice`. `listDevices` orders by `last_seen_at DESC, serial_number ASC` so the currently-connected device surfaces first but retired devices still appear (useful for historical recordings).
- Seven new tests: two on the client (wire→domain translation; empty-serial guard), two on the store (upsert-rewrites + retired-device retention; empty-array no-op), two on the service (refresh populates catalog; `/device/list` failure does not fail the sync), one end-to-end on the server (`GET /api/devices` returns the refreshed catalog after a `limit=0` sync).


- `DEFAULT_BACKFILL_DRAFT.serialNumber` semantics unchanged, but the input it maps to is no longer free-form — it is bound to the `<select>` value, so `""` means "any device" and any other value comes from the device catalog. This avoids typos (previously, a mistyped serial silently returned zero backfill matches).

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-24: release 0.4.12

- Backfill preview. New `GET /api/backfill/candidates?from&to&serialNumber&scene&previewLimit` runs the same filter pipeline as a real backfill (`client.listEverything` + `applyLocalFilters`) and returns the matching recordings annotated with their current local state (`"missing"`, `"mirrored"`, `"dismissed"`) WITHOUT downloading anything. Response shape: `{ plaudTotal, matched, missing, previewLimit, recordings: BackfillCandidate[] }`.
- Web panel renders a preview table inside the Historical backfill card, fed by the new endpoint, debounced 500 ms on filter changes. Columns: `#N`, Title, Date, Duration, Device, State (with colored badges). Header shows "X match — Y would be downloaded (of Z total in Plaud)". Truncates to 200 rows with a "Showing first 200 of M" footer when the filter matches more.
- Shared schemas: `BackfillCandidateStateSchema`, `BackfillCandidateSchema`, `BackfillPreviewFiltersSchema`, `BackfillPreviewResponseSchema`.
- Two new tests: service `previewBackfillCandidates` annotates state and respects filters + `previewLimit` cap; server `GET /api/backfill/candidates` returns the right shape and narrows by `serialNumber`.


- Scene filter removed from the backfill form. The input was opaque (raw integer like `7` with no in-app mapping to meaning) and operators could not know what to enter. The backend schema still accepts `scene` for programmatic callers (optional, nullable) — only the UI widget is gone. If scene filtering proves useful later, it will be reintroduced with a real dropdown of values present in the account.
- Historical backfill card is now just "Device" (select) + date range, with the live preview below and "Run filtered backfill" at the bottom. The operator sees exactly what a click would do before clicking.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-24: release 0.4.13

- Controls section layout. Manual sync and Historical backfill were sharing a two-column grid (`.two-up`), but the backfill preview table couldn't fit in half the viewport and overflowed horizontally. Both cards now stack full-width in the new `.stack-sections` container, giving the preview enough room to render without horizontal scroll.
- Device column in the backfill preview now shows the operator's nickname ("Office", "Travel") pulled from the device catalog instead of the raw serial number. Falls back to `PLAUD <model>` when a device has no nickname and to `PLAUD-<tail6>` when the serial isn't in the catalog (retired device, or preview fired before the first sync). New helper `formatDeviceShortName(serialNumber, catalog)` on the web side; `BackfillPreview` now receives `devices` as a prop.
- Preview table uses `<colgroup>` with fixed widths (`#`, Date, Duration, Device, State) so Title is the only flex column. Combined with `table-layout: fixed` and per-cell `overflow: hidden; text-overflow: ellipsis`, the table fits inside the card without horizontal scroll. Vertical scroll (`max-height: 360px`) is unchanged.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-24: release 0.4.14

- Tab bar above the card grid with two tabs: **Main** (Manual sync + Historical backfill + Library) and **Configuration** (Plaud token + Webhook delivery). Active tab persists in `localStorage` (`plaud-mirror:active-tab`) so a refresh keeps the operator where they were. Default is **Main**.
- Historical backfill card is now **collapsible**. Header is clickable (plus Enter/Space keyboard support) and shows a caret. Default state is **collapsed** — expanding the card triggers the `/api/backfill/candidates` preview, so keeping it closed on first load avoids hitting Plaud with a preview query nobody asked for. Expanded/collapsed state persists in `localStorage` (`plaud-mirror:backfill-expanded`).


- Panel information architecture split into setup (Configuration tab) and day-to-day use (Main tab). Previously everything was on one scroll; the Configuration surface is rarely revisited after first setup and was adding vertical noise.
- `BackfillPreview` component is only mounted when the Historical backfill card is expanded. Its `useEffect` (debounced fetch on filter change) therefore does not fire while the card is collapsed — no wasted Plaud call.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-24: release 0.4.15

- `docs/operations/DEPLOY_PLAYBOOK.md` fallback block rewritten. The previous runbook carried a bash block that exported `PLAUD_MIRROR_DOCKER_BUILD_IMAGE="vxcontrol/kali-linux:latest"` as a Docker-Hub-timeout workaround — directly contradicting the policy documented in README and HANDOFF. Replaced with the list of acceptable substitutes (Node slim/alpine locally cached, `docker save`/`docker load`, or a pull-through registry mirror), an example using `node:20-alpine`, and an explicit rejection paragraph for pentesting or general-purpose distro bases.
- `HOW_TO_USE.md` rewritten end to end. The previous body claimed "v0.1.0 is a design-and-governance baseline" and that the repository "does not yet give you the runnable Plaud sync service"; both statements were false at v0.4.14. The new file describes v0.4.15 reality (Docker + local Node run instructions, backfill preview, device catalog, tabs, phase boundary), and references the DOWNSTREAM_FEEDBACK flow for protocol observations.
- `docs/version-sync-manifest.yml` now tracks `HOW_TO_USE.md` (20 targets, up from 19). This closes a real orphan-marker gap — the file previously had a `<!-- doc-version -->` marker but sat outside the manifest, so nothing enforced its freshness.
- `docs/llm/HANDOFF.md` "Verified Runtime State" updated from v0.4.13 to v0.4.15. Current Status no longer carries "Next: rebuild + push" boilerplate now that the rebuild+push actually happened. `LLM_START_HERE.md` Current Focus re-synced.


- Three concrete drifts flagged by a second GPT-5 review on 2026-04-24 are closed in this release rather than merely logged. This is the fix that accompanies DF-001 (DEPLOY_PLAYBOOK), DF-002 (HOW_TO_USE orphan) and DF-003 (HANDOFF stale "Next:") in `~/src/LLM-DocKit/docs/DOWNSTREAM_FEEDBACK.md`; previously those entries described the failure modes without actually repairing the specific instances.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-24: release 0.4.16

- `Dockerfile` drops the `SHELL ["/bin/bash", "-lc"]` directive from both the build and runtime stages. Docker's default `/bin/sh -c` is now used, which is POSIX-portable and works on Alpine (busybox `ash`), Debian/Ubuntu (`dash`), and any sane Linux base. The directive was unnecessary — none of the existing `RUN` commands use bash-specific syntax (no arrays, no `[[`, no process substitution, no `set -o pipefail` inside pipes; just `&&`, `command -v`, `mkdir -p`, `chown`, `corepack npm`).


- Documented Docker fallback `node:20-alpine` was not actually executable at v0.4.15 because the Dockerfile forced `SHELL ["/bin/bash", "-lc"]` and Alpine doesn't ship bash — an operator following `docs/operations/DEPLOY_PLAYBOOK.md` would have hit a build error, contradicting README and HANDOFF claims that alpine is a valid substitute. Removing the SHELL directive closes the contradiction: verified end-to-end locally by building with `--build-arg BUILD_BASE_IMAGE=node:20-alpine --build-arg RUNTIME_BASE_IMAGE=node:20-alpine`, running the resulting container, and confirming `GET /api/health` returns `200` (the verification was performed against the in-progress v0.4.15 working tree before the bump to v0.4.16; the same container path was re-built at v0.4.16 after the bump and container `cat /app/VERSION` returns `0.4.16` on `dev-vm`). Default `node:20-bookworm-slim` build also re-verified green. GPT-5 flagged this on 2026-04-24 as the residual Docker contradiction after the v0.4.15 playbook rewrite.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-24: release 0.4.17

- `packages/shared/src/formatting.ts`: pure formatting helpers shared between the web panel and the API (`formatDuration`, `formatBytes`, `formatRecordingsMetric`, `computeMissing`, `formatDeviceLabel`, `formatDeviceShortName`, `coerceNonNegativeInteger`, `summarizeRun`, `describeBusy`, `buildDownloadFilename`). All deterministic, no side effects, no DOM, no fetch — exercisable by `node --test` alongside the rest of the backend suite.
- `packages/shared/src/formatting.test.ts`: 12 new tests covering every helper, including the duration buckets, byte unit shifts, missing-recordings clamp on stale `plaudTotal`, device label fallbacks, and 11 cases for `buildDownloadFilename` (extension extraction, sanitisation, length cap, fallback to recording id, every extension Plaud ships).
- `apps/api/src/server.ts` `buildContentDisposition()` helper: builds an RFC 5987 `Content-Disposition` header with both ASCII-fallback `filename=` and UTF-8 `filename*=` for non-ASCII titles. Tested with quotation/backslash escaping and accented characters.
- `apps/api/src/server.test.ts`: extended audio-route test asserts the new `Content-Disposition: inline; filename="..."; filename*=UTF-8''...` header is emitted; new unit test for `buildContentDisposition` covers ASCII fallback, UTF-8 encoding, and quote/backslash escaping.


- `apps/web/src/App.tsx` no longer carries local copies of `formatDuration`, `formatBytes`, `formatRecordingsMetric`, `computeMissing`, `formatDeviceLabel`, `formatDeviceShortName`, `coerceNonNegativeInteger`, `summarizeRun`, `describeBusy`. They now import from `@plaud-mirror/shared`. Behavior is preserved except where the test caught a latent edge case (see Fixed below). `readTab`, `readBackfillExpanded`, and `toErrorMessage` stay local because they touch `localStorage` / `Error` instanceof checks that are web-runtime-specific.
- `apps/api/src/runtime/service.ts` `getRecordingAudio()` return shape now includes `filename: string`, derived from `buildDownloadFilename(title, localPath, id)`. Server route uses it.
- `HOW_TO_USE.md` body referenced `v0.4.15` and `53/53 tests at v0.4.15` — both stale at v0.4.16. Now reflects the current `v0.4.17` reality and `66/66 tests` (12 new helper tests + 1 new server-header test added on top of the 53). Same prose-drift class GPT-5 caught for the third time; tracked in DOWNSTREAM_FEEDBACK as DF-006.
- CHANGELOG `[0.4.16]` Fixed paragraph clarified: the verification phrase "`GET /api/health` returns `200` with `version: "0.4.15"`" was technically correct (verification ran against the in-progress working tree BEFORE the bump) but read as an inconsistency for a reader of the v0.4.16 entry. The clarified text now spells out the timeline.


- Browser native `<audio>` "More options → Download" menu now saves a sensible filename. Previously the download landed as a file literally named `audio` with no extension, because our `/api/recordings/:id/audio` endpoint emitted no `Content-Disposition` and the browser fell back to the URL's last segment. Now the response carries `Content-Disposition: inline; filename="<safe-title>.<ext>"; filename*=UTF-8''<encoded>` with extension derived from the on-disk `localPath` (mp3, ogg, m4a, wav). Title sanitisation: replace anything outside `[A-Za-z0-9_.-]` with `_`, collapse repeats, trim edges, cap at 80 chars; empty/whitespace title falls back to the recording id. Reported by the operator on 2026-04-24.
- `coerceNonNegativeInteger("", fallback)` returned `0` because `Number("")` is `0` (a JS quirk), so clearing the sync-limit input silently downgraded the next run to refresh-only. Now returns the fallback when the input is empty or whitespace-only. Operator can still type `0` explicitly when they want a refresh-only run; clearing the field reverts to `defaultSyncLimit`. Caught by the new helper test.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-25: release 0.4.18

- **`v0.4.17` was unbuildable from a fresh clone.** This release ships the two source files that should have been part of `v0.4.17` but were never staged: `packages/shared/src/formatting.ts` and `packages/shared/src/formatting.test.ts`. Root cause: the `v0.4.17` commit was prepared with `git add -u`, which stages MODIFIED tracked files only — not new untracked files. The two newly-created files stayed `??` in `git status` and were silently omitted. The local workspace passed 66/66 tests and the container at the time reported `version: "0.4.17"` because `tsc` + `COPY . .` both read from the filesystem, not from git. The published commit (`d1bc317` on `origin/main`) referenced the missing module from `package.json:19` (test runner path), `packages/shared/src/index.ts:1` (`export * from "./formatting.js"`), `apps/web/src/App.tsx` (helper imports), and `apps/api/src/runtime/service.ts` (`buildDownloadFilename` import) — so a fresh clone of `v0.4.17` would have failed `npm install && npm run build && npm test` at the import-resolution step. GPT-5 caught it on 2026-04-25; before that, the only signals were `git status` post-commit (untouched) and the commit's own stat line (`128 insertions, 183 deletions` for a release whose narrative claimed ~500 added lines of helpers + tests — net negative is incompatible with that claim). Force-push to amend `v0.4.17` was considered and rejected (project rule against destructive history rewrites on `main`). This release is the forward-fix: `v0.4.17` stays in history as a known-broken tag, `v0.4.18` is the first commit on `origin/main` that is actually buildable from clean.


- The actual code shipped here — `formatting.ts` (10 helpers) and `formatting.test.ts` (12 tests covering them) — is identical to what the `v0.4.17` CHANGELOG entry described. No new features land in this release; it is purely the missing files plus the version bump plus this entry. The narrative in the `v0.4.17` CHANGELOG remains accurate as a description of what `v0.4.17` *intended to ship*, but only `v0.4.18` actually ships it on `origin/main`.
- Companion DocKit work (queued, separate repo): `DF-027` in `~/src/LLM-DocKit/docs/DOWNSTREAM_FEEDBACK.md` to formalise the failure mode ("LLM uses `git add -u` and silently skips new files"), and a stretch pre-commit hook check that grep-verifies imports in the staged tree resolve to staged files — would catch this exact pattern mechanically.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-25: release 0.4.19

- Web-side test framework: Vitest + jsdom + @testing-library/react + @testing-library/jest-dom installed in `apps/web`. Decision recorded as **D-015** in `docs/llm/DECISIONS.md` (Vitest reuses Vite's pipeline, jsdom is the de facto reference DOM-in-Node, @testing-library/react is the React-team-recommended assertion vocabulary, the alternatives — Jest, happy-dom, Enzyme, hand-rolled rendering — were considered and explicitly rejected with rationale). New `apps/web/vitest.config.ts` + `apps/web/src/test-setup.ts` + `apps/web/package.json#scripts.test`. The root `npm test` chains a new `npm run test:web` step after the backend suite.
- New module `apps/web/src/storage.ts` exporting `readTab`, `readBackfillExpanded`, and a `STORAGE_KEYS` constant. The two helpers were previously local to `App.tsx`; extracting them lets the test file exercise localStorage roundtrips without mounting React. `STORAGE_KEYS.ACTIVE_TAB` / `STORAGE_KEYS.BACKFILL_EXPANDED` deduplicate the literal key names that production code and tests would otherwise both repeat.
- New component `apps/web/src/components/StateBadge.tsx` extracted from `App.tsx`. Same render behaviour, now testable in isolation (the prop type is now imported from `@plaud-mirror/shared` as `BackfillCandidateState`).
- Two new test files: `apps/web/src/storage.test.ts` (8 tests covering default / "config" / "main" / corrupt-value branches for both helpers + a STORAGE_KEYS sanity assertion) and `apps/web/src/components/StateBadge.test.tsx` (3 tests covering all three state values, the "mirrored → already local" label remap, and class-name correctness). Total: 11 web-side tests.
- Four new decisions in `docs/llm/DECISIONS.md`:
  - **D-012** — Continuous sync scheduler runs in-process with anti-overlap protection. Locks the contract before scheduler code lands in v0.5.x.
  - **D-013** — Webhook outbox is a separate SQLite table with explicit state transitions (`pending` / `delivering` / `delivered` / `retry_waiting` / `permanently_failed`) and exponential-backoff retry policy.
  - **D-014** — Health endpoint surfaces operational state (scheduler status, outbox backlog, last errors), not just configuration state.
  - **D-015** — Web UI tests use Vitest + jsdom + @testing-library/react.
- New "Beyond Phase 6: Multi-tenant variant (out of scope for this repo)" section in `docs/ROADMAP.md` (committed earlier today) capturing the three viable paths (instance-per-tenant deployment, in-place refactor, new sibling project) for the operator's future multi-tenant interest, with explicit reference to D-009 as the current scope-limiting decision. D-009 gained a matching Implications bullet pointing back at the ROADMAP section.


- `apps/web/src/App.tsx` no longer carries local copies of `readTab`, `readBackfillExpanded`, or `<StateBadge>`. Imports them from the new modules. Inline localStorage `setItem` calls now reference `STORAGE_KEYS.ACTIVE_TAB` and `STORAGE_KEYS.BACKFILL_EXPANDED` to keep production and test code in sync on the literal key names.


- This release is the **Phase 3 prerequisite**, not Phase 3 itself. The roadmap's Phase 3 scope (continuous sync scheduler, webhook outbox, stronger health surfaces) lands in `v0.5.x` next; this release sets up the testing foundation and freezes the design contracts (D-012/013/014) before code is written. Test count: 53 (pre-helper-extract baseline at v0.4.16) → 66 (after D-015's first half + helper-level coverage) → 77 (after this release's web-side component-level coverage).
- DF-026 in `~/src/LLM-DocKit/docs/DOWNSTREAM_FEEDBACK.md` (UI tests gap) is now `partially implemented (plaud-mirror v0.4.19)` on the helper+component-level axis. Component tests for `<App>`-level interaction (tabs, collapse, BackfillPreview lifecycle) remain a future patch — they need either App-decomposition or a fetch-mocking pattern that is non-trivial to set up. The current batch deliberately targets small extractable pieces first.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-25: release 0.5.0

- **Phase 3 begins.** In-process continuous sync scheduler — opt-in via `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` (`0` or unset → disabled, Phase 2 manual-only behavior preserved; positive values enforce a 60 000 ms floor; default when set to a non-numeric/empty string is 15 minutes). Implementation: `apps/api/src/runtime/scheduler.ts` (217 lines). The scheduler is a single `setTimeout` loop with two layers of anti-overlap protection — an `inflight` flag at the scheduler level (records `lastTickStatus = "skipped"` when a tick fires while the previous one has not resolved) plus the existing `service.runSync` serialization via `getActiveSyncRun` (rejects mid-flight, returns the existing run id). Cadence is from-fire, not from-completion: the next tick is scheduled before the current tick is awaited, so a slow run does not push subsequent ticks back. Wired into `createApp` in `apps/api/src/server.ts`; Fastify's `onClose` hook stops the scheduler so SIGTERM cleanly cancels the pending timer. Locks the contract from **D-012** (`docs/llm/DECISIONS.md`).
- Health observability surface — partial **D-014** (scheduler subset). `GET /api/health` now includes a `scheduler` block (`enabled`, `intervalMs`, `nextTickAt`, `lastTickAt`, `lastTickStatus` ∈ `"completed"` / `"failed"` / `"skipped"` / `null`, `lastTickError`). When the scheduler is enabled, `health.phase` flips to `"Phase 3 - unattended operation"`; otherwise it stays `"Phase 2 - manual sync"`. Older clients reading the response when the scheduler is off see the disabled-shape default thanks to Zod's `.default(...)` on `ServiceHealthSchema.scheduler`. Webhook outbox backlog and `lastErrors` ring buffer arrive in `v0.5.1` / `v0.5.2`.
- New shared schema + type: `SchedulerStatusSchema` and `SchedulerStatus` in `packages/shared/src/runtime.ts`. Strict Zod object enforcing the wire shape; reused by `getHealth()` and the panel's TypeScript imports.
- New environment variable parsed in `apps/api/src/runtime/environment.ts` via a new `parseSchedulerInterval()` helper. Validates the 60 000 ms floor, normalizes `0` and unset to disabled, and falls back to a 900 000 ms default when given malformed input. Exposed as `ServerEnvironment.schedulerIntervalMs`.
- New service hook `setSchedulerStatusProvider(provider)` on `PlaudMirrorService` so the runtime can register a live scheduler-status function without coupling the service to the scheduler module. `getHealth()` calls it (or returns the disabled default) when assembling the response.
- New test file `apps/api/src/runtime/scheduler.test.ts` (7 tests, ~264 lines): `fireOnce` with completed and failed cases (error message captured), anti-overlap skip semantics, `start`/`stop` with a deterministic injected timer harness, `start` idempotency (a second `start()` does not double the cadence), constructor input validation (rejects non-positive `intervalMs`), and `status()` reflecting the last result with `nextTickAt` cleared on stop.


- `apps/api/src/runtime/service.ts` `getHealth()` now reports the scheduler status and dynamically selects the `phase` string. `apps/api/src/server.ts` instantiates the `Scheduler` and registers the status provider when `environment.schedulerIntervalMs > 0`. Test environments in `apps/api/src/runtime/service.test.ts` and `apps/api/src/server.test.ts` now include `schedulerIntervalMs: 0` to keep the existing manual-only test surface intact.
- `packages/shared/src/formatting.test.ts` `withPlaudTotal` fixture now includes the new `scheduler` field on its `ServiceHealth` literal so the strict shape continues to compile.
- `package.json#scripts.test` chains the new `apps/api/dist/runtime/scheduler.test.js` into the Node `--test` invocation. Total backend tests: 73 (up from 66 in `v0.4.19`); web-side tests: 11 (unchanged); grand total: **84**.


- This release is the **first Phase 3 release**. The roadmap's "Current phase" pointer flips from Phase 2 to Phase 3, and the version table now reads `0.5.x` → Phase 3 in progress. The remaining Phase 3 increments — durable webhook outbox (`v0.5.1`, locks **D-013**) and full health observability (`v0.5.2`, completes **D-014**) — are queued; the scheduler shipped here is enough to validate "does the service run unattended?" with the existing immediate-webhook path.
- Default behavior is unchanged: containers without `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` set get the disabled scheduler and behave exactly like `v0.4.19`. Operators who want continuous sync set the env var (recommended starting point: 900000 = 15 minutes) and the panel's health card will start showing `nextTickAt` / `lastTickAt`.
- DF-026 in `~/src/LLM-DocKit/docs/DOWNSTREAM_FEEDBACK.md` (UI tests gap) status is unchanged: still `partially implemented` — the new tests in this release are backend-only.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-25: release 0.5.1

- **`v0.5.0` shipped the scheduler default-on without an opt-in.** `parseSchedulerInterval` was called with a 15-minute fallback in `apps/api/src/runtime/environment.ts`, so any operator who upgraded from `0.4.x` to `0.5.0` without setting `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` got automatic sync ticks every 15 minutes silently. Both the SemVer minor-bump contract ("no behavior change without opt-in") and every doc in the `0.5.0` release (CHANGELOG, HOW_TO_USE, AUTH_AND_SYNC, ARCHITECTURE, HANDOFF, HISTORY) explicitly promised "0/unset = disabled, Phase 2 manual-only behavior preserved" — the code did the opposite. Verified live: the post-`0.5.0` rebuild on `dev-vm` reported `scheduler.enabled: true, intervalMs: 900000` even though `.env`, `compose.yml`, and the container's environment had no such variable. The fallback in `environment.ts:46` is now `0` (disabled) and the recommended starting value (15 min) lives in `HOW_TO_USE.md` and `AUTH_AND_SYNC.md`, never in code. Six new regression tests in `apps/api/src/runtime/environment.test.ts` cover the full env-var matrix.
- **`v0.5.0` documented service-layer anti-overlap that did not exist in code.** CHANGELOG `[0.5.0]`, `AUTH_AND_SYNC.md`, `ARCHITECTURE.md`, and `HISTORY.md` all stated *"`service.runSync` serializes via `getActiveSyncRun` (rejects mid-flight, returns the existing run id)"*. `apps/api/src/runtime/service.ts:520` `startMirror` simply called `this.store.startSyncRun(...)` directly with no `getActiveSyncRun` consultation. A manual sync and a scheduled tick that fired concurrently both inserted into `sync_runs` and both dispatched `executeMirror`, racing on the recordings UPSERT path and leaving two `running` rows the panel poll could not interpret. The only real protection in `0.5.0` was the scheduler's own `inflight` flag, which only stops two ticks of the same scheduler from overlapping — not manual+scheduled. New private helper `startOrReuseMirror` now consults `getActiveSyncRun` before allocating a new row; when a run is active, it returns the existing run's id with `started: false`. `runSync` / `runBackfill` map this to the public `{ id, status: "running" }` shape (REST callers can't tell the difference because their contract is "poll until done"). New `runScheduledSync` returns `{ id, started: boolean }` for the scheduler tick. One new regression test in `apps/api/src/runtime/service.test.ts` proves concurrent calls reuse the active run id and dispatch only one `executeMirror`, plus dispatch a fresh run only after the active one finishes.
- **Scheduler `lastTickStatus` now reports anti-overlap absorption honestly.** In `0.5.0`, when the (then-missing) service-level reuse would have absorbed a tick, the tick still labelled itself `completed` because `runSync` did not signal "no work happened." `0.5.1` extends `Scheduler.runTick`'s contract to accept a `{ skipped: true, reason?: string }` return value: when present, the scheduler records `lastTickStatus = "skipped"` and `lastTickError = reason` (the field is reused for operator-readable context, not just errors). `server.ts` maps `runScheduledSync()`'s `started: false` to this shape. Two new tests in `apps/api/src/runtime/scheduler.test.ts` cover the new path (skip via runTick result + reason surfaced, void / non-skip-shaped object stays `completed`).


- `v0.5.0` is broken and superseded. **Operators upgrading from `0.4.x` should skip `0.5.0` and go directly to `0.5.1`.** No need to roll back if `0.5.0` was deployed: the only persistent state changes were extra `sync_runs` rows from the missing anti-overlap (each one harmless on its own — Plaud listings are idempotent and recordings UPSERT by id). On reboot with `0.5.1`, the active-run reuse takes over and no further duplicate rows are created.
- This is a **patch** release (0.5.0 → 0.5.1) because the surface contract is unchanged; the pre-existing API shape (`/api/health`, `/api/sync/run` semantics, the `scheduler` block) all stay the same. What changed is the actual behavior matching the documentation.
- Phase 3 sequencing is pushed back one slot to absorb this fix: `v0.5.2` is now the durable webhook outbox (D-013), `v0.5.3` is the full health observability surface (D-014, complete).
- This release continues to be backend-only; web-side test count is unchanged at 11. Backend test count: 73 (`v0.5.0`) → 82 (`v0.5.1`); grand total: **93**.


- `parseSchedulerInterval` fallback in `apps/api/src/runtime/environment.ts` is now `0` instead of `15 * 60 * 1000`. JSDoc on `ServerEnvironment.schedulerIntervalMs` rewritten to reflect the corrected contract.
- `PlaudMirrorService` gains a private `startOrReuseMirror(mode, filters)` helper used by `runSync`, `runBackfill`, and the new `runScheduledSync`. Public REST routes are unchanged in shape.
- `Scheduler.SchedulerOptions.runTick` return type widened from `Promise<unknown>` to `Promise<TickRunResult | void>` to support the external-skip path. New exported interface `TickRunResult { skipped: boolean; reason?: string }`. The `inflight`-flag anti-overlap path is unchanged.
- `apps/api/src/server.ts` scheduler `runTick` now calls `service.runScheduledSync()` (instead of `service.runSync(...)`), inspects `started`, and returns `{ skipped: true, reason }` to the scheduler when an existing run absorbed the tick.
- `package.json#scripts.test` chains the new `apps/api/dist/runtime/environment.test.js` ahead of `service.test.js`.


- `apps/api/src/runtime/environment.test.ts` (6 regression tests for the env-var matrix).
- `apps/api/src/runtime/service.test.ts` regression test for concurrent-run reuse.
- `apps/api/src/runtime/scheduler.test.ts` regression tests for the `runTick → { skipped: true }` path and for non-skip return values staying `completed`.
- New public method `PlaudMirrorService.runScheduledSync()` and new exported scheduler type `TickRunResult` in `apps/api/src/runtime/scheduler.ts`. No HTTP route surface change.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-25: release 0.5.2

- **Panel-driven scheduler configuration.** The continuous sync scheduler is now configured from the Configuration tab of the web UI: a new "Continuous sync scheduler" card shows the live status (`enabled` / `interval` / `next tick` / `last tick` / `last tick reason`) and an "Interval (minutes, 0 disables)" form that posts to `PUT /api/config`. The interval persists in SQLite (the same `settings` key/value table the webhook URL already uses), so changes survive container restarts and the operator never has to touch `.env`. The `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` env var is downgraded to a **bootstrap-only seed** — it pre-populates the SQLite row on a fresh database, then the SQLite-backed value wins on every subsequent boot, ignoring any later env-var changes.
- **Hot reconfigure without restart.** New `SchedulerManager` (`apps/api/src/runtime/scheduler-manager.ts`) wraps the `Scheduler` class and exposes `applyInterval(ms)` with start / stop / swap-cadence semantics. `service.updateConfig` calls back into the manager via a new reconfigure hook, so a panel save takes effect immediately — the existing `Scheduler` is `stop()`ed and a fresh one is started with the new cadence in the same tick. Idempotent for unchanged values (no cadence reset on a no-op save).
- New shared schema field `RuntimeConfig.schedulerIntervalMs` (with `.default(0)` so older clients still parse) and `UpdateRuntimeConfigRequest.schedulerIntervalMs?` (optional, omit to leave unchanged). `GET /api/config` now reports the persisted value; `PUT /api/config` accepts and validates it (must be `0` or `≥ 60_000`) and persists via `RuntimeStore.saveConfig`.
- New `RuntimeStore.seedSchedulerDefaults(ms)` method called on `service.initialize()`. Only writes the env-var value to SQLite when the row is absent — once the operator has touched the panel even once, the env var is irrelevant on subsequent boots.


- `SchedulerManager` replaces the inline `Scheduler` instantiation that lived in `apps/api/src/server.ts`. The runtime now always constructs a manager (regardless of the persisted interval); `manager.applyInterval(0)` is a no-op so a freshly-installed container with no env var and no panel save stays disabled exactly like `v0.5.1`.
- `PlaudMirrorService` gains a `setSchedulerReconfigureHook(hook)` API alongside the existing `setSchedulerStatusProvider` so the runtime can wire bidirectional integration with the manager: read live status into `getHealth`, push interval changes from `updateConfig`.
- `apps/web/src/App.tsx` adds the scheduler card under the existing Webhook card on the Configuration tab. Helpers `formatSchedulerInput` / `parseSchedulerInput` round-trip between the operator-facing minutes and the wire-format milliseconds.


- This is a **minor** release (0.5.1 → 0.5.2) because the panel surface gains a new operator-visible feature. The HTTP contract is additive (a new optional field on `PUT /api/config`, a new field on `GET /api/config` and `RuntimeConfig`); existing callers that ignore the field continue to work.
- For operators who already had `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` set in `.env`: the value seeds SQLite on the first `v0.5.2` boot, after which the panel is the source of truth. You can safely remove the env var; it does nothing once the SQLite row exists.
- Phase 3 sequencing pushed back one slot again to absorb this UX work: `v0.5.3` is now the durable webhook outbox (D-013), `v0.5.4` is the full health observability surface (D-014, complete). This is the third roadmap shift in `0.5.x`; the pattern is finally settling because the scheduler subsystem is now operator-controllable end-to-end.
- Test totals: 93 → 102 (91 backend + 11 web). 9 new tests: 1 in `store.test.ts` (round-trip + seed-only-once semantics), 7 in the new `scheduler-manager.test.ts` (start / stop / reconfigure / idempotency / floor / sub-floor rejection), 1 in `service.test.ts` (validation + persistence + hook dispatch on `updateConfig`).

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-26: release 0.5.3

- **Durable webhook outbox (D-013).** Webhook delivery is now decoupled from sync: each successfully-mirrored recording pushes its `recording.synced` payload into a new SQLite table `webhook_outbox`, and a dedicated `OutboxWorker` (5-second cadence, anti-overlap reusing the existing `Scheduler`) walks the queue, retries with exponential backoff, and either delivers (`→ delivered`) or escalates to `permanently_failed` after 8 attempts. Backoff schedule: 30 s, 2 m, 10 m, 30 m, 1 h, 2 h, 4 h, 8 h — cumulative ~16 hours, sized to ride out an overnight downstream outage on a home-infra box. The HMAC signature is recomputed at delivery time (not at enqueue), so rotating `webhookSecret` mid-flight is honoured for items still in the queue.
- **`webhook_outbox` SQLite table** with FSM `pending → delivering → delivered | retry_waiting → permanently_failed`. Atomic claim via `UPDATE ... WHERE id = ? AND state = ?` so a worker tick and a panel-triggered retry cannot pick the same row twice. Index on `(state, next_attempt_at)` for cheap polling. `webhook_deliveries` (the existing append-only audit log) keeps every individual attempt record.
- **New routes**:
  - `GET /api/outbox` returns `{ items: OutboxItem[] }`, **only `permanently_failed` rows**. The pending and retry-waiting backlog is visible only as counters (see below) so the panel does not become a queue browser.
  - `POST /api/outbox/:id/retry` resets a `permanently_failed` row to `pending` (clears `attempts` and `last_error`); 409 when the item is in any other state, 404 when unknown, 400 when the id shape is unsafe.
- **`/api/health.outbox` block** with `pending`, `retryWaiting`, `permanentlyFailed`, and `oldestPendingAgeMs` (ms age of the oldest queued or retrying row, null when both states are empty). Visible in every health response from now on.
- **`SyncRunSummary.enqueued`** new counter — number of webhook payloads pushed to the outbox during a run. Coexists with `delivered`, which keeps its original semantic ("delivered synchronously inside this run") and now stays at 0 for runs executed by the outbox-aware service.
- **New "Webhook outbox" card on the Configuration tab** of the panel: live counters from `health.outbox`, oldest-pending age, list of `permanently_failed` rows with a Retry button per row. StatusPill colour: green when empty, amber when there is anything pending or retrying, red when there is at least one permanently-failed item.
- New shared schema types: `OutboxState`, `OutboxItem`, `OutboxHealth`, `OutboxListResponse`, `OutboxRetryResponse`. New `RuntimeStore` methods: `enqueueOutboxItem`, `claimOutboxItem`, `markOutboxDelivered`, `markOutboxRetry`, `markOutboxPermanentlyFailed`, `forceOutboxRetry`, `getOutboxHealth`, `listFailedOutboxItems`, `getOutboxPayload`, `getOutboxItem`, plus `seedSchedulerDefaults`-style additive migration on `sync_runs.enqueued`. New module `apps/api/src/runtime/outbox-worker.ts`. New module `apps/api/src/runtime/webhook-signature.ts` extracting `buildWebhookSignature` so the worker and the legacy code path can share the HMAC code without duplication.


- **Webhook delivery is no longer synchronous.** `service.processRecording` calls a new private `enqueueOrSkipWebhook(recording, mode)` that pushes a payload into the outbox and writes `lastWebhookStatus = "queued"` on the recording row. The legacy synchronous `deliverWebhook` method is removed. Every operator-visible HTTP POST to the configured webhook URL now comes from the outbox worker, not from `executeMirror`.
- **`RecordingMirror.lastWebhookStatus` enum extended** with `"queued"` (the new normal state right after a sync) alongside the legacy `"skipped"` / `"success"` / `"failed"` values. Older rows in long-lived databases keep their original value; new rows finalised by v0.5.3 carry `"queued"` (or `"skipped"` when the webhook is not configured).
- `apps/api/src/server.ts` constructs an `OutboxWorker` unconditionally during boot and registers an `onClose` hook to stop it, alongside the existing scheduler manager.
- `apps/web/src/App.tsx` wires `failedOutboxItems` state, `handleRetryOutboxItem` handler, and the new card. The existing manual-sync metrics block is unchanged in this release; a follow-up will surface `enqueued` next to `delivered`.
- `package.json#scripts.test` chains the new `apps/api/dist/runtime/outbox-worker.test.js` alongside the existing scheduler / manager / environment tests.


- This is a **patch** release (0.5.2 → 0.5.3) because the HTTP contract additions are strictly additive (new fields default-fill in older clients via Zod's `.default(...)` and `.default(0)`; new routes do not affect existing ones). Operator-visible behaviour does change — webhook delivery is now async — but the _shape_ of the payload, the HMAC scheme, and every existing route remain identical, so a downstream that was working with v0.5.2 keeps working without code changes.
- `delivered` in `SyncRunSummary` is now structurally always 0 for new runs. Dashboards that read it as "successful webhook deliveries during this run" will start showing 0 — that is the correct value, because deliveries no longer happen during the run. Use the `enqueued` field for the equivalent v0.5.3+ count, and `health.outbox.pending + retryWaiting` for "what is waiting to be delivered right now."
- For an operator who already had `lastWebhookStatus: "success"` rows in their database from before v0.5.3: those rows are NOT re-enqueued. The outbox is fed by `executeMirror`, not by a backfill scan of historical recordings. If you want the new audit-trail-by-outbox semantics for a recording that pre-dates v0.5.3, force a re-mirror via the existing `forceDownload` path.
- Test totals: 102 → 113 (102 backend + 11 web). 11 new tests: 4 in `store.test.ts` (outbox enqueue/claim/markDelivered + retry transitions + permanently_failed + force-retry rejection from non-failed states), 6 in `outbox-worker.test.ts` (empty-queue skip, success path, transient-failure retry with backoff, monotonic deliveryAttempt across retries, MAX_ATTEMPTS escalation, unconfigured-webhook escalation), 1 server test (HTTP shape: empty list, list, retry success, 409 on non-failed, 404 on unknown, 400 on bad id).


- (No bug fixes in this release — the in-flight `lastWebhookStatus = "queued"` value is a new state, not a fix to an existing bug.)

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-26: release 0.5.4

- **Layer-1 doc-drift enforcement (D-016).** New `scripts/check-prose-drift.sh` (POSIX sh, ~290 lines, zero external deps) catches the prose-drift class that has hit plaud-mirror six times across `v0.4.x → v0.5.3` despite a passive auto-memory rule that was extended four times and never enforced anything. Four rules:
  - `R1-current-state-stale-version` — "Current"-context lines (`Version:`, `Current delivery target:`) that don't match `VERSION`.
  - `R1-future-version-without-planning-phrase` — `vX.Y.Z > current` mentioned without a planning phrase (`next:`, `scheduled for`, `lands in v`, `from v`, etc.).
  - `R3-future-claim-already-shipped` — phrases like "deferred to vX.Y.Z" / "still later in vX.Y.Z" that cite a version `<= current` (i.e., a "future" claim about something already shipped). Adjacency-aware: only flags the version literal immediately following the phrase, not unrelated versions later in the same line.
  - `R4-decision-status-stale` — `D-XXX` entries whose `Status:` says "designed/lands during" while `CHANGELOG.md` mentions them as shipped.
  Three modes: `--strict` (default; exit 1 on drift, used by the validator wrapper), `--review` (JSON output for the future agent-based check, on-ramp to Layer 2), `--update-baseline --note "<reason>" [--transient-until vX.Y.Z]` (deliberate operation that records auditable acceptances). The baseline file `scripts/.prose-drift-baseline.json` carries `{id, literal, file, rule, reason, commit_sha, created_at, transient_until?}` per entry and is enforced (when `current VERSION >= transient_until`, the entry is reported as expired with a remediation message).
- **`prose-drift` check** in `scripts/dockit-validate-session.sh` (eighth check). Thin wrapper that invokes the standalone script in `--strict --quiet` mode and translates exit code → `add_result`. Severity `WARN` during v0.5.4 (calibration window — assumes false positives in the first release using the script). Promoted to `FAIL` from v0.5.5 once the baseline shape settles. Per the Layer-1/Layer-2 architecture from `~/src/LLM-DocKit/docs/HOOKS_ENFORCEMENT_PROPOSAL.md` (RFC, draft).
- **Decision D-016** in `docs/llm/DECISIONS.md` documenting the regex-paliativo / semantic-deferred two-layer cascade. Explicit acknowledgment that the script is not the full closure of the doc-drift class — Optional Enhancement B of `HOOKS_ENFORCEMENT_PROPOSAL.md` (agent-based Stop hook reading code + docs) is the closure path. The `--review` JSON output of the script is the explicit on-ramp to that future agent.
- **Global meta-rule** in `~/.claude/CLAUDE.md` ("Before adding a passive rule") plus a `PostToolUse` hook in `~/.claude/hooks/check-passive-rule.sh` that nudges whenever a write lands in `~/.claude/projects/*/memory/*`. The nudge is the meta-enforcement; the heuristic in `CLAUDE.md` is the rationale. Both are global because auto-memory is global infrastructure (`~/.claude/projects/*/memory/`) — a per-project rule cannot reach it.
- **`docs/llm/D-013` and `docs/llm/D-014` Status fields rewritten** to reflect shipped reality (caught immediately by the new R4 rule on the script's first run — the script paid for itself before its own commit).
- **`scripts/.prose-drift-baseline.json`** with two permanent entries for `docs/UPSTREAMS.md` (`v0.5.10` for `rsteckler/applaud`, `v1.4.1` for `iiAtlas/plaud-recording-downloader`). These are external upstream package versions, not plaud-mirror's, and drift independently from the `VERSION` file. The baseline reason is recorded in the entry itself for future auditability.
- **DF-028** in `~/src/LLM-DocKit/docs/DOWNSTREAM_FEEDBACK.md` (separate commit, separate repo) framing this episode as the first empirical demand for `LLM_DOCKIT_CE_V2_PROPOSAL.md` P0 #1 ("Manifest = intención, CI = evidencia"). Status `candidate, awaiting validation`. Resolution path explicit: `candidate → validated → tracked → adopted`.


- `scripts/dockit-validate-session.sh` registers the new `check_prose_drift` function in the run list (now 8 checks; was 7).
- `~/.claude/settings.json` gains a `PostToolUse` hook entry alongside the existing `SessionStart`, `Stop`, `Notification`, and `PostToolUseFailure` hooks.


- This is a **patch** release (0.5.3 → 0.5.4). The product surface is unchanged — no new runtime behavior, no new HTTP routes, no schema changes. What changes is the **governance enforcement layer**: a class of doc-drift bug that has been recurrent in this project is now caught structurally instead of by LLM discipline. Operators upgrading from `v0.5.3` see no behavior change.
- D-014 full (`lastErrors` ring buffer + extended outbox/sync history) is pushed back to **`v0.5.5`** to absorb this governance work. The roadmap shift (the fourth in `0.5.x`) is small in scope: v0.5.4 absorbs only the script + check + meta-rule, leaving D-014 as the only remaining Phase 3 piece for v0.5.5.
- Test totals are unchanged: 113 (102 backend + 11 web). The script does not have its own test suite yet — it is smoke-tested by running against the live tree (and immediately found two real drifts on first invocation, which is the strongest test possible). A formal harness for the script is deferred to the moment it is upstreamed into LLM-DocKit per DF-028.
- The `prose-drift` check is in `WARN` severity during this release. Operators who run the validator will see `[WARN] prose-drift: ...` if drift is detected, but commits and pushes are not blocked. From v0.5.5 onwards, `[FAIL]` will block. Use `scripts/check-prose-drift.sh --update-baseline --note "<reason>"` between now and v0.5.5 to record any legitimate exceptions before the gate hardens.


- (No bug fixes in this release — the new check fixed two stale `Status:` lines in `D-012` and `D-014` on its first run, but those weren't bugs in the runtime sense; they were doc drift caught by the new tool. They are listed under "Added" because the fix was a side effect of building the tool.)

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-04-27: release 0.5.5

- **D-014 full — full health observability.** `GET /api/health` now also returns:
  - `lastErrors`: cross-subsystem error ring buffer (in-memory, capped at `LAST_ERRORS_CAP=20`, most-recent-first). Each entry has `occurredAt` (ISO), `subsystem` (`scheduler` | `outbox` | `sync` | `auth`), `message`, `context` (string→string map). Failed scheduler ticks, outbox delivery errors (both retry and permanent escalations), and failed sync runs all feed it through `service.recordError`. The buffer resets per container restart by design — durable failures live in `outbox.permanentlyFailed` or `lastSync.error`.
  - `recentSyncRuns`: last 5 finished sync runs from SQLite (`finished_at DESC`). Distinct from `lastSync` (single most-recent finished run) — operator-facing audit signal for "are recent runs succeeding or failing?". Active runs excluded; they remain on `activeRun`.
- New `LastErrorEntrySchema` and `LAST_ERRORS_CAP` exports in `@plaud-mirror/shared`.
- New `RuntimeStore.getRecentSyncRuns(limit)` query.
- New `service.recordError(subsystem, message, context?)` method.
- New `SchedulerManagerOptions.onTick` callback, used by the runtime to feed failed ticks into the ring buffer.
- New `OutboxWorkerDependencies.onDeliveryError` callback, used by the runtime to feed both retry and permanent-failure escalations into the ring buffer.
- 3 new tests in `apps/api/src/runtime/service.test.ts` (ring buffer cap+ordering+cross-subsystem; sync error feeds lastErrors; recentSyncRuns surfaces last 5 most-recent finished).
- **D-017 — new `check_unabsorbed_artifact()` validator check (ninth check, WARN-level non-blocking).** New `scripts/check-unabsorbed-artifact.sh` (POSIX sh, filename-only comparison) detects local artifacts in `scripts/` and `.claude/rules/` whose filename does not exist in the LLM-DocKit upstream template (`$HOME/src/LLM-DocKit/`). New `scripts/.unabsorbed-artifact-baseline.json` ships with three entries:
  - `scripts/check-prose-drift.sh` — transient (`df_id: DF-028`), candidate-for-absorption upstream
  - `scripts/check-upstreams.sh` — permanent project-specific (watches plaud-specific upstreams)
  - `.claude/rules/external-context-triggers.md` — permanent project-specific (glob list is local data; the rule template lives upstream)


- **`prose-drift` validator hardened from WARN to FAIL** in `scripts/dockit-validate-session.sh` per D-016 plan. One calibration release (v0.5.4) was sufficient — operator workflow is rephrase-or-baseline. False positives caught during today's drift sweep (parens/backticks separating planning phrase from version literal) were resolved by rewording, not by relaxing the regex; the script remains a structural check, the operator's task is to phrase prose so the regex sees a recognised planning phrase on the same line as the version literal.
- D-014 status in `docs/llm/DECISIONS.md` updated from "partially implemented" to "fully implemented in v0.5.5".
- D-016 status updated to acknowledge the WARN→FAIL transition shipped in v0.5.5.
- `OutboxHealthSchema` doc-comment cleaned up (was pointing at a non-existent v0.5.4 D-014 landing).
- `SchedulerStatusSchema` doc-comment cleaned up similarly.
- `docs/operations/AUTH_AND_SYNC.md` "Still later in 0.5.x" section replaced with "Full health observability — shipped in v0.5.5" (resumable backfill remains deferred).
- `docs/operations/API_CONTRACT.md` `/api/health` description updated to describe the new fields and mark D-014 full as of v0.5.5.


- Test count: 113 → 116 (105 backend + 11 web). Backend gained the 3 D-014 tests; web suite unchanged.
- POSIX-shell bugs caught and worth recording (per D-017 §"Revisions"):
  1. `$'\t'` ANSI-C quoting is bash-only. Under `#!/bin/sh` it is treated as a literal `$\t` and silently fails. Fix: define `TAB=$(printf '\t')` once, interpolate as `"${TAB}"`. Same shape that hit `check-prose-drift.sh` in v0.5.4.
  2. `grep -c X file 2>/dev/null || echo 0` produces a multi-line value when there are zero matches: grep prints "0" AND exits nonzero, so the fallback also runs. Fix: `grep X file 2>/dev/null | wc -l | tr -d ' '`.
  3. sed-based JSON merge in `--update-baseline` mode breaks on `/` literals in path strings. Fix: delegate JSON read-modify-write to Python3 (already a documented dependency via `~/.claude/hooks/check-passive-rule.sh`).
- The `check_unabsorbed_artifact()` validator check generates the structural anchor for `DF-028` upstream: every `dockit-validate-session.sh --human` run on a tree where DF-028 is still un-absorbed will emit a baseline-suppressed transient entry, reminding the operator that the upstream story is open.
- `/api/health.lastErrors` is in-memory and resets per container restart by design. This is the right shape for a transient observability surface — durable failures already live in `outbox.permanentlyFailed` and `lastSync.error`, where they survive a restart.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-05-14: release 0.5.6

Patch governance/sync release. No runtime code or API change; pre-commit hook bumped this because `scripts/*` and `.claude/settings.json` count as versioned governance surface (same pattern as `v0.5.4` and `v0.5.5`).


- New `scripts/dockit-bootstrap-context.sh` from LLM-DocKit 4.8 sync — companion to the SessionStart hook for orienting a fresh agent into the external `home-infra` context.


- `.claude/settings.json` — adopted the LLM-DocKit 4.8 SessionStart hook so new sessions load the external context block automatically.
- `scripts/dockit-validate-session.sh` — extended with the upstream 4.8 orientation/template-residue checks while preserving the local `prose-drift` (D-016), `unabsorbed-artifact` (D-017), and `json-version` checks.
- `docs/version-sync-manifest.yml` — yaml-merged with the 4.8 upstream schema; project entries preserved.
- `LLM_START_HERE.md` — section-merged with the 4.8 upstream templates; project-specific blocks intact.
- `docs/llm/HANDOFF.md` + `docs/llm/HISTORY.md` — rotated the Session Focus chain so the 2026-05-13 Codex session is preserved as Previous Session Focus, today's entry records the closure, and `Open Work` reflects that the home-infra control-plane exposure landed earlier today as `the operator/home-infra` commit `dec374f`.


- The 2026-05-13 Codex session prepared the sync + HANDOFF/HISTORY content but did not commit; this release closes that pending work as the proper patch release (the pre-commit hook correctly refused a `Version impact: no` commit that touched governance surface).
- No `npm` build, no container rebuild, no test changes — `116/116` from v0.5.5 still holds. Validators `scripts/check-version-sync.sh` and `scripts/dockit-validate-session.sh --human` both PASS.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-10: release 0.6.0

Phase 3 hardening release, forced by the 2026-06-10 full-code security review before any unattended soak. The roadmap was re-cut: Phase 3 now spans `0.5.x`–`0.6.x`, Phase 4 (auto re-login) moves to `0.7.x` (see ROADMAP "Why Phase 3 Was Extended Through 0.6.x").


- **Operator access control (D-018).** New `PLAUD_MIRROR_ADMIN_PASSPHRASE` env var. When set, every `/api/*` route requires a signed HttpOnly session cookie (`plaud_mirror_session`, SameSite=Lax, 30-day TTL) obtained via the new `POST /api/session/login`; the public allowlist is `GET /api/health` (with `auth.userSummary` redacted for unauthenticated callers) and the `/api/session*` routes. New module `apps/api/src/runtime/operator-auth.ts` (HMAC session tokens keyed by master key + passphrase, constant-time passphrase comparison, in-memory login throttle: 5 failures/minute → 429). New routes `GET /api/session` and `POST /api/session/logout`. The web panel boots through a login gate and gains a Log out button; any mid-session 401 returns to the gate. When the env var is unset the API stays open (pre-0.6.0 behavior) and `health.warnings` + the boot log say so explicitly.
- **Startup crash recovery (D-013 amendment).** `service.initialize()` now sweeps orphans left by a dead process: `sync_runs` stuck in `running` are marked `failed` (they used to deadlock the anti-overlap guard forever), and `webhook_outbox` rows stuck in `delivering` are re-queued as `retry_waiting` due immediately with `attempts` preserved (at-least-once delivery accepted; downstreams must key idempotency on `recording.id`). Both sweeps surface in `health.lastErrors`.
- **Plaud request timeouts.** Every `PlaudClient` call carries `AbortSignal.timeout(PLAUD_MIRROR_REQUEST_TIMEOUT_MS)` (default 30 s) and fails with a clear `timed out after Nms` error; audio-artifact downloads carry a 10-minute ceiling (`AUDIO_DOWNLOAD_TIMEOUT_MS`). A hung connection can no longer wedge `activeRun` permanently.


- `compose.yml` passes `PLAUD_MIRROR_ADMIN_PASSPHRASE` through to the container (empty = disabled + warning).
- `GET /api/health` redacts `auth.userSummary` (Plaud account email/uid) for unauthenticated callers when access control is enabled.


- Backward compatible: deployments without the new env var behave exactly as v0.5.6, plus a visible warning.
- Test count: 116 → 130 (116 backend + 14 web). New: operator-auth unit suite, server-level gate/login/throttle/redaction tests, orphan-recovery store + service tests, Plaud client timeout test, download abort-signal test, LoginGate component tests.
- Known hardening debt deliberately left for the 0.6.x line: scrypt KDF upgrade for `data/secrets.enc` (current: single-pass SHA-256 of the master key), panel UI for `health.warnings` / `lastErrors` / `recentSyncRuns`.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-10: release 0.6.1

Patch governance/sync release: adopt LLM-DocKit **4.8.2** (upstream moved past the previously-adopted 4.8.0 on 2026-05-17). No runtime code or API change; the pre-commit hook requires the bump because `scripts/*` is versioned governance surface (same precedent as v0.5.4–v0.5.6).


- `scripts/test-validator.sh` (upstream 4.8.2): POSIX smoke-test runner for `dockit-validate-session.sh`. Passes 9/9 against the merged local validator.


- `scripts/dockit-validate-session.sh`: merged the upstream 4.8.1/4.8.2 refinements — `is_zero_diff_read_only_session()` honoring `DOCKIT_ALLOW_READ_ONLY_SKIP=1` (DF-039: read-only sessions like `/brief` skip handoff-date/history-entry only when the working tree is zero-diff) and the glob-character filter in the orientation path extraction — while preserving the local guardrails the blind template copy had removed (`handoff-start-here-sync`, `prose-drift` D-016, `unabsorbed-artifact` D-017).


- The raw `dockit-sync --apply` clobbered three scripts by overwriting local additions (`json-version` support in `bump-version.sh`/`check-version-sync.sh`, the three local checks in the validator); they were restored and hand-merged in the same session. This is the second occurrence of the clobber-on-sync pattern (first: 2026-05-13) — candidate feedback for LLM-DocKit (`merge` strategy for scripts with local extensions).
- Tests: 130/130 unchanged; validator smoke suite 9/9.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-10: release 0.6.2

Patch: operator tooling for D-018. No runtime change.


- `scripts/set-admin-passphrase.sh` — interactive helper the operator runs on dev-vm to store `PLAUD_MIRROR_ADMIN_PASSPHRASE` in Doppler (`plaud-mirror/dev`, project auto-created on first run, closing the "create Doppler project plaud-mirror" item open since Phase 2 planning). Silent double prompt, minimum 8 characters, value piped to the Doppler CLI via stdin so it never reaches argv, shell history, or disk. Prints the arm-and-verify steps (`doppler run ... -- docker compose up -d`).


- `docs/operations/DEPLOY_PLAYBOOK.md` + `docs/operations/AUTH_AND_SYNC.md` document Doppler as the source of truth for the operator passphrase, with the `doppler run` launch path (process env overrides `.env` in compose substitution).
- `scripts/.unabsorbed-artifact-baseline.json`: new permanent entry for the helper (D-017 protocol).

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-11: release 0.6.3

- `scripts/set-admin-passphrase.sh`: save the terminal state (`stty -g`) and restore it via `trap` on EXIT/INT/TERM, so a Ctrl-C between `stty -echo` and `stty echo` can no longer leave the operator's terminal without echo (low-severity UX finding from the operator's post-release audit of v0.6.2). No runtime change.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-11: release 0.7.0

Opens Phase 4 (re-auth). Browser-assisted Plaud re-auth so the operator refreshes the ~300-day bearer in one tap — no DevTools, no stored password — chosen over credentials-login (not applicable: Google-SSO account) and the official OAuth/MCP (deferred/watch). See D-019.


- **Browser-assisted Plaud re-auth (D-019).** New panel card "Reconectar Plaud": `POST /api/connect/start` mints a single-use `captureId` (in-memory `CaptureSessionStore`, TTL 10 min); the operator logs into app.plaud.ai (Google) and taps a bookmarklet that reads the bearer from Plaud's `localStorage` (extraction adapted from the MIT `iiAtlas` upstream, with attribution) and bounces it to the mirror's new `/connect` page (`ConnectPlaud`), which completes via `POST /api/connect/complete { token, captureId }`. The captureId binds the swap to operator intent (token-fixation defence); the bearer is validated against Plaud before storing and only ever travels in a URL fragment (never logged) + one same-origin authenticated POST. New module `apps/web/src/plaud-token.ts` (`extractPlaudToken`, `buildBookmarklet`). Both connect routes require the operator session.


- The manual token paste (`POST /api/auth/token`) stays as the universal fallback. Telegram is explicitly not a capture channel.
- Auth-provider evaluation recorded in D-019: official partner API (enterprise-only, rejected), official CLI/MCP (deferred/watch, not disproven — its docs mention `presigned_url`), private email+password login (real endpoint, but not applicable to a Google-SSO account), browser-assisted capture (chosen).
- Attribution: token-location logic adapted from MIT `iiAtlas/plaud-recording-downloader` (Copyright (c) 2025 Atlas Wegman); see `docs/UPSTREAMS.md` Phase 4 adoption and the header of `apps/web/src/plaud-token.ts`.
- Tests: 130 → 141 (121 backend + 20 web). New: `capture-session.test.ts`, connect-flow server tests (start/complete/replay/forged), `plaud-token.test.ts` (extraction + bookmarklet shape).

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-12: release 0.7.1

UX fixes to the v0.7.0 browser-assisted re-auth (D-019), from the operator's post-release audit. No security-model change.


- **Reconnect popup-blocker (medium).** "Reconectar Plaud" now opens the app.plaud.ai tab synchronously inside the click handler and mints the `captureId` in parallel, instead of opening it after `await`. Opening a tab after an await loses the user-gesture context and mobile/popup blockers reject it — exactly the "from the phone" path this feature targets. The captureId only needs to reach mirror localStorage before the operator taps the bookmarklet (seconds later), so the parallel mint is race-free.


- **"Copiar marcador (móvil)" button.** Copies the bookmarklet to the clipboard via the Clipboard API (with a `window.prompt` fallback in insecure contexts), since dragging to a bookmarks bar is unavailable on mobile and long-pressing a `javascript:` link is unreliable.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-12: release 0.7.2

Fixes the v0.7.0/v0.7.1 browser-assisted re-auth (D-019) so the bookmarklet actually runs, after the operator reported "I drag it, tap it on Plaud, and nothing happens".


- **Bookmarklet did nothing (the real blocker).** `buildBookmarklet` wrapped the whole script body in `encodeURIComponent`, so the browser executed percent-encoded text (`%7B`, `%28`, …) → a silent syntax error. The bookmarklet now emits the raw, executable `javascript:` source (origin single-quoted to keep the href clean; no whole-body encoding). Regression-guarded in `plaud-token.test.ts` (asserts no `%7B`/`%28`).
- **"Reconectar Plaud" popup not null-checked.** If the browser blocks the tab, the panel now shows "abre app.plaud.ai manualmente …" instead of falsely reporting success; the capture session is still minted so a manual open works.


- **Reconnect card rewritten** for clarity: numbered "Paso 1 — instalar (una vez)" vs "Paso 2 — usarlo", explicit desktop (`Ctrl+Shift+B` + drag) vs mobile (copy) install, and clarifying that the purple link is dragged (not clicked) while "Reconectar Plaud" is the button pressed in the panel. Clicking the link now shows a friendly "arrástrame, no me pulses" hint instead of Chrome's scary `javascript:`-blocked error.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-12: release 0.7.3

Fixes the persistent 403 when validating a captured Plaud token: it was the wrong token type, on top of a region mismatch.


- **403 on token validation — wrong token type.** The extractor (and bookmarklet) inherited iiAtlas's "workspace token first" priority, but Plaud Mirror validates against `/user/me`, a user-scoped endpoint that rejects the per-workspace token with 403. `extractPlaudToken` / the bookmarklet now prefer the global **user token** (`pld_tokenstr`) first and use the workspace token only as a fallback.
- **Region:** the operator's account is EU, so `PLAUD_MIRROR_API_BASE=[referenced endpoint]` is now set (in Doppler `plaud-mirror/dev`). A US base returned a hard 403 that the `-302` regional-retry path did not catch.
- **Messy paste tolerated.** `saveAccessToken` strips surrounding quotes and a leading `Bearer `/`bearer ` prefix before validating/storing, so pasting the raw localStorage value (`"bearer eyJ..."`) works instead of becoming `Bearer "bearer eyJ..."` → 403.
- **Plaud rejection reason surfaced.** `PlaudApiError` now includes a short slice of Plaud's response body in its message, so a 403/4xx shows the operator *why* in the panel instead of a bare HTTP code.


- Tests 141 → 142 (122 backend + 20 web): extractor priority flipped (user token wins; workspace fallback), `saveAccessToken` normalization test.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-13: release 0.7.4

Closes the PII/info-leak introduced by v0.7.3 and fixes stale comments. No new feature.


- **Plaud's raw error body no longer leaks to public `/api/health` (medium).** v0.7.3 put a slice of Plaud's response body into `PlaudApiError.message`, which flows into `auth.lastError`, `lastSync.error`, and `lastErrors` — all exposed on the unauthenticated `/api/health`. The message is now generic again (`... failed with HTTP <code>`); the body stays in `bodySnippet` and is surfaced **only** on the authenticated `POST /api/auth/token` / `/api/connect/complete` response (so the operator still sees *why* a token was rejected, in the panel, without exposing it publicly).
- **Stale comments in `apps/web/src/plaud-token.ts`** still said "workspace token first" / "Prefer it", contradicting the v0.7.3 priority change. Updated to "user token (`pld_tokenstr`) first; workspace token is the fallback", with the iiAtlas divergence noted.


- Tests 142 → 143 (new: `saveAccessToken` keeps `auth.lastError` generic for public health but enriches the thrown, authenticated error with Plaud's reason).

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-16: release 0.7.5

- **Masked token paste now fails with a clear 400 instead of a ByteString crash.** Pasting a redacted/hidden token value such as `Bearer ●●●●` made the backend try to build `Authorization: Bearer ●...`; the bullet character is not legal in a Fetch `ByteString` header, so the operator saw `Cannot convert argument to a ByteString... index 7`. `saveAccessToken` now rejects mask characters and other non-header-safe token characters before constructing the Plaud client, with a message that tells the operator to copy the real `localStorage` token instead of a hidden/redacted field.
- **Docker image build no longer depends on `npm prune`.** The v0.7.5 deploy exposed a local build hang in `corepack npm prune --omit=dev`; the Dockerfile now uses a separate `prod-deps` stage with `npm ci --omit=dev` and copies those production dependencies into the runtime image.


- Tests 143 → 144 (new: masked-token guard rejects before any Plaud request is built).
- Live deploy verified on dev-vm: container and `/api/health` report `0.7.5`, operator auth is armed, and `PLAUD_MIRROR_API_BASE=[referenced endpoint]`.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-16: release 0.7.6

- **Bookmarklet made shorter and visible.** The browser-assisted reconnect marker no longer carries the full workspace-token heuristic. It now focuses on the known user-token key (`pld_tokenstr`), scans storage as a fallback, and stays under 2 KB to reduce bookmark truncation risk.
- **Reconnect instructions now state the expected browser behavior.** Pressing the marker on `app.plaud.ai` should show a Plaud Mirror alert and then return to `/connect`; if no alert appears, the marker is not installed/executing correctly.


- **Bookmarklet failure is no longer silent.** The marker now shows an alert for every outcome: wrong page, token not found, token found, or capture error. This is intentionally less elegant but much easier to debug for an operator.


- Tests 144 → 145 (new: bookmarklet size guard; web tests 20 → 21).

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-16: release 0.8.0

- **Local Chrome companion extension for Plaud re-auth.** `apps/chrome-extension/` now ships an unpacked Manifest V3 extension ("Plaud Mirror Connector") that reads the active `app.plaud.ai` / `web.plaud.ai` tab's user bearer (`pld_tokenstr` first, storage scan fallback) and redirects that tab to Plaud Mirror's `/connect#token=...` handshake. It uses only `activeTab` + `scripting`, injects in Chrome's `MAIN` world, stores only the mirror origin, and never stores or logs the Plaud token.
- **Extension contract tests.** New integration smoke test verifies the extension manifest permissions, Plaud/mirror host coverage, `/connect#token=` redirect, `MAIN`-world script injection, and no token-material persistence in extension `localStorage`.


- **Reconnect UX is extension-first.** The Configuration tab now presents the Chrome extension as the recommended path and demotes the bookmarklet to a copy-only fallback. This resolves the React/Chrome failure mode where a draggable `javascript:` `href` rendered by React becomes `javascript:throw new Error('React has blocked...')`, so the installed bookmarklet contains no real capture code.
- **Phase 4 remains active through `0.8.x`.** `v0.8.0` is a SemVer minor because it adds a new operator-facing re-auth delivery mechanism. It is still Phase 4 scope, so Phase 5 shifts to `0.9.x` and Phase 6 to `0.10.x+`.


- **Reconnect ready-state copy.** "Reconectar Plaud" now opens Plaud synchronously for popup-blocker compatibility, then only tells the operator to use the connector once `/api/connect/start` has returned and the `captureId` is stored in mirror `localStorage`.
- Tests: 145 → 147 (126 Node tests + 21 web tests). New: Chrome extension manifest/contract smoke tests.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-16: release 0.8.1

- **Plaud API requests now mimic Plaud Web's request context.** The backend now validates and syncs with `Origin`/`Referer: [referenced endpoint]`, a browser-like Chrome user agent, and the browser `sec-fetch-*` headers instead of the old custom `plaud-mirror-phase1/...` user agent and `app.plaud.ai` origin.


- **Extension-captured tokens no longer fail backend validation because of the backend request fingerprint.** The operator proved the captured EU user token returns `200` from Plaud Web's own console, while the backend received an HTML `403` from Plaud/Cloudflare. The token and region were correct; the stale server-side Plaud request context was the remaining mismatch.
- Tests: 147 -> 148 (new Plaud client header-regression test).

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-16: release 0.9.0

- **Reference-driven operator panel redesign.** The React/Vite panel now absorbs the visual and interaction direction from `docs/design/reference/plaud-mirror-panel-standalone.html`: 212px operator rail, dense light-console layout, five real screens (Main, Library, Backfill, Configuration, Operations), status strip, next-action card, KPI coverage, recent errors, recent runs, outbox retry surface, and a mobile-aware reconnect flow.
- **Operator language toggle.** The panel chrome now switches live between Spanish and English and persists the chosen language in local storage. Raw log content, recording titles, and Plaud/backend error text stay verbatim.
- **Library controls.** Recordings now have live search, compact/full player modes, 50/100/150 pagination, and dismissed-recording visibility integrated into the new Library screen.


- **Panel visual system.** Replaced the previous card-heavy UI with the reference design system: Archivo UI type, Space Grotesk headings, JetBrains Mono labels/data, green accent `#0f7a5a`, light page surface `#d7d9dd`, tight status tones, and responsive rail-to-mobile navigation. Backend routes and data contracts are unchanged.
- **Backfill preview and Operations are first-class.** Existing endpoints are reorganized into dedicated screens: Backfill recalculates the dry-run preview as filters change, while Operations surfaces recent sync runs, outbox counters/retry, and `health.lastErrors` without needing curl.
- **Configuration keeps the current auth model.** Operator login, Chrome extension reconnect, copy-only bookmarklet fallback, manual token paste, webhook settings, scheduler settings, and read-only technical state remain wired to the existing API. No secrets or `.env` files are touched.


- **Observability gap.** `health.warnings`, `lastErrors`, `recentSyncRuns`, scheduler state, and outbox state are now visible in the panel's Main/Operations surfaces instead of existing only in `/api/health`.
- Tests: 148 -> 150 (127 Node tests + 23 web tests). New web coverage validates the expanded tab model and persisted ES/EN language preference.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-17: release 0.9.1

- Nothing.


- **Operator panel now uses the full viewport.** The `v0.9.0` redesign copied the standalone reference frame too literally: the production shell rendered as a centered 1240px card on a grey presentation canvas. The app shell now fills the viewport, keeps the 212px rail pinned to the left edge, and lets the main content scroll inside the remaining width/height.
- **Mobile rail stays compact.** The desktop full-height rail is overridden at the existing mobile breakpoint so the single-column layout keeps a compact sticky top rail instead of a 100vh block.


- **Wide desktop wasted space.** Large monitors no longer show broad grey margins around the operator panel; the frame border, shadow, outer radius, max-width, and page padding were removed from the production shell.
- Tests: 150 (127 Node/integration tests + 23 web tests).

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-18: release 0.9.2

- Nothing.


- **Main sync now downloads the displayed missing count.** The Main cockpit action no longer borrows the Historical Backfill form's conservative `limit=1`. When Main says recordings are missing, its button now sends the visible missing count as the sync limit, capped at the existing backend safety ceiling of 1000.
- **High-volume Main syncs require confirmation.** If the Main action would download 25 or more recordings, the panel asks the operator to confirm before starting the run.


- **Misleading "Sync missing" behavior.** A Main click could examine the full Plaud catalog but download only one recording because it inherited the Backfill draft limit. The button label now says exactly how many recordings it will download.
- Tests: 150 -> 151 (127 Node/integration tests + 24 web tests).

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-18: release 0.9.3

- **Trace Protocol governance support from LLM-DocKit.** Session onboarding now documents the Trace header convention, `dockit-bootstrap-context.sh` surfaces it during startup, and `dockit-validate-session.sh` includes a durable `trace-protocol` check that stays skipped unless a project explicitly enables it in `.dockit-config.yml`.
- **Validator smoke coverage for Trace Protocol.** `scripts/test-validator.sh` now covers the skip path, valid anchors, minute/second commit times, missing HISTORY footers, pre-activation history, missing anchors, invalid hashes, and missing `since` configuration.


- **Merged the DocKit sync manually instead of accepting the raw overwrite.** The upstream trace-protocol additions were kept while restoring Plaud Mirror's local validator extensions.
- **Read-only DocKit hook skips are now explicit.** The Claude hook runs the validator with `DOCKIT_ALLOW_READ_ONLY_SKIP=1`, preserving the upstream maintenance refinement without weakening dirty-session enforcement.


- **Local guardrails were restored after a raw DocKit sync clobbered them.** `handoff-start-here-sync`, `prose-drift`, `unabsorbed-artifact`, and `json-version` handling in the version bump/check scripts are active again. The validator now reports 12 checks instead of dropping to 9.
- Tests: runtime tests unchanged at 151. Governance checks: `scripts/dockit-validate-session.sh --human` passes 12/12; `scripts/test-validator.sh` passes 17/17.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-18: release 0.9.4

- Nothing.


- **Library Full mode now earns its toggle.** Full playback rows use a wider, flexible native-audio column on desktop so the scrubber reaches much farther left instead of staying as a narrow right-side control.
- **Library owns its list scroll.** The Library screen now keeps its header/toolbar/pagebar fixed inside the operator content area and scrolls the recordings table itself, so 50/100/150-row pages remain reachable in the full-viewport shell.


- **Compact Library playback.** Compact Play now controls the real row `<audio>` element inside the user click gesture instead of only toggling React state and waiting for a newly-rendered audio control. The playing compact row still expands to the native scrubber.
- Tests: 151 -> 153 (127 Node/integration tests + 26 web tests).

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-19: release 0.9.5

- **Labeled mobile view selector.** The mobile rail now exposes a native view selector labeled `Vista` / `View`, so navigation is not an icon-only strip at the top of the phone screen.


- **Mobile status is compact.** The desktop status strip is replaced on mobile by a single horizontally-scrollable row of compact chips, keeping Auth, Sync, Scheduler, Outbox, and Errors visible without consuming the main viewport.
- **Mobile rail is a real header.** The mobile shell now keeps the brand/version, view selector, language toggle, and logout in a compact top header instead of a five-icon pseudo-sidebar.


- **Library mobile row actions stay on the right.** Dismiss/restore buttons are explicitly anchored to the top-right grid cell on narrow screens instead of dropping under the row content.
- Tests: 153 -> 154 (127 Node/integration tests + 27 web tests).

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-19: release 0.9.6

- **LLM-DocKit 4.9.6 guardrails adopted.** Version tooling now supports upstream `yaml-info-version` and `package-lock-version` marker handlers in addition to the existing Plaud Mirror `json-version` handling.
- **Package-lock version sync.** `package-lock.json` is now tracked by `docs/version-sync-manifest.yml`, and both its top-level `version` and `packages[""].version` are checked and bumped with the rest of the release markers.
- **Expanded validator smoke coverage.** `scripts/test-validator.sh` now covers flexible HISTORY formats, Trace footer handling for dash/no-dash HISTORY entries, and version marker drift for JSON, YAML, and package-lock files.


- **Trace Protocol v1.3 chat guidance.** `LLM_START_HERE.md` and `scripts/dockit-bootstrap-context.sh` now require seconds in chat `Sent` headers on both local and UTC timestamps, and instruct readers to re-check git status, `git log -1`, and the current clock before acting on stale Trace reports.
- **HISTORY validation follows upstream 4.9.6.** The validator accepts both dash and no-dash HISTORY entry formats by default, with strict `history_format: dash` / `history_format: no-dash` available through `.dockit-config.yml`.
- **DocKit sync merged manually.** The upstream 4.9.6 updates were applied while preserving Plaud Mirror's local `handoff-start-here-sync`, `prose-drift`, and `unabsorbed-artifact` validator checks.


- **Prevented another raw-sync clobber.** The first post-apply validator dropped from 12 checks to 9 after upstream copied `scripts/dockit-validate-session.sh`; the local guardrails were reinserted before commit.
- **Removed stale lockfile version drift.** `package-lock.json` had remained at `0.9.0`; the new `package-lock-version` target updates it to `0.9.6`.
- Tests: runtime tests unchanged; governance checks now expect 22 version targets, `scripts/dockit-validate-session.sh --human` reports 12 checks, and `scripts/test-validator.sh` reports 32 smoke cases.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-21: release 0.10.0

- **Home Infra Protocol sync-job adoption.** `infra.contract.yml` now declares
  `plaud-mirror-recordings-sync` as a `home-infra-protocol` `sync_jobs[]`
  producer for Plaud recording mirroring.
- **Protocol status snapshot endpoint.** `GET
  /api/protocol/sync-jobs/plaud-mirror-recordings-sync/status` and alias
  `/api/protocol/status` publish a public sanitized `status-snapshot` for Infra
  Portal/Hermes consumers.
- **Protocol schemas and mapper.** `packages/shared/src/protocol.ts` models the
  status-snapshot contract, and `apps/api/src/runtime/protocol-status.ts` maps
  `ServiceHealth` into protocol checks for auth, latest sync, coverage,
  scheduler, and outbox.
- **Infra contract docs.** `docs/INFRA_CONTRACT.md` documents the
  producer/consumer boundary and explains why the contract starts as
  `schedule.mode: manual`.


- **Phase 5 entered for infra/protocol integration.** The sync engine is
  unchanged, but Plaud Mirror now participates in the shared Home Infra sync
  protocol; NAS rollout and multi-day soak remain pending.
- **Public allowlist extended safely.** The protocol status routes are public
  like `/api/health`, but return only sanitized operational status and no Plaud
  account PII, bearer tokens, webhook secrets, or raw Plaud error bodies.


- Nothing.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-06-29: release 0.10.1

- Nothing.


- Nothing.


- **Sync progress no longer counts disabled-webhook decisions as skipped sync
  candidates.** A normal sync with no webhook configured could show
  `downloaded 20` and `skipped 20` for the same 20 recordings because
  `SyncRunSummary.skipped` was incremented from the recording-level
  `lastWebhookStatus="skipped"` state. The run summary now treats webhook
  skipped as delivery state only; downloaded candidates keep `skipped=0` while
  the recording row still records that no webhook was configured.
- Tests: runtime test count unchanged; `apps/api/src/runtime/service.test.ts`
  now asserts the split between sync skipped candidates and webhook skipped
  delivery state.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-10: release 0.10.2

- **Repository CI gate.** GitHub Actions now runs the supported Node 20 build,
  web typecheck, Node/integration tests, and Vitest suite on pushes to `main`
  and pull requests.
- **Automatic Node test discovery.** `scripts/run-node-tests.mjs` recursively
  finds compiled unit and integration tests, so a new test file cannot be
  silently omitted from the root suite.


- **The root test gate now typechecks the panel.** `npm test` runs
  `tsc -p apps/web/tsconfig.json --noEmit`; Vite transpilation is no longer the
  only compiler check for React code.
- **Idle panels observe scheduler work.** The panel polls health every 30
  seconds while idle and switches to the existing 2-second run polling loop
  when it discovers a sync started outside the current tab.


- **Docker build context no longer includes secrets or host build output.**
  `.env*`, nested `node_modules`, `dist`, `.tsbuildinfo`, and Vite caches are
  excluded, preventing secret exposure and stale host artifacts from affecting
  image builds.
- **Library layout test no longer races initial loading.** The Full-player test
  waits for its recording before changing mode, removing timing-dependent CI
  failures.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-10: release 0.10.3

- **Candidate failure accounting.** `SyncRunSummary.failed` is persisted in
  SQLite (additive migration, default 0 for older rows) and rendered in live
  progress plus the Operations run table.


- **Candidate selection reconciles SQLite with disk.** A row counts as mirrored
  only when its file exists, is non-empty, and matches `bytesWritten`; missing
  or wrong-sized artifacts re-enter sync/backfill selection and preview as
  missing.
- **Poisoned recordings no longer block older candidates.** Candidate failures
  are recorded individually, processing continues, and any partial run closes
  as `failed` with durable per-recording error context instead of a false green.
- **Concurrent backfills are explicit conflicts.** `POST /api/backfill/run`
  returns 409 while another sync is active instead of reusing that run id and
  silently discarding the requested filters.


- **Audio replacement is atomic.** Downloads stream into a unique temporary
  file, `fsync` it, and rename it over the destination only after success; an
  interrupted force-download or restore preserves the previous valid audio and
  cleans up the partial file.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-10: release 0.10.4

- **Whole-run runtime ceiling.** Sync/backfill work defaults to one hour
  (`PLAUD_MIRROR_SYNC_MAX_RUNTIME_MS`) and propagates cancellation into Plaud
  requests and streamed audio downloads.
- **Container liveness.** Compose probes the public `/api/health` endpoint.


- **Scheduler telemetry awaits the run.** `lastTickStatus=completed` now means
  the mirror run finished, not merely that background work was dispatched.
- **Bounded pagination and graceful shutdown.** Full Plaud listings reject
  repeated pages and stop after 100 pages; SIGTERM/SIGINT drain active work
  before SQLite closes.
- **Dependency security refresh.** Fastify Static 9, Vitest 4, and patched
  transitives leave both full and production `npm audit` clean.


- **Outbox retry off-by-one.** All eight backoff windows, including the final
  8-hour wait, are reachable before a ninth failed attempt becomes permanent.
- **Outbox claims recover in-process.** Secret/payload setup failures now audit
  the attempt and return the claim to `retry_waiting`; health counts active
  `delivering` rows.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-10: release 0.10.5

- **Node 20 timeout-test portability.** The hung-request regression test keeps
  the event loop alive long enough for Node 20's unref'ed
  `AbortSignal.timeout()` timer to fire. Runtime timeout behavior is unchanged;
  the evidence gate now measures it consistently on CI and local Node 24.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-10: release 0.10.6

- **Node 20 whole-run timeout evidence.** The service-level max-runtime test
  now owns the same short event-loop keepalive as the request-timeout test,
  allowing the intentionally unref'ed production timer to fire under Node 20.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-10: release 0.10.7

- **Soak schedule contract activated.** The project contract now declares
  `internal-loop` at `PT15M` with `stale_after: PT2H`, aligned with the one-hour
  runtime ceiling. Its header now references Home Infra Protocol 0.7.1 and
  removes the obsolete pre-ingestion note.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-13: release 0.10.8

- Upstream baselines refreshed after the overdue D-004 review (applaud
  v0.5.11, iiAtlas 1.4.3, openplaud v0.5.4, plaud-toolkit 810c7ceb,
  obsidian-sync 1.0.1). This stops the daily `upstream-watch` failure
  emails that started on 2026-07-11.
- D-019 gains a 2026-07-13 amendment: Plaud is retiring localStorage
  `pld_tokenstr` for new/migrated accounts in favor of `pld_ut`/`pld_urt`
  cookies plus a refresh endpoint (facts from MIT applaud v0.5.11 PR #32).
  The capture-path adaptation is queued in HANDOFF Open Work.


- Governance/documentation-only patch; no runtime behavior change and no
  deployment. The dev-vm runtime deliberately stays on `v0.10.7` while the
  Phase 3 soak accumulates evidence (running since 2026-07-10).
- `docs/llm/REVIEWS.md` records the pre-soak execution audit and the corrected
  provenance of the operator-requested July 6 backdating on
  `2f38024..a791e0a`; published history remains unchanged.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-14: release 0.11.0

- Dismissed Library rows now offer an explicit `Delete from Plaud` action. A
  single confirmation names the irreversible Plaud-account consequence before
  the authenticated API performs the request.
- `DELETE /api/recordings/:id/plaud` implements Plaud's observed two-step
  trash-then-delete flow and records a durable `upstream_deleted_at` tombstone.
- Root `PRODUCT.md` and `DESIGN.md` plus the Impeccable design sidecar capture
  the operator-panel product and visual rules for future UI work.


- Local dismiss remains the required first step and remains reversible. A
  successful permanent Plaud deletion removes Restore, keeps the local row as
  an auditable tombstone, and makes later sync UPSERTs unable to erase it.
- Phase 6 begins with operator-facing fit and finish while the independent
  Phase 3 soak and live webhook exit gate remain open.


- The Plaud mutation client rejects explicit non-zero application statuses and
  handles both empty success responses and normal Plaud envelopes.
- Web UI tests use a repository-level 15-second limit so full App integration
  cases remain stable on the shared dev VM without weakening assertions.
- The anti-overlap service test now drains its captured background callbacks
  instead of leaking a one-hour runtime timer after its assertions complete.


- Validation uses mocks only for the destructive endpoint. No real Plaud
  recording is deleted as part of automated or deployment verification.
- Deploying this runtime restarts the continuous process. Existing soak
  evidence remains historical evidence, but Phase 3 exit is not claimed until
  the post-deploy observation window and live webhook drill are complete.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-14: release 0.11.1

- Permanent Plaud deletion now has a route-local fail-closed authorization
  guard in addition to the normal operator-session hook.


- `DELETE /api/recordings/:id/plaud` now returns `403` without contacting
  Plaud when `PLAUD_MIRROR_ADMIN_PASSPHRASE` is absent. The rest of the API
  retains its documented open-development compatibility mode.
- Removed an unused delivery-record identity helper and aligned the local-file
  deletion comment with the existing `localFileRemoved` response contract.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-14: release 0.11.2

- A route-specific regression assertion that the permanent Plaud DELETE returns
  401 for an anonymous caller when operator auth is configured.


- The fail-closed destructive authorization guard is now a named reusable
  Fastify pre-handler instead of inline route logic.
- The auth runbook now records the recoverable trash-succeeded/delete-failed
  state and its safe retry behavior.


- Closed the two low hardening observations from the final Claude Opus backup
  audit without changing UI, successful API, storage, or protocol behavior.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-16: release 0.12.0

- Durable `upstream_deletion_operations` state plus append-only
  `upstream_deletion_events`, including operation ids, retry counts, stages,
  and the last reconciliation error.
- Generation-based mirror coverage on `/api/health`, with explicit remote,
  mirrored, dismissed, missing, local-only, and confirmed-deleted counts.


- Permanent deletion now journals intent before each Plaud mutation and
  reconciles a prior uncertain DELETE through Plaud detail before issuing any
  second destructive request.
- Concurrent deletion requests for the same recording are serialized in the
  service, and remote absence after any durable deletion intent is reconciled
  without another mutation.
- Library rows with an unresolved Plaud deletion expose a retry-only state;
  Restore is unavailable until the deletion is reconciled.
- Protocol coverage uses the committed remote inventory generation rather than
  subtracting all historical tombstones from the current Plaud total.


- Reject 2xx HTML and unrecognized JSON mutation responses instead of treating
  HTTP status alone as proof that Plaud accepted a destructive command.
- Keep historical tombstones and local-only tracked rows outside the current
  remote coverage partition, so mirrored + dismissed + missing equals the
  current Plaud listing exactly.
- Preserve full contrast for destructive controls on dismissed Library rows.


- The SQLite migration is additive and old tombstones are imported as
  confirmed deletion operations. No real Plaud deletion is part of automated
  or deployment validation.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-16: release 0.13.0

- Optional public protocol `next_run_at`, sourced directly from the active
  scheduler's next tick.
- Producer/schema regressions for UTC validation, authoritative publication,
  and omission when no schedule is known.


- Review the project contract against Home Infra Protocol 0.10.0 and document
  planned execution separately from freshness.


- Give generic consumers a truthful countdown source without requiring them to
  estimate the next run from cadence.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-16: release 0.13.1

- A deterministic regression test for a timer callback that was already
  queued when the scheduler stopped.
- Test-context cleanup for every HTTP application fixture, including failed
  assertions.


- Runtime scheduler timers no longer keep a Node process alive by themselves.


- Prevent a queued scheduler callback from rearming work after `stop()`,
  eliminating an intermittent test-process hang and tightening shutdown.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-16: release 0.14.0

- Provider-neutral Transcription Intake v1 contracts, capability discovery,
  separately scoped machine credentials, authenticated immutable artifact
  leases, durable admission outbox, push/pull status reconciliation, exact
  coverage, and bounded historical replay.
- A dedicated Integrations screen with test-before-enable setup, one-audio
  canary, replay preview/batches, credential rotation, recent delivery state,
  plus optional primary-pipeline visibility on Main and Library.
- Contract, store, worker, lifecycle, auth-boundary, scale, HTTP Range, and web
  regressions for the optional transcription lane.


- Make Media2Text the first intended compatible provider rather than a Plaud
  Mirror build, runtime, storage, or deployment dependency; the generic
  `recording.synced` webhook remains a separate unchanged feature.
- Keep destination setup neutral in the panel: no provider is preselected,
  provider names are operator-defined, and Spanish/English delivery states
  describe the shared protocol rather than one implementation.
- Extend encrypted secret storage and SQLite through additive destination,
  artifact, delivery, outbox, and status-event state while preserving healthy
  standalone operation when no destination exists.


- Keep claimed transcription work recoverable when encrypted-secret reads
  fail, apply status-event deduplication and state mutation atomically, reject
  status regressions/identity drift, and retain active audio leases when a
  destination is disabled or the source recording is dismissed/deleted.
- Distinguish retryable admission failure from downstream processing failure,
  remove duplicate artifact pins after idempotent enqueue, and count replay
  eligibility beyond 1,000 recordings.
- Give destination tabs keyboard semantics, announce errors/status changes,
  remove decorative side stripes, keep the mobile metrics grid compact, and
  enforce 44 px touch targets across the new integration controls.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-17: release 0.14.1

- A byte-pinned contract manifest, local manifest verifier, and executable
  provider probe for capability, admission, duplicate, conflict, and pull
  conformance checks.


- Name the existing wire contract honestly as the Plaud Mirror Transcription
  Intake v1 Compatibility Profile and record the future neutral core/profile
  extraction trigger in D-024.
- Require explicit operator and API confirmation before enabling an additional
  paid transcription destination.


- Block Restore throughout an in-flight permanent Plaud deletion, including
  the pre-journal network window, so concurrent requests cannot resurrect a
  recording while its upstream deletion continues.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-17: release 0.14.2

- Persist the provider's transcript record hash separately from the immutable
  source-audio hash on each delivery.


- Accept signed terminal transcription status when `recordSha256` identifies
  the generated transcript record. The previous implementation incorrectly
  compared it with the source audio SHA-256 and rejected every successful
  Media2Text completion with HTTP 409.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-07-18: release 0.15.0

- Structured local review for terminal transcription failures, with neutral
  dependency, incompatible-audio, policy, and provider categories; active or
  resolved disposition; provider-invocation evidence; and an optional policy
  limit.
- Additive coverage counters for failures requiring attention versus retained
  historical incidents, plus a duration snapshot on each delivery.


- Integrations now shows a sanitized phase, cause, and next action instead of
  reducing every terminal problem to `Failed`. Resolved canaries keep their
  original terminal state as audit evidence.
- Rename the credential action to "Rotate transcriber audio access" / "Rotar
  acceso del transcriptor al audio".

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-09-12: release 0.15.1

- Added the centrally managed Fable-preferred, exact-Opus fallback review
  policy.


- Preserved code, deployed runtime, data, delivery, spend, and full-template
  provenance.


- None.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-09-13: release 0.16.0

- A fail-closed QNAP deployment surface with an immutable registry image,
  loopback-only ingress, least-privilege container settings, pinned Doppler
  bootstrap, explicit migrated-state gate, and automated source-asset tests.
- A one-time dev-vm-to-NAS migration and rollback runbook that preserves a
  single scheduler writer, copies SQLite only after quiescence, verifies the
  data boundary before proxy cutover, and retains the old state until
  acceptance.


- Production placement moves from `dev-vm` to the NAS. Small control state
  stays under `[private custody]`; growing recordings use the 1 TB
  `[private custody]` dataset.
- Production secrets move to `plaud-mirror/prd`; the historical master key is
  escrowed there without rotating it so the existing `secrets.enc` remains
  decryptable.
- Connection-control implementation moves to the `0.17.x` line. Its D-026
  product contract and authorization boundary are unchanged.
- The supported build/runtime baseline moves to Node 24.15+. Fastify,
  `@fastify/static`, Vite, Vitest, the React plugin, and jsdom are refreshed to
  versions whose resolved dependency graph passes both full and production
  `npm audit` with zero findings.


- The NAS production port is bound only to loopback; `edge-caddy` remains the
  sole operator ingress. The development Compose surface intentionally retains
  its existing dev-vm LAN binding and is not a production deployment asset.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-09-13: release 0.16.1

- No new product capability.


- The QNAP production runtime identity is pinned to the live storage owner
  `1000:100` instead of the generic Node image identity `1000:1000`. The
  container remains non-root and every persistent leaf remains mode 0700.


- The first NAS cutover attempt now fails recoverably instead of depending on
  unavailable QNAP privilege escalation: the source container was restored
  before proxy change, and the launcher/tests/runbook use the enforceable
  QNAP UID/GID discovered from live storage.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-09-14: release 0.16.2

- This is a source and NAS host-asset patch only. The accepted immutable
  `v0.16.1` container remains running unchanged; no `v0.16.2` image is built or
  published, and Doppler's production image pin is not changed.


- No new product capability.


- No runtime or data contract change.


- NAS container acceptance now compares Docker's declared bind sources with
  the exact declared QNAP paths. It no longer resolves `[private custody]` aliases to
  backing-dataset paths that Docker inspect intentionally does not report.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-09-14: release 0.16.3

- No new product capability.


- The project-owned infra contract now records the accepted production truth:
  `host_id: nas` and `doppler://plaud-mirror/prd` secret references. The public
  hostname, application behavior, storage schema, and protocol remain
  unchanged.
- This is a source/contract/documentation release only. No `v0.16.3` image is
  built or published, the immutable `v0.16.1` container remains running, and
  no runtime restart or data copy occurs.
- The documentation follow-up records completed Home Infra `0.34.18` and
  warning-free Infra Portal projection without changing the owner contract or
  running container.
- After a full checksum dry run proved all 1,441 recording-tree files and
  12,209,691,055 bytes identical, the operator authorized removal of the
  dev-vm audio copy. Only `runtime/recordings` was emptied; control state was
  retained and root free space increased from 8.5 GB to 20 GB. NAS is now the
  sole verified audio copy because no independent backup was verified first.
- A second operator-authorized retirement pass removed only the rebuildable
  `node_modules` tree, the exact stopped dev-vm container, and its sole-tagged
  local Plaud image. The source checkout, `.env`, empty recordings directory,
  and all 15,594,388 bytes of `runtime/data` remain. That control-state copy is
  deliberately retained because it is now Plaud's only off-NAS custody while
  a restore-tested NAS backup remains open.


- Removed the final owner-side placement drift that still described the
  stopped `dev-vm` rollback source as production after NAS canonical and
  automatic-run acceptance had passed.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-09-23: release 0.16.4

- Updated DocKit delivery checks and Opus 5.5 review policy; no runtime deployment.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-09-29: release 0.16.5

- Registered local ForgeOS Dossier declaration, custody workflow and ecosystem reassessment.


- Selectively align onboarding and Trace with DocKit 4.17.0 while retaining project validators.
- Prepend current runtime, integration and next-step evidence to the preserved historical orientation.


- Source tooling only. No production image, runtime, content contract, credential or paid processing change.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### 2026-09-30: release 0.16.6

- Adopt current applicable DocKit 4.18 features while retaining local guards.
- Curate complete project history and prepare shared Dossier delivery.
- Preserve the operational-first consensus as a proposal, with no runtime change.

Retrospective compiled on September 30 from the preserved changelog. Runtime acceptance is recorded separately.

### September 13-14: NAS placement and retained recovery limit

A quiesced single-writer migration, corrected storage identity, direct/canonical readback and automatic run established accepted NAS placement. The retired VM is no longer a complete audio rollback.

Preserve observed deployment separately from source versions; independent backup remains open.

### September 29: ecosystem and operational-first consensus

Existing verified text, a bounded new-recording path, daily operation and later retrieval became the agreed recommendation. None was claimed implemented.

Prioritize useful output soon while preserving owner authority, frozen contracts and spending gates.

### September 30: documented history enters Dossier

A source-grounded retrospective is prepared for explicit shared publication, preserving native L1 and honest observation/publication times.

Operator requested the full roadmap, decisions, past work and visible project-card access.

## Documentary source inventory

- CHANGELOG.md
- DESIGN.md
- HOW_TO_USE.md
- PRODUCT.md
- README.md
- apps/chrome-extension/README.md
- deploy/nas/README.md
- docs/ARCHITECTURE.md
- docs/DELIVERY_CONTRACT.md
- docs/INFRA_CONTRACT.md
- docs/PROJECT_CONTEXT.md
- docs/ROADMAP.md
- docs/STRUCTURE.md
- docs/UPSTREAMS.md
- docs/VERSIONING_RULES.md
- docs/contracts/README.md
- docs/design/CONNECTIONS_OPERATOR_EXPERIENCE.md
- docs/integrations/CODEX.md
- docs/llm/DECISIONS.md
- docs/llm/DOCKIT_ADOPTION.md
- docs/llm/HANDOFF.md
- docs/llm/HISTORY.md
- docs/llm/README.md
- docs/llm/REVIEWS.md
- docs/operations/API_CONTRACT.md
- docs/operations/AUTH_AND_SYNC.md
- docs/operations/DEPLOY_PLAYBOOK.md
- docs/operations/DOSSIER.md
- docs/operations/NAS_MIGRATION_2026-09-13.md
- docs/operations/README.md
- docs/operations/UPSTREAM_WATCH.md
- docs/reviews/2026-09-29-operational-consensus.md
- docs/reviews/2026-09-29-project-reassessment.md
- docs/reviews/2026-09-30-dossier-retrospective.md
