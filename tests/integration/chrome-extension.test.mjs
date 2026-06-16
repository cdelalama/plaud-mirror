import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile("apps/chrome-extension/manifest.json", "utf8"));
const popupJs = await readFile("apps/chrome-extension/popup.js", "utf8");
const popupHtml = await readFile("apps/chrome-extension/popup.html", "utf8");

test("Chrome extension manifest uses minimal permissions for Plaud capture", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions.sort(), ["activeTab", "scripting"]);
  assert.ok(manifest.host_permissions.includes("https://app.plaud.ai/*"));
  assert.ok(manifest.host_permissions.includes("https://web.plaud.ai/*"));
  assert.ok(manifest.host_permissions.includes("https://plaud.lamanoriega.com/*"));
  assert.equal(manifest.action.default_popup, "popup.html");
});

test("Chrome extension captures Plaud tokens without storing token material", () => {
  assert.match(popupJs, /pld_tokenstr/);
  assert.match(popupJs, /connect#token=/);
  assert.match(popupJs, /chrome\.scripting\.executeScript/);
  assert.match(popupJs, /world:\s*"MAIN"/);
  assert.match(popupJs, /chrome\.tabs\.update/);
  assert.doesNotMatch(popupJs, /localStorage\.setItem\([^)]*token/i);
  assert.doesNotMatch(popupJs, /console\.log/);
  assert.match(popupHtml, /Send token to mirror/);
});
