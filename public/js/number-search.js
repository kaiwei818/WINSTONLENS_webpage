// The jersey number box and its suggestions (a combobox: type, or pick with
// the arrow keys), shared by the set page (js/set.js) and the Sports page
// (js/sports-search.js). Both pages use the same ids: #number-search,
// #number-options, #number-clear.
//
// numbers: the numbers to suggest, in order. countOf(n): how many photos have n.
// onPick(n): show n's photos ("" shows all again). say(text): the status line.
// none: the "no photos tagged #99" message's text key.

import { t } from "./text.js";

export function numberSearch({ numbers, countOf, onPick, say, none }) {
  const search = document.getElementById("number-search");
  const options = document.getElementById("number-options");
  const clearButton = document.getElementById("number-clear");
  let active = -1;

  function showOptions() {
    const typed = search.value;
    const found = numbers.filter((n) => n.startsWith(typed));
    active = found.indexOf(typed);
    options.replaceChildren(...found.map((n, i) => {
      const li = document.createElement("li");
      li.id = `number-option-${n}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === active));
      li.dataset.number = n;
      const label = document.createElement("span");
      label.textContent = `#${n}`;
      const count = document.createElement("span");
      count.className = "number-count";
      count.textContent = t("photos", { n: countOf(n) });
      li.append(label, count);
      // pointerdown, not click: picks before the box loses focus and the list closes.
      li.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        choose(n);
      });
      return li;
    }));
    const open = document.activeElement === search && found.length > 0;
    options.hidden = !open;
    search.setAttribute("aria-expanded", String(open));
    search.setAttribute("aria-activedescendant", open && active >= 0 ? `number-option-${found[active]}` : "");
    if (typed && !found.length) say(t(none, { number: typed }));
  }
  function closeOptions() {
    options.hidden = true;
    search.setAttribute("aria-expanded", "false");
    search.removeAttribute("aria-activedescendant");
  }
  function choose(n) {
    onPick(n);
    closeOptions();
    search.blur(); // on phones: put the keyboard away, so the photos show
  }

  search.addEventListener("focus", showOptions);
  search.addEventListener("blur", closeOptions);
  search.addEventListener("input", () => {
    search.value = search.value.replace(/\D/g, "");
    // The photos follow as soon as the typed number is one that has photos.
    if (!search.value) onPick("");
    else if (numbers.includes(search.value)) onPick(search.value);
    else say("");
    clearButton.hidden = !search.value;
    showOptions();
  });
  search.addEventListener("keydown", (event) => {
    const items = [...options.children];
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (options.hidden) return showOptions();
      if (!items.length) return;
      active = (active + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.setAttribute("aria-selected", String(i === active)));
      search.setAttribute("aria-activedescendant", items[active].id);
      items[active].scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const pick = items[active]?.dataset.number || (numbers.includes(search.value) ? search.value : "");
      if (pick) choose(pick);
    } else if (event.key === "Escape" && !options.hidden) {
      event.preventDefault();
      closeOptions();
    }
  });
  clearButton.addEventListener("click", () => {
    onPick("");
    search.focus();
  });
}
