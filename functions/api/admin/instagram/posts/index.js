// POST /api/admin/instagram/posts
// body: {"set_id", "orientation" ("vertical" or "horizontal"), "photo_ids": [...], "url"?, "note"?}
// "Mark as posted": records the post and takes its photos off your picks, so
// the next post forms from the picks that are left.

import { logActivity, quoted } from "../../../../../lib/activity.js";
import { cleanInstagramUrl, cleanNote, listPosts } from "../../../../../lib/instagram.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const setId = Number(body.set_id);
  const orientation = body.orientation;
  const ids = [...new Set((Array.isArray(body.photo_ids) ? body.photo_ids : []).map(Number).filter(Number.isInteger))];
  const url = cleanInstagramUrl(body.url);

  if (!["vertical", "horizontal"].includes(orientation)) return Response.json({ error: "Choose vertical or horizontal." }, { status: 400 });
  if (ids.length === 0 || ids.length > 20) return Response.json({ error: "A post has 1 to 20 photos." }, { status: 400 });
  if (url === null) return Response.json({ error: "That is not an Instagram link. Paste the post's address, like https://www.instagram.com/p/..." }, { status: 400 });

  const set = await env.DB.prepare(`SELECT id, title FROM sets WHERE id = ?`).bind(setId).first();
  if (!set) return Response.json({ error: "Set not found" }, { status: 404 });
  // Every photo must belong to this set.
  const { results: found } = await env.DB.prepare(
    `SELECT id FROM photos WHERE set_id = ? AND id IN (${ids.map(() => "?").join(",")})`
  ).bind(setId, ...ids).all();
  if (found.length !== ids.length) return Response.json({ error: "Some of those photos are not in this set." }, { status: 400 });

  const post = await env.DB.prepare(
    `INSERT INTO instagram_posts (set_id, orientation, url, note) VALUES (?, ?, ?, ?) RETURNING id`
  ).bind(setId, orientation, url, cleanNote(body.note)).first();
  await env.DB.batch([
    ...ids.map((photoId, position) => env.DB.prepare(
      `INSERT INTO instagram_post_photos (post_id, photo_id, position) VALUES (?, ?, ?)`
    ).bind(post.id, photoId, position)),
    env.DB.prepare(`UPDATE photos SET instagram = 0 WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids),
  ]);
  await logActivity(context, "instagram_post",
    `Marked a ${orientation} Instagram post of ${ids.length} ${ids.length === 1 ? "photo" : "photos"} from ${quoted(set.title)} as posted`, setId);

  const [saved] = (await listPosts(env, setId)).filter((p) => p.id === post.id);
  return Response.json(saved, { status: 201 });
}
