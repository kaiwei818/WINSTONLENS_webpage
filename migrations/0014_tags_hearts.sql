-- Who is in each photo, and which photos visitors like.
--
-- tags: the jersey numbers in the photo, as typed on the admin pages and
-- cleaned up by public/js/tags.js ("12, 7"). Visitors search a set by them
-- ("Find my photos" on the set page).
ALTER TABLE photos ADD COLUMN tags TEXT NOT NULL DEFAULT '';

-- One row per visitor per photo they hearted. "visitor" is a random id their
-- browser made up and keeps; it says nothing about who they are.
CREATE TABLE photo_hearts (
  photo_id   INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  visitor    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (photo_id, visitor)
);
