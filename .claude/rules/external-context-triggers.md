---
globs:
  - "docs/PROJECT_CONTEXT.md"
  - "docs/ARCHITECTURE.md"
  - "docs/operations/AUTH_AND_SYNC.md"
  - "docs/operations/DEPLOY_PLAYBOOK.md"
---
When modifying these files, check .dockit-config.yml external_context.update_triggers
for external docs that may need updating.
Run: scripts/dockit-validate-session.sh --check external-triggers --human
