// A stand-in for Cloudflare D1, on Node's built-in SQLite, with every
// migration applied: lets tests run the real request handlers. Test only.

import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export function testDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const dir = new URL("../../migrations/", import.meta.url);
  for (const file of readdirSync(dir).sort()) sqlite.exec(readFileSync(new URL(file, dir), "utf8"));

  const plain = (v) => (v === undefined ? null : typeof v === "boolean" ? Number(v) : v);
  const statement = (sql) => {
    let args = [];
    const run = () => {
      const prepared = sqlite.prepare(sql);
      if (/^\s*select|returning/i.test(sql)) return { results: prepared.all(...args), meta: { changes: 0 } };
      return { results: [], meta: { changes: Number(prepared.run(...args).changes) } };
    };
    return {
      bind(...values) { args = values.map(plain); return this; },
      async first() { return run().results[0] ?? null; },
      async all() { return run(); },
      async run() { return run(); },
      run_: run,
    };
  };
  return {
    sqlite, // for setting up rows in a test
    prepare: statement,
    async batch(list) {
      sqlite.exec("BEGIN");
      try {
        const results = list.map((s) => s.run_());
        sqlite.exec("COMMIT");
        return results;
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    },
  };
}
