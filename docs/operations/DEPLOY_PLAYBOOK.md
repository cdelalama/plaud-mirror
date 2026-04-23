<!-- doc-version: 0.4.4 -->
# Deploy Playbook

This runbook describes the actual Phase 2 Docker deployment path for Plaud Mirror.

## Scope

- Launching Plaud Mirror on `dev-vm`
- Updating to a new version
- Rolling back a failed deployment

## Preconditions

- Docker and Docker Compose available
- `PLAUD_MIRROR_MASTER_KEY` set in the shell or compose environment
- Persistent host paths available for:
  - `./runtime/data`
  - `./runtime/recordings`

## First Deploy

```bash
cd ~/src/plaud-mirror
export PLAUD_MIRROR_MASTER_KEY="<long-random-secret>"
docker compose up --build -d
```

If Docker Hub is timing out when pulling `node:20-bookworm-slim` on `dev-vm`, use the cached local fallback image:

```bash
export PLAUD_MIRROR_DOCKER_BUILD_IMAGE="vxcontrol/kali-linux:latest"
export PLAUD_MIRROR_DOCKER_RUNTIME_IMAGE="vxcontrol/kali-linux:latest"
docker compose up --build -d
```

This fallback now uses `corepack npm` inside the container build and does not rely on `apt` to install `npm`, `node`, or build tools. That matters on this `dev-vm`, because Docker Hub and Kali mirrors have both shown intermittent timeouts.

Then open `http://<host>:3040`.

## Upgrade

```bash
cd ~/src/plaud-mirror
git pull
docker compose up --build -d
```

## Validation

1. `GET /api/health` returns `200`
2. Web panel loads
3. Token can be saved from the UI
4. Manual sync or backfill can be triggered
5. Mirrored files appear in `runtime/recordings`

## Rollback

1. Stop the new container:

```bash
docker compose down
```

2. Check out the previous git revision or tag.
3. Rebuild and relaunch:

```bash
docker compose up --build -d
```

## Notes

- The current container is a single-process Phase 2 slice: API plus static web panel.
- Scheduler and resilient retry loops are not part of this deployment yet; they arrive in Phase 3.
