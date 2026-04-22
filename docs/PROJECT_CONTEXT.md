<!-- doc-version: 0.1.1 -->
# Project Context - Plaud Mirror

## Vision

Build a self-hosted service that mirrors Plaud audio recordings to local infrastructure reliably, with minimal operator friction. The project exists because Plaud's official export flow is manual and not designed for server-side automation, while many downstream uses only need the audio artifact and a stable handoff into another pipeline.

## Objectives

- Keep Plaud authentication alive with minimal human intervention.
- Detect and download new recordings automatically.
- Persist mirrored audio locally in a predictable, automation-friendly layout.
- Offer a small web UI for configuration, visibility, and manual control.
- Emit clean downstream delivery signals so another system can run speech-to-text.
- Track ecosystem upstreams and surface changes that could improve or break Plaud Mirror.

## Stakeholders

- Product owner: `cdelalama`
- Technical owner: Plaud Mirror core maintainers
- Primary users: Self-hosting operators who want their Plaud audio on their own server
- Additional stakeholders: Downstream STT/indexing services, home infrastructure operators

## Architectural Overview

Plaud Mirror is planned as a Docker-first service with two main runtime surfaces: a backend API/worker and a web UI. The backend owns auth, scheduling, downloading, storage, webhook delivery, and upstream-watch automation. The UI is intentionally operational, not consumer-facing: configuration, sync status, auth status, and local artifact visibility.

The system is designed around an audio-first contract. It does not need to own transcription. Its core promise is: "if a recording appears in Plaud, Plaud Mirror should stay logged in long enough to detect it, mirror it locally, and notify the next system."

## Key Components

| Component | Purpose | Owner | Notes |
|-----------|---------|-------|-------|
| Auth Manager | Maintain Plaud session state and token freshness | Core | Manual bearer-token first; optional credential-based re-login later |
| Plaud Adapter | Encapsulate Plaud API calls and regional quirks | Core | Inspired by existing reverse-engineered clients, but not locked to a single upstream |
| Sync Engine | Poll for new recordings, queue downloads, retry failures | Core | Audio-first behavior for v1 |
| Artifact Store | Persist audio and sync metadata locally | Core | Predictable on-disk layout for downstream automation |
| Web UI | Show config, health, auth status, recordings, and manual actions | Core | Operational UI, not a public portal |
| Upstream Watch | Detect useful changes in upstream repos | Core | Focus on auth, token handling, and download flow changes |

## Current Status (2026-04-22)

Plaud Mirror `v0.1.1` is a repository and architecture bootstrap. The project now has:
- a concrete name and product scope
- a public GitHub repository: `https://github.com/cdelalama/plaud-mirror`
- an initial published baseline on `main`
- a downstream `LLM-DocKit` setup
- architecture and operations docs
- an upstream baseline manifest plus checker script
- an explicit policy for licensing boundaries and upstream reuse
- a converged implementation plan for the first usable release on `dev-vm`

The runtime service does not exist yet. No Plaud auth, download, Docker image, or UI implementation has been committed. The current plan is manual-token-first, with a small product UI, filtered historical backfill, and generic HMAC-signed webhook delivery in the first usable release; automatic re-login is explicitly deferred.

## Upcoming Milestones

1. Phase 1: Plaud spike on `dev-vm` to validate manual-token auth, recordings listing, real audio download, and actual metadata/filter shape
2. Phase 2: first usable internal release with product UI, encrypted persisted manual-token auth, filtered historical backfill, and HMAC-signed generic webhook delivery
3. Phase 3: continuous sync and resilience with scheduler, resumable backfill, and stronger health/status surfaces
4. Phase 4: optional automatic re-login if a reliable non-browser path exists
5. Phase 5: deployment hardening and NAS rollout
6. Phase 6: OSS preparation and public-facing quickstart/documentation tightening

## References

- [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/UPSTREAMS.md](UPSTREAMS.md)
- [docs/operations/AUTH_AND_SYNC.md](operations/AUTH_AND_SYNC.md)
- Plaud export help: <https://support.plaud.ai/hc/en-us/articles/51573949068697-How-to-export-my-data>
- Plaud developer overview: <https://plaud.mintlify.app/documentation/get_started/overview>
