// Downloads 思源黑體 (Noto Sans TC, SIL Open Font License) from Google Fonts
// into public/fonts/noto-sans-tc/ and writes public/css/noto-sans-tc.css, so
// the site serves it itself: visitors' browsers never ask Google.
//
// The font comes in 108 pieces, each a range of characters ("unicode-range"),
// and each covering every weight from regular to bold. A page downloads only
// the pieces holding the characters it shows, usually a few hundred KB.
// Only Chinese pages load the stylesheet (functions/_middleware.js).
//
// Run once: node scripts/zh-font.mjs   (again only to update the font)

import { mkdir, writeFile } from "node:fs/promises";

const CSS_URL = "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400..700&display=swap";
// Google sends woff2 (the smallest format) only to browsers it knows can read it.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const FONT_DIR = new URL("../public/fonts/noto-sans-tc/", import.meta.url);

const css = await (await fetch(CSS_URL, { headers: { "User-Agent": UA } })).text();
const files = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g)].map((m) => m[1]);
if (files.length < 50) throw new Error(`Expected about 100 pieces, got ${files.length}.`);

await mkdir(FONT_DIR, { recursive: true });
let total = 0;
let local = css;
for (const [i, url] of files.entries()) {
  const name = `${String(i).padStart(3, "0")}.woff2`;
  const bytes = new Uint8Array(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
  await writeFile(new URL(name, FONT_DIR), bytes);
  total += bytes.length;
  local = local.replace(url, `/fonts/noto-sans-tc/${name}`);
}

const header = `/* 思源黑體 (Noto Sans TC), regular to bold, stored on this site in ${files.length} pieces.
   Made by scripts/zh-font.mjs from Google Fonts; SIL Open Font License
   (fonts/noto-sans-tc/OFL.txt). Loaded on Chinese pages only. */\n`;
await writeFile(new URL("../public/css/noto-sans-tc.css", import.meta.url), header + local.replace(/\/\* \[\d+\] \*\/\n/g, ""));
console.log(`${files.length} pieces, ${(total / 1024 / 1024).toFixed(1)} MB in all.`);
