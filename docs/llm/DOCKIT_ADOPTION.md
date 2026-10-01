# DocKit 4.18.0 adoption - 2026-09-30

Upstream: 4.18.0 at ae2bd1df20587974f4c7496032bbb6db176cbb34,
verified against fetched origin/main. Plaud source 0.16.6 is tooling/docs only.

Adopted the current bootstrap, workspace validator, session gate, optional Codex
hook installer and integration instructions. Reconciled current managed onboarding
sections and Claude SessionStart/Stop hooks. Existing PostToolUse/PreCompact hooks
retain identical behavior. The validator adds upstream work-records while retaining
all three local drift/orientation checks and the existing smoke-test corpus.
Delivery helpers already match upstream; the current contract is refreshed.
The upstream Trace version example is qualified as DocKit to avoid a local
cross-product prose-version false positive. Optional Codex hook installation is
not automatic; the supplied integration guide describes its host requirement.

The upstream full dry-run was inspected before editing. No force sync or private
sync-state rewrite ran. This is current applicable-feature adoption with deliberate
project variants (validator/tests/version targets/hooks), not byte parity with a
blank scaffold. Historical full-template state is not evidence of current parity.
Exact source review and validation are recorded in REVIEWS.md.

## Preserved earlier adoption receipts

# DocKit selective adoption - 2026-09-29

Upstream: 4.17.0 at d065a38602656ce8936e3ecfc6f0bedb7beafd27,
verified against remote main. Local source release: 0.16.5, tooling only.
This is selective current-feature alignment, not a claim of full-template
byte parity or a rewritten sync-state identity.

Adopted exact upstream bootstrap and Trace helper bytes plus the managed
trace-protocol section (one upstream version label is qualified as DocKit to
avoid Plaud's cross-product prose-version false positive). Dossier discovery remains inert. Added the project's
own registered declaration and runbook; no ForgeOS engine or DocKit project
identity is copied. Existing 4.16.3 delivery helpers, exact Opus 5.5 policy,
local validator extensions, tests, hooks and version handlers are preserved.

A selective dry-run against the primary checkout found bootstrap eligible and
the Trace section conflicted (both sides changed). No force apply ran. The
reviewed upstream Trace block was explicitly reconciled in an isolated linked
worktree; its named helper is supplied from the same source. The upstream sync
tool's linked-worktree limitation remains open and its private state is not
edited to pretend this was an automatic full sync. Future synchronization must
respect this receipt and current bytes, not overwrite local checks.

Validation and independent review are recorded in docs/llm/REVIEWS.md.
Dossier capture, export, availability and recovery evidence belong in
`docs/operations/DOSSIER.md`. No runtime deployment follows this tooling release.

## Historical 4.16.3 receipt

# DocKit adoption - 2026-09-23

Source: LLM-DocKit 4.16.3, patch candidate based on revision 361b393; final provenance is in the fleet report.

Adopted DocKit 4.16.3 delivery controls, visible skipped checks and exact Opus 5.5 high review policy. Existing deployment and acceptance gates remain unchanged.

This is a selective release rollout. Historical full-template identity is retained;
project hooks, versioning scripts, local validator regressions and excluded sections
are preserved. Copying delivery helpers does not integrate a mutation command.
Each project must bind its real probes and entrypoint and retain recovery evidence.

Delivered files:
- `scripts/dockit-validate-session.sh`
- `scripts/dockit-delivery-check.sh`
- `scripts/dockit-delivery-record.sh`
- `scripts/dockit-delivery-lib.sh`
- `scripts/dockit-delivery-state.awk`
- `scripts/test-delivery.sh`
- `docs/DELIVERY_CONTRACT.md`

Managed sections: independent-review-policy and delivery-evidence.

The validator retains a three-way merge of project-local checks.

Validation and independent review are recorded in the source fleet report:
`LLM-DocKit/docs/FLEET_ROLLOUT_2026-09-23.md`.

The upstream regression suite runs in the DocKit source repository, where its
control-plane fixtures exist. Existing adopter regression files are preserved.

## 2026-09-30 language-policy clarification

Explicitly adopted the DocKit 4.18.1 source/product language distinction.
Spanish operator-facing prose is independent of English technical sources.
This is a reviewed project-local policy edit, not a full-template sync or
claim that unrelated helper versions, host hooks or private sync state changed.


## 2026-10-01 - Selective operator-clarity policy

Adopted only the managed operator-clarity section from LLM-DocKit 4.18.2.
Existing hooks, template identity, source pins and project priorities remain.
This is reviewed manual section adoption in an existing checkout, not a full
template upgrade or a claim that historical publications were rewritten.
