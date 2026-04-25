<!-- doc-version: 0.5.0 -->
# API Contract

This document describes the HTTP and webhook surface that now exists in-repo. The current implementation covers the full Phase 2 slice (manual sync/backfill, immediate HMAC-signed webhook delivery with persisted attempt log, local curation routes) and the Phase 3 scheduler subset that landed in `v0.5.0` (in-process continuous sync scheduler observable through the `scheduler` block in `/api/health`). The durable webhook outbox (D-013) and full health observability (`lastErrors`, outbox backlog) are deferred to `v0.5.1` / `v0.5.2` and are NOT yet part of the contract.

## Admin API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Return version, phase string, auth summary, last completed sync, currently active run (if any), scheduler status (D-014 partial — scheduler subset; full surface in `v0.5.2`), recording counts, webhook configuration flag, warning list. |
| `GET` | `/api/config` | Return sanitized runtime config |
| `PUT` | `/api/config` | Update webhook URL and optional webhook secret |
| `GET` | `/api/auth/status` | Return current auth state |
| `POST` | `/api/auth/token` | Validate and persist a Plaud bearer token |
| `POST` | `/api/sync/run` | Schedule a manual sync. Returns `202 Accepted` with `{ id, status: "running" }` immediately; the work runs in the background. Poll `GET /api/sync/runs/:id` or `GET /api/health` (`activeRun` carries progress while running, `lastSync` updates on completion). |
| `POST` | `/api/backfill/run` | Schedule a filtered historical backfill. Same async semantics as `/api/sync/run`: returns `202` with `{ id, status: "running" }`. |
| `GET` | `/api/backfill/candidates` | Dry-run preview: same filter pipeline as `/api/backfill/run` (listEverything + local filters), but returns matching recordings annotated with their local state (`missing`/`mirrored`/`dismissed`) and downloads nothing. Query params: `from`, `to`, `serialNumber`, `scene`, `previewLimit` (max 500, default 200). |
| `GET` | `/api/sync/runs/:id` | Return the live `SyncRunSummary` for a specific run id. `status` is `"running"` until the background work finishes (`"completed"` or `"failed"`). Returns 404 for unknown ids. |
| `GET` | `/api/devices` | Return the cached device catalog (`{ devices: Device[] }`). Populated from Plaud's `/device/list` as a side effect of every sync. No network call on this route — reads from SQLite. Empty array is a valid response when no sync has run yet. |
| `GET` | `/api/recordings` | List recent mirrored recordings. Accepts `?limit=<n>` (max 200, default 50) and `?includeDismissed=true` to include locally dismissed rows (hidden by default). |
| `GET` | `/api/recordings/:id/audio` | Stream the locally mirrored audio file for a single recording. Returns 404 if the recording is not tracked or has no local file. Response body is the raw audio bytes with the stored `Content-Type`. Supports HTTP Range (RFC 7233 single-range): advertises `Accept-Ranges: bytes`, includes `Content-Length`, and honors `Range: bytes=start-end` (plus suffix `bytes=-N` and open-ended `bytes=start-`) with `206 Partial Content`. Unsatisfiable ranges return `416` with `Content-Range: bytes */size`. Multipart byteranges are intentionally unsupported. |
| `DELETE` | `/api/recordings/:id` | Local-only dismiss. Removes the audio file from disk, clears `localPath`/`bytesWritten`, and marks the row `dismissed=true`. Plaud is not touched. Subsequent sync/backfill runs skip dismissed rows. |
| `POST` | `/api/recordings/:id/restore` | Clear the dismissed flag **and immediately re-download the audio** (fresh `/file/detail` + `/file/temp-url` against Plaud, artifact written to `recordings/<id>/audio.<ext>`). Returns 409 if the recording is not currently dismissed. If the immediate download fails (missing/invalid token, network error), the flag is still cleared and the error is surfaced so the caller can recover. |

## Request Shapes

### `POST /api/auth/token`

```json
{
  "accessToken": "plaud-bearer-token"
}
```

### `PUT /api/config`

```json
{
  "webhookUrl": "https://example.internal/hooks/plaud",
  "webhookSecret": "optional-secret-to-store"
}
```

`webhookSecret` is optional on update. Omitting it keeps the current secret unchanged. Sending `null` clears it.

### `POST /api/sync/run`

```json
{
  "limit": 100,
  "forceDownload": false
}
```

`limit` accepts `0` (refresh-only: paginate the full Plaud listing, update `plaudTotal` and stable ranks, download nothing). Maximum `1000`.

Response is `202 Accepted`:

```json
{
  "id": "sync-run-id",
  "status": "running"
}
```

### `POST /api/backfill/run`

```json
{
  "from": "2026-04-01",
  "to": "2026-04-22",
  "serialNumber": "PLAUD-1",
  "scene": 7,
  "limit": 100,
  "forceDownload": false
}
```

All backfill filters are optional. Response is `202 Accepted` with the same `{ id, status: "running" }` shape as `/api/sync/run`.

### `GET /api/backfill/candidates`

Query parameters (all optional):

- `from`, `to`: `YYYY-MM-DD` ISO dates, inclusive.
- `serialNumber`: restrict to one device's recordings.
- `scene`: integer scene filter (retained for programmatic callers; the web UI no longer surfaces this).
- `previewLimit`: response-size cap (`1`–`500`, default `200`).

Response (200 OK):

```json
{
  "plaudTotal": 308,
  "matched": 45,
  "missing": 12,
  "previewLimit": 200,
  "recordings": [
    {
      "id": "plaud-recording-id",
      "title": "Weekly sync",
      "createdAt": "2026-04-22T10:00:00.000Z",
      "durationSeconds": 1820,
      "serialNumber": "PLAUD-XYZ",
      "scene": 1,
      "sequenceNumber": 301,
      "state": "missing"
    }
  ]
}
```

- `matched` is the count before response truncation (authoritative).
- `missing` is how many of `matched` would actually download right now (state `"missing"`).
- `state` is one of `"missing"` | `"mirrored"` | `"dismissed"`.
- `sequenceNumber` is the stable `#N` rank in the operator's full Plaud timeline, same as the library view.

### `GET /api/sync/runs/:id`

No request body. Returns the live `SyncRunSummary` for the run:

```json
{
  "id": "sync-run-id",
  "mode": "sync",
  "status": "running",
  "startedAt": "2026-04-24T10:25:00.000Z",
  "finishedAt": null,
  "examined": 308,
  "matched": 25,
  "downloaded": 7,
  "delivered": 0,
  "skipped": 0,
  "plaudTotal": 308,
  "error": null
}
```

`finishedAt` is `null` while the run is in flight and stamped once the background work resolves. `status` transitions from `"running"` to `"completed"` (or `"failed"` with `error` populated). Returns 404 for unknown ids.

### `DELETE /api/recordings/:id`

No request body. Response:

```json
{
  "id": "plaud-recording-id",
  "dismissed": true,
  "dismissedAt": "2026-04-22T10:10:00.000Z",
  "localFileRemoved": true
}
```

`localFileRemoved` is `false` if there was no local file on disk (e.g. download never happened or the file was already removed manually). The SQLite row is still marked as dismissed.

### `POST /api/recordings/:id/restore`

No request body. Response:

```json
{
  "id": "plaud-recording-id",
  "dismissed": false
}
```

Returns 409 when called on a recording whose `dismissed` is already `false`.

### `GET /api/health`

No request body. Response (200 OK):

```json
{
  "version": "0.5.0",
  "phase": "Phase 3 - unattended operation",
  "auth": {
    "mode": "manual-token",
    "configured": true,
    "state": "healthy",
    "resolvedApiBase": "https://api.plaud.ai",
    "lastValidatedAt": "2026-04-25T10:00:00.000Z",
    "lastError": null,
    "userSummary": null
  },
  "lastSync": { /* SyncRunSummary, or null before any run completes */ },
  "activeRun": { /* SyncRunSummary while a run is in flight, else null */ },
  "scheduler": {
    "enabled": true,
    "intervalMs": 900000,
    "nextTickAt": "2026-04-25T10:15:00.000Z",
    "lastTickAt": "2026-04-25T10:00:00.000Z",
    "lastTickStatus": "completed",
    "lastTickError": null
  },
  "recordingsCount": 215,
  "dismissedCount": 12,
  "webhookConfigured": true,
  "warnings": []
}
```

Fields:

- `phase` reads `"Phase 3 - unattended operation"` when the scheduler is enabled, `"Phase 2 - manual sync"` otherwise. The exact string is for human consumption; do not key logic off it.
- `lastSync` holds the last **completed** run (`status` ∈ `"completed"` / `"failed"`). It stays pinned through subsequent runs so the panel's hero metric does not flicker to zero. `null` until any run finishes.
- `activeRun` holds the currently-running run (only when `status === "running"`); `null` otherwise. The panel polls `/api/health` every 2 s while `activeRun !== null` and stops once it clears.
- `scheduler` is the partial D-014 surface shipped in `v0.5.0`. Always present (defaults to `{ enabled: false, intervalMs: 0, nextTickAt: null, lastTickAt: null, lastTickStatus: null, lastTickError: null }` when the scheduler is disabled). `lastTickStatus` is one of `"completed"` / `"failed"` / `"skipped"` (anti-overlap skip) or `null` (no tick yet in this process). `nextTickAt` and `lastTickAt` are ISO 8601 strings or `null`. `lastTickError` carries the `Error.message` from the most recent failed tick.
- `recordingsCount` excludes dismissed rows; `dismissedCount` is the dismissed-only count.
- `warnings` is a free-form string array reserved for non-fatal operator-visible signals.

## Webhook Contract

Event name:

```text
recording.synced
```

Header:

```text
X-Plaud-Mirror-Signature-256: sha256=<hex-digest>
```

Payload:

```json
{
  "event": "recording.synced",
  "source": "plaud-mirror",
  "recording": {
    "id": "plaud-recording-id",
    "title": "Weekly sync",
    "createdAt": "2026-04-21T10:22:00.000Z",
    "localPath": "recordings/plaud-recording-id/audio.mp3",
    "format": "mp3",
    "contentType": "audio/mpeg",
    "bytesWritten": 123456
  },
  "sync": {
    "syncedAt": "2026-04-21T10:25:11.000Z",
    "deliveryAttempt": 1,
    "mode": "backfill"
  }
}
```

## Phase Boundary Note

Phase 2 delivers the manual route surface and immediate HMAC-signed webhook delivery with persisted attempt logging. Phase 3 is in progress and lands incrementally across `0.5.x`:

- `v0.5.0` (this release) adds the in-process continuous sync scheduler and the `health.scheduler` subset of D-014. Webhook delivery is still **immediate** — the outbox does not yet exist, so a failed delivery still requires the operator to re-trigger sync.
- `v0.5.1` adds the durable webhook outbox (D-013): explicit FSM, exponential-backoff retry, and the persisted queue replaces the immediate-only delivery path. The contract above will gain backlog observability fields.
- `v0.5.2` adds the full health observability surface (D-014, full): a `lastErrors` ring buffer and outbox backlog counters.
