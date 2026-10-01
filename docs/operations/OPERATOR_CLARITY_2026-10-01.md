# Operator clarity delivery - 2026-10-01

Carlos requested plain operator prose and explicit roadmap continuity across
projects. DocKit 4.18.2 owns the shared rule; ForgeOS 0.29.2 maps it to existing
Dossier fields. Plaud 0.16.10 and Media2Text 0.41.0 explain M0 and the retained
base work. Portal 0.33.7 applies the reader correction to all four Dossiers.
Home Infra 0.47.10 records installed instructions and the verified deployment.

## What the operator can do now

Open [the current Spanish Plaud Dossier](https://infra.lamanoriega.com/dossier/shared/plaud-mirror?revision=shared%3A04aee2be34e6815da046799f479d6804903497ec0d05efd9b4b7a1eefb965c59). It names the chosen priority,
explains the September 29 recommendation and September 30 M0 choice, preserves
phases 3/5/6 and the proposed M1/M2/M3 sequence, and gives an actual next action.
Carlos downloads `Mis-transcripciones-M0-20260930-r2.zip` from his personal NAS
folder `Media2Text-private/M0-20260930`, extracts it, opens the folder containing
`LEEME.md` in Obsidian, then copies the folder to Android over USB. M0 finishes
when he can open the index, find a note with two remembered words and read it
offline on both devices. The prepared collection has 75 notes; device use is
still unverified. Media2Text owns `docs/operations/M0_READING_GUIDE.es.md`.

Every roadmap tab now displays authored priority and next action. List position
no longer invents the current phase or dependency edges; unfinished rows show
IDs rather than an execution order. Declared dependencies/dependents are named.
The shared protocol was selectively adopted in six owner repositories and
installed with byte comparisons in Codex, Claude and source-root instructions
on this host. Other hosts/ongoing sessions and all old curated publications are
not claimed migrated. Home Infra and DocKit need their next meaningful capture
to bring old short prose up to the new rule; original histories remain immutable.

## Verified delivery

- Exact `claude-opus-5-5`, high: SOURCE_GO/CURATION_GO after corrections, then
  RENDER_GO after seven actual screenshots and executor browser evidence.
  Earlier partial-onboarding rounds remain advisory; full final onboarding
  and retained native captures are documented in REVIEWS.md and the JSON receipt.
- Portal: 195 tests, typecheck and client/server build pass; published source
  `d37de4c02d01cfcb9442ccac4ac61e306690e1c6`, immutable image
  `registry.lamanoriega.com/infra-portal:0.33.7@sha256:8b6703fa912f09faafa1fa9619c4b3e63c0f2bc87097ace917fcfdfeb928412f`. Healthy NAS runtime, eleven mounts and four
  reader bindings preserved. SQLite Online Backup quick_check passed before it.
- Real browser: four projects, 390/1440 px, four roadmap tabs each (32 checks),
  zero page errors/overflow, exact M0 detail and original historical permalink.
- Plaud: L6 `local:9684b148e6d5062b80000b01832ad69579f6206b7d59f193b0df0b1fc6cd0e2e`; S6 `shared:04aee2be34e6815da046799f479d6804903497ec0d05efd9b4b7a1eefb965c59`; 28 milestones, 29 decisions, 35 pinned sources,
  23 changes. S1-S5 are exact and readable. Capture retry was idempotent.
  Sources pin published `6f57b37`; this later receipt does not require S7.
- Plaud 0.16.1 and Media2Text 0.39.3 retain their exact September 19 start times,
  container IDs and images. No new transcription or provider expense occurred.

## Incidents, recovery and next publication gate

The first Portal attempt rolled back because the development Docker image ID
was an OCI index digest while the NAS uses a config digest. Rollback was verified;
the corrected delivery compared NAS-local identity, immutable registry digest
and OCI source separately. No producer was restarted.

The publication client timed out after S6 committed. Status and exact readback
resolved the outcome; no publication mutation was retried. A complete six-record
read took 23.53 seconds, above the earlier 20-second follow-up threshold and close
to the 30-second Portal cutoff. **Do not publish Plaud S7 until reader headroom
and backup capacity are addressed through reviewed work, or adequate fresh read
headroom and a validated complete backup are demonstrated.**

The pre-S6 standard coherent backup succeeded. The post-S6 standard API reports
`backup exceeds pilot limit` (2,000,000 bytes). A bounded read-only archive under
the existing publisher lock preserves the complete current store. Its 2,314,240
bytes were restored into an isolated private dev-vm directory; the trusted engine
validated all six records and every record equals the live readback. SHA256:
`b54a642363fcdc8b45099348cdb8bab203a729b808517ea758748f06ad3daace`. The original store, engine and API limits
were not changed. Safe extraction required explicit private file/directory modes.
This is a tested retained recovery artifact, not ongoing independent disaster
recovery or a repaired standard backup API. ForgeOS owns the capacity follow-up.

The separate Portal integration-closure remains the next ordinary Portal task.
Rendered technical delivery does not replace Carlos's device/visual acceptance.
