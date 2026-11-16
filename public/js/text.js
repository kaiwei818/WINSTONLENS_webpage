// The words the page scripts show, in the page's language (English or
// 繁體中文). The server puts them in the page as data (#site-text; see
// lib/i18n.js, CLIENT_KEYS), so they are there before any script runs.
// t("photos", { n: 3 }) -> "3 photos" / "3 張照片".

const strings = (() => {
  try {
    return JSON.parse(document.getElementById("site-text")?.textContent || "{}");
  } catch {
    return {};
  }
})();

export function t(key, values = {}) {
  const value = strings[key] ?? key;
  const text = typeof value === "object" ? (values.n === 1 ? value.one : value.other) : value;
  return String(text).replace(/\{(\w+)\}/g, (all, name) => (name in values ? values[name] : all));
}
