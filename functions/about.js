// GET /about
// Serves public/about.html with your bio, portrait, and contact details filled
// in on the server. Search engines and link previews read the finished page, and
// visitors see everything at once, with no loading step.

import { withPageMeta } from "../lib/meta.js";
import { contactItems, externalAttrs } from "../lib/contact.js";
import { escapeHtml } from "../lib/render.js";
import { ABOUT_KEYS, getSettings } from "../lib/settings.js";

export async function onRequestGet({ request, env }) {
  const about = await getSettings(env, ABOUT_KEYS);
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(new URL("/about.html", url));

  // Everything you typed is "escaped" before it goes into the page, so a "<" in
  // your bio shows as a "<" and can never become HTML or a script.
  const bioHtml = about.about_bio
    ? about.about_bio.split(/\n\s*\n/).map((paragraph) =>
        `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, "<br>")}</p>`).join("")
    : `<p class="muted">More about me is coming soon.</p>`;

  const contact = contactItems(about).map((item) => link(item.href, item.label, item.shown));
  const gear = gearItems(about.about_gear);

  const portrait = about.about_portrait_key ? portraitHtml(about) : "";

  const filled = new HTMLRewriter()
    .on("#about-bio", { element(el) { el.setInnerContent(bioHtml, { html: true }); } })
    .on("#about-contact", { element(el) { el.setInnerContent(contact.join(""), { html: true }); } })
    .on("#about-gear", {
      element(el) {
        if (gear.length) el.setInnerContent(gear.join(""), { html: true });
        else el.remove();
      },
    })
    .on("#gear-heading", { element(el) { if (!gear.length) el.remove(); } })
    .on("#contact-heading", { element(el) { if (!contact.length) el.remove(); } })
    .on("#about-portrait", {
      element(el) {
        if (portrait) el.setInnerContent(portrait, { html: true });
        else el.remove();
      },
    })
    .transform(page);

  const firstParagraph = about.about_bio.split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
  return withPageMeta(filled, {
    title: "About",
    description: firstParagraph.length > 160 ? `${firstParagraph.slice(0, 157)}...` : firstParagraph,
    url: url.origin + "/about",
    image: about.about_portrait_key ? `${url.origin}/img/${about.about_portrait_key}` : "",
  });
}

function link(href, label, shown) {
  const external = externalAttrs(href);
  return `<li><span class="contact-label">${escapeHtml(label)}</span>` +
    `<a href="${escapeHtml(href)}"${external}>${escapeHtml(shown)}</a></li>`;
}

// One item per line. "Camera: Sony A7 IV" shows "Camera" as a small label in
// front, like the contact details; a line without a colon shows as it is.
function gearItems(text) {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^([^:]{1,30}):\s*(.+)$/);
    return match
      ? `<li><span class="contact-label">${escapeHtml(match[1].trim())}</span><span>${escapeHtml(match[2])}</span></li>`
      : `<li><span>${escapeHtml(line)}</span></li>`;
  });
}

function portraitHtml(about) {
  const width = Number(about.about_portrait_width) || 0;
  const height = Number(about.about_portrait_height) || 0;
  const widthAt = (edge) => (width >= height ? edge : Math.round((edge * width) / height));
  const srcset = about.about_portrait_small_key
    ? `/img/${about.about_portrait_small_key} ${widthAt(800)}w, /img/${about.about_portrait_key} ${widthAt(1200)}w`
    : "";
  return `<img src="/img/${escapeHtml(about.about_portrait_key)}"` +
    (srcset ? ` srcset="${escapeHtml(srcset)}" sizes="(max-width: 700px) calc(100vw - 32px), 420px"` : "") +
    ` width="${width}" height="${height}" alt="Portrait of the photographer">`;
}
