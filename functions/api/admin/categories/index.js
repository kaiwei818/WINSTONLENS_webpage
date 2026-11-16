// GET  /api/admin/categories   all categories, in order, with how many sets use each
// POST /api/admin/categories   body: {"name": "Landscape"}  creates one

import { slugify } from "../../../../lib/slug.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.name_zh, c.slug, COUNT(sc.set_id) AS set_count
     FROM categories c LEFT JOIN set_categories sc ON sc.category_id = c.id
     GROUP BY c.id ORDER BY c.sort_order, c.name`
  ).all();
  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 40);
  if (!name) return Response.json({ error: "Please type a category name." }, { status: 400 });

  const slug = slugify(name);
  const clash = await env.DB.prepare(`SELECT id FROM categories WHERE slug = ?`).bind(slug).first();
  if (clash) return Response.json({ error: "That category already exists." }, { status: 409 });

  const created = await env.DB.prepare(
    `INSERT INTO categories (name, slug, sort_order)
     VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories))
     RETURNING id, name, slug`
  ).bind(name, slug).first();
  return Response.json({ ...created, set_count: 0 }, { status: 201 });
}
