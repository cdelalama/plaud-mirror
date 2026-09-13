#!/bin/sh
set -eu

DOCKER_BIN="${DOCKER_BIN:-/share/ZFS1_DATA/.qpkg/container-station/usr/bin/.libs/docker}"
CONTAINER="plaud-mirror"

fail() {
  echo "$1" >&2
  exit 1
}

[ -x "$DOCKER_BIN" ] || fail "Container Station Docker CLI is unavailable."

state="$("$DOCKER_BIN" inspect --format '{{.State.Status}}|{{.State.Health.Status}}|{{.State.OOMKilled}}|{{.Config.User}}|{{.HostConfig.ReadonlyRootfs}}|{{.HostConfig.Memory}}|{{.HostConfig.PidsLimit}}|{{.HostConfig.LogConfig.Type}}|{{index .HostConfig.LogConfig.Config "max-size"}}|{{index .HostConfig.LogConfig.Config "max-file"}}|{{.HostConfig.RestartPolicy.Name}}|{{.HostConfig.CapDrop}}|{{.HostConfig.SecurityOpt}}|{{index .HostConfig.Tmpfs "/tmp"}}' "$CONTAINER")"
[ "$state" = "running|healthy|false|1000:100|true|1073741824|256|json-file|10m|3|unless-stopped|[ALL]|[no-new-privileges:true]|noexec,nosuid,size=64m,mode=1777" ] \
  || fail "Container state, identity, resource, or logging policy is not exact: $state"

image_ref="$("$DOCKER_BIN" inspect --format '{{.Config.Image}}' "$CONTAINER")"
echo "$image_ref" | grep -Eq '^registry\.lamanoriega\.com/plaud-mirror:[0-9]+\.[0-9]+\.[0-9]+@sha256:[0-9a-f]{64}$' \
  || fail "Running image is not an immutable Plaud Mirror release reference."

[ "$("$DOCKER_BIN" port "$CONTAINER" 3040/tcp)" = "127.0.0.1:3040" ] \
  || fail "Port 3040 is not bound exclusively to NAS loopback."

mounts="$("$DOCKER_BIN" inspect --format '{{range .Mounts}}{{.Source}}=>{{.Destination}}:{{.RW}};{{end}}' "$CONTAINER")"
data_source="$(readlink -f /share/Container/runtime/plaud-mirror/data)"
recordings_source="$(readlink -f /share/ProjectsData/plaud-mirror/recordings)"
case "$mounts" in
  *"$data_source=>/var/lib/plaud-mirror/data:true;"*) ;;
  *) fail "Control-state mount is absent or read-only." ;;
esac
case "$mounts" in
  *"$recordings_source=>/var/lib/plaud-mirror/recordings:true;"*) ;;
  *) fail "Recording mount is absent or read-only." ;;
esac

echo "Container policy verified: immutable image, healthy, OOM-free, UID:GID 1000:100, read-only root, capability-free/no-new-privileges execution, exact writable mounts, private tmpfs, loopback ingress, unless-stopped recovery, 1 GiB/256 PID limits, bounded logs."
