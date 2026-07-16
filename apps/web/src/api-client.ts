interface ApiErrorResponse {
  message?: string;
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init.body !== null;
  const callerHeaders = (init?.headers as Record<string, string> | undefined) ?? {};
  const headers: Record<string, string> = hasBody
    ? { "content-type": "application/json", ...callerHeaders }
    : { ...callerHeaders };
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({} as ApiErrorResponse));
    const message = payload.message || `Request failed with HTTP ${response.status}`;
    if (response.status === 401 && !path.startsWith("/api/session")) {
      throw new UnauthorizedError(message);
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
