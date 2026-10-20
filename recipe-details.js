export function recipeMetadataRows(record) {
  const rows = (record?.metadata || []).map(entry => ({ key: entry.key, value: entry.value }));
  if (record?.specialValue) rows.push({ key: "GT special value", value: record.specialValue });
  if (record?.circuitConflicts) rows.push({ key: "Circuit conflicts", value: record.circuitConflicts });
  return rows;
}
export function appendRecipeDetails(card, recipe) {
  const gt = recipe.gtRecipe, rows = recipeMetadataRows(gt);
  const details = document.createElement("details"); details.className = "recipeDetails";
  const summary = document.createElement("summary"); summary.textContent = `Recipe details${rows.length ? ` · ${rows.length} metadata fields` : ""}`; details.appendChild(summary);
  const id = document.createElement("p"); id.textContent = `Recipe ID: ${recipe.id}`; details.appendChild(id);
  const energy = document.createElement("p");
  energy.textContent = `Base energy per batch: ${gt?.durationTicks > 0 && gt.voltage >= 0 && gt.amperage > 0 ? (gt.durationTicks * gt.voltage * gt.amperage).toLocaleString("en") + " EU" : "unknown"}`;
  details.appendChild(energy);
  if (rows.length) {
    const list = document.createElement("dl");
    for (const row of rows) {
      const key = document.createElement("dt"), value = document.createElement("dd");
      key.textContent = row.key; value.textContent = String(row.value); list.append(key, value);
    }
    details.appendChild(list);
    const note = document.createElement("p"); note.textContent = "Exported metadata. Review machine-specific conditions when choosing a production route."; details.appendChild(note);
  }
  card.dataset.recipeId = recipe.id; card.appendChild(details);
}
