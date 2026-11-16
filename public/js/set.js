// Set page. The server already put the title, description, and photo grid into
// the page (see functions/sets/[slug].js), so there is nothing to download or
// build here. This script makes the photos clickable (tapping one opens the
// full-screen viewer), filters it ("Find my photos"), keeps the visitor's
// hearts, and handles license codes.

import { createLightbox } from "./lightbox.js";
import { sortTags, tagList } from "./tags.js";

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
// Search by jersey number: suggestions list the numbers tagged in this set,
// with how many photos each. ?number=12 in the address opens the set already
// filtered, so the link can be shared. Plus "My favorites": this visitor's hearts.
const FAVORITES = "favorites"; // the filter value for "My favorites"
const tagsOf = photos.map((photo) => tagList(photo.tags));
const numbers = sortTags([...new Set(tagsOf.flat())]);
const countOf = (n) => tagsOf.filter((tags) => tags.includes(n)).length;
let filter = "";
const matches = (i) => !filter || (filter === FAVORITES ? hearted.has(photos[i].id) : tagsOf[i].includes(filter));
const lessMotion = matchMedia("(prefers-reduced-motion: reduce)");
const ease = "cubic-bezier(0.16, 1, 0.3, 1)"; // --ease-out in style.css

const thumbs = document.querySelectorAll("#photo-grid .thumb-button");
const lightbox = createLightbox(photos, {
  downloadUrl: (photo) =>
    licenseCode && photo.downloadable ? `/api/download/${photo.id}?code=${encodeURIComponent(licenseCode)}` : "",
  thumbFor: (index) => thumbs[index] || null,
  visible: matches,
  onShow: paintHeart,
});

const search = document.getElementById("number-search");
const options = document.getElementById("number-options");
const clearButton = document.getElementById("number-clear");
const favoritesButton = document.getElementById("favorites-toggle");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function renderFilter() {
  const favorites = photos.filter((p) => hearted.has(p.id)).length;
  document.getElementById("photo-filter").hidden = !numbers.length && !favorites;
  document.getElementById("number-search-box").hidden = !numbers.length;
  favoritesButton.hidden = !favorites;
  favoritesButton.textContent = `\u2665 My favorites (${favorites})`;
  favoritesButton.setAttribute("aria-pressed", String(filter === FAVORITES));
  clearButton.hidden = !search.value;
}

// The photos change all at once, so the grid fades in rather than jumping.
function applyFilter(value, { fade = true } = {}) {
  if (value === FAVORITES && !photos.some((p) => hearted.has(p.id))) value = "";
  const changed = value !== filter;
  filter = value;
  const grid = document.getElementById("photo-grid");
  thumbs.forEach((button, i) => (button.parentElement.hidden = !matches(i)));
  if (changed && fade && !lessMotion.matches) grid.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: ease });
  const count = photos.filter((_, i) => matches(i)).length;
  document.getElementById("photo-filter-status").textContent = !filter ? ""
    : filter === FAVORITES ? `Your favorites: ${plural(count, "photo")}` : `${plural(count, "photo")} of #${filter}`;
  if (filter !== FAVORITES && search.value !== filter) search.value = filter;
  if (filter === FAVORITES) search.value = "";
  // A number goes into the address (and the Share button), so the link opens
  // on just those photos. Favorites are this visitor's own: not shared.
  const query = filter && filter !== FAVORITES ? `?number=${filter}` : "";
  history.replaceState(history.state, "", location.pathname + query);
  if (query) document.documentElement.dataset.shareUrl = location.origin + location.pathname + query;
  else delete document.documentElement.dataset.shareUrl;
  renderFilter();
}

// ---------- The suggestions (a combobox: type, or pick with the arrow keys) ----------
let active = -1;
function showOptions() {
  const typed = search.value;
  const found = numbers.filter((n) => n.startsWith(typed));
  active = found.indexOf(typed);
  options.replaceChildren(...found.map((n, i) => {
    const li = document.createElement("li");
    li.id = `number-option-${n}`;
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", String(i === active));
    li.dataset.number = n;
    const label = document.createElement("span");
    label.textContent = `#${n}`;
    const count = document.createElement("span");
    count.className = "number-count";
    count.textContent = plural(countOf(n), "photo");
    li.append(label, count);
    // pointerdown, not click: picks before the box loses focus and the list closes.
    li.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      choose(n);
    });
    return li;
  }));
  const open = document.activeElement === search && found.length > 0;
  options.hidden = !open;
  search.setAttribute("aria-expanded", String(open));
  search.setAttribute("aria-activedescendant", open && active >= 0 ? `number-option-${found[active]}` : "");
  if (typed && !found.length) document.getElementById("photo-filter-status").textContent = `No photos tagged #${typed} in this set yet.`;
}
function closeOptions() {
  options.hidden = true;
  search.setAttribute("aria-expanded", "false");
  search.removeAttribute("aria-activedescendant");
}
function choose(n) {
  applyFilter(n);
  closeOptions();
  search.blur(); // on phones: put the keyboard away, so the photos show
}
search.addEventListener("focus", showOptions);
search.addEventListener("blur", closeOptions);
search.addEventListener("input", () => {
  search.value = search.value.replace(/\D/g, "");
  // The grid follows as soon as the typed number is one in this set.
  if (!search.value) applyFilter("");
  else if (numbers.includes(search.value)) applyFilter(search.value);
  else document.getElementById("photo-filter-status").textContent = "";
  clearButton.hidden = !search.value;
  showOptions();
});
search.addEventListener("keydown", (event) => {
  const items = [...options.children];
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (options.hidden) return showOptions();
    if (!items.length) return;
    active = (active + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items.forEach((li, i) => li.setAttribute("aria-selected", String(i === active)));
    search.setAttribute("aria-activedescendant", items[active].id);
    items[active].scrollIntoView({ block: "nearest" });
  } else if (event.key === "Enter") {
    event.preventDefault();
    const pick = items[active]?.dataset.number || (numbers.includes(search.value) ? search.value : "");
    if (pick) choose(pick);
  } else if (event.key === "Escape" && !options.hidden) {
    event.preventDefault();
    closeOptions();
  }
});
clearButton.addEventListener("click", () => {
  applyFilter("");
  search.focus();
});
favoritesButton.addEventListener("click", () => applyFilter(filter === FAVORITES ? "" : FAVORITES));

const wanted = (new URLSearchParams(location.search).get("number") || "").replace(/\D/g, "");
if (numbers.includes(wanted)) applyFilter(wanted, { fade: false });
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
// A heart given gets a small pop; one taken back just settles. Not from the
// keyboard (Enter or Space: detail is 0), and not for reduced motion.
let pop;
function popHeart(on) {
  if (lessMotion.matches) return;
  pop?.cancel();
  pop = heartButton.querySelector("svg").animate(
    on ? [{ transform: "scale(1)" }, { transform: "scale(1.3)" }, { transform: "scale(0.94)" }, { transform: "scale(1)" }]
      : [{ transform: "scale(1)" }, { transform: "scale(0.85)" }, { transform: "scale(1)" }],
    { duration: on ? 380 : 200, easing: ease },
  );
}
heartButton.addEventListener("click", async (event) => {
  const photo = current;
  const on = !hearted.has(photo.id);
  setHeart(photo, on); // at once; put back if the server says no
  if (event.detail) popHeart(on);
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
