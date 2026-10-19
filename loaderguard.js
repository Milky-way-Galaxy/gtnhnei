// Only this module owns the boot overlay. Slow downloads must never replace app DOM.
const loader = document.getElementById("bootLoader");
const message = loader.querySelector(".bootMsg");
const note = loader.querySelector(".bootNote");
const retry = document.getElementById("bootRetry");
const search = document.getElementById("search");
const clear = document.getElementById("clear");
let slowTimer;

export function onRetry(callback) {
  retry.addEventListener("click", callback);
}

export function setLoadState(phase, text) {
  clearTimeout(slowTimer);
  loader.dataset.state = phase;
  message.textContent = text;
  retry.hidden = phase !== "error";
  document.getElementById("bootResetDataset")?.toggleAttribute("hidden", phase !== "error");
  search.disabled = clear.disabled = phase !== "ready";
  note.textContent = "";
  loader.querySelector(".bootBar").hidden = phase === "error";
  loader.hidden = phase === "ready";

  if (phase !== "ready" && phase !== "error") {
    slowTimer = setTimeout(() => {
      note.textContent = "The database is large. Loading is still in progress; you can keep this tab open.";
    }, 25000);
  }
}

setLoadState("fetch", "Fetching recipe database…");

// Recovery for removed/unavailable dataset links or stale saved selections.
const reset = document.createElement("button");
reset.hidden = true;
reset.id = "bootResetDataset"; reset.type = "button"; reset.textContent = "Use bundled dataset";
reset.addEventListener("click", () => {
  try { localStorage.removeItem("gtnh_atlas_dataset_v1"); } catch { /* Recover via URL. */ }
  const url = new URL(location.href); url.searchParams.delete("dataset"); location.assign(url);
});
retry.after(reset);
