#!/bin/sh
set -eu

CONFIG_FILE="config/upstreams.tsv"
OUTPUT_MODE="table"

usage() {
    cat <<'EOF'
Usage: scripts/check-upstreams.sh [--config path] [--markdown]

Checks tracked upstream repositories against the committed baseline.

Exit codes:
  0  all tracked upstreams match the baseline
  10 one or more tracked upstreams changed
  1  usage or runtime error
EOF
}

die() {
    echo "ERROR: $*" >&2
    exit 1
}

short_ref() {
    ref="$1"
    case "$ref" in
        ????????*????????*) printf '%s' "$ref" | cut -c1-12 ;;
        *) printf '%s' "$ref" ;;
    esac
}

fetch_current_ref() {
    repo="$1"
    track="$2"

    case "$track" in
        release)
            current=$(gh release list -R "$repo" -L 1 --json tagName --jq 'if length == 0 then "" else .[0].tagName end' 2>/dev/null || true)
            [ -n "$current" ] || current="NO_RELEASE"
            ;;
        commit)
            branch=$(gh repo view "$repo" --json defaultBranchRef --jq '.defaultBranchRef.name')
            current=$(gh api "repos/$repo/commits/$branch" --jq '.sha')
            ;;
        *)
            die "unsupported track type '$track' for $repo"
            ;;
    esac

    printf '%s\n' "$current"
}

render_header() {
    case "$OUTPUT_MODE" in
        markdown)
            echo "| Repo | Track | Baseline | Current | Status | Tier | Keep | Watch Focus |"
            echo "|------|-------|----------|---------|--------|------|------|-------------|"
            ;;
        table)
            printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "repo" "track" "baseline" "current" "status" "tier" "keep" "watch_focus"
            ;;
    esac
}

render_row() {
    repo="$1"
    track="$2"
    baseline="$3"
    current="$4"
    status="$5"
    tier="$6"
    keep="$7"
    watch_focus="$8"

    case "$OUTPUT_MODE" in
        markdown)
            printf '| `%s` | `%s` | `%s` | `%s` | `%s` | `%s` | `%s` | `%s` |\n' \
                "$repo" "$track" "$(short_ref "$baseline")" "$(short_ref "$current")" "$status" "$tier" "$keep" "$watch_focus"
            ;;
        table)
            printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
                "$repo" "$track" "$(short_ref "$baseline")" "$(short_ref "$current")" "$status" "$tier" "$keep" "$watch_focus"
            ;;
    esac
}

while [ $# -gt 0 ]; do
    case "$1" in
        --config)
            [ $# -ge 2 ] || die "--config requires a path"
            CONFIG_FILE="$2"
            shift 2
            ;;
        --markdown)
            OUTPUT_MODE="markdown"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            die "unknown argument: $1"
            ;;
    esac
done

command -v gh >/dev/null 2>&1 || die "gh is required"
[ -f "$CONFIG_FILE" ] || die "config file not found: $CONFIG_FILE"

changed=0
tab=$(printf '\t')

render_header

while IFS="$tab" read -r repo track baseline license tier keep watch_focus; do
    case "${repo:-}" in
        ''|\#*)
            continue
            ;;
    esac

    current=$(fetch_current_ref "$repo" "$track")
    status="CURRENT"
    if [ "$current" != "$baseline" ]; then
        status="CHANGED"
        changed=10
    fi

    render_row "$repo" "$track" "$baseline" "$current" "$status" "$tier" "$keep" "$watch_focus"
done < "$CONFIG_FILE"

exit "$changed"
