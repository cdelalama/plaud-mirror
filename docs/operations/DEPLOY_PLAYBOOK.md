<!-- doc-version: 0.16.3 -->
# Deploy Playbook

This runbook separates local development, NAS production, upgrades, migration,
validation, and rollback. Source, published image, running container, public
ingress, and Home Infra observation are separate claims.

## Runtime ownership

- `dev-vm`: local development and the retained pre-NAS rollback source.
- NAS: production runs the accepted immutable `v0.16.1` image using
  `deploy/nas/`; source `v0.16.2` supplied the corrected host verifier and
  `v0.16.3` reconciles only the project-owned placement contract. Neither
  recreates the runtime.
- `edge-caddy`: the sole public ingress for
  `https://plaud.lamanoriega.com/`.
- Plaud Mirror: owns its SQLite state, encrypted secret blob, recording files,
  in-process PT15M scheduler, and public Home Infra Protocol snapshot.

Never run the dev-vm and NAS containers together. Both contain the same
persisted scheduler and are not a distributed active/passive pair.

## Development on dev-vm

Preconditions:

- Docker and Docker Compose are available.
- `PLAUD_MIRROR_MASTER_KEY` and `PLAUD_MIRROR_ADMIN_PASSPHRASE` are supplied.
- Current development secrets come from `doppler://plaud-mirror/dev`.

```sh
cd ~/src/plaud-mirror
doppler run --project plaud-mirror --config dev -- docker compose up -d --build
```

Every recreate must remain Doppler-wrapped unless an equivalent gitignored
environment is deliberately installed. A bare recreate can omit the admin
passphrase and disarm operator authentication. Verify `/api/session` reports
`authRequired: true`.

If Docker Hub cannot supply `node:24-bookworm-slim`, the Dockerfile accepts
`PLAUD_MIRROR_DOCKER_BUILD_IMAGE` and `PLAUD_MIRROR_DOCKER_RUNTIME_IMAGE`.
Use only a Node 24.15-or-newer slim/alpine image or a side-loaded official Node
image. Never substitute a pentesting/general-purpose distribution.

## NAS production assets

Production files live in `/share/Container/compose/plaud-mirror/` and are
copied from `deploy/nas/` at the accepted source revision. The source tree is
built on dev-vm; NAS pulls the immutable image from the private registry.

Persistent state is split by growth profile:

- `/share/Container/runtime/plaud-mirror/data` for `app.db`, WAL/SHM files,
  encrypted `secrets.enc`, and small retained database backups;
- `/share/ProjectsData/plaud-mirror/recordings` for mirrored audio, metadata,
  and active `.delivery-artifacts` leases.

Both leaves must use the live-verified QNAP identity UID/GID 1000:100, mode
0700. The NAS administrator and
host remain inside the trust boundary. The service runs with a read-only root,
all Linux capabilities dropped, `no-new-privileges`, a PID/memory ceiling,
and only `127.0.0.1:3040` published.

`deploy/nas/.env` is untracked, mode 0600, and contains only the read-only
`plaud-mirror/prd` Doppler service token. `start.sh` downloads the config to a
mode-0600 file on the NAS host `/tmp` tmpfs (observed as 64 MB at migration
preflight and re-checked by filesystem type on every launch), validates required keys and an
immutable image reference, uses it only for the current Compose invocation,
and removes it on every exit path. Full production values are therefore not
persisted in the compose share or captured by its snapshots. The launcher does
not start or repair Container Station and does not edit `edge-caddy`.
Launcher receipts are pre-created under `umask 077` at mode 0600. The
`docker compose config --quiet` flag is mandatory because a rendered Compose
configuration would disclose production values into that log.

```sh
cd /share/Container/compose/plaud-mirror
./start.sh
```

Normal migration startup requires non-empty `app.db`, `secrets.enc`,
recordings, and `.migration-ready-v1`, then runs a read-only SQLite integrity
probe inside the pinned application image before startup. The migration command
sets `PLAUD_MIRROR_REQUIRE_QUIESCED=true` so that same probe also requires zero
active work. Ordinary upgrades omit it: retry-waiting/processing rows are
legitimate and orphaned running/delivering rows require application startup
recovery. Never use the empty-install override for orphan recovery.
`PLAUD_MIRROR_ALLOW_EMPTY_STATE=true` is reserved for an explicit new-install
decision, starts with scheduling disabled until configured, and must not be
used to bypass a failed migration.

## First NAS migration

Follow
[`NAS_MIGRATION_2026-09-13.md`](NAS_MIGRATION_2026-09-13.md). Its gates are
mandatory:

1. audited source candidate and immutable published image;
2. secret-safe `plaud-mirror/prd` escrow preserving the historical master key;
3. live-safe recordings pre-seed only;
4. zero active work, source stop, WAL checkpoint, SQLite integrity, and final
   authoritative data copy;
5. direct loopback NAS acceptance, including authenticated static and Range
   playback, before the proxy changes;
6. backed-up and validated single-vhost Caddy reload;
7. canonical HTTPS, audio Range, protocol, and first automatic-run evidence;
8. Home Infra projection only after serving truth exists.

## NAS upgrade

1. Freeze and audit the release candidate.
2. Build and push the version tag from dev-vm.
3. Resolve and record the registry digest; update
   `PLAUD_MIRROR_IMAGE=registry.lamanoriega.com/plaud-mirror:<version>@sha256:<digest>`
   in `plaud-mirror/prd` without printing it.
4. Require `activeRun: null` and no currently claimed (`delivering`) outbox
   work. Pending/retry-waiting deliveries may survive an ordinary upgrade;
   application startup recovery owns any crash-orphaned running/delivering
   rows.
5. Back up SQLite coherently through the SQLite Online Backup API or after the
   service is stopped. Never copy only `app.db` while WAL is active.
6. Run NAS `./start.sh`; it pulls and recreates only `plaud-mirror`.
7. Validate every surface below. A runtime-affecting upgrade resets the joint
   Plaud/Media2Text observation clock defined by D-026.

## Validation

Require all applicable evidence:

1. Docker reports `plaud-mirror` healthy and its immutable image digest matches
   the accepted registry reference.
2. `/app/VERSION`, local `/api/health.version`, and the intended release agree.
3. `/api/session` reports `authRequired: true`; anonymous protected routes
   return 401.
4. `/api/health` shows Plaud auth healthy, `activeRun: null`, exact physical
   coverage, and truthful retained errors/outbox state.
5. `/api/protocol/sync-jobs/plaud-mirror-recordings-sync/status` returns the
   expected job, a future `next_run_at`, and no secrets or private errors.
6. Direct NAS root/static assets load and one real recording supports
   authenticated HTTP Range playback before Caddy changes.
7. Canonical HTTPS loads through Caddy; direct NAS plaintext is loopback-only.
8. The first automatic PT15M run completes on the NAS with no duplicate writer.
9. Home Infra/Infra Portal show `host_id: nas`, the accepted Plaud contract
   source, current observation, and no provenance warning.

Validation never invokes permanent Plaud deletion, replay, credential
rotation, a new paid transcription, or generic webhook delivery without their
separate gates.

## Host reboot without deployment

Before a planned shutdown, require `activeRun: null` where practical. Compose
uses `restart: unless-stopped`; Docker should restart the accepted existing
image without a rebuild or secret download. After boot, validate Docker,
session auth, health, protocol status, and the first subsequent automatic run.

Do not run `up --build` merely because a host rebooted. A long outage may make
the Home Infra observation stale; that is truthful until a new producer
snapshot arrives.

## Rollback

For an image-only upgrade, set `PLAUD_MIRROR_IMAGE` back to the prior immutable
tag/digest and run `./start.sh`. If a database migration is not backward
compatible, restore its coherent pre-upgrade backup before starting the prior
image.

For the first host migration, restore the backed-up Plaud Caddy upstream,
stop the NAS writer with the fixed Container Station Docker binary, reconcile
any NAS-side state change, restore the old container's restart policy, and only
then restart the unchanged Doppler-wrapped dev-vm runtime. Never run both
schedulers. The old dev-vm data is retained until NAS serving, observation,
backup, and explicit cleanup gates are complete. The one-time migration
runbook carries the literal stop/restart commands so rollback does not depend
on a removed temporary Compose env file.
