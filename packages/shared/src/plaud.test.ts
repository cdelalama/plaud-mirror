import test from "node:test";
import assert from "node:assert/strict";

import {
  PlaudFileDetailResponseSchema,
  PlaudListResponseSchema,
  PlaudTempUrlResponseSchema,
} from "./index.js";

test("PlaudListResponseSchema normalizes recording fields", () => {
  const response = PlaudListResponseSchema.parse({
    status: 0,
    data_file_total: "1",
    data_file_list: [
      {
        id: "rec-1",
        filename: "Weekly sync",
        filesize: "4096",
        start_time: "1713780000000",
        end_time: 1713780300000,
        duration: "300000",
        edit_time: 1713780310000,
        is_trash: 0,
        is_trans: 1,
        is_summary: "true",
        serial_number: "PLAUD-123",
        scene: "7",
      },
    ],
  });

  assert.equal(response.data_file_total, 1);
  assert.equal(response.data_file_list[0]?.filesize, 4096);
  assert.equal(response.data_file_list[0]?.is_summary, true);
  assert.equal(response.data_file_list[0]?.scene, 7);
});

test("PlaudFileDetailResponseSchema keeps core metadata", () => {
  const response = PlaudFileDetailResponseSchema.parse({
    status: 0,
    data: {
      file_id: "rec-1",
      file_name: "Weekly sync",
      duration: "300000",
      is_trash: false,
      start_time: 1713780000000,
      serial_number: "PLAUD-123",
      content_list: [
        {
          data_id: "content-1",
          data_type: "transaction",
          task_status: "2",
        },
      ],
    },
  });

  assert.equal(response.data.file_id, "rec-1");
  assert.equal(response.data.duration, 300000);
  assert.equal(response.data.content_list?.[0]?.task_status, 2);
});

test("PlaudTempUrlResponseSchema supports direct temp_url", () => {
  const response = PlaudTempUrlResponseSchema.parse({
    status: 0,
    temp_url: "https://storage.example.com/audio.m4a?signature=abc",
  });

  assert.equal(response.temp_url, "https://storage.example.com/audio.m4a?signature=abc");
});
