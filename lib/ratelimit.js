// Rate limits for the public license endpoints, so nobody can try code after
// code (brute force), or pull files in bulk with a stolen code.
//
// hit(context, bucket, key) records one request and says whether it is allowed.
// Each bucket has its own limit per time window:

import { translator } from "./i18n.js";

export const LIMITS = {
  // Checking a code on a set page (any answer, right or wrong), per IP address.
  license_check: { max: 30, seconds: 15 * 60 },
  // Downloading clean files, per IP address. "Download all" of 60 photos fits.
  download: { max: 200, seconds: 60 * 60 },
  // Downloads per code, from all addresses together: a shared code cannot be
  // used to drain everything at once.
  download_code: { max: 300, seconds: 60 * 60 },
  // WRONG codes from the whole internet together. If many addresses guess at
  // once (a "distributed" attack), checking pauses for everyone for a while.
  wrong_code_global: { max: 300, seconds: 60 * 60 },
  // Hearts on photos (and taking them back), per IP address: plenty for a
  // visitor going through a few sets, too few to pile up fake favourites.
  heart: { max: 300, seconds: 60 * 60 },
};

// Returns { ok: true } or { ok: false, retryAfter: seconds }.
// count: false only looks, without recording a hit.
//
// A hit is recorded FIRST and counted after, in one database step (like the
// login limit in functions/api/admin/login.js). If 500 requests arrive at the
// same moment, each one then counts the others too, so only the first `max`
// get through. (Counting first would let all 500 see "0 so far".)
// A refused request's own record is taken out again, so being refused does
// not make the wait longer.
export async function hit({ env }, bucket, key, { count = true } = {}) {
  const { max, seconds } = LIMITS[bucket];
  const now = Math.floor(Date.now() / 1000);
  const since = now - seconds;
  const counting = env.DB.prepare(
    `SELECT COUNT(*) AS hits, MIN(at) AS oldest FROM rate_hits WHERE bucket = ? AND key = ? AND at > ?`
  ).bind(bucket, key, since);
  const refused = (row) => ({ ok: false, retryAfter: Math.max(1, (row.oldest || now) + seconds - now) });

  if (!count) {
    const row = await counting.first();
    return row.hits >= max ? refused(row) : { ok: true };
  }

  const [added, , counted] = await env.DB.batch([
    env.DB.prepare(`INSERT INTO rate_hits (bucket, key, at) VALUES (?, ?, ?) RETURNING rowid`).bind(bucket, key, now),
    // Housekeeping: forget hits that no longer count.
    env.DB.prepare(`DELETE FROM rate_hits WHERE bucket = ? AND at <= ?`).bind(bucket, since),
    counting,
  ]);
  const row = counted.results[0];
  if (row.hits > max) {
    await env.DB.prepare(`DELETE FROM rate_hits WHERE rowid = ?`).bind(added.results[0].rowid).run();
    return refused(row);
  }
  return { ok: true, justReachedLimit: row.hits === max };
}

export function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "local";
}

// A friendly "please wait" answer, with the standard Retry-After header.
// lang: the visitor's language (lib/i18n.js).
export function tooMany(retryAfter, json = false, lang = "en") {
  const minutes = Math.ceil(retryAfter / 60);
  const message = translator(lang)("wait", { n: minutes });
  const headers = { "Retry-After": String(retryAfter) };
  return json
    ? Response.json({ error: message }, { status: 429, headers })
    : new Response(message, { status: 429, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
}
