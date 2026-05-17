/* === Split Planner and Material Calculator v3 === */
(() => {
  "use strict";

  if (window.__GTNH_NAV_SPLIT_V3__) return;
  window.__GTNH_NAV_SPLIT_V3__ = true;

  function install() {
    const oldCalc = document.getElementById("toolCalc");
    if (!oldCalc) return;

    oldCalc.textContent = "Planner";
    oldCalc.title = "Route planner, recipe tree, YAML, gtnh-flow export";

    let btn = document.getElementById("toolMatCalc");

    if (!btn) {
      btn = document.createElement("button");
      btn.id = "toolMatCalc";
      btn.type = "button";
      btn.title = "Material calculator";
      oldCalc.insertAdjacentElement("afterend", btn);

      btn.addEventListener("click", () => {
        if (window.GTNH_MATCALC?.open) {
          window.GTNH_MATCALC.open();
        } else {
          alert("Material calculator is still loading.");
        }
      });
    }

    btn.textContent = "Calculator";
  }

  function renameOldOverlay() {
    const ov = document.getElementById("gtnhCalcOverlay");
    if (!ov) return;

    [...ov.querySelectorAll("h1,h2,h3,div,span")].forEach(el => {
      if (String(el.textContent || "").trim() === "GTNH Calculator") {
        el.textContent = "Material Calculator";
      }
    });
  }

  const mo = new MutationObserver(() => {
    clearTimeout(window.__gtnhNavSplitTimer);
    window.__gtnhNavSplitTimer = setTimeout(() => {
      install();
      renameOldOverlay();
    }, 80);
  });

  function start() {
    install();
    renameOldOverlay();
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
