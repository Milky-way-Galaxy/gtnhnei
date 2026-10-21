export class SteadyStateError extends Error {
  constructor(message, loops = []) { super(message); this.name = "SteadyStateError"; this.loops = loops; }
}

// A unique rectangular system is allowed (e.g. a returned-cell balance adds a
// redundant conservation equation). No objective or route optimization is used.
export function solveUniqueBalance(coefficients, demand) {
  const rows = coefficients.length, columns = coefficients[0]?.length || 0;
  if (!columns || columns > 128 || rows > 256 || demand.length !== rows || coefficients.some(row => row.length !== columns || row.some(value => !Number.isFinite(value))) || demand.some(value => !Number.isFinite(value))) throw new SteadyStateError("Balance dimensions or numbers are unsupported. Split the factory into smaller plans (128 recipes / 256 internal goods).");
  const matrix = coefficients.map((row, index) => { const scale = Math.max(...row.map(Math.abs)) || 1; return [...row.map(value => value / scale), demand[index] / scale]; });
  const pivots = [];
  for (let column = 0; column < columns; column++) {
    const start = pivots.length;
    let pivot = start;
    for (let row = start; row < rows; row++) if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot]?.[column] || 0)) pivot = row;
    if (!matrix[pivot] || Math.abs(matrix[pivot][column]) < 1e-10) continue;
    [matrix[start], matrix[pivot]] = [matrix[pivot], matrix[start]];
    const divisor = matrix[start][column];
    for (let c = column; c <= columns; c++) matrix[start][c] /= divisor;
    for (let row = start + 1; row < rows; row++) {
      const factor = matrix[row][column];
      for (let c = column; c <= columns; c++) matrix[row][c] -= factor * matrix[start][c];
    }
    pivots.push(column);
  }
  if (pivots.length !== columns) throw new SteadyStateError("Selected routes do not define a unique balance. Choose additional boundaries/routes; no optimizer or free circulation rate was assumed.");
  const solution = Array(columns).fill(0);
  for (let row = pivots.length - 1; row >= 0; row--) {
    const column = pivots[row]; let value = matrix[row][columns];
    for (let c = column + 1; c < columns; c++) value -= matrix[row][c] * solution[c];
    solution[column] = value;
  }
  const tolerance = 64 * Number.EPSILON * Math.max(1, ...solution.map(Math.abs));
  if (solution.some(value => !Number.isFinite(value) || value < -tolerance || value > 1e15)) throw new SteadyStateError("Selected routes have no feasible nonnegative balance. Supply a boundary or choose another route; negative production was not accepted.");
  const rates = solution.map(value => Math.max(0, value));
  let residual = 0;
  for (let row = 0; row < rows; row++) {
    const terms = coefficients[row].map((value, column) => value * rates[column]);
    const scale = Math.abs(demand[row]) + terms.reduce((n, value) => n + Math.abs(value), 0);
    const error = Math.abs(terms.reduce((n, value) => n + value, 0) - demand[row]);
    residual = Math.max(residual, scale ? error / scale : error ? Infinity : 0);
  }
  if (residual > 1e-9) throw new SteadyStateError("Selected routes have inconsistent material balances. Excess/deficit cannot be resolved by this exact-balance mode.");
  return { rates, residual };
}

function stronglyConnected(records) {
  let next = 0;
  const index = new Map(), low = new Map(), stack = [], active = new Set(), loops = [];
  function visit(id) {
    index.set(id, next); low.set(id, next++); stack.push(id); active.add(id);
    const edges = records.get(id).balance.inputs.map(io => io.id).filter(key => records.get(key)?.recipe);
    for (const other of edges) {
      if (!index.has(other)) { visit(other); low.set(id, Math.min(low.get(id), low.get(other))); }
      else if (active.has(other)) low.set(id, Math.min(low.get(id), index.get(other)));
    }
    if (low.get(id) !== index.get(id)) return;
    const group = []; let other;
    do { other = stack.pop(); active.delete(other); group.push(other); } while (other !== id);
    if (group.length > 1 || edges.includes(id)) loops.push(group.sort().map(key => ({ ...records.get(key).good })));
  }
  for (const [id, record] of records) if (record.recipe && !index.has(id)) visit(id);
  return loops.sort((a, b) => a[0].id.localeCompare(b[0].id));
}

export function buildSteadyStateGraph(catalog, demands, options, { recipeBalance, selectRecipe, machinePerformance, add }) {
  if (options.inventory !== undefined && (!options.inventory || typeof options.inventory !== "object" || Array.isArray(options.inventory))) throw new Error("Inventory must map exact good IDs to quantities.");
  const inventoryEntries = Object.entries(options.inventory || {});
  if (inventoryEntries.length > 1000 || inventoryEntries.some(([id, quantity]) => !/^[if]:/.test(id) || catalog.resolve(id)?.id !== id || !Number.isFinite(Number(quantity)) || Number(quantity) < 0)) throw new Error("Inventory requires exact item/fluid IDs and finite nonnegative quantities.");
  const external = new Set(options.externalInputs || []), free = new Set(options.freeInputs || []);
  const maxDepth = options.depth === "full" ? 64 : Math.max(1, Math.min(64, Number(options.depth) || 1));
  const nodeLimit = Math.max(10, Math.min(20000, Number(options.nodeLimit) || 2500));
  const records = new Map(), selected = new Map(), nodes = [], unresolved = [], warnings = new Set();
  const register = (recipe, primary) => {
    if (selected.has(recipe.id)) return selected.get(recipe.id);
    if (selected.size >= 128) throw new SteadyStateError("Balance is limited to 128 selected recipes. Split this factory into smaller plans.");
    if ([...recipe.inputs, ...recipe.outputs].some(io => io.amount > 0 && io.probability !== 1)) throw new SteadyStateError("This balance mode requires guaranteed recipe inputs and outputs. Use recursive expected calculations for chance recipes.");
    const balance = recipeBalance(recipe);
    balance.inputs = balance.inputs.map(input => {
      if (input.type !== "ore") return input;
      const choice = catalog.resolve(options.oreChoices?.[input.id]);
      if (!choice || !input.alternatives?.some(value => value.id === choice.id)) throw new SteadyStateError(`Choose the exact OreDict ingredient for ${input.name} before balancing.`);
      return { ...input, ...catalog.describe(choice) };
    });
    const record = { recipe, primary, balance, performance: machinePerformance(recipe, options.machineConfigs?.[recipe.id]) };
    selected.set(recipe.id, record); return record;
  };
  // Register explicitly selected roots first so a guaranteed co-product can be
  // recognized as an existing producer without choosing a new recipe for it.
  for (const demand of [...demands].sort((a, b) => a.targetGood.id.localeCompare(b.targetGood.id))) if (demand.rootRecipe) register(demand.rootRecipe, demand.targetGood.id);
  function expand(good, depth, parent, path) {
    if (nodes.length >= nodeLimit) throw new SteadyStateError("Dependency node budget reached. Increase the budget or supply more boundaries before balancing.");
    const node = { key: nodes.length, id: good.id, name: good.name, type: good.type, unit: good.unit, parent, depth, amount: 0, children: [] }; nodes.push(node);
    if (path.has(good.id)) { node.status = "recycled"; return node; }
    const previous = records.get(good.id);
    if (previous) { Object.assign(node, { status: previous.recipe ? "shared" : previous.reason, recipeId: previous.recipe?.id, machine: previous.recipe?.machine }); return node; }
    let reason = free.has(good.id) ? "supplied-free" : external.has(good.id) ? "external" : depth >= maxDepth ? "depth-limit" : null;
    if (reason) { records.set(good.id, { good, reason }); node.status = reason; return node; }
    const object = catalog.resolve(good.id), recipes = object ? catalog.recipes(object) : [];
    const explicit = options.routeChoices?.[good.id] ?? options.routeChoices?.[good.name?.toLowerCase()];
    const existing = explicit === undefined ? [...selected.values()].filter(row => row.balance.outputs.some(io => io.id === good.id && io.amount > 0)) : [];
    const recipe = existing.length === 1 ? existing[0].recipe : selectRecipe(recipes, good, options);
    if (!recipe) {
      reason = !recipes.length ? "no-recipe" : explicit !== undefined ? "invalid-route" : "choose-route";
      if (reason !== "no-recipe") throw new SteadyStateError(`${good.name}: ${reason.replaceAll("-", " ")}. Select the missing route before balancing.`);
      records.set(good.id, { good, reason }); node.status = reason; return node;
    }
    const chosen = register(recipe, good.id);
    records.set(good.id, { good, ...chosen });
    Object.assign(node, { recipeId: recipe.id, machine: recipe.machine, status: "produced", performance: chosen.performance, routeCount: recipes.length });
    const nextPath = new Set(path).add(good.id);
    for (const input of [...chosen.balance.inputs].sort((a, b) => a.id.localeCompare(b.id))) node.children.push(expand(input, depth + 1, node.key, nextPath));
    return node;
  }
  const rootsById = new Map();
  for (const demand of [...demands].sort((a, b) => a.targetGood.id.localeCompare(b.targetGood.id))) rootsById.set(demand.targetGood.id, expand(demand.targetGood, 0, null, new Set()));
  const roots = demands.map(demand => rootsById.get(demand.targetGood.id));
  const loops = stronglyConnected(records), seeds = options.loopSeeds || {};
  if (typeof seeds !== "object" || Array.isArray(seeds) || Object.keys(seeds).length > 1000) throw new SteadyStateError("Invalid circulating stock map.", loops);
  for (const [id, amount] of Object.entries(seeds)) if (!/^[if]:/.test(id) || !catalog.resolve(id) || !Number.isFinite(amount) || amount < 0 || id.startsWith("i:") && !Number.isInteger(amount)) throw new SteadyStateError("Circulating stock requires exact IDs, nonnegative native quantities and whole item counts.", loops);
  if (loops.some(loop => !loop.some(good => seeds[good.id] > 0))) throw new SteadyStateError("Declare circulating startup stock for each loop before balancing. Enter actual available stock; an automatic startup sequence is not assumed.", loops);
  const internal = [...records.values()].filter(row => row.recipe).sort((a, b) => a.good.id.localeCompare(b.good.id));
  const columns = [...selected.values()].sort((a, b) => a.recipe.id.localeCompare(b.recipe.id));
  const demandById = new Map(demands.map(row => [row.targetGood.id, row.requested]));
  const coefficient = (row, id) => row.balance.outputs.filter(io => io.id === id).reduce((n, io) => n + io.amount, 0) - row.balance.inputs.filter(io => io.id === id).reduce((n, io) => n + io.amount, 0);
  let solved;
  try { solved = columns.length ? solveUniqueBalance(internal.map(row => columns.map(column => coefficient(column, row.good.id))), internal.map(row => demandById.get(row.good.id) || 0)) : { rates: [], residual: 0 }; }
  catch (error) { if (error instanceof SteadyStateError) error.loops = loops; throw error; }
  const rates = new Map(columns.map((row, i) => [row.recipe.id, solved.rates[i]]));
  const net = new Map(), absolute = new Map(), goodById = new Map(), outputs = new Map(), consumed = new Map();
  const accumulate = (good, value) => { goodById.set(good.id, good); net.set(good.id, (net.get(good.id) || 0) + value); absolute.set(good.id, (absolute.get(good.id) || 0) + Math.abs(value)); };
  for (const demand of demands) accumulate(demand.targetGood, demand.requested);
  const steps = new Map(), reusable = new Map();
  for (const row of columns) {
    const batches = rates.get(row.recipe.id); if (!batches) continue;
    steps.set(row.recipe.id, { recipeId: row.recipe.id, recipe: row.recipe, machine: row.recipe.machine, performance: row.performance, batches });
    for (const io of row.balance.inputs) { accumulate(io, io.amount * batches); consumed.set(io.id, (consumed.get(io.id) || 0) + io.amount * batches); }
    for (const io of row.balance.outputs) { accumulate(io, -io.amount * batches); if (io.id !== row.primary) outputs.set(io.id, (outputs.get(io.id) || 0) + io.amount * batches); }
    for (const io of row.balance.reusable) reusable.set(`${row.recipe.id}|${io.id}`, { ...io, recipeId: row.recipe.id });
    if (!row.performance) warnings.add(`${row.recipe.machine}: timing/power unknown; machine and power totals are partial.`);
    if (row.recipe.metadata?.length || row.recipe.specialValue || row.recipe.circuitConflicts) warnings.add("Recipe conditions and machine-specific modifiers still require verification; balancing does not validate them.");
  }
  const materials = new Map(), byproducts = new Map(), byproductsUsed = new Map();
  for (const [id, quantity] of net) {
    const good = goodById.get(id);
    if (records.get(id)?.recipe && Math.abs(quantity) <= 1e-9 * absolute.get(id)) continue;
    if (quantity > 0 && !free.has(id)) add(materials, good, quantity, { reason: records.get(id)?.reason || "external" });
    else if (quantity < 0) add(byproducts, good, -quantity);
  }
  for (const [id, quantity] of outputs) add(byproductsUsed, goodById.get(id), Math.min(quantity, (consumed.get(id) || 0) + (demandById.get(id) || 0)), { reason: "guaranteed co-product in steady-state balance" });
  for (const node of nodes) {
    const selectedRow = node.recipeId ? selected.get(node.recipeId) : null;
    node.batches = rates.get(node.recipeId) || 0;
    if (node.parent === null) node.amount = demandById.get(node.id);
    else {
      const parent = nodes[node.parent], row = selected.get(parent.recipeId);
      node.amount = (row?.balance.inputs.find(io => io.id === node.id)?.amount || 0) * (rates.get(parent.recipeId) || 0);
    }
    node.productionAmount = node.amount;
    if (selectedRow) { node.performance = selectedRow.performance; node.output = node.batches * (selectedRow.balance.outputs.find(io => io.id === node.id)?.amount || 0); if (!node.batches) node.status = "from-byproduct"; }
  }
  if (Object.keys(options.inventory || {}).length) warnings.add("Finite inventory is not deducted from continuous rates. Circulating startup stock is recorded separately.");
  warnings.add("Steady-state balances use guaranteed selected recipes and explicit supplied boundaries. Tree nodes can share recipe executions; machine rows count each recipe once.");
  if (loops.length) warnings.add("Circulating stock is user-declared additional startup stock. Its sufficiency, transport and startup sequence are not validated. Continuous recycling never creates this stock.");
  return { roots, nodes, materials, byproducts, reusable, steps, inventoryUsed: new Map(), byproductsUsed, inventory: new Map(), warnings, unresolved, visits: nodes.length, nodeLimit,
    seedRows: Object.entries(seeds).filter(([id, amount]) => amount > 0 && loops.some(loop => loop.some(good => good.id === id))).map(([id, amount]) => ({ ...catalog.describe(catalog.resolve(id)), amount })),
    balance: { mode: "steady_state", status: "balanced", loops, residual: solved.residual, startupValidated: false } };
}
