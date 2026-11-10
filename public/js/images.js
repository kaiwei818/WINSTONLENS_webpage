// Helpers for choosing image sizes.
//
// "srcset" lists the same picture in several sizes, each with its width in
// pixels ("800w"). "sizes" tells the browser how wide the picture will appear
// on screen. The browser multiplies that by the screen's pixel density and
// downloads the smallest file that is still sharp: a phone gets the 800 px file,
// a large Retina screen the 1200 px one. Photos uploaded before the phone sizes
// existed have no small/medium file, and simply use the one size they have.

export const img = (key) => `/img/${key}`;

// Width of a size whose LONG edge is `edge` pixels. A portrait photo's width is
// smaller than its long edge, and srcset needs the real width.
function widthAt(photo, edge) {
  return photo.width >= photo.height ? edge : Math.round((edge * photo.width) / photo.height);
}

// Grid pictures: small (800) and thumb (1200).
export function gridSrcset(photo, keys = photo) {
  if (!keys.small_key) return "";
  return `${img(keys.small_key)} ${widthAt(photo, 800)}w, ${img(keys.thumb_key)} ${widthAt(photo, 1200)}w`;
}

// Full-screen viewer: medium (2000) and display (3000), both watermarked.
export function viewerSrcset(photo) {
  if (!photo.medium_key) return "";
  return `${img(photo.medium_key)} ${widthAt(photo, 2000)}w, ${img(photo.display_key)} ${widthAt(photo, 3000)}w`;
}

// The home page hero: every size the photo has (small 800, thumb 1200,
// medium 2000, display 3000), so a phone gets a small file and only a large
// Retina screen the biggest. A file is never wider than the photo itself, and
// photos uploaded before the medium size existed simply skip it.
export function heroSrcset(photo, keys) {
  const longEdge = Math.max(photo.width, photo.height) || 0;
  const seen = new Set();
  return [[keys.small_key, 800], [keys.thumb_key, 1200], [keys.medium_key, 2000], [keys.display_key, 3000]]
    .filter(([key]) => key)
    .map(([key, edge]) => [key, widthAt(photo, longEdge ? Math.min(edge, longEdge) : edge)])
    .filter(([, width]) => width && !seen.has(width) && seen.add(width))
    .map(([key, width]) => `${img(key)} ${width}w`)
    .join(", ");
}
