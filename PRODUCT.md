# Product

## Register

product

## Users

Plaud Mirror serves one authenticated homelab operator managing recordings from
their own Plaud account. The operator uses the panel from desktop and phone to
check mirror coverage, play local audio, run bounded sync or backfill work,
recover authentication, curate recordings, optionally deliver verified audio
to an independent transcription provider, and inspect failures without using
Plaud developer tools.

## Product Purpose

Move original Plaud audio into predictable local storage with low operator
friction and make every consequential state change auditable. Success means the
operator can distinguish Plaud inventory, local mirror coverage, dismissed
items, scheduler health, generic notification delivery, and optional
source-to-transcript state without the interface claiming more than the runtime
has observed. Plaud Mirror remains a complete product when no transcription
provider is configured.

## Brand Personality

Quiet, precise, and operational. The panel should feel like a dependable local
console: dense enough for repeated work, explicit about ownership and risk, and
calm when the system is healthy.

## Anti-references

- A marketing landing page, consumer-cloud upsell surface, or multi-tenant SaaS
  dashboard.
- Decorative gradients, glass effects, oversized metrics, or animation that
  competes with recording work.
- Ambiguous destructive actions, hidden side effects, or copy that conflates a
  local dismissal with mutation of the Plaud account.
- Desktop-only tables that force horizontal scrolling or hide row actions on a
  phone.

## Design Principles

1. State the ownership boundary. Local files, Plaud originals, scheduler state,
   webhook notification, transcription admission, transcript storage, and
   Cortex indexing are separate facts.
2. Keep routine work compact. The Library is a scanning and playback surface;
   controls should stay close to the recording they affect.
3. Make destructive scope explicit. Confirmation copy names what disappears
   and what remains before any irreversible request is sent.
4. Prefer evidence to reassurance. Render observed counts and states, preserve
   degraded truth, and never infer success from intent.
5. Preserve the same workflow on desktop and phone, with readable copy,
   reachable actions, and stable layout.

## Accessibility & Inclusion

Use semantic controls with keyboard focus, minimum 44 px touch targets on
mobile, labels that do not rely on color alone, and reduced-motion-safe state
feedback. Spanish and English operator copy must remain functionally
equivalent. Confirmation and error text must identify the affected recording
and the Plaud-versus-local consequence in plain language.
