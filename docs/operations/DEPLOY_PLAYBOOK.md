<!-- doc-version: 0.3.0 -->
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
