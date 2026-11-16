// English and 繁體中文 (Taiwan usage) for every word the public site says
// itself. Set titles, descriptions, category names and the About bio have
// their own Chinese boxes on the admin pages; captions stay as written.
//
// Which language a visitor gets (langOf): ?lang=zh or ?lang=en in the address
// (the 中文 / English link, or a shared link; link previews read it too), else
// the choice they made before (a cookie), else their browser's language.
// The server translates pages before sending them (functions/_middleware.js),
// and the strings the page scripts need travel with the page as data
// (CLIENT_KEYS, read by js/text.js).
//
// Wording: Taiwan Traditional Chinese only (照片, 分享, 下載, 授權碼, 背號,
// 我的最愛, 連結, 網站, 瀏覽器...), never Mainland terms.

export const LANGS = ["en", "zh"];
export const HTML_LANG = { en: "en", zh: "zh-Hant-TW" };

// A value can be a string, or { one, other } where English needs a plural.
// {name} is replaced by the value given for it.
export const TEXT = {
  en: {
    "site.description": "Photography by Winston Chang: landscapes, sports, travel and wildlife.",
    "home.title": "{owner} Photography",
    "home.description": "Photo sets by {owner}: {list} photography.",
    "home.category.description": "{name} photo sets by {owner}.",
    "home.heading": "Photo sets",
    "home.empty": "No photo sets yet. Please come back soon.",
    "home.category.empty": "No sets in this category yet.",
    "home.categories": "Categories",
    "home.all": "All",
    "list.and": " and ",
    "list.comma": ", ",
    "hero.featured": "Featured",
    "hero.latest": "Latest work",
    "hero.season": "In season",
    "hero.view": "View set",
    "hero.section": "Featured set",
    "photos": { one: "{n} photo", other: "{n} photos" },
    "month": "{month} {year}",
    "months": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    "nav.work": "Work",
    "nav.about": "About",
    "nav.contact": "Contact",
    "nav.map": "Map",
    "nav.updates": "What's new",
    "nav.sets": "Sets",
    "nav.categories": "Categories",
    "menu.label": "Menu",
    "menu.open": "Open menu",
    "menu.close": "Close menu",
    "menu.share": "Share this page",
    "lang.switch": "中文",
    "lang.switchLabel": "切換成中文",
    "skip": "Skip to content",
    "footer.contact": "Get in touch",
    "footer.top": "Back to top",
    "contact.email": "Email",
    "contact.phone": "Phone",
    "contact.website": "Website",
    "theme.dark": "Dark mode",
    "theme.light": "Light mode",
    "theme.toDark": "Switch to dark mode",
    "theme.toLight": "Switch to light mode",
    "share": "Share",
    "share.copy": "Copy link",
    "share.copied": "Link copied",
    "share.more": "More options",
    "share.email": "Email",
    "share.prompt": "Copy this link:",
    "set.all": "All sets",
    "set.related": "Related sets",
    "set.empty": "This set has no photos yet.",
    "set.photoTitle": "{title}, photo {n}",
    "related.category": "Also {name}",
    "related.place": "Also in {place}",
    "related.time": "Around the same time",
    "related.year": "The same year",
    "related.camera": "Also shot with {camera}",
    "find.label": "Find my photos by jersey number",
    "find.placeholder": "Number",
    "find.clear": "Clear, show all photos",
    "find.options": "Numbers in this set",
    "find.result": { one: "{n} photo of #{number}", other: "{n} photos of #{number}" },
    "find.none": "No photos tagged #{number} in this set yet.",
    "find.favorites": "♥ My favorites ({n})",
    "find.favoritesResult": { one: "Your favorites: {n} photo", other: "Your favorites: {n} photos" },
    "viewer.label": "Photo viewer",
    "viewer.close": "Close",
    "viewer.prev": "Previous photo",
    "viewer.next": "Next photo",
    "viewer.status": "Photo {n} of {total}",
    "viewer.problem": "This photo could not be loaded.",
    "viewer.retry": "Try again",
    "viewer.like": "Like",
    "viewer.liked": "Liked",
    "viewer.download": "Download",
    "viewer.thumb": "View photo {n}",
    "license.heading": "Have a license code?",
    "license.help": "Enter the code you received to download full-quality copies without the watermark.",
    "license.label": "License code",
    "license.unlock": "Unlock",
    "license.accepted": { one: "Code accepted. Open a photo and use the Download button, or download them all at once ({n} photo available).", other: "Code accepted. Open a photo and use the Download button, or download them all at once ({n} photos available)." },
    "license.left": { one: " You have {n} download left.", other: " You have {n} downloads left." },
    "license.all": "Download all {n} (.zip)",
    "license.needs": "Needs {n} downloads; your code has {left} left. Download photos one by one instead.",
    "license.downloading": "Downloading {n} of {total}...",
    "license.zipping": "Making the .zip file...",
    "license.done": "Done: {n} photos saved as {file}.",
    "license.stopped": "Stopped after {n} of {total}: {reason}",
    "license.partial": " The ones that worked are in the .zip.",
    "license.interrupted": "The connection was interrupted.",
    "license.checkFailed": "Could not check the code. Please try again.",
    "license.invalid": "This code is not valid for this set.",
    "license.off": "This code has been switched off.",
    "license.expired": "This code has expired.",
    "license.usedUp": "This code has no downloads left.",
    "license.tooMany": "Too many wrong codes. Please wait 15 minutes and try again.",
    "license.paused": "Code checking is paused for a while. Please try again later.",
    "license.notDownloadable": "This photo cannot be downloaded.",
    "license.fileMissing": "File missing. Please contact the photographer.",
    "license.setNotFound": "Set not found.",
    "wait": { one: "Too many requests. Please wait {n} minute and try again.", other: "Too many requests. Please wait {n} minutes and try again." },
    "about.title": "About",
    "about.heading": "About {owner}",
    "about.gear": "Gear",
    "about.contact": "Contact",
    "about.soon": "More about me is coming soon.",
    "about.portrait": "Portrait of the photographer",
    "map.title": "Map",
    "map.description": "Where the photo sets were taken.",
    "map.lead": "Where the sets were taken. Wildlife sets are left off, so nests and perches stay private.",
    "map.region": "Map of the sets",
    "map.empty": "No sets are on the map yet.",
    "map.list": "Sets on the map",
    "map.rough": "rough area",
    "updates.title": "What's new",
    "updates.lead": "New things you can do on the site.",
    "notfound.title": "Page not found",
    "notfound.heading": "Page not found",
    "notfound.text": "This page does not exist, or it has moved.",
    "notfound.home": "See all photo sets",
  },
  zh: {
    "site.description": "Winston Chang 的攝影作品：風景、運動、旅行與野生動物。",
    "home.title": "{owner} 攝影作品",
    "home.description": "{owner} 的攝影作品集：{list}攝影。",
    "home.category.description": "{owner} 的{name}作品集。",
    "home.heading": "作品集",
    "home.empty": "目前還沒有作品集，敬請期待。",
    "home.category.empty": "這個分類還沒有作品集。",
    "home.categories": "分類",
    "home.all": "全部",
    "list.and": "與",
    "list.comma": "、",
    "hero.featured": "精選",
    "hero.latest": "最新作品",
    "hero.season": "當季精選",
    "hero.view": "查看作品集",
    "hero.section": "精選作品集",
    "photos": "{n} 張照片",
    "month": "{year} 年 {month} 月",
    "months": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
    "nav.work": "作品",
    "nav.about": "關於",
    "nav.contact": "聯絡",
    "nav.map": "地圖",
    "nav.updates": "新功能",
    "nav.sets": "作品集",
    "nav.categories": "分類",
    "menu.label": "選單",
    "menu.open": "開啟選單",
    "menu.close": "關閉選單",
    "menu.share": "分享此頁",
    "lang.switch": "English",
    "lang.switchLabel": "Switch to English",
    "skip": "跳到主要內容",
    "footer.contact": "聯絡我",
    "footer.top": "回到頂端",
    "contact.email": "電子郵件",
    "contact.phone": "電話",
    "contact.website": "網站",
    "theme.dark": "深色模式",
    "theme.light": "淺色模式",
    "theme.toDark": "切換成深色模式",
    "theme.toLight": "切換成淺色模式",
    "share": "分享",
    "share.copy": "複製連結",
    "share.copied": "已複製連結",
    "share.more": "更多選項",
    "share.email": "電子郵件",
    "share.prompt": "請複製這個連結：",
    "set.all": "所有作品集",
    "set.related": "相關作品集",
    "set.empty": "這個作品集還沒有照片。",
    "set.photoTitle": "{title}，第 {n} 張照片",
    "related.category": "同為{name}",
    "related.place": "同樣在{place}",
    "related.time": "拍攝時間相近",
    "related.year": "同一年拍攝",
    "related.camera": "同樣使用 {camera} 拍攝",
    "find.label": "用背號找照片",
    "find.placeholder": "背號",
    "find.clear": "清除，顯示所有照片",
    "find.options": "這個作品集裡的背號",
    "find.result": "#{number} 共 {n} 張照片",
    "find.none": "這個作品集還沒有標記 #{number} 的照片。",
    "find.favorites": "♥ 我的最愛（{n}）",
    "find.favoritesResult": "我的最愛：{n} 張照片",
    "viewer.label": "照片檢視器",
    "viewer.close": "關閉",
    "viewer.prev": "上一張",
    "viewer.next": "下一張",
    "viewer.status": "第 {n} 張，共 {total} 張",
    "viewer.problem": "這張照片無法載入。",
    "viewer.retry": "再試一次",
    "viewer.like": "按讚",
    "viewer.liked": "已按讚",
    "viewer.download": "下載",
    "viewer.thumb": "查看第 {n} 張照片",
    "license.heading": "有授權碼嗎？",
    "license.help": "輸入您收到的授權碼，即可下載無浮水印的高畫質照片。",
    "license.label": "授權碼",
    "license.unlock": "解鎖",
    "license.accepted": "授權碼正確。打開照片後點「下載」，或一次全部下載（共 {n} 張可下載）。",
    "license.left": "還可以下載 {n} 次。",
    "license.all": "全部下載 {n} 張（.zip）",
    "license.needs": "需要 {n} 次下載，但您的授權碼只剩 {left} 次。請改為一張一張下載。",
    "license.downloading": "正在下載第 {n} 張，共 {total} 張…",
    "license.zipping": "正在製作 .zip 檔…",
    "license.done": "完成：已將 {n} 張照片存成 {file}。",
    "license.stopped": "下載到第 {n} 張（共 {total} 張）時停止：{reason}",
    "license.partial": "已下載的照片在 .zip 檔裡。",
    "license.interrupted": "連線中斷了。",
    "license.checkFailed": "無法驗證授權碼，請再試一次。",
    "license.invalid": "這組授權碼不適用於這個作品集。",
    "license.off": "這組授權碼已停用。",
    "license.expired": "這組授權碼已過期。",
    "license.usedUp": "這組授權碼的下載次數已用完。",
    "license.tooMany": "輸入錯誤次數過多，請 15 分鐘後再試。",
    "license.paused": "授權碼驗證暫停中，請稍後再試。",
    "license.notDownloadable": "這張照片無法下載。",
    "license.fileMissing": "找不到檔案，請與攝影師聯絡。",
    "license.setNotFound": "找不到作品集。",
    "wait": "請求次數過多，請 {n} 分鐘後再試。",
    "about.title": "關於",
    "about.heading": "關於 {owner}",
    "about.gear": "器材",
    "about.contact": "聯絡方式",
    "about.soon": "更多介紹即將推出。",
    "about.portrait": "攝影師肖像",
    "map.title": "地圖",
    "map.description": "作品集的拍攝地點。",
    "map.lead": "作品的拍攝地點。野生動物作品不會標示在地圖上，以保護鳥巢與棲息處。",
    "map.region": "作品集地圖",
    "map.empty": "地圖上還沒有作品集。",
    "map.list": "地圖上的作品集",
    "map.rough": "大略位置",
    "updates.title": "新功能",
    "updates.lead": "網站上可以使用的新功能。",
    "notfound.title": "找不到頁面",
    "notfound.heading": "找不到這個頁面",
    "notfound.text": "這個頁面不存在，或已經移到別的地方。",
    "notfound.home": "查看所有作品集",
  },
};

// The strings the page scripts use (they arrive with the page, js/text.js).
export const CLIENT_KEYS = [
  "photos", "theme.dark", "theme.light", "theme.toDark", "theme.toLight",
  "share.copy", "share.copied", "share.more", "share.email", "share.prompt", "menu.share", "set.photoTitle",
  "find.result", "find.none", "find.favorites", "find.favoritesResult",
  "viewer.status", "viewer.like", "viewer.liked", "share",
  "license.help", "license.accepted", "license.left", "license.all", "license.needs", "license.downloading",
  "license.zipping", "license.done", "license.stopped", "license.partial", "license.interrupted", "license.checkFailed",
  "map.rough", "hero.view",
];

// t("photos", { n: 3 }) -> "3 photos" / "3 張照片".
export function translator(lang) {
  const table = TEXT[lang] || TEXT.en;
  return (key, values = {}) => format(table[key] ?? TEXT.en[key] ?? key, values);
}

export function format(value, values = {}) {
  const text = typeof value === "object" && !Array.isArray(value) ? (values.n === 1 ? value.one : value.other) : value;
  return String(text).replace(/\{(\w+)\}/g, (all, name) => (name in values ? values[name] : all));
}

export function clientText(lang) {
  const table = TEXT[lang] || TEXT.en;
  return Object.fromEntries(CLIENT_KEYS.map((key) => [key, table[key] ?? TEXT.en[key]]));
}

// "March 2026" / "2026 年 3 月", from "2026-03-15" or "2026-03-15 08:30:00".
export function monthYear(date, lang = "en") {
  const match = /^(\d{4})-(\d{2})/.exec(date || "");
  if (!match) return "";
  const table = TEXT[lang] || TEXT.en;
  const month = table.months[Number(match[2]) - 1];
  return month ? format(table.month, { month, year: match[1] }) : "";
}

// "landscape, sports and travel" / "風景、運動與旅行".
export function joinList(items, lang = "en") {
  const t = translator(lang);
  if (items.length < 2) return items[0] || "";
  return `${items.slice(0, -1).join(t("list.comma"))}${t("list.and")}${items.at(-1)}`;
}

// The visitor's language: ?lang= in the address, their earlier choice (cookie
// "lang"), else their browser's.
export function langOf(request) {
  const asked = new URL(request.url).searchParams.get("lang");
  if (LANGS.includes(asked)) return asked;
  const cookie = /(?:^|;\s*)lang=(en|zh)\b/.exec(request.headers.get("Cookie") || "");
  if (cookie) return cookie[1];
  const accept = (request.headers.get("Accept-Language") || "").toLowerCase();
  const first = accept.split(",")[0].trim();
  return first.startsWith("zh") ? "zh" : "en";
}

// A set's or category's own words in this language, falling back to English.
export const localized = (english, chinese, lang) => (lang === "zh" && chinese ? chinese : english);
