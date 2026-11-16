// Map places for sets: reading what you paste on the admin page, and what
// visitors may see. Shared by the admin page, the server and the tests.

const inRange = (lat, lng) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

// "51.1784, -115.5708", or a Google Maps / Apple Maps link that has the
// numbers in it. Returns { lat, lng }, or null when there are none.
// (Short share links like maps.app.goo.gl hide the numbers: copy them instead.)
export function parsePlace(text) {
  const s = String(text ?? "").trim();
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // a Google Maps place: the place itself
    /[@=](-?\d+\.\d+),\s*(-?\d+\.\d+)/, // ...@51.17,-115.57,12z or ?q= / ?ll=
    /^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/, // the numbers on their own
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(s);
    if (!match) continue;
    const [lat, lng] = [Number(match[1]), Number(match[2])];
    return inRange(lat, lng) ? { lat, lng } : null;
  }
  return null;
}

// What visitors are shown for a set: the spot (exact), a rough area rounded
// to 0.1 degree, about 10 km (region), or nothing (hidden, or no place yet).
export function publicPlace({ map_lat: lat, map_lng: lng, map_precision: precision }) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  if (precision === "exact") return { lat: round(lat, 4), lng: round(lng, 4), area: false };
  if (precision === "region") return { lat: round(lat, 1), lng: round(lng, 1), area: true };
  return null;
}

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;
