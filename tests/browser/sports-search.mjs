// The Sports page's number search over every sports set, links into each
// set's filtered viewer, and the admin number boxes (Sports sets only).

import { openPage, wait } from "./helpers.mjs";

const suggestions = (page) => page.$$eval("#number-options:not([hidden]) li", (lis) => lis.map((l) => l.textContent));
const groups = (page) => page.$$eval("#number-results .number-group", (gs) => gs.map((g) =>
  `${g.querySelector(".number-group-title a").textContent}:${g.querySelectorAll(".number-photos li").length}`));

export default async function ({ context, base, cookie, check }) {
  const page = await openPage(context);
  await page.goto(`${base}/?category=sports`, { waitUntil: "networkidle0" });
  check("the Sports page has the number search", !(await page.$eval("#sports-search", (e) => e.hidden)));
  await page.click("#number-search"); await wait(30);
  check("suggestions cover every sports set", JSON.stringify(await suggestions(page)) === JSON.stringify(["#72 photos", "#125 photos", "#232 photos"]),
    (await suggestions(page)).join(" | "));
  await page.keyboard.type("12"); await wait(50);
  check("#12: its photos, grouped by set, instead of the set cards",
    JSON.stringify(await groups(page)) === JSON.stringify(["Coastline:4", "City Nights:1"]) && (await page.$eval("#set-grid", (e) => e.hidden)),
    (await groups(page)).join(" | "));
  check("the status and the address say #12", (await page.$eval("#photo-filter-status", (e) => e.textContent)) === "5 photos of #12" &&
    (await page.evaluate(() => location.search)) === "?category=sports&number=12");
  await page.click("#number-search", { clickCount: 3 }); await page.keyboard.type("99"); await wait(30);
  check("an unknown number says so", (await page.$eval("#photo-filter-status", (e) => e.textContent)) === "No photos tagged #99 in the sports sets yet.");
  await page.click("#number-clear"); await wait(50);
  check("× brings the set cards back", !(await page.$eval("#set-grid", (e) => e.hidden)) && (await page.$eval("#number-results", (e) => e.hidden)));

  await page.goto(`${base}/?category=sports&number=12`, { waitUntil: "networkidle0" });
  check("a ?number=12 link opens already searched", (await groups(page)).length === 2);
  await page.click("#number-results .number-photos a");
  await page.waitForSelector("#lightbox[open]"); await wait(500);
  check("a photo opens in its set's viewer, with only #12's photos",
    (await page.evaluate(() => location.pathname)) === "/sets/coastline" &&
    (await page.$eval("#lightbox-counter", (e) => e.textContent)) === "1 / 4");
  await page.keyboard.press("Escape"); await wait(600);
  check("closing it leaves the set filtered to #12", (await page.evaluate(() => location.search)) === "?number=12" &&
    (await page.$$eval("#photo-grid li", (lis) => lis.filter((l) => !l.hidden).length)) === 4);

  await page.goto(`${base}/?category=landscape`, { waitUntil: "networkidle0" });
  check("other categories have no number search", (await page.$("#sports-search")) === null && (await page.$("script[data-sports]")) === null);
  await page.goto(`${base}/?category=sports&lang=zh`, { waitUntil: "networkidle0" });
  check("in Chinese too", (await page.$eval("label[for=number-search]", (e) => e.textContent)) === "用背號找所有運動作品集裡的照片");
  await page.goto(`${base}/?lang=en`, { waitUntil: "networkidle0" });
  check("no script errors", page.problems.length === 0, page.problems.join(" | "));
  await page.close();

  // Admin: the jersey number boxes only on Sports sets.
  const admin = await openPage(context, { viewport: { width: 1280, height: 900 } });
  await admin.setCookie({ name: "session", value: cookie, domain: "localhost", path: "/" });
  const idOf = async (slug) => (await (await fetch(`${base}/api/admin/sets`, { headers: { Cookie: `session=${cookie}` } })).json())
    .find((s) => s.slug === slug).id;
  const numberBoxes = async (slug) => {
    await admin.goto(`${base}/admin/set?id=${await idOf(slug)}`, { waitUntil: "load" }); await wait(900);
    return admin.$$eval(".numbers-field", (fs) => fs.filter((f) => f.offsetParent !== null).length);
  };
  check("admin: a Sports set has number boxes", (await numberBoxes("coastline")) > 0);
  check("admin: other sets do not", (await numberBoxes("forest")) === 0);
  await admin.close();
}
