/* === gtnh-flow calculator pinned export tabs v1 === */
(() => {
  if (window.__GTNH_FLOW_LAYOUT_FIX_V1__) return;
  window.__GTNH_FLOW_LAYOUT_FIX_V1__ = true;

  function norm(s) {
    return String(s || "").trim().toLowerCase();
  }

  function markExportTabs() {
    const overlay = document.getElementById("gtnhCalcOverlay");
    if (!overlay) return;

    const buttons = [...overlay.querySelectorAll("button, a")];

    for (const btn of buttons) {
      const txt = norm(btn.textContent);

      if (["summary", "json", "yaml", "gtnh-flow", "errors"].includes(txt)) {
        const row = btn.parentElement;
        if (!row) continue;

        const rowText = norm(row.textContent);

        if (
          rowText.includes("summary") &&
          rowText.includes("json") &&
          rowText.includes("yaml")
        ) {
          row.classList.add("gtnhExportTabsPinned");
        }
      }
    }
  }

  const mo = new MutationObserver(markExportTabs);
  mo.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("load", markExportTabs);
  window.addEventListener("resize", markExportTabs);
  setInterval(markExportTabs, 800);
})();
