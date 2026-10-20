const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const numberFormat = new Intl.NumberFormat("en", {maximumSignificantDigits: 7});
const fmt = value => value === null ? "unknown" : numberFormat.format(value);
export function factoryCapacityHtml(plan, configs) {
  const analysis = plan.capacityAnalysis;
  if (!analysis) return "";
  const rate = analysis.rateFactor;
  return `<section class="plannerCapacity" aria-label="Factory capacity analysis"><h4>Factory bottlenecks</h4>
    <p class="plannerCapacityHeadline">Known-stage capacity ceiling: <strong>${rate === null ? "unknown" : fmt(rate * 100) + "% of requested output"}</strong>.</p>
    <details><summary>Capacity assumptions</summary><p>All outputs scale together with the same recipes and installed machines. Input supply, transport, other recipe conditions and startup are assumed. Power and material totals above describe requested demand.</p></details>
    ${analysis.unknownStages || analysis.hasUnresolvedRoutes ? '<p class="plannerCapacityWarning">Partial analysis: unknown timing or unresolved routes can lower this ceiling further.</p>' : ""}
    ${rate === null ? "" : `<ul class="plannerCapacityOutputs">${analysis.targets.map(target => `<li>${esc(target.name)}: <b>${fmt(target.capacity)} ${esc(target.unit)}/s</b> at the ceiling (requested ${fmt(target.requested)} ${esc(target.unit)}/s)</li>`).join("")}</ul>`}
    <div class="plannerCapacityList">${[...analysis.rows].sort((a,b) => (a.capacityFactor ?? Infinity) - (b.capacityFactor ?? Infinity)).map(row => {
      const limiting = analysis.limitingRecipeIds.includes(row.recipeId), stopped = row.installed === 0;
      const status = stopped ? "Stopped" : row.capacityFactor === null ? "Timing unknown" : row.capacityFactor < 1 - 1e-10 ? "Over capacity" : limiting ? "Limiting stage" : "Spare capacity";
      const override = configs[row.recipeId]?.installedMachines;
      return `<article class="plannerCapacityStage" data-capacity-recipe="${esc(row.recipeId)}" data-limiting="${limiting}">
        <b title="${esc(row.recipeId)}">${esc(row.machine)} · ${status}</b><small>Makes: ${esc(row.outputs.slice(0,3).join(", "))}${row.outputs.length > 3 ? ` and ${row.outputs.length - 3} more` : ""}</small>
        <p>Required: ${fmt(row.required)} machines (${fmt(row.equivalents)} equivalent) · Utilization at requested rate: ${stopped ? "stopped" : row.utilization === null ? "unknown" : fmt(row.utilization * 100) + "%"}</p>
        <div class="plannerCapacityControls"><label>Installed machines<input type="number" min="0" max="1000000" step="1" data-installed-machines="${esc(row.recipeId)}" value="${override ?? ""}" placeholder="Default: ${row.installed ?? "unknown"}" aria-label="Installed machines: ${esc(row.machine)} (${esc(row.recipeId)})"></label>
        <button type="button" data-add-machine="${esc(row.recipeId)}">Add one machine</button>${override === undefined ? "" : `<button type="button" data-default-machines="${esc(row.recipeId)}">Use default count</button>`}</div>
        <small>${row.countSource === "recipe" ? `Recipe override: ${fmt(row.installed)} installed.` : row.countSource === "root" ? `Fixed root pool: ${fmt(row.installed)} installed.` : `Automatic: ${fmt(row.installed)} installed.`} Leave blank for the default. Zero stops this stage. Counts apply to this recipe's shared pool, not every recipe using the same machine type.</small>
      </article>`;
    }).join("") || '<p>No executable machine stages to analyze.</p>'}</div></section>`;
}
