// GET /sets/:slug
// Serves public/set.html with this set's title, description, and photo grid
// already in the page (built here on the server, so Google and link previews
// see the real content), plus the link-preview tags.
// Drafts are only shown to you (when logged in), as a preview. Everyone else,
// and anyone asking for a set that does not exist, gets the "not found" page.

import { isLoggedIn } from "../../lib/auth.js";
import { withPageMeta } from "../../lib/meta.js";
import { galleryData } from "../../lib/structured.js";
import { decodeSlug, setWithPhotos } from "../../lib/queries.js";
import { relatedSets } from "../../lib/related.js";
import { escapeHtml, jsonForPage, monthYear, photoThumbHtml, relatedCardHtml } from "../../lib/render.js";

export async function onRequestGet({ request, env, params }) {
  const set = await setWithPhotos(env, decodeSlug(params.slug));

  const visible = set && (set.published || (await isLoggedIn(request, env)));
  if (!visible) {
    const notFound = await env.ASSETS.fetch(new URL("/404", request.url));
    return new Response(notFound.body, { status: 404, headers: notFound.headers });
  }

  const url = new URL(request.url);
  const [page, related] = await Promise.all([
    env.ASSETS.fetch(new URL("/set.html", url)),
    relatedSets(env, set.id),
  ]);

  const filled = new HTMLRewriter()
    .on("#set-title", { element(el) { el.setInnerContent(set.title); } }) // plain text: escaped for us
    .on("#set-description", {
      element(el) {
        if (set.description) el.setInnerContent(set.description);
        else el.remove();
      },
    })
    // The facts beside the title, one per line: "Keelung, Taiwan", "March 2026", "18 photos".
    .on("#set-location", {
      element(el) {
        const count = set.photos.length;
        const facts = [set.location, monthYear(set.shot_date), count ? `${count} ${count === 1 ? "photo" : "photos"}` : ""];
        const lines = facts.filter(Boolean).map((fact) => `<span>${escapeHtml(fact)}</span>`).join("");
        if (lines) el.setInnerContent(lines, { html: true });
        else el.remove();
      },
    })
    .on("#related-sets", { element(el) { if (!related.length) el.remove(); } })
    .on("#related-grid", { element(el) { el.setInnerContent(related.map(relatedCardHtml).join(""), { html: true }); } })
    .on("#photo-grid", { element(el) { el.setInnerContent(set.photos.map(photoThumbHtml).join(""), { html: true }); } })
    .on("#status", {
      element(el) {
        if (set.photos.length) el.remove();
        else el.setInnerContent("This set has no photos yet.");
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
        if (set.published) return;
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

  return withPageMeta(filled, {
    title: set.title,
    shareTitle: shared ? `${set.title}, photo ${photoNumber}` : "",
    description: shared ? shared.caption || shared.alt_text || set.description : set.description,
    url: url.origin + url.pathname,
    shareUrl: shared ? `${url.origin}${url.pathname}?photo=${photoNumber}` : "",
    // The 1200 px thumbnail, not the 3000 px version: link previews are small,
    // and some apps give up on large images.
    image: cover.thumb_key ? `${url.origin}/img/${cover.thumb_key}` : "",
    imageSize: thumbSize(cover),
    imageAlt: cover.alt_text || set.title,
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
