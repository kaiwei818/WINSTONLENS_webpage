-- More about each licensed download (lib/receipts.js), all worked out by
-- Cloudflare or the browser; the IP address itself is still never kept.
ALTER TABLE download_receipts ADD COLUMN network TEXT NOT NULL DEFAULT '';     -- "TELUS Communications"
ALTER TABLE download_receipts ADD COLUMN postal_code TEXT NOT NULL DEFAULT ''; -- "T2P", often approximate
ALTER TABLE download_receipts ADD COLUMN time_zone TEXT NOT NULL DEFAULT '';   -- "America/Edmonton"
ALTER TABLE download_receipts ADD COLUMN device TEXT NOT NULL DEFAULT '';      -- "iPhone, Safari"
