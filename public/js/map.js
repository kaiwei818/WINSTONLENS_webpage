// The map page (/map): one pin per set, its cover in a round frame. Sets
// shown only as a rough area get a dashed frame and a soft circle around
// them (seen when zoomed in). Tapping opens a card with the cover, the name
// and "View set".
// The data comes from functions/map.js; Leaflet draws the map.
// (A module, run after leaflet.js, which comes before it in the page.)

import { t } from "./text.js";

(function () {
  const box = document.getElementById("map");
  if (!box || !window.L) return;
  const pins = JSON.parse(document.getElementById("map-data").textContent);
  const lessMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const map = L.map(box, {
    scrollWheelZoom: false, // scrolling the page must not get stuck zooming the map
    zoomAnimation: !lessMotion,
    fadeAnimation: !lessMotion,
    markerZoomAnimation: !lessMotion,
  });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const card = (pin) => {
    const el = document.createElement("div");
    el.className = "map-card";
    if (pin.cover) {
      const img = document.createElement("img");
      img.src = `/img/${pin.cover}`;
      img.alt = "";
      el.append(img);
    }
    const title = document.createElement("p");
    title.className = "map-card-title";
    title.textContent = pin.title;
    const facts = document.createElement("p");
    facts.className = "map-card-facts";
    facts.textContent = [pin.location, t("photos", { n: pin.count }), pin.area ? t("map.rough") : ""]
      .filter(Boolean).join(document.documentElement.lang.startsWith("zh") ? "，" : ", ");
    const link = document.createElement("a");
    link.className = "pill";
    link.href = `/sets/${encodeURIComponent(pin.slug)}`;
    link.textContent = t("hero.view");
    el.append(title, facts, link);
    return el;
  };

  // The view first (a circle can only be drawn on a map that has one).
  if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], pins[0].area ? 10 : 12);
  else map.fitBounds(pins.map((pin) => [pin.lat, pin.lng]), { padding: [48, 48], maxZoom: 12 });

  for (const pin of pins) {
    const where = [pin.lat, pin.lng];
    if (pin.area) L.circle(where, { radius: 6000, className: "map-area", interactive: false }).addTo(map);
    L.marker(where, {
      title: pin.area ? `${pin.title} (${t("map.rough")})` : pin.title,
      alt: pin.title,
      icon: L.divIcon({
        className: pin.area ? "map-pin map-pin-area" : "map-pin",
        html: pin.cover ? `<img src="/img/${encodeURI(pin.cover)}" alt="">` : "",
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        popupAnchor: [0, -26],
      }),
    }).bindPopup(card(pin), { maxWidth: 240, minWidth: 200 }).addTo(map);
  }
})();
