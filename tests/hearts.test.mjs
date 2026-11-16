// The public hearts endpoint (functions/api/hearts.js), the one place
// visitors write to the database, run against a real SQLite database with
// all migrations. Run with: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { onRequestPost } from "../functions/api/hearts.js";
import { testDb } from "./helpers/d1.mjs";

function setup() {
  const DB = testDb();
  DB.sqlite.exec(`INSERT INTO sets (id, slug, title, published, sort_order) VALUES (1, 'banff', 'Banff', 1, 0), (2, 'draft', 'Draft', 0, 1)`);
  DB.sqlite.exec(`INSERT INTO photos (id, set_id, thumb_key, display_key, width, height) VALUES (10, 1, 't', 'd', 10, 10), (20, 2, 't', 'd', 10, 10)`);
  const heart = async (body, origin = "https://winstonlens.com") => {
    const request = new Request("https://winstonlens.com/api/hearts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, "CF-Connecting-IP": "203.0.113.5" },
      body: JSON.stringify(body),
    });
    return (await onRequestPost({ request, env: { DB } })).status;
  };
  const count = (photo) => DB.sqlite.prepare("SELECT COUNT(*) AS n FROM photo_hearts WHERE photo_id = ?").get(photo).n;
  return { heart, count };
}

test("a heart counts once per visitor, and can be taken back", async () => {
  const { heart, count } = setup();
  assert.equal(await heart({ photo_id: 10, visitor: "visitor-aaaa", on: true }), 200);
  assert.equal(await heart({ photo_id: 10, visitor: "visitor-aaaa", on: true }), 200);
  assert.equal(count(10), 1);
  assert.equal(await heart({ photo_id: 10, visitor: "visitor-bbbb", on: true }), 200);
  assert.equal(count(10), 2);
  assert.equal(await heart({ photo_id: 10, visitor: "visitor-aaaa", on: false }), 200);
  assert.equal(count(10), 1);
});

test("photos in drafts, missing photos, other sites and bad ids are refused", async () => {
  const { heart, count } = setup();
  assert.equal(await heart({ photo_id: 20, visitor: "visitor-aaaa", on: true }), 404); // draft: not even its existence is told
  assert.equal(count(20), 0);
  assert.equal(await heart({ photo_id: 999, visitor: "visitor-aaaa", on: true }), 404);
  assert.equal(await heart({ photo_id: 10, visitor: "visitor-aaaa", on: true }, "https://evil.example"), 403);
  assert.equal(await heart({ photo_id: 10, visitor: "x", on: true }), 400);
  assert.equal(count(10), 0);
});
