function multiply(value, factor) {
  const result = value * factor;
  if (!Number.isFinite(result) || result < 0) throw new Error("Supply projection exceeds the supported numeric range.");
  return result;
}
export function packingFor(amount, good) {
  if (good?.unit === "L" || good?.type === "fluid") return { buckets: amount / 1000 };
  if (!Number.isInteger(good?.stackSize) || good.stackSize < 1) return null;
  const stacks = Math.floor(amount / good.stackSize);
  return { stackSize: good.stackSize, stacks, remainder: Math.max(0, amount - stacks * good.stackSize) };
}
export function buildSupplyPlan(plan, { seconds = 3600, basis = "requested", checks = {} } = {}, catalog) {
  if (!plan?.materials || !plan.targets) throw new Error("Build a production plan first.");
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 31536000) throw new Error("Operating duration must be between one second and one year.");
  if (!["requested", "installed"].includes(basis)) throw new Error("Unknown operating supply basis.");
  const factor = plan.isRate && basis === "installed" ? plan.capacityAnalysis?.rateFactor : 1;
  if (!Number.isFinite(factor) || factor < 0) throw new Error("Installed capacity is unknown. Use the requested rate or resolve machine timing first.");
  const multiplier = plan.isRate ? multiply(seconds, factor) : 1;
  const rows = (entries, kind, scale) => entries.map(entry => {
    const amount = multiply(entry.amount, scale), object = catalog?.resolve(entry.id);
    const good = object ? catalog.describe(object) : entry;
    const key = `${kind}:${entry.id}`;
    return { ...entry, amount, key, packing: packingFor(amount, good), checked: Object.hasOwn(checks, key) && checks[key] === amount };
  });
  const consumption = rows(plan.materials, "input", multiplier), startup = rows(plan.reusable, "startup", 1);
  const notes = [];
  if (plan.isRate) notes.push("Continuous-rate estimate. Whole-batch startup rounding and machine warmup are not simulated.");
  if (plan.isRate && basis === "requested") notes.push("Uses the requested output mix. Under-capacity machine pools must be expanded to sustain it.");
  if (plan.isRate && basis === "installed") notes.push("Scales the whole output mix to the conditional known-stage capacity ceiling. Assumes supplied inputs, transport and remaining recipe conditions.");
  if (plan.unresolved?.length) notes.push("Unresolved dependencies remain boundary supplies. This is not a complete raw-resource bill.");
  if (plan.hasUnknownPower) notes.push("Energy covers known recipe power only.");
  const all = [...consumption, ...startup];
  return { dataset: plan.dataset, isRate: plan.isRate, seconds: plan.isRate ? seconds : null, basis, factor,
    consumption, startup, surplus: rows(plan.byproducts, "surplus", multiplier),
    outputs: plan.targets.map(target => ({ id: target.id, name: target.name, unit: target.unit, amount: multiply(target.requested, multiplier) })),
    knownEnergy: plan.isRate ? multiply(plan.knownAverageEut, multiplier * 20) : plan.knownEnergy,
    partial: !!plan.hasUnknownPower, capacityPartial: plan.isRate && basis === "installed" && !!plan.capacityAnalysis.partial,
    completed: all.filter(row => row.checked).length, total: all.length, notes };
}
export function supplyCsv(supply) {
  const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const header = ["Dataset", "Projection", "Duration (seconds)", "Rate scale", "Section", "ID", "Material", "Amount", "Unit", "Native stack size", "Full stacks", "Remaining items", "Buckets", "Prepared"];
  const rows = [header, ...["consumption", "startup", "surplus"].flatMap(kind => supply[kind].map(row =>
    [supply.dataset.id, supply.isRate ? supply.basis : "total craft", supply.seconds, supply.factor, kind, row.id, row.name, row.amount, row.unit, row.packing?.stackSize, row.packing?.stacks, row.packing?.remainder, row.packing?.buckets, row.checked]))];
  return rows.map(row => row.map(quote).join(",")).join("\r\n");
}
