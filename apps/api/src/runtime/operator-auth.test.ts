import assert from "node:assert/strict";
import test from "node:test";

import {
  LoginThrottle,
  SESSION_TTL_MS,
  createSessionToken,
  deriveSessionKey,
  parseCookies,
  verifyPassphrase,
  verifySessionToken,
} from "./operator-auth.js";

test("session token round-trips and expires at the TTL boundary", () => {
  const key = deriveSessionKey("master-key", "passphrase");
  const now = new Date("2026-06-10T00:00:00.000Z");
  const token = createSessionToken(key, now);

  assert.ok(verifySessionToken(key, token, now));
  assert.ok(verifySessionToken(key, token, new Date(now.getTime() + SESSION_TTL_MS - 1_000)));
  assert.ok(!verifySessionToken(key, token, new Date(now.getTime() + SESSION_TTL_MS + 1_000)));
});

test("session token rejects tampering, malformed input, and rotated keys", () => {
  const key = deriveSessionKey("master-key", "passphrase");
  const rotatedKey = deriveSessionKey("master-key", "rotated-passphrase");
  const now = new Date("2026-06-10T00:00:00.000Z");
  const token = createSessionToken(key, now);
  const separator = token.indexOf(".");
  const expiresAt = Number(token.slice(0, separator));
  const signature = token.slice(separator + 1);

  // Rotating the passphrase (or master key) invalidates every session.
  assert.ok(!verifySessionToken(rotatedKey, token, now));
  // Forging a later expiry without re-signing fails.
  assert.ok(!verifySessionToken(key, `${expiresAt + 9_999_999}.${signature}`, now));
  assert.ok(!verifySessionToken(key, undefined, now));
  assert.ok(!verifySessionToken(key, "garbage", now));
  assert.ok(!verifySessionToken(key, ".only-signature", now));
});

test("verifyPassphrase accepts exact match only", () => {
  assert.ok(verifyPassphrase("secret", "secret"));
  assert.ok(!verifyPassphrase("secret", "secret2"));
  assert.ok(!verifyPassphrase("secret", "Secret"));
  assert.ok(!verifyPassphrase("secret", ""));
});

test("parseCookies extracts the session cookie among others and tolerates junk", () => {
  const cookies = parseCookies("a=1; plaud_mirror_session=123.abc; b=2; malformed");
  assert.equal(cookies.plaud_mirror_session, "123.abc");
  assert.equal(cookies.a, "1");
  assert.deepEqual(parseCookies(undefined), {});
});

test("LoginThrottle blocks after maxAttempts inside the window and recovers afterwards", () => {
  const throttle = new LoginThrottle(3, 1_000);
  const t0 = new Date("2026-06-10T00:00:00.000Z");

  assert.ok(!throttle.isBlocked(t0));
  throttle.registerFailure(t0);
  throttle.registerFailure(t0);
  assert.ok(!throttle.isBlocked(t0));
  throttle.registerFailure(t0);
  assert.ok(throttle.isBlocked(t0));
  // Window expiry unblocks without explicit reset.
  assert.ok(!throttle.isBlocked(new Date(t0.getTime() + 1_500)));
  // Successful login resets immediately.
  throttle.registerFailure(t0);
  throttle.reset();
  assert.ok(!throttle.isBlocked(t0));
});
