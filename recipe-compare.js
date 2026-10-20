// Compare base recipe content, not exporter hashes or localized good names.
// Unique topology matches may be called modified; ambiguous matches stay added/
// removed rather than guessing which alternative became which.
const sortedIo = (entries, quantities, shapeless) => entries.map(io=>[
  io.type,io.id,shapeless ? null : io.slot ?? null,...(quantities ? [io.amount,io.probability] : [])
]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
function signature(recipe, quantities) {
  return JSON.stringify([recipe.machine,!!recipe.shapeless,sortedIo(recipe.inputs,quantities,recipe.shapeless),sortedIo(recipe.outputs,quantities,recipe.shapeless),
    ...(quantities ? [recipe.durationTicks,recipe.voltage,recipe.amperage,
      recipe.metadata.map(entry=>[entry.key,entry.value]).sort((a,b)=>a[0].localeCompare(b[0]) || a[1]-b[1]),
      recipe.circuitConflicts ?? null,recipe.specialValue ?? null] : [])]);
}
const group = (entries, key) => {
  const result = new Map();
  for (const entry of entries) { const id = key(entry); if (!result.has(id)) result.set(id,[]); result.get(id).push(entry); }
  return result;
};
export function compareRecipes(before, after) {
  const oldExact=group(before,recipe=>signature(recipe,true)), newExact=group(after,recipe=>signature(recipe,true));
  const unchanged=[], modified=[], removed=[], added=[], pendingOld=[], pendingNew=[];
  for (const key of new Set([...oldExact.keys(),...newExact.keys()])) {
    const a=oldExact.get(key)||[], b=newExact.get(key)||[], common=Math.min(a.length,b.length);
    for (let i=0;i<common;i++) unchanged.push({before:a[i],after:b[i]});
    pendingOld.push(...a.slice(common));pendingNew.push(...b.slice(common));
  }
  const oldShape=group(pendingOld,recipe=>signature(recipe,false)), newShape=group(pendingNew,recipe=>signature(recipe,false));
  for (const key of new Set([...oldShape.keys(),...newShape.keys()])) {
    const a=oldShape.get(key)||[], b=newShape.get(key)||[];
    if (a.length===1 && b.length===1) modified.push({before:a[0],after:b[0]});
    else { removed.push(...a);added.push(...b); }
  }
  return {unchanged,modified,removed,added};
}
