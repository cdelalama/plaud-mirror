const DEFAULT_MIRROR_ORIGIN = "https://plaud.lamanoriega.com";
const MIRROR_ORIGIN_KEY = "plaudMirrorOrigin";
const PLAUD_HOST_PATTERN = /(^|\.)plaud\.ai$/i;

const originInput = document.querySelector("#mirror-origin");
const sendButton = document.querySelector("#send-token");
const status = document.querySelector("#status");

originInput.value = localStorage.getItem(MIRROR_ORIGIN_KEY) || DEFAULT_MIRROR_ORIGIN;

originInput.addEventListener("change", () => {
  const normalized = normalizeMirrorOrigin(originInput.value);
  originInput.value = normalized;
  localStorage.setItem(MIRROR_ORIGIN_KEY, normalized);
});

sendButton.addEventListener("click", () => {
  void sendTokenToMirror();
});

async function sendTokenToMirror() {
  setStatus("Reading Plaud session from the active tab...", "info");
  sendButton.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      throw new Error("No active browser tab found.");
    }

    const tabUrl = new URL(tab.url);
    if (!PLAUD_HOST_PATTERN.test(tabUrl.hostname)) {
      throw new Error("Open app.plaud.ai or web.plaud.ai first, then press this extension button.");
    }

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: capturePlaudToken,
    });

    if (!result?.token) {
      throw new Error(result?.error || "No Plaud token found. Sign in, wait for the library to load, then retry.");
    }

    const mirrorOrigin = normalizeMirrorOrigin(originInput.value);
    localStorage.setItem(MIRROR_ORIGIN_KEY, mirrorOrigin);
    setStatus("Token found. Returning to Plaud Mirror...", "success");
    await chrome.tabs.update(tab.id, {
      url: `${mirrorOrigin}/connect#token=${encodeURIComponent(result.token)}`,
    });
    window.close();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    sendButton.disabled = false;
  }
}

function normalizeMirrorOrigin(value) {
  try {
    const url = new URL(value || DEFAULT_MIRROR_ORIGIN);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return DEFAULT_MIRROR_ORIGIN;
    }
    return url.origin;
  } catch {
    return DEFAULT_MIRROR_ORIGIN;
  }
}

function setStatus(message, tone) {
  status.textContent = message;
  status.dataset.tone = tone;
}

function capturePlaudToken() {
  const jwtPattern = /eyJ[A-Za-z0-9_\-=]{5,}\.[A-Za-z0-9_\-=]+\.[A-Za-z0-9_\-=]+/;
  const priorityKeys = ["pld_tokenstr", "tokenstr", "token", "access_token", "plaud_token", "auth_token"];

  function extract(value) {
    if (typeof value !== "string") {
      return null;
    }
    let text = value.trim();
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === "string") {
        text = parsed.trim();
      }
    } catch {
      // Plaud sometimes stores plain strings and sometimes JSON strings.
    }
    const bearer = text.match(/Bearer\s+(.+)/i);
    if (bearer?.[1]) {
      const token = bearer[1].match(jwtPattern);
      if (token?.[0]) {
        return token[0];
      }
    }
    const token = text.match(jwtPattern);
    return token?.[0] ?? null;
  }

  function read(store, key) {
    try {
      return store?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  function scan(store) {
    if (!store) {
      return null;
    }
    for (const key of priorityKeys) {
      const token = extract(read(store, key));
      if (token) {
        return token;
      }
    }
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      const token = extract(key ? read(store, key) : null);
      if (token) {
        return token;
      }
    }
    return null;
  }

  const token = scan(window.localStorage) || scan(window.sessionStorage);
  if (!token) {
    return { token: null, error: "No Plaud token found in localStorage/sessionStorage." };
  }
  return { token };
}
