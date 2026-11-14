// Is this visitor's connection slow? The photo viewer asks, to decide whether
// to load the full 3000 px file at once or stay with the 1200 px one for a
// while (see "Slow connections" in lightbox.js).
//
// No test file is downloaded. The answer comes from three things the browser
// already knows, the best one first:
//
//   1. What the visitor asked for: "data saver" switched on, or a connection
//      the browser itself calls 2g or 3g (Chrome, Edge and Android only).
//   2. How long the full-size photos opened so far really took (remembered
//      for this tab, so it carries from one set to the next).
//   3. How fast this page's grid photos arrived. Small files travel slower
//      than a connection's real speed (every download starts gently), so this
//      guess is doubled to be fair, and a full-size measurement replaces it
//      as soon as there is one.
//
// When nothing can be measured (everything came from the browser's saved
// copies, or the browser shares no timings), the answer is "not slow": the
// viewer then behaves as it always did.

// A visitor should not wait longer than this for a full-size photo...
export const WAIT_LIMIT_SECONDS = 2.5;
// ...and a full-size photo is about this big (the limit is 1.85 MB, see
// image-worker.js).
const TYPICAL_FULL_BYTES = 1.5 * 1024 * 1024;

const STORE = "viewer-speeds";  // sessionStorage: speeds of the last full-size photos
const KEEP = 5;
const MIN_BYTES = 30 * 1024;    // smaller files say more about delay than speed

// The middle value: one odd photo (a stall, a tiny file) does not decide it.
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Kilobits per second from the browser's own records of downloads ("resource
// timing"), or 0 when there is nothing usable. Files that came from the
// browser's saved copies (transferSize 0) are skipped: they took no time.
// whole: count the whole wait including the first reply (full-size photos);
// otherwise only the time the bytes were arriving (small grid photos).
export function kbpsFromEntries(entries, { whole = false } = {}) {
  const speeds = [];
  for (const entry of entries) {
    const bytes = entry.encodedBodySize || 0;
    const ms = whole ? entry.duration : entry.responseEnd - entry.responseStart;
    if (!entry.transferSize || bytes < MIN_BYTES || !(ms > 5)) continue;
    speeds.push((bytes * 8) / ms); // bits per millisecond = kilobits per second
  }
  return speeds.length ? median(speeds) : 0;
}

// The decision itself, apart from the browser, so it can be tested.
//   saveData, effectiveType   from navigator.connection (may be missing)
//   fullKbps                  measured on full-size photos (0 = none yet)
//   gridKbps                  measured on grid photos (0 = none)
// Returns { slow, reason }.
export function judge({ saveData = false, effectiveType = "", fullKbps = 0, gridKbps = 0 }) {
  if (saveData) return { slow: true, reason: "data-saver" };
  if (/(^|-)2g$|^3g$/.test(effectiveType)) return { slow: true, reason: "connection-type" };
  const kbps = fullKbps || gridKbps * 2;
  if (!kbps) return { slow: false, reason: "unknown" };
  const seconds = (TYPICAL_FULL_BYTES * 8) / 1000 / kbps;
  return { slow: seconds > WAIT_LIMIT_SECONDS, reason: fullKbps ? "measured" : "estimated" };
}

function remembered() {
  try {
    const speeds = JSON.parse(sessionStorage.getItem(STORE) || "[]");
    return Array.isArray(speeds) ? speeds.filter((n) => typeof n === "number" && n > 0) : [];
  } catch {
    return [];
  }
}

// Called by the viewer after a full-size photo arrived: note how fast it came.
export function noteFullLoad(url) {
  try {
    const kbps = kbpsFromEntries(performance.getEntriesByName(url).slice(-1), { whole: true });
    if (!kbps) return;
    sessionStorage.setItem(STORE, JSON.stringify([...remembered(), Math.round(kbps)].slice(-KEEP)));
  } catch {} // private browsing, or no timings: nothing is remembered
}

// Asked by the viewer every time a photo is shown.
export function connection() {
  const info = navigator.connection || {};
  let gridKbps = 0;
  try {
    const grid = performance.getEntriesByType("resource").filter((e) => new URL(e.name).pathname.startsWith("/img/"));
    gridKbps = kbpsFromEntries(grid);
  } catch {}
  const full = remembered();
  return judge({
    saveData: Boolean(info.saveData),
    effectiveType: info.effectiveType || "",
    fullKbps: full.length ? median(full) : 0,
    gridKbps,
  });
}
