/* === GTNH Atlas Material Calculator v4: manual ignore filters === */
(() => {
  "use strict";

  if (window.__GTNH_MATERIAL_CALC_V4__) return;
  window.__GTNH_MATERIAL_CALC_V4__ = true;

  const STORE_KEY = "gtnh_material_calc_state_v4";

  const defaultState = {
    target: "",
    amount: 1,
    amountMode: "runs", // runs | target
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
  let lastCandidateNames = [];
  let lastErrors = [];
  let visitedNodes = 0;
  let saveTimer = null;

  function loadState() {
    let old = {};
    let newer = {};

    for (const key of [
      "gtnh_material_calc_state_v1",
      "gtnh_material_calc_state_v2",
      "gtnh_material_calc_state_v3"
    ]) {
      try {
        old = { ...old, ...JSON.parse(localStorage.getItem(key) || "{}") };
      } catch {}
    }

    try {
      newer = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch {}

    const merged = { ...defaultState, ...old, ...newer };

    if (!Array.isArray(merged.manualIgnored)) merged.manualIgnored = [];

    if (localStorage.getItem("gtnh_material_calc_v4_migrated") !== "1") {
      merged.cellsReusable = true;
      merged.ignoreCircuits = true;
      merged.ignoreTargetOutputs = true;
      merged.amountMode = merged.amountMode || "runs";
      merged.depth = Math.max(1, Number(merged.depth || 1));
      merged.manualIgnored = Array.isArray(merged.manualIgnored) ? merged.manualIgnored : [];

      localStorage.setItem("gtnh_material_calc_v4_migrated", "1");
      localStorage.setItem(STORE_KEY, JSON.stringify(merged));
    }

    return merged;
  }

  function saveState() {
    state.manualIgnored = normalizeNameList(state.manualIgnored);
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
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
    return String(s || "")
      .trim()
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
      const key = compact(name);

      if (!name || !key || seen.has(key)) continue;

      seen.add(key);
      out.push(name);
    }

    return out.sort((a, b) => a.localeCompare(b));
  }

  function amountNum(v) {
    const n = Number(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
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

  function parseYaml(yaml) {
    const result = {
      machine: "",
      tier: "",
      eut: "",
      dur: "",
      input: {},
      output: {},
      inputOrder: [],
      outputOrder: []
    };

    let section = "";

    for (const raw of String(yaml || "").split(/\r?\n/)) {
      const line = raw.replace(/#.*$/, "");
      if (!line.trim()) continue;

      const mMachine = line.match(/^\s*-\s*m:\s*(.+?)\s*$/i);
      if (mMachine) {
        result.machine = mMachine[1].trim();
        continue;
      }

      const mTier = line.match(/^\s*tier:\s*(.+?)\s*$/i);
      if (mTier) {
        result.tier = mTier[1].trim();
        continue;
      }

      const mEut = line.match(/^\s*eut:\s*(.+?)\s*$/i);
      if (mEut) {
        result.eut = mEut[1].trim();
        continue;
      }

      const mDur = line.match(/^\s*dur:\s*(.+?)\s*$/i);
      if (mDur) {
        result.dur = mDur[1].trim();
        continue;
      }

      if (/^\s*I:\s*(\{\s*\})?\s*$/i.test(line)) {
        section = "input";
        continue;
      }

      if (/^\s*O:\s*(\{\s*\})?\s*$/i.test(line)) {
        section = "output";
        continue;
      }

      const mItem = line.match(/^\s{4,}(.+?):\s*(.+?)\s*$/);
      if (mItem && section) {
        const name = cleanName(mItem[1]);
        const amt = amountNum(mItem[2]);

        if (!name || name === "{}" || !amt) continue;

        result[section][name] = (result[section][name] || 0) + amt;

        const orderKey = section === "input" ? "inputOrder" : "outputOrder";
        if (!result[orderKey].includes(name)) result[orderKey].push(name);
      }
    }

    return result;
  }

  function normalizeMap(map) {
    const out = {};

    for (const [rawName, rawAmount] of Object.entries(map || {})) {
      const name = cleanName(rawName);
      const amount = amountNum(rawAmount);

      if (!name || !amount) continue;

      out[name] = (out[name] || 0) + amount;
    }

    return out;
  }

  function scaleMap(map, scale) {
    const out = {};

    for (const [name, amount] of Object.entries(map || {})) {
      out[name] = amountNum(amount) * scale;
    }

    return out;
  }

  function manualIgnoredSet() {
    return new Set(normalizeNameList(state.manualIgnored).map(compact));
  }

  function isManualIgnored(name) {
    return manualIgnoredSet().has(compact(name));
  }

  function isIgnoredName(name, productName = "") {
    const c = compact(name);
    const product = compact(productName || state.target);

    if (!c) return true;

    if (isManualIgnored(name)) return true;

    if (state.waterFree && c === "water") return true;

    if (state.steamFree && (
      c === "steam" ||
      c === "superheatedsteam" ||
      c === "densesteam"
    )) return true;

    if (state.cellsReusable && (
      c === "emptycell" ||
      c === "emptyfluidcell" ||
      c === "cell" ||
      c.includes("emptycell")
    )) return true;

    if (state.ignoreCircuits && (
      c === "programmedcircuit" ||
      c === "integratedcircuit" ||
      c.includes("programmedcircuit") ||
      c.includes("circuitconfiguration")
    )) return true;

    if (state.ignoreTargetOutputs && product && c === product) return true;

    return false;
  }

  function getRecipeBase(name, routeIndex = 0) {
    const api = window.GTNHNEI_FLOW_EXPORT_API;

    if (!api?.yamlForRecipe) {
      return {
        ok: false,
        error: "Recipe export API is not ready.",
        input: {},
        output: {},
        inputOrder: [],
        outputOrder: [],
        machine: ""
      };
    }

    try {
      const chosenRoute = window.GTNH_MAKER_API?.routeFor?.(name, routeIndex) ?? routeIndex;
      const res = api.yamlForRecipe(name, chosenRoute, {
        targetAmount: 1
      });

      const parsed = parseYaml(res?.yaml || "");

      let input = normalizeMap(parsed.input);
      let output = normalizeMap(parsed.output);

      if (!Object.keys(input).length && res?.input) input = normalizeMap(res.input);
      if (!Object.keys(output).length && res?.output) output = normalizeMap(res.output);

      return {
        ok: !!res?.ok || !!parsed.machine || !!Object.keys(input).length,
        yaml: res?.yaml || "",
        machine: res?.machine || parsed.machine,
        tier: res?.tier || parsed.tier,
        eut: res?.eut ?? parsed.eut,
        dur: res?.dur ?? parsed.dur,
        input,
        output,
        inputOrder: Object.keys(input),
        outputOrder: Object.keys(output)
      };
    } catch (err) {
      return {
        ok: false,
        error: String(err?.message || err),
        input: {},
        output: {},
        inputOrder: [],
        outputOrder: [],
        machine: ""
      };
    }
  }

  function producedAmount(data, productName) {
    const productKey = compact(productName);

    for (const [name, amount] of Object.entries(data.output || {})) {
      if (compact(name) === productKey) return amountNum(amount);
    }

    for (const [name, amount] of Object.entries(data.input || {})) {
      if (compact(name) === productKey) return amountNum(amount);
    }

    return 1;
  }

  function scaleRecipe(base, productName, desiredAmount) {
    const produced = Math.max(1e-12, producedAmount(base, productName));
    const scale = Math.max(0, amountNum(desiredAmount)) / produced;

    return {
      ...base,
      scale,
      produced,
      input: scaleMap(base.input, scale),
      output: scaleMap(base.output, scale)
    };
  }

  function cleanedInputs(data, productName, applyManual = true) {
    const input = normalizeMap(data.input || {});
    const output = normalizeMap(data.output || {});

    const entries = Object.entries(input);
    const outputKeys = new Set(Object.keys(output).map(compact));
    const productKey = compact(productName);

    let firstTargetIndex = -1;

    if (state.ignoreTargetOutputs && productKey) {
      firstTargetIndex = entries.findIndex(([name]) => compact(name) === productKey);
    }

    return entries.filter(([name], index) => {
      const c = compact(name);

      if (applyManual && isManualIgnored(name)) return false;

      if (state.waterFree && c === "water") return false;

      if (state.steamFree && (
        c === "steam" ||
        c === "superheatedsteam" ||
        c === "densesteam"
      )) return false;

      if (state.cellsReusable && (
        c === "emptycell" ||
        c === "emptyfluidcell" ||
        c === "cell" ||
        c.includes("emptycell")
      )) return false;

      if (state.ignoreCircuits && (
        c === "programmedcircuit" ||
        c === "integratedcircuit" ||
        c.includes("programmedcircuit") ||
        c.includes("circuitconfiguration")
      )) return false;

      if (state.ignoreTargetOutputs && productKey && c === productKey) return false;
      if (outputKeys.has(c)) return false;
      if (firstTargetIndex >= 0 && index >= firstTargetIndex) return false;

      return true;
    });
  }

  function collectCandidatesForPopup() {
    const names = new Set();

    for (const row of lastRows || []) {
      if (row?.name) names.add(cleanName(row.name));
    }

    for (const name of lastCandidateNames || []) {
      if (name) names.add(cleanName(name));
    }

    const target = cleanName(state.target);

    if (target) {
      const base = getRecipeBase(target, state.routeIndex);
      const produced = producedAmount(base, target);

      let desiredAmount;
      if (state.amountMode === "runs") {
        desiredAmount = produced * Math.max(0, amountNum(state.amount));
      } else {
        desiredAmount = Math.max(0, amountNum(state.amount));
      }

      const scaled = scaleRecipe(base, target, desiredAmount);

      for (const [name] of cleanedInputs(scaled, target, false)) {
        names.add(cleanName(name));
      }

      for (const name of Object.keys(scaled.input || {})) names.add(cleanName(name));
      for (const name of Object.keys(scaled.output || {})) names.add(cleanName(name));
    }

    for (const name of state.manualIgnored || []) {
      names.add(cleanName(name));
    }

    return [...names]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  function addRow(map, name, amount, source, depth) {
    name = cleanName(name);
    amount = amountNum(amount);

    if (!name || !amount || isIgnoredName(name)) return;

    const key = compact(name);

    if (!map.has(key)) {
      map.set(key, {
        name,
        amount: 0,
        sources: new Set(),
        minDepth: depth
      });
    }

    const row = map.get(key);
    row.amount += amount;
    row.sources.add(source);
    row.minDepth = Math.min(row.minDepth, depth);
  }

  function expand(name, amountNeeded, depthLeft, routeIndex, outMap, seen, source) {
    name = cleanName(name);
    amountNeeded = amountNum(amountNeeded);

    if (!name || amountNeeded <= 0 || isIgnoredName(name)) return;

    if (window.GTNH_MAKER_API?.isExternalInput?.(name)) {
      addRow(outMap, name, amountNeeded, source + " external-input", depthLeft);
      return;
    }

    visitedNodes++;

    if (visitedNodes > state.nodeLimit) {
      addRow(outMap, name, amountNeeded, source + " node-limit", depthLeft);
      return;
    }

    const loopKey = `${compact(name)}:${depthLeft}:${Math.round(amountNeeded * 1000000)}`;
    if (seen.has(loopKey)) {
      addRow(outMap, name, amountNeeded, source + " loop-stop", depthLeft);
      return;
    }

    seen.add(loopKey);

    if (depthLeft <= 0) {
      addRow(outMap, name, amountNeeded, source, depthLeft);
      return;
    }

    const base = getRecipeBase(name, routeIndex);

    if (!base.ok) {
      addRow(outMap, name, amountNeeded, source, depthLeft);

      if (base.error) lastErrors.push(`${name}: ${base.error}`);

      return;
    }

    const scaled = scaleRecipe(base, name, amountNeeded);
    const inputs = cleanedInputs(scaled, name);

    if (!inputs.length) {
      addRow(outMap, name, amountNeeded, source, depthLeft);
      return;
    }

    for (const [inName, inAmount] of inputs) {
      expand(inName, inAmount, depthLeft - 1, 0, outMap, new Set(seen), name);
    }
  }

  function calculate() {
    readForm();
    saveState();

    lastErrors = [];
    visitedNodes = 0;

    const outMap = new Map();

    if (!state.target) {
      lastRows = [];
      lastCandidateNames = [];
      lastErrors.push("No target selected.");
      renderResults();
      return;
    }

    const base = getRecipeBase(state.target, state.routeIndex);

    if (!base.ok) {
      lastRows = [];
      lastCandidateNames = [];
      lastErrors.push(base.error || "No production recipe found.");
      renderResults();
      return;
    }

    const baseProduced = producedAmount(base, state.target);

    let desiredAmount;

    if (state.amountMode === "runs") {
      desiredAmount = baseProduced * Math.max(0, amountNum(state.amount));
    } else {
      desiredAmount = Math.max(0, amountNum(state.amount));
    }

    const scaled = scaleRecipe(base, state.target, desiredAmount);
    const unfilteredDirectInputs = cleanedInputs(scaled, state.target, false);
    const directInputs = cleanedInputs(scaled, state.target, true);

    lastCandidateNames = unfilteredDirectInputs.map(([name]) => cleanName(name));

    if (!directInputs.length) {
      lastRows = [];
      lastErrors.push("No required materials found after filters. Open ignored-material picker and unignore something if needed.");
      renderResults();
      return;
    }

    const depth = clampInt(state.depth, 1, 50);

    for (const [name, amount] of directInputs) {
      expand(
        name,
        amount,
        depth - 1,
        0,
        outMap,
        new Set(),
        state.target
      );
    }

    lastRows = [...outMap.values()]
      .map(x => ({
        name: x.name,
        amount: x.amount,
        sources: [...x.sources].join(", "),
        depth: x.minDepth
      }))
      .filter(x => !isIgnoredName(x.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (visitedNodes >= state.nodeLimit) {
      lastErrors.push(`Stopped at node limit ${state.nodeLimit}. Reduce depth or raise limit.`);
    }

    if (!lastRows.length && !lastErrors.length) {
      lastErrors.push("No materials found after filters.");
    }

    renderResults();
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
                <input id="matTarget" placeholder="epichlorohydrin" autocomplete="off">
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
                <label class="matCheck"><input id="matCellsReusable" type="checkbox"> Ignore reusable cells</label>
                <label class="matCheck"><input id="matIgnoreCircuits" type="checkbox"> Ignore programmed circuits</label>
                <label class="matCheck"><input id="matIgnoreTargetOutputs" type="checkbox"> Ignore target/byproducts</label>
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
      if (event.target?.id?.startsWith("mat")) scheduleSave();
    });

    ov.addEventListener("change", event => {
      if (event.target?.id?.startsWith("mat")) {
        readForm();
        saveState();
      }
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
          <input id="gtnhIgnoreManualText" placeholder="type material name, e.g. programmed circuit">
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

      addManualIgnored(name);
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
      const names = lastRows.map(r => r.name).filter(Boolean);

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
    const key = compact(name);
    state.manualIgnored = normalizeNameList(
      (state.manualIgnored || []).filter(x => compact(x) !== key)
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
      const on = ignored.has(compact(name));

      return `
        <button type="button" class="gtnhIgnoreChip ${on ? "ignored" : ""}" data-name="${esc(name)}">
          <span>${esc(name)}</span>
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
        ? `<b>Manually ignored:</b> ${list.map(esc).join(", ")}`
        : `<b>Manually ignored:</b> none`;
    }
  }

  function readForm() {
    const val = id => document.getElementById(id)?.value ?? "";

    state.target = String(val("matTarget")).trim();
    state.amount = Math.max(0, Number(val("matAmount") || 1));
    state.amountMode = String(val("matAmountMode") || "runs") === "target" ? "target" : "runs";
    state.depth = clampInt(val("matDepth") || 1, 1, 50);
    state.routeIndex = Math.max(0, Number(val("matRoute") || 1) - 1);
    state.nodeLimit = clampInt(val("matNodeLimit") || 2500, 100, 20000);

    state.waterFree = !!document.getElementById("matWaterFree")?.checked;
    state.steamFree = !!document.getElementById("matSteamFree")?.checked;
    state.cellsReusable = !!document.getElementById("matCellsReusable")?.checked;
    state.ignoreCircuits = !!document.getElementById("matIgnoreCircuits")?.checked;
    state.ignoreTargetOutputs = !!document.getElementById("matIgnoreTargetOutputs")?.checked;

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
            <tr>
              <td>${esc(amountText(r.amount))}</td>
              <td>${esc(r.name)}</td>
              <td>
                <button type="button" class="matIgnoreInlineBtn" data-name="${esc(r.name)}">
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

  window.GTNH_MATCALC = {
    open,
    close,
    calculate,
    openIgnorePicker,
    getState: () => ({ ...state }),
    getLastRows: () => lastRows.slice(),
    getManualIgnored: () => normalizeNameList(state.manualIgnored)
  };
})();
