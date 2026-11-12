// Admin page for one set: edit its details, upload photos, and manage the
// photos already in it (order, cover, captions, delete).
//
// The journey of each photo:
//   waiting -> processing (in a Web Worker) -> ready (preview shown)
//           -> uploading -> done
// Two photos are processed at a time. More would not be faster (your computer
// has a limited number of cores) but would use a lot more memory. If a photo
// fails (usually because the browser ran out of image memory, which happens in
// Safari), it is retried once automatically, and from then on photos are
// processed one at a time.
// Uploads go one at a time, so the photos keep the order you chose them in:
// the server adds each photo after the last one it received.

import { configureQuickLook, openQuickLook } from "./quick-look.js";
import { GROUPS, groupCounts, groupLimitNote, groupShortText } from "./picks-limit.js";
import { postRecordList } from "./instagram-posts.js";
import { readCaptureKey } from "./exif.js";
import { makePlaceholder } from "./placeholder.js";
import { currentIds, makeSortable, moveItem } from "./sortable.js";

let parallel = 2;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const setId = Number(new URLSearchParams(location.search).get("id"));

const $ = (id) => document.getElementById(id);
const baseTitle = document.title; // "Set · Admin | winstonlens"
const wmOn = $("wm-on");
const keepClean = $("keep-clean");
const wmText = $("wm-text");
const wmStyleInputs = [...document.querySelectorAll('input[name="wm-style"]')];

let set = null;
let items = [];          // every photo in the list, with its status
let processing = 0;      // how many are in a worker right now
let uploading = 0;       // how many are being sent right now
let uploadStarted = false;
const idleWorkers = [];  // workers are reused, since starting one takes time
let nextId = 1;

// ---------- Load the set ----------

async function loadSet() {
  const response = await fetch(`/api/admin/sets/${setId}`);
  if (response.status === 401) return (location.href = "/admin/login");
  if (!response.ok) {
    $("set-title").textContent = "Set not found";
    return;
  }
  set = await response.json();
  showDetails();
  renderExisting();
  loadCategories();
  showHeroChoices();
}

// ---------- Categories ----------

async function loadCategories() {
  const response = await fetch("/api/admin/categories");
  if (!response.ok) return;
  const categories = await response.json();
  $("category-empty").hidden = categories.length > 0;
  $("category-boxes").replaceChildren(...categories.map((category) => {
    const label = document.createElement("label");
    label.className = "checkbox";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = category.id;
    box.checked = set.category_ids.includes(category.id);
    // Saves straight away, like the other details.
    box.addEventListener("change", saveCategories);
    label.append(box, ` ${category.name}`);
    return label;
  }));
}

// ---------- Hero: featured, and seasonal months ----------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function showHeroChoices() {
  $("hero-featured").checked = Boolean(set.featured);
  const chosen = String(set.feature_months || "").split(",").filter(Boolean).map(Number);
  $("month-boxes").replaceChildren(...MONTHS.map((name, i) => {
    const label = document.createElement("label");
    label.className = "checkbox";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = i + 1;
    box.checked = chosen.includes(i + 1);
    box.addEventListener("change", saveHeroChoices);
    label.append(box, ` ${name}`);
    return label;
  }));
}

async function saveHeroChoices() {
  const months = [...$("month-boxes").querySelectorAll("input:checked")].map((box) => Number(box.value));
  const response = await fetch(`/api/admin/sets/${setId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ featured: $("hero-featured").checked, feature_months: months }),
  });
  if (!response.ok) return alert("Could not save the hero choice. Please try again.");
  Object.assign(set, await response.json());
  flash($("details-status"), "Saved");
}
$("hero-featured").addEventListener("change", saveHeroChoices);

async function saveCategories() {
  const ids = [...$("category-boxes").querySelectorAll("input:checked")].map((box) => Number(box.value));
  const response = await fetch(`/api/admin/sets/${setId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_ids: ids }),
  });
  if (!response.ok) return alert("Could not save the categories. Please try again.");
  set.category_ids = ids;
  flash($("details-status"), "Saved");
}

// ---------- Set details ----------

// sent: what a save just sent. Boxes you typed in since then are left alone,
// so nothing you type is lost when a save finishes.
function showDetails(sent = null) {
  $("set-title").textContent = set.title;
  document.title = baseTitle.replace(/^Set/, set.title);
  $("view-link").href = $("preview-link").href = `/sets/${encodeURIComponent(set.slug)}`;
  showVisibility();
  for (const [id, field] of [["details-title", "title"], ["details-slug", "slug"], ["details-description", "description"], ["details-date", "shot_date"], ["details-location", "location"]]) {
    if (!sent || $(id).value === sent[field]) $(id).value = set[field];
  }
}

$("details-form").addEventListener("submit", (event) => {
  event.preventDefault();
  saveDetails();
});

// Like captions, the details also save by themselves when you leave a box
// after changing it, so nothing typed gets lost if you forget the button.
for (const id of ["details-title", "details-slug", "details-description", "details-date", "details-location"]) {
  $(id).addEventListener("change", () => {
    if ($(id).checkValidity()) saveDetails(); // skip an empty title or address
  });
}

// Saves run one after another, never at the same time. Otherwise, when you move
// quickly between boxes, an older save could finish last and undo a newer one.
let saving = Promise.resolve();
function saveDetails() {
  saving = saving.then(saveDetailsNow, saveDetailsNow);
  return saving;
}

async function saveDetailsNow() {
  const status = $("details-status");
  const sent = {
    title: $("details-title").value,
    slug: $("details-slug").value,
    description: $("details-description").value,
    shot_date: $("details-date").value,
    location: $("details-location").value,
  };
  const response = await fetch(`/api/admin/sets/${setId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sent),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    status.textContent = data.error || "Could not save.";
    status.dataset.state = "error";
    return;
  }
  Object.assign(set, data);
  showDetails(sent); // shows the cleaned-up web address, e.g. "My Trip!" -> "my-trip"
  flash(status, "Saved");
}

// ---------- Draft / published ----------

function showVisibility() {
  const published = Boolean(set.published);
  const scheduled = !published && set.publish_at ? new Date(set.publish_at) : null;
  $("publish-text").textContent = published
    ? "Published: everyone can see this set."
    : scheduled
      ? `Scheduled: this set becomes public on ${formatWhen(scheduled)} (your time). Until then only you can see it.`
      : "Draft: only you can see this set (use Preview while logged in). Visitors and search engines cannot.";
  $("publish-button").textContent = published ? "Unpublish (back to draft)" : "Publish now";
  $("publish-button").className = published ? "button-secondary" : "";
  $("set-title").dataset.state = published ? "published" : scheduled ? "scheduled" : "draft";

  $("schedule-form").hidden = published;
  $("unschedule-button").hidden = !scheduled;
  $("schedule-button").textContent = scheduled ? "Change time" : "Schedule";
  $("publish-at").min = toLocalInput(new Date(Date.now() + 60_000));
  if (scheduled && document.activeElement !== $("publish-at")) $("publish-at").value = toLocalInput(scheduled);
}

// "Sat, 25 Oct 2026, 09:00" in the computer's own language and time zone.
function formatWhen(date) {
  return date.toLocaleString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// A date as the "2026-10-25T09:00" text that <input type="datetime-local"> uses (local time).
function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function saveSchedule(value) {
  $("schedule-error").textContent = "";
  const response = await fetch(`/api/admin/sets/${setId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publish_at: value }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    $("schedule-error").textContent = data.error || "Could not save the schedule.";
    return;
  }
  Object.assign(set, data);
  showVisibility();
}

$("schedule-form").addEventListener("submit", (event) => {
  event.preventDefault();
  // The box holds local time; new Date() reads it as local, toISOString() turns it into UTC.
  const when = new Date($("publish-at").value);
  if (Number.isNaN(when.getTime())) return;
  if (set.photos.length === 0 && !confirm("This set has no photos yet. Schedule it anyway?")) return;
  saveSchedule(when.toISOString());
});
$("unschedule-button").addEventListener("click", () => saveSchedule(""));

$("publish-button").addEventListener("click", async () => {
  const publish = !set.published;
  if (publish && set.photos.length === 0 &&
      !confirm("This set has no photos yet. Publish it anyway?")) return;

  const response = await fetch(`/api/admin/sets/${setId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ published: publish }),
  });
  if (!response.ok) return alert("Could not change the visibility. Please try again.");
  Object.assign(set, await response.json());
  showVisibility();
});

// Shows a short message like "Saved" next to a field, then fades it.
function flash(element, text) {
  element.textContent = text;
  element.dataset.state = "ok";
  clearTimeout(element.timer);
  element.timer = setTimeout(() => (element.textContent = ""), 2000);
}

// ---------- Photos already in the set ----------

const existing = $("existing");
makeSortable(existing, { onChange: savePhotoOrder });

function renderExisting() {
  existing.replaceChildren(...set.photos.map(createPhotoCard));
  $("existing-empty").hidden = set.photos.length > 0;
  $("existing-help").hidden = set.photos.length === 0;
  $("order-tools").hidden = set.photos.length < 2;
  addMissingPlaceholders();
  updateAltReminder();
  updatePicksCount();
  renderInstagramPosts();
}

// "12 of 58 photos have no description yet": screen readers say nothing
// useful about a photo without one, and Google cannot tell what it shows.
function updateAltReminder() {
  const missing = set.photos.filter((p) => !(p.alt_text || "").trim()).length;
  const reminder = $("alt-reminder");
  reminder.hidden = missing === 0;
  reminder.textContent = missing === set.photos.length
    ? `None of these ${missing} photos has a description for blind visitors yet. Add one in each photo's "Description" box.`
    : `${missing} of ${set.photos.length} photos have no description for blind visitors yet.`;
}

// ---------- Shuffle ----------
// A random new order, saved at once. "Undo shuffle" puts back the order from
// before the first shuffle, until you move a photo by hand.
let orderBeforeShuffle = null;

$("shuffle-photos").addEventListener("click", async () => {
  if (set.photos.length < 2) return;
  const before = set.photos.map((p) => p.id);
  orderBeforeShuffle ??= before;
  // The home page shows the first photo as the cover unless you picked one
  // with ★. Keep today's cover, so shuffling does not change the home page.
  if (!set.cover_photo_id) await setCover(set.photos[0]);
  let shuffled;
  do shuffled = shuffle([...set.photos]);
  while (set.photos.length > 2 && shuffled.every((p, i) => p.id === before[i])); // always a new order
  set.photos = shuffled;
  await saveOrder("Shuffled and saved.");
  $("undo-order").hidden = false;
});

$("undo-order").addEventListener("click", async () => {
  if (!orderBeforeShuffle) return;
  const ids = orderBeforeShuffle;
  set.photos.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  orderBeforeShuffle = null;
  $("undo-order").hidden = true;
  await saveOrder("Back to the order before shuffling.");
});

async function saveOrder(message) {
  renderExisting(); // the cards in the new order; savePhotoOrder reads them
  if (await savePhotoOrder({ keepUndo: true })) flash($("order-status"), message);
}

// Fisher-Yates with the browser's real random numbers: every order equally likely.
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Photos uploaded before blurry previews existed (migrations/0010) get one now,
// made from their small grid picture, one at a time in the background.
let fillingPlaceholders = false;
async function addMissingPlaceholders() {
  if (fillingPlaceholders || typeof OffscreenCanvas === "undefined") return;
  fillingPlaceholders = true;
  try {
    for (const photo of set.photos.filter((p) => !p.placeholder)) {
      const picture = new Image();
      picture.src = `/img/${photo.thumb_key}`;
      try {
        await picture.decode();
        const placeholder = await makePlaceholder(picture, picture.naturalWidth, picture.naturalHeight);
        if (!placeholder) continue;
        const response = await fetch(`/api/admin/photos/${photo.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placeholder }),
        });
        if (response.ok) photo.placeholder = placeholder;
      } catch (err) {
        console.warn(`No blurry preview for photo ${photo.id}:`, err);
      }
    }
  } finally {
    fillingPlaceholders = false;
  }
}

function createPhotoCard(photo, index) {
  const item = document.createElement("li");
  item.className = "photo-card";
  item.dataset.id = photo.id;
  const isCover = coverId() === photo.id;
  if (isCover) item.classList.add("is-cover");

  // With a mouse, drag the picture itself. With a finger, drag the ⠿ grip, so
  // touching a picture can still scroll the page (see sortable.js).
  const figure = document.createElement("div");
  figure.className = "photo-card-image";
  const img = document.createElement("img");
  img.src = `/img/${photo.thumb_key}`;
  img.alt = "";
  img.loading = "lazy";
  img.draggable = false; // turn off the browser's own image dragging
  img.className = "drag-surface";
  img.title = "Click for a quick look, drag to reorder";
  // A plain click (not a drag: sortable.js stops those) opens the quick look.
  img.addEventListener("click", () =>
    openQuickLook(set.photos, set.photos.indexOf(photo), item.querySelector(".photo-card-tools button")));
  const grip = document.createElement("span");
  grip.className = "drag-handle photo-grip";
  grip.textContent = "⠿";
  grip.title = "Drag to reorder";
  grip.setAttribute("aria-hidden", "true");
  figure.append(img, grip);
  if (isCover) {
    const badge = document.createElement("span");
    badge.className = "cover-badge";
    badge.textContent = "Cover";
    figure.append(badge);
  }
  if (photo.downloadable) {
    const badge = document.createElement("span");
    badge.className = "download-badge";
    badge.textContent = "Downloadable";
    badge.title = "A clean copy is stored for visitors with a license code";
    figure.append(badge);
  }

  const caption = textField(photo, "caption", "Caption (shown in the viewer)");
  const camera = textField(photo, "camera_info", "Camera details (shown in the viewer; clear to hide)");
  const alt = textField(photo, "alt_text", "Description for blind visitors (alt text)",
    "Not written yet: say what is in the photo");

  const tools = document.createElement("div");
  tools.className = "photo-card-tools";
  const number = index + 1;
  tools.append(
    toolButton("⤢", `Quick look at photo ${number}: whole picture and size`, () => openQuickLook(set.photos, set.photos.indexOf(photo))),
    toolButton("←", `Move photo ${number} earlier`, () => movePhoto(item, -1, "←")),
    toolButton("→", `Move photo ${number} later`, () => movePhoto(item, 1, "→")),
    toolButton(isCover ? "★" : "☆", isCover ? `Photo ${number} is the cover` : `Make photo ${number} the cover`,
      () => setCover(photo), isCover ? "active" : ""),
    ...(photo.downloadable
      ? [toolButton("⤓", `Stop photo ${number} being downloadable (deletes its clean copy)`, () => removeDownload(photo))]
      : []),
    toolButton("×", `Delete photo ${number}`, () => deletePhoto(photo), "danger"),
  );

  item.append(figure, ratingField(photo, number), caption, camera, alt, instagramToggle(photo, number, figure), tools);
  return item;
}

// ---------- Rating and Instagram picks (only for you, never shown publicly) ----------

// Saves one or more of a photo's fields; returns the saved photo, or null.
async function savePhoto(photo, changes) {
  const response = await fetch(`/api/admin/photos/${photo.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (!response.ok) return null;
  const saved = await response.json();
  Object.assign(photo, changes, saved);
  return saved;
}

// The quick look rates and picks too; afterwards the photo's card is redrawn
// so both always show the same.
function redrawCard(photo) {
  const old = existing.querySelector(`.photo-card[data-id="${photo.id}"]`);
  if (old) old.replaceWith(createPhotoCard(photo, set.photos.indexOf(photo)));
}
configureQuickLook({
  rate: async (photo, rating) => {
    if (!(await savePhoto(photo, { rating }))) return false;
    redrawCard(photo);
    return true;
  },
  pick: async (photo) => {
    if (!(await savePhoto(photo, { instagram: photo.instagram ? 0 : 1 }))) return false;
    redrawCard(photo);
    updatePicksCount();
    return true;
  },
  pickCounts: () => pickCounts(), // looked up when needed: it is defined further down
});

// Five stars: click one to rate, click the same one again to clear.
function ratingField(photo, number) {
  const field = document.createElement("div");
  field.className = "photo-rating";
  field.setAttribute("role", "group");
  field.setAttribute("aria-label", `Your rating for photo ${number}`);
  const status = document.createElement("span");
  status.className = "save-status";
  status.setAttribute("role", "status");

  const stars = [1, 2, 3, 4, 5].map((value) => {
    const star = document.createElement("button");
    star.type = "button";
    star.className = "rating-star";
    star.textContent = "★";
    star.setAttribute("aria-label", `${value} ${value === 1 ? "star" : "stars"}`);
    star.addEventListener("click", async () => {
      const rating = photo.rating === value ? 0 : value;
      if (!(await savePhoto(photo, { rating }))) {
        status.textContent = "Not saved, try again";
        status.dataset.state = "error";
        return;
      }
      paint();
      flash(status, rating ? "Saved" : "Cleared");
    });
    return star;
  });
  function paint() {
    stars.forEach((star, i) => {
      star.classList.toggle("is-on", i < photo.rating);
      star.textContent = i < photo.rating ? "★" : "☆"; // filled or outlined: not by colour alone
      star.setAttribute("aria-pressed", String(i + 1 === photo.rating));
    });
    field.title = photo.rating ? `Rated ${photo.rating} of 5` : "Not rated yet";
  }
  paint();
  const label = document.createElement("span");
  label.className = "rating-label";
  label.textContent = "Rating";
  label.setAttribute("aria-hidden", "true"); // the group already says "Your rating for photo 3"
  field.append(label, ...stars, status);
  return field;
}

// "Pick for Instagram": adds the photo to the Instagram picks page.
function instagramToggle(photo, number, figure) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button-secondary instagram-toggle";
  const paint = () => {
    button.setAttribute("aria-pressed", String(Boolean(photo.instagram)));
    button.textContent = photo.instagram ? "Picked for Instagram" : "Pick for Instagram";
    button.setAttribute("aria-label", `${photo.instagram ? "Picked" : "Pick"} photo ${number} for Instagram`);
    figure.querySelector(".instagram-badge")?.remove();
    if (photo.instagram) {
      const badge = document.createElement("span");
      badge.className = "instagram-badge";
      badge.textContent = "Instagram";
      badge.title = "Picked to post on Instagram";
      figure.append(badge);
    }
  };
  button.addEventListener("click", async () => {
    button.disabled = true;
    const saved = await savePhoto(photo, { instagram: photo.instagram ? 0 : 1 });
    button.disabled = false;
    if (!saved) return alert("Could not save. Please try again.");
    paint();
    updatePicksCount();
  });
  paint();
  return button;
}

// Each set is posted on its own, so counts are for this set only.
const pickCounts = () => groupCounts(set.photos.filter((p) => p.instagram));

// "Instagram picks in this set: 14 vertical (one post, 14 of 20), 18
// horizontal (one post, 18 of 20).", plus a note when a group nears two posts.
function updatePicksCount() {
  const counts = pickCounts();
  $("picks-line").hidden = counts.vertical + counts.horizontal === 0;
  $("picks-count").textContent = "Instagram picks in this set: " +
    GROUPS.filter((g) => counts[g]).map((g) => groupShortText(g, counts[g])).join(", ") + ".";
  const notes = GROUPS.map((g) => groupLimitNote(g, counts[g])).filter(Boolean);
  const note = $("picks-note");
  note.hidden = notes.length === 0;
  note.textContent = notes.map((n) => n.text).join(" ");
  note.dataset.level = notes.some((n) => n.level !== "near") ? "full" : notes.length ? "near" : "";
}

// The posts already made from this set, with their links (instagram-posts.js).
function renderInstagramPosts() {
  const own = set.instagram_posts || [];
  $("ig-posts-panel").hidden = own.length === 0;
  $("ig-posts").replaceChildren(postRecordList(own, { onChange: reloadInstagramPosts }));
}
async function reloadInstagramPosts() {
  const response = await fetch(`/api/admin/sets/${setId}`);
  if (!response.ok) return;
  const fresh = await response.json();
  set.instagram_posts = fresh.instagram_posts;
  // Undo puts photos back in the picks: take their pick state from the server.
  for (const photo of set.photos) {
    const now = fresh.photos.find((p) => p.id === photo.id);
    if (now && now.instagram !== photo.instagram) { photo.instagram = now.instagram; redrawCard(photo); }
  }
  updatePicksCount();
  renderInstagramPosts();
}

// The cover is the chosen photo, or the first photo when none was chosen.
function coverId() {
  return set.cover_photo_id ?? set.photos[0]?.id;
}

function textField(photo, field, labelText, placeholder = "") {
  const label = document.createElement("label");
  label.className = "photo-card-field";
  const span = document.createElement("span");
  span.textContent = labelText;
  const input = document.createElement("input");
  input.type = "text";
  input.value = photo[field];
  input.maxLength = { caption: 1000, alt_text: 500, camera_info: 200 }[field];
  input.placeholder = placeholder;
  const status = document.createElement("span");
  status.className = "save-status";
  status.setAttribute("role", "status");

  // "change" fires when you leave the box after typing, not on every key.
  input.addEventListener("change", async () => {
    const response = await fetch(`/api/admin/photos/${photo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: input.value }),
    });
    if (!response.ok) {
      status.textContent = "Not saved, try again";
      status.dataset.state = "error";
      return;
    }
    photo[field] = (await response.json())[field];
    if (field === "alt_text") updateAltReminder();
    flash(status, "Saved");
  });

  label.append(span, input, status);
  return label;
}

function toolButton(text, label, onClick, variant = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `icon-button ${variant}`;
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.addEventListener("click", onClick);
  return button;
}

async function movePhoto(item, direction, arrow) {
  if (!moveItem(item, direction)) return;
  await savePhotoOrder();
  // Redrawing replaced the buttons. Put focus back on the same arrow of the same
  // photo, so a keyboard user can press Enter again to keep moving it.
  const card = existing.querySelector(`[data-id="${item.dataset.id}"]`);
  [...(card?.querySelectorAll(".icon-button") ?? [])].find((b) => b.textContent === arrow)?.focus();
}

async function savePhotoOrder({ keepUndo = false } = {}) {
  if (!keepUndo) {
    // Moved by hand: the shuffle can no longer be undone.
    orderBeforeShuffle = null;
    $("undo-order").hidden = true;
  }
  const ids = currentIds(existing);
  const response = await fetch(`/api/admin/sets/${setId}/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photo_ids: ids }),
  });
  if (!response.ok) {
    alert("Could not save the new order. The page will reload the photos.");
    loadSet();
    return false;
  }
  set.photos.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  // Redraw so the photo numbers in the labels and the default cover stay right.
  renderExisting();
  return true;
}

async function setCover(photo) {
  const response = await fetch(`/api/admin/sets/${setId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cover_photo_id: photo.id }),
  });
  if (!response.ok) return alert("Could not change the cover. Please try again.");
  set.cover_photo_id = photo.id;
  renderExisting();
}

// ---------- Deleting ----------

async function removeDownload(photo) {
  if (!confirm("Delete this photo's clean copy? It will no longer be downloadable with a license code.\n\nThe photo itself stays.")) return;
  const response = await fetch(`/api/admin/photos/${photo.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remove_download: true }),
  });
  if (!response.ok) return alert("Could not remove the clean copy. Please try again.");
  photo.downloadable = 0;
  renderExisting();
}

async function deletePhoto(photo) {
  if (!confirm("Delete this photo?\n\nThis cannot be undone.")) return;
  const response = await fetch(`/api/admin/photos/${photo.id}`, { method: "DELETE" });
  if (!response.ok) {
    alert("Could not delete the photo. Please try again.");
    return;
  }
  set.photos = set.photos.filter((p) => p.id !== photo.id);
  if (set.cover_photo_id === photo.id) set.cover_photo_id = null; // the server did the same
  renderExisting();
}

$("delete-set").addEventListener("click", async () => {
  if (!set) return;
  const count = set.photos.length;
  const photos = `${count} ${count === 1 ? "photo" : "photos"}`;
  if (!confirm(`Delete the set "${set.title}" and its ${photos}?\n\nThis cannot be undone.`)) return;

  const response = await fetch(`/api/admin/sets/${set.id}`, { method: "DELETE" });
  if (!response.ok) {
    alert("Could not delete the set. Please try again.");
    return;
  }
  location.href = "/admin/";
});

// ---------- Watermark settings (remembered in this browser) ----------

try {
  wmText.value = localStorage.getItem("watermark-text") ?? "";
  wmOn.checked = localStorage.getItem("watermark-on") !== "false";
  const style = localStorage.getItem("watermark-style") || "full";
  for (const input of wmStyleInputs) input.checked = input.value === style;
} catch {
  // Private browsing can block storage. The page still works without it.
}
for (const input of [wmText, wmOn, ...wmStyleInputs]) {
  input.addEventListener("change", () => {
    try {
      localStorage.setItem("watermark-text", wmText.value);
      localStorage.setItem("watermark-on", String(wmOn.checked));
      localStorage.setItem("watermark-style", watermarkStyle());
    } catch {}
  });
}

// "full" (tiled across the photo) or "small" (one line in the corner).
function watermarkStyle() {
  return wmStyleInputs.find((input) => input.checked)?.value || "full";
}

function currentWatermark() {
  return wmOn.checked && wmText.value.trim() ? wmText.value.trim() : "";
}

// ---------- Adding files ----------

$("file-input").addEventListener("change", (event) => {
  addFiles(event.target.files);
  event.target.value = ""; // so choosing the same file again still triggers "change"
});

const dropZone = $("drop-zone");
dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  addFiles(event.dataTransfer.files);
});
// A file dropped anywhere else would make the browser open it and leave this page.
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => event.preventDefault());

function addFiles(fileList) {
  if (!set) return;
  if (uploadStarted && !isBusy()) clearList(); // a finished batch: start fresh

  const added = [];
  for (const file of fileList) {
    const item = { id: nextId++, file, status: "waiting", el: createCard(file) };
    if (!ALLOWED_TYPES.includes(file.type)) {
      item.status = "error";
      item.error = "Not a JPEG, PNG, or WebP file.";
    } else {
      added.push(item);
    }
    items.push(item);
    $("queue").append(item.el.root);
    renderItem(item);
  }
  $("queue-panel").hidden = items.length === 0;
  checkDuplicates(added);
  pumpProcessing();
  renderSummary();
}

// ---------- Processing in workers ----------

function pumpProcessing() {
  let item;
  while (processing < parallel && (item = items.find((i) => i.status === "waiting"))) {
    processing++;
    item.status = "processing";
    renderItem(item);
    processItem(item).finally(() => {
      processing--;
      pumpProcessing();
      renderSummary();
    });
  }
  renderSummary();
}

async function processItem(item) {
  const worker = idleWorkers.pop() || new Worker(new URL("./image-worker.js", import.meta.url), { type: "module" });
  const result = await new Promise((resolve) => {
    worker.onmessage = (event) => resolve(event.data);
    worker.onerror = () => resolve({ error: "Processing failed." });
    worker.postMessage({ id: item.id, file: item.file, watermark: currentWatermark(), watermarkStyle: watermarkStyle(), keepClean: keepClean.checked });
  });

  if (result.error) {
    // Throw away this worker: a fresh one starts with all of its memory free.
    worker.terminate();
  } else {
    idleWorkers.push(worker);
  }

  if (item.status === "removed") return; // the list was cleared meanwhile
  if (result.error && !item.retried) {
    // First failure: slow down to one photo at a time and try this one again.
    item.retried = true;
    parallel = 1;
    item.status = "waiting";
  } else if (result.error) {
    item.status = "error";
    item.error = result.error;
  } else {
    item.status = "ready";
    item.result = result;
    item.thumbUrl = URL.createObjectURL(result.thumb);
    showPreview();
  }
  renderItem(item);
}

// The first finished photo becomes the big watermark preview.
function showPreview() {
  const preview = $("wm-preview");
  if (!preview.hidden) return;
  const first = items.find((i) => i.result);
  if (!first) return;
  first.displayUrl = URL.createObjectURL(first.result.display);
  $("wm-preview-img").src = first.displayUrl;
  preview.hidden = false;
}

// ---------- Uploading ----------

$("upload-button").addEventListener("click", () => {
  uploadStarted = true;
  pumpUploads();
});

function pumpUploads() {
  let item;
  while (uploading < 1 && (item = items.find((i) => i.status === "ready"))) {
    uploading++;
    item.status = "uploading";
    renderItem(item);
    uploadItem(item).finally(() => {
      uploading--;
      pumpUploads();
      if (!isBusy()) loadSet(); // all done: refresh "Photos in this set"
    });
  }
  renderSummary();
}

async function uploadItem(item) {
  const { width, height, cameraInfo, placeholder } = item.result;
  const form = new FormData();
  form.append("set_id", setId);
  form.append("width", width);
  form.append("height", height);
  // Empty until you write one on this page: an automatic "Photo from <set>"
  // tells a blind visitor nothing, and goes stale when the set is renamed.
  form.append("alt_text", "");
  form.append("camera_info", cameraInfo || "");
  form.append("placeholder", placeholder || "");
  const facts = await item.factsReady; // name, fingerprint, capture time (for duplicate warnings later)
  form.append("original_name", item.file.name);
  form.append("original_hash", facts?.hash || "");
  form.append("taken_at", facts?.takenAt || "");
  for (const size of ["small", "thumb", "display", "download"]) {
    const blob = item.result[size];
    if (blob) form.append(size, blob, `${size}.${extension(blob)}`);
  }

  try {
    const response = await fetch("/api/admin/photos", { method: "POST", body: form });
    if (response.status === 401) return (location.href = "/admin/login");
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Server said ${response.status}`);
    }
    item.status = "done";
  } catch (err) {
    if (!item.uploadRetried) {
      // Networks hiccup. Try once more before calling it a failure.
      item.uploadRetried = true;
      item.status = "ready";
    } else {
      item.status = "error";
      item.error = `Upload failed: ${err.message}`;
    }
  }
  renderItem(item);
}

// ---------- Retrying ----------

// A photo can be tried again if it is a supported type: either its shrinking
// failed (start over), or its upload failed (send the finished files again).
function canRetry(item) {
  return item.status === "error" && ALLOWED_TYPES.includes(item.file.type);
}

$("retry-button").addEventListener("click", () => {
  for (const item of items.filter(canRetry)) {
    item.status = item.result ? "ready" : "waiting";
    item.retried = item.uploadRetried = false;
    item.error = "";
    renderItem(item);
  }
  pumpProcessing();
  if (uploadStarted) pumpUploads();
});

function extension(blob) {
  return blob.type === "image/webp" ? "webp" : "jpg";
}

// ---------- Clearing ----------

$("clear-button").addEventListener("click", clearList);

function clearList() {
  for (const item of items) {
    if (item.status === "processing") item.status = "removed";
    URL.revokeObjectURL(item.thumbUrl);  // free the memory the previews used
    URL.revokeObjectURL(item.displayUrl);
  }
  items = items.filter((i) => i.status === "uploading"); // let in-flight uploads finish
  $("queue").replaceChildren(...items.map((i) => i.el.root));
  $("wm-preview").hidden = true;
  uploadStarted = items.length > 0;
  $("queue-panel").hidden = items.length === 0;
  renderSummary();
}

// ---------- Duplicate warnings ----------
// Before uploading, each new file is compared with every photo already on the
// site, by three facts (see functions/api/admin/photos/duplicates.js):
//   the exact same file     its fingerprint (SHA-256 hash of every byte) matches
//   the same moment         same capture time and camera, from EXIF (for example,
//                           the same shot exported twice, or edited)
//   the same file name      weakest: cameras reuse names after 9999 shots
// Matches are only warnings: you can skip the photo, or upload it anyway.

const REASON_TEXT = {
  hash: "The exact same file is already in",
  moment: "Taken at the same moment, with the same camera, as a photo in",
  name: "Same file name as a photo in",
};

async function fileFacts(file) {
  // crypto.subtle is built into the browser: the file never leaves your computer.
  const [digest, takenAt] = await Promise.all([
    crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    readCaptureKey(file),
  ]);
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { hash, takenAt };
}

async function checkDuplicates(newItems) {
  if (!newItems.length) return;
  // One file at a time: reading many 25 MB files at once would use a lot of memory.
  let chain = Promise.resolve();
  for (const item of newItems) {
    item.factsReady = chain = chain.then(() => fileFacts(item.file)).catch(() => null);
  }
  await chain;

  const files = [];
  for (const item of newItems) {
    const facts = await item.factsReady;
    if (facts) files.push({ key: String(item.id), name: item.file.name, hash: facts.hash, taken_at: facts.takenAt });
  }
  let matches = {};
  try {
    const response = await fetch("/api/admin/photos/duplicates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files }),
    });
    if (response.ok) ({ matches } = await response.json());
  } catch {
    return; // no warning is better than blocking the upload
  }

  for (const item of newItems) {
    if (item.status === "removed" || !items.includes(item)) continue;
    const notes = (matches[item.id] || []).map((m) => ({
      reason: m.reasons[0], // the strongest one
      text: `${REASON_TEXT[m.reasons[0]]} "${m.set_title}"`,
      href: `/admin/set?id=${m.set_id}`,
    }));
    // The same file twice in this list.
    const facts = await item.factsReady;
    const twin = facts && items.find((other) => other !== item && other.id < item.id &&
      other.status !== "removed" && other.factsReady && other.facts?.hash === facts.hash);
    item.facts = facts;
    if (twin) notes.unshift({ reason: "hash", text: `The same file is also in this list ("${twin.file.name}")` });
    item.duplicates = notes;
    renderWarning(item);
  }
  renderSummary();
}

function renderWarning(item) {
  const box = item.el.warning;
  const notes = item.duplicates || [];
  box.hidden = notes.length === 0 || item.status === "done";
  if (box.hidden) return;
  box.dataset.strength = notes.some((n) => n.reason !== "name") ? "strong" : "weak";
  const list = document.createElement("ul");
  for (const note of notes.slice(0, 3)) {
    const li = document.createElement("li");
    if (note.href) {
      const link = document.createElement("a");
      link.href = note.href;
      link.target = "_blank";
      link.textContent = note.text;
      li.append(link);
    } else {
      li.textContent = note.text;
    }
    list.append(li);
  }
  const title = document.createElement("strong");
  title.textContent = "Possible duplicate";
  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "button-secondary";
  skip.textContent = "Skip this photo";
  skip.addEventListener("click", () => skipItem(item));
  box.replaceChildren(title, list, skip);
  // Uploading: too late to skip.
  skip.hidden = !["waiting", "processing", "ready", "error"].includes(item.status);
}

// Takes one photo out of the list (before it is uploaded).
function skipItem(item) {
  if (item.status === "processing") item.status = "removed"; // the worker's result will be ignored
  if (!["waiting", "processing", "removed", "ready", "error"].includes(item.status)) return;
  item.status = "removed";
  URL.revokeObjectURL(item.thumbUrl);
  URL.revokeObjectURL(item.displayUrl);
  items = items.filter((i) => i !== item);
  item.el.root.remove();
  $("queue-panel").hidden = items.length === 0;
  if (!items.some((i) => i.result)) $("wm-preview").hidden = true;
  renderSummary();
}

$("skip-duplicates").addEventListener("click", () => {
  for (const item of items.filter((i) => i.duplicates?.length && i.status !== "uploading" && i.status !== "done")) {
    skipItem(item);
  }
});

// ---------- Drawing the list ----------

function createCard(file) {
  const root = document.createElement("li");
  const img = document.createElement("img");
  img.alt = "";
  const name = document.createElement("p");
  name.className = "queue-name";
  name.textContent = file.name;
  const sizes = document.createElement("p");
  sizes.className = "muted";
  const status = document.createElement("p");
  status.className = "queue-status";
  const warning = document.createElement("div");
  warning.className = "queue-warning";
  warning.hidden = true;
  root.append(img, name, sizes, status, warning);
  return { root, img, sizes, status, warning };
}

const STATUS_TEXT = {
  waiting: "Waiting",
  processing: "Shrinking...",
  ready: "Ready",
  uploading: "Uploading...",
  done: "Uploaded",
};

function renderItem(item) {
  const { root, img, sizes, status } = item.el;
  root.dataset.status = item.status;
  status.textContent = item.status === "error" ? item.error : STATUS_TEXT[item.status];
  if (item.thumbUrl && !img.src) img.src = item.thumbUrl;
  if (item.duplicates) renderWarning(item);
  if (item.result) {
    const { small, thumb, display, cameraInfo } = item.result;
    const online = small.size + thumb.size + display.size;
    sizes.textContent = `${formatBytes(item.file.size)} → ${formatBytes(online)} online (3 sizes)`;
    if (item.result.download) sizes.textContent += ` + ${formatBytes(item.result.download.size)} private clean copy`;
    if (cameraInfo) sizes.textContent += ` · ${cameraInfo}`;
  }
}

function renderSummary() {
  const count = (status) => items.filter((i) => i.status === status).length;
  const total = items.length;
  const done = count("done");
  const ready = count("ready");
  const errors = count("error");
  const processed = total - count("waiting") - count("processing");

  let text;
  if (count("waiting") + count("processing") > 0) text = `Shrinking photos: ${processed} of ${total} done.`;
  else if (uploading > 0 || (uploadStarted && ready > 0)) text = `Uploading: ${done} of ${total - errors} sent.`;
  else if (uploadStarted) text = `Finished: ${done} uploaded.`;
  else text = `${ready} ${ready === 1 ? "photo" : "photos"} ready. Check the preview, then upload.`;
  if (errors) text += ` ${errors} failed: see the red messages below.`;
  // Storage these photos will use, so you can keep an eye on the set's size.
  const shrunk = items.filter((i) => i.result && i.status !== "removed");
  if (shrunk.length) {
    const online = shrunk.reduce((sum, i) => sum + i.result.small.size + i.result.thumb.size + i.result.display.size, 0);
    const clean = shrunk.reduce((sum, i) => sum + (i.result.download?.size || 0), 0);
    text += ` Storage: ${formatBytes(online)}` + (clean ? ` + ${formatBytes(clean)} clean copies.` : ".");
  }
  const duplicates = items.filter((i) => i.duplicates?.length && i.status !== "done" && i.status !== "uploading").length;
  if (duplicates) text += ` ${duplicates} possible ${duplicates === 1 ? "duplicate" : "duplicates"}: see the yellow notes.`;
  $("skip-duplicates").hidden = duplicates === 0;
  $("queue-summary").textContent = text;
  $("queue-summary").dataset.state = errors ? "error" : "";
  $("retry-button").hidden = !items.some(canRetry) || isBusy();

  // Each photo counts twice: once for shrinking, once for uploading.
  $("queue-progress").max = Math.max(1, (total - errors) * 2);
  $("queue-progress").value = processed - errors + done;

  $("upload-button").disabled = ready === 0 || count("waiting") + count("processing") > 0 || uploading > 0;
  $("upload-button").textContent = `Upload ${ready || ""} ${ready === 1 ? "photo" : "photos"}`.replace("  ", " ");

  // The watermark is baked in while shrinking, so it cannot change mid-batch.
  const locked = isBusy() || ready > 0;
  wmOn.disabled = wmText.disabled = keepClean.disabled = locked;
  for (const input of wmStyleInputs) input.disabled = locked;
}

function isBusy() {
  return processing > 0 || uploading > 0 || items.some((i) => i.status === "waiting");
}

window.addEventListener("beforeunload", (event) => {
  if (isBusy() || items.some((i) => i.status === "ready")) event.preventDefault();
});

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

loadSet().catch((error) => {
  console.error(error);
  $("set-title").textContent = "Could not load this set.";
});
