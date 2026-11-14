# Lesson 21: High-resolution clean copies for licensed downloads

Until now a clean copy (the private file a visitor downloads with a license
code, lesson 10) was 3000 px on its long edge, about 2 to 4 MB. Good for
screens, small for a large print.

## The new box

On a set's admin page, under **Watermark and downloads**:

- [x] Also store a clean copy (no watermark) for licensed downloads
- [x] **High-resolution clean copies (the photo's full size, up to 6000 px)**

The second box only works with the first one ticked: it is about downloads,
so a set without clean copies has nothing to make bigger. Like the watermark,
it is decided when the photos are shrunk, so choose before adding files.

What changes when it is ticked:

| | Normal clean copy | High resolution |
|---|---|---|
| Size | 3000 px long edge | Your photo's own size, 6000 px at most |
| Quality | 92 | 95 (lower only if the file would pass 12 MB) |
| File | about 2 to 4 MB | about 6 to 12 MB |

Nothing else changes: the watermarked sizes everyone sees are the same, the
file is still made in your browser (the original never leaves your computer),
and it is still a new JPEG with no GPS or camera serial number in it.

After shrinking, each photo's line says what it got, for example
`+ 9.9 MB private clean copy (high resolution, 6000 × 4000)`.

- A photo that is 3000 px or smaller simply gets the normal clean copy.
- If the browser cannot make the big file (phones, and Safari with very large
  photos, run out of image memory), that photo quietly gets the normal clean
  copy instead, and its line shows the smaller size.

## The limit: 1 GB per set

High-resolution copies are several times bigger, and the free storage is
10 GB for the whole site. So a set that takes them may store **1 GB at most**,
everything counted (all sizes plus clean copies): about 80 to 150
high-resolution photos.

- Under the box, the page shows the room left: "This set uses 240.0 MB;
  784.0 MB left."
- If the photos you added would not fit, the summary says so before you
  upload.
- The server checks again for every photo, and refuses one that would pass
  the limit with a message saying how full the set is. The photos before it
  are already saved.
- Uploads **without** the high-resolution box are not limited, exactly as
  before, so your normal bulk uploads behave the same.

To change the numbers (6000 px, 12 MB per file, 1 GB per set), edit
`public/js/clean-copy.js`. Only photos uploaded afterwards change.

## Good to know

- To give an existing photo a high-resolution copy, upload it again (as with
  any clean copy), then delete the old one.
- **Download all** packs every file in the visitor's browser. A big set of
  12 MB files takes a while and a lot of memory on a phone; on a computer it
  is fine.
- A license code's download count works the same: one file, one download.

## Deploy

No database step this time:

```
cd ~/project-0
git pull
npm run deploy
```
