import { afterEach, describe, expect, it } from "vitest";

import { readBackfillExpanded, readLanguage, readTab, STORAGE_KEYS } from "./storage.js";

// Vitest under jsdom gives us a real `window.localStorage`. Each test
// clears it on exit so cross-test bleed is impossible — the helpers'
// purpose is "what does the operator's last choice say, given THIS
// localStorage state", and isolation keeps that contract honest.
afterEach(() => {
  window.localStorage.clear();
});

describe("readTab", () => {
  it("defaults to 'main' when nothing is stored", () => {
    expect(readTab()).toBe("main");
  });

  it("returns the persisted rail tab when it is known", () => {
    for (const tab of ["main", "library", "backfill", "config", "ops"] as const) {
      window.localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
      expect(readTab()).toBe(tab);
    }
  });

  it("falls back to 'main' on any unrecognised value", () => {
    // legacy value, typo, future-feature value — all collapse to default.
    for (const corrupt of ["", "Config", "settings", "MAIN", "1", "true", "recordings"]) {
      window.localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, corrupt);
      expect(readTab()).toBe("main");
    }
  });
});

describe("readLanguage", () => {
  it("defaults to Spanish when nothing is stored", () => {
    expect(readLanguage()).toBe("es");
  });

  it("returns English only when the stored value is exactly 'en'", () => {
    window.localStorage.setItem(STORAGE_KEYS.LANGUAGE, "en");
    expect(readLanguage()).toBe("en");
  });

  it("falls back to Spanish on unsupported locale values", () => {
    for (const corrupt of ["", "ES", "english", "fr", "1"]) {
      window.localStorage.setItem(STORAGE_KEYS.LANGUAGE, corrupt);
      expect(readLanguage()).toBe("es");
    }
  });
});

describe("readBackfillExpanded", () => {
  it("defaults to false (collapsed) when nothing is stored", () => {
    expect(readBackfillExpanded()).toBe(false);
  });

  it("returns true only when the stored value is exactly 'true'", () => {
    window.localStorage.setItem(STORAGE_KEYS.BACKFILL_EXPANDED, "true");
    expect(readBackfillExpanded()).toBe(true);
  });

  it("treats 'false' / '1' / '0' / empty / garbage all as false", () => {
    for (const corrupt of ["false", "1", "0", "", "TRUE", "yes"]) {
      window.localStorage.setItem(STORAGE_KEYS.BACKFILL_EXPANDED, corrupt);
      expect(readBackfillExpanded()).toBe(false);
    }
  });
});

describe("STORAGE_KEYS", () => {
  it("exposes the literal key names so test setup can target them by reference", () => {
    // The whole point of exporting the constants is that tests and
    // production code never duplicate the literal string. If someone
    // renames the key in storage.ts and forgets to grep for the literal,
    // this assertion fails loudly.
    expect(STORAGE_KEYS.ACTIVE_TAB).toBe("plaud-mirror:active-tab");
    expect(STORAGE_KEYS.BACKFILL_EXPANDED).toBe("plaud-mirror:backfill-expanded");
    expect(STORAGE_KEYS.LANGUAGE).toBe("plaud-mirror:language");
  });
});
