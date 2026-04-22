<!-- doc-version: 0.3.1 -->
# Plaud Mirror

Self-hosted Plaud audio mirror with a local web panel, manual sync/backfill controls, and Docker deployment.

**Version:** see [VERSION](VERSION) | [CHANGELOG](CHANGELOG.md)

## Overview

Plaud Mirror is an operator-run service for mirroring Plaud recordings into local storage and notifying downstream systems through a generic webhook. It is intentionally audio-first: it validates auth, lists recordings, downloads the original artifact, stores it in a predictable layout, and hands off the result.

The repository now contains the first usable internal slice:

- Fastify admin API
- React/Vite web panel
- encrypted persisted bearer-token auth
- manual sync and filtered historical backfill
- local recording index in SQLite
- immediate HMAC-signed webhook delivery with persisted delivery attempts
- Docker packaging for `dev-vm`

Continuous sync, resumable backfill, retry outbox, and automatic re-login are explicitly later phases.

## Operator Posture

Plaud Mirror is for personal/operator use against the operator's own Plaud account. It is not a hosted multi-tenant service and does not present itself as a redistribution layer for Plaud-sourced audio.

## Quick Start

### Local Node Run

Prerequisites:

- Node `>=20`
- `PLAUD_MIRROR_MASTER_KEY` set

```bash
cd ~/src/plaud-mirror
npm install

export PLAUD_MIRROR_MASTER_KEY="<long-random-secret>"
npm start
```

Then open `http://localhost:3040`.

### Docker on `dev-vm`

```bash
cd ~/src/plaud-mirror
export PLAUD_MIRROR_MASTER_KEY="<long-random-secret>"
docker compose up --build
```

If Docker Hub is timing out on this `dev-vm`, force the build to reuse the cached local Kali image:

```bash
export PLAUD_MIRROR_DOCKER_BUILD_IMAGE="vxcontrol/kali-linux:latest"
export PLAUD_MIRROR_DOCKER_RUNTIME_IMAGE="vxcontrol/kali-linux:latest"
docker compose up --build
```

That fallback no longer depends on `apt` inside the container build. The local image already provides `node`, `corepack`, and the build tools needed by the current dependency set, so the build can stay inside Docker even when both Docker Hub and Kali package mirrors are unreliable.

Runtime data lands in:

- `./runtime/data`
- `./runtime/recordings`

## Phase 1 Spike

The original CLI spike is still available for direct Plaud probing:

```bash
export PLAUD_MIRROR_ACCESS_TOKEN="<your-bearer-token>"
npm run spike -- probe --limit 100 --download-first
```

This remains useful for live Plaud validation and metadata discovery.

## What Works Today

```bash
npm test
npm start
docker compose up --build
scripts/check-version-sync.sh
scripts/dockit-validate-session.sh --human
```

## Documentation

| Document | Purpose |
|----------|---------|
| [LLM_START_HERE.md](LLM_START_HERE.md) | Entry point for LLM contributors |
| [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) | Product intent and current state |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Canonical phase boundaries |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Runtime structure and flow design |
| [docs/operations/API_CONTRACT.md](docs/operations/API_CONTRACT.md) | Actual HTTP and webhook surface |
| [docs/operations/AUTH_AND_SYNC.md](docs/operations/AUTH_AND_SYNC.md) | Auth model and sync behavior |
| [docs/operations/DEPLOY_PLAYBOOK.md](docs/operations/DEPLOY_PLAYBOOK.md) | Docker deployment and rollback |
| [docs/llm/HANDOFF.md](docs/llm/HANDOFF.md) | Current implementation snapshot |

## Contributing

- Every new runtime case must add or update tests in the same session.
- Runtime work is not done until the relevant suite passes locally.
- Scope changes must be reflected in `docs/ROADMAP.md`, not only in code or handoff notes.

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.
