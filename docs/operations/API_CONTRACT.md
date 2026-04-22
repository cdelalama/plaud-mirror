<!-- doc-version: 0.1.1 -->
# API Contract

This document captures the planned stable surfaces for Plaud Mirror before implementation starts.

## Scope

Plaud Mirror is expected to expose:
- an admin HTTP API used by the local web UI
- a webhook payload for downstream delivery after audio sync

## Planned Admin API

Phase 2 target surface for the first usable release:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Liveness and high-level service status |
| `GET` | `/api/config` | Return sanitized runtime configuration |
| `PUT` | `/api/config` | Update non-secret config such as poll interval or webhook target |
| `POST` | `/api/auth/token` | Save or validate a bearer token |
| `POST` | `/api/sync/run` | Trigger an immediate sync |
| `POST` | `/api/backfill/run` | Trigger a filtered historical backfill job |
| `GET` | `/api/recordings` | List mirrored recordings with local status |
| `GET` | `/api/auth/status` | Return auth mode, token expiry, and last successful validation |

Later-phase candidate route:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/credentials` | Save or validate Plaud credentials for automatic re-login once that mode exists |

## Planned Webhook Contract

Plaud Mirror should emit a downstream webhook when a new audio artifact is mirrored. The same `recording.synced` event shape is used for both ongoing sync and historical backfill.

Webhook deliveries for the first usable release should be signed with an HMAC-SHA256 header, for example:

```
X-Plaud-Mirror-Signature-256: sha256=<hex-digest>
```

Example payload:

```json
{
  "event": "recording.synced",
  "source": "plaud-mirror",
  "recording": {
    "id": "plaud-recording-id",
    "title": "Weekly sync",
    "createdAt": "2026-04-21T10:22:00Z",
    "localPath": "recordings/plaud-recording-id/audio.ogg",
    "format": "ogg"
  },
  "sync": {
    "syncedAt": "2026-04-21T10:25:11Z",
    "deliveryAttempt": 1
  }
}
```

## Contract Change Workflow

1. Decide whether the change is breaking.
2. Update this document and the implementation in the same session.
3. Update shared schemas in `packages/shared/`.
4. Add or update integration tests in `tests/integration/`.
5. Record the impact in `docs/llm/HISTORY.md` and `docs/VERSIONING_RULES.md` if needed.

## Checklist

- [ ] HTTP route documented
- [ ] Webhook schema documented
- [ ] Breaking change reviewed
- [ ] Version impact assessed
