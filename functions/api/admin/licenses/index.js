// GET  /api/admin/licenses   all codes, newest first, with their sets
// POST /api/admin/licenses   body: {"label", "set_ids": [..], "expires_on": "2026-12-31" | "",
//                                   "max_downloads": 20 | null}  creates a code

import { logActivity, quoted } from "../../../../lib/activity.js";
import { codeName, newCode } from "../../../../lib/license.js";
import { isPublicSql } from "../../../../lib/visibility.js";

export async function onRequestGet({ env }) {
  const { results: codes } = await env.DB.prepare(
    `SELECT id, code, label, expires_at, max_downloads, downloads, revoked, created_at
     FROM license_codes ORDER BY id DESC`
  ).all();
  const { results: links } = await env.DB.prepare(
    `SELECT ls.code_id, s.id, s.title, s.slug, ${isPublicSql()} AS published
     FROM license_code_sets ls JOIN sets s ON s.id = ls.set_id`
  ).all();
  for (const code of codes) {
    code.sets = links.filter((l) => l.code_id === code.id).map(({ id, title, slug, published }) => ({ id, title, slug, published }));
  }
  return Response.json(codes);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const label = String(body.label || "").trim().slice(0, 100);
  const setIds = [...new Set((Array.isArray(body.set_ids) ? body.set_ids : []).map(Number))].filter(Number.isInteger);
  if (setIds.length === 0) return Response.json({ error: "Choose at least one set." }, { status: 400 });

  const { results: existing } = await env.DB.prepare(
    `SELECT id, title FROM sets WHERE id IN (${setIds.map(() => "?").join(",")})`
  ).bind(...setIds).all();
  if (existing.length !== setIds.length) return Response.json({ error: "A chosen set no longer exists." }, { status: 400 });

  let expiresAt = null;
  if (body.expires_on) {
    // "2026-12-31" means: valid until the end of that day (UTC).
    const time = Date.parse(`${body.expires_on}T23:59:59Z`);
    if (Number.isNaN(time)) return Response.json({ error: "That expiry date does not look right." }, { status: 400 });
    expiresAt = Math.floor(time / 1000);
  }
  let maxDownloads = null;
  if (body.max_downloads !== null && body.max_downloads !== undefined && body.max_downloads !== "") {
    maxDownloads = Number(body.max_downloads);
    if (!Number.isInteger(maxDownloads) || maxDownloads < 1 || maxDownloads > 100000) {
      return Response.json({ error: "The download limit must be a whole number, 1 or more." }, { status: 400 });
    }
  }

  // A clash with an existing code is practically impossible, but try again if so.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    try {
      const created = await env.DB.prepare(
        `INSERT INTO license_codes (code, label, expires_at, max_downloads) VALUES (?, ?, ?, ?)
         RETURNING id, code`
      ).bind(code, label, expiresAt, maxDownloads).first();
      await env.DB.batch(setIds.map((setId) =>
        env.DB.prepare(`INSERT INTO license_code_sets (code_id, set_id) VALUES (?, ?)`).bind(created.id, setId)
      ));
      const limits = [
        expiresAt ? `until ${body.expires_on}` : "",
        maxDownloads ? `${maxDownloads} downloads` : "",
      ].filter(Boolean).join(", ");
      await logActivity(context, "license_create",
        `Created ${codeName({ code, label })} for ${existing.map((s) => quoted(s.title)).join(", ")}${limits ? ` (${limits})` : ""}`);
      return Response.json(created, { status: 201 });
    } catch (err) {
      if (!String(err.message).includes("UNIQUE")) throw err;
    }
  }
  return Response.json({ error: "Could not make a code. Please try again." }, { status: 500 });
}
