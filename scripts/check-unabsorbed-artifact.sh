#!/bin/sh
# check-unabsorbed-artifact.sh — Layer-1 detector for local artifacts (scripts,
# rules) that exist in this downstream but not in the LLM-DocKit upstream
# template. Generates signal for downstream-feedback (DF) candidates so the
# operator can choose to (a) propagate upstream, or (b) baseline as
# project-specific.
#
# Designed per the symmetric companion proposal from the ForgeOS-context
# Claude session (cross-session audit on 2026-04-27): plaud-mirror builds
# this Layer-1 detector; ForgeOS builds `forge audit` as the cross-repo
# automation. Together they replace the manual cross-audit work that today
# only catches deltas during human review rounds.
#
# Usage:
#   scripts/check-unabsorbed-artifact.sh                  # default, exit 1 on findings
#   scripts/check-unabsorbed-artifact.sh --quiet          # suppress PASS output
#   scripts/check-unabsorbed-artifact.sh --update-baseline --path PATH --reason "R" [--permanent] [--df DF-NNN]
#
# Exit codes:
#   0 — no unbaselined unabsorbed artifacts
#   1 — unbaselined unabsorbed artifacts present
#   2 — script error (bad arguments, missing upstream)

set -e

# ── Defaults ──────────────────────────────────────────────────────────────────

# POSIX sh has no $'\t' ANSI-C quoting — produce a literal tab via printf.
TAB=$(printf '\t')

MODE="check"
QUIET=false
ADD_PATH=""
ADD_REASON=""
ADD_PERMANENT=false
ADD_DF=""

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UPSTREAM_PATH="${LLM_DOCKIT_PATH:-$HOME/src/LLM-DocKit}"
BASELINE_FILE="$PROJECT_ROOT/scripts/.unabsorbed-artifact-baseline.json"

# Directories to scan. Each entry must exist in both downstream and upstream
# layouts; we compare filename presence only, not content. Filename match
# means "the upstream template has a file by this name", which is the
# operator's signal that absorption already happened (regardless of content
# divergence — that is a different drift class).
SCAN_DIRS="scripts .claude/rules"

# Filenames in the scan dirs to skip (the script itself, the baseline, dotfiles
# that are configuration not artifacts).
SKIP_PATTERNS="check-unabsorbed-artifact.sh|^\\..*\\.json$|^\\.unabsorbed-artifact-baseline\\.json$"

# ── Parse arguments ───────────────────────────────────────────────────────────

while [ $# -gt 0 ]; do
    case "$1" in
        --quiet)
            QUIET=true
            shift
            ;;
        --update-baseline)
            MODE="update-baseline"
            shift
            ;;
        --path)
            ADD_PATH="$2"
            shift 2
            ;;
        --reason)
            ADD_REASON="$2"
            shift 2
            ;;
        --permanent)
            ADD_PERMANENT=true
            shift
            ;;
        --df)
            ADD_DF="$2"
            shift 2
            ;;
        --help|-h)
            sed -n '2,22p' "$0"
            exit 0
            ;;
        *)
            printf "unknown argument: %s\n" "$1" >&2
            exit 2
            ;;
    esac
done

# ── Preconditions ─────────────────────────────────────────────────────────────

if [ ! -d "$UPSTREAM_PATH" ]; then
    printf 'check-unabsorbed-artifact: upstream path not found: %s\n' "$UPSTREAM_PATH" >&2
    printf '  set LLM_DOCKIT_PATH env var to override (default: $HOME/src/LLM-DocKit)\n' >&2
    exit 2
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

# Whether a path is in the baseline. Arg: relative path. Echo: "yes" or "no".
in_baseline() {
    _path="$1"
    if [ ! -f "$BASELINE_FILE" ]; then
        echo "no"
        return
    fi
    _needle="\"path\":\"$_path\""
    if grep -q "$_needle" "$BASELINE_FILE" 2>/dev/null; then
        echo "yes"
    else
        echo "no"
    fi
}

# Get the reason field of a baselined entry. Arg: relative path.
baseline_reason() {
    _path="$1"
    if [ ! -f "$BASELINE_FILE" ]; then return; fi
    _needle="\"path\":\"$_path\""
    grep -oE "$_needle[^}]*\"reason\":\"[^\"]*\"" "$BASELINE_FILE" 2>/dev/null \
        | head -1 \
        | sed -E 's/.*"reason":"([^"]*)".*/\1/'
}

# Whether the baselined entry is permanent. Arg: relative path. Echo: "yes" or "no".
baseline_permanent() {
    _path="$1"
    if [ ! -f "$BASELINE_FILE" ]; then echo "no"; return; fi
    _needle="\"path\":\"$_path\""
    _block=$(grep -oE "$_needle[^}]*" "$BASELINE_FILE" 2>/dev/null | head -1)
    if printf '%s' "$_block" | grep -q '"permanent":true'; then
        echo "yes"
    else
        echo "no"
    fi
}

# ── Scan ──────────────────────────────────────────────────────────────────────

FINDINGS_FILE=$(mktemp)
trap 'rm -f "$FINDINGS_FILE"' EXIT

scan() {
    for _dir in $SCAN_DIRS; do
        _local_dir="$PROJECT_ROOT/$_dir"
        _upstream_dir="$UPSTREAM_PATH/$_dir"
        [ -d "$_local_dir" ] || continue

        # List files (one level, no recursion). Skip patterns matched against basename.
        for _file in "$_local_dir"/*; do
            [ -f "$_file" ] || continue
            _name=$(basename "$_file")
            if printf '%s' "$_name" | grep -qE "$SKIP_PATTERNS"; then
                continue
            fi

            _rel="$_dir/$_name"

            # If upstream has a file by the same name in the same dir, considered absorbed.
            if [ -f "$_upstream_dir/$_name" ]; then
                continue
            fi

            # Unabsorbed. Check baseline.
            _baselined=$(in_baseline "$_rel")
            if [ "$_baselined" = "yes" ]; then
                _perm=$(baseline_permanent "$_rel")
                _reason=$(baseline_reason "$_rel")
                if [ "$_perm" = "yes" ]; then
                    printf '%s\tBASELINED-PERMANENT\t%s\n' "$_rel" "$_reason" >> "$FINDINGS_FILE"
                else
                    printf '%s\tBASELINED-TRANSIENT\t%s\n' "$_rel" "$_reason" >> "$FINDINGS_FILE"
                fi
                continue
            fi

            printf '%s\tUNABSORBED\t\n' "$_rel" >> "$FINDINGS_FILE"
        done
    done
}

# ── Update-baseline mode ──────────────────────────────────────────────────────

update_baseline() {
    if [ -z "$ADD_PATH" ] || [ -z "$ADD_REASON" ]; then
        printf 'update-baseline requires --path PATH --reason "REASON"\n' >&2
        printf '  optional: --permanent, --df DF-NNN\n' >&2
        exit 2
    fi

    if [ ! -f "$PROJECT_ROOT/$ADD_PATH" ]; then
        printf 'update-baseline: path does not exist locally: %s\n' "$ADD_PATH" >&2
        exit 2
    fi

    _now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    _sha=$(cd "$PROJECT_ROOT" && git rev-parse --short=12 HEAD 2>/dev/null || echo "unknown")
    _id="${_sha}-$(date +%s)-$$"
    _perm_field=$([ "$ADD_PERMANENT" = "true" ] && echo "true" || echo "false")

    # Use python3 to construct + merge JSON safely. Sed-based templating breaks
    # on any `/` in path or reason (and on `&` in replacement text). The
    # baseline file is small; a structural read-modify-write is cleaner and
    # already the established pattern (see ~/.claude/hooks/check-passive-rule.sh).
    BASELINE_FILE="$BASELINE_FILE" \
    NOW="$_now" \
    ID="$_id" \
    ADD_PATH="$ADD_PATH" \
    PERM="$_perm_field" \
    REASON="$ADD_REASON" \
    DF="$ADD_DF" \
    python3 - <<'PYEOF'
import json, os, sys

path = os.environ['BASELINE_FILE']
now = os.environ['NOW']
entry = {
    "id": os.environ['ID'],
    "path": os.environ['ADD_PATH'],
    "permanent": os.environ['PERM'] == 'true',
    "reason": os.environ['REASON'],
    "created_at": now,
}
df = os.environ.get('DF') or ''
if df:
    entry["df_id"] = df

if os.path.exists(path):
    with open(path) as f:
        data = json.load(f)
    data['updated_at'] = now
    data.setdefault('entries', []).append(entry)
else:
    data = {
        "version": "0.5.5",
        "updated_at": now,
        "entries": [entry],
    }

with open(path, 'w') as f:
    json.dump(data, f, separators=(',', ':'))
    f.write('\n')
PYEOF

    printf 'baselined: %s\n' "$ADD_PATH"
    printf '  reason: %s\n' "$ADD_REASON"
    printf '  permanent: %s\n' "$_perm_field"
    [ -n "$ADD_DF" ] && printf '  df_id: %s\n' "$ADD_DF"
    exit 0
}

# ── Main ──────────────────────────────────────────────────────────────────────

if [ "$MODE" = "update-baseline" ]; then
    update_baseline
fi

scan

# Categorize findings. Use wc -l (not grep -c) because grep -c returns "0"
# AND exits nonzero when there are no matches, which combined with `|| echo 0`
# would concatenate two zeros into a multi-line value.
_unabsorbed=$(grep "${TAB}UNABSORBED${TAB}" "$FINDINGS_FILE" 2>/dev/null | wc -l | tr -d ' ')
_baselined_perm=$(grep "${TAB}BASELINED-PERMANENT${TAB}" "$FINDINGS_FILE" 2>/dev/null | wc -l | tr -d ' ')
_baselined_trans=$(grep "${TAB}BASELINED-TRANSIENT${TAB}" "$FINDINGS_FILE" 2>/dev/null | wc -l | tr -d ' ')

if [ "$_unabsorbed" = "0" ]; then
    if [ "$QUIET" != "true" ]; then
        printf 'unabsorbed-artifact: PASS (0 unbaselined; %s baselined-permanent; %s baselined-transient)\n' \
            "$_baselined_perm" "$_baselined_trans"
    fi
    exit 0
fi

# Findings to report.
printf 'unabsorbed-artifact: %s unabsorbed local artifact(s) not present in LLM-DocKit upstream (%s)\n' \
    "$_unabsorbed" "$UPSTREAM_PATH"
grep "${TAB}UNABSORBED${TAB}" "$FINDINGS_FILE" | while IFS= read -r _row; do
    _path=$(printf '%s' "$_row" | cut -f1)
    printf '  [UNABSORBED] %s\n' "$_path"
done

printf '\nRemediation:\n'
printf '  - Open a downstream-feedback (DF) entry in ~/src/LLM-DocKit/docs/DOWNSTREAM_FEEDBACK.md\n'
printf '    proposing the artifact for upstream absorption, or\n'
printf '  - Run scripts/check-unabsorbed-artifact.sh --update-baseline --path PATH --reason "<why>"\n'
printf '    Add --permanent if project-specific (never to be absorbed); add --df DF-NNN if\n'
printf '    a candidate DF is in flight upstream.\n'

exit 1
