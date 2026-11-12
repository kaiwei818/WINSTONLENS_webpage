// The Instagram picks page (/admin/instagram): every photo flagged with
// "Pick for Instagram" on a set's page, ready to post.
//
// Instagram has no web address that starts a post with photos already in it,
// so this uses the next best thing for each device:
//   phone     Share hands the photos to the phone's share sheet, where
//             Instagram is one of the choices (Web Share API). The files are
//             downloaded first ("Get photos ready"), because phones only allow
//             sharing straight after a tap, not after a long download.
//   computer  Download them as one .zip, then upload them on instagram.com.
// The files are the public, watermarked display versions.

import { makeZip } from "./zip.js";

const $ = (id) => document.getElementById(id);
const MAX_PER_POST = 20; // Instagram's limit for one post (a carousel)

let photos = [];              // from /api/admin/instagram
const selected = new Set();   // photo ids
let ready = null;             // { key, files }: files downloaded for sharing

const visible = () => photos.filter((p) => p.rating >= Number($("min-rating").value));
const chosen = () => visible().filter((p) => selected.has(p.id));
const fileName = (p, i) => `${p.set_slug}-${String(i + 1).padStart(2, "0")}.jpg`;
const stars = (n) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "Not rated");

// Sharing files to Instagram works on phones and tablets: test with a tiny
// file. Computers that can share (Chrome on a Mac) get no Share button, since
// their share menus have no Instagram; Download is the way there.
const canShareFiles = (() => {
  try {
    return window.matchMedia("(pointer: coarse)").matches &&
      Boolean(navigator.canShare?.({ files: [new File([""], "test.jpg", { type: "image/jpeg" })] }));
  } catch {
    return false;
  }
})();

async function load() {
  const response = await fetch("/api/admin/instagram");
  if (response.status === 401) return (location.href = "/admin/login");
  if (!response.ok) {
    $("status").textContent = "Could not load your picks. Reload the page to try again.";
    return;
  }
  photos = (await response.json()).photos;
  photos.forEach((p) => selected.add(p.id));
  render();
}

function render() {
  const list = visible();
  $("picks").replaceChildren(...list.map(card));
  $("picks-toolbar").hidden = photos.length === 0;
  $("picks-actions").hidden = list.length === 0;
  $("status").hidden = list.length > 0;
  $("status").textContent = photos.length === 0
    ? "No photos picked yet. Open a set from the dashboard and click “Pick for Instagram” on the photos you want."
    : "No picks with that rating. Choose a lower one above.";
  update();
}

function card(photo) {
  const item = document.createElement("li");
  item.className = "picks-item";
  const label = document.createElement("label");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = selected.has(photo.id);
  box.addEventListener("change", () => {
    if (box.checked) selected.add(photo.id);
    else selected.delete(photo.id);
    update();
  });
  const img = document.createElement("img");
  img.src = `/img/${photo.small_key || photo.thumb_key}`;
  img.alt = photo.alt_text;
  img.loading = "lazy";
  const name = document.createElement("span");
  name.className = "visually-hidden";
  name.textContent = `Select photo from ${photo.set_title}`;
  label.append(box, img, name);

  const meta = document.createElement("p");
  meta.className = "picks-meta";
  const rating = document.createElement("span");
  rating.className = "picks-stars";
  rating.textContent = stars(photo.rating);
  rating.setAttribute("aria-label", photo.rating ? `Rated ${photo.rating} of 5` : "Not rated");
  const link = document.createElement("a");
  link.href = `/admin/set?id=${photo.set_id}`;
  link.textContent = photo.set_title;
  meta.append(rating, link);
  item.append(label, meta);
  return item;
}

// The count, the 20-photo note, and which buttons apply.
function update() {
  const count = chosen().length;
  $("selected-count").textContent = `${count} selected`;
  $("limit-note").hidden = count <= MAX_PER_POST;
  const key = chosen().map((p) => p.id).join(",");
  const isReady = ready?.key === key && count > 0;
  $("prepare").hidden = !canShareFiles || isReady;
  $("share").hidden = !canShareFiles || !isReady;
  for (const id of ["prepare", "download", "mark-posted"]) $(id).disabled = count === 0;
  if (!isReady) $("share-status").textContent = "";
}

async function downloadFiles(list, onProgress) {
  const files = [];
  for (const [i, p] of list.entries()) {
    onProgress?.(i);
    const response = await fetch(`/img/${p.display_key}`);
    if (!response.ok) throw new Error(`photo ${i + 1} could not be downloaded`);
    files.push(new File([await response.blob()], fileName(p, i), { type: "image/jpeg" }));
  }
  return files;
}

$("min-rating").addEventListener("change", render);
$("select-all").addEventListener("click", () => { visible().forEach((p) => selected.add(p.id)); render(); });
$("select-none").addEventListener("click", () => { visible().forEach((p) => selected.delete(p.id)); render(); });

$("prepare").addEventListener("click", async () => {
  const list = chosen();
  $("prepare").disabled = true;
  try {
    const files = await downloadFiles(list, (i) => { $("share-status").textContent = `Getting photo ${i + 1} of ${list.length}...`; });
    ready = { key: list.map((p) => p.id).join(","), files };
    update();
    $("share-status").textContent = `${files.length} ${files.length === 1 ? "photo is" : "photos are"} ready. Tap Share to Instagram, then choose Instagram.`;
    $("share").focus();
  } catch (err) {
    $("share-status").textContent = `Could not get the photos ready: ${err.message}. Try again.`;
  } finally {
    $("prepare").disabled = chosen().length === 0;
  }
});

$("share").addEventListener("click", async () => {
  try {
    await navigator.share({ files: ready.files });
    $("share-status").textContent = "Shared. Once it is posted, click “Mark selected as posted”.";
  } catch (err) {
    // Closing the share sheet without choosing anything is not a problem.
    if (err.name !== "AbortError") $("share-status").textContent = `Could not open the share sheet: ${err.message}`;
  }
});

$("download").addEventListener("click", async () => {
  const list = chosen();
  const button = $("download");
  button.disabled = true;
  try {
    const files = await downloadFiles(list, (i) => { button.textContent = `Getting ${i + 1} of ${list.length}...`; });
    const zip = await makeZip(files.map((file) => ({ name: file.name, blob: file })));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(zip);
    const today = new Date().toLocaleDateString("en-CA"); // your own date, as 2026-11-11
    link.download = `instagram-${today}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
  } catch (err) {
    alert(`Could not make the .zip: ${err.message}`);
  } finally {
    button.textContent = "Download selected (.zip)";
    button.disabled = chosen().length === 0;
  }
});

$("mark-posted").addEventListener("click", async () => {
  const list = chosen();
  if (!confirm(`Take ${list.length} ${list.length === 1 ? "photo" : "photos"} off your Instagram picks?`)) return;
  const results = await Promise.all(list.map((p) =>
    fetch(`/api/admin/photos/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagram: 0 }),
    }).then((r) => r.ok).catch(() => false)));
  const done = new Set(list.filter((_, i) => results[i]).map((p) => p.id));
  photos = photos.filter((p) => !done.has(p.id));
  done.forEach((id) => selected.delete(id));
  ready = null;
  render();
  if (done.size < list.length) alert(`${list.length - done.size} could not be updated. Please try again.`);
});

load();
