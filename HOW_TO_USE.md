<!-- doc-version: 0.5.1 -->
# How to Use This Repository

This guide explains how Plaud Mirror is operated end-to-end and how it stays aligned with both `LLM-DocKit` (the governance scaffold it adopts) and the Plaud ecosystem upstreams it watches.

## Current Reality

`v0.5.1` is the **stable Phase 3 entry point**: it inherits the full Phase 2 manual slice and adds the in-process continuous sync scheduler (D-012) plus the partial health observability surface (D-014, scheduler subset). It also corrects two regressions introduced in `v0.5.0` — the scheduler defaulted to 15 minutes when `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` was unset (now correctly disabled), and `service.runSync` / `runScheduledSync` now actually serialise via `getActiveSyncRun` instead of merely claiming to. **Operators upgrading from `v0.4.x` should skip `v0.5.0` and go directly to `v0.5.1`.** Today the repository gives you:

- a Fastify API and React/Vite panel bundled in a single Docker container;
- encrypted persisted bearer-token auth against Plaud, surviving restarts;
- async manual sync and filtered historical backfill with live progress polling and a dry-run preview;
- **opt-in continuous sync scheduler** — set `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` to enable automatic ticks (see "Configuring the scheduler interval" below);
- a cached device catalog that feeds a real device selector in the backfill form;
- local recording index in SQLite with stable `#N` ranks, classic pagination, inline audio playback with HTTP Range support, and local-only dismiss/restore;
- immediate HMAC-signed webhook delivery with persisted delivery attempts;
- a `scheduler` block on `/api/health` reporting `enabled` / `intervalMs` / `nextTickAt` / `lastTickAt` / `lastTickStatus` / `lastTickError`;
- upstream-watch tooling plus the full LLM-DocKit governance circuit (HANDOFF, HISTORY, DECISIONS, REVIEWS, version-sync manifest, validator, pre-commit hook).

What it deliberately does **not** give you yet: durable retry outbox (next: `v0.5.2`), `lastErrors` ring buffer + outbox backlog in health (next: `v0.5.3`), resumable backfill, automatic re-login, NAS rollout. Those are remaining Phase 3 work and Phase 4+ per `docs/ROADMAP.md`.

For the full feature inventory see [README.md](README.md); for the product intent see [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md); for current work state see [docs/llm/HANDOFF.md](docs/llm/HANDOFF.md).

## Running the Service

### Docker (recommended for `dev-vm`)

```bash
cd ~/src/plaud-mirror
export PLAUD_MIRROR_MASTER_KEY="<long-random-secret>"
docker compose up --build -d
```

Then open `http://localhost:3040`, save a Plaud bearer token in the Configuration tab, and trigger a sync from the Main tab.

For Docker Hub timeout handling and acceptable fallback images, see [docs/operations/DEPLOY_PLAYBOOK.md](docs/operations/DEPLOY_PLAYBOOK.md). Pentesting distributions (e.g. `vxcontrol/kali-linux:latest`) are explicitly rejected as runtime bases.

### Local Node

```bash
cd ~/src/plaud-mirror
npm install
export PLAUD_MIRROR_MASTER_KEY="<long-random-secret>"
npm start
```

### Configuring the scheduler interval (Phase 3, opt-in)

The continuous sync scheduler is **disabled by default** to preserve Phase 2 manual-only behavior for existing operators. Enable it by setting `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` in the environment that boots the container or `npm start`:

| Value                          | Result                                                                              |
|--------------------------------|-------------------------------------------------------------------------------------|
| (unset) / empty / `0`          | Scheduler disabled — operator triggers every sync manually.                         |
| `60000` … any positive integer | Scheduler fires every `intervalMs` ms (minimum 60 000 = 60 s).                      |
| Below `60000` (positive)       | Rejected at startup — protects Plaud from over-polling.                             |
| Negative / non-integer string  | Rejected at startup with an explicit error — fail loud, never default silently.     |

Recommended starting point: `900000` (15 min). The recommendation lives in this doc deliberately, not in code; the runtime never picks a non-zero scheduler on your behalf.

Each tick performs `runScheduledSync()` against Plaud. Two layers of anti-overlap protect against double work:

1. **Service-layer.** If a manual `POST /api/sync/run` (or another scheduled tick) is already mid-flight, the tick reuses that run's id without inserting a second `sync_runs` row, and `lastTickStatus` is `"skipped"` with `lastTickError` carrying the reason (e.g. `"another sync run was already in flight"`).
2. **Scheduler-level.** If the previous tick's promise has not resolved by the time the next timer fires, the new fire is also recorded as `"skipped"` and discarded.

Verify the scheduler is live by checking `GET /api/health` and confirming the `scheduler` block reports `enabled: true` with a populated `nextTickAt`. After the first tick fires, watch `lastTickAt` / `lastTickStatus` to confirm cadence.

When the scheduler is enabled, `health.phase` reads `"Phase 3 - unattended operation"`; when disabled it falls back to `"Phase 2 - first usable slice"`. Use this string for human eyes only — never for control flow.

### Phase 1 spike (still available)

The original CLI probe for direct Plaud validation lives at `apps/api/src/phase1/`:

```bash
export PLAUD_MIRROR_ACCESS_TOKEN="<your-bearer-token>"
npm run spike -- probe --limit 100 --download-first
```

Useful for live Plaud flow checks and metadata discovery without booting the panel.

## Local Governance Setup (first clone)

1. Install the pre-commit hook:
   ```bash
   cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
   chmod +x .git/hooks/pre-commit
   ```

2. Generate the external-context block from `home-infra`:
   ```bash
   scripts/dockit-generate-external-context.sh --apply --claude-rules --project .
   ```

3. Validate the repository documentation state:
   ```bash
   scripts/check-version-sync.sh
   scripts/dockit-validate-session.sh --human
   ```

4. Check tracked upstreams against GitHub:
   ```bash
   scripts/check-upstreams.sh
   scripts/check-upstreams.sh --markdown
   ```

## Testing

```bash
npm test
```

93 tests at `v0.5.1`: 82 backend (Plaud client, runtime service, store, server routes, shared schemas including the `formatting` helpers used by both web and api, built-api smoke, web-build smoke, scheduler tests, **plus 9 regression tests added in `v0.5.1`: 6 in `apps/api/dist/runtime/environment.test.js` proving the env var matrix above (unset → disabled, empty → disabled, explicit `0` → disabled, positive accepted, sub-floor rejected, non-numeric/negative rejected), 1 in `apps/api/dist/runtime/service.test.js` proving concurrent `runSync` / `runScheduledSync` reuse the active run instead of inserting a second `sync_runs` row, and 2 in `apps/api/dist/runtime/scheduler.test.js` proving `runTick` returning `{ skipped: true, reason }` flips `lastTickStatus` to `skipped` and that void / non-skip return values stay `completed`**) + 11 web (`storage` localStorage helpers, `<StateBadge>` component rendering). The web side runs under Vitest+jsdom+@testing-library/react (D-015) and is hooked into the root `npm test` via `npm run test:web`.

## Working With LLM-DocKit Upstream

Plaud Mirror is a downstream project of `LLM-DocKit`. The opt-in marker `.dockit-enabled` and the local `.dockit-config.yml` are already committed. When `LLM-DocKit` improves, sync from the template repository, not from this project.

Example workflow:

```bash
/home/cdelalama/src/LLM-DocKit/scripts/dockit-sync.sh --init-state --project /home/cdelalama/src/plaud-mirror
/home/cdelalama/src/LLM-DocKit/scripts/dockit-sync.sh --dry-run --project /home/cdelalama/src/plaud-mirror
/home/cdelalama/src/LLM-DocKit/scripts/dockit-sync.sh --apply --project /home/cdelalama/src/plaud-mirror
```

After any sync:

```bash
cd /home/cdelalama/src/plaud-mirror
scripts/check-version-sync.sh
scripts/dockit-validate-session.sh --human
```

Observations from running Plaud Mirror as a DocKit adopter feed back into `~/src/LLM-DocKit/docs/DOWNSTREAM_FEEDBACK.md` (DF-NNN entries). That log is DocKit's backlog for protocol improvements — contribute findings there, not here.

## Working With External Context

This project is tied to local infrastructure decisions documented in `~/src/home-infra`. That link is configured in `.dockit-config.yml` and rendered into `LLM_START_HERE.md` via markers.

If deployment, auth, or storage assumptions change:

1. update the relevant local docs (`docs/ARCHITECTURE.md`, `docs/operations/AUTH_AND_SYNC.md`, etc.);
2. regenerate the external-context block;
3. review whether `home-infra/docs/PROJECTS.md` or `home-infra/docs/SERVICES.md` also need updates.

Regenerate command:

```bash
scripts/dockit-generate-external-context.sh --apply --claude-rules --project .
```

## Working With Upstreams

The canonical upstream baseline lives in `config/upstreams.tsv` and the licensing/adoption rationale in [docs/UPSTREAMS.md](docs/UPSTREAMS.md).

Check GitHub drift:

```bash
scripts/check-upstreams.sh
```

Interpretation:

- `CURRENT` means the tracked baseline still matches GitHub.
- `CHANGED` means the repo moved and needs human review.

When a tracked upstream changes:

1. read [docs/UPSTREAMS.md](docs/UPSTREAMS.md);
2. inspect the changed upstream release or commits;
3. decide `adopt`, `watch`, or `ignore`;
4. update `config/upstreams.tsv` only after recording the decision in `docs/llm/DECISIONS.md` and `docs/llm/HISTORY.md`.

Per D-005 + D-011, AGPL upstreams (`openplaud/openplaud`) may be referenced for endpoint facts and wire shapes but NOT copied for code, types, or schemas into this MIT codebase.

## Implementation Map

The runtime is already in place. High-level module boundaries:

- `apps/api/src/` — Fastify admin API, auth handler, sync/backfill service with pluggable scheduler, SQLite store, encrypted secret store, Plaud client with regional retry.
- `apps/web/src/` — React/Vite panel with Main / Configuration tabs, Manual sync + Historical backfill cards, library with pagination + inline audio player.
- `packages/shared/src/` — Zod schemas: `plaud.ts` holds wire-level Plaud response shapes, `runtime.ts` holds domain types shared across API/store/web.

Before changing auth, download, sync cadence, or storage layout, read:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/UPSTREAMS.md](docs/UPSTREAMS.md)
- [docs/operations/AUTH_AND_SYNC.md](docs/operations/AUTH_AND_SYNC.md)
- [docs/operations/API_CONTRACT.md](docs/operations/API_CONTRACT.md)

Every auth/download/sync-cadence change must update all three operational docs in the same session (enforced by `LLM_START_HERE.md`).
