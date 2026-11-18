// Download receipts: a record of every clean file downloaded with a license
// code: which set, which photo, which code, where from (region only, from
// Cloudflare; never the IP address), and when. See /admin/receipts.
//
// Optional email (lib/email.js: the secrets it needs).
// Downloads are grouped: each one waits QUIET_SECONDS, and only the newest
// download of a code sends one email, listing every download of that code not
// emailed yet. "Download all" fetches the photos one after another, so 60
// photos make one email. (A very slow connection, more than QUIET_SECONDS per
// photo, splits it into a few emails; none is ever lost or sent twice.)

import { canEmail, emailMe } from "./email.js";
import { SITE } from "./site.js";

export const QUIET_SECONDS = 25; // Cloudflare lets background work run 30 seconds at most

// "iPhone, Safari", from the browser's User-Agent: a rough guess, enough to
// tell one phone from another. Scripts show their own name ("curl/8.4.0").
export function deviceOf(userAgent) {
  const ua = String(userAgent || "");
  const device = /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone"
    : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Android phone" : "Android tablet")
    : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : "";
  // Order matters: Edge and Opera also say "Chrome", and every iPhone browser says "Safari".
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  if (device || browser) return [device, browser].filter(Boolean).join(", ");
  return ua.split(" ")[0].slice(0, 40) || "unknown";
}

// "Taipei, Taipei City, TW" (whatever parts Cloudflare knows).
export function placeOf(request) {
  const cf = request.cf || {};
  return [cf.city, cf.region, cf.country].filter(Boolean).join(", ");
}

export async function recordReceipt(context, { license, photo, viaAll }) {
  const { env, request } = context;
  const cf = request.cf || {};
  const emailing = canEmail(env);
  try {
    const row = await env.DB.prepare(
      `INSERT INTO download_receipts (code_id, code, code_label, set_id, set_title, photo_id, photo_name,
                                      country, region, city, via_all, emailed,
                                      network, postal_code, time_zone, device)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
    ).bind(license.id, license.code, license.label || "", photo.set_id, photo.title, photo.id,
           photo.original_name || "", cf.country || "", cf.region || "", cf.city || "", viaAll ? 1 : 0,
           emailing ? 0 : 1, String(cf.asOrganization || "").slice(0, 100), String(cf.postalCode || "").slice(0, 20),
           String(cf.timezone || "").slice(0, 60), deviceOf(request.headers?.get("User-Agent"))).first();
    // In the background (waitUntil), so the download does not wait for it.
    if (emailing) context.waitUntil?.(emailWhenQuiet(env, request, license, row.id));
  } catch (err) {
    console.error("Could not save the download receipt:", err); // never block the download
  }
}

async function emailWhenQuiet(env, request, license, id) {
  try {
    await new Promise((resolve) => setTimeout(resolve, QUIET_SECONDS * 1000));
    const newest = await env.DB.prepare(`SELECT MAX(id) AS id FROM download_receipts WHERE code_id = ?`)
      .bind(license.id).first();
    if (newest.id !== id) return; // a newer download of this code sends the email
    // Taken in one step, so two emails never list the same download.
    const { results: rows } = await env.DB.prepare(
      `UPDATE download_receipts SET emailed = 1 WHERE code_id = ? AND emailed = 0
       RETURNING id, at, set_title, photo_id, photo_name, city, region, country, via_all,
                 network, postal_code, time_zone, device`
    ).bind(license.id).all();
    if (!rows.length) return;
    rows.sort((a, b) => a.id - b.id);
    if (!(await sendEmail(env, request, license, rows))) {
      // Not sent: these go in the next email for this code instead.
      await env.DB.prepare(`UPDATE download_receipts SET emailed = 0 WHERE code_id = ? AND id BETWEEN ? AND ?`)
        .bind(license.id, rows[0].id, rows.at(-1).id).run();
    }
  } catch (err) {
    console.error("Receipt email failed:", err);
  }
}

// One email for a group of downloads. Returns true when Cloudflare accepted it.
async function sendEmail(env, request, license, rows) {
  const origin = new URL(request.url).origin;
  const who = license.label ? `${license.code} (${license.label})` : license.code;
  const when = (at) => at.replace("T", " ").replace("Z", " UTC");
  const list = (values) => [...new Set(values.filter(Boolean))].join("; ");
  const sets = list(rows.map((r) => r.set_title));
  const n = rows.length;
  // The visitor's own clock ("12:59 in America/Edmonton"), when Cloudflare knows their time zone.
  const theirs = (r) => {
    try {
      return r.time_zone ? ` (${new Date(r.at).toLocaleTimeString("en-CA", { timeZone: r.time_zone, hour: "2-digit", minute: "2-digit", hour12: false })} in ${r.time_zone})` : "";
    } catch {
      return ""; // a time zone name this runtime does not know
    }
  };
  const lines = [
    n === 1 ? "A clean photo was downloaded from your site." : `${n} clean photos were downloaded from your site.`,
    ``,
    `Code:     ${who}`,
    `Set:      ${sets}`,
    `Where:    ${list(rows.map((r) => [r.city, r.region, r.postal_code, r.country].filter(Boolean).join(", "))) || "unknown"}`,
    `Network:  ${list(rows.map((r) => r.network)) || "unknown"}`,
    `Device:   ${list(rows.map((r) => r.device)) || "unknown"}`,
    `When:     ${when(rows[0].at)}${theirs(rows[0])}${n > 1 ? ` to ${when(rows.at(-1).at)}` : ""}`,
    ``,
    n === 1 ? "Photo:" : "Photos:",
    ...rows.map((r) => `  #${r.photo_id}${r.photo_name ? ` ${r.photo_name}` : ""}, ${when(r.at)}${r.via_all ? ", Download all" : ""}`),
    ``,
    `All receipts: ${origin}/admin/receipts`,
  ];
  return emailMe(env, {
    subject: `Download: ${sets} (${who}), ${n} ${n === 1 ? "photo" : "photos"}`,
    text: lines.join("\n"),
    fromName: `${SITE.name} downloads`,
  });
}
