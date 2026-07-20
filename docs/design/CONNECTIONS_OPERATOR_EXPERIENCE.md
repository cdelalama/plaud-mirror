<!-- doc-version: 0.15.0 -->
# Connections Operator Experience

Status: operator-ratified design brief. Wave 1 is complete when the deployment,
failure review, durable decisions, and cross-repository documentation are
published. Product implementation remains separately gated.

## Outcome

An operator starting from zero must be able to answer four questions without
understanding either service's environment variables:

1. How do I connect this transcriber?
2. Is the connection working, and what evidence proves it?
3. What will it process and what might it cost?
4. How do I pause, rotate, disconnect, or archive it safely?

Plaud Mirror remains complete with no transcription destination. Media2Text is
the first compatible transcriber, not a Plaud Mirror dependency. Cortex is
downstream of transcript-ready output and is never configured or observed by
Plaud Mirror.

## Authority Map

| Concern | Authority | Plaud Mirror presentation |
|---|---|---|
| Plaud inventory, eligible workload, duration, bytes, duplicate-destination scope | Plaud Mirror | Exact local scope and replay preview |
| Transcription profile, provider selection, provider price, provider limits | Media2Text | Imported capability/limit evidence; never invented locally |
| Transcript ingestion and semantic availability | Cortex | Absent from this product |
| Deployment versions, secret references, sanitized health | Home Infra | Read-only infrastructure truth; no secret values or pairing workflow |
| Governance and session recovery | Each adopter's LLM-DocKit files | Durable decisions, roadmap, handoff, and validation evidence |
| Cross-project product discovery | ForgeOS | Links to the owning artifacts; it does not copy this roadmap or become runtime authority |

Home Infra Protocol remains a declaration and observation protocol. It does not
own provider signup, credentials, pairing authorization, or media transport.
Extraction of a common pairing protocol waits for a second real service pair.

## Bilateral Connection Model

Connecting Plaud Mirror to a transcriber creates two independent configured
halves:

- Plaud Mirror knows where and how to admit audio to the transcriber.
- The transcriber knows where and how to fetch the immutable audio and return
  signed status.

The three connection secrets have explicit direction:

| Secret | Issuer | Holder/use |
|---|---|---|
| `artifactBearer` | Plaud Mirror | Media2Text fetches leased audio |
| `intakeBearer` | Media2Text | Plaud Mirror admits work |
| `statusHmacSecret` | Media2Text | Media2Text signs status; Plaud Mirror verifies |

Plaud Mirror-to-Media2Text and Media2Text-to-Cortex are separate hops with
separate health and failure ownership. A Cortex outage must not make the Plaud
connection red.

## Portable Bundles V1

The first operator workflow uses two sensitive, portable JSON bundles rather
than five loose fields:

1. Plaud Mirror exports a `connection-request`. It contains a unique bundle and
   request id, issue/expiry timestamps, producer identity and public origin,
   artifact/status route metadata, pinned contract version and hashes, declared
   requirements, and the Plaud-issued `artifactBearer`.
2. Media2Text imports the request into an application-authenticated admin
   surface, creates a producer profile in its runtime store, and exports a
   `connection-grant`. The grant echoes the request/contract identity and
   contains the receiver origin and identity, capability/limit snapshot,
   `intakeBearer`, and `statusHmacSecret`.
3. Plaud Mirror imports the grant, verifies the echoed request and contract,
   tests the connection, and only then permits enablement and a bounded canary.

Both bundles are secrets. The interfaces must warn against chat, email, source
control, screenshots, and long-lived downloads. V1 uses the authenticated
single-operator interfaces and operator custody as its trust bootstrap. It does
not invent a signing PKI.

V1 guarantees are deliberately narrow:

- a canonical-content hash detects accidental corruption, not an attacker who
  can rewrite the bundle and recompute the hash;
- import rejects an expired bundle and persists consumed bundle ids to reject
  re-import;
- the UI may reveal a generated bundle once, but copied bytes cannot be made
  physically single-view or revocable offline;
- there is no cryptographic proof of issuer authenticity in the portable
  artifact.

Strong authenticated redemption belongs to future online pairing. At that
point Plaud can provision artifact access in-band after authenticating with the
intake credential, and per-lease artifact tokens can replace a static
destination bearer. That evolution is deferred with online pairing and must
not be closed off by V1 storage or schema choices.

## Media2Text Runtime Provisioning

The first real Media2Text implementation must make producer profiles mutable at
runtime through an authenticated admin API and UI. A CLI that only writes
Doppler and recreates the container is not the primary operator journey; it
preserves the restart friction this design is intended to remove.

The runtime store must encrypt secrets at rest, audit create/import/rotate/
revoke actions, and support rotation without a container restart. Existing
`Y2T_TRANSCRIPTION_INTAKE_PROFILES_JSON` configuration becomes a one-time seed:
on startup it imports only when the store is empty, after which the runtime
store is authoritative. A CLI may remain as a break-glass or automation
surface over the same authenticated control plane.

An implementation split is pre-authorized if needed:

- `0.41.x`: encrypted runtime profile store, seed migration, authenticated
  profile administration, rotation/revocation, and audit.
- `0.42.x`: request import, grant export, consumed-bundle tracking, expiry,
  contract binding, and operator walkthrough.

SemVer must describe the actual shipped slice; neither version is promised
until its repository gates pass.

## Connection State Presentation

The product must not collapse reality into one linear stepper. Each connection
card summarizes four independent dimensions:

| Dimension | Examples |
|---|---|
| Configuration | absent, partial request, grant imported, complete |
| Policy | disabled, enabled, primary, secondary paid destination |
| Evidence | untested, capability test passed, canary passed |
| Health | unknown, healthy, degraded, action required |

Canary evidence must be persisted on the delivery itself as
`dispatchKind: canary | manual_batch | automatic`. A button label or inference
from the most recent successful delivery is not evidence.

The current screen name `Integrations` remains until visual design validates
the information architecture. `Connections` is a candidate, not a frozen
rename. The implementation must budget the complete documentation, tests,
translations, and visual-gate sweep if the rename is accepted.

## Operator Operations

The UI distinguishes four actions:

- **Pause:** stop new admission while preserving the configured connection and
  obligations.
- **Rotate access:** rotate Plaud's artifact bearer and guide the matching
  receiver update; never imply this rotates all three secrets.
- **Disconnect:** revoke Plaud's local half, stop new work, choose a disposition
  for in-flight work, and guide the operator to revoke the Media2Text profile.
  Manual V1 cannot claim atomic bilateral revocation.
- **Archive:** hide a disconnected connection while retaining immutable
  evidence and audit history. Do not call this Delete.

If the operator cuts active work, append a revocation event and project the
affected delivery to a terminal local `operator_revoked` disposition. Preserve
the row identity, timestamps, intake id, prior events, and provider evidence.
Coverage counts it as terminal and untranscribed rather than leaving a pending
zombie. The exact event/schema change is part of implementation design and
requires tests before release.

## Cost And Scope

Cost has two authorities:

- Plaud Mirror computes eligible item count, duration, bytes, selected batches,
  and duplicate-destination scope.
- Media2Text owns provider price, provider choice, retry allowance, and hard
  economic limits.

Plaud may show a local planning estimate only when labelled with its configured
rate and date. The current USD 335.62 replay number is a local estimate using
the configured Deepgram rate as of 2026-07-18, not a Media2Text quotation and
not spending authority. A future replay GO requires a fresh receiver-owned
quotation plus the existing explicit batch approval.

## Failure Ownership

| Failure | Owning surface | Cross-service effect |
|---|---|---|
| Plaud cannot admit or serve leased bytes | Plaud Mirror connection | Media2Text may show the producer profile degraded |
| Media2Text cannot fetch, normalize, or transcribe | Media2Text profile/job | Plaud delivery receives bounded terminal evidence |
| Status callback fails | Media2Text outbox, recovered by Plaud pull | Connection health may degrade; Plaud source sync stays healthy |
| Cortex delivery fails | Media2Text transcript-ready delivery | Plaud is unchanged |
| Bundle expired/re-imported/contract mismatch | Importing product | No partial activation; preserve auditable pairing state |
| Rotation during active leases | Both products, each for its half | Existing obligations follow an explicit grace or terminal policy |

## Eight-Wave Roadmap

1. **Operational baseline and durable decisions.** Deploy Plaud Mirror 0.15.0,
   classify the three retained failures, record D-026 and Media2Text D-024,
   publish this brief, update Home Infra deployed truth, and leave replay,
   Cortex delivery, and provider spend untouched.
2. **LLM-DocKit alignment.** In isolated governance commits, sync Plaud Mirror
   from 4.9.6 and Media2Text from 4.12.3 to canonical 4.13.1. Plaud's validator
   smoke suite and local prose/unabsorbed-artifact checks are hard exit gates.
   A fifth destructive re-merge of local checks blocks the sync and becomes an
   upstream merge-strategy defect, not another silent repair. ForgeOS stays on
   its own branch and consumes only published handoffs.
3. **Bundle and lifecycle contract.** Freeze exact request/grant schemas,
   canonicalization, expiry/re-import semantics, partial-pair state, rotation,
   disconnect, active-obligation disposition, threat model, and negative test
   matrix. No runtime code precedes this contract review.
4. **Media2Text control plane.** Ship runtime profile administration and seed
   migration, then bundle import/grant export, using the authorized 0.41/0.42
   split when it lowers risk.
5. **Plaud Mirror control plane.** Ship request export/grant import, dimension
   summaries, persisted canary kind, cost/scope presentation, and guided
   operations, using an honest 0.16/0.17 split if needed.
6. **Joint operator verification.** Starting from empty state, pair both
   products through their public TLS interfaces, run capability tests, process
   exactly one approved canary, verify push/pull agreement and lease release,
   rotate access, and exercise non-destructive disconnect dry-runs. Update Home
   Infra only with deployed versions, digests, secret references, and sanitized
   health.
7. **Five-day freeze and Phase 3 close.** Start the clock only after the last
   planned deploy of both services, the successful joint canary, and Plaud's
   first completed automatic PT15M run after those deploys. Freeze both
   services for five uninterrupted days except incidents. A runtime deploy to
   either service that can affect the path resets the clock; docs-only commits
   do not. Verify Docker health, exact coverage, both outboxes, pull recovery,
   Portal freshness, and the separately required live generic-webhook drill,
   then close Phase 3 with evidence.
8. **Learn before extracting.** Let ForgeOS discover the published operating
   model and let Home Infra observe it. Online pairing, per-lease tokens, and a
   shared pairing protocol remain deferred until a second real service pair
   proves reusable vocabulary. Historical replay stays a separate economic
   decision.

Only Wave 1 is authorized by the 2026-07-20 GO. Every later wave retains its
repository-local onboarding, implementation, deployment, credential, canary,
and spending gates.

## Definition Of Done

The program is done only when a new operator can connect from empty state,
prove operation with persisted evidence, understand scope and quoted cost,
rotate and disconnect without hidden zombie work, recover after restart, and
see truthful independent health for both hops. All owning repos must be clean,
published, and internally synchronized; Home Infra must match deployed reality;
DocKit validators must pass; ForgeOS must point to the owning artifacts rather
than copy them; no secret may appear in Git, logs, Home Infra, or bundles stored
as evidence.
