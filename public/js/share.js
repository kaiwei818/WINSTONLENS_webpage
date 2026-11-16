// Share buttons. Any <button data-share> shares the page it is on: its address,
// title, and description (the same ones link previews use).
//
// On phones, the button opens the phone's own share sheet (Messages, LINE,
// Instagram, AirDrop, ...). On computers it opens a small menu: copy the link,
// or share on LINE, Facebook, X, WhatsApp, or by email.
//
// The buttons start hidden and only appear when this script runs.
// (A module, loaded after the page is read, like "defer".)

import { t } from "./text.js";

(function () {
  const ICONS = {
    copy: '<path d="M9 9h10v10H9z"/><path d="M5 15V5h10"/>',
    line: '<path d="M12 4C7 4 3 7.2 3 11.2c0 3.6 3.2 6.6 7.5 7.1l-.4 2.7 3.4-2.6c4.5-.4 7.5-3.5 7.5-7.2C21 7.2 17 4 12 4z"/>',
    facebook: '<path d="M14 8h2.5V4.5H14A4 4 0 0 0 10 8.5V11H7.5v3.5H10V21h3.5v-6.5H16l.5-3.5h-3v-2c0-.6.4-1 1-1z"/>',
    x: '<path d="M5 4l14 16M19 4L5 20"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8.5 19z"/>',
    email: '<path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/>',
    more: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  };

  function pageInfo() {
    const canonical = document.querySelector('link[rel="canonical"]')?.href;
    return {
      // The set page sets data-share-url while it is filtered to one player.
      url: document.documentElement.dataset.shareUrl || canonical || location.href.split("#")[0],
      title: document.title,
      text: document.querySelector('meta[name="description"]')?.content || "",
    };
  }

  // Phones and tablets: the built-in share sheet is the best choice.
  const preferNative = typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches;

  let menu = null;
  let openFor = null;

  function closeMenu() {
    if (!menu) return;
    menu.remove();
    menu = null;
    openFor?.setAttribute("aria-expanded", "false");
    openFor = null;
  }

  function item(icon, label, action) {
    const el = typeof action === "string" ? document.createElement("a") : document.createElement("button");
    if (typeof action === "string") {
      el.href = action;
      if (!action.startsWith("mailto:")) {
        el.target = "_blank";
        el.rel = "noopener";
      }
      el.addEventListener("click", closeMenu);
    } else {
      el.type = "button";
      el.addEventListener("click", action);
    }
    el.className = "share-item";
    el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>`;
    el.append(label);
    return el;
  }

  function openMenu(button) {
    const { url, title, text } = pageInfo();
    const u = encodeURIComponent(url);
    menu = document.createElement("div");
    menu.className = "share-menu";
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-label", t("menu.share"));

    const copy = item("copy", t("share.copy"), async () => {
      try {
        await navigator.clipboard.writeText(url);
        copy.lastChild.textContent = t("share.copied");
      } catch {
        // Clipboard blocked: show the address so it can be copied by hand.
        window.prompt(t("share.prompt"), url);
      }
      setTimeout(closeMenu, 900);
    });
    menu.append(
      copy,
      item("line", "LINE", `https://social-plugins.line.me/lineit/share?url=${u}`),
      item("facebook", "Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`),
      item("x", "X", `https://twitter.com/intent/tweet?url=${u}&text=${encodeURIComponent(title)}`),
      item("whatsapp", "WhatsApp", `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`),
      item("email", t("share.email"), `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`.trim())}`),
    );
    if (typeof navigator.share === "function") {
      menu.append(item("more", t("share.more"), () => {
        closeMenu();
        navigator.share({ url, title, text }).catch(() => {});
      }));
    }

    document.body.append(menu);
    // Place it under the button, kept inside the screen.
    const box = button.getBoundingClientRect();
    const width = menu.offsetWidth;
    const left = Math.min(Math.max(8, box.right - width), document.documentElement.clientWidth - width - 8);
    menu.style.left = `${left + window.scrollX}px`;
    menu.style.top = `${box.bottom + window.scrollY + 8}px`;
    button.setAttribute("aria-expanded", "true");
    openFor = button;
    menu.querySelector(".share-item").focus();
  }

  async function onShare(event) {
    let button = event.currentTarget;
    if (openFor === button) return closeMenu();
    closeMenu();
    // The button in the ☰ menu: close the menu first (the share menu cannot
    // show on top of it), and place the share menu under the ☰ button instead.
    const dialog = button.closest("dialog");
    if (dialog) {
      dialog.close();
      button = document.getElementById("menu-button") || button;
    }
    if (preferNative) {
      try {
        await navigator.share(pageInfo());
        return;
      } catch (err) {
        if (err.name === "AbortError") return; // the visitor closed the share sheet
        // Anything else: fall back to the menu below.
      }
    }
    openMenu(button);
  }

  document.addEventListener("DOMContentLoaded", () => {
    for (const button of document.querySelectorAll("[data-share]")) {
      button.hidden = false;
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      button.addEventListener("click", onShare);
    }
  });
  document.addEventListener("click", (event) => {
    if (menu && !menu.contains(event.target) && !event.target.closest("[data-share]")) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu) {
      const button = openFor;
      closeMenu();
      button?.focus();
    }
  });
  window.addEventListener("resize", closeMenu);
})();
