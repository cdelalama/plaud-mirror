import { describe, expect, it } from "vitest";

import { buildBookmarklet, extractJwt, extractPlaudToken, type StorageLike } from "./plaud-token.js";

// A real-shaped JWT (header.payload.signature) whose payload decodes to { sub }.
function jwt(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub, exp: 9999999999 })).toString("base64url");
  return `${header}.${payload}.sigsigsig`;
}

function store(entries: Record<string, string>): StorageLike {
  const keys = Object.keys(entries);
  return {
    length: keys.length,
    key: (i) => keys[i] ?? null,
    getItem: (k) => (k in entries ? entries[k]! : null),
  };
}

describe("extractJwt", () => {
  it("pulls a bare JWT, a Bearer-prefixed JWT, and a quoted JWT", () => {
    const t = jwt("u1");
    expect(extractJwt(t)).toBe(t);
    expect(extractJwt(`Bearer ${t}`)).toBe(t);
    expect(extractJwt(`"${t}"`)).toBe(t);
  });
  it("rejects non-JWT strings", () => {
    expect(extractJwt("not-a-token")).toBeNull();
    expect(extractJwt(null)).toBeNull();
    expect(extractJwt(42)).toBeNull();
  });
});

describe("extractPlaudToken", () => {
  it("prefers the active workspace token over raw token keys", () => {
    const userId = "user-abc";
    const wsToken = jwt("ws");
    const ls = store({
      pld_tokenstr: JSON.stringify(jwt(userId)),
      [`pld_${userId}:currentWorkspaceId`]: JSON.stringify("w1"),
      [`pld_${userId}:workspaceList`]: JSON.stringify([
        { workspaceId: "w1", workspaceToken: `Bearer ${wsToken}`, expiresAt: 9_999_999_999_999 },
      ]),
    });
    expect(extractPlaudToken([ls], "", 1_000)).toBe(wsToken);
  });

  it("skips an expired workspace token and falls back to a priority key", () => {
    const userId = "user-abc";
    const fallback = jwt("fallback");
    const ls = store({
      pld_tokenstr: fallback,
      [`pld_${userId}:currentWorkspaceId`]: JSON.stringify("w1"),
      [`pld_${userId}:workspaceList`]: JSON.stringify([
        { workspaceId: "w1", workspaceToken: `Bearer ${jwt("stale")}`, expiresAt: 1 },
      ]),
    });
    // jwtSubject(pld_tokenstr) = "fallback" → no matching workspace → priority key wins.
    expect(extractPlaudToken([ls], "", 1_000)).toBe(fallback);
  });

  it("falls back to a full scan, then to cookies, then null", () => {
    expect(extractPlaudToken([store({ random: jwt("scan") })], "")).toBe(jwt("scan"));
    expect(extractPlaudToken([store({})], `access_token=${jwt("cookie")}`)).toBe(jwt("cookie"));
    expect(extractPlaudToken([store({}), null], "")).toBeNull();
  });
});

describe("buildBookmarklet", () => {
  it("produces a javascript: URL that targets the given mirror origin's /connect", () => {
    const bm = buildBookmarklet("https://plaud.example.com");
    expect(bm.startsWith("javascript:")).toBe(true);
    const decoded = decodeURIComponent(bm.slice("javascript:".length));
    expect(decoded).toContain("https://plaud.example.com");
    expect(decoded).toContain("/connect#token=");
    expect(decoded).toContain("pld_tokenstr");
    expect(decoded).toContain("plaud.ai");
  });
});
