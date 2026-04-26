import { createHmac } from "node:crypto";

/**
 * Build the `X-Plaud-Mirror-Signature-256` header value for a webhook
 * payload. Lives in its own module (instead of being a private helper of
 * `service.ts`) so the durable outbox worker can reuse exactly the same
 * scheme — the worker MUST recompute the signature at delivery time, not
 * cache the one computed at enqueue time, because the operator is allowed
 * to rotate `webhookSecret` between enqueue and the actual POST.
 */
export function buildWebhookSignature(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}
