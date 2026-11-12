// Quick look (admin): click a photo on a set's admin page to see the whole
// picture, uncropped, with its size, shape, and how Instagram would show it.
// ← → (or the buttons) go through the set; Escape or × closes it.
// It rates and picks too (keys 1 to 5 rate, 0 clears, P picks), with the
// running count of Instagram picks in this photo's group (vertical or
// horizontal, two posts of 20 each) and a note as they fill up.
//
// The size is the one on the site: the version made at upload, at most
// 3000 px on its long edge (your original is resized to that).

import { groupCountText, groupLimitNote, groupOf } from "./picks-limit.js";

const $ = (id) => document.getElementById(id);
const dialog = $("quick-look");
const img = $("ql-img");
let photos = [];
let index = 0;
let opener = null; // what had focus before, to return to on close
// Saving lives in the page that opens the quick look (admin-set.js):
// rate(photo, 0-5) and pick(photo) save and return true or false; pickCounts()
// counts the Instagram picks in all sets, { vertical, horizontal }.
let controls = { rate: async () => false, pick: async () => false, pickCounts: () => ({ vertical: 0, horizontal: 0 }) };
export function configureQuickLook(options) { controls = { ...controls, ...options }; }

// Common shapes, so 3000 x 1999 still reads as "3:2".
const RATIOS = [[1, 1], [5, 4], [4, 5], [4, 3], [3, 4], [3, 2], [2, 3], [16, 10], [16, 9], [9, 16], [2, 1], [21, 9]];
function ratioText(w, h) {
  const r = w / h;
  const near = RATIOS.find(([a, b]) => Math.abs(a / b - r) / r < 0.01);
  return near ? `${near[0]}:${near[1]}` : `${r >= 1 ? r.toFixed(2) : (1 / r).toFixed(2)}:1${r < 1 ? " (tall)" : ""}`;
}

// Instagram posts take shapes from 4:5 (tall) to 1.91:1 (wide); anything
// beyond is cropped to the nearest one.
function instagramText(w, h) {
  const r = w / h;
  if (r > 1.91) return `Too wide for an Instagram post: it gets cropped to 1.91:1, losing about ${Math.round((1 - 1.91 / r) * 100)}% at the sides.`;
  if (r < 0.8) return `Too tall for an Instagram post: it gets cropped to 4:5, losing about ${Math.round((1 - r / 0.8) * 100)}% at the top and bottom.`;
  return "Fits an Instagram post without cropping.";
}

function row(label, value) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  return [dt, dd];
}

function show(newIndex) {
  index = (newIndex + photos.length) % photos.length;
  const p = photos[index];
  // The small version at once, then the full one when it arrives.
  img.src = `/img/${p.thumb_key}`;
  img.alt = p.alt_text || `Photo ${index + 1}`;
  img.style.setProperty("--ratio", p.width / p.height);
  const full = new Image();
  full.onload = () => { if (photos[index] === p) img.src = full.src; };
  full.src = `/img/${p.display_key || p.medium_key || p.thumb_key}`;

  $("ql-counter").textContent = `${index + 1} / ${photos.length}`;
  const w = p.width, h = p.height;
  const orientation = w === h ? "Square" : w > h ? "Landscape" : "Portrait";
  $("ql-details").replaceChildren(
    ...row("Size", `${w.toLocaleString()} × ${h.toLocaleString()} px`),
    ...row("Shape", `${ratioText(w, h)}, ${orientation.toLowerCase()}`),
    ...row("Megapixels", `${((w * h) / 1e6).toFixed(1)} MP`),
    ...row("Instagram", instagramText(w, h)),
    ...(p.original_name ? row("File", p.original_name) : []),
    ...(p.camera_info ? row("Camera", p.camera_info) : []),
  );
  paintControls();
  const single = photos.length < 2;
  $("ql-prev").hidden = single;
  $("ql-next").hidden = single;
}

// returnTo: where keyboard focus goes back to on close (a picture cannot hold
// focus, so a click on one passes its card's quick look button).
// ---------- Rating and Instagram pick ----------
const stars = [1, 2, 3, 4, 5].map((value) => {
  const star = document.createElement("button");
  star.type = "button";
  star.className = "rating-star";
  star.setAttribute("aria-label", `${value} ${value === 1 ? "star" : "stars"}`);
  star.addEventListener("click", () => rate(photos[index].rating === value ? 0 : value));
  return star;
});
$("ql-rating").append(...stars);

function paintControls() {
  const p = photos[index];
  stars.forEach((star, i) => {
    star.textContent = i < p.rating ? "★" : "☆";
    star.classList.toggle("is-on", i < p.rating);
    star.setAttribute("aria-pressed", String(i + 1 === p.rating));
  });
  $("ql-pick").setAttribute("aria-pressed", String(Boolean(p.instagram)));
  $("ql-pick").textContent = p.instagram ? "Picked for Instagram" : "Pick for Instagram";
  // The count for this photo's own group: it goes in the vertical posts or the horizontal ones.
  const group = groupOf(p);
  const count = controls.pickCounts()[group];
  $("ql-picks").textContent = groupCountText(group, count);
  const note = groupLimitNote(group, count);
  $("ql-picks-note").hidden = !note;
  $("ql-picks-note").textContent = note?.text || "";
  $("ql-picks-note").dataset.level = note?.level || "";
}

async function rate(value) {
  const p = photos[index];
  const before = p.rating;
  p.rating = value; // show it at once; put it back if saving fails
  paintControls();
  if (!(await controls.rate(p, value))) {
    p.rating = before;
    if (photos[index] === p) paintControls();
    $("ql-picks").textContent = "Rating not saved. Try again.";
  }
}

async function pick() {
  const p = photos[index];
  const button = $("ql-pick");
  button.disabled = true;
  const saved = await controls.pick(p);
  button.disabled = false;
  if (photos[index] === p) paintControls();
  if (!saved) $("ql-picks").textContent = "Pick not saved. Try again.";
}
$("ql-pick").addEventListener("click", pick);

export function openQuickLook(list, start, returnTo = document.activeElement) {
  photos = list;
  opener = returnTo;
  show(start);
  dialog.showModal();
  $("ql-close").focus();
}

$("ql-prev").addEventListener("click", () => show(index - 1));
$("ql-next").addEventListener("click", () => show(index + 1));
$("ql-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (/^[0-5]$/.test(event.key)) { event.preventDefault(); rate(Number(event.key)); return; }
  if (event.key === "p" || event.key === "P") { event.preventDefault(); if (!$("ql-pick").disabled) pick(); return; }
  if (photos.length < 2) return;
  if (event.key === "ArrowLeft") { event.preventDefault(); show(index - 1); }
  if (event.key === "ArrowRight") { event.preventDefault(); show(index + 1); }
});
// A click on the dark space around the photo closes it.
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener("close", () => { img.removeAttribute("src"); opener?.focus?.(); });
