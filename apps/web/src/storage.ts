// Web-runtime localStorage helpers. Kept in their own module so they can be
// exercised by Vitest+jsdom (D-015) without dragging the whole App component
// into the test surface. Each helper reads a single key, validates the
// stored value against the expected shape, and returns the same default
// every call site uses on first load. Both wrap the read in a try/catch so
// the panel still works in environments where localStorage is unavailable
// (private browsing, sandboxed iframes).

export type ActiveTab = "main" | "library" | "backfill" | "config" | "ops";
export type OperatorLanguage = "es" | "en";

const ACTIVE_TAB_KEY = "plaud-mirror:active-tab";
const BACKFILL_EXPANDED_KEY = "plaud-mirror:backfill-expanded";
const LANGUAGE_KEY = "plaud-mirror:language";

/**
 * Read the persisted active-tab value from `localStorage`.
 *
 * - Default is `"main"`.
 * - Only one of the known rail tabs is accepted; any other value (missing,
 *   corrupt, legacy) falls back to `"main"` so the operator lands on the
 *   day-to-day surface by default.
 */
export function readTab(): ActiveTab {
  try {
    const saved = window.localStorage?.getItem(ACTIVE_TAB_KEY);
    return saved === "main" ||
      saved === "library" ||
      saved === "backfill" ||
      saved === "config" ||
      saved === "ops"
      ? saved
      : "main";
  } catch {
    return "main";
  }
}

/**
 * Read the persisted operator UI language.
 *
 * - Default is Spanish because this is a single-operator local panel and the
 *   operator runs it in Spanish today.
 * - Only `"es"` and `"en"` are accepted; anything else falls back to `"es"`.
 */
export function readLanguage(): OperatorLanguage {
  try {
    const saved = window.localStorage?.getItem(LANGUAGE_KEY);
    return saved === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

/**
 * Read the persisted Historical-backfill expanded/collapsed state.
 *
 * - Default is `false` (collapsed). Default matters: expanding the card
 *   triggers a `/api/backfill/candidates` request to Plaud, so a fresh page
 *   load must NOT auto-expand.
 * - Only the literal string `"true"` opts into expanded; everything else
 *   (including missing or corrupt values) falls back to `false`.
 */
export function readBackfillExpanded(): boolean {
  try {
    const saved = window.localStorage?.getItem(BACKFILL_EXPANDED_KEY);
    return saved === "true";
  } catch {
    return false;
  }
}

/**
 * Storage key constants exported so tests can reference them by name rather
 * than duplicate the literal string and risk drift.
 */
export const STORAGE_KEYS = {
  ACTIVE_TAB: ACTIVE_TAB_KEY,
  BACKFILL_EXPANDED: BACKFILL_EXPANDED_KEY,
  LANGUAGE: LANGUAGE_KEY,
} as const;
