#!/bin/sh
# Store PLAUD_MIRROR_ADMIN_PASSPHRASE (D-018 operator access control) in
# Doppler, following the home-infra secrets convention (CONVENTIONS.md
# "Secrets Management (Doppler)").
#
# Run this yourself, interactively, on dev-vm:
#
#   scripts/set-admin-passphrase.sh
#
# The passphrase is read silently from the terminal (asked twice), passed
# to the Doppler CLI via stdin (never argv, never a file, never echoed),
# and stored at doppler://plaud-mirror/dev/PLAUD_MIRROR_ADMIN_PASSPHRASE.
# The Doppler project is created on first run.
#
# After storing, arm the running container with either:
#
#   a) Doppler-injected launch (recommended; process env overrides .env):
#        doppler run --project plaud-mirror --config dev -- docker compose up -d
#
#   b) or copy the value into the local .env yourself and run
#        docker compose up -d
#      (.env is gitignored; Doppler stays the source of truth either way).
#
# Note: a plain `docker compose up -d` WITHOUT doppler run and WITHOUT the
# .env entry starts the service with access control disabled again —
# /api/health will carry the explicit warning if that happens.

set -eu

PROJECT="plaud-mirror"
CONFIG="${PLAUD_MIRROR_DOPPLER_CONFIG:-dev}"
SECRET_NAME="PLAUD_MIRROR_ADMIN_PASSPHRASE"

fail() {
    echo "ERROR: $1" >&2
    exit 1
}

command -v doppler >/dev/null 2>&1 || fail "doppler CLI not found; see home-infra docs/ONBOARDING.md"
doppler me >/dev/null 2>&1 || fail "doppler CLI is not authenticated; run 'doppler login' first"

[ -t 0 ] || fail "this script must run interactively (it prompts for the passphrase)"

# Ensure the project exists (HANDOFF Top Priorities has tracked
# "create the Doppler project plaud-mirror" since Phase 2).
if ! doppler projects get "$PROJECT" >/dev/null 2>&1; then
    echo "Doppler project '$PROJECT' does not exist; creating it..."
    doppler projects create "$PROJECT" \
        --description "Plaud Mirror runtime secrets (dev-vm)" >/dev/null
    echo "Created project '$PROJECT' (configs dev/stg/prd)."
fi

doppler configs get "$CONFIG" --project "$PROJECT" >/dev/null 2>&1 \
    || fail "config '$CONFIG' not found in project '$PROJECT'"

# Silent double prompt. stty instead of `read -s` so the script stays POSIX sh.
printf "New %s (input hidden): " "$SECRET_NAME"
stty -echo
read -r PASSPHRASE
stty echo
printf "\n"
printf "Repeat to confirm: "
stty -echo
read -r PASSPHRASE_CONFIRM
stty echo
printf "\n"

[ -n "$PASSPHRASE" ] || fail "empty passphrase rejected"
[ "$PASSPHRASE" = "$PASSPHRASE_CONFIRM" ] || fail "passphrases do not match; nothing stored"
[ "${#PASSPHRASE}" -ge 8 ] || fail "passphrase shorter than 8 characters rejected"

# stdin keeps the value out of argv (ps) and out of shell history.
printf '%s' "$PASSPHRASE" | doppler secrets set "$SECRET_NAME" \
    --project "$PROJECT" --config "$CONFIG" --silent

unset PASSPHRASE PASSPHRASE_CONFIRM

echo "Stored doppler://$PROJECT/$CONFIG/$SECRET_NAME."
echo ""
echo "Next: restart the container with the secret injected:"
echo "  doppler run --project $PROJECT --config $CONFIG -- docker compose up -d"
echo ""
echo "Then verify the lock is armed:"
echo "  curl -s http://127.0.0.1:3040/api/session   # expect {\"authRequired\":true,...}"
