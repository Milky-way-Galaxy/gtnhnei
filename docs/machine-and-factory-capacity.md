# GT5 machine accuracy and factory bottlenecks

This follow-up to [PR #10](https://github.com/Milky-way-Galaxy/gtnhnei/pull/10)
is implemented in [PR #11](https://github.com/Milky-way-Galaxy/gtnhnei/pull/11),
branch `feat/machine-capabilities`. The stack retains PR #3's startup/search
fixes and the subsequent calculators, versioned datasets, saved/shared plans and
flow fixes. No changes are merged or deployed by this work.

## Delivered functionality

**Machine accuracy:** Existing generic OC/parallel profiles retain their numeric
behavior. Opt-in GT5 reference profiles automatically choose OCs within supplied
voltage, amps and an explicit OC cap. They respect ULV tier handling, integer
power/tick rounding, optional amperage OCs and a one-tick floor. Requested lanes
must fit the available supply; unsupported/impossible configurations are rejected
without replacing the previous working UI profile.

**Electric Blast Furnace:** A recipe must identify the actual EBF crafter and
matching heat metadata before this model is offered. It checks required heat,
applies multiplicative discounts every 900 K of surplus, and converts available
OCs to heat-perfect OCs every 1800 K. The normal EBF is limited to one lane.
Players can enter measured machine heat or select one of 14 verified heating
coils, including automatic voltage heat bonuses. Coil names follow the selected
reference: “Electrum Flux” in 2.8.0 and “Fluxed Electrum” in the newer reference.

**Factory bottlenecks:** Rate plans report each recipe's required/installed
machines and utilization, identify limiting stages, and calculate the
steady-state ceiling for the whole output mix. Shared intermediate demand is
aggregated before sizing. Players can override any recipe pool, add one machine,
restore its default, or stop it with zero. Installed power and reusable startup
stock use actual installed pools. Zero remains a zero ceiling even when that
stage's timing is unknown. Unknown timing and unresolved routes explicitly mark
the analysis partial. Counts and profiles survive JSON, saved plans, share links
and page reloads.

**Interface and exports:** Mobile controls wrap and preserve focus, scroll and
expanded machine profiles after recalculation. Bottleneck cards identify the
products made, rather than exposing a hash as the main label. A machines CSV
exports exact dataset/recipe IDs, effective timing, lanes, power, required and
installed counts, utilization and limiting stages. CSV utilization is a fraction
(for example, `0.8` means 80%). Material CSV retains its previous format. YAML
explicitly preserves base recipes and excludes planner profiles/count overrides
so gtnh-flow does not apply bonuses twice.

**Compatibility and architecture:** Shared machine formulas now live in a small,
replaceable module; factory capacity analysis is independent of DOM rendering.
The old `machinePerformance` export remains available. Old drafts with unused
invalid generic profiles retain their routes/preferences and portable exports;
an invalid profile cannot affect a calculation because every used profile is
validated before execution. Checked profiles validate their new fields on import.
Plans using checked profiles or installed-pool overrides require format 3, with
an explicit calculation reference. Older clients reject them before calculating,
while existing format-1/2 plans retain support. This prevents a verified old-client
failure where a shared EBF profile was accepted but computed 1380 ticks instead
of 345 ticks because that client ignored the new model.
There are no new runtime packages, data files, framework or bundling requirement.

## Verified source and dataset scope

The original GT5 Java calculators are pinned to `5.09.51.470` (`000a4d9`, official
GTNH 2.8.0 manifest) and `5.09.54.205` (`a3e1e11`, official 2.9.0 RC-2 manifest).
The binary 2.9 recipe export does not record its exact GT5 build. The newer
calculation profile is explicitly labeled an RC-2 **reference**, not presented
as a verified exact match to that export. Each plan saves the reference it uses.

No recipe dataset has been relabeled, mixed or changed. Both existing 2.8.0 and
2.9.0 datasets/atlases retain their checksums. **2.8.4 remains unavailable** until
a matching authentic recipe export can be verified. See
[machine reference details](machine-models.md) and [data provenance](datasets.md).

Two real-data examples:

- GTNH 2.8.0 hot Oriharukon route `r~--l7UvQdPwieyDfV6NjffQ==` has 1380 ticks,
  7680 EU/t and a 5400 K requirement. A Naquadah coil (7201 K) with LuV supply
  (+400 K) gives 7601 K, two heat discounts and one heat-perfect OC: **345 ticks,
  27,725 EU/t, 9,565,125 EU**. Item/fluid demand and base-recipe YAML stay intact.
- Epichlorohydrin at 3000 L/min plus 6000 L/min of its earlier Hydrogen co-product
  needs 1.6 base reactor equivalents with ordered co-product reuse. One installed
  reactor limits the mix to **62.5%**, or **31.25 L/s Epichlorohydrin and 62.5 L/s
  Hydrogen**. Installed power is 30 EU/t; requested demand still represents 48
  average EU/t. The original 2.8.0 route is `r~7CR1mklsMhyejhfODug_QQ==`.

## Commits

| Commit | Result |
| --- | --- |
| [`9d03f12`](https://github.com/Milky-way-Galaxy/gtnhnei/commit/9d03f12) | Supply-checked GT5/EBF profiles and independent pinned Java verification |
| [`406ddad`](https://github.com/Milky-way-Galaxy/gtnhnei/commit/406ddad) | Factory capacity, per-recipe installed pools, machine exports and regression tests |
| [`229e86c`](https://github.com/Milky-way-Galaxy/gtnhnei/commit/229e86c) | Verified version-specific coils, voltage heat bonuses and clearer mobile cards |
| [`596a823`](https://github.com/Milky-way-Galaxy/gtnhnei/commit/596a823) | Legacy draft/profile compatibility and portable-export regression coverage |
| [`f798c9e`](https://github.com/Milky-way-Galaxy/gtnhnei/commit/f798c9e) | Real EBF calculations in both datasets, physical heat reference and retained CI screenshots |
| [`6043eb4`](https://github.com/Milky-way-Galaxy/gtnhnei/commit/6043eb4) | Format-3 safety for checked profiles/pools and explicit shared calculation references |

See [all PR commits](https://github.com/Milky-way-Galaxy/gtnhnei/pull/11/commits),
including the final documentation handoff.

## Validation

| Check | Result |
| --- | --- |
| ESLint and static build | Passed; 33 local assets, 38 JS modules/scripts, 24 packaged Python files |
| Full Node suite | **108 passed**, including calculations, plan-format migration, shared links and both real recipe datasets |
| Full desktop/touch Chromium suite | **102 passed**; the 46 affected calculator/save/import cases were repeated after the format-3 change and all passed |
| Original pinned Java reference | **640 vectors**: 638 matching numerical results, plus two intentionally rejected over-supply results from the older calculator |
| Original heating coils | All **14 ratings and names at each pin** verified; original enum compiled, translation names checked |
| Data audit | **411,840 recipes** checked: 190,080 in 2.8.0 and 221,760 in 2.9.0; original data/atlas hashes retained |
| Real external Pyodide and Viz.js | Passed for **both datasets**, including two-output rates, actual SVG rendering and flow/JSON switching |
| Focused vendor Python rounding tests | **8 passed** |
| Full vendor Python suite | **334 passed, 9 pre-existing fixture failures**; failed-case list exactly matches the earlier baseline |

The complete CI workflow repeats the pinned Java checks, focused Python tests,
`npm run verify` and both-dataset audit for the PR head. Check
[PR #11 checks](https://github.com/Milky-way-Galaxy/gtnhnei/pull/11/checks) for its
latest result. The `browser-test-results` CI artifact now retains the new
desktop/mobile screenshots on successful runs as well as failure traces.

The full vendor failures are `cbdline`, `hogline`, `diesel`, the Syncthing text
file, `goldenapple`, `brick`, `diwater_loop.png`, `crashes`, and `ucfe_chemplant`.
They cover existing incomplete/non-YAML fixtures, a Graphviz label and solver
edge cases, and are not reported as passing. No vendor source changed here.

An intermediate local browser invocation collided with another run's artifact
directory and failed during trace teardown. It was discarded and rerun in
isolation; the passing results above are from the clean runs. Actual Python/Viz
integration is separate from the deterministic browser tests' worker/Viz mocks.
Machine numerical references use original Java classes; in-game execution,
physical mobile devices and Safari were not verified.

## Remaining limits and next milestones

The numerical harness runs original Java calculator/coil classes with minimal
dependency stubs, not Minecraft or complete in-game machines. Parallel/perfect-OC
support outside the standard EBF, maintenance, hatch aggregation, item/fluid
transport, recipe gating, laser OCs, subtick parallel scaling and other multiblock
bonuses are not inferred. Players supply the power available at the machine;
cable losses and unsupported hardware configurations need in-game verification.

The factory ceiling assumes supplied boundary inputs and unchanged selected
routes. It is not a startup schedule, completion-time prediction, stochastic
guarantee, automatic route optimizer or closed-loop recycling solver. Total jobs
retain their previous root-processing model; rate-pool overrides do not invent
an upstream total-job schedule. Mobile tests emulate touch Chromium; physical
phones and Safari are unverified.

Next useful milestones are source-verified models for additional multiblocks and
subtick behavior, global route/co-product optimization with explicit seed stock,
and factory scheduling. A verified 2.8.4 extraction and version-keyed offline
dataset/index caching remain independent priorities. Review the existing PR
stack in order before considering any approved merge or deployment.

## Files changed from PR #10

These 28 files changed from PR #10:

```text
.github/workflows/checks.yml
README.md
docs/calculations.md
docs/machine-and-factory-capacity.md
docs/machine-models.md
eslint.config.js
factory-capacity-ui.js
factory-capacity.js
licenses/GPL-3.0.txt
licenses/GT5-Unofficial-LGPL-3.0.txt
machine-model.js
machine-profile-ui.js
package.json
planner-state.js
planner-ui.js
planner.css
production-engine.js
recipe-export.js
tests/browser/factory-capacity.spec.js
tests/browser/machine-profiles.spec.js
tests/datasets.test.js
tests/factory-capacity.test.js
tests/fixtures/gt5-machine-reference.json
tests/machine-model.test.js
tests/plan-share.test.js
tests/production-engine.test.js
tests/repository-versions.test.js
tools/machine-reference.py
```
