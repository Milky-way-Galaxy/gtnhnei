/* === GTNH calculator shell v1 === */
(() => {
  "use strict";

  const defaultState = {
    target: "",
    amount: 1,
    unit: "items",
    rateMode: "total",
    depth: "1",
    routeMode: "ask",
    machineMode: "auto",
    machineCount: 1,
    settings: {
      waterFree: true,
      steamFree: true,
      cellsReusable: true,
      expandCircuits: false,
      expandMachines: false,
      expandPlatesWires: false
    },
    lockedRoutes: {},
    rawOverrides: [],
    ignored: []
  };

  let state = loadState();
  let codeTab = "summary";
  let calcHasBuiltTree = false;

  function loadState() {
    try {
      const raw = localStorage.getItem("gtnhnei_calc_state");
      if (!raw) return structuredClone(defaultState);
      return { ...structuredClone(defaultState), ...JSON.parse(raw) };
    } catch {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    localStorage.setItem("gtnhnei_calc_state", JSON.stringify(state));
  }

  function esc(x) {
    return String(x ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
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
    el._timer = setTimeout(() => el.classList.remove("show"), 1600);
  }

  function ensureBusyOverlay() {
    let el = document.getElementById("gtnhCalcBusy");
    if (el) return el;

    el = document.createElement("div");
    el.id = "gtnhCalcBusy";
    el.className = "gtnhCalcBusy";
    el.innerHTML = `
      <div class="gtnhCalcBusyBox">
        <div class="gtnhCalcSpinner"></div>
        <div class="gtnhCalcBusyTitle">Building recipe tree</div>
        <div class="gtnhCalcBusyText" id="gtnhCalcBusyText">
          Reading GTNH recipe routes. Big recipe lists can take a moment.
        </div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function setCalcBusy(on, text = "") {
    const el = ensureBusyOverlay();
    const msg = document.getElementById("gtnhCalcBusyText");
    if (msg && text) msg.textContent = text;
    el.classList.toggle("show", !!on);
  }

  function waitForPaint() {
    return new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }


  function createOverlay() {
    if (document.getElementById("gtnhCalcOverlay")) return;

    const ov = document.createElement("div");
    ov.id = "gtnhCalcOverlay";
    ov.className = "gtnhCalcOverlay";
    ov.dataset.mobileTab = "planner";

    ov.innerHTML = `
      <section class="gtnhCalcPanel" role="dialog" aria-label="GTNH calculator">
        <header class="gtnhCalcHead">
          <div>
            <h2>GTNH Calculator</h2>
            <p>Target → route choice → machines → recursive tree → export.</p>
          </div>
          <button class="gtnhCalcClose" id="gtnhCalcClose" type="button">×</button>
        </header>

        <nav class="gtnhCalcTabs">
          <button type="button" data-calc-tab="planner" class="active">Planner</button>
          <button type="button" data-calc-tab="tree">Tree</button>
          <button type="button" data-calc-tab="code">Code / Export</button>
        </nav>

        <main class="gtnhCalcWorkspace">
          <section class="gtnhCalcCol" data-calc-panel="planner">
            <h3>Planner</h3>

            <div class="gtnhCalcField">
              <label>Target item/fluid</label>
              <input id="calcTarget" placeholder="epichlorohydrin, microprocessor, etc.">
            </div>

            <div class="gtnhCalcRow">
              <div class="gtnhCalcField">
                <label>Amount</label>
                <input id="calcAmount" type="number" min="0" step="any">
              </div>
              <div class="gtnhCalcField">
                <label>Unit</label>
                <select id="calcUnit">
                  <option value="items">items</option>
                  <option value="L">L</option>
                  <option value="batches">batches</option>
                </select>
              </div>
            </div>

            <div class="gtnhCalcField">
              <label>Mode</label>
              <select id="calcRateMode">
                <option value="total">total craft</option>
                <option value="per_second">per second</option>
                <option value="per_minute">per minute</option>
                <option value="per_hour">per hour</option>
              </select>
            </div>

            <div class="gtnhCalcField">
              <label>Recursive depth</label>
              <select id="calcDepth">
                <option value="1">1 level</option>
                <option value="3">3 levels</option>
                <option value="full">full recursive</option>
              </select>
            </div>

            <div class="gtnhCalcField">
              <label>Route mode</label>
              <select id="calcRouteMode">
                <option value="ask">ask when multiple routes exist</option>
                <option value="lowest_tier">lowest tier</option>
                <option value="fastest">fastest</option>
                <option value="lowest_eut">lowest EU/t</option>
                <option value="fewest_inputs">fewest inputs</option>
                <option value="manual">manual locked routes</option>
              </select>
            </div>

            <div class="gtnhCalcField">
              <label>Machine mode</label>
              <select id="calcMachineMode">
                <option value="auto">calculate machine count from target rate</option>
                <option value="fixed">I have fixed machine count</option>
              </select>
            </div>

            <div class="gtnhCalcField">
              <label>Machine count</label>
              <input id="calcMachineCount" type="number" min="1" step="1">
            </div>

            <div class="gtnhCalcChecks">
              <label><input id="setWaterFree" type="checkbox"> Treat water as free</label>
              <label><input id="setSteamFree" type="checkbox"> Treat steam as free</label>
              <label><input id="setCellsReusable" type="checkbox"> Empty cells reusable</label>
              <label><input id="setExpandCircuits" type="checkbox"> Expand circuits</label>
              <label><input id="setExpandMachines" type="checkbox"> Expand machines</label>
              <label><input id="setExpandPlatesWires" type="checkbox"> Expand plates/wires</label>
            </div>

            <div class="gtnhCalcActions">
              <button class="primary" id="calcBuild" type="button">Build tree</button>
              <button id="calcUseSearch" type="button">Use search text</button>
              <button id="calcClear" type="button">Clear</button>
            </div>
          </section>

          <section class="gtnhCalcCol" data-calc-panel="tree">
            <h3>Recipe Tree</h3>
            <div id="calcTree" class="gtnhTreeBox"></div>
          </section>

          <section class="gtnhCalcCol" data-calc-panel="code">
            <h3>Code / Export</h3>

            <div class="gtnhCodeTabs">
              <button type="button" data-code-tab="summary" class="active">Summary</button>
              <button type="button" data-code-tab="json">JSON</button>
              <button type="button" data-code-tab="yaml">YAML</button>
              <button type="button" data-code-tab="errors">Errors</button>
            </div>

            <div class="gtnhCalcField">
              <label id="calcCodeLabel">Summary</label>
              <textarea id="calcCodeOut" readonly></textarea>
            </div>

            <div class="gtnhCalcActions">
              <button class="primary" id="calcCopyCode" type="button">Copy</button>
              <button id="calcDownloadJson" type="button">Download JSON</button>
            </div>
          </section>
        </main>
      </section>
    `;

    document.body.appendChild(ov);
    bind();
    syncForm();
    render();
  }

  function bind() {
    document.getElementById("gtnhCalcClose")?.addEventListener("click", close);

    document.querySelectorAll("[data-calc-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.calcTab;
        const ov = document.getElementById("gtnhCalcOverlay");
        ov.dataset.mobileTab = tab;

        document.querySelectorAll("[data-calc-tab]").forEach(b => b.classList.toggle("active", b === btn));
      });
    });

    document.querySelectorAll("[data-code-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        codeTab = btn.dataset.codeTab;
        document.querySelectorAll("[data-code-tab]").forEach(b => b.classList.toggle("active", b === btn));
        renderCode();
      });
    });

    const ids = [
      "calcTarget", "calcAmount", "calcUnit", "calcRateMode", "calcDepth",
      "calcRouteMode", "calcMachineMode", "calcMachineCount"
    ];

    ids.forEach(id => {
      document.getElementById(id)?.addEventListener("input", readForm);
      document.getElementById(id)?.addEventListener("change", readForm);
    });

    const checks = [
      ["setWaterFree", "waterFree"],
      ["setSteamFree", "steamFree"],
      ["setCellsReusable", "cellsReusable"],
      ["setExpandCircuits", "expandCircuits"],
      ["setExpandMachines", "expandMachines"],
      ["setExpandPlatesWires", "expandPlatesWires"]
    ];

    checks.forEach(([id, key]) => {
      document.getElementById(id)?.addEventListener("change", e => {
        state.settings[key] = e.target.checked;
        saveState();
        render();
      });
    });

    document.getElementById("calcBuild")?.addEventListener("click", async () => {
      readForm();
      calcHasBuiltTree = true;

      const ov = document.getElementById("gtnhCalcOverlay");
      if (ov) ov.dataset.mobileTab = "tree";

      document.querySelectorAll("[data-calc-tab]").forEach(b => {
        b.classList.toggle("active", b.dataset.calcTab === "tree");
      });

      setCalcBusy(true, `Building routes for ${state.target || "target"}...`);

      // Let Chrome paint the loading screen before the heavy synchronous recipe lookup.
      await waitForPaint();

      try {
        render();
        toast("Tree built.");
      } catch (err) {
        console.error(err);
        toast("Build failed. Check console/log.");
      } finally {
        setCalcBusy(false);
      }
    });

    document.getElementById("calcUseSearch")?.addEventListener("click", () => {
      const search = document.getElementById("search");
      if (search && search.value.trim()) {
        state.target = search.value.trim();
        syncForm();
        saveState();
        render();
        toast("Copied search text into calculator target.");
      } else {
        toast("Search box is empty.");
      }
    });

    document.getElementById("calcClear")?.addEventListener("click", () => {
      state = structuredClone(defaultState);
      saveState();
      syncForm();
      render();
      toast("Calculator cleared.");
    });

    document.getElementById("calcCopyCode")?.addEventListener("click", async () => {
      const out = document.getElementById("calcCodeOut")?.value || "";
      try {
        await navigator.clipboard.writeText(out);
        toast("Copied.");
      } catch {
        toast("Copy failed.");
      }
    });

    document.getElementById("calcDownloadJson")?.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "gtnhnei_calc_state.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  function syncForm() {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };

    set("calcTarget", state.target);
    set("calcAmount", state.amount);
    set("calcUnit", state.unit);
    set("calcRateMode", state.rateMode);
    set("calcDepth", state.depth);
    set("calcRouteMode", state.routeMode);
    set("calcMachineMode", state.machineMode);
    set("calcMachineCount", state.machineCount);

    const checks = [
      ["setWaterFree", "waterFree"],
      ["setSteamFree", "steamFree"],
      ["setCellsReusable", "cellsReusable"],
      ["setExpandCircuits", "expandCircuits"],
      ["setExpandMachines", "expandMachines"],
      ["setExpandPlatesWires", "expandPlatesWires"]
    ];

    checks.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!state.settings[key];
    });
  }

  function readForm() {
    const val = id => document.getElementById(id)?.value ?? "";

    state.target = val("calcTarget").trim();
    state.amount = Number(val("calcAmount") || 0);
    state.unit = val("calcUnit");
    state.rateMode = val("calcRateMode");
    state.depth = val("calcDepth");
    state.routeMode = val("calcRouteMode");
    state.machineMode = val("calcMachineMode");
    state.machineCount = Math.max(1, Number(val("calcMachineCount") || 1));

    calcHasBuiltTree = false;

    saveState();
    render();
  }

  function targetLine() {
    if (!state.target) return "No target selected.";
    return `${state.amount || 0} ${state.unit}${state.rateMode === "total" ? "" : " / " + state.rateMode.replace("per_", "")} ${state.target}`;
  }

  function renderTree() {
    const box = document.getElementById("calcTree");
    if (!box) return;

    const api = window.GTNHNEI_DATA_API;

    if (!state.lockedRoutes) state.lockedRoutes = {};

    if (!state.target) {
      box.innerHTML = `
        <div class="gtnhTreeNode gtnhTreeWarn">
          <b>No target</b>
          <span>Pick an item/fluid on the left, or press “Use search text”.</span>
        </div>
      `;
      return;
    }

    if (!calcHasBuiltTree) {
      box.innerHTML = `
        <div class="gtnhTreeNode">
          <b>Ready</b>
          <span>Target: ${esc(state.target)}</span>
          <span>Press Build tree to search real production recipes. This avoids freezing while opening or typing.</span>
        </div>
      `;
      return;
    }

    if (!api?.ready) {
      box.innerHTML = `
        <div class="gtnhTreeNode gtnhTreeWarn">
          <b>Database still loading</b>
          <span>Wait until data.bin finishes loading, then press Build tree again.</span>
        </div>
      `;
      return;
    }

    const found = api.find(state.target);
    const prod = api.production(state.target);
    const selectedKey = String(state.target).toLowerCase();
    const selectedIndex = state.lockedRoutes[selectedKey];

    if (!found) {
      box.innerHTML = `
        <div class="gtnhTreeNode gtnhTreeWarn">
          <b>Target not found</b>
          <span>${esc(state.target)} was not found in the NEI database.</span>
        </div>
      `;
      return;
    }

    const routes = prod?.recipes || [];

    let statusHtml = "";
    if (!prod?.ok) {
      statusHtml = `
        <div class="gtnhTreeNode gtnhTreeWarn">
          <b>Recipe lookup failed</b>
          <span>${esc(prod?.error || "unknown error")}</span>
        </div>
      `;
    } else if (routes.length === 0) {
      statusHtml = `
        <div class="gtnhTreeNode gtnhTreeWarn">
          <b>No production recipe</b>
          <span>This is raw/unresolved for calculator purposes.</span>
        </div>
      `;
    } else if (routes.length === 1) {
      statusHtml = `
        <div class="gtnhTreeNode">
          <b>1 production route found</b>
          <span>Auto-selected. Recursive expansion comes next.</span>
        </div>
      `;
    } else {
      statusHtml = `
        <div class="gtnhTreeNode gtnhTreeWarn">
          <b>${routes.length} production routes found</b>
          <span>Choose one route. Do not let GTNH silently pick cursed chemistry routes.</span>
        </div>
      `;
    }

    const routeCards = routes.map((r, i) => {
      const selected = String(i) === String(selectedIndex) || (routes.length === 1 && selectedIndex === undefined);
      const badges = [
        r.tier ? `Tier ${r.tier}` : "",
        r.eut !== "" ? `${r.eut} EU/t` : "",
        r.duration !== "" ? `${r.duration} ticks/time` : ""
      ].filter(Boolean);

      return `
        <article class="gtnhRouteCard ${selected ? "selected" : ""}">
          <div class="gtnhRouteTop">
            <div>
              <div class="gtnhRouteTitle">Route ${i + 1}: ${esc(r.machine)}</div>
              <div class="gtnhRouteSub">${esc(r.machineText || "No machine text")}</div>
            </div>
          </div>

          <div class="gtnhRouteBadges">
            ${badges.length ? badges.map(b => `<span>${esc(b)}</span>`).join("") : "<span>no EU/time data exposed yet</span>"}
          </div>

          <div class="gtnhEmbeddedNeiCard" data-live-production-card="${i}" data-live-target="${esc(found.name)}">
            <div class="gtnhRouteIo">
              <div><b>Loading NEI card...</b></div>
            </div>
          </div>

          <div class="gtnhRouteActions">
            <button class="primary" type="button" data-calc-route="${i}">${selected ? "Selected" : "Use this route"}</button>
            <button type="button" data-open-recipe="${esc(found.name)}">Open NEI recipe</button>
            <button type="button" data-open-usage="${esc(found.name)}">Open NEI usage</button>
          </div>
        </article>
      `;
    }).join("");

    box.innerHTML = `
      <div class="gtnhTreeNode">
        <b>${esc(found.name)}</b>
        <span>Target: ${esc(targetLine())}</span>
        <span>Type: ${esc(found.type || "unknown")} • iconId: ${esc(found.iconId ?? "none")}</span>
      </div>

      ${statusHtml}

      <div class="gtnhTreeNode">
        <b>Machine mode</b>
        <span>${state.machineMode === "auto"
          ? "Calculate machine count from target rate."
          : `Fixed machine count: ${esc(state.machineCount)}`}</span>
      </div>

      <div class="gtnhRouteList">
        ${routeCards || ""}
      </div>
    `;

    box.querySelectorAll("[data-calc-route]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.lockedRoutes[selectedKey] = Number(btn.dataset.calcRoute);
        saveState();
        render();
        toast("Route locked for " + found.name + ".");
      });
    });

    box.querySelectorAll("[data-open-recipe]").forEach(btn => {
      btn.addEventListener("click", () => {
        api.openRecipe(btn.dataset.openRecipe);
      });
    });

    box.querySelectorAll("[data-open-usage]").forEach(btn => {
      btn.addEventListener("click", () => {
        api.openUsage(btn.dataset.openUsage);
      });
    });
  }

  function makeSummary() {
    return [
      "GTNHNEI Calculator Summary",
      "",
      "Target:",
      "  " + targetLine(),
      "",
      "Route mode:",
      "  " + state.routeMode,
      "",
      "Machine mode:",
      "  " + (state.machineMode === "auto"
        ? "auto-calculate machine count from target rate"
        : `fixed machine count = ${state.machineCount}`),
      "",
      "Expansion:",
      "  depth = " + state.depth,
      "",
      "Settings:",
      "  water_free = " + state.settings.waterFree,
      "  steam_free = " + state.settings.steamFree,
      "  cells_reusable = " + state.settings.cellsReusable,
      "  expand_circuits = " + state.settings.expandCircuits,
      "  expand_machines = " + state.settings.expandMachines,
      "  expand_plates_wires = " + state.settings.expandPlatesWires,
      "",
      "Status:",
      "  UI shell ready. Real route picker and recipe expansion come next."
    ].join("\n");
  }

  function makeYaml() {
    return [
      "target:",
      `  name: ${state.target || ""}`,
      `  amount: ${state.amount || 0}`,
      `  unit: ${state.unit}`,
      `  mode: ${state.rateMode}`,
      "",
      "calculator:",
      `  depth: ${state.depth}`,
      `  route_mode: ${state.routeMode}`,
      `  machine_mode: ${state.machineMode}`,
      `  machine_count: ${state.machineCount}`,
      "",
      "settings:",
      `  water_free: ${state.settings.waterFree}`,
      `  steam_free: ${state.settings.steamFree}`,
      `  cells_reusable: ${state.settings.cellsReusable}`,
      `  expand_circuits: ${state.settings.expandCircuits}`,
      `  expand_machines: ${state.settings.expandMachines}`,
      `  expand_plates_wires: ${state.settings.expandPlatesWires}`
    ].join("\n");
  }

  function makeErrors() {
    const errors = [];

    if (!state.target) {
      errors.push("No target selected.");
    }

    if (state.routeMode !== "ask") {
      errors.push("Warning: route mode is not 'ask'. In GTNH this can choose a bad route later.");
    }

    errors.push("Recipe expansion not implemented yet. This shell is safe placeholder logic.");

    return errors.map((e, i) => `${i + 1}. ${e}`).join("\n");
  }

  function hydrateLiveRecipeCards() {
    const api = window.GTNHNEI_LIVE_RECIPE_CARD_API;
    if (!api?.ready) return;

    document.querySelectorAll("[data-live-production-card]").forEach(mount => {
      if (mount.dataset.liveDone === "1") return;

      const target = mount.dataset.liveTarget || state.target;
      const index = Number(mount.dataset.liveProductionCard || 0);

      try {
        const ok = api.mountProduction(target, index, mount);
        if (ok) {
          mount.dataset.liveDone = "1";
        }
      } catch (err) {
        console.warn("live NEI card mount failed:", err);
      }
    });
  }

  function renderCode() {
    const out = document.getElementById("calcCodeOut");
    const label = document.getElementById("calcCodeLabel");
    if (!out || !label) return;

    if (codeTab === "summary") {
      label.textContent = "Summary";
      out.value = makeSummary();
    } else if (codeTab === "json") {
      label.textContent = "JSON state";
      out.value = JSON.stringify(state, null, 2);
    } else if (codeTab === "yaml") {
      label.textContent = "YAML export draft";
      out.value = makeYaml();
    } else {
      label.textContent = "Errors / warnings";
      out.value = makeErrors();
    }
  }

  function render() {
    renderTree();
    renderCode();

    // Mount real NEI cards after HTML exists.
    // This preserves normal tooltip/click/tap behavior.
    setTimeout(hydrateLiveRecipeCards, 0);
  }

  function open() {
    createOverlay();
    syncForm();
    render();
    document.getElementById("gtnhCalcOverlay")?.classList.add("show");
  }

  function close() {
    document.getElementById("gtnhCalcOverlay")?.classList.remove("show");
  }

  window.GTNH_CALC = { open, close, getState: () => state };
})();

/* === CALCULATOR FRONT ACTION FIX v1 START === */
(() => {
  if (window.__GTNH_CALC_FRONT_ACTION_FIX_V1__) return;
  window.__GTNH_CALC_FRONT_ACTION_FIX_V1__ = true;

  let tapTimer = null;
  let lastTapName = "";
  let lastTapTime = 0;
  let longPressTimer = null;
  let suppressClickUntil = 0;

  function calcOverlay() {
    return document.getElementById("gtnhCalcOverlay");
  }

  function isInCalc(el) {
    const ov = calcOverlay();
    return !!(ov && el && ov.contains(el));
  }

  function clickCloseButton() {
    const ov = calcOverlay();
    if (!ov) return;

    const btn =
      ov.querySelector("#calcClose") ||
      ov.querySelector("[data-calc-close]") ||
      ov.querySelector("[aria-label='Close']") ||
      [...ov.querySelectorAll("button")].find(b => String(b.textContent || "").trim() === "×");

    if (btn) {
      btn.click();
      return;
    }

    // Conservative fallback. Do not set hidden=true because your open() may not undo it.
    ov.classList.remove("show", "open", "active");
    ov.style.display = "none";
  }

  function getSlotName(start) {
    const root = start?.closest?.(".gtnhEmbeddedNeiCard");
    if (!root) return "";

    let el = start;
    while (el && el !== root && el.nodeType === 1) {
      const ds = el.dataset || {};

      const name =
        ds.gtnhIconName ||
        ds.gtnhName ||
        ds.name ||
        ds.itemName ||
        ds.fluidName ||
        el.getAttribute("data-gtnh-icon-name") ||
        el.getAttribute("data-name") ||
        el.getAttribute("aria-label") ||
        el.getAttribute("title");

      if (name && String(name).trim()) {
        return String(name).trim();
      }

      el = el.parentElement;
    }

    return "";
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
    el._timer = setTimeout(() => el.classList.remove("show"), 1600);
  }

  async function copyName(name) {
    try {
      await navigator.clipboard.writeText(name);
      toast("Copied: " + name);
    } catch {
      toast("Copy failed: " + name);
    }
  }

  function ensureReturnPill() {
    let pill = document.getElementById("gtnhCalcReturnPill");
    if (pill) return pill;

    pill = document.createElement("button");
    pill.id = "gtnhCalcReturnPill";
    pill.type = "button";
    pill.textContent = "Back to Calculator";
    pill.addEventListener("click", () => {
      const ov = calcOverlay();
      if (!ov) return;

      ov.classList.remove("gtnhCalcParked");
      ov.style.display = "";
      pill.classList.remove("show");
    });

    document.body.appendChild(pill);
    return pill;
  }

  function parkCalculator() {
    const ov = calcOverlay();
    if (!ov) return;

    ov.classList.add("gtnhCalcParked");
    ov.style.display = "none";

    const pill = ensureReturnPill();
    pill.classList.add("show");
  }

  function openRealNei(name, mode) {
    if (!name) return;

    // Do NOT fully close/reopen calculator. That causes rebuild lag.
    // Park it, open NEI, then let the return pill restore the same calculator DOM/state.
    parkCalculator();

    setTimeout(() => {
      try {
        if (mode === "usage") {
          window.GTNHNEI_MAIN_API?.usage?.(name);
        } else {
          window.GTNHNEI_MAIN_API?.recipe?.(name);
        }
      } catch (err) {
        console.warn("Failed to open real NEI:", mode, name, err);
      }
    }, 60);
  }

  function stop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
  }

  // Fix the calculator buttons opening NEI behind the overlay.
  document.addEventListener("click", event => {
    const target = event.target;
    if (!isInCalc(target)) return;

    const recipeBtn = target.closest?.("[data-open-recipe]");
    const usageBtn = target.closest?.("[data-open-usage]");

    if (recipeBtn) {
      stop(event);
      openRealNei(recipeBtn.dataset.openRecipe, "recipe");
      return;
    }

    if (usageBtn) {
      stop(event);
      openRealNei(usageBtn.dataset.openUsage, "usage");
      return;
    }
  }, true);

  // Long press = copy.
  document.addEventListener("pointerdown", event => {
    const target = event.target;
    if (!isInCalc(target)) return;

    const name = getSlotName(target);
    if (!name) return;

    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      suppressClickUntil = Date.now() + 700;
      copyName(name);
    }, 650);
  }, true);

  document.addEventListener("pointerup", () => {
    clearTimeout(longPressTimer);
  }, true);

  document.addEventListener("pointercancel", () => {
    clearTimeout(longPressTimer);
  }, true);

  document.addEventListener("pointermove", () => {
    clearTimeout(longPressTimer);
  }, true);

  // Tap = recipe, double tap = usage.
  document.addEventListener("click", event => {
    const target = event.target;
    if (!isInCalc(target)) return;

    const name = getSlotName(target);
    if (!name) return;

    stop(event);

    if (Date.now() < suppressClickUntil) return;

    const now = Date.now();
    const isDouble = lastTapName === name && now - lastTapTime < 330;

    clearTimeout(tapTimer);

    if (isDouble) {
      lastTapName = "";
      lastTapTime = 0;
      openRealNei(name, "usage");
      return;
    }

    lastTapName = name;
    lastTapTime = now;

    tapTimer = setTimeout(() => {
      openRealNei(name, "recipe");
      lastTapName = "";
      lastTapTime = 0;
    }, 260);
  }, true);

  // Desktop right click = usage.
  document.addEventListener("contextmenu", event => {
    const target = event.target;
    if (!isInCalc(target)) return;

    const name = getSlotName(target);
    if (!name) return;

    stop(event);
    openRealNei(name, "usage");
  }, true);
})();
/* === CALCULATOR FRONT ACTION FIX v1 END === */

/* === CALCULATOR MOBILE QUICK ACTIONS v1 START === */
(() => {
  if (window.__GTNH_CALC_MOBILE_QUICK_ACTIONS_V1__) return;
  window.__GTNH_CALC_MOBILE_QUICK_ACTIONS_V1__ = true;

  function overlay() {
    return document.getElementById("gtnhCalcOverlay");
  }

  function ensureQuickActions() {
    const ov = overlay();
    if (!ov) return;

    if (document.getElementById("gtnhCalcQuickActions")) return;

    const bar = document.createElement("div");
    bar.id = "gtnhCalcQuickActions";
    bar.innerHTML = `
      <button type="button" id="gtnhCalcQuickBuild">Build tree</button>
      <button type="button" id="gtnhCalcQuickTree">Tree</button>
    `;

    ov.appendChild(bar);

    document.getElementById("gtnhCalcQuickBuild")?.addEventListener("click", () => {
      document.getElementById("calcBuild")?.click();
    });

    document.getElementById("gtnhCalcQuickTree")?.addEventListener("click", () => {
      const treeBtn =
        document.querySelector("[data-calc-tab='tree']") ||
        [...document.querySelectorAll("#gtnhCalcOverlay button")]
          .find(b => String(b.textContent || "").trim().toLowerCase() === "tree");

      treeBtn?.click();
    });
  }

  const timer = setInterval(ensureQuickActions, 500);

  window.addEventListener("load", ensureQuickActions);
  window.addEventListener("resize", ensureQuickActions);
})();
/* === CALCULATOR MOBILE QUICK ACTIONS v1 END === */

/* === CALCULATOR COMPACT BUILD BUTTON v1 START === */
(() => {
  if (window.__GTNH_CALC_COMPACT_BUILD_V1__) return;
  window.__GTNH_CALC_COMPACT_BUILD_V1__ = true;

  function installCompactBuild() {
    const ov = document.getElementById("gtnhCalcOverlay");
    if (!ov) return;

    if (document.getElementById("gtnhCalcCompactBuild")) return;

    const treeTab =
      ov.querySelector("[data-calc-tab='tree']") ||
      [...ov.querySelectorAll("button")].find(b => String(b.textContent || "").trim().toLowerCase() === "tree");

    const parent = treeTab?.parentElement;
    if (!parent) return;

    const btn = document.createElement("button");
    btn.id = "gtnhCalcCompactBuild";
    btn.type = "button";
    btn.textContent = "Build";
    btn.addEventListener("click", () => {
      document.getElementById("calcBuild")?.click();
    });

    parent.appendChild(btn);
  }

  const timer = setInterval(installCompactBuild, 400);
  window.addEventListener("load", installCompactBuild);
  window.addEventListener("resize", installCompactBuild);
})();
/* === CALCULATOR COMPACT BUILD BUTTON v1 END === */

/* === CALCULATOR YAML EXPORT WIRING v1 START === */
(() => {
  if (window.__GTNH_CALC_YAML_EXPORT_WIRING_V1__) return;
  window.__GTNH_CALC_YAML_EXPORT_WIRING_V1__ = true;

  let yamlModeActive = false;
  let lastYaml = "";

  function getState() {
    try {
      return window.GTNH_CALC?.getState?.() || {};
    } catch {
      return {};
    }
  }

  function getTarget() {
    const st = getState();

    return String(
      st.target ||
      document.getElementById("calcTarget")?.value ||
      document.querySelector("[name='target']")?.value ||
      ""
    ).trim();
  }

  function getRouteIndex(target) {
    const st = getState();
    const key = String(target || "").toLowerCase();

    const locked =
      st.lockedRoutes?.[key] ??
      st.lockedRoutes?.[String(target || "")] ??
      0;

    const n = Number(locked);
    return Number.isFinite(n) ? n : 0;
  }

  function outputEl() {
    return (
      document.getElementById("calcCodeOut") ||
      document.querySelector("#gtnhCalcOverlay textarea") ||
      document.querySelector("#gtnhCalcOverlay pre")
    );
  }

  function setOutput(text) {
    const out = outputEl();
    if (!out) return false;

    if ("value" in out) out.value = text;
    else out.textContent = text;

    return true;
  }

  function fileSafe(s) {
    return String(s || "target")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "target";
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
    el._timer = setTimeout(() => el.classList.remove("show"), 1600);
  }

  function buildYaml() {
    const api = window.GTNHNEI_FLOW_EXPORT_API;
    const target = getTarget();

    if (!target) {
      lastYaml = "# No target selected.\n";
      setOutput(lastYaml);
      return;
    }

    if (!api?.ready) {
      lastYaml = "# GTNH-flow export API is not ready yet. Wait for data load, then press YAML again.\n";
      setOutput(lastYaml);
      return;
    }

    const routeIndex = getRouteIndex(target);
    const st = getState();

    try {
      const result = api.yamlForRecipe(target, routeIndex, {
        targetAmount: st.targetAmount || st.amount || 1
      });

      lastYaml = result.yaml || "# YAML export failed.\n";
      setOutput(lastYaml);

      const dl = [...document.querySelectorAll("#gtnhCalcOverlay button")]
        .find(b => /download/i.test(String(b.textContent || "")));

      if (dl) dl.textContent = "Download YAML";

      toast(result.ok ? "YAML draft generated." : "YAML draft generated with warning.");
    } catch (err) {
      lastYaml =
`# YAML export crashed.
# ${String(err?.message || err)}
`;
      setOutput(lastYaml);
      toast("YAML export crashed.");
    }
  }

  async function copyYaml() {
    if (!lastYaml) buildYaml();

    try {
      await navigator.clipboard.writeText(lastYaml);
      toast("Copied YAML.");
    } catch {
      toast("Copy failed.");
    }
  }

  function downloadYaml() {
    if (!lastYaml) buildYaml();

    const target = getTarget();
    const blob = new Blob([lastYaml], { type: "text/yaml;charset=utf-8" });
    const a = document.createElement("a");

    a.href = URL.createObjectURL(blob);
    a.download = `gtnh-flow_${fileSafe(target)}.yaml`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);

    toast("Downloaded YAML.");
  }

  document.addEventListener("click", event => {
    const btn = event.target?.closest?.("button");
    if (!btn) return;

    const inCalc = btn.closest("#gtnhCalcOverlay");
    if (!inCalc) return;

    const txt = String(btn.textContent || "").trim().toLowerCase();

    if (txt === "yaml") {
      yamlModeActive = true;
      setTimeout(buildYaml, 80);
      return;
    }

    if (yamlModeActive && txt === "copy") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      copyYaml();
      return;
    }

    if (yamlModeActive && txt.includes("download")) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      downloadYaml();
      return;
    }

    if (["summary", "json", "errors"].includes(txt)) {
      yamlModeActive = false;
    }
  }, true);

  window.GTNH_CALC_YAML_EXPORT = {
    buildYaml,
    copyYaml,
    downloadYaml
  };
})();
/* === CALCULATOR YAML EXPORT WIRING v1 END === */
