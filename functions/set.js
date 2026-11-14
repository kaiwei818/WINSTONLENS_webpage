// GET /set
// public/set.html is only the empty frame that functions/sets/[slug].js fills
// in for /sets/<name>. Opened on its own (/set or /set.html) it is a page with
// no title and no photos, so it answers "not found" instead.

import { notFoundPage } from "../lib/not-found.js";

export function onRequest({ request, env }) {
  return notFoundPage(env, request);
}
