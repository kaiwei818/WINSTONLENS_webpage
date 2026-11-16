// Set page. The server already put the title, description, and photo grid into
// the page (see functions/sets/[slug].js), so there is nothing to download or
// build here. This script makes the photos clickable (tapping one opens the
// full-screen viewer), filters it ("Find my photos"), keeps the visitor's
// hearts, and handles license codes.

import { createLightbox } from "./lightbox.js";
import { sortTags, tagLabel, tagList } from "./tags.js";

// The photo details (all sizes, captions, camera info), sent along in the page.
const photos = JSON.parse(document.getElementById("set-data").textContent);
const slug = decodeURIComponent(location.pathname.split("/").pop());

// ---------- Licensed downloads ----------
// After a valid code is entered, photos with a clean copy get a Download button
// in the viewer. The code is remembered only in this browser tab (sessionStorage),
// and the server checks it again on every download.
let licenseCode = "";
try {
  licenseCode = sessionStorage.getItem(`license:${slug}`) || "";
} catch {}

// ---------- Hearts ----------
// Kept in this browser (localStorage): the photos this visitor hearted, and a
// random id that lets the server count one heart per visitor (api/hearts.js).
function stored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
const hearted = new Set(stored("hearts", []));
let visitor = stored("visitor", "");
if (!visitor) store("visitor", (visitor = crypto.randomUUID()));

// ---------- Find my photos ----------
// One chip per player tagged in this set (jersey numbers first), plus
// "My favorites" once the visitor has hearted something here. ?player=12 in
// the address opens the set already filtered, so the link can be shared.
const FAVORITES = "\u2665"; // the filter value for "My favorites"
const tagsOf = photos.map((photo) => tagList(photo.tags));
const allTags = sortTags([...new Set(tagsOf.flat())]);
let filter = "";
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const matches = (i) => !filter ||
  (filter === FAVORITES ? hearted.has(photos[i].id) : tagsOf[i].some((tag) => same(tag, filter)));

const thumbs = document.querySelectorAll("#photo-grid .thumb-button");
const lightbox = createLightbox(photos, {
  downloadUrl: (photo) =>
    licenseCode && photo.downloadable ? `/api/download/${photo.id}?code=${encodeURIComponent(licenseCode)}` : "",
  thumbFor: (index) => thumbs[index] || null,
  visible: matches,
  onShow: paintHeart,
});

function renderFilter() {
  const favorites = photos.filter((p) => hearted.has(p.id)).length;
  const box = document.getElementById("photo-filter");
  box.hidden = !allTags.length && !favorites;
  if (box.hidden) return;
  const chip = (value, text) => {
    const a = document.createElement("a");
    a.href = value && value !== FAVORITES ? `?player=${encodeURIComponent(value)}` : location.pathname;
    a.textContent = text;
    if (filter === value) a.setAttribute("aria-current", "page");
    a.addEventListener("click", (event) => {
      event.preventDefault();
      applyFilter(filter === value ? "" : value); // tapping the chosen chip again shows all
    });
    return a;
  };
  document.getElementById("photo-filter-chips").replaceChildren(
    chip("", "All"),
    ...allTags.map((tag) => chip(tag, tagLabel(tag))),
    ...(favorites ? [chip(FAVORITES, `\u2665 My favorites (${favorites})`)] : []),
  );
}

function applyFilter(value) {
  filter = value;
  if (filter === FAVORITES && !photos.some((p) => hearted.has(p.id))) filter = "";
  let count = 0;
  thumbs.forEach((button, i) => {
    button.parentElement.hidden = !matches(i);
    if (matches(i)) count++;
  });
  const photoWord = `${count} ${count === 1 ? "photo" : "photos"}`;
  document.getElementById("photo-filter-label").textContent = !filter ? "Find my photos"
    : filter === FAVORITES ? `Your favorites: ${photoWord}` : `${photoWord} of ${tagLabel(filter)}`;
  // A player's filter goes into the address (and the Share button), so the
  // link opens on just their photos. Favorites are this visitor's own: not shared.
  const query = filter && filter !== FAVORITES ? `?player=${encodeURIComponent(filter)}` : "";
  history.replaceState(history.state, "", location.pathname + query);
  if (query) document.documentElement.dataset.shareUrl = location.origin + location.pathname + query;
  else delete document.documentElement.dataset.shareUrl;
  renderFilter();
}

const wanted = new URLSearchParams(location.search).get("player") || "";
const startTag = allTags.find((tag) => same(tag, wanted.replace(/^#/, "")));
if (startTag) applyFilter(startTag);
else renderFilter();

const heartButton = document.getElementById("lightbox-heart");
let current = null;
function paintHeart(photo = current) {
  current = photo;
  const on = hearted.has(photo.id);
  heartButton.setAttribute("aria-pressed", String(on));
  heartButton.setAttribute("aria-label", on ? "Remove your heart" : "Heart this photo");
}
function setHeart(photo, on) {
  if (on) hearted.add(photo.id);
  else hearted.delete(photo.id);
  store("hearts", [...hearted]);
  if (current === photo) paintHeart();
  if (filter === FAVORITES) applyFilter(FAVORITES);
  else renderFilter();
}
heartButton.addEventListener("click", async () => {
  const photo = current;
  const on = !hearted.has(photo.id);
  setHeart(photo, on); // at once; put back if the server says no
  try {
    const response = await fetch("/api/hearts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_id: photo.id, visitor, on }),
    });
    if (response.ok) return;
  } catch {}
  setHeart(photo, !on);
});

const licenseForm = document.getElementById("license-form");
const downloadable = photos.filter((p) => p.downloadable);
let downloadsLeft = null; // null: no limit (or not known yet)

if (licenseForm) {
  if (licenseCode) {
    showUnlocked(null);
    // Ask again quietly: the code may have been switched off, or used up, since.
    checkCode(licenseCode).then((data) => {
      if (data.ok) showUnlocked(data.downloads_left);
      else forgetCode(data.error);
    });
  }
  licenseForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = document.getElementById("license-error");
    error.textContent = "";
    const code = document.getElementById("license-code").value;
    const data = await checkCode(code);
    if (!data.ok) {
      error.textContent = data.error;
      return;
    }
    licenseCode = code;
    try {
      sessionStorage.setItem(`license:${slug}`, code);
    } catch {}
    showUnlocked(data.downloads_left);
    lightbox.refresh();
  });
}

async function checkCode(code) {
  try {
    const response = await fetch("/api/license/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, slug }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: data.error || "Could not check the code. Please try again." };
    return { ok: true, downloads_left: data.downloads_left ?? null };
  } catch {
    return { ok: false, error: "Could not check the code. Please try again." };
  }
}

// The saved code stopped working: go back to the empty form, with the reason.
function forgetCode(reason) {
  licenseCode = "";
  try {
    sessionStorage.removeItem(`license:${slug}`);
  } catch {}
  licenseForm.hidden = false;
  document.getElementById("license-panel").classList.remove("unlocked");
  document.getElementById("download-all-row").hidden = true;
  document.getElementById("license-help").textContent =
    "Enter the code you received to download full-quality copies without the watermark.";
  document.getElementById("license-error").textContent = reason;
  lightbox.refresh();
}

function showUnlocked(left) {
  downloadsLeft = left;
  const count = downloadable.length;
  const limit = left === null || left === undefined ? "" : ` You have ${left} ${left === 1 ? "download" : "downloads"} left.`;
  document.getElementById("license-help").textContent =
    `Code accepted. Open a photo and use the Download button, or download them all at once (${count} ${count === 1 ? "photo" : "photos"} available).${limit}`;
  licenseForm.hidden = true;
  document.getElementById("license-panel").classList.add("unlocked");

  // "Download all": every photo counts as one download toward the code's limit.
  const row = document.getElementById("download-all-row");
  const button = document.getElementById("download-all");
  const status = document.getElementById("download-all-status");
  row.hidden = count < 2;
  button.textContent = `Download all ${count} (.zip)`;
  const enough = left === null || left === undefined || left >= count;
  button.disabled = !enough;
  status.textContent = enough ? "" : `Needs ${count} downloads; your code has ${left} left. Download photos one by one instead.`;
}

// ---------- Download all ----------
// The photos are fetched one by one (each is checked and counted by the server,
// exactly like a single download), then packed into one .zip in the browser.
document.getElementById("download-all")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const status = document.getElementById("download-all-status");
  button.disabled = true;
  const files = [];
  let problem = "";
  for (const [n, photo] of downloadable.entries()) {
    status.textContent = `Downloading ${n + 1} of ${downloadable.length}...`;
    try {
      const response = await fetch(`/api/download/${photo.id}?code=${encodeURIComponent(licenseCode)}&all=1`);
      if (!response.ok) {
        problem = await response.text();
        break;
      }
      // The server names each file; keep that name inside the .zip.
      const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") || "")?.[1] || `${slug}-${photo.id}.jpg`;
      files.push({ name, blob: await response.blob() });
    } catch {
      problem = "The connection was interrupted.";
      break;
    }
  }

  if (files.length) {
    status.textContent = "Making the .zip file...";
    const { makeZip } = await import("./zip.js");
    const zip = await makeZip(files);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(zip);
    link.download = `${slug}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
  }
  const message = problem
    ? `Stopped after ${files.length} of ${downloadable.length}: ${problem}${files.length ? " The ones that worked are in the .zip." : ""}`
    : `Done: ${files.length} photos saved as ${slug}.zip.`;

  // Update the number of downloads left (a used-up code fails this check).
  const data = await checkCode(licenseCode);
  if (data.ok) showUnlocked(data.downloads_left);
  else button.disabled = true;
  status.textContent = message;
});

for (const button of thumbs) {
  const index = Number(button.dataset.index);
  button.addEventListener("click", () => lightbox.open(index, button));

  // Remember which file the grid picture used, so the viewer can show it
  // instantly while the large version loads.
  const img = button.querySelector("img");
  const remember = () => (photos[index].gridSrc = img.currentSrc);
  if (img.complete) remember();
  else img.addEventListener("load", remember);
}

// A link to one photo (/sets/kyoto?photo=3, from sharing or a reload) opens it.
// The address first goes back to the plain set page, so Back then closes the
// viewer and stays on the set, instead of leaving the site.
// After a reload with a photo open, the history entry is already the viewer's
// own: reopen it without adding another.
const shared = Number(new URLSearchParams(location.search).get("photo")) - 1;
if (photos[shared]) {
  const reloaded = Boolean(history.state?.lightbox);
  if (!reloaded) history.replaceState(null, "", location.pathname);
  lightbox.open(shared, thumbs[shared], { instant: true, push: !reloaded });
}

// Right-click and long-press saving are blocked for the whole site in protect.js.
