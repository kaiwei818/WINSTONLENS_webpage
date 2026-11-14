# Lesson 20: Renamed sets keep their old links, and other fixes from a code review

The whole site was read through and run on a test copy. Nothing was broken or
unsafe, but six small things were worth fixing.

## Renamed sets keep their old links

Changing a set's address (the "slug" box on its admin page) used to break
every link to the old one: links you had shared, and Google's results.

Now the old address is remembered (`slug_history` table, `migrations/0013`),
and `/sets/kyoto` sends visitors on to `/sets/kyoto-autumn` with a "moved
permanently" (301) redirect, the same kind lesson 8 uses for the old domain.
A link to one photo (`?photo=3`) still opens that photo.

- **A set that uses the address now always wins.** If you later make a new
  set at `/sets/kyoto`, that address shows the new set, and the old note is
  dropped.
- Rename a set back and its first address simply works again.
- An old address of a **draft** stays "not found" for visitors, so it never
  reveals a set only you can see.
- Deleting a set forgets its old addresses too.

## Sharper covers on the home page

The page tells the browser how wide each cover appears, so it can pick the
smallest file that is still sharp (lesson 7). That hint still described the
old layout, three equal cards of 460 px. In today's layout cards are 437 to
1344 px wide, so large screens were sometimes given a file that was too small
and looked soft.

`cardSizes()` in `lib/render.js` now works out each card's real width from its
place in the grid. A card as wide as the whole page (the last card of some
layouts) may also use the large viewer file on sharp screens; every other card
keeps to the two small files, so the home page stays light.

**If you change `.set-grid` in `style.css`, change `cardSizes()` too.** A
comment in both places says so, and `npm test` checks the widths.

## Addresses with nothing behind them say "not found"

- `/set` (the empty frame that set pages are built from) showed a blank page.
- `/?category=...` with a category that does not exist showed an empty list.

Both now show the 404 page with the real "not found" status, so Google does
not file them as thin pages ("Soft 404", lesson 9).

## Rate limits that hold under a burst

The limits on license checks and downloads (lesson 14) counted first and
recorded after. Many requests arriving at the same moment could each see "not
at the limit yet" and all pass. They now record first and count after, in one
database step, the way the login limit always did. A refused request's record
is removed again, so being refused does not make anyone wait longer.

## Housekeeping

- `wrangler` (Cloudflare's tool) updated from 4.148.0 to 4.162.0, which clears
  the warnings `npm audit` showed. It only runs on your Mac, never on the site.
- The README no longer mentions the old `photo-portfolio` name.
- `npm test` now also checks the rate limits and the cover widths (12 checks).

## Deploy

This one has a database step (the table of old addresses):

```
cd ~/project-0
git pull
npm install
npm run db:migrate:remote
npm run deploy
```

Run the database step **before** deploying: the new code looks in that table
whenever someone opens a set address that does not exist.
