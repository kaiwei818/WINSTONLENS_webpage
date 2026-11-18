// The daily update email: what happened on the site in the last 24 hours,
// from the activity log, the download receipts and the hearts. Sent each
// morning by .github/workflows/daily-report.yml through /api/daily-report.
// Each download batch also gets its own email right away (lib/receipts.js).

import { SITE } from "./site.js";

const DAY = 24 * 60 * 60 * 1000;
const MAX_LINES = 15; // per section; the rest is on the admin pages

// Returns { subject, text }.
export async function dailyReport(env, origin, now = new Date()) {
  const since = new Date(now - DAY).toISOString().slice(0, 19) + "Z";
  const [{ results: activity }, { results: downloads }, { results: hearts }] = await Promise.all([
    env.DB.prepare(
      `SELECT a.action, a.summary, s.title FROM activity_log a LEFT JOIN sets s ON s.id = a.set_id
       WHERE a.at > ? ORDER BY a.id`
    ).bind(since).all(),
    env.DB.prepare(
      `SELECT set_title, code, code_label, COUNT(*) AS n,
              GROUP_CONCAT(DISTINCT NULLIF(TRIM(city || ', ' || country, ', '), '')) AS places,
              GROUP_CONCAT(DISTINCT NULLIF(network, '')) AS networks,
              GROUP_CONCAT(DISTINCT NULLIF(device, '')) AS devices
       FROM download_receipts WHERE at > ? GROUP BY set_title, code ORDER BY MIN(id)`
    ).bind(since).all(),
    env.DB.prepare(
      `SELECT s.title, COUNT(*) AS n FROM photo_hearts h
       JOIN photos p ON p.id = h.photo_id JOIN sets s ON s.id = p.set_id
       WHERE h.created_at > ? GROUP BY s.id ORDER BY n DESC, s.title`
    ).bind(since).all(),
  ]);

  // "Calgary, CA,Taipei, TW" -> "Calgary, CA; Taipei, TW" (GROUP_CONCAT joins with a bare comma).
  const joined = (list) => list.replace(/,(?=[^ ])/g, "; ");
  const count = (action) => activity.filter((a) => a.action === action).length;
  const summaries = (...actions) => activity.filter((a) => actions.includes(a.action)).map((a) => a.summary);
  const uploads = new Map();
  for (const a of activity.filter((a) => a.action === "upload")) uploads.set(a.title || "a deleted set", (uploads.get(a.title || "a deleted set") || 0) + 1);
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  const photosDownloaded = downloads.reduce((sum, d) => sum + d.n, 0);
  const likes = hearts.reduce((sum, h) => sum + h.n, 0);
  const failedLogins = count("login_failed");
  const sections = [
    ["Downloads", downloads.map((d) => `${d.set_title}: ${plural(d.n, "photo")} with ${d.code}` +
      `${d.code_label ? ` (${d.code_label})` : ""}${d.places ? `, from ${joined(d.places)}` : ""}` +
      `${d.networks ? ` · ${joined(d.networks)}` : ""}${d.devices ? ` · ${joined(d.devices)}` : ""}`)],
    ["Refused downloads", summaries("download_refused")],
    ["New likes", hearts.map((h) => `${h.title}: ${h.n}`)],
    ["License codes", summaries("license_create", "license_off", "license_on", "license_delete")],
    ["Uploads", [...uploads].map(([title, n]) => `${title}: ${plural(n, "photo")}`)],
    ["Sets and publishing", summaries("set_create", "publish", "unpublish", "schedule", "set_delete")],
    ["Deleted", summaries("photo_delete", "clean_copy_remove")],
    ["Instagram", summaries("instagram_post", "instagram_unpost")],
    ["Security", [
      count("login") && `Logins to the admin pages: ${count("login")}`,
      failedLogins && `Failed logins: ${failedLogins}${failedLogins >= 3 ? " (not you? check /admin/activity)" : ""}`,
      ...summaries("rate_limited"),
    ].filter(Boolean)],
  ].filter(([, lines]) => lines.length);

  const highlights = [
    photosDownloaded && plural(photosDownloaded, "download"),
    likes && plural(likes, "new like"),
    failedLogins && `⚠ ${plural(failedLogins, "failed login")}`,
  ].filter(Boolean);
  const subject = `${SITE.name} daily: ${highlights.join(", ") || "a quiet day"}`;

  const when = (date) => date.toISOString().slice(0, 16).replace("T", " ");
  const text = [
    `What happened on ${SITE.domain} from ${when(new Date(now - DAY))} to ${when(now)} UTC.`,
    ``,
    ...(sections.length ? sections.flatMap(([title, lines]) => [
      `${title}:`,
      ...lines.slice(0, MAX_LINES).map((line) => `  ${line}`),
      ...(lines.length > MAX_LINES ? [`  …and ${lines.length - MAX_LINES} more`] : []),
      ``,
    ]) : [`Nothing new: no downloads, likes, uploads or logins.`, ``]),
    `Activity log: ${origin}/admin/activity`,
    `Download receipts: ${origin}/admin/receipts`,
  ].join("\n");
  return { subject, text };
}
