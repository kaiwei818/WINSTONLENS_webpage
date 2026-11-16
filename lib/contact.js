// Your contact details, as you entered them on the admin About page.
// Used by the About page and by the "Get in touch" part at the end of every
// page (lib/chrome.js), so you only keep them up to date in one place.

import { translator } from "./i18n.js";

export const CONTACT_KEYS = ["about_email", "about_phone", "about_instagram", "about_link_label", "about_link_url"];

// Returns [{ label, href, shown }] for whatever is filled in, labelled in lang.
export function contactItems(about, lang = "en") {
  const t = translator(lang);
  const items = [];
  if (about.about_email) {
    items.push({ label: t("contact.email"), href: `mailto:${about.about_email}`, shown: about.about_email });
  }
  if (about.about_phone) {
    // tel: links keep only the digits and a leading +, so "+886 912-345-678"
    // dials +886912345678 when tapped on a phone.
    const dial = about.about_phone.replace(/(?!^\+)[^\d]/g, "");
    items.push({ label: t("contact.phone"), href: `tel:${dial}`, shown: about.about_phone });
  }
  if (about.about_instagram) {
    items.push({ label: "Instagram", href: `https://www.instagram.com/${about.about_instagram}/`, shown: `@${about.about_instagram}` });
  }
  if (about.about_link_url) {
    const shown = about.about_link_url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    items.push({ label: about.about_link_label || t("contact.website"), href: about.about_link_url, shown });
  }
  return items;
}

// Links to other sites open in a new tab; "noopener" stops that tab from
// being able to control this one.
export function externalAttrs(href) {
  return href.startsWith("http") ? ' target="_blank" rel="noopener"' : "";
}
