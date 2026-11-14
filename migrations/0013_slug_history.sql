-- Old addresses of renamed sets.
-- When you change a set's address (slug) from "kyoto" to "kyoto-autumn", the
-- old one is remembered here, so /sets/kyoto sends visitors (and Google, and
-- every link already shared) on to /sets/kyoto-autumn instead of "not found".
-- A set that uses the address now always wins: if a new set takes "kyoto",
-- the old note is removed and /sets/kyoto shows the new set.

CREATE TABLE slug_history (
  slug       TEXT PRIMARY KEY,                                        -- the old address
  set_id     INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,  -- where it leads now
  changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_slug_history_set ON slug_history(set_id);
