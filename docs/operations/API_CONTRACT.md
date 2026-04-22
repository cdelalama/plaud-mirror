<!-- doc-version: 0.3.0 -->
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
| `GET` | `/api/recordings` | List recent mirrored recordings |

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
