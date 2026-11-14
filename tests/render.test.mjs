// The home page tells the browser how wide each cover appears (cardSizes in
// lib/render.js), following the grid in style.css. These pin the widths that
// were measured in a real browser at 1440 px. Run with: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { cardSizes, setCardHtml } from "../lib/render.js";

const computer = (index, count) => cardSizes(index, count).sizes.match(/min\(.*\)$/)[0];

test("a full run of five: wide, narrow, then three across", () => {
  assert.equal(computer(0, 5), "min(58vw, 777px)");
  assert.equal(computer(1, 5), "min(42vw, 551px)");
  for (const index of [2, 3, 4]) assert.equal(computer(index, 5), "min(33vw, 437px)");
});

test("a run that ends early stretches its last cards", () => {
  assert.deepEqual(cardSizes(0, 1), {
    sizes: "(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) calc(100vw - 32px), min(100vw, 1344px)",
    full: true,
  });
  assert.equal(computer(2, 3), "min(100vw, 1344px)"); // three sets: the third takes the row
  assert.equal(computer(2, 4), "min(50vw, 664px)");   // four sets: the last two share it
  assert.equal(computer(3, 4), "min(50vw, 664px)");
  assert.equal(computer(5, 6), "min(100vw, 1344px)"); // a lone card starting a second run
});

test("on tablets only an odd card left at the end takes the whole row", () => {
  const tablet = (index, count) => cardSizes(index, count).sizes.match(/\(max-width: 1023px\) [^,]+/)[0];
  assert.equal(tablet(0, 2), "(max-width: 1023px) 50vw");
  assert.equal(tablet(2, 3), "(max-width: 1023px) calc(100vw - 32px)");
  assert.equal(tablet(3, 4), "(max-width: 1023px) 50vw");
});

test("only a page-wide card is offered the large viewer file", () => {
  const set = {
    slug: "kyoto", title: "Kyoto", photo_count: 3, cover_width: 3000, cover_height: 2000,
    cover_small_key: "s.jpg", cover_thumb_key: "t.jpg", cover_display_key: "d.jpg",
  };
  const sets = [set, set, set];
  assert.ok(!setCardHtml(set, 0, sets).includes("/img/d.jpg"));
  assert.ok(setCardHtml(set, 2, sets).includes("/img/d.jpg 3000w"));
});
