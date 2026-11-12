// Which set the big photo at the top of the home page (the "hero") shows.
// You choose the rule on the admin dashboard (setting "hero_mode"):
//
//   first    the first set in your list (move a set to the top to feature it)
//   latest   "Latest work": the set with the newest date (its Date box, or
//            the day you created it)
//   rotate   one of the sets you marked "Feature in the hero", changing every
//            visit or every day (setting "hero_rotate": "visit" or "day").
//            Seasonal highlights: a featured set can be limited to some months
//            ("3,4,5" = March to May). In its months it is preferred over
//            all-year featured sets. If no featured set is in season and none
//            is all-year, it rotates between all of them (public/js/hero-pick.js).
//
// Months and days follow Taiwan time (UTC+8).
// If no set is featured at all, the first set in the list is used.

import { localNow, rotationPool } from "../public/js/hero-pick.js";
import { getSettings } from "./settings.js";

export const HERO_KEYS = ["hero_mode", "hero_rotate"];

// sets: the public sets in home page order (from publishedSets).
// Returns { set, label } or null.
export async function pickHero(env, sets) {
  const withCover = sets.filter((s) => s.cover_thumb_key);
  if (!withCover.length) return null;
  const { hero_mode: mode, hero_rotate: rotate } = await getSettings(env, HERO_KEYS);

  if (mode === "latest") {
    const newest = [...withCover].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.id - a.id)[0];
    return { set: newest, label: "Latest work" };
  }

  if (mode === "rotate") {
    const { pool, reason } = rotationPool(withCover);
    if (pool.length) {
      const day = Math.floor(localNow().getTime() / 86400000);
      const index = rotate === "day" ? day % pool.length : Math.floor(Math.random() * pool.length);
      return { set: pool[index], label: reason === "in-season" ? "In season" : "Featured" };
    }
  }

  return { set: withCover[0], label: "Featured" };
}
