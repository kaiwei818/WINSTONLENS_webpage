// Map places for sets: reading what you paste on the admin page, and what
// visitors may see. Shared by the admin page, the server and the tests.

const inRange = (lat, lng) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

// "51.41728° N, 116.23912° W", 51°25'02.2"N 116°14'20.8"W, "51.1784, -115.5708",
// or a Google Maps / Apple Maps link that has the numbers in it.
// Returns { lat, lng }, or null when there are none.
// (Short share links like maps.app.goo.gl hide the numbers: copy them instead.)
export function parsePlace(text) {
  const s = String(text ?? "").trim();
  const signed = (n, letter) => (/[SW]/i.test(letter) ? -n : n);
  // Degrees with N/S and E/W: 51.41728° N, 116.23912° W
  let match = /^(\d+(?:\.\d+)?)\s*°?\s*([NS])[\s,]+(\d+(?:\.\d+)?)\s*°?\s*([EW])$/i.exec(s);
  if (match) return checked(signed(Number(match[1]), match[2]), signed(Number(match[3]), match[4]));
  // Degrees, minutes, seconds: 51°25'02.2"N 116°14'20.8"W
  match = /^(\d+)°\s*(\d+)['′]\s*(\d+(?:\.\d+)?)["″]\s*([NS])[\s,]+(\d+)°\s*(\d+)['′]\s*(\d+(?:\.\d+)?)["″]\s*([EW])$/i.exec(s);
  if (match) {
    const dms = (d, m, sec) => Number(d) + Number(m) / 60 + Number(sec) / 3600;
    return checked(signed(dms(match[1], match[2], match[3]), match[4]), signed(dms(match[5], match[6], match[7]), match[8]));
  }
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // a Google Maps place: the place itself
    /[@=](-?\d+\.\d+),\s*(-?\d+\.\d+)/, // ...@51.17,-115.57,12z or ?q= / ?ll=
    /^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/, // the numbers on their own
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(s);
    if (!match) continue;
    return checked(Number(match[1]), Number(match[2]));
  }
  return null;
}

const checked = (lat, lng) => (inRange(lat, lng) ? { lat: round(lat, 6), lng: round(lng, 6) } : null);

// 51.41728, -116.23912 -> "51.41728° N, 116.23912° W": how the admin page shows a place.
export const formatPlace = (lat, lng) =>
  `${round(Math.abs(lat), 5)}° ${lat < 0 ? "S" : "N"}, ${round(Math.abs(lng), 5)}° ${lng < 0 ? "W" : "E"}`;

// What visitors are shown for a set: the spot (exact), a rough area rounded
// to 0.1 degree, about 10 km (region), or nothing (hidden, or no place yet).
export function publicPlace({ map_lat: lat, map_lng: lng, map_precision: precision }) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  if (precision === "exact") return { lat: round(lat, 4), lng: round(lng, 4), area: false };
  if (precision === "region") return { lat: round(lat, 1), lng: round(lng, 1), area: true };
  return null;
}

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;
