import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const TRANSCRIPTION_STATUS_MAX_CLOCK_SKEW_MS = 5 * 60_000;

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
  return `{${entries.join(",")}}`;
}

export function buildTranscriptionStatusSignature(
  payload: unknown,
  timestamp: string,
  secret: string,
): string {
  const body = `${timestamp}.${canonicalJson(payload)}`;
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

export function verifyTranscriptionStatusSignature(input: {
  payload: unknown;
  timestamp: string | undefined;
  signature: string | undefined;
  secret: string;
  now?: Date;
}): boolean {
  if (!input.timestamp || !input.signature) {
    return false;
  }
  const timestampMs = Date.parse(input.timestamp);
  const now = input.now ?? new Date();
  if (!Number.isFinite(timestampMs) || Math.abs(now.getTime() - timestampMs) > TRANSCRIPTION_STATUS_MAX_CLOCK_SKEW_MS) {
    return false;
  }
  const expected = buildTranscriptionStatusSignature(input.payload, input.timestamp, input.secret);
  return safeEqual(expected, input.signature);
}

export function verifyBearerToken(expected: string | null, authorization: string | undefined): boolean {
  if (!expected || !authorization?.startsWith("Bearer ")) {
    return false;
  }
  return safeEqual(expected, authorization.slice("Bearer ".length).trim());
}

function safeEqual(expected: string, actual: string): boolean {
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  const actualHash = createHash("sha256").update(actual, "utf8").digest();
  return timingSafeEqual(expectedHash, actualHash);
}
