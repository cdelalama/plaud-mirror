<!-- doc-version: 0.16.2 -->
# NAS Migration - 2026-09-13

## Scope and authority

The operator authorized moving Plaud Mirror from `dev-vm` to NAS because the
117 GB dev-vm filesystem is under pressure. This slice may build and publish a
Plaud Mirror image, provision the existing runtime values into
`plaud-mirror/prd`, copy Plaud Mirror state, start its NAS container, change
only the Plaud `edge-caddy` upstream, and update the owning and observing
repositories. It does not authorize historical transcription replay, Cortex
delivery, provider spend, connection-control implementation, Container
Station repair, unrelated NAS changes, or premature deletion of the rollback
source.

## Verified preflight

Observed at 2026-09-13 21:31-21:47 UTC before any runtime mutation:

- Plaud source is clean `main` at `57f1f9b`, version `0.15.1`; runtime remains
  `0.15.0` from image digest
  `sha256:10df26493fe5c08ec5fae1a7542587ded8938e935f28b201231798fb58ed237b`.
- dev-vm root is 117 GB, 98 GB used, 13 GB available (89%). The source-owned
  `runtime/` is 12 GB and contains 1,441 files.
- The running container is healthy, operator auth is required, Plaud auth is
  healthy, no sync is active, PT15M is enabled, and the public snapshot is
  `ok/none` at 720/720 with one historical upstream tombstone.
- Six consecutive runs failed while a newly discovered recording directory
  could not be created; the next run downloaded it and two later runs were
  clean. This is retained evidence, not relabelled as a healthy history.
- NAS Container Station is operational with 31 of 35 containers running.
  Host memory is 64 GB with about 12 GB available at preflight. The standard
  Container share has only 22.6 GB free, so recordings must not live there.
- `/share/ProjectsData` is a 1 TB dataset with about 968 GB free. Production
  uses it for recordings and keeps only small control state in
  `/share/Container/runtime`.
- NAS port 3040 and the Plaud compose/runtime paths were absent. Current
  `edge-caddy` routes only the Plaud hostname to
  `http://10.0.0.110:3040`.
- Live Docker inspection returned `HostConfig.NetworkMode=host` for
  `edge-caddy`, and `/usr/bin/wget` exists inside that container. The loopback
  upstream is valid only while this remains true; the pre-cutover gate below
  verifies both the mode and actual reachability from inside the proxy.
- `df -T /tmp` and `stat -f -c %T /tmp` identified NAS host `/tmp` as a
  64 MB `tmpfs`. `start.sh` rechecks the filesystem type before materializing
  full Doppler values there.
- `plaud-mirror/prd` contained no application values. The running container
  carried the 64-character historical master key; it must be escrowed without
  rotation so the migrated `secrets.enc` stays decryptable.
- Live cutover attempt 1 proved the SSH/storage identity is
  `uid=1000(cdelalama) gid=100(everyone)`, not the generic image identity
  1000:1000. QNAP denied the audited 1000:1000 ownership normalization, and
  its remapped Docker root could not bypass the dataset ACL. No NAS writer or
  Caddy change occurred; the old `v0.15.0` container was immediately restored
  healthy with `restart=unless-stopped`. `v0.16.1` pins the executable NAS
  identity to 1000:100, which the live account can enforce without privilege
  escalation.
- Attempt 2 passed the `v0.16.1` strict launcher, image-based SQLite probe, and
  direct authenticated runtime checks at 720/720. Container acceptance then
  exposed a verifier-only mismatch: Docker reports the declared `/share/*`
  bind source while `readlink -f` returns its backing `/share/ZFS*_DATA` path.
  Both mounts were independently inspected as RW and the NAS remains the only
  healthy writer; Caddy still targets the stopped dev-vm. `v0.16.2` changes
  only the source-owned host verifier so it compares the exact declared source
  paths. The accepted `v0.16.1` image stays running and is not rebuilt or
  recreated for this correction.

## Non-negotiable invariants

1. Exactly one Plaud scheduler may run. The dev-vm container is stopped and
   confirmed stopped before NAS startup.
2. A live SQLite file is never copied as a bare file. Final copy happens only
   after the source process stops, WAL checkpoint and `integrity_check` pass.
3. The historical master key and `secrets.enc` move together. A successful
   process start is not proof of decryption; Plaud auth must validate.
4. The pre-seed is not authoritative. A final stopped-source rsync plus exact
   checksum convergence, file/count/byte and SQLite checks precede a
   `.migration-ready-v1` receipt and startup.
5. Port 3040 is loopback-only on NAS. The existing HTTPS hostname stays stable
   and `edge-caddy` is the only operator ingress.
6. Home Infra changes from `dev-vm` to `nas` only after serving/runtime
   evidence exists. Home Infra Protocol requires no schema change; ForgeOS
   remains an artifact discoverer and receives no copied roadmap.
7. The old source is stopped and retained until post-cutover acceptance. It is
   not deleted by the migration procedure.

## Release and secret preparation

1. Freeze an exact `v0.16.2` source/host-asset candidate and run the repository suite, deploy
   asset tests, dependency audit, DocKit validator, and diff hygiene.
2. Run the independent read-only review required by `LLM_START_HERE.md` using
   exact `claude-fable-5-1` at high effort. Use exact
   `claude-opus-5[1m]` at high effort only after directly recording Fable quota
   exhaustion. Reconcile every finding before deployment.
3. Keep the already accepted runtime image pinned to
   `registry.lamanoriega.com/plaud-mirror:0.16.1@sha256:77e0872e829d24b3a711707d0df9a6f16585ad6376aa39f78e906a140acd0cbe`.
   `v0.16.2` is published as a source and NAS host-asset patch only: do not
   build or publish a `0.16.2` image, change `PLAUD_MIRROR_IMAGE`, run
   `start.sh`, or recreate the healthy `v0.16.1` container.
4. Copy only the required existing values to `plaud-mirror/prd` without
   printing them: the running master key, admin passphrase, and EU API base.
   Create a read-only production service token and keep it as the only value in
   NAS `deploy/nas/.env`, mode 0600. Full values are materialized only in the
   NAS `/tmp` tmpfs for one `start.sh` invocation and removed on every exit.

## Authoritative resume point after attempt 2

Attempt 2 completed release/secret preparation, the recordings pre-seed, and
quiesced cutover steps 1 through 6 below. The NAS `plaud-mirror` container is
now the only writer and its database may have advanced beyond the stopped
dev-vm copy. The completed commands are retained as historical and recovery
evidence; they are **not** the continuation path for attempt 2.

Resume only with this sequence:

1. Publish the audited `v0.16.2` source commit. Do not build an image or
   recreate the running `v0.16.1` container.
2. Copy only `deploy/nas/verify-container.sh` to
   `/share/Container/compose/plaud-mirror/`, preserve mode 0755, and require its
   local and NAS SHA-256 values to match.
3. Run the corrected container verifier and `verify-runtime.mjs` against the
   existing immutable `v0.16.1` container.
4. Continue with proxy cutover step 8 and canonical/first-automatic-run
   acceptance step 9.

Fail closed before any future use of pre-seed or quiesced-copy steps 4-5. They
may run only for a new migration attempt whose target has been proven
non-authoritative: the NAS `plaud-mirror` container must not exist or be
running, and an operator-approved recovery assessment must establish that the
target database is not newer than the declared source. The present attempt
does not satisfy that gate. Never rsync `runtime/data` or recordings from the
stopped dev-vm, rewrite `.migration-ready-v1`, or restart the dev-vm writer
while the current NAS database is authoritative.

## Completed data pre-seed record (do not rerun for attempt 2)

The source may continue running during this non-authoritative first pass. Do
not pre-seed `runtime/data` while SQLite is live.

```sh
cd /home/cdelalama/src/plaud-mirror
ssh nas.lamanoriega.com \
  'if [ -e /share/ProjectsData/plaud-mirror/recordings ]; then stat -c "%n %u:%g %a" /share/ProjectsData/plaud-mirror/recordings; getfacl -p /share/ProjectsData/plaud-mirror/recordings; else echo "/share/ProjectsData/plaud-mirror/recordings ABSENT"; fi; mkdir -p /share/ProjectsData/plaud-mirror/recordings && chmod 700 /share/ProjectsData/plaud-mirror/recordings'
rsync -rlt --delete-delay \
  runtime/recordings/ \
  nas.lamanoriega.com:/share/ProjectsData/plaud-mirror/recordings/
```

## Completed quiesced cutover record - steps 1-6 (do not rerun for attempt 2)

The following commands document the completed initial transfer and remain
useful only as controlled recovery reference under the refusal gate above.
They are not an attempt-2 resume procedure.

1. From the repository root, re-read `/api/health`; require
   `activeRun: null`. Require the following query to return exactly
   `0|0|0|0|0` (active run, actionable generic outbox, actionable media outbox,
   non-terminal media delivery, uncertain upstream deletion). Do not use the
   panel during the cutover.

   ```sh
   cd /home/cdelalama/src/plaud-mirror
   test "$(sqlite3 runtime/data/app.db "SELECT (SELECT count(*) FROM sync_runs WHERE status='running'), (SELECT count(*) FROM webhook_outbox WHERE state IN ('pending','delivering','retry_waiting')), (SELECT count(*) FROM media_delivery_outbox WHERE state IN ('pending','delivering','retry_waiting')), (SELECT count(*) FROM media_deliveries WHERE state IN ('pending','delivering','accepted','processing')), (SELECT count(*) FROM upstream_deletion_operations WHERE stage != 'confirmed');")" = "0|0|0|0|0"
   ```

2. Stop only Plaud Mirror on dev-vm and confirm the container is stopped:

   ```sh
   docker compose stop -t 90 plaud-mirror
   docker update --restart=no plaud-mirror-plaud-mirror-1
   docker compose ps
   test "$(docker inspect --format '{{.State.Running}}|{{.HostConfig.RestartPolicy.Name}}' plaud-mirror-plaud-mirror-1)" = "false|no"
   ```

3. Checkpoint and verify the now-quiescent database. Save a small local
   pre-cutover backup before copying:

   ```sh
   test "$(sqlite3 runtime/data/app.db 'PRAGMA wal_checkpoint(TRUNCATE);' | tail -n 1)" = "0|0|0"
   test "$(sqlite3 runtime/data/app.db 'PRAGMA integrity_check;')" = "ok"
   PLAUD_BACKUP="runtime/data/app.db.backup-$(date -u +%Y%m%dT%H%M%SZ)-pre-nas"
   sqlite3 runtime/data/app.db ".backup '$PLAUD_BACKUP'"
   test -s "$PLAUD_BACKUP"
   sha256sum "$PLAUD_BACKUP"
   ```

4. Prepare exclusive target leaves, then make the final authoritative copy:

   ```sh
   ssh nas.lamanoriega.com \
     'if [ -e /share/Container/runtime/plaud-mirror/data ]; then stat -c "%n %u:%g %a" /share/Container/runtime/plaud-mirror/data; getfacl -p /share/Container/runtime/plaud-mirror/data; else echo "/share/Container/runtime/plaud-mirror/data ABSENT"; fi; mkdir -p /share/Container/runtime/plaud-mirror/data /share/ProjectsData/plaud-mirror/recordings && setfacl -b /share/Container/runtime/plaud-mirror/data /share/ProjectsData/plaud-mirror/recordings && chmod 700 /share/Container/runtime/plaud-mirror/data /share/ProjectsData/plaud-mirror/recordings'
   rsync -rlt --delete-delay runtime/data/ \
     nas.lamanoriega.com:/share/Container/runtime/plaud-mirror/data/
   rsync -rlt --delete-delay runtime/recordings/ \
     nas.lamanoriega.com:/share/ProjectsData/plaud-mirror/recordings/
   ssh nas.lamanoriega.com \
     'set -eu; identity_check=$(mktemp /tmp/plaud-identity.XXXXXX); trap '\''rm -f "$identity_check"'\'' EXIT INT TERM; chown -R 1000:100 /share/Container/runtime/plaud-mirror/data /share/ProjectsData/plaud-mirror/recordings; find /share/Container/runtime/plaud-mirror/data /share/ProjectsData/plaud-mirror/recordings -type d -exec chmod 700 {} \;; find /share/Container/runtime/plaud-mirror/data /share/ProjectsData/plaud-mirror/recordings -type f -exec chmod 600 {} \;; find /share/Container/runtime/plaud-mirror/data /share/ProjectsData/plaud-mirror/recordings ! -user 1000 -print > "$identity_check"; test ! -s "$identity_check"; find /share/Container/runtime/plaud-mirror/data /share/ProjectsData/plaud-mirror/recordings ! -group 100 -print > "$identity_check"; test ! -s "$identity_check"'
   ```

5. Execute the exact convergence gate below. It requires a content-checksum
   dry run with no changes for both trees; matching source/target file counts
   and byte totals; matching `secrets.enc` and `app.db` SHA-256; source
   `integrity_check=ok`; and zero active rows. Only then write the receipt that
   `start.sh` requires. Its pre-start image probe repeats SQLite integrity and
   zero-active-work checks against the NAS-mounted database.

   ```sh
   PLAUD_DATA_DELTA="$(mktemp)"
   PLAUD_RECORDINGS_DELTA="$(mktemp)"
   trap 'rm -f "$PLAUD_DATA_DELTA" "$PLAUD_RECORDINGS_DELTA"' EXIT INT TERM
   rsync -rlt --checksum --delete --dry-run --itemize-changes runtime/data/ \
     nas.lamanoriega.com:/share/Container/runtime/plaud-mirror/data/ > "$PLAUD_DATA_DELTA"
   rsync -rlt --checksum --delete --dry-run --itemize-changes runtime/recordings/ \
     nas.lamanoriega.com:/share/ProjectsData/plaud-mirror/recordings/ > "$PLAUD_RECORDINGS_DELTA"
   test ! -s "$PLAUD_DATA_DELTA"
   test ! -s "$PLAUD_RECORDINGS_DELTA"

   PLAUD_SOURCE_DATA_STATS="$(find runtime/data -type f -exec stat -c '%s' {} \; | awk '{ files += 1; bytes += $1 } END { print files "|" bytes }')"
   PLAUD_TARGET_DATA_STATS="$(ssh nas.lamanoriega.com 'find /share/Container/runtime/plaud-mirror/data -type f -exec stat -c "%s" {} \; | awk '\''{ files += 1; bytes += $1 } END { print files "|" bytes }'\'')"
   PLAUD_SOURCE_RECORDING_STATS="$(find runtime/recordings -type f -exec stat -c '%s' {} \; | awk '{ files += 1; bytes += $1 } END { print files "|" bytes }')"
   PLAUD_TARGET_RECORDING_STATS="$(ssh nas.lamanoriega.com 'find /share/ProjectsData/plaud-mirror/recordings -type f -exec stat -c "%s" {} \; | awk '\''{ files += 1; bytes += $1 } END { print files "|" bytes }'\'')"
   test "$PLAUD_SOURCE_DATA_STATS" = "$PLAUD_TARGET_DATA_STATS"
   test "$PLAUD_SOURCE_RECORDING_STATS" = "$PLAUD_TARGET_RECORDING_STATS"

   test "$(sha256sum runtime/data/secrets.enc | awk '{print $1}')" = "$(ssh nas.lamanoriega.com 'sha256sum /share/Container/runtime/plaud-mirror/data/secrets.enc' | awk '{print $1}')"
   test "$(sha256sum runtime/data/app.db | awk '{print $1}')" = "$(ssh nas.lamanoriega.com 'sha256sum /share/Container/runtime/plaud-mirror/data/app.db' | awk '{print $1}')"
   test "$(sqlite3 runtime/data/app.db 'PRAGMA integrity_check;')" = "ok"
   test "$(sqlite3 runtime/data/app.db "SELECT (SELECT count(*) FROM sync_runs WHERE status='running'), (SELECT count(*) FROM webhook_outbox WHERE state IN ('pending','delivering','retry_waiting')), (SELECT count(*) FROM media_delivery_outbox WHERE state IN ('pending','delivering','retry_waiting')), (SELECT count(*) FROM media_deliveries WHERE state IN ('pending','delivering','accepted','processing')), (SELECT count(*) FROM upstream_deletion_operations WHERE stage != 'confirmed');")" = "0|0|0|0|0"

   PLAUD_MIGRATION_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
   PLAUD_MIGRATION_HEAD="$(git rev-parse HEAD)"
   ssh nas.lamanoriega.com "umask 077; printf 'verified_at=%s\nsource_head=%s\n' '$PLAUD_MIGRATION_AT' '$PLAUD_MIGRATION_HEAD' > /share/Container/runtime/plaud-mirror/.migration-ready-v1; chown 1000:100 /share/Container/runtime/plaud-mirror/.migration-ready-v1; chmod 600 /share/Container/runtime/plaud-mirror/.migration-ready-v1"
   rm -f "$PLAUD_DATA_DELTA" "$PLAUD_RECORDINGS_DELTA"
   trap - EXIT INT TERM
   ```

6. Copy
   `deploy/nas/{docker-compose.yml,start.sh,verify-container.sh,verify-runtime.mjs,README.md}` to
   `/share/Container/compose/plaud-mirror/`, install the mode-0600 bootstrap
   `.env`, and preserve launcher output as durable pre-change ACL/ownership and
   database-probe evidence. The quiescence flag is exclusive to this cutover:

   ```sh
   umask 077
   PLAUD_START_LOG="start-$(date -u +%Y%m%dT%H%M%SZ).log"
   : > "$PLAUD_START_LOG"
   chmod 600 "$PLAUD_START_LOG"
   if PLAUD_MIRROR_REQUIRE_QUIESCED=true ./start.sh > "$PLAUD_START_LOG" 2>&1; then
     cat "$PLAUD_START_LOG"
   else
     PLAUD_START_STATUS=$?
     cat "$PLAUD_START_LOG" >&2
     exit "$PLAUD_START_STATUS"
   fi
   ```

   The launcher's `docker compose config --quiet` is load-bearing: never remove
   `--quiet` or replace it with a full rendered config in this logged path,
   because rendered environment values include production secrets.

   For later upgrades run plain `./start.sh`: SQLite integrity remains
   mandatory, while the app is allowed to recover orphaned state. Never use
   `PLAUD_MIRROR_ALLOW_EMPTY_STATE=true` for migration or recovery.
## Remaining acceptance steps (resume after verifier publication)

7. Before proxy change, require the accepted immutable `v0.16.1` image, Docker
   healthy, `/app/VERSION=0.16.1`, user 1000:100, read-only root, the two expected
   mounts, the 1 GB/256-PID ceilings, and bounded logging. Then pipe
   `verify-runtime.mjs` into Node inside the container. It requires direct NAS
   static HTML, `authRequired:true`, anonymous protected-route 401, successful
   operator login without printing the passphrase, authenticated health with
   Plaud auth healthy and exact 720/720-or-newer coverage, protocol `ok/none`,
   and authenticated one-byte Range playback with HTTP 206.

   ```sh
   PLAUD_NAS_DOCKER=/share/ZFS1_DATA/.qpkg/container-station/usr/bin/.libs/docker
   ssh nas.lamanoriega.com \
     'cd /share/Container/compose/plaud-mirror && ./verify-container.sh'
   ssh nas.lamanoriega.com \
     "cd /share/Container/compose/plaud-mirror && $PLAUD_NAS_DOCKER exec -i plaud-mirror node --input-type=module < verify-runtime.mjs"
   ```

8. Re-read `edge-caddy` network mode and require exactly `host`; then prove
   the new service is reachable from the proxy container itself. Back up the
   exact Caddyfile, require exactly one old Plaud upstream, replace
   it with `reverse_proxy http://127.0.0.1:3040`, validate the complete Caddy
   configuration inside `edge-caddy`, and use a config reload. Do not recreate
   unrelated containers.

   ```sh
   PLAUD_NAS_DOCKER=/share/ZFS1_DATA/.qpkg/container-station/usr/bin/.libs/docker
   test "$(ssh nas.lamanoriega.com "$PLAUD_NAS_DOCKER inspect --format '{{.HostConfig.NetworkMode}}' edge-caddy")" = "host"
   ssh nas.lamanoriega.com \
     "$PLAUD_NAS_DOCKER exec edge-caddy wget -qO- http://127.0.0.1:3040/api/session >/dev/null"
   ```

9. Repeat session, health, Range audio, and protocol checks through canonical
   HTTPS;
   require Infra Portal observation after its inputs are updated. Observe the
   first NAS-owned automatic PT15M run, then rerun `verify-container.sh` to
   require that it remains healthy and not OOM killed under the configured
   memory/PID/log limits before calling runtime serving.

## Rollback

If NAS startup fails before proxy cutover, stop the exact NAS container with
`/share/ZFS1_DATA/.qpkg/container-station/usr/bin/.libs/docker stop -t 90
plaud-mirror`; no Compose secrets file is needed. If canonical validation fails
after cutover, first restore and validate the timestamped Caddyfile, then stop
the NAS container. If any NAS-side state mutation occurred, preserve it and
reconcile it before restarting the old writer. On dev-vm run
`docker update --restart=unless-stopped plaud-mirror-plaud-mirror-1`, then
`doppler run --project plaud-mirror --config dev -- docker compose up -d
plaud-mirror`, and verify it is healthy before restoring traffic. Never run
both schedulers to make rollback look fast.

Source cleanup is a later lifecycle action. It requires accepted NAS serving,
the post-cutover observation window, a recoverable NAS snapshot/backup, and an
exact target declaration. This runbook never deletes `runtime/` on dev-vm.

## Evidence receipt

This section is filled only with observed facts after execution. Until then,
source assets are a candidate and production remains on dev-vm.
