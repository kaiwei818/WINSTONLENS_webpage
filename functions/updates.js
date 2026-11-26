// GET /updates
// Serves public/updates.html with its main address ("canonical") filled in, so
// Google treats /updates, /updates?lang=en and anything else after "?" as one
// page, and _middleware.js can add the Chinese address (?lang=zh) and the
// hreflang links, the same as /about.

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(new URL("/updates.html", url));
  return new HTMLRewriter()
    .on('link[rel="canonical"]', { element(el) { el.setAttribute("href", url.origin + "/updates"); } })
    .transform(page);
}
