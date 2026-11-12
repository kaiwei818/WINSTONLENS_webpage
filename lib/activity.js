// The admin activity log (see migrations/0007 and /admin/activity).
//
// logActivity(context, action, summary, setId) adds one line, such as
//   upload     Uploaded photo #42 to "Kyoto"
//   download   Code WL-7K3F-Q9XM (Jane) downloaded photo #42 from "Kyoto"
// It never makes the real work fail: if writing the log goes wrong, the
// upload or download still succeeds, and the problem is only printed.
//
// Only the visitor's country is kept (from Cloudflare), never their IP address.

// What each action is called on the log page, and its filter group.
export const ACTIONS = {
  upload: "Upload",
  photo_delete: "Deletion",
  clean_copy_remove: "Deletion",
  set_create: "Set",
  set_delete: "Deletion",
  publish: "Publishing",
  unpublish: "Publishing",
  schedule: "Publishing",
  license_create: "License",
  license_off: "License",
  license_on: "License",
  license_delete: "License",
  download: "Download",
  download_refused: "Download",
  login: "Login",
  login_failed: "Login",
  rate_limited: "Security",
  instagram_post: "Instagram",
  instagram_unpost: "Instagram",
};

const KEEP_DAYS = 365; // older lines are removed now and then

export async function logActivity({ env, request }, action, summary, setId = null) {
  try {
    const country = request?.cf?.country || "";
    const row = await env.DB.prepare(
      `INSERT INTO activity_log (action, summary, set_id, country) VALUES (?, ?, ?, ?) RETURNING id`
    ).bind(action, String(summary).slice(0, 500), setId, country).first();
    // Every 200th line, tidy up lines older than a year.
    if (row && row.id % 200 === 0) {
      await env.DB.prepare(`DELETE FROM activity_log WHERE at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ?)`)
        .bind(`-${KEEP_DAYS} days`).run();
    }
  } catch (err) {
    console.error("Could not write the activity log:", err);
  }
}

// "Kyoto" -> “Kyoto”, cut short if very long, for summaries.
export function quoted(title) {
  const text = String(title ?? "");
  return `"${text.length > 80 ? `${text.slice(0, 79)}…` : text}"`;
}
