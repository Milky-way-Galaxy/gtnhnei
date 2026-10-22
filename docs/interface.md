# Atlas interface

Atlas uses compact neutral surfaces so recipe icons, material quantities and
warnings remain the main information. The same controls are used on desktop and
mobile; large crafting recipes and diagrams scroll within their own regions.

## Toolbar

- **GTNH version** opens a dropdown next to the button. The checked row is the
  current dataset. Long lists scroll inside the dropdown, including on short
  screens. Unverified/unavailable exports remain disabled with an explanation.
  The dataset source is available at the end of the list.
- **Calculator** opens the current version's production plan.
- **Library** contains favorites and recent items, with JSON backup tools.
- **More** (⋯) contains Theme, Offline, Help & shortcuts, Feedback, and About Atlas.
  The button also indicates an available offline app update.

Menus support Up/Down, Home/End, Enter, Escape, Tab and outside-click dismissal.
Escape returns focus to the button that opened the menu. A native popover keeps
menus outside the app's clipped scroll surfaces; a fixed-position fallback
supports browsers without popovers.

About Atlas reopens the introduction and focuses its labelled Close button.
Closing remembers the existing `gtnh_atlas_intro_hidden_v1` preference. It does
not add another toolbar row. Feedback uses a native modal dialog with labelled
fields and restores focus when dismissed.

## Themes

More → Theme switches immediately between Graphite (the default neutral palette),
Atlas Classic (the previous navy/teal colors), and NEI Classic (game-style gray
recipe panels and beveled input/output slots). Each theme keeps the compact
navigation and current controls. The choice is saved for this device across pack
versions and offline reloads. If browser storage is unavailable, the dialog says
that the selection lasts for this tab.

NEI Classic is inspired by the game's inventory UI, rather than a complete
replica of every GTNH machine GUI. It uses the same verified item/fluid quantities,
probabilities, slot positions and icon atlas as the other themes. Large crafting
grids scroll locally, including 9×9 recipes. The palette is applied by a small
local script before styles paint; it does not wait for the recipe database.

## Recipe browsing

The item's name has its own heading. Recipes / Uses switches the view, Plan
opens the calculator, and the star toggles the exact item's favorite. Item
permalinks and version comparison are under More recipe actions. Machine choices
stay in their own scrolling row. Recipe filters apply to base batch values;
metadata and machine-specific conditions still need checking.

The grid's count and load controls share one row. Search filters indicate how
many are active; Reset is available without opening the panel. Existing saved
filters and rendering limits retain their meaning.

## Calculator

Basic and Factory share a header row and the same saved draft. Settings, Results
and Export remain one row. Calculate updates results, and Checklist opens
operating supplies and preparation tools. Switching modes preserves stock,
routes, machine profiles and extra outputs; Basic shows a Review action when
factory settings still affect results.

Results start with the product, quantity, version, energy and processing time.
Materials precede detailed diagnostics and machine controls. Unknown values,
recipe conditions, insufficient capacity and unresolved dependencies retain
warnings. Calculation assumptions are expandable. Empty startup/byproduct
sections and zero-warning panels are omitted. Both modes retain dependency
search, diagrams and portable exports.

Changing views, filtering materials, or opening menus does not change recipe
quantities or numeric assumptions. New plans and imports open at the top of the
results; following a diagnostic still jumps to its dependency.

Recipe data, saved-plan formats and GT5 machine formulas are independent of this
presentation. Available datasets are still the verified 2.8.0 and 2.9.0 exports;
2.8.4 remains unavailable pending a verified matching export.
