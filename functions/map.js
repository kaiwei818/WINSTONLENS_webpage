// GET /map
// Serves public/map.html with the public sets that have a place on the map
// (migrations/0015), as data for js/map.js, and the same sets as a plain
// list (for visitors without scripts, keyboard and screen reader users).
// Each place leaves the server only as precise as the set allows
// (public/js/geo.js): exact spots, or rough areas rounded to about 10 km.
// Hidden sets (the default, and wildlife) are never sent.

import { withPageMeta } from "../lib/meta.js";
import { publishedSets } from "../lib/queries.js";
import { escapeHtml, jsonForPage } from "../lib/render.js";
import { publicPlace } from "../public/js/geo.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const [sets, { results: places }] = await Promise.all([
    publishedSets(env),
    env.DB.prepare(`SELECT id, map_lat, map_lng, map_precision FROM sets WHERE map_precision != 'hidden' AND map_lat IS NOT NULL`).all(),
  ]);
  const placeOf = new Map(places.map((row) => [row.id, publicPlace(row)]));
  const pins = sets.filter((s) => placeOf.get(s.id)).map((s) => ({
    slug: s.slug,
    title: s.title,
    location: s.location || "",
    cover: s.cover_small_key || s.cover_thumb_key || "",
    count: s.photo_count,
    ...placeOf.get(s.id),
  }));

  const page = await env.ASSETS.fetch(new URL("/map.html", url));
  const list = pins.map((p) => {
    const facts = [p.location, p.area ? "rough area" : ""].filter(Boolean).join(", ");
    return `<li><a href="/sets/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a>` +
      `${facts ? ` <span class="muted">${escapeHtml(facts)}</span>` : ""}</li>`;
  }).join("");
  const filled = new HTMLRewriter()
    .on("#map-data", { element(el) { el.setInnerContent(jsonForPage(pins), { html: true }); } })
    .on("#map-list", { element(el) { el.setInnerContent(list, { html: true }); } })
    .on("#map-empty", { element(el) { if (pins.length) el.remove(); } })
    .on("#map", { element(el) { if (!pins.length) el.remove(); } })
    .transform(page);
  return withPageMeta(filled, {
    title: "Map",
    description: "Where the photo sets were taken.",
    url: `${url.origin}/map`,
  });
}
