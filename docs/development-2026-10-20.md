# GTNH Atlas development handoff — 2026-10-20

The latest branch, `fix/flow-view-and-retry`, contains all work from PR #3 through
PR #10. Nothing has been merged or deployed. The original 2.8.0 database and atlas
are unchanged. This report supersedes the historical #4–#5 report.

## Review stack and delivered milestones

| PR | Base | Delivered behavior | Implementation commits |
| --- | --- | --- | --- |
| [#3](https://github.com/Milky-way-Galaxy/gtnhnei/pull/3) | main | Startup, initialization, search and mobile scrolling fixes | `ae6c781` |
| [#4](https://github.com/Milky-way-Galaxy/gtnhnei/pull/4) | #3 branch | Shared recursive calculator, dataset infrastructure, filtering/permalinks, packaged browser solver | `ae40cd1` through `897cdb1` |
| [#5](https://github.com/Milky-way-Galaxy/gtnhnei/pull/5) | #4 branch | Finite inventory, native stacks, exact-ID makers, preserved settings and precision fixes | `48a00f2` through `a4890cb` |
| [#6](https://github.com/Milky-way-Galaxy/gtnhnei/pull/6) | #5 branch | Multi-output factory calculation and ordered co-product reuse | [0ec27f5](https://github.com/Milky-way-Galaxy/gtnhnei/commit/0ec27f5) |
| [#7](https://github.com/Milky-way-Galaxy/gtnhnei/pull/7) | #6 branch | Authentic 2.9.0 dataset, format-7 adapter and recipe comparisons | [5acee00](https://github.com/Milky-way-Galaxy/gtnhnei/commit/5acee00), [c0896e8](https://github.com/Milky-way-Galaxy/gtnhnei/commit/c0896e8) |
| [#8](https://github.com/Milky-way-Galaxy/gtnhnei/pull/8) | #7 branch | Named factory library and complete shareable plan links | [6d556e2](https://github.com/Milky-way-Galaxy/gtnhnei/commit/6d556e2) |
| [#9](https://github.com/Milky-way-Galaxy/gtnhnei/pull/9) | #8 branch | Route energy/yield metrics, recipe metadata, installed capacity and route-selection performance | [e5b8a4a](https://github.com/Milky-way-Galaxy/gtnhnei/commit/e5b8a4a) |
| [#10](https://github.com/Milky-way-Galaxy/gtnhnei/pull/10) | #9 branch | Flow retry/view/clipboard recovery, stale-plan guards, DOT export and real-runtime smoke tooling | [eb99d18](https://github.com/Milky-way-Galaxy/gtnhnei/commit/eb99d18) |

Review in stack order. Later branches include earlier implementation commits.
After merging a base, retarget/rebase its successors as appropriate, particularly
if using squash merges. The final reporting commit is listed in #10's commit tab.

## Calculator functionality completed

The production and material calculators share the same structured recipe engine,
with exact dataset/good/recipe identities. Recursive expansion supports explicit
routes and OreDict alternatives, whole or fractional jobs, continuous rates,
expected chance yields, fluid/bucket/native-stack conversion, returned stock,
non-consumed tools, consumed cells, cycles, missing recipes and depth/node limits.
Boundary inputs remain in the material ledger rather than disappearing.

The continuation adds factories of up to 20 outputs. Duplicate exact outputs are
converted and combined before root batch rounding. Inventory is spent once across
all roots; material, energy and recipe-machine ledgers are shared. Machine rate
demand aggregates before installed counts round up. Optional co-product reuse
spends earlier outputs once, after their inputs are expanded, preserving cyclic
seed requirements. Used co-products and remaining surplus are shown separately.

Root processing times are per output. Rates expose machine equivalents, required
and installed counts, average/installed EU/t and installed recipe capacity. Fixed
counts provision startup stock and installed power correctly. Explicit normal/
perfect OC and parallel profiles remain available. Recipe choices show expected
net output and base EU per item/L, including a lowest-base-energy route policy.

Both regular and embedded recipe cards expose exact recipe IDs, base energy and
exported GT metadata. The planner displays these conditions next to profiles.
The unused duplicate card renderer was removed. Locked route selection no longer
balances unrelated alternatives; automatic selection uses one scoring pass.

Plans support JSON import/export, material CSV, full dependency SVG and base-recipe
gtnh-flow YAML. Factory JSON uses schema 2; single-output and legacy settings remain
supported. Named plans save/load/replace/download/delete/undo per dataset checksum.
Shared links contain full configurations, including inventory, and load through a
preview before replacing the active draft. Corrupt storage, quota errors, invalid
payloads and incompatible datasets fail visibly while retaining existing data.

Flow rendering now retries failed Viz imports, restores YAML/JSON exports when
switching views, and never hides workspace ancestors by scanning their text.
Clipboard failures have a download fallback, including new DOT export. Edited
unbuilt drafts cannot silently render a default recipe; obsolete results and
empty executable plans are handled explicitly.

## Authentic version support

| Installed snapshot | Format | Items | Fluids | Recipes |
| --- | --- | ---: | ---: | ---: |
| GTNH 2.8.0 upstream export | 5 | 41,091 | 1,542 | 190,080 |
| GTNH 2.9.0 upstream export | 7 | 50,811 | 1,476 | 221,760 |

Both databases and matching atlases have pinned provenance and checksums. The
2.8.0 files retain their original bytes. Startup verifies the selected export's
decompressed checksum and record counts. Settings, saved plans, choices and URLs
remain associated with the correct dataset. Switching reloads the repository.

The format-7 tooltip storage change is implemented explicitly. All 2.9 good
fields, IO, GT metadata, machine lists and ID remaps are compared with an
independent pinned upstream parser, whose MIT notice is retained. The upstream
asset notice is retained with the new data. These are verified upstream snapshots,
not fresh extractions from locally launched modpacks.

2.8.4's official pack release was verified, but no matching recipe export was
verified; selection stays disabled. The 2.7.4 archive needs a validated format-3
adapter. No export was relabeled or substituted. See [provenance/extraction](datasets.md).

Production and usage pages compare recipes for the selected exact good ID against
the other installed snapshot. Content matching avoids treating exporter-ID changes
as recipe changes. Results distinguish unchanged, added, removed and uniquely
matched modified routes, paginate details and export complete JSON. Comparison
repositories never replace the active repository. Different IDs with the same name
remain separate: the mercury Epichlorohydrin route outputs GalacticraftMars Hydrogen
in 2.8.0 and GregTech Hydrogen in 2.9.0.

## Verification and practical evidence

| Check | Completed result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run build` | Passed: static assets/imports/syntax and 24 packaged Python/config/license files |
| `npm test` | **90 passed** |
| Desktop + Pixel 7 touch Chromium | **88 passed** in the complete application run |
| `npm run audit:data` | **411,840 recipes passed**, with exact structured quantities/probabilities, hashes and counts |
| Independent upstream format-7 contract | Every installed 2.9 record/remap passed |
| `npm run smoke:flow` | Real 2.9 Pyodide + Viz.js passed, including flow/JSON/re-render recovery |
| `ATLAS_SMOKE_DATASET=gtnh-2.8.0 npm run smoke:flow` | Same real-runtime check passed with the 2.8 IDs |
| Full vendored pytest, `PYTHONHASHSEED=0` | **334 passed; 9 existing baseline failures**, unchanged |
| Whitespace/diff checks | Passed |

The deterministic flow browser cases mock Worker/Viz responses to test failures,
retry, views and exports. They do not replace the separate actual-runtime smoke
checks. The three flow regression cases failed against the preceding code, then
passed after the repair. Browser coverage uses Chromium emulation; Safari and
physical phones were not tested. No in-game machine build was tested.

Verified real examples:

- 2.8.0 Epichlorohydrin: 2000 L = two 640-tick, 30 EU/t executions = 38,400 EU.
- Both snapshots' mercury routes: 3000 L/min Epichlorohydrin plus 6000 L/min
  co-product Hydrogen uses 1.6 base machine equivalents, 48 average EU/t and two
  installed machines/60 EU/t, with 62.5 L/s installed Epichlorohydrin capacity.
  The actual solver diagram reports 50 L/s Epichlorohydrin and 100 L/s Hydrogen.
- 2.8.0 Hot Oriharukon route `r~--l7UvQdPwieyDfV6NjffQ==`: `coil_heat = 5400`,
  1380 ticks at 7680 EU/t = 10,598,400 EU per ingot.
- Warm local Node route microbenchmark: same explicit route among 1,434 real
  2.9 Iron Ingot alternatives, median of five 100-call samples: 400.81 ms before,
  1.19 ms after. This measures route selection, not total startup or every device.

Real smoke artifacts (YAML, SVG, flow text, mobile screenshots) are generated under
`test-results/real-flow-smoke/<dataset>/`; the opt-in command reproduces them.
All normal browser checks run at the GitHub Pages `/gtnhnei/` subpath.

The nine full-Python failures remain cbdline, hogline, diesel, the Syncthing text
fixture, goldenapple, brick, diwater-loop PNG, crashes and ucfe_chemplant. They
match the baseline described in [validation notes](validation.md); none were
hidden, skipped or changed into successes. The historical compiled Jest snapshots
still lack their original fixtures/runner. Restored repository assertions run in
the Node suite.

## Files and architecture

- Engine/state/UI: `production-engine.js`, `recipe-data.js`, `recipe-export.js`,
  `planner-state.js`, `planner-ui.js`, `planner.css`, and shared material integration.
- New persistence/sharing: `plan-library.js`, `plan-share.js`, `plan-tools-ui.js`.
- Versioning/comparison: manifest, separate 2.9 assets, `datasets.js`, common
  `dist/repository.js`, `repository-loader.js`, `recipe-compare.js`, comparison UI/CSS.
- Recipe details and flow: `recipe-details.js`, `app.js`, existing flow integration,
  worker package and test/smoke tools.
- Existing startup/search/identity fixes and automated checks are preserved.

The full changed-file list against PR #3 is below. Original 2.8.0 binary/atlas
files are absent from that list because they were not modified.

## Known limits and next milestones

1. Obtain an authentic 2.8.4 export using the actual pack/config and a matching
   exporter/parser, with provenance, checksums and browser/calculation validation.
2. Add GT machine-specific capability/heat/voltage/amperage/subtick models using
   verified rules. Current generic profiles display, but do not evaluate, all
   exported machine-specific conditions.
3. Add a global recycling/route optimizer with explicit seed and startup handling.
   Ordered co-product reuse is not a global LP solver; whole-job branches round
   separately, target order can matter, chance outputs are expected values, and
   per-root times are not an overall factory makespan.
4. Add Safari/physical-device coverage and investigate measured worker/offline
   caching improvements. Named libraries remain browser-local; larger links use
   JSON backup. Real flow rendering still downloads pinned external runtimes.
5. Repair the archived Python fixture/solver failures separately while retaining
   their baseline evidence; recover original historical JS solver fixtures if needed.

No framework migration, merge or public deployment was performed. Review the
stack before authorizing publication. The latest branch is a complete checkout of
all delivered work; recovery bundles/patches are provided with the handoff.

## Complete changed-file list after PR #3

```text
.github/workflows/checks.yml
.gitignore
README.md
app.js
calc.js
data-loader.js
data/gtnh-2.9.0/UPSTREAM-NOTICE.md
data/gtnh-2.9.0/atlas.webp
data/gtnh-2.9.0/data.bin
data/manifest.json
datasets.js
dist/repository.js
docs/calculations.md
docs/datasets.md
docs/development-2026-10-20.md
docs/overnight-development.md
docs/validation.md
eslint.config.js
flowcalc.js
flowfix.js
gtnhflow-pyodide-worker.js
gtnhflow-pyodide.js
index.html
loaderguard.js
maker-state.js
makerchoice.js
materialcalc.js
navsplit.js
package.json
plan-library.js
plan-share.js
plan-tools-ui.js
planner-state.js
planner-ui.js
planner.css
production-engine.js
recipe-compare.js
recipe-data.js
recipe-details.js
recipe-export.js
repository-loader.js
search-controls.css
search-controls.js
style.css
tests/browser/comparison.spec.js
tests/browser/flow-recovery.spec.js
tests/browser/makers.spec.js
tests/browser/planner.spec.js
tests/browser/route-details.spec.js
tests/browser/saved-plans.spec.js
tests/browser/search.spec.js
tests/browser/versions.spec.js
tests/data-loader.test.js
tests/datasets.test.js
tests/fixtures/upstream-format7.js
tests/flow-worker.test.js
tests/legacy-flow.test.js
tests/maker-state.test.js
tests/plan-library.test.js
tests/plan-share.test.js
tests/production-engine.test.js
tests/recipe-compare.test.js
tests/recipe-details.test.js
tests/repository-loader.test.js
tests/repository-versions.test.js
tools/audit-data.js
tools/check-site.js
tools/package-flow.py
tools/smoke-flow.js
topstrip.js
vendor/gtnh-flow-browser.manifest.json
vendor/gtnh-flow-browser.zip
vendor/gtnh-flow-browser/src/graph/_postProcessing.py
vendor/gtnh-flow-browser/src/graph/_rounding.py
vendor/gtnh-flow-browser/tests/graph/test_rounding.py
version-compare-ui.js
version-compare.css
```
