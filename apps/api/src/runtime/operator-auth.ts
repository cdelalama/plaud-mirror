import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Operator access control primitives (D-018, v0.6.0).
 *
 * Plaud Mirror is single-operator, so the access model is deliberately
 * minimal: one shared passphrase (`PLAUD_MIRROR_ADMIN_PASSPHRASE`) that,
 * once posted to `POST /api/session/login`, yields a stateless
 * HMAC-signed session cookie. No user table, no password hashing at
 * rest (the passphrase lives in the deployment's env, like the master
 * key), no refresh-token dance.
 *
 * Properties:
 * - The signing key is derived from BOTH the master key and the
 *   passphrase, so rotating either one invalidates every outstanding
 *   session cookie.
 * - Tokens are `<expiresAtMs>.<base64url HMAC>` — stateless, nothing to
 *   persist or clean up, verification is one HMAC.
 * - Cookie is HttpOnly + SameSite=Lax. Lax means cross-site POST/PUT/
 *   DELETE never carry the cookie, which is the CSRF protection this
 *   surface needs. The Secure flag is intentionally NOT set because the
 *   LAN fallback access path (`http://<host>:3040`) has no TLS; the
 *   public hostname terminates TLS at edge-caddy.
 * - Passphrase comparison hashes both sides before timingSafeEqual so
 *   the length of the configured passphrase does not leak through the
 *   comparison's length check.
 */

export const SESSION_COOKIE_NAME = "plaud_mirror_session";

/**
 * 30 days. Long on purpose: the primary re-auth surface is the
 * operator's phone, and a passphrase prompt every few hours would
 * defeat the "fix the Plaud token from the phone in seconds" goal.
 * The cookie is bound to the passphrase, so rotating the passphrase
 * is the kill switch.
 */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const SESSION_CONTEXT = "plaud-mirror-session-v1";

export function deriveSessionKey(masterKey: string, passphrase: string): Buffer {
  return createHash("sha256")
    .update(`${SESSION_CONTEXT}:${masterKey}:${passphrase}`, "utf8")
    .digest();
}

export function createSessionToken(
  key: Buffer,
  now: Date = new Date(),
  ttlMs: number = SESSION_TTL_MS,
): string {
  const expiresAt = now.getTime() + ttlMs;
  return `${expiresAt}.${signSessionExpiry(key, expiresAt)}`;
}

export function verifySessionToken(
  key: Buffer,
  token: string | undefined,
  now: Date = new Date(),
): boolean {
  if (!token) {
    return false;
  }
  const separator = token.indexOf(".");
  if (separator <= 0) {
    return false;
  }
  const expiresAt = Number(token.slice(0, separator));
  if (!Number.isInteger(expiresAt) || expiresAt <= now.getTime()) {
    return false;
  }
  const provided = Buffer.from(token.slice(separator + 1), "utf8");
  const expected = Buffer.from(signSessionExpiry(key, expiresAt), "utf8");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function signSessionExpiry(key: Buffer, expiresAt: number): string {
  return createHmac("sha256", key)
    .update(`${SESSION_CONTEXT}:${expiresAt}`, "utf8")
    .digest("base64url");
}

export function verifyPassphrase(expected: string, provided: string): boolean {
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  const providedDigest = createHash("sha256").update(provided, "utf8").digest();
  return timingSafeEqual(expectedDigest, providedDigest);
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) {
    return cookies;
  }
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const name = part.slice(0, eq).trim();
    const rawValue = part.slice(eq + 1).trim();
    if (!name) {
      continue;
    }
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }
  return cookies;
}

export function buildSessionCookie(token: string, ttlMs: number = SESSION_TTL_MS): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(ttlMs / 1000)}`;
}

export function buildSessionClearCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * In-memory failed-login throttle. Single-process, single-operator:
 * a global window (not per-IP) is enough to make LAN brute force
 * impractical (5 attempts/minute = ~7200/day against a passphrase)
 * without pulling in a rate-limit dependency. Resets on success and
 * on process restart.
 */
export class LoginThrottle {
  private failures: number[] = [];

  constructor(
    private readonly maxAttempts: number = 5,
    private readonly windowMs: number = 60_000,
  ) {}

  isBlocked(now: Date = new Date()): boolean {
    this.prune(now);
    return this.failures.length >= this.maxAttempts;
  }

  registerFailure(now: Date = new Date()): void {
    this.prune(now);
    this.failures.push(now.getTime());
  }

  reset(): void {
    this.failures = [];
  }

  private prune(now: Date): void {
    const cutoff = now.getTime() - this.windowMs;
    this.failures = this.failures.filter((timestamp) => timestamp > cutoff);
  }
}
