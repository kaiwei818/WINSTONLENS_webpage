// The jersey number rule (public/js/tags.js): what the admin types becomes the
// numbers visitors search by. Run with: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanTags, sortTags, tagList } from "../public/js/tags.js";

test("numbers can be separated by anything", () => {
  assert.deepEqual(tagList("12 7 23"), ["12", "7", "23"]);
  assert.deepEqual(tagList("#12, #7、23"), ["12", "7", "23"]);
  assert.deepEqual(tagList("Lee 12"), ["12"]); // names are not kept
});

test("duplicates and blanks are dropped; 0 and 00 differ", () => {
  assert.equal(cleanTags(" 12, 12 ,, 7 "), "12, 7");
  assert.equal(cleanTags("0 00"), "0, 00");
  assert.equal(cleanTags(""), "");
  assert.equal(cleanTags(null), "");
});

test("at most 20 numbers of up to 3 digits", () => {
  assert.equal(tagList(Array.from({ length: 30 }, (_, i) => i).join(" ")).length, 20);
  assert.deepEqual(tagList("12345"), ["123", "45"]);
});

test("suggestions are in number order", () => {
  assert.deepEqual(sortTags(["12", "7", "100", "0"]), ["0", "7", "12", "100"]);
});
