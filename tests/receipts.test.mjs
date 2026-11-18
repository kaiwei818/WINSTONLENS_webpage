// Download receipt emails (lib/receipts.js): a group of downloads with one
// code makes one email, against the real tables. Run with: npm test

import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { QUIET_SECONDS, deviceOf, recordReceipt } from "../lib/receipts.js";
import { testDb } from "./helpers/d1.mjs";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const license = { id: 7, code: "WL-AAAA-BBBB", label: "Jane" };
const photo = (id) => ({ id, set_id: 1, title: "Taiwan barbet", original_name: `IMG_${id}.jpg` });

function setup({ accepted = true } = {}) {
  const env = { DB: testDb(), EMAIL_API_TOKEN: "token", RECEIPT_EMAIL: "me@example.com", CLOUDFLARE_ACCOUNT_ID: "acct" };
  const background = [];
  const context = {
    env,
    request: {
      url: "https://winstonlens.com/api/download/1",
      cf: { city: "Taipei", region: "Taipei City", country: "TW", postalCode: "100", asOrganization: "Chunghwa Telecom", timezone: "Asia/Taipei" },
      headers: new Headers({ "User-Agent": IPHONE }),
    },
    waitUntil: (promise) => background.push(promise),
  };
  const sent = [];
  mock.method(globalThis, "fetch", async (url, init) => {
    sent.push({ url, auth: init.headers.Authorization, ...JSON.parse(init.body) });
    return new Response("", { status: accepted ? 200 : 403 });
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
  assert.equal(sent[0].url, "https://api.cloudflare.com/client/v4/accounts/acct/email/sending/send");
  assert.equal(sent[0].auth, "Bearer token");
  assert.deepEqual(sent[0].from, { address: "receipts@winstonlens.com", name: "winstonlens downloads" });
  assert.equal(sent[0].to, "me@example.com");
  assert.equal(sent[0].subject, "Download: Taiwan barbet (WL-AAAA-BBBB (Jane)), 3 photos");
  assert.match(sent[0].text, /3 clean photos/);
  assert.match(sent[0].text, /Where: {4}Taipei, Taipei City, 100, TW\n/);
  assert.match(sent[0].text, /Network: {2}Chunghwa Telecom\n/);
  assert.match(sent[0].text, /Device: {3}iPhone, Safari\n/);
  assert.match(sent[0].text, /When: {5}.* UTC \(\d\d:\d\d in Asia\/Taipei\)/);
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
  const { env, context, quiet } = setup({ accepted: false });

  await recordReceipt(context, { license, photo: photo(1), viaAll: false });
  await quiet();
  const left = env.DB.sqlite.prepare("SELECT COUNT(*) AS n FROM download_receipts WHERE emailed = 0").get();
  assert.equal(left.n, 1);
});

test("without the email secrets, receipts are saved and nothing is sent", async (t) => {
  t.after(() => mock.restoreAll());
  const { env, context, sent } = setup();
  delete env.EMAIL_API_TOKEN;
  await recordReceipt(context, { license, photo: photo(1), viaAll: false });
  assert.equal(sent.length, 0);
  assert.equal(env.DB.sqlite.prepare("SELECT emailed FROM download_receipts").get().emailed, 1);
});

test("the device and browser, from the User-Agent", () => {
  const cases = {
    [IPHONE]: "iPhone, Safari",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1": "iPhone, Chrome",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36": "Mac, Chrome",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0": "Windows, Edge",
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36": "Android phone, Samsung Internet",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.1; rv:132.0) Gecko/20100101 Firefox/132.0": "Mac, Firefox",
    "curl/8.4.0": "curl/8.4.0",
    "": "unknown",
  };
  for (const [ua, want] of Object.entries(cases)) assert.equal(deviceOf(ua), want, ua);
});
