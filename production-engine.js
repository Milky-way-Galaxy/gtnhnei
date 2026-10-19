const EPS = 1e-10;
// Arithmetic such as (0.1 + 0.2) / 0.3 can land just above an integer.
// Correct a few floating-point ULPs, without dropping small positive demands.
export function ceilPositive(value) {
  const nearest = Math.round(value);
  const tolerance = 2 * Number.EPSILON * Math.max(1, Math.abs(value));
  return Math.max(1, Math.ceil(nearest > 0 && Math.abs(value - nearest) <= tolerance ? nearest : value));
}
const add = (map, good, amount, extra = {}) => {
  if (!(amount > 0)) return;
  const previous = map.get(good.id);
  if (previous) previous.amount += amount;
  else map.set(good.id, { id: good.id, name: good.name, type: good.type, unit: good.unit, amount, ...extra });
};
export function recipeBalance(recipe) {
  const inputs = new Map(), outputs = new Map(), reusable = new Map();
  for (const io of recipe.inputs) {
    if (io.amount === 0) add(reusable, io, 1, { reason: "non-consumed tool/circuit" });
    else add(inputs, io, io.amount * io.probability);
  }
  for (const io of recipe.outputs) add(outputs, io, io.amount * io.probability);
  for (const [id, input] of inputs) {
    // Only guaranteed returns qualify as reusable stock. Chance returns are
    // accounted for as expected net consumption, with a stochastic warning.
    const returned = recipe.outputs.filter(io => io.id === id && io.probability === 1).reduce((n, io) => n + io.amount, 0);
    if (returned) add(reusable, input, Math.min(input.amount, returned), { reason: "returned by the recipe" });
  }
  const netInputs = new Map(), netOutputs = new Map();
  for (const [id, input] of inputs) add(netInputs, input, input.amount - (outputs.get(id)?.amount || 0));
  for (const [id, output] of outputs) add(netOutputs, output, output.amount - (inputs.get(id)?.amount || 0));
  return { inputs: [...netInputs.values()], outputs: [...netOutputs.values()], reusable: [...reusable.values()] };
}

export function machinePerformance(recipe, config = {}) {
  if (!(recipe.durationTicks > 0) || recipe.eut === null) return null;
  const parallels = Number(config.parallels ?? 1), overclocks = Number(config.overclocks ?? 0);
  if (!Number.isInteger(parallels) || parallels < 1 || parallels > 4096 || !Number.isInteger(overclocks) || overclocks < 0 || overclocks > 10) {
    throw new Error("Parallel lanes must be 1–4096 and overclocks 0–10.");
  }
  if (config.overclockMode && !["normal", "perfect"].includes(config.overclockMode)) throw new Error("Unknown overclock model.");
  const durationTicks = Math.max(1, Math.floor(recipe.durationTicks / (config.overclockMode === "perfect" ? 4 : 2) ** overclocks));
  const laneEut = recipe.eut * 4 ** overclocks;
  return { durationTicks, parallels, laneEut, eut: laneEut * parallels, batchesPerSecond: 20 * parallels / durationTicks };
}

export function selectRecipe(recipes, good, options = {}) {
  const viable = recipes.filter(recipe => recipeBalance(recipe).outputs.some(io => io.id === good.id && io.amount > EPS));
  const chosen = options.routeChoices?.[good.id] ?? options.routeChoices?.[good.name?.toLowerCase()];
  if (chosen !== undefined) {
    const selected = typeof chosen === "number" ? recipes[chosen] : recipes.find(recipe => recipe.id === chosen);
    return selected && viable.includes(selected) ? selected : null;
  }
  if (options.routeMode === "manual") return null;
  if (viable.length === 1) return viable[0];
  if (["ask", "manual"].includes(options.routeMode || "ask")) return null;
  const score = recipe => {
    const yieldAmount = recipeBalance(recipe).outputs.find(io => io.id === good.id).amount;
    switch (options.routeMode) {
      case "fastest": return recipe.durationTicks === null ? Infinity : recipe.durationTicks / yieldAmount;
      case "lowest_eut": return recipe.eut ?? Infinity;
      case "fewest_inputs": return recipeBalance(recipe).inputs.length;
      default: return recipe.voltage ?? Infinity;
    }
  };
  return viable.slice().sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id))[0] || null;
}

export function calculateProduction(catalog, options) {
  const amount = Number(options.amount ?? 1);
  if (!(amount > 0) || !Number.isFinite(amount)) throw new Error("Enter a finite amount greater than zero.");
  const fixedMachines = Number(options.machineCount ?? 1);
  if (!Number.isInteger(fixedMachines) || fixedMachines < 1 || fixedMachines > 1000000) throw new Error("Root machine count must be an integer from 1 to 1,000,000.");
  const target = catalog.resolve(options.target);
  if (!target) {
    const matches = catalog.matches?.(options.target) || [];
    throw new Error(matches.length > 1 ? "Several goods have this name. Select an exact item/fluid ID from the suggestions." : "Target not found. Select an exact name or item/fluid ID.");
  }
  const targetGood = catalog.describe(target);
  const rateMode = options.rateMode || "total";
  if (!["total", "per_second", "per_minute", "per_hour"].includes(rateMode)) throw new Error("Unknown quantity time unit.");
  const isRate = rateMode !== "total";
  const seconds = { total: 1, per_second: 1, per_minute: 60, per_hour: 3600 }[rateMode];
  let requested = amount / seconds;
  const unit = options.unit || targetGood.unit;
  if (!["items", "L", "buckets", "batches", "stacks"].includes(unit)) throw new Error("Unknown quantity unit.");
  if (unit === "stacks") {
    if (targetGood.type !== "item" || !Number.isInteger(target.stackSize) || target.stackSize <= 0) throw new Error("Stacks require an item with a known native stack size in this dataset.");
    requested *= target.stackSize;
  } else if (unit === "buckets") {
    if (targetGood.type !== "fluid") throw new Error("Buckets can only be used for fluids.");
    requested *= 1000;
  } else if (unit === "L" && targetGood.type !== "fluid") throw new Error("L can only be used for fluids.");
  else if (unit === "items" && targetGood.type === "fluid") throw new Error("Use L or buckets for fluid quantities.");
  const rootRecipes = catalog.recipes(target);
  const rootRecipe = selectRecipe(rootRecipes, targetGood, options);
  if (unit === "batches") {
    if (!rootRecipe) throw new Error("Select a production route before specifying batches.");
    requested *= recipeBalance(rootRecipe).outputs.find(io => io.id === targetGood.id).amount;
  }
  if (!(requested > 0) || !Number.isFinite(requested)) throw new Error("Quantity exceeds the safe calculation range after unit conversion.");
  const maxDepth = options.depth === "full" ? 64 : Math.max(1, Math.min(64, Number(options.depth) || 1));
  const nodeLimit = Math.max(10, Math.min(20000, Number(options.nodeLimit) || 2500));
  const materials = new Map(), byproducts = new Map(), reusable = new Map(), steps = new Map(), inventoryUsed = new Map();
  const warnings = new Set(), unresolved = [], nodes = [];
  const inventory = new Map();
  if (options.inventory !== undefined && (!options.inventory || typeof options.inventory !== "object" || Array.isArray(options.inventory))) throw new Error("Inventory must map exact good IDs to quantities.");
  const stockEntries = Object.entries(options.inventory || {});
  if (stockEntries.length > 1000) throw new Error("Inventory is limited to 1,000 goods per plan.");
  for (const [id, value] of stockEntries) {
    const quantity = Number(value), object = catalog.resolve(id);
    if (!object || object.id !== id || catalog.describe(object).type === "ore") throw new Error(`Inventory requires an exact item/fluid ID in this dataset: ${id}`);
    if (!Number.isFinite(quantity) || quantity < 0) throw new Error(`Invalid inventory quantity for ${id}. Use a finite non-negative quantity in native items or L.`);
    if (quantity) inventory.set(id, { ...catalog.describe(object), amount: quantity });
  }
  if (inventory.size) warnings.add(isRate ? "Finite inventory is not deducted from continuous rates. Switch to a total job to use stock on hand." : "Inventory is allocated once in dependency order to total-job demand. Startup tools/returned stock remain listed separately; byproducts are not recycled into this inventory.");
  const external = new Set(options.externalInputs || []), free = new Set(options.freeInputs || []);
  const machineConfigs = options.machineConfigs || {};
  let visits = 0;
  const leaf = (good, quantity, reason, node) => {
    node.status = reason;
    if (reason !== "supplied-free") add(materials, good, quantity, { reason });
    if (["cycle", "node-limit", "choose-route", "invalid-route", "ore-choice"].includes(reason)) {
      unresolved.push({ id: good.id, name: good.name, reason });
      warnings.add(`${good.name}: ${reason.replaceAll("-", " ")}. Treat this quantity as supplied input until resolved.`);
    }
    return node;
  };
  function expand(good, quantity, depth, path, parent = null) {
    // Stop before allocating any more nodes at the budget boundary. All remaining
    // input quantities still enter the materials ledger; none are discarded.
    const node = { key: nodes.length, id: good.id, name: good.name, type: good.type, unit: good.unit, amount: quantity, parent, depth, children: [] };
    if (!isRate && !free.has(good.id)) {
      const stock = inventory.get(good.id);
      const used = Math.min(quantity, stock?.amount || 0);
      if (used > 0) {
        stock.amount = Math.max(0, stock.amount - used);
        node.inventoryUsed = used;
        add(inventoryUsed, good, used, { reason: "from inventory" });
        const remaining = quantity - used;
        quantity = remaining <= 2 * Number.EPSILON * quantity ? 0 : remaining;
      }
    }
    node.productionAmount = quantity;
    if (++visits > nodeLimit) {
      if (quantity === 0) { node.status = "from-inventory"; return node; }
      return leaf(good, quantity, "node-limit", node);
    }
    nodes.push(node);
    if (quantity === 0) { node.status = "from-inventory"; return node; }
    if (free.has(good.id)) return leaf(good, quantity, "supplied-free", node);
    if (external.has(good.id)) return leaf(good, quantity, "external", node);
    if (path.has(good.id)) return leaf(good, quantity, "cycle", node);
    if (depth >= maxDepth) return leaf(good, quantity, "depth-limit", node);
    const object = catalog.resolve(good.id);
    if (good.type === "ore") return leaf(good, quantity, "ore-choice", node);
    const recipes = object ? catalog.recipes(object) : [];
    if (!recipes.length) return leaf(good, quantity, "no-recipe", node);
    const recipe = selectRecipe(recipes, good, options);
    if (!recipe) return leaf(good, quantity, options.routeChoices?.[good.id] !== undefined ? "invalid-route" : "choose-route", node);
    const balance = recipeBalance(recipe);
    const yieldAmount = balance.outputs.find(io => io.id === good.id)?.amount;
    if (!(yieldAmount > EPS)) return leaf(good, quantity, "invalid-route", node);
    const batches = isRate || options.rounding === "fractional" ? quantity / yieldAmount : ceilPositive(quantity / yieldAmount);
    if (!Number.isFinite(batches) || batches > 1e15) throw new Error("Quantity exceeds the safe calculation range; reduce the target or break up this chain.");
    node.recipeId = recipe.id;
    node.machine = recipe.machine;
    node.batches = batches;
    node.output = batches * yieldAmount;
    node.status = "produced";
    node.performance = machinePerformance(recipe, machineConfigs[recipe.id]);
    node.routeCount = recipes.length;
    if (recipe.outputs.some(io => io.probability < 1)) warnings.add("Chance outputs use expected yields, not guaranteed amounts. Actual batches can vary.");
    if (!node.performance) warnings.add(`${recipe.machine}: timing/power is not available in this dataset; machine count and energy are unknown.`);
    if (machineConfigs[recipe.id]?.overclocks || (machineConfigs[recipe.id]?.parallels || 1) > 1) warnings.add("Custom machine profiles use the selected generic OC/parallel model. Verify machine-specific limits, amperage, heat and voltage before building.");
    const previous = steps.get(recipe.id);
    if (previous) previous.batches += batches;
    else steps.set(recipe.id, { recipeId: recipe.id, machine: recipe.machine, recipe, batches, performance: node.performance });
    for (const io of balance.outputs) add(byproducts, io, io.id === good.id ? Math.max(0, io.amount * batches - quantity) : io.amount * batches);
    for (const io of balance.reusable) {
      const key = `${recipe.id}|${io.id}`;
      if (!reusable.has(key)) reusable.set(key, { ...io, recipeId: recipe.id });
    }
    const nextPath = new Set(path).add(good.id);
    for (let input of balance.inputs) {
      if (input.type === "ore" && options.oreChoices?.[input.id]) {
        const choice = catalog.resolve(options.oreChoices[input.id]);
        if (choice && input.alternatives?.some(value => value.id === choice.id)) input = { ...input, ...catalog.describe(choice) };
      }
      node.children.push(expand(input, input.amount * batches, depth + 1, nextPath, node.key));
    }
    return node;
  }
  const root = expand(targetGood, requested, 0, new Set());
  const machineRows = [...steps.values()].map(step => {
    const p = step.performance;
    const equivalents = isRate && p ? step.batches / p.batchesPerSecond : null;
    const count = equivalents === null ? null : ceilPositive(equivalents);
    const installedCount = count === null ? null : options.machineMode === "fixed" && step.recipeId === root.recipeId ? fixedMachines : count;
    return { ...step, equivalents, count, installedCount, averageEut: equivalents === null ? null : equivalents * p.eut,
      installedEut: installedCount === null ? null : installedCount * p.eut,
      energy: p ? step.batches * p.durationTicks * p.laneEut : null };
  });
  const reusableTotals = new Map();
  for (const entry of reusable.values()) {
    const step = machineRows.find(step => step.recipeId === entry.recipeId);
    add(reusableTotals, entry, entry.amount * (entry.recipeId === root.recipeId && (!isRate || options.machineMode === "fixed") ? fixedMachines : Math.max(1, step?.count || 1)) * (entry.reason === "non-consumed tool/circuit" ? 1 : step?.performance?.parallels || 1));
  }
  const total = key => machineRows.reduce((sum, step) => sum + (step[key] || 0), 0);
  const rootPerformance = root.performance;
  const rootYield = rootRecipe ? recipeBalance(rootRecipe).outputs.find(io => io.id === targetGood.id)?.amount : null;
  const capacity = rootPerformance && rootYield ? rootPerformance.batchesPerSecond * rootYield * fixedMachines : null;
  if (isRate && options.machineMode === "fixed" && capacity !== null && requested > capacity + EPS) warnings.add(`Requested output exceeds the ${fixedMachines} root machine(s) capacity of ${capacity.toPrecision(6)} ${targetGood.unit}/s.`);
  if (byproducts.size) warnings.add("Byproducts/surplus are listed separately. Cross-recipe recycling is not automatically credited.");
  if (reusableTotals.size) warnings.add("Reusable quantities provision startup stock for the configured root machine count and full parallel capacity, not recurring consumption.");
  return { schemaVersion: 1, dataset: catalog.dataset, target: targetGood, requested, isRate, rateMode,
    root, nodes, materials: [...materials.values()], byproducts: [...byproducts.values()], reusable: [...reusableTotals.values()],
    inventoryUsed: [...inventoryUsed.values()], inventoryRemaining: [...inventory.values()].filter(row => row.amount > 0),
    steps: machineRows, warnings: [...warnings], unresolved, truncated: visits > nodeLimit,
    knownEnergy: isRate ? null : total("energy"), knownAverageEut: isRate ? total("averageEut") : null,
    knownInstalledEut: isRate ? total("installedEut") : null,
    hasUnknownPower: machineRows.some(step => !step.performance), capacity,
    rootTimeSeconds: !isRate && root.status === "from-inventory" ? 0 : !isRate && rootPerformance ? (options.rounding === "fractional" ? root.batches / (rootPerformance.parallels * fixedMachines) : ceilPositive(root.batches / (rootPerformance.parallels * fixedMachines))) * rootPerformance.durationTicks / 20 : null };
}
