// GET    /api/admin/sets/:id   one set and its photos, for the admin set page
// PATCH  /api/admin/sets/:id   change title, description, date, slug, cover photo, published, or categories
// DELETE /api/admin/sets/:id   delete the set, its photos, and their files

import { logActivity, quoted } from "../../../../lib/activity.js";
import { listPosts } from "../../../../lib/instagram.js";
import { uniqueSlug } from "../../../../lib/slug.js";
import { settleScheduled } from "../../../../lib/visibility.js";

const RETURNED = "id, slug, title, description, shot_date, location, featured, feature_months, cover_photo_id, published, publish_at";

export async function onRequestGet(context) {
  const { env, params } = context;
  await settleScheduled(context); // a scheduled time that has passed: show it as published
  const set = await env.DB.prepare(
    `SELECT ${RETURNED} FROM sets WHERE id = ?`
  ).bind(Number(params.id)).first();

  if (!set) return Response.json({ error: "Set not found" }, { status: 404 });

  const { results: photos } = await env.DB.prepare(
    `SELECT id, thumb_key, medium_key, display_key, original_name, width, height, caption, alt_text, camera_info, size_bytes, rating, instagram,
            placeholder != '' AS placeholder,
            download_key IS NOT NULL AS downloadable
     FROM photos WHERE set_id = ? ORDER BY sort_order, id`
  ).bind(set.id).all();

  const { results: categories } = await env.DB.prepare(
    `SELECT category_id FROM set_categories WHERE set_id = ?`
  ).bind(set.id).all();

  return Response.json({ ...set, photos, category_ids: categories.map((c) => c.category_id), instagram_posts: await listPosts(env, set.id) });
}

// Body: any of {"title", "description", "shot_date" ("YYYY-MM-DD" or ""), "slug", "cover_photo_id", "published",
// "publish_at" (a future time like "2026-10-25T01:00:00Z" to schedule it, or "" to cancel),
// "location" ("Kyoto, Japan"), "featured" (true/false: may appear in a rotating hero),
// "feature_months" ([3, 4, 5]: only those months; [] = all year),
// "category_ids": [..]}.
// Fields that are left out stay as they are.
export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const setId = Number(params.id);
  const set = await env.DB.prepare(`SELECT id, title, published, publish_at FROM sets WHERE id = ?`).bind(setId).first();
  if (!set) return Response.json({ error: "Set not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const changes = {};

  if ("title" in body) {
    changes.title = String(body.title).trim().slice(0, 200);
    if (!changes.title) return Response.json({ error: "The title cannot be empty." }, { status: 400 });
  }
  if ("description" in body) {
    changes.description = String(body.description).trim().slice(0, 2000);
  }
  if ("shot_date" in body) {
    changes.shot_date = String(body.shot_date ?? "").trim();
    if (changes.shot_date && !/^\d{4}-\d{2}-\d{2}$/.test(changes.shot_date)) {
      return Response.json({ error: "The date must look like 2026-03-15." }, { status: 400 });
    }
  }
  if ("location" in body) {
    changes.location = String(body.location ?? "").trim().slice(0, 100);
  }
  if ("featured" in body) {
    changes.featured = body.featured ? 1 : 0;
  }
  if (Array.isArray(body.feature_months)) {
    const months = [...new Set(body.feature_months.map(Number))].filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
    changes.feature_months = months.sort((a, b) => a - b).join(",");
  }
  if ("slug" in body) {
    // Clean it up the same way new slugs are made. If another set already uses
    // it, a number is added ("forest-2"); the response says what was saved.
    changes.slug = await uniqueSlug(env, body.slug, setId);
  }
  if ("cover_photo_id" in body) {
    const coverId = body.cover_photo_id === null ? null : Number(body.cover_photo_id);
    if (coverId !== null) {
      const photo = await env.DB.prepare(`SELECT id FROM photos WHERE id = ? AND set_id = ?`)
        .bind(coverId, setId).first();
      if (!photo) return Response.json({ error: "That photo is not in this set." }, { status: 400 });
    }
    changes.cover_photo_id = coverId;
  }

  if ("published" in body) {
    changes.published = body.published ? 1 : 0; // true = everyone sees it, false = draft
    changes.publish_at = ""; // publishing now, or going back to draft, ends any schedule
  }
  if ("publish_at" in body && !("published" in body)) {
    const text = String(body.publish_at || "");
    if (text) {
      const time = Date.parse(text);
      if (Number.isNaN(time)) return Response.json({ error: "That date and time do not look right." }, { status: 400 });
      if (time <= Date.now()) return Response.json({ error: "Choose a time in the future, or use Publish now." }, { status: 400 });
      // Stored in one fixed format (UTC, whole seconds), so the database can compare it as text.
      changes.publish_at = new Date(time).toISOString().replace(/\.\d{3}Z$/, "Z");
      changes.published = 0; // stays a draft until then
    } else {
      changes.publish_at = "";
    }
  }

  if (Array.isArray(body.category_ids)) {
    // Replace the set's categories with exactly this list (unknown ids are ignored).
    const ids = [...new Set(body.category_ids.map(Number))].filter(Number.isInteger);
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM set_categories WHERE set_id = ?`).bind(setId),
      ...ids.map((id) => env.DB.prepare(
        `INSERT INTO set_categories (set_id, category_id) SELECT ?, id FROM categories WHERE id = ?`
      ).bind(setId, id)),
    ]);
  }

  const columns = Object.keys(changes);
  if (columns.length === 0) {
    if (Array.isArray(body.category_ids)) return Response.json({ ok: true });
    return Response.json({ error: "Nothing to change." }, { status: 400 });
  }

  // Column names come from our own list above, never from the request, so
  // building the SQL text from them is safe. The values still go through bind().
  const updated = await env.DB.prepare(
    `UPDATE sets SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?
     RETURNING ${RETURNED}`
  ).bind(...Object.values(changes), setId).first();

  // Log changes to who can see the set.
  if ("published" in body && Boolean(changes.published) !== Boolean(set.published)) {
    await logActivity(context, changes.published ? "publish" : "unpublish",
      `${changes.published ? "Published" : "Unpublished (back to draft)"} ${quoted(updated.title)}`, setId);
  } else if ("publish_at" in changes && changes.publish_at !== set.publish_at && !("published" in body)) {
    await logActivity(context, "schedule", changes.publish_at
      ? `Scheduled ${quoted(updated.title)} to go public at ${changes.publish_at}`
      : `Cancelled the schedule for ${quoted(updated.title)}`, setId);
  }
  return Response.json(updated);
}

// Deletes the set, every photo row in it, and every image file in storage.
export async function onRequestDelete(context) {
  const { env, params } = context;
  const setId = Number(params.id);
  const info = await env.DB.prepare(`SELECT title FROM sets WHERE id = ?`).bind(setId).first();
  const { results: photos } = await env.DB.prepare(
    `SELECT small_key, thumb_key, medium_key, display_key, download_key FROM photos WHERE set_id = ?`
  ).bind(setId).all();

  // Database first: once the rows are gone, nothing on the site points to the
  // files any more. Doing the files first could leave broken images on show if
  // the database step then failed.
  const [, , , , , deleted] = await env.DB.batch([
    env.DB.prepare(`DELETE FROM instagram_post_photos WHERE post_id IN (SELECT id FROM instagram_posts WHERE set_id = ?)`).bind(setId),
    env.DB.prepare(`DELETE FROM instagram_posts WHERE set_id = ?`).bind(setId),
    env.DB.prepare(`DELETE FROM photos WHERE set_id = ?`).bind(setId),
    env.DB.prepare(`DELETE FROM set_categories WHERE set_id = ?`).bind(setId),
    env.DB.prepare(`DELETE FROM license_code_sets WHERE set_id = ?`).bind(setId),
    env.DB.prepare(`DELETE FROM sets WHERE id = ?`).bind(setId),
  ]);
  if (deleted.meta.changes === 0) {
    return Response.json({ error: "Set not found" }, { status: 404 });
  }

  const keys = photos.flatMap((p) => [p.small_key, p.thumb_key, p.medium_key, p.display_key, p.download_key]).filter(Boolean);
  // R2 deletes at most 1000 files per call.
  for (let i = 0; i < keys.length; i += 1000) {
    await env.BUCKET.delete(keys.slice(i, i + 1000));
  }

  await logActivity(context, "set_delete",
    `Deleted the set ${quoted(info?.title)} and its ${photos.length} ${photos.length === 1 ? "photo" : "photos"}`, setId);
  return Response.json({ ok: true, deleted_photos: photos.length });
}
