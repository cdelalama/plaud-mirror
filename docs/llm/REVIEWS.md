# Review Notes

This file archives formal reviews with enough analytical detail to reconstruct *why* each decision was made, not only *what* was decided. Short outcome bullets live in `HANDOFF.md`; stable rationale lives in `DECISIONS.md`; this file preserves the reasoning that connects the two.

## Review Entry Convention

When a review generates non-trivial pushback or a merge pass, the entry should use the structure below. Simple sign-offs (no debate) can stay as a one-paragraph note.

```
## <YYYY-MM-DD> — <Review Name>

**Input:** <what was reviewed>
**Reviewers:** <LLM / human, in order of pass>

### Points of Agreement
- <bullet>

### Points Raised (Pushback / Additions)
1. **<short title>** — <one-line summary of the point>
   - Resolution: Adopted / Amended / Rejected
   - Rationale: <why that resolution, citing user decisions, constraints, or evidence>

### Summary Outcome
- <final merged conclusions>

### Follow-Through Landed
- <concrete actions taken in the same session>
- <actions deferred, with pointer to where they are tracked>
```

The goal is *referenceable analysis*, not full transcripts. If a point is decided without debate, one line is enough. If a point generates disagreement, capture both sides and the resolution so the reasoning survives future sessions and LLM changes.

---

## 2026-04-22 — Roadmap Review

**Input:** Codex GPT-5's post-brainstorm implementation roadmap for the first usable Plaud Mirror release (appended to `HANDOFF.md`).
**Reviewers:** Claude Opus 4.7 (second-opinion pass) → Codex GPT-5 (merge pass).

### Points of Agreement

- **TypeScript monorepo stack** (Fastify API + React/Vite panel + SQLite + Zod). Matches the already-scaffolded `apps/api/`, `apps/web/`, `packages/shared/` layout; Zod-first shared schemas give a single source of truth for API, webhook, and config contracts.
- **Plaud spike before scaffolding.** Original architecture assumes the Plaud flow documented by `iiAtlas/plaud-recording-downloader` still holds; that assumption must be re-validated before committing to a data model or filter set.
- **Manual-token-first, defer auto-relogin.** Shipping a useful mirror without renewal is strictly better than not shipping because renewal isn't solid.
- **dev-vm first, NAS later.** Matches the existing home-infra deployment pattern (`docker save | ssh 10.0.0.220 'docker load'`).
- **Same-process jobs, no Redis.** Right-sized for a personal mirror.
- **Unified webhook contract for backfill + sync.** One contract simplifies downstream integration (e.g. `youtube2text-api`); a "mirror-only backfill" remains worth preserving as a config flag.

### Points Raised (Pushback / Additions)

1. **Browser-assisted renewal should not be on the roadmap as a fallback.**
   - Pushback: Chromium/Playwright adds attack surface inside a service holding Plaud credentials; painful on NAS + QNAP Docker quirks; if direct renewal fails, better to stop and redesign than paper over with browser automation.
   - Resolution: **Amended.** Kept on the roadmap but reclassified as de-prioritized research; not a planned path; requires fresh user approval to revisit. The user had previously accepted it as a non-ideal optional path, so removing it entirely would have over-corrected.
   - Rationale: preserve user's earlier acceptance while ensuring it does not silently become the default.

2. **Doppler integration is missing from the plan.**
   - Pushback: infra convention (`~/src/home-infra/docs/CONVENTIONS.md`) is Doppler for every secret; the scaffold should run under `doppler run --project plaud-mirror --config dev -- ...` from day 1.
   - Resolution: **Amended.** Doppler is adopted as the *infrastructure convention* for this owner's environments, but the *application contract* stays plain environment variables so the project remains portable for OSS users. Doppler injects the env vars; the app never imports a Doppler SDK.
   - Rationale: avoids coupling a portable OSS product to a specific secrets manager while still matching the home-infra convention locally. This amendment is an improvement over the original push, which conflated infra wiring with product dependency.

3. **home-infra docs update is missing from the plan.**
   - Pushback: per global CLAUDE.md, any new service or project must be reflected in `~/src/home-infra/docs/`. Missing here: register `plaud-mirror` in `PROJECTS.md` now; update `SERVICES.md` and `INVENTORY.md` on deployment.
   - Resolution: **Adopted** (as an operational reminder tied to implementation/deployment slices, not to the product core). Landed in this session.

4. **Webhook HMAC signing should be Phase 2, not deferred.**
   - Pushback: cheap to implement (one shared secret + SHA-256); expensive to retrofit once downstream consumers exist.
   - Resolution: **Adopted.** HMAC signing is now a Phase 2 requirement for the first usable release.

5. **Phase 1 spike needs a storage/measurement task.**
   - Pushback: measuring audio artifact size, format, and rough arrival rate drives retention/pruning decisions and validates whether local filesystem storage is adequate before commitment.
   - Resolution: **Adopted.** Added to Phase 1 exit criteria.

6. **Plaud TOS exposure is not addressed.**
   - Pushback: a third-party client that automates authenticated access to Plaud and stores the audio locally occupies grey space relative to Plaud's TOS; the repo should state its operator-only posture before presenting itself as OSS to avoid drifting into looking like a hosted-mirror product.
   - Resolution: **Adopted.** Opened and accepted as D-009 ("Operator-only TOS posture"). Posture statement, not a legal opinion; narrows the claimed use.

7. **Backfill scope in Phase 2 — worth questioning.**
   - Pushback: Phase 2 becomes materially smaller and ships faster if backfill slides to Phase 3; open question whether day-1 backfill is a genuine requirement.
   - Resolution: **Rejected.** The user had already confirmed day-1 historical backfill in the `Confirmed Product Direction` section of the handoff; this reopened a closed decision. Claude's mistake: should have checked confirmed-direction before raising as open. Backfill stays in Phase 2.

8. **Scheduler polling default is unspecified.**
   - Pushback: Phase 3 says "configurable scheduler" but picks no default; Plaud recordings arrive at most a few times/day, so 15–30 min is plenty and faster invites rate-limit or TOS issues.
   - Resolution: **Adopted.** Phase 3 now targets 15-minute default.

### Summary Outcome

- Keep the GPT-5 vertical-slice roadmap as the base.
- Adopt the useful additions: Phase 2 webhook HMAC, Phase 1 storage measurement, D-009 TOS posture, 15-minute scheduler default, home-infra follow-through.
- Do not move historical backfill out of the first usable release.
- Treat Doppler as an infrastructure convention, not a product dependency.
- Keep browser-assisted renewal off the planned path; only revisit it with fresh user approval.

### Follow-Through Landed

- D-003 amended in `docs/llm/DECISIONS.md` (phased auth strategy).
- D-009 added in `docs/llm/DECISIONS.md` (operator-only TOS posture).
- `plaud-mirror` registered in `~/src/home-infra/docs/PROJECTS.md`.
- HANDOFF rewritten as operational snapshot; debate archived in this file.
- D-009 posture copy in `README.md` and `LLM_START_HERE.md` deferred to the Phase 2 implementation window to avoid churn before scaffolding.

---

## Planned Reviews

- Security review before implementing credential storage (recommend invoking `/security-review`).
- Contract review before freezing the first HTTP API and webhook payload.
- Deployment review before publishing the first Docker image.
