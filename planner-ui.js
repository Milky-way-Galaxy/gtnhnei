import { calculateFactory, recipeMetrics } from "./production-engine.js";
import { exportPlanYaml, planCsv, machinesCsv } from "./recipe-export.js";
import { defaultPlannerState, normalizePlannerState, serializePlan, importPlan } from "./planner-state.js";
import { mountPlanTools, installSharedPlanNotice } from "./plan-tools-ui.js";
import { recipeMetadataRows } from "./recipe-details.js";
import { machinePerformance } from "./machine-model.js";
import { machineProfileHtml, initialMachineConfig } from "./machine-profile-ui.js";
import { factoryCapacityHtml } from "./factory-capacity-ui.js";
import { createSupplyTools } from "./supply-ui.js";
import { openRouteChoices } from "./route-choice-ui.js";
import { readMaterialDraft, factorySettingsSummary } from "./calculator-workspace.js";
import { openItemPicker } from "./item-picker.js";
import { planDiagnostics } from "./plan-diagnostics.js";
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const quantityFormat = new Intl.NumberFormat("en", { maximumSignificantDigits: 7 });
const fmt = number => number === null || number === undefined ? "unknown" : quantityFormat.format(number);

export function installPlanner() {
  let previousFocus = null, displayNodeLimit = 250, planTools, legacyDraft, workspaceBackup = null, migrationNotes = [], storageWarning = "";
  let state = structuredClone(defaultPlannerState), datasetId = null, plan = null, error = "", built = false, codeTab = "summary";
  const catalog = () => window.GTNH_CATALOG;
  const dataset = () => catalog()?.dataset || { id: "gtnh-2.8.0", label: "GTNH 2.8.0" };
  const supplies = createSupplyTools({ catalog, getPlan: () => plan, getState: () => state, update: values => { Object.assign(state, values); return save(); } });
  const key = () => `gtnh_atlas_planner_v1_${dataset().id}`;
  function load() {
    if (!catalog()) return;
    if (datasetId === dataset().id) return;
    datasetId = dataset().id;
    try {
      const saved = localStorage.getItem(key()) || (datasetId === "gtnh-2.8.0" || datasetId === "legacy" ? localStorage.getItem("gtnhnei_calc_state") : null);
      const restored = saved ? JSON.parse(saved) : null;
      // A zero/blank amount was a valid unfinished draft in the old shell. Keep
      // its route/settings preferences while giving it a calculable amount.
      if (restored && (!(Number(restored.amount) > 0) || !Number.isFinite(Number(restored.amount)))) restored.amount = 1;
      state = restored ? normalizePlannerState(restored) : { ...structuredClone(defaultPlannerState), uiMode: "basic" };
      legacyDraft = readMaterialDraft(catalog(), { getItem: key => localStorage.getItem(key) });
      migrationNotes = legacyDraft.issues;
      if (!saved && legacyDraft.state) { state = legacyDraft.state; migrationNotes = ["Your previous Calculator draft was opened in Basic mode. Its original storage is unchanged.", ...migrationNotes]; }
      try { workspaceBackup = localStorage.getItem(`gtnh_atlas_before_material_import_${datasetId}`); } catch { /* Session-only backup remains available below. */ }
    } catch { state = { ...structuredClone(defaultPlannerState), uiMode: "basic" }; storageWarning = "Browser storage is unavailable. Export JSON to preserve this session's plan."; }
  }
  function save() {
    try { localStorage.setItem(key(), JSON.stringify(state)); return true; }
    catch { storageWarning = "Storage is unavailable. Export JSON to preserve your plan."; return false; }
  }
  function setMode(mode) {
    if (!["basic", "factory"].includes(mode)) return;
    read(); state.uiMode = mode; save(); render();
  }
  function renderWorkspace(root) {
    root.dataset.calculatorMode = state.uiMode;
    root.querySelectorAll("[data-calculator-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.calculatorMode === state.uiMode)));
    const active = factorySettingsSummary(state), notice = root.querySelector("#calculatorActiveSettings");
    notice.hidden = state.uiMode !== "basic" || !active.length;
    notice.querySelector("span").textContent = `Still included in these results: ${active.join(" · ")}. Switching modes preserves every setting.`;
    root.querySelector("#calculatorModeHint").textContent = state.uiMode === "basic" ? "One product and its materials." : "Multiple outputs, stock and machine profiles.";
    const migration = root.querySelector("#calculatorMigration");
    migration.hidden = !legacyDraft?.raw && !migrationNotes.length && !workspaceBackup;
    root.querySelector("#calculatorMigrationNotes").textContent = migrationNotes.join(" ");
    root.querySelector("#calculatorImportLegacy").disabled = !legacyDraft?.state;
    root.querySelector("#calculatorRestoreDraft").hidden = !workspaceBackup;
    const good = catalog()?.resolve(state.target), selected = root.querySelector("#calculatorSelectedGood");
    selected.hidden = !good;
    if (good) {
      selected.querySelector("b").textContent = good.name; selected.querySelector("small").textContent = `${good.id} · ${catalog().describe(good).unit === "L" ? "Fluid · 1000 L = 1 bucket" : "Item"}`;
      window.GTNHNEI_ICON_API?.setIconByName(selected.querySelector(".pickerIcon"), good.id);
    }
    const loops = plan?.balance?.loops || [], seedBox = root.querySelector("#plannerLoopSeeds");
    seedBox.innerHTML = loops.length ? loops.map((loop, i) => `<fieldset><legend>Loop ${i + 1}: circulating startup stock</legend><p>Declare actual stock in at least one of these forms. This is additional to per-machine reusable reserves; sufficiency and the startup sequence need in-game verification.</p>${loop.map(good => `<label>${esc(good.name)} (${esc(good.unit)})<input type="number" min="0" step="${good.type === "item" ? "1" : "any"}" data-loop-seed="${esc(good.id)}" value="${state.loopSeeds[good.id] ?? ""}" aria-label="Circulating stock: ${esc(good.name)}"><small>${esc(good.id)}</small></label>`).join("")}</fieldset>`).join("") : '<p class="plannerHint">Build a rate plan to identify selected-recipe loops. Keep external feedstocks explicitly supplied.</p>';
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function options() {
    const c = catalog(), targetIds = new Set([state.target, ...state.additionalTargets.map(entry => entry.target)].map(value => c.resolve(value)?.id));
    const routeChoices = { ...state.lockedRoutes, ...state.routeChoices };
    const makers = window.GTNH_MAKER_API;
    const externalInputs = new Set(state.rawOverrides), freeInputs = new Set(state.ignored);
    for (const id of Object.keys(makers?.getState().externalInputs || {})) if (/^[ifo]:/.test(id) && !targetIds.has(id) && makers.isExternalInput(id)) externalInputs.add(id);
    for (const good of c.goods) {
      const maker = makers?.makerInfo(good.id);
      if (maker && routeChoices[good.id] === undefined) routeChoices[good.id] = maker.recipeId || maker.routeIndex;
      if (targetIds.has(good.id)) continue;
      const name = (good.name || "").toLowerCase();
      if (state.ignored.includes(good.id) || state.ignored.includes(name) || state.settings.waterFree && name === "water" || state.settings.steamFree && ["steam", "superheated steam", "dense steam"].includes(name)) freeInputs.add(good.id);
      if (state.rawOverrides.includes(name) || makers?.isExternalInput(good.id) ||
        !state.settings.expandCircuits && /circuit/.test(name) || !state.settings.expandMachines && good.id.startsWith("i:gregtech:gt.blockmachines:") ||
        !state.settings.expandPlatesWires && /\b(plate|wire|cable)s?\b/.test(name)) externalInputs.add(good.id);
    }
    return { ...state, reuseByproducts:state.settings.reuseByproducts, routeChoices, externalInputs: [...externalInputs], freeInputs: [...freeInputs], targets: [{target:state.target, amount:state.amount, unit:state.unit, machineCount:state.machineCount}, ...state.additionalTargets] };
  }
  function restoreCodeOutput() {
    const root = document.getElementById("gtnhCalcOverlay");
    if (!root) return;
    const graph = root.querySelector("#gtnhFlowBrowserPanel");
    if (graph) graph.style.display = "none";
    for (const id of ["calcCodeOut", "calcCodeLabel"]) root.querySelector(`#${id}`).style.display = "";
  }
  function calculate() {
    restoreCodeOutput();
    error = ""; plan = null;
    try {
      if (!catalog()) throw new Error("The recipe database is still loading. Try Build again when loading completes.");
      plan = calculateFactory(catalog(), options());
    } catch (failure) { error = failure.message; }
  }
  function build() {
    load(); read(); built = true; calculate(); render();
  }
  function read() {
    const root = document.getElementById("gtnhCalcOverlay");
    if (!root) return;
    for (const id of ["target", "amount", "unit", "rateMode", "depth", "routeMode", "machineMode", "machineCount", "rounding", "balanceMode"]) {
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
    root.querySelectorAll("[data-calc-tab]").forEach(button => {
      const active = button.dataset.calcTab === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
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
  function renderTargets(root) {
    root.querySelector("#plannerFactoryTargets").innerHTML = state.additionalTargets.map((entry, index) => {
      const good = catalog()?.resolve(entry.target);
      return `<div class="plannerFactoryTarget"><b>${esc(good?.name || entry.target)}</b><small>${esc(entry.target)}</small><div class="plannerProfile"><label>Amount<input type="number" min="0.000000001" step="any" data-target-field="amount" data-target-index="${index}" value="${entry.amount}"></label><label>Unit<select data-target-field="unit" data-target-index="${index}">${["items","stacks","L","buckets","batches"].map(unit=>`<option ${entry.unit===unit?"selected":""}>${unit}</option>`).join("")}</select></label><label>Root machines<input type="number" min="1" max="1000000" data-target-field="machineCount" data-target-index="${index}" value="${entry.machineCount ?? 1}"></label></div><button type="button" data-target-remove="${index}" aria-label="Remove factory output: ${esc(good?.name || entry.target)}">Remove output</button></div>`;
    }).join("") || '<p class="plannerEmpty">The primary target above is the only output.</p>';
  }
  function saveInventory() {
    save();
    if (built) calculate(); else error = "";
    render();
  }
  function setInstalledMachines(id, value) {
    const recipe = plan?.steps.find(step => step.recipeId === id)?.recipe;
    if (!recipe) return false;
    const next = { ...(state.machineConfigs[id] || {}) };
    if (value === undefined) delete next.installedMachines;
    else next.installedMachines = value;
    try { machinePerformance(recipe, next); }
    catch (failure) { document.querySelector("#plannerStatus").textContent = `${failure.message} Previous count retained.`; return false; }
    state.machineConfigs[id] = next; save(); calculate(); render(); return true;
  }
  function routeControl(node) {
    const good = catalog().resolve(node.id);
    if (node.type === "ore") {
      const alternatives = good?.items || [];
      return `<label>Ingredient for ${esc(node.name)}<select data-ore="${esc(node.id)}"><option value="">Keep OreDict unresolved</option>${alternatives.map(g => `<option value="${esc(g.id)}" ${state.oreChoices[node.id] === g.id ? "selected" : ""}>${esc(g.name)} · ${esc(g.id)}</option>`).join("")}</select></label>`;
    }
    const routes = good ? catalog().recipes(good) : [];
    if (!routes.length) return "";
    return `<label>Production route<select data-route-good="${esc(node.id)}"><option value="">${["ask", "manual"].includes(state.routeMode) ? "Choose a route" : "Automatic route policy"}</option>${routes.map((r, index) => { const metrics = recipeMetrics(r, node), unit = catalog().describe(good).unit; return `<option value="${esc(r.id)}" ${node.recipeId === r.id ? "selected" : ""} ${metrics.output > 0 ? "" : "disabled"}>${index + 1}. ${esc(r.machine)} · ${r.tier || "non-electric/unknown"} · ${r.durationTicks === null ? "time unknown" : fmt(r.durationTicks / 20) + "s"} · ${fmt(r.eut)} EU/t · net ${fmt(metrics.output)} ${unit}/batch${metrics.expected ? " (expected)" : ""} · ${fmt(metrics.energyPerOutput)} EU/${unit === "items" ? "item" : unit}</option>`; }).join("")}</select></label><button type="button" data-compare-good="${esc(node.id)}" data-selected-recipe="${esc(node.recipeId || "")}">Compare ${routes.length} production routes</button>`;
  }
  function summary() {
    if (!plan) return error || "Enter a target and press Build tree.";
    return [`GTNH Atlas — ${dataset().label}`, ...plan.targets.map(target => `${target.name}: ${fmt(target.requested)} ${target.unit}${plan.isRate ? "/s" : ""}`),
      `Known ${plan.isRate ? "average EU/t" : "energy (EU)"}: ${fmt(plan.isRate ? plan.knownAverageEut : plan.knownEnergy)}${plan.hasUnknownPower ? " (partial; unknown machines)" : ""}`,
      ...(plan.capacityAnalysis ? [`Known-stage capacity ceiling: ${plan.capacityAnalysis.rateFactor === null ? "unknown" : fmt(plan.capacityAnalysis.rateFactor * 100) + "% of requested mix"}`,
        ...plan.capacityAnalysis.targets.map(target => `${target.name} at ceiling: ${fmt(target.capacity)} ${target.unit}/s`), "Assumes supplied inputs, transport and remaining recipe conditions."] : []),
      "", "Materials:", ...plan.materials.map(row => `${fmt(row.amount)} ${row.unit}${plan.isRate ? "/s" : ""} ${row.name} [${row.id}]`),
      "", "Used from inventory:", ...plan.inventoryUsed.map(row => `${fmt(row.amount)} ${row.unit} ${row.name} [${row.id}]`),
      "", "Reused co-products:", ...plan.byproductsUsed.map(row => `${fmt(row.amount)} ${row.unit}${plan.isRate?"/s":""} ${row.name} [${row.id}]`),
      "", "Reusable startup stock:", ...plan.reusable.map(row => `${fmt(row.amount)} ${row.unit} ${row.name}`),
      "", ...plan.warnings].join("\n");
  }
  function diagnosticsHtml() {
    const checks = planDiagnostics(plan);
    const issue = row => `<li><b>${esc(row.name)}</b> — ${esc(row.message)}${row.occurrences > 1 ? ` (${row.occurrences} branches)` : ""}<small>${esc(row.id)}</small><button type="button" data-review-node="${row.nodeKey}">Review dependency</button> <button type="button" data-supply="${esc(row.id)}">Supply externally</button>${row.reason === "no-recipe" ? ` <button type="button" data-report-good="${esc(row.id)}">Save recipe-coverage report</button>` : ""}</li>`;
    return `<section class="plannerDiagnostics"><h4>Plan checks</h4><p>${checks.attention.length ? `${checks.attention.length} route/dependency decision(s) need attention. Their demand is retained as supplied material until resolved.` : "Selected routes are expanded to the configured depth."}</p>${checks.attention.length ? `<ul>${checks.attention.slice(0, 100).map(issue).join("")}</ul>` : ""}${checks.cycles.length ? `<details open class="plannerCycleInspector"><summary>Circular dependencies (${checks.cycles.length})</summary>${checks.cycles.map(loop => `<article><p><b>${loop.goods.map(good => esc(good.name)).join(" → ")}</b></p><p>Recipes: ${loop.recipeIds.map(esc).join(" · ")}</p><p>These routes require a supplied boundary or validated recycling balance. The recursive plan does not credit future output as startup stock.</p><button type="button" data-review-node="${loop.nodeKey}">Review loop boundary</button></article>`).join("")}</details>` : ""}${checks.supplies.length ? `<details><summary>External and depth-boundary supplies (${checks.supplies.length})</summary><p>These are supplied inputs, not automatically mined or manufactured. A missing entry is a dataset coverage limit.</p><ul>${checks.supplies.slice(0, 100).map(issue).join("")}</ul>${checks.supplies.length > 100 ? "<p>First 100 shown; the material export contains all demands.</p>" : ""}</details>` : ""}${checks.unknownMachines.length ? `<p>Timing or power is unknown for ${checks.unknownMachines.length} selected recipe(s): ${checks.unknownMachines.map(row => esc(row.machine)).join(", ")}. Power and machine totals are partial.</p>` : ""}${checks.conditionalRecipes.length ? `<p>${checks.conditionalRecipes.length} recipe(s) have conditions. Review machine metadata before building; unsupported conditions are not assumed satisfied.</p>` : ""}</section>`;
  }
  function balanceHtml() {
    if (!plan.balance) return "";
    const balance = plan.balance;
    return `<section class="plannerBalanceNotice" data-balance-status="${balance.status}" ${balance.status === "blocked" ? 'role="alert"' : ""}><h4>${balance.status === "balanced" ? "Steady-state material balance checked" : "Steady-state balance blocked"}</h4><p>${balance.status === "balanced" ? "Guaranteed selected recipes and supplied boundaries balance at the requested rates. Machine rows count each recipe once." : `${esc(balance.reason)} Displayed quantities are recursive boundary estimates; recycling has not been solved.`}</p>${balance.loops?.length ? `<p>${balance.loops.length} closed loop(s): ${balance.loops.map(loop => loop.map(good => esc(good.name)).join(" ↔ ")).join("; ")}. Circulating stock is user-declared and never generated by the calculation. Startup order and adequacy require verification.</p><button type="button" id="plannerEditLoopStock">Review circulating stock in Factory</button>` : ""}</section>`;
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
    renderWorkspace(root);
    if (!plan) restoreCodeOutput();
    const focusedTarget = document.activeElement?.dataset.targetIndex, focusedTargetField = document.activeElement?.dataset.targetField;
    const focusedStock = document.activeElement?.dataset.stockQuantity;
    renderInventory(root);
    renderTargets(root);
    const box = root.querySelector("#calcTree");
    const workspace = root.querySelector(".gtnhCalcWorkspace"), scroll = workspace.scrollTop;
    const expanded = new Set([...box.querySelectorAll("details[open][data-node-id]")].map(node => node.dataset.nodeId));
    const expandedMachines = new Set([...box.querySelectorAll("details[open][data-machine-id]")].map(node => node.dataset.machineId));
    const active = document.activeElement;
    const restore = focusedTarget !== undefined ? `[data-target-index="${focusedTarget}"][data-target-field="${focusedTargetField}"]` : focusedStock ? `[data-stock-quantity="${CSS.escape(focusedStock)}"]` : active?.dataset.routeGood ? `[data-route-good="${CSS.escape(active.dataset.routeGood)}"]` :
      active?.dataset.compareGood ? `[data-compare-good="${CSS.escape(active.dataset.compareGood)}"]` :
      active?.dataset.installedMachines ? `[data-installed-machines="${CSS.escape(active.dataset.installedMachines)}"]` :
      active?.dataset.addMachine ? `[data-add-machine="${CSS.escape(active.dataset.addMachine)}"]` :
      active?.dataset.defaultMachines ? `[data-installed-machines="${CSS.escape(active.dataset.defaultMachines)}"]` :
      active?.dataset.ore ? `[data-ore="${CSS.escape(active.dataset.ore)}"]` :
      active?.dataset.profileField ? `[data-profile="${CSS.escape(active.closest("[data-profile]").dataset.profile)}"] [data-profile-field="${active.dataset.profileField}"]` : null;
    if (error) box.innerHTML = `<p role="alert" class="plannerError">${esc(error)}</p>`;
    else if (!built || !plan) box.innerHTML = '<div class="calculatorEmpty"><span aria-hidden="true">+</span><h4>Your production plan starts here</h4><p>Choose a product from NEI, set an amount or rate, then select <b>Build tree</b>.</p><p>Materials, machine requirements and power will appear here. Unresolved routes stay visible for you to choose.</p></div>';
    else {
      box.innerHTML = `<p class="plannerDataset">${esc(dataset().label)} · ${plan.targets.length > 1 ? `Factory: ${plan.targets.length} outputs` : `${esc(plan.target.name)} · ${fmt(plan.requested)} ${esc(plan.target.unit)}${plan.isRate ? "/s" : ""}`}</p>
        <div class="plannerMetrics"><div>${plan.isRate ? "Known average EU/t" : "Known energy"}<b>${fmt(plan.isRate ? plan.knownAverageEut : plan.knownEnergy)}${plan.isRate ? "" : " EU"}</b></div><div>${plan.isRate ? "Installed EU/t" : plan.targets.length > 1 ? "Processing times" : "Root processing time"}<b>${plan.isRate ? fmt(plan.knownInstalledEut) : plan.targets.length > 1 ? "Per output below" : fmt(plan.rootTimeSeconds) + " s"}</b></div></div>
        ${plan.targets.length > 1 ? `<h4>Factory outputs</h4><div class="plannerTable"><table><thead><tr><th>Output</th><th>Demand${plan.isRate ? "/s" : ""}</th><th>${plan.isRate ? "Installed recipe capacity/s" : "Root time (s)"}</th></tr></thead><tbody>${plan.targets.map(target=>`<tr><td>${esc(target.name)}<small>${esc(target.id)}</small></td><td>${fmt(target.requested)} ${esc(target.unit)}</td><td>${target.root.status === "from-byproduct" ? "From co-products" : fmt(plan.isRate ? target.installedCapacity : target.timeSeconds)}</td></tr>`).join("")}</tbody></table></div>` : ""}
        <p>${plan.targets.length === 1 && plan.capacity !== null ? plan.isRate ? `Installed root recipe capacity (${fmt(plan.targets[0].installedCount)} machines): ${fmt(plan.targets[0].installedCapacity)} ${esc(plan.target.unit)}/s. ` : `Root capacity with ${state.machineCount} machine(s): ${fmt(plan.capacity)} ${esc(plan.target.unit)}/s. ` : ""}${plan.hasUnknownPower ? "Some timing/power values are unknown. Totals cover known machines only." : "Timing and power use the selected recipe profiles; no other multiblock bonuses are assumed."}</p>
        <details ${plan.unresolved.length ? "open" : ""}><summary>Warnings and unresolved routes (${plan.warnings.length})</summary><ul>${plan.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul></details>
        ${balanceHtml()}${diagnosticsHtml()}${factoryCapacityHtml(plan, state.machineConfigs)}
        <h4>Required materials ${plan.isRate ? "per second" : ""}</h4>${table(plan.materials, "actions")}
        ${plan.inventoryUsed.length ? `<details open><summary>Used from inventory (${plan.inventoryUsed.length})</summary>${table(plan.inventoryUsed)}</details>` : ""}
        ${plan.inventoryRemaining.length ? `<details><summary>Unspent inventory (${plan.inventoryRemaining.length})</summary>${table(plan.inventoryRemaining, "", false)}</details>` : ""}
        <details ${state.settings.cellsReusable ? "open" : ""}><summary>Reusable startup stock (${plan.reusable.length})</summary>${table(plan.reusable, "", false)}</details>
        <details><summary>Byproducts and surplus (${plan.byproducts.length})</summary>${table(plan.byproducts)}</details>
        ${plan.byproductsUsed.length ? `<details open><summary>Reused co-products (${plan.byproductsUsed.length})</summary>${table(plan.byproductsUsed)}</details>` : ""}
        <h4>Dependency tree</h4><p>${plan.nodes.length} nodes. ${plan.truncated ? "Node limit reached; boundary materials retained." : ""}</p>
        <div class="plannerNodes">${plan.nodes.slice(0, displayNodeLimit).map(node => `<details class="plannerNode" data-node-key="${node.key}" data-node-id="${esc(node.id)}" ${node.depth < 2 || expanded.has(node.id) ? "open" : ""}><summary><b>${esc(node.name)}</b> · ${fmt(node.amount)} ${esc(node.unit)}${plan.isRate ? "/s" : ""} · ${esc(node.status.replaceAll("-", " "))}</summary><small>${esc(node.id)} · depth ${node.depth}</small>${node.inventoryUsed ? `<p>${fmt(node.inventoryUsed)} ${esc(node.unit)} supplied from inventory; ${fmt(node.productionAmount)} remaining demand.</p>` : ""}${node.byproductUsed ? `<p>${fmt(node.byproductUsed)} ${esc(node.unit)} supplied from earlier co-products.</p>` : ""}${node.recipeId ? `<p>${esc(node.machine)} · ${fmt(node.batches)} batches${plan.isRate ? "/s" : ""}</p>` : ""}${node.depth === 0 ? routeControl(node) : `<div data-route-slot="${node.key}"></div>`}<button data-supply="${esc(node.id)}" type="button">Supply externally</button></details>`).join("")}</div>
        ${plan.nodes.length > displayNodeLimit ? `<button type="button" id="plannerShowMore">Show ${Math.min(250, plan.nodes.length-displayNodeLimit)} more dependency nodes</button>` : ""}
        <h4>Machine requirements</h4><p>Choose a generic assumption or a named GT5 reference. Machine-specific conditions still require verification.</p>
        ${plan.steps.map(step => { const cfg = state.machineConfigs[step.recipeId] || {}, metadata = recipeMetadataRows(step.recipe), p = step.performance; return `<details class="plannerNode" data-machine-id="${esc(step.recipeId)}" ${expandedMachines.has(step.recipeId) ? "open" : ""}><summary>${esc(step.machine)} · ${plan.isRate ? fmt(step.count) + " required machines (" + fmt(step.equivalents) + " equivalent)" : fmt(step.batches) + " batches"}</summary><p>${p ? fmt(p.durationTicks) + " ticks/batch · " + fmt(p.eut) + " EU/t at full load" + (plan.isRate && step.installedCount !== step.count ? ` · ${fmt(step.installedCount)} configured machines` : "") : "Timing/power unknown"}</p><p>${plan.isRate ? `Average: ${fmt(step.averageEut)} EU/t · installed: ${fmt(step.installedEut)} EU/t` : `Known step energy: ${fmt(step.energy)} EU`}</p>${p?.model ? `<p class="plannerMachineResult">Applied ${p.overclocks} overclocks · ${p.heatOverclocks} heat-perfect · ${p.heatDiscounts} heat discounts · ${fmt(p.availableEut)} EU/t supply${p.tickLimited ? " · one-tick floor reached" : ""}</p>` : ""}${metadata.length ? `<details class="plannerRecipeMetadata"><summary>Recipe metadata</summary><dl>${metadata.map(row => `<dt>${esc(row.key)}</dt><dd>${esc(row.value)}</dd>`).join("")}</dl><p>${p?.model === "ebf" ? "coil_heat is evaluated against the configured machine heat. Other conditions still require verification." : "These exported conditions are not evaluated by this OC/parallel profile."}</p></details>` : ""}
          ${machineProfileHtml(step, cfg, dataset().id)}</details>`; }).join("")}
        <h4>Dependency diagram</h4><div class="plannerDiagram" role="img" aria-label="Recipe dependency diagram">${diagram()}</div>`;
    }
    if (restore) root.querySelector(restore)?.focus({ preventScroll: true });
    workspace.scrollTop = scroll;
    root.querySelector("#calcCodeOut").value = code();
    root.querySelector("#calcCodeLabel").textContent = codeTab === "json" ? "Versioned plan settings (portable JSON)" : codeTab;
    root.querySelector("#plannerStatus").textContent = [error || (plan ? `${plan.materials.length} required materials · ${plan.unresolved.length} unresolved dependencies` : "Ready"), storageWarning].filter(Boolean).join(" · ");
    root.querySelector("#plannerSupplies").disabled = !plan;
  }
  function diagram(limit = 120) {
    const visible = plan.nodes.slice(0, limit), width = 800, height = visible.length * 42 + 24;
    const rowFor = new Map(visible.map((node, index) => [node.key, index]));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><title>Production dependencies for ${plan.targets.map(target=>esc(target.name)).join(", ")}</title>${visible.map((n, i) => {
      const x = 14 + Math.min(n.depth, 10) * 24, y = 14 + i * 42;
      const parentIndex = rowFor.get(n.parent) ?? -1;
      return `${parentIndex >= 0 ? `<path d="M${14 + Math.min(visible[parentIndex].depth, 10) * 24 + 8} ${14 + parentIndex * 42 + 24}V${y + 12}H${x}" fill="none" stroke="#6791ac"/>` : ""}<rect x="${x}" y="${y}" width="${width - x - 14}" height="26" rx="5" fill="${n.status === "produced" ? "#142f44" : "#47371d"}"/><text x="${x + 8}" y="${y + 18}" fill="#eaf2ff" font-size="12">${esc(n.name.slice(0, 65))} · ${fmt(n.amount)} ${esc(n.unit)}${plan.isRate ? "/s" : ""}</text>`;
    }).join("")}</svg>`;
  }
  function ensure() {
    if (document.getElementById("gtnhCalcOverlay")) return;
    const overlay = document.createElement("div"); overlay.id = "gtnhCalcOverlay"; overlay.className = "gtnhCalcOverlay"; overlay.dataset.mobileTab = "planner";
    const select = (key, id, label, choices) => `<label class="gtnhCalcField" for="${id}">${label}<select id="${id}" data-state="${key}">${choices.map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select></label>`;
    overlay.innerHTML = `<section class="gtnhCalcPanel" role="dialog" aria-modal="true" aria-label="GTNH production planner"><header class="gtnhCalcHead"><div><h2>Production Calculator</h2><p>Plan materials, machines and power.</p></div><button id="gtnhCalcClose" aria-label="Close planner" type="button">×</button></header>
      <div class="calculatorModes" role="group" aria-label="Calculator mode"><button id="calculatorModeBasic" data-calculator-mode="basic" type="button">Basic</button><button id="calculatorModeFactory" data-calculator-mode="factory" type="button">Factory</button><p id="calculatorModeHint"></p></div><div id="calculatorActiveSettings" class="calculatorActiveSettings" hidden><span></span><button data-calculator-mode="factory" type="button">Review in Factory</button></div><nav class="gtnhCalcTabs" aria-label="Calculator views"><button data-calc-tab="planner" class="active" type="button">Settings</button><button data-calc-tab="tree" type="button">Results</button><button data-calc-tab="code" type="button">Code / Export</button></nav>
      <p id="plannerStatus" role="status" aria-live="polite"></p><main class="gtnhCalcWorkspace"><section class="gtnhCalcCol" data-calc-panel="planner"><h3>Target and settings</h3><details id="calculatorMigration" hidden><summary>Previous Calculator draft and backups</summary><p id="calculatorMigrationNotes"></p><div class="gtnhCalcActions"><button type="button" id="calculatorImportLegacy">Load previous Calculator draft</button><button type="button" id="calculatorRestoreDraft" hidden>Restore workspace before import</button><button type="button" id="calculatorBackupLegacy">Download untouched legacy backup</button></div></details>
      <label class="gtnhCalcField" for="calcTarget">Product<input id="calcTarget" data-state="target" list="plannerGoods" autocomplete="off" placeholder="Choose from NEI, or enter a name / ID"><datalist id="plannerGoods"></datalist></label><button id="calculatorChooseGood" class="calculatorChooseGood" data-pick-field="calcTarget" type="button" aria-haspopup="dialog">Choose item / fluid from NEI</button><div id="calculatorSelectedGood" class="calculatorSelectedGood" hidden><span class="pickerIcon" aria-hidden="true"></span><span><b></b><small></small></span></div>
      <div class="calculatorFieldRow"><label class="gtnhCalcField" for="calcAmount">Amount<input id="calcAmount" type="number" min="0.000001" step="any" data-state="amount"></label>
      ${select("unit", "calcUnit", "Quantity unit", [["items","items"],["stacks","stacks (dataset's native item size)"],["L","L (GT fluid units)"],["buckets","buckets (1000 L)"],["batches","recipe batches"]])}</div>
      ${select("rateMode", "calcRateMode", "Amount mode", [["total","total craft"],["per_second","per second"],["per_minute","per minute"],["per_hour","per hour"]])}
      ${select("rounding", "calcRounding", "Total-craft rounding", [["whole","Whole batches (surplus shown)"],["fractional","Fractional / expected quantities"]])}
      ${select("depth", "calcDepth", "Dependency depth", [["1","1 level"],["3","3 levels"],["full","Full (cycle/budget protected)"]])}
      ${select("routeMode", "calcRouteMode", "Automatic route policy", [["ask","Choose when multiple routes exist"],["lowest_energy","Lowest base energy per output"],["lowest_tier","Lowest recipe voltage"],["fastest","Fastest per target output"],["lowest_eut","Lowest EU/t"],["fewest_inputs","Fewest consumed inputs"],["manual","Only locked routes"]])}
      <div data-factory-only>${select("machineMode", "calcMachineMode", "Machine mode", [["auto","Compute machines for target rate"],["fixed","Check fixed root machine capacity"]])}<p class="plannerHint">Automatic policies compare individual base recipes. Upstream energy and machine-specific bonuses are excluded.</p>
      <label class="gtnhCalcField" for="calcMachineCount">Root machine count<input id="calcMachineCount" type="number" min="1" step="1" data-state="machineCount"></label></div>
      <details id="plannerBalanceSettings" data-factory-only><summary>Recycling and material balance</summary>${select("balanceMode", "calcBalanceMode", "Calculation method", [["recursive","Recursive expansion (existing plan behavior)"],["steady_state","Guided steady-state balance (guaranteed recipes)"]])}<p>Steady-state mode uses continuous rates, exact selected recipes and supplied boundaries. Selecting it starts at full dependency depth. Ambiguous, negative, non-unique or chance-dependent balances remain blocked.</p><div id="plannerLoopSeeds"></div></details><div id="plannerPlanTools"></div><details id="plannerFactory" data-factory-only><summary>Additional factory outputs</summary><p>All outputs use the amount mode above. Materials, finite inventory and recipe machine requirements are shared. Co-products are listed separately; times are per output.</p><label class="gtnhCalcField" for="plannerFactoryGood">Output name or exact ID<input id="plannerFactoryGood" list="plannerFactoryGoods" autocomplete="off"><datalist id="plannerFactoryGoods"></datalist></label><button type="button" data-pick-field="plannerFactoryGood" aria-haspopup="dialog">Choose factory output from NEI</button><button id="plannerAddTarget" type="button">Add factory output</button><div id="plannerFactoryTargets"></div></details>
      <details id="plannerInventory" data-factory-only><summary>Stock on hand (total jobs)</summary><p>Enter native item counts or L of fluid (1000 L = 1 bucket). Stock is shared across branches and deducted once per job. Continuous rates and reusable startup stock remain separate.</p><label class="gtnhCalcField" for="plannerStockGood">Material name or exact ID<input id="plannerStockGood" list="plannerStockGoods" autocomplete="off"><datalist id="plannerStockGoods"></datalist></label><button type="button" data-pick-field="plannerStockGood" aria-haspopup="dialog">Choose stock item from NEI</button><label class="gtnhCalcField" for="plannerStockAmount">Stock quantity<input id="plannerStockAmount" type="number" min="0" step="any" value="1"></label><button id="plannerAddStock" type="button">Set stock quantity</button><div id="plannerInventoryList"></div></details>
      <details><summary>Supply and expansion settings</summary><div class="gtnhCalcChecks">${Object.entries({waterFree:"Supply water freely",steamFree:"Supply steam freely",cellsReusable:"Expand returned-cell stock details",expandCircuits:"Expand circuit production",expandMachines:"Expand machine production",expandPlatesWires:"Expand plates, wires and cables",reuseByproducts:"Reuse earlier co-products (order affects totals)"}).map(([key,label])=>`<label><input type="checkbox" data-setting="${key}"> ${label}</label>`).join("")}</div><p>Only actually returned containers/tools are reusable; consumed empty cells remain requirements.</p><button id="plannerResetChoices" type="button">Clear route and supply overrides</button></details>
      <div class="gtnhCalcActions"><button id="calcUseSearch" type="button">Use search text</button><button id="calcClear" type="button">Clear</button></div></section>
      <section class="gtnhCalcCol" data-calc-panel="tree"><h3>Production and materials</h3><div id="calcTree"></div></section>
      <section class="gtnhCalcCol" data-calc-panel="code"><h3>Exports and import</h3><div class="gtnhCodeTabs">${["summary","json","yaml","csv","errors"].map(name=>`<button type="button" data-planner-owned data-planner-code="${name}">${name.toUpperCase()}</button>`).join("")}</div><label id="calcCodeLabel" for="calcCodeOut">Summary</label><textarea id="calcCodeOut" readonly></textarea><div class="gtnhCalcActions"><button id="calcCopyCode" data-planner-owned type="button">Copy</button><button id="calcDownloadJson" data-planner-owned type="button">Download JSON</button><button id="plannerDownloadCsv" data-planner-owned type="button">Download CSV</button><button id="plannerDownloadMachines" data-planner-owned type="button">Download machines CSV</button><button id="plannerDownloadSvg" data-planner-owned type="button">Download SVG</button><label class="plannerImport">Import plan<input id="plannerImport" type="file" accept=".json,application/json"></label></div><p>JSON plans are tied to their recipe dataset. CSV contains materials; SVG is a standalone dependency diagram. YAML uses base recipe values and requires review before gtnh-flow solving.</p></section></main><footer class="calculatorActions"><button id="calcBuild" type="button">Build tree</button><button id="plannerSupplies" type="button" title="Operating supplies and printable build checklist">Supplies</button><span>Calculations run when you build.</span></footer></section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", async event => {
      const button = event.target.closest("button"); if (!button) return;
      if (button.dataset.calculatorMode) { setMode(button.dataset.calculatorMode); return; }
      if (button.dataset.reviewNode !== undefined) {
        tab("tree");
        const details = overlay.querySelector(`[data-node-key="${button.dataset.reviewNode}"]`);
        if (details) { details.open = true; details.querySelector("summary")?.focus(); details.scrollIntoView({ block: "nearest" }); }
        return;
      }
      if (button.dataset.reportGood) {
        const good = catalog()?.resolve(button.dataset.reportGood);
        if (!good) return;
        download("gtnh-atlas-recipe-coverage.json", JSON.stringify({ format: "gtnh-atlas-recipe-coverage", schemaVersion: 1,
          dataset: { id: dataset().id, sha256: dataset().sha256, source: dataset().source, sourceRevision: dataset().sourceRevision },
          good: catalog().describe(good), productionEntries: good.production.length, usageEntries: good.consumption.length,
          note: "No production entry was present in this snapshot. This does not prove the item is unobtainable; gathered resources and unsupported custom recipe handlers may have no entry." }, null, 2), "application/json");
        return;
      }
      if (button.dataset.pickField && catalog()) {
        const field = button.dataset.pickField, input = overlay.querySelector(`#${field}`);
        openItemPicker(catalog(), good => {
          if (field === "calcTarget") {
            state.target = good.id; state.unit = catalog().describe(good).unit; built = false; plan = null; error = ""; sync(); save(); render();
          } else { input.value = good.id; overlay.querySelector(field === "plannerStockGood" ? "#plannerStockAmount" : "#plannerAddTarget").focus(); }
        }, { query: input.value.trim() }); return;
      }
      if (button.dataset.calcTab) { tab(button.dataset.calcTab); return; }
      if (button.dataset.plannerCode) { restoreCodeOutput(); codeTab = button.dataset.plannerCode; render(); return; }
      if (button.dataset.compareGood) {
        const currentOptions = options(), baseline = plan;
        openRouteChoices(catalog(), button.dataset.compareGood, button.dataset.selectedRecipe, recipeId => {
          state.routeChoices[button.dataset.compareGood] = recipeId; built = true; save(); calculate(); render();
        }, { baseline, preview: recipeId => calculateFactory(catalog(), { ...currentOptions, routeChoices: { ...currentOptions.routeChoices, [button.dataset.compareGood]: recipeId } }) }); return;
      }
      if (button.dataset.supply) { state.rawOverrides.push(button.dataset.supply); built = true; save(); calculate(); render(); return; }
      if (button.dataset.stock) {
        setMode("factory");
        tab("planner"); overlay.querySelector("#plannerInventory").open = true;
        const input = overlay.querySelector("#plannerStockGood"); input.value = button.dataset.stock;
        overlay.querySelector("#plannerStockAmount").value = state.inventory[button.dataset.stock] ?? 1;
        input.focus(); return;
      }
      if (button.dataset.stockRemove) { delete state.inventory[button.dataset.stockRemove]; saveInventory(); return; }
      if (button.dataset.targetRemove !== undefined) { state.additionalTargets.splice(Number(button.dataset.targetRemove),1); saveInventory(); return; }
      if (button.dataset.addMachine) {
        const id = button.dataset.addMachine, count = plan?.steps.find(step => step.recipeId === id)?.installedCount;
        setInstalledMachines(id, (count ?? 0) + 1); return;
      }
      if (button.dataset.defaultMachines) { setInstalledMachines(button.dataset.defaultMachines, undefined); return; }
      switch (button.id) {
        case "plannerEditLoopStock": setMode("factory"); tab("planner"); overlay.querySelector("#plannerBalanceSettings").open = true; overlay.querySelector("[data-loop-seed]")?.focus(); break;
        case "calculatorImportLegacy":
          if (legacyDraft?.state) {
            read();
            try { workspaceBackup = serializePlan(state, dataset()); }
            catch (failure) { migrationNotes = [`Previous draft was not loaded: ${failure.message} Fix the current draft so it can be backed up first.`]; render(); break; }
            try { localStorage.setItem(`gtnh_atlas_before_material_import_${datasetId}`, workspaceBackup); }
            catch { migrationNotes = ["Previous workspace retained for this tab only. Export a JSON backup before leaving."]; }
            state = structuredClone(legacyDraft.state); built = true; calculate(); sync(); save(); render();
          }
          break;
        case "calculatorRestoreDraft":
          if (workspaceBackup) { state = importPlan(workspaceBackup, dataset()); built = true; calculate(); sync(); save(); render(); }
          break;
        case "calculatorBackupLegacy": download("gtnh-atlas-legacy-calculator-backup.json", JSON.stringify({ dataset: dataset().id, originals: legacyDraft?.originals || {} }, null, 2), "application/json"); break;
        case "gtnhCalcClose": close(); break;
        case "calcBuild": build(); tab("tree"); break;
        case "plannerSupplies": supplies.open(); break;
        case "calcUseSearch": {
          const query = document.getElementById("search").value.trim(), good = catalog()?.resolve(query);
          const select = item => { state.target = item.id; state.unit = catalog().describe(item).unit; built = false; plan = null; error = ""; sync(); save(); render(); };
          if (good) select(good); else if (catalog()) openItemPicker(catalog(), select, { query });
          break;
        }
        case "plannerShowMore": displayNodeLimit += 250; render(); break;
        case "calcClear": state = { ...structuredClone(defaultPlannerState), uiMode: state.uiMode }; plan = null; built = false; error = ""; sync(); save(); render(); break;
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
        case "plannerAddTarget": {
          const good = catalog()?.resolve(overlay.querySelector("#plannerFactoryGood").value.trim());
          if (!good || catalog().describe(good).type === "ore") { error = "Select an exact item or fluid for the factory output."; render(); break; }
          if (state.additionalTargets.length >= 19) { error = "A factory supports up to 20 outputs."; render(); break; }
          state.additionalTargets.push({target:good.id,amount:1,unit:catalog().describe(good).unit,machineCount:1});
          saveInventory(); break;
        }
        case "calcCopyCode": try { await navigator.clipboard.writeText(code()); } catch { error = "Clipboard unavailable. Select and copy the export text."; render(); } break;
        case "calcDownloadJson": download("gtnh-atlas-plan.json", serializePlan(state,dataset()), "application/json"); break;
        case "plannerDownloadCsv": if (plan) download("gtnh-atlas-materials.csv",planCsv(plan),"text/csv"); break;
        case "plannerDownloadMachines": if (plan) download("gtnh-atlas-machines.csv",machinesCsv(plan),"text/csv"); break;
        case "plannerDownloadSvg": if (plan) download("gtnh-atlas-dependencies.svg",diagram(plan.nodes.length),"image/svg+xml"); break;
      }
    });
    overlay.addEventListener("input", event => {
      if (["calcTarget", "plannerStockGood", "plannerFactoryGood"].includes(event.target.id)) {
        const query = event.target.value.toLowerCase();
        const matches = catalog()?.goods.filter(good => (good.name || "").toLowerCase().includes(query) || good.id.toLowerCase().includes(query)).slice(0,25) || [];
        overlay.querySelector(event.target.id === "calcTarget" ? "#plannerGoods" : event.target.id === "plannerFactoryGood" ? "#plannerFactoryGoods" : "#plannerStockGoods").innerHTML = matches.map(good => `<option value="${esc(good.id)}">${esc(good.name)} · ${esc(good.mod)}</option>`).join("");
      }
      if (event.target.matches("[data-state],[data-setting]")) {
        read();
        if (event.target.id === "calcTarget") {
          const good = catalog()?.resolve(state.target);
          if (good && (catalog().describe(good).unit === "L" ? ["items", "stacks"].includes(state.unit) : ["L", "buckets"].includes(state.unit))) { state.unit = catalog().describe(good).unit; overlay.querySelector("#calcUnit").value = state.unit; save(); }
        }
        if (event.target.id === "calcBalanceMode" && state.balanceMode === "steady_state") { state.depth = "full"; overlay.querySelector("#calcDepth").value = "full"; save(); }
        built = false; plan = null; render();
      }
    });
    overlay.addEventListener("change", async event => {
      const input = event.target;
      if (input.dataset.loopSeed) {
        const quantity = Number(input.value);
        if (!input.checkValidity() || !Number.isFinite(quantity) || quantity < 0) { overlay.querySelector("#plannerStatus").textContent = "Circulating stock must be nonnegative; items require whole counts. Previous value retained."; input.value = state.loopSeeds[input.dataset.loopSeed] ?? ""; return; }
        if (quantity) state.loopSeeds[input.dataset.loopSeed] = quantity; else delete state.loopSeeds[input.dataset.loopSeed];
        save(); calculate(); render(); return;
      }
      if (input.dataset.installedMachines) {
        const id = input.dataset.installedMachines;
        if (!input.checkValidity()) {
          input.value = state.machineConfigs[id]?.installedMachines ?? "";
          overlay.querySelector("#plannerStatus").textContent = "Installed machines must be whole numbers from 0 to 1,000,000. Previous count retained.";
          return;
        }
        if (!setInstalledMachines(id, input.value === "" ? undefined : Number(input.value))) input.value = state.machineConfigs[id]?.installedMachines ?? "";
        return;
      }
      if (input.dataset.targetField) {
        const entry = state.additionalTargets[Number(input.dataset.targetIndex)], field = input.dataset.targetField;
        if (!entry) return;
        if (field !== "unit" && (!input.value || !input.checkValidity() || Number(input.value) <= 0)) {
          input.value = entry[field]; overlay.querySelector("#plannerStatus").textContent = "Factory quantities must be positive and machine counts must be whole numbers. Previous value retained."; return;
        }
        entry[field] = field === "unit" ? input.value : Number(input.value); saveInventory(); return;
      } else if (input.dataset.stockQuantity) {
        const amount = Number(input.value);
        if (!Number.isFinite(amount) || amount < 0) { error = "Stock quantity must be finite and non-negative."; render(); return; }
        if (amount) state.inventory[input.dataset.stockQuantity] = amount; else delete state.inventory[input.dataset.stockQuantity];
        saveInventory(); return;
      } else if (input.dataset.routeGood) {
        if (input.value) state.routeChoices[input.dataset.routeGood] = input.value; else delete state.routeChoices[input.dataset.routeGood];
      } else if (input.dataset.ore) state.oreChoices[input.dataset.ore] = input.value;
      else if (input.dataset.profileField) {
        const id = input.closest("[data-profile]").dataset.profile, field = input.dataset.profileField;
        const previous = state.machineConfigs[id] || {}, recipe = plan?.steps.find(step => step.recipeId === id)?.recipe;
        if (!recipe) return;
        try {
          if (!input.checkValidity() || input.type === "number" && !input.value) throw new Error("Enter a whole number within the field's limits.");
          const value = input.type === "checkbox" ? input.checked : input.tagName === "SELECT" && field !== "voltageTier" ? input.value : Number(input.value);
          const next = field === "model" ? initialMachineConfig(recipe, previous, value, dataset().id) : { ...previous, [field]: value };
          if (field === "coilLevel") {
            // Returning to measured heat keeps the currently calculated value.
            next.machineHeat = machinePerformance(recipe, previous).machineHeat;
            if (input.value === "") delete next.coilLevel; else next.coilLevel = Number(input.value);
          }
          machinePerformance(recipe, next);
          state.machineConfigs[id] = next;
        } catch (failure) {
          if (input.type === "checkbox") input.checked = !!previous[field];
          else input.value = previous[field] ?? ({parallels:1, model:"generic", coilLevel:"", overclockMode:"normal"}[field] ?? 0);
          overlay.querySelector("#plannerStatus").textContent = `${failure.message} Previous profile retained.`;
          return;
        }
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
    planTools = mountPlanTools(overlay, { dataset, snapshot: () => { read(); return state; }, apply: applySavedState, download });
    sync(); render();
  }
  function open(options = {}) { load(); if (["basic", "factory"].includes(options.mode)) state.uiMode = options.mode; ensure(); sync(); render(); planTools.refresh(); const overlay = document.getElementById("gtnhCalcOverlay"); if (!overlay.classList.contains("show")) previousFocus = document.activeElement; overlay.classList.add("show");
    // A text field summons the software keyboard before touch users can browse.
    const preferred = document.getElementById(matchMedia("(pointer: coarse)").matches ? "calculatorChooseGood" : "calcTarget");
    const focusTarget = preferred.getClientRects().length ? preferred : document.getElementById("gtnhCalcClose");
    focusTarget.focus({ preventScroll: true });
  }
  function close() { document.getElementById("gtnhCalcOverlay")?.classList.remove("show"); (previousFocus?.isConnected ? previousFocus : document.getElementById("toolCalc"))?.focus(); }
  function applySavedState(next) { load(); state = normalizePlannerState(next); built = true; calculate(); save(); open(); tab("tree"); const tree = document.getElementById("calcTree"); tree.tabIndex = -1; tree.focus({ preventScroll: true }); }
  installSharedPlanNotice({ dataset: () => catalog()?.dataset, apply: applySavedState, download });
  window.GTNH_CALC = { open, close, build, setMode,
    planItem(id) {
      load(); const good = catalog()?.resolve(id); if (!good) return false;
      state.target = id; state.unit = catalog().describe(good).unit; state.amount = 1; state.additionalTargets = [];
      built = true; calculate(); save(); open(); tab("tree");
      document.querySelector(".plannerNodes summary")?.focus(); return true;
    }, getState: () => { load(); return structuredClone(state); }, getPlan: () => plan,
    exportYaml: () => plan ? exportPlanYaml(plan) : "# Build a production plan first.\n",
    import: text => { load(); state = importPlan(text, dataset()); save(); if (document.getElementById("gtnhCalcOverlay")) { sync(); built=true; calculate(); render(); } return structuredClone(state); } };
  window.GTNH_CALC_YAML_EXPORT = { buildYaml: () => window.GTNH_CALC.exportYaml() };
}
