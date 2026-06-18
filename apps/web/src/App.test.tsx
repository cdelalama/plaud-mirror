import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const authStatus = {
  mode: "manual-token",
  configured: true,
  state: "healthy",
  resolvedApiBase: "https://api-euc1.plaud.ai",
  lastValidatedAt: "2026-06-18T09:00:00.000Z",
  lastError: null,
  userSummary: null,
};

const completedRun = {
  id: "last-run",
  mode: "sync",
  status: "completed",
  startedAt: "2026-06-18T09:00:00.000Z",
  finishedAt: "2026-06-18T09:00:01.000Z",
  examined: 10,
  matched: 0,
  downloaded: 0,
  delivered: 0,
  enqueued: 0,
  skipped: 0,
  plaudTotal: 10,
  filters: {
    from: null,
    to: null,
    serialNumber: null,
    scene: null,
    limit: 0,
    forceDownload: false,
  },
  error: null,
};

const health = {
  version: "0.9.2",
  phase: "Phase 4 - operator UX",
  auth: authStatus,
  lastSync: completedRun,
  activeRun: null,
  scheduler: {
    enabled: false,
    intervalMs: 0,
    nextTickAt: null,
    lastTickAt: null,
    lastTickStatus: null,
    lastTickError: null,
  },
  outbox: {
    pending: 0,
    retryWaiting: 0,
    permanentlyFailed: 0,
    oldestPendingAgeMs: null,
  },
  lastErrors: [],
  recentSyncRuns: [completedRun],
  recordingsCount: 3,
  dismissedCount: 0,
  webhookConfigured: false,
  warnings: [],
};

const config = {
  dataDir: "/data",
  recordingsDir: "/recordings",
  webhookUrl: null,
  hasWebhookSecret: false,
  defaultSyncLimit: 100,
  schedulerIntervalMs: 0,
};

describe("<App>", () => {
  it("syncs every missing recording from Main instead of inheriting the Backfill limit", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/session") {
        return jsonResponse({ authRequired: false, authenticated: true });
      }
      if (path === "/api/health") {
        return jsonResponse(health);
      }
      if (path === "/api/config") {
        return jsonResponse(config);
      }
      if (path === "/api/auth/status") {
        return jsonResponse(authStatus);
      }
      if (path.startsWith("/api/recordings")) {
        return jsonResponse({ recordings: [], total: 3, skip: 0, limit: 50 });
      }
      if (path === "/api/devices") {
        return jsonResponse({ devices: [] });
      }
      if (path === "/api/outbox") {
        return jsonResponse({ items: [] });
      }
      if (path === "/api/sync/run" && init?.method === "POST") {
        return jsonResponse({ id: "new-run", status: "running" });
      }
      if (path === "/api/sync/runs/new-run") {
        return jsonResponse({
          ...completedRun,
          id: "new-run",
          matched: 7,
          downloaded: 7,
          filters: { ...completedRun.filters, limit: 7 },
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(7));

    const button = await screen.findByRole("button", { name: "Descargar 7" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sync/run",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const syncCall = fetchMock.mock.calls.find(([input, init]) => String(input) === "/api/sync/run" && init?.method === "POST");
    expect(syncCall).toBeTruthy();
    expect(JSON.parse(String(syncCall?.[1]?.body))).toEqual({
      limit: 7,
      forceDownload: false,
    });
  });
});
