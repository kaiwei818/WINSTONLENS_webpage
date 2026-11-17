// Download receipt emails (lib/receipts.js): a group of downloads with one
// code makes one email, against the real tables. Run with: npm test

import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { QUIET_SECONDS, recordReceipt } from "../lib/receipts.js";
import { testDb } from "./helpers/d1.mjs";

const license = { id: 7, code: "WL-AAAA-BBBB", label: "Jane" };
const photo = (id) => ({ id, set_id: 1, title: "Taiwan barbet", original_name: `IMG_${id}.jpg` });

function setup({ resendOk = true } = {}) {
  const env = { DB: testDb(), RESEND_API_KEY: "key", RECEIPT_EMAIL: "me@example.com" };
  const background = [];
  const context = {
    env,
    request: { url: "https://winstonlens.com/api/download/1", cf: { city: "Taipei", region: "Taipei City", country: "TW" } },
    waitUntil: (promise) => background.push(promise),
  };
  const sent = [];
  mock.method(globalThis, "fetch", async (_url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response("", { status: resendOk ? 200 : 500 });
  });
  const quiet = async () => {
    mock.timers.tick(QUIET_SECONDS * 1000);
    await Promise.all(background.splice(0));
  };
  return { env, context, sent, quiet };
}

test("a Download all of three photos sends one email listing all three", async (t) => {
  mock.timers.enable({ apis: ["setTimeout"] });
  t.after(() => { mock.timers.reset(); mock.restoreAll(); });
  const { context, sent, quiet } = setup();

  for (const id of [1, 2, 3]) await recordReceipt(context, { license, photo: photo(id), viaAll: true });
  await quiet();

  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, "Download: Taiwan barbet (WL-AAAA-BBBB (Jane)), 3 photos");
  assert.match(sent[0].text, /3 clean photos/);
  assert.match(sent[0].text, /Where: {2}Taipei, Taipei City, TW/);
  for (const id of [1, 2, 3]) assert.match(sent[0].text, new RegExp(`#${id} IMG_${id}\\.jpg, .* UTC, Download all`));

  // A later download is a new group: only that photo.
  await recordReceipt(context, { license, photo: photo(4), viaAll: false });
  await quiet();
  assert.equal(sent.length, 2);
  assert.match(sent[1].text, /A clean photo was downloaded/);
  assert.doesNotMatch(sent[1].text, /#1 /);
});

test("a failed email goes into the next one instead", async (t) => {
  mock.timers.enable({ apis: ["setTimeout"] });
  t.after(() => { mock.timers.reset(); mock.restoreAll(); });
  const { env, context, quiet } = setup({ resendOk: false });

  await recordReceipt(context, { license, photo: photo(1), viaAll: false });
  await quiet();
  const left = env.DB.sqlite.prepare("SELECT COUNT(*) AS n FROM download_receipts WHERE emailed = 0").get();
  assert.equal(left.n, 1);
});

test("without the email secrets, receipts are saved and nothing is sent", async (t) => {
  t.after(() => mock.restoreAll());
  const { env, context, sent } = setup();
  delete env.RESEND_API_KEY;
  await recordReceipt(context, { license, photo: photo(1), viaAll: false });
  assert.equal(sent.length, 0);
  assert.equal(env.DB.sqlite.prepare("SELECT emailed FROM download_receipts").get().emailed, 1);
});
