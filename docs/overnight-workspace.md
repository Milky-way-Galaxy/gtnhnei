# Workspace, offline use and practical production planning

This milestone starts from published main `98a6371` and keeps both authentic
recipe datasets and prior calculator/source-verification work intact. No recipe
binary, atlas, GT5 formula, or upstream Python solver source was changed.

## Delivered functionality

### Repeat loading and offline use

`database-cache.js` caches decompressed recipe buffers in IndexedDB by exact
dataset ID plus uncompressed SHA-256. Every cached read is verified before the
repository parser runs. Corrupt entries are removed and downloaded again;
blocked, slow or full cache storage does not prevent a network load. Metadata is
stored separately so listing cache sizes does not deserialize every large buffer.
Saving a new revision replaces old revisions of that pack, retaining other packs.
Both startup and version comparison share this loader.

Offline installation is explicit. It saves one coherent static app build and the
active version's checksum-verified atlas. The service worker pins the shell to
its build; databases retain their separate content/version verification. An
unsaved version fails visibly offline and never borrows another version's data.
The manager shows what is saved, removes disposable downloads, and applies app
updates after acceptance. Plans, favorites and inventory use separate storage.

The generated shell follows actual local module imports and includes the Python
worker/package and Easter egg assets. It excludes dev tools and recipe/atlas
binaries from automatic shell installation. External Pyodide, Viz and GitHub
feedback require connectivity; ordinary search/planning/dependency SVGs work
offline after installation. Browser eviction and quota still apply.

### Workspace and item library

One toolbar owns Planner, Calculator, Library, Offline, Help and version choice.
The old toolbar rename observer and 488-line obsolete toolbar stylesheet were
removed. A flex layout reserves the viewport for the recipe scrolling surface;
the compact phone toolbar wraps visibly rather than hiding tools offscreen.
Native dialogs provide focus containment, Escape closing and focus return.
Keyboard shortcuts cover search, planner, library, help, recipes, usages and stars.
Layout preferences fall back to the tab when localStorage is inaccessible.
Browser Ctrl/Cmd/Alt combinations are retained. Mobile planner actions wrap into
two visible rows, including Build and Supplies. The old automatic-help preference
is retained and editable; clearing favorites now has undo without clearing history.

Favorites now retain exact case-sensitive item/fluid IDs, with up to 500 favorites
and 100 deduplicated recent goods per version. Recipe pages have a star. Library
rows open recipes, usages or planning and retain name copying. JSON files merge
favorites/history only into the matching dataset revision. Legacy favorites map
to IDs only for unique exact names; missing/ambiguous names stay visible. Original
legacy storage is preserved. Malformed saved data is retained for raw backup.

### Supplies and preparation checklist

Planner → Supplies projects a selected operating duration for rate plans:

- Consumed inputs, outputs and byproducts scale by seconds and selected rate mix.
- Known energy is average EU/t × 20 ticks/s × seconds × mix scale.
- Requested rates and the conditional known-stage installed ceiling are explicit
  choices. Partial stages, boundary supplies and recipe conditions remain flagged.
- Reusable startup stock stays at the configured machine-pool requirement.
- Packing uses each item's native stack size and 1,000 L/bucket, without changing
  or rounding the underlying calculated demand.
- Checkmarks persist as optional plan presentation data, including JSON/share
  links. A check applies only when its exact required quantity still matches.
- Supplies CSV includes dataset, basis, duration, scale, exact IDs, units, packing
  and preparation. Print mode shows the checklist and assumptions.

These are continuous-rate supply estimates, with no batch-startup scheduling,
machine warmup or logistics simulation. Preparation does not deduct inventory or
change production calculations. Existing numeric plan formats remain unchanged.

### Production-route comparison

Each dependency's production-route control can open comparison cards. Sorting
uses EU per unit of net output, net throughput, voltage or batch yield; filters
cover machine, ingredient/recipe text and maximum known recipe voltage. Unknown
timing/power stay unknown. Chance yields are expected values. Zero-net-output
routes are ineligible. Cards show net inputs/outputs, reusable stock, conditions,
crafters and exact recipe IDs; selecting one updates the current plan.

Metrics cover the base recipe step. Recursive input-production costs and custom
machine profiles are evaluated in the resulting plan, not invented in the cards.

### Checked static publishing

`tools/stage-site.js` produces the exact public artifact from an allowlist of
runtime assets, verified datasets, notices and docs. It excludes test fixtures,
node_modules, workspace/recovery files and private conversation archives.
One content-derived query version covers local scripts, module imports, styles
and the worker package so browsers do not combine old and new release modules.
The staging transform itself contributes to the build ID. Integration/debug
imports can use `window.GTNH_MODULE_URL(path)` to share app module identity.

Playwright serves this staged artifact at the GitHub Pages subpath. Publish Atlas
reuses the complete Site checks workflow before deploying through Pages Actions,
replacing the ambiguous legacy/Jekyll publication path.
The deployment job selects the Actions source with its scoped `pages: write`
token; the connected development integration does not have Pages-settings write
access (its direct setup request returned 403). Actual setup/deployment results
are recorded in the PR's release status.

## Local startup measurement

The benchmark made one first visit and two returns for each dataset in separate
desktop and Pixel 7 Chromium contexts. It used local HTTP, no CPU or network
throttling. Timing starts at the load callback and excludes initial scripts/styles.
The first visit includes verification and writing the raw cache; returns still
verify and construct indexes. Values are milliseconds, rounded.

| Context | Pack | First startup | Two returns | Database first | Database returns |
| --- | --- | ---: | ---: | ---: | ---: |
| Desktop Chromium | 2.8.0 | 1,469 | 663 / 1,220 | 641 | 174 / 244 |
| Desktop Chromium | 2.9.0 | 1,672 | 775 / 705 | 656 | 176 / 198 |
| Pixel 7 emulation | 2.8.0 | 1,265 | 709 / 602 | 570 | 181 / 150 |
| Pixel 7 emulation | 2.9.0 | 1,582 | 769 / 692 | 675 | 203 / 172 |

Only one binary was fetched across each three-visit sequence: 15,379,169 bytes
for 2.8.0 and 17,699,195 for 2.9.0. These results establish the skipped download
and local benefit; they do not measure physical-phone or public-network speed.

## Verification

Focused checks passed before the full release regression:

- Cache: 114 Node tests and 28 browser cases across desktop/mobile at that step.
- Navigation/version/material regressions: 20 browser cases.
- Library/offline UI: 12 cases, followed by four checks after shell-graph cleanup.
- Supplies/saved-plan integration: 10 cases; the real 2.8 and 2.9 epichlorohydrin
  routes independently produced the expected two-hour quantities and energy.
- Route cards plus inaccessible localStorage: four browser cases.
- Both complete offline datasets, unsaved-version recovery, accepted updates,
  old-shell cleanup and invalid atlas hashes: eight browser cases.

Release verification:

- Full local `npm run verify`: lint/static/packaging checks, 131 Node and 130
  desktop/mobile cases passed before the final compatibility additions.
- Full [CI on e191eeb](https://github.com/Milky-way-Galaxy/gtnhnei/actions/runs/39462616996):
  132 Node and 132 browser cases passed, 640 original-Java reference cases passed,
  411,840 recipe audit passed, and focused upstream Python rounding passed.
- Final compatibility checks: 18 library/search, 14 library/supplies/mobile action
  and four print-media cases passed locally. The exact reported `pine plank`
  search also passed on desktop/mobile, showing all four matching items without
  an exception. The final browser collection contains 134 cases.
- Real external Pyodide/Viz smoke: both versions passed from the staged artifact.
  The two-output factory produced expected 48 average / 60 installed EU/t,
  62.5 L/s installed recipe capacity, SVG/text and repeated flow/JSON recovery.
- Full inherited vendor Python suite: **333 passed, 10 failed**. Nine failures
  match the previously recorded baseline. The additional
  `projects/gog/zhuhai_cetane.yaml` example is hash-order-sensitive: it fails on
  both this branch and a clean `98a6371` copy at `PYTHONHASHSEED=1`, and passes on
  both at seed 0. No vendored Python source or fixture changed.
- Browser print-media rules and unclipped root overflow are checked. Physical
  printing and physical-phone/Safari behavior remain unverified.

The final PR check and Publish Atlas workflow are the release gates; current
results and deployment links are recorded in [PR #12](https://github.com/Milky-way-Galaxy/gtnhnei/pull/12).

The initial staged test exposed an offline cache-key/versioning mismatch. The
generated file list now remains canonical while executable imports are versioned;
both datasets' actual disconnected reloads passed after that correction.

## Existing issue coverage

[Issue #2](https://github.com/Milky-way-Galaxy/gtnhnei/issues/2) reported an
undefined `GRID_PAGE_SIZE` after searching `pine plank`. The published startup
fix retains a defined batch constant, and this milestone adds the exact query
as a desktop/mobile regression. Firefox itself was not exercised.

[Issue #1](https://github.com/Milky-way-Galaxy/gtnhnei/issues/1), missing NASA
Workbench rocket construction, remains a verified data-coverage gap. Neither
snapshot has a NASA Workbench recipe type. For example, the Tier 1 base rocket
`i:GalacticraftCore:item.spaceship:0` has only a shapeless variant-conversion entry;
the chest variants have no production entries. Matching item names and conversion
recipes cannot reconstruct an authentic workbench construction recipe. This needs
version-pinned upstream extraction or a separately verified supplemental dataset.

## Scope and remaining work

- GTNH 2.8.4 still needs an authentic verified recipe export. No dataset was added
  or relabeled in this milestone.
- Specialized multiblock modifiers, subtick/laser behavior, global route/recycling
  optimization and factory scheduling remain outside the current engine.
- Source-derived numeric GT5 checks remain in the existing machine test suite.
- Native browser persistence is not a backup guarantee. Export important plans
  and libraries. Corrupt saved libraries are preserved for manual recovery.
- Tests cover Chromium desktop/touch emulation. Physical phones, Safari and
  Firefox are not verified here.
- The inherited full Python vendor suite has known fixture failures and ordering sensitivity;
  no solver source was changed. Focused upstream rounding checks remain in CI.

Recommended next work: broaden source-verified machine capability models, add
explicit recycling/seed-stock optimization, and validate physical-phone/Safari
behavior and authentic 2.8.4 extraction.

## Changed files

`D` marks removed obsolete toolbar files; other entries are added or modified.

```text
M	.github/workflows/checks.yml
A	.github/workflows/pages.yml
M	.gitignore
A	AGENTS.md
M	README.md
M	app.js
M	data-loader.js
A	database-cache.js
M	datasets.js
A	docs/overnight-workspace.md
M	eslint.config.js
M	index.html
A	item-library.js
A	library-ui.js
D	navsplit.js
A	offline-manifest.js
A	offline-paths.js
A	offline-ui.js
A	offline.js
M	package.json
M	planner-state.js
M	planner-ui.js
M	playwright.config.js
A	preferences.js
A	route-choice-ui.js
A	route-choices.js
M	seo-intro-close.js
A	service-worker.js
A	supply-plan.js
A	supply-ui.js
M	tests/browser/atlas.spec.js
M	tests/browser/comparison.spec.js
A	tests/browser/database-cache.spec.js
A	tests/browser/library.spec.js
A	tests/browser/offline.spec.js
A	tests/browser/route-choices.spec.js
M	tests/browser/search.spec.js
A	tests/browser/supplies.spec.js
A	tests/database-cache.test.js
A	tests/item-library.test.js
A	tests/route-choices.test.js
A	tests/supply-plan.test.js
A	tools/benchmark-startup.js
A	tools/offline-manifest.js
M	tools/serve.js
M	tools/smoke-flow.js
A	tools/stage-site.js
D	topstrip.css
M	topstrip.js
A	ui-dialog.js
M	version-compare-ui.js
A	workspace.css
```
