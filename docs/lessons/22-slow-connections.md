# Lesson 22: A lighter viewer on slow connections

The full-screen viewer loads a 3000 px file for every photo, up to 1.85 MB.
On a good connection that is instant. On a weak phone signal it is a long
wait for every photo, and it spends the visitor's mobile data.

Now the site notices a slow connection and loads less.

## How the site knows, without a speed test

No test file is downloaded. `public/js/connection.js` uses what the browser
already knows, the best source first:

1. **What the visitor asked for.** "Data saver" switched on, or a connection
   the browser itself calls 2g or 3g. Only Chrome, Edge and Android tell us
   this; Safari and Firefox do not.
2. **How long the full-size photos opened so far really took.** The browser
   keeps a record of every download (its size and its time). This is the most
   reliable number, and it is remembered while the tab stays open, so it
   carries from one set to the next.
3. **How fast the small photos in the grid arrived**, before any photo has
   been opened. Small files travel slower than the line's real speed, so this
   first guess is generous, and number 2 replaces it after the first photo.

The rule: if a full-size photo would take longer than **2.5 seconds**, the
connection counts as slow. That is roughly anything under 5 Mbps.

When nothing can be measured (for example everything came from the browser's
saved copies), the answer is "not slow", and the viewer works as it always
did.

## What a slow connection gets

| | Normal | Slow | Data saver on |
|---|---|---|---|
| Opening a photo | 3000 px file | 1200 px file (about a fifth of the data) | 1200 px file |
| Staying on it 2 seconds | | the 3000 px file follows quietly | nothing more |
| Zooming in | | the 3000 px file at once | the 3000 px file at once |
| The next photo, in advance | 3000 px | 1200 px | not loaded |

So someone flicking through a set on a weak signal sees every photo quickly,
and only the photos they stop to look at cost the full amount. On a phone the
1200 px file already fills the screen sharply.

A photo whose full file has arrived once keeps showing it; nothing ever goes
back down to the smaller file.

## Changing the numbers

- `WAIT_LIMIT_SECONDS` in `public/js/connection.js`: the 2.5 seconds.
- `STAY_BEFORE_FULL` in `public/js/lightbox.js`: the 2 seconds on a photo
  before its full file is fetched.

## Honest limits

- It is an estimate. A connection that changes (walking out of Wi-Fi range)
  is noticed one photo late.
- A fast connection is never held back: when in doubt the full file loads.
- Checked on a test copy in Chrome with the speed held at 1.5 Mbps. iPhones
  use the measured numbers only (2 and 3 above), since Safari does not report
  the connection type or data saver.

## Deploy

No database step:

```
cd ~/project-0
git pull
npm run deploy
```
