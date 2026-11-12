-- Your own rating of each photo (1 to 5 stars; 0 means not rated yet) and a
-- flag for photos you want to post on Instagram. Both are only for you: they
-- are set and seen in the admin pages, never on the public site.
ALTER TABLE photos ADD COLUMN rating INTEGER NOT NULL DEFAULT 0;
ALTER TABLE photos ADD COLUMN instagram INTEGER NOT NULL DEFAULT 0;

-- Makes "every photo flagged for Instagram" fast on the Instagram picks page.
CREATE INDEX idx_photos_instagram ON photos(instagram) WHERE instagram = 1;
