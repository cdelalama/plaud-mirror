<!-- doc-version: 0.10.6 -->
# How to Use This Repository

This guide explains how Plaud Mirror is operated end-to-end and how it stays aligned with both `LLM-DocKit` (the governance scaffold it adopts) and the Plaud ecosystem upstreams it watches.

## Current Reality

`v0.10.6` is the CI-portable form of the consolidated pre-soak hardening release on the Phase 5 protocol-integrated runtime. Runtime behavior comes from `v0.10.4`; `v0.10.5`-`v0.10.6` make both timeout regression harnesses reliable on Node 20 CI. **Operators upgrading from any `0.4.x`/`0.5.x` should go directly to `v0.10.6`.** Today the repository gives you:

- a Fastify API and React/Vite panel bundled in a single Docker container;
- **operator access control** (v0.6.0): set `PLAUD_MIRROR_ADMIN_PASSPHRASE` and the panel asks for the passphrase once per device (30-day session cookie); without it the API runs open and `/api/health` warns;
- encrypted persisted bearer-token auth against Plaud, surviving restarts;
- browser-assisted Plaud re-auth through the local Chrome extension (`apps/chrome-extension`), with manual paste and copy-only bookmarklet fallback, surfaced in the Configuration screen;
- async manual sync and filtered historical backfill with live progress polling and a dry-run preview;
- **opt-in continuous sync scheduler** — configurable from the Configuration screen of the panel (set the interval in minutes, `0` disables); see "Configuring the scheduler" below;
- a one-hour whole-run ceiling (`PLAUD_MIRROR_SYNC_MAX_RUNTIME_MS=3600000` by default) that cancels Plaud calls and audio streams instead of leaving a run active forever;
- a cached device catalog that feeds a real device selector in the backfill form;
- local recording index in SQLite with stable `#N` ranks, search, 50/100/150 pagination, compact/full inline audio playback with HTTP Range support, and local-only dismiss/restore;
- HMAC-signed webhook delivery via a **durable outbox**: every sync enqueues, the worker retries failures with exponential backoff, the panel exposes counters and a Retry button for permanently-failed items;
- a `scheduler` block, an `outbox` counters block, plus the `lastErrors` ring buffer and `recentSyncRuns` list on `/api/health` (D-014 full from v0.5.5), now visible in the Main and Operations screens;
- a `home-infra-protocol` sync-job surface: `infra.contract.yml` declares `plaud-mirror-recordings-sync`, and `/api/protocol/sync-jobs/plaud-mirror-recordings-sync/status` publishes a public sanitized status snapshot for Infra Portal/Hermes-style consumers;
- a Spanish/English operator-chrome toggle persisted in browser storage, plus a labeled mobile view selector so phone navigation is not icon-only;
- upstream-watch tooling plus the full LLM-DocKit governance circuit (HANDOFF, HISTORY, DECISIONS, REVIEWS, version-sync manifest, validator, pre-commit hook).

What it deliberately does **not** give you yet: resumable backfill, fully unattended re-login, NAS rollout. Those are remaining Phase 3+ work per `docs/ROADMAP.md`.

For the full feature inventory see [README.md](README.md); for the product intent see [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md); for current work state see [docs/llm/HANDOFF.md](docs/llm/HANDOFF.md).

## Running the Service

### Docker (recommended for `dev-vm`)

```bash
cd ~/src/plaud-mirror
doppler run --project plaud-mirror --config dev -- docker compose up -d --build
```

Then open `http://localhost:3040`, sign in with the operator passphrase, reconnect Plaud from the Configuration screen (Chrome extension recommended, manual paste fallback), and trigger a sync from the Main screen.

On `dev-vm`, the operator passphrase lives in Doppler (`plaud-mirror/dev`). Use the Doppler-wrapped compose command for every recreate unless the same secret is intentionally copied into the local gitignored `.env`.

For Docker Hub timeout handling and acceptable fallback images, see [docs/operations/DEPLOY_PLAYBOOK.md](docs/operations/DEPLOY_PLAYBOOK.md). Pentesting distributions (e.g. `vxcontrol/kali-linux:latest`) are explicitly rejected as runtime bases.

### Local Node

```bash
cd ~/src/plaud-mirror
npm install
export PLAUD_MIRROR_MASTER_KEY="<long-random-secret>"
npm start
```

### Reconnecting Plaud (Chrome extension, Phase 4)

The recommended no-DevTools path is the local Chrome extension:

1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
2. Select `~/src/plaud-mirror/apps/chrome-extension`.
3. Pin **Plaud Mirror Connector** in the Chrome toolbar.
4. In the Plaud Mirror panel, Configuration screen, press **Reconectar Plaud**. This starts the 10-minute capture session and opens Plaud.
5. In the Plaud tab, sign in with Google if needed, press the extension, then **Send token to mirror**.

The extension reads the token from the active Plaud tab and sends it through the same `/connect` fragment handshake as v0.7.0. It stores only the mirror origin, never the Plaud token. Manual paste remains available in the token form. The bookmarklet is copy-only fallback; do not drag a `javascript:` link from React-rendered UI.

### Configuring the scheduler (Phase 3, opt-in)

The continuous sync scheduler is **disabled by default** to preserve Phase 2 manual-only behavior for existing operators. From `v0.5.2` onwards, you configure it from the **Configuration screen of the web panel**:

1. Open the panel at `http://localhost:3040`, switch to Configuration.
2. Find the **Continuous sync scheduler** card. The status block shows whether it is enabled, the current interval, the next tick, the last tick result, and (when applicable) the reason a tick was skipped.
3. In the form, type the desired interval in **minutes** (e.g. `15`) and click "Save scheduler settings". The change persists in SQLite and is hot-applied — no container restart, no `.env` edit.
4. To disable, set the field to `0` and save.

Rules enforced by the panel + the API:

| Value (minutes) | Result                                                                                  |
|-----------------|-----------------------------------------------------------------------------------------|
| `0`             | Scheduler disabled. Manual sync only.                                                   |
| `1` … any       | Scheduler enabled, fires every `N` minutes (the wire format is milliseconds: `N * 60_000`). |
| Below `1`       | Rejected by the panel and by `PUT /api/config` (HTTP 400).                              |

Recommended starting point: `15` minutes.

Each tick performs `runScheduledSync()` against Plaud. Two layers of anti-overlap protect against double work:

1. **Service-layer.** If a manual `POST /api/sync/run` (or another scheduled tick) is already mid-flight, the tick reuses that run's id without inserting a second `sync_runs` row, and `lastTickStatus` is `"skipped"` with `lastTickError` carrying the reason (e.g. `"another sync run was already in flight"`).
2. **Scheduler-level.** If the previous tick's promise has not resolved by the time the next timer fires, the new fire is also recorded as `"skipped"` and discarded.

When the scheduler is enabled, `health.phase` reads `"Phase 3 - unattended operation"`; when disabled it falls back to `"Phase 2 - first usable slice"`. Use this string for human eyes only — never for control flow.

### Home Infra Protocol sync status (Phase 5)

Plaud Mirror declares its Plaud recording sync in `infra.contract.yml` as
`plaud-mirror-recordings-sync`. The live status endpoint is:

```text
GET /api/protocol/sync-jobs/plaud-mirror-recordings-sync/status
```

`/api/protocol/status` is an alias. Both are public and sanitized like
`/api/health`, but they return the protocol `status-snapshot` shape for Infra
Portal, Hermes, or future agents. The snapshot maps existing runtime truth:
Plaud auth, latest/active sync, mirror coverage, scheduler state, and webhook
outbox state.

The contract currently uses `schedule.mode: manual` with `stale_after: P1D`
because the live scheduler is disabled until the soak starts. When the
scheduler becomes the intended operating mode, update `infra.contract.yml` to
`internal-loop`, add cadence, and keep `stale_after > cadence`.

#### Optional: bootstrap from the env var

The `PLAUD_MIRROR_SCHEDULER_INTERVAL_MS` env var (in `.env` or `compose.yml`) is **only used to seed the SQLite row on a fresh install**. It is convenient if you want a brand-new container to start with a non-zero scheduler without having to log into the panel afterwards. Once the SQLite row exists (either because the seed wrote it, or because you saved from the panel), the env var is ignored on every subsequent boot. To change the value of an existing install, **always use the panel** — editing `.env` after the first boot will silently do nothing.

### Webhook outbox (Phase 3, durable retry queue, v0.5.3+)

Every successfully-mirrored recording is pushed into the durable outbox (`webhook_outbox` SQLite table). A dedicated worker walks the queue every 5 s, retries across eight exponential-backoff windows, and either delivers (`→ delivered`) or escalates to `permanently_failed` on the ninth failed attempt.

Backoff schedule (per-attempt wait):

| Attempt | Wait before next attempt |
|---------|--------------------------|
| 1 → fail | 30 s |
| 2 → fail | 2 min |
| 3 → fail | 10 min |
| 4 → fail | 30 min |
| 5 → fail | 1 h |
| 6 → fail | 2 h |
| 7 → fail | 4 h |
| 8 → fail | (escalates to `permanently_failed`) |

Cumulative window before escalation: ~16 hours. Tuned for home infra: long enough to ride out an overnight downstream outage without paging the operator, short enough that a permanently-broken downstream doesn't accumulate weeks of retry attempts.

In the panel, open Operations for live outbox counters or Configuration for webhook settings:

- **Counters** — `pending`, `retry_waiting`, `permanently_failed`, plus the age of the oldest queued/retrying row. Live from `/api/health.outbox`.
- **Permanently-failed list** — every row that exhausted its retries shows up here with the recording id, attempt count, and last error message. Press **Retry** to reset that row to `pending` (the worker re-attempts on its next tick).
- **No queue browser**. The pending and retry-waiting backlog is intentionally not listed individually — only counters. The outbox is a "deliver and forget" surface, not a workflow tool. If you need to inspect a specific in-flight item, query SQLite directly.

The HMAC signature is recomputed at delivery time, not at enqueue time. If you rotate `webhookSecret` in the panel while items are in the queue, the worker re-signs them with the new secret on the next attempt. Items already in `delivered` are not retroactively re-delivered.

If you clear the webhook URL while items are queued, the worker escalates them to `permanently_failed` with `last_error = "webhook not configured"` (instead of looping forever or silently dropping). Reconfigure the URL and press **Retry** on each row to re-enqueue.

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

161 runtime tests at `v0.10.1`: 134 Node tests (shared schemas/formatting/protocol, Plaud client, runtime service/store/scheduler/outbox/auth/capture-session/protocol-status, server routes, integration smoke for built API/web, Chrome extension contract) + 27 web tests under Vitest+jsdom+@testing-library/react (D-015). The root `npm test` runs both the Node test runner and `npm run test:web`. Governance checks are separate: `scripts/dockit-validate-session.sh --human` runs 12 checks, `scripts/check-version-sync.sh` checks 23 version targets, and `scripts/test-validator.sh` currently has 32 smoke cases.

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
- `apps/web/src/` — React/Vite panel with the v0.9.0 operator rail, v0.9.1 full-viewport shell, and v0.9.2 Main sync-limit fix: Main, Library, Backfill, Configuration, and Operations screens. v0.9.3 changes governance tooling only, not the panel runtime.
- `packages/shared/src/` — Zod schemas: `plaud.ts` holds wire-level Plaud response shapes, `runtime.ts` holds domain types shared across API/store/web.

Before changing auth, download, sync cadence, or storage layout, read:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/UPSTREAMS.md](docs/UPSTREAMS.md)
- [docs/operations/AUTH_AND_SYNC.md](docs/operations/AUTH_AND_SYNC.md)
- [docs/operations/API_CONTRACT.md](docs/operations/API_CONTRACT.md)

Every auth/download/sync-cadence change must update all three operational docs in the same session (enforced by `LLM_START_HERE.md`).
