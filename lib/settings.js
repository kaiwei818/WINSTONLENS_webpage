// Reading and saving site settings (the "settings" table: one row per key).

export async function getSettings(env, keys) {
  const { results } = await env.DB.prepare(
    `SELECT key, value FROM settings WHERE key IN (${keys.map(() => "?").join(", ")})`
  ).bind(...keys).all();
  const values = Object.fromEntries(keys.map((key) => [key, ""]));
  for (const row of results) values[row.key] = row.value;
  return values;
}

// "INSERT ... ON CONFLICT DO UPDATE" = add the row, or change it if it exists.
export async function saveSettings(env, values) {
  await env.DB.batch(Object.entries(values).map(([key, value]) =>
    env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(key, String(value))
  ));
}

// Everything the About page uses.
export const ABOUT_KEYS = [
  "about_bio",
  "about_bio_zh", // the bio in 繁體中文 (optional; empty shows the English one)
  "about_gear",
  "about_email",
  "about_phone",
  "about_instagram",
  "about_link_label",
  "about_link_url",
  "about_portrait_small_key",
  "about_portrait_key",
  "about_portrait_width",
  "about_portrait_height",
];
