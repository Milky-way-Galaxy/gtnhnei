import { createDialog, escapeHtml } from "./ui-dialog.js";
let dialog;
export function openThemePicker() {
  const api = window.GTNH_THEME;
  if (!api) return;
  if (!dialog) {
    dialog = createDialog("atlasThemeDialog", "Theme", "Choose a look for Atlas. Changes apply immediately.");
    dialog.querySelector(".atlasDialogBody").innerHTML = `<fieldset class="themeOptions"><legend>Color theme</legend>${api.themes.map(theme => `<label class="themeOption" data-theme-option="${theme.id}"><input type="radio" name="atlasTheme" value="${theme.id}" aria-label="${escapeHtml(theme.label)}" aria-describedby="${theme.id}Description"><span class="themePreview" aria-hidden="true"></span><span><b>${escapeHtml(theme.label)}</b><small id="${theme.id}Description">${escapeHtml(theme.description)}</small></span></label>`).join("")}</fieldset><p id="atlasThemeStatus" class="atlasMuted" role="status" aria-live="polite"></p>`;
    dialog.addEventListener("change", event => {
      if (!event.target.matches('[name="atlasTheme"]')) return;
      const { persisted } = api.select(event.target.value);
      dialog.querySelector("#atlasThemeStatus").textContent = persisted ? "Saved on this device." : "Applied for this tab. Browser storage is unavailable.";
    });
  }
  dialog.querySelectorAll('[name="atlasTheme"]').forEach(input => { input.checked = input.value === api.current; });
  dialog.querySelector("#atlasThemeStatus").textContent = "";
  dialog.showModal();
  dialog.querySelector("input:checked")?.focus();
}
