// GET /
// Serves public/index.html with the hero (the big featured photo, chosen by
// lib/hero.js) and the set cards already in it, plus link-preview tags
// (sharing your home page shows the cover of your first set).
//
// The cards are built here on the server, not in the browser, so the very first
// version of the page has your real content. Google judges pages largely by that
// first version; an empty "Loading..." page gets marked as a "Soft 404".

import { pickHero } from "../lib/hero.js";
import { withPageMeta } from "../lib/meta.js";
import { homeData } from "../lib/structured.js";
import { categoriesInUse, publishedSets } from "../lib/queries.js";
import { escapeHtml, heroHtml, setCardHtml } from "../lib/render.js";
import { SITE } from "../lib/site.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  // ?category=landscape shows only that category. Plain links, so the filter
  // works without JavaScript and Google can follow each category page.
  const category = (url.searchParams.get("category") || "").slice(0, 60);
  const [sets, categories] = await Promise.all([publishedSets(env, category), categoriesInUse(env)]);
  const current = categories.find((c) => c.slug === category);
  const page = await env.ASSETS.fetch(new URL("/", url));

  const button = (href, name, active) =>
    `<a href="${href}"${active ? ' aria-current="page"' : ""}>${escapeHtml(name)}</a>`;
  const nav = categories.length
    ? button("/", "All", !current) +
      categories.map((c) => button(`/?category=${encodeURIComponent(c.slug)}`, c.name, c === current)).join("")
    : "";

  // The hero: only on the main home page (lib/hero.js picks the set).
  const hero = category ? null : await pickHero(env, sets);

  const filled = new HTMLRewriter()
    .on("#hero", {
      element(el) {
        if (hero) el.setInnerContent(heroHtml(hero.set, hero.label), { html: true });
        else el.remove();
      },
    })
    // With the hero, the featured set's name is the page's main heading, so
    // "Photo sets" steps down to the next level.
    .on(".section-head h1", { element(el) { if (hero) el.tagName = "h2"; } })
    .on("#set-grid", { element(el) { el.setInnerContent(sets.map(setCardHtml).join(""), { html: true }); } })
    .on("#category-nav", {
      element(el) {
        if (nav) el.setInnerContent(nav, { html: true });
        else el.remove();
      },
    })
    .on("#status", {
      element(el) {
        if (sets.length) el.remove();
        else if (category) el.setInnerContent("No sets in this category yet.");
        else el.setInnerContent("No photo sets yet. Please come back soon.");
      },
    })
    .transform(page);

  // "Winston Chang Photography" in the tab and in Google, and a description
  // that names what is here ("... landscape, sports, travel and wildlife").
  const names = categories.map((c) => c.name.toLowerCase());
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0] || "";
  const description = current
    ? `${current.name} photo sets by ${SITE.owner}.`
    : list ? `Photo sets by ${SITE.owner}: ${list} photography.` : SITE.description;

  return withPageMeta(filled, {
    title: current ? current.name : `${SITE.owner} Photography`,
    description,
    url: current ? `${url.origin}/?category=${encodeURIComponent(current.slug)}` : url.origin + "/",
    image: (hero?.set || sets[0])?.cover_thumb_key ? `${url.origin}/img/${(hero?.set || sets[0]).cover_thumb_key}` : "",
    imageSize: thumbSize(hero?.set || sets[0]),
    imageAlt: (hero?.set || sets[0])?.title || "",
    structuredData: current ? null : homeData(url.origin),
  });
}

// The cover's thumbnail is 1200 px on its long edge (or the photo's own size).
function thumbSize(set) {
  if (!set?.cover_width || !set?.cover_height) return null;
  const scale = Math.min(1, 1200 / Math.max(set.cover_width, set.cover_height));
  return { width: set.cover_width * scale, height: set.cover_height * scale };
}
