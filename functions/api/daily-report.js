// POST /api/daily-report   with the header  Authorization: Bearer <REPORT_SECRET>
// Sends the daily update email (lib/daily-report.js). Called each morning by
// .github/workflows/daily-report.yml; the secret (stored on both Cloudflare
// and GitHub) keeps anyone else from sending it.

import { sameSecret } from "../../lib/auth.js";
import { dailyReport } from "../../lib/daily-report.js";
import { canEmail, emailMe } from "../../lib/email.js";
import { SITE } from "../../lib/site.js";

export async function onRequestPost({ request, env }) {
  const given = (request.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (!env.REPORT_SECRET || !(await sameSecret(given, env.REPORT_SECRET))) {
    return new Response("Not found", { status: 404 });
  }
  if (!canEmail(env)) return Response.json({ error: "Email is not set up (lib/email.js)." }, { status: 503 });
  const report = await dailyReport(env, new URL(request.url).origin);
  const sent = await emailMe(env, { ...report, fromName: `${SITE.name} daily` });
  return Response.json({ sent, subject: report.subject }, { status: sent ? 200 : 502 });
}
