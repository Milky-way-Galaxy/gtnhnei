# Atlas feature status

This tracks delivered features and remaining work. A feature being discussed is
not a promise that it is finished. Commits and pull requests preserve completed
work when a session is interrupted.

## Implemented

- Startup/search fixes, incremental recipe rendering and checked database caching.
- Shared recursive calculator, Basic/Factory modes, inventory and up to 20 outputs.
- Route selection/comparison, full-plan previews, power, machine and material lists.
- Source-checked GT5/EBF profiles, installed machine pools and bottleneck analysis.
- Supported continuous recycling balances with explicitly declared circulating stock.
- NEI picker, exact-ID favorites/history, saved plans, sharing and portable exports.
- Operating supplies, preparation checklist, printing and offline app installation.
- Verified 2.8.0/2.9.0 data and cross-version recipe comparison.
- Compact desktop/mobile interface, scrollable version menu, three themes and Luna.
- Recent-search examples and recent-item picker shortcuts. Empty-field hints rotate
  every second; typing, focus, hidden tabs and reduced motion pause them. More →
  Rotating search examples disables rotation. Searches stay on this browser and
  with their dataset revision. Recent items and favorites supply additional hints;
  a new history uses names resolved from the active recipe data.
- Plain-language calculator help, with the advanced controls and numeric warnings
  retained. A changing example never changes a saved target or calculation.

## Partial or limited

- Recycling: supported selected-recipe continuous balances; no global route
  optimizer or proven startup/batch-buffer schedule.
- Machine models: documented GT5/EBF references; specialized multiblock bonuses,
  laser/subtick behavior and every GTNH machine are not covered.
- Recipe coverage: missing entries remain explicit supplied inputs. Some NASA
  Workbench construction recipes are absent from both installed snapshots.
- Offline: downloaded search/native planning work offline; external flow solving
  and GitHub feedback require a connection.
- Saved work: local browser storage with exports; no cloud synchronization.

## Blocked on verified data

GTNH 2.8.4 needs an authentic matching recipe export and icon atlas. An official
pack release alone does not verify recipe data. See [data provenance](datasets.md).

## Verification still needed

Physical Android/iPhone, Safari, OS keyboard behavior and physical printing.
Browser viewport/touch emulation is not physical-device testing. The inherited
full vendor Python suite also has documented baseline fixture/solver failures;
passing application CI does not claim those are repaired.

The compact-interface milestone and its themes shipped in PR #20. Later cleanup
is tracked in its own PR; publication is confirmed by its public build marker.
