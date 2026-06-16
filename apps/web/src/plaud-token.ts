// Browser-side Plaud bearer extraction for the assisted re-auth flow
// (D-019, Phase 4 / v0.7.0).
//
// The token-location algorithm (priority keys / pld_tokenstr first, then the
// per-workspace token, then a full storage scan, then cookies) is adapted from:
//
//   iiAtlas/plaud-recording-downloader — extension/lib/auth-probe.js
//   MIT License, Copyright (c) 2025 Atlas Wegman
//   https://github.com/iiAtlas/plaud-recording-downloader
//
// Deliberate divergence from iiAtlas (v0.7.3): iiAtlas prioritizes the
// per-workspace token (it targets file ops); Plaud Mirror prioritizes the
// global user token (pld_tokenstr) because it validates against /user/me,
// which rejects the workspace token with 403. See UPSTREAMS Phase 4 / D-019.
//
// Reused with attribution per D-005 (MIT, attribution preserved) and D-007
// (iiAtlas is the token-storage-keys reference). Reimplemented in TypeScript,
// not copied verbatim, and shipped two ways: `extractPlaudToken` (testable,
// runs over injected storage objects) and `buildBookmarklet` (the
// self-contained `javascript:` string the operator drags to their bookmarks
// bar, which runs on app.plaud.ai and POSTs nothing — it only reads storage
// and navigates the token to the mirror's /connect page).

const JWT_REGEX = /eyJ[A-Za-z0-9_\-=]{5,}\.[A-Za-z0-9_\-=]+\.[A-Za-z0-9_\-=]+/;
const PRIORITY_KEYS = ["pld_tokenstr", "tokenstr", "token", "access_token", "plaud_token", "auth_token"];

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
}

export function extractJwt(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = value.replace(/^"|"$/g, "").trim();
  if (!cleaned) {
    return null;
  }
  const bearer = cleaned.match(/Bearer\s+(.+)/i);
  if (bearer && bearer[1] && JWT_REGEX.test(bearer[1].trim())) {
    return bearer[1].trim();
  }
  const direct = cleaned.match(JWT_REGEX);
  return direct ? direct[0] : null;
}

function parseJsonValue(value: string | null): unknown {
  if (value == null) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function jwtSubject(value: unknown): string | null {
  const jwt = extractJwt(value);
  if (!jwt) {
    return null;
  }
  try {
    const payload = jwt.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(atob(payload)) as { sub?: string };
    return parsed?.sub ?? null;
  } catch {
    return null;
  }
}

// Resolve the per-workspace token, keyed by the logged-in user id, honouring
// its expiry. This is the FALLBACK in extractPlaudToken (v0.7.3): Plaud Mirror
// prefers the user token from the priority keys because /user/me rejects the
// workspace token; this is only used when no priority key holds a JWT.
function activeWorkspaceToken(storage: StorageLike, now: number): string | null {
  const userIds: string[] = [];
  const subject = jwtSubject(parseJsonValue(storage.getItem("pld_tokenstr")));
  if (subject) {
    userIds.push(subject);
  }
  for (let i = 0; i < storage.length; i += 1) {
    const match = /^pld_(.+):currentWorkspaceId$/.exec(storage.key(i) ?? "");
    if (match?.[1] && !userIds.includes(match[1])) {
      userIds.push(match[1]);
    }
  }
  for (const userId of userIds) {
    const workspaceId = parseJsonValue(storage.getItem(`pld_${userId}:currentWorkspaceId`));
    const workspaceList = parseJsonValue(storage.getItem(`pld_${userId}:workspaceList`));
    if (!workspaceId || !Array.isArray(workspaceList)) {
      continue;
    }
    const workspace = workspaceList.find((item) => item?.workspaceId === workspaceId);
    if (!workspace?.workspaceToken) {
      continue;
    }
    if (workspace.expiresAt && Number(workspace.expiresAt) <= now) {
      continue;
    }
    const token = extractJwt(workspace.workspaceToken);
    if (token) {
      return token;
    }
  }
  return null;
}

export function extractPlaudToken(
  stores: Array<StorageLike | null | undefined>,
  cookie = "",
  now: number = Date.now(),
): string | null {
  // Priority keys FIRST (pld_tokenstr is the global USER token). Plaud Mirror
  // validates with /user/me — a user endpoint — and then lists/downloads with
  // the same bearer; the user token works for all of that, which is what the
  // mirror used successfully before. The per-workspace token (iiAtlas's first
  // choice, because it targets file ops) is REJECTED by /user/me with 403, so
  // it is only a fallback here. Reordered in v0.7.3 after exactly that 403.
  for (const store of stores) {
    if (!store) {
      continue;
    }
    for (const key of PRIORITY_KEYS) {
      const extracted = extractJwt(store.getItem(key));
      if (extracted) {
        return extracted;
      }
    }
  }
  for (const store of stores) {
    if (store) {
      const token = activeWorkspaceToken(store, now);
      if (token) {
        return token;
      }
    }
  }
  for (const store of stores) {
    if (!store) {
      continue;
    }
    for (let i = 0; i < store.length; i += 1) {
      const extracted = extractJwt(store.getItem(store.key(i) ?? ""));
      if (extracted) {
        return extracted;
      }
    }
  }
  const cookieMatch = cookie.match(/(?:^|; )(?:(?:token|access_token|jwt)=)([^;]+)/i);
  if (cookieMatch && cookieMatch[1]) {
    const extracted = extractJwt(decodeURIComponent(cookieMatch[1]));
    if (extracted) {
      return extracted;
    }
  }
  return null;
}

// Plaud web app entry point the panel opens for the operator to log in.
export const PLAUD_WEB_APP_URL = "https://app.plaud.ai/";

/**
 * Build the bookmarklet (`javascript:` URL) the operator drags to their
 * bookmarks bar. It runs on app.plaud.ai, extracts the bearer with the same
 * algorithm as `extractPlaudToken`, and navigates to `<mirrorOrigin>/connect`
 * with the token in the URL fragment (fragment never reaches any server). It
 * carries NO captureId — that lives in the mirror's own localStorage and is
 * added by the /connect page, so Plaud's origin never sees it.
 */
export function buildBookmarklet(mirrorOrigin: string): string {
  // Single-quote the origin so the body contains no double quotes (keeps the
  // href attribute clean) and — critically — DO NOT percent-encode the body.
  // A bookmarklet is executed as-is after `javascript:`; percent-encoding the
  // whole script makes the browser run encoded text → silent syntax error
  // ("nothing happens"). React sets the href as a property, so raw characters
  // in the value are fine for dragging to the bookmarks bar.
  const origin = "'" + mirrorOrigin.replace(/'/g, "%27") + "'";
  const body = `(function(){
var J=/eyJ[A-Za-z0-9_\\-=]{5,}\\.[A-Za-z0-9_\\-=]+\\.[A-Za-z0-9_\\-=]+/;
function xj(v){if(typeof v!=='string')return null;var c=v.replace(/^"|"$/g,'').trim();if(!c)return null;var b=c.match(/Bearer\\s+(.+)/i);if(b&&b[1]&&J.test(b[1].trim()))return b[1].trim();var m=c.match(J);return m?m[0]:null;}
function pj(v){if(v==null)return null;try{return JSON.parse(v);}catch(e){return v;}}
function sb(v){var j=xj(v);if(!j)return null;try{return(JSON.parse(atob(j.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub)||null;}catch(e){return null;}}
function ws(s,n){if(!s)return null;var ids=[],t=sb(pj(s.getItem('pld_tokenstr')));if(t)ids.push(t);for(var i=0;i<s.length;i++){var mm=/^pld_(.+):currentWorkspaceId$/.exec(s.key(i)||'');if(mm&&mm[1]&&ids.indexOf(mm[1])<0)ids.push(mm[1]);}for(var x=0;x<ids.length;x++){var u=ids[x],w=pj(s.getItem('pld_'+u+':currentWorkspaceId')),l=pj(s.getItem('pld_'+u+':workspaceList'));if(!w||!Array.isArray(l))continue;var f=l.find(function(it){return it&&it.workspaceId===w;});if(!f||!f.workspaceToken)continue;if(f.expiresAt&&Number(f.expiresAt)<=n)continue;var k=xj(f.workspaceToken);if(k)return k;}return null;}
function find(){var ss=[window.localStorage,window.sessionStorage],n=Date.now(),i,s,j;var pk=['pld_tokenstr','tokenstr','token','access_token','plaud_token','auth_token'];for(i=0;i<ss.length;i++){s=ss[i];if(!s)continue;for(j=0;j<pk.length;j++){var e=xj(s.getItem(pk[j]));if(e)return e;}}for(i=0;i<ss.length;i++){var w=ws(ss[i],n);if(w)return w;}for(i=0;i<ss.length;i++){s=ss[i];if(!s)continue;for(j=0;j<s.length;j++){var e2=xj(s.getItem(s.key(j)));if(e2)return e2;}}var cm=document.cookie.match(/(?:^|; )(?:(?:token|access_token|jwt)=)([^;]+)/i);if(cm&&cm[1]){var ce=xj(decodeURIComponent(cm[1]));if(ce)return ce;}return null;}
try{if(location.host.indexOf('plaud.ai')<0){alert('Abre primero app.plaud.ai (con tu sesion iniciada) y pulsa este marcador alli.');return;}var tk=find();if(!tk){alert('No encontre el token de Plaud. Confirma que has iniciado sesion en app.plaud.ai.');return;}location.href=${origin}+'/connect#token='+encodeURIComponent(tk);}catch(e){alert('Error capturando el token: '+(e&&e.message?e.message:e));}
})();`;
  return "javascript:" + body.replace(/\n/g, "");
}
