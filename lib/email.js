// Emails to you: from receipts@winstonlens.com to RECEIPT_EMAIL, with
// Cloudflare Email (free to a verified Email Routing destination). Used by
// the download receipts (lib/receipts.js) and the daily update
// (lib/daily-report.js). Needs:
//   EMAIL_API_TOKEN        secret: a Cloudflare API token allowed to send email
//   RECEIPT_EMAIL          secret: where the emails go (a verified destination)
//   CLOUDFLARE_ACCOUNT_ID  in wrangler.toml [vars]

import { SITE } from "./site.js";

export const canEmail = (env) => Boolean(env.EMAIL_API_TOKEN && env.RECEIPT_EMAIL && env.CLOUDFLARE_ACCOUNT_ID);

// Returns true when Cloudflare accepted the email.
export async function emailMe(env, { subject, text, fromName = SITE.name }) {
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.EMAIL_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: { address: `receipts@${SITE.domain}`, name: fromName }, to: env.RECEIPT_EMAIL, subject, text }),
    });
    if (!response.ok) console.error("Email failed:", response.status, await response.text());
    return response.ok;
  } catch (err) {
    console.error("Email failed:", err);
    return false;
  }
}
