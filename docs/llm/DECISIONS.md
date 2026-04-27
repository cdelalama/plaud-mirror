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

**Status:** accepted; **implemented across v0.5.0 → v0.5.2** (`apps/api/src/runtime/scheduler.ts`, `apps/api/src/runtime/scheduler-manager.ts`, hot-reconfigure via `service.setSchedulerReconfigureHook`). v0.5.0 introduced the timer + tick path (regressed: default-on without opt-in, missing service-level anti-overlap); v0.5.1 fixed the regressions; v0.5.2 made the interval panel-driven via `RuntimeConfig.schedulerIntervalMs` persisted in SQLite.

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
export const OUTBOX_MAX_ATTEMPTS = 8;
```

Cumulative window before escalation: ~16 hours.

### Revisions from original draft

The original draft (pre-implementation) specified a 5-attempt schedule (`30s, 2m, 10m, 1h, 6h`) and the endpoint `POST /api/webhook-outbox/:id/retry`. During v0.5.3 implementation, both were updated based on review feedback:

- **Backoff schedule extended from 5 to 8 attempts (~7h cumulative → ~16h cumulative).** Reason: home-infra deployments typically experience overnight downstream outages (8–10 hours offline). A 7h window gave up too early — the operator would wake up to a queue full of `permanently_failed` rows that needed manual retry. 16h covers a full overnight window; the curve `30s, 2m, 10m, 30m, 1h, 2h, 4h, 8h` keeps early retries snappy for transient blips and lengthens later retries so a long outage doesn't hammer the downstream when it eventually comes back. Reviewer (GPT-5) explicitly recommended this; adopted without further changes.
- **Endpoint renamed from `/api/webhook-outbox/:id/retry` to `/api/outbox/:id/retry`.** Reason: the new GET-list route had to live somewhere too, and `/api/outbox` reads better as a resource root than `/api/webhook-outbox` (the table name leaks into the URL otherwise). No functional difference.
- **`GET /api/outbox` returns ONLY `permanently_failed` rows.** Pending and retry-waiting items are visible only as counters via `health.outbox` (`pending`, `retryWaiting`, `permanentlyFailed`, `oldestPendingAgeMs`). Decision driver: keep the panel focused on "what needs operator attention" and not turn it into a queue browser. If the operator needs to inspect a specific in-flight row, query SQLite directly.

The original draft also implied that backoff could include "jitter" — the shipped implementation does NOT add jitter. Single-process, single-tenant home-infra deployment; no thundering-herd risk to mitigate.

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
- `/api/health` exposes the outbox backlog (`pending` / `retryWaiting` / `permanentlyFailed` / `oldestPendingAgeMs`) per D-014's first slice.
- `POST /api/outbox/:id/retry` allows the operator to recover a `permanently_failed` row from the panel: resets `attempts = 0`, clears `last_error`, transitions back to `pending`. Returns 409 for any other state, 404 for unknown id, 400 for unsafe id shape.
- Atomic claim: the transition `pending|retry_waiting → delivering` is a guarded `UPDATE ... WHERE id = ? AND state = ?` that fails when a concurrent claim has already moved the row. Worker-tick + panel-triggered retry cannot pick the same row twice.
- Backfill at scale creates many outbox rows in one batch. The worker processes them serially (one per 5-second tick) — simplest correctness, no parallel delivery. A 100-recording backfill against a healthy downstream drains in ~8.5 minutes; against a flaky downstream, the queue persists and recovers without operator intervention.

## D-014 - Health endpoint surfaces operational state, not just configuration state

**Status:** accepted; **fully implemented in v0.5.5**. `/api/health.scheduler` shipped in v0.5.0, `/api/health.outbox` (counters: pending / retryWaiting / permanentlyFailed / oldestPendingAgeMs) shipped in v0.5.3, and `lastErrors` (in-memory ring buffer, cap LAST_ERRORS_CAP=20, most-recent-first, cross-subsystem) plus `recentSyncRuns` (last 5 finished runs from `sync_runs` ordered by `finished_at DESC`) shipped in v0.5.5. (`v0.5.4` was governance-only — Layer-1 doc-drift enforcement, D-016 — and did not advance D-014.)

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


## D-016 - Doc-drift enforcement is layered: regex now (paliativo), semantic agent later (full closure)

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

## D-017 - Unabsorbed-artifact detection is local in plaud-mirror, symmetric `forge audit` lives in ForgeOS

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
