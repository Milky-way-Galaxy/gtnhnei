# Production calculations

The planner and material calculator share `production-engine.js` and
`RecipeCatalog` from `recipe-data.js`. Neither reads quantities from HTML or
parses YAML to recover recipe data. Each good, route, plan and result has a
stable ID and dataset identity. OreDict alternatives remain unresolved until
chosen explicitly; exact duplicate names require an ID for calculations.

## Quantity model

Inputs/outputs are summed by ID. Expected quantities use amount × probability.
Returns of the same good are subtracted only from that good, rather than dropping
all inputs that follow a target/byproduct in rendered text. Guaranteed returned
goods and zero-amount tools/circuits appear as startup stock. Consumed empty cells
remain required. Autocatalytic recipes use net output while retaining seed stock.

Total crafts round each dependency branch up to whole recipe executions by
default, showing surplus. Fractional totals can be selected. Rates always use
fractional executions and normalize to seconds. In GT fluid notation, 1 bucket
is 1000 L (1000 Minecraft mB). Item counts and fluid quantities cannot be mixed.
Chance outputs are expected yields; there is no guaranteed stochastic minimum.

Depth limits, supplied inputs, missing recipes and unresolved choices enter the
material ledger. Cycles are detected by good ID along the dependency path, even
when quantities change. The node budget retains quantities at its boundary.
Byproducts are reported but are not automatically credited across separate
recipe branches. This is conservative expansion, not a global recycling/LP solver.

## Machines and power

Known base GT recipe power is voltage × amperage, and duration is read in ticks.
Rate machine equivalents = executions/s × effective duration ticks / (20 ×
parallel lanes). Installed count rounds up; average and installed EU/t are shown
separately. Total-craft energy = executions × effective ticks × per-lane EU/t.
Root processing time excludes upstream staging and logistics.

Profiles explicitly select parallel lanes and overclocks. Normal overclocks
multiply per-lane EU/t by 4 and divide time by 2; perfect OCs divide time by 4.
Duration truncates to whole ticks, with a one-tick floor. No subtick behavior or
machine-specific bonuses are assumed. Check heat, voltage, amperage, parallel
limits, coils, machine modifiers and multiblock behavior in-game. Recipes with
missing timing/power report unknown values instead of invented machine counts.

JSON exports preserve settings and stable recipe/ingredient choices against the
exact dataset checksum. Mismatched datasets are rejected before replacing active
settings. Legacy settings-only JSON imports are supported and need route review.
CSV is a material ledger; SVG is a dependency diagram. gtnh-flow YAML uses base
recipe values, expected yields and base machine equivalents; custom planner
profiles are not silently translated into specialized gtnh-flow machine options.

Verified real example: GTNH 2.8.0 route `r~7CR1mklsMhyejhfODug_QQ==`
produces 1000 L Epichlorohydrin in 640 ticks at 30 EU/t. 2000 L requires
2 executions and 38,400 EU. A 3000 L/min target requires 1.6 base machines,
2 installed machines, 48 average EU/t and 60 installed EU/t.
