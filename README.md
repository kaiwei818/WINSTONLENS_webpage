# winstonlens

Winston Chang's photography portfolio. It runs on Cloudflare's free tier:

- **Public gallery:** a hero photo (first set, latest work, or rotating featured
  and seasonal sets), large cover cards (title, date, location, photo count),
  related sets under each set, sets (albums) of photos, a full-screen viewer with swipe and
  keyboard controls and camera details, a light / dark switch, category filters, an About page, link
  previews and share buttons (copy link, LINE, Facebook, X, WhatsApp, email, or
  the phone's share sheet), and grid images sized for each screen. Visitors with a license code you gave them can download clean copies.
- **Private admin area** at `/admin`: create sets as private drafts, publish now or
  at a scheduled time,
  rename, reorder, and delete them;
  upload photos (shrunk and watermarked in your browser, full or small style, so originals
  never leave your computer), optionally with a private clean copy for downloads;
  create license codes and categories; get warned about duplicate photos;
  see an activity log of uploads, deletions, license codes, and downloads, and a
  receipt for every licensed download (optionally by email); license checks and
  downloads are rate limited; a watermark toolkit that marks full-size
  originals on your computer without uploading them; reorder photos, choose covers, and write captions and
  descriptions; watch your storage use, overall and per set.

The original plan is in [photo-portfolio-spec.md](photo-portfolio-spec.md).

## Learning guide

1. [How the site works, and running it on your Mac](docs/lessons/01-setup-and-gallery.md)
2. [The admin login](docs/lessons/02-admin-login.md)
3. [Creating sets and uploading photos](docs/lessons/03-uploads.md)
4. [Photo viewer, deleting, and sharper photos](docs/lessons/04-viewer-delete-quality.md)
5. [Managing photos, security, and going live](docs/lessons/05-manage-secure-deploy.md)
6. [Branding, drafts, search engines, and the 404 page](docs/lessons/06-brand-drafts-seo.md)
7. [Camera details, the About page, and faster phones](docs/lessons/07-camera-about-phones.md)
8. [Moving to your own domain](docs/lessons/08-custom-domain.md)
9. [Fixing "Soft 404": pages that arrive complete](docs/lessons/09-server-rendered-pages.md)
10. [License codes, categories, and the tiled watermark](docs/lessons/10-downloads-categories-watermark.md)
11. [Hero, cover cards, dark mode, and watermark styles](docs/lessons/11-hero-themes-watermark.md)
12. [Share buttons, the watermark toolkit, and the storage limit](docs/lessons/12-share-toolkit-storage.md)
13. [Duplicate warnings, Download all, the activity log, and scheduled publishing](docs/lessons/13-duplicates-downloads-log-schedule.md)
14. [Hero choices, related sets, rate limits, and download receipts](docs/lessons/14-hero-related-limits-receipts.md)
15. [Getting winstonlens.com into Google](docs/lessons/15-google-after-new-domain.md)
16. [The menu, contact on every page, and smooth page changes](docs/lessons/16-menu-footer-smooth.md)
17. [Fresh styles after every deploy (the Safari problem)](docs/lessons/17-fresh-styles-after-deploy.md)
18. [An accessibility and polish pass](docs/lessons/18-uiux-audit.md)
19. [Blurry previews, photo links, smoother viewer, and faster photos](docs/lessons/19-polish-and-speed.md)

---

## Run it on your computer

You need [Node.js](https://nodejs.org) (the LTS version). Then, in Terminal:

```
git clone https://github.com/kaiwei818/WINSTONLENS_webpage.git
cd WINSTONLENS_webpage
npm install
npm run db:migrate:local   # create the local database tables
npm run hash-password      # choose your admin password (saved to .dev.vars)
npm run dev                # open http://localhost:8788
```

Optional: `npm run seed:local` adds three sample sets. **It replaces everything in
your local database**, so only use it on a fresh setup.

Local data lives in the hidden `.wrangler` folder. It never touches the live site.

## Put it online (Cloudflare)

Do these once, in this order. Lesson 5 explains each step in detail.

1. Create a free account at https://dash.cloudflare.com/sign-up, then log in from Terminal:
   ```
   npx wrangler login
   ```
2. Create the database, and copy the `database_id` it prints into `wrangler.toml`:
   ```
   npx wrangler d1 create portfolio-db
   ```
3. Create the database tables:
   ```
   npm run db:migrate:remote
   ```
4. Turn on R2 in the Cloudflare dashboard (left menu, **R2 Object Storage**; it asks
   for a payment method but the first 10 GB are free), then create the bucket:
   ```
   npx wrangler r2 bucket create portfolio-images
   ```
5. Deploy for the first time. If it asks questions, create the project as
   `winstonlens` with `main` as the production branch:
   ```
   npm run deploy
   ```
6. Store your admin username, password hash, and session secret on Cloudflare.
   `npm run hash-password` prints all three values; paste each one when asked:
   ```
   npx wrangler pages secret put ADMIN_USERNAME
   npx wrangler pages secret put ADMIN_PASSWORD_HASH
   npx wrangler pages secret put SESSION_SECRET
   ```
7. Deploy again so the secrets take effect:
   ```
   npm run deploy
   ```

Your site is at the address the deploy prints, like `https://photo-portfolio.pages.dev`.
After any code change, run `npm run deploy` again. If a change adds a file to
`migrations/`, run `npm run db:migrate:remote` first.

## Settings

The site name, owner, description, and main domain (plus the old addresses that
redirect to it) are in `lib/site.js`. Change them there and
deploy; every page picks them up.

| Name | Where | Required | What it is |
|------|-------|----------|------------|
| `ADMIN_USERNAME` | `.dev.vars` locally; `wrangler pages secret put` live | Yes | Your admin login name, for example your email. Capital letters do not matter. |
| `ADMIN_PASSWORD_HASH` | same | Yes | Your admin password, hashed. Made by `npm run hash-password`. |
| `SESSION_SECRET` | same | Yes | Random text that signs login cookies. Changing it logs everyone out. |
| `RESEND_API_KEY` | `wrangler pages secret put` | No | Only for download receipt emails (lesson 14): an API key from resend.com. |
| `RECEIPT_EMAIL` | same | No | Where download receipt emails go (your Resend account's address). |
| `ALLOWED_HOSTS` | `[vars]` in `wrangler.toml` | No | Extra domain names allowed to show your images, comma separated. Only needed when the site has more than one domain. |
| `DB` | `wrangler.toml` | Yes | The D1 database (`database_id` from step 2). |
| `BUCKET` | `wrangler.toml` | Yes | The R2 bucket for images. |

Secrets never go in the code or on GitHub. `.dev.vars` is listed in `.gitignore`.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Run the site locally at http://localhost:8788 |
| `npm run hash-password` | Set the admin username and password |
| `npm run db:migrate:local` | Apply database changes locally |
| `npm run db:migrate:remote` | Apply database changes to the live site |
| `npm run seed:local` | Replace local data with three sample sets |
| `npm run deploy` | Publish to Cloudflare Pages |
| `npm test` | Check that the admin login lock still holds (tests/) |

## How it fits together

```
public/                  Files sent to browsers as they are
  index.html, set.html     Public pages
  admin/                   Admin pages (protected by functions/admin/_middleware.js)
  about.html               The About page (filled in by functions/about.js)
  js/                      Browser code (image-worker.js shrinks photos, exif.js reads camera
                           details, images.js picks image sizes, lightbox.js is the viewer,
                           theme.js is the light / dark switch, share.js the share buttons,
                           watermark.js draws watermarks, admin-toolkit.js and
                           toolkit-worker.js are the toolkit, zip.js packs its downloads)
  css/style.css            All styling, light and dark mode
  404.html                 The "page not found" page
functions/               Server code; the file path is the web address
  _middleware.js           Runs for every request: security headers, site name
  index.js                 Home page, with the set cards built on the server
  robots.txt.js, sitemap.xml.js   For search engines
  api/sets/                Public data (read only)
  api/license/, api/download/   License code check and clean-copy downloads
  api/admin/               Admin data; _middleware.js checks the login for all of it
  img/[[key]].js           Serves images from R2, with hotlink protection
  sets/[slug].js           Set pages, with the photo grid built on the server
lib/                     Shared server code: site name (site.js), database queries, page HTML (render.js),
                         settings, login, slugs, ordering, security headers, page tags
migrations/              Database tables, one numbered file per change
scripts/                 hash-password and seed-local
tests/                   Automated checks, run with npm test
```

## API

Public (read only):

- `GET /api/sets`: all published sets with cover and photo count
- `GET /?category=:slug`: the home page filtered to one category
- `GET /api/sets/:slug`: one set with its photos (drafts only when logged in)
- `GET /about`: the About page
- `GET /robots.txt`, `GET /sitemap.xml`: for search engines
- `GET /img/:key`: an image file (refuses other websites and private clean copies)
- `POST /api/license/check`: is this license code valid for this set (rate limited)
- `GET /api/download/:id?code=...`: download a clean copy with a valid code (counts one download;
  the set page's "Download all" uses this for each photo, then zips them in the browser)

Admin (login required; writes must come from this site):

- `POST /api/admin/login`, `POST /api/admin/logout`
- `GET /api/admin/stats`: storage used, in total and per set
- `GET /api/admin/sets`, `POST /api/admin/sets`
- `PATCH /api/admin/sets/order`: order of sets
- `GET`, `PATCH`, `DELETE /api/admin/sets/:id`: one set (title, slug, description, date, cover, published, scheduled time, categories)
- `PATCH /api/admin/sets/:id/reorder`: order of photos in a set
- `POST /api/admin/photos/duplicates`: which of these files are already on the site
- `GET /api/admin/activity`: the activity log
- `GET /api/admin/receipts`: download receipts (`?format=csv` for a spreadsheet)
- `GET`, `PATCH /api/admin/hero`: how the home page hero is chosen
- `POST /api/admin/photos`: upload one photo (small, thumb, display, plus an optional private clean copy)
- `PATCH`, `DELETE /api/admin/photos/:id`: caption, alt text, camera details, remove clean copy, delete
- `GET`, `POST /api/admin/licenses`; `PATCH`, `DELETE /api/admin/licenses/:id`: license codes
- `GET`, `POST /api/admin/categories`; `DELETE /api/admin/categories/:id`: categories
- `GET`, `PATCH /api/admin/about`: About page bio, gear, and contact details (email, phone, Instagram, one link)
- `POST`, `DELETE /api/admin/about/portrait`: About page portrait

## Honest limits

- Nothing on the web can fully stop people from saving images. This site only
  serves watermarked, resized copies (originals never go online), blocks
  right-click and long-press saving on phones (js/protect.js and the "Photo
  protection" rules in style.css), and stops other websites from embedding your images.
  Screenshots still work. Someone with a license code can share the clean files
  they download; switch off a code to stop further downloads.
- One admin account. Logging out removes the cookie from that browser; to log out
  everywhere, run `npm run hash-password` and update both secrets.
