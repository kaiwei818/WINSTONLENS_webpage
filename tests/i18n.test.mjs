// The English / 繁體中文 strings (lib/i18n.js): nothing missing, Taiwan
// wording only, and the helpers. Run with: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { CLIENT_KEYS, TEXT, joinList, langOf, monthYear, translator } from "../lib/i18n.js";

// Words used in Mainland China where Taiwan says something else.
const MAINLAND = ["視頻", "鏈接", "信息", "默認", "設置", "搜索", "屏幕", "軟件", "網絡", "用戶", "質量", "點擊", "登錄", "文件", "圖片", "保存", "打印", "博客", "視圖", "菜單"];

test("every English string has a Chinese one, and the other way round", () => {
  assert.deepEqual(Object.keys(TEXT.zh).sort(), Object.keys(TEXT.en).sort());
  for (const key of CLIENT_KEYS) assert.ok(key in TEXT.en, `client key ${key} is missing`);
});

test("Chinese uses Taiwan wording only", () => {
  const all = JSON.stringify(TEXT.zh);
  for (const word of MAINLAND) assert.ok(!all.includes(word), `uses the Mainland word ${word}`);
});

test("plurals, values, months and lists", () => {
  const en = translator("en");
  const zh = translator("zh");
  assert.equal(en("photos", { n: 1 }), "1 photo");
  assert.equal(en("photos", { n: 6 }), "6 photos");
  assert.equal(zh("photos", { n: 6 }), "6 張照片");
  assert.equal(zh("find.result", { n: 4, number: "12" }), "#12 共 4 張照片");
  assert.equal(monthYear("2026-03-15", "en"), "March 2026");
  assert.equal(monthYear("2026-03-15 08:30:00", "zh"), "2026 年 3 月");
  assert.equal(monthYear("", "zh"), "");
  assert.equal(joinList(["landscape", "sports", "travel"], "en"), "landscape, sports and travel");
  assert.equal(joinList(["風景", "運動", "旅行"], "zh"), "風景、運動與旅行");
});

test("the visitor's language: their choice first, then their browser", () => {
  const request = (headers, query = "") => new Request(`https://winstonlens.com/${query}`, { headers });
  assert.equal(langOf(request({ Cookie: "lang=en" }, "?lang=zh")), "zh"); // a shared ?lang=zh link wins
  assert.equal(langOf(request({ Cookie: "theme=dark; lang=zh" })), "zh");
  assert.equal(langOf(request({ Cookie: "lang=en", "Accept-Language": "zh-TW" })), "en");
  assert.equal(langOf(request({ "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8" })), "zh");
  assert.equal(langOf(request({ "Accept-Language": "en-CA,en;q=0.9,zh;q=0.5" })), "en");
  assert.equal(langOf(request({})), "en");
});
