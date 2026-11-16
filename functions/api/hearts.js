// POST /api/hearts   body: {"photo_id": 42, "visitor": "<random id>", "on": true | false}
// A visitor hearts a photo (on: true) or takes the heart back (on: false).
// The admin set page shows how many hearts each photo has; visitors only see
// their own, remembered in their browser (js/set.js).
//
// No account and no IP address is kept: "visitor" is a random id the browser
// made up. One heart per visitor per photo; rate limited per address.
// shortcut: a visitor who clears their browser can heart again; fine for a
// "which shots do people like" signal, not for a vote.

import { isSameOrigin } from "../../lib/auth.js";
import { clientIp, hit, tooMany } from "../../lib/ratelimit.js";
import { isPublicSql } from "../../lib/visibility.js";
import { langOf } from "../../lib/i18n.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isSameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const photoId = Number(body.photo_id);
  const visitor = String(body.visitor || "");
  if (!Number.isInteger(photoId) || !/^[\w-]{8,64}$/.test(visitor)) {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const limit = await hit(context, "heart", clientIp(request));
  if (!limit.ok) return tooMany(limit.retryAfter, true, langOf(request));

  // Only photos visitors can see.
  const photo = await env.DB.prepare(
    `SELECT p.id FROM photos p JOIN sets s ON s.id = p.set_id WHERE p.id = ? AND ${isPublicSql()}`
  ).bind(photoId).first();
  if (!photo) return Response.json({ error: "Photo not found." }, { status: 404 });

  await env.DB.prepare(body.on
    ? `INSERT OR IGNORE INTO photo_hearts (photo_id, visitor) VALUES (?, ?)`
    : `DELETE FROM photo_hearts WHERE photo_id = ? AND visitor = ?`
  ).bind(photoId, visitor).run();
  return Response.json({ ok: true });
}
