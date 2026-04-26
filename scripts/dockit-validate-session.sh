#!/bin/sh
# dockit-validate-session.sh -- Validate LLM documentation state.
#
# Portable POSIX sh. Zero external dependencies.
# Designed as the single entry point for all enforcement drivers
# (Claude Code hooks, pre-commit, CI, manual).
#
# Exit codes:
#   0 -- all checks pass
#   1 -- at least one ERROR check failed
#   2 -- script error (bad arguments, missing files)
#
# Usage:
#   scripts/dockit-validate-session.sh                    # JSON output (default)
#   scripts/dockit-validate-session.sh --human            # plain text output
#   scripts/dockit-validate-session.sh --check handoff-date --check history-entry
#   scripts/dockit-validate-session.sh --quiet            # suppress PASS output
#   scripts/dockit-validate-session.sh --project /path    # custom project root

set -e

# ── Defaults ──────────────────────────────────────────────────────────────────

PROJECT_ROOT=""
OUTPUT_MODE="json"
QUIET=false
SELECTED_CHECKS=""
TODAY=$(date +%Y-%m-%d)

# ── Parse arguments ──────────────────────────────────────────────────────────

while [ $# -gt 0 ]; do
    case "$1" in
        --human)
            OUTPUT_MODE="human"
            shift
            ;;
        --json)
            OUTPUT_MODE="json"
            shift
            ;;
        --quiet)
            QUIET=true
            shift
            ;;
        --check)
            if [ -z "$2" ]; then
                echo "ERROR: --check requires a value" >&2
                exit 2
            fi
            SELECTED_CHECKS="$SELECTED_CHECKS $2"
            shift 2
            ;;
        --project)
            if [ -z "$2" ]; then
                echo "ERROR: --project requires a path" >&2
                exit 2
            fi
            PROJECT_ROOT="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [--human|--json] [--quiet] [--check NAME]... [--project PATH]"
            echo ""
            echo "Checks: handoff-date, history-entry, decisions-referenced, version-sync, external-context, external-triggers, handoff-start-here-sync"
            echo ""
            echo "Exit codes: 0=pass, 1=fail, 2=script error"
            exit 0
            ;;
        *)
            echo "ERROR: unknown argument: $1" >&2
            exit 2
            ;;
    esac
done

# ── Resolve project root ────────────────────────────────────────────────────

if [ -z "$PROJECT_ROOT" ]; then
    # Try git root first, then fall back to script location
    PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
    if [ -z "$PROJECT_ROOT" ]; then
        SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
        PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
    fi
fi

if [ ! -d "$PROJECT_ROOT" ]; then
    echo "ERROR: project root not found: $PROJECT_ROOT" >&2
    exit 2
fi

# ── File paths ───────────────────────────────────────────────────────────────

HANDOFF="$PROJECT_ROOT/docs/llm/HANDOFF.md"
HISTORY="$PROJECT_ROOT/docs/llm/HISTORY.md"
DECISIONS="$PROJECT_ROOT/docs/llm/DECISIONS.md"
START_HERE="$PROJECT_ROOT/LLM_START_HERE.md"
CHECK_VERSION_SCRIPT="$PROJECT_ROOT/scripts/check-version-sync.sh"
CONFIG_FILE="$PROJECT_ROOT/.dockit-config.yml"

# ── Results accumulator ─────────────────────────────────────────────────────

RESULTS=""
ERRORS=0
WARNINGS=0
CHECKS_RUN=0

add_result() {
    _name="$1"
    _status="$2"
    _message="$3"

    CHECKS_RUN=$((CHECKS_RUN + 1))

    if [ "$_status" = "FAIL" ]; then
        ERRORS=$((ERRORS + 1))
    elif [ "$_status" = "WARN" ]; then
        WARNINGS=$((WARNINGS + 1))
    fi

    # In quiet mode, suppress PASS results from output
    if [ "$QUIET" = true ] && [ "$_status" = "PASS" ]; then
        return
    fi

    if [ -n "$RESULTS" ]; then
        RESULTS="$RESULTS,"
    fi
    # Escape for valid JSON: backslashes, double quotes, newlines, tabs
    _escaped_msg=$(printf '%s' "$_message" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ' | sed 's/\t/ /g')
    RESULTS="$RESULTS{\"name\":\"$_name\",\"status\":\"$_status\",\"message\":\"$_escaped_msg\"}"
}

# ── Check: should this check run? ───────────────────────────────────────────

should_run() {
    _check_name="$1"
    if [ -z "$SELECTED_CHECKS" ]; then
        return 0  # no filter = run all
    fi
    case "$SELECTED_CHECKS" in
        *"$_check_name"*) return 0 ;;
        *) return 1 ;;
    esac
}

# ── Check functions ─────────────────────────────────────────────────────────

check_handoff_date() {
    if ! should_run "handoff-date"; then return; fi

    if [ ! -f "$HANDOFF" ]; then
        add_result "handoff-date" "FAIL" "HANDOFF.md not found at $HANDOFF"
        return
    fi

    # Look for "Last Updated: YYYY-MM-DD" pattern
    handoff_date=$(grep -E '^\s*-?\s*Last Updated:' "$HANDOFF" 2>/dev/null | head -1 | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1 || true)

    if [ -z "$handoff_date" ]; then
        add_result "handoff-date" "FAIL" "No 'Last Updated' date found in HANDOFF.md"
    elif [ "$handoff_date" != "$TODAY" ]; then
        add_result "handoff-date" "FAIL" "Last Updated is $handoff_date, expected $TODAY"
    else
        add_result "handoff-date" "PASS" "HANDOFF.md has today's date ($TODAY)"
    fi
}

check_history_entry() {
    if ! should_run "history-entry"; then return; fi

    if [ ! -f "$HISTORY" ]; then
        add_result "history-entry" "FAIL" "HISTORY.md not found at $HISTORY"
        return
    fi

    # Look for today's date anywhere in the history entries (not in header/format lines)
    if grep -q "^- $TODAY" "$HISTORY" 2>/dev/null; then
        add_result "history-entry" "PASS" "HISTORY.md has entry for $TODAY"
    else
        add_result "history-entry" "FAIL" "No HISTORY.md entry for $TODAY"
    fi
}

check_decisions_referenced() {
    if ! should_run "decisions-referenced"; then return; fi

    if [ ! -f "$HANDOFF" ]; then
        add_result "decisions-referenced" "FAIL" "HANDOFF.md not found"
        return
    fi
    if [ ! -f "$DECISIONS" ]; then
        add_result "decisions-referenced" "FAIL" "DECISIONS.md not found"
        return
    fi

    # Extract D-xxx references from HANDOFF
    handoff_refs=$(grep -oE 'D-[0-9]{3}' "$HANDOFF" 2>/dev/null | sort -u || true)

    if [ -z "$handoff_refs" ]; then
        add_result "decisions-referenced" "PASS" "No D-xxx references in HANDOFF.md"
        return
    fi

    missing=""
    for ref in $handoff_refs; do
        if ! grep -q "^## $ref" "$DECISIONS" 2>/dev/null; then
            missing="$missing $ref"
        fi
    done

    if [ -n "$missing" ]; then
        add_result "decisions-referenced" "FAIL" "HANDOFF references D-xxx IDs not in DECISIONS.md:$missing"
    else
        count=$(echo "$handoff_refs" | wc -w | tr -d ' ')
        add_result "decisions-referenced" "PASS" "All $count D-xxx references found in DECISIONS.md"
    fi
}

check_handoff_start_here_sync() {
    if ! should_run "handoff-start-here-sync"; then return; fi

    # Both files optional in generic DocKit consumers -> skip if missing.
    if [ ! -f "$HANDOFF" ] || [ ! -f "$START_HERE" ]; then
        add_result "handoff-start-here-sync" "PASS" "Skipped (HANDOFF or LLM_START_HERE not present)"
        return
    fi

    ho_line=$(grep -E '^\s*-?\s*Last Updated:' "$HANDOFF" 2>/dev/null | head -1 || true)
    sh_line=$(grep -E '^\s*-?\s*Last Updated:' "$START_HERE" 2>/dev/null | head -1 || true)

    # If either side has no Last Updated, skip (project may not use this pattern).
    if [ -z "$ho_line" ] || [ -z "$sh_line" ]; then
        add_result "handoff-start-here-sync" "PASS" "Skipped (no 'Last Updated' pattern in one of the files)"
        return
    fi

    # Normalize: strip everything up to and including first colon, then trim.
    ho_val=$(echo "$ho_line" | sed 's/^[^:]*://' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    sh_val=$(echo "$sh_line" | sed 's/^[^:]*://' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    if [ "$ho_val" = "$sh_val" ]; then
        add_result "handoff-start-here-sync" "PASS" "LLM_START_HERE 'Current Focus' Last Updated matches HANDOFF: $ho_val"
    else
        add_result "handoff-start-here-sync" "FAIL" "Last Updated mismatch — HANDOFF: '$ho_val' vs LLM_START_HERE: '$sh_val'. Update LLM_START_HERE.md 'Current Focus (Snapshot)' to match HANDOFF 'Current Status'."
    fi
}

check_version_sync() {
    if ! should_run "version-sync"; then return; fi

    if [ ! -f "$CHECK_VERSION_SCRIPT" ]; then
        add_result "version-sync" "FAIL" "check-version-sync.sh not found"
        return
    fi

    # Run from PROJECT_ROOT so relative paths in check-version-sync.sh work
    sync_output=$(cd "$PROJECT_ROOT" && "$CHECK_VERSION_SCRIPT" 2>&1) && sync_rc=0 || sync_rc=$?

    if [ "$sync_rc" -eq 0 ]; then
        add_result "version-sync" "PASS" "$sync_output"
    else
        add_result "version-sync" "FAIL" "$sync_output"
    fi
}

# ── External context parser helpers ──────────────────────────────────────────
# State-machine parser for .dockit-config.yml external_context section.
# Each helper reads CONFIG_FILE independently (simple, no shared state needed).

_read_ext_path() {
    [ -f "$CONFIG_FILE" ] || return
    _in=false
    while IFS= read -r _line || [ -n "$_line" ]; do
        case "$_line" in ""|\#*) continue ;; esac
        _s=$(echo "$_line" | sed 's/^ *//')
        _i=$(( ${#_line} - ${#_s} ))
        if [ "$_i" -eq 0 ]; then
            [ "$_s" = "external_context:" ] && _in=true || _in=false
            continue
        fi
        if [ "$_in" = true ] && [ "$_i" -eq 2 ]; then
            case "$_s" in path:*) echo "$_s" | sed 's/^path: *//' ;; esac
        fi
    done < "$CONFIG_FILE"
}

_read_ext_read_files() {
    [ -f "$CONFIG_FILE" ] || return
    _in=false; _in_read=false
    while IFS= read -r _line || [ -n "$_line" ]; do
        case "$_line" in ""|\#*) continue ;; esac
        _s=$(echo "$_line" | sed 's/^ *//')
        _i=$(( ${#_line} - ${#_s} ))
        if [ "$_i" -eq 0 ]; then
            [ "$_s" = "external_context:" ] && { _in=true; _in_read=false; } || { _in=false; _in_read=false; }
            continue
        fi
        [ "$_in" = false ] && continue
        if [ "$_i" -eq 2 ]; then
            [ "$_s" = "read:" ] && _in_read=true || _in_read=false
            continue
        fi
        if [ "$_i" -eq 4 ] && [ "$_in_read" = true ]; then
            echo "$_s" | sed 's/^- *//'
        fi
    done < "$CONFIG_FILE"
}

_read_ext_triggers() {
    [ -f "$CONFIG_FILE" ] || return
    _in=false; _in_trig=false
    while IFS= read -r _line || [ -n "$_line" ]; do
        case "$_line" in ""|\#*) continue ;; esac
        _s=$(echo "$_line" | sed 's/^ *//')
        _i=$(( ${#_line} - ${#_s} ))
        if [ "$_i" -eq 0 ]; then
            [ "$_s" = "external_context:" ] && { _in=true; _in_trig=false; } || { _in=false; _in_trig=false; }
            continue
        fi
        [ "$_in" = false ] && continue
        if [ "$_i" -eq 2 ]; then
            [ "$_s" = "update_triggers:" ] && _in_trig=true || _in_trig=false
            continue
        fi
        if [ "$_i" -eq 4 ] && [ "$_in_trig" = true ]; then
            _t=$(echo "$_s" | sed 's/^- *//')
            _local=$(echo "$_t" | sed 's/^local: *//; s/ *target:.*$//')
            _target=$(echo "$_t" | sed 's/.*target: *//')
            echo "$_local|$_target"
        fi
    done < "$CONFIG_FILE"
}

check_external_context() {
    if ! should_run "external-context"; then return; fi

    # CI portability: skip if env var set
    if [ "${DOCKIT_SKIP_EXTERNAL:-0}" = "1" ]; then
        add_result "external-context" "PASS" "Skipped (DOCKIT_SKIP_EXTERNAL=1)"
        return
    fi

    # No config file -> explicit skip (opt-in feature)
    if [ ! -f "$CONFIG_FILE" ]; then
        add_result "external-context" "PASS" "Skipped (no .dockit-config.yml)"
        return
    fi

    # Read path from config
    _ext_path=$(_read_ext_path)

    # No external_context section -> explicit skip
    if [ -z "$_ext_path" ]; then
        add_result "external-context" "PASS" "Skipped (no external_context in config)"
        return
    fi

    # Normalize path (~ expansion, resolve)
    _expanded=$(echo "$_ext_path" | sed "s|^~|$HOME|")
    _resolved=$(cd "$_expanded" 2>/dev/null && pwd) || {
        add_result "external-context" "FAIL" "External docs path not accessible: $_ext_path"
        return
    }

    # Read file list and validate existence
    _files=$(_read_ext_read_files)
    if [ -z "$_files" ]; then
        add_result "external-context" "FAIL" "external_context.path set but no read: files in $CONFIG_FILE"
        return
    fi

    _missing=""
    _count=0
    _old_ifs="$IFS"
    IFS='
'
    for _f in $_files; do
        [ -z "$_f" ] && continue
        _count=$((_count + 1))
        if [ ! -f "$_resolved/$_f" ]; then
            _missing="$_missing $_f"
        fi
    done
    IFS="$_old_ifs"

    if [ -n "$_missing" ]; then
        add_result "external-context" "FAIL" "Missing files in $_ext_path:$_missing"
    else
        add_result "external-context" "PASS" "All $_count external context files exist at $_ext_path"
    fi
}

check_external_triggers() {
    if ! should_run "external-triggers"; then return; fi

    # CI portability: skip if env var set
    if [ "${DOCKIT_SKIP_EXTERNAL:-0}" = "1" ]; then
        add_result "external-triggers" "PASS" "Skipped (DOCKIT_SKIP_EXTERNAL=1)"
        return
    fi

    # No config file -> explicit skip
    if [ ! -f "$CONFIG_FILE" ]; then
        add_result "external-triggers" "PASS" "Skipped (no .dockit-config.yml)"
        return
    fi

    # Read triggers from config
    _triggers=$(_read_ext_triggers)
    if [ -z "$_triggers" ]; then
        add_result "external-triggers" "PASS" "No update_triggers defined"
        return
    fi

    # Get changed files: staged + unstaged working tree
    _changed=$(cd "$PROJECT_ROOT" && {
        git diff --name-only HEAD 2>/dev/null
        git diff --cached --name-only 2>/dev/null
    } | sort -u) || true

    if [ -z "$_changed" ]; then
        add_result "external-triggers" "PASS" "No local changes to match against triggers"
        return
    fi

    # Match changed files against trigger globs
    _matched=""
    _old_ifs="$IFS"
    IFS='
'
    for _trigger in $_triggers; do
        _glob=$(echo "$_trigger" | cut -d'|' -f1)
        _target=$(echo "$_trigger" | cut -d'|' -f2)
        for _file in $_changed; do
            [ -z "$_file" ] && continue
            # POSIX glob matching via case
            eval "case \"\$_file\" in $_glob) _matched=\"\$_matched \$_file->$_target\" ;; esac"
        done
    done
    IFS="$_old_ifs"

    if [ -n "$_matched" ]; then
        add_result "external-triggers" "WARN" "Local changes may require external doc updates:$_matched"
    else
        add_result "external-triggers" "PASS" "No trigger matches in changed files"
    fi
}

# ── Check: prose-drift (D-016 — Layer-1 wrapper) ───────────────────────────
# Thin wrapper around scripts/check-prose-drift.sh per the
# Layer-1/Layer-2 architecture proposed in
# ~/src/LLM-DocKit/docs/HOOKS_ENFORCEMENT_PROPOSAL.md (RFC, draft). The
# external script is the validation logic; this function is the driver
# adapter that translates exit code → add_result.
#
# Severity is WARN during v0.5.4 (the calibration window — assume
# false positives in the first release using the script). Promote to
# FAIL in v0.5.5 once the baseline is stable.
check_prose_drift() {
    if ! should_run "prose-drift"; then return; fi

    _script="$PROJECT_ROOT/scripts/check-prose-drift.sh"
    if [ ! -f "$_script" ]; then
        add_result "prose-drift" "WARN" "scripts/check-prose-drift.sh not found; skipping (D-016 not yet adopted in this project root)"
        return
    fi
    if [ ! -x "$_script" ]; then
        add_result "prose-drift" "WARN" "scripts/check-prose-drift.sh is not executable; skipping"
        return
    fi

    # Run in quiet+strict mode. The script prints findings to stdout when
    # it fails; capture the first finding line for the result message.
    _output=$("$_script" --strict --quiet 2>&1)
    _exit=$?
    if [ "$_exit" = "0" ]; then
        add_result "prose-drift" "PASS" "No drift detected (regex-based, see D-016 for scope and limits)"
    else
        # First non-header line of the output is the most informative summary.
        _summary=$(printf '%s' "$_output" | head -3 | tr '\n' ' ' | sed 's/  */ /g; s/^ //; s/ $//')
        add_result "prose-drift" "WARN" "Drift detected: $_summary | run scripts/check-prose-drift.sh for details"
    fi
}

# ── Run all checks ──────────────────────────────────────────────────────────

check_handoff_date
check_history_entry
check_handoff_start_here_sync
check_decisions_referenced
check_version_sync
check_external_context
check_external_triggers
check_prose_drift

# ── Output ───────────────────────────────────────────────────────────────────

if [ "$CHECKS_RUN" -eq 0 ]; then
    echo "ERROR: no checks were run (check --check arguments)" >&2
    exit 2
fi

OK_VALUE="true"
if [ "$ERRORS" -gt 0 ]; then
    OK_VALUE="false"
fi

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date +%Y-%m-%dT%H:%M:%SZ)

if [ "$OUTPUT_MODE" = "json" ]; then
    printf '{"ok":%s,"warnings":%d,"timestamp":"%s","checks":[%s]}\n' "$OK_VALUE" "$WARNINGS" "$TIMESTAMP" "$RESULTS"
else
    # Human-readable output
    echo "=== Documentation Validation ==="
    echo "Date: $TODAY"
    echo ""

    # Parse results for human display
    if [ "$ERRORS" -gt 0 ]; then
        echo "RESULT: FAIL ($ERRORS error(s), $WARNINGS warning(s) in $CHECKS_RUN check(s))"
    elif [ "$WARNINGS" -gt 0 ]; then
        echo "RESULT: PASS with $WARNINGS warning(s) ($CHECKS_RUN check(s))"
    else
        echo "RESULT: PASS ($CHECKS_RUN check(s) passed)"
    fi
    echo ""

    # Print each result from JSON (simple approach: re-extract from accumulated data)
    echo "$RESULTS" | sed 's/},{/}\n{/g' | while IFS= read -r entry; do
        name=$(printf '%s' "$entry" | sed 's/.*"name":"\([^"]*\)".*/\1/')
        status=$(printf '%s' "$entry" | sed 's/.*"status":"\([^"]*\)".*/\1/')
        message=$(printf '%s' "$entry" | sed 's/.*"message":"\([^"]*\)".*/\1/' | sed 's/\\"/"/g')

        printf '  [%s] %s: %s\n' "$status" "$name" "$message"
    done
fi

# ── Exit code ────────────────────────────────────────────────────────────────

if [ "$ERRORS" -gt 0 ]; then
    exit 1
else
    exit 0
fi
