// GET /sitemap.xml
// A list of every public page, in the standard format search engines read.
// It is built fresh from the database, so new sets appear automatically.
// Drafts (including scheduled sets whose time has not come) are left out.
// It lists pages only, not the photo files: a list of every full-size file
// made downloading all of them in one go too easy. Google still finds the
// photos on the set pages themselves.

import { isPublicSql } from "../lib/visibility.js";

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const { results: sets } = await env.DB.prepare(
    `SELECT s.id, s.slug FROM sets s WHERE ${isPublicSql()} ORDER BY sort_order, id`
  ).all();

  const entry = (loc) => `  <url><loc>${escapeXml(loc)}</loc></url>`;
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entry(`${origin}/`),
    entry(`${origin}/about`),
    ...sets.map((s) => entry(`${origin}/sets/${encodeURIComponent(s.slug)}`)),
    "</urlset>",
    "",
  ].join("\n");

  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
