<!-- doc-version: 0.1.0 -->
# Authentication and Sync Operations

This runbook defines how Plaud Mirror should behave around authentication, token retention, and recording sync.

## Scope

- Plaud auth modes
- Token renewal policy
- Sync cadence and retry behavior
- Failure handling and operator expectations

## Auth Modes

### Mode 1: Bearer Token

Recommended when the operator wants to avoid storing Plaud credentials. The token is validated and monitored for expiry, but Plaud Mirror cannot recover automatically if the token expires and no credentials are present.

### Mode 2: Username and Password

Optional mode for automatic re-login. Credentials are stored encrypted at rest and used only to renew the Plaud session when needed.

## Auth State Model

Minimum state to persist:
- auth mode
- access token
- token expiry timestamp
- Plaud region or API base metadata if discovered
- last successful auth validation
- last renewal attempt and failure reason

## Renewal Policy

- Validate the active token on startup.
- Refresh or re-login before expiry, not after it. Initial target: renew when less than 15 minutes remain.
- If a Plaud API call returns `401`, do one forced renewal and retry the original call once.
- If credentials are not available, move the service into a degraded auth state and surface it in the UI.

## Sync Policy

- Poll Plaud on a configurable interval.
- De-duplicate using the Plaud recording ID as the primary key.
- Download the original audio artifact first. Local transcode is optional and not part of the critical path.
- Persist sync metadata even when downstream webhook delivery fails.

## Failure Modes

| Failure | Expected Service Response | Operator Action |
|---------|---------------------------|-----------------|
| Token expired, no credentials | Mark auth degraded, stop new downloads that require auth, surface warning in UI | Provide a fresh token or credentials |
| Credentials invalid | Stop renewal attempts after bounded retries, keep last good token if still valid | Fix credentials |
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
- number of pending or failed recordings
