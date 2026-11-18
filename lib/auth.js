// Everything about "who is logged in" lives here.
//
// Two ideas to understand:
//
// 1. Password hashing. We never store your password, only a "hash" of it: a
//    scrambled fingerprint that cannot be turned back into the password. To
//    check a login, we hash what was typed and compare fingerprints. PBKDF2
//    repeats the scrambling 100,000 times on purpose, so someone who steals the
//    hash needs a very long time to guess passwords against it.
//
// 2. Signed session cookie. After a correct login, the server gives the browser
//    a cookie like "1760000000.Xyz...". The first part is the expiry time. The
//    second part is a signature made with SESSION_SECRET, which only the server
//    knows. If anyone edits the expiry, the signature no longer matches, so the
//    cookie cannot be forged. HttpOnly means JavaScript on the page cannot read
//    it, so a malicious script cannot steal it.

const encoder = new TextEncoder();
const COOKIE_NAME = "session";
const SESSION_SECONDS = 7 * 24 * 60 * 60; // stay logged in for 7 days

// ---------- Password ----------

// The stored hash looks like "pbkdf2:100000:<salt>:<hash>" (made by scripts/hash-password.mjs).
export async function verifyPassword(password, stored) {
  const [scheme, iterations, saltBase64, hashBase64] = stored.split(":");
  if (scheme !== "pbkdf2") throw new Error("ADMIN_PASSWORD_HASH has the wrong format");

  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const actual = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltBase64), iterations: Number(iterations) },
    key,
    256
  );
  const expected = fromBase64(hashBase64);

  // timingSafeEqual takes the same time whether the first byte or the last byte
  // differs, so an attacker cannot learn anything from how long the check took.
  return actual.byteLength === expected.byteLength &&
    crypto.subtle.timingSafeEqual(actual, expected);
}

// ---------- Username ----------

// The username is compared without caring about capital letters or spaces
// around it, the way email addresses usually work.
// Both values are first turned into fixed-length fingerprints (SHA-256), so the
// comparison takes the same time whatever was typed, like the password check.
export async function verifyUsername(typed, expected) {
  const normalize = (text) => String(text).trim().toLowerCase();
  return sameSecret(normalize(typed), normalize(expected));
}

// Two texts compared in the same time whatever they hold (fingerprints first),
// for secrets such as REPORT_SECRET.
export async function sameSecret(given, expected) {
  const [a, b] = await Promise.all([given, expected].map((text) =>
    crypto.subtle.digest("SHA-256", encoder.encode(String(text)))
  ));
  return crypto.subtle.timingSafeEqual(a, b);
}

// ---------- Session cookie ----------

export async function createSessionCookie(request, env) {
  const payload = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const signature = await crypto.subtle.sign("HMAC", await signingKey(env), encoder.encode(payload));
  return cookieHeader(request, `${payload}.${toBase64Url(signature)}`, SESSION_SECONDS);
}

export function clearSessionCookie(request) {
  return cookieHeader(request, "", 0);
}

export async function isLoggedIn(request, env) {
  const value = readCookie(request, COOKIE_NAME);
  if (!value) return false;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  if (Number(payload) < Date.now() / 1000) return false; // expired

  try {
    return await crypto.subtle.verify(
      "HMAC", await signingKey(env), fromBase64Url(signature), encoder.encode(payload)
    );
  } catch {
    return false; // garbage in the cookie
  }
}

// Blocks other websites from sending requests to our admin API with your cookie
// (an attack called CSRF). Browsers always say which site a POST came from.
export function isSameOrigin(request) {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

// Tells the caller which required settings are missing, so setup mistakes give
// a clear message instead of a confusing crash.
export function missingSecrets(env) {
  const missing = [];
  if (!env.ADMIN_USERNAME || !env.ADMIN_USERNAME.trim()) missing.push("ADMIN_USERNAME");
  if (!env.ADMIN_PASSWORD_HASH) missing.push("ADMIN_PASSWORD_HASH");
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) missing.push("SESSION_SECRET");
  return missing;
}

// ---------- Helpers ----------

function signingKey(env) {
  return crypto.subtle.importKey(
    "raw", encoder.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

function cookieHeader(request, value, maxAge) {
  // "Secure" (HTTPS only) is always on for the real site. It is left off for
  // http://localhost, because Safari refuses Secure cookies there.
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function fromBase64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

function toBase64Url(buffer) {
  const text = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return text.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text) {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  return fromBase64(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
}
