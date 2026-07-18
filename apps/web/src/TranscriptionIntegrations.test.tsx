import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("renders reviewed failures honestly and only offers valid transport retries", async () => {
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
      makeDelivery("dependency-canary", "failed", false, "processing", 10, {
        category: "dependency",
        resolution: "resolved",
        providerInvoked: false,
        policyLimitMinutes: null,
        reviewedAt: "2026-07-18T10:00:00.000Z",
      }),
      makeDelivery("incompatible-canary", "failed", false, "processing", 11, {
        category: "incompatible_artifact",
        resolution: "resolved",
        providerInvoked: true,
        policyLimitMinutes: null,
        reviewedAt: "2026-07-18T10:01:00.000Z",
      }),
      makeDelivery("long-policy-recording", "failed", false, "processing", 12_690.6, {
        category: "policy",
        resolution: "active",
        providerInvoked: false,
        policyLimitMinutes: 180,
        reviewedAt: "2026-07-18T10:02:00.000Z",
      }),
      makeDelivery("conflict-admission", "conflict", true, "admission", 4, null),
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
              failed: 3,
              conflict: 1,
              requiresReview: 2,
              resolvedFailures: 2,
            },
          }],
        });
      }
      if (path.includes("/deliveries?limit=50")) return jsonResponse({ items: deliveries });
      if (path.endsWith("/conflict-admission-delivery/failure-review") && init?.method === "PATCH") {
        return jsonResponse({ item: deliveries[3] });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TranscriptionIntegrations language="es" onUnauthorized={() => undefined} />);

    expect(await screen.findByText("Independent Transcriber")).toBeInTheDocument();
    expect(screen.getByText("Transcription Intake v1")).toBeInTheDocument();
    expect(screen.getByText("3 / 10")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Reintentar")).toHaveLength(1));
    expect(screen.getAllByText("Incidencia histórica resuelta")).toHaveLength(2);
    expect(screen.getByText("Bloqueada por política")).toBeInTheDocument();
    expect(screen.getByText("long-policy-recording")).toBeInTheDocument();
    expect(screen.getByText(/211\.51 min/)).toBeInTheDocument();
    expect(screen.getByText(/180 min.*El proveedor no fue invocado/)).toBeInTheDocument();
    expect(screen.getByText("conflict-admission")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rotar acceso del transcriptor al audio" })).toBeInTheDocument();

    const review = screen.getByText("Clasificar incidencia").closest("details");
    expect(review).not.toBeNull();
    fireEvent.click(within(review!).getByText("Clasificar incidencia"));
    fireEvent.change(within(review!).getByLabelText("Tipo de incidencia"), { target: { value: "provider" } });
    fireEvent.click(within(review!).getByLabelText("El proveedor fue invocado"));
    fireEvent.click(within(review!).getByRole("button", { name: "Guardar revisión" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/transcription/deliveries/conflict-admission-delivery/failure-review",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          category: "provider",
          resolution: "active",
          providerInvoked: true,
          policyLimitMinutes: null,
        }),
      }),
    ));
  });
});

function makeDelivery(
  recordingId: string,
  state: "failed" | "conflict",
  retryable: boolean,
  failureStage: "admission" | "processing",
  durationSeconds: number,
  failureReview: {
    category: "dependency" | "incompatible_artifact" | "policy" | "provider";
    resolution: "active" | "resolved";
    providerInvoked: boolean;
    policyLimitMinutes: number | null;
    reviewedAt: string;
  } | null,
) {
  return {
    id: `${recordingId}-delivery`,
    destinationId: "66666666-6666-4666-8666-666666666666",
    recordingId,
    recordingTitle: recordingId,
    artifactRevision: `sha256:${"a".repeat(64)}`,
    sha256: "a".repeat(64),
    bytes: 42,
    durationSeconds,
    state,
    intakeId: state === "failed" ? "intake-failed" : null,
    transcriptId: null,
    transcriptRecordSha256: null,
    lastError: "synthetic failure",
    failureStage,
    failureReview,
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
