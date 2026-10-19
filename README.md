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

The Planner now calculates recursive materials, route/OreDict alternatives,
expected chance yields, startup stock, machine requirements and base energy.
It supports whole batches and continuous rates, native item stacks, finite stock
on hand for total jobs, fixed-machine capacity/power checks, dataset-bound JSON plans,
material CSVs and dependency SVGs. The separate Material Calculator shares the
same engine. Search has item/fluid/mod filters and exact-ID permalinks.

The installed dataset is verified **GTNH 2.8.0**. 2.8.4 is not relabeled from
2.8.0; unavailable versions remain disabled until authentic compatible exports
are validated. See [calculation assumptions](docs/calculations.md),
[dataset provenance](docs/datasets.md) and the
[development report](docs/overnight-development.md).

Additional checks:

```sh
npm run audit:data
python3 tools/package-flow.py --check
```

The checked-in browser Python source package is reproducible with
`python3 tools/package-flow.py`. Its source/config/license hashes are validated
by the normal build check. Full Pyodide rendering downloads external runtime
packages on demand; local dependency SVGs work without that runtime.
