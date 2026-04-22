<!-- doc-version: 0.1.1 -->
# Plaud Mirror

Self-hosted Plaud audio mirror with web UI, auto-sync, and webhook delivery.

**Version:** see [VERSION](VERSION) | [CHANGELOG](CHANGELOG.md)

## Overview

Plaud Mirror is a Docker-first service for mirroring Plaud recordings to local storage as soon as they appear in the account. Its job is deliberately narrow: stay authenticated, discover new recordings, download the audio artifact, and hand the result to downstream systems that do speech-to-text, indexing, or archival work.

The project is meant to be a real OSS with its own identity, not a thin wrapper around somebody else's code. At the same time, it does not ignore the existing ecosystem. Plaud Mirror takes concrete inspiration from several upstream projects, documents exactly what it keeps from each one, and maintains a watchlist so changes in auth, token handling, regional API behavior, or download flows are visible quickly.

Version `0.1.1` is the current bootstrap/docs-governance baseline. The repository already contains the documentation system, architecture decisions, upstream baselines, watch automation stubs, and validator enforcement for key LLM-doc sync rules. The runtime service itself is still pending implementation.

## Quick Start

### Prerequisites
- `gh` authenticated against GitHub
- Local access to `home-infra` if you want external-context generation
- POSIX shell environment for repository scripts

### Setup
```bash
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
scripts/dockit-generate-external-context.sh --apply --claude-rules --project .
scripts/check-version-sync.sh
scripts/check-upstreams.sh
```

### What Works Today
```bash
scripts/dockit-validate-session.sh --human
scripts/check-upstreams.sh --markdown
```

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

This repository is doc-first until the runtime lands. Any change touching auth, token renewal, sync cadence, storage layout, or upstream baselines must update the matching docs in the same session.

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.

---

*Project documentation scaffolded from [LLM-DocKit](https://github.com/cdelalama/LLM-DocKit).*
