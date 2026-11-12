import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const compose = readFileSync("compose.development.yml", "utf8");
const defaultCompose = readFileSync("compose.yml", "utf8");
const launcher = readFileSync("scripts/agent-development.sh", "utf8");

test("default Compose delegates to the isolated agent-development runtime", () => {
  assert.match(defaultCompose, /include:\s*\n\s*- compose\.development\.yml/);
  assert.match(compose, /container_name: plaud-mirror-development/);
  assert.match(compose, /PLAUD_MIRROR_ENVIRONMENT: development/);
  assert.match(compose, /PLAUD_MIRROR_STATE_POLICY: isolated/);
  assert.match(compose, /PLAUD_MIRROR_SCHEDULER_INTERVAL_MS: "0"/);
  assert.match(compose, /PLAUD_MIRROR_DEV_ROOT[^\n]*\/data:/);
  assert.match(compose, /PLAUD_MIRROR_DEV_ROOT[^\n]*\/recordings:/);
  assert.doesNotMatch(compose, /\.\/runtime\/(data|recordings)/);
});

test("agent launcher refuses unsafe state roots and verifies the live boundary", () => {
  assert.match(launcher, /Development state root must be a dedicated path outside the repository and home root/);
  assert.match(launcher, /Development state root must not be a symlink/);
  assert.match(launcher, /Development state path escapes its dedicated root/);
  assert.match(launcher, /PLAUD_MIRROR_DEV_BIND_IP/);
  assert.match(launcher, /\.scheduler\.enabled == false/);
  assert.match(launcher, /\.auth\.configured == false/);
  assert.match(launcher, /\.authRequired == true and \.authenticated == false/);
  assert.match(launcher, /\.recordingsCount >= 1/);
  assert.match(launcher, /did not become reachable within 60 seconds/);
  assert.match(
    readFileSync("apps/api/src/runtime/service.ts", "utf8"),
    /assertPlaudRemoteAccessAllowed\("store Plaud credentials"\)/,
  );
});

test("agent launcher rejects a symlinked development state root before preparing it", () => {
  const root = mkdtempSync(join(tmpdir(), "plaud-development-root-"));
  const linkedRoot = join(root, "linked-state");
  const targetRoot = join(root, "target-state");
  mkdirSync(targetRoot);
  symlinkSync(targetRoot, linkedRoot, "dir");
  try {
    const result = spawnSync("scripts/agent-development.sh", ["prepare"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, PLAUD_MIRROR_DEV_ROOT: linkedRoot },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must not be a symlink/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("agent launcher refuses to adopt a non-empty unmarked state directory", () => {
  const root = mkdtempSync(join(tmpdir(), "plaud-development-nonempty-"));
  const stateRoot = join(root, "state");
  mkdirSync(stateRoot);
  mkdirSync(join(stateRoot, "unrelated"));
  try {
    const result = spawnSync("scripts/agent-development.sh", ["prepare"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, PLAUD_MIRROR_DEV_ROOT: stateRoot },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing to adopt a non-empty directory/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function runRefreshWithFakeDocker(dockerBody) {
  const root = mkdtempSync(join(tmpdir(), "plaud-development-inspect-"));
  const bin = join(root, "bin");
  const calls = join(root, "calls.log");
  mkdirSync(bin);
  const fake = (name, body) => {
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  };
  fake("docker", dockerBody);
  for (const name of ["ssh", "rsync"]) {
    fake(name, `echo ${name} >> "${calls}"\nexit 1`);
  }
  const result = spawnSync("scripts/agent-development.sh", ["refresh-samples"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      PLAUD_MIRROR_DEV_ROOT: join(root, "state"),
    },
  });
  const log = existsSync(calls) ? readFileSync(calls, "utf8") : "";
  rmSync(root, { recursive: true, force: true });
  return { result, log };
}

test("sample refresh fails closed when the container state cannot be inspected", () => {
  const { result, log } = runRefreshWithFakeDocker(
    'echo "Cannot connect to the Docker daemon" >&2\nexit 1',
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot determine the development container state/);
  assert.equal(log, "");
});

test("sample refresh proceeds past the state check only for a confirmed absent container", () => {
  const { result, log } = runRefreshWithFakeDocker(
    'echo "Error: No such object: plaud-mirror-development" >&2\nexit 1',
  );
  assert.notEqual(result.status, 0);
  assert.match(log, /^ssh$/m);
  assert.doesNotMatch(log, /rsync/);
});
