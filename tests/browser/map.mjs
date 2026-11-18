// The map: what reaches visitors (exact, rounded, or nothing), and the page.

import { execFileSync } from "node:child_process";
import { openPage, wait } from "./helpers.mjs";

const sql = (command) => execFileSync("npx", ["wrangler", "d1", "execute", "portfolio-db", "--local", "--command", command], { stdio: "pipe" });

export default async function ({ context, base, check }) {
  const source = await (await fetch(`${base}/map`)).text();
  check("a rough-area set leaves the server rounded, never exact", source.includes('"lat":25,"lng":121.6') && !source.includes("25.0273"));
  check("a hidden set is never sent", !source.includes("121.7419"));

  const page = await openPage(context);
  await page.goto(`${base}/map`, { waitUntil: "networkidle0" });
  await wait(800);
  check("a cover pin per set, the rough one dashed with an area", (await page.$$(".map-pin")).length === 2 &&
    (await page.$$(".map-pin-area")).length === 1 && (await page.$$(".map-area")).length === 1);
  // Hovering grows the pin in place; it used to jump away (the scale multiplied
  // Leaflet's position transform).
  const center = async () => page.$eval(".map-pin:not(.map-pin-area)", (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const before = await center();
  await page.mouse.move(before.x, before.y); await wait(400);
  const after = await center();
  check("hovering a pin keeps it in place", Math.hypot(after.x - before.x, after.y - before.y) < 1, JSON.stringify({ before, after }));
  await page.click(".map-pin:not(.map-pin-area)"); await wait(500);
  check("tapping a pin opens its card with View set", (await page.$eval(".leaflet-popup .pill", (a) => a.getAttribute("href"))) === "/sets/coastline");
  check("the same sets are listed under the map", (await page.$$("#map-list li")).length === 2);
  // Map pictures come from OpenStreetMap (needs the internet): only script errors count here.
  check("no script errors", page.problems.filter((p) => !p.includes("tile.openstreetmap.org")).length === 0, page.problems.join(" | "));
  await page.close();

  // Two sets in the same place (like several games at one arena): one pin
  // with a count, whose card lists both. Put back afterwards.
  sql("UPDATE sets SET map_lat = 51.1784, map_lng = -115.5708, map_precision = 'exact' WHERE slug = 'city-nights'");
  try {
    const shared = await openPage(context);
    await shared.goto(`${base}/map`, { waitUntil: "networkidle0" });
    await wait(800);
    check("sets in one place share a pin with a count", (await shared.$$(".map-pin")).length === 1 &&
      (await shared.$eval(".map-pin-count", (el) => el.textContent)) === "2");
    await shared.click(".map-pin"); await wait(500);
    const links = await shared.$$eval(".leaflet-popup .map-choice", (all) => all.map((a) => a.getAttribute("href")).sort());
    check("its card lists every set there, each linking to it", JSON.stringify(links) === JSON.stringify(["/sets/city-nights", "/sets/coastline"]), JSON.stringify(links));
    check("the list scrolls when it is long", (await shared.$eval(".map-choices", (el) => getComputedStyle(el).overflowY)) === "auto");
    await shared.close();
  } finally {
    sql("UPDATE sets SET map_lat = 25.0273, map_lng = 121.5764, map_precision = 'region' WHERE slug = 'city-nights'");
  }
}
