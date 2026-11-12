// Admin dashboard: storage used, the list of sets (create, reorder, delete), and logging out.

import { MONTHS, rotationPool } from "./hero-pick.js";
import { currentIds, makeSortable, moveItem } from "./sortable.js";

async function loadStats() {
  const response = await fetch("/api/admin/stats");
  if (response.status === 401) {
    location.href = "/admin/login"; // session expired
    return;
  }
  const stats = await response.json();

  const percent = (stats.bytes_used / stats.bytes_limit) * 100;
  document.getElementById("storage-text").textContent =
    `${formatBytes(stats.bytes_used)} of ${formatBytes(stats.bytes_limit)} used (${percent.toFixed(1)}%)`;
  document.getElementById("storage-fill").style.width = `${Math.min(percent, 100)}%`;
  document.getElementById("counts").textContent =
    `${stats.set_count} sets, ${stats.photo_count} photos`;
  renderStorageBySet(stats);
}

// One row per set, largest first. The bar shows the set's share of the space
// used so far (not of the 10 GB), so the differences between sets are visible.
function renderStorageBySet(stats) {
  const list = document.getElementById("storage-list");
  list.replaceChildren(...stats.sets.map((set) => {
    const share = stats.bytes_used ? (set.bytes_used / stats.bytes_used) * 100 : 0;
    const item = document.createElement("li");

    const name = document.createElement("a");
    name.href = `/admin/set?id=${set.id}`;
    name.textContent = set.title;
    const size = document.createElement("span");
    size.className = "storage-size";
    size.textContent = `${formatBytes(set.bytes_used)} · ${set.photo_count} ${set.photo_count === 1 ? "photo" : "photos"}`;

    const meter = document.createElement("div");
    meter.className = "meter";
    const fill = document.createElement("div");
    fill.className = "meter-fill";
    fill.style.width = `${share}%`;
    meter.append(fill);
    meter.setAttribute("role", "img");
    meter.setAttribute("aria-label", `${Math.round(share)}% of the space used`);

    item.append(name, size, meter);
    return item;
  }));
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ---------- Sets ----------

const setList = document.getElementById("set-list");
let lastSets = []; // for the hero note

async function loadSets() {
  const response = await fetch("/api/admin/sets");
  if (!response.ok) return;
  const sets = await response.json();
  lastSets = sets;
  setList.replaceChildren(...sets.map(createSetRow));
  showHeroNote();
}

function createSetRow(set) {
  const item = document.createElement("li");
  item.dataset.id = set.id;

  // The ⠿ handle is what you grab to drag the row (see sortable.js).
  const handle = document.createElement("span");
  handle.className = "drag-handle";
  handle.textContent = "⠿";
  handle.title = "Drag to reorder";
  handle.setAttribute("aria-hidden", "true");

  const link = document.createElement("a");
  link.href = `/admin/set?id=${set.id}`;
  link.textContent = set.title;
  if (!set.published) {
    const badge = document.createElement("span");
    badge.className = "draft-badge";
    if (set.publish_at) {
      const when = new Date(set.publish_at);
      badge.classList.add("scheduled");
      badge.textContent = `Scheduled ${when.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    } else {
      badge.textContent = "Draft";
    }
    link.append(" ", badge);
  }
  if (set.featured) {
    const star = document.createElement("span");
    star.className = "draft-badge featured-badge";
    star.textContent = set.feature_months ? "Featured (seasonal)" : "Featured";
    link.append(" ", star);
  }
  const count = document.createElement("span");
  count.className = "muted";
  count.textContent = `${set.photo_count} ${set.photo_count === 1 ? "photo" : "photos"}`;

  const up = iconButton("↑", `Move ${set.title} up`, () => moveSet(item, -1));
  const down = iconButton("↓", `Move ${set.title} down`, () => moveSet(item, 1));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "button-danger";
  remove.textContent = "Delete";
  remove.setAttribute("aria-label", `Delete set ${set.title}`);
  remove.addEventListener("click", () => deleteSet(set, item));
  item.append(handle, link, count, up, down, remove);
  return item;
}

function iconButton(text, label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button";
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

function moveSet(item, direction) {
  if (!moveItem(item, direction)) return;
  // Keep keyboard focus on the same button, so pressing Enter again keeps moving it.
  item.querySelector(direction < 0 ? ".icon-button" : ".icon-button + .icon-button").focus();
  saveSetOrder();
}

makeSortable(setList, { onChange: saveSetOrder });

// The order on this list is the order on the home page.
async function saveSetOrder() {
  const response = await fetch("/api/admin/sets/order", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ set_ids: currentIds(setList) }),
  });
  if (!response.ok) {
    alert("Could not save the new order. The list will reload.");
    loadSets();
  }
}

async function deleteSet(set, row) {
  const photos = `${set.photo_count} ${set.photo_count === 1 ? "photo" : "photos"}`;
  // confirm() shows the browser's own OK/Cancel box. Deleting cannot be undone,
  // so always ask first.
  if (!confirm(`Delete the set "${set.title}" and its ${photos}?\n\nThis cannot be undone.`)) return;

  const response = await fetch(`/api/admin/sets/${set.id}`, { method: "DELETE" });
  if (!response.ok) {
    alert("Could not delete the set. Please try again.");
    return;
  }
  row.remove();
  loadStats(); // storage went down
}

document.getElementById("new-set-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("new-set-error");
  error.textContent = "";

  const response = await fetch("/api/admin/sets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: document.getElementById("new-set-title").value }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    error.textContent = data.error || "Could not create the set.";
    return;
  }
  // Go straight to the new set's page. It starts as a draft.
  location.href = `/admin/set?id=${data.id}`;
});

// ---------- Categories ----------

const categoryList = document.getElementById("category-list");

async function loadCategories() {
  const response = await fetch("/api/admin/categories");
  if (!response.ok) return;
  const categories = await response.json();
  categoryList.replaceChildren(...categories.map((category) => {
    const item = document.createElement("li");
    const sets = `${category.set_count} ${category.set_count === 1 ? "set" : "sets"}`;
    item.append(`${category.name} `);
    const count = document.createElement("span");
    count.className = "muted";
    count.textContent = `(${sets})`;
    const remove = iconButton("×", `Delete category ${category.name}`, async () => {
      if (!confirm(`Delete the category "${category.name}"?\n\nIts sets stay; they just lose this category.`)) return;
      const result = await fetch(`/api/admin/categories/${category.id}`, { method: "DELETE" });
      if (!result.ok) return alert("Could not delete the category. Please try again.");
      loadCategories();
    });
    item.append(count, remove);
    return item;
  }));
}

document.getElementById("new-category-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("new-category-name");
  const error = document.getElementById("new-category-error");
  error.textContent = "";
  const response = await fetch("/api/admin/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: input.value }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    error.textContent = data.error || "Could not add the category.";
    return;
  }
  input.value = "";
  loadCategories();
});

// ---------- Log out ----------

document.getElementById("logout").addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  location.href = "/admin/login";
});

loadSets().catch((error) => console.error(error));

// ---------- Home page hero ----------

const heroRadios = (name) => [...document.querySelectorAll(`input[name="${name}"]`)];

async function loadHero() {
  const response = await fetch("/api/admin/hero");
  if (!response.ok) return;
  const hero = await response.json();
  for (const r of heroRadios("hero-mode")) r.checked = r.value === hero.hero_mode;
  for (const r of heroRadios("hero-rotate")) r.checked = r.value === hero.hero_rotate;
  showHeroNote();
}

// What "Rotate" does this month, using the same rule as the home page
// (hero-pick.js): which featured sets the hero rotates between right now.
function showHeroNote() {
  const mode = heroRadios("hero-mode").find((r) => r.checked)?.value;
  document.getElementById("hero-rotate-field").hidden = mode !== "rotate";
  const note = document.getElementById("hero-note");
  if (mode !== "rotate") return (note.textContent = "");
  const live = lastSets.filter((s) => s.published && s.photo_count > 0);
  const { pool, reason, month } = rotationPool(live);
  const name = MONTHS[month - 1];
  const sets = (n) => `${n} ${n === 1 ? "set" : "sets"}`;
  const titles = pool.map((s) => s.title).join(", ");
  note.textContent = {
    "in-season": `${name}: rotating between ${sets(pool.length)} in season (${titles}). Sets with other months ticked wait for their months.`,
    "all-year": `${name}: no featured set has ${name} ticked, so it rotates between ${sets(pool.length)} featured all year (${titles}).`,
    "out-of-season": `${name}: none of your featured sets has ${name} ticked and none is all-year, so it rotates between all ${sets(pool.length)} (${titles}). Tick ${name} on a set's page to prefer it this month.`,
    none: "No public set is featured yet: until you feature one, the first set in your list is shown.",
  }[reason];
}

for (const radio of [...heroRadios("hero-mode"), ...heroRadios("hero-rotate")]) {
  radio.addEventListener("change", async () => {
    const body = { [radio.name.replace("-", "_")]: radio.value };
    const response = await fetch("/api/admin/hero", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const status = document.getElementById("hero-status");
    status.textContent = response.ok ? "Saved" : "Could not save.";
    status.dataset.state = response.ok ? "ok" : "error";
    setTimeout(() => (status.textContent = ""), 2000);
    showHeroNote();
  });
}

loadHero();
loadCategories().catch((error) => console.error(error));
loadStats().catch((error) => {
  console.error(error);
  document.getElementById("storage-text").textContent = "Could not load storage info.";
});
