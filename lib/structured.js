// Structured data for Google (schema.org, in JSON-LD form). It describes the
// page in a way search engines understand exactly:
//   home page  "the website winstonlens, by the person Winston Chang"
//   set page   "a photo gallery with these photos, by Winston Chang"
// For each photo it also names the photographer, the copyright, and where to
// ask for a license (the About page). Google Images can then show
// "Credit: Winston Chang" and a "Licensable" label next to your photos.
//
// Test a page at https://search.google.com/test/rich-results after deploying.

import { SITE } from "./site.js";

function person(origin) {
  return { "@type": "Person", name: SITE.owner, url: `${origin}/about` };
}

// instagram (optional): the account name from the About page, so Google can
// tie the site and the Instagram profile to the same person.
export function homeData(origin, instagram = "") {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: SITE.name, url: `${origin}/`, description: SITE.description, author: person(origin) },
      { ...person(origin), "@id": `${origin}/about#person`,
        ...(instagram ? { sameAs: [`https://www.instagram.com/${instagram}/`] } : {}) },
    ],
  };
}

// Up to 50 photos: plenty for Google, and keeps the page small.
export function galleryData(origin, set) {
  const year = new Date().getUTCFullYear();
  const photo = (p) => ({
    "@type": "ImageObject",
    contentUrl: `${origin}/img/${p.display_key}`,
    thumbnailUrl: `${origin}/img/${p.thumb_key}`,
    ...(p.alt_text ? { name: p.alt_text } : {}),
    ...(p.caption ? { caption: p.caption } : {}),
    width: p.width,
    height: p.height,
    creator: person(origin),
    creditText: SITE.owner,
    copyrightNotice: `© ${year} ${SITE.owner}`,
    license: `${origin}/about`,
    acquireLicensePage: `${origin}/about`,
  });
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: set.title,
    ...(set.description ? { description: set.description } : {}),
    url: `${origin}/sets/${encodeURIComponent(set.slug)}`,
    ...(set.shot_date ? { dateCreated: set.shot_date } : {}),
    ...(set.location ? { contentLocation: { "@type": "Place", name: set.location } } : {}),
    author: person(origin),
    image: set.photos.slice(0, 50).map(photo),
  };
}
