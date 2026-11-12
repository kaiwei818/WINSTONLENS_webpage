// Instagram takes up to 20 photos in one post. These say how close your
// picks are to that, shown beside the pick buttons. They only inform: you can
// always pick more and post the rest yourself as another post.

export const MAX_PER_POST = 20;
const NEAR = MAX_PER_POST - 3; // start mentioning it at 17

export function picksCountText(total) {
  return total > MAX_PER_POST
    ? `Instagram picks: ${total} (one post takes ${MAX_PER_POST})`
    : `Instagram picks: ${total} of ${MAX_PER_POST} for one post`;
}

// null while there is plenty of room; otherwise { level, text }.
export function picksLimitNote(total) {
  if (total < NEAR) return null;
  if (total < MAX_PER_POST) {
    const left = MAX_PER_POST - total;
    return { level: "near", text: `${left} more ${left === 1 ? "pick fills" : "picks fill"} one post.` };
  }
  if (total === MAX_PER_POST) {
    return { level: "full", text: "That fills one post. You can keep picking and post the rest yourself as a second post." };
  }
  return { level: "over", text: `More than one post holds. Keep picking if you like, and post them in batches of up to ${MAX_PER_POST}.` };
}
