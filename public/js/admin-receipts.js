// The download receipts page (admin/receipts.html). Reads /api/admin/receipts.

const $ = (id) => document.getElementById(id);
let lastId = null;

async function load(more = false) {
  const params = new URLSearchParams();
  const codeId = $("code-filter").value;
  if (codeId) params.set("code_id", codeId);
  if (more && lastId) params.set("before", lastId);
  $("status").hidden = false;
  $("status").textContent = "Loading...";

  const response = await fetch(`/api/admin/receipts?${params}`);
  if (response.status === 401) return (location.href = "/admin/login");
  if (!response.ok) {
    $("status").textContent = "Could not load the receipts.";
    return;
  }
  const { receipts, more: hasMore, codes } = await response.json();
  if (!more) {
    $("lines").replaceChildren();
    fillCodes(codes);
  }
  $("lines").append(...receipts.map(row));
  lastId = receipts.length ? receipts[receipts.length - 1].id : lastId;
  $("more").hidden = !hasMore;
  $("status").hidden = $("lines").children.length > 0;
  $("status").textContent = "No downloads yet.";
  $("csv-link").href = `/api/admin/receipts?format=csv${codeId ? `&code_id=${codeId}` : ""}`;
}

function fillCodes(codes) {
  const select = $("code-filter");
  const chosen = select.value;
  select.replaceChildren(new Option("All codes", ""), ...codes.map((c) =>
    new Option(`${c.code}${c.label ? ` (${c.label})` : ""}: ${c.downloads}`, c.id)));
  select.value = chosen;
}

function cell(text, className = "") {
  const td = document.createElement("td");
  td.textContent = text; // text, never HTML
  if (className) td.className = className;
  return td;
}

function row(r) {
  const tr = document.createElement("tr");
  const when = new Date(r.at).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const photo = `#${r.photo_id}${r.photo_name ? ` (${r.photo_name})` : ""}${r.via_all ? ", Download all" : ""}`;
  tr.append(
    cell(when),
    cell(r.code_label ? `${r.code} (${r.code_label})` : r.code),
    cell(`"${r.set_title}", photo ${photo}`),
    cell([r.city, r.region, r.postal_code, r.country].filter(Boolean).join(", ") || "unknown", "muted"),
    cell([r.network, r.device].filter(Boolean).join(" · ") || "unknown", "muted"),
  );
  return tr;
}

$("code-filter").addEventListener("change", () => {
  lastId = null;
  load();
});
$("more").addEventListener("click", () => load(true));
load();
