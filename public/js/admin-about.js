// Admin page for the About page: bio, gear, contact details, and portrait.

const $ = (id) => document.getElementById(id);
const FIELDS = ["bio", "gear", "email", "phone", "instagram", "link_label", "link_url"];
let about = null;

async function load() {
  const response = await fetch("/api/admin/about");
  if (response.status === 401) return (location.href = "/admin/login");
  about = await response.json();
  for (const field of FIELDS) $(field).value = about[`about_${field}`];
  showPortrait();
}

// ---------- Bio and contact ----------

// Saves run one after another, never at the same time. Otherwise, when you move
// quickly between boxes, an older save could finish last and undo a newer one.
let saving = Promise.resolve();
function save() {
  saving = saving.then(saveNow, saveNow);
  return saving;
}

async function saveNow() {
  const status = $("about-status");
  const body = Object.fromEntries(FIELDS.map((field) => [field, $(field).value]));
  const response = await fetch("/api/admin/about", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    status.textContent = data.error || "Could not save.";
    status.dataset.state = "error";
    return;
  }
  about = data;
  // Show what was saved, for example "@winstonlens" typed becomes "winstonlens".
  // Skip any box you typed in since this save started, so nothing you type is lost.
  for (const field of FIELDS) {
    if ($(field).value === body[field]) $(field).value = about[`about_${field}`];
  }
  status.textContent = "Saved";
  status.dataset.state = "ok";
  clearTimeout(status.timer);
  status.timer = setTimeout(() => (status.textContent = ""), 2000);
}

$("about-form").addEventListener("submit", (event) => {
  event.preventDefault();
  save();
});
for (const field of FIELDS) {
  $(field).addEventListener("change", () => {
    if ($(field).checkValidity()) save();
  });
}

// ---------- Portrait ----------

function showPortrait() {
  const has = Boolean(about.about_portrait_key);
  $("portrait-preview").hidden = !has;
  if (has) $("portrait-preview").src = `/img/${about.about_portrait_key}`;
  $("portrait-remove").hidden = !has;
  $("portrait-status").textContent = has ? "Current portrait." : "No portrait yet.";
}

$("portrait-input").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const status = $("portrait-status");
  status.textContent = "Shrinking...";

  // The same background worker the set upload page uses, without a watermark.
  const worker = new Worker(new URL("./image-worker.js", import.meta.url), { type: "module" });
  const result = await new Promise((resolve) => {
    worker.onmessage = (e) => resolve(e.data);
    worker.onerror = () => resolve({ error: "Processing failed." });
    worker.postMessage({ id: 1, file, watermark: "" });
  });
  worker.terminate();
  if (result.error) {
    status.textContent = result.error;
    return;
  }

  status.textContent = "Uploading...";
  const form = new FormData();
  form.append("width", result.width);
  form.append("height", result.height);
  for (const size of ["small", "thumb"]) {
    const blob = result[size];
    form.append(size, blob, `${size}.jpg`);
  }
  const response = await fetch("/api/admin/about/portrait", { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    status.textContent = data.error || "Upload failed. Please try again.";
    return;
  }
  about = data;
  showPortrait();
});

$("portrait-remove").addEventListener("click", async () => {
  if (!confirm("Remove the portrait from the About page?")) return;
  const response = await fetch("/api/admin/about/portrait", { method: "DELETE" });
  if (!response.ok) return alert("Could not remove the portrait. Please try again.");
  about = await response.json();
  showPortrait();
});

load().catch((error) => {
  console.error(error);
  $("portrait-status").textContent = "Could not load the About page settings.";
});
