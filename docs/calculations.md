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
Stack quantities use the target item's stack size from the active recipe data,
including unstackable tools and modded limits; no fixed 64-item assumption is made.
Chance outputs are expected yields; there is no guaranteed stochastic minimum.

Depth limits, supplied inputs, missing recipes and unresolved choices enter the
material ledger. Cycles are detected by good ID along the dependency path, even
when quantities change. The node budget retains quantities at its boundary.
Byproducts are reported separately by default. Optional co-product reuse credits
only outputs from previously expanded recipes, once, against later branches or
factory targets. Outputs enter the pool after their inputs have been expanded,
so a future output cannot erase a cycle's required seed. Result tables distinguish
reused quantities from unspent surplus. This ordered model can reduce duplicate
production, but is not a global recycling/LP solver; target and dependency order
can affect its result. Chance co-products retain the expected-yield warning.

For total jobs, stock on hand is allocated by exact item/fluid ID in dependency
order. Each unit can be spent only once across the whole tree. Partial stock
reduces the quantity expanded into a production route, including whole-batch
rounding of the remainder. The result lists used and unspent stock. Inventory
is saved with the dataset-bound plan; rebuilding previews the same job and does
not permanently consume the saved stock. Quantities use items or native fluid L,
not buckets. Finite stock is not deducted from continuous input rates. Freely
supplied inputs do not spend stock. Reusable tools/returned seed stock remain a
separate startup requirement, rather than silently spending the same inventory
on both consumption and startup. Byproducts do not replenish this ledger.

## Factory plans

A factory accepts up to 20 outputs, using the same total-job or continuous-rate
mode. Item/fluid units are converted before duplicate output IDs are combined,
so requesting the same output twice does not round each root separately. All
roots share the inventory, material, co-product and recipe-step ledgers. Recipe
machine equivalents are added across branches before installed counts round up.
Dependency branches still round individual executions in whole-job mode; enable
co-product reuse to use their earlier surplus where available.

The planner shows per-output root processing time or configured root capacity.
It does not invent an overall factory completion time from concurrent chains.
Fixed counts for distinct roots using the same recipe are separate configured
machine pools and are summed; repeated identical output IDs must use the same
configured count. Continuous combined demand is checked against installed
capacity. The diagram renders a forest with an independent root for each output.

Factory JSON uses plan schema 2, preventing older clients from silently dropping
additional outputs. Single-output exports remain schema 1. Both formats preserve
the dataset checksum, route choices, profiles, finite inventory and co-product
setting. Import accepts existing single-output plans and legacy drafts.

## Machines and power

Known base GT recipe power is voltage × amperage, and duration is read in ticks.
Rate machine equivalents = executions/s × effective duration ticks / (20 ×
parallel lanes). Installed count rounds up; average and installed EU/t are shown
separately. Total-craft energy = executions × effective ticks × per-lane EU/t.
Fixed machine mode retains the required count and uses the configured root count
for installed power and startup stock; insufficient capacity is warned explicitly.
Ceilings correct floating-point noise near integers and keep at least one machine
for any positive required rate, however small.
Whole-batch root time schedules complete waves across the requested machines/parallel lanes; fractional totals use continuous estimates. Root time excludes upstream staging and logistics. Startup stock provisions the configured root count/full parallel capacity, with non-consumed circuits counted once per physical machine.

Profiles explicitly select parallel lanes and overclocks. Normal overclocks
multiply per-lane EU/t by 4 and divide time by 2; perfect OCs divide time by 4.
Duration truncates to whole ticks, with a one-tick floor. No subtick behavior or
machine-specific bonuses are assumed. Check heat, voltage, amperage, parallel
limits, coils, machine modifiers and multiblock behavior in-game. Recipes with
missing timing/power report unknown values instead of invented machine counts.

JSON exports preserve settings and stable recipe/ingredient choices against the
exact dataset checksum. Mismatched datasets are rejected before replacing active
settings. Legacy settings-only JSON imports are supported and need route review.
New maker/supplied-input choices and ignored materials use exact IDs. Legacy
unique-name makers remain valid; duplicate names require an identifying recipe
ID. Material-calculator root route controls override maker defaults. The ignore
picker reads the structured catalog, and legacy name-based ignores migrate to all
previously matching IDs so their coverage is retained without joining variants.
CSV is a material ledger; SVG is a dependency diagram. gtnh-flow YAML uses base
recipe values, expected yields and base machine equivalents; custom planner
profiles are not silently translated into specialized gtnh-flow machine options.

Verified real example: GTNH 2.8.0 route `r~7CR1mklsMhyejhfODug_QQ==`
produces 1000 L Epichlorohydrin in 640 ticks at 30 EU/t. 2000 L requires
2 executions and 38,400 EU. A 3000 L/min target requires 1.6 base machines,
2 installed machines, 48 average EU/t and 60 installed EU/t.
