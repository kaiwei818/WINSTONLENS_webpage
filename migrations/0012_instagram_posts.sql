-- A record of each Instagram post you made from your picks: which set, the
-- vertical or horizontal group, when, an optional link to the post and a
-- short note, and which photos were in it (in order). Admin only.
-- Nothing existing is changed or removed.
CREATE TABLE instagram_posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id      INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  orientation TEXT NOT NULL CHECK (orientation IN ('vertical', 'horizontal')),
  url         TEXT NOT NULL DEFAULT '',      -- https://www.instagram.com/p/... (optional)
  note        TEXT NOT NULL DEFAULT '',
  posted_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_instagram_posts_set ON instagram_posts(set_id, posted_at);

CREATE TABLE instagram_post_photos (
  post_id  INTEGER NOT NULL REFERENCES instagram_posts(id) ON DELETE CASCADE,
  photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, photo_id)
);
CREATE INDEX idx_instagram_post_photos_photo ON instagram_post_photos(photo_id);
