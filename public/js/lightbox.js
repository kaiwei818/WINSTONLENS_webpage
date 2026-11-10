// Full-screen photo viewer ("lightbox").
//
// Open it by tapping a photo. Then:
//   next / previous   swipe left or right, the arrow keys, or the < > buttons
//   first / last      the Home and End keys
//   close             swipe down, Escape, the × button, or the phone's Back button
//   zoom              pinch with two fingers; then one finger looks around
//
// Each photo has its own address (/sets/kyoto?photo=3), so it can be shared,
// and a reload or a shared link opens that photo. Back closes the viewer.
//
// In browsers that can (Chrome, Edge, Safari 18), the photo grows out of its
// place in the grid when opened and shrinks back into it when closed (a "view
// transition"). Elsewhere, and for visitors who asked for less motion, it fades.
//
// It uses the built-in <dialog> element, which gives us for free: showing on top
// of everything, closing on Escape, and keeping keyboard focus inside while open.

import { img as imageUrl, viewerSrcset } from "./images.js";

const SWIPE_DISTANCE = 50; // pixels a finger must travel to count as a swipe

// downloadUrl(photo): optional; returns a download address for this photo, or ""
// when it cannot be downloaded (no license code entered, or no clean copy).
// thumbFor(index): optional; the grid button of that photo, for the grow and
// shrink effect and to put keyboard focus back on the photo last viewed.
export function createLightbox(photos, { downloadUrl = () => "", thumbFor = () => null } = {}) {
  const dialog = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-img");
  const info = document.getElementById("lightbox-info");
  const caption = document.getElementById("lightbox-caption");
  const camera = document.getElementById("lightbox-camera");
  const counter = document.getElementById("lightbox-counter");
  const download = document.getElementById("lightbox-download");
  const prevButton = document.getElementById("lightbox-prev");
  const nextButton = document.getElementById("lightbox-next");
  const status = document.getElementById("lightbox-status");
  const problem = document.getElementById("lightbox-problem");
  const lessMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let index = 0;
  let direction = 1; // which way the visitor is moving through the set
  let returnFocusTo = null;
  let cleanedUp = true;
  // What the visitor last asked for (open or closed). Set at once, while the
  // grow/shrink effect still runs, so quick Back/Forward presses end up right.
  let wantOpen = false;
  const closeButton = document.getElementById("lightbox-close");

  function show(newIndex) {
    const previous = index;
    index = (newIndex + photos.length) % photos.length; // wrap around at the ends
    if (index !== previous) direction = newIndex < previous ? -1 : 1;
    const photo = photos[index];

    // Show the grid picture at once (already downloaded, so instant), then swap
    // in the large version as soon as it arrives. No blank screen while waiting:
    // underneath is the photo's tiny blurry preview (see style.css).
    img.removeAttribute("srcset");
    img.src = photo.gridSrc || imageUrl(photo.thumb_key);
    img.alt = photo.alt_text;
    if (photo.placeholder) img.style.setProperty("--ph", `url("${photo.placeholder}")`);
    else img.style.removeProperty("--ph");
    setState("loading");
    // Its final size from the start (see style.css), so it does not grow when
    // the large file replaces the smaller grid one.
    if (photo.width && photo.height) {
      img.style.setProperty("--ratio", photo.width / photo.height);
      img.style.setProperty("--w", `${photo.width}px`);
    } else {
      img.style.removeProperty("--ratio");
      img.style.removeProperty("--w");
    }
    const large = loadLarge(photo);
    large.onload = () => {
      if (photos[index] !== photo) return; // moved on to another photo meanwhile
      img.src = large.currentSrc || large.src;
      setState("");
      // Only now start on the next one, so it does not slow this one down.
      preload(index + direction);
    };
    large.onerror = () => {
      if (photos[index] === photo) setState("error");
    };

    caption.textContent = photo.caption;
    caption.hidden = !photo.caption;
    camera.textContent = photo.camera_info || "";
    camera.hidden = !photo.camera_info;
    info.hidden = caption.hidden && camera.hidden;
    counter.textContent = `${index + 1} / ${photos.length}`;
    const href = downloadUrl(photo);
    download.hidden = !href;
    if (href) download.href = href;
    const single = photos.length === 1;
    prevButton.hidden = nextButton.hidden = single;
    // Screen readers say this when the photo changes (not on opening, when
    // they already announce the viewer itself).
    status.textContent = dialog.open
      ? `Photo ${index + 1} of ${photos.length}${photo.alt_text ? `: ${photo.alt_text}` : ""}`
      : "";
    if (wantOpen) rememberAddress();
  }

  // The address follows the photo, a moment after the last change: Safari
  // refuses more than 100 address changes in a short time.
  let addressTimer;
  function rememberAddress() {
    clearTimeout(addressTimer);
    addressTimer = setTimeout(() => {
      if (!wantOpen || !history.state?.lightbox) return;
      try {
        history.replaceState({ lightbox: true }, "", photoAddress(index));
      } catch {} // over the browser's limit: the address just stays a little behind
    }, 250);
  }

  // "loading": a thin line moves along the top after a moment (style.css).
  // "error": the large file failed; the smaller one stays, with a note.
  function setState(state) {
    dialog.dataset.state = state;
    // Keyboard focus on "Try again" must not vanish with the note (it would
    // land outside the viewer, and the arrow keys would stop working).
    if (state !== "error" && problem.contains(document.activeElement)) closeButton.focus();
    problem.hidden = state !== "error";
  }
  img.addEventListener("error", () => setState("error"));
  problem.querySelector("button").addEventListener("click", () => show(index));

  // Start downloading the next photo (in the direction the visitor is going),
  // so moving on feels instant. Not when the visitor's device asks to save data.
  function preload(i) {
    const connection = navigator.connection;
    if (photos.length < 2 || connection?.saveData || /2g/.test(connection?.effectiveType || "")) return;
    loadLarge(photos[(i + photos.length) % photos.length]);
  }

  function photoAddress(i) {
    return `${location.pathname}?photo=${i + 1}`;
  }

  // The viewer fills the screen, so "sizes" is the screen width. The browser
  // then picks the 2000 px version on phones and the 3000 px one on big screens.
  function loadLarge(photo) {
    const large = new Image();
    large.sizes = "100vw";
    large.srcset = viewerSrcset(photo); // empty for older photos: then src is used
    large.src = imageUrl(photo.display_key);
    return large;
  }

  // instant: no grow effect (used when the page opens straight on a photo).
  // push: false when the current history entry already is this viewer's (a
  // reload while a photo was open), so no extra Back step is added.
  function open(startIndex, opener, { instant = false, push = true } = {}) {
    if (wantOpen) return show(startIndex);
    returnFocusTo = opener;
    index = startIndex;
    show(startIndex);
    wantOpen = true;
    // The page is scrolled by us when the viewer closes (to the last photo),
    // not by the browser's memory of where it was.
    history.scrollRestoration = "manual";
    // Add a history entry, so the phone's Back button closes the viewer
    // instead of leaving the page.
    if (push) {
      try {
        history.pushState({ lightbox: true }, "", photoAddress(index));
      } catch {}
    }
    showDialog(instant);
  }

  function showDialog(instant) {
    morph("open", () => {
      if (!wantOpen || dialog.open) return; // closed again meanwhile
      dialog.showModal();
      document.body.classList.add("no-scroll");
      cleanedUp = false;
      status.textContent = "";
    }, instant);
  }

  // Every way of closing ends up here, so the cleanup happens exactly once:
  // back where the visitor was, on the photo they looked at last.
  function cleanUp() {
    if (cleanedUp) return;
    cleanedUp = true;
    document.body.classList.remove("no-scroll");
    const thumb = thumbFor(index);
    thumb?.scrollIntoView({ block: "nearest", behavior: "instant" });
    (thumb || returnFocusTo)?.focus({ preventScroll: true }); // put keyboard users back
    setState("");
    history.scrollRestoration = "auto";
  }

  // instant: no shrink effect (the browser already animated a back swipe).
  function closeNow(instant = false) {
    wantOpen = false;
    clearTimeout(addressTimer);
    if (!dialog.open) return cleanUp();
    // While the viewer still covers the page, bring the photo's place in the
    // grid into view, so it can shrink back into it.
    thumbFor(index)?.scrollIntoView({ block: "nearest", behavior: "instant" });
    morph("close", () => {
      if (wantOpen) return; // opened again meanwhile (a quick Forward)
      dialog.close();
      cleanUp();
    }, instant);
  }

  // × button, swipe down, Escape: go Back, which closes the viewer (popstate),
  // so the address bar and the Back button stay right.
  function close() {
    if (history.state?.lightbox) history.back();
    else closeNow();
  }

  window.addEventListener("popstate", (event) => {
    const wanted = Number(new URLSearchParams(location.search).get("photo")) - 1;
    if (history.state?.lightbox && photos[wanted]) {
      // Forward again onto a photo address: show that photo.
      if (wantOpen) show(wanted);
      else {
        index = wanted;
        show(wanted);
        wantOpen = true;
        history.scrollRestoration = "manual";
        showDialog(event.hasUAVisualTransition);
      }
    } else if (wantOpen) closeNow(event.hasUAVisualTransition);
  });
  // Escape: close the same way as the × button (with the shrink effect).
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  // The browser may still close the dialog itself (for example a second Escape).
  dialog.addEventListener("close", () => {
    if (wantOpen) {
      wantOpen = false;
      if (history.state?.lightbox) history.back();
    }
    cleanUp();
  });

  // ---------- Grow and shrink ----------
  // The picture in the grid and the picture in the viewer get the same
  // "view-transition-name" for a moment; the browser then animates one into the
  // other. update() makes the actual change (open or close the dialog).
  function morph(kind, update, instant = false) {
    const thumbImg = thumbFor(index)?.querySelector("img");
    const box = thumbImg?.getBoundingClientRect();
    const onScreen = box && box.bottom > 0 && box.top < innerHeight && box.width > 0;
    if (instant || !document.startViewTransition || lessMotion.matches || !onScreen) return update();
    const root = document.documentElement;
    const [from, to] = kind === "open" ? [thumbImg, img] : [img, thumbImg];
    root.classList.add("photo-transition");
    from.style.viewTransitionName = "photo";
    let transition;
    try {
      transition = document.startViewTransition(async () => {
        from.style.viewTransitionName = "";
        update();
        to.style.viewTransitionName = "photo";
        // Wait (briefly) for the picture to be ready, so it does not grow empty.
        if (kind === "open") await Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 150))]);
      });
    } catch {
      from.style.viewTransitionName = "";
      root.classList.remove("photo-transition");
      return update();
    }
    transition.finished.finally(() => {
      from.style.viewTransitionName = to.style.viewTransitionName = "";
      root.classList.remove("photo-transition");
    });
  }

  closeButton.addEventListener("click", close);
  prevButton.addEventListener("click", () => show(index - 1));
  nextButton.addEventListener("click", () => show(index + 1));

  dialog.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const to = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: photos.length - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    show(to);
  });

  // Tapping the dark area around the photo closes the viewer. With a mouse,
  // the dark space level with the photo, at its left and right, is where the
  // ‹ › buttons sit, and a click that just missed one used to close the
  // viewer: there it goes to the previous or next photo instead. The corners
  // and the space above and below the photo still close it.
  const mouse = window.matchMedia("(hover: hover) and (pointer: fine)");
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog && !event.target.classList.contains("lightbox-stage")) return;
    const photo = img.getBoundingClientRect();
    const levelWithPhoto = event.clientY >= photo.top && event.clientY <= photo.bottom;
    if (mouse.matches && photos.length > 1 && levelWithPhoto) {
      if (event.clientX < photo.left) return show(index - 1);
      if (event.clientX > photo.right) return show(index + 1);
    }
    close();
  });

  // ---------- Swipes ----------
  // While a finger moves sideways, the photo moves with it. Not with a mouse,
  // not while zoomed in, and not for visitors who asked for less motion.
  const fingers = new Set(); // pointers touching the screen now
  const zoomed = () => (window.visualViewport?.scale || 1) > 1.01;
  let start = null;

  // Zoomed in with two fingers: one finger then looks around the photo, like
  // anywhere else, instead of changing or closing it.
  window.visualViewport?.addEventListener("resize", () => {
    dialog.style.touchAction = zoomed() ? "auto" : "";
  });

  function release(event, instant) {
    fingers.delete(event.pointerId);
    img.style.transition = instant ? "none" : ""; // a short swipe springs back
    img.style.transform = "";
    if (instant) {
      void img.offsetWidth; // apply the jump now, before the spring-back is turned on again
      img.style.transition = "";
    }
  }

  dialog.addEventListener("pointerdown", (event) => {
    if (event.isPrimary) fingers.clear(); // the first finger of a new touch
    fingers.add(event.pointerId);
    // A second finger means a pinch, not a swipe.
    start = fingers.size === 1 ? { x: event.clientX, y: event.clientY } : null;
  });
  dialog.addEventListener("pointermove", (event) => {
    if (!start || event.pointerType === "mouse" || fingers.size !== 1 || zoomed() || lessMotion.matches) return;
    const dx = event.clientX - start.x;
    const sideways = Math.abs(dx) > Math.abs(event.clientY - start.y);
    img.style.transition = "none";
    img.style.transform = sideways ? `translateX(${dx}px)` : "";
  });
  dialog.addEventListener("pointercancel", (event) => {
    start = null;
    release(event, false);
  });
  dialog.addEventListener("pointerup", (event) => {
    if (!start || zoomed()) {
      start = null;
      release(event, false);
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
      release(event, true); // the next photo appears in the middle, not where the finger was
      show(dx < 0 ? index + 1 : index - 1); // finger moved left: next photo
    } else if (dy > SWIPE_DISTANCE * 2 && Math.abs(dy) > Math.abs(dx)) {
      release(event, true);
      close(); // swipe down
    } else {
      release(event, false);
    }
  });

  // Show or hide the Download button for the photo on screen (after a code was entered).
  function refresh() {
    if (dialog.open) show(index);
  }

  return { open, refresh };
}
