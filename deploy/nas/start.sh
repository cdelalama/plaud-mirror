#!/bin/sh
set -eu

# This launcher consumes an already accepted release and an already prepared
# state migration. It never starts or repairs Container Station and never
# edits the shared edge proxy.
umask 077

COMPOSE_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
COMPOSE_BIN="${COMPOSE_BIN:-/usr/local/lib/docker/cli-plugins/docker-compose}"
DOCKER_BIN="${DOCKER_BIN:-/share/ZFS1_DATA/.qpkg/container-station/usr/bin/.libs/docker}"
DOPPLER_CLI_IMAGE="dopplerhq/cli@sha256:59801bdc9f8ede69eaeac6241d06434e6d5ebc40bd6f2456d70444ee79186224"
BOOTSTRAP_ENV="$COMPOSE_DIR/.env"
PLAUD_MIRROR_RUNTIME_UID="${PLAUD_MIRROR_RUNTIME_UID:-1000}"
PLAUD_MIRROR_RUNTIME_GID="${PLAUD_MIRROR_RUNTIME_GID:-1000}"
PLAUD_MIRROR_NAS_DATA_DIR="${PLAUD_MIRROR_NAS_DATA_DIR:-/share/Container/runtime/plaud-mirror/data}"
PLAUD_MIRROR_NAS_RECORDINGS_DIR="${PLAUD_MIRROR_NAS_RECORDINGS_DIR:-/share/ProjectsData/plaud-mirror/recordings}"
EXPECTED_DATA_DIR="/share/Container/runtime/plaud-mirror/data"
EXPECTED_RECORDINGS_DIR="/share/ProjectsData/plaud-mirror/recordings"
MIGRATION_RECEIPT="/share/Container/runtime/plaud-mirror/.migration-ready-v1"
PLAUD_MIRROR_REQUIRE_QUIESCED="${PLAUD_MIRROR_REQUIRE_QUIESCED:-false}"
export PLAUD_MIRROR_RUNTIME_UID PLAUD_MIRROR_RUNTIME_GID
export PLAUD_MIRROR_NAS_DATA_DIR PLAUD_MIRROR_NAS_RECORDINGS_DIR

fail() {
  echo "$1" >&2
  exit 1
}

if [ "$PLAUD_MIRROR_NAS_DATA_DIR" != "$EXPECTED_DATA_DIR" ] \
  || [ "$PLAUD_MIRROR_NAS_RECORDINGS_DIR" != "$EXPECTED_RECORDINGS_DIR" ]; then
  fail "Persistent paths must match the two reviewed Plaud Mirror leaves exactly."
fi
if [ "$PLAUD_MIRROR_RUNTIME_UID:$PLAUD_MIRROR_RUNTIME_GID" != "1000:1000" ]; then
  fail "The reviewed NAS runtime identity is exactly UID:GID 1000:1000."
fi
case "$PLAUD_MIRROR_REQUIRE_QUIESCED" in
  true|false) ;;
  *) fail "PLAUD_MIRROR_REQUIRE_QUIESCED must be true or false." ;;
esac

if [ ! -x "$DOCKER_BIN" ] || [ ! -x "$COMPOSE_BIN" ] || [ ! -S /var/run/docker.sock ]; then
  fail "Container Station is unavailable; no deployment action was taken."
fi
if ! "$DOCKER_BIN" info >/dev/null 2>&1; then
  fail "Container Station is not operational; no deployment action was taken."
fi
if [ ! -f "$BOOTSTRAP_ENV" ] || ! awk '
  index($0, "DOPPLER_TOKEN=") == 1 {
    value = substr($0, length("DOPPLER_TOKEN=") + 1)
    if (value != "" && value != "\"\"" && value != "\047\047") valid++
    seen++
  }
  END { exit !(seen == 1 && valid == 1) }
' "$BOOTSTRAP_ENV"; then
  fail "The bootstrap env must contain exactly one non-empty DOPPLER_TOKEN."
fi
if [ "$(stat -c '%a' "$BOOTSTRAP_ENV" 2>/dev/null || true)" != "600" ]; then
  fail "The bootstrap env must have mode 0600."
fi
if grep -Ev '^(#.*|[[:space:]]*|DOPPLER_TOKEN=.*)$' "$BOOTSTRAP_ENV" | grep -q .; then
  fail "The bootstrap env may contain only DOPPLER_TOKEN."
fi
if [ "$(stat -f -c '%T' /tmp 2>/dev/null || true)" != "tmpfs" ]; then
  fail "NAS /tmp is not tmpfs; refusing to materialize the production environment."
fi

temporary="$(mktemp /tmp/plaud-mirror-doppler.XXXXXX)"
cleanup() {
  rm -f "$temporary" "$temporary.symlinks"
}
trap cleanup EXIT INT TERM

"$DOCKER_BIN" run --rm --env-file "$BOOTSTRAP_ENV" "$DOPPLER_CLI_IMAGE" \
  secrets download --no-file --format env > "$temporary"
[ -s "$temporary" ] || fail "Doppler generated an empty environment; the service was not started."

for required_key in \
  PLAUD_MIRROR_IMAGE PLAUD_MIRROR_MASTER_KEY \
  PLAUD_MIRROR_ADMIN_PASSPHRASE PLAUD_MIRROR_API_BASE
do
  if ! awk -v key="$required_key" '
    index($0, key "=") == 1 {
      value = substr($0, length(key) + 2)
      if (value != "" && value != "\"\"" && value != "\047\047") valid++
      seen++
    }
    END { exit !(seen == 1 && valid == 1) }
  ' "$temporary"; then
    fail "Doppler environment has a missing, duplicate, or empty required value."
  fi
done
if ! grep -Eq '^PLAUD_MIRROR_IMAGE="?registry\.lamanoriega\.com/plaud-mirror:[0-9]+\.[0-9]+\.[0-9]+@sha256:[0-9a-f]{64}"?$' "$temporary"; then
  fail "The application image is not pinned to an accepted tag and digest."
fi

chmod 600 "$temporary"

for directory in "$PLAUD_MIRROR_NAS_DATA_DIR" "$PLAUD_MIRROR_NAS_RECORDINGS_DIR"; do
  if [ -e "$directory" ]; then
    echo "Pre-change persistent leaf: $(stat -c '%n %u:%g %a' "$directory")" >&2
    if command -v getfacl >/dev/null 2>&1; then
      getfacl -p "$directory" >&2
    fi
  else
    echo "Pre-change persistent leaf: $directory ABSENT" >&2
  fi
  mkdir -p "$directory"
  if ! find "$directory" -type l -exec printf '%s\n' {} \; > "$temporary.symlinks"; then
    fail "Could not inspect the persistent Plaud Mirror leaf for symbolic links."
  fi
  if [ -s "$temporary.symlinks" ]; then
    fail "Persistent Plaud Mirror leaves may not contain symbolic links."
  fi
  : > "$temporary.symlinks"
  if command -v setfacl >/dev/null 2>&1; then
    setfacl -b "$directory"
  fi
  chown -R "$PLAUD_MIRROR_RUNTIME_UID:$PLAUD_MIRROR_RUNTIME_GID" "$directory"
  find "$directory" -type d -exec chmod 700 {} \;
  find "$directory" -type f -exec chmod 600 {} \;
  [ "$(stat -c '%u:%g:%a' "$directory")" = "$PLAUD_MIRROR_RUNTIME_UID:$PLAUD_MIRROR_RUNTIME_GID:700" ] \
    || fail "Persistent directory ownership or mode is not exclusive."
done

if [ "${PLAUD_MIRROR_ALLOW_EMPTY_STATE:-false}" != "true" ]; then
  [ -s "$PLAUD_MIRROR_NAS_DATA_DIR/app.db" ] \
    || fail "Migrated app.db is missing; the service was not started."
  [ -s "$PLAUD_MIRROR_NAS_DATA_DIR/secrets.enc" ] \
    || fail "Migrated secrets.enc is missing; the service was not started."
  [ -s "$MIGRATION_RECEIPT" ] \
    || fail "The exact-copy migration receipt is missing; the service was not started."
  find "$PLAUD_MIRROR_NAS_RECORDINGS_DIR" -type f | grep -q . \
    || fail "Migrated recordings are missing; the service was not started."
fi

cd "$COMPOSE_DIR"
"$COMPOSE_BIN" --env-file "$temporary" config --quiet
"$COMPOSE_BIN" --env-file "$temporary" pull plaud-mirror

if [ "${PLAUD_MIRROR_ALLOW_EMPTY_STATE:-false}" != "true" ]; then
  image_ref="$(grep '^PLAUD_MIRROR_IMAGE=' "$temporary" | cut -d= -f2- | tr -d '"')"
  database_check='import Database from "better-sqlite3";
const db = new Database("/var/lib/plaud-mirror/data/app.db", { readonly: true, fileMustExist: true });
db.pragma("query_only = ON");
const integrity = db.pragma("integrity_check", { simple: true });
const requireQuiesced = process.argv[1] === "true";
const checks = {
  activeRuns: db.prepare("SELECT COUNT(*) AS count FROM sync_runs WHERE status = '\''running'\''").get().count,
  webhookWork: db.prepare("SELECT COUNT(*) AS count FROM webhook_outbox WHERE state IN ('\''pending'\'', '\''delivering'\'', '\''retry_waiting'\'')").get().count,
  mediaOutboxWork: db.prepare("SELECT COUNT(*) AS count FROM media_delivery_outbox WHERE state IN ('\''pending'\'', '\''delivering'\'', '\''retry_waiting'\'')").get().count,
  nonterminalMedia: db.prepare("SELECT COUNT(*) AS count FROM media_deliveries WHERE state IN ('\''pending'\'', '\''delivering'\'', '\''accepted'\'', '\''processing'\'')").get().count,
  uncertainUpstreamDeletion: db.prepare("SELECT COUNT(*) AS count FROM upstream_deletion_operations WHERE stage != '\''confirmed'\''").get().count
};
db.close();
if (integrity !== "ok" || (requireQuiesced && Object.values(checks).some((count) => count !== 0))) {
  console.error(JSON.stringify({ integrity, requireQuiesced, checks }));
  process.exit(1);
}
console.log(JSON.stringify({ integrity, requireQuiesced, checks }));'
  "$DOCKER_BIN" run --rm --network none \
    --user "$PLAUD_MIRROR_RUNTIME_UID:$PLAUD_MIRROR_RUNTIME_GID" \
    --read-only --pids-limit 256 --memory 1g \
    --volume "$PLAUD_MIRROR_NAS_DATA_DIR:/var/lib/plaud-mirror/data" \
    --entrypoint node "$image_ref" --input-type=module -e "$database_check" \
    "$PLAUD_MIRROR_REQUIRE_QUIESCED"
fi

"$COMPOSE_BIN" --env-file "$temporary" up -d plaud-mirror
rm -f "$temporary"
trap - EXIT INT TERM
