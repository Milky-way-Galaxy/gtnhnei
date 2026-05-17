/* === GTNH Atlas mobile scroll cleanup === */
(() => {
  "use strict";

  if (window.__GTNH_MOBILE_POLISH_JS__) return;
  window.__GTNH_MOBILE_POLISH_JS__ = true;

  function resetSideScroll(root = document) {
    try {
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;

      const nodes = root.querySelectorAll?.("*") || [];
      for (const el of nodes) {
        if (el.scrollLeft && !el.classList.contains("gtnhFlowBrowserViewer")) {
          el.scrollLeft = 0;
        }
      }
    } catch {}
  }

  function patch() {
    const overlay = document.getElementById("gtnhCalcOverlay");
    if (overlay) {
      overlay.classList.add("mobilePolishedPlanner");
      resetSideScroll(overlay);
    }

    const viewer = document.querySelector(".gtnhFlowBrowserViewer");
    if (viewer) {
      viewer.style.overflow = "auto";
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
      attributes: true,
      attributeFilter: ["class", "style"]
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
