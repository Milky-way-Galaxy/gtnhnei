# Luna statue Easter egg

Type `lunaloves.` into the main recipe search, or open `?lunaloves=1` at the
Atlas site root. Existing `GTNHNEIExtras.openLunaStatue()` and
`closeLunaStatue()` integrations remain available.

This is a fictional tribute recipe. Its quantities, machine statistics and
assembly are jokes, never recipe data or planner inputs. Assembling the statue
only changes this dialog's presentation; it does not consume resources, change
saved plans or write a discovery preference. Reset assembly restores its initial
presentation. The glow animation respects reduced-motion preferences.

- Tap an ingredient to open real NEI recipes. Double-tap or right-click opens
  uses; hold copies its name. The site's Back button returns to Luna.
- Copy joke recipe includes an explicit fictional-recipe notice.
- Copy secret link preserves the current site path and strips unrelated query
  parameters and fragments before adding `?lunaloves=1`.
- Escape, Close and a backdrop click dismiss the modal. Tab wraps through its
  controls. The browser restores focus to the previously focused control.
- A sticky header keeps Close reachable while scrolling on short screens.

`tests/browser/luna.spec.js` covers discovery, focus, dismissal, reversible
assembly, unchanged local storage, narrow screens, clipboard exports, direct
links and recipe/back navigation on desktop Chromium and Pixel 7 emulation.
