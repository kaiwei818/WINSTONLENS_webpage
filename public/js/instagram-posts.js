// The record of Instagram posts you made from a set's picks (lib/instagram.js),
// shown on the Instagram picks page and on each set's admin page: when, the
// vertical or horizontal group, how many photos, a strip of them, the link to
// the post and your note. Edit adds or changes the link and note; Undo posted
// removes the record and puts its photos back in your picks.

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// "2026-11-12 06:10:24" (UTC, from the database) -> "12 Nov 2026" in your time zone.
function postedDate(text) {
  const date = new Date(`${text.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function send(method, id, body) {
  const response = await fetch(`/api/admin/instagram/posts/${id}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Please try again.");
  return data;
}

// posts: records for one set. onChange(): called after an edit or an undo,
// so the page can reload what it shows.
export function postRecordList(posts, { onChange, showSet = false } = {}) {
  const list = el("ul", "ig-posts");
  for (const post of posts) list.append(postRecord(post, { onChange, showSet }));
  return list;
}

function postRecord(post, { onChange, showSet }) {
  const item = el("li", "ig-post");
  const head = el("p", "ig-post-head");
  const posted = el("strong", "", `Posted ${postedDate(post.posted_at)}`);
  head.append(posted, el("span", "muted", `${post.orientation === "vertical" ? "Vertical" : "Horizontal"}, ${plural(post.photo_count, "photo")}${showSet ? `, ${post.set_title}` : ""}`));

  const strip = el("div", "ig-post-strip");
  for (const key of post.thumbs) {
    const img = document.createElement("img");
    img.src = `/img/${key}`;
    img.alt = "";
    img.loading = "lazy";
    strip.append(img);
  }
  if (post.photo_count > post.thumbs.length) strip.append(el("span", "ig-post-more", `+${post.photo_count - post.thumbs.length}`));

  const link = el("p", "ig-post-link");
  if (post.url) {
    const a = el("a", "", "Open the post on Instagram");
    a.href = post.url;
    a.target = "_blank";
    a.rel = "noopener";
    link.append(a);
  } else {
    link.append(el("span", "muted", "No link yet"));
  }
  const note = post.note ? el("p", "ig-post-note", post.note) : null;
  const status = el("p", "form-error");
  status.setAttribute("role", "alert");

  const actions = el("div", "actions");
  const edit = el("button", "button-secondary", post.url ? "Edit link or note" : "Add link or note");
  edit.type = "button";
  const undo = el("button", "button-secondary", "Undo posted");
  undo.type = "button";
  actions.append(edit, undo);

  // Edit, in place: the link and the note, then Save or Cancel.
  const form = el("form", "ig-post-form");
  form.hidden = true;
  const urlLabel = el("label", "", "Link to the post");
  const urlInput = el("input");
  urlInput.type = "url";
  urlInput.placeholder = "https://www.instagram.com/p/...";
  urlInput.value = post.url;
  urlLabel.append(urlInput);
  const noteLabel = el("label", "", "Note");
  const noteInput = el("input");
  noteInput.type = "text";
  noteInput.maxLength = 200;
  noteInput.placeholder = "For example: caption idea, hashtags, likes";
  noteInput.value = post.note;
  noteLabel.append(noteInput);
  const save = el("button", "", "Save");
  save.type = "submit";
  const cancel = el("button", "button-secondary", "Cancel");
  cancel.type = "button";
  const formActions = el("div", "actions");
  formActions.append(save, cancel);
  form.append(urlLabel, noteLabel, formActions);

  edit.addEventListener("click", () => {
    form.hidden = false;
    actions.hidden = true;
    urlInput.focus();
  });
  cancel.addEventListener("click", () => {
    form.hidden = true;
    actions.hidden = false;
    status.textContent = "";
    edit.focus();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    save.disabled = true;
    try {
      await send("PATCH", post.id, { url: urlInput.value, note: noteInput.value });
      onChange?.();
    } catch (err) {
      status.textContent = err.message;
      save.disabled = false;
    }
  });
  undo.addEventListener("click", async () => {
    if (!confirm(`Undo this post? Its ${plural(post.photo_count, "photo")} go back into your Instagram picks, and the link and note are removed.`)) return;
    undo.disabled = true;
    try {
      await send("DELETE", post.id);
      onChange?.();
    } catch (err) {
      status.textContent = err.message;
      undo.disabled = false;
    }
  });

  item.append(head, strip, link, ...(note ? [note] : []), actions, form, status);
  return item;
}

// "Mark as posted": asks for the link and a note in the page's #posted-dialog,
// then saves the record. Resolves to true when saved, false when cancelled.
export function markAsPosted({ setId, orientation, photoIds, title }) {
  const dialog = document.getElementById("posted-dialog");
  const form = dialog.querySelector("form");
  const error = dialog.querySelector(".form-error");
  dialog.querySelector("#posted-title").textContent = title;
  dialog.querySelector("#posted-count").textContent =
    `These ${plural(photoIds.length, "photo")} leave your picks and are kept as a record of the post. You can add the link later.`;
  form.reset();
  error.textContent = "";
  dialog.showModal();
  dialog.querySelector("#posted-url").focus();

  return new Promise((resolve) => {
    const finish = (saved) => {
      form.removeEventListener("submit", onSubmit);
      dialog.querySelector("#posted-cancel").removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancel);
      dialog.close();
      resolve(saved);
    };
    const onCancel = (event) => { event.preventDefault(); finish(false); };
    const onSubmit = async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      const response = await fetch("/api/admin/instagram/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set_id: setId, orientation, photo_ids: photoIds, url: form.url.value, note: form.note.value }),
      }).catch(() => null);
      submit.disabled = false;
      if (response?.ok) return finish(true);
      error.textContent = (await response?.json().catch(() => null))?.error || "Could not save. Please try again.";
    };
    form.addEventListener("submit", onSubmit);
    dialog.querySelector("#posted-cancel").addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onCancel);
  });
}
