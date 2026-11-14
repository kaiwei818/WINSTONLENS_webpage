// The "page not found" page (public/404.html), sent with the 404 status, so
// browsers and Google know the address has nothing. A page that says "not
// found" but answers "200 OK" is what Google calls a "Soft 404".

export async function notFoundPage(env, request) {
  const page = await env.ASSETS.fetch(new URL("/404", request.url));
  return new Response(page.body, { status: 404, headers: page.headers });
}
