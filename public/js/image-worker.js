// Shrinks one photo. This file runs as a "Web Worker": a background thread, so
// the heavy work (decoding a 25 MB file, resizing 24 million pixels) does not
// freeze the page. The page sends a file in, and this sends three small files back.
//
// Output for each photo:
//   small    800 px on the long edge   (grids on phones)
//   thumb   1200 px on the long edge   (grids on computers, home page cards)
//   display 3000 px on the long edge   (the full-screen viewer, on every screen)
//   download 3000 px JPEG, NO watermark, only if you ticked "clean copy"; kept
//            private and given out only with a license code. With "high
//            resolution" also ticked: the photo's own size, up to 6000 px, at
//            a higher quality (limits in clean-copy.js)
//   placeholder  an 8 px color grid for the blurry preview, as text (js/placeholder.js)
// Every public size gets the watermark, in the style you picked:
//   full   repeated diagonally across the whole photo (strong on the viewer
//          size, lighter on the grid sizes)
//   small  one line in the bottom-right corner
//
// ---------- Storage limit ----------
// Each size has a maximum file size (maxBytes). The photo is first saved at the
// normal quality; if the file is too big (very detailed photos), it is saved
// again at the next lower quality, and so on. All sizes are saved as JPEG (see
// encode() at the end).
// If even the lowest quality is too big, the display size is made a little
// smaller (2400 px). Most photos fit at the first try.
//
// With these limits one photo uses at most about 2.5 MB online, so a set of 60
// photos stays under about 150 MB. (A private clean copy, if you keep one, adds
// about 2 to 4 MB per photo on top.)
//
// There is no separate phone-sized viewer file any more: phones load the same
// 3000 px file as computers. That is slower on phones, but saves storage.
// To change the limits, edit the values below. Only photos uploaded afterwards change.
//
// Drawing onto a canvas and saving it creates a brand new file, so ALL of the
// original's hidden data (EXIF: GPS location, camera serial number) is left behind.
// Before that, we read just the camera details we want to show (exif.js).

import { HIRES } from "./clean-copy.js";
import { readCameraInfo } from "./exif.js";
import { makePlaceholder } from "./placeholder.js";
import { drawWatermark } from "./watermark.js";

const MB = 1024 * 1024;
const SIZES = {
  small: { edge: 800, qualities: [0.8, 0.72, 0.64], maxBytes: 0.2 * MB, watermark: "light" },
  thumb: { edge: 1200, qualities: [0.82, 0.74, 0.66], maxBytes: 0.45 * MB, watermark: "light" },
  display: {
    edge: 3000, qualities: [0.88, 0.82, 0.76, 0.7], maxBytes: 1.85 * MB, watermark: "strong",
    // Last resort for photos still too big at the lowest quality:
    fallback: { edge: 2400, qualities: [0.8, 0.72] },
  },
};

self.onmessage = async (event) => {
  const { id, file, watermark, watermarkStyle = "full", keepClean, hiRes } = event.data;
  try {
    const [images, cameraInfo] = await Promise.all([
      processPhoto(file, watermark, watermarkStyle, keepClean, hiRes),
      readCameraInfo(file),
    ]);
    self.postMessage({ id, ...images, cameraInfo });
  } catch (err) {
    // Usually the browser ran out of memory for images (Safari has a strict
    // limit), or the file is damaged. The upload page retries it once by itself.
    self.postMessage({ id, error: `Could not process this photo (${err.message || err}).` });
  }
};

// keepClean: also make a private, clean 3000 px JPEG ("download"), for
// visitors with a license code. It is saved BEFORE any watermark is drawn.
// hiRes: make that copy from the original at up to 6000 px instead (below).
async function processPhoto(file, watermark, watermarkStyle, keepClean, hiRes) {
  // "from-image" applies the camera's rotation flag, so portrait shots stand upright.
  const original = await createImageBitmap(file, { imageOrientation: "from-image" });
  const canvases = {};
  try {
    // Each size is made from the next bigger one: much faster than starting
    // from the 6000 px original every time. All are still clean at this point.
    canvases.display = shrink(original, SIZES.display.edge);

    const blobs = {};
    // The high-resolution clean copy has to come from the original, so it is
    // made now, before the original is let go. Only when the original is
    // really bigger than the normal 3000 px copy. If the browser cannot do it
    // (phones and Safari run out of image memory on very large photos), the
    // normal clean copy is made further down instead.
    let cleanSize = null;
    if (keepClean && hiRes && Math.max(original.width, original.height) > SIZES.display.edge) {
      try {
        ({ blob: blobs.download, ...cleanSize } = await encodeHiRes(original));
      } catch {
        delete blobs.download;
        cleanSize = null;
      }
    }
    original.close(); // free the ~100 MB of decoded pixels as early as possible
    canvases.thumb = shrink(canvases.display, SIZES.thumb.edge);
    canvases.small = shrink(canvases.thumb, SIZES.small.edge);

    // Made before the watermark: at 8 px it would only be a smudge anyway.
    const placeholder = await makePlaceholder(canvases.small, canvases.small.width, canvases.small.height).catch(() => "");

    // JPEG for the download: every program can open it. High quality, since
    // this is the copy people license.
    if (keepClean && !blobs.download) {
      blobs.download = await canvases.display.convertToBlob({ type: "image/jpeg", quality: 0.92 });
      cleanSize = { width: canvases.display.width, height: canvases.display.height };
    }

    // Now mark every public size.
    for (const [name, size] of Object.entries(SIZES)) {
      drawWatermark(canvases[name], watermark, watermarkStyle, size.watermark);
    }

    // One at a time keeps less memory in use than all at once.
    for (const name of ["small", "thumb"]) {
      blobs[name] = await encodeWithin(canvases[name], SIZES[name]);
      release(canvases[name]); // done with this size
    }
    blobs.display = await encodeWithin(canvases.display, SIZES.display);
    // The display file may have been made smaller to fit; report its real size.
    let { width, height } = canvases.display;
    if (blobs.display.fallback) {
      ({ width, height } = blobs.display.fallback);
      blobs.display = blobs.display.blob;
    }
    // cleanSize: the clean copy's size in pixels. cleanHiRes: it is the
    // high-resolution kind (counts toward the set's storage limit).
    const cleanHiRes = Boolean(cleanSize) && Math.max(cleanSize.width, cleanSize.height) > SIZES.display.edge;
    return { ...blobs, width, height, placeholder, cleanSize, cleanHiRes };
  } finally {
    original.close(); // safe to call twice
    Object.values(canvases).forEach(release);
  }
}

// Saves the canvas at the first quality whose file fits within maxBytes.
// For the display size, if nothing fits, also tries the smaller fallback size,
// and then returns { blob, fallback: { width, height } }.
async function encodeWithin(canvas, size) {
  let blob;
  for (const quality of size.qualities) {
    blob = await encode(canvas, quality);
    if (blob.size <= size.maxBytes) return blob;
  }
  if (!size.fallback) return blob; // the smallest we tried: still fine to use

  const smaller = shrink(canvas, size.fallback.edge); // the watermark shrinks along with it
  try {
    for (const quality of size.fallback.qualities) {
      blob = await encode(smaller, quality);
      if (blob.size <= size.maxBytes) break;
    }
    return { blob, fallback: { width: smaller.width, height: smaller.height } };
  } finally {
    release(smaller);
  }
}

// The high-resolution clean copy: the original at its own size (6000 px at
// most), saved at the first quality whose file fits within HIRES.maxBytes;
// if none fits, a little smaller. Returns { blob, width, height }.
async function encodeHiRes(original) {
  const attempts = [HIRES, HIRES.fallback];
  for (const { edge, qualities } of attempts) {
    const canvas = fit(original, edge);
    try {
      for (const quality of qualities) {
        const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
        if (blob.size <= HIRES.maxBytes) return { blob, width: canvas.width, height: canvas.height };
      }
    } finally {
      release(canvas);
    }
  }
  // Still too big: the server would refuse it, so fall back to the normal copy.
  throw new Error("too large");
}

// The source at its own size, or scaled down so its long edge is `edge`.
// One step is enough here: at most a small reduction, never below half.
function fit(source, edge) {
  const scale = Math.min(1, edge / Math.max(source.width, source.height));
  return draw(source, Math.round(source.width * scale), Math.round(source.height * scale));
}

// A canvas keeps its pixels in memory until the browser gets around to cleaning
// up, which Safari does slowly. Shrinking it to 0 x 0 frees the memory at once.
// Without this, Safari ran out of image memory after a few large photos.
function release(canvas) {
  if (canvas) canvas.width = canvas.height = 0;
}

// Shrinking 6000 px straight down to 500 px skips most pixels and looks jagged.
// Halving step by step averages them properly, like a good photo editor does.
function shrink(source, longEdge) {
  const scale = Math.min(1, longEdge / Math.max(source.width, source.height));
  const targetWidth = Math.round(source.width * scale);
  const targetHeight = Math.round(source.height * scale);

  let current = source;
  while (current.width / 2 >= targetWidth) {
    const smaller = draw(current, Math.round(current.width / 2), Math.round(current.height / 2));
    if (current !== source) release(current); // the in-between step is no longer needed
    current = smaller;
  }
  const result = draw(current, targetWidth, targetHeight);
  if (current !== source) release(current);
  return result;
}

function draw(source, width, height) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

// Every browser saves JPEG. Chrome could make WebP files about 30% smaller,
// but at the same quality setting its WebP smooths away fine detail (grain,
// leaves, water), so photos uploaded from Chrome looked softer than the same
// photos from Safari (which can only save JPEG). JPEG everywhere gives the same
// result whichever browser you upload from.
function encode(canvas, quality) {
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}
