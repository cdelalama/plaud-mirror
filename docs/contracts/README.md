# Transcription Intake v1

Plaud Mirror is a standalone audio-mirroring product. Transcription is an
optional integration over this provider-neutral network contract. Media2Text is
the first planned compatible provider, not a runtime, package, storage, or
deployment dependency.

## Provider Surface

A compatible transcription service exposes these routes below one configured
exact origin:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/intake-capabilities` | Prove contract compatibility before activation |
| `POST` | `/v1/intakes` | Durably admit one immutable audio revision |
| `GET` | `/v1/intakes/{intakeId}` | Reconcile accepted work after lost callbacks or restarts |

All three routes use the same out-of-band `Authorization: Bearer <intake
credential>`. The provider must scope it to this producer and these routes. A
successful `POST /v1/intakes` persists the obligation before returning a 2xx
admission body. Repeating a byte-identical request under the same
`idempotencyKey` returns the original admission with `deduplicated: true`.
HTTP 409 is reserved for the same identity/key carrying conflicting content.

The capability response must conform to
`transcription-intake-capabilities.v1.schema.json`; admission responses use
`transcription-intake-admission.v1.schema.json`; pull status uses
`transcription-intake-status.v1.schema.json`.

## Producer Surface

The intake payload contains two producer URLs:

- `artifact.url` is read with a separately provisioned artifact bearer. That
  token grants only active immutable delivery leases and is never serialized
  into a URL or payload.
- `callback.url` accepts an at-least-once status event conforming to
  `transcription-intake-status-event.v1.schema.json`.

Callbacks carry:

```text
X-Transcription-Timestamp: <ISO-8601 timestamp>
X-Transcription-Signature: sha256=<hex HMAC>
```

The signature input is `<timestamp>.<canonical-json-body>`. Canonical JSON sorts
every object key lexicographically, preserves array order, and emits compact
JSON. Plaud Mirror accepts a maximum five-minute clock skew. The status secret
is separately provisioned and is not the intake or artifact credential.

## Identity And Lifecycle

The durable source identity is:

```text
source.authority + source.collectionId + source.itemId + source.artifactRevision
```

For Plaud Mirror, `authority` is `plaud-mirror`, `collectionId` is a stable
pseudonymous installation workspace, `itemId` is the Plaud recording id, and
`artifactRevision` is exactly `sha256:<artifact.sha256>`.

Plaud Mirror pins a content-addressed delivery copy before enqueue and retains
it while any delivery is `pending`, `delivering`, `accepted`, or `processing`.
Local dismiss, permanent deletion from Plaud, and replacement of the mirror
file cannot invalidate that lease. The copy is released only after
`transcribed`, processing `failed`, or permanent admission failure/conflict.

Delivery is at least once. A provider must tolerate a crash after durable
admission but before the producer receives the response. Status transitions are
monotonic: `accepted -> processing -> transcribed|failed`; states may skip
forward but never regress. Push events are deduplicated by `eventId`, and pull
reconciliation is authoritative only when the complete source identity and
optional `recordSha256` match.

An explicit re-transcription of a terminal artifact is provider-owned. Reposting
the same intake is idempotent and does not request new processing.

## Security And Privacy

- Production origins use HTTPS. Plain HTTP is accepted only for loopback
  development.
- Origins contain no path, query, fragment, or embedded credentials.
- Intake payloads contain no Plaud bearer, operator session, filesystem path,
  shared-volume reference, intake credential, status secret, or artifact
  token.
- Titles and filenames are operator data intentionally disclosed to the chosen
  provider. Providers must avoid logging them unless their own operator policy
  explicitly permits it. Errors returned to Plaud Mirror use sanitized codes.
- Disabling a destination stops new admission and reconciliation requests, but
  does not revoke an already active artifact lease. Rotating the artifact token
  does revoke the old token.

## Conformance Gate

A provider is compatible only after all of these pass:

1. Capability discovery with the scoped intake credential.
2. One canary admission and authenticated byte-range artifact fetch.
3. SHA-256 and byte-length verification before processing.
4. Signed push status plus pull reconciliation with identical source identity.
5. Duplicate intake and duplicate status-event replay.
6. Explicit idempotency conflict and temporary 5xx recovery.
7. Terminal artifact-lease release.

Bulk historical replay remains operator-controlled and starts only after the
canary gate. It uses already verified local audio and never re-downloads from
Plaud.
