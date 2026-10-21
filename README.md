# GTNH NEI Recipe Search & Calculator | GTNH Atlas

**GTNH Atlas** is a mobile-friendly **GregTech: New Horizons recipe searcher, usage lookup, calculator, and planning tool**.

Maintained by [Milky-way-Galaxy](https://github.com/Milky-way-Galaxy).

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

The app is plain HTML, CSS and JavaScript with no framework or runtime package
dependency. Node 22+ runs development checks and stages the Pages artifact:

```sh
npm ci
npx playwright install chromium
npm run offline:manifest # after editing runtime HTML/JS/CSS
npm run verify
```

`npm run verify` runs lint, static asset/module validation, real-database tests,
and desktop/mobile Chromium browser regressions against the staged public site.
`npm run build` validates the static site and offline manifest; it does not
replace the checked-in `dist/` modules. `npm run stage` creates `_site/`, stamps
the complete local module graph with a content-derived build ID, and includes
verified data and license notices. Tests and development dependencies are excluded.
To preview at the GitHub Pages repository path, run `node tools/serve.js` and open
<http://127.0.0.1:4173/gtnhnei/>. An existing Chromium installation can be selected
with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium`.

See [validation notes](docs/validation.md) for startup behavior, test coverage and
known limitations of the bundled legacy test suites.


## Production planning

One **Calculator** offers **Basic** and **Factory** modes with a shared draft.
Choose products, factory outputs and inventory through the NEI icon picker,
using partial search, favorites or recent items instead of remembering exact names.
Fluid selections set litres automatically. Mode changes retain advanced settings
and show when they still affect a Basic result.

The calculator computes recursive materials, route/OreDict alternatives, expected
chance yields, startup stock, machine requirements and base energy. Factory plans
combine up to 20 outputs with shared inventory and optional ordered co-product
reuse. Whole batches and continuous rates, native item stacks, fixed-machine
capacity/power checks and explicit overclock/parallel profiles are supported.
Route choices show net yields and energy per output; recipe details expose
exported machine metadata. Legacy Material Calculator APIs remain available.
**Compare production routes** opens mobile-friendly cards with machine/voltage
filters, energy per net output, throughput, expected chance yields, ingredients,
startup stock and exported conditions. Choosing a card uses its exact recipe ID.
Full-plan previews show actual material and known-power changes before applying
the candidate. Plan checks expose unresolved routes and circular dependencies.
Opt-in guided steady-state balances support guaranteed selected-recipe loops,
requiring explicit circulating stock and rejecting unsupported balances.
New numerical semantics use portable plan format 4; formats 1–3 remain readable.
See the [unified calculator guide](docs/unified-calculator.md) for migration,
the real returned-cell regression and precise limits.
Opt-in [GT5 reference profiles](docs/machine-models.md) constrain overclocks by
voltage/power and calculate Electric Blast Furnace heat discounts, coil heat
and voltage bonuses. Rate factories report shared-stage bottlenecks, utilization
and the capacity ceiling of the complete output mix. Installed counts can be
overridden per recipe and exported as a machines CSV.

**Supplies** turns a built plan into a gathering checklist. Rate plans project
consumption, output and known energy for a chosen operating duration at either
the requested mix or the conditional installed-capacity ceiling. Native stacks
and buckets accompany exact base quantities. Startup stock is not multiplied by
time. Preparation marks survive plan JSON/shared links, invalidate when required
quantities change, and leave recipe/inventory math untouched. Supplies CSV and a
print layout support practical building.

Named plans are saved per dataset/export on this browser. Versioned JSON, shared
plan links, material CSVs, dependency SVGs and gtnh-flow YAML/DOT/SVG support
backup and exchange. Search has item/fluid/mod filters and exact-ID permalinks.

The installed datasets are verified upstream **GTNH 2.8.0** and **GTNH 2.9.0**
exports with matching atlases and independent checksums. The default 2.8.0 assets
remain unchanged. On-demand recipe comparisons keep exact good IDs across the
two snapshots. **2.8.4 remains unavailable** until a matching export is verified.
See [calculation assumptions](docs/calculations.md), [dataset provenance](docs/datasets.md),
the [workspace/offline/supplies report](docs/overnight-workspace.md),
the [machine/factory report](docs/machine-and-factory-capacity.md), and
the [earlier calculator/version/flow report](docs/development-2026-10-20.md).

## Library, offline use and publishing

The toolbar exposes **Planner**, **Calculator**, **Library**, **Offline** and the
version chooser on phones. Star a recipe to keep its exact item ID. Library has
version-specific favorites, recent history, recipe/usage/plan actions and JSON
import/export. Old name-based favorites remain recoverable; ambiguous names are
retained visibly rather than assigned to a guessed item.

Verified decompressed databases are cached in IndexedDB, keyed by pack and SHA-256.
Return visits skip downloading/decompressing 15–18 MB of gzip data and still check
integrity. Damaged caches are replaced; unavailable/full storage falls back to
network loading. **Offline → Save active version offline** additionally saves the
application and the matching checksum-verified icon atlas. Offline search,
planning, local dependency SVGs and saved work then run without a connection.
The external flow solver and GitHub feedback still need a connection. Browsers
can evict disposable data; export plans and favorites for portable backups.

Offline app updates wait for **Apply app update and reload**. Removing downloaded
data retains all plans/favorites. Keyboard shortcuts: `/` search, `P` planner,
`L` library, `?` help; focused grid items support `R`, `U`, and `F`.

The **Publish Atlas** workflow reuses Site checks before uploading `_site/` and
deploying to GitHub Pages. Its repository-scoped `pages: write` token selects
**GitHub Actions** as the Pages source; repository policy must allow that
permission. A push to `main` publishes only after those checks pass. Respect the user's publishing
approval before merging. For a local measurement of first/returning visits:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run benchmark:startup
```

The benchmark uses local HTTP and simulated mobile viewports without CPU/network
throttling; it is not a physical-phone or public-network performance measurement.

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
