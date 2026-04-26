#!/bin/sh
# check-prose-drift.sh -- Layer-1 validation contract for prose drift.
#
# Catches the class of "doc says X, code does Y" bugs that has hit
# plaud-mirror six times across v0.5.x (see DECISIONS.md D-016 and
# auto-memory `feedback_prose_version_drift`). Designed per the
# Layer-1/Layer-2 architecture proposed in
# ~/src/LLM-DocKit/docs/HOOKS_ENFORCEMENT_PROPOSAL.md (RFC, draft, untracked).
#
# Usage:
#   scripts/check-prose-drift.sh                # strict mode (default), exit 1 on drift
#   scripts/check-prose-drift.sh --strict       # explicit strict
#   scripts/check-prose-drift.sh --review       # JSON output for an agent-based check
#   scripts/check-prose-drift.sh --update-baseline --note "<reason>"
#                                               # accept current matches into baseline
#   scripts/check-prose-drift.sh --quiet        # suppress PASS output
#
# Exit codes:
#   0 -- no drift detected (or all matches are baselined)
#   1 -- drift detected (in strict mode)
#   2 -- script error (bad arguments, missing files)
#
# This script is paliativo. It catches REGEX-detectable drift only.
# The full closure of the doc-drift problem requires a semantic check
# (Optional Enhancement B of HOOKS_ENFORCEMENT_PROPOSAL.md). The
# `--review` mode emits JSON-formatted findings as the on-ramp to that
# agent-based check.

set -e

# ── Defaults ──────────────────────────────────────────────────────────────────

MODE="strict"
QUIET=false
UPDATE_NOTE=""
TRANSIENT_UNTIL=""
EXTEND_ID=""

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASELINE_FILE="$PROJECT_ROOT/scripts/.prose-drift-baseline.json"
VERSION_FILE="$PROJECT_ROOT/VERSION"

# ── Parse arguments ──────────────────────────────────────────────────────────

while [ $# -gt 0 ]; do
    case "$1" in
        --strict)
            MODE="strict"
            shift
            ;;
        --review)
            MODE="review"
            shift
            ;;
        --update-baseline)
            MODE="update-baseline"
            shift
            ;;
        --extend-transient)
            EXTEND_ID="$2"
            shift 2
            ;;
        --transient-until)
            TRANSIENT_UNTIL="$2"
            shift 2
            ;;
        --note)
            UPDATE_NOTE="$2"
            shift 2
            ;;
        --quiet)
            QUIET=true
            shift
            ;;
        -h|--help)
            sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "ERROR: unknown argument: $1" >&2
            exit 2
            ;;
    esac
done

if [ ! -f "$VERSION_FILE" ]; then
    echo "ERROR: VERSION file not found at $VERSION_FILE" >&2
    exit 2
fi
CURRENT_VERSION=$(tr -d '[:space:]' < "$VERSION_FILE")

# ── Helpers ──────────────────────────────────────────────────────────────────

# Compare two semver strings. Echo: -1 if a<b, 0 if a==b, 1 if a>b.
# Limited to MAJOR.MINOR.PATCH (no prerelease).
semver_cmp() {
    _a="$1"
    _b="$2"
    if [ "$_a" = "$_b" ]; then echo 0; return; fi

    _a_major=$(printf '%s' "$_a" | cut -d. -f1)
    _a_minor=$(printf '%s' "$_a" | cut -d. -f2)
    _a_patch=$(printf '%s' "$_a" | cut -d. -f3)
    _b_major=$(printf '%s' "$_b" | cut -d. -f1)
    _b_minor=$(printf '%s' "$_b" | cut -d. -f2)
    _b_patch=$(printf '%s' "$_b" | cut -d. -f3)

    if [ "$_a_major" -lt "$_b_major" ]; then echo -1; return; fi
    if [ "$_a_major" -gt "$_b_major" ]; then echo 1; return; fi
    if [ "$_a_minor" -lt "$_b_minor" ]; then echo -1; return; fi
    if [ "$_a_minor" -gt "$_b_minor" ]; then echo 1; return; fi
    if [ "$_a_patch" -lt "$_b_patch" ]; then echo -1; return; fi
    if [ "$_a_patch" -gt "$_b_patch" ]; then echo 1; return; fi
    echo 0
}

# JSON-escape a string (backslashes, double quotes, newlines, tabs).
json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ' | sed 's/\t/ /g'
}

# Whether a finding is in the baseline. Args: literal, file. Echo: "yes" or "no".
in_baseline() {
    _literal="$1"
    _file="$2"
    if [ ! -f "$BASELINE_FILE" ]; then
        echo "no"
        return
    fi
    # Simple substring check on the JSON. Good enough for POSIX sh; the
    # baseline is small and entries are clearly delimited.
    _needle='"literal":"'$(json_escape "$_literal")'","file":"'$(json_escape "$_file")'"'
    if grep -q "$_needle" "$BASELINE_FILE" 2>/dev/null; then
        echo "yes"
    else
        echo "no"
    fi
}

# Get the transient_until field of a baselined entry. Args: literal, file.
# Echo the version string or empty.
baseline_transient_until() {
    _literal="$1"
    _file="$2"
    if [ ! -f "$BASELINE_FILE" ]; then return; fi
    _needle='"literal":"'$(json_escape "$_literal")'","file":"'$(json_escape "$_file")'"'
    grep -oE "$_needle[^}]*\"transient_until\":\"[^\"]*\"" "$BASELINE_FILE" 2>/dev/null \
        | head -1 \
        | sed 's/.*"transient_until":"\([^"]*\)".*/\1/'
}

# In POSIX sh, the right-hand side of a pipe runs in a subshell — any
# variable written there is invisible to the parent. The check rules
# below use `grep ... | while read`, so we collect findings into a
# temp file rather than a variable. Final output reads the file.
FINDINGS_FILE=$(mktemp -t prose-drift.XXXXXX 2>/dev/null || mktemp)
EXPIRED_FILE=$(mktemp -t prose-drift-expired.XXXXXX 2>/dev/null || mktemp)
trap 'rm -f "$FINDINGS_FILE" "$EXPIRED_FILE"' EXIT

# Add a finding to the temp file. Args: rule, file, line, literal, message.
add_finding() {
    _rule="$1"
    _file="$2"
    _line="$3"
    _literal="$4"
    _message="$5"

    _baselined=$(in_baseline "$_literal" "$_file")
    _status="active"
    if [ "$_baselined" = "yes" ]; then
        _transient=$(baseline_transient_until "$_literal" "$_file")
        if [ -n "$_transient" ]; then
            _cmp=$(semver_cmp "$CURRENT_VERSION" "$_transient")
            if [ "$_cmp" = "0" ] || [ "$_cmp" = "1" ]; then
                _status="expired"
                _message="$_message [baseline transient_until=$_transient expired at v$CURRENT_VERSION]"
                printf 'x\n' >> "$EXPIRED_FILE"
            else
                _status="baselined-transient"
            fi
        else
            _status="baselined-permanent"
        fi
    fi

    if [ "$_status" = "baselined-permanent" ] || [ "$_status" = "baselined-transient" ]; then
        # Suppressed by baseline (only included in --review mode).
        if [ "$MODE" != "review" ]; then
            return
        fi
    fi

    _esc_msg=$(json_escape "$_message")
    _esc_lit=$(json_escape "$_literal")
    _esc_file=$(json_escape "$_file")
    printf '{"rule":"%s","file":"%s","line":%s,"literal":"%s","status":"%s","message":"%s"}\n' \
        "$_rule" "$_esc_file" "$_line" "$_esc_lit" "$_status" "$_esc_msg" >> "$FINDINGS_FILE"
}

# ── Rules ────────────────────────────────────────────────────────────────────

# R1: stale vX.Y.Z literals in primary docs. Two distinct signals:
#   (a) "Current"-context literals (e.g. `Version:`, `Current delivery target:`,
#       `> Version:`) that don't match VERSION → FLAG (always wrong).
#   (b) Future-version literals (vX.Y.Z > current) that aren't in a
#       legitimate planning phrase (`next:`, `scheduled for`, `→`,
#       `(next: vX.Y.Z)`, `lands in`) → FLAG (forward-promise drift).
# Older versions (vX.Y.Z < current) are historical narrative by default
# and are NOT flagged; they are the bulk of legitimate prose. Excludes
# CHANGELOG/HISTORY (immutable narrative) and the doc-version markers.
rule_stale_versions() {
    _files="README.md LLM_START_HERE.md HOW_TO_USE.md"
    _files="$_files docs/PROJECT_CONTEXT.md docs/ROADMAP.md docs/ARCHITECTURE.md"
    _files="$_files docs/STRUCTURE.md docs/UPSTREAMS.md docs/VERSIONING_RULES.md"
    _files="$_files docs/operations/API_CONTRACT.md docs/operations/AUTH_AND_SYNC.md"
    _files="$_files docs/operations/DEPLOY_PLAYBOOK.md docs/operations/UPSTREAM_WATCH.md"
    _files="$_files docs/llm/DECISIONS.md docs/llm/HANDOFF.md"

    # Phrases that mark a line as a legitimate planning forward-reference.
    # If a future-version literal appears on a line containing any of these,
    # we don't flag it.
    _planning_phrases='next:|scheduled for|will land|lands in v|→ v|next slot|once the|in a future|from v|hardened to .* from v|rampa.* is v|baseline:|deferred to|still later in|coming in|planned for|arrives in|lands during'

    for _f in $_files; do
        _path="$PROJECT_ROOT/$_f"
        [ -f "$_path" ] || continue
        grep -nE 'v[0-9]+\.[0-9]+\.[0-9]+' "$_path" 2>/dev/null \
            | grep -vE 'doc-version:|<!-- doc-version' \
            | while IFS= read -r _row; do
                _line=$(printf '%s' "$_row" | cut -d: -f1)
                _content=$(printf '%s' "$_row" | cut -d: -f2-)
                printf '%s' "$_content" | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | sort -u | while IFS= read -r _ver; do
                    _ver_num=$(printf '%s' "$_ver" | sed 's/^v//')
                    _cmp=$(semver_cmp "$_ver_num" "$CURRENT_VERSION")
                    if [ "$_cmp" = "0" ]; then continue; fi  # current → ok

                    # (a) "Current"-context line: if the line contains a
                    # version assertion phrase ("Version:", "Current delivery
                    # target:", "> Version "), the literal must match current.
                    if printf '%s' "$_content" | grep -qE '^[[:space:]]*(>?[[:space:]]*Version:|- Current delivery target:|"version":)' ; then
                        add_finding "R1-current-state-stale-version" "$_f" "$_line" "$_ver" \
                            "Current-state line cites $_ver but VERSION is $CURRENT_VERSION (this asserts the current version, must match)"
                        continue
                    fi

                    # (b) Future-version drift: literal > current and the
                    # line is not in a legitimate planning phrase.
                    if [ "$_cmp" = "1" ]; then
                        if printf '%s' "$_content" | grep -qiE "$_planning_phrases"; then
                            continue
                        fi
                        add_finding "R1-future-version-without-planning-phrase" "$_f" "$_line" "$_ver" \
                            "Future $_ver mentioned without a planning phrase (next:/scheduled for/lands in/→); is this a forward-promise drift?"
                        continue
                    fi

                    # (c) Older versions are legitimate historical narrative
                    # by default. Not flagged.
                done
            done
    done
}

# R2: phase string literals in docs must match what service.ts emits.
# Extract canonical strings from service.ts; flag any other "Phase N - ..."
# in docs.
rule_phase_strings() {
    _src="$PROJECT_ROOT/apps/api/src/runtime/service.ts"
    [ -f "$_src" ] || return 0

    # Collect canonical literals (one per line) into a temp set.
    _canonical=$(grep -oE '"Phase [0-9] - [^"]+"' "$_src" 2>/dev/null | sort -u)
    [ -n "$_canonical" ] || return 0

    _doc_globs="README.md LLM_START_HERE.md HOW_TO_USE.md"
    _doc_globs="$_doc_globs docs/PROJECT_CONTEXT.md docs/ROADMAP.md docs/ARCHITECTURE.md"
    _doc_globs="$_doc_globs docs/operations/API_CONTRACT.md docs/operations/AUTH_AND_SYNC.md"
    _doc_globs="$_doc_globs docs/operations/DEPLOY_PLAYBOOK.md docs/operations/UPSTREAM_WATCH.md"
    _doc_globs="$_doc_globs docs/llm/DECISIONS.md docs/llm/HANDOFF.md"

    for _f in $_doc_globs; do
        _path="$PROJECT_ROOT/$_f"
        [ -f "$_path" ] || continue
        grep -nE '"Phase [0-9] - [^"]+"' "$_path" 2>/dev/null | while IFS= read -r _row; do
            _line=$(printf '%s' "$_row" | cut -d: -f1)
            _content=$(printf '%s' "$_row" | cut -d: -f2-)
            printf '%s' "$_content" | grep -oE '"Phase [0-9] - [^"]+"' | sort -u | while IFS= read -r _str; do
                if printf '%s\n' "$_canonical" | grep -qF "$_str"; then continue; fi
                add_finding "R2-phase-string-mismatch" "$_f" "$_line" "$_str" \
                    "Phase literal $_str not found in service.ts. Canonical strings: $(printf '%s' "$_canonical" | tr '\n' ' ')"
            done
        done
    done
}

# R3: future-work phrases ("still later", "lands during", "arrives in",
# etc.) followed by a version literal that is <= current. The check
# extracts the version that is **immediately adjacent** to the phrase
# (within ~30 chars after), not any version mentioned anywhere on the
# line — otherwise long preamble paragraphs that mention many versions
# in different contexts produce noise. Caught: "X is deferred to vY.Y.Y"
# where Y <= current. Not caught (intentionally): "X (shipped in vA.A.A)
# is later replaced by Y deferred to vB.B.B" — the "shipped in vA.A.A"
# part is historical narrative.
rule_future_claims() {
    _doc_globs="docs/operations/API_CONTRACT.md docs/operations/AUTH_AND_SYNC.md"
    _doc_globs="$_doc_globs docs/operations/DEPLOY_PLAYBOOK.md docs/operations/UPSTREAM_WATCH.md"
    _doc_globs="$_doc_globs docs/llm/DECISIONS.md"

    # Phrases that imply "this is future-work". Each should be specific
    # enough that the version literal that follows is the one being
    # claimed as future. Keep this list narrow.
    _phrases='still later in|arrives in|lands during|deferred to|will land in|implementation lands|coming in|planned for'

    for _f in $_doc_globs; do
        _path="$PROJECT_ROOT/$_f"
        [ -f "$_path" ] || continue
        grep -niE "($_phrases)" "$_path" 2>/dev/null | while IFS= read -r _row; do
            _line=$(printf '%s' "$_row" | cut -d: -f1)
            _content=$(printf '%s' "$_row" | cut -d: -f2-)
            # Extract every "<phrase> ... vX.Y.Z" substring (max ~40 chars
            # between phrase and version) and pull the version. This avoids
            # flagging unrelated versions later in the same line.
            _adjacent=$(printf '%s' "$_content" \
                | grep -oiE "($_phrases)[^.]{0,40}\\\`?v[0-9]+\\.[0-9]+\\.[0-9]+\\\`?" \
                | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' \
                | sort -u)
            [ -n "$_adjacent" ] || continue
            for _ver in $_adjacent; do
                _ver_num=$(printf '%s' "$_ver" | sed 's/^v//')
                _cmp=$(semver_cmp "$_ver_num" "$CURRENT_VERSION")
                if [ "$_cmp" = "-1" ] || [ "$_cmp" = "0" ]; then
                    _excerpt=$(printf '%s' "$_content" | head -c 120 | sed 's/[[:space:]]*$//')
                    add_finding "R3-future-claim-already-shipped" "$_f" "$_line" "$_ver" \
                        "Line claims $_ver is future-work but VERSION is $CURRENT_VERSION: $_excerpt"
                fi
            done
        done
    done
}

# R4: every D-XXX with a CHANGELOG "implemented in vX.Y.Z" mention must
# have its DECISIONS.md Status reflect the implementation (not still
# "designed" / "lands during Phase N").
rule_decision_status_consistency() {
    _changelog="$PROJECT_ROOT/CHANGELOG.md"
    _decisions="$PROJECT_ROOT/docs/llm/DECISIONS.md"
    [ -f "$_changelog" ] || return 0
    [ -f "$_decisions" ] || return 0

    # Find D-XXX references in CHANGELOG that say "implemented" or
    # "shipped in" + "v0.X.Y". Best-effort: pull every D-XXX in CHANGELOG.
    _shipped_decisions=$(grep -oE 'D-[0-9]{3}' "$_changelog" 2>/dev/null | sort -u)
    [ -n "$_shipped_decisions" ] || return 0

    for _d in $_shipped_decisions; do
        # Locate the heading and the Status line in DECISIONS.md.
        _heading_line=$(grep -nE "^## $_d " "$_decisions" 2>/dev/null | head -1 | cut -d: -f1)
        [ -n "$_heading_line" ] || continue
        # Status line is typically within ~5 lines after the heading.
        _status_block=$(sed -n "${_heading_line},$((_heading_line + 5))p" "$_decisions" 2>/dev/null)
        _status_text=$(printf '%s' "$_status_block" | grep -i 'Status:' | head -1)
        # If the status still says "designed" / "lands during" / "draft" only — flag.
        if printf '%s' "$_status_text" | grep -qiE '(designed|lands during|will land|implementation lands)'; then
            if ! printf '%s' "$_status_text" | grep -qiE '(implemented|shipped)'; then
                add_finding "R4-decision-status-stale" "docs/llm/DECISIONS.md" "$_heading_line" "$_d" \
                    "Status still reads as designed/lands-during but CHANGELOG mentions $_d as shipped: $_status_text"
            fi
        fi
    done
}

# ── Run ──────────────────────────────────────────────────────────────────────

rule_stale_versions
rule_phase_strings
rule_future_claims
rule_decision_status_consistency

# ── Update-baseline mode ─────────────────────────────────────────────────────

# Count findings (one JSON object per line) and expired baseline matches.
FINDING_COUNT=$(wc -l < "$FINDINGS_FILE" 2>/dev/null | tr -d ' ' || echo 0)
EXPIRED_COUNT=$(wc -l < "$EXPIRED_FILE" 2>/dev/null | tr -d ' ' || echo 0)

# Concatenate findings into a single comma-separated JSON array body.
FINDINGS=$(tr '\n' ',' < "$FINDINGS_FILE" | sed 's/,$//')

if [ "$MODE" = "update-baseline" ]; then
    if [ -z "$UPDATE_NOTE" ]; then
        echo "ERROR: --update-baseline requires --note \"<reason>\"" >&2
        exit 2
    fi
    _commit_sha=$(cd "$PROJECT_ROOT" && git rev-parse --short=12 HEAD 2>/dev/null || echo "unknown")
    _now=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date +%Y-%m-%dT%H:%M:%SZ)
    _entries=""
    _i=0
    while IFS= read -r _line_json; do
        [ -z "$_line_json" ] && continue
        _i=$((_i + 1))
        _file=$(printf '%s' "$_line_json" | sed 's/.*"file":"\([^"]*\)".*/\1/')
        _literal=$(printf '%s' "$_line_json" | sed 's/.*"literal":"\([^"]*\)".*/\1/')
        _rule=$(printf '%s' "$_line_json" | sed 's/.*"rule":"\([^"]*\)".*/\1/')
        if [ -n "$_entries" ]; then _entries="$_entries,"; fi
        _entry="{\"id\":\"$_commit_sha-$_i\",\"literal\":\"$_literal\",\"file\":\"$_file\",\"rule\":\"$_rule\",\"reason\":\"$(json_escape "$UPDATE_NOTE")\",\"commit_sha\":\"$_commit_sha\",\"created_at\":\"$_now\""
        if [ -n "$TRANSIENT_UNTIL" ]; then
            _entry="$_entry,\"transient_until\":\"$TRANSIENT_UNTIL\""
        fi
        _entry="$_entry}"
        _entries="$_entries$_entry"
    done < "$FINDINGS_FILE"
    printf '{"version":"%s","updated_at":"%s","entries":[%s]}\n' "$CURRENT_VERSION" "$_now" "$_entries" > "$BASELINE_FILE"
    echo "Baseline updated: $BASELINE_FILE ($_i entries)"
    exit 0
fi

# ── Output ───────────────────────────────────────────────────────────────────

if [ "$MODE" = "review" ]; then
    _now=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date +%Y-%m-%dT%H:%M:%SZ)
    printf '{"timestamp":"%s","version":"%s","findings_count":%d,"expired_baseline_count":%d,"findings":[%s]}\n' \
        "$_now" "$CURRENT_VERSION" "$FINDING_COUNT" "$EXPIRED_COUNT" "$FINDINGS"
    exit 0
fi

# Strict mode (default).
if [ "$FINDING_COUNT" -eq 0 ] && [ "$EXPIRED_COUNT" -eq 0 ]; then
    if [ "$QUIET" != true ]; then
        echo "prose-drift: PASS (no drift detected, version=$CURRENT_VERSION)"
    fi
    exit 0
fi

echo "prose-drift: FAIL ($FINDING_COUNT finding(s), $EXPIRED_COUNT expired baseline entry/entries)"
while IFS= read -r _entry; do
    [ -z "$_entry" ] && continue
    _rule=$(printf '%s' "$_entry" | sed 's/.*"rule":"\([^"]*\)".*/\1/')
    _file=$(printf '%s' "$_entry" | sed 's/.*"file":"\([^"]*\)".*/\1/')
    _line=$(printf '%s' "$_entry" | sed 's/.*"line":\([0-9]*\).*/\1/')
    _msg=$(printf '%s' "$_entry" | sed 's/.*"message":"\([^"]*\)".*/\1/')
    printf '  [%s] %s:%s\n    %s\n' "$_rule" "$_file" "$_line" "$_msg"
done < "$FINDINGS_FILE"
echo ""
echo "Remediation:"
echo "  - Edit the file(s) above to remove the drift, or"
echo "  - Run scripts/check-prose-drift.sh --update-baseline --note \"<why this is acceptable>\""
echo "    (use --transient-until vX.Y.Z to mark the entry as expected to disappear by that version)"
exit 1
