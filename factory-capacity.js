// A fixed-recipe, steady-state capacity bound, not a logistics/startup schedule.
// Rates and earlier-co-product credits scale linearly while installed pools stay
// fixed. Shared recipe demand has already been aggregated by calculateFactory.
export function analyzeFactoryCapacity(plan) {
  if (!plan.isRate) return null;
  const rows = plan.steps.map(step => {
    const known = step.performance?.batchesPerSecond > 0 && Number.isFinite(step.equivalents) && step.equivalents > 0 && Number.isFinite(step.installedCount);
    const factor = known ? step.installedCount / step.equivalents : null;
    return { recipeId: step.recipeId, machine: step.machine, required: step.count, installed: step.installedCount,
      equivalents: step.equivalents, countSource: step.installedSource,
      utilization: known && step.installedCount > 0 ? step.equivalents / step.installedCount : null,
      capacityFactor: Number.isFinite(factor) ? factor : null,
      batchesPerSecond: known ? step.performance.batchesPerSecond * step.installedCount : null };
  });
  const known = rows.filter(row => row.capacityFactor !== null);
  const rateFactor = known.length ? Math.min(...known.map(row => row.capacityFactor)) : null;
  const limitingRecipeIds = known.filter(row => Math.abs(row.capacityFactor - rateFactor) <= 8 * Number.EPSILON * Math.max(1, rateFactor)).map(row => row.recipeId);
  return { rateFactor, rows, limitingRecipeIds, unknownStages: rows.length - known.length,
    hasUnresolvedRoutes: plan.unresolved.length > 0 || plan.truncated,
    targets: plan.targets.map(target => ({ id: target.id, name: target.name, unit: target.unit, requested: target.requested,
      capacity: rateFactor === null || !Number.isFinite(target.requested * rateFactor) ? null : target.requested * rateFactor })) };
}
