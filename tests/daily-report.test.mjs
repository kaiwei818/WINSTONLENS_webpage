// The daily update email (lib/daily-report.js) and the address that sends it
// (functions/api/daily-report.js), against the real tables. Run with: npm test

import assert from "node:assert/strict";
import { timingSafeEqual } from "node:crypto";
import { mock, test } from "node:test";
import { dailyReport } from "../lib/daily-report.js";
import { onRequestPost } from "../functions/api/daily-report.js";
import { testDb } from "./helpers/d1.mjs";

// Cloudflare has this; Node keeps it elsewhere.
crypto.subtle.timingSafeEqual ??= (a, b) => timingSafeEqual(new Uint8Array(a), new Uint8Array(b));

const NOW = new Date("2026-11-18T15:00:00Z");
const ago = (hours) => new Date(NOW - hours * 3600 * 1000).toISOString().slice(0, 19) + "Z";

function seeded() {
  const db = testDb();
  db.sqlite.exec(`
    INSERT INTO sets (id, slug, title) VALUES (1, 'thunder', 'Vikings vs Thunder'), (2, 'banff', 'Banff');
    INSERT INTO photos (id, set_id, thumb_key, display_key, width, height) VALUES (10, 1, 't', 'd', 1, 1), (11, 1, 't', 'd', 1, 1), (20, 2, 't', 'd', 1, 1);
    INSERT INTO activity_log (at, action, summary, set_id) VALUES
      ('${ago(2)}', 'upload', 'Uploaded photo #10', 1), ('${ago(2)}', 'upload', 'Uploaded photo #11', 1),
      ('${ago(3)}', 'license_create', 'Created code WL-AAAA-BBBB (Jane)', 1),
      ('${ago(4)}', 'login', 'Logged in', NULL),
      ('${ago(5)}', 'login_failed', 'Wrong password', NULL), ('${ago(5)}', 'login_failed', 'Wrong password', NULL),
      ('${ago(5)}', 'login_failed', 'Wrong password', NULL),
      ('${ago(30)}', 'publish', 'Published "Old news"', 2);
    INSERT INTO download_receipts (at, code_id, code, code_label, set_id, set_title, photo_id, city, country, network, device) VALUES
      ('${ago(1)}', 7, 'WL-AAAA-BBBB', 'Jane', 1, 'Vikings vs Thunder', 10, 'Calgary', 'CA', 'TELUS', 'iPhone, Safari'),
      ('${ago(1)}', 7, 'WL-AAAA-BBBB', 'Jane', 1, 'Vikings vs Thunder', 11, 'Calgary', 'CA', 'TELUS', 'Mac, Chrome'),
      ('${ago(40)}', 7, 'WL-AAAA-BBBB', 'Jane', 1, 'Vikings vs Thunder', 11, 'Calgary', 'CA', '', '');
    INSERT INTO photo_hearts (photo_id, visitor, created_at) VALUES (10, 'a', '${ago(6)}'), (11, 'b', '${ago(6)}'), (20, 'c', '${ago(50)}');
  `);
  return db;
}

test("the last 24 hours, summed up by set", async () => {
  const { subject, text } = await dailyReport({ DB: seeded() }, "https://winstonlens.com", NOW);
  assert.equal(subject, "winstonlens daily: 2 downloads, 2 new likes, ⚠ 3 failed logins");
  assert.match(text, /Downloads:\n {2}Vikings vs Thunder: 2 photos with WL-AAAA-BBBB \(Jane\), from Calgary, CA · TELUS · iPhone, Safari; Mac, Chrome\n/);
  assert.match(text, /New likes:\n {2}Vikings vs Thunder: 2\n/);
  assert.match(text, /Uploads:\n {2}Vikings vs Thunder: 2 photos\n/);
  assert.match(text, /License codes:\n {2}Created code WL-AAAA-BBBB \(Jane\)\n/);
  assert.match(text, /Logins to the admin pages: 1\n {2}Failed logins: 3 \(not you\?/);
  assert.doesNotMatch(text, /Old news|Banff/); // older than a day
});

test("a quiet day still says so", async () => {
  const { subject, text } = await dailyReport({ DB: testDb() }, "https://winstonlens.com", NOW);
  assert.equal(subject, "winstonlens daily: a quiet day");
  assert.match(text, /Nothing new/);
});

test("the address needs the secret, then sends the email", async (t) => {
  t.after(() => mock.restoreAll());
  const sent = [];
  mock.method(globalThis, "fetch", async (_url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response("{}", { status: 200 });
  });
  const env = { DB: seeded(), REPORT_SECRET: "s3cret", EMAIL_API_TOKEN: "t", RECEIPT_EMAIL: "me@example.com", CLOUDFLARE_ACCOUNT_ID: "a" };
  const call = (auth) => onRequestPost({ env, request: new Request("https://winstonlens.com/api/daily-report", { method: "POST", headers: auth ? { Authorization: auth } : {} }) });

  assert.equal((await call()).status, 404);
  assert.equal((await call("Bearer wrong")).status, 404);
  assert.equal(sent.length, 0);
  assert.equal((await call("Bearer s3cret")).status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].from.name, "winstonlens daily");
  assert.match(sent[0].subject, /^winstonlens daily: /);
});
