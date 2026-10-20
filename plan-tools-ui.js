import { PlanLibrary } from "./plan-library.js";
import { createPlanLink, readPlanLink } from "./plan-share.js";
import { serializePlan } from "./planner-state.js";
export function mountPlanTools(root, { dataset, snapshot, apply, download }) {
  const panel = root.querySelector("#plannerPlanTools");
  let removed = null;
  panel.innerHTML =
    '<details id="plannerLibrary"><summary>Saved plans and sharing</summary><p>Keep named factory plans on this browser. Download JSON for a portable backup.</p><label for="plannerPlanName">Plan name<input id="plannerPlanName" maxlength="100" autocomplete="off"></label><button type="button" id="plannerSaveNew">Save current as new</button><label for="plannerSavedPlan">Saved plans for this dataset<select id="plannerSavedPlan"><option value="">Select a saved plan</option></select></label><div class="plannerLibraryActions"><button type="button" id="plannerLoadSaved">Load selected</button><button type="button" id="plannerReplaceSaved">Replace selected with current</button><button type="button" id="plannerDownloadSaved">Download selected JSON</button><button type="button" id="plannerDeleteSaved">Delete selected</button><button type="button" id="plannerUndoDelete" hidden>Undo deletion</button></div><p>Load selected replaces the current draft. Replace selected updates the named plan with the current draft and name.</p><button type="button" id="plannerCreateLink">Create shareable link</button><label id="plannerLinkField" for="plannerShareLink" hidden>Shareable plan link<input id="plannerShareLink" readonly></label><button type="button" id="plannerCopyLink" hidden>Copy link</button><p id="plannerLibraryStatus" role="status" aria-live="polite"></p></details>';
  const field = (id) => panel.querySelector(`#${id}`),
    message = (text) => {
      field("plannerLibraryStatus").textContent = text;
    };
  const library = () => new PlanLibrary(localStorage, dataset());
  function refresh(selected = field("plannerSavedPlan").value) {
    try {
      const entries = library()
          .read()
          .sort(
            (a, b) =>
              b.updatedAt.localeCompare(a.updatedAt) ||
              a.name.localeCompare(b.name),
          ),
        select = field("plannerSavedPlan");
      select.replaceChildren(new Option("Select a saved plan", ""));
      for (const entry of entries) select.add(new Option(entry.name, entry.id));
      select.value = entries.some((entry) => entry.id === selected)
        ? selected
        : "";
      for (const id of [
        "plannerLoadSaved",
        "plannerReplaceSaved",
        "plannerDownloadSaved",
        "plannerDeleteSaved",
      ])
        field(id).disabled = !select.value;
      return entries;
    } catch (error) {
      message(error.message);
      return [];
    }
  }
  field("plannerSavedPlan").addEventListener("change", () => {
    const entries = refresh(),
      entry = entries.find(
        (value) => value.id === field("plannerSavedPlan").value,
      );
    if (entry) field("plannerPlanName").value = entry.name;
  });
  panel.addEventListener("click", async (event) => {
    const id = event.target.closest("button")?.id;
    if (!id) return;
    try {
      if (id === "plannerSaveNew" || id === "plannerReplaceSaved") {
        const selected =
          id === "plannerReplaceSaved" ? field("plannerSavedPlan").value : null;
        if (id === "plannerReplaceSaved" && !selected)
          throw new Error("Select a saved plan first.");
        const entry = library().save(
          field("plannerPlanName").value,
          snapshot(),
          selected,
        );
        refresh(entry.id);
        message(
          `Saved “${entry.name}” on this browser. Download JSON for a backup.`,
        );
      } else if (id === "plannerLoadSaved") {
        apply(library().load(field("plannerSavedPlan").value));
        message("Loaded the saved plan into the current draft.");
      } else if (id === "plannerDownloadSaved") {
        const entry = library()
          .read()
          .find((entry) => entry.id === field("plannerSavedPlan").value);
        if (!entry) throw new Error("Select a saved plan first.");
        download("gtnh-atlas-saved-plan.json", entry.plan, "application/json");
        message("Downloaded the selected saved plan.");
      } else if (id === "plannerDeleteSaved") {
        removed = library().remove(field("plannerSavedPlan").value);
        refresh("");
        field("plannerUndoDelete").hidden = false;
        message(
          `Deleted “${removed.name}”. Undo is available until this page reloads.`,
        );
      } else if (id === "plannerUndoDelete") {
        if (removed) {
          library().restore(removed);
          refresh(removed.id);
          removed = null;
          field("plannerUndoDelete").hidden = true;
          message("Restored the deleted plan.");
        }
      } else if (id === "plannerCreateLink") {
        field("plannerLinkField").hidden = true;
        field("plannerCopyLink").hidden = true;
        message("Creating plan link…");
        const link = await createPlanLink(snapshot(), dataset());
        field("plannerShareLink").value = link;
        field("plannerLinkField").hidden = false;
        field("plannerCopyLink").hidden = false;
        message(
          "Link includes the version, outputs, routes, machine profiles and inventory. Copy it to share this configuration.",
        );
      } else if (id === "plannerCopyLink") {
        try {
          await navigator.clipboard.writeText(field("plannerShareLink").value);
          message("Plan link copied.");
        } catch {
          field("plannerShareLink").focus();
          field("plannerShareLink").select();
          message("Select and copy the link from the field.");
        }
      }
    } catch (error) {
      message(error.message);
    }
  });
  return { refresh };
}
export function installSharedPlanNotice({ dataset, apply, download }) {
  let sequence = 0;
  async function check() {
    if (!dataset()?.sha256) return;
    const current = ++sequence;
    document.getElementById("sharedPlanBanner")?.remove();
    if (!location.hash.startsWith("#plan=")) return;
    const banner = document.createElement("aside");
    banner.id = "sharedPlanBanner";
    banner.setAttribute("aria-label", "Shared production plan");
    const text = document.createElement("p");
    text.setAttribute("role", "status");
    text.textContent = "Reading shared plan…";
    banner.appendChild(text);
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = "Dismiss";
    dismiss.addEventListener("click", clear);
    banner.appendChild(dismiss);
    document.getElementById("status").before(banner);
    function clear() {
      sequence++;
      banner.remove();
      const url = new URL(location.href);
      if (url.hash.startsWith("#plan=")) {
        url.hash = "";
        history.replaceState(null, "", url);
      }
    }
    try {
      const state = await readPlanLink(location.hash, dataset());
      if (current !== sequence || !banner.isConnected) return;
      text.textContent = `Shared plan for ${dataset().label}: ${1 + state.additionalTargets.length} output target(s). Load it to replace the current draft.`;
      const load = document.createElement("button");
      load.type = "button";
      load.id = "loadSharedPlan";
      load.textContent = "Load shared plan";
      load.addEventListener("click", () => {
        apply(state);
        clear();
      });
      banner.insertBefore(load, dismiss);
      const save = document.createElement("button");
      save.type = "button";
      save.textContent = "Download shared JSON";
      save.addEventListener("click", () =>
        download(
          "gtnh-atlas-shared-plan.json",
          serializePlan(state, dataset()),
          "application/json",
        ),
      );
      banner.insertBefore(save, dismiss);
    } catch (error) {
      if (current === sequence) {
        text.textContent = error.message;
        text.setAttribute("role", "alert");
      }
    }
  }
  window.addEventListener("gtnhnei-data-api-ready", check);
  window.addEventListener("hashchange", check);
  check();
}
