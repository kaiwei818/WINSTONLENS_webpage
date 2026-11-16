// Small helpers shared by the browser checks.

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A page that collects script errors and failed requests (the prerender
// file is left out: blocked on purpose, so tests do not prerender pages).
export async function openPage(context, { device, reduceMotion = false, viewport = { width: 1280, height: 860 } } = {}) {
  const page = await context.newPage();
  if (device) await page.emulate(device);
  else await page.setViewport(viewport);
  if (reduceMotion) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.setRequestInterception(true);
  page.on("request", (r) => (r.url().includes("speculation-rules") ? r.respond({ status: 404, body: "" }) : r.continue()));
  page.problems = [];
  page.on("pageerror", (e) => page.problems.push(e.message));
  page.on("response", (r) => r.status() >= 400 && !r.url().includes("speculation-rules") && page.problems.push(`${r.status()} ${r.url()}`));
  return page;
}
