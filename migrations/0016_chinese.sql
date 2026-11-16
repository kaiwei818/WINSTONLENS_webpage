-- 繁體中文 versions of your own words, for visitors who read the site in
-- Chinese (lib/i18n.js). Empty means "show the English": nothing has to be
-- filled in. The About bio's Chinese version is a setting (about_bio_zh).
ALTER TABLE sets ADD COLUMN title_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE sets ADD COLUMN description_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN name_zh TEXT NOT NULL DEFAULT '';
