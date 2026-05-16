/* === GTNH Workbench top strip cleanup v1 === */
(() => {
  if (window.__GTNH_TOPSTRIP_CLEAN_V1__) return;
  window.__GTNH_TOPSTRIP_CLEAN_V1__ = true;

  function norm(s) {
    return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function isInsideCalculator(el) {
    return !!el.closest?.("#gtnhCalcOverlay, .gtnhCalcOverlay, .gtnhFlowCalcPanel, #gtnhFlowRealPanel");
  }

  function looksLikeTopStrip(row) {
    if (!row) return false;

    const txt = norm(row.textContent);

    return (
      txt.includes("calculator") &&
      txt.includes("favorites") &&
      txt.includes("help")
    );
  }

  function cleanTopStrip() {
    const clickable = [...document.querySelectorAll("button, a, [role='button']")];

    for (const el of clickable) {
      if (isInsideCalculator(el)) continue;

      const txt = norm(el.textContent);
      const row = el.parentElement;

      if (!looksLikeTopStrip(row)) continue;

      // Remove redundant top Flow button.
      if (txt === "flow") {
        el.classList.add("gtnhTopFlowHidden");
        el.setAttribute("aria-hidden", "true");
        el.tabIndex = -1;
        continue;
      }

      // Turn database version button into a compact badge.
      if (/^gtnh\s*2\.8\.x$/.test(txt) || txt.includes("gtnh 2.8.x")) {
        el.classList.add("gtnhDbBadgeClean");

        if (!txt.startsWith("db:")) {
          el.textContent = "DB: GTNH 2.8.x";
        }

        el.setAttribute("aria-label", "Current database: GTNH 2.8.x");
        el.title = "Current database: GTNH 2.8.x";
      }
    }
  }

  const mo = new MutationObserver(cleanTopStrip);
  mo.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("load", cleanTopStrip);
  window.addEventListener("resize", cleanTopStrip);
  setInterval(cleanTopStrip, 800);

  cleanTopStrip();
})();
