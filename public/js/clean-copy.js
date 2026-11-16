// The limits for clean copies: the private files visitors with a license
// code download (see image-worker.js). One place, used by the
// upload worker (to make the file), the admin set page (to show the room
// left), and the server (to enforce the set's limit).
//
// A clean copy keeps the photo's own size, up to 4500 px, at a high quality:
// usually 3.5 to 7 MB. To change the limits, edit the values here. Only photos
// uploaded afterwards change.

const MB = 1024 * 1024;

export const HIRES = {
  edge: 4500,                           // longest side, in pixels (never bigger than your original)
  qualities: [0.95, 0.92, 0.88, 0.84],  // tried in this order until the file fits
  maxBytes: 12 * MB,                    // one file is never larger than this
  // Last resort for very detailed photos still too big at the lowest quality:
  fallback: { edge: 4000, qualities: [0.9, 0.84] },
};

// Everything one set stores (all sizes plus clean copies) may not pass this
// once clean copies bigger than 3000 px are involved. 300 MB is about 35 to 50
// photos with clean copies, and keeps the whole site well inside the 10 GB of
// free storage: thirty such sets would still fit.
export const SET_LIMIT_BYTES = 300 * MB;
