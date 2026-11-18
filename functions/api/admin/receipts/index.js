// GET /api/admin/receipts?code_id=3&before=120     newest first, 100 at a time
// GET /api/admin/receipts?format=csv&code_id=3     all of them, as a spreadsheet file
// Download receipts (see lib/receipts.js). code_id is optional: one code only.

const PAGE = 100;
const COLUMNS = ["at", "code", "code_label", "set_title", "photo_id", "photo_name", "city", "region", "postal_code", "country",
  "network", "device", "time_zone", "via_all"];

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const codeId = Number(url.searchParams.get("code_id")) || 0;
  const csv = url.searchParams.get("format") === "csv";
  const before = Number(url.searchParams.get("before")) || Number.MAX_SAFE_INTEGER;

  const { results } = await env.DB.prepare(
    `SELECT id, ${COLUMNS.join(", ")} FROM download_receipts
     WHERE (? = 0 OR code_id = ?) AND id < ?
     ORDER BY id DESC ${csv ? "" : `LIMIT ${PAGE + 1}`}`
  ).bind(codeId, codeId, csv ? Number.MAX_SAFE_INTEGER : before).all();

  if (csv) {
    // Opens in Excel, Numbers, or Google Sheets. The "﻿" at the start tells
    // Excel the file is UTF-8, so Chinese titles show correctly.
    const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = [COLUMNS.join(","), ...results.map((r) => COLUMNS.map((c) => cell(r[c])).join(","))];
    return new Response("﻿" + lines.join("\r\n") + "\r\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="download-receipts-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const { results: codes } = await env.DB.prepare(
    `SELECT code_id AS id, code, code_label AS label, COUNT(*) AS downloads
     FROM download_receipts GROUP BY code_id ORDER BY MAX(id) DESC`
  ).all();
  return Response.json({ receipts: results.slice(0, PAGE), more: results.length > PAGE, codes });
}
