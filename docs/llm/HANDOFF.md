<!-- doc-version: 0.4.19 -->
# LLM Work Handoff

This file is the live operational snapshot. Durable rationale lives in `docs/llm/DECISIONS.md`. Phase boundaries live in `docs/ROADMAP.md`.

## Current Status

- Last Updated: 2026-04-25 - Claude Opus 4.7
- Session Focus: Phase 3 Step 1 — set up the web-side test framework and lock the four design decisions (D-012 scheduler, D-013 outbox, D-014 health observability, D-015 test framework) before code for scheduler/outbox/health lands in v0.5.x. This release ships v0.4.19 as a Phase 2 hardening release: it adds the testing infrastructure and the first batch of web-side component tests, but does NOT yet add Phase 3 features. Phase 3 proper begins at v0.5.0 with the scheduler.
- Status: `v0.4.19` shipped. Vitest + jsdom + @testing-library/react + @testing-library/jest-dom installed in `apps/web`. New `vitest.config.ts`, `test-setup.ts`, `apps/web/package.json#scripts.test = "vitest run"`. Root `npm test` chains a new `npm run test:web` step after the backend suite. New modules: `apps/web/src/storage.ts` (extracted `readTab` + `readBackfillExpanded` + `STORAGE_KEYS` constant) and `apps/web/src/components/StateBadge.tsx` (extracted from App.tsx). Two new test files (`storage.test.ts` 8 tests, `StateBadge.test.tsx` 3 tests) for 11 web-side tests; total 77 (66 backend + 11 web). Four new decisions: D-012/013/014 lock scheduler/outbox/health design contracts before code; D-015 records the test-framework choice. Doc sweep: ROADMAP/PROJECT_CONTEXT/ARCHITECTURE/HOW_TO_USE/CHANGELOG/HANDOFF/LLM_START_HERE all updated to v0.4.19. DocKit's DF-026 status moves to `partially implemented (plaud-mirror v0.4.19)` for the helper+component-level axis; App-level interaction tests (tabs/collapse/BackfillPreview lifecycle) deferred to a future patch because they need either App decomposition or fetch-mocking patterns that are non-trivial. Phase 3 next session: start v0.5.0 with the scheduler module per D-012.

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
- `GET /api/health` returns `200` with `{ version: "0.4.19", auth.state: "healthy" }` against the operator's real Plaud account.
- Bearer token saved via the web UI, auth validated with `/user/me`, encrypted at rest, survives restarts.
- Manual sync and filtered backfill exercised against live Plaud. Latest confirmed state: 308 recordings in the account total, 215+ mirrored locally, `plaudTotal` + stable `#N` ranks populating correctly.
- Device catalog populates after sync via `/device/list`; the backfill selector renders operator nicknames.
- `GET /api/backfill/candidates` returns annotated dry-run results against the live account (`state: "missing" | "mirrored" | "dismissed"`).
- Inline audio playback via `<audio>` + HTTP Range works from the library.
- Async sync (`POST /api/sync/run` → `202 → GET /api/sync/runs/:id` polling) verified: the panel surfaces `downloaded X of Y` live while a run is in flight.
- Persistent paths: `runtime/data` (SQLite + encrypted secrets) and `runtime/recordings` (audio artifacts).

## What Is Still Not Verified

- **Real webhook delivery against a live downstream receiver.** No webhook URL has been configured in this environment yet; all recordings carry `lastWebhookStatus: "skipped"` because the service short-circuits when no URL is set. Once a receiver exists, confirm HMAC signature verification and persisted delivery attempts end-to-end.
- **Unattended behavior from Phase 3 onward.** No scheduler loop, no retry/outbox, no automatic re-login. These are explicitly deferred by the roadmap and are not expected to work at `v0.4.19` — Phase 3 proper begins at v0.5.0 with the scheduler.
- **Multi-day stability.** The service has been restarted many times across sessions; no long uninterrupted run has been measured.

## Roadmap Boundary

- This work stays inside **Phase 2** from [docs/ROADMAP.md](../ROADMAP.md): usable UI + Docker + encrypted manual token + manual sync/backfill + signed webhook, plus the local-only curation increment added in `0.4.x`.
- No Phase 3 scope has been pulled in silently. There is still no scheduler, durable outbox, unattended retry loop, or automatic re-login.
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

1. Run the Phase 2 stack on `dev-vm` with a real Plaud token and validate the full UI flow. Backend schema still accepts `scene` for programmatic callers; the UI now hides it.
2. Confirm that filtered backfill works against real Plaud metadata, especially `serialNumber` and date-range filters (these are the filters the UI surfaces).
3. Confirm webhook delivery against the real downstream target.
4. Create the Doppler project `plaud-mirror` before moving past `dev-vm`.
5. Start Phase 3 only after the live Phase 2 validation is documented.

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
