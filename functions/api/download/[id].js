// GET /api/download/:photoId?code=WL-....
// Sends the clean copy of one photo as a file download, if the code is valid
// for that photo's set. Every successful download counts toward the code's limit,
// and is written to the activity log (refused ones too, for codes that exist).
// "&all=1" only marks the log line as part of "Download all".
// Each successful download also gets a receipt (lib/receipts.js).
// Rate limited (lib/ratelimit.js): 200 files per hour per address, and 300 per
// hour per code from all addresses together.

import { logActivity, quoted } from "../../../lib/activity.js";
import { checkCode, codeName } from "../../../lib/license.js";
import { clientIp, hit, tooMany } from "../../../lib/ratelimit.js";
import { placeOf, recordReceipt } from "../../../lib/receipts.js";
import { isPublicSql } from "../../../lib/visibility.js";
import { langOf, translator } from "../../../lib/i18n.js";

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const lang = langOf(request); // the visitor's messages in their language; the log stays English
  const t = translator(lang);
  // Plain text in the visitor's language (it shows in the browser tab).
  const say = (key, status) => new Response(t(key), { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const photo = await env.DB.prepare(
    `SELECT p.id, p.download_key, p.sort_order, p.original_name, s.id AS set_id, s.slug, s.title
     FROM photos p JOIN sets s ON s.id = p.set_id
     WHERE p.id = ? AND ${isPublicSql()} AND p.download_key IS NOT NULL`
  ).bind(Number(params.id)).first();
  if (!photo) return say("license.notDownloadable", 404);

  const limit = await hit(context, "download", clientIp(request));
  if (!limit.ok) return tooMany(limit.retryAfter, false, lang);
  if (limit.justReachedLimit) {
    // Logged once, when the limit is reached, not for every refused request after.
    await logActivity(context, "rate_limited", "One address reached the hourly download limit", photo.set_id);
  }

  const url = new URL(request.url);
  const viaAll = Boolean(url.searchParams.get("all"));
  const via = viaAll ? " (Download all)" : "";
  const result = await checkCode(request, env, url.searchParams.get("code"), photo.set_id);
  if (!result.ok) {
    if (result.license) {
      await logActivity(context, "download_refused",
        `Refused ${codeName(result.license)} for photo #${photo.id} in ${quoted(photo.title)}: ${result.reason}`, photo.set_id);
    }
    const headers = result.retryAfter ? { "Retry-After": String(result.retryAfter) } : {};
    return new Response(result.error, { status: result.status, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  }

  const perCode = await hit(context, "download_code", String(result.license.id));
  if (!perCode.ok) return tooMany(perCode.retryAfter, false, lang);
  if (perCode.justReachedLimit) {
    await logActivity(context, "rate_limited", `${codeName(result.license)} reached its hourly download limit`, photo.set_id);
  }

  const file = await env.BUCKET.get(photo.download_key);
  if (!file) return say("license.fileMissing", 404);

  // Count it. "downloads < max" is checked again here, so two downloads at the
  // same moment cannot both squeeze past the limit.
  const counted = await env.DB.prepare(
    `UPDATE license_codes SET downloads = downloads + 1
     WHERE id = ? AND (max_downloads IS NULL OR downloads < max_downloads)
     RETURNING downloads, max_downloads`
  ).bind(result.license.id).first();
  if (!counted) {
    await logActivity(context, "download_refused",
      `Refused ${codeName(result.license)} for photo #${photo.id} in ${quoted(photo.title)}: no downloads left`, photo.set_id);
    return say("license.usedUp", 403);
  }
  const used = counted.max_downloads === null ? `${counted.downloads} used, no limit` : `${counted.downloads} of ${counted.max_downloads} used`;
  const place = placeOf(request);
  await logActivity(context, "download",
    `${codeName(result.license)} downloaded photo #${photo.id} from ${quoted(photo.title)}${via} (${used})${place ? `, from ${place}` : ""}`, photo.set_id);
  await recordReceipt(context, { license: result.license, photo, viaAll });

  return new Response(file.body, {
    headers: {
      "Content-Type": "image/jpeg",
      // "attachment" = save as a file, with this name, instead of opening it.
      "Content-Disposition": `attachment; filename="${photo.slug.replace(/[^\w-]/g, "") || "photo"}-${photo.id}.jpg"`,
      "Cache-Control": "private, no-store",
    },
  });
}
