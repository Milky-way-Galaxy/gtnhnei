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
additional outputs. Single-output exports remain schema 1. Plans containing checked
machine models or installed-pool overrides use schema 3 so old clients reject
unsupported calculations instead of silently ignoring the new settings. All formats preserve
the dataset checksum, route choices, profiles, finite inventory and co-product
setting. Import accepts existing single-output plans and legacy drafts.

## Machines and power

Known base GT recipe power is voltage × amperage, and duration is read in ticks.
Rate machine equivalents = executions/s × effective duration ticks / (20 ×
parallel lanes). Installed count rounds up; average and installed EU/t are shown
separately. Total-craft energy = executions × effective ticks × per-lane EU/t.
Fixed machine mode retains the required count and uses the configured root count
for installed power and startup stock; insufficient capacity is warned explicitly.
Each rate-plan recipe can override its own installed machine pool (including
zero). This takes precedence over automatic sizing and fixed root counts. Clear
the override to restore that recipe's default. Pools are keyed by recipe ID;
separate recipes using the same machine type do not silently share a pool.
Startup stock and installed power use the actual installed counts. Total jobs
retain their existing configured-root timing; these rate-only overrides do not
invent an upstream job schedule.
Ceilings correct floating-point noise near integers and keep at least one machine
for any positive required rate, however small.
Whole-batch root time schedules complete waves across the requested machines/parallel lanes; fractional totals use continuous estimates. Root time excludes upstream staging and logistics. Startup stock provisions the configured root count/full parallel capacity, with non-consumed circuits counted once per physical machine.

Profiles explicitly select parallel lanes and overclocks. Normal overclocks
multiply per-lane EU/t by 4 and divide time by 2; perfect OCs divide time by 4.
Duration truncates to whole ticks, with a one-tick floor. No subtick behavior or
machine-specific bonuses are assumed by the generic profile. Opt-in named GT5
profiles check configured power, voltage and EBF heat, using release-pinned
numerical references. See [machine models](machine-models.md) for verified source
versions, independent Java verification and limits. Check parallel
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

## Factory bottlenecks

Continuous plans include a **known-stage capacity ceiling** for the entire output
mix. For every known recipe, capacity factor = installed machines / required
machine equivalents. The lowest factor limits all outputs together, including
shared intermediate demand. Multiple limiting recipes are shown when tied.
Per-stage utilization = demanded equivalents / installed machines; a zero count
stops the stage and gives a zero factory ceiling, without dividing by zero.

For example, 3000 L/min Epichlorohydrin plus 6000 L/min of its earlier hydrogen
co-product needs the same 1.6 reactor equivalents with co-product reuse. One
installed base reactor limits this mix to 62.5%: 31.25 L/s Epichlorohydrin and
62.5 L/s Hydrogen. It draws 30 installed EU/t; the **requested** mix still requires
48 average EU/t. Material and average-power ledgers retain requested demand so
an insufficient factory cannot appear to satisfy the target by shrinking it.

This steady-state ceiling assumes all boundary inputs, transport, other recipe
conditions and startup requirements can be supplied. Unknown timing or unresolved
routes explicitly mark the analysis partial; no known executable stage produces
an unknown ceiling, not unlimited capacity. It is not an actual completion-time,
stochastic guarantee, machine-sharing scheduler or power-network simulation.

The Tree view allows per-recipe counts, Add one machine and Use default count,
and preserves focus/scroll while updating the analysis. Counts persist in saved
and shared plans. **Download machines CSV** includes exact recipe/dataset IDs,
profile references, timing, lane count, per-machine power, required/installed
counts, utilization and limiting stages. Material CSV retains its prior format.
YAML retains base recipes and explicitly excludes planner installed overrides
and machine profiles; gtnh-flow performs its own sizing.

## Named saved plans and shared links

**Saved plans and sharing** keeps up to 100 named plans per dataset/export on the
current browser. Save current as new preserves other named plans; Replace selected
updates only the selected named plan. Load selected replaces the active draft.
Deleting has an undo action for the current page session. Each selected plan can
be downloaded as the existing portable JSON format and imported through Code /
Export. Library keys include the full dataset ID and checksum, so different
versions or changed exports cannot share recipe choices accidentally.

Storage mutations re-read current data, validate existing records and write once.
Malformed libraries are retained, and storage/quota failures display an error
rather than discarding old entries. Library storage has a 3 MB serialized-text
limit; browser storage quotas may be lower. Existing draft/settings keys remain
unchanged. Saved plans are local browser data, not account/cloud synchronization.

**Create shareable link** gzip-compresses a versioned plan into the URL fragment.
The URL retains the GitHub Pages subpath and selects the exact dataset. No plan
hosting service is required, and fragments are not sent in HTTP requests. Links
include outputs, routes, machine profiles, inventory and supplied-input settings.
A recipient sees a preview and must choose Load shared plan before their draft
is replaced; they can also download its JSON. Missing/mismatched checksums,
unsupported codecs and invalid payloads fail visibly. Link data is limited to
24,000 characters and decompressed data to 2 MB; larger plans should use JSON.

## Route efficiency and exported recipe details

Route suggestions show expected net target yield per batch and base EU per native
item or fluid L. Guaranteed target returns are subtracted from gross output, so
seeded recipes are compared by actual net production. Only uncertainty in the
selected target's IO marks its yield as expected. Zero-net-output routes are
unavailable as production choices.

**Lowest base energy per output** compares ticks × EU/t / expected net output.
This differs from Lowest EU/t, which compares machine power alone. Automatic
policies evaluate individual base recipes; upstream energy, initial inventory,
whole-job rounding and machine-specific bonuses are not globally optimized.
Known timing/power ranks before unknown estimates; explicit route IDs and legacy
numeric route choices retain precedence. Locked routes balance only the selected
recipe; automatic scoring uses one pass instead of sorting repeated balances.

Each recipe card and embedded card exposes its exact recipe ID, known base
energy per batch, and exported metadata/special values/circuit-conflict fields.
The planner repeats these metadata fields beside the machine profile. Generic
OC/parallel profiles do not evaluate them. For example, actual 2.8.0 recipe
`r~--l7UvQdPwieyDfV6NjffQ==` makes one Hot Oriharukon Ingot with `coil_heat = 5400`,
1380 ticks at 7680 EU/t, totaling 10,598,400 EU. These are dataset values, not a
claim that a particular player-built furnace can run it.

Rate results show capacity from the **installed recipe machine pool**, rather
than the default one-machine count used for configured-root estimates. A 50 L/s
Epichlorohydrin target installs two base machines with 62.5 L/s recipe capacity;
the Hydrogen target supplied by that route is labeled From co-products. Each
machine step shows its own average/installed EU/t or total job energy. In the JS
result API, the existing `capacity` field keeps its configured-root meaning;
`targets[].installedCount` and `installedCapacity` expose the installed pool.

## Flow-view recovery

The in-browser solver renders the current computed plan; edited/unbuilt drafts
cannot silently fall back to an arbitrary one-machine recipe. Plans with no
executable timed machine steps get an explanation instead of fabricated values.
Changing calculations discards the displayed old flow, and request IDs invalidate
results from earlier runs, including runs superseded by an invalid draft.

Flow placement and visibility use explicit output containers. Reopening a graph
or switching between YAML, JSON and flow cannot hide the calculator workspace.
Failed Viz module/instance initialization can retry with a fresh module URL.
Blocked clipboard access keeps the graph usable and points to downloads; DOT
source now has its own download alongside YAML and SVG.
