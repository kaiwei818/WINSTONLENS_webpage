// Security headers: instructions to the browser that limit what a page may do.
// They cost nothing and block whole families of attacks. functions/_middleware.js
// adds them to every response the site sends.

export const SECURITY_HEADERS = {
  // Only load scripts, styles, images, and connections from this site.
  // ("blob:" is for the previews on the upload page, "data:" for the tiny
  // blurry photo previews written into the page, and OpenStreetMap for the
  // map pictures on /map.) If an attacker managed
  // to sneak a <script> into a caption, the browser would refuse to run it.
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' blob: data: https://tile.openstreetmap.org",
    // Inline style="" attributes are allowed: the photo grid uses them to give
    // each photo its shape before any script runs. Scripts stay strictly locked.
    "style-src 'self' 'unsafe-inline'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  // Never show this site inside another site's frame (stops "clickjacking").
  "X-Frame-Options": "DENY",
  // Trust the Content-Type we send; do not guess.
  "X-Content-Type-Options": "nosniff",
  // Tell other sites only our domain when someone follows a link, not the full address.
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // This site never needs the camera, microphone, or location.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  // Always use HTTPS for the next year. (Browsers ignore this on http://localhost.)
  "Strict-Transport-Security": "max-age=31536000",
};

// Adds any header the response does not already have. (Images set their own,
// stricter Content-Security-Policy, which must not be replaced.)
export function addSecurityHeaders(headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
}
