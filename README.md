<!-- doc-version: 0.12.0 -->
# Plaud Mirror

Self-hosted Plaud audio mirror with a local operator panel, manual sync/backfill controls, and Docker deployment.

**Version:** see [VERSION](VERSION) | [CHANGELOG](CHANGELOG.md)

## Overview

Plaud Mirror is an operator-run service for mirroring Plaud recordings into local storage and notifying downstream systems through a generic webhook. It is intentionally audio-first: it validates auth, lists recordings, downloads the original artifact, stores it in a predictable layout, and hands off the result.

The repository now contains the full Phase 2 slice, the complete Phase 3 runtime, the Phase 4 operator UX, the Phase 5 Home Infra Protocol integration, and the first Phase 6 operator fit-and-finish slice: operator-controllable scheduler (since v0.5.2), durable webhook outbox (since v0.5.3), full health observability with cross-subsystem `lastErrors` ring buffer + `recentSyncRuns` history (since v0.5.5), browser-assisted re-auth (since v0.7.0/v0.8.0), a reference-driven five-screen panel (since v0.9.0), a protocol sync-job status surface (since v0.10.0), and explicit permanent Plaud deletion for already-dismissed recordings (since v0.11.0):

- Fastify admin API
- React/Vite web panel with Main, Library, Backfill, Configuration, and Operations screens
- local Chrome companion extension for no-DevTools Plaud re-auth
- encrypted persisted bearer-token auth
- **async** manual sync and filtered historical backfill (returns `202` with a run id, UI polls for live progress)
- backfill dry-run preview: see exactly which recordings would be downloaded before clicking "Run backfill"
- cached device catalog populated from Plaud's `/device/list`, feeding a real device selector in the backfill form
- local recording index in SQLite with stable `#N` ranks anchored to Plaud's full timeline
- search, 50/100/150 pagination, and compact/full inline audio playback with HTTP Range support
- reversible local dismiss/restore plus an optional, separately confirmed
  permanent Plaud deletion available only after local dismissal; deletion
  attempts are journaled and uncertain outcomes become explicit retry states
- HMAC-signed webhook delivery via a **durable outbox** (v0.5.3+): each successful sync enqueues the payload, a worker uses eight exponential-backoff waits (30s → 8h) before a ninth final attempt, and Operations surfaces active/failed state plus Retry controls. Counters on `/api/health.outbox`.
- **opt-in continuous sync scheduler** configured from the Configuration screen of the panel (interval in minutes, `0` disables, hot-applied without container restart); status surfaced via the `scheduler` block on `/api/health`
- **Home Infra Protocol sync-job status**: `infra.contract.yml` declares `plaud-mirror-recordings-sync`, and `/api/protocol/sync-jobs/plaud-mirror-recordings-sync/status` publishes a sanitized `status-snapshot` for Infra Portal/Hermes-style consumers
- generation-based coverage that proves the current Plaud inventory against
  physical local artifacts while reporting historical tombstones separately
- Spanish/English operator chrome persisted in browser storage, with a labeled mobile view selector and compact mobile status chips
- Docker packaging for `dev-vm`, running as non-root `USER 1000:1000`

The current re-auth path is browser-assisted: the panel starts a one-time capture session and the local Chrome extension sends the Plaud browser token back through `/connect`. The v0.9.x panel absorbs `docs/design/reference/plaud-mirror-panel-standalone.html` as its visual source reference, uses a full-viewport production shell on wide monitors, makes the Main cockpit's "Sync missing" action download the displayed missing count instead of inheriting the Backfill form's conservative limit, and keeps the mobile shell readable with labeled navigation and compact status chips. Resumable backfill, fully unattended re-login, and NAS rollout remain later phases.

## Operator Posture

Plaud Mirror is for personal/operator use against the operator's own Plaud account. It is not a hosted multi-tenant service and does not present itself as a redistribution layer for Plaud-sourced audio.

## Quick Start

### Local Node Run

Prerequisites:

- Node `>=20`
- `PLAUD_MIRROR_MASTER_KEY` set
- `PLAUD_MIRROR_ADMIN_PASSPHRASE` set (recommended) — the operator passphrase that protects the panel and API. When unset, the API runs open (pre-0.6.0 behavior) and `/api/health` carries a warning.

```bash
cd ~/src/plaud-mirror
npm install

export PLAUD_MIRROR_MASTER_KEY="<long-random-secret>"
export PLAUD_MIRROR_ADMIN_PASSPHRASE="<operator-passphrase>"
npm start
```

Then open `http://localhost:3040`.

### Docker on `dev-vm`

```bash
cd ~/src/plaud-mirror
doppler run --project plaud-mirror --config dev -- docker compose up -d --build
```

The `dev-vm` deployment keeps operator access control in Doppler (`plaud-mirror/dev`). A bare `docker compose up` can recreate the container without `PLAUD_MIRROR_ADMIN_PASSPHRASE` and disarm the panel lock unless the same value is also present in a local `.env`.

If Docker Hub is timing out, the Dockerfile accepts `PLAUD_MIRROR_DOCKER_BUILD_IMAGE` and `PLAUD_MIRROR_DOCKER_RUNTIME_IMAGE` build-arg overrides so you can point the build at a locally cached Node base. Acceptable substitutes:

- a Node slim or alpine image already cached by another project on the same host;
- a `node:20-bookworm-slim` image side-loaded via `docker save` / `docker load`;
- a pull-through registry mirror on your infra (see the open item in `~/src/home-infra/docs/PROJECTS.md`).

Pentesting distributions such as `vxcontrol/kali-linux:latest` are **not** acceptable substitutes. Kali is a security-tooling base, inflates the attack surface of this service, and does not belong in a Plaud mirror's runtime — even if it happens to be cached locally for an unrelated project.

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
doppler run --project plaud-mirror --config dev -- docker compose up -d --build
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
| [docs/INFRA_CONTRACT.md](docs/INFRA_CONTRACT.md) | Home Infra Protocol project contract and sync-job status |
| [docs/operations/API_CONTRACT.md](docs/operations/API_CONTRACT.md) | Actual HTTP and webhook surface |
| [docs/operations/AUTH_AND_SYNC.md](docs/operations/AUTH_AND_SYNC.md) | Auth model and sync behavior |
| [docs/operations/DEPLOY_PLAYBOOK.md](docs/operations/DEPLOY_PLAYBOOK.md) | Docker deployment and rollback |
| [docs/UPSTREAMS.md](docs/UPSTREAMS.md) | Which upstreams are tracked, what is adopted, what is rejected |
| [PRODUCT.md](PRODUCT.md) | Operator, product-purpose, and interaction principles |
| [DESIGN.md](DESIGN.md) | Current operator-panel visual system and component rules |
| [docs/llm/DECISIONS.md](docs/llm/DECISIONS.md) | Long-form rationale for non-obvious choices (D-001..D-021) |
| [docs/llm/HANDOFF.md](docs/llm/HANDOFF.md) | Current implementation snapshot |

## Contributing

- Every new runtime case must add or update tests in the same session.
- Runtime work is not done until the relevant suite passes locally.
- Scope changes must be reflected in `docs/ROADMAP.md`, not only in code or handoff notes.

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.
