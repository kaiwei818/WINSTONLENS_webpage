// Shared by every admin page:
//   - Log out, in the links at the top (lib/chrome.js puts them there).
//   - Folding: each panel's heading opens and closes it, so long pages stay
//     easy to get around. The page remembers what you folded (in this browser).
//     A panel marked data-fold="closed" starts folded the first time.
// Page scripts call makeFoldable() for panels they build later.

export function makeFoldable(box, { key = "", open = true } = {}) {
  const heading = box.querySelector(":scope > h2");
  if (!heading || box.querySelector(":scope > details.fold")) return;
  const storageKey = `fold:${location.pathname}:${key || heading.id || heading.textContent.trim()}`;
  let saved = null;
  try {
    saved = localStorage.getItem(storageKey);
  } catch {}

  const details = document.createElement("details");
  details.className = "fold";
  details.open = saved ? saved === "open" : open;
  const summary = document.createElement("summary");
  summary.className = "fold-head";
  const rest = [...box.childNodes].slice([...box.childNodes].indexOf(heading) + 1);
  heading.replaceWith(details);
  summary.append(heading);
  summary.insertAdjacentHTML("beforeend", '<svg class="fold-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>');
  const body = document.createElement("div");
  body.className = "fold-body";
  body.append(...rest);
  details.append(summary, body);
  details.addEventListener("toggle", () => {
    try {
      localStorage.setItem(storageKey, details.open ? "open" : "closed");
    } catch {}
  });
}

for (const box of document.querySelectorAll("main .panel, main .danger-zone, main [data-fold]")) {
  if (!box.closest("dialog") && !box.hasAttribute("data-nofold")) makeFoldable(box, { open: box.dataset.fold !== "closed" });
}

for (const button of document.querySelectorAll("[data-logout]")) {
  button.addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    location.href = "/admin/login";
  });
}
