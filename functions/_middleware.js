// Runs for EVERY request to the site, before anything else, and touches every
// response on its way out:
//   0. sends visitors on an old address (winstonlens.pages.dev, www.) to the
//      main domain, with a "moved permanently" (301) redirect (lib/site.js)
//   1. adds the security headers (lib/security.js)
//   2. on HTML pages, fills in the site name, owner, and year (lib/site.js)
//   3. on public pages, fills in the header links, the ☰ menu, and the
//      "Get in touch" footer (lib/chrome.js), and tells browsers they may load the next page early
//      (the Speculation-Rules header, see public/speculation-rules.json)
//   4. on HTML pages, gives every style and script a versioned address, so
//      browsers never mix a new page with an old saved copy of the CSS
//      (see "Fresh styles and scripts" at the end of this file)
//   5. on public pages, English or 繁體中文 (lib/i18n.js): ?lang=zh / ?lang=en
//      shows that language and remembers the choice; marked text (data-i18n,
//      data-lang) is translated, and the page scripts get their strings as
//      data (#site-text)
//
// Doing this in one place means no page can forget it.
//
// Cost note: because of this file, every request (pages, CSS, JS, images) runs a
// Cloudflare Function. The free plan includes 100,000 a day, which is thousands
// of visitors; one visit to a set is roughly 10 to 40 requests.

import { ASSET_VERSION } from "../lib/asset-version.js";
import { footerHtml, menuHtml, navHtml } from "../lib/chrome.js";
import { CONTACT_KEYS } from "../lib/contact.js";
import { HTML_LANG, LANGS, clientText, langOf, translator, zhUrl } from "../lib/i18n.js";
import { escapeHtml, jsonForPage } from "../lib/render.js";
import { categoriesInUse } from "../lib/queries.js";
import { addSecurityHeaders } from "../lib/security.js";
import { getSettings } from "../lib/settings.js";
import { SITE } from "../lib/site.js";
import { isPublicSql } from "../lib/visibility.js";

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  // A permanent redirect tells browsers and Google "this page now lives at the
  // new address", and Google moves the page's search ranking along with it.
  // 308 for forms (POST): like 301, but the browser sends the form again.
  if (SITE.oldHosts.includes(host)) {
    url.hostname = SITE.domain;
    url.protocol = "https:";
    url.port = "";
    return Response.redirect(url.toString(), ["GET", "HEAD"].includes(request.method) ? 301 : 308);
  }

  const versioned = url.pathname.match(VERSIONED_PATH);
  if (versioned) return serveVersioned(request, env, url, versioned[1], versioned[2]);


  const original = await next(withoutRevalidation(request));
  const response = new Response(original.body, original); // a copy we can change
  addSecurityHeaders(response.headers);

  // The test copy of each deploy ("2f1d6431.winstonlens.pages.dev"): keep it
  // out of Google, so search results only ever show the real address.
  if (host.endsWith(".pages.dev")) response.headers.set("X-Robots-Tag", "noindex");

  // The rules file must be served as this type, or browsers ignore it.
  if (url.pathname === "/speculation-rules.json") {
    response.headers.set("Content-Type", "application/speculationrules+json");
  }

  if (!(response.headers.get("Content-Type") || "").includes("text/html")) {
    return response;
  }
  // The page below gets changed (versioned addresses, menu, footer), so the
  // HTML file's own fingerprint no longer describes it. See withoutRevalidation.
  response.headers.delete("ETag");
  response.headers.delete("Last-Modified");

  const isPublic = !url.pathname.startsWith("/admin");
  let chrome = null;
  const lang = isPublic ? langOf(request) : "en";
  const t = translator(lang);
  if (isPublic) {
    // Chrome and Edge: start loading a page as soon as the visitor points at
    // (or touches) its link, so it appears instantly when clicked.
    response.headers.set("Speculation-Rules", '"/speculation-rules.json"');
    // The page depends on the visitor's language choice. ?lang=zh / ?lang=en
    // (the 中文 / English link, or a shared link) is remembered for a year.
    response.headers.append("Vary", "Cookie, Accept-Language");
    const asked = url.searchParams.get("lang");
    if (LANGS.includes(asked)) {
      response.headers.append("Set-Cookie", `lang=${asked}; Path=/; Max-Age=31536000; SameSite=Lax${url.protocol === "https:" ? "; Secure" : ""}`);
    }
    chrome = await loadChrome(env, url, lang);
  }

  let rewriter = new HTMLRewriter();
  const version = ASSET_VERSION;
  if (version) {
    // <link href="/css/style.css">  becomes  <link href="/v/3f9a0c2b7d1e/css/style.css">
    rewriter = rewriter
      .on('link[rel="stylesheet"][href^="/css/"]', {
        element(el) { el.setAttribute("href", `/v/${version}${el.getAttribute("href")}`); },
      })
      .on('script[src^="/js/"]', {
        element(el) { el.setAttribute("src", `/v/${version}${el.getAttribute("src")}`); },
      });
  }
  if (chrome) {
    const values = { owner: SITE.owner };
    rewriter = rewriter
      .on("#site-nav", { element(el) { el.setInnerContent(chrome.nav, { html: true }); } })
      .on("#site-menu", { element(el) { el.setInnerContent(chrome.menu, { html: true }); el.setAttribute("aria-label", t("menu.label")); } })
      .on("#contact", { element(el) { el.setInnerContent(chrome.footer, { html: true }); } })
      .on("html", { element(el) { el.setAttribute("lang", HTML_LANG[lang]); } })
      // Chinese pages: 思源黑體, stored on this site (scripts/zh-font.mjs). English
      // pages never load it. Added already versioned, like the other styles.
      .on("head", {
        element(el) {
          if (lang === "zh") el.append(`<link rel="stylesheet" href="${version ? `/v/${version}` : ""}/css/noto-sans-tc.css">`, { html: true });
        },
      })
      // The shared header: the other language's link first, then its words.
      .on(".header-buttons", {
        element(el) {
          el.prepend(`<a class="lang-switch" href="${escapeHtml(chrome.langHref)}" lang="${lang === "zh" ? "en" : "zh-Hant-TW"}" ` +
            `aria-label="${t("lang.switchLabel")}">${t("lang.switch")}</a>`, { html: true });
        },
      })
      // Each language gets its own address in Google: the plain one is English,
      // ?lang=zh Chinese, and each page names the other (hreflang).
      .on('link[rel="canonical"]', {
        element(el) {
          const href = el.getAttribute("href");
          if (!href) return;
          const zh = zhUrl(href);
          if (url.searchParams.get("lang") === "zh") el.setAttribute("href", zh);
          el.after(`<link rel="alternate" hreflang="en" href="${escapeHtml(href)}">` +
            `<link rel="alternate" hreflang="zh-Hant-TW" href="${escapeHtml(zh)}">` +
            `<link rel="alternate" hreflang="x-default" href="${escapeHtml(href)}">`, { html: true });
        },
      })
      .on(".skip-link", { element(el) { el.setInnerContent(t("skip")); } })
      .on(".menu-button-label", { element(el) { el.setInnerContent(t("menu.label")); } })
      // Words marked in the pages: data-i18n="key" (the text), data-i18n-attr=
      // "aria-label=key,placeholder=key" (attributes), data-lang="en" / "zh"
      // (a whole block kept only in its own language).
      .on("[data-i18n]", { element(el) { el.setInnerContent(t(el.getAttribute("data-i18n"), values)); } })
      .on("[data-i18n-attr]", {
        element(el) {
          for (const pair of el.getAttribute("data-i18n-attr").split(",")) {
            const [name, key] = pair.split("=").map((s) => s.trim());
            el.setAttribute(name, t(key, values));
          }
        },
      })
      .on("[data-lang]", { element(el) { if (el.getAttribute("data-lang") !== lang) el.remove(); } })
      // The strings the page scripts need, before any script runs (js/text.js).
      .on("body", { element(el) { el.prepend(`<script type="application/json" id="site-text">${jsonForPage(clientText(lang))}</script>`, { html: true }); } });
  }
  return rewriter
    // <span data-site="name"></span>  becomes  <span data-site="name">winstonlens</span>
    .on("[data-site]", {
      element(el) {
        const key = el.getAttribute("data-site");
        el.setInnerContent(key === "year" ? String(new Date().getUTCFullYear()) : SITE[key] ?? "");
      },
    })
    // <title data-page="Forest">  becomes  <title>Forest | winstonlens</title>
    // (data-i18n-page="key": a fixed page's name, in the visitor's language)
    .on("title", {
      element(el) {
        const key = el.getAttribute("data-i18n-page");
        const page = key ? t(key) : el.getAttribute("data-page");
        el.setInnerContent(page ? `${page} | ${SITE.name}` : SITE.name);
        el.removeAttribute("data-page");
      },
    })
    .on('meta[property="og:site_name"]', { element(el) { el.setAttribute("content", SITE.name); } })
    .on('meta[name="description"]', {
      element(el) {
        if (!el.getAttribute("content")) el.setAttribute("content", isPublic ? t("site.description") : SITE.description);
      },
    })
    .transform(response);
}

// The header links, and the sets, categories, and contact details for the menu and footer. If the
// database cannot be reached, the page still works, with a shorter menu.
async function loadChrome(env, url, lang) {
  const category = url.searchParams.get("category") || "";
  const nav = navHtml({ path: url.pathname, category, lang });
  // This page's address with the other language chosen (anything after "?" kept).
  const other = new URL(url);
  other.searchParams.set("lang", lang === "zh" ? "en" : "zh");
  const langHref = other.pathname + other.search;
  try {
    const [{ results: sets }, categories, about] = await Promise.all([
      env.DB.prepare(`SELECT slug, title, title_zh FROM sets s WHERE ${isPublicSql()} ORDER BY sort_order, id`).all(),
      categoriesInUse(env),
      getSettings(env, CONTACT_KEYS),
    ]);
    return {
      nav,
      langHref,
      menu: menuHtml({ sets, categories, path: url.pathname, category, lang, langHref }),
      footer: footerHtml(about, lang),
    };
  } catch (err) {
    console.error("Could not load the menu:", err);
    return { nav, langHref, menu: menuHtml({ sets: [], categories: [], path: url.pathname, lang, langHref }), footer: footerHtml({}, lang) };
  }
}

// ---------- Fresh styles and scripts ----------
// Cloudflare tells browsers to keep a saved copy of CSS and JS files for 4
// hours (the "Browser Cache TTL" setting). So right after a deploy, a browser
// can show the new page with the old styles: the menu and footer then look
// unstyled. The fix is to change the address whenever a file changes.
//
// npm run deploy puts a fingerprint of all CSS and JS files into
// lib/asset-version.js for the upload (scripts/deploy.mjs). Pages then load
// /v/<fingerprint>/css/style.css instead of /css/style.css. A changed file
// means a new fingerprint, a new address, and a fresh download. An unchanged
// one is kept by the browser for a year, so pages also load faster.
//
// Scripts that load other scripts ("./lightbox.js") stay inside the same
// /v/<fingerprint>/ folder, so they are fresh too.

const VERSIONED_PATH = /^\/v\/([0-9a-f]{12})(\/(?:css|js)\/.+)$/;

// A browser that has a page saved asks "has it changed?" (If-None-Match).
// For a plain HTML file, like the admin login page, Pages compares the file
// itself and answers "no" when only the CSS or JS changed. The browser then
// keeps its saved page, with the old /v/<fingerprint>/ addresses, for good.
// So page requests go on without that question, and always get a fresh page.
function withoutRevalidation(request) {
  const isPage = (request.headers.get("Accept") || "").includes("text/html")
    || request.headers.get("Sec-Fetch-Dest") === "document";
  const asks = request.headers.has("If-None-Match") || request.headers.has("If-Modified-Since");
  if (!isPage || !asks || !["GET", "HEAD"].includes(request.method)) return undefined;
  const headers = new Headers(request.headers);
  headers.delete("If-None-Match");
  headers.delete("If-Modified-Since");
  return new Request(request, { headers });
}

async function serveVersioned(request, env, url, version, path) {
  const file = await env.ASSETS.fetch(new Request(new URL(path, url), request));
  const response = new Response(file.body, file);
  addSecurityHeaders(response.headers);
  if (file.ok || file.status === 304) {
    // An address from an older deploy (a page opened before it) still works,
    // but that copy must not be kept: it is today's file under an old name.
    response.headers.set(
      "Cache-Control",
      version === ASSET_VERSION ? "public, max-age=31536000, immutable" : "no-store",
    );
  }
  return response;
}
