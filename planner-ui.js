import { calculateProduction } from "./production-engine.js";
import { exportPlanYaml, planCsv } from "./recipe-export.js";
import { defaultPlannerState, normalizePlannerState, serializePlan, importPlan } from "./planner-state.js";
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const fmt = number => number === null || number === undefined ? "unknown" : new Intl.NumberFormat("en", { maximumSignificantDigits: 7 }).format(number);

export function installPlanner() {
  let previousFocus = null, displayNodeLimit = 250;
  let state = structuredClone(defaultPlannerState), datasetId = null, plan = null, error = "", built = false, codeTab = "summary";
  const catalog = () => window.GTNH_CATALOG;
  const dataset = () => catalog()?.dataset || { id: "gtnh-2.8.0", label: "GTNH 2.8.0" };
  const key = () => `gtnh_atlas_planner_v1_${dataset().id}`;
  function load() {
    if (datasetId === dataset().id) return;
    datasetId = dataset().id;
    try {
      const saved = localStorage.getItem(key()) || (datasetId === "gtnh-2.8.0" || datasetId === "legacy" ? localStorage.getItem("gtnhnei_calc_state") : null);
      const restored = saved ? JSON.parse(saved) : null;
      // A zero/blank amount was a valid unfinished draft in the old shell. Keep
      // its route/settings preferences while giving it a calculable amount.
      if (restored && (!(Number(restored.amount) > 0) || !Number.isFinite(Number(restored.amount)))) restored.amount = 1;
      state = restored ? normalizePlannerState(restored) : structuredClone(defaultPlannerState);
    } catch { state = structuredClone(defaultPlannerState); }
  }
  function save() {
    try { localStorage.setItem(key(), JSON.stringify(state)); }
    catch { error = "Storage is unavailable. Export your plan to preserve it."; }
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function options() {
    const c = catalog(), target = c.resolve(state.target), targetId = target?.id;
    const routeChoices = { ...state.lockedRoutes, ...state.routeChoices };
    const makers = window.GTNH_MAKER_API;
    const externalInputs = new Set(state.rawOverrides), freeInputs = new Set(state.ignored);
    for (const id of Object.keys(makers?.getState().externalInputs || {})) if (/^[ifo]:/.test(id) && id !== targetId && makers.isExternalInput(id)) externalInputs.add(id);
    for (const good of c.goods) {
      const maker = makers?.makerInfo(good.id);
      if (maker && routeChoices[good.id] === undefined) routeChoices[good.id] = maker.recipeId || maker.routeIndex;
      if (good.id === targetId) continue;
      const name = (good.name || "").toLowerCase();
      if (state.ignored.includes(good.id) || state.ignored.includes(name) || state.settings.waterFree && name === "water" || state.settings.steamFree && ["steam", "superheated steam", "dense steam"].includes(name)) freeInputs.add(good.id);
      if (state.rawOverrides.includes(name) || makers?.isExternalInput(good.id) ||
        !state.settings.expandCircuits && /circuit/.test(name) || !state.settings.expandMachines && good.id.startsWith("i:gregtech:gt.blockmachines:") ||
        !state.settings.expandPlatesWires && /\b(plate|wire|cable)s?\b/.test(name)) externalInputs.add(good.id);
    }
    return { ...state, routeChoices, externalInputs: [...externalInputs], freeInputs: [...freeInputs] };
  }
  function calculate() {
    error = ""; plan = null;
    try {
      if (!catalog()) throw new Error("The recipe database is still loading. Try Build again when loading completes.");
      plan = calculateProduction(catalog(), options());
    } catch (failure) { error = failure.message; }
  }
  function build() {
    load(); read(); built = true; calculate(); render();
  }
  function read() {
    const root = document.getElementById("gtnhCalcOverlay");
    if (!root) return;
    for (const id of ["target", "amount", "unit", "rateMode", "depth", "routeMode", "machineMode", "machineCount", "rounding"]) {
      const input = root.querySelector(`[data-state="${id}"]`);
      if (input) state[id] = ["amount", "machineCount"].includes(id) ? Number(input.value) : input.value;
    }
    for (const input of root.querySelectorAll("[data-setting]")) state.settings[input.dataset.setting] = input.checked;
    save();
  }
  function sync() {
    const root = document.getElementById("gtnhCalcOverlay");
    for (const input of root.querySelectorAll("[data-state]")) input.value = state[input.dataset.state];
    for (const input of root.querySelectorAll("[data-setting]")) input.checked = !!state.settings[input.dataset.setting];
  }
  function tab(name) {
    const root = document.getElementById("gtnhCalcOverlay"); root.dataset.mobileTab = name;
    root.querySelectorAll("[data-calc-tab]").forEach(button => button.classList.toggle("active", button.dataset.calcTab === name));
  }
  function table(rows, extra = "", isRate = plan.isRate) {
    if (!rows.length) return '<p class="plannerEmpty">None.</p>';
    return `<div class="plannerTable"><table><thead><tr><th>Material</th><th>Quantity${isRate ? "/s" : ""}</th><th>Unit</th>${extra ? "<th>Action</th>" : ""}</tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.name)}<small title="${esc(row.id)}">${esc((row.reason || row.type || "").replaceAll("-", " "))}${catalog().matches(row.name).length > 1 ? " · " + esc(row.id) : ""}</small></td><td>${fmt(row.amount)}</td><td>${esc(row.unit)}</td>${extra ? `<td><div class="plannerMaterialActions"><button type="button" data-supply="${esc(row.id)}">Supply externally</button>${row.type === "ore" ? "" : `<button type="button" data-stock="${esc(row.id)}">Use stock</button>`}</div></td>` : ""}</tr>`).join("")}</tbody></table></div>`;
  }
  function renderInventory(root) {
    root.querySelector("#plannerInventoryList").innerHTML = Object.entries(state.inventory).map(([id, amount]) => {
      const object = catalog()?.resolve(id), good = object ? catalog().describe(object) : { name: id, unit: "?" };
      return `<div class="plannerStockRow"><label>${esc(good.name)} <small>${esc(id)} · ${esc(good.unit)}</small><input type="number" min="0" step="any" data-stock-quantity="${esc(id)}" aria-label="Stock on hand: ${esc(good.name)}" value="${amount}"></label><button type="button" data-stock-remove="${esc(id)}" aria-label="Remove stock: ${esc(good.name)}">Remove</button></div>`;
    }).join("") || '<p class="plannerEmpty">No stock recorded.</p>';
  }
  function saveInventory() {
    save();
    if (built) calculate(); else error = "";
    render();
  }
  function routeControl(node) {
    const good = catalog().resolve(node.id);
    if (node.type === "ore") {
      const alternatives = good?.items || [];
      return `<label>Ingredient for ${esc(node.name)}<select data-ore="${esc(node.id)}"><option value="">Keep OreDict unresolved</option>${alternatives.map(g => `<option value="${esc(g.id)}" ${state.oreChoices[node.id] === g.id ? "selected" : ""}>${esc(g.name)} · ${esc(g.id)}</option>`).join("")}</select></label>`;
    }
    const routes = good ? catalog().recipes(good) : [];
    if (!routes.length) return "";
    return `<label>Production route<select data-route-good="${esc(node.id)}"><option value="">${["ask", "manual"].includes(state.routeMode) ? "Choose a route" : "Automatic route policy"}</option>${routes.map((r, index) => `<option value="${esc(r.id)}" ${node.recipeId === r.id ? "selected" : ""}>${index + 1}. ${esc(r.machine)} · ${r.tier || "non-electric/unknown"} · ${r.durationTicks === null ? "time unknown" : fmt(r.durationTicks / 20) + "s"} · ${fmt(r.eut)} EU/t</option>`).join("")}</select></label>`;
  }
  function summary() {
    if (!plan) return error || "Enter a target and press Build tree.";
    return [`GTNH Atlas — ${dataset().label}`, `${plan.target.name}: ${fmt(plan.requested)} ${plan.target.unit}${plan.isRate ? "/s" : ""}`,
      `Known ${plan.isRate ? "average EU/t" : "energy (EU)"}: ${fmt(plan.isRate ? plan.knownAverageEut : plan.knownEnergy)}${plan.hasUnknownPower ? " (partial; unknown machines)" : ""}`,
      "", "Materials:", ...plan.materials.map(row => `${fmt(row.amount)} ${row.unit}${plan.isRate ? "/s" : ""} ${row.name} [${row.id}]`),
      "", "Used from inventory:", ...plan.inventoryUsed.map(row => `${fmt(row.amount)} ${row.unit} ${row.name} [${row.id}]`),
      "", "Reusable startup stock:", ...plan.reusable.map(row => `${fmt(row.amount)} ${row.unit} ${row.name}`),
      "", ...plan.warnings].join("\n");
  }
  function code() {
    if (codeTab === "json") return serializePlan(state, dataset());
    if (codeTab === "yaml") return plan ? exportPlanYaml(plan) : "# Build a plan first.\n";
    if (codeTab === "csv") return plan ? planCsv(plan) : "";
    if (codeTab === "errors") return [error, ...(plan?.warnings || [])].filter(Boolean).join("\n") || "No warnings.";
    return summary();
  }
  function render() {
    const root = document.getElementById("gtnhCalcOverlay"); if (!root) return;
    const focusedStock = document.activeElement?.dataset.stockQuantity;
    renderInventory(root);
    const box = root.querySelector("#calcTree");
    const workspace = root.querySelector(".gtnhCalcWorkspace"), scroll = workspace.scrollTop;
    const expanded = new Set([...box.querySelectorAll("details[open][data-node-id]")].map(node => node.dataset.nodeId));
    const active = document.activeElement;
    const restore = focusedStock ? `[data-stock-quantity="${CSS.escape(focusedStock)}"]` : active?.dataset.routeGood ? `[data-route-good="${CSS.escape(active.dataset.routeGood)}"]` :
      active?.dataset.ore ? `[data-ore="${CSS.escape(active.dataset.ore)}"]` :
      active?.dataset.profileField ? `[data-profile="${CSS.escape(active.closest("[data-profile]").dataset.profile)}"] [data-profile-field="${active.dataset.profileField}"]` : null;
    if (error) box.innerHTML = `<p role="alert" class="plannerError">${esc(error)}</p>`;
    else if (!built || !plan) box.innerHTML = '<p>Choose an exact target and press Build tree. Calculations run only when requested.</p>';
    else {
      box.innerHTML = `<p class="plannerDataset">${esc(dataset().label)} · ${esc(plan.target.name)} · ${fmt(plan.requested)} ${esc(plan.target.unit)}${plan.isRate ? "/s" : ""}</p>
        <div class="plannerMetrics"><div>${plan.isRate ? "Known average EU/t" : "Known energy"}<b>${fmt(plan.isRate ? plan.knownAverageEut : plan.knownEnergy)}${plan.isRate ? "" : " EU"}</b></div><div>${plan.isRate ? "Installed EU/t" : "Root processing time"}<b>${fmt(plan.isRate ? plan.knownInstalledEut : plan.rootTimeSeconds)}${plan.isRate ? "" : " s"}</b></div></div>
        <p>${plan.capacity !== null ? `Root capacity with ${state.machineCount} machine(s): ${fmt(plan.capacity)} ${esc(plan.target.unit)}/s. ` : ""}${plan.hasUnknownPower ? "Some timing/power values are unknown. Totals cover known machines only." : "Base recipe timing and power; no automatic multiblock bonuses."}</p>
        <details ${plan.unresolved.length ? "open" : ""}><summary>Warnings and unresolved routes (${plan.warnings.length})</summary><ul>${plan.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul></details>
        <h4>Required materials ${plan.isRate ? "per second" : ""}</h4>${table(plan.materials, "actions")}
        ${plan.inventoryUsed.length ? `<details open><summary>Used from inventory (${plan.inventoryUsed.length})</summary>${table(plan.inventoryUsed)}</details>` : ""}
        ${plan.inventoryRemaining.length ? `<details><summary>Unspent inventory (${plan.inventoryRemaining.length})</summary>${table(plan.inventoryRemaining, "", false)}</details>` : ""}
        <details ${state.settings.cellsReusable ? "open" : ""}><summary>Reusable startup stock (${plan.reusable.length})</summary>${table(plan.reusable, "", false)}</details>
        <details><summary>Byproducts and surplus (${plan.byproducts.length})</summary>${table(plan.byproducts)}</details>
        <h4>Dependency tree</h4><p>${plan.nodes.length} nodes. ${plan.truncated ? "Node limit reached; boundary materials retained." : ""}</p>
        <div class="plannerNodes">${plan.nodes.slice(0, displayNodeLimit).map(node => `<details class="plannerNode" data-node-key="${node.key}" data-node-id="${esc(node.id)}" ${node.depth < 2 || expanded.has(node.id) ? "open" : ""}><summary><b>${esc(node.name)}</b> · ${fmt(node.amount)} ${esc(node.unit)}${plan.isRate ? "/s" : ""} · ${esc(node.status.replaceAll("-", " "))}</summary><small>${esc(node.id)} · depth ${node.depth}</small>${node.inventoryUsed ? `<p>${fmt(node.inventoryUsed)} ${esc(node.unit)} supplied from inventory; ${fmt(node.productionAmount)} remaining demand.</p>` : ""}${node.recipeId ? `<p>${esc(node.machine)} · ${fmt(node.batches)} batches${plan.isRate ? "/s" : ""}</p>` : ""}${node.depth === 0 ? routeControl(node) : `<div data-route-slot="${node.key}"></div>`}<button data-supply="${esc(node.id)}" type="button">Supply externally</button></details>`).join("")}</div>
        ${plan.nodes.length > displayNodeLimit ? `<button type="button" id="plannerShowMore">Show ${Math.min(250, plan.nodes.length-displayNodeLimit)} more dependency nodes</button>` : ""}
        <h4>Machine requirements</h4><p>Parallel lanes and overclock models are explicit assumptions; verify the selected machine supports them.</p>
        ${plan.steps.map(step => { const cfg = state.machineConfigs[step.recipeId] || {}; return `<details class="plannerNode"><summary>${esc(step.machine)} · ${plan.isRate ? fmt(step.count) + " required machines (" + fmt(step.equivalents) + " equivalent)" : fmt(step.batches) + " batches"}</summary><p>${step.performance ? fmt(step.performance.durationTicks) + " ticks/batch · " + fmt(step.performance.eut) + " EU/t at full load" + (plan.isRate && step.installedCount !== step.count ? ` · ${fmt(step.installedCount)} configured machines` : "") : "Timing/power unknown"}</p>
          <div class="plannerProfile" data-profile="${esc(step.recipeId)}"><label>Parallel lanes<input type="number" min="1" max="4096" data-profile-field="parallels" value="${cfg.parallels || 1}"></label><label>Overclocks<input type="number" min="0" max="10" data-profile-field="overclocks" value="${cfg.overclocks || 0}"></label><label>OC model<select data-profile-field="overclockMode"><option value="normal">Normal (4×EU / 2×speed)</option><option value="perfect" ${cfg.overclockMode === "perfect" ? "selected" : ""}>Perfect (4×EU / 4×speed)</option></select></label></div></details>`; }).join("")}
        <h4>Dependency diagram</h4><div class="plannerDiagram" role="img" aria-label="Recipe dependency diagram">${diagram()}</div>`;
    }
    if (restore) root.querySelector(restore)?.focus({ preventScroll: true });
    workspace.scrollTop = scroll;
    root.querySelector("#calcCodeOut").value = code();
    root.querySelector("#calcCodeLabel").textContent = codeTab === "json" ? "Versioned plan settings (portable JSON)" : codeTab;
    root.querySelector("#plannerStatus").textContent = error || (plan ? `${plan.materials.length} required materials · ${plan.unresolved.length} unresolved dependencies` : "Ready");
  }
  function diagram(limit = 120) {
    const visible = plan.nodes.slice(0, limit), width = 800, height = visible.length * 42 + 24;
    const rowFor = new Map(visible.map((node, index) => [node.key, index]));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><title>Production dependencies for ${esc(plan.target.name)}</title>${visible.map((n, i) => {
      const x = 14 + Math.min(n.depth, 10) * 24, y = 14 + i * 42;
      const parentIndex = rowFor.get(n.parent) ?? -1;
      return `${parentIndex >= 0 ? `<path d="M${14 + Math.min(visible[parentIndex].depth, 10) * 24 + 8} ${14 + parentIndex * 42 + 24}V${y + 12}H${x}" fill="none" stroke="#6791ac"/>` : ""}<rect x="${x}" y="${y}" width="${width - x - 14}" height="26" rx="5" fill="${n.status === "produced" ? "#142f44" : "#47371d"}"/><text x="${x + 8}" y="${y + 18}" fill="#eaf2ff" font-size="12">${esc(n.name.slice(0, 65))} · ${fmt(n.amount)} ${esc(n.unit)}${plan.isRate ? "/s" : ""}</text>`;
    }).join("")}</svg>`;
  }
  function ensure() {
    if (document.getElementById("gtnhCalcOverlay")) return;
    const overlay = document.createElement("div"); overlay.id = "gtnhCalcOverlay"; overlay.className = "gtnhCalcOverlay"; overlay.dataset.mobileTab = "planner";
    const select = (key, id, label, choices) => `<label class="gtnhCalcField" for="${id}">${label}<select id="${id}" data-state="${key}">${choices.map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select></label>`;
    overlay.innerHTML = `<section class="gtnhCalcPanel" role="dialog" aria-modal="true" aria-label="GTNH production planner"><header class="gtnhCalcHead"><div><h2>Production Planner</h2><p>Materials, production routes, machines and energy from recipe data.</p></div><button id="gtnhCalcClose" aria-label="Close planner" type="button">×</button></header>
      <nav class="gtnhCalcTabs" aria-label="Planner views"><button data-calc-tab="planner" class="active" type="button">Planner</button><button data-calc-tab="tree" type="button">Tree</button><button data-calc-tab="code" type="button">Code / Export</button><button id="calcBuild" type="button">Build tree</button></nav>
      <p id="plannerStatus" role="status" aria-live="polite"></p><main class="gtnhCalcWorkspace"><section class="gtnhCalcCol" data-calc-panel="planner"><h3>Target and settings</h3>
      <label class="gtnhCalcField" for="calcTarget">Target name or exact ID<input id="calcTarget" data-state="target" list="plannerGoods" autocomplete="off" placeholder="Epichlorohydrin"><datalist id="plannerGoods"></datalist></label>
      <label class="gtnhCalcField" for="calcAmount">Amount<input id="calcAmount" type="number" min="0.000001" step="any" data-state="amount"></label>
      ${select("unit", "calcUnit", "Quantity unit", [["items","items"],["stacks","stacks (dataset's native item size)"],["L","L (GT fluid units)"],["buckets","buckets (1000 L)"],["batches","recipe batches"]])}
      ${select("rateMode", "calcRateMode", "Amount mode", [["total","total craft"],["per_second","per second"],["per_minute","per minute"],["per_hour","per hour"]])}
      ${select("rounding", "calcRounding", "Total-craft rounding", [["whole","Whole batches (surplus shown)"],["fractional","Fractional / expected quantities"]])}
      ${select("depth", "calcDepth", "Dependency depth", [["1","1 level"],["3","3 levels"],["full","Full (cycle/budget protected)"]])}
      ${select("routeMode", "calcRouteMode", "Automatic route policy", [["ask","Choose when multiple routes exist"],["lowest_tier","Lowest recipe voltage"],["fastest","Fastest per target output"],["lowest_eut","Lowest EU/t"],["fewest_inputs","Fewest consumed inputs"],["manual","Only locked routes"]])}
      ${select("machineMode", "calcMachineMode", "Machine mode", [["auto","Compute machines for target rate"],["fixed","Check fixed root machine capacity"]])}
      <label class="gtnhCalcField" for="calcMachineCount">Root machine count<input id="calcMachineCount" type="number" min="1" step="1" data-state="machineCount"></label>
      <details id="plannerInventory"><summary>Stock on hand (total jobs)</summary><p>Enter native item counts or L of fluid (1000 L = 1 bucket). Stock is shared across branches and deducted once per job. Continuous rates and reusable startup stock remain separate.</p><label class="gtnhCalcField" for="plannerStockGood">Material name or exact ID<input id="plannerStockGood" list="plannerStockGoods" autocomplete="off"><datalist id="plannerStockGoods"></datalist></label><label class="gtnhCalcField" for="plannerStockAmount">Stock quantity<input id="plannerStockAmount" type="number" min="0" step="any" value="1"></label><button id="plannerAddStock" type="button">Set stock quantity</button><div id="plannerInventoryList"></div></details>
      <details><summary>Supply and expansion settings</summary><div class="gtnhCalcChecks">${Object.entries({waterFree:"Supply water freely",steamFree:"Supply steam freely",cellsReusable:"Expand returned-cell stock details",expandCircuits:"Expand circuit production",expandMachines:"Expand machine production",expandPlatesWires:"Expand plates, wires and cables"}).map(([key,label])=>`<label><input type="checkbox" data-setting="${key}"> ${label}</label>`).join("")}</div><p>Only actually returned containers/tools are reusable; consumed empty cells remain requirements.</p><button id="plannerResetChoices" type="button">Clear route and supply overrides</button></details>
      <div class="gtnhCalcActions"><button id="calcUseSearch" type="button">Use search text</button><button id="calcClear" type="button">Clear</button></div></section>
      <section class="gtnhCalcCol" data-calc-panel="tree"><h3>Production and materials</h3><div id="calcTree"></div></section>
      <section class="gtnhCalcCol" data-calc-panel="code"><h3>Exports and import</h3><div class="gtnhCodeTabs">${["summary","json","yaml","csv","errors"].map(name=>`<button type="button" data-planner-owned data-planner-code="${name}">${name.toUpperCase()}</button>`).join("")}</div><label id="calcCodeLabel" for="calcCodeOut">Summary</label><textarea id="calcCodeOut" readonly></textarea><div class="gtnhCalcActions"><button id="calcCopyCode" data-planner-owned type="button">Copy</button><button id="calcDownloadJson" data-planner-owned type="button">Download JSON</button><button id="plannerDownloadCsv" data-planner-owned type="button">Download CSV</button><button id="plannerDownloadSvg" data-planner-owned type="button">Download SVG</button><label class="plannerImport">Import plan<input id="plannerImport" type="file" accept=".json,application/json"></label></div><p>JSON plans are tied to their recipe dataset. CSV contains materials; SVG is a standalone dependency diagram. YAML uses base recipe values and requires review before gtnh-flow solving.</p></section></main></section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", async event => {
      const button = event.target.closest("button"); if (!button) return;
      if (button.dataset.calcTab) { tab(button.dataset.calcTab); return; }
      if (button.dataset.plannerCode) { codeTab = button.dataset.plannerCode; render(); return; }
      if (button.dataset.supply) { state.rawOverrides.push(button.dataset.supply); built = true; save(); calculate(); render(); return; }
      if (button.dataset.stock) {
        tab("planner"); overlay.querySelector("#plannerInventory").open = true;
        const input = overlay.querySelector("#plannerStockGood"); input.value = button.dataset.stock;
        overlay.querySelector("#plannerStockAmount").value = state.inventory[button.dataset.stock] ?? 1;
        input.focus(); return;
      }
      if (button.dataset.stockRemove) { delete state.inventory[button.dataset.stockRemove]; saveInventory(); return; }
      switch (button.id) {
        case "gtnhCalcClose": close(); break;
        case "calcBuild": build(); tab("tree"); break;
        case "calcUseSearch": state.target = document.getElementById("search").value.trim(); sync(); save(); break;
        case "plannerShowMore": displayNodeLimit += 250; render(); break;
        case "calcClear": state = structuredClone(defaultPlannerState); plan = null; built = false; error = ""; sync(); save(); render(); break;
        case "plannerResetChoices": state.routeChoices = {}; state.machineConfigs = {}; state.rawOverrides = []; state.oreChoices = {}; state.lockedRoutes = {}; save(); calculate(); render(); break;
        case "plannerAddStock": {
          const good = catalog()?.resolve(overlay.querySelector("#plannerStockGood").value.trim());
          const amount = Number(overlay.querySelector("#plannerStockAmount").value);
          if (!good || catalog().describe(good).type === "ore") { error = "Select an exact item or fluid for stock on hand."; render(); break; }
          if (!Number.isFinite(amount) || amount < 0) { error = "Stock quantity must be finite and non-negative."; render(); break; }
          if (!Object.hasOwn(state.inventory, good.id) && Object.keys(state.inventory).length >= 1000) { error = "Inventory is limited to 1,000 goods per plan."; render(); break; }
          if (amount) state.inventory[good.id] = amount; else delete state.inventory[good.id];
          saveInventory(); break;
        }
        case "calcCopyCode": try { await navigator.clipboard.writeText(code()); } catch { error = "Clipboard unavailable. Select and copy the export text."; render(); } break;
        case "calcDownloadJson": download("gtnh-atlas-plan.json", serializePlan(state,dataset()), "application/json"); break;
        case "plannerDownloadCsv": if (plan) download("gtnh-atlas-materials.csv",planCsv(plan),"text/csv"); break;
        case "plannerDownloadSvg": if (plan) download("gtnh-atlas-dependencies.svg",diagram(plan.nodes.length),"image/svg+xml"); break;
      }
    });
    overlay.addEventListener("input", event => {
      if (["calcTarget", "plannerStockGood"].includes(event.target.id)) {
        const query = event.target.value.toLowerCase();
        const matches = catalog()?.goods.filter(good => (good.name || "").toLowerCase().includes(query) || good.id.toLowerCase().includes(query)).slice(0,25) || [];
        overlay.querySelector(event.target.id === "calcTarget" ? "#plannerGoods" : "#plannerStockGoods").innerHTML = matches.map(good => `<option value="${esc(good.id)}">${esc(good.name)} · ${esc(good.mod)}</option>`).join("");
      }
      if (event.target.matches("[data-state],[data-setting]")) { read(); built = false; plan = null; render(); }
    });
    overlay.addEventListener("change", async event => {
      const input = event.target;
      if (input.dataset.stockQuantity) {
        const amount = Number(input.value);
        if (!Number.isFinite(amount) || amount < 0) { error = "Stock quantity must be finite and non-negative."; render(); return; }
        if (amount) state.inventory[input.dataset.stockQuantity] = amount; else delete state.inventory[input.dataset.stockQuantity];
        saveInventory(); return;
      } else if (input.dataset.routeGood) {
        if (input.value) state.routeChoices[input.dataset.routeGood] = input.value; else delete state.routeChoices[input.dataset.routeGood];
      } else if (input.dataset.ore) state.oreChoices[input.dataset.ore] = input.value;
      else if (input.dataset.profileField) {
        const id = input.closest("[data-profile]").dataset.profile;
        if (input.dataset.profileField !== "overclockMode" && (!input.value || !input.checkValidity())) {
          input.value = state.machineConfigs[id]?.[input.dataset.profileField] ?? (input.dataset.profileField === "parallels" ? 1 : 0);
          overlay.querySelector("#plannerStatus").textContent = "Parallel lanes must be whole numbers from 1–4096; overclocks from 0–10. Previous profile retained.";
          return;
        }
        state.machineConfigs[id] = { ...(state.machineConfigs[id] || {}), [input.dataset.profileField]: input.dataset.profileField === "overclockMode" ? input.value : Number(input.value) };
      } else if (input.id === "plannerImport") {
        try {
          if (input.files[0]?.size > 2000000) throw new Error("Plan exceeds the 2 MB import limit.");
          state = importPlan(await input.files[0].text(), dataset()); sync(); built = true; error = "";
        } catch (failure) { error = failure.message; render(); return; }
      } else return;
      save(); calculate(); render();
    });
    overlay.addEventListener("toggle", event => {
      const details = event.target;
      if (!details.open || !details.dataset.nodeKey || !plan) return;
      const slot = details.querySelector("[data-route-slot]");
      if (slot && !slot.children.length) {
        const node = plan.nodes.find(value => value.key === Number(details.dataset.nodeKey));
        if (node) slot.innerHTML = routeControl(node);
      }
    }, true);
    overlay.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const elements = [...overlay.querySelectorAll('button, input, select, textarea, a[href], summary')].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    sync(); render();
  }
  function open() { load(); ensure(); sync(); render(); previousFocus = document.activeElement; document.getElementById("gtnhCalcOverlay").classList.add("show"); document.getElementById("calcTarget").focus({ preventScroll: true }); }
  function close() { document.getElementById("gtnhCalcOverlay")?.classList.remove("show"); (previousFocus?.isConnected ? previousFocus : document.getElementById("toolCalc"))?.focus(); }
  window.GTNH_CALC = { open, close, build,
    planItem(id) {
      load(); const good = catalog()?.resolve(id); if (!good) return false;
      state.target = id; state.unit = catalog().describe(good).unit; state.amount = 1;
      built = true; calculate(); save(); open(); tab("tree");
      document.querySelector(".plannerNodes summary")?.focus(); return true;
    }, getState: () => { load(); return structuredClone(state); }, getPlan: () => plan,
    exportYaml: () => plan ? exportPlanYaml(plan) : "# Build a production plan first.\n",
    import: text => { load(); state = importPlan(text, dataset()); save(); if (document.getElementById("gtnhCalcOverlay")) { sync(); built=true; calculate(); render(); } return structuredClone(state); } };
  window.GTNH_CALC_YAML_EXPORT = { buildYaml: () => window.GTNH_CALC.exportYaml() };
}
