# Consensus: a useful recording pipeline first

Date: 2026-09-29 UTC. Status: agreed recommendation, not a canonical-roadmap amendment or implementation authorization.

## Decision

Prioritize an immediately useful transcript library, then the automatic new-recording path, then Cortex retrieval. Keep existing project ownership and frozen content contracts. Remove complete bilateral provisioning, federation and embedding research from the first usable delivery's critical path.

Use Markdown as the first portable reading/search projection, with Obsidian as the recommended first local reader. Media2Text remains the canonical transcript/provenance authority. Cortex later consumes Media2Text records for policy-controlled, attributed retrieval; it does not ingest personal Obsidian edits as authoritative source evidence.

## How consensus was reached

Codex and exact `claude-opus-5-5` at high effort assessed the source independently. Claude had read-only Read/Glob/Grep access, no shell, network, writes, MCP or subagents. Both rounds report the exact requested canonical model.

Round 1 recommended a Media2Text-owned Markdown projection and later pull-first Cortex retrieval. Codex supplied fresh live evidence and challenged seven details. Round 2 explicitly returned AGREEMENT, accepted all seven corrections and stated no substantive disagreement remained. The amount of the ongoing budget, first reading device and exact transfer mechanism remain implementation inputs, not unresolved architectural disputes.

Primary source snapshots: Plaud main 1dcd23b (local 0.16.5); Media2Text main 7f97e83 (source 0.40.3); Cortex c62c6e3 (source 0.4.4, confirmed equal to remote main). Prior cross-project infrastructure evidence is in Plaud's 2026-09-29 reassessment. Concurrent Home Infra/Portal work was not modified or made a prerequisite.

## Current evidence and its limits

- Plaud's prior live inventory reports 770/770 mirrored, automatic 15-minute sync and an enabled Media2Text destination. Transcription coverage: 76 complete, 72 failed, 622 not sent. The unsent historical corpus is 608.0074 hours.
- A new NAS read-only probe at 15:22:44 UTC found 76 immutable Transcript Store v1 records, all from Plaud, each with provider JSON, TXT, Markdown and JSONL.
- All 76 Markdown files matched recorded size and SHA-256; all 76 authenticated library Markdown GETs returned the same bytes. This proves file/HTTP availability, not browser usability or transcription accuracy.
- 75 records, corresponding to 75 distinct source items, matched the admitted original-audio identity. One retained 0.39.2 record has the known derivative/source mismatch and must be excluded from the trusted candidate set without deleting evidence.
- None of the 76 stored intake requests retained original recording time. Record it as unknown unless a bounded, attributed lookup in Plaud recovers it. Never relabel processing time as recording time.
- The receiver's internal rolling-30-day ledger reports 2,717.2054 minutes and USD 24.998289 estimated/reserved out of USD 25, with no pending reservation. This is policy-accounting evidence, not a vendor invoice. A new recording currently has effectively no headroom.
- With no intervening work or policy change, the next observed reservation leaves the rolling window on 2026-09-30T09:55:03.640Z, releasing an estimated USD 0.445403. This is a conditional projection, not an admission promise.
- The current provider estimate is USD 0.552/hour. The backlog therefore needs a separately selected scope and fresh receiver estimate; no new spending is approved here.
- Cortex's development database is healthy. A READ ONLY transaction found zero sources, resources, representations, projection spaces, projections and projection items. Only its database container was observed running.
- Cortex has fixture ingest but no implemented live Transcript Ready receiver, Query Broker or MCP retrieval product. Its existing webhook rejects legacy `run:done` with 503, but can answer 200/ignored for the wrong event shape when its optional signature check permits it. Media2Text marks any successful HTTP response delivered. This is a conditional source-code hazard, not evidence that live events were lost. Keep the output URL unset until a real consumer and acknowledgement semantics exist.

## Proposed delivery sequence

| Stage | Concrete result | Owner | Acceptance |
| --- | --- | --- | --- |
| M0: existing text | Use the authenticated Media2Text library; curate a small Markdown export and then the eligible portion of the 75 candidates | Media2Text; operator selects device/folder | Open and search on one real workstation; count/hash manifest; exclusions applied; repeat export creates no duplicates or human-note overwrites; no new STT |
| M1: new recording | One short selected new recording flows through Plaud sync, existing STT, transcript storage and the user's reading folder | Plaud + Media2Text; Home Infra for placement | Budget/headroom resolved first; scoped backup/restore/rollback before runtime changes; automatic arrival; pause and honest budget-blocked state; then a few natural cycles |
| M2: reliable daily operation | Incremental export, bounded repair, useful failure categories and clear last-success/backlog reporting | Media2Text + Plaud | Crash/retry does not duplicate; generated data can be rebuilt; exclusion policy survives restore; new work stays separate from historical processing; five-day stability observation closes after final changes |
| M3: attributed retrieval | Cortex pulls frozen Media2Text records, exposes lexical retrieval through its policy/broker/MCP boundary, then adds semantic ranking when measured useful | Cortex; Home Infra owns production placement | Durable ingest/reconciliation, exact source lineage, authorized results and honest outages; operational owner off dev-vm; real questions succeed with citations |

Independent recovery of original audio starts as urgent parallel work and gates unattended expansion. A same-NAS copy is not independent recovery, and Plaud cloud retention is not a substitute for controlled custody. Viewing existing transcripts does not require completing a global backup program. Before an actual deployment, preserve coherent control/transcript state, verify a bounded restore and retain rollback.

## Changes to the previous roadmap recommendation

1. Move existing-content value and a readable/searchable destination before complete connection provisioning. The current connection already works; a new-operator setup wizard contributes less immediate value than making its outputs useful.
2. Put budget eligibility before the fresh end-to-end canary. The current ledger is almost exactly at its ceiling. Choose a sustainable budget from actual new-recording volume; never silently raise caps or switch providers.
3. Separate new daily recordings from the 622 historical items and the 72 failed cases. Historical remediation does not block use of the existing candidates or a controlled new-recording pilot. It still needs a correct recovery model before replay.
4. Preserve the current STT provider initially. Local transcription, GPU selection and model benchmarking follow measured quality, privacy, volume or cost needs. No new hardware or vector-database migration is proposed.
5. Prioritize transcript-only Cortex value over email federation only through an explicit owner-reviewed plan amendment. D-008 through D-010 acceptance fixtures remain unchanged and pending; this pilot does not falsely close V1a.
6. Keep the five-day soak as stability acceptance while bounded attended use already supplies value. The independent generic-webhook drill remains a distinct requirement unless explicitly amended.
7. DocKit, Dossier, ForgeOS and Portal support governance/operations. Their broader integration is not a prerequisite for delivering transcript content.

Release numbers should follow the actual changes accepted by each owner. The historical assignment of Media2Text 0.41/0.42 to provisioning must not force provisioning back ahead of the new product priority. M0 can reuse deployed 0.39.3 read-only. M1 should build from current Media2Text main, preserving its reviewed provenance/lifecycle improvements; an upgrade requires its own validation and the existing Home Infra ingress reconciliation.

## Small first-export rules

- Media2Text owns the exporter/projector. Canonical records remain immutable; Markdown is a rebuildable presentation.
- Start with one private workstation folder and an explicit existing transfer path. No credentials inside the vault, no broad API key distributed to clients, no new cloud sync decision by implication, and no production worker on dev-vm.
- Stable filenames derive from authority, collection and source item, with full identity, source/transcript hashes and current revision in metadata. Titles and dates remain readable fields; unknown recording dates stay unknown. Retain path history in the manifest.
- Generated files and personal annotations are separate. An edited generated file produces a blocked/conflict report, not an overwrite or another full-text conflict file.
- Apply an operator-owned exclusion list on first export, regeneration and restore. A known withdrawal can produce a metadata-only generated stub without transcript body. It must not remain available through normal content search. An edited/conflicted copy needs explicit resolution before claiming withdrawal completed.
- Temporary source absence is not deletion. The initial manual exclusion/retraction procedure is explicitly not automatic source deletion or physical erasure from all copies/backups.
- Prefer bounded rescans and atomic writes over a new event bus or universal synchronization platform for this corpus.

## Corrections agreed during reconciliation

Opus withdrew the first-pass suggestions of searchable full-text withdrawal banners, extra `*.conflict.md` copies, a lasting receiver-complete/producer-failed operating state and budget work after the new-recording milestone. Codex corrected the earlier prioritization of complete backup/provisioning work ahead of usable output. Both agreed that every historical retry must first define attempt/revision/status reconciliation without regressing frozen terminal states or inventing idempotency keys.

## Why Markdown and Obsidian first

Obsidian stores notes as ordinary Markdown files and supports core text search without a vector index. These capabilities fit immediate reading and retrieval of the existing transcripts. Semantic cross-language retrieval and agent answers with evidence remain Cortex's later contribution. Keeping Markdown and canonical JSON allows both paths without forcing a premature database or embedding choice.

Official references: [Obsidian storage](https://obsidian.md/help/data-storage), [Obsidian core Search](https://obsidian.md/help/plugins/search).

Key code references: Media2Text `src/pipeline/run.ts:707`, `src/transcripts/store.ts:315`, `src/formatters/md.ts:43`, `src/api/server.ts:793`, `src/jobs/outboxWorker.ts:123`; Cortex `src/api/webhookRoute.ts:19`, `src/api/server.ts:13`, `docs/CORTEX_V1_EXECUTION_PLAN.md:113`.

## Scope of this session

Analysis and consensus only. No canonical roadmap, source code, credentials, production configuration, processing budget, paid transcription, historical replay, content export or device synchronization was changed. No tests or deployments were needed for unchanged source. Runtime probes were read-only and emitted aggregates, not transcript text. Private evidence and both model rounds remain in operator custody; staging archives were verified before release.
