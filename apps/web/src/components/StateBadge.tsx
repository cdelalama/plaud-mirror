import type { BackfillCandidateState } from "@plaud-mirror/shared";

// Small leaf component rendering a coloured pill for the current local
// state of a backfill-preview row. Pulled out of App.tsx so component-level
// tests can render it in isolation (D-015 → D-026 partially-implemented).
//
// The label-mapping deliberately differs from the raw state key — "mirrored"
// renders as "already local" because operators read the column as
// "what does this mean for me?" not "what does the type system call it?".
export function StateBadge({ state }: { state: BackfillCandidateState }) {
  const label =
    state === "missing"
      ? "missing"
      : state === "mirrored"
        ? "already local"
        : "dismissed";
  return <span className={`state-badge state-${state}`}>{label}</span>;
}
