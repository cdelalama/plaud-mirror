# How to Use This Repository

This guide explains how Plaud Mirror is meant to be operated as a project before the runtime exists, and how it stays aligned with both `LLM-DocKit` and the Plaud ecosystem upstreams it watches.

## Current Reality

`v0.1.0` is a design-and-governance baseline. Today the repository gives you:
- a concrete product definition
- a repository structure for the upcoming implementation
- auth and sync design rules
- an upstream baseline manifest plus a local checker
- DocKit-based LLM working memory and validation

It does **not** yet give you the runnable Plaud sync service.

## Local Setup

1. Install the pre-commit hook:
```bash
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

2. Generate the external-context block from `home-infra`:
```bash
scripts/dockit-generate-external-context.sh --apply --claude-rules --project .
```

3. Validate the repository documentation state:
```bash
scripts/check-version-sync.sh
scripts/dockit-validate-session.sh --human
```

4. Check tracked upstreams:
```bash
scripts/check-upstreams.sh
scripts/check-upstreams.sh --markdown
```

## Working With LLM-DocKit Upstream

Plaud Mirror is a downstream project of `LLM-DocKit`. The opt-in marker `.dockit-enabled` and the local `.dockit-config.yml` are already committed. When `LLM-DocKit` improves, sync from the template repository, not from this project.

Example workflow:
```bash
/home/cdelalama/src/LLM-DocKit/scripts/dockit-sync.sh --init-state --project /home/cdelalama/src/plaud-mirror
/home/cdelalama/src/LLM-DocKit/scripts/dockit-sync.sh --dry-run --project /home/cdelalama/src/plaud-mirror
/home/cdelalama/src/LLM-DocKit/scripts/dockit-sync.sh --apply --project /home/cdelalama/src/plaud-mirror
```

After any sync:
```bash
cd /home/cdelalama/src/plaud-mirror
scripts/check-version-sync.sh
scripts/dockit-validate-session.sh --human
```

## Working With External Context

This project is tied to local infrastructure decisions documented in `home-infra`. That link is configured in `.dockit-config.yml`.

If deployment, auth, or storage assumptions change:
1. update the relevant local docs
2. regenerate external context
3. review whether `home-infra` docs also need updates

Command:
```bash
scripts/dockit-generate-external-context.sh --apply --claude-rules --project .
```

## Working With Upstreams

The canonical upstream baseline lives in `config/upstreams.tsv`.

Use:
```bash
scripts/check-upstreams.sh
```

Interpretation:
- `CURRENT` means the tracked baseline still matches GitHub.
- `CHANGED` means the repo moved and needs human review.

When a tracked upstream changes:
1. read [docs/UPSTREAMS.md](docs/UPSTREAMS.md)
2. inspect the changed upstream release or commits
3. decide `adopt`, `watch`, or `ignore`
4. update `config/upstreams.tsv` only after documenting the decision in `docs/llm/DECISIONS.md` and `docs/llm/HISTORY.md`

## Starting Implementation

The intended implementation order is:
1. `apps/api/` - service API, auth manager, scheduler, storage, webhook delivery
2. `apps/web/` - settings and status UI
3. `packages/shared/` - shared schemas, config, and webhook contracts

Before writing runtime code, read:
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/UPSTREAMS.md](docs/UPSTREAMS.md)
- [docs/operations/AUTH_AND_SYNC.md](docs/operations/AUTH_AND_SYNC.md)
- [docs/operations/API_CONTRACT.md](docs/operations/API_CONTRACT.md)
