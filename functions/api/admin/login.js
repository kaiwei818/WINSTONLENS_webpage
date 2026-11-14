// POST /api/admin/login   body: {"username": "...", "password": "..."}
// Checks the username and password and, if both are right, sends back the
// session cookie.

import { logActivity } from "../../../lib/activity.js";
import { createSessionCookie, missingSecrets, verifyPassword, verifyUsername } from "../../../lib/auth.js";

const MAX_FAILURES = 5;          // wrong logins allowed...
const WINDOW_SECONDS = 15 * 60;  // ...per 15 minutes, per IP address

export async function onRequestPost(context) {
  const { request, env } = context;
  const missing = missingSecrets(env);
  if (missing.length > 0) {
    return Response.json(
      { error: `Server is not set up yet. Missing: ${missing.join(", ")}. See docs/lessons/02-admin-login.md` },
      { status: 500 }
    );
  }

  // Cloudflare tells us the visitor's IP address. Locally there is none.
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const now = Math.floor(Date.now() / 1000);

  // Record this attempt BEFORE checking anything, then count. If 500 guesses
  // arrive at the same moment, each one then counts the others too, so only
  // the first 5 get through. (Counting first would let all 500 see "0 so far".)
  // A correct login removes the record again, below.
  const [, , counted] = await env.DB.batch([
    env.DB.prepare(`INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)`).bind(ip, now),
    // Housekeeping: forget attempts older than the window.
    env.DB.prepare(`DELETE FROM login_attempts WHERE attempted_at <= ?`).bind(now - WINDOW_SECONDS),
    env.DB.prepare(`SELECT COUNT(*) AS attempts FROM login_attempts WHERE ip = ? AND attempted_at > ?`)
      .bind(ip, now - WINDOW_SECONDS),
  ]);

  if (counted.results[0].attempts > MAX_FAILURES) {
    return Response.json(
      { error: "Too many wrong attempts. Please wait 15 minutes and try again." },
      { status: 429, headers: { "Retry-After": String(WINDOW_SECONDS) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  // Check both, always. Stopping early after a wrong username would answer
  // faster, which would tell an attacker the username was the wrong part.
  const [usernameOk, passwordOk] = await Promise.all([
    verifyUsername(username, env.ADMIN_USERNAME),
    verifyPassword(password, env.ADMIN_PASSWORD_HASH),
  ]);

  if (!usernameOk || !passwordOk) {
    await logActivity(context, "login_failed", "Wrong username or password");
    // Never say which one was wrong: that would help someone guessing.
    return Response.json({ error: "Wrong username or password." }, { status: 401 });
  }

  await env.DB.prepare(`DELETE FROM login_attempts WHERE ip = ?`).bind(ip).run();
  await logActivity(context, "login", "Logged in");

  return Response.json({ ok: true }, {
    headers: { "Set-Cookie": await createSessionCookie(request, env) },
  });
}
