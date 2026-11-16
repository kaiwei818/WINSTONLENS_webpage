// The admin pages: the same top links everywhere, folding panels, the map
// place format, and logging out. Logged in with the runner's throwaway secret.

import { openPage, wait } from "./helpers.mjs";

export default async function ({ context, base, cookie, check }) {
  const page = await openPage(context, { viewport: { width: 1280, height: 900 } });
  await page.setCookie({ name: "session", value: cookie, domain: "localhost", path: "/" });
  const go = async (path) => { await page.goto(base + path, { waitUntil: "load" }); await wait(700); };

  for (const [path, current] of [["/admin/", "Dashboard"], ["/admin/licenses", "License codes"], ["/admin/toolkit", "Toolkit"]]) {
    await go(path);
    const links = await page.$$eval(".admin-header nav a, .admin-header nav [data-logout]", (els) => els.slice(0, 8).map((e) => e.textContent.trim() + (e.getAttribute("aria-current") ? "*" : "")));
    const want = ["Dashboard", "Instagram picks", "License codes", "Toolkit", "Activity", "About page", "View site", "Log out"].map((l) => (l === current ? `${l}*` : l));
    check(`${path}: the same top links, current page marked`, JSON.stringify(links) === JSON.stringify(want), links.join(" | "));
  }

  await go("/admin/");
  const setId = await page.$eval(".admin-set-list a[href*='/admin/set?id=']", (a) => new URL(a.href).searchParams.get("id"));
  await page.evaluate(() => localStorage.clear());
  await go(`/admin/set?id=${setId}`);
  const folds = await page.$$eval("details.fold", (ds) => ds.filter((d) => !d.closest("[hidden]")).map((d) => d.querySelector("h2").textContent + (d.open ? ":open" : ":closed")));
  check("set page: the rarely used panels start folded", JSON.stringify(folds) === JSON.stringify(["Visibility:open", "Set details:closed", "Watermark and downloads:closed", "Add photos:open", "Photos in this set:open", "Delete this set:closed"]), folds.join(" | "));
  const height = () => page.$eval("#details-form", (f) => Math.round(f.getBoundingClientRect().height));
  const closed = await height();
  await page.click("#details-form .fold-head"); await wait(80);
  const mid = await height(); await wait(450);
  check("Set details opens smoothly", closed < mid && mid < (await height()), `${closed} -> ${mid}`);
  await page.click("#map-place", { clickCount: 3 }); await page.type("#map-place", "51.41728° N, 116.23912° W"); await page.keyboard.press("Tab"); await wait(600);
  await page.reload({ waitUntil: "load" }); await wait(700);
  check("the fold is remembered, and the place shows as 51.41728° N, 116.23912° W",
    (await page.$eval("#details-form details.fold", (d) => d.open)) && (await page.$eval("#map-place", (e) => e.value)) === "51.41728° N, 116.23912° W");

  await go("/admin/toolkit");
  await Promise.all([page.waitForNavigation(), page.click("[data-logout]")]);
  check("Log out works from any admin page", page.url().endsWith("/admin/login"));
  check("no errors", page.problems.length === 0, page.problems.join(" | "));
  await page.close();
}
