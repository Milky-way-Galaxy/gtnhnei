const attentionStatuses = new Set(["choose-route", "invalid-route", "ore-choice", "cycle", "node-limit"]);
function matches(row, query) {
  const text = [row.name, row.id, row.status, row.machine, row.reason].filter(Boolean).join(" ").toLowerCase();
  return String(query).trim().toLowerCase().split(/\s+/).every(word => text.includes(word));
}
export function filterPlanMaterials(rows, { query = "", type = "all" } = {}) {
  return rows.filter(row => (type === "all" || row.type === type) && matches(row, query))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }) || a.id.localeCompare(b.id));
}
export function filterPlanNodes(nodes, { query = "", attentionOnly = false } = {}) {
  // Filtering is presentation-only. Keep original preorder and parent keys.
  return nodes.filter(node => (!attentionOnly || attentionStatuses.has(node.status)) && matches(node, query));
}
