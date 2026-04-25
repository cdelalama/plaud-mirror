import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StateBadge } from "./StateBadge.js";

afterEach(() => {
  cleanup();
});

describe("<StateBadge>", () => {
  it("renders 'missing' as the literal label and the green state class", () => {
    render(<StateBadge state="missing" />);
    const el = screen.getByText("missing");
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass("state-badge");
    expect(el).toHaveClass("state-missing");
  });

  it("renders 'mirrored' as the operator-friendly 'already local'", () => {
    // Deliberately different from the raw state key. Operators read the
    // column as "what does this mean for me" — the assertion here exists
    // so a future change to "mirrored" surfaces in the UI as a label
    // change shows up loudly.
    render(<StateBadge state="mirrored" />);
    const el = screen.getByText("already local");
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass("state-mirrored");
    // Negative assertion: the raw key must NOT leak into rendered text.
    expect(screen.queryByText("mirrored")).not.toBeInTheDocument();
  });

  it("renders 'dismissed' as 'dismissed' and uses the amber state class", () => {
    render(<StateBadge state="dismissed" />);
    const el = screen.getByText("dismissed");
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass("state-dismissed");
  });
});
