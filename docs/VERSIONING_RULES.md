<!-- doc-version: 0.4.14 -->
# Versioning Rules

## Version Format

Use Semantic Versioning (SemVer): MAJOR.MINOR.PATCH.

## Version Location

Versioning in Plaud Mirror now spans both documentation and runtime package manifests.

Current version sources:
- `VERSION`: primary source of truth for project version
- `docs/version-sync-manifest.yml`: lists all files tracked for version sync
- `package.json`: root workspace manifest
- `apps/api/package.json`: API workspace manifest
- `apps/web/package.json`: web workspace manifest
- `packages/shared/package.json`: shared-schema workspace manifest

## Impact Guidelines For This Project

### Patch (x.y.Z)

- Documentation refinements
- Upstream baseline updates without user-visible runtime behavior changes
- Bug fixes that do not change storage layout, auth mode, or webhook contract

### Minor (x.Y.z)

- New auth capabilities that are backward compatible
- New optional delivery mechanisms or operator UI features
- New configuration options that preserve old behavior
- Phase-boundary shifts captured in `docs/ROADMAP.md` when they do not break existing contracts

### Major (X.y.z)

- Storage layout changes requiring migration
- Breaking changes to webhook payloads or HTTP API
- New deployment requirements or incompatible auth behavior

## Synchronization Rules

All files requiring version markers are listed in `docs/version-sync-manifest.yml`.
This manifest is the single source of truth for version sync.

### Automated Version Bump

Run the bump script to update all tracked files atomically:
```bash
scripts/bump-version.sh <new_version>
```

The script reads the manifest and updates:
- `VERSION` file (plain version string)
- `<!-- doc-version: X.Y.Z -->` HTML comment markers in documentation files
- `"version": "X.Y.Z"` fields in tracked package manifests
- `CHANGELOG.md` section header (adds `## [X.Y.Z]` placeholder)

### Validation

Run the check script to detect version drift:
```bash
scripts/check-version-sync.sh
```

This exits `0` if all files match `VERSION`, or exits `1` with details on which files are out of sync.

### Pre-Commit Hook

Install the pre-commit hook to catch drift before it is committed:
```bash
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

The hook:
1. Blocks commits where `VERSION` is staged but manifest targets are not.
2. Warns when code/config files change without a `HISTORY.md` update.
3. Runs `check-version-sync.sh`.

### Adding New Files to Version Tracking

To track a new file:
1. Add an entry to `docs/version-sync-manifest.yml`.
2. Use the marker type that matches the file format:
   - docs: `<!-- doc-version: X.Y.Z -->` on line 1
   - package manifest: `"version": "X.Y.Z"`
3. Run `scripts/check-version-sync.sh` to verify.

## Update Process

1. Determine the impact level.
2. Run `scripts/bump-version.sh <new_version>`.
3. Fill in the `CHANGELOG.md` section created by the bump script.
4. Update `docs/llm/HANDOFF.md` with the new version context.
5. Append a `HISTORY.md` entry documenting the version rationale.
6. Run `scripts/check-version-sync.sh`.
7. If runtime code changed, run the relevant test suite and leave it green before commit.

## Testing Discipline

- Every new runtime case must add or update tests in the same session.
- Treat tests as part of the feature, not as follow-up cleanup.
- If behavior changes, update the existing assertions to reflect the intended contract.
- A code change is not complete until the relevant local tests pass.

## Environment Variables

- Never commit real Plaud credentials or bearer tokens.
- New environment variables must use the `PLAUD_MIRROR_` prefix unless they come from platform conventions such as `PORT`.
- If a new secret or runtime variable is introduced, document it in the relevant runbook and in `docs/llm/HISTORY.md`.

## Tips

- Auth, token, storage, and webhook changes are easy to under-version. Default upward if unsure.
- Keep versioning consistent between documentation, future runtime manifests, and deployment references.
- Baseline changes in `config/upstreams.tsv` should be treated as governance changes and documented even if they do not require a version bump.
