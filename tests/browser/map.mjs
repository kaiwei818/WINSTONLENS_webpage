// The map: what reaches visitors (exact, rounded, or nothing), and the page.

import { openPage, wait } from "./helpers.mjs";

export default async function ({ context, base, check }) {
  const source = await (await fetch(`${base}/map`)).text();
  check("a rough-area set leaves the server rounded, never exact", source.includes('"lat":25,"lng":121.6') && !source.includes("25.0273"));
  check("a hidden set is never sent", !source.includes("121.7419"));

  const page = await openPage(context);
  await page.goto(`${base}/map`, { waitUntil: "networkidle0" });
  await wait(800);
  check("a cover pin per set, the rough one dashed with an area", (await page.$$(".map-pin")).length === 2 &&
    (await page.$$(".map-pin-area")).length === 1 && (await page.$$(".map-area")).length === 1);
  await page.click(".map-pin:not(.map-pin-area)"); await wait(500);
  check("tapping a pin opens its card with View set", (await page.$eval(".leaflet-popup .pill", (a) => a.getAttribute("href"))) === "/sets/coastline");
  check("the same sets are listed under the map", (await page.$$("#map-list li")).length === 2);
  // Map pictures come from OpenStreetMap (needs the internet): only script errors count here.
  check("no script errors", page.problems.filter((p) => !p.includes("tile.openstreetmap.org")).length === 0, page.problems.join(" | "));
  await page.close();
}
