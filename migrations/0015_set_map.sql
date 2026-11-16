-- Where each set was taken, for the map page (/map). You place it on the
-- set's admin page. map_precision decides what visitors see:
--   exact   a pin at this spot (Banff, Keelung, Elephant Mountain)
--   region  only a rough area, about 10 km across, never the spot itself
--   hidden  not on the map at all (the default; right for wildlife sets,
--           so nest and perch locations are never shown)
-- The exact numbers stay in the database; region sets are rounded before
-- they leave the server (functions/map.js).
ALTER TABLE sets ADD COLUMN map_lat REAL;
ALTER TABLE sets ADD COLUMN map_lng REAL;
ALTER TABLE sets ADD COLUMN map_precision TEXT NOT NULL DEFAULT 'hidden'
  CHECK (map_precision IN ('exact', 'region', 'hidden'));
