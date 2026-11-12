// PATCH  /api/admin/photos/:id   body: any of {"caption", "alt_text", "camera_info", "rating", "instagram"},
//                                or {"remove_download": true} to delete the clean copy
// DELETE /api/admin/photos/:id   deletes the row and all of its image files

import { logActivity, quoted } from "../../../../lib/activity.js";
import { cleanPlaceholder } from "../../../../lib/render.js";

// The photo with its set's title, for the activity log.
function findPhoto(env, id) {
  return env.DB.prepare(
    `SELECT p.id, p.set_id, p.original_name, p.small_key, p.thumb_key, p.medium_key, p.display_key,
            p.download_key, s.title AS set_title
     FROM photos p JOIN sets s ON s.id = p.set_id WHERE p.id = ?`
  ).bind(id).first();
}

function describe(photo) {
  return `photo #${photo.id}${photo.original_name ? ` (${photo.original_name})` : ""} in ${quoted(photo.set_title)}`;
}

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const body = await request.json().catch(() => ({}));

  if (body.remove_download) {
    const photo = await findPhoto(env, Number(params.id));
    if (!photo) return Response.json({ error: "Photo not found" }, { status: 404 });
    if (photo.download_key) {
      // Database first, then the file (same reasoning as deleting a photo).
      await env.DB.prepare(`UPDATE photos SET download_key = NULL WHERE id = ?`).bind(Number(params.id)).run();
      await env.BUCKET.delete(photo.download_key);
      await logActivity(context, "clean_copy_remove", `Removed the clean copy of ${describe(photo)}`, photo.set_id);
    }
    return Response.json({ ok: true });
  }

  const changes = {};
  // caption:  shown to everyone under the photo in the viewer
  // alt_text: read aloud by screen readers, and used by Google image search
  if ("caption" in body) changes.caption = String(body.caption).trim().slice(0, 1000);
  if ("alt_text" in body) changes.alt_text = String(body.alt_text).trim().slice(0, 500);
  // camera_info: the camera details line in the viewer; empty hides it
  if ("camera_info" in body) changes.camera_info = String(body.camera_info).trim().slice(0, 200);
  // rating: your own 1 to 5 stars, 0 for not rated (admin only, never public)
  if ("rating" in body) changes.rating = Math.min(5, Math.max(0, Math.round(Number(body.rating)) || 0));
  // instagram: picked to post on Instagram (admin only, never public)
  if ("instagram" in body) changes.instagram = body.instagram ? 1 : 0;
  // placeholder: the tiny blurry preview (only a small image data: address is accepted)
  if ("placeholder" in body) changes.placeholder = cleanPlaceholder(body.placeholder);

  const columns = Object.keys(changes);
  if (columns.length === 0) return Response.json({ error: "Nothing to change." }, { status: 400 });

  const updated = await env.DB.prepare(
    `UPDATE photos SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?
     RETURNING id, caption, alt_text, camera_info, rating, instagram`
  ).bind(...Object.values(changes), Number(params.id)).first();

  if (!updated) return Response.json({ error: "Photo not found" }, { status: 404 });
  return Response.json(updated);
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const photo = await findPhoto(env, Number(params.id));

  if (!photo) return Response.json({ error: "Photo not found" }, { status: 404 });

  await env.DB.batch([
    // If this photo was a set's cover, go back to "first photo is the cover".
    env.DB.prepare(`UPDATE sets SET cover_photo_id = NULL WHERE cover_photo_id = ?`).bind(photo.id),
    env.DB.prepare(`DELETE FROM instagram_post_photos WHERE photo_id = ?`).bind(photo.id),
    env.DB.prepare(`DELETE FROM photos WHERE id = ?`).bind(photo.id),
  ]);
  // Older photos have no small/medium version (null): leave those out.
  await env.BUCKET.delete([photo.small_key, photo.thumb_key, photo.medium_key, photo.display_key, photo.download_key].filter(Boolean));
  await logActivity(context, "photo_delete", `Deleted ${describe(photo)}`, photo.set_id);

  return Response.json({ ok: true });
}
