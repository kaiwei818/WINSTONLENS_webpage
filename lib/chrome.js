// The parts every public page shares, built on the server by
// functions/_middleware.js (so they are in the page from the start, with no
// loading step):
//
//   menuHtml    the slide-in menu behind the ☰ button at the top right:
//               Work, About, Contact, every set, the categories, Share, and
//               light / dark (opened and closed by public/js/menu.js)
//   navHtml     the Work / About / Contact links in the header (computers;
//               phones and tablets reach them through the menu)
//   footerHtml  the end of every page: "Get in touch" with your contact
//               details from the admin About page, and the © line

import { contactItems, externalAttrs } from "./contact.js";
import { localized, translator } from "./i18n.js";
import { escapeHtml } from "./render.js";
import { SITE } from "./site.js";

const icon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
const ICONS = {
  close: icon('<path d="M6 6l12 12M18 6L6 18"/>'),
  chevron: '<svg class="menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  share: icon('<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v8h14v-8"/>'),
  globe: icon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'),
  moon: '<svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  sun: '<svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></svg>',
};

// path: the page being shown ("/", "/about", "/sets/kyoto"), to mark it in the menu.
// query: its "?category=..." part, if any. lang: "en" or "zh" (lib/i18n.js).
// langHref: this page's address with the other language chosen.
export function menuHtml({ sets, categories, path, category = "", lang = "en", langHref = "" }) {
  const t = translator(lang);
  const current = (href, active) =>
    `<a href="${escapeHtml(href)}"${active ? ' aria-current="page"' : ""}>`;
  const setLinks = sets.map((s) => {
    const href = `/sets/${encodeURIComponent(s.slug)}`;
    return `<li>${current(href, path === href || decodeURI(path) === `/sets/${s.slug}`)}${escapeHtml(localized(s.title, s.title_zh, lang))}</a></li>`;
  }).join("");
  const categoryLinks = categories.map((c) =>
    `<li>${current(`/?category=${encodeURIComponent(c.slug)}`, path === "/" && category === c.slug)}${escapeHtml(localized(c.name, c.name_zh, lang))}</a></li>`
  ).join("");

  // Sets and Categories fold away under their name (a native <details>), so the
  // menu stays short; the one holding the page you are on starts open.
  const onSet = sets.some((s) => path === `/sets/${encodeURIComponent(s.slug)}` || decodeURI(path) === `/sets/${s.slug}`);
  const section = (name, count, items, listClass, open) =>
    `<details class="menu-section"${open ? " open" : ""}><summary class="menu-heading">` +
    `<span>${name}</span><span class="menu-count">${count}</span>${ICONS.chevron}</summary>` +
    `<ul class="${listClass}">${items}</ul></details>`;

  return `<div class="menu-panel">
  <div class="menu-top">
    <span class="menu-title">${escapeHtml(SITE.name)}</span>
    <button type="button" class="menu-close" id="menu-close" aria-label="${t("menu.close")}">${ICONS.close}</button>
  </div>
  <nav class="menu-nav" aria-label="${t("menu.label")}">
    <ul class="menu-main">
      <li>${current("/", path === "/" && !category)}${t("nav.work")}</a></li>
      <li>${current("/about", path === "/about")}${t("nav.about")}</a></li>
      <li>${current("/map", path === "/map")}${t("nav.map")}</a></li>
      <li>${current("/updates", path === "/updates")}${t("nav.updates")}</a></li>
      <li><a href="#contact" data-close-menu>${t("nav.contact")}</a></li>
    </ul>
    ${setLinks ? section(t("nav.sets"), sets.length, setLinks, "menu-list", onSet) : ""}
    ${categoryLinks ? section(t("nav.categories"), categories.length, categoryLinks, "menu-list menu-chips", path === "/" && Boolean(category)) : ""}
  </nav>
  <div class="menu-actions">
    ${langHref ? `<a class="menu-action" href="${escapeHtml(langHref)}" lang="${lang === "zh" ? "en" : "zh-Hant-TW"}">${ICONS.globe}<span>${t("lang.switch")}</span></a>` : ""}
    <button type="button" class="menu-action" data-share hidden>${ICONS.share}<span>${t("menu.share")}</span></button>
    <button type="button" class="menu-action theme-toggle" id="theme-toggle" data-theme-toggle hidden>${ICONS.moon}${ICONS.sun}<span class="theme-label">${t("theme.dark")}</span></button>
  </div>
</div>`;
}

// The same three links as the top of the menu, marked the same way.
export function navHtml({ path, category = "", lang = "en" }) {
  const t = translator(lang);
  const link = (href, label, active) =>
    `<a href="${href}"${active ? ' aria-current="page"' : ""}>${label}</a>`;
  return link("/", t("nav.work"), path === "/" && !category) +
    link("/about", t("nav.about"), path === "/about") +
    link("#contact", t("nav.contact"), false);
}

export function footerHtml(about, lang = "en") {
  const t = translator(lang);
  const items = contactItems(about, lang).map((item) =>
    `<li><span class="contact-label">${escapeHtml(item.label)}</span>` +
    `<a href="${escapeHtml(item.href)}"${externalAttrs(item.href)}>${escapeHtml(item.shown)}</a></li>`
  ).join("");
  const year = new Date().getUTCFullYear();
  return (items
    ? `<div class="footer-contact"><h2 class="footer-heading">${t("footer.contact")}</h2><ul class="footer-links">${items}</ul></div>`
    : "") +
    `<div class="footer-bottom"><p class="footer-copy"><span>© ${year} ${escapeHtml(SITE.owner)}</span> <span class="footer-name">${escapeHtml(SITE.name)}</span></p>` +
    // "#top" with no element of that id means the very top of the page (an
    // HTML rule), so nothing on the page may have id="top".
    `<span class="footer-end"><a class="footer-top" href="/updates">${t("nav.updates")}</a>` +
    `<a class="footer-top" href="#top">${t("footer.top")}</a></span></div>`;
}

// The links at the top of every admin page (functions/admin/_middleware.js
// puts them in), with the page you are on marked. Log out works on every page
// (js/admin-chrome.js).
const ADMIN_LINKS = [
  ["/admin/", "Dashboard"],
  ["/admin/instagram", "Instagram picks"],
  ["/admin/licenses", "License codes"],
  ["/admin/toolkit", "Toolkit"],
  ["/admin/activity", "Activity"],
  ["/admin/about", "About page"],
];
export function adminNavHtml(path) {
  const here = path.replace(/\.html$/, "").replace(/\/$/, "") || "/admin";
  return ADMIN_LINKS.map(([href, label]) =>
    `<a href="${href}"${here === href.replace(/\/$/, "") ? ' aria-current="page"' : ""}>${label}</a>`).join("") +
    `<a href="/" target="_blank">View site</a>` +
    `<button type="button" class="button-secondary" data-logout>Log out</button>`;
}
