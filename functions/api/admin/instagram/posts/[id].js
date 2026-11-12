// PATCH  /api/admin/instagram/posts/:id   body: any of {"url", "note"}: add or change the link and note
// DELETE /api/admin/instagram/posts/:id   "Undo posted": removes the record and
//                                         puts its photos back in your picks

import { logActivity, quoted } from "../../../../../lib/activity.js";
import { cleanInstagramUrl, cleanNote, listPosts } from "../../../../../lib/instagram.js";

export async function onRequestPatch({ request, env, params }) {
  const body = await request.json().catch(() => ({}));
  const changes = {};
  if ("url" in body) {
    const url = cleanInstagramUrl(body.url);
    if (url === null) return Response.json({ error: "That is not an Instagram link. Paste the post's address, like https://www.instagram.com/p/..." }, { status: 400 });
    changes.url = url;
  }
  if ("note" in body) changes.note = cleanNote(body.note);
  const columns = Object.keys(changes);
  if (!columns.length) return Response.json({ error: "Nothing to change." }, { status: 400 });

  const row = await env.DB.prepare(
    `UPDATE instagram_posts SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ? RETURNING set_id`
  ).bind(...Object.values(changes), Number(params.id)).first();
  if (!row) return Response.json({ error: "Post not found" }, { status: 404 });
  const [saved] = (await listPosts(env, row.set_id)).filter((p) => p.id === Number(params.id));
  return Response.json(saved);
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const id = Number(params.id);
  const post = await env.DB.prepare(
    `SELECT ip.id, ip.set_id, ip.orientation, s.title AS set_title FROM instagram_posts ip JOIN sets s ON s.id = ip.set_id WHERE ip.id = ?`
  ).bind(id).first();
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });

  const [restored] = await env.DB.batch([
    env.DB.prepare(`UPDATE photos SET instagram = 1 WHERE id IN (SELECT photo_id FROM instagram_post_photos WHERE post_id = ?)`).bind(id),
    env.DB.prepare(`DELETE FROM instagram_post_photos WHERE post_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM instagram_posts WHERE id = ?`).bind(id),
  ]);
  await logActivity(context, "instagram_unpost",
    `Undid a ${post.orientation} Instagram post from ${quoted(post.set_title)}; its photos are back in your picks`, post.set_id);
  return Response.json({ ok: true, restored: restored.meta.changes });
}
