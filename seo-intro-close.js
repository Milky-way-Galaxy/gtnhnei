import { getPreference, setPreference, removePreference } from "./preferences.js";

const KEY = "gtnh_atlas_intro_hidden_v1";
let returnFocus;
export function installIntro() {
  const intro = document.getElementById("seoIntro");
  if (!intro || document.getElementById("seoIntroClose")) return;
  const close = document.createElement("button");
  close.id = "seoIntroClose"; close.className = "seoIntroClose"; close.type = "button";
  close.textContent = "Close"; close.setAttribute("aria-label", "Close About Atlas");
  close.addEventListener("click", () => {
    setPreference(KEY, "1"); intro.classList.add("seoIntroHidden");
    (returnFocus || document.getElementById("toolMore"))?.focus({ preventScroll: true });
  });
  intro.appendChild(close);
  intro.classList.toggle("seoIntroHidden", getPreference(KEY) === "1");
}
export function openAtlasIntro(source) {
  installIntro();
  const intro = document.getElementById("seoIntro");
  if (!intro) return;
  returnFocus = source;
  removePreference(KEY); intro.classList.remove("seoIntroHidden");
  document.getElementById("seoIntroClose").focus({ preventScroll: true });
}
