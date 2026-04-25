# Decision Log (Stable Rationale)

This file captures durable "why" decisions for Plaud Mirror.

---

## D-001 - Plaud Mirror is audio-first

**Status:** accepted

### Decision
Plaud Mirror's core responsibility is downloading and storing the audio artifact, not providing transcription.

### Rationale
The user's downstream pipeline already owns speech-to-text. Expanding Plaud Mirror into transcript or summary generation would dilute the core problem: reliable mirroring and session durability.

### Implications

- Audio sync is the critical path for v1.
- Transcript and summary support are optional future extensions, not required for the first release.

---

## D-002 - Server-first architecture with web UI

**Status:** accepted

### Decision
Plaud Mirror is a server-side service with a local operational web UI, not a browser extension and not a one-shot CLI.

### Rationale
The primary use case is an always-on home server or similar self-hosted environment. The operator needs persistence, scheduling, visibility, and configuration more than interactive bulk export.

### Implications

- `apps/api/` and `apps/web/` are first-class planned modules.
- Docker deployment and on-disk durability matter from the start.

---

## D-003 - Phased auth strategy: manual token first, automatic re-login later

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

## D-004 - Upstream-watch is mandatory

**Status:** accepted

### Decision
Changes in relevant upstream repos must be tracked explicitly through `config/upstreams.tsv`, `docs/UPSTREAMS.md`, and `scripts/check-upstreams.sh`.

### Rationale
Plaud integrations depend on unofficial and evolving behavior. Auth keys, region logic, and export endpoints can drift. Silent drift is a product risk.

### Implications

- Primary upstreams are treated as ongoing inputs, not one-time research.
- Baseline changes are governance changes and must be documented.

---

## D-005 - License boundary is conservative

**Status:** accepted

### Decision
MIT is the intended Plaud Mirror license. MIT upstreams may be reused with attribution. AGPL and no-license upstreams remain reference-only unless a future documented decision changes this.

### Rationale
The project is meant to be publishable as permissive OSS without accidental license contamination or ambiguity.

### Implications

- `openplaud/openplaud` is an idea source, not a copy source.
- Reuse from no-license repos is blocked until license clarity exists.

---

## D-006 - Canonical local layout uses Plaud recording ID

**Status:** accepted

### Decision
Local mirrored artifacts should be keyed by the Plaud recording ID, not only by title or date.

### Rationale
Titles can change and are not guaranteed unique. The remote ID is the most stable dedupe key.

### Implications

- Default path shape is `recordings/<recording-id>/...`
- Human-readable metadata belongs in filenames only as optional secondary detail

---

## D-007 - Reuse strategy is composite, not a single-upstream fork

**Status:** accepted

### Decision
Plaud Mirror will combine ideas from multiple upstreams instead of treating one existing project as the canonical base.

### Rationale
No single upstream matches the target product cleanly. `Applaud` is strongest on server shape and operator UX. `iiAtlas` is strongest on fast-moving auth and region heuristics. The Studer projects are strongest as direct endpoint/export references. A composite strategy gives better fit and lowers lock-in.

### Implications

- `Applaud` and `iiAtlas` remain the two highest-priority upstreams to watch.
- Plaud Mirror can evolve its own identity without inheriting another project's full product surface or constraints.

---

## D-008 - Core auth and download logic must stay auditable in-repo

**Status:** accepted

### Decision
Plaud Mirror should not hide its critical Plaud auth and audio download flow behind an opaque third-party runtime dependency.

### Rationale
Source review of third-party tools is useful but not equivalent to a full trust guarantee. Upstream inspection also surfaced at least one concrete credential-handling flaw in the ecosystem: `JamesStuder/Plaud_BulkDownloader` echoes the password to the console. That finding reinforces the value of keeping the critical path readable and reviewable inside Plaud Mirror itself.

### Implications

- Upstream code can be referenced, adapted, or vendored with review, but the auth/download path should remain understandable from this repository alone.
- Token-first auth remains the preferred operator mode where practical because it reduces password exposure.

---

## D-009 - Operator-only TOS posture

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

## D-010 - Roadmap phases are normative

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

## D-011 - API facts discovered in AGPL upstreams may be adopted; AGPL code may not

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

## D-012 - Continuous sync scheduler runs in-process with anti-overlap protection

**Status:** accepted (designed; implementation lands incrementally during Phase 3)

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
- The scheduler must be cancellable cleanly on process shutdown so SIGTERM does not leave a half-finished run.
- Anti-overlap protection means an unusually long sync (e.g. backfilling 1000 missing recordings) blocks subsequent ticks until it finishes. That is the correct behavior — overlapping runs would corrupt the `sync_runs` row that polling relies on.
- Test surface: a deterministic scheduler injection (similar to the one already in `service.test.ts`) lets tests fast-forward through ticks without real timers.

## D-013 - Webhook outbox is a separate SQLite table with explicit state transitions

**Status:** accepted (designed; implementation lands during Phase 3)

### Decision

The Phase 3 webhook outbox is a **new SQLite table** (`webhook_outbox`), not an extension of the existing `webhook_deliveries` table or of `sync_runs`. The new table tracks pending/in-flight delivery state; `webhook_deliveries` continues to log every attempt as an audit trail.

Schema (additive migration, no destructive changes):

```sql
CREATE TABLE IF NOT EXISTS webhook_outbox (
  id            TEXT PRIMARY KEY,           -- UUID
  recording_id  TEXT NOT NULL,              -- FK to recordings.id (per D-006)
  payload_json  TEXT NOT NULL,              -- the signed payload at enqueue time
  state         TEXT NOT NULL,              -- 'pending' | 'delivering' | 'delivered' | 'retry_waiting' | 'permanently_failed'
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,                     -- ISO timestamp; null for delivered/permanently_failed
  last_error    TEXT,                       -- last HTTP status / error message snippet
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
```

State machine:

```
       enqueue
         ↓
      pending ──(picked up)──→ delivering ──(2xx)──→ delivered  [terminal]
                                  │
                                  ├──(failure, attempt_count < max)──→ retry_waiting ──(next_attempt_at reached)──→ pending
                                  │
                                  └──(failure, attempt_count == max)──→ permanently_failed  [terminal]
```

Retry policy: exponential backoff with jitter, capped. Default schedule (configurable via env): `30s, 2m, 10m, 1h, 6h`. After the 5th failure, transitions to `permanently_failed` and operator must intervene (manual retry button in panel, or DELETE the outbox row).

### Rationale

Separate table because:

1. **`webhook_deliveries` is an append-only log** — every attempt creates a row. The outbox is mutable state with explicit transitions. Conflating them would force a schema change to a table whose current shape works.
2. **Different access patterns** — outbox rows are queried by `state` and `next_attempt_at` (worker scan); delivery rows are queried by `recording_id` for audit. Indexed differently.
3. **Different lifecycle** — delivered outbox rows can be archived or pruned after N days; delivery log rows must persist for audit indefinitely (or until configured retention).

Explicit named states (rather than booleans like `delivered=true/false`) because the state machine has FIVE distinct positions, and naming them prevents the kind of "what does `failed` mean exactly" drift that bit Mode B sync at v0.4.9 (when "skipped" was overloaded to mean three things).

Exponential backoff over linear because the failure modes we expect (downstream receiver down, network blip, signature mismatch) all benefit from rapid early retries followed by long pauses — linear would either hammer a down receiver or wait too long on a transient error.

### Implications

- `service.processRecording` no longer attempts immediate delivery as the only path. It enqueues into the outbox; a separate `webhook-worker` (driven by the same scheduler from D-012, or a dedicated worker tick) drains it.
- The existing immediate-delivery codepath (Phase 2) becomes a special case: `outbox.enqueue + outbox.process(id)` synchronously when scheduler is disabled, async when enabled. Operators using Phase 2 mode (manual-sync only) see no behavioral change.
- `/api/health` exposes outbox backlog count + oldest pending age (per D-014).
- A new endpoint `POST /api/webhook-outbox/:id/retry` allows the operator to manually retry a `permanently_failed` row (resets `attempt_count` and transitions back to `pending`).
- Backfill at scale (hundreds of recordings) creates hundreds of outbox rows in one batch. The worker processes them serially with the same backoff schedule — no parallel delivery, simplest correctness.

## D-014 - Health endpoint surfaces operational state, not just configuration state

**Status:** accepted (designed; implementation lands during Phase 3)

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

## D-015 - UI tests use Vitest + jsdom + @testing-library/react

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
