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

## D-003 - Dual auth strategy

**Status:** accepted

### Decision
Support two auth modes:
1. token-first mode using a pasted Plaud bearer token
2. optional credential mode for automatic re-login and token rotation

### Rationale
Token-first mode minimizes credential exposure. Credential mode minimizes operator toil and supports longer-lived server automation. Both are useful; neither alone satisfies all operators.

### Implications

- Secrets storage must handle both token metadata and credentials.
- UI must clearly show which auth mode is active and whether renewal is possible.
- On `401`, the service can retry only when credentials are available.

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
