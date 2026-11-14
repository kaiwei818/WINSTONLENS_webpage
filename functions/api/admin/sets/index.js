// GET  /api/admin/sets   every set, for the dashboard list
// POST /api/admin/sets   body: {"title": "...", "description": "..."}  creates a set
//                        New sets start as drafts, visible only to you.
// (The login check happens in ../_middleware.js.)

import { logActivity, quoted } from "../../../../lib/activity.js";
import { uniqueSlug } from "../../../../lib/slug.js";
import { settleScheduled } from "../../../../lib/visibility.js";

export async function onRequestGet(context) {
  const { env } = context;
  await settleScheduled(context); // scheduled sets whose time has come: mark them published
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.slug, s.title, s.published, s.publish_at, s.featured, s.feature_months, COUNT(p.id) AS photo_count
     FROM sets s LEFT JOIN photos p ON p.set_id = s.id
     GROUP BY s.id
     ORDER BY s.sort_order, s.id`
  ).all();
  return Response.json(results);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim().slice(0, 200);
  const description = String(body.description || "").trim().slice(0, 2000);

  if (!title) {
    return Response.json({ error: "Please give the set a title." }, { status: 400 });
  }

  const slug = await uniqueSlug(env, title);
  const set = await env.DB.prepare(
    `INSERT INTO sets (slug, title, description, published, sort_order)
     VALUES (?, ?, ?, 0, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM sets))
     RETURNING id, slug, title, published`
  ).bind(slug, title, description).first();

  // If a renamed set used to live at this address, the new set has it now.
  await env.DB.prepare(`DELETE FROM slug_history WHERE slug = ?`).bind(slug).run();

  await logActivity(context, "set_create", `Created the set ${quoted(title)}`, set.id);
  return Response.json({ ...set, publish_at: "", photo_count: 0 }, { status: 201 });
}
