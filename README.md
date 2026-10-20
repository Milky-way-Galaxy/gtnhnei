# GTNH NEI Recipe Search & Calculator | GTNH Atlas

**GTNH Atlas** is a mobile-friendly **GregTech: New Horizons recipe searcher, usage lookup, calculator, and planning tool**.

Live site:

https://milky-way-galaxy.github.io/gtnhnei/

This project is made for GTNH players who want a faster way to search recipes, check item usages, inspect machines, plan materials, and use GTNH-related tools without opening the full game every time.

---

## Features

- **GTNH NEI-style search**
  - Search items, recipes, machines, inputs, and outputs.
  - Useful when you want to quickly check how something is made or used.

- **Recipe and usage lookup**
  - Find recipes for an item.
  - Find what an item is used in.
  - Check machine, input, output, duration, and EU/t data when available.

- **GTNH calculator / planner**
  - Helps with material and route planning.
  - Designed for GTNH factory thinking, not just simple item search.

- **gtnh-flow integration**
  - Built to work alongside GTNH flow-style planning.
  - Useful for visualizing production chains and routes.

- **Mobile-friendly interface**
  - Works on phones.
  - Designed for quick lookup while playing.

- **Static website**
  - No server required.
  - Runs directly from GitHub Pages.

---

## Why GTNH Atlas?

GTNH has huge recipe chains, many machines, many intermediate materials, and a lot of “wait, how the hell do I make this again?” moments.

GTNH Atlas tries to make that easier by combining:

```text
NEI-style search + recipe lookup + usage lookup + calculators + planning tools

```


## Development and checks

The deployed app is plain HTML, CSS and JavaScript. Serve the repository over HTTP;
there is no runtime package dependency or framework build step. Node 22+ is used
only for development checks:

```sh
npm ci
npx playwright install chromium
npm run verify
```

`npm run verify` runs lint, static asset/module validation, real-database tests,
and desktop/mobile Chromium browser regressions. `npm run build` validates the
static site; it does not generate or replace the checked-in `dist/` modules.
To preview at the GitHub Pages repository path, run `node tools/serve.js` and open
<http://127.0.0.1:4173/gtnhnei/>. An existing Chromium installation can be selected
with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium`.

See [validation notes](docs/validation.md) for startup behavior, test coverage and
known limitations of the bundled legacy test suites.


## Production planning

The Planner calculates recursive materials, route/OreDict alternatives, expected
chance yields, startup stock, machine requirements and base energy. Factory plans
combine up to 20 outputs with shared inventory and optional ordered co-product
reuse. Whole batches and continuous rates, native item stacks, fixed-machine
capacity/power checks and explicit overclock/parallel profiles are supported.
Route choices show net yields and energy per output; recipe details expose
exported machine metadata. The separate Material Calculator shares the engine.
Opt-in [GT5 reference profiles](docs/machine-models.md) constrain overclocks by
voltage/power and calculate Electric Blast Furnace heat discounts, coil heat
and voltage bonuses. Rate factories report shared-stage bottlenecks, utilization
and the capacity ceiling of the complete output mix. Installed counts can be
overridden per recipe and exported as a machines CSV.

Named plans are saved per dataset/export on this browser. Versioned JSON, shared
plan links, material CSVs, dependency SVGs and gtnh-flow YAML/DOT/SVG support
backup and exchange. Search has item/fluid/mod filters and exact-ID permalinks.

The installed datasets are verified upstream **GTNH 2.8.0** and **GTNH 2.9.0**
exports with matching atlases and independent checksums. The default 2.8.0 assets
remain unchanged. On-demand recipe comparisons keep exact good IDs across the
two snapshots. **2.8.4 remains unavailable** until a matching export is verified.
See [calculation assumptions](docs/calculations.md), [dataset provenance](docs/datasets.md)
the [latest machine/factory report](docs/machine-and-factory-capacity.md), and
the [earlier calculator/version/flow report](docs/development-2026-10-20.md).

Additional checks:

```sh
npm run audit:data
python3 tools/package-flow.py --check
npm run check:machines
```

`check:machines` requires Python 3, JDK 21+ and network access. It independently
reproduces the committed numerical fixtures with release-pinned original GT5
Java calculators and heating-coil enums. The normal Node suite uses these
fixtures without needing Java or external downloads.

The checked-in browser Python source package is reproducible with
`python3 tools/package-flow.py`. Its source/config/license hashes are validated
by the normal build check. Full Pyodide rendering downloads external runtime
packages on demand; local dependency SVGs work without that runtime.


The opt-in integration smoke test downloads the real Python runtime/packages and
Viz.js, runs a two-output factory, checks its power/material rates and verifies
flow/JSON tab recovery in a touch-emulated browser:

```sh
npm run smoke:flow
ATLAS_SMOKE_DATASET=gtnh-2.8.0 npm run smoke:flow
```

It starts or reuses the local preview server and saves YAML, SVG, flow text and
mobile screenshots under `test-results/real-flow-smoke/<dataset>/`. The default
is 2.9.0. This external-runtime check is separate from the deterministic normal
suite; it requires access to the pinned runtime CDNs.
