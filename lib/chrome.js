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
import { escapeHtml } from "./render.js";
import { SITE } from "./site.js";

const icon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
const ICONS = {
  close: icon('<path d="M6 6l12 12M18 6L6 18"/>'),
  share: icon('<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v8h14v-8"/>'),
  moon: '<svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  sun: '<svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></svg>',
};

// path: the page being shown ("/", "/about", "/sets/kyoto"), to mark it in the menu.
// query: its "?category=..." part, if any.
export function menuHtml({ sets, categories, path, category = "" }) {
  const current = (href, active) =>
    `<a href="${escapeHtml(href)}"${active ? ' aria-current="page"' : ""}>`;
  const setLinks = sets.map((s) => {
    const href = `/sets/${encodeURIComponent(s.slug)}`;
    return `<li>${current(href, path === href || decodeURI(path) === `/sets/${s.slug}`)}${escapeHtml(s.title)}</a></li>`;
  }).join("");
  const categoryLinks = categories.map((c) =>
    `<li>${current(`/?category=${encodeURIComponent(c.slug)}`, path === "/" && category === c.slug)}${escapeHtml(c.name)}</a></li>`
  ).join("");

  return `<div class="menu-panel">
  <div class="menu-top">
    <span class="menu-title">${escapeHtml(SITE.name)}</span>
    <button type="button" class="menu-close" id="menu-close" aria-label="Close menu">${ICONS.close}</button>
  </div>
  <nav class="menu-nav" aria-label="Main">
    <ul class="menu-main">
      <li>${current("/", path === "/" && !category)}Work</a></li>
      <li>${current("/about", path === "/about")}About</a></li>
      <li><a href="#contact" data-close-menu>Contact</a></li>
    </ul>
    ${setLinks ? `<h2 class="menu-heading">Sets</h2><ul class="menu-list">${setLinks}</ul>` : ""}
    ${categoryLinks ? `<h2 class="menu-heading">Categories</h2><ul class="menu-list menu-chips">${categoryLinks}</ul>` : ""}
  </nav>
  <div class="menu-actions">
    <button type="button" class="menu-action" data-share hidden>${ICONS.share}<span>Share this page</span></button>
    <button type="button" class="menu-action theme-toggle" id="theme-toggle" data-theme-toggle hidden>${ICONS.moon}${ICONS.sun}<span class="theme-label">Dark mode</span></button>
  </div>
</div>`;
}

// The same three links as the top of the menu, marked the same way.
export function navHtml({ path, category = "" }) {
  const link = (href, label, active) =>
    `<a href="${href}"${active ? ' aria-current="page"' : ""}>${label}</a>`;
  return link("/", "Work", path === "/" && !category) +
    link("/about", "About", path === "/about") +
    link("#contact", "Contact", false);
}

export function footerHtml(about) {
  const items = contactItems(about).map((item) =>
    `<li><span class="contact-label">${escapeHtml(item.label)}</span>` +
    `<a href="${escapeHtml(item.href)}"${externalAttrs(item.href)}>${escapeHtml(item.shown)}</a></li>`
  ).join("");
  const year = new Date().getUTCFullYear();
  return (items
    ? `<div class="footer-contact"><h2 class="footer-heading">Get in touch</h2><ul class="footer-links">${items}</ul></div>`
    : "") +
    `<div class="footer-bottom"><p class="footer-copy"><span>© ${year} ${escapeHtml(SITE.owner)}</span> <span class="footer-name">${escapeHtml(SITE.name)}</span></p>` +
    // "#top" with no element of that id means the very top of the page (an
    // HTML rule), so nothing on the page may have id="top".
    `<a class="footer-top" href="#top">Back to top</a></div>`;
}
