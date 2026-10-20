# Working on GTNH Atlas

Atlas is a static browser application published at a GitHub Pages repository
subpath. Preserve relative asset URLs, recipe lookup, saved settings, touch
interactions, exact case-sensitive IDs, and the public JavaScript integration
APIs used by the calculator and flow tools. Avoid framework rewrites.

## Data and calculations

- Each available dataset must have independent verified upstream provenance,
  correct binary format, a matching icon atlas, and manifest checksums. Never
  relabel or mix pack versions. Unverified versions remain unavailable.
- Recipe data and numeric results come from the repository/catalog, never HTML.
  Distinguish expected chance outputs, boundary supplies, reusable startup
  materials, unknown values, and conditional machine capacity.
- Named machine models must cite and test their GT5 source reference. Do not
  infer specialized multiblock bonuses, sub-tick behavior, or missing timing.
- Keep old plan formats readable. New numeric semantics require a format that
  older clients reject; optional presentation/checklist data may be ignored.
- Cache data is disposable and must be verified before parsing. Clearing it must
  never remove user plans, favorites, inventory or route preferences.

## Architecture and verification

- `app.js` owns recipe navigation and the repository startup. `topstrip.js` owns
  the toolbar. `planner-ui.js` uses the pure production engine. Keep new numeric
  helpers independent of browser UI where practical.
- After changing runtime HTML/JS/CSS, run `npm run offline:manifest` and commit
  `offline-manifest.js`. Its content-derived ID keeps offline app builds coherent.
- `npm run verify` runs lint, static/package checks, Node tests and desktop/mobile
  browser tests. Browser tests serve the exact staged Pages artifact at
  `/gtnhnei/`. Locally, system Chromium can be selected with
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`.
- `npm run audit:data` checks both real recipe databases. `npm run check:machines`
  compares the models to original pinned GT5 Java source. `npm run smoke:flow`
  checks the external flow runtime when that integration changes.
- `npm run stage` packages only public runtime assets, verified data, notices and
  documentation into `_site/`. Do not publish node_modules, test fixtures,
  workspace backups, private conversation exports, or credentials.

## Delivery

Use a development branch, coherent commits and a pull request. Follow the user's
current publishing authorization; never infer permission to merge/deploy merely
from a successful test run. Report actual test results and material limitations.
Keep private chat context outside the public repository.
