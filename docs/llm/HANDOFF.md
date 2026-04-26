<!-- doc-version: 0.5.2 -->
# LLM Work Handoff

This file is the live operational snapshot. Durable rationale lives in `docs/llm/DECISIONS.md`. Phase boundaries live in `docs/ROADMAP.md`.

## Current Status

- Last Updated: 2026-04-26 - Claude Opus 4.7
- Session Focus: Doc-only sweep after an external review flagged drift the same day `v0.5.2` shipped: README.md still listed continuous sync as a "later phase," and HANDOFF's Top Priorities + What Is Still Not Verified + Roadmap Boundary sections still cited the old `v0.5.1` / `v0.5.2` outbox mapping (now `v0.5.3` / `v0.5.4`). Doc-only commit (no VERSION bump per `docs/VERSIONING_RULES.md` exclusion list). Pattern recognized: post-`bump-version.sh` sweep must read prose line-by-line, not trust that "marker updated" means "doc up to date" — the `feedback_prose_version_drift` auto-memory rule extended now to README and HANDOFF Top Priorities. Previous Session Focus (`v0.5.2` panel-driven scheduler) preserved verbatim below for historical continuity.
- Session Focus (v0.5.2 release, 2026-04-25): `v0.5.2` adds **panel-driven scheduler configuration**. The user explicitly asked for the scheduler to be configurable from the UI ("no me interesa que esté en el .env"), so the scheduler interval moves from "env-var only" to "persisted in SQLite, settable via `PUT /api/config`, hot-applied with no restart." The env var is downgraded to a one-time seed for fresh installs. Tercer roadmap shift en `0.5.x`: outbox (D-013) → `v0.5.3`, full health (D-014) → `v0.5.4`.
- Status: `v0.5.2` shipped. Code: new module `apps/api/src/runtime/scheduler-manager.ts` with `SchedulerManager.applyInterval(ms)` (start / stop / swap-cadence in place, idempotent for unchanged values, throws below the 60 000 ms floor); `RuntimeConfig.schedulerIntervalMs` and `UpdateRuntimeConfigRequest.schedulerIntervalMs?` added to the shared schema (`.default(0)` so older clients still parse); `RuntimeStore.seedSchedulerDefaults(ms)` writes the env-var bootstrap value only when the SQLite row is absent; `RuntimeStore.saveConfig` accepts the new field and persists via the existing `settings` key/value table; `service.updateConfig` validates the floor at the request boundary (HTTP 400 for sub-floor positives), persists, then calls a new reconfigure hook so the live `Scheduler` is started / stopped / swapped via the manager; `service.setSchedulerReconfigureHook(fn)` mirrors `setSchedulerStatusProvider`; `apps/api/src/server.ts` now constructs a `SchedulerManager` unconditionally, wires both hooks, and applies the persisted interval after `service.initialize()` (env-var seed runs first); the inline `Scheduler` instantiation in `createApp` is gone. Web: new "Continuous sync scheduler" card on the Configuration tab with a live status block (state, interval, next/last tick, last reason) and a form (`Interval (minutes, 0 disables)`); helpers `formatSchedulerInput` / `parseSchedulerInput` round-trip minutes ↔ ms; `handleSaveScheduler` posts to `PUT /api/config { schedulerIntervalMs }`. Tests: 9 new (1 store round-trip + seed-only-once, 7 in the new `scheduler-manager.test.ts`, 1 service `updateConfig`). Test totals: **102** (91 backend + 11 web), up from 93 at `v0.5.1`. Doc sweep: CHANGELOG `[0.5.2]` filled (Added/Changed/Notes); ROADMAP "Current target" → `v0.5.2` and entry note rewritten to mention panel-driven config + push outbox to `v0.5.3` and full-health to `v0.5.4`; PROJECT_CONTEXT current-status rewritten to lead with the panel UX win; ARCHITECTURE status header + "What Phase 3 Adds" / "Continuous sync scheduler" / "Next Architectural Step" all updated to describe the SchedulerManager + SQLite-as-source-of-truth flow + the env var as a one-time seed; AUTH_AND_SYNC env-var matrix replaced with a unified value matrix that applies regardless of source (panel or seed) plus an explicit "to take an existing install back to disabled, set the value to 0 in the panel — removing the env var no longer changes anything" warning; API_CONTRACT route table + `PUT /api/config` example + Phase Boundary Note all updated; HOW_TO_USE "Configuring the scheduler" rewritten to lead with panel steps and demote env-var to "Optional: bootstrap from the env var" subsection; test count bumped to 102 with breakdown. HANDOFF / LLM_START_HERE kept in sync. Next session: `v0.5.3` for the durable webhook outbox per D-013.

## What Landed

- `apps/api` now serves the admin API and the built web panel.
- `apps/web` now contains the product panel for token setup, webhook config, sync/backfill controls, and recordings visibility.
- Secrets now persist encrypted at rest via `PLAUD_MIRROR_MASTER_KEY`.
- Runtime state now persists in SQLite.
- Docker launch path now exists via `Dockerfile` and `compose.yml`.
- Docker now supports build/runtime base-image overrides via `PLAUD_MIRROR_DOCKER_BUILD_IMAGE` and `PLAUD_MIRROR_DOCKER_RUNTIME_IMAGE`, so this `dev-vm` can substitute another locally cached Node base when Docker Hub is flaky. The default remains `node:20-bookworm-slim`; pentesting distributions (e.g. `vxcontrol/kali-linux`) are explicitly not an acceptable substitute.
- The fallback Docker path now avoids `apt` entirely and builds with `corepack npm`, which removes the network dependency on distro package mirrors during image build.
- The Phase 2 container has now been built and started successfully on `dev-vm`; the service is reachable on port `3040` and reports the expected "missing token" health state.
- The Phase 1 spike now measures download byte count from the written file, not only `content-length`.
- `docs/ROADMAP.md` now defines the phases explicitly so Phase 2 and Phase 3 do not blur together again.
- The container now runs as non-root (`USER 1000:1000`); bind-mounted directories under `./runtime/` no longer end up root-owned on the host. `compose.yml` also pins `user: "1000:1000"` for explicitness.
- The previous Kali-based Docker fallback recommendation was removed from "Next Session". Kali was only cached on `dev-vm` because of an unrelated project; using a pentesting distribution as a Node runtime base inflates the attack surface and is not an appropriate posture for this service. Acceptable fallbacks are listed in "Next Session" below.
- **Local curation feature set (v0.4.0):** per the owner's request, the web panel now exposes an inline `<audio>` player per mirrored recording (streamed from `GET /api/recordings/:id/audio`), a "Delete local mirror" button with a confirmation dialog, and a "Show dismissed" toggle that reveals dismissed rows with a "Restore" action. Dismiss is **local-only by design** (per D-001 audio-first scope and the conservative posture on upstream mutation): it unlinks the local audio file, clears `localPath`/`bytesWritten`, and sets `dismissed=true` on the SQLite row so future sync/backfill runs skip it. Plaud itself is never called for deletion. Restore clears the flag. Recording ids are validated against a strict allowlist and the resolved audio path is confirmed to stay within the configured recordings directory, so the new streaming route is not a path-traversal vector. Migration is additive (pre-0.4.0 databases gain the `dismissed` and `dismissed_at` columns via `ALTER TABLE` at startup).

## Docker Incident Summary

The Docker failure on `dev-vm` was a chain, not a single bug:

1. The normal base image path (`node:20-bookworm-slim`) failed because Docker Hub blob pulls timed out.
2. A local-image fallback was added with `vxcontrol/kali-linux:latest`, but the first implementation still used `apt-get install npm ...` during the image build.
3. That meant the fallback still depended on network access, this time to Kali package mirrors, and those mirrors also timed out.
4. After removing the `apt` dependency, the build exposed a second problem: the fallback image already had `node` and `corepack`, but not a standalone `npm` binary on `PATH`.
5. Some build steps still invoked scripts that called `npm` internally, so the image build failed even though `corepack npm` itself worked.

The effective fix in [Dockerfile](../../Dockerfile) was:

- keep build/runtime base-image override support,
- stop installing `npm` through `apt`,
- use `corepack npm` directly in the container build,
- call runtime and web builds directly instead of routing through nested scripts that expect `npm` on `PATH`.

This is now verified on the actual `dev-vm`, not assumed.

## Verified Runtime State

- Container `plaud-mirror-plaud-mirror-1` is up on `dev-vm`, port `3040` bound, running as `USER 1000:1000`.
- `GET /api/health` returns `200` with `{ version: "0.5.2", auth.state: "healthy" }` against the operator's real Plaud account. The `scheduler` block is present in every response and **defaults to the disabled shape** when neither the SQLite row nor the env-var seed have set a non-zero value. From `v0.5.2` the live source of truth is the SQLite `config.schedulerIntervalMs` row, set from the panel; the env var only seeds the row on fresh installs.
- Bearer token saved via the web UI, auth validated with `/user/me`, encrypted at rest, survives restarts.
- Manual sync and filtered backfill exercised against live Plaud. Latest confirmed state: 308 recordings in the account total, 215+ mirrored locally, `plaudTotal` + stable `#N` ranks populating correctly.
- Device catalog populates after sync via `/device/list`; the backfill selector renders operator nicknames.
- `GET /api/backfill/candidates` returns annotated dry-run results against the live account (`state: "missing" | "mirrored" | "dismissed"`).
- Inline audio playback via `<audio>` + HTTP Range works from the library.
- Async sync (`POST /api/sync/run` → `202 → GET /api/sync/runs/:id` polling) verified: the panel surfaces `downloaded X of Y` live while a run is in flight.
- Persistent paths: `runtime/data` (SQLite + encrypted secrets) and `runtime/recordings` (audio artifacts).

## What Is Still Not Verified

- **Real webhook delivery against a live downstream receiver.** No webhook URL has been configured in this environment yet; all recordings carry `lastWebhookStatus: "skipped"` because the service short-circuits when no URL is set. Once a receiver exists, confirm HMAC signature verification and persisted delivery attempts end-to-end.
- **Multi-day scheduler-driven unattended behavior.** The scheduler ships in `v0.5.0` (regressed), `v0.5.1` (regressions fixed), and `v0.5.2` (panel-driven config). Backed by 18 deterministic tests across `scheduler.test.ts`, `scheduler-manager.test.ts`, `environment.test.ts`, and the relevant `service.test.ts` cases, but no live multi-day soak run has been measured yet. Once an operator sets a non-zero interval from the panel, observe the `health.scheduler` block over several ticks before declaring "unattended on `dev-vm` works."
- **Durable webhook outbox.** Still not implemented (D-013, scheduled for `v0.5.3`). A failed webhook delivery still requires the operator to re-trigger sync; the persisted attempt log captures the failure but does not retry.
- **Full health observability.** `lastErrors` ring buffer and outbox backlog counters are not yet on `/api/health` (D-014, scheduled for `v0.5.4`).
- **Automatic re-login.** Phase 4. No code yet.
- **Multi-day stability.** The service has been restarted many times across sessions; no long uninterrupted run has been measured.

## Roadmap Boundary

- The project is in **Phase 3** per [docs/ROADMAP.md](../ROADMAP.md). `v0.5.0` introduced the scheduler but regressed; `v0.5.1` fixed the regressions; `v0.5.2` added panel-driven configuration. The remaining Phase 3 increments are tracked: durable webhook outbox (D-013 → `v0.5.3`) and full health observability (D-014 full → `v0.5.4`).
- Phase 4+ scope is still untouched: no automatic re-login, no resumable backfill, no NAS validation, no public OSS polish.
- Working-tree cleanliness and validator status are not asserted here — they age badly. Run `git status` and `scripts/dockit-validate-session.sh --human` for the current fact.

## Governance Cleanup Landed in 0.4.1

The six items GPT-5 flagged in the 2026-04-23 review are closed:

1. **Roadmap/phase boundary** — `docs/ROADMAP.md` now explicitly covers Phase 2 across `0.3.x` and `0.4.x`; every later phase shifts by one minor so Phase 3 is `0.5.x`, Phase 4 is `0.6.x`, Phase 5 is `0.7.x`, Phase 6 is `0.8.x+`. SemVer stays authoritative over phase labels and the "Why Phase 2 Was Extended Through 0.4.x" note captures the reasoning.
2. **README Kali recommendation** — removed. The README now lists only generic acceptable fallbacks (locally cached slim/alpine, `docker save`/`docker load`, or a pull-through registry mirror) and explicitly rejects `vxcontrol/kali-linux:latest` as a Node runtime base.
3. **CHANGELOG narratives** — `0.3.2` and `0.4.0` entries are now filled with real user-visible bullets instead of header-only skeletons.
4. **Stale drift claim** — the "Roadmap and Drift Status" block in this handoff was replaced with a shorter "Roadmap Boundary" block that does not assert working-tree cleanliness. `git status` and the validator are the source of truth for that.
5. **Stable docs prose refresh** — `docs/PROJECT_CONTEXT.md` and `docs/ARCHITECTURE.md` no longer cite `v0.3.0` in prose; both reflect the current `v0.4.1` state including local curation.
6. **Hero metric fix** — `apps/web/src/App.tsx` now reads `health?.recordingsCount` for the hero "Recordings" metric, falling back to the paginated array length only if health has not loaded yet. This is the only code change in `0.4.1`.

## Top Priorities

1. Live-soak the scheduler from the panel: set 15 min, observe `health.scheduler.lastTickAt` advancing for several ticks, confirm a manual sync mid-tick is recorded as `lastTickStatus = "skipped"` with a useful `lastTickError` reason.
2. Confirm webhook delivery against a real downstream target (still untested in this environment because no webhook URL has been configured).
3. Ship `v0.5.3` (D-013, durable webhook outbox) — pushed back twice already, this is the next minor.
4. Ship `v0.5.4` (D-014 full, `lastErrors` ring buffer + outbox backlog on `/api/health`) right after the outbox lands.
5. Create the Doppler project `plaud-mirror` before moving past `dev-vm`.

## Open Questions

- What retry and scheduler defaults are safe enough for Phase 3?
- Can automatic re-login be implemented without browser automation?
- If `scene` filtering turns out to be useful with real operator experience, how would we surface it? A smart dropdown of scene values observed in the account (via `SELECT DISTINCT scene FROM recordings`) is one option; another is discovering a Plaud-provided mapping of scene numbers to human labels.

## Confirmed Product Direction

- First deployment target is `dev-vm`; NAS comes later.
- The first usable release must include a small product-style web panel.
- Manual bearer-token auth is acceptable first, but it must be encrypted at rest and survive restarts.
- Historical backfill is required from day 1.
- Downstream delivery stays generic webhook-first.
- Automatic re-login stays on the roadmap but is not a Phase 2 gate.

## Roadmap Pointer

Use [docs/ROADMAP.md](../ROADMAP.md) as the source of truth. The important boundary is:

- **Phase 2:** usable manual slice with UI + Docker
- **Phase 3:** unattended operation and resilience

Do not collapse those phases casually.

## Next Session

- If the stack is not already running, start it with:
  `docker compose up --build -d`
- If Docker Hub pulls time out on `dev-vm`, the Dockerfile still accepts `PLAUD_MIRROR_DOCKER_BUILD_IMAGE` and `PLAUD_MIRROR_DOCKER_RUNTIME_IMAGE` build-arg overrides. Valid fallbacks: a locally cached Node slim/alpine image from another project, a home-infra-local registry mirror (see the open registry-mirror item in `~/src/home-infra/docs/PROJECTS.md`), or a side-loaded `node:20-bookworm-slim` via `docker save`/`docker load`. Do **not** substitute a pentesting distribution such as `vxcontrol/kali-linux:latest` — it inflates the attack surface, bloats the image, and ships tooling that has no place in a Plaud mirror's runtime.
- Open the UI and save a fresh Plaud bearer token.
- Run a filtered backfill from the panel.
- Inspect:
  - `/api/health`
  - `runtime/recordings/<recording-id>/metadata.json`
  - webhook receiver logs
- Record the live findings before planning Phase 3.

## Testing Notes

- `npm test` passes, including:
  - shared schema tests
  - Plaud client tests
  - Phase 1 spike tests
  - encrypted-secret/store/service/server tests
  - built API/web integration smoke tests
- Docker packaging now includes a local-base fallback for this `dev-vm`; `docker compose up --build -d` has been verified locally and `/api/health` responds with the expected "missing token" payload.
- Live Plaud validation still has not happened in-session because no real token was available.

## Key Decisions (Links)

- D-001: audio-first mirror
- D-002: server-first with web UI
- D-003: manual token first, automatic re-login later
- D-004: upstream-watch is mandatory
- D-005: conservative license boundary
- D-006: recording ID is the canonical local key
- D-007: composite reuse strategy
- D-008: critical auth/download path stays auditable in-repo
- D-009: operator-only TOS posture
- D-010: roadmap phases are normative
- D-011: API facts discovered in AGPL upstreams may be adopted; AGPL code may not

## Do Not Touch

- `config/upstreams.tsv` without documenting the baseline change
- `docs/UPSTREAMS.md` licensing boundaries without explicit user approval
- `.dockit-config.yml` external-context paths unless the infra-doc repo moved
