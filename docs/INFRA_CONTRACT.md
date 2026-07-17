<!-- doc-version: 0.14.1 -->
# Infra Contract

Plaud Mirror publishes a `home-infra-protocol` project contract in
`infra.contract.yml`.

The source contract is reviewed against local protocol `0.10.0`. The
permanent-delete workflow is intentionally absent from this contract because
it is a project-local operator command, not a sync-status action or infra
policy. v0.13.0 publishes the scheduler's authoritative next execution without
changing cadence, freshness, ownership, or the sync engine.

The contract is an upstream input to `home-infra`. Plaud Mirror owns the sync
engine and its protocol status endpoint; `home-infra` owns the portal registry
that tells Infra Portal where to find the contract and status snapshot.

## Sync Job

`plaud-mirror-recordings-sync` is a `sync_jobs[]` entry because Plaud Mirror
synchronizes local state from Plaud, an external authority.

Current declaration:

- Source: `plaud`, `external`.
- Runtime: `dev-vm`, service `plaud-mirror`.
- Schedule mode: `internal-loop`.
- Cadence: `PT15M`.
- Silence budget: `PT2H` (greater than cadence plus `max_runtime: PT1H`).
- Status URL:
  `https://plaud.lamanoriega.com/api/protocol/sync-jobs/plaud-mirror-recordings-sync/status`.

The internal scheduler is the normal soak mode from `v0.10.7`. Plaud Mirror
continues to own and execute the loop; Home Infra only consumes its declared
cadence and status. `stale_after: PT2H` exceeds both the 15-minute cadence and
the one-hour maximum runtime, so consumers do not mark a legitimately long run
stale before its next expected evidence window.

## Status Snapshot

The status URL returns `schemas/status-snapshot.schema.json` shape from
`home-infra-protocol`:

- `observed_at`
- `next_run_at` when the live scheduler has an authoritative next tick
- `condition`
- `severity`
- `summary`
- `checks[]`

The endpoint is public like `/api/health`, but it is sanitized: it does not
return Plaud account PII, bearer tokens, webhook secrets, or raw secret-bearing
error bodies.

`observed_at` is anchored to sync evidence, not to the HTTP request time:

1. active sync `startedAt`, when a run is in flight;
2. latest finished sync `finishedAt`, when available;
3. latest auth validation time, before the first sync;
4. current time only as a first-boot fallback.

This keeps consumer freshness meaningful: Infra Portal or Hermes can join the
snapshot's `observed_at` with the contract's `stale_after` instead of treating
every HTTP read as a fresh sync event.

`next_run_at` comes directly from the active `SchedulerManager`; it is omitted
when scheduling is disabled or no next tick is known. It is a plan, not health
evidence. Consumers may show a countdown, but only `observed_at + stale_after`
determines whether the snapshot is stale.

## Producer / Consumer Boundary

Plaud Mirror is the producer. It reports its own local sync condition:

- Plaud auth state.
- Latest sync run state.
- Mirror coverage from one committed full-list generation (`plaud_total`,
  mirrored, dismissed, missing). Its four current-remote values partition the
  listing exactly.
- Private additive `local_only` and `upstream_deleted` count details. Protocol
  consumers already tolerate unknown fields; these are not registry policy.
- Scheduler state.
- Webhook outbox state.

Consumers derive freshness and policy:

- Infra Portal renders the job and derived freshness.
- Hermes may alert later when severity/freshness crosses its policy.
- `home-infra` registers the contract and portal-safe access URL, but does not
  execute Plaud syncs or move Plaud Mirror's scheduler into infra.
