import test from "node:test";
import assert from "node:assert/strict";

import {
  PlaudClient,
  buildPlaudApiUrl,
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
