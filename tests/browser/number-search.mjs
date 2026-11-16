// "Find my photos": the number box and its suggestions, the filtered viewer,
// hearts and My favorites.

import { KnownDevices } from "puppeteer-core";
import { openPage, wait } from "./helpers.mjs";

const visible = (page) => page.$$eval("#photo-grid li", (lis) => lis.filter((l) => !l.hidden).length);
const suggestions = (page) => page.$$eval("#number-options:not([hidden]) li", (lis) => lis.map((l) => l.textContent));
const status = (page) => page.$eval("#photo-filter-status", (e) => e.textContent);

export default async function ({ context, base, check }) {
  const page = await openPage(context);
  await page.goto(`${base}/sets/coastline`, { waitUntil: "networkidle0" });
  await page.click("#number-search"); await wait(30);
  check("suggestions: numbers in order, with counts", JSON.stringify(await suggestions(page)) === JSON.stringify(["#72 photos", "#124 photos", "#232 photos"]));
  await page.keyboard.type("12"); await wait(30);
  check("typing 12 shows #12's 4 photos", (await visible(page)) === 4 && (await status(page)) === "4 photos of #12");
  check("the address and Share carry ?number=12", (await page.evaluate(() => location.search)) === "?number=12" &&
    (await page.evaluate(() => document.documentElement.dataset.shareUrl)).endsWith("/sets/coastline?number=12"));
  await page.click("#number-clear"); await wait(50);
  check("× shows all photos again", (await visible(page)) === 6);
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter"); await wait(50);
  check("arrow keys and Enter pick a number", (await visible(page)) === 4);
  await page.click("#number-search", { clickCount: 3 }); await page.keyboard.type("99"); await wait(30);
  check("an unknown number says so", (await status(page)) === "No photos tagged #99 in this set yet.");
  await page.click("#number-search", { clickCount: 3 }); await page.keyboard.press("Backspace"); await wait(30);
  await page.click("#number-options li:last-child"); await wait(50);
  check("clicking a suggestion picks it", (await status(page)) === "2 photos of #23");
  await page.keyboard.press("Escape");

  await page.click("#photo-grid li:not([hidden]) .thumb-button");
  await page.waitForSelector("#lightbox[open]"); await wait(500);
  check("the viewer counts only the filtered photos", (await page.$eval("#lightbox-counter", (e) => e.textContent)) === "1 / 2");
  await page.click("#lightbox-heart"); await wait(40);
  check("Like fills, says Liked, and pops", (await page.$eval("#lightbox-heart", (b) => b.textContent.trim())) === "Liked" &&
    (await page.$eval("#lightbox-heart svg", (s) => s.getAnimations().length)) === 1);
  await wait(400);
  await page.keyboard.press("Escape"); await wait(600);
  await page.click("#favorites-toggle"); await wait(50);
  check("My favorites shows just the liked photo", (await visible(page)) === 1);
  // Un-liking inside the viewer keeps the photo's own address.
  await page.click("#photo-grid li:not([hidden]) .thumb-button");
  await page.waitForSelector("#lightbox[open]"); await wait(600);
  const address = await page.evaluate(() => location.search);
  await page.click("#lightbox-heart"); await wait(300);
  check("un-liking in My favorites keeps the photo's address", address.startsWith("?photo=") && (await page.evaluate(() => location.search)) === address, `${address} -> ${await page.evaluate(() => location.search)}`);
  await page.keyboard.press("Escape"); await wait(600);

  await page.goto(`${base}/sets/coastline?number=7`, { waitUntil: "networkidle0" });
  check("a ?number=7 link opens on #7", (await visible(page)) === 2);
  await page.goto(`${base}/sets/forest`, { waitUntil: "networkidle0" });
  check("a set without numbers or likes shows no search", await page.$eval("#photo-filter", (e) => e.hidden));
  check("no errors (computer)", page.problems.length === 0, page.problems.join(" | "));
  await page.close();

  const phone = await openPage(context, { device: KnownDevices["iPhone 13"] });
  await phone.goto(`${base}/sets/coastline`, { waitUntil: "networkidle0" });
  await phone.tap("#number-search"); await wait(100);
  await phone.tap("#number-options li:nth-child(2)"); await wait(100);
  check("phone: tapping a suggestion picks it", (await visible(phone)) === 4);
  await phone.close();
}
