import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";
import { STORAGE_KEYS } from "./storage.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

const recording = {
  id: "recording-1",
  title: "Planning note",
  createdAt: "2026-06-18T09:00:00.000Z",
  durationSeconds: 93,
  serialNumber: "device-1",
  scene: null,
  localPath: "/recordings/recording-1/audio.m4a",
  contentType: "audio/mp4",
  bytesWritten: 123456,
  mirroredAt: "2026-06-18T09:01:00.000Z",
  lastWebhookStatus: "skipped",
  lastWebhookAttemptAt: null,
  dismissed: false,
  dismissedAt: null,
  sequenceNumber: 1,
};

describe("<App>", () => {
  it("keeps mobile navigation labeled and able to switch views", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
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
        return jsonResponse({ recordings: [], total: 0, skip: 0, limit: 50 });
      }
      if (path === "/api/devices") {
        return jsonResponse({ devices: [] });
      }
      if (path === "/api/outbox") {
        return jsonResponse({ items: [] });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const viewMenu = await screen.findByLabelText("Vista");
    expect((viewMenu as HTMLSelectElement).value).toBe("main");

    fireEvent.change(viewMenu, { target: { value: "library" } });

    await screen.findByRole("heading", { name: "Library" });
    expect(window.localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)).toBe("library");
  });

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

  it("discovers scheduler runs while idle and switches to fast polling", async () => {
    const intervals: Array<{ handler: TimerHandler; delay: number | undefined }> = [];
    let intervalId = 0;
    vi.spyOn(globalThis, "setInterval").mockImplementation(((handler: TimerHandler, delay?: number) => {
      intervals.push({ handler, delay });
      intervalId += 1;
      return intervalId;
    }) as typeof setInterval);

    const schedulerRun = {
      ...completedRun,
      id: "scheduler-run",
      status: "running",
      finishedAt: null,
      examined: 606,
      matched: 21,
      downloaded: 4,
      plaudTotal: 606,
    };
    let healthReads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/session") {
        return jsonResponse({ authRequired: false, authenticated: true });
      }
      if (path === "/api/health") {
        healthReads += 1;
        return jsonResponse(healthReads === 1 ? health : { ...health, activeRun: schedulerRun });
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
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await screen.findByLabelText("Vista");
    await waitFor(() => expect(intervals.some(({ delay }) => delay === 30_000)).toBe(true));
    const idleTick = intervals.find(({ delay }) => delay === 30_000)?.handler;
    expect(typeof idleTick).toBe("function");

    await act(async () => {
      await (idleTick as () => Promise<void>)();
    });

    await waitFor(() => expect(intervals.some(({ delay }) => delay === 2_000)).toBe(true));
    expect(healthReads).toBeGreaterThanOrEqual(3);
  });

  it("plays the compact Library row through the real audio element", async () => {
    const playMock = vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    window.localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, "library");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
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
        return jsonResponse({ recordings: [recording], total: 1, skip: 0, limit: 50 });
      }
      if (path === "/api/devices") {
        return jsonResponse({ devices: [] });
      }
      if (path === "/api/outbox") {
        return jsonResponse({ items: [] });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const playButton = await screen.findByTitle("Reproducir");
    fireEvent.click(playButton);

    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(1));
    const row = screen.getByText("Planning note").closest("article");
    expect(row?.className).toContain("recording-line-compact");
    const audio = row?.querySelector("audio");
    expect(audio?.className).not.toContain("hidden-audio");
  });

  it("marks full Library rows so the native player can use the wide layout", async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    window.localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, "library");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
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
        return jsonResponse({ recordings: [recording], total: 1, skip: 0, limit: 50 });
      }
      if (path === "/api/devices") {
        return jsonResponse({ devices: [] });
      }
      if (path === "/api/outbox") {
        return jsonResponse({ items: [] });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await screen.findByText("Planning note");
    fireEvent.click(await screen.findByRole("button", { name: "completo" }));

    const row = screen.getByText("Planning note").closest("article");
    expect(row?.className).toContain("recording-line-full");
    const audio = row?.querySelector("audio");
    expect(audio?.className).not.toContain("hidden-audio");
  });
});
