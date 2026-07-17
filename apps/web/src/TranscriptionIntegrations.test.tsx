import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranscriptionIntegrations } from "./TranscriptionIntegrations.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("<TranscriptionIntegrations>", () => {
  it("keeps the destination form provider-neutral", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ destinations: [] })));

    render(<TranscriptionIntegrations language="es" onUnauthorized={() => undefined} />);

    fireEvent.click(await screen.findByRole("button", { name: "Añadir destino" }));
    expect(screen.getByLabelText("Nombre")).toHaveValue("");
    expect(screen.getByPlaceholderText("Servicio de transcripción")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Media2Text")).not.toBeInTheDocument();
  });

  it("renders a provider-neutral destination and only offers valid retries", async () => {
    const destination = {
      id: "66666666-6666-4666-8666-666666666666",
      name: "Independent Transcriber",
      kind: "transcription-intake-v1",
      baseUrl: "https://transcriber.example",
      artifactBaseUrl: "https://mirror.example",
      enabled: true,
      primary: true,
      hasIntakeCredential: true,
      hasStatusSigningSecret: true,
      hasArtifactAccessToken: true,
      providerName: "Independent Transcriber",
      providerVersion: "2.0.0",
      lastTestedAt: "2026-07-16T10:00:00.000Z",
      lastTestError: null,
      createdAt: "2026-07-16T09:00:00.000Z",
      updatedAt: "2026-07-16T10:00:00.000Z",
    };
    const deliveries = [
      makeDelivery("failed-processing", "failed", false, "processing"),
      makeDelivery("conflict-admission", "conflict", true, "admission"),
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/transcription") {
        return jsonResponse({
          destinations: [{
            destination,
            coverage: {
              eligible: 10,
              notSent: 2,
              pending: 1,
              accepted: 1,
              processing: 1,
              transcribed: 3,
              failed: 1,
              conflict: 1,
            },
          }],
        });
      }
      if (path.includes("/deliveries?limit=50")) return jsonResponse({ items: deliveries });
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TranscriptionIntegrations language="es" onUnauthorized={() => undefined} />);

    expect(await screen.findByText("Independent Transcriber")).toBeInTheDocument();
    expect(screen.getByText("Transcription Intake v1")).toBeInTheDocument();
    expect(screen.getByText("3 / 10")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Reintentar")).toHaveLength(1));
    expect(screen.getByText("failed-processing")).toBeInTheDocument();
    expect(screen.getByText("conflict-admission")).toBeInTheDocument();
  });
});

function makeDelivery(
  recordingId: string,
  state: "failed" | "conflict",
  retryable: boolean,
  failureStage: "admission" | "processing",
) {
  return {
    id: `${recordingId}-delivery`,
    destinationId: "66666666-6666-4666-8666-666666666666",
    recordingId,
    recordingTitle: recordingId,
    artifactRevision: `sha256:${"a".repeat(64)}`,
    sha256: "a".repeat(64),
    bytes: 42,
    state,
    intakeId: state === "failed" ? "intake-failed" : null,
    transcriptId: null,
    transcriptRecordSha256: null,
    lastError: "synthetic failure",
    failureStage,
    retryable,
    createdAt: "2026-07-16T10:00:00.000Z",
    updatedAt: "2026-07-16T10:01:00.000Z",
    terminalAt: "2026-07-16T10:01:00.000Z",
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
