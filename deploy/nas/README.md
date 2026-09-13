# NAS deployment assets

These assets make the QNAP deployment reproducible. Source availability does
not prove that an image was published, state was migrated, the NAS runtime was
accepted, or Home Infra was updated.

`start.sh` fails closed when Container Station is unavailable, when the
bootstrap file is not owner-only, when Doppler is incomplete, when the image is
not pinned by release tag and registry digest, or when exact-copy and SQLite
gates are missing. It accepts only the two reviewed absolute storage leaves,
emits their prior ownership/ACL state for the durable launcher receipt, rejects
symlinks, and normalizes the
migrated tree to UID/GID 1000:1000 with owner-only modes. It never starts
Container Station, changes `edge-caddy`, migrates state, or removes the former
runtime.

The NAS layout is deliberately split:

- control state: `/share/Container/runtime/plaud-mirror/data`;
- recordings: `/share/ProjectsData/plaud-mirror/recordings`.

The split keeps the small SQLite/encrypted-secret state with other container
runtimes while placing the growing audio collection on the 1 TB ProjectsData
share. Both leaves are owned by numeric UID/GID 1000:1000 with mode 0700. The
parent NAS shares, NAS administrators, and the storage host remain inside the
trust boundary; mode 0700 is not cryptographic isolation.

The mode-0600 `.env` contains only a read-only Doppler service token for
`plaud-mirror/prd`. Preflight observed host `/tmp` as a 64 MB tmpfs and the
launcher refuses to continue if that filesystem type changes. Required values
are materialized there only for validation and the Compose invocation, then
removed by a trap. They are never persisted to the snapshotted compose share.
Compose uses that temporary file for substitution; it does not inject Doppler
metadata or host-path settings into the application container.

`verify-container.sh` verifies the exact image reference, health/OOM state,
identity, restart policy, read-only/capability-free/no-new-privileges runtime,
private tmpfs, writable mounts, loopback publication, resource ceilings, and
bounded logs. `verify-runtime.mjs` is then piped into Node inside
the running container. It uses
the already injected passphrase without printing it and requires the direct
loopback static root, armed operator session, anonymous 401, authenticated
health, protocol status, and one-byte audio Range response before Caddy moves.

Use these files only through `docs/operations/DEPLOY_PLAYBOOK.md`. Normal
startup requires the exact-copy receipt and independently opens the copied
SQLite database read-only inside the accepted image. Integrity is mandatory on
every launcher invocation. The one-time cutover additionally sets
`PLAUD_MIRROR_REQUIRE_QUIESCED=true` to reject all active work; ordinary
upgrades omit it so app startup can recover orphaned rows and can preserve
legitimate retry/processing state. A genuinely new empty installation must opt
in explicitly with `PLAUD_MIRROR_ALLOW_EMPTY_STATE=true`; that separate flag
is not part of migration or orphan recovery and starts with the scheduler
disabled until configured.
