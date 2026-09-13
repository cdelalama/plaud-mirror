import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const compose = readFileSync("deploy/nas/docker-compose.yml", "utf8");
const start = readFileSync("deploy/nas/start.sh", "utf8");
const verifyRuntime = readFileSync("deploy/nas/verify-runtime.mjs", "utf8");
const verifyContainer = readFileSync("deploy/nas/verify-container.sh", "utf8");

test("NAS Compose is immutable, loopback-only, and least privilege", () => {
  assert.match(compose, /PLAUD_MIRROR_IMAGE:\?set an immutable registry tag and digest/);
  assert.match(compose, /127\.0\.0\.1:3040:3040/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /cap_drop:\n      - ALL/);
  assert.match(compose, /stop_grace_period: 90s/);
  assert.match(compose, /restart: unless-stopped/);
  assert.doesNotMatch(compose, /^\s+build:/mu);
  assert.doesNotMatch(compose, /^\s+env_file:/mu);
  assert.doesNotMatch(compose, /^\s+-\s*["']?(?:0\.0\.0\.0)?:3040:/mu);
  assert.doesNotMatch(compose, /^\s+-\s*["']?3040:3040["']?\s*$/mu);
  assert.match(compose, /logging:\n      driver: json-file/);
  assert.match(compose, /max-size: "10m"/);
  assert.match(compose, /max-file: "3"/);
  for (const required of [
    "PLAUD_MIRROR_IMAGE",
    "PLAUD_MIRROR_MASTER_KEY",
    "PLAUD_MIRROR_ADMIN_PASSPHRASE",
    "PLAUD_MIRROR_API_BASE",
    "PLAUD_MIRROR_NAS_DATA_DIR",
    "PLAUD_MIRROR_NAS_RECORDINGS_DIR"
  ]) {
    assert.match(compose, new RegExp(`\\$\\{${required}:\\?`));
  }
});

test("NAS launcher fails closed before secret access without Container Station", () => {
  assert.equal(statSync("deploy/nas/start.sh").mode & 0o777, 0o755);
  assert.equal(spawnSync("sh", ["-n", "deploy/nas/start.sh"]).status, 0);
  const result = spawnSync("sh", ["deploy/nas/start.sh"], {
    env: { ...process.env, DOCKER_BIN: "/nonexistent/docker", COMPOSE_BIN: "/nonexistent/compose" },
    encoding: "utf8"
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Container Station is unavailable; no deployment action was taken.\n");
});

test("NAS launcher rejects any persistent path or runtime identity override", () => {
  const unsafePath = spawnSync("sh", ["deploy/nas/start.sh"], {
    env: { ...process.env, PLAUD_MIRROR_NAS_DATA_DIR: "/share/Container/runtime" },
    encoding: "utf8"
  });
  assert.equal(unsafePath.status, 1);
  assert.equal(unsafePath.stderr, "Persistent paths must match the two reviewed Plaud Mirror leaves exactly.\n");

  const unsafeIdentity = spawnSync("sh", ["deploy/nas/start.sh"], {
    env: { ...process.env, PLAUD_MIRROR_RUNTIME_UID: "0" },
    encoding: "utf8"
  });
  assert.equal(unsafeIdentity.status, 1);
  assert.equal(unsafeIdentity.stderr, "The reviewed NAS runtime identity is exactly UID:GID 1000:100.\n");
});

test("NAS launcher keeps secrets untracked and state migration explicit", () => {
  const ignore = readFileSync(".gitignore", "utf8");
  assert.match(ignore, /^\.env$/mu);
  assert.match(start, /DOPPLER_CLI_IMAGE="dopplerhq\/cli@sha256:[0-9a-f]{64}"/);
  assert.match(start, /grep -Eq '\^PLAUD_MIRROR_IMAGE=/);
  assert.match(start, /mktemp \/tmp\/plaud-mirror-doppler\.XXXXXX/);
  assert.match(start, /stat -f -c '%T' \/tmp/);
  assert.doesNotMatch(start, /COMPOSE_DIR\/\.env\.doppler/);
  assert.match(start, /PLAUD_MIRROR_ALLOW_EMPTY_STATE:-false/);
  assert.match(start, /Migrated app\.db is missing/);
  assert.match(start, /Migrated secrets\.enc is missing/);
  assert.match(start, /exact-copy migration receipt is missing/);
  assert.match(start, /integrity_check/);
  assert.match(start, /nonterminalMedia/);
  assert.match(start, /uncertainUpstreamDeletion/);
  assert.match(start, /PLAUD_MIRROR_REQUIRE_QUIESCED/);
  assert.match(start, /"\$DOCKER_BIN" run --rm --network none/);
  assert.doesNotMatch(start, /"\$COMPOSE_BIN"[^\n]* run /);
  assert.match(start, /setfacl -b/);
  assert.doesNotMatch(start, /set -x/);
  assert.doesNotMatch(start, /qpkg_cli\s+--(?:enable|start)/);
});

test("NAS paths separate control state from growing recordings", () => {
  assert.match(start, /\/share\/Container\/runtime\/plaud-mirror\/data/);
  assert.match(start, /\/share\/ProjectsData\/plaud-mirror\/recordings/);
  assert.match(start, /must match the two reviewed Plaud Mirror leaves exactly/);
  assert.match(start, /chown -R/);
  assert.match(start, /chmod 700/);
  assert.match(start, /PLAUD_MIRROR_RUNTIME_UID:-1000/);
  assert.match(start, /PLAUD_MIRROR_RUNTIME_GID:-100\}/);
  assert.match(start, /! -user "\$PLAUD_MIRROR_RUNTIME_UID"/);
  assert.match(start, /! -group "\$PLAUD_MIRROR_RUNTIME_GID"/);
  assert.match(start, /rm -f "\$temporary" "\$temporary\.symlinks" "\$temporary\.identity"\ntrap - EXIT INT TERM/);
  assert.doesNotMatch(start, /-print -quit/);
});

test("NAS direct acceptance covers auth, static assets, health, protocol, and Range", () => {
  assert.equal(spawnSync(process.execPath, ["--check", "deploy/nas/verify-runtime.mjs"]).status, 0);
  assert.match(verifyRuntime, /anonymousConfigResponse\.status === 401/);
  assert.match(verifyRuntime, /rootResponse\.status === 200/);
  assert.match(verifyRuntime, /health\.auth\?\.state === "healthy"/);
  assert.match(verifyRuntime, /health\.scheduler\?\.enabled === true/);
  assert.match(verifyRuntime, /health\.warnings\.length === 0/);
  assert.match(verifyRuntime, /protocol\.condition === "ok"/);
  assert.match(verifyRuntime, /rangeResponse\.status === 206/);
  assert.match(verifyRuntime, /rangeBytes\.byteLength === 1/);
  assert.doesNotMatch(verifyRuntime, /console\.log\([^)]*passphrase/);
});

test("NAS container acceptance verifies the complete deployed policy", () => {
  assert.equal(statSync("deploy/nas/verify-container.sh").mode & 0o777, 0o755);
  assert.equal(spawnSync("sh", ["-n", "deploy/nas/verify-container.sh"]).status, 0);
  for (const expected of [
    "State.Health.Status",
    "State.OOMKilled",
    "Config.User",
    "HostConfig.ReadonlyRootfs",
    "HostConfig.Memory",
    "HostConfig.PidsLimit",
    "HostConfig.LogConfig",
    "HostConfig.RestartPolicy.Name",
    "HostConfig.CapDrop",
    "HostConfig.SecurityOpt",
    "HostConfig.Tmpfs",
    "Config.Image",
    "127.0.0.1:3040",
    "/share/Container/runtime/plaud-mirror/data",
    "/share/ProjectsData/plaud-mirror/recordings"
  ]) {
    assert.match(verifyContainer, new RegExp(expected.replaceAll(".", "\\.")));
  }
  assert.match(verifyContainer, /1000:100\|true\|1073741824\|256\|json-file\|10m\|3\|unless-stopped\|\[ALL\]\|\[no-new-privileges:true\]\|noexec,nosuid,size=64m,mode=1777/);
});
