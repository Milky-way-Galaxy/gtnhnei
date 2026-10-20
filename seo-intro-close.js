/* === GTNH Atlas closeable intro === */
import { getPreference, setPreference, removePreference } from "./preferences.js";
(() => {
  "use strict";

  const KEY = "gtnh_atlas_intro_hidden_v1";

  function qs(s, r = document) {
    return r.querySelector(s);
  }

  function makeShowButton() {
    if (qs("#seoIntroShow")) return;

    const btn = document.createElement("button");
    btn.id = "seoIntroShow";
    btn.type = "button";
    btn.textContent = "Show intro";
    btn.className = "seoIntroShow";

    btn.addEventListener("click", () => {
      removePreference(KEY);
      const intro = qs("#seoIntro");
      if (intro) intro.classList.remove("seoIntroHidden");
      btn.remove();
    });

    const nav =
      qs("#gtnhTopStrip") ||
      qs(".gtnhTopStrip") ||
      qs("nav") ||
      qs(".topStrip");

    if (nav) nav.appendChild(btn);
    else document.body.prepend(btn);
  }

  function start() {
    const intro = qs("#seoIntro");
    if (!intro) return;

    if (!qs("#seoIntroClose", intro)) {
      const btn = document.createElement("button");
      btn.id = "seoIntroClose";
      btn.type = "button";
      btn.className = "seoIntroClose";
      btn.textContent = "×";
      btn.setAttribute("aria-label", "Hide intro");

      btn.addEventListener("click", () => {
        setPreference(KEY, "1");
        intro.classList.add("seoIntroHidden");
        makeShowButton();
      });

      intro.prepend(btn);
    }

    if (getPreference(KEY) === "1") {
      intro.classList.add("seoIntroHidden");
      makeShowButton();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
