-- Download receipt emails are grouped (lib/receipts.js): one email lists every
-- download of a code not yet emailed. 1 = emailed (or email not set up), so
-- receipts from before this change never show up in an email.
ALTER TABLE download_receipts ADD COLUMN emailed INTEGER NOT NULL DEFAULT 1;
