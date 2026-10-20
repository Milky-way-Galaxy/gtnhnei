import { calculateProduction } from "./production-engine.js";
/* === GTNH Atlas Material Calculator v4: manual ignore filters === */
(() => {
  "use strict";

  if (window.__GTNH_MATERIAL_CALC_V4__) return;
  window.__GTNH_MATERIAL_CALC_V4__ = true;

  const STORE_KEY = "gtnh_material_calc_state_v4";

  function scopedKey() {
    const id = window.GTNH_DATASETS?.active?.id;
    return !id || id === "gtnh-2.8.0" ? STORE_KEY : `${STORE_KEY}_${id}`;
  }
  const defaultState = {
    target: "",
    amount: 1,
    amountMode: "runs", // runs | target | stacks
    routeIndex: 0,
    depth: 1,
    nodeLimit: 2500,

    waterFree: false,
    steamFree: false,
    cellsReusable: true,
    ignoreCircuits: true,
    ignoreTargetOutputs: true,

    manualIgnored: []
  };

  let state = loadState();
  let lastRows = [];
  let lastCandidateIds = [];
  let lastErrors = [];
  let saveTimer = null;

  function loadState() {
    let old = {};
    let newer = {};

    for (const key of (scopedKey() === STORE_KEY ? [
      "gtnh_material_calc_state_v1",
      "gtnh_material_calc_state_v2",
      "gtnh_material_calc_state_v3"
    ] : [])) {
      try {
        old = { ...old, ...JSON.parse(localStorage.getItem(key) || "{}") };
      } catch {}
    }

    try {
      newer = JSON.parse(localStorage.getItem(scopedKey()) || "{}");
    } catch {}

    const merged = { ...defaultState, ...old, ...newer };

    if (!Array.isArray(merged.manualIgnored)) merged.manualIgnored = [];

    let migrated = false;
    try { migrated = localStorage.getItem(scopedKey() === STORE_KEY ? "gtnh_material_calc_v4_migrated" : scopedKey() + "_migrated") === "1"; } catch {}
    if (!migrated) {
      merged.cellsReusable = newer.cellsReusable ?? old.cellsReusable ?? true;
      merged.ignoreCircuits = newer.ignoreCircuits ?? old.ignoreCircuits ?? true;
      merged.ignoreTargetOutputs = newer.ignoreTargetOutputs ?? old.ignoreTargetOutputs ?? true;
      merged.amountMode = merged.amountMode || "runs";
      merged.depth = Math.max(1, Number(merged.depth || 1));
      merged.manualIgnored = Array.isArray(merged.manualIgnored) ? merged.manualIgnored : [];

      try {
        localStorage.setItem(scopedKey() === STORE_KEY ? "gtnh_material_calc_v4_migrated" : scopedKey() + "_migrated", "1");
        localStorage.setItem(scopedKey(), JSON.stringify(merged));
      } catch {}
    }

    return merged;
  }

  function saveState() {
    state.manualIgnored = normalizeNameList(state.manualIgnored);
    try { localStorage.setItem(scopedKey(), JSON.stringify(state)); }
    catch { toast("Settings cannot be saved in this browser. Copy results before closing."); }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      readForm();
      saveState();
    }, 120);
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function compact(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function cleanName(s) {
    const text = String(s || "").trim();
    if (/^[ifo]:/.test(text)) return text;
    return text
      .replace(/^x\d+\s+/i, "")
      .replace(/^L\s+/i, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function normalizeNameList(list) {
    const seen = new Set();
    const out = [];

    for (const raw of list || []) {
      const name = cleanName(raw);
      const key = ignoredKey(name);

      if (!name || !key || seen.has(key)) continue;

      seen.add(key);
      out.push(name);
    }

    return out.sort((a, b) => a.localeCompare(b));
  }
  const ignoredKey = name => /^[ifo]:/.test(name) ? name : compact(name);

  function migrateIgnoredNames() {
    const catalog = window.GTNH_CATALOG;
    if (!catalog) return;
    const names = state.manualIgnored.filter(value => !/^[ifo]:/.test(value));
    if (!names.length) return;
    const keys = new Set(names.map(compact)), resolved = new Set(), ids = [];
    for (const good of catalog.goods) {
      const key = compact(good.name);
      if (keys.has(key)) { ids.push(good.id); resolved.add(key); }
    }
    // Preserve all variants previously covered by a legacy name. They can now
    // be unignored independently; unknown legacy labels remain recoverable.
    state.manualIgnored = normalizeNameList([...state.manualIgnored.filter(name => !resolved.has(compact(name))), ...ids]);
  }

  function clampInt(v, min, max) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function amountText(n) {
    n = Number(n);

    if (!Number.isFinite(n)) return String(n);

    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(3).replace(/\.?0+$/, "") + "B";
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(3).replace(/\.?0+$/, "") + "M";
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(3).replace(/\.?0+$/, "") + "k";

    return String(Math.round(n * 1000000) / 1000000);
  }

  function toast(text) {
    let el = document.getElementById("gtnhSmallHint") || document.getElementById("gtnhCalcToast");

    if (!el) {
      el = document.createElement("div");
      el.id = "gtnhSmallHint";
      el.className = "gtnhSmallHint";
      document.body.appendChild(el);
    }

    el.textContent = text;
    el.classList.add("show");

    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function getSearchText() {
    const selectors = [
      "#search",
      "#q",
      "#searchBox",
      "#searchInput",
      "input[type='search']",
      "input[placeholder*='Search' i]",
      "input[placeholder*='item' i]",
      "input[placeholder*='fluid' i]",
      ".search input",
      ".topSearch input",
      ".neiSearch input"
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const value = String(el?.value || "").trim();
      if (value) return value;
    }

    const active = document.activeElement;
    if (active && active.tagName === "INPUT") {
      const value = String(active.value || "").trim();
      if (value) return value;
    }

    return "";
  }

  function manualIgnoredSet() {
    return new Set(normalizeNameList(state.manualIgnored).map(ignoredKey));
  }

  function isManualIgnored(name, ignored = manualIgnoredSet()) {
    const good = window.GTNH_CATALOG?.resolve(name);
    return ignored.has(ignoredKey(name)) || !!(good && ignored.has(compact(good.name)));
  }

  function collectCandidatesForPopup() {
    const names = new Set();

    for (const row of lastRows || []) {
      if (row?.id || row?.name) names.add(row.id || cleanName(row.name));
    }

    for (const name of lastCandidateIds || []) {
      if (name) names.add(cleanName(name));
    }

    const catalog = window.GTNH_CATALOG, target = catalog?.resolve(state.target);
    const recipe = target ? catalog.recipes(target)[state.routeIndex] : null;
    if (recipe) {
      for (const io of [...recipe.inputs, ...recipe.outputs]) names.add(io.id);
    }

    for (const name of state.manualIgnored || []) {
      names.add(cleanName(name));
    }

    return [...names]
      .filter(Boolean)
      .sort((a, b) => (catalog?.resolve(a)?.name || a).localeCompare(catalog?.resolve(b)?.name || b));
  }

  function calculate() {
    readForm(); saveState();
    lastErrors = []; lastRows = []; lastCandidateIds = [];
    window.GTNH_MATCALC.lastPlan = null;
    const catalog = window.GTNH_CATALOG;
    try {
      if (!catalog) throw new Error("Recipe data is still loading.");
      migrateIgnoredNames();
      const target = catalog.resolve(state.target);
      if (!target) throw new Error("Select an exact item/fluid name or ID. Duplicate names need an exact ID.");
      const routeChoices = {}, externalInputs = [], freeInputs = [], ignored = manualIgnoredSet();
      const makers = window.GTNH_MAKER_API;
      for (const id of Object.keys(makers?.getState().externalInputs || {})) if (/^[ifo]:/.test(id) && makers.isExternalInput(id)) externalInputs.push(id);
      for (const id of state.manualIgnored) if (/^[ifo]:/.test(id) && catalog.resolve(id)) freeInputs.push(id);
      for (const good of catalog.goods) {
        const name = (good.name || "").toLowerCase();
        const maker = makers?.makerInfo(good.id);
        if (maker) routeChoices[good.id] = maker.recipeId || maker.routeIndex;
        if (makers?.isExternalInput(good.id) || state.ignoreCircuits && good.id !== target.id && /circuit/.test(name)) externalInputs.push(good.id);
        if (isManualIgnored(good.id, ignored) || state.waterFree && name === "water" || state.steamFree && ["steam", "superheated steam", "dense steam"].includes(name)) freeInputs.push(good.id);
      }
      routeChoices[target.id] = state.routeIndex;
      const result = calculateProduction(catalog, { target: target.id, amount: state.amount,
        unit: state.amountMode === "runs" ? "batches" : state.amountMode === "stacks" ? "stacks" : catalog.describe(target).unit, depth: state.depth,
        rounding: "fractional", nodeLimit: state.nodeLimit, routeChoices, externalInputs, freeInputs, routeMode: "ask" });
      lastRows = result.materials.map(row => ({ ...row, sources: row.reason, depth: 0 })).sort((a,b) => a.name.localeCompare(b.name));
      lastCandidateIds = [...result.materials, ...result.reusable, ...result.byproducts].map(row => row.id);
      lastErrors = result.warnings;
      window.GTNH_MATCALC.lastPlan = result;
      renderResults();
      let extra = document.getElementById("matAdditionalResults");
      if (!extra) { extra = document.createElement("div"); extra.id = "matAdditionalResults"; document.getElementById("matResults").after(extra); }
      extra.innerHTML = `<details ${state.cellsReusable ? "open" : ""}><summary>Reusable startup stock (${result.reusable.length})</summary><ul>${result.reusable.map(row => `<li>${esc(amountText(row.amount))} ${esc(row.unit)} ${esc(row.name)}</li>`).join("")}</ul></details><details><summary>Byproducts and surplus (${result.byproducts.length})</summary><ul>${result.byproducts.map(row => `<li>${esc(amountText(row.amount))} ${esc(row.unit)} ${esc(row.name)}</li>`).join("")}</ul></details>`;
      return result;
    } catch (error) { lastErrors = [error.message]; document.getElementById("matAdditionalResults")?.remove(); renderResults(); return null; }
  }

  function ensureOverlay() {
    let ov = document.getElementById("gtnhMatCalcOverlay");
    if (ov) return ov;

    ov = document.createElement("div");
    ov.id = "gtnhMatCalcOverlay";
    ov.className = "gtnhMatCalcOverlay";

    ov.innerHTML = `
      <div class="gtnhMatCalcCard">
        <div class="gtnhMatCalcHead">
          <div>
            <h2>Material Calculator</h2>
            <p>Pick target → amount → depth → calculate raw materials.</p>
          </div>
          <button type="button" id="gtnhMatCalcClose" class="gtnhMatCalcClose">×</button>
        </div>

        <div class="gtnhMatCalcGrid">
          <section class="gtnhMatCalcPanel gtnhMatCalcInput">
            <h3>Setup</h3>

            <label>
              Target item/fluid
              <div class="matInline">
                <input id="matTarget" list="matGoods" placeholder="Exact name or item/fluid ID" autocomplete="off"><datalist id="matGoods"></datalist>
                <button type="button" id="matUseSearch">Import NEI search</button>
              </div>
            </label>

            <div class="gtnhMatCalcTwo">
              <label>
                Amount
                <input id="matAmount" type="number" min="0" step="any">
              </label>

              <label>
                Amount means
                <select id="matAmountMode">
                  <option value="runs">recipe runs</option>
                  <option value="target">target amount</option>
                  <option value="stacks">target stacks (native item size)</option>
                </select>
              </label>
            </div>

            <div class="gtnhMatCalcTwo">
              <label>
                Route
                <input id="matRoute" type="number" min="1" step="1">
              </label>

              <label>
                Max depth
                <input id="matDepth" type="number" min="1" max="50" step="1">
              </label>
            </div>

            <label class="matRouteLabel">Production route<select id="matRouteChoice"><option value="">Enter an exact target first</option></select></label>
            <div class="gtnhMatCalcActions">
              <button type="button" id="matCalculate" class="primary">Calculate</button>
              <button type="button" id="matDeepCalculate">Deep calculate</button>
              <button type="button" id="matOpenIgnorePicker">Choose ignored</button>
              <button type="button" id="matOpenRecipe">Recipe</button>
              <button type="button" id="matOpenUsage">Usage</button>
            </div>

            <details class="matFilters">
              <summary>Basic filters</summary>

              <div class="gtnhMatCheckGrid">
                <label class="matCheck"><input id="matWaterFree" type="checkbox"> Ignore water</label>
                <label class="matCheck"><input id="matSteamFree" type="checkbox"> Ignore steam</label>
                <label class="matCheck"><input id="matCellsReusable" type="checkbox"> Expand reusable stock details</label>
                <label class="matCheck"><input id="matIgnoreCircuits" type="checkbox"> Don't expand circuit production</label>
              </div>

              <label>
                Safety node limit
                <input id="matNodeLimit" type="number" min="100" max="20000" step="100">
              </label>
            </details>

            <div id="matManualIgnoredSummary" class="matManualIgnoredSummary"></div>
          </section>

          <section class="gtnhMatCalcPanel gtnhMatCalcOutput">
            <div class="gtnhMatCalcResultHead">
              <h3>Materials</h3>
              <span id="matResultCount">0 rows</span>
            </div>

            <div id="matErrors" class="gtnhMatCalcErrors"></div>
            <div id="matResults" class="gtnhMatCalcResults"></div>

            <div class="gtnhMatCalcActions">
              <button type="button" id="matCopyTable">Copy table</button>
              <button type="button" id="matCopyJson">Copy JSON</button>
            </div>
          </section>
        </div>
      </div>
    `;

    document.body.appendChild(ov);

    ov.querySelector("#gtnhMatCalcClose")?.addEventListener("click", close);

    ov.addEventListener("click", event => {
      if (event.target === ov) close();
    });

    ov.addEventListener("input", event => {
      if (event.target?.id === "matTarget") {
        const query = event.target.value.toLowerCase(), list = ov.querySelector("#matGoods");
        list.innerHTML = (window.GTNH_CATALOG?.goods.filter(good => (good.name || "").toLowerCase().includes(query) || good.id.toLowerCase().includes(query)).slice(0,25) || []).map(good => `<option value="${esc(good.id)}">${esc(good.name)} · ${esc(good.mod)}</option>`).join("");
      }
      if (event.target?.id?.startsWith("mat")) scheduleSave();
    });

    ov.addEventListener("change", event => {
      if (event.target?.id?.startsWith("mat")) {
        readForm();
        saveState();
        if (event.target.id === "matTarget") syncForm();
      }
    });

    ov.querySelector("#matRouteChoice").addEventListener("change", event => {
      if (event.target.value !== "") { ov.querySelector("#matRoute").value = Number(event.target.value) + 1; calculate(); }
    });
    ov.querySelector("#matCalculate")?.addEventListener("click", calculate);

    ov.querySelector("#matDeepCalculate")?.addEventListener("click", () => {
      state.depth = 50;
      syncForm();
      saveState();
      calculate();
    });

    ov.querySelector("#matOpenIgnorePicker")?.addEventListener("click", () => {
      readForm();
      saveState();
      openIgnorePicker();
    });

    ov.querySelector("#matUseSearch")?.addEventListener("click", () => {
      const searchText = getSearchText();

      if (!searchText) {
        toast("NEI search box is empty.");
        return;
      }

      state.target = searchText;
      syncForm();
      readForm();
      saveState();

      toast("Imported NEI search: " + searchText);
      calculate();
    });

    ov.querySelector("#matOpenRecipe")?.addEventListener("click", () => {
      readForm();
      saveState();

      if (!state.target) return toast("No target.");

      window.GTNHNEI_MAIN_API?.recipe?.(state.target);
      close();
    });

    ov.querySelector("#matOpenUsage")?.addEventListener("click", () => {
      readForm();
      saveState();

      if (!state.target) return toast("No target.");

      window.GTNHNEI_MAIN_API?.usage?.(state.target);
      close();
    });

    ov.querySelector("#matCopyTable")?.addEventListener("click", async () => {
      const text = [
        "amount\tmaterial\tsource",
        ...lastRows.map(r => `${amountText(r.amount)}\t${r.name}\t${r.sources}`)
      ].join("\n");

      await navigator.clipboard.writeText(text);
      toast("Copied table.");
    });

    ov.querySelector("#matCopyJson")?.addEventListener("click", async () => {
      await navigator.clipboard.writeText(JSON.stringify(lastRows, null, 2));
      toast("Copied JSON.");
    });

    return ov;
  }

  function ensureIgnoreOverlay() {
    let ov = document.getElementById("gtnhIgnorePickerOverlay");
    if (ov) return ov;

    ov = document.createElement("div");
    ov.id = "gtnhIgnorePickerOverlay";
    ov.className = "gtnhIgnorePickerOverlay";

    ov.innerHTML = `
      <div class="gtnhIgnorePickerCard">
        <div class="gtnhIgnorePickerHead">
          <div>
            <h2>Ignored materials</h2>
            <p>Tap a material to toggle ignore/unignore. Red = ignored.</p>
          </div>
          <button type="button" id="gtnhIgnorePickerClose">×</button>
        </div>

        <div class="gtnhIgnoreManualAdd">
          <input id="gtnhIgnoreManualText" list="matGoods" aria-label="Material name or exact ID to ignore" placeholder="material name or exact item/fluid ID">
          <button type="button" id="gtnhIgnoreManualAddBtn">Add</button>
        </div>

        <div class="gtnhIgnorePickerActions">
          <button type="button" id="gtnhIgnoreRecalc">Apply + recalculate</button>
          <button type="button" id="gtnhIgnoreClear">Clear manual ignored</button>
          <button type="button" id="gtnhIgnoreUseCurrent">Use current result list</button>
        </div>

        <div id="gtnhIgnoreChips" class="gtnhIgnoreChips"></div>
      </div>
    `;

    document.body.appendChild(ov);

    ov.addEventListener("click", event => {
      if (event.target === ov) closeIgnorePicker();
    });

    ov.querySelector("#gtnhIgnorePickerClose")?.addEventListener("click", closeIgnorePicker);

    ov.querySelector("#gtnhIgnoreManualAddBtn")?.addEventListener("click", () => {
      const input = document.getElementById("gtnhIgnoreManualText");
      const name = cleanName(input?.value || "");

      if (!name) {
        toast("Empty material name.");
        return;
      }

      const good = window.GTNH_CATALOG?.resolve(name);
      if (!good) { toast("Select an exact name or item/fluid ID. Duplicate names need an ID."); return; }
      addManualIgnored(good.id);
      if (input) input.value = "";
      renderIgnorePicker();
      syncForm();
      saveState();
    });

    ov.querySelector("#gtnhIgnoreManualText")?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        ov.querySelector("#gtnhIgnoreManualAddBtn")?.click();
      }
    });

    ov.querySelector("#gtnhIgnoreClear")?.addEventListener("click", () => {
      state.manualIgnored = [];
      saveState();
      renderIgnorePicker();
      syncForm();
      toast("Manual ignored list cleared.");
    });

    ov.querySelector("#gtnhIgnoreUseCurrent")?.addEventListener("click", () => {
      const names = lastRows.map(r => r.id || r.name).filter(Boolean);

      if (!names.length) {
        toast("No current result list.");
        return;
      }

      state.manualIgnored = normalizeNameList([...state.manualIgnored, ...names]);
      saveState();
      renderIgnorePicker();
      syncForm();
      toast("Current materials added to ignored list.");
    });

    ov.querySelector("#gtnhIgnoreRecalc")?.addEventListener("click", () => {
      saveState();
      closeIgnorePicker();
      calculate();
    });

    return ov;
  }

  function addManualIgnored(name) {
    state.manualIgnored = normalizeNameList([...state.manualIgnored, name]);
  }

  function removeManualIgnored(name) {
    const key = ignoredKey(name);
    state.manualIgnored = normalizeNameList(
      (state.manualIgnored || []).filter(x => ignoredKey(x) !== key)
    );
  }

  function toggleManualIgnored(name) {
    if (isManualIgnored(name)) {
      removeManualIgnored(name);
    } else {
      addManualIgnored(name);
    }

    saveState();
  }

  function openIgnorePicker() {
    migrateIgnoredNames();
    ensureIgnoreOverlay().classList.add("show");
    renderIgnorePicker();
  }

  function closeIgnorePicker() {
    document.getElementById("gtnhIgnorePickerOverlay")?.classList.remove("show");
  }

  function renderIgnorePicker() {
    const box = document.getElementById("gtnhIgnoreChips");
    if (!box) return;

    const names = collectCandidatesForPopup();

    if (!names.length) {
      box.innerHTML = `
        <div class="gtnhIgnoreEmpty">
          No candidates yet. Calculate once, or type a material name manually.
        </div>
      `;
      return;
    }

    const ignored = manualIgnoredSet();

    box.innerHTML = names.map(name => {
      const on = isManualIgnored(name, ignored), good = window.GTNH_CATALOG?.resolve(name);

      return `
        <button type="button" class="gtnhIgnoreChip ${on ? "ignored" : ""}" data-name="${esc(name)}">
          <span>${esc(good?.name || name)}${good ? `<small class="matGoodId">${esc(good.id)}</small>` : ""}</span>
          <b>${on ? "ignored" : "active"}</b>
        </button>
      `;
    }).join("");

    box.querySelectorAll(".gtnhIgnoreChip").forEach(btn => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.name || "";
        toggleManualIgnored(name);
        renderIgnorePicker();
        syncForm();
      });
    });
  }

  function syncForm() {
    migrateIgnoredNames();
    const catalog = window.GTNH_CATALOG, select = document.getElementById("matRouteChoice");
    const target = catalog?.resolve(state.target);
    if (select) {
      const routes = target ? catalog.recipes(target) : [];
      select.innerHTML = routes.length ? routes.map((route,index) => `<option value="${index}">${index+1}. ${esc(route.machine)} · ${route.durationTicks === null ? "time unknown" : amountText(route.durationTicks/20)+"s"} · ${esc(route.eut ?? "unknown")} EU/t</option>`).join("") : '<option value="">No exact target/routes</option>';
      select.value = String(state.routeIndex);
    }
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };

    set("matTarget", state.target);
    set("matAmount", state.amount);
    set("matAmountMode", state.amountMode);
    set("matDepth", clampInt(state.depth, 1, 50));
    set("matRoute", Number(state.routeIndex || 0) + 1);
    set("matNodeLimit", state.nodeLimit || 2500);

    const checks = [
      ["matWaterFree", "waterFree"],
      ["matSteamFree", "steamFree"],
      ["matCellsReusable", "cellsReusable"],
      ["matIgnoreCircuits", "ignoreCircuits"],
      ["matIgnoreTargetOutputs", "ignoreTargetOutputs"]
    ];

    checks.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!state[key];
    });

    const summary = document.getElementById("matManualIgnoredSummary");
    if (summary) {
      const list = normalizeNameList(state.manualIgnored);

      summary.innerHTML = list.length
        ? `<b>Manually ignored:</b> ${list.map(value => esc(catalog?.resolve(value)?.name || value)).join(", ")}`
        : `<b>Manually ignored:</b> none`;
    }
  }

  function readForm() {
    const val = id => document.getElementById(id)?.value ?? "";

    state.target = String(val("matTarget")).trim();
    state.amount = Math.max(0, Number(val("matAmount") || 1));
    state.amountMode = ["target", "stacks"].includes(val("matAmountMode")) ? val("matAmountMode") : "runs";
    state.depth = clampInt(val("matDepth") || 1, 1, 50);
    state.routeIndex = Math.max(0, Number(val("matRoute") || 1) - 1);
    state.nodeLimit = clampInt(val("matNodeLimit") || 2500, 100, 20000);

    state.waterFree = !!document.getElementById("matWaterFree")?.checked;
    state.steamFree = !!document.getElementById("matSteamFree")?.checked;
    state.cellsReusable = !!document.getElementById("matCellsReusable")?.checked;
    state.ignoreCircuits = document.getElementById("matIgnoreCircuits")?.checked ?? state.ignoreCircuits;
    state.ignoreTargetOutputs = document.getElementById("matIgnoreTargetOutputs")?.checked ?? state.ignoreTargetOutputs;

    state.manualIgnored = normalizeNameList(state.manualIgnored);
  }

  function renderResults() {
    const count = document.getElementById("matResultCount");
    const errors = document.getElementById("matErrors");
    const box = document.getElementById("matResults");

    if (count) count.textContent = `${lastRows.length} row${lastRows.length === 1 ? "" : "s"}`;

    if (errors) {
      errors.innerHTML = lastErrors.length
        ? lastErrors.map(e => `<div>${esc(e)}</div>`).join("")
        : "";
    }

    if (!box) return;

    if (!lastRows.length) {
      box.innerHTML = `<div class="matEmpty">No result yet.</div>`;
      syncForm();
      return;
    }

    box.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Amount</th>
            <th>Material</th>
            <th>Action</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          ${lastRows.map(r => `
            <tr data-good-id="${esc(r.id)}" data-good-name="${esc(r.name)}">
              <td>${esc(amountText(r.amount))} ${esc(r.unit || "items")}</td>
              <td><span class="matGoodName">${esc(r.name)}</span>${window.GTNH_CATALOG?.matches(r.name).length > 1 ? `<small class="matGoodId">${esc(r.id)}</small>` : ""}</td>
              <td>
                <button type="button" class="matIgnoreInlineBtn" data-name="${esc(r.id || r.name)}">
                  ignore
                </button>
              </td>
              <td>${esc(r.sources)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    box.querySelectorAll(".matIgnoreInlineBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        addManualIgnored(btn.dataset.name || "");
        saveState();
        calculate();
        toast("Ignored: " + (btn.dataset.name || ""));
      });
    });

    syncForm();
  }

  function open(initialTarget = "") {
    const ov = ensureOverlay();

    if (initialTarget) state.target = initialTarget;
    if (!state.target) state.target = getSearchText();

    syncForm();
    renderResults();

    ov.classList.add("show");

    const card = ov.querySelector(".gtnhMatCalcCard");
    if (card) card.scrollTop = 0;

    setTimeout(() => {
      document.getElementById("matTarget")?.focus?.();
    }, 80);
  }

  function close() {
    readForm();
    saveState();
    document.getElementById("gtnhMatCalcOverlay")?.classList.remove("show");
  }

  window.addEventListener("gtnh-dataset-selected", () => { state = loadState(); lastRows = []; });
  window.GTNH_MATCALC = {
    open,
    close,
    calculate,
    openIgnorePicker,
    getState: () => structuredClone(state),
    getLastRows: () => lastRows.slice(),
    getManualIgnored: () => normalizeNameList(state.manualIgnored)
  };
})();
