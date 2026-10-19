# Startup and regression validation

This records the historical PR #3 baseline. See [the current development report](overnight-development.md) for subsequent implementation and validation.

The revival changes target three areas:

1. **Rendering and incremental search.** Restore the missing grid/recipe batch
   constants (180 goods and 24 recipes per append). Compute the full matching
   goods list once per query, grow its visible slice, and listen to the actual
   grid scroll container. Limit changes append directly without synthetic input
   events or page reloads. Existing slots and scroll position survive growth.
2. **Database loading and initialization.** Stream the gzip response while
   reporting compressed bytes received; then show the indexing stage. One boot
   controller handles loading, errors and retry. The overlay remains present
   during slow downloads. Four dependent API installers await the database;
   superseded icon/flow implementations and identical guarded API copies are
   removed. Maker choices wrap the final flow API when it becomes available.
   Classic feature scripts use `defer` in document order.
3. **Planner scrolling.** Stop clearing every descendant's horizontal scroll on
   DOM changes. Observe panel insertion rather than all style/class mutations,
   and avoid redundant overflow writes. Planner tabs and flow viewers can retain
   their horizontal positions while other UI elements update.

## Reproduction and checks

The starting commit is `02302ff`. A real Chromium run of that commit loaded the
API but rendered zero grid slots; the status reported
`ERROR: GRID_PAGE_SIZE is not defined`. Recipe batching also referenced an
undefined `RECIPE_PAGE_SIZE`. The new lint configuration detects undefined
identifiers in the active application scripts.

The checked-in database contains 15,379,169 compressed bytes, 45,051,492
decompressed bytes, 41,091 items, 1,542 fluids, and 190,080 recipes. The database,
`data/atlas.webp`, and `dist/` parser modules are unchanged. A full-byte comparison
checks that the streaming loader returns the original decompressed database.

Run with Node 22+:

```sh
npm ci
npx playwright install chromium
npm run verify
```

Validation on 2026-10-19 with Node 24.19.0 and Chromium 154.0.8037.57:

- ESLint: passed for active application code and development tooling. Archived
  `disabled_scripts/`, generated `dist/`, and third-party `vendor/` are excluded.
- Static site build/validation: passed for 30 local assets and 19 active scripts
  and modules, including dependency paths, syntax and unique static HTML IDs.
- Node tests: **9 passed**. Real data counts, representative production/usage
  pointers, mod-filtered search, gzip integrity/progress, missing Content-Length,
  network/HTTP failures, and damaged payloads are covered.
- Browser tests: **20 passed** across desktop and Pixel 7 touch emulation. They
  cover rendered batches, one-time API initialization, one data download,
  filtered incremental growth without navigation, empty results, production and
  usage cards, machine tabs, back/forward, live-card mounting, YAML output,
  downloads held beyond 25 seconds, HTTP/gzip/version errors and retry, missing
  gzip support, and preservation of horizontal scroll after DOM changes.
- An additional manual browser check used touch-emulated taps to open Electric
  Blast Furnace production and return to the filtered item grid.
- GitHub Pages compatibility is exercised at `/gtnhnei/` using a static HTTP
  server. The Pages source is `main:/`; this feature branch is not deployed.

The `build` command validates the existing static files. No bundle or runtime
npm dependency is required. Pull-request CI runs the same `npm run verify` suite.

## Bundled Python and historical JavaScript tests

The vendored Python suite can be run independently:

```sh
cd vendor/gtnh-flow-browser
python3 -m pip install -r requirements.txt
PYTHONHASHSEED=0 python3 -m pytest -q
```

The first run reported **325 passed, 10 failed**. An untouched baseline checkout
reported **326 passed, 9 failed**; `projects/gog/zhuhai_cetane.yaml` passed in the
baseline run after failing in the branch run, with identical source and fixtures.
The other failures cover malformed/incomplete projects, discovery of non-YAML
files, a Graphviz label error, and underdetermined/zero-divisor solver scenarios.
With `PYTHONHASHSEED=0`, both the branch and untouched `02302ff` baseline reported
**326 passed, 9 failed**, with identical failures:

- `projects/cbdline.yaml` — missing duration.
- `projects/hogline.yaml` — null duration.
- `projects/diesel.yaml` — missing balancing anchor.
- `projects/.stfolder/syncthing-folder-3621a3.txt` — non-YAML discovery.
- `projects/renewables/hydrogen/goldenapple.yaml` — Graphviz label error.
- `projects/renewables/oxy/brick.yaml` — division by zero.
- `projects/renewables/chlorine/diwater_loop.png` — non-YAML discovery.
- `projects/random/crashes.yaml` — underdetermined system.
- `projects/random/ucfe_chemplant.yaml` — division by zero.

No vendored files were changed. These tests are documented separately from the
passing application CI suite.

`dist/tests/` contains historical compiled Jest tests but no runner configuration,
original sources, `.gtnh` solver fixtures or snapshots. Its repository assertions
are restored in the new runnable Node tests. The historical solver snapshot suite
cannot be reconstructed from the checked-in files.

## Remaining limits

- Repository indexing still runs synchronously on the main thread after a paint
  opportunity. Decompression already streamed in the original app. These changes
  remove redundant polling, rendering work and repeated searches; they do not
  shrink the database. No numerical load-time or memory improvement is claimed.
- Mobile coverage uses Chromium emulation, not physical devices or Safari.
- YAML export and live recipe cards are tested. Full Pyodide diagram generation
  is not covered: the worker expects `vendor/gtnh-flow-browser.zip`, which is
  absent from the tracked repository (`*.zip` is ignored). Packaging that archive
  and auditing the reported NASA Workbench data gap remain follow-up work.
