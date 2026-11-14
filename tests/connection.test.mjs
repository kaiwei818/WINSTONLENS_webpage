// When does the photo viewer treat a connection as slow (public/js/connection.js)?
// Run with: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { judge, kbpsFromEntries } from "../public/js/connection.js";

const KB = 1024;
// A download as the browser records it: its size, and when the bytes arrived.
const entry = (bytes, ms, { cached = false, wait = 50 } = {}) => ({
  encodedBodySize: bytes, transferSize: cached ? 0 : bytes + 300,
  responseStart: wait, responseEnd: wait + ms, duration: wait + ms,
});

test("data saver and 2g/3g are slow, whatever was measured", () => {
  assert.deepEqual(judge({ saveData: true, fullKbps: 90000 }), { slow: true, reason: "data-saver" });
  for (const type of ["slow-2g", "2g", "3g"]) assert.equal(judge({ effectiveType: type }).slow, true);
  assert.equal(judge({ effectiveType: "4g" }).slow, false);
});

test("nothing measured means not slow: the viewer behaves as before", () => {
  assert.deepEqual(judge({}), { slow: false, reason: "unknown" });
});

test("a full-size photo that would take over 2.5 seconds is slow", () => {
  // A 1.5 MB photo in 2.5 seconds needs about 4900 kbps.
  assert.equal(judge({ fullKbps: 4000 }).slow, true);
  assert.equal(judge({ fullKbps: 6000 }).slow, false);
});

test("a full-size measurement replaces the guess from grid photos", () => {
  assert.deepEqual(judge({ fullKbps: 20000, gridKbps: 500 }), { slow: false, reason: "measured" });
  // Grid photos alone: doubled, since small files travel slower than the line.
  assert.deepEqual(judge({ gridKbps: 3000 }), { slow: false, reason: "estimated" });
  assert.equal(judge({ gridKbps: 2000 }).slow, true);
});

test("speed comes from real downloads only", () => {
  // 150 KB in 300 ms = 4096 kbps.
  assert.equal(Math.round(kbpsFromEntries([entry(150 * KB, 300)])), 4096);
  // Saved copies, tiny files and instant answers say nothing.
  assert.equal(kbpsFromEntries([entry(150 * KB, 300, { cached: true }), entry(5 * KB, 40), entry(150 * KB, 2)]), 0);
  assert.equal(kbpsFromEntries([]), 0);
});

test("one stalled photo does not decide it, and full-size photos count the whole wait", () => {
  const speeds = [entry(150 * KB, 100), entry(150 * KB, 100), entry(150 * KB, 6000)];
  assert.equal(Math.round(kbpsFromEntries(speeds)), 12288);
  // 1.5 MB arriving over 3 s after a 1 s wait: 4 s in all.
  assert.equal(Math.round(kbpsFromEntries([entry(1536 * KB, 3000, { wait: 1000 })], { whole: true })), 3146);
});
