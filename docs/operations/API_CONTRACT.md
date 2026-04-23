<!-- doc-version: 0.4.9 -->
# API Contract

This document describes the Phase 2 HTTP and webhook surface that now exists in-repo.

## Admin API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Return version, phase, auth summary, last sync, warning list |
| `GET` | `/api/config` | Return sanitized runtime config |
| `PUT` | `/api/config` | Update webhook URL and optional webhook secret |
| `GET` | `/api/auth/status` | Return current auth state |
| `POST` | `/api/auth/token` | Validate and persist a Plaud bearer token |
| `POST` | `/api/sync/run` | Trigger a manual sync over the latest listings |
| `POST` | `/api/backfill/run` | Trigger a filtered historical backfill |
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

All backfill filters are optional.

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

Phase 2 delivers the route surface and immediate webhook delivery with persisted attempt logging. Durable retry/outbox semantics remain a Phase 3 concern and should not be implied here.
