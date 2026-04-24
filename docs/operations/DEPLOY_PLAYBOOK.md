<!-- doc-version: 0.4.16 -->
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

If Docker Hub is timing out when pulling `node:20-bookworm-slim` on `dev-vm`, the Dockerfile accepts `PLAUD_MIRROR_DOCKER_BUILD_IMAGE` and `PLAUD_MIRROR_DOCKER_RUNTIME_IMAGE` build-arg overrides so you can point at a locally cached Node base instead. Acceptable substitutes are any legitimate Node runtime image:

- a Node `slim` or `alpine` image already cached by another project on the same host (e.g. `node:20-alpine`, `node:20-slim`);
- a `node:20-bookworm-slim` side-loaded via `docker save` / `docker load` from another machine;
- a pull-through registry mirror on your infra (see the open registry-mirror item in `~/src/home-infra/docs/PROJECTS.md`).

Example with a locally cached Node slim image:

```bash
export PLAUD_MIRROR_DOCKER_BUILD_IMAGE="node:20-alpine"
export PLAUD_MIRROR_DOCKER_RUNTIME_IMAGE="node:20-alpine"
docker compose up --build -d
```

The fallback path uses `corepack npm` inside the container build and does not rely on `apt` to install `npm`, `node`, or build tools, so any Node-capable base without an `npm` binary on `PATH` works.

**Do NOT** substitute a pentesting or general-purpose Linux distribution as the Node base. `vxcontrol/kali-linux:latest` in particular is explicitly rejected: Kali is a security-tooling base, it inflates the attack surface of this service, it bloats the image, and it ships tooling that has no place in a Plaud mirror's runtime — even if it happens to be cached locally for an unrelated project. Same rule for any distro image whose purpose is not "run Node.js applications".

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
