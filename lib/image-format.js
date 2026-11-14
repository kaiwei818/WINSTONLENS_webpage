// Which image format a file really is, from its first bytes.
//
// Every image format starts with a few fixed "magic" bytes. Checking them is
// more reliable than trusting the file name or the type the browser claims.
// Used by both upload endpoints (set photos and the About portrait).

const text = (bytes, from, to) => String.fromCharCode(...bytes.slice(from, to));

const FORMATS = [
  { type: "image/jpeg", ext: "jpg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: "image/webp", ext: "webp", matches: (b) => text(b, 0, 4) === "RIFF" && text(b, 8, 12) === "WEBP" },
];

// bytes: the file's ArrayBuffer. Returns { type, ext } (JPEG, PNG or WebP), or null.
export function imageFormat(bytes) {
  const start = new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength));
  const format = FORMATS.find((f) => f.matches(start));
  return format ? { type: format.type, ext: format.ext } : null;
}
