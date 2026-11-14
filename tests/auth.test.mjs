// The signed session cookie is the lock on the whole admin area (lib/auth.js).
// These check that the lock holds: a fresh cookie opens it, an edited, expired
// or made-up one does not. Run with: npm test

import assert from "node:assert/strict";
import { test } from "node:test";
import { createSessionCookie, isLoggedIn } from "../lib/auth.js";

const env = { SESSION_SECRET: "test-secret-that-is-at-least-32-characters-long" };
const SITE = "https://winstonlens.com/admin/";

// "session=<expiry>.<signature>; Path=/; ..." -> "<expiry>.<signature>"
const valueOf = (header) => header.split(";")[0].slice("session=".length);
const withCookie = (value) => new Request(SITE, { headers: { Cookie: `session=${value}` } });

test("a fresh cookie is accepted", async () => {
  const value = valueOf(await createSessionCookie(new Request(SITE), env));
  assert.equal(await isLoggedIn(withCookie(value), env), true);
});

test("a cookie with an edited expiry is refused", async () => {
  const [expiry, signature] = valueOf(await createSessionCookie(new Request(SITE), env)).split(".");
  assert.equal(await isLoggedIn(withCookie(`${Number(expiry) + 86400}.${signature}`), env), false);
});

test("a cookie signed with another secret is refused", async () => {
  const value = valueOf(await createSessionCookie(new Request(SITE), { SESSION_SECRET: "x".repeat(40) }));
  assert.equal(await isLoggedIn(withCookie(value), env), false);
});

test("an expired cookie is refused, even with a real signature", async () => {
  const realNow = Date.now;
  Date.now = () => realNow() - 8 * 24 * 60 * 60 * 1000; // made 8 days ago; sessions last 7
  const value = valueOf(await createSessionCookie(new Request(SITE), env));
  Date.now = realNow;
  assert.equal(await isLoggedIn(withCookie(value), env), false);
});

test("no cookie or garbage is refused", async () => {
  assert.equal(await isLoggedIn(new Request(SITE), env), false);
  assert.equal(await isLoggedIn(withCookie("garbage"), env), false);
  assert.equal(await isLoggedIn(withCookie("9999999999.%%%"), env), false);
});
