// Jersey numbers on photos, used by the admin pages (to type them), the
// server (to clean them before saving) and the set page (the number search).
// One shared rule, so all three agree.

const MAX_TAGS = 20;

// The category whose sets get jersey numbers (its address name, as in
// /?category=sports). Only its sets show the number boxes on the admin pages,
// and its page searches all of them at once.
export const SPORTS = "sports";

// "12 7, #23 12" -> ["12", "7", "23"]. Any non-digit separates numbers.
// "0" and "00" stay different: both are real jersey numbers.
export function tagList(text) {
  return [...new Set(String(text ?? "").match(/\d{1,3}/g) || [])].slice(0, MAX_TAGS);
}

// The form saved in the database and shown in the admin box.
export const cleanTags = (text) => tagList(text).join(", ");

// In number order, for the search suggestions.
export const sortTags = (tags) => [...tags].sort((a, b) => a - b || a.localeCompare(b));
