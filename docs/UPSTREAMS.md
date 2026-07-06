<!-- doc-version: 0.10.6 -->
# Upstream Strategy

Last verified against GitHub: 2026-04-22

Plaud Mirror is its own project, but it is intentionally informed by existing work in the Plaud ecosystem. This document records:
- which upstreams matter
- what Plaud Mirror keeps from each one
- what Plaud Mirror explicitly does not inherit
- how changes in those upstreams are detected and reviewed

## Reuse Principles

- Prefer MIT-licensed upstream code when direct reuse makes sense and attribution is preserved.
- Treat AGPL or no-license repositories as reference-only unless a licensing decision is explicitly documented.
- Prioritize changes related to auth, token renewal, regional API behavior, recording discovery, temp-URL download flow, and operator UX.
- Never adopt upstream behavior blindly. Every adoption must preserve Plaud Mirror's audio-first and always-logged-in goals.

## Selection Summary

Plaud Mirror is intentionally based on a composite reading of the ecosystem, not on a blind fork of a single upstream.

- `rsteckler/applaud` is the closest fit for product shape because it already thinks like a server: periodic sync, local storage, UI, and operator workflows.
- `iiAtlas/plaud-recording-downloader` is the best reference for fast-moving auth and region behavior because it reacts quickly to changes in the Plaud web frontend.
- `JamesStuder/Plaud_API` and `JamesStuder/Plaud_BulkDownloader` are useful research references for endpoint sequencing and export/download flow, but Plaud Mirror does not want its core auth path to depend on an opaque third-party client.
- `openplaud/openplaud` is useful for product and UX ideas, but its AGPL license and broader product scope make it the wrong direct base for Plaud Mirror.

The result is deliberate:
- service shape and operator UX are inspired mainly by `Applaud`
- auth and token resilience are informed heavily by `iiAtlas`
- endpoint and export behavior are checked against the Studer projects
- licensing and product-scope discipline keep Plaud Mirror independent

Phase 1 adoption now landed in-repo:
- browser-aligned request headers and pseudo device/request IDs are informed by `JamesStuder/Plaud_API`; `v0.8.1` updates that alignment to Plaud Web's current browser context (`https://web.plaud.ai`, browser-like UA, `sec-fetch-*`) after the old `app.plaud.ai` + custom-user-agent fingerprint started returning HTML 403 for a valid browser-captured token
- regional API retry on `status = -302` / region mismatch payloads is informed by `iiAtlas/plaud-recording-downloader`
- the `/user/me`, `/file/simple/web`, `/file/detail/<id>`, and `/file/temp-url/<id>` sequence was cross-checked against `Applaud` and the Studer client before implementation

Phase 2 adoption now landed in-repo:
- the product panel and server-first operator flow continue to follow the `Applaud` shape rather than making the browser extension the product
- manual-token persistence with explicit degraded-auth handling keeps Plaud Mirror aligned with its own phased-auth decision instead of inheriting a browser-session-only model
- Docker-first packaging now exists, but scheduler/outbox behavior is still intentionally deferred to the next phase rather than copied prematurely from upstreams
- the `/device/list` endpoint (wire shape: `{ status, data_devices: [{ sn, name, model, version_number }] }`) was discovered only in `openplaud/openplaud` (AGPL-3.0); the endpoint existence and field names are unprotectable facts about Plaud's server, so Plaud Mirror reuses the API shape but reimplements the client, store, and UI from scratch in this MIT codebase. No openplaud code is copied. See D-011.

Phase 4 adoption now landed in-repo (v0.7.0, v0.8.0, D-019):
- the browser-side bearer-extraction logic (priority-keys → workspace-token → full-scan → cookie cascade, reading `localStorage.pld_tokenstr` and the `pld_<userId>:workspaceList` workspace tokens) is **adapted from the MIT-licensed `iiAtlas/plaud-recording-downloader`** (`extension/lib/auth-probe.js`, Copyright (c) 2025 Atlas Wegman). Reused **with attribution** per D-005 (MIT, attribution preserved) and D-007 (iiAtlas is the token-storage-keys reference). It is reimplemented in TypeScript (`apps/web/src/plaud-token.ts`), not copied verbatim, **with one deliberate divergence (v0.7.3):** iiAtlas prioritizes the per-workspace token (it targets file ops); Plaud Mirror prioritizes the global user token (`pld_tokenstr`) because it validates against `/user/me`, which rejects the workspace token with 403. **v0.7.6 added a second deliberate divergence in the fallback bookmarklet:** the bookmarklet itself is shorter and visible (known `pld_tokenstr` key first, full storage scan fallback, alert on every outcome) instead of carrying the full workspace-token heuristic silently. **v0.8.0 adds a small local Chrome companion extension** because React/Chrome made a draggable `javascript:` link unreliable. This does not overturn the server-first product decision: the extension only captures the browser bearer and hands it to the server's `/connect` handshake; the API, storage, sync, and UI remain in Plaud Mirror.
- the email+password login endpoint (`POST /auth/access-token`, body `username`/`password`, returns `access_token`+`refresh_token`, ~300-day TTL, 10 logins/hour) was confirmed from the MIT-stack toolkits and a no-credential reachability probe; it is documented in D-019 as the path for email+password accounts but is **not used** here because the operator's account is Google SSO. Endpoint facts only; no client code copied.
- Plaud's official CLI/MCP (`@plaud-ai/mcp`, OAuth) is recorded as **deferred/watch** in D-019, not adopted and not disproven.

## Primary Inspiration

| Upstream | License | Baseline | What Plaud Mirror Keeps | What Plaud Mirror Rejects | Watch Focus |
|----------|---------|----------|-------------------------|---------------------------|-------------|
| `rsteckler/applaud` | MIT | `v0.5.10`, `3b005bf8e80e0c9ca696e49f8a1d2f04a03f5b0b` | Server-first shape, poller split, local storage mindset, operational web UI, webhook delivery | Lock-in to its exact storage layout or browser-session-only assumptions | Auth/session reuse, scheduler design, download flow, API and UI evolution |
| `iiAtlas/plaud-recording-downloader` | MIT | `v1.4.1`, `bdee168d721eaea666172825dadec72778bcd66f` | Token/session extraction heuristics, regional handling ideas, fast reaction to Plaud frontend changes | Browser-only product scope; Plaud Mirror's extension is only a local companion for token capture | Token storage keys, auth changes, regional endpoint drift |

## Reference Upstreams

| Upstream | License | Baseline | What Plaud Mirror Keeps | What Plaud Mirror Rejects | Watch Focus |
|----------|---------|----------|-------------------------|---------------------------|-------------|
| `JamesStuder/Plaud_API` | MIT | `2026.03.20.01`, `3563b9ba779c6e5ba38e7f04de360075d9b619bd` | Endpoint map, export flow sequencing, reverse-engineered API reference | Hard dependency on one unofficial client library | Auth endpoint changes, export actions, download temp-URL flow |
| `JamesStuder/Plaud_BulkDownloader` | MIT | `6d6cc1addb84a761a438b8d934ecbc83b7a53a0c` | Bulk orchestration concepts and audio export ordering | Password echoing, CLI-only UX, transcript-heavy scope | Audio export edge cases and naming conventions |
| `leonardsellem/plaud-sync-for-obsidian` | MIT | `1.0.0`, `7c1f06cc982f0174498694aa13bc8a0fb0a9fe1b` | Metadata mapping and session-handling ideas for a sync product | Obsidian-specific product assumptions | Session extraction and recording metadata handling |

## Watch-Only Upstreams

| Upstream | License | Baseline | Why It Is Tracked | Reuse Boundary |
|----------|---------|----------|-------------------|----------------|
| `openplaud/openplaud` | AGPL-3.0 | `v0.1.0`, `cc1892b23f39ed0567129be239b0028c91aa658b` | Product ideas around UX, secret handling, and sync ergonomics | No code copy into MIT Plaud Mirror without an explicit license decision |
| `sergivalverde/plaud-toolkit` | No clear repo license | `dd5774b306f13cc2b11ce917d17575165b527bd4` | Auth/token-management ideas and a TypeScript ecosystem view | Reference only until license is clarified |
| `josephhyatt/plaud-exporter` | No clear repo license | `456b32a04afa9d6a8664c0137f5656a0513db975` | Minimal exporter ideas and alternate download approaches | Reference only until license is clarified |

## Security Notes From Upstream Research

- Running third-party Plaud tools means executing local code that can see your Plaud credentials or bearer token. The risk is not "remote execution elsewhere"; the risk is trusting a third-party implementation with local secrets.
- During source inspection, `JamesStuder/Plaud_BulkDownloader` was found to echo the password to the console. That does not prove credential theft, but it is a real handling flaw and a useful warning sign for Plaud Mirror's own standards.
- During source inspection, `JamesStuder/Plaud_API` did not show obvious hardcoded credential-exfiltration endpoints in the reviewed code. That still does not amount to a full supply-chain guarantee.
- Because of that gap between "reviewed source" and "fully trusted runtime artifact", Plaud Mirror keeps a conservative rule: the core auth and download path should stay auditable in-repo rather than hidden behind an opaque dependency.

## Official Plaud References

These are not code upstreams, but they matter for operator expectations and possible future official integrations.

- Plaud export help:
  <https://support.plaud.ai/hc/en-us/articles/51573949068697-How-to-export-my-data>
- Plaud developer docs:
  <https://plaud.mintlify.app/documentation/get_started/overview>

## Monitoring Strategy

- `config/upstreams.tsv` is the committed baseline.
- `scripts/check-upstreams.sh` compares the current GitHub state against that baseline.
- `.github/workflows/upstream-watch.yml` is the scheduled check entry point for GitHub-hosted automation.
- Changes in primary inspiration upstreams are reviewed first.

## Review Policy

When an upstream changes:
1. Identify whether the change touches auth, token renewal, region handling, listing, export, or download.
2. Decide `adopt`, `watch`, or `ignore`.
3. Record the rationale in `docs/llm/DECISIONS.md`.
4. Update `config/upstreams.tsv` only after the decision is documented.
