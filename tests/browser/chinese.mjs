// The site in 繁體中文: every public page without English site words, your
// Chinese titles, the scripts' messages, switching back, and a browser set to
// Chinese (Taiwan) getting it by itself.

import { openPage, wait } from "./helpers.mjs";

// Site words that must not show in English on a Chinese page (English set
// titles and captions are content, and fine).
const ENGLISH = /\b(Work|About|Contact|Share|Menu|Sets|Categories|View set|Photo sets|photos?|Find my photos|Download|Like|Back to top|Get in touch|Skip to content|Dark mode|Light mode|Related sets|Have a license|Unlock|Map|What's new|rough area|Featured|Latest work|Page not found)\b/g;

export default async function ({ context, base, check }) {
  const page = await openPage(context);
  await page.goto(`${base}/?lang=zh`, { waitUntil: "networkidle0" }); // the choice, remembered from here on
  for (const path of ["/", "/sets/coastline", "/about", "/map", "/updates", "/no-such-page"]) {
    await page.goto(base + path, { waitUntil: "networkidle0" }); await wait(300);
    const text = await page.evaluate(() => document.body.innerText + " " +
      [...document.querySelectorAll("[aria-label],[placeholder]")].map((e) => e.getAttribute("aria-label") || e.getAttribute("placeholder")).join(" "));
    const left = text.replace(/City Nights|Coastline|Forest/g, "").match(ENGLISH) || [];
    check(`${path}: all in Chinese`, left.length === 0 && (await page.$eval("html", (h) => h.lang)) === "zh-Hant-TW", left.join(", "));
  }
  await page.goto(`${base}/sets/coastline`, { waitUntil: "networkidle0" });
  check("your Chinese title and description", (await page.$eval("#set-title", (e) => e.textContent)) === "海岸線" &&
    (await page.$eval("#set-description", (e) => e.textContent)) === "海邊的藍色時刻。");
  await page.click("#number-search"); await page.keyboard.type("12"); await wait(50);
  check("number search answers in Chinese", (await page.$eval("#photo-filter-status", (e) => e.textContent)) === "#12 共 4 張照片");
  await page.click("#number-search", { clickCount: 3 }); await page.keyboard.press("Backspace"); await page.keyboard.press("Escape");
  await page.click(".thumb-button"); await page.waitForSelector("#lightbox[open]"); await wait(500);
  await page.click("#lightbox-heart"); await wait(100);
  check("the viewer's buttons in Chinese", (await page.$eval("#lightbox-heart", (b) => b.textContent.trim())) === "已按讚" &&
    (await page.$eval("#lightbox-share", (b) => b.textContent.trim())) === "分享");
  await page.click("#lightbox-heart"); await wait(200);
  await page.keyboard.press("Escape"); await wait(600);
  await page.goto(base + (await page.$eval(".lang-switch", (a) => a.getAttribute("href"))), { waitUntil: "networkidle0" });
  check("English switches back on the same page", (await page.$eval("html", (h) => h.lang)) === "en" && (await page.$eval("#set-title", (e) => e.textContent)) === "Coastline");
  const problems = page.problems.filter((p) => !p.includes("/no-such-page")); // that one is meant to be "not found"
  check("no errors", problems.length === 0, problems.join(" | "));
  await page.close();

  const taiwan = await openPage(context);
  await taiwan.setExtraHTTPHeaders({ "Accept-Language": "zh-TW,zh;q=0.9" });
  await taiwan.deleteCookie({ name: "lang", domain: "localhost" });
  await taiwan.goto(`${base}/`, { waitUntil: "networkidle0" });
  check("a browser set to Chinese (Taiwan) gets 中文 by itself", (await taiwan.$eval("html", (h) => h.lang)) === "zh-Hant-TW");
  await taiwan.close();
}
