import { makerChoiceFor, makerRouteIndex } from "./maker-state.js";
/* === GTNH Maker Choice v1 === */
/* Choose whether a needed material is an external input or produced by a selected route. */
(() => {
  "use strict";

  if (window.__GTNH_MAKER_CHOICE_V1__) return;
  window.__GTNH_MAKER_CHOICE_V1__ = true;

  const STORE_KEY = "gtnh_maker_choice_v1";

  function scopedKey() {
    const id = window.GTNH_DATASETS?.active?.id;
    return !id || id === "gtnh-2.8.0" ? STORE_KEY : `${STORE_KEY}_${id}`;
  }
  const DEFAULT_STATE = {
    makers: {},          // exact good ID -> choice; legacy compact names still read
    externalInputs: {}
  };

  let state = loadState();
  const candidateCache = new Map();

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(scopedKey()) || "{}");
      return {
        ...DEFAULT_STATE,
        ...raw,
        makers: raw.makers && typeof raw.makers === "object" ? raw.makers : {},
        externalInputs: raw.externalInputs && typeof raw.externalInputs === "object" ? raw.externalInputs : {}
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function saveState() {
    try { localStorage.setItem(scopedKey(), JSON.stringify(state)); }
    catch { toast("Maker choices cannot be saved in this browser. Keep the page open to retain this session."); }
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

  function routeFor(name, fallback = 0) {
    const catalog = window.GTNH_CATALOG, good = catalog?.resolve(cleanName(name));
    return good ? makerRouteIndex(catalog, good, makerChoiceFor(state, catalog, good), fallback) : fallback;
  }

  function makerInfo(name) {
    const catalog = window.GTNH_CATALOG, good = catalog?.resolve(cleanName(name));
    return good ? makerChoiceFor(state, catalog, good) : null;
  }

  function isExternalInput(name) {
    const catalog = window.GTNH_CATALOG, good = catalog?.resolve(cleanName(name));
    return !!(good && makerChoiceFor(state, catalog, good, "externalInputs"));
  }

  function setExternalInput(name) {
    const good = window.GTNH_CATALOG?.resolve(cleanName(name));
    if (!good) return false;
    clearChoice(good.id, false);
    state.externalInputs[good.id] = { name: good.name, goodId: good.id };

    saveState();
    return true;
  }

  function setMaker(name, routeIndex) {
    const good = window.GTNH_CATALOG?.resolve(cleanName(name)), route = routeCandidates(name)[Number(routeIndex)];
    if (!good || !route) return false;
    clearChoice(good.id, false);
    state.makers[good.id] = {
      name: good.name, goodId: good.id,
      routeIndex: route.index,
      recipeId: route.recipeId
    };

    saveState();

    return true;
  }

  function clearChoice(name, persist = true) {
    const catalog = window.GTNH_CATALOG, good = catalog?.resolve(cleanName(name));
    for (const section of ["makers", "externalInputs"]) {
      if (good) {
        const legacyKey = compact(good.name);
        const legacy = state[section][legacyKey];
        if (legacy && makerChoiceFor({ [section]: { [legacyKey]: legacy } }, catalog, good, section) === legacy) delete state[section][legacyKey];
        delete state[section][good.id];
      } else delete state[section][compact(name)];
    }

    if (persist) saveState();
  }

  function routeCandidates(name) {
    const catalog = window.GTNH_CATALOG;
    if (!catalog) return [];
    const good = catalog.resolve(cleanName(name));
    if (!good) return [];
    const key = `${catalog.dataset.id}:${good.id}`;
    if (candidateCache.has(key)) return candidateCache.get(key);
    const grouped = entries => {
      const values = new Map();
      for (const io of entries) {
        const name = catalog.matches(io.name).length > 1 ? `${io.name} [${io.id}]` : io.name;
        values.set(name, (values.get(name) || 0) + io.amount * io.probability);
      }
      return Object.fromEntries(values);
    };
    const out = catalog.recipes(good).map((recipe, index) => ({ index, recipeId: recipe.id, name: good.name || good.id,
      machine: recipe.machine, tier: recipe.tier || "", eut: recipe.eut ?? "", dur: recipe.durationTicks === null ? "" : recipe.durationTicks / 20,
      input: grouped(recipe.inputs), output: grouped(recipe.outputs) }));
    candidateCache.set(key, out);
    return out;
  }

  function statusFor(name) {
    const cleaned = cleanName(name);
    const key = compact(cleaned);

    if (!key) {
      return {
        kind: "unknown",
        label: "unknown",
        candidates: []
      };
    }

    if (isExternalInput(cleaned)) {
      return {
        kind: "external",
        label: "input",
        candidates: []
      };
    }

    const selected = makerInfo(cleaned);
    if (selected) {
      const index = routeFor(cleaned);
      return {
        kind: index < 0 ? "missing" : "selected",
        label: index < 0 ? "saved recipe unavailable" : `maker route ${index + 1}`,
        candidates: routeCandidates(cleaned)
      };
    }

    const candidates = routeCandidates(cleaned);

    if (candidates.length > 1) {
      return {
        kind: "missing",
        label: "missing maker",
        candidates
      };
    }

    if (candidates.length === 1) {
      return {
        kind: "default",
        label: "default maker",
        candidates
      };
    }

    return {
      kind: "raw",
      label: "input",
      candidates
    };
  }

  function wrapFlowApi() {
    const api = window.GTNHNEI_FLOW_EXPORT_API;

    if (!api?.yamlForRecipe || api.__makerChoiceWrapped) return false;

    const orig = api.yamlForRecipe.bind(api);

    api.__makerChoiceOrigYamlForRecipe = orig;
    api.__makerChoiceWrapped = true;

    api.yamlForRecipe = function makerChoiceYamlForRecipe(name, routeIndex = 0, opts = {}) {
      const forced = !!opts?.forceRoute;
      const chosenRoute = forced ? routeIndex : routeFor(name, routeIndex);

      return orig(name, chosenRoute, opts);
    };

    return true;
  }

  function ensureOverlay() {
    let ov = document.getElementById("gtnhMakerChoiceOverlay");
    if (ov) return ov;

    ov = document.createElement("div");
    ov.id = "gtnhMakerChoiceOverlay";
    ov.className = "gtnhMakerChoiceOverlay";

    ov.innerHTML = `
      <div class="gtnhMakerChoiceCard">
        <div class="gtnhMakerChoiceHead">
          <div>
            <h2>Maker choice</h2>
            <p>Choose whether this material is supplied as an input or produced by a selected route.</p>
          </div>
          <button type="button" id="gtnhMakerChoiceClose">×</button>
        </div>

        <div class="gtnhMakerChoiceBody">
          <div id="gtnhMakerChoiceTarget" class="gtnhMakerChoiceTarget"></div>

          <div class="gtnhMakerChoiceMainActions">
            <button type="button" id="gtnhMakerUseInput">Use as input</button>
            <button type="button" id="gtnhMakerClear">Clear choice</button>
            <button type="button" id="gtnhMakerOpenRecipe">Open recipe</button>
            <button type="button" id="gtnhMakerOpenUsage">Open usage</button>
          </div>

          <div class="gtnhMakerChoiceSection">
            <h3>Add maker</h3>
            <p>Pick the route used when the calculator/planner expands this material.</p>
            <div id="gtnhMakerRoutes" class="gtnhMakerRoutes"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(ov);

    ov.addEventListener("click", event => {
      if (event.target === ov) close();
    });

    ov.querySelector("#gtnhMakerChoiceClose")?.addEventListener("click", close);

    ov.querySelector("#gtnhMakerUseInput")?.addEventListener("click", () => {
      const name = ov.dataset.name || "";
      setExternalInput(name);
      toast(`${name}: using as input`);
      recalc();
      render();
    });

    ov.querySelector("#gtnhMakerClear")?.addEventListener("click", () => {
      const name = ov.dataset.name || "";
      clearChoice(name);
      toast(`${name}: choice cleared`);
      recalc();
      render();
    });

    ov.querySelector("#gtnhMakerOpenRecipe")?.addEventListener("click", () => {
      const name = ov.dataset.name || "";
      window.GTNHNEI_MAIN_API?.recipe?.(name);
      close();
    });

    ov.querySelector("#gtnhMakerOpenUsage")?.addEventListener("click", () => {
      const name = ov.dataset.name || "";
      window.GTNHNEI_MAIN_API?.usage?.(name);
      close();
    });

    return ov;
  }

  function routeIoPreview(route) {
    const input = Object.entries(route.input || {})
      .slice(0, 7)
      .map(([name, amount]) => `<span>${esc(name)} <b>${esc(amountText(amount))}</b></span>`)
      .join("");

    const output = Object.entries(route.output || {})
      .slice(0, 5)
      .map(([name, amount]) => `<span>${esc(name)} <b>${esc(amountText(amount))}</b></span>`)
      .join("");

    return `
      <div class="gtnhMakerRouteIo">
        <div>
          <b>Input</b>
          ${input || "<em>unknown</em>"}
        </div>
        <div>
          <b>Output</b>
          ${output || "<em>unknown</em>"}
        </div>
      </div>
    `;
  }

  function open(name) {
    name = cleanName(name);

    if (!name) {
      toast("No material selected.");
      return;
    }
    if (!window.GTNH_CATALOG?.resolve(name)) { toast("Select an exact material name or item/fluid ID. Duplicate names need an ID."); return; }

    ensureOverlay().dataset.name = name;
    render();
    document.getElementById("gtnhMakerChoiceOverlay")?.classList.add("show");
  }

  function close() {
    document.getElementById("gtnhMakerChoiceOverlay")?.classList.remove("show");
  }

  function render() {
    const ov = ensureOverlay();
    const name = cleanName(ov.dataset.name || "");
    const target = ov.querySelector("#gtnhMakerChoiceTarget");
    const routesBox = ov.querySelector("#gtnhMakerRoutes");

    if (!name) return;

    const status = statusFor(name);
    const current = makerInfo(name);
    const routes = routeCandidates(name);

    if (target) {
      const good = window.GTNH_CATALOG?.resolve(name);
      target.innerHTML = `
        <div class="gtnhMakerTargetName">${esc(good?.name || name)}</div>
        ${good ? `<small>${esc(good.id)}</small>` : ""}
        <div class="gtnhMakerStatus ${esc(status.kind)}">
          <span>${status.kind === "missing" ? "⚠" : "●"}</span>
          ${esc(status.label)}
        </div>
        <div class="gtnhMakerTargetNote">
          ${
            status.kind === "missing"
              ? "This material has multiple possible routes. Choose one maker route or use it as an input."
              : status.kind === "selected"
                  ? `This material uses route ${routeFor(name) + 1}.`
                : status.kind === "external"
                  ? "This material is treated as supplied input."
                  : "No maker choice is required right now."
          }
        </div>
      `;
    }

    if (!routesBox) return;

    if (!routes.length) {
      routesBox.innerHTML = `
        <div class="gtnhMakerNoRoutes">
          No production route found from the exposed recipe data. Use this as input.
        </div>
      `;
      return;
    }

    routesBox.innerHTML = routes.map(route => {
      const selected = current && (current.recipeId ? current.recipeId === route.recipeId : Number(current.routeIndex) === Number(route.index));

      return `
        <article class="gtnhMakerRoute ${selected ? "selected" : ""}">
          <div class="gtnhMakerRouteTop">
            <div>
              <h4>Route ${route.index + 1}: ${esc(route.machine)}</h4>
              <p>
                ${route.tier ? esc(route.tier) + " · " : ""}
                ${route.eut !== "" ? esc(route.eut) + " EU/t · " : ""}
                ${route.dur !== "" ? esc(route.dur) + "s" : ""}
              </p>
            </div>
            <button type="button" data-route="${route.index}">
              ${selected ? "Selected" : "Use this route"}
            </button>
          </div>
          ${routeIoPreview(route)}
        </article>
      `;
    }).join("");

    routesBox.querySelectorAll("button[data-route]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.route || 0);
        setMaker(name, idx);
        toast(`${name}: route ${idx + 1} selected`);
        recalc();
        render();
      });
    });
  }

  function recalc() {
    candidateCache.clear();

    try {
      window.GTNH_MATCALC?.calculate?.();
    } catch {}

    try {
      window.GTNH_CALC?.build?.();
    } catch {}

    setTimeout(decorate, 120);
  }

  function decorateMaterialCalculator() {
    const rows = document.querySelectorAll("#matResults tbody tr");

    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      const name = row.dataset.goodId || row.dataset.goodName || cleanName(cells[1]?.firstChild?.textContent || "");
      if (!name) continue;

      const status = statusFor(name);

      row.classList.toggle("makerChoiceMissing", status.kind === "missing");
      row.classList.toggle("makerChoiceSelected", status.kind === "selected");
      row.classList.toggle("makerChoiceExternal", status.kind === "external");

      let cell = cells[2];
      if (!cell) continue;

      if (!cell.querySelector(".makerChoiceInlineBtn")) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "makerChoiceInlineBtn";
        btn.textContent = "maker";
        btn.addEventListener("click", event => {
          event.stopPropagation();
          open(name);
        });
        cell.appendChild(btn);
      }

      let badge = cells[1].querySelector(".makerChoiceRowBadge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "makerChoiceRowBadge";
        cells[1].appendChild(badge);
      }

      const text =
        status.kind === "missing" ? "⚠ maker?" :
        status.kind === "selected" ? `maker ${routeFor(name) + 1}` :
        status.kind === "external" ? "input" :
        "";
      if (badge.textContent !== text) badge.textContent = text;
      const className = `makerChoiceRowBadge ${status.kind}`;
      if (badge.className !== className) badge.className = className;
    }
  }

  function decorateIcons() {
    const roots = [
      document.getElementById("gtnhCalcOverlay"),
      document.getElementById("gtnhMatCalcOverlay")
    ].filter(Boolean);

    for (const root of roots) {
      const icons = root.querySelectorAll("[data-gtnh-icon-name], [data-gtnhIconName]");

      for (const el of icons) {
        // The unified planner owns its route decisions. A global maker default
        // can be unset even when this plan has an exact valid recipe selected.
        if (el.closest("[data-plan-icon], #calculatorSelectedGood")) continue;
        const name = cleanName(el.dataset.gtnhIconName || el.dataset.gtnhIconName || "");
        if (!name) continue;

        const status = statusFor(name);
        const missing = status.kind === "missing";

        el.classList.toggle("makerChoiceIconMissing", missing);

        if (!missing) continue;
        if (el.querySelector(".makerChoiceMiniBtn")) continue;
        if (["IMG", "CANVAS", "SVG"].includes(el.tagName)) continue;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "makerChoiceMiniBtn";
        btn.textContent = "⚠";
        btn.title = "Choose maker";
        btn.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          open(name);
        });

        el.appendChild(btn);
      }
    }
  }

  function decorate() {
    decorateMaterialCalculator();
    decorateIcons();
  }

  function startObserver() {
    const mo = new MutationObserver(() => {
      clearTimeout(window.__makerChoiceDecorateTimer);
      window.__makerChoiceDecorateTimer = setTimeout(decorate, 120);
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener("resize", decorate);
    window.addEventListener("orientationchange", decorate);
  }

  function start() {
    // The database may take much longer than 20 seconds on a phone connection.
    window.addEventListener("gtnhnei-flow-export-ready", () => {
      wrapFlowApi();
      decorate();
    });
    wrapFlowApi();

    window.addEventListener("gtnh-dataset-selected", () => { state = loadState(); candidateCache.clear(); });
    startObserver();
    decorate();
  }

  window.GTNH_MAKER_API = {
    open,
    close,
    routeFor,
    makerInfo,
    isExternalInput,
    setExternalInput,
    setMaker,
    clearChoice,
    statusFor,
    routeCandidates,
    getState: () => JSON.parse(JSON.stringify(state)),
    recalc
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
