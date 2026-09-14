<!-- doc-version: 0.16.3 -->
# Project Context - Plaud Mirror

## Vision

Build a self-hosted Plaud mirror that gets the original audio artifact out of Plaud and into local infrastructure with low operator friction.

## Objectives

- Persist mirrored audio locally in a predictable layout.
- Offer a small web panel for auth, visibility, and manual control.
- Deliver a generic webhook that downstream systems can consume.
- Optionally deliver immutable verified audio to any independent service that
  implements Plaud Mirror's provider-neutral Transcription Intake v1 contract.
- Publish Plaud recording sync status through the shared `home-infra-protocol`
  contract so infra consumers can reason about freshness and health.
- Keep auth and download behavior auditable in-repo.
- Track upstream changes that can break or improve the Plaud path.

## Architectural Summary

Plaud Mirror is a server-first product with two runtime surfaces:

- `apps/api/`: Fastify API plus same-process worker logic
- `apps/web/`: React/Vite operator panel served by the API runtime

Persistence is split between SQLite for state/indexes and the filesystem for mirrored audio artifacts. Secrets are encrypted at rest with a master key supplied by the surrounding deployment.

## Current Status (2026-09-14, v0.16.3 placement reconciliation)

The operator promoted NAS placement ahead of the connection-control work
because dev-vm is at 89% disk utilization and the Plaud runtime holds 12 GB of
audio. `v0.16.0` introduced a fail-closed QNAP deployment with immutable registry
image, Doppler `prd` bootstrap, loopback-only HTTP, and split storage: small
control state stays in `/share/Container`, while recordings use the 1 TB
`/share/ProjectsData` dataset. The candidate also moves the supported runtime
to Node 24.15+ and clears the dependency audit before placing a new public
container. Live attempt 1 exposed QNAP's actual storage owner as 1000:100 and
rolled back before NAS startup or proxy change; `v0.16.1` corrects that runtime
identity. Attempt 2 then started a healthy NAS-only writer and passed direct
auth/runtime/Range checks, but the container verifier compared a resolved ZFS
path with Docker's declared `/share/*` source. `v0.16.2` corrects only that
host-side acceptance check; published source `9d6bce7` and CI run `34793046331`
passed without producing an image. The corrected host verifier passed against
the unchanged immutable `v0.16.1` container. NAS `edge-caddy` now routes the
canonical hostname to loopback `127.0.0.1:3040`; direct and canonical
authenticated runtime/Range checks pass. NAS is the single healthy writer at
720/720, and its first PT15M automatic run
`16e03fb1-7b56-4854-81d1-6a8dfa85bfc4` completed with zero work and zero
failures. `dev-vm` remains stopped with restart disabled. `v0.16.3` changes
only the project-owned placement and production-secret references so Home
Infra can ingest current truth; it creates no image, restart, or data copy.

`v0.15.0` source adds provider-neutral local review for retained transcription
failures without modifying the frozen wire contract, retryability, or terminal
delivery state. Fresh pre-migration evidence reports exact 720/720 coverage and
98 terminal deliveries: 61 `transcribed` and 37 retained `failed`, with none in
flight. The original three rows reviewed in July preserve two resolved findings
and one active policy block; the later rows have not been reclassified by
inference. The 622-recording historical replay arithmetic remains exact because
the additional automatic deliveries correspond to recordings added after the
original backlog was measured.

`v0.14.2` from `a993936` repaired the final mismatch found by
the first live Media2Text completion. The runtime now persists source audio and
transcript record identities separately, keeps the source revision as the
audio-integrity boundary, accepts the signed terminal callback, and releases
the immutable artifact lease. Real MP3 and OGG recordings reached terminal
`transcribed`; the final OGG canary preserved its original `audio/ogg` SHA-256
while Media2Text recorded a distinct transcript-record SHA-256.

Plaud Mirror owns a provider-neutral Transcription Intake v1
compatibility profile and
optional delivery lane: exact-origin capability discovery, separate encrypted
machine credentials, content-addressed artifact leases, durable admission,
signed/pull status reconciliation, historical local replay, exact coverage,
an executable conformance probe, and an Integrations screen. D-024 preserves a
future neutral Content Intake direction without prematurely creating a third
protocol repository. A destination-free instance remains healthy and
fully functional; the generic webhook remains separate. Media2Text is the
first compatible provider, not a build/runtime/storage dependency.
Restore is now serialized against the full permanent-deletion window, and a
second enabled destination requires explicit cost confirmation. The live
destination now has 98 terminal delivery rows. The three rows reviewed in July
remain useful examples, but the 35 later failures still require their own
operator classification rather than inherited labels.
Historical replay remains blocked: 622 recordings remain, representing
608.0074 hours. USD 335.62 is a Plaud-local planning estimate using the
configured Deepgram rate as of 2026-07-18; it is not a Media2Text quotation or
spending authority. A fresh receiver-owned quote and separate operator approval
are required before any batch is sent.

D-026 now governs the next operator-experience program. Connection setup is a
bilateral control-plane workflow, separate from the frozen content contract:
Plaud exports a sensitive request, Media2Text provisions a mutable runtime
producer profile and returns a sensitive grant, and Plaud tests and enables the
result. The interface presents independent configuration, policy, evidence,
and health dimensions plus deliberate Pause, Rotate access, Disconnect, and
Archive actions. Plaud never configures Cortex. The exact roadmap and trust
limits are in `docs/design/CONNECTIONS_OPERATOR_EXPERIENCE.md`; only its Wave 1
documentation and operational baseline are authorized so far.

Plaud Mirror `v0.13.1` hardens scheduler shutdown after independent audit:
`stop()` now prevents an already-queued callback from rearming or running
work, and every HTTP application test registers unconditional cleanup. The
patch is deployed from clean source `d00ca3e` and reconciled through Home Infra
0.6.10. Plaud Mirror `v0.13.0` publishes the active scheduler's authoritative next tick
as Home Infra Protocol 0.10.0 `next_run_at`. The field is omitted when no plan
exists and never changes freshness or severity. This restores useful countdown
UX in generic consumers without asking them to reconstruct a schedule from
cadence. Production v0.15.0 currently reports 720/720 current
coverage, `ok/none`, and a future next run.

Plaud Mirror `v0.12.0` is the integrity follow-up to the first real operator
deletion on 2026-07-15. That event exposed two assumptions that mocked happy
paths could not justify: any 2xx response was accepted as Plaud success, and a
historical tombstone was subtracted from the current remote total even after it
had disappeared upstream. The release fixes the model rather than hiding the
count: each full Plaud listing commits one inventory generation after physical
artifact verification, while deletion intent and every transition are stored
durably before remote side effects. Unknown mutation responses fail closed;
retry inspects Plaud and reconciles a prior uncertain delete without blindly
repeating it. Historical tombstones and local-only tracked rows remain visible but
outside the current remote coverage partition.

This is a backward-compatible minor release: SQLite changes are additive,
legacy tombstones are imported as confirmed operations, existing API fields are
preserved, and Home Infra Protocol still consumes the same status-snapshot
contract. The additional count detail is private passthrough data that protocol
consumers already tolerate. Media2Text is now a proven optional destination,
but remains outside Plaud Mirror's build, storage, and availability boundary.
The producer review of Media2Text commit `c982ced` remains durable evidence in
D-022/REVIEWS, while D-023 supersedes its repository-SHA implementation gate.
Cortex consumes the provider's separate transcript-ready output and never
fetches Plaud audio directly; that delivery remains disabled pending a frozen
consumer contract.

Home Infra `0.34.18` commits `f82fb02` and `0519d45` complete the NAS
observer projection. The final input sync created backup
`20260914T012258Z-before-0519d45` without restarting the Portal or either
serving container. Infra Portal provenance reports catalog source `0519d45`,
Plaud contract source `ffe28e9`, and no warnings. It independently observes
Plaud Mirror as the canonical production service on `nas`, HTTP 200, with a
current `plaud-mirror-recordings-sync` job at exact 720/720 coverage. The
earlier Home Infra 0.7.11 / Portal 0.20.3 evidence remains historical only.

The 2026-07-18 pre-shutdown checkpoint and post-reboot runs remain valid
historical stability evidence. The 2026-07-20 deployment starts new observation
but does not start the final exit window, because planned connection-control
deploys would invalidate it. Phase 3 closes only after the final Plaud and
Media2Text releases, one joint canary, the first subsequent automatic PT15M
run, five deploy-free days across both services, and the separate live generic-
webhook drill.

Plaud Mirror `v0.10.7` activates the soak contract: the project-owned sync job
is `internal-loop` at `PT15M`, with `stale_after: PT2H` exceeding cadence plus
the one-hour maximum runtime. The physical preflight completed at 619/619 with
zero repair candidates.

The `v0.10.6` source underneath is the CI-portable form of the `v0.10.4` pre-soak
execution hardening. It adds no runtime behavior: `v0.10.5` fixes the Node 20
request-timeout harness and `v0.10.6` applies the same keepalive to the
whole-run timeout harness.

The `v0.10.4` patch completes execution hardening. Scheduler
ticks await the actual mirror run, sync work has a one-hour cancelable ceiling,
Plaud pagination is bounded, outbox claims recover in-process and retain the
full overnight retry window, and SIGTERM waits for active work before SQLite
closes. Compose now has a healthcheck and dependency audits are clean. At that
release point, runtime deployment remained on v0.10.1 until the consolidated
image was deployed and physically reconciled.

The `v0.10.3` patch underneath made audio replacement atomic, reconciled SQLite
coverage against physical existence and size, isolated candidate failures, and
made filtered backfill collisions explicit.

The `v0.10.2` patch underneath established trustworthy evidence: Node 20 CI,
web typechecking, automatic test discovery, Docker-context hygiene, and idle
panel observation of scheduler-started runs.

The `v0.10.1` patch underneath is a Phase 5 patch on top of the `v0.10.0`
Home Infra Protocol release. It fixes the sync-run progress summary so
recording-level webhook delivery state does not masquerade as skipped sync
work: a downloaded recording with no webhook configured still records
`lastWebhookStatus="skipped"`, but `SyncRunSummary.skipped` no longer increments
for that delivery decision.

The `v0.10.0` release underneath opened **Phase 5 infra/protocol integration**
while preserving the existing sync engine. It adds `home-infra-protocol`
adoption for the Plaud recording sync: `infra.contract.yml` declares
`plaud-mirror-recordings-sync`, `docs/INFRA_CONTRACT.md` explains the
producer/consumer boundary, and the API publishes a public sanitized status
snapshot at `/api/protocol/sync-jobs/plaud-mirror-recordings-sync/status`
(alias `/api/protocol/status`). The snapshot maps existing runtime truth
(`/api/health`, `sync_runs`, scheduler state, outbox counters) into the
protocol's `observed_at`, `condition`, `severity`, `summary`, and `checks[]`
shape without exposing Plaud account PII, tokens, webhook secrets, or raw
secret-bearing errors.

The sync job is declared as `schedule.mode: internal-loop`, `cadence: PT15M`, and `stale_after: PT2H` for the Phase 3 soak. This is not a rewrite of the Plaud sync/download pipeline; it is the protocol surface that lets Home Infra, Infra Portal, Hermes, and future agents consume Plaud Mirror's sync state consistently.

The `v0.9.6` patch underneath keeps the `v0.9.0` reference-driven panel, the `v0.9.1` full-viewport shell, the `v0.9.2` Main cockpit sync fix, the `v0.9.3` DocKit trace-protocol governance merge, the `v0.9.4` Library playback/scroll fix, and the `v0.9.5` mobile shell fix, then syncs LLM-DocKit 4.9.6 governance/tooling: flexible HISTORY format validation, Trace v1.3 chat `Sent` guidance with seconds, expanded version marker handlers, preserved Plaud Mirror local validator guardrails, and `package-lock.json` version enforcement.

The `v0.9.5` patch underneath made the mobile shell usable: phone navigation now has a labeled `Vista` / `View` selector instead of icon-only rail buttons, the status strip collapses to one compact chip row, and Library dismiss/restore actions stay pinned to the top-right of mobile rows.

The `v0.9.4` patch underneath fixed the redesigned Library: Compact Play starts the native row audio, Full mode uses a wider desktop player column, and the recordings table owns its scroll region under the fixed Library header/toolbar/pagebar.

The `v0.9.3` patch underneath absorbed the DocKit trace-protocol sync without losing Plaud Mirror's local guardrails (`handoff-start-here-sync`, `prose-drift`, `unabsorbed-artifact`, and `json-version` package-manifest checking). The validator now runs 12 checks: the previous 11 plus `trace-protocol`, skipped unless explicitly enabled in `.dockit-config.yml`.

The `v0.9.2` patch underneath fixed the Main cockpit sync action: "Sync missing" no longer inherits the Historical Backfill form's conservative `limit=1`; it sends the displayed missing count as the sync limit, capped at the existing backend ceiling of 1000, and asks for confirmation for high-volume downloads. No backend API, auth, sync engine, storage, secret, or `.env` behavior changed.

The `v0.9.1` patch underneath fixed the production shell: the standalone reference frame had been copied too literally as a centered 1240px card on a grey presentation canvas. The real panel now fills the viewport, keeps the 212px rail on the left edge, and lets the main content scroll inside the remaining width and height.

The `v0.9.0` minor release underneath absorbs the standalone design reference at `docs/design/reference/plaud-mirror-panel-standalone.html` into the real React/Vite panel without changing backend APIs: a 212px operator rail, dense light-console visual system, five screens (Main, Library, Backfill, Configuration, Operations), ES/EN chrome toggle, health/status strip, auth-failure banner, next-action card, KPI coverage, live Library search/player controls, live Backfill preview, and Operations visibility for recent runs, outbox retry, and `lastErrors`.

The `v0.8.x` line underneath remains the Phase 4 re-auth foundation. `v0.8.0` added the local Chrome companion extension as the recommended capture surface, and `v0.8.1` fixes the remaining server-side validation mismatch: the operator proved the captured EU user token returns `200` from Plaud Web's own console, while the backend got an HTML `403` from Plaud/Cloudflare. The token and region were correct; the stale backend request fingerprint was not. `PlaudClient` now validates and syncs with Plaud Web's browser context (`https://web.plaud.ai`, browser-like Chrome UA, browser `sec-fetch-*` headers).

`v0.7.0` introduced the browser-assisted `/connect` handshake (D-019): a panel-initiated single-use `captureId` lets the operator refresh the ~300-day Plaud bearer with no DevTools and no stored password. It was chosen after confirming the operator's account is Google SSO (so it has no password and Plaud forbids adding one, killing credentials-login) and parking the official OAuth/MCP as deferred/watch (not disproven). `v0.7.1`-`v0.7.6` patched the bookmarklet delivery path (popup timing, copy install, encoding, token type/region, public-error hygiene, masked-token guard, shorter visible marker). The final finding was decisive: React-rendered `javascript:` links are not a reliable way to install a bookmarklet, because React replaces the `href` with a defensive throw before Chrome stores it. `v0.8.0` therefore added a local Chrome companion extension as the recommended capture surface. The extension reads the active Plaud tab's browser storage (`pld_tokenstr` first, scan fallback), redirects that tab to `/connect#token=...`, stores only the mirror origin, and never stores or logs the token. Manual token paste and copy-only bookmarklet remain fallback paths; Telegram is explicitly not a capture channel.

The `v0.6.x` line this builds on was the **Phase 3 hardening + tooling** sequence, forced by the 2026-06-10 security review: `v0.6.0` operator access control (D-018 — `PLAUD_MIRROR_ADMIN_PASSPHRASE` + signed HttpOnly session cookie gating `/api/*`, login screen, throttle, health PII redaction), startup crash recovery (D-013 amendment — orphaned `running`/`delivering` rows recovered at boot, at-least-once accepted), and Plaud client timeouts; then `v0.6.1` (LLM-DocKit 4.8.2 sync), `v0.6.2` (Doppler passphrase helper `scripts/set-admin-passphrase.sh`), `v0.6.3` (terminal-echo fix). The operator access control is armed in production (passphrase in Doppler, secondary "Startup Embassy" account). Runtime test count: 161 (134 Node + 27 web); validator smoke: 32 checks.

The `v0.5.5` runtime baseline underneath: **D-014 full** health observability (`lastErrors` ring buffer capped at 20, `recentSyncRuns` last 5 finished runs on `/api/health`) plus the D-016/D-017 governance layers (`prose-drift` at FAIL, `unabsorbed-artifact` baseline).

The runtime baseline carried from `v0.5.3` is the **durable webhook outbox** (D-013): each successfully-mirrored recording pushes its `recording.synced` payload into a `webhook_outbox` SQLite table. As corrected in `v0.10.4`, the worker uses eight backoff windows (30 s → 8 h, about 15 h 42 m cumulative) and a ninth final attempt before escalating to `permanently_failed`. The Operations screen has live counters (`pending` / `delivering` / `retry_waiting` / `permanently_failed` / `oldestPendingAgeMs`), a list of permanently-failed items, and a per-row Retry button; webhook URL/secret settings live in Configuration. The HMAC signature is recomputed at delivery time so rotating `webhookSecret` mid-flight is honoured. Routes: `GET /api/outbox` (failed list only) and `POST /api/outbox/:id/retry`.

The earlier `0.5.x` baseline still applies: in-process continuous sync scheduler (D-012, stabilized in `v0.5.1`, panel-driven from `v0.5.2`), two-layer anti-overlap, SQLite-persisted scheduler config. `SyncRunSummary.enqueued` counts webhook payloads pushed to the outbox during the run; `delivered` keeps its original semantic ("delivered synchronously inside this run") and structurally stays at 0 from `v0.5.3` onwards.

Operators upgrading from `0.4.x` should skip `v0.5.0` (scheduler default-on regression + missing service-layer anti-overlap) and go directly to `v0.10.7`.

The Phase 2 slice it inherits: a live Fastify API, a web panel for token setup, webhook configuration, sync/backfill controls, recordings visibility with inline audio playback, encrypted persisted manual bearer-token auth, manual sync and filtered historical backfill (async-202, with a `limit=0` "refresh server stats" path), SQLite-backed recording and delivery state, immediate HMAC-signed webhook delivery with persisted attempt logging, reversible local dismiss/restore plus the v0.11.0 optional upstream deletion, Docker packaging running as non-root `USER 1000:1000`, and the original Phase 1 spike CLI for direct Plaud probing. Concretely:

- a live Fastify API
- a web panel for token setup, webhook configuration, sync/backfill controls, and recordings visibility
- encrypted persisted manual bearer-token auth
- manual sync and filtered historical backfill (async: 202-then-poll, with a `limit=0` "refresh server stats" path)
- SQLite-backed recording and delivery state (including `dismissed`, `dismissed_at`, and `upstream_deleted_at` for curation/audit)
- immediate HMAC-signed webhook delivery with persisted attempt logging
- inline audio playback per recording, reversible local dismiss/restore, and an explicit permanent Plaud-delete action restricted to dismissed rows
- Docker packaging running non-root: 1000:1000 on dev-vm and the verified
  QNAP storage identity 1000:100 on NAS
- the original Phase 1 spike CLI for direct Plaud probing

What it still does not have:

- resumable backfill
- fully unattended re-login
- a completed final joint five-day stability window and live generic-webhook
  drill after the accepted NAS cutover

## Phase Boundaries

The roadmap is normative. See [docs/ROADMAP.md](ROADMAP.md).

Short version:

1. Phase 1 proved the Plaud path.
2. Phase 2 ships the first manual usable product slice.
3. Phase 3 adds unattended operation and resilience.
4. Phase 4 revisits re-auth and renewal strategy.
5. Phase 5 hardens deployment and validates NAS.
6. Phase 6 prepares public OSS fit and finish.

## References

- [docs/ROADMAP.md](ROADMAP.md)
- [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/operations/API_CONTRACT.md](operations/API_CONTRACT.md)
- [docs/operations/AUTH_AND_SYNC.md](operations/AUTH_AND_SYNC.md)
