# Decision Log (Stable Rationale)

This file captures durable "why" decisions for Plaud Mirror.

---

## D-001 - Plaud Mirror is audio-first

**Status:** accepted

### Decision
Plaud Mirror's core responsibility is downloading and storing the audio artifact, not providing transcription.

### Rationale
The user's downstream pipeline already owns speech-to-text. Expanding Plaud Mirror into transcript or summary generation would dilute the core problem: reliable mirroring and session durability.

### Implications

- Audio sync is the critical path for v1.
- Transcript and summary support are optional future extensions, not required for the first release.

---

## D-002 - Server-first architecture with web UI

**Status:** accepted

### Decision
Plaud Mirror is a server-side service with a local operational web UI, not a browser extension and not a one-shot CLI.

### Rationale
The primary use case is an always-on home server or similar self-hosted environment. The operator needs persistence, scheduling, visibility, and configuration more than interactive bulk export.

### Implications

- `apps/api/` and `apps/web/` are first-class planned modules.
- Docker deployment and on-disk durability matter from the start.

---

## D-003 - Phased auth strategy: manual token first, automatic re-login later

**Status:** accepted (amended 2026-04-22)

### Decision
Plaud Mirror's auth strategy is phased, not simultaneous:

1. **First usable release:** manual bearer-token mode only. Operator pastes a Plaud token in the UI; the service encrypts and persists it, monitors validity, and surfaces a clear degraded state when the token expires.
2. **Later (Phase 4):** introduce automatic re-login via a `SessionProvider` abstraction with `manual-token` and `credentials-relogin` as the intended modes. Implement the least brittle renewal path first; ship the feature only when it is genuinely reliable.
3. **Explicitly disfavored:** browser-assisted renewal (Puppeteer/Playwright). It is not part of the planned path and would require fresh user approval to revisit.

### Rationale
Automatic re-login is the single most fragile component of a third-party Plaud client: auth endpoints and token formats can change without notice, and debugging a broken renewal flow blocks every other feature. Shipping a useful mirror with manual-token-only auth is strictly better than not shipping because the renewal story isn't solid yet. The original version of this decision treated dual-mode as a v1 requirement; experience from the brainstorm and upstream review showed that framing was too ambitious and would stall the first release.

Browser automation is disfavored because it (a) adds a Chromium/Playwright dependency to a service that holds Plaud credentials, (b) enlarges the attack surface, and (c) is painful to operate on NAS-class hardware with QNAP Docker quirks. Keeping it off the planned path prevents it from quietly becoming the default.

### Implications

- Phase 2 (first usable release) only needs to persist and validate a bearer token. No credential storage, no renewal loop.
- Secrets storage layout must still anticipate future credential fields so Phase 4 does not require a destructive migration.
- UI must surface the current auth mode, token expiry (when known), and a clear operator action when the token becomes invalid.
- On `401` in Phase 2, the service transitions to a "degraded auth" state and requires operator intervention; it does not attempt automatic recovery.
- In Phase 4, if `credentials-relogin` proves too brittle to ship reliably, the correct response is to stop and redesign, not to fall back to browser automation.

---

## D-004 - Upstream-watch is mandatory

**Status:** accepted

### Decision
Changes in relevant upstream repos must be tracked explicitly through `config/upstreams.tsv`, `docs/UPSTREAMS.md`, and `scripts/check-upstreams.sh`.

### Rationale
Plaud integrations depend on unofficial and evolving behavior. Auth keys, region logic, and export endpoints can drift. Silent drift is a product risk.

### Implications

- Primary upstreams are treated as ongoing inputs, not one-time research.
- Baseline changes are governance changes and must be documented.

---

## D-005 - License boundary is conservative

**Status:** accepted

### Decision
MIT is the intended Plaud Mirror license. MIT upstreams may be reused with attribution. AGPL and no-license upstreams remain reference-only unless a future documented decision changes this.

### Rationale
The project is meant to be publishable as permissive OSS without accidental license contamination or ambiguity.

### Implications

- `openplaud/openplaud` is an idea source, not a copy source.
- Reuse from no-license repos is blocked until license clarity exists.

---

## D-006 - Canonical local layout uses Plaud recording ID

**Status:** accepted

### Decision
Local mirrored artifacts should be keyed by the Plaud recording ID, not only by title or date.

### Rationale
Titles can change and are not guaranteed unique. The remote ID is the most stable dedupe key.

### Implications

- Default path shape is `recordings/<recording-id>/...`
- Human-readable metadata belongs in filenames only as optional secondary detail

---

## D-007 - Reuse strategy is composite, not a single-upstream fork

**Status:** accepted

### Decision
Plaud Mirror will combine ideas from multiple upstreams instead of treating one existing project as the canonical base.

### Rationale
No single upstream matches the target product cleanly. `Applaud` is strongest on server shape and operator UX. `iiAtlas` is strongest on fast-moving auth and region heuristics. The Studer projects are strongest as direct endpoint/export references. A composite strategy gives better fit and lowers lock-in.

### Implications

- `Applaud` and `iiAtlas` remain the two highest-priority upstreams to watch.
- Plaud Mirror can evolve its own identity without inheriting another project's full product surface or constraints.

---

## D-008 - Core auth and download logic must stay auditable in-repo

**Status:** accepted

### Decision
Plaud Mirror should not hide its critical Plaud auth and audio download flow behind an opaque third-party runtime dependency.

### Rationale
Source review of third-party tools is useful but not equivalent to a full trust guarantee. Upstream inspection also surfaced at least one concrete credential-handling flaw in the ecosystem: `JamesStuder/Plaud_BulkDownloader` echoes the password to the console. That finding reinforces the value of keeping the critical path readable and reviewable inside Plaud Mirror itself.

### Implications

- Upstream code can be referenced, adapted, or vendored with review, but the auth/download path should remain understandable from this repository alone.
- Token-first auth remains the preferred operator mode where practical because it reduces password exposure.

---

## D-009 - Operator-only TOS posture

**Status:** accepted

### Decision
Plaud Mirror is published as open source for **personal/operator use against the operator's own Plaud account only**. It is not a hosted service, not a multi-tenant gateway, and does not redistribute Plaud-sourced audio to third parties. This posture is stated in the README and in operator-facing docs before the first usable release.

### Rationale
A third-party client that automates authenticated access to Plaud and stores the resulting audio locally occupies grey space relative to Plaud's terms of service. The project does not have legal clearance, and pursuing it is not in scope. What is in scope is being explicit about the intended use so the repository does not drift into presenting itself as a general-purpose hosted-mirror product — which would materially increase TOS exposure for both the maintainer and downstream users.

This decision is a **posture statement**, not a legal opinion. It does not claim the project is TOS-compliant; it narrows the claimed use so the reader understands what the project is and is not.

### Implications

- README and `LLM_START_HERE.md` must state the operator-only posture before the first usable release (Phase 2 exit gate).
- Docs and UI copy must not describe Plaud Mirror as a "service for others" or a "hosted mirror."
- Multi-tenant features (per-user tokens, account separation beyond a single operator) are out of scope without a new decision revisiting this posture.
- Redistribution of Plaud-sourced audio by Plaud Mirror itself (e.g. a public gallery, a re-publishing webhook target) is out of scope.
- If Plaud publishes terms or a program that changes this picture, this decision should be revisited explicitly rather than drifted through.
