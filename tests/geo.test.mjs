// Map places (public/js/geo.js): reading pasted places, and never showing more
// than a set's precision allows. Run with: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePlace, publicPlace } from "../public/js/geo.js";

test("reads plain numbers and map links", () => {
  assert.deepEqual(parsePlace("51.1784, -115.5708"), { lat: 51.1784, lng: -115.5708 });
  assert.deepEqual(parsePlace("25.0273 121.5764"), { lat: 25.0273, lng: 121.5764 });
  assert.deepEqual(parsePlace("https://www.google.com/maps/@25.1287,121.7419,14z"), { lat: 25.1287, lng: 121.7419 });
  // A place link: the place's own spot (!3d/!4d) wins over the map's centre (@).
  assert.deepEqual(parsePlace("https://www.google.com/maps/place/X/@25.0,121.0,12z/data=!3d25.0273!4d121.5764"), { lat: 25.0273, lng: 121.5764 });
  assert.deepEqual(parsePlace("https://maps.apple.com/?ll=51.17,-115.57&q=Banff"), { lat: 51.17, lng: -115.57 });
});

test("refuses what is not a place", () => {
  assert.equal(parsePlace(""), null);
  assert.equal(parsePlace("Banff"), null);
  assert.equal(parsePlace("https://maps.app.goo.gl/abc123"), null);
  assert.equal(parsePlace("95, 10"), null); // no latitude beyond 90
});

test("visitors never get more than the precision allows", () => {
  const set = { map_lat: 25.027312, map_lng: 121.576418 };
  assert.deepEqual(publicPlace({ ...set, map_precision: "exact" }), { lat: 25.0273, lng: 121.5764, area: false });
  assert.deepEqual(publicPlace({ ...set, map_precision: "region" }), { lat: 25, lng: 121.6, area: true });
  assert.equal(publicPlace({ ...set, map_precision: "hidden" }), null);
  assert.equal(publicPlace({ map_lat: null, map_lng: null, map_precision: "exact" }), null);
});
