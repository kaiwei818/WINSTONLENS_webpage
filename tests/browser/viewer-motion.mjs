// The photo viewer: settling in, keys staying instant, the arrows not moving
// when pressed, swipes and drag-down on a phone, and reduced motion.

import { KnownDevices } from "puppeteer-core";
import { openPage, wait } from "./helpers.mjs";

const counter = (page) => page.$eval("#lightbox-counter", (e) => e.textContent);
const settling = (page) => page.$eval("#lightbox-img", (e) => e.getAnimations().filter((a) => !(a instanceof CSSTransition)).length);

export default async function ({ context, base, check }) {
  // Computer, mouse
  let page = await openPage(context);
  await page.goto(`${base}/sets/coastline`, { waitUntil: "networkidle0" });
  await page.click(".thumb-button");
  await page.waitForSelector("#lightbox[open]");
  await wait(600);
  check("opens from the grid", (await counter(page)) === "1 / 6");
  const centre = () => page.$eval("#lightbox-next", (b) => Math.round(b.getBoundingClientRect().top + b.getBoundingClientRect().height / 2));
  const before = await centre();
  const box = await (await page.$("#lightbox-next")).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await wait(200);
  const held = await centre();
  await page.mouse.up(); await wait(50);
  check("the › arrow stays in place while pressed", Math.abs(held - before) <= 1, `${before} -> ${held}`);
  check("a click on › settles the next photo in", (await counter(page)) === "2 / 6" && (await settling(page)) === 1);
  await wait(400);
  await page.keyboard.press("ArrowRight"); await wait(30);
  check("the arrow keys change photos instantly", (await counter(page)) === "3 / 6" && (await settling(page)) === 0);
  for (let i = 0; i < 4; i++) { await page.click("#lightbox-next"); await wait(40); }
  check("quick clicks never pile up animations", (await settling(page)) <= 1);
  await wait(400);
  const open = await page.$eval("#lightbox", (d) => parseFloat(getComputedStyle(d).transitionDuration));
  await page.keyboard.press("Escape"); await wait(700);
  const closing = await page.$eval("#lightbox", (d) => parseFloat(getComputedStyle(d).transitionDuration));
  check("Escape closes, and closing is quicker than opening", !(await page.$("#lightbox[open]")) && closing < open, `${open}s / ${closing}s`);
  check("no errors (computer)", page.problems.length === 0, page.problems.join(" | "));
  await page.close();

  // Reduced motion
  page = await openPage(context, { reduceMotion: true });
  await page.goto(`${base}/sets/coastline`, { waitUntil: "networkidle0" });
  await page.click(".thumb-button"); await page.waitForSelector("#lightbox[open]"); await wait(300);
  await page.click("#lightbox-next"); await wait(20);
  check("reduced motion: no settling, no fades", (await settling(page)) === 0 &&
    (await page.$eval("#lightbox-close", (b) => getComputedStyle(b).transitionProperty)) === "none");
  await page.close();

  // Phone, touch
  page = await openPage(context, { device: KnownDevices["iPhone 13"] });
  await page.goto(`${base}/sets/coastline`, { waitUntil: "networkidle0" });
  const cdp = await page.createCDPSession();
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  async function drag(x1, y1, x2, y2, steps, ms, hold = false) {
    await touch("touchStart", x1, y1);
    for (let i = 1; i <= steps; i++) { await touch("touchMove", x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps); await wait(ms / steps); }
    if (!hold) await touch("touchEnd");
  }
  const tb = await (await page.$(".thumb-button")).boundingBox();
  await touch("touchStart", tb.x + 20, tb.y + 20); await touch("touchEnd");
  await page.waitForSelector("#lightbox[open]"); await wait(600);
  check("phone: a tapped photo is not left dimmed", (await page.$eval(".thumb-button img", (i) => getComputedStyle(i).opacity)) === "1");
  await drag(295, 420, 135, 420, 8, 240); await wait(30);
  check("phone: swiping left goes to the next photo", (await counter(page)) === "2 / 6");
  await wait(400);
  await drag(195, 420, 225, 420, 2, 40); await wait(30);
  check("phone: a short quick flick counts", (await counter(page)) === "1 / 6");
  await wait(400);
  await drag(195, 320, 195, 480, 8, 400, true);
  const dragged = await page.$eval("#lightbox-img", (i) => i.style.transform);
  await touch("touchMove", 195, 360); await touch("touchEnd"); await wait(400);
  check("phone: dragging down follows the finger, and letting go high up cancels", /translateY\(160px\)/.test(dragged) && Boolean(await page.$("#lightbox[open]")));
  await drag(195, 320, 195, 570, 8, 400); await wait(900);
  check("phone: dragging down far closes the viewer", !(await page.$("#lightbox[open]")));
  check("no errors (phone)", page.problems.length === 0, page.problems.join(" | "));
  await page.close();
}
