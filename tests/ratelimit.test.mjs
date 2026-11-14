// The rate limits on license codes and downloads (lib/ratelimit.js), against
// a small stand-in for the database. Run with: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { hit, LIMITS } from "../lib/ratelimit.js";

// Just enough of D1 for the four statements ratelimit.js uses. `pause` makes
// every database call wait a moment, so requests really overlap.
function fakeDb() {
  let rows = [];
  let nextId = 1;
  const run = (sql, args) => {
    if (sql.startsWith("INSERT")) {
      const row = { rowid: nextId++, bucket: args[0], key: args[1], at: args[2] };
      rows.push(row);
      return { results: [{ rowid: row.rowid }] };
    }
    if (sql.startsWith("DELETE FROM rate_hits WHERE rowid")) {
      rows = rows.filter((r) => r.rowid !== args[0]);
      return { results: [] };
    }
    if (sql.startsWith("DELETE")) {
      rows = rows.filter((r) => !(r.bucket === args[0] && r.at <= args[1]));
      return { results: [] };
    }
    const found = rows.filter((r) => r.bucket === args[0] && r.key === args[1] && r.at > args[2]);
    return { results: [{ hits: found.length, oldest: found.length ? Math.min(...found.map((r) => r.at)) : null }] };
  };
  const pause = () => new Promise((resolve) => setTimeout(resolve, 1));
  const statement = (sql, args = []) => ({
    sql, args,
    bind: (...values) => statement(sql, values),
    first: async () => { await pause(); return run(sql, args).results[0]; },
    run: async () => { await pause(); return run(sql, args); },
  });
  return {
    prepare: (sql) => statement(sql.trim()),
    // One batch is one transaction: its statements run together, in order.
    batch: async (statements) => { await pause(); return statements.map((s) => run(s.sql, s.args)); },
    count: () => rows.length,
  };
}

const { max } = LIMITS.license_check;

test("requests up to the limit pass, the next one waits", async () => {
  const env = { DB: fakeDb() };
  for (let n = 1; n <= max; n++) {
    const result = await hit({ env }, "license_check", "1.2.3.4");
    assert.equal(result.ok, true);
    assert.equal(Boolean(result.justReachedLimit), n === max);
  }
  const refused = await hit({ env }, "license_check", "1.2.3.4");
  assert.equal(refused.ok, false);
  assert.ok(refused.retryAfter > 0);
  // Another address is not affected.
  assert.equal((await hit({ env }, "license_check", "5.6.7.8")).ok, true);
});

test("a burst at the same moment cannot squeeze past the limit", async () => {
  const env = { DB: fakeDb() };
  const results = await Promise.all(
    Array.from({ length: max * 3 }, () => hit({ env }, "license_check", "1.2.3.4"))
  );
  assert.equal(results.filter((r) => r.ok).length, max);
});

test("refused requests leave no record behind, and looking does not count", async () => {
  const env = { DB: fakeDb() };
  for (let n = 0; n < max + 5; n++) await hit({ env }, "license_check", "1.2.3.4");
  assert.equal(env.DB.count(), max);
  assert.equal((await hit({ env }, "license_check", "1.2.3.4", { count: false })).ok, false);
  assert.equal((await hit({ env }, "license_check", "9.9.9.9", { count: false })).ok, true);
  assert.equal(env.DB.count(), max);
});
