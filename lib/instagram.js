// Records of the Instagram posts you made from your picks (migrations/0012),
// shown on the Instagram picks page and on each set's admin page.

// The post's link, if any: only an https Instagram address is kept, so the
// admin pages never show a link to anywhere else. "" means no link.
export function cleanInstagramUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    if (url.protocol === "https:" && (host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am")) {
      return url.href.slice(0, 300);
    }
  } catch {}
  return null; // not an Instagram link
}

export const cleanNote = (value) => String(value ?? "").trim().slice(0, 200);

// Every post record (or one set's), newest first, each with its photo count
// and the first few thumbnails.
export async function listPosts(env, setId = null) {
  const { results: posts } = await env.DB.prepare(
    `SELECT ip.id, ip.set_id, ip.orientation, ip.url, ip.note, ip.posted_at, s.title AS set_title
     FROM instagram_posts ip JOIN sets s ON s.id = ip.set_id
     WHERE ? IS NULL OR ip.set_id = ?
     ORDER BY ip.posted_at DESC, ip.id DESC`
  ).bind(setId, setId).all();
  if (!posts.length) return [];

  const { results: photos } = await env.DB.prepare(
    `SELECT pp.post_id, p.id, p.thumb_key, p.small_key
     FROM instagram_post_photos pp JOIN photos p ON p.id = pp.photo_id
     WHERE pp.post_id IN (${posts.map(() => "?").join(",")})
     ORDER BY pp.post_id, pp.position`
  ).bind(...posts.map((p) => p.id)).all();

  return posts.map((post) => {
    const own = photos.filter((p) => p.post_id === post.id);
    return { ...post, photo_count: own.length, thumbs: own.slice(0, 6).map((p) => p.small_key || p.thumb_key) };
  });
}
