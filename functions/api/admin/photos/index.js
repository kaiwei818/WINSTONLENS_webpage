// POST /api/admin/photos
// Receives one already-shrunk photo from the upload page, as a form with:
//   set_id, width, height, alt_text, camera_info, placeholder (the tiny blurry
//   preview, as a data: address; see js/placeholder.js),
//   original_name, original_hash, taken_at (facts about the original file, for
//   duplicate warnings; see migrations/0007),
//   small, thumb, display (the image files; "medium" is only sent by
//   upload pages from before the storage limit, and still accepted)
//   download (optional): the clean copy for licensed downloads, stored under
//   "private/", which /img/ refuses to serve
// Saves the files to R2 and adds a row to the photos table.
//
// The browser did the resizing, so the 25 MB original never arrives here.
// We still check everything: never trust what a browser sends.

import { logActivity, quoted } from "../../../../lib/activity.js";
import { imageFormat } from "../../../../lib/image-format.js";
import { cleanPlaceholder } from "../../../../lib/render.js";

// 15 MB per file. A 3000 px photo at quality 0.9 is usually 1 to 4 MB, but very
// detailed photos can go higher. The file type is checked from the file's own
// first bytes (lib/image-format.js).
const MAX_BYTES = 15 * 1024 * 1024;

// thumb and display are required. small and medium (phone sizes) are optional,
// so an upload page left open from before the update still works.
const SIZES = [
  { name: "small", required: false },
  { name: "thumb", required: true },
  { name: "medium", required: false },
  { name: "display", required: true },
  { name: "download", required: false },
];

export async function onRequestPost(context) {
  const { request, env } = context;
  let form;
  try {
    form = await request.formData();
  } catch {
    return error("Expected a form upload.");
  }

  const setId = Number(form.get("set_id"));
  const width = Number(form.get("width"));
  const height = Number(form.get("height"));
  const altText = String(form.get("alt_text") || "").trim().slice(0, 500);
  const cameraInfo = String(form.get("camera_info") || "").trim().slice(0, 200);
  const originalName = String(form.get("original_name") || "").trim().slice(0, 255);
  const originalHash = /^[0-9a-f]{64}$/.test(form.get("original_hash") || "") ? form.get("original_hash") : "";
  const takenAt = String(form.get("taken_at") || "").trim().slice(0, 120);
  const placeholder = cleanPlaceholder(form.get("placeholder"));

  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width < 1 || height < 1 || width > 10000 || height > 10000) {
    return error("Width and height must be whole numbers between 1 and 10000.");
  }

  const set = await env.DB.prepare(`SELECT id, title FROM sets WHERE id = ?`).bind(setId).first();
  if (!set) return error("That set does not exist.", 404);

  // Check every file first, before storing anything.
  const files = {};
  for (const { name, required } of SIZES) {
    if (!required && !form.get(name)) continue;
    const checked = await checkImage(form.get(name), name);
    if (checked.error) return error(checked.error);
    files[name] = checked;
  }

  // A random id makes every key unique, which is what lets /img/ cache forever.
  const id = crypto.randomUUID();
  const keys = {};
  for (const [name, file] of Object.entries(files)) {
    keys[name] = name === "download"
      ? `private/${setId}/${id}-download.${file.format.ext}`
      : `photos/${setId}/${id}-${name}.${file.format.ext}`;
  }
  await Promise.all(Object.entries(files).map(([name, file]) =>
    env.BUCKET.put(keys[name], file.bytes, { httpMetadata: { contentType: file.format.type } })
  ));
  const totalBytes = Object.values(files).reduce((sum, file) => sum + file.bytes.byteLength, 0);

  try {
    const photo = await env.DB.prepare(
      `INSERT INTO photos (set_id, small_key, thumb_key, medium_key, display_key, download_key,
                           width, height, alt_text, camera_info, size_bytes,
                           original_name, original_hash, taken_at, placeholder, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM photos WHERE set_id = ?))
       RETURNING id, thumb_key, display_key, width, height, alt_text, camera_info, size_bytes`
    ).bind(setId, keys.small ?? null, keys.thumb, keys.medium ?? null, keys.display, keys.download ?? null,
           width, height, altText, cameraInfo, totalBytes, originalName, originalHash, takenAt, placeholder, setId).first();
    const name = originalName ? ` (${originalName})` : "";
    const clean = keys.download ? ", with a clean copy" : "";
    await logActivity(context, "upload", `Uploaded photo #${photo.id}${name} to ${quoted(set.title)}${clean}`, setId);
    return Response.json(photo, { status: 201 });
  } catch (err) {
    // The files are saved but the database row failed: remove the files so
    // they do not sit in storage forever, invisible but still counting.
    await env.BUCKET.delete(Object.values(keys));
    throw err;
  }
}

async function checkImage(file, name) {
  if (!(file instanceof File)) return { error: `Missing the ${name} image.` };
  if (file.size > MAX_BYTES) return { error: `The ${name} image is larger than 15 MB.` };

  const bytes = await file.arrayBuffer();
  const format = imageFormat(bytes);
  if (!format) return { error: `The ${name} image must be JPEG, PNG, or WebP.` };

  return { bytes, format };
}

function error(message, status = 400) {
  return Response.json({ error: message }, { status });
}
