<!-- doc-version: 0.3.0 -->
# LLM Work Handoff

This file is the live operational snapshot. Durable rationale lives in `docs/llm/DECISIONS.md`. Phase boundaries live in `docs/ROADMAP.md`.

## Current Status

- Last Updated: 2026-04-22 - Codex GPT-5
- Session Focus: Validate the new Phase 2 web+Docker slice on `dev-vm` with a real Plaud token and confirm the live backfill/webhook path
- Status: `v0.3.0` is now the first usable internal slice. The repo contains a Fastify API, React/Vite panel, encrypted persisted bearer-token auth, manual sync and filtered historical backfill, SQLite-backed recording and delivery state, HMAC-signed webhook delivery, Docker packaging for `dev-vm`, and the original Phase 1 CLI spike for direct Plaud probing. The gap is no longer "there is no UI"; the remaining gaps are live Plaud validation, scheduler/outbox resilience, automatic re-login, and NAS rollout.

## What Landed

- `apps/api` now serves the admin API and the built web panel.
- `apps/web` now contains the product panel for token setup, webhook config, sync/backfill controls, and recordings visibility.
- Secrets now persist encrypted at rest via `PLAUD_MIRROR_MASTER_KEY`.
- Runtime state now persists in SQLite.
- Docker launch path now exists via `Dockerfile` and `compose.yml`.
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

- Export `PLAUD_MIRROR_MASTER_KEY` on `dev-vm`.
- Start the service:
  `docker compose up --build`
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
- Docker packaging was implemented in-session, but live `docker compose` validation still needs the target `dev-vm`.
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
