/* === GTNH Atlas mobile scroll cleanup === */
(() => {
  "use strict";

  if (window.__GTNH_MOBILE_POLISH_JS__) return;
  window.__GTNH_MOBILE_POLISH_JS__ = true;

  function patch() {
    const overlay = document.getElementById("gtnhCalcOverlay");
    if (overlay) {
      overlay.classList.add("mobilePolishedPlanner");
    }

    const viewer = document.querySelector(".gtnhFlowBrowserViewer");
    if (viewer) {
      // Do not write the same observed attribute on every observer callback.
      if (viewer.style.overflow !== "auto") viewer.style.overflow = "auto";
    }
  }

  const mo = new MutationObserver(() => {
    clearTimeout(window.__gtnhMobilePolishTimer);
    window.__gtnhMobilePolishTimer = setTimeout(patch, 80);
  });

  function start() {
    patch();
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      // Child insertion is enough to discover panels. Watching style/class here
      // also observes our own patches, tooltips, and every flow pan/zoom update.
    });

    window.addEventListener("resize", patch);
    window.addEventListener("orientationchange", patch);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
