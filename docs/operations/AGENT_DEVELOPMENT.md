<!-- doc-version: 0.17.0 -->
# Agent Development Runtime

This is the canonical development workflow for Plaud Mirror. It exists for
agent-driven implementation and product review on `dev-vm`; it is not a
standby production replica or a rollback source.

## Agent contract

When an operator says that an agent is working on Plaud Mirror, the unqualified
runtime context is **development**. After the mandatory LLM-DocKit onboarding,
the agent must run:

```sh
npm run dev:agent:status
```

If the requested work needs a live panel and the runtime is stopped, start or
rebuild it from the checked-out source with:

```sh
npm run dev:agent
```

Production remains the immutable NAS runtime. An agent must not deploy,
restart, reconfigure, replay, or copy development state into production unless
the operator gives a separate production action or GO.

## Stable commands

| Command | Effect |
|---|---|
| `npm run dev:agent` | Prepare state if needed, build the current source, start the development container, wait for health, and verify isolation invariants. |
| `npm run dev:agent:status` | Read the live container, port, health, scheduler, Plaud-auth, and sample-count boundary. |
| `npm run dev:agent:credentials` | Show the direct LAN URL and the generated development-only operator passphrase. Treat the output as sensitive. |
| `npm run dev:agent:down` | Stop the development container without touching its isolated state. |
| `npm run dev:agent:refresh-samples` | While stopped, select and copy a new bounded representative sample from NAS production, then verify every byte by SHA-256. |
| `npm run dev:agent:prepare` | Create only the external state directories and synthetic development secrets. |

The default Docker Compose entrypoint delegates to
`compose.development.yml`, so an accidental plain `docker compose up` cannot
revive the retired production-like `./runtime` mounts.

## Environment identity

- Local container: `plaud-mirror-development`
- Local image: `plaud-mirror:<source-version>-development` (set by the
  launcher; a plain Compose run uses `plaud-mirror:development`)
- Direct LAN URL: `http://dev.lamanoriega.com:3041/`
- Canonical hostname: none active. A private
  `https://plaud-mirror.dev.lamanoriega.com/` DNS record and edge route are an
  optional later Home Infra action that needs separate operator approval.
- Home Infra service id: `plaud-mirror-development`
- Home Infra project id: `plaud-mirror` (shared with production)
- Protocol environment: `development`
- State policy: `isolated`

The shared project id lets Home Infra consumers group production and
development as one product without collapsing their health or lifecycle. An
Infra Portal Development environment tab was prototyped on 2026-09-15 but is
not published or deployed.

## State and data boundary

The default host root is
`${XDG_STATE_HOME:-$HOME/.local/state}/plaud-mirror-development`; it is outside
the repository. The launcher refuses the repository root, descendants of the
repository, `/`, the home directory itself, symlinked roots, and state paths
that resolve outside the dedicated root. It also refuses to adopt an existing
non-empty directory that lacks its exact safety marker. The root contains:

- `data/app.db`: a fresh development-only SQLite database;
- `data/secrets.enc`: created only if the development UI stores local secrets;
- `recordings/`: at most eight explicitly selected audio samples;
- `samples.json`: a private manifest with source metadata, byte size, and
  SHA-256;
- `runtime.env`: generated development-only master key and operator
  passphrase; and
- `.plaud-mirror-development`: the deletion-safety marker.

The sample refresh command reads the production database and audio tree over
SSH but never copies production SQLite, `secrets.enc`, Plaud credentials,
destination credentials, or scheduler state. The selector currently chooses
up to three files nearest 30 seconds, 5 minutes, and 30 minutes, each bounded
to 20 MB. Files and the private manifest stay out of Git.

At every start, the development entrypoint validates the manifest shape,
SHA-256, bounded manifest/audio sizes, and resolved in-root regular-file paths
before seeding recording rows. A refreshed manifest archives active
sample rows no longer present and clears their now-absent local paths while
retaining any linked development evidence. It refuses to run unless
`PLAUD_MIRROR_ENVIRONMENT=development` and
`PLAUD_MIRROR_STATE_POLICY=isolated`; the generic environment loader also
rejects either half of that identity when declared alone.

## Safety properties

- The scheduler is forced to `0` on every startup; the environment loader
  rejects a positive interval under the isolated identity, shared
  initialization resets any persisted positive value to `0`, the API rejects
  attempts to enable it, and the launcher verifies it remains off.
- `prepare`, `up`, `down` and `refresh-samples` take an exclusive lock in the
  state root, so concurrent first runs cannot generate different credentials.
  Sample refresh replaces audio only after Docker confirms the container is
  stopped or absent; an inspection error stops the command.
- No production Plaud bearer is present; the API rejects Plaud credential
  enrollment and every sync, backfill, remote restore, and upstream-delete
  path while this runtime is `development + isolated`. Public health must
  report Plaud auth unconfigured.
- Operator authentication is armed with a synthetic, local-only passphrase.
- The container is non-root, read-only, capability-free, and
  `no-new-privileges`, with PID and memory limits.
- Port 3041 is bound only to the dev-vm LAN address. Production retains NAS
  loopback port 3040 and its separate canonical hostname.
- Development has ordinary network reachability so an operator can exercise
  deliberately configured integrations. Isolation comes from separate state,
  absent production credentials, disabled scheduling, distinct ingress, and
  explicit Home Infra environment identity; it is not described as an
  air-gapped sandbox.
- Production and development may run concurrently because they do not share
  state or credentials. Two runtimes pointed at production state may not.

## Current runtime

Rebuild receipt (2026-11-12 00:34 UTC): `npm run dev:agent` from the clean
`main` checkout at published `4331dbc` built image `plaud-mirror:0.17.0-development`
(`sha256:7f2637bbff09`) and recreated `plaud-mirror-development` with its existing
isolated state. Health reports 0.17.0, Plaud auth unconfigured, scheduler off and
three samples. Authenticated smoke: token save, scheduler enable and manual sync
return 403; three recordings list; a one-byte Range returns 206. NAS production
0.16.1 kept its start time, zero restarts and 952/952 coverage. The previous
image `plaud-mirror:0.16.4-development` is retained as the rollback source;
removing it is a separate decision.

## Seeing source changes

`npm run dev:agent` rebuilds the image from the current checkout and recreates
the development container. A successful command ends with the verified sample
count and URL. Use the direct development URL for browser review. The production
hostname continues to show the accepted NAS release until an independently
authorized production deployment.

## Sample refresh and privacy

Representative production audio is personal data. Refresh only when useful,
keep the set bounded, never print titles or ids into committed artifacts, and
never attach the private manifest or audio to an audit packet. Stop the runtime
before refreshing. The command stages into a marked private root, validates all
hashes, then replaces only the development sample tree.

## Reset or removal

Stopping is non-destructive. Removing development state or its current image
is a separate destructive action: resolve the exact marked root and container
first, then obtain explicit authorization. Never use the retired
repository-local `runtime/data` custody as development input or delete it as
part of routine development; it remains a separate backup/resilience decision.
