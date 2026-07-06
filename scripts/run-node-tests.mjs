import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const roots = [
  { path: "packages/shared/dist", suffix: ".test.js" },
  { path: "apps/api/dist", suffix: ".test.js" },
  { path: "tests/integration", suffix: ".test.mjs" },
];

async function discoverTests(directory, suffix) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return discoverTests(path, suffix);
    }
    return entry.isFile() && entry.name.endsWith(suffix) ? [path] : [];
  }));
  return files.flat();
}

const testFiles = (await Promise.all(
  roots.map(({ path, suffix }) => discoverTests(path, suffix)),
)).flat().sort();

if (testFiles.length === 0) {
  throw new Error("No compiled Node or integration tests were discovered.");
}

console.log(`Discovered ${testFiles.length} Node/integration test files.`);
const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
