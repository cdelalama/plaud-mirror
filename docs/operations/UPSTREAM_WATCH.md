<!-- doc-version: 0.1.1 -->
# Upstream Watch Playbook

This runbook defines how Plaud Mirror detects and reviews changes in tracked upstream repositories.

## Scope

- Tracked repositories listed in `config/upstreams.tsv`
- Local check script `scripts/check-upstreams.sh`
- Scheduled GitHub workflow `.github/workflows/upstream-watch.yml`

## Inputs

- `config/upstreams.tsv`
- `docs/UPSTREAMS.md`
- GitHub metadata for each tracked upstream

## Procedure

1. Run the checker:
```bash
scripts/check-upstreams.sh
```

2. If the result is `CHANGED`, inspect the affected upstream release or commits.

3. Classify the change:
- `adopt` if it directly improves Plaud Mirror
- `watch` if it is relevant but not immediately actionable
- `ignore` if it does not affect Plaud Mirror's goals

4. Document the rationale in:
- `docs/llm/DECISIONS.md`
- `docs/llm/HISTORY.md`

5. Only then update `config/upstreams.tsv` to the new baseline.

## Review Priorities

Highest priority:
- auth endpoint changes
- token storage or extraction changes
- region handling changes
- recording listing or export flow changes
- download temp-URL changes

Secondary priority:
- operator UX improvements
- storage layout ideas
- webhook or delivery ideas

## Validation

After updating the baseline:
```bash
scripts/check-upstreams.sh
```

The same upstream should return `CURRENT`.

## Escalation

If a primary upstream changed in a way that likely breaks auth or download:
1. pause production rollout
2. inspect the upstream diff or release notes
3. update `docs/UPSTREAMS.md` and `docs/ARCHITECTURE.md` before shipping a fix
