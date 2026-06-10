import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginGate } from "./App.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("<LoginGate>", () => {
  it("posts the passphrase to /api/session/login and reports success", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("/api/session/login");
      return jsonResponse({ authRequired: true, authenticated: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onAuthenticated = vi.fn();

    render(<LoginGate onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByPlaceholderText("Operator passphrase"), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ passphrase: "correct-horse" });
  });

  it("shows the server error on a wrong passphrase and does not authenticate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "Invalid passphrase" }, 401)),
    );
    const onAuthenticated = vi.fn();

    render(<LoginGate onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByPlaceholderText("Operator passphrase"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText("Invalid passphrase")).toBeInTheDocument());
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it("refuses to submit an empty passphrase without hitting the network", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginGate onAuthenticated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Enter the operator passphrase.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
