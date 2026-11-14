// The limits for "high-resolution" clean copies: the private files visitors
// with a license code download (see image-worker.js). One place, used by the
// upload worker (to make the file), the admin set page (to show the room
// left), and the server (to enforce the set's limit).
//
// A normal clean copy is 3000 px on its long edge, about 2 to 4 MB.
// A high-resolution one keeps the photo's own size, up to 6000 px, at a
// higher quality: usually 6 to 12 MB. To change the limits, edit the values
// here. Only photos uploaded afterwards change.

const MB = 1024 * 1024;

export const HIRES = {
  edge: 6000,                           // longest side, in pixels (never bigger than your original)
  qualities: [0.95, 0.92, 0.88, 0.84],  // tried in this order until the file fits
  maxBytes: 12 * MB,                    // one file is never larger than this
  // Last resort for very detailed photos still too big at the lowest quality:
  fallback: { edge: 5000, qualities: [0.9, 0.84] },
};

// Everything one set stores (all sizes plus clean copies) may not pass this
// once high-resolution copies are involved. 1 GB is a tenth of the 10 GB of
// free storage: about 80 to 150 high-resolution photos.
export const SET_LIMIT_BYTES = 1024 * MB;
