import { afterEach, describe, expect, it } from "vitest";

import { readBackfillExpanded, readTab, STORAGE_KEYS } from "./storage.js";

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

  it("returns 'config' only when the stored value is exactly 'config'", () => {
    window.localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, "config");
    expect(readTab()).toBe("config");
  });

  it("returns 'main' when the stored value is the literal 'main'", () => {
    window.localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, "main");
    expect(readTab()).toBe("main");
  });

  it("falls back to 'main' on any unrecognised value", () => {
    // legacy value, typo, future-feature value — all collapse to default.
    for (const corrupt of ["", "Config", "settings", "MAIN", "1", "true"]) {
      window.localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, corrupt);
      expect(readTab()).toBe("main");
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
  });
});
