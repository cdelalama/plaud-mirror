<!-- doc-version: 0.1.0 -->
# Authentication and Sync Operations

This runbook defines how Plaud Mirror should behave around authentication, token retention, and recording sync.

## Scope

- Plaud auth modes
- Token renewal policy
- Sync cadence and retry behavior
- Failure handling and operator expectations

## Auth Modes

### Phase 2 Mode: Bearer Token

This is the required auth mode for the first usable release. The operator pastes a Plaud bearer token in the UI; Plaud Mirror encrypts and persists it, validates it, and surfaces a degraded state when it expires or becomes invalid.

### Later Mode: Username and Password

Optional later mode for automatic re-login. Credentials are stored encrypted at rest and used only when automatic renewal is actually implemented and considered reliable enough to ship.

### Explicitly Disfavored: Browser-Assisted Renewal

Browser automation is not part of the planned path for the first usable release. Reintroducing it would require explicit new approval.

## Auth State Model

Minimum state to persist:
- auth mode
- access token
- token expiry timestamp
- Plaud region or API base metadata if discovered
- last successful auth validation
- whether automatic renewal is available in the current deployment
- last renewal attempt and failure reason

## Renewal Policy

- Validate the active token on startup.
- In the first usable release, do not attempt automatic recovery. If the token is expired, near-useless, or a Plaud API call returns `401`, move the service into a degraded auth state and require the operator to provide a fresh token.
- If `credentials-relogin` is added in a later phase, renew before expiry rather than after it. Initial target remains less than 15 minutes remaining.
- Browser-assisted renewal is not a fallback plan; if direct renewal proves too brittle, stop and redesign rather than silently expanding the auth surface.

## Sync Policy

- Support manual sync and filtered historical backfill from the first usable release.
- Once continuous sync lands, poll Plaud on a configurable interval with a conservative default target of 15 minutes.
- De-duplicate using the Plaud recording ID as the primary key.
- Download the original audio artifact first. Local transcode is optional and not part of the critical path.
- Persist sync metadata even when downstream webhook delivery fails.
- Historical backfill emits the same `recording.synced` webhook contract as ongoing sync.

## Failure Modes

| Failure | Expected Service Response | Operator Action |
|---------|---------------------------|-----------------|
| Token expired or invalid in manual-token mode | Mark auth degraded, stop new downloads that require auth, surface warning in UI | Provide a fresh token |
| Credentials invalid in a later auto-relogin phase | Stop renewal attempts after bounded retries, keep last good token if still valid | Fix credentials |
| Plaud temp URL download failed | Retry with bounded backoff | Inspect Plaud/API behavior and logs |
| Region/auth flow changed upstream | Upstream watch should detect likely changes; sync may degrade | Review tracked upstream repos and update adapter logic |

## Security Rules

- Never log passwords, tokens, or full temporary download URLs.
- Keep secrets encrypted at rest.
- Rotate credentials after debugging if exposure is suspected.
- Treat recording titles and audio content as sensitive data.

## Operational Signals

The UI and health model should expose:
- current auth mode
- token expiry countdown
- last successful auth validation
- last successful sync
- whether automatic renewal is available in this deployment
- number of pending or failed recordings
