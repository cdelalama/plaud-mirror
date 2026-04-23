<!-- doc-version: 0.4.3 -->
# LLM Work Handoff

This file is the live operational snapshot. Durable rationale lives in `docs/llm/DECISIONS.md`. Phase boundaries live in `docs/ROADMAP.md`.

## Current Status

- Last Updated: 2026-04-23 - Claude Opus 4.7
- Session Focus: Fix the "Delete local mirror" button returning 400 from the web UI while the same DELETE worked from `curl` / direct `fetch()`. Root cause was `requestJson` in `apps/web/src/App.tsx` always attaching `Content-Type: application/json`, including on body-less DELETE / POST calls, which made Fastify's default body parser reject the empty body. Ship `v0.4.3`, rebuild, push. Prose sweep applied to ROADMAP/PROJECT_CONTEXT/ARCHITECTURE per the new `feedback_prose_version_drift.md` memory.
- Status: `v0.4.3` ships a 5-line fix in `requestJson` — the JSON content-type header is only attached when `init.body` is actually present. This unblocks the operator's dismiss/restore flow from the UI (the backend routes had always worked, as confirmed by hitting `DELETE /api/recordings/<id>` directly from the browser console during the same-day diagnostic). 37/37 tests still pass (the bug was in how the browser constructed the request, not in a covered backend path). Prose version drift from the 0.4.2 bump is also cleaned up in the same release.

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

- `docker compose up --build -d`: verified locally on `dev-vm`
- Container: `plaud-mirror-plaud-mirror-1` is up
- Port binding: `0.0.0.0:3040->3040`
- Health check: `GET /api/health` returns `200`
- Current health payload is expected:
  - service healthy
  - no Plaud token configured yet
  - no recordings mirrored yet
- Persistent paths:
  - `runtime/data`
  - `runtime/recordings`

## What Is Still Not Verified

- Real Plaud bearer token validation through the web UI
- Real filtered backfill against live Plaud metadata
- Real webhook delivery into the downstream receiver
- Any unattended behavior from Phase 3 onward

Do not speak as if Plaud audio has already been mirrored in this environment. The stack is up, but live Plaud validation is still pending.

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

1. Run the Phase 2 stack on `dev-vm` with a real Plaud token and validate the full UI flow.
2. Confirm that filtered backfill works against real Plaud metadata, especially `serialNumber` and `scene`.
3. Confirm webhook delivery against the real downstream target.
4. Create the Doppler project `plaud-mirror` before moving past `dev-vm`.
5. Start Phase 3 only after the live Phase 2 validation is documented.

## Open Questions

- Which non-date backfill filters remain worth exposing after real Plaud validation?
- What retry and scheduler defaults are safe enough for Phase 3?
- Can automatic re-login be implemented without browser automation?

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

## Do Not Touch

- `config/upstreams.tsv` without documenting the baseline change
- `docs/UPSTREAMS.md` licensing boundaries without explicit user approval
- `.dockit-config.yml` external-context paths unless the infra-doc repo moved
