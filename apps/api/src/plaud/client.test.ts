import test from "node:test";
import assert from "node:assert/strict";

import {
  PlaudApiError,
  PlaudAuthError,
  PlaudClient,
  buildPlaudApiUrl,
  extractTempUrl,
  extractRegionalApiBase,
  isRegionMismatchPayload,
  normalizeApiBase,
  shouldRetryWithRegionalApi,
} from "./client.js";

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

test("normalizeApiBase only accepts plaud hosts", () => {
  assert.equal(normalizeApiBase("api.plaud.ai"), "https://api.plaud.ai");
  assert.equal(normalizeApiBase("https://api-apne1.plaud.ai/"), "https://api-apne1.plaud.ai");
  assert.equal(normalizeApiBase("https://example.com"), null);
});

test("region mismatch helpers detect alternate api hosts", () => {
  const payload = {
    status: -302,
    msg: "user region mismatch",
    data: {
      domains: {
        api: "https://api-apne1.plaud.ai",
      },
    },
  };

  assert.equal(isRegionMismatchPayload(payload), true);
  assert.equal(extractRegionalApiBase(payload), "https://api-apne1.plaud.ai");
  assert.equal(
    shouldRetryWithRegionalApi(payload, "https://api.plaud.ai", "https://api-apne1.plaud.ai"),
    true,
  );
});

test("buildPlaudApiUrl keeps slash handling stable", () => {
  assert.equal(
    buildPlaudApiUrl("/file/simple/web", "https://api.plaud.ai"),
    "https://api.plaud.ai/file/simple/web",
  );
  assert.equal(
    buildPlaudApiUrl("file/simple/web", "https://api.plaud.ai"),
    "https://api.plaud.ai/file/simple/web",
  );
});

test("listEverything paginates until the final page arrives partial and reports the real total", async () => {
  const makePage = (count: number, offset: number): unknown => ({
    status: 0,
    data_file_total: count,
    data_file_list: Array.from({ length: count }, (_, index) => ({
      id: `rec-${offset + index + 1}`,
      filename: "audio",
      filesize: 100,
      start_time: 1713780000000,
      end_time: 1713780300000,
      duration: 100,
      edit_time: 1713780310000,
      is_trash: false,
      is_trans: true,
      is_summary: false,
      serial_number: "PLAUD-1",
    })),
  });

  const calls: string[] = [];
  const responses = [
    createJsonResponse(makePage(500, 0)),
    createJsonResponse(makePage(53, 500)),
  ];
  const client = new PlaudClient({
    accessToken: "token",
    fetchImpl: async (input) => {
      calls.push(String(input));
      const next = responses.shift();
      if (!next) {
        throw new Error("unexpected extra fetch");
      }
      return next;
    },
  });

  const { recordings, total } = await client.listEverything(500);
  assert.equal(recordings.length, 553);
  assert.equal(total, 553);
  assert.equal(calls.length, 2, "should stop as soon as a page arrives shorter than pageSize");
  assert.ok(calls[0]?.includes("skip=0"));
  assert.ok(calls[1]?.includes("skip=500"));
});

test("PlaudClient retries with a regional host when Plaud requests it", async () => {
  const calls: string[] = [];
  const responses = [
    createJsonResponse({
      status: -302,
      msg: "user region mismatch",
      data: {
        domains: {
          api: "https://api-apne1.plaud.ai",
        },
      },
    }),
    createJsonResponse({
      status: 0,
      data_file_total: 1,
      data_file_list: [
        {
          id: "rec-1",
          filename: "Weekly sync",
          filesize: 2048,
          start_time: 1713780000000,
          end_time: 1713780300000,
          duration: 300000,
          edit_time: 1713780310000,
          is_trash: false,
          is_trans: true,
          is_summary: false,
          serial_number: "PLAUD-1",
        },
      ],
    }),
  ];

  const client = new PlaudClient({
    accessToken: "token-value",
    fetchImpl: async (input) => {
      calls.push(String(input));
      const next = responses.shift();
      if (!next) {
        throw new Error("unexpected extra fetch call");
      }
      return next;
    },
  });

  const response = await client.listRecordings({ limit: 1 });

  assert.equal(response.data_file_list.length, 1);
  assert.equal(calls[0], "https://api.plaud.ai/file/simple/web?skip=0&limit=1&is_trash=2&sort_by=start_time&is_desc=true");
  assert.equal(calls[1], "https://api-apne1.plaud.ai/file/simple/web?skip=0&limit=1&is_trash=2&sort_by=start_time&is_desc=true");
  assert.equal(client.getResolvedApiBase(), "https://api-apne1.plaud.ai");
});

test("PlaudClient throws PlaudAuthError on 401", async () => {
  const client = new PlaudClient({
    accessToken: "token-value",
    fetchImpl: async () => createJsonResponse({ status: 401, msg: "expired" }, 401),
  });

  await assert.rejects(
    () => client.getCurrentUser(),
    (error: unknown) => error instanceof PlaudAuthError && error.message.includes("401"),
  );
});

test("PlaudClient throws PlaudApiError on non-JSON success body", async () => {
  const client = new PlaudClient({
    accessToken: "token-value",
    fetchImpl: async () => new Response("not-json", { status: 200 }),
  });

  await assert.rejects(
    () => client.getCurrentUser(),
    (error: unknown) => error instanceof PlaudApiError && error.message.includes("non-JSON"),
  );
});

test("listDevices translates Plaud wire fields to the domain Device type", async () => {
  const fetchImpl = (async () => {
    return createJsonResponse({
      status: 0,
      msg: "success",
      data_devices: [
        {
          sn: "PLAUD-ABC123",
          name: "Office recorder",
          model: "888",
          version_number: 131339,
        },
        {
          sn: "PLAUD-DEF456",
          name: "",
          model: "888",
          version_number: 131339,
        },
        {
          // Defensive: wire may omit name/model/version on new/edge devices.
          sn: "PLAUD-GHI789",
        },
      ],
    });
  }) as unknown as typeof fetch;

  const client = new PlaudClient({
    accessToken: "token",
    fetchImpl,
  });

  const devices = await client.listDevices();

  assert.equal(devices.length, 3);
  assert.equal(devices[0]?.serialNumber, "PLAUD-ABC123");
  assert.equal(devices[0]?.displayName, "Office recorder");
  assert.equal(devices[0]?.model, "888");
  assert.equal(devices[0]?.firmwareVersion, 131339);
  assert.equal(typeof devices[0]?.lastSeenAt, "string");

  // Missing display name is normalized to "" (not null/undefined) so the UI
  // can string-concat without optional chaining.
  assert.equal(devices[1]?.displayName, "");

  // Fully minimal device still parses with safe defaults.
  assert.equal(devices[2]?.serialNumber, "PLAUD-GHI789");
  assert.equal(devices[2]?.displayName, "");
  assert.equal(devices[2]?.model, "");
  assert.equal(devices[2]?.firmwareVersion, null);
});

test("listDevices skips entries with an empty serial number", async () => {
  const fetchImpl = (async () => {
    return createJsonResponse({
      status: 0,
      data_devices: [
        { sn: "", name: "broken", model: "888" },
        { sn: "PLAUD-VALID", name: "good", model: "888" },
      ],
    });
  }) as unknown as typeof fetch;

  const client = new PlaudClient({
    accessToken: "token",
    fetchImpl,
  });

  const devices = await client.listDevices();
  assert.equal(devices.length, 1);
  assert.equal(devices[0]?.serialNumber, "PLAUD-VALID");
});

test("extractTempUrl accepts nested data.temp_url and rejects missing temp urls", () => {
  assert.equal(
    extractTempUrl({
      status: 0,
      data: {
        temp_url: "https://storage.example.com/audio.m4a",
      },
    }, "rec-1"),
    "https://storage.example.com/audio.m4a",
  );

  assert.throws(
    () => extractTempUrl({ status: 0 }, "rec-1"),
    (error: unknown) => error instanceof PlaudApiError && error.message.includes("no temp_url"),
  );
});
