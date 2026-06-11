import { randomUUID } from "node:crypto";

/**
 * One-time, short-lived capture sessions for the browser-assisted Plaud
 * re-auth flow (D-019, Phase 4 / v0.7.0).
 *
 * The operator starts a capture from the panel (`POST /api/connect/start`),
 * which mints a `captureId`. The `/connect` page must present that same
 * `captureId` back (`POST /api/connect/complete`) for the captured bearer to
 * be accepted. This binds the token swap to operator intent: a crafted
 * `/connect#token=<attacker-token>` link that a logged-in operator is tricked
 * into opening cannot replace the stored token, because it carries no live,
 * operator-minted `captureId` (token-fixation defence). Garbage tokens are
 * already rejected downstream by `service.saveAccessToken` validating the
 * bearer against Plaud `/user/me`; this layer is specifically about intent.
 *
 * In-memory by design: a capture is a seconds-to-minutes interaction. A
 * process restart simply means the operator taps "Reconnect" again. Single
 * use + TTL keep the window tight.
 */
export const CAPTURE_TTL_MS = 10 * 60 * 1000;

interface CaptureRecord {
  expiresAt: number;
}

export class CaptureSessionStore {
  private readonly sessions = new Map<string, CaptureRecord>();

  constructor(private readonly ttlMs: number = CAPTURE_TTL_MS) {}

  /** Mint a new single-use capture id. */
  start(now: Date = new Date()): { captureId: string; expiresAt: string } {
    this.prune(now);
    const captureId = randomUUID();
    const expiresAtMs = now.getTime() + this.ttlMs;
    this.sessions.set(captureId, { expiresAt: expiresAtMs });
    return { captureId, expiresAt: new Date(expiresAtMs).toISOString() };
  }

  /**
   * Consume a capture id: returns true and deletes it if it was present and
   * not expired, false otherwise. Single-use — a second call for the same id
   * returns false.
   */
  consume(captureId: string, now: Date = new Date()): boolean {
    this.prune(now);
    const record = this.sessions.get(captureId);
    if (!record) {
      return false;
    }
    this.sessions.delete(captureId);
    return record.expiresAt > now.getTime();
  }

  /** Drop expired records so the map cannot grow without bound. */
  private prune(now: Date): void {
    const cutoff = now.getTime();
    for (const [id, record] of this.sessions) {
      if (record.expiresAt <= cutoff) {
        this.sessions.delete(id);
      }
    }
  }
}
