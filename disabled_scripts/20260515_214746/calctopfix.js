/* === GTNH Calculator top bar desktop/mobile action fix v1 === */
(() => {
  if (window.__GTNH_CALC_TOPBAR_FIX_V1__) return;
  window.__GTNH_CALC_TOPBAR_FIX_V1__ = true;

  function overlay() {
    return document.getElementById("gtnhCalcOverlay");
  }

  function norm(s) {
    return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function toast(text) {
    let el = document.getElementById("gtnhCalcToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "gtnhCalcToast";
      el.className = "gtnhCalcToast";
      document.body.appendChild(el);
    }

    el.textContent = text;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 1200);
  }

  function isMainTopRow(btn) {
    const row = btn?.parentElement;
    if (!row) return false;

    const text = norm(row.textContent);
    return (
      text.includes("planner") &&
      text.includes("tree") &&
      text.includes("code / export")
    );
  }

  function findPanelRoot(seed) {
    const ov = overlay();
    if (!ov || !seed) return seed;

    const panelSelectors = [
      ".gtnhCalcPanel",
      ".calcPanel",
      ".gtnhCalcPane",
      ".calcPane",
      ".gtnhCalcCard",
      ".calcCard",
      ".panel",
      "section",
      "article"
    ].join(",");

    let el = seed;

    while (el && el !== ov) {
      if (
        el.matches?.(panelSelectors) &&
        el.offsetWidth > 120 &&
        el.offsetHeight > 90
      ) {
        return el;
      }
      el = el.parentElement;
    }

    // Fallback: use the direct child area, not the whole overlay.
    el = seed;
    let last = seed;

    while (el && el.parentElement && el.parentElement !== ov) {
      last = el;
      el = el.parentElement;
    }

    return last || seed;
  }

  function panelFor(tab) {
    const selectors = {
      planner: [
        "#calcPlanner",
        "#calcTarget",
        "#calcAmount",
        "#setWaterFree"
      ],
      tree: [
        "#calcTreePanel",
        "#calcTree",
        "[data-calc-route]",
        "[data-live-production-card]"
      ],
      code: [
        "#calcCodePanel",
        "#calcCodeOut",
        "#calcCodeLabel",
        "#gtnhFlowRealPanel",
        "#gtnhFlowCalcPanel"
      ]
    };

    for (const sel of selectors[tab] || []) {
      const el = document.querySelector(sel);
      if (el) return findPanelRoot(el);
    }

    return null;
  }

  function setActiveTab(tab) {
    const ov = overlay();
    if (!ov) return;

    ov.dataset.mobileTab = tab;

    ov.querySelectorAll("[data-calc-tab]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.calcTab === tab);
      btn.setAttribute("aria-pressed", btn.dataset.calcTab === tab ? "true" : "false");
    });
  }

  function focusPanel(tab) {
    const target = panelFor(tab);
    if (!target) {
      toast("Panel not found: " + tab);
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });

    target.classList.remove("gtnhCalcPanelPulse");
    void target.offsetWidth;
    target.classList.add("gtnhCalcPanelPulse");

    setTimeout(() => {
      target.classList.remove("gtnhCalcPanelPulse");
    }, 900);
  }

  function buildThenFocusTree() {
    const realBuild =
      document.getElementById("calcBuild") ||
      [...document.querySelectorAll("#gtnhCalcOverlay button")]
        .find(b => norm(b.textContent) === "build tree");

    if (!realBuild) {
      toast("Build button not found.");
      return;
    }

    realBuild.click();

    setActiveTab("tree");
    setTimeout(() => focusPanel("tree"), 180);
  }

  function isTopBuild(btn) {
    if (!btn) return false;
    const t = norm(btn.textContent);
    return t === "build" && isMainTopRow(btn);
  }

  document.addEventListener("click", event => {
    const btn = event.target?.closest?.("button");
    const ov = overlay();

    if (!btn || !ov || !ov.contains(btn)) return;

    const mainTab = btn.closest("[data-calc-tab]");

    if (mainTab) {
      const tab = mainTab.dataset.calcTab;

      if (!["planner", "tree", "code"].includes(tab)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      setActiveTab(tab);
      focusPanel(tab);
      return;
    }

    if (isTopBuild(btn)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      buildThenFocusTree();
    }
  }, true);

  // Also make keyboard Enter/Space work after focusing top buttons.
  document.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const btn = event.target?.closest?.("button");
    const ov = overlay();

    if (!btn || !ov || !ov.contains(btn)) return;

    const mainTab = btn.closest("[data-calc-tab]");
    if (mainTab || isTopBuild(btn)) {
      event.preventDefault();
      btn.click();
    }
  }, true);

  window.GTNH_CALC_TOPBAR_FIX = {
    focusPlanner: () => {
      setActiveTab("planner");
      focusPanel("planner");
    },
    focusTree: () => {
      setActiveTab("tree");
      focusPanel("tree");
    },
    focusCode: () => {
      setActiveTab("code");
      focusPanel("code");
    },
    build: buildThenFocusTree
  };
})();
