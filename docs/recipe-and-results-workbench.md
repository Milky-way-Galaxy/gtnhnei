# Recipe and results workbench

## Find and plan a production route

On a recipe or usage page, open **Filter & sort recipes** to search machine,
ingredient or recipe IDs, set a maximum exported recipe voltage, hide chance
outputs, or sort base recipe batch time/power/energy. Unknown timing/power sorts
last; an explicit voltage ceiling excludes unknown power. Filters combine with
the existing machine tabs and reset when opening another item/view. Dataset
order and lazy card batching remain the default; normalized browsing indexes are
only prepared when filtering or sorting is requested.

Values describe the base recipe batch. Yield varies, so a low EU/batch entry is
not necessarily the cheapest per item or for the entire production chain. Recipe
conditions and actual machine availability still require review. Use the
planner's existing route comparison for net-output and complete-plan comparisons.

**Show usages / Show recipes** switches views without a double-tap gesture.
**Plan with this recipe** starts a one-native-unit primary target using that exact
recipe. Current rate mode, machine/supply preferences and inventory remain in
use; additional factory targets are cleared for the new single-product plan.
Before replacing an existing target, Atlas saves a versioned backup. The Settings
pane's **Restore previous draft** restores the previous factory configuration,
including its outputs, inventory and profiles. Storage failure leaves a backup
for the current tab and warns the user; an invalid current draft is not silently
overwritten. Named saved plans are untouched.

**Recipe permalink** includes dataset, exact good ID, view and exact recipe ID.
Opening it shows that recipe, with **Show all recipes** to return to the full
list. Missing/foreign IDs show a notice and the full item list. Item and recipe
links remove unrelated query parameters and shared-plan fragments.

## Explore results

The overview shows counts of material entries, selected recipes, unresolved
dependencies and startup entries. These are counts, not summed quantities.
Known energy and power retain their existing partial/unknown semantics.

Section navigation jumps inside the result scroll area. On phones, required
materials appear as cards with native quantities, units and supply/stock actions;
on desktop they remain a table. Icons use the active dataset's matching atlas.
Search materials by name/ID and filter item, fluid or OreDict entries. Search the
complete dependency list before applying its display limit, or show only route,
OreDict, cycle and budget decisions. Expand/collapse acts on shown nodes.
Diagnostic review clears a hiding tree filter and reveals nodes beyond the
initial display budget. The dependency diagram and downloaded exports remain
complete regardless of these display filters.

Filters and expansion controls never recalculate or modify the plan, inventory,
route choices, YAML or exported quantities. Old plan formats remain readable;
new presentation preferences are session-only. The legacy gtnh-flow integration
respects planner-owned navigation so Diagram remains the built-in dependency SVG.
