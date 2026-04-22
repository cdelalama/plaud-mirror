<!-- doc-version: 0.2.1 -->
# Deploy Playbook

This runbook describes the intended Docker deployment path for Plaud Mirror.

## Scope

- Local or server deployment with Docker or Docker Compose
- Rolling forward to a new Plaud Mirror version
- Rolling back after a failed release

## Preconditions

- Docker host available
- Persistent volumes prepared for `data/` and `recordings/`
- Master encryption key supplied through Docker secret or `PLAUD_MIRROR_MASTER_KEY`
- Optional Plaud credentials or bearer token available

## Deploy Steps

1. Confirm the target version and image:
   - Version: `<x.y.z>`
   - Image tag: `<registry>/plaud-mirror:<x.y.z>`
2. Back up persistent data:
   - `data/`
   - `recordings/`
3. Apply deployment:
   - pull or build the new image
   - restart the stack
4. Post-deploy validation:
   - `GET /api/health`
   - web UI loads
   - auth status renders
   - manual sync can be triggered
5. Monitor:
   - application logs
   - auth status
   - first scheduler run

## Rollback Steps

1. Identify the previous image tag.
2. Stop the new deployment.
3. Redeploy the previous image.
4. Restore backed-up data only if the new version wrote incompatible state.
5. Re-run health and sync smoke tests.

## Smoke Tests

- `GET /api/health` returns success
- `GET /api/auth/status` returns a sane mode and status
- `POST /api/sync/run` starts a sync without crashing
- New recordings still land in `recordings/<recording-id>/`

## Observability Notes

- Logs should show auth validation, sync start/end, and delivery outcome
- Failed auth renewal is a release blocker for production use
- Upstream-watch alerts should be reviewed before production deploys if Plaud changed recently
