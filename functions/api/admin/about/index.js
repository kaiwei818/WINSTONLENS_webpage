// GET   /api/admin/about   the About page settings, for the admin form
// PATCH /api/admin/about   save bio, gear, and contact details (any of the fields below)

import { ABOUT_KEYS, getSettings, saveSettings } from "../../../../lib/settings.js";

export async function onRequestGet({ env }) {
  return Response.json(await getSettings(env, ABOUT_KEYS));
}

export async function onRequestPatch({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const changes = {};
  const text = (value, max) => String(value ?? "").trim().slice(0, max);

  if ("bio" in body) changes.about_bio = text(body.bio, 5000);
  if ("bio_zh" in body) changes.about_bio_zh = text(body.bio_zh, 5000); // the bio in 繁體中文 (optional)
  if ("gear" in body) changes.about_gear = text(body.gear, 2000);

  if ("email" in body) {
    const email = text(body.email, 200);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "That email address does not look right." }, { status: 400 });
    }
    changes.about_email = email;
  }

  if ("phone" in body) {
    // Shown as you typed it. Only digits, spaces, and + - ( ) . are allowed,
    // with 6 to 15 digits (the longest phone numbers in the world have 15).
    const phone = text(body.phone, 40);
    const digits = phone.replace(/\D/g, "").length;
    if (phone && (!/^\+?[\d\s().-]+$/.test(phone) || digits < 6 || digits > 15)) {
      return Response.json({ error: "That phone number does not look right." }, { status: 400 });
    }
    changes.about_phone = phone;
  }

  if ("instagram" in body) {
    // Accept "@winstonlens", "winstonlens", or a full instagram.com link.
    const name = text(body.instagram, 200)
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/^@/, "")
      .replace(/\/.*$/, "");
    if (name && !/^[A-Za-z0-9._]{1,30}$/.test(name)) {
      return Response.json({ error: "That Instagram name does not look right." }, { status: 400 });
    }
    changes.about_instagram = name;
  }

  if ("link_label" in body) changes.about_link_label = text(body.link_label, 40);
  if ("link_url" in body) {
    const url = text(body.link_url, 500);
    // Only real web links. This also blocks tricks like "javascript:" links.
    if (url && !/^https?:\/\/[^\s]+$/i.test(url)) {
      return Response.json({ error: "The link must start with https://" }, { status: 400 });
    }
    changes.about_link_url = url;
  }

  if (Object.keys(changes).length === 0) {
    return Response.json({ error: "Nothing to change." }, { status: 400 });
  }
  await saveSettings(env, changes);
  return Response.json(await getSettings(env, ABOUT_KEYS));
}
