<!-- doc-version: 0.2.0 -->
# Plaud Mirror

Self-hosted Plaud audio mirror with web UI, auto-sync, and webhook delivery.

**Version:** see [VERSION](VERSION) | [CHANGELOG](CHANGELOG.md)

## Overview

Plaud Mirror is a Docker-first service for mirroring Plaud recordings to local storage as soon as they appear in the account. Its job is deliberately narrow: stay authenticated, discover new recordings, download the audio artifact, and hand the result to downstream systems that do speech-to-text, indexing, or archival work.

The project is meant to be a real OSS with its own identity, not a thin wrapper around somebody else's code. At the same time, it does not ignore the existing ecosystem. Plaud Mirror takes concrete inspiration from several upstream projects, documents exactly what it keeps from each one, and maintains a watchlist so changes in auth, token handling, regional API behavior, or download flows are visible quickly.

Version `0.2.0` starts Phase 1 implementation. The repository now contains the documentation system, upstream-watch tooling, version-sync enforcement for package manifests, and a real TypeScript spike harness for validating Plaud bearer-token auth, recordings listing, detail lookup, and audio download from `dev-vm`. The production API, UI, and Docker deployment are still pending.

## Quick Start

### Prerequisites
- `gh` authenticated against GitHub
- Local access to `home-infra` if you want external-context generation
- POSIX shell environment for repository scripts

### Setup
```bash
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
npm install
scripts/dockit-generate-external-context.sh --apply --claude-rules --project .
scripts/check-version-sync.sh
scripts/check-upstreams.sh
```

### What Works Today
```bash
npm test
npm run spike -- --help
scripts/dockit-validate-session.sh --human
scripts/check-upstreams.sh --markdown
```

## Phase 1 Spike

The current implementation target is a CLI spike in `apps/api` that proves the live Plaud flow before the full Fastify/React product slice exists.

Required environment:

```bash
export PLAUD_MIRROR_ACCESS_TOKEN="<your-bearer-token>"
```

Optional environment:

```bash
export PLAUD_MIRROR_API_BASE="https://api.plaud.ai"
```

Useful commands:

```bash
npm run spike -- validate
npm run spike -- list --limit 50 --from 2026-04-01 --to 2026-04-22
npm run spike -- detail --id <recording-id>
npm run spike -- download --id <recording-id>
npm run spike -- probe --limit 100 --download-first
```

Outputs:
- `.state/phase1/latest-report.json` for the spike summary
- `recordings/<recording-id>/audio.<ext>` for mirrored audio
- `recordings/<recording-id>/metadata.json` for the local metadata snapshot

## Documentation

| Document | Purpose |
|----------|---------|
| [LLM_START_HERE.md](LLM_START_HERE.md) | Entry point for LLM contributors |
| [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) | Vision, architecture, milestones, current state |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical design for auth, sync, storage, and UI |
| [docs/UPSTREAMS.md](docs/UPSTREAMS.md) | Upstream matrix, baselines, and reuse policy |
| [docs/STRUCTURE.md](docs/STRUCTURE.md) | Repository layout |
| [docs/VERSIONING_RULES.md](docs/VERSIONING_RULES.md) | Version management policy |
| [docs/operations/AUTH_AND_SYNC.md](docs/operations/AUTH_AND_SYNC.md) | Auth renewal and sync behavior |
| [docs/operations/UPSTREAM_WATCH.md](docs/operations/UPSTREAM_WATCH.md) | How upstream changes are detected and reviewed |
| [docs/llm/HANDOFF.md](docs/llm/HANDOFF.md) | Current work state |
| [HOW_TO_USE.md](HOW_TO_USE.md) | Project workflow and DocKit usage guide |

## Contributing

This repository is still documentation-heavy, but runtime work has now started. Any change touching auth, token renewal, sync cadence, storage layout, or upstream baselines must update the matching docs in the same session.

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.

---

*Project documentation scaffolded from [LLM-DocKit](https://github.com/cdelalama/LLM-DocKit).*
