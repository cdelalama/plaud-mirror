import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../docs/contracts/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.v1.json", root), "utf8"));

if (manifest.profile !== "plaud-mirror.transcription-intake.v1") {
  throw new Error(`Unexpected contract profile: ${manifest.profile}`);
}

for (const [filename, expected] of Object.entries(manifest.schemas)) {
  const bytes = await readFile(new URL(filename, root));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== expected.sha256 || bytes.byteLength !== expected.bytes) {
    throw new Error(`${filename} does not match manifest.v1.json`);
  }
  JSON.parse(bytes.toString("utf8"));
}

console.log(`Transcription contract ${manifest.profile} verified (${Object.keys(manifest.schemas).length} schemas).`);
