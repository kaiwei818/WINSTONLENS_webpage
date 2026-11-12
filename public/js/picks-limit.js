// How Instagram picks are split into posts.
//
// Instagram takes up to 20 photos in one post, and a post looks best when all
// its photos have the same shape. So picks are sorted into two groups,
// vertical and horizontal (square photos count as vertical), and each group
// fills up to two posts of 20, best rated first. That is room for 40 of each;
// picks past that wait on the picks page for another round. Nothing here ever
// stops you picking: the notes only say how full things are.

export const PER_POST = 20;
export const POSTS_PER_GROUP = 2;
export const PER_GROUP = PER_POST * POSTS_PER_GROUP; // 40
const NEAR = PER_GROUP - 3; // start mentioning it at 37

export const GROUPS = ["vertical", "horizontal"];
export const groupOf = (photo) => (photo.width > photo.height ? "horizontal" : "vertical");
const Name = (group) => group[0].toUpperCase() + group.slice(1);

// { vertical: 23, horizontal: 12 }
export function groupCounts(photos) {
  const counts = { vertical: 0, horizontal: 0 };
  for (const photo of photos) counts[groupOf(photo)]++;
  return counts;
}

// Best rated first, then in the order given (sets, then photos within them).
// Returns { posts: [[...20], [...20]], waiting: [...] }.
export function splitIntoPosts(photos) {
  const sorted = photos.map((p, i) => ({ p, i })).sort((a, b) => b.p.rating - a.p.rating || a.i - b.i).map(({ p }) => p);
  const posts = [];
  for (let i = 0; i < POSTS_PER_GROUP && i * PER_POST < sorted.length; i++) posts.push(sorted.slice(i * PER_POST, (i + 1) * PER_POST));
  return { posts, waiting: sorted.slice(PER_GROUP) };
}

// "Vertical picks: 23 of 40 (post 1 full, post 2 has 3)"
export function groupCountText(group, count) {
  if (count > PER_GROUP) return `${Name(group)} picks: ${count} (two posts take ${PER_GROUP})`;
  const detail = count < PER_POST ? `one post, ${count} of ${PER_POST}` : count === PER_POST ? "post 1 full" : `post 1 full, post 2 has ${count - PER_POST}`;
  return `${Name(group)} picks: ${count} of ${PER_GROUP} (${detail})`;
}

// null while there is room; otherwise { level, text }.
export function groupLimitNote(group, count) {
  const name = group; // "vertical" / "horizontal"
  if (count < NEAR) return null;
  if (count < PER_GROUP) {
    const left = PER_GROUP - count;
    return { level: "near", text: `${left} more ${name} ${left === 1 ? "pick fills" : "picks fill"} both ${name} posts.` };
  }
  if (count === PER_GROUP) {
    return { level: "full", text: `Both ${name} posts are full. You can keep picking: extras wait on the picks page for another round.` };
  }
  const extra = count - PER_GROUP;
  return { level: "over", text: `${extra} ${name} ${extra === 1 ? "pick doesn't" : "picks don't"} fit in two posts. ${extra === 1 ? "It waits" : "They wait"} on the picks page for another round, or unpick some.` };
}
