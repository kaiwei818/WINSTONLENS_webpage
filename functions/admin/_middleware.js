// Runs before every request for an /admin page. Visitors who are not logged in
// are sent to the login page instead.

import { isLoggedIn } from "../../lib/auth.js";
import { adminNavHtml } from "../../lib/chrome.js";

const LOGIN_PAGES = ["/admin/login", "/admin/login.html"];

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const loggedIn = await isLoggedIn(request, env);

  if (LOGIN_PAGES.includes(url.pathname)) {
    // Already logged in? Skip the login page.
    return loggedIn ? Response.redirect(new URL("/admin/", url), 302) : next();
  }

  if (!loggedIn) {
    return Response.redirect(new URL("/admin/login", url), 302);
  }

  // Tell browsers not to keep a saved copy of admin pages (so "Back" after
  // logging out shows nothing).
  const original = await next();
  const response = new Response(original.body, original); // a copy we can change
  response.headers.set("Cache-Control", "no-store");
  if (!(response.headers.get("Content-Type") || "").includes("text/html")) return response;
  // The same links at the top of every admin page, before the page's own
  // buttons (light/dark, "View set").
  return new HTMLRewriter()
    .on(".admin-header nav", { element(el) { el.prepend(adminNavHtml(url.pathname), { html: true }); } })
    .transform(response);
}
