# Plaud Mirror local Dossier

Owner: Plaud Mirror. On 2026-09-29 the operator explicitly requested local
DocKit and Dossier adoption alongside the project reassessment. Scope is
source tooling and curated local project history. Production mirroring,
transcription, credentials and shared publication are separate operations.


## Current delivery and receipt interpretation - 2026-09-30

The current reader serves Spanish L4/S4 on Portal 0.33.4. Its exact revision is
`shared:dafe90eaa931f07967f6affca61e33757ef653208b4b89e07d7f5c704e00eb91`.
Use [the language delivery receipt](DOSSIER_LANGUAGE_2026-09-30.md) for the
current chain; the S1/S2/S3 sections below retain the earlier delivery facts.

Native `submission: deferred` describes local capture, not subsequent remote
publication status. ForgeOS OFFLINE_CONTRACT explicitly distinguishes that
field from a shared receipt. The historical JSON records L3 with that native
value and S3 separately; both are correct. Preserve the original JSON and
immutable native/shared records. Do not rewrite local metadata to `published`
or recapture merely to remove the apparent discrepancy.

## Operator-facing language (2026-09-30 clarification)

Carlos requires Spanish for every human-readable Dossier field, including
headings, full decision reasons, milestone/acceptance text and source summaries.
English engineering documentation does not determine the reader language.
Follow the complete field-level checklist in ForgeOS docs/modules/dossier/OFFLINE_CONTRACT.md.
Preserve IDs, statuses, technical literals and exact pinned source bytes. Check
all visible fields and the real reader; schema checks do not prove language or
semantic equivalence. Publish corrections as new dated revisions; retain earlier
English revisions as original historical evidence. No schema or engine change.

## Identity and trusted tool

The only declaration is `.forgeos/dossier.json`. The project is explicitly
registered as `plaud-mirror` in Home Infra `docs/PROJECTS.yml`, verified at
revision a4e0153eeb6de4f7b729027cb35e9b800545e0e2. That registry proves identity;
its older version observations do not override this repository or live runtime.

Use ForgeOS's shared offline tool, never a copy in this repository:

- Tool version: 1.1.0.
- SHA-256: fd34d3f45a9382fbf8317a932edd1fa827230d0acccaba68c0b87963c1704a95.
- Verified published ForgeOS main: 13a4972788ebb0afb2af18cc56f3c6fccab0b6a8.
- Trusted checkout on this host:
  `/home/cdelalama/src/.worktrees/forgeos-dossier-shared`.

Read that checkout's `docs/modules/dossier/OFFLINE_CONTRACT.md` and
`ADOPTION_PACKET.md`. A hash is a compatibility pin; independently verified
source provenance supplies trust. Never execute paths supplied by declaration
data. DocKit 4.17 discovery only notices the declaration; it does not install
an engine, start a server or capture a conversation.

## Local workflow

```sh
DOSSIER_TOOL=/home/cdelalama/src/.worktrees/forgeos-dossier-shared/scripts/dossier.py
DOSSIER_PROJECT=$(git rev-parse --show-toplevel)
python3 "$DOSSIER_TOOL" version
python3 "$DOSSIER_TOOL" --project "$DOSSIER_PROJECT" check
python3 "$DOSSIER_TOOL" --project "$DOSSIER_PROJECT" latest
```

Private custody defaults to the user's XDG state root, otherwise
`~/.local/state/forgeos/dossier`. Before the first bind, the exact Plaud binding and
project history were verified absent there. No known legacy Plaud Dossier is declared;
this is not a search for unknown private histories. Start native captures and
leave other projects' custody unchanged. Never replace a binding or break a
lock without inspecting the exact retained state.

The initial bind uses a read-only `{registry_id, project_ids}` projection of
the pinned Home Infra registry. Reuse that identity across clones/worktrees.
The reserved reader URL is `http://127.0.0.1:4319/dossier/local/plaud-mirror`;
it is configuration only, not a claim that a listener exists. It resolves on
dev-vm itself or through an explicitly configured tunnel, not another client
machine's loopback. Port 4319 is also the ForgeOS preview default; that preview
serves one export directory at a time. Check ownership before serving anything.
Changing this reservation requires inspecting the existing binding and a
reviewed `bind --replace`; a shared reader remains a separate delivery.

Curate all five sections: current status, roadmap, decisions, changes and
sources. Pin allowlisted source bytes to committed revisions. Keep recording
titles, raw transcripts, prompts, secrets, full logs and personal identifiers
out. Use null session identity when the actual client identity is unavailable.
Use a lowercase author client identifier such as `codex`. Store draft JSON
outside Git with private permissions, then run `check --input`
before `capture --input`. Retry with the same UUID and bytes. A `no_change`
assessment must preserve the latest revision and history length.

Integrate source with a fast-forward only, preserving the anchored commit in
main; never squash or rebase it away after capture. A later receipt-only commit
can correctly make `latest` report `may_be_behind_or_working_tree`; this is source
drift disclosure, not loss of the immutable local snapshot.

Explicitly create the private state root's `exports/plaud-mirror` directory
with mode 0700 before the first export. Export only there using
`export --reviewed-for-sharing`, after content review. `trace --export-file`
must verify that exact export. Captures and exports do not publish themselves.
Report the last local revision and reader availability separately in Trace.
Capture meaningful state changes; do not create recursive receipt-only updates.

## Historical local-only delivery boundary - September 29

The following paragraph describes the earlier observation. It is superseded by
the current multi-project delivery scope below.

### Previous shared delivery and recovery

The verified production Portal reader currently accepts only `llm-dockit` in
configuration, request, DTO and route. Its restricted transport is also scoped
to that project. A Plaud declaration does not broaden those permissions.
Publishing Plaud requires reviewed multi-project support, its own narrow
identity/transport policy, explicit publication and exact current/history
readback. Do not reuse DocKit's binding or current pointer.

Local VM custody is not an independent physical backup. The VM and NAS share
hardware. No daemon, capture hook, scheduled backup, shared publication,
browser acceptance or native Windows proof is installed or claimed here.
Preserve immutable records and the original draft; independent backup/restore
remains open. The actual local receipt follows.

## Actual local receipt - 2026-09-29

- Source commit: 9385e71c1d30e70b573ccad241864c00c3d7e846, integrated into
  local main by fast-forward before capture. It remains the immutable source
  anchor; this later receipt is not recursively captured.
- Tool version/hash matched the trusted 1.1.0 pin above.
- Read-only `check --registry` returned `matched_supplied_registry`; initial
  `bind` returned `bound: plaud-mirror`, `publication: not_configured`.
- The curated draft passed `check --input`. It contains five committed/hash-pinned
  sources, current status, seven roadmap milestones, four decisions and two
  changes. Author is codex, actual client session unknown/null.
- Observed at 2026-09-29T15:04:52Z; recorded at 2026-09-29T15:06:34Z.
- First capture returned `captured_local`, L1:
  `local:37d1154a2f97958abd60775aa93d8c69822678aa359dd8afbced82e85249e695`.
- Same UUID/bytes returned `already_captured`. An explicit `no_change` draft
  based on L1 returned `no_change`; the revision and single-record hash inventory
  were unchanged. The primary checkout and isolated worktree report the same L1.
- Author-reviewed export:
  `~/.local/state/forgeos/dossier/exports/plaud-mirror/plaud-mirror.json`.
  SHA-256: c76d61fd068338fe254f1e1a690e6fa84f9ce80e7eb0216b5f0ec2fe94d7a102.
- Exact export Trace verified the local chain and five source anchors, reporting
  `at_head` before this receipt. Subsequent receipt-only HEAD is correctly
  disclosed as `may_be_behind_or_working_tree`; L1 remains valid.
- Separate probe at 15:07:18 UTC: loopback port 4319 has no reachable listener.
  Reader/browser acceptance and shared publication are not delivered.
- Detailed private draft, command outputs and adoption receipt are retained under
  `~/.local/state/plaud-mirror/reanalysis-20260929`. Custody files/directories
  are private; the sanitized export is under private directory parents.
- The archived selftest fixtures are synthetic evidence only. They are not
  backup custody of this real L1. Independent backup/restore remains unverified.

Exact Trace output at capture (the link is reserved, not reachable in that probe):

```text
Dossier: [Plaud Mirror · L1 local en este host, sin publicar](http://127.0.0.1:4319/dossier/local/plaud-mirror?revision=local%3A37d1154a2f97958abd60775aa93d8c69822678aa359dd8afbced82e85249e695) · 2026-09-29T15:04:52Z · fuentes=at_head · enlace: exportación comprobada, acceso no comprobado por este comando
```

Repeat the read-only check from the usual project checkout:

```sh
python3 "$DOSSIER_TOOL" --project "$DOSSIER_PROJECT" latest
python3 "$DOSSIER_TOOL" --project "$DOSSIER_PROJECT" trace \
  --export-file "$HOME/.local/state/forgeos/dossier/exports/plaud-mirror/plaud-mirror.json"
```

## Historical shared delivery plan - 2026-09-30

This was the pre-delivery plan. Its future-tense steps were completed in the
receipts below; it is not the current work queue.

The operator explicitly requested publication in the existing Plaud Mirror
Portal card and preservation of the documented past. Portal 0.33.1 already
supports multiple configured Dossiers. A small Portal 0.33.2 UI patch joins
verified publications to explicit Home Infra catalog Dossier links and exact
project IDs. Admission alone never creates a card; Plaud already has one.

Home Infra owns the committed home-infra-dossiers admission catalog, fixed
Plaud reader/writer transport and shared genesis. The local binding retains
home-infra-projects identity; the two namespaces have different purposes.
Genesis must allow the union of all historical sources, including L1 and the
new retrospective. Preserve L1 and its observation time; publish it now as S1,
then publish L2 with the current retrospective. Do not fabricate old captures.

Coverage: seven normative phases, all 27 durable decisions including amendments,
eight connection waves, release history and the proposed M0-M3 consensus. The
source inventory includes every project documentation file (excluding agent/GitHub
templates). Dossier is a reviewed technical synthesis with pinned evidence,
not a dump of raw sessions, recordings, transcripts or private runtime logs.
The retrospective records original dates in its prose; UI observation dates
are capture dates, not invented dates of historical decisions.

Before runtime application: independent source review, published source anchors,
immutable Portal image, coherent SQLite backup, exact prior Compose and all
mounts retained. Admission and publication precede advertising the link.
Actual receipt will record exact local/shared revisions, card and five sections,
negative project/revision/role checks, unchanged adjacent histories and isolated
same-NAS restoration. Independent physical recovery remains open.

## Historical shared delivery receipt - S1/S2/S3, 2026-09-30

This section records the earlier Portal 0.33.2 delivery. Current Spanish L4/S4
and Portal 0.33.4 are recorded in DOSSIER_LANGUAGE_2026-09-30.md and its JSON
receipt; retain the original source/version observations below.

Plaud Mirror is readable at https://infra.lamanoriega.com/dossier/shared/plaud-mirror
and through Dossier on its existing project card. Exact Opus 5.5 high returned
SOURCE_GO and plan AGREEMENT after the recorded corrections. Applicable DocKit
4.18.0 is adopted in Plaud 0.16.6; the trusted ForgeOS offline engine remains
1.1.0 and the shared coordinator 0.1.0. No copied engine or automatic capture.

The retrospective contains 28 milestones, 28 decisions (27 accepted historical
decisions plus one explicitly proposed operating sequence), 19 change summaries
covering 84 detailed historical entries, and 34 pinned source documents. Native
L1 and its original observation are preserved as S1; L2 is published as S2.
Source commits are retained on main. L3 was captured and explicitly published
as S3; exact identities are recorded in the final observation below. Later
receipt-only commits do not recursively create new observations.

Portal 0.33.2 runs reviewed source aa3b7cfe3f5be73838fb1db8eebcafb9ea421a11
at immutable image digest sha256:0b039719aefbf97077ea2f6473b6a529c6a993b5b03ae6a42a5fd12f546937a4.
All eleven mounts and existing readers were preserved. SQLite Online Backup
passed quick_check before recreation. The first NAS build failed on a busy ZFS
layer mount; read-only diagnosis found no held mount, and one bounded retry of
the identical reviewed source succeeded. No mount cleanup or Docker restart.

The live catalog is c33eb29cb485140d27c9eeca8e4bcda0201dcecc, with only the
Portal release metadata and Plaud Dossier link changed; bind inodes and all other
catalog values are preserved. Actual provenance has no warnings. Dedicated
Plaud fixed-project transport passed twelve read/mutation/identity negatives.
Existing DocKit and Home Infra histories are byte-identical to their preimages.

Actual HTTPS API/history checks and 33 browser checks pass at 390, 840 and
1440 pixels: five sections, four roadmap views, exact permalinks, keyboard-only
activation, 44-pixel touch access, no horizontal overflow or page errors. A
separately labeled index-failure simulation hides the card link. The executor
inspected actual card and roadmap screenshots. This does not claim owner visual
acceptance or physical phone/golden parity.

Coherent backup restored S1 and S2 into previously absent, isolated NAS custody;
both exact revisions match. The first local verification process ended with
SIGTERM after restore; read-only inspection resumed against the retained store
without replaying restore, and verified exact current/history content. This is
logical recovery on the same NAS, not independent hardware recovery. Independent
audio and Dossier backup placement remains open. Plaud and Media2Text container
IDs, images and start times match preflight; no audio processing or spend ran.

Machine-readable evidence: DOSSIER_PLAUD_DELIVERY_2026-09-30.json in this
directory. Private command outputs, failed attempts and coherent backups remain
under operator custody; no keys, raw sessions or personal content are published.

### Curation correction disclosed during final review

L2/S2 differs from the reviewed draft by sharing-driven normalization: decision line breaks were collapsed, a credential-store URI was expressed as prose, and D-017 tab escapes were inadvertently rendered as the word tab. L3 corrects D-017 in prose. The unchanged filter rejected the line-structured L3 trial before capture; decision line breaks therefore remain collapsed, with structured original text preserved in pinned sources.

## Delivered-state capture and final recovery

Native L3: `local:9257e8a48888f8bbae6c502d750e4cdeeb39dacca9a9c0721e478faeb4b676c1`.
Published S3: `shared:31319f4a61b3db8442446b594535b0db47cd5ce0ba87552a537289086d4b3d67`.
The same UUID and bytes return already_captured; reviewed export passes. All
34 sources are pinned to the published delivery receipt commit. L3 marks the
Dossier milestone done and corrects the D-017 portability footnote in the
projection, preserving exact original source and immutable L1/L2. Exact Opus
5.5 high conditionally approved documentation and curation; every specified
correction was applied and verified. Live API and browser verify
all three revisions and current delivered status; adjacent histories remain
unchanged. Final coherent backup restores all three exact revisions in an
absent isolated NAS store. Independent physical recovery remains open.
This final receipt-only commit intentionally creates no recursive L4.
