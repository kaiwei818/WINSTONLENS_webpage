// Player tags on photos: jersey numbers or names, used by the admin pages (to
// type them), the server (to clean them before saving) and the set page
// ("Find my photos"). One shared rule, so all three agree.

const MAX_TAGS = 20;
const MAX_LENGTH = 40;

// "12 7, #23, Lee Chen, lee chen" -> ["12", "7", "23", "Lee Chen"].
// Commas separate tags. A piece made only of numbers may use spaces instead
// ("12 7 23"), which is quickest to type while going through photos.
export function tagList(text) {
  const tags = [];
  for (const piece of String(text ?? "").split(/[,\n、，]/)) {
    const clean = piece.trim().replace(/\s+/g, " ");
    const parts = /^[#\d\s]+$/.test(clean) ? clean.split(" ") : [clean];
    for (const part of parts) {
      const tag = part.replace(/^#/, "").trim().slice(0, MAX_LENGTH);
      if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);
    }
  }
  return tags.slice(0, MAX_TAGS);
}

// The form saved in the database and shown in the admin box.
export const cleanTags = (text) => tagList(text).join(", ");

// Numbers first, in number order, then names A to Z: the order of the chips.
export function sortTags(tags) {
  const isNumber = (t) => /^\d+$/.test(t);
  return [...tags].sort((a, b) =>
    isNumber(a) && isNumber(b) ? a - b : isNumber(a) ? -1 : isNumber(b) ? 1 : a.localeCompare(b));
}

// "#12" for a number, the name as it is otherwise.
export const tagLabel = (tag) => (/^\d+$/.test(tag) ? `#${tag}` : tag);
