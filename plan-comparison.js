export function compareProductionPlans(before, after) {
  if (before.dataset.id !== after.dataset.id || before.dataset.sha256 !== after.dataset.sha256 || before.isRate !== after.isRate) throw new Error("Compare plans from the same recipe dataset and quantity mode.");
  const left = new Map(before.materials.map(row => [row.id, row])), right = new Map(after.materials.map(row => [row.id, row]));
  const materials = [...new Set([...left.keys(), ...right.keys()])].map(id => {
    const old = left.get(id), next = right.get(id);
    return { ...(next || old), before: old?.amount || 0, after: next?.amount || 0, delta: (next?.amount || 0) - (old?.amount || 0) };
  }).filter(row => Math.abs(row.delta) > 1e-10 * Math.max(1, Math.abs(row.before), Math.abs(row.after))).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const powerKey = before.isRate ? "knownAverageEut" : "knownEnergy";
  return { isRate: before.isRate, materials,
    knownPower: { before: before[powerKey], after: after[powerKey], delta: after[powerKey] - before[powerKey] },
    requiredMachines: { before: before.steps.reduce((n, step) => n + (step.count || 0), 0), after: after.steps.reduce((n, step) => n + (step.count || 0), 0) },
    partial: before.hasUnknownPower || after.hasUnknownPower || !!before.unresolved.length || !!after.unresolved.length || before.truncated || after.truncated,
    unresolvedBefore: before.unresolved.length, unresolvedAfter: after.unresolved.length,
    warnings: after.warnings };
}
