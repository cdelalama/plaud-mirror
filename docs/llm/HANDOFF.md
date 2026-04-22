<!-- doc-version: 0.3.1 -->
# LLM Work Handoff

This file is the live operational snapshot. Durable rationale lives in `docs/llm/DECISIONS.md`. Phase boundaries live in `docs/ROADMAP.md`.

## Current Status

- Last Updated: 2026-04-22 - Codex GPT-5
- Session Focus: Validate the live UI flow with a real Plaud token now that the Phase 2 Docker slice is up on `dev-vm`, and confirm the backfill/webhook path
- Status: `v0.3.1` keeps the Phase 2 usable slice intact and fixes the deployment blocker seen on this `dev-vm`: the Docker build can now override its base images, the local cached `vxcontrol/kali-linux:latest` fallback no longer depends on `apt` because the build uses `corepack npm` directly, and `docker compose up --build -d` has been verified locally with `/api/health` returning `200`. The remaining gaps are live Plaud validation, scheduler/outbox resilience, automatic re-login, and NAS rollout.

## What Landed

- `apps/api` now serves the admin API and the built web panel.
- `apps/web` now contains the product panel for token setup, webhook config, sync/backfill controls, and recordings visibility.
- Secrets now persist encrypted at rest via `PLAUD_MIRROR_MASTER_KEY`.
- Runtime state now persists in SQLite.
- Docker launch path now exists via `Dockerfile` and `compose.yml`.
- Docker now supports build/runtime base-image overrides so this `dev-vm` can reuse the local cached Kali image when Docker Hub is flaky.
- The fallback Docker path now avoids `apt` entirely and builds with `corepack npm`, which removes the second network dependency that was still breaking on Kali mirrors.
- The Phase 2 container has now been built and started successfully on `dev-vm`; the service is reachable on port `3040` and reports the expected "missing token" health state.
- The Phase 1 spike now measures download byte count from the written file, not only `content-length`.
- `docs/ROADMAP.md` now defines the phases explicitly so Phase 2 and Phase 3 do not blur together again.

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
- If Docker Hub times out on this `dev-vm`, use:
  `PLAUD_MIRROR_DOCKER_BUILD_IMAGE=vxcontrol/kali-linux:latest PLAUD_MIRROR_DOCKER_RUNTIME_IMAGE=vxcontrol/kali-linux:latest docker compose up --build -d`
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
