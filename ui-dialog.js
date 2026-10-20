export const escapeHtml = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
export function createDialog(id, title, description = "") {
  const dialog = document.createElement("dialog"); dialog.id = id; dialog.className = "atlasDialog";
  dialog.setAttribute("aria-labelledby", id + "Title");
  dialog.innerHTML = `<header class="atlasDialogHead"><div><h2 id="${id}Title">${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><button type="button" aria-label="Close ${escapeHtml(title.toLowerCase())}" data-dialog-close>×</button></header><div class="atlasDialogBody"></div>`;
  dialog.querySelector("[data-dialog-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    const r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
  });
  document.body.appendChild(dialog); return dialog;
}
export function notify(text) {
  let box = document.getElementById("atlasNotice");
  if (!box) { box = document.createElement("div"); box.id = "atlasNotice"; box.role = "status"; document.body.appendChild(box); }
  box.textContent = text; box.hidden = false; clearTimeout(box._timer);
  box._timer = setTimeout(() => { box.hidden = true; }, 4000);
}
export function downloadText(filename, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type })), anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
