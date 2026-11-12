// The Instagram picks page (/admin/instagram): one section per set. Each set's
// picks are sorted into vertical and horizontal, each split into up to two
// posts of 20, best rated first (see picks-limit.js); picks past two posts
// wait for another round. Under them, the posts already made from that set,
// with their links (instagram-posts.js).
//
// Instagram has no web address that starts a post with photos already in it,
// so each post gets the next best thing for each device:
//   phone     Share hands the post's photos to the share sheet, where
//             Instagram is one of the choices (Web Share API). They are
//             downloaded first ("Get photos ready"), because phones only allow
//             sharing straight after a tap, not after a long download.
//   computer  Download the post as one .zip, then upload it on instagram.com.
// The files are the public, watermarked display versions.

import { makeZip } from "./zip.js";
import { GROUPS, PER_POST, groupOf, splitIntoPosts } from "./picks-limit.js";
import { markAsPosted, postRecordList } from "./instagram-posts.js";

const $ = (id) => document.getElementById(id);
let photos = [];          // picks, from /api/admin/instagram
let posts = [];           // records of posts already made
const ready = new Map();  // post key -> File[] downloaded for sharing

const stars = (n) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "Not rated");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const keyOf = (list) => list.map((p) => p.id).join(",");
const Name = (group) => group[0].toUpperCase() + group.slice(1);

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
  ({ photos, posts } = await response.json());
  ready.clear();
  render();
}

function render() {
  // Every set with picks or posts, in the order of your sets.
  const sets = new Map();
  for (const p of photos) if (!sets.has(p.set_id)) sets.set(p.set_id, { id: p.set_id, title: p.set_title, order: p.set_order });
  for (const p of posts) if (!sets.has(p.set_id)) sets.set(p.set_id, { id: p.set_id, title: p.set_title, order: Infinity });
  const ordered = [...sets.values()].sort((a, b) => a.order - b.order || a.id - b.id);
  $("status").hidden = ordered.length > 0;
  $("status").textContent = "No photos picked yet. Open a set from the dashboard and click \u201cPick for Instagram\u201d on the photos you want.";
  $("sets").replaceChildren(...ordered.map(setSection));
}

function setSection(set) {
  const section = el("section", "picks-set");
  const heading = el("h2");
  const link = el("a", "", set.title);
  link.href = `/admin/set?id=${set.id}`;
  heading.append(link);
  section.append(heading);
  const picks = photos.filter((p) => p.set_id === set.id);
  if (picks.length) section.append(...GROUPS.map((group) => groupBlock(set, group, picks.filter((p) => groupOf(p) === group))).filter(Boolean));
  else section.append(el("p", "muted", "No picks waiting in this set."));
  const own = posts.filter((p) => p.set_id === set.id);
  if (own.length) {
    const history = el("div", "picks-history");
    history.append(el("h3", "", `Posted from ${set.title}`), postRecordList(own, { onChange: load }));
    section.append(history);
  }
  return section;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function groupBlock(set, group, list) {
  if (!list.length) return null;
  const block = el("div", "picks-group");
  block.dataset.group = group;
  const heading = el("h3", "", `${Name(group)} `);
  heading.append(el("span", "picks-group-count", plural(list.length, "photo")));
  block.append(heading);
  const { posts: groupPosts, waiting } = splitIntoPosts(list);
  groupPosts.forEach((post, i) => block.append(postBlock(set, group, i + 1, post)));
  if (waiting.length) {
    const wait = el("div", "picks-waiting");
    wait.append(
      el("h4", "", `Waiting for another round: ${plural(waiting.length, "photo")}`),
      el("p", "muted small", `Two ${group} posts take ${PER_POST * 2}. These move up when you mark a post as posted, or unpick some above.`),
      grid(waiting),
    );
    block.append(wait);
  }
  return block;
}

function postBlock(set, group, number, list) {
  const block = el("article", "picks-post");
  const head = el("div", "picks-post-head");
  const title = el("h4", "", `${Name(group)} post ${number} `);
  title.append(el("span", "picks-group-count", `${list.length} of ${PER_POST}`));
  const status = el("p", "muted small picks-post-status");
  status.setAttribute("role", "status");
  const actions = el("div", "actions");
  const key = keyOf(list);
  const name = `${list[0].set_slug}-${group}-${number}`; // banff-vertical-1

  if (canShareFiles) {
    const isReady = ready.has(key);
    const prepare = button(isReady ? "Photos ready" : "Get photos ready to share", "", async () => {
      prepare.disabled = true;
      try {
        ready.set(key, await downloadFiles(list, name, (i) => { status.textContent = `Getting photo ${i + 1} of ${list.length}...`; }));
        status.textContent = `${plural(list.length, "photo")} ready. Tap Share to Instagram, then choose Instagram.`;
        share.hidden = false;
        prepare.textContent = "Photos ready";
        share.focus();
      } catch (err) {
        status.textContent = `Could not get the photos ready: ${err.message}. Try again.`;
        prepare.disabled = false;
      }
    });
    prepare.disabled = isReady;
    const share = button("Share to Instagram", "", async () => {
      try {
        await navigator.share({ files: ready.get(key) });
        status.textContent = "Shared. Once it is posted, tap “Mark as posted”.";
      } catch (err) {
        // Closing the share sheet without choosing anything is not a problem.
        if (err.name !== "AbortError") status.textContent = `Could not open the share sheet: ${err.message}`;
      }
    });
    share.hidden = !isReady;
    actions.append(prepare, share);
  }

  const download = button("Download (.zip)", "button-secondary", async () => {
    download.disabled = true;
    try {
      const files = await downloadFiles(list, name, (i) => { download.textContent = `Getting ${i + 1} of ${list.length}...`; });
      const zip = await makeZip(files.map((file) => ({ name: file.name, blob: file })));
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zip);
      const today = new Date().toLocaleDateString("en-CA"); // your own date, as 2026-11-12
      link.download = `instagram-${name}-${today}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
    } catch (err) {
      alert(`Could not make the .zip: ${err.message}`);
    } finally {
      download.textContent = "Download (.zip)";
      download.disabled = false;
    }
  });

  // Asks for the link and a note, saves the record, and takes these photos
  // off the picks (photos waiting for another round then move up).
  const posted = button("Mark as posted", "button-secondary", async () => {
    const saved = await markAsPosted({ setId: set.id, orientation: group, photoIds: list.map((p) => p.id),
      title: `${set.title}: ${group} post ${number}, ${plural(list.length, "photo")}` });
    if (saved) load();
    else posted.focus();
  });

  actions.append(download, posted);
  head.append(title, actions, status);
  block.append(head, grid(list));
  return block;
}

function grid(list) {
  const ul = el("ul", "picks-grid");
  for (const photo of list) {
    const item = el("li", "picks-item");
    const img = document.createElement("img");
    img.src = `/img/${photo.small_key || photo.thumb_key}`;
    img.alt = photo.alt_text;
    img.loading = "lazy";
    img.style.setProperty("--ratio", photo.width / photo.height);
    const meta = el("p", "picks-meta");
    const rating = el("span", "picks-stars", stars(photo.rating));
    rating.setAttribute("aria-label", photo.rating ? `Rated ${photo.rating} of 5` : "Not rated");
    meta.append(rating); // the set is the section's heading
    // The file name on your computer ("DSC01234.JPG"), to find the original.
    // Photos uploaded before names were recorded have none.
    const file = photo.original_name ? el("p", "picks-file", photo.original_name) : null;
    const remove = button("Unpick", "picks-unpick button-secondary", () => unpick([photo]));
    remove.setAttribute("aria-label", `Unpick ${photo.original_name || "this photo"} from ${photo.set_title}`);
    item.append(img, meta, ...(file ? [file] : []), remove);
    ul.append(item);
  }
  return ul;
}

function button(text, className, onClick) {
  const b = el("button", className, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

async function downloadFiles(list, name, onProgress) {
  const files = [];
  for (const [i, p] of list.entries()) {
    onProgress?.(i);
    const response = await fetch(`/img/${p.display_key}`);
    if (!response.ok) throw new Error(`photo ${i + 1} could not be downloaded`);
    files.push(new File([await response.blob()], `${name}-${String(i + 1).padStart(2, "0")}.jpg`, { type: "image/jpeg" }));
  }
  return files;
}

// Takes photos off the picks (their ratings stay); the posts then re-form,
// so photos waiting for another round move up.
async function unpick(list) {
  const results = await Promise.all(list.map((p) =>
    fetch(`/api/admin/photos/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagram: 0 }),
    }).then((r) => r.ok).catch(() => false)));
  const done = new Set(list.filter((_, i) => results[i]).map((p) => p.id));
  photos = photos.filter((p) => !done.has(p.id));
  ready.clear();
  render();
  if (done.size < list.length) alert(`${list.length - done.size} could not be updated. Please try again.`);
}

load();
