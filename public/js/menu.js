// The ☰ menu at the top right of every public page (the panel itself is built
// on the server, in lib/chrome.js).
//
// It uses the built-in <dialog> element, which gives for free: showing above
// everything, closing with Escape, and keeping keyboard focus inside while open.
// The slide-in and fade are in style.css ("Menu").

(function () {
  function setup() {
    const button = document.getElementById("menu-button");
    const menu = document.getElementById("site-menu");
    if (!button || !menu || !menu.showModal) return;

    function open() {
      menu.showModal();
      button.setAttribute("aria-expanded", "true");
      document.body.classList.add("no-scroll");
      // Start on the current page's link, or the first one.
      (menu.querySelector('[aria-current="page"]') || menu.querySelector(".menu-nav a"))?.focus();
    }

    function close() {
      if (menu.open) menu.close();
    }

    // Where keyboard focus goes when the menu closes: back to the Menu button,
    // or to the contact links after "Contact".
    let focusAfterClose = null;

    button.addEventListener("click", open);
    menu.addEventListener("close", () => {
      button.setAttribute("aria-expanded", "false");
      document.body.classList.remove("no-scroll");
      (focusAfterClose || button).focus({ preventScroll: true });
      focusAfterClose = null;
    });
    menu.querySelector("#menu-close")?.addEventListener("click", close);

    // A tap on the dark area beside the panel closes the menu.
    menu.addEventListener("click", (event) => {
      if (event.target === menu) close();
    });

    // "Contact" scrolls to the end of this page, so close the menu first, and
    // move keyboard focus there too (Tab then continues from the contact links).
    for (const link of menu.querySelectorAll("[data-close-menu]")) {
      link.addEventListener("click", () => {
        focusAfterClose = document.querySelector(`${link.hash} a`);
        close();
      });
    }

    // Coming back with the browser's Back button can restore a page with the
    // menu still open; start closed instead.
    window.addEventListener("pageshow", close);

    // Leaving for another page from the open menu: skip the fade, which would
    // briefly draw the header on top of the menu.
    window.addEventListener("pageswap", (event) => {
      if (menu.open) event.viewTransition?.skipTransition();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();

  // The English / 中文 links (header and menu, data-lang-choice). The English
  // one goes to the plain address, which shows the language saved in the
  // "lang" cookie, so save the new choice first (the same cookie the server
  // sets for ?lang=zh, see functions/_middleware.js). Speculation rules skip
  // these links, so no page is loaded early with the old choice.
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[data-lang-choice]");
    if (!link) return;
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `lang=${link.dataset.langChoice}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  });
})();
