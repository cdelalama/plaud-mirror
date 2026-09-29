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
