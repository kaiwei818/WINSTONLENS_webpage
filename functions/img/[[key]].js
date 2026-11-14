// GET /img/:key
// Streams an image out of the R2 bucket.
// [[key]] (double brackets) catches the whole rest of the path, slashes included,
// so /img/photos/3/abc-thumb.webp gives params.key = ["photos", "3", "abc-thumb.webp"].
//
// Hotlink protection: when another website puts <img src="https://your-site/img/...">
// on its own pages, the visitor's browser sends "Referer: https://other-site/...".
// We refuse those, so other sites cannot show your photos using your bandwidth.
// Requests with no Referer at all are allowed: opening an image link directly,
// privacy browser settings, and link-preview bots (iMessage, LINE) look like that.
// But a site can hide its Referer on purpose (<img referrerpolicy="no-referrer">).
// Browsers still say "Sec-Fetch-Site: cross-site" then, so that is refused too.

export async function onRequestGet({ request, env, params, waitUntil }) {
  if (!isAllowedReferer(request, env)) {
    return new Response("Images from this site cannot be shown on other websites.", { status: 403 });
  }

  const key = params.key.join("/");
  // Clean copies for licensed downloads live under "private/". They must never
  // be reachable here; only /api/download/... hands them out, after checking a code.
  if (key.startsWith("private/") || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  // Cloudflare's cache in the visitor's region: after the first visitor there,
  // the photo comes from nearby instead of from storage. Safe because a file
  // never changes (every upload gets a new key). The address alone is the key,
  // so the Referer check above still runs for every request.
  // (On *.pages.dev test addresses this cache does nothing; that is fine.)
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    // Browsers may still keep it for a year (the edge copy says one day).
    const response = new Response(cached.body, cached);
    response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return noCdnCopy(response);
  }

  const object = await env.BUCKET.get(key);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers); // copies the Content-Type saved at upload
  headers.set("etag", object.httpEtag);
  // Every upload gets a new, unique key, so a file never changes.
  // Browsers may cache it for a year without checking again.
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("X-Content-Type-Options", "nosniff");
  // An image never needs to run code. This makes sure nothing in a file (an SVG
  // can contain scripts) can run, even if someone opens it directly in a tab.
  headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");

  const response = new Response(object.body, { headers });
  // The edge copy expires after a day, so a photo you delete stops being
  // served from the cache by then (the file itself is gone at once).
  const edgeCopy = new Response(response.clone().body, response);
  edgeCopy.headers.set("Cache-Control", "public, max-age=86400");
  waitUntil(cache.put(cacheKey, edgeCopy));
  return noCdnCopy(response);
}

// Cloudflare's CDN in front of the site must not keep its own copy of what we
// send: it would then answer later requests itself, without running this code,
// so the Referer check above would be skipped and any site could show the
// photo. Browsers still keep it for a year (Cache-Control), and the copy in
// caches.default above is only read after the check, so photos stay fast.
function noCdnCopy(response) {
  response.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  response.headers.set("CDN-Cache-Control", "no-store");
  return response;
}

// HEAD = "only send me the headers". Some link-preview bots check images this
// way first. Cloudflare drops the body automatically for HEAD.
export const onRequestHead = onRequestGet;

function isAllowedReferer(request, env) {
  const referer = request.headers.get("Referer");
  if (!referer) return request.headers.get("Sec-Fetch-Site") !== "cross-site";

  let refererHost;
  try {
    refererHost = new URL(referer).host;
  } catch {
    return false; // not even a valid address
  }

  // Our own pages, plus any extra domains listed in the ALLOWED_HOSTS setting
  // (comma separated, for example "www.example.com,example.com"). You only need
  // that if the site is reachable under more than one domain name.
  const allowed = [new URL(request.url).host, ...(env.ALLOWED_HOSTS || "").split(",")]
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(refererHost.toLowerCase());
}
