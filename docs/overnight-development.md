# Autonomous development report — 2026-10-19

Review PRs: https://github.com/Milky-way-Galaxy/gtnhnei/pull/4 and
https://github.com/Milky-way-Galaxy/gtnhnei/pull/5

Branches: `feat/production-planner-and-datasets` (#4) and `feat/planner-inventory`
(#5), stacked on the unchanged fixes in PR #3 (`fix/startup-and-search`,
`ae6c781`). Nothing is merged or deployed.

## Completed functionality

### Shared production and material calculations

The production planner now performs calculations rather than only previewing
routes. Both calculators use a tested shared engine reading structured binary
recipe records, with item/fluid/OreDict IDs retained throughout.

- Recursive dependencies with route choices at each good and explicit OreDict
  alternatives. All routes are exposed; the former 32-route scan/deduplication
  no longer drops valid recipes.
- Required material totals, byproducts/surplus and reusable startup stock.
  Consumed cells remain requirements; guaranteed returns and zero-amount tools
  are classified separately. Circuits are provisioned once per physical machine,
  not once per parallel lane.
- Total and per-second/minute/hour quantities, native item-stack and GT fluid L/bucket conversion,
  whole/fractional executions and expected chance yields. Whole jobs schedule
  complete processing waves over the configured machines/lanes.
- Base machine equivalents, installed machine counts, average/installed EU/t,
  known energy, root capacity and root processing time. Explicit normal/perfect
  overclock and parallel profiles are available with stated model limits.
- Identity-based cycle detection, depth/node budgets, retained boundary inputs,
  external/free resources, explicit unresolved routes and unknown timing/power.
- Dataset-bound JSON import/export, CSV material ledgers, standalone full-tree
  SVG exports and base-recipe gtnh-flow YAML. JSON restores legacy preferences
  and rejects incompatible dataset identities/checksums before replacing state.
- Finite consumable stock on hand for total jobs, spent once across dependency
  branches before expanding the remaining quantities. Used/unspent stock is
  visible, editable, saved per dataset and included in portable plans. Rates
  retain ongoing requirements; startup seeds/tools remain a separate ledger.
- Fixed-rate machines distinguish required counts from configured installed
  counts and use the latter for installed power/startup circuits. Tiny positive
  rates still require a machine; rounding corrects floating-point noise.

With 1000 L Epichlorohydrin already owned, the 2000 L job below needs only one
execution and 19,200 EU. Owning 1500 L Chlorine as well reduces the outstanding
Chlorine requirement to 500 L. Two native stacks of buckets mean 32 buckets,
while two stacks of GTNH Ender Pearls mean 128, as verified from the actual data.

Real-data anchor: route `r~7CR1mklsMhyejhfODug_QQ==` produces 1000 L
Epichlorohydrin in 640 ticks at 30 EU/t. The implemented calculations verify:

| Target | Executions | Machine equivalents / installed | Power or energy |
| --- | --- | --- | --- |
| 2000 L total | 2 | root processes for 64 s on one machine | 38,400 EU |
| 3000 L/min | 0.05/s | 1.6 / 2 | 48 average / 60 installed EU/t |

The actual Pyodide solver and Viz.js rendered both examples in a Chromium
390×844 touch-emulated browser. The rate diagram reports 50 L/s output and
1.6 machines; its power summary now correctly reports 48 EU/t.

### Version-aware data system

The existing binary and atlas **exactly match upstream GTNH 2.8.0-v5**, including
both Git blob IDs. The badge now identifies 2.8.0 precisely. The files are unchanged.

The manifest records release, format, source commit, file/decompressed checksums
and record counts. Startup verifies the decompressed hash and counts before
publishing the APIs. Dataset changes reload state and isolate plan, maker,
material and favorites storage. Exported plans identify the dataset/checksum.

2.8.4 is listed as unavailable: its official modpack release is verified, but a
matching compatible recipe export has not been verified. Authentic 2.7.4 and
2.9.0 upstream data use formats 3 and 7 respectively and are also disabled until
proper adapters are validated. No dataset is relabeled or substituted. See
[detailed provenance and extraction instructions](datasets.md).

### Search, mobile usability and performance

- Search filters for items/fluids, mod and production availability, plus name,
  mod and ID sorting. Exact item/fluid/OreDict IDs work in the search field.
- Dataset/ID-specific recipe and usage permalinks and a direct Plan this action.
- Roving keyboard grid focus, arrow navigation, Enter/U recipe/usage access,
  planner focus handling/Escape return and explicit input labels.
- Large tree pagination, lazy route controls, a bounded on-screen diagram and
  complete SVG export. Planner and material target suggestions show exact IDs.
- Visible recipe output probabilities; electrical badges show total EU/t and
  amperage/voltage separately.
- Cooperative repository/catalog indexing yields between chunks. Its complete
  ID offset/remap map matches the original parser, including recipe aliases.
- Structured metadata replaces DOM card generation and HTML/YAML quantity
  parsing. Exact-name lookup is indexed. No numerical speedup/memory benchmark
  is claimed; decompression and all assets remain static-host compatible.

### Browser flow solver repaired

A reproducible 45,251-byte source archive now packages 24 Python/config/license
files. Build checks validate it against tracked sources and hashes. Worker
initialization failures can retry, requests run serially with IDs, and stale
responses cannot replace the latest graph.

A real rate smoke test exposed a floating-point ceiling bug: 48.00000000000001
was displayed as 49 EU/t. The same issue could promote one machine to two for
peak power. A ULP-bounded correction fixes these ceilings while keeping genuine
fractional requirements rounded upward. Eight Python regression cases cover it.

### Calculator integration and initialization cleanup

The separate material calculator's explicit root route now takes precedence over
saved maker defaults. New maker/supplied-input choices and ignored materials use
exact IDs, including ID case. Legacy unique-name maker choices remain supported;
an ambiguous name needs an identifying recipe ID rather than guessing a variant.
Legacy ignored names migrate to all previously matching IDs, retaining coverage
while allowing variants to be unignored independently.

Navigation used to replace its own observed labels every 80 ms. That continually
rescheduled the maker decorator and could prevent its controls from appearing.
Navigation and maker badges now update only when their value changes; desktop
and touch tests verify that labels/material rows settle without idle DOM writes.
Rows carry explicit good IDs, so status badges cannot become part of a parsed name.

The ignore picker reads structured recipe inputs, outputs and returned stock;
obsolete YAML parsing/filtering/math helpers were removed. The legacy flow preview
also delegates to the structured exporter, preserves real subsecond timing and
explicit routes, and refuses unknown values. Failed material calculations clear
stale result objects, and blocked settings storage retains working session state.
Targeted unused-variable linting guards the maintained calculator/data modules.

## Bugs addressed

- Calculator shell never calculating materials or machines.
- Input losses from rendered-card/YAML scraping and positional output filtering.
- Changed-quantity cycles bypassing the old loop key.
- Global empty-cell ignoring understating actual consumption.
- Missing chance-yield and net-return handling.
- Route truncation and inappropriate name-based deduplication.
- Fractional total-job time that could be shorter than one real batch.
- Tiny requested quantities rounding to zero required crafts or disappearing.
- Unknown timing exported as invented executable durations/EU.
- Same-named distinct fluids merging in flow exports.
- Legacy nested settings, explicit false preferences and zero-amount drafts
  losing their choices during migration.
- Ordinary names such as `constructor` reaching inherited raw ID-map properties.
- Missing Python ZIP, permanently rejected initialization promises and concurrent
  worker requests sharing the wrong YAML.
- Flow power/machine-count ceiling errors caused by floating-point noise.
- Inventory being expanded as though the player owns no materials.
- Zero installed machines for tiny rates and fixed-machine power/stock mismatch.
- Manual route mode silently executing an unlocked sole recipe.
- Explicit material routes overridden by saved makers; cross-variant maker choices.
- Self-triggering navigation updates starving maker controls and badge text being
  read back as part of material identity.
- Legacy flow preview inventing unknown/subsecond durations from page text.
- Settings-storage errors preventing the material calculator from initializing.

## Verification

Final application results: **59 Node tests and 58 browser scenarios passed**.
The Node tests passed on both Node 24 and Node 22 (the CI runtime). The suite
includes the inherited startup/search/recipe regressions and new calculator,
version, import/export, filtering, navigation and accessibility scenarios.

| Check | Result |
| --- | --- |
| Node tests | 59 passed |
| Desktop and Pixel 7 touch-emulated browser tests | **58 passed** |
| ESLint | Passed |
| Static site/module validation | Passed |
| Packaged Python source/hash validation | 24 files passed |
| Structured recipe audit | All 190,080 recipes serialized without errors |
| Real Pyodide + Viz.js | Native and rate Epichlorohydrin cases rendered successfully |
| Full vendored pytest, `PYTHONHASHSEED=0` | 334 passed; 9 baseline failures unchanged |
| New Python rounding regressions | 8 passed (included above) |
| Diff whitespace check | Passed |

The nine Python failures are the same project fixtures documented in the PR #3
baseline: cbdline, hogline, diesel, the Syncthing text file, goldenapple, brick,
the diwater-loop PNG, crashes, and ucfe_chemplant. They were reproduced before the
vendor rounding change; no failures are hidden or converted into passes/skips.
The historical compiled Jest solver snapshots still lack their original fixtures.

## Review history

Implementation commits:

- `ae40cd1` — shared recursive planning, verified dataset identities and cooperative indexing.
- `5ad920a` — search filters, permalinks and scalable planner navigation.
- `bc8529b` — packaged browser solver, worker serialization and retry.
- `1f3481b` — calculation precision, state migration, accurate recipe information and flow power correction.
- `48a00f2` — finite inventory, native stacks, manual routes and configured machine power.
- `f331723` — exact-ID makers/ignored inputs, stable initialization, structured picker/legacy flow preview, storage recovery and stricter lint.

Follow-up documentation records final coverage and limitations. The first clean CI runner exposed a transitive graphviz dependency in the focused Python test; the CI follow-up installs the vendor's declared requirements rather than relying on packages already present locally. PR #4 is stacked
on #3; review/merge #3 first, then retarget #4 to main for its own review. GitHub
Actions passed for #4 (`897cdb1`) and the inventory milestone in #5 (`48a00f2`);
the PR checks track subsequent commits. Review #5 after #4; its target is #4's
feature branch. Recovery bundles/patches include both feature branches.

## Trying the delivered functionality

Serve the branch with `node tools/serve.js` and open
`http://127.0.0.1:4173/gtnhnei/`. In Planner, select
`f:gregtech:liquid_epichlorhydrin`, 2000 L, depth 1 and the first 30 EU/t,
32-second production route. Build the plan. Add 1000 L of the target and 1500 L
Chlorine under Stock on hand to reproduce the 19,200 EU / 500 L remaining example.
Change to 3000 L per minute to reproduce the verified throughput case; finite
stock stays separate from that continuous rate.

## Files changed

The [#4 files](https://github.com/Milky-way-Galaxy/gtnhnei/pull/4/files) and
[#5 files](https://github.com/Milky-way-Galaxy/gtnhnei/pull/5/files) contain the
complete diffs. Principal implementation groups:

| Area | Files |
| --- | --- |
| Calculators | `production-engine.js`, `planner-ui.js`, `planner-state.js`, `planner.css`, `calc.js`, `materialcalc.js`, `makerchoice.js`, `maker-state.js`, `recipe-export.js` |
| Data and versions | `recipe-data.js`, `repository-loader.js`, `data-loader.js`, `datasets.js`, `data/manifest.json` |
| Search/navigation | `app.js`, `search-controls.js`, `search-controls.css`, `navsplit.js`, `topstrip.js`, `style.css`, `index.html`, `loaderguard.js` |
| Flow | `flowcalc.js`, `flowfix.js`, `gtnhflow-pyodide.js`, `gtnhflow-pyodide-worker.js`, `tools/package-flow.py`, packaged Python source/manifests and rounding helpers/tests |
| Verification/docs | Node/browser regression suites, `tools/audit-data.js`, CI workflow, ESLint/package scripts, README and `docs/` |

## Remaining work and recommended next milestones

1. **Obtain a real 2.8.4 export.** Run the documented NESQL pipeline in an actual
   2.8.4 pack with recorded mods/configs and matched exporter/parser. Add paired
   data/atlas files and validate authentic recipes before enabling selection.
2. **Add version adapters** for authentic format-3 2.7.4 and format-7 2.9.0 data,
   each with source/schema tests and real recipe comparisons. Changing a header
   integer is not an adapter.
3. **Machine-specific profiles.** Validate heat/coils, voltage/amp limits,
   multiblock bonuses, special parallel rules, generators and subtick behavior.
   Current profiles deliberately use explicit generic assumptions and unknowns.
4. **Global production balancing.** The current recursive planner is conservative:
   cross-branch byproducts are not automatically credited, cycles stop at supplied
   inputs, and whole-batch rounding happens per branch. Closed recycling loops,
   multi-target planning and optimal stock allocation need a verified solver.
   Finite consumable inventory is implemented, but is allocated in dependency order.
5. **Coverage and devices.** Audit the reported NASA Workbench recipe gap against
   an actual GTNH version/item, repair the nine upstream fixture failures, and
   test Safari and physical phones. Chromium touch emulation is not device testing.
6. **Performance follow-up.** Measure low-end-device startup/heap/large-plan traces
   before selecting further memory changes or moving calculations to a worker.
