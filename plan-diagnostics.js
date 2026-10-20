const messages = {
  "choose-route": "Choose a production route", "invalid-route": "Saved route is unavailable or has no positive net yield",
  "ore-choice": "Choose the actual ingredient", "cycle": "Circular dependency needs an explicit supply or a supported balance",
  "node-limit": "Dependency budget reached; remaining demand is retained", "depth-limit": "Supplied at the selected depth boundary",
  "no-recipe": "No production entry in this dataset; supply externally",
};
export function planDiagnostics(plan) {
  const nodes = new Map(plan.nodes.map(node => [node.key, node])), issues = new Map(), cycles = new Map();
  for (const node of plan.nodes) {
    if (messages[node.status]) {
      const key = `${node.id}|${node.status}`;
      if (!issues.has(key)) issues.set(key, { id: node.id, name: node.name, nodeKey: node.key, reason: node.status, message: messages[node.status], occurrences: 0 });
      issues.get(key).occurrences++;
    }
    if (node.status !== "cycle") continue;
    const path = [node], visited = new Set([node.key]);
    let ancestor = nodes.get(node.parent);
    while (ancestor && !visited.has(ancestor.key)) {
      path.push(ancestor); visited.add(ancestor.key);
      if (ancestor.id === node.id) break;
      ancestor = nodes.get(ancestor.parent);
    }
    path.reverse();
    const recipeIds = path.filter(entry => entry.recipeId).map(entry => entry.recipeId);
    const key = [...new Set(recipeIds)].sort().join("|");
    if (!cycles.has(key)) cycles.set(key, { nodeKey: node.key, goods: path.map(entry => ({ id: entry.id, name: entry.name })), recipeIds });
  }
  const all = [...issues.values()];
  return { attention: all.filter(row => !["no-recipe", "depth-limit"].includes(row.reason)),
    supplies: all.filter(row => ["no-recipe", "depth-limit"].includes(row.reason)), cycles: [...cycles.values()],
    unknownMachines: plan.steps.filter(step => !step.performance).map(step => ({ recipeId: step.recipeId, machine: step.machine })),
    conditionalRecipes: plan.steps.filter(step => step.recipe.specialValue || step.recipe.circuitConflicts || step.recipe.metadata?.some(entry => entry.key !== "recycle")).map(step => ({ recipeId: step.recipeId, machine: step.machine })) };
}
