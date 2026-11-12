// The "Rotate between featured sets" rule for the home page hero, shared by
// the server (lib/hero.js picks the set) and the admin dashboard (which says
// what the rule does this month), so the two always agree.
//
// A featured set can be limited to some months ("10" = October only). In its
// months it is preferred over all-year featured sets. When no featured set is
// in season and none is all-year, the hero rotates between all featured sets
// rather than falling back to the first set in the list.
//
// Months follow Taiwan time (UTC+8).

export const TIME_ZONE_HOURS = 8;
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

// Taiwan's date now, as a Date whose UTC fields are Taiwan's.
export const localNow = (now = Date.now()) => new Date(now + TIME_ZONE_HOURS * 3600 * 1000);

const monthsOf = (set) => String(set.feature_months || "").split(",").filter(Boolean).map(Number);

// sets: the public sets with a cover. Returns
// { pool, reason: "in-season" | "all-year" | "out-of-season" | "none", month }.
export function rotationPool(sets, now = Date.now()) {
  const month = localNow(now).getUTCMonth() + 1;
  const featured = sets.filter((s) => s.featured);
  const inSeason = featured.filter((s) => monthsOf(s).includes(month));
  if (inSeason.length) return { pool: inSeason, reason: "in-season", month };
  const allYear = featured.filter((s) => monthsOf(s).length === 0);
  if (allYear.length) return { pool: allYear, reason: "all-year", month };
  if (featured.length) return { pool: featured, reason: "out-of-season", month };
  return { pool: [], reason: "none", month };
}
