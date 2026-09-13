import { readFile } from "node:fs/promises";

const base = "http://127.0.0.1:3040";
const expectedVersion = (await readFile("/app/VERSION", "utf8")).trim();
const passphrase = process.env.PLAUD_MIRROR_ADMIN_PASSPHRASE;

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

requireCondition(Boolean(passphrase), "Operator passphrase is absent inside the runtime");

const rootResponse = await fetch(`${base}/`);
requireCondition(rootResponse.status === 200, `Static root returned ${rootResponse.status}`);
requireCondition(
  rootResponse.headers.get("content-type")?.includes("text/html"),
  "Static root did not return HTML",
);
await rootResponse.body?.cancel();

const anonymousSessionResponse = await fetch(`${base}/api/session`);
const anonymousSession = await anonymousSessionResponse.json();
requireCondition(
  anonymousSessionResponse.status === 200
    && anonymousSession.authRequired === true
    && anonymousSession.authenticated === false,
  "Anonymous session contract is not armed",
);

const anonymousConfigResponse = await fetch(`${base}/api/config`);
requireCondition(anonymousConfigResponse.status === 401, "Protected config route did not reject anonymous access");
await anonymousConfigResponse.body?.cancel();

const loginResponse = await fetch(`${base}/api/session/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ passphrase }),
});
const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
requireCondition(loginResponse.status === 200 && Boolean(cookie), "Operator login did not issue a session cookie");
await loginResponse.body?.cancel();
const authenticatedHeaders = { cookie };

const healthResponse = await fetch(`${base}/api/health`, { headers: authenticatedHeaders });
const health = await healthResponse.json();
requireCondition(healthResponse.status === 200, `Health returned ${healthResponse.status}`);
requireCondition(health.version === expectedVersion, "Health version does not match /app/VERSION");
requireCondition(health.auth?.state === "healthy", "Plaud authentication is not healthy");
requireCondition(health.scheduler?.enabled === true, "Migrated scheduler is not enabled");
requireCondition(health.activeRun === null, "A sync run is active during direct acceptance");
requireCondition(Array.isArray(health.warnings) && health.warnings.length === 0, "Health has active warnings");
requireCondition(health.coverage?.remoteTotal >= 1, "Health has no remote coverage evidence");
requireCondition(
  health.coverage.remoteTotal === health.coverage.mirrored && health.coverage.missing === 0,
  "Health coverage is not exact",
);

const protocolResponse = await fetch(
  `${base}/api/protocol/sync-jobs/plaud-mirror-recordings-sync/status`,
);
const protocol = await protocolResponse.json();
requireCondition(protocolResponse.status === 200, `Protocol status returned ${protocolResponse.status}`);
requireCondition(
  protocol.version === expectedVersion && protocol.condition === "ok" && protocol.severity === "none",
  "Protocol status is not ok/none at the expected version",
);

const recordingsResponse = await fetch(`${base}/api/recordings?limit=50`, {
  headers: authenticatedHeaders,
});
const recordings = await recordingsResponse.json();
const playable = recordings.recordings?.find((recording) => recording.localPath && !recording.dismissed);
requireCondition(recordingsResponse.status === 200 && Boolean(playable), "No playable migrated recording was returned");

const rangeResponse = await fetch(`${base}/api/recordings/${encodeURIComponent(playable.id)}/audio`, {
  headers: { ...authenticatedHeaders, range: "bytes=0-0" },
});
const rangeBytes = new Uint8Array(await rangeResponse.arrayBuffer());
requireCondition(rangeResponse.status === 206, `Authenticated Range returned ${rangeResponse.status}`);
requireCondition(rangeBytes.byteLength === 1, "Authenticated Range did not return exactly one byte");
requireCondition(
  rangeResponse.headers.get("content-range")?.startsWith("bytes 0-0/"),
  "Authenticated Range omitted the expected Content-Range",
);

console.log(JSON.stringify({
  version: expectedVersion,
  staticRoot: rootResponse.status,
  anonymousProtectedRoute: anonymousConfigResponse.status,
  health: healthResponse.status,
  protocol: `${protocol.condition}/${protocol.severity}`,
  authenticatedRange: rangeResponse.status,
  coverage: `${health.coverage.mirrored}/${health.coverage.remoteTotal}`,
}));
