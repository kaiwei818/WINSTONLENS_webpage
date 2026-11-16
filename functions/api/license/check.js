// POST /api/license/check   body: {"code": "WL-....", "slug": "set-address"}
// Tells the set page whether a code unlocks downloads for that set.
// Rate limited: 30 checks per 15 minutes per address, right or wrong
// (lib/ratelimit.js), on top of the wrong-code limits in lib/license.js.

import { checkCode, downloadsLeft } from "../../../lib/license.js";
import { isSameOrigin } from "../../../lib/auth.js";
import { clientIp, hit, tooMany } from "../../../lib/ratelimit.js";
import { isPublicSql } from "../../../lib/visibility.js";
import { langOf, translator } from "../../../lib/i18n.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isSameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const limit = await hit(context, "license_check", clientIp(request));
  if (!limit.ok) return tooMany(limit.retryAfter, true, langOf(request));
  const body = await request.json().catch(() => ({}));

  const set = await env.DB.prepare(`SELECT id FROM sets s WHERE slug = ? AND ${isPublicSql()}`)
    .bind(String(body.slug || "")).first();
  if (!set) return Response.json({ error: translator(langOf(request))("license.setNotFound") }, { status: 404 });

  const result = await checkCode(request, env, body.code, set.id);
  if (!result.ok) {
    const headers = result.retryAfter ? { "Retry-After": String(result.retryAfter) } : {};
    return Response.json({ error: result.error }, { status: result.status, headers });
  }
  return Response.json({ ok: true, downloads_left: downloadsLeft(result.license) });
}
