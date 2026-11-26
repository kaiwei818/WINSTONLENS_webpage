// GET /sets/:slug
// Serves public/set.html with this set's title, description, and photo grid
// already in the page (built here on the server, so Google and link previews
// see the real content), plus the link-preview tags.
// Drafts are only shown to you (when logged in), as a preview. Everyone else,
// and anyone asking for a set that does not exist, gets the "not found" page.
// The old address of a renamed set leads to its new one (migrations/0013).

import { isLoggedIn } from "../../lib/auth.js";
import { notFoundPage } from "../../lib/not-found.js";
import { withPageMeta } from "../../lib/meta.js";
import { galleryData } from "../../lib/structured.js";
import { decodeSlug, movedSet, setWithPhotos } from "../../lib/queries.js";
import { relatedSets } from "../../lib/related.js";
import { escapeHtml, jsonForPage, photoThumbHtml, relatedCardHtml } from "../../lib/render.js";
import { langOf, localized, monthYear, translator } from "../../lib/i18n.js";

export async function onRequestGet({ request, env, params }) {
  const slug = decodeSlug(params.slug);
  const set = await setWithPhotos(env, slug);
  const url = new URL(request.url);

  if (!set) {
    // Maybe the set was renamed: its old address sends people on to the new
    // one, "moved permanently" (301), keeping anything after the "?" (a link
    // to one photo still opens that photo). Drafts are not given away: an old
    // address of a set only you can see stays "not found" for everyone else.
    const moved = await movedSet(env, slug);
    if (moved && (moved.published || (await isLoggedIn(request, env)))) {
      return Response.redirect(`${url.origin}/sets/${encodeURIComponent(moved.slug)}${url.search}`, 301);
    }
    return notFoundPage(env, request);
  }

  const visible = set.published || (await isLoggedIn(request, env));
  if (!visible) return notFoundPage(env, request);

  // English or 繁體中文 (lib/i18n.js): the site's words, and the set's own
  // title and description when a Chinese one was written.
  const lang = langOf(request);
  const t = translator(lang);
  const title = localized(set.title, set.title_zh, lang);
  const description = localized(set.description, set.description_zh, lang);

  const [page, related] = await Promise.all([
    env.ASSETS.fetch(new URL("/set.html", url)),
    relatedSets(env, set.id, lang),
  ]);

  const filled = new HTMLRewriter()
    .on("#set-title", { element(el) { el.setInnerContent(title); } }) // plain text: escaped for us
    .on("#set-description", {
      element(el) {
        if (description) el.setInnerContent(description);
        else el.remove();
      },
    })
    // The facts beside the title, one per line: "Keelung, Taiwan", "March 2026", "18 photos".
    .on("#set-location", {
      element(el) {
        const count = set.photos.length;
        const facts = [set.location, monthYear(set.shot_date, lang), count ? t("photos", { n: count }) : ""];
        const lines = facts.filter(Boolean).map((fact) => `<span>${escapeHtml(fact)}</span>`).join("");
        if (lines) el.setInnerContent(lines, { html: true });
        else el.remove();
      },
    })
    .on("#related-sets", { element(el) { if (!related.length) el.remove(); } })
    .on("#related-grid", { element(el) { el.setInnerContent(related.map((s) => relatedCardHtml(s, lang)).join(""), { html: true }); } })
    .on("#photo-grid", { element(el) { el.setInnerContent(set.photos.map((p, i) => photoThumbHtml(p, i, lang)).join(""), { html: true }); } })
    .on("#status", {
      element(el) {
        if (set.photos.length) el.remove();
        else el.setInnerContent(t("set.empty"));
      },
    })
    // The license code box, only when some photos here can be downloaded.
    .on("#license-panel", {
      element(el) {
        if (set.published && set.photos.some((p) => p.downloadable)) el.removeAttribute("hidden");
        else el.remove();
      },
    })
    // Only you can open a draft; remind yourself it is not public yet.
    .on("#draft-banner", {
      element(el) {
        // Published: take the notice out of the page entirely. Hidden is not
        // enough, since tools that read the raw text still find it.
        if (set.published) return el.remove();
        el.removeAttribute("hidden");
        if (set.publish_at) {
          el.setInnerContent(`Scheduled preview: only you can see this set until ${set.publish_at.replace("T", " ").replace("Z", " UTC")}. It becomes public by itself then.`);
        }
      },
    })
    // The photo details the viewer needs, for set.js. No second request needed.
    .on("#set-data", { element(el) { el.setInnerContent(jsonForPage(set.photos), { html: true }); } })
    .transform(page);

  // A link to one photo (?photo=3, from the viewer) previews that photo.
  const photoNumber = Number(url.searchParams.get("photo"));
  const shared = Number.isInteger(photoNumber) ? set.photos[photoNumber - 1] : null;
  const cover = shared || {
    thumb_key: set.cover_thumb_key, width: set.cover_width, height: set.cover_height, alt_text: "",
  };

  // /sets/osprey/ and /sets/osprey are the same page: the main address has no
  // slash at the end (like /about), so Google does not see two pages.
  const path = url.pathname.replace(/\/+$/, "");
  return withPageMeta(filled, {
    title,
    shareTitle: shared ? t("set.photoTitle", { title, n: photoNumber }) : "",
    description: shared ? shared.caption || shared.alt_text || description : description || t("site.description"),
    url: url.origin + path,
    shareUrl: shared ? `${url.origin}${path}?photo=${photoNumber}` : "",
    // The 1200 px thumbnail, not the 3000 px version: link previews are small,
    // and some apps give up on large images.
    image: cover.thumb_key ? `${url.origin}/img/${cover.thumb_key}` : "",
    imageSize: thumbSize(cover),
    imageAlt: cover.alt_text || title,
    // Drafts are never indexed, so they need no structured data.
    structuredData: set.published ? galleryData(url.origin, set) : null,
  });
}

// The thumbnail is 1200 px on its long edge (or the photo's own size, if smaller).
function thumbSize({ width, height }) {
  if (!width || !height) return null;
  const scale = Math.min(1, 1200 / Math.max(width, height));
  return { width: width * scale, height: height * scale };
}
