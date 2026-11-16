// PATCH  /api/admin/categories/:id   body: {"name_zh": "風景"}  its name in 繁體中文 ("" shows the English)
// DELETE /api/admin/categories/:id   removes the category (the sets themselves stay)

export async function onRequestPatch({ request, env, params }) {
  const body = await request.json().catch(() => ({}));
  if (!("name_zh" in body)) return Response.json({ error: "Nothing to change." }, { status: 400 });
  const updated = await env.DB.prepare(`UPDATE categories SET name_zh = ? WHERE id = ? RETURNING id, name, name_zh`)
    .bind(String(body.name_zh ?? "").trim().slice(0, 40), Number(params.id)).first();
  if (!updated) return Response.json({ error: "Category not found" }, { status: 404 });
  return Response.json(updated);
}

export async function onRequestDelete({ env, params }) {
  const id = Number(params.id);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM set_categories WHERE category_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM categories WHERE id = ?`).bind(id),
  ]);
  return Response.json({ ok: true });
}
