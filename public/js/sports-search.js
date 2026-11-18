// The Sports page (/?category=sports): find a jersey number in every sports
// set at once. Picking #12 swaps the set cards for #12's photos, grouped by
// set; each photo opens in its set's viewer with only #12's photos
// (/sets/x?number=12&photo=3). ?number=12 in the address opens the page
// already searched, so the link can be shared.
// The tagged photos come with the page (functions/index.js, #sports-data).

import { numberSearch } from "./number-search.js";
import { sortTags, tagList } from "./tags.js";
import { t } from "./text.js";

const data = document.getElementById("sports-data");
const sets = data ? JSON.parse(data.textContent) : [];
const all = sets.flatMap((set) => set.photos.map((photo) => ({ set, photo, tags: tagList(photo.tags) })));
const numbers = sortTags([...new Set(all.flatMap((p) => p.tags))]);
const countOf = (n) => all.filter((p) => p.tags.includes(n)).length;

const box = document.getElementById("sports-search");
const search = document.getElementById("number-search");
const clearButton = document.getElementById("number-clear");
const status = document.getElementById("photo-filter-status");
const results = document.getElementById("number-results");
const grid = document.getElementById("set-grid");

function show(n) {
  search.value = n;
  clearButton.hidden = !n;
  grid.hidden = Boolean(n);
  results.hidden = !n;
  const found = all.filter((p) => p.tags.includes(n));
  status.textContent = n ? t("find.result", { n: found.length, number: n }) : "";
  results.replaceChildren(...(n ? sets : []).map((set) => group(set, found.filter((p) => p.set === set), n)).filter(Boolean));
  const url = new URL(location.href);
  if (n) url.searchParams.set("number", n);
  else url.searchParams.delete("number");
  history.replaceState(history.state, "", url.pathname + url.search);
  if (n) document.documentElement.dataset.shareUrl = url.href;
  else delete document.documentElement.dataset.shareUrl;
}

// One set's photos of #n: its name (opens the set filtered to #n) and the photos.
function group(set, found, n) {
  if (!found.length) return null;
  const setUrl = `/sets/${encodeURIComponent(set.slug)}?number=${n}`;
  const section = document.createElement("section");
  section.className = "number-group";
  const heading = document.createElement("h2");
  heading.className = "number-group-title";
  const link = document.createElement("a");
  link.href = setUrl;
  link.textContent = set.title;
  const count = document.createElement("span");
  count.className = "number-group-count";
  count.textContent = t("photos", { n: found.length });
  heading.append(link, count);
  const list = document.createElement("ul");
  list.className = "number-photos";
  for (const { photo } of found) {
    const item = document.createElement("li");
    const open = document.createElement("a");
    open.href = `${setUrl}&photo=${photo.n}`;
    const img = document.createElement("img");
    img.src = `/img/${photo.image}`;
    img.alt = photo.alt || "";
    img.width = photo.width;
    img.height = photo.height;
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    open.append(img);
    item.append(open);
    list.append(item);
  }
  section.append(heading, list);
  return section;
}

if (box && numbers.length) {
  box.hidden = false;
  numberSearch({
    numbers,
    countOf,
    onPick: show,
    say: (text) => (status.textContent = text),
    none: "find.noneAll",
  });
  const wanted = (new URLSearchParams(location.search).get("number") || "").replace(/\D/g, "");
  if (numbers.includes(wanted)) show(wanted);
}
