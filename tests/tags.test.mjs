// The player tag rule (public/js/tags.js): what the admin types becomes the
// tags visitors filter by. Run with: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanTags, sortTags, tagLabel, tagList } from "../public/js/tags.js";

test("numbers may be separated by spaces, names by commas", () => {
  assert.deepEqual(tagList("12 7 23"), ["12", "7", "23"]);
  assert.deepEqual(tagList("12 7, Lee Chen"), ["12", "7", "Lee Chen"]);
  assert.deepEqual(tagList("#12, #7"), ["12", "7"]);
  assert.deepEqual(tagList("Coach  Wang，12、7"), ["Coach Wang", "12", "7"]);
});

test("duplicates, blanks and extra spaces are dropped", () => {
  assert.equal(cleanTags(" 12, 12 , lee chen, Lee Chen,, "), "12, lee chen");
  assert.equal(cleanTags(""), "");
  assert.equal(cleanTags(null), "");
});

test("there is a limit on count and length", () => {
  assert.equal(tagList(Array.from({ length: 30 }, (_, i) => i).join(" ")).length, 20);
  assert.equal(tagList("x".repeat(100))[0].length, 40);
});

test("chips: numbers in number order first, then names", () => {
  assert.deepEqual(sortTags(["Lee", "12", "7", "Amy", "100"]), ["7", "12", "100", "Amy", "Lee"]);
  assert.equal(tagLabel("12"), "#12");
  assert.equal(tagLabel("Lee Chen"), "Lee Chen");
});
