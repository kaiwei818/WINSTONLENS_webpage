// Browser checks: the photo viewer's motion, the number search, the map's
// privacy rules and the admin folding, in real Chrome against a local copy of
// the site. Run with: npm run test:browser
//
// Needs: Chrome installed (or CHROME_PATH set), the sample sets in your local
// database (npm run seed:local), and puppeteer-core (npm install -D puppeteer-core@24).
// It starts the site on port 8790 with a throwaway login secret (never your
// real one), and gives the sample sets jersey numbers and map places in your
// local database. The live site is never touched.

import { spawn, execFileSync } from "node:child_process";
import { createSessionCookie } from "../../lib/auth.js";

let puppeteer;
try {
  puppeteer = (await import("puppeteer-core")).default;
} catch {
  console.error("Browser checks need puppeteer-core. Install it once with: npm install -D puppeteer-core@24");
  process.exit(1);
}

const PORT = 8790;
const BASE = `http://localhost:${PORT}`;
const SECRET = "browser-test-only-secret-0123456789abcdef";
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SUITES = ["viewer-motion", "number-search", "map", "admin-folds"];

// The sample sets get what the checks expect: #12 on four Coastline photos,
// #7 on two, #23 on two; Coastline exactly on the map, City Nights as a rough
// area, Forest hidden.
const FIXTURES = `
UPDATE photos SET tags = CASE (id % 3) WHEN 0 THEN '12, 7' WHEN 1 THEN '12' ELSE '23' END WHERE set_id = (SELECT id FROM sets WHERE slug = 'coastline');
UPDATE photos SET tags = '' WHERE set_id != (SELECT id FROM sets WHERE slug = 'coastline');
UPDATE sets SET map_lat = 51.1784, map_lng = -115.5708, map_precision = 'exact' WHERE slug = 'coastline';
UPDATE sets SET map_lat = 25.0273, map_lng = 121.5764, map_precision = 'region' WHERE slug = 'city-nights';
UPDATE sets SET map_lat = 25.1287, map_lng = 121.7419, map_precision = 'hidden' WHERE slug = 'forest';
DELETE FROM photo_hearts;`;

const wrangler = (args) => execFileSync("npx", ["wrangler", ...args], { stdio: "pipe" }).toString();
wrangler(["d1", "migrations", "apply", "portfolio-db", "--local"]);
if (!wrangler(["d1", "execute", "portfolio-db", "--local", "--command", "SELECT COUNT(*) AS n FROM sets WHERE slug = 'coastline'"]).includes('"n": 1')) {
  console.error("The sample sets are missing. Run npm run seed:local first (it replaces your local data).");
  process.exit(1);
}
wrangler(["d1", "execute", "portfolio-db", "--local", "--command", FIXTURES]);

const server = spawn("npx", ["wrangler", "pages", "dev", "--port", String(PORT), "--binding", `SESSION_SECRET=${SECRET}`], { stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-server.pid); } catch {} };
process.on("exit", stop);
for (let i = 0; ; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch {}
  if (i > 60) { console.error("The local site did not start."); process.exit(1); }
  await new Promise((r) => setTimeout(r, 1000));
}

const cookie = (await createSessionCookie(new Request(BASE), { SESSION_SECRET: SECRET })).split(";")[0].slice("session=".length);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
let passed = 0;
let failed = 0;
for (const name of SUITES) {
  console.log(`\n${name}`);
  const context = await browser.createBrowserContext(); // each suite starts with a fresh browser profile
  const check = (label, ok, detail = "") => {
    ok ? passed++ : failed++;
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail !== "" && !ok ? `  (${detail})` : ""}`);
  };
  try {
    await (await import(`./${name}.mjs`)).default({ context, base: BASE, cookie, check });
  } catch (err) {
    check("finished without a crash", false, err.message);
  }
  await context.close();
}
await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
