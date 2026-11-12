#!/bin/sh
set -eu

PROJECT_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
STATE_BASE=${XDG_STATE_HOME:-${HOME}/.local/state}
DEV_ROOT=${PLAUD_MIRROR_DEV_ROOT:-$STATE_BASE/plaud-mirror-development}
COMPOSE_FILE="$PROJECT_ROOT/compose.development.yml"
PROJECT_NAME=plaud-mirror-development
DEV_BIND_IP=${PLAUD_MIRROR_DEV_BIND_IP:-10.0.0.110}
NAS_HOST=${PLAUD_MIRROR_SAMPLE_NAS_HOST:-nas.lamanoriega.com}
NAS_DOCKER=${PLAUD_MIRROR_SAMPLE_NAS_DOCKER:-/share/ZFS1_DATA/.qpkg/container-station/usr/bin/.libs/docker}
NAS_RECORDINGS_ROOT=/share/ProjectsData/plaud-mirror/recordings
MARKER="$DEV_ROOT/.plaud-mirror-development"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command is unavailable: $1"
}

validate_root() {
  require_command realpath
  root_real=$(realpath -m -- "$DEV_ROOT")
  project_real=$(realpath -m -- "$PROJECT_ROOT")
  home_real=$(realpath -m -- "$HOME")
  case "$root_real" in
    "$project_real"|"$project_real"/*|/|"$home_real")
      fail "Development state root must be a dedicated path outside the repository and home root"
      ;;
  esac
  [ ! -L "$DEV_ROOT" ] || fail "Development state root must not be a symlink"
  [ ! -e "$DEV_ROOT" ] || [ -d "$DEV_ROOT" ] \
    || fail "Development state root must be a directory"
  if [ -d "$DEV_ROOT" ] && [ ! -e "$MARKER" ] \
      && find "$DEV_ROOT" -mindepth 1 -maxdepth 1 -print | grep -q .; then
    fail "Refusing to adopt a non-empty directory without the development marker: $DEV_ROOT"
  fi
}

validate_state_path() {
  path=$1
  [ ! -L "$path" ] || fail "Development state paths must not be symlinks: $path"
  root_real=$(realpath -m -- "$DEV_ROOT")
  path_real=$(realpath -m -- "$path")
  case "$path_real" in
    "$root_real"/*) ;;
    *) fail "Development state path escapes its dedicated root: $path" ;;
  esac
}

prepare() {
  validate_root
  require_command openssl
  validate_state_path "$DEV_ROOT/data"
  validate_state_path "$DEV_ROOT/recordings"
  validate_state_path "$DEV_ROOT/runtime.env"
  validate_state_path "$DEV_ROOT/samples.json"
  validate_state_path "$MARKER"
  umask 077
  mkdir -p "$DEV_ROOT/data" "$DEV_ROOT/recordings"
  if [ ! -f "$MARKER" ]; then
    printf 'plaud-mirror-development-v1\n' > "$MARKER"
  fi
  [ "$(sed -n '1p' "$MARKER")" = "plaud-mirror-development-v1" ] \
    || fail "Development state marker is invalid: $MARKER"
  acquire_lifecycle_lock
  if [ ! -f "$DEV_ROOT/runtime.env" ]; then
    master_key=$(openssl rand -hex 32)
    admin_passphrase=$(openssl rand -base64 24 | tr -d '\n')
    {
      printf 'PLAUD_MIRROR_MASTER_KEY=%s\n' "$master_key"
      printf 'PLAUD_MIRROR_ADMIN_PASSPHRASE=%s\n' "$admin_passphrase"
    } > "$DEV_ROOT/runtime.env"
  fi
  chmod 700 "$DEV_ROOT" "$DEV_ROOT/data" "$DEV_ROOT/recordings"
  chmod 600 "$MARKER" "$DEV_ROOT/runtime.env"
}

require_dev_marker() {
  validate_root
  validate_state_path "$DEV_ROOT/data"
  validate_state_path "$DEV_ROOT/recordings"
  validate_state_path "$DEV_ROOT/runtime.env"
  validate_state_path "$DEV_ROOT/samples.json"
  validate_state_path "$MARKER"
  [ -f "$MARKER" ] || fail "Development state is not prepared; run: npm run dev:agent:prepare"
  [ "$(sed -n '1p' "$MARKER")" = "plaud-mirror-development-v1" ] \
    || fail "Development state marker is invalid: $MARKER"
}

container_state() {
  if inspect_output=$(docker inspect --format '{{.State.Running}}' plaud-mirror-development 2>&1); then
    case "$inspect_output" in
      true) printf 'running\n' ;;
      false) printf 'stopped\n' ;;
      *) return 1 ;;
    esac
    return 0
  fi
  case "$inspect_output" in
    *"No such object"*|*"No such container"*) printf 'absent\n' ;;
    *) return 1 ;;
  esac
}

container_running() {
  container_state_value=$(container_state) \
    || fail "Cannot determine the development container state; refusing to continue"
  [ "$container_state_value" = running ]
}

LOCK_HELD=0
acquire_lifecycle_lock() {
  [ "$LOCK_HELD" -eq 0 ] || return 0
  require_command flock
  validate_state_path "$DEV_ROOT/.lifecycle.lock"
  exec 9>"$DEV_ROOT/.lifecycle.lock"
  flock -n 9 || fail "Another development lifecycle command is running; retry when it finishes"
  LOCK_HELD=1
}

refresh_samples() {
  prepare
  require_command docker
  require_command jq
  require_command rsync
  require_command ssh
  require_command sha256sum
  acquire_lifecycle_lock
  if container_running; then
    fail "Stop the development runtime before refreshing its samples"
  fi

  temp_root=$(mktemp -d "$DEV_ROOT/.samples-stage.XXXXXX")
  cleanup() {
    rm -rf "$temp_root"
  }
  trap cleanup EXIT HUP INT TERM
  manifest="$temp_root/samples.json"
  ssh -o BatchMode=yes "$NAS_HOST" \
    "$NAS_DOCKER exec -i plaud-mirror node --input-type=module" \
    < "$PROJECT_ROOT/scripts/select-development-samples.mjs" > "$manifest"
  jq -e '
    .schema == "plaud-mirror.development-samples.v1"
    and .source == "nas-production-sample"
    and (.samples | length >= 1 and length <= 8)
    and all(.samples[]; (.relativePath | test("^[A-Za-z0-9_-]+/[A-Za-z0-9._-]+$")))
  ' "$manifest" >/dev/null || fail "NAS sample manifest failed local validation"

  mkdir -p "$temp_root/recordings"
  jq -r '.samples[].relativePath' "$manifest" | while IFS= read -r relative_path; do
    sample_dir="$temp_root/recordings/${relative_path%/*}"
    mkdir -p "$sample_dir"
    rsync -a --protect-args \
      "$NAS_HOST:$NAS_RECORDINGS_ROOT/$relative_path" \
      "$sample_dir/"
  done
  jq -r '.samples[] | "\(.sha256)  recordings/\(.relativePath)"' "$manifest" \
    > "$temp_root/SHA256SUMS"
  (cd "$temp_root" && sha256sum -c SHA256SUMS >/dev/null)

  rsync -a --delete "$temp_root/recordings/" "$DEV_ROOT/recordings/"
  install -m 600 "$manifest" "$DEV_ROOT/samples.json"
  printf 'Development sample set refreshed: %s recordings, %s bytes\n' \
    "$(jq '.samples | length' "$manifest")" \
    "$(jq '[.samples[].bytes] | add' "$manifest")"
  rm -rf "$temp_root"
  trap - EXIT HUP INT TERM
}

up() {
  prepare
  require_command docker
  require_command curl
  acquire_lifecycle_lock
  if [ ! -s "$DEV_ROOT/samples.json" ]; then
    refresh_samples
  fi
  export PLAUD_MIRROR_DEV_ROOT="$DEV_ROOT"
  export PLAUD_MIRROR_DEV_BIND_IP="$DEV_BIND_IP"
  PLAUD_MIRROR_DEV_IMAGE="plaud-mirror:$(sed -n '1p' "$PROJECT_ROOT/VERSION")-development"
  export PLAUD_MIRROR_DEV_IMAGE
  docker compose --project-name "$PROJECT_NAME" --file "$COMPOSE_FILE" up -d --build
  attempts=0
  until curl -fsS --max-time 5 "http://$DEV_BIND_IP:3041/api/health" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    [ "$attempts" -lt 30 ] || fail "Development runtime did not become reachable within 60 seconds"
    sleep 2
  done
  status
}

down() {
  require_dev_marker
  require_command docker
  acquire_lifecycle_lock
  export PLAUD_MIRROR_DEV_ROOT="$DEV_ROOT"
  docker compose --project-name "$PROJECT_NAME" --file "$COMPOSE_FILE" stop
}

status() {
  require_dev_marker
  require_command docker
  require_command curl
  require_command jq
  if ! container_running; then
    printf 'Plaud Mirror development: stopped\n'
    return 1
  fi
  port_binding=$(docker inspect plaud-mirror-development \
    --format '{{(index (index .HostConfig.PortBindings "3040/tcp") 0).HostIp}}:{{(index (index .HostConfig.PortBindings "3040/tcp") 0).HostPort}}')
  [ "$port_binding" = "$DEV_BIND_IP:3041" ] \
    || fail "Development runtime has an unexpected host binding: $port_binding"
  health=$(curl -fsS --max-time 5 "http://$DEV_BIND_IP:3041/api/health")
  expected_version=$(sed -n '1p' "$PROJECT_ROOT/VERSION")
  printf '%s\n' "$health" | jq -e --arg version "$expected_version" '
    .version == $version
    and .scheduler.enabled == false
    and .auth.configured == false
    and .recordingsCount >= 1
  ' >/dev/null || fail "Development health violates isolation or sample-data invariants"
  session=$(curl -fsS --max-time 5 "http://$DEV_BIND_IP:3041/api/session")
  printf '%s\n' "$session" | jq -e '
    .authRequired == true and .authenticated == false
  ' >/dev/null || fail "Development operator authentication is not armed"
  printf 'Plaud Mirror development: running, isolated state, scheduler disabled, %s sample recordings\n' \
    "$(printf '%s\n' "$health" | jq -r '.recordingsCount')"
  printf 'URL: http://dev.lamanoriega.com:3041/ (direct LAN address; no canonical hostname is active)\n'
}

credentials() {
  require_dev_marker
  passphrase=$(sed -n 's/^PLAUD_MIRROR_ADMIN_PASSPHRASE=//p' "$DEV_ROOT/runtime.env")
  [ -n "$passphrase" ] || fail "Development admin passphrase is missing"
  printf 'URL: http://dev.lamanoriega.com:3041/\n'
  printf 'Admin passphrase: %s\n' "$passphrase"
}

case "${1:-status}" in
  prepare) prepare ;;
  refresh-samples) refresh_samples ;;
  up) up ;;
  down) down ;;
  status) status ;;
  credentials) credentials ;;
  *) fail "Usage: $0 {prepare|refresh-samples|up|down|status|credentials}" ;;
esac
