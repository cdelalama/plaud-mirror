<!-- doc-version: 0.10.8 -->
# Infra Contract

Plaud Mirror publishes a `home-infra-protocol` project contract in
`infra.contract.yml`.

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

## Producer / Consumer Boundary

Plaud Mirror is the producer. It reports its own local sync condition:

- Plaud auth state.
- Latest sync run state.
- Mirror coverage (`plaud_total`, mirrored, dismissed, missing).
- Scheduler state.
- Webhook outbox state.

Consumers derive freshness and policy:

- Infra Portal renders the job and derived freshness.
- Hermes may alert later when severity/freshness crosses its policy.
- `home-infra` registers the contract and portal-safe access URL, but does not
  execute Plaud syncs or move Plaud Mirror's scheduler into infra.
