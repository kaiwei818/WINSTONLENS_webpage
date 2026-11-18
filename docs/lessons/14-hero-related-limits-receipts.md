# Lesson 14: Hero choices, related sets, rate limits, and download receipts

This lesson adds four things:

1. **Hero choices**: the big home page photo can show your first set, your
   latest work, or rotate between featured sets, with seasonal highlights.
2. **Related sets** at the bottom of each set page.
3. **Rate limits** on license codes and downloads, against guessing and bulk downloading.
4. **Download receipts**: a record of every licensed download, with an optional email.

Run `npm run db:migrate:remote` before deploying (see the end).

---

## Part A: Hero choices

On the admin dashboard, **Home page hero** has three choices:

| Choice | The hero shows |
|--------|----------------|
| The first set in your Sets list | As before: drag a set to the top to feature it |
| Latest work | The set with the newest date (its Date box, or the day you created it). The label says "Latest work" |
| Rotate between featured sets | One of the sets you marked as featured, changing **on every visit** or **once a day** |

To feature a set, open its admin page and, under **Home page hero**, tick
**Feature this set when the hero rotates**.

**Seasonal highlights:** on a featured set, tick months, for example March and
April for cherry blossoms. In those months the set is preferred over all-year
featured sets, and the hero label says "In season". In other months it is not
shown. A featured set with no months ticked can appear all year.

Months and days follow Taiwan time (UTC+8). To change that, edit
`TIME_ZONE_HOURS` in `lib/hero.js`.

If no set fits the rule (for example, nothing is featured yet), the first set is used.

## Part B: Related sets

At the bottom of each set page, up to 4 other sets with something in common
appear, each with the reason:

| In common | Points | Shown as |
|-----------|--------|----------|
| A category | 3 each | "Also Landscape" |
| The same location | 4 | "Also in Kyoto" |
| The same country (last part of the location) | 1 | "Also in Japan" |
| Dates close together (both sets need a Date) | 3, 2, or 1 | "Around the same time", "The same year" |
| The same camera | 2 | "Also shot with Sony A7 IV" |

The sets with the most points are shown. A set with nothing in common with any
other shows no "Related sets" section.

**New: Location.** Each set's admin page has a **Location** box ("Kyoto,
Japan"). It shows under the set's title and on its home page card, and is used
for related sets. Write the country last, after a comma, so sets in the same
country match.

The lens is not used: the camera details saved with each photo only name the
camera body. The code is in `lib/related.js`.

## Part C: Rate limits

A license code is 8 random characters, about 850 billion possibilities, so
guessing one is already hopeless. These limits make it even more so, and also
stop a leaked code from being used to download everything at once
(`lib/ratelimit.js` and `lib/license.js`):

| What | Limit | Then |
|------|-------|------|
| Wrong codes from one address | 10 per 15 minutes | That address waits 15 minutes |
| Code checks from one address (right or wrong) | 30 per 15 minutes | That address waits |
| Wrong codes from everywhere together | 300 per hour | Code checking pauses for everyone for a while (stops many computers guessing at once) |
| Downloads from one address | 200 per hour | That address waits |
| Downloads with one code (from all addresses) | 300 per hour | That code waits |

The visitor sees a polite "please wait" message. The answer carries the
standard `Retry-After` header, which says how many seconds to wait. The moment
a limit is reached, it is written once to the activity log (the new
**Security** filter). The address itself is only kept for the length of the
time window, then deleted.

The limits are generous enough for normal use: a "Download all" of 60 photos
fits easily. To change them, edit `LIMITS` in `lib/ratelimit.js`.

## Part D: Download receipts

Every clean file downloaded with a code gets a receipt. Open **License codes,
See download receipts** (`/admin/receipts`). Each line has:

- when (in your time zone)
- the code and its label ("WL-7K3F-Q9XM (Jane)")
- the set and photo (with the original file name), and whether it was part of Download all
- roughly where from: city, region, postal area and country, which Cloudflare
  works out from the visitor's internet connection. The IP address itself is
  never stored.
- their network ("TELUS Communications"; a data center or cloud company often
  means a script or a shared code) and device ("iPhone, Safari"), plus their
  time zone, so the email can show the time on their clock

You can show one code at a time, and **Export as spreadsheet (.csv)** opens in
Excel, Numbers, or Google Sheets.

Receipts copy the titles and names in, so they still make sense after you
delete the set, photo, or code. The download count also appears in the
activity log, now with the place.

### Optional: an email for downloads

If you also want an email, it comes from `receipts@winstonlens.com` through
Cloudflare Email, free, because your domain already uses Cloudflare Email
Routing:

1. In Cloudflare, **Email → Email Routing → Destination addresses**: check
   that the address you want the emails at is listed as **Verified**.
   (Sending to a verified destination is free on every plan.)
2. **My Profile → API Tokens → Create Token → Custom token**: give it the
   account permission for **Email Sending** (Edit or Send), for your account
   only. Copy the token.
3. Store two secrets on Cloudflare:
   ```
   npx wrangler pages secret put EMAIL_API_TOKEN
   npx wrangler pages secret put RECEIPT_EMAIL
   ```
   (the token, then the verified address). Your account id is already in
   `wrangler.toml` (`CLOUDFLARE_ACCOUNT_ID`).
4. Deploy again.

### Optional: a daily update

Every morning (15:00 UTC, 8 am in Alberta in winter) you also get one email
about the last 24 hours: downloads by set and code, refused downloads, new
likes by set, license codes, uploads, publishing, and logins (failed logins
show in the subject). A GitHub Action asks the site to send it, with a shared
secret. Set it on both sides with one line (it never shows the value):

```
S=$(openssl rand -hex 32); printf %s "$S" | npx wrangler pages secret put REPORT_SECRET --project-name winstonlens; printf %s "$S" | gh secret set REPORT_SECRET
```

Change the time in `.github/workflows/daily-report.yml`; **Run workflow** on
the GitHub Actions tab sends one right away.

Downloads are **grouped**: one email per batch, not one per photo. Each
download waits 25 seconds; if no other download with the same code follows,
one email goes out listing every photo since the last email: the code, set,
place, and time of each. A Download all of 60 photos is one email. (On a very
slow connection, where one photo takes longer than 25 seconds, it may arrive
as a few emails; every photo is still listed exactly once.) If the email ever
fails, the download still works, the receipt is still saved, and those photos
go in the next email for that code.

## Deploy

```
cd ~/project-0
git pull
npm run db:migrate:remote
npm run deploy
```
