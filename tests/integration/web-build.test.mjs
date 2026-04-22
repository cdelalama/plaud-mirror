import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

test("web build emits the product panel shell", async () => {
  const html = await readFile(join(process.cwd(), "apps/web/dist/index.html"), "utf8");

  assert.match(html, /Plaud Mirror/);
  assert.match(html, /src=\"\/assets\//);
});
