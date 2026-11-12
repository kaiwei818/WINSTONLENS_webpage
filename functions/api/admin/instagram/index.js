// GET /api/admin/instagram
// Every photo you flagged for Instagram, from all sets: best rated first, then
// in the order of your sets and of the photos within each set. Plus "posts":
// the record of each post you marked as posted (lib/instagram.js).
// The image keys are the public, watermarked sizes; the clean copies for
// licensed downloads are never listed here.

import { listPosts } from "../../../../lib/instagram.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.set_id, p.thumb_key, p.small_key, p.display_key, p.width, p.height,
            p.caption, p.alt_text, p.rating, p.original_name,
            s.title AS set_title, s.slug AS set_slug, s.sort_order AS set_order
     FROM photos p JOIN sets s ON s.id = p.set_id
     WHERE p.instagram = 1
     ORDER BY p.rating DESC, s.sort_order, s.id, p.sort_order, p.id`
  ).all();
  return Response.json({ photos: results, posts: await listPosts(env) });
}
