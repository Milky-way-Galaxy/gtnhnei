# Machine calculation references

The default **Generic · manual overclocks** profile preserves previous plans:
explicit lanes, 4× EU/t per OC, 2× or 4× speed, whole ticks, one-tick minimum.
It does not assert that a particular machine can support those settings.

Two opt-in profiles add automatic, supply-constrained overclocks:

- **GT5 · voltage and power checked** uses the configured voltage tier, amps,
  parallel lanes, normal/perfect ratio, optional amperage OCs and OC limit.
- **Electric Blast Furnace · heat and power checked** additionally requires the
  Electric Blast Furnace crafter ID `i:gregtech:gt.blockmachines:1000` and matching
  `coil_heat`/special-value data. It uses one lane and derives perfect OCs from
  surplus heat. It cannot be applied to a recipe just because its name or special
  value resembles a heat requirement. Other blast furnace variants need their
  own verified models.

Selecting a checked model starts at the lowest tier covering the base lane power.
The initial EBF heat equals the recipe requirement, yielding no assumed discount.
These are editable planning assumptions, not detected hardware. Enter available
power **at the machine**, and the EBF heat shown on its info screen (including the
machine's voltage heat bonus). Cable/transformer losses are not subtracted again.
Alternatively select one of the 14 verified heating coils. The EBF computes
effective heat as base coil heat + `100 × (voltage tier − 2)`, and updates it
when voltage changes. The displayed field becomes read-only until measured heat
is selected again; returning to measured mode keeps the current computed value.
Coil names and ratings are verified from `HeatingCoilLevel.java` and the English
language file at both pins. No unimplemented ULV coil is offered.
The newer reference's “Fluxed Electrum” label is kept separate from 2.8.0's
“Electrum Flux”; their verified coil level and heat rating are unchanged.

## Pinned sources and version scope

| Reference | GT5 commit | Verified pack association |
| --- | --- | --- |
| `gt5-5.09.51.470` | [`000a4d9`](https://github.com/GTNewHorizons/GT5-Unofficial/tree/000a4d9b24d77f40a79da7a105bb79ac7efca817) | GTNH 2.8.0 release manifest |
| `gt5-5.09.54.205` | [`a3e1e11`](https://github.com/GTNewHorizons/GT5-Unofficial/tree/a3e1e11241a814c9fa0dd0973d5699548428f689) | GTNH 2.9.0 RC-2 manifest |

Manifest provenance: DreamAssemblerXXL commit
[`79f4f62`](https://github.com/GTNewHorizons/DreamAssemblerXXL/tree/79f4f6251ca06c31108de67258aff60e120f1886/releases/manifests),
`2.8.0.json` and `2.9.0-RC-2.json`, `github_mods.GT5-Unofficial.version`.
The 2.9 recipe export does not identify its exact GT5 build. The RC-2 model is
therefore explicitly labeled a **calculation reference**, not claimed to be the
export's exact implementation. The reference can be selected independently in
each recipe profile and is preserved in JSON, saved plans and share links.
Recipe datasets and IDs remain unchanged.

At each pin, the numerical implementation is `gregtech/api/util/OverclockCalculator.java`;
the EBF heat checks are in
`gregtech/common/tileentities/machines/multi/MTEElectricBlastFurnace.java`, and
input-power/tier-skip validation is in `gregtech/api/util/ParallelHelper.java`.

## Implemented rules and deliberate limits

Surplus EBF heat gives a multiplicative `0.95^floor(surplus / 900)` power
discount. Each 1800 K surplus converts one available normal OC into a heat-perfect
OC (4× power and 4× speed). Heat does not create extra OCs beyond the available
voltage/power budget. Consumption rounds up **after** discounts and OCs; duration
truncates and stops at one tick. The integer tier calculation treats ULV as LV.

The references differ in power-tier rounding: the 2.8 calculator truncates base
power to integer EU/t when choosing OCs; RC-2 compares rounded hundredths. A
discounted 34 EU/t recipe at 128 V illustrates a real boundary: the older source
chooses an OC consuming 130 EU/t, while RC-2 retains 33 EU/t without that OC.
Atlas refuses a final consumption above the configured supply even if the older
reference calculator returns it. Lowering the OC cap recovers a valid profile.

Requested lanes must fit the per-lane discounted input-power check, and the base
recipe cannot exceed the default one-tier voltage-skip allowance. Atlas reports
an error rather than silently reducing lanes. Amperage OCs require explicit
opt-in. Parallel/perfect-OC support still depends on the actual machine; the GT5
reference profile does not identify every possible crafter's capabilities.

These profiles do not model maintenance losses, machine structure/recipe gating,
pollution, laser OCs, subtick parallel scaling, batch mode, item buses, hatch
aggregation rules, or arbitrary multiblock bonuses. At the one-tick floor the
planner warns that further OCs do not increase modeled production. Metadata and
other unmet conditions remain visible. YAML intentionally retains **base recipe
values**, rather than applying these profiles a second time in gtnh-flow.

## Independent verification

`npm test` compares against committed results from the **original Java classes**:
320 input cases for each of the two reference pins, including upstream unit-test
examples, heat boundaries, low/MAX-voltage recipes, power/amp/parallel combinations,
tick truncation and explicit OC limits. It tests the conservative over-budget
rejection separately. Real recipe integration additionally checks hot Oriharukon
(1380 ticks, 7680 EU/t, 5400 K) and Epichlorohydrin (640 ticks, 30 EU/t).
With a Naquadah coil (7201 K) and LuV voltage (+400 K), that Oriharukon scenario
has 7601 K effective heat, two heat discounts and one heat-perfect OC: 345 ticks,
27,725 EU/t and 9,565,125 EU per execution. Its item/fluid quantities stay unchanged.
All 14 implemented coil heat ratings and names are also independently checked
at each source version, by compiling the original enum and reading translations.

To reproduce all reference results with Python 3, JDK 21+ and network access:

```sh
npm run check:machines
```

`tools/machine-reference.py` downloads source at immutable commits, compiles each
unmodified calculator in a temporary directory, and supplies minimal dependency
stubs. The actual `GTUtility` power and integer-log helpers are extracted from
the same pin; excluded subtick code alone uses a small clamp stub. Java has no
dependency on Atlas's implementation. Source SHA-256 hashes are recorded in
`tests/fixtures/gt5-machine-reference.json`. `--write` regenerates that fixture;
normal checks require identical output. The game and complete machine classes
are not run by this numerical harness.

`machine-model.js` adapts the GT5 numerical formulas and is provided under
LGPL-3.0-or-later, with attribution in its header. See
`licenses/GT5-Unofficial-LGPL-3.0.txt` and `licenses/GPL-3.0.txt` for the associated
license texts. It remains a replaceable JavaScript module in the static site.
