// The map page (/map): one pin per set, its cover in a round frame. Sets
// shown only as a rough area get a dashed frame and a soft circle around
// them (seen when zoomed in). Tapping opens a card with the cover, the name
// and "View set". Pins that would overlap share one pin with a count; its card
// is a scrollable list of the sets there.
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

  const factsOf = (pin) => [pin.location, t("photos", { n: pin.count }), pin.area ? t("map.rough") : ""]
    .filter(Boolean).join(document.documentElement.lang.startsWith("zh") ? "，" : ", ");
  const text = (tag, className, value) => {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = value;
    return el;
  };
  const cover = (pin) => {
    const img = document.createElement("img");
    img.src = `/img/${pin.cover}`;
    img.alt = "";
    return img;
  };

  const card = (pin) => {
    const el = document.createElement("div");
    el.className = "map-card";
    if (pin.cover) el.append(cover(pin));
    const link = text("a", "pill", t("hero.view"));
    link.href = `/sets/${encodeURIComponent(pin.slug)}`;
    el.append(text("p", "map-card-title", pin.title), text("p", "map-card-facts", factsOf(pin)), link);
    return el;
  };

  // Several sets in one place: each is a row (cover, name, facts) linking to it.
  const choices = (here) => {
    const el = document.createElement("div");
    el.className = "map-card";
    const list = document.createElement("ul");
    list.className = "map-choices";
    for (const pin of here) {
      const link = document.createElement("a");
      link.className = "map-choice";
      link.href = `/sets/${encodeURIComponent(pin.slug)}`;
      if (pin.cover) link.append(cover(pin));
      link.append(text("span", "map-choice-title", pin.title), text("span", "map-choice-facts", factsOf(pin)));
      const item = document.createElement("li");
      item.append(link);
      list.append(item);
    }
    el.append(text("p", "map-card-title", t("map.here", { n: here.length })), list);
    return el;
  };

  // The view first (a circle can only be drawn on a map that has one).
  if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], pins[0].area ? 10 : 12);
  else map.fitBounds(pins.map((pin) => [pin.lat, pin.lng]), { padding: [48, 48], maxZoom: 12 });

  for (const pin of pins) {
    if (pin.area) L.circle([pin.lat, pin.lng], { radius: 6000, className: "map-area", interactive: false }).addTo(map);
  }

  // Pins closer than one pin's width would cover each other, so they share a
  // pin. Grouped again after every zoom: zooming in pulls them apart.
  const PIN = 48;
  const markers = L.layerGroup().addTo(map);
  const draw = () => {
    const groups = [];
    for (const pin of pins) {
      const point = map.latLngToLayerPoint([pin.lat, pin.lng]);
      const near = groups.find((g) => g.point.distanceTo(point) < PIN);
      if (near) near.pins.push(pin);
      else groups.push({ point, pins: [pin] });
    }
    markers.clearLayers();
    for (const { pins: here } of groups) {
      const [first] = here;
      const many = here.length > 1;
      const where = [here.reduce((sum, p) => sum + p.lat, 0) / here.length, here.reduce((sum, p) => sum + p.lng, 0) / here.length];
      const label = many ? `${t("map.here", { n: here.length })}: ${here.map((p) => p.title).join(", ")}`
        : first.area ? `${first.title} (${t("map.rough")})` : first.title;
      L.marker(where, {
        title: label,
        alt: label,
        // The frame sits inside Leaflet's box: Leaflet positions that box with a
        // transform, and the hover scale on the box itself would scale its
        // position too (the pin jumped away under the mouse).
        icon: L.divIcon({
          className: "map-pin-box",
          html: `<span class="${!many && first.area ? "map-pin map-pin-area" : "map-pin"}">` +
            (first.cover ? `<img src="/img/${encodeURI(first.cover)}" alt="">` : "") + "</span>" +
            (many ? `<span class="map-pin-count">${here.length}</span>` : ""),
          iconSize: [PIN, PIN],
          iconAnchor: [PIN / 2, PIN / 2],
          popupAnchor: [0, -26],
        }),
      }).bindPopup(many ? choices(here) : card(first), { maxWidth: 260, minWidth: 220 }).addTo(markers);
    }
  };
  draw();
  map.on("zoomend", draw);
})();
