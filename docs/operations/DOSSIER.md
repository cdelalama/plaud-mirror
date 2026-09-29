# Plaud Mirror local Dossier

Owner: Plaud Mirror. On 2026-09-29 the operator explicitly requested local
DocKit and Dossier adoption alongside the project reassessment. Scope is
source tooling and curated local project history. Production mirroring,
transcription, credentials and shared publication are separate operations.

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
`~/.local/state/forgeos/dossier`. Before adoption, the exact Plaud binding and
project history are absent there. No known legacy Plaud Dossier is declared;
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
Store draft JSON outside Git with private permissions, then run `check --input`
before `capture --input`. Retry with the same UUID and bytes. A `no_change`
assessment must preserve the latest revision and history length.

Integrate source with a fast-forward only, preserving the anchored commit in
main; never squash or rebase it away after capture. A later receipt-only commit
can correctly make `latest` report `may_be_behind_or_working_tree`; this is source
drift disclosure, not loss of the immutable local snapshot.

Export only to the private state root's `exports/plaud-mirror` directory using
`export --reviewed-for-sharing`, after content review. `trace --export-file`
must verify that exact export. Captures and exports do not publish themselves.
Report the last local revision and reader availability separately in Trace.
Capture meaningful state changes; do not create recursive receipt-only updates.

## Shared delivery and recovery

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
remains open. A verification receipt follows the first actual capture.
