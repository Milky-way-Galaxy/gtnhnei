# GTNH Atlas

A mobile-friendly GregTech: New Horizons recipe workbench.

Live site:

https://milky-way-galaxy.github.io/gtnhnei/

GTNH Atlas is built for quick recipe lookup, usage lookup, route planning, material calculation, favorites, and gtnh-flow export/diagram work.

## Status

This project is still experimental.

Working parts:

- NEI-style item/fluid search
- Recipe and usage pages
- Machine tabs
- Mobile-friendly recipe grids
- Favorites
- Material calculator
- Planner / recipe tree
- YAML export
- SVG export
- gtnh-flow browser panel
- LunaLoves easter egg

Still being improved:

- recursive material calculation accuracy
- route selection UX
- gtnh-flow diagram layout
- mobile UI polish
- recipe edge cases
- cleanup of older helper scripts

## Main sections

### NEI

Search item/fluid names and open recipe or usage views.

Controls:

- Tap / left click: recipe
- Double tap / right click: usage
- Long press: item menu

### Planner

The planner is for choosing a target, route, machine mode, and recursive depth.

It can build a recipe tree and export data for later use.

### Material Calculator

The material calculator estimates required materials from a selected production route.

Current features:

- amount scaling
- route number selection
- recursive depth selection
- reusable-cell filtering
- water/steam filtering
- programmed-circuit filtering
- manual ignored-material picker
- copy table
- copy JSON

The calculator depends on recipe data exposed by the site. Some recipes may need manual checking because GTNH recipes can be cursed as hell.

### Favorites

Favorites are for saving commonly checked items/fluids.

Useful for:

- important intermediates
- power fuels
- circuit parts
- chemistry products
- project targets

### gtnh-flow

The gtnh-flow panel is for generating a diagram and exporting YAML/SVG.

Current goal:

- generate gtnh-flow-compatible YAML
- run gtnh-flow in the browser when available
- export SVG for sharing or saving

The gtnh-flow integration is still experimental, so exported YAML should be checked before relying on it for large factory plans.

## Local development

Run locally:

```bash
cd ~/gtnhnei
python3 -m http.server 5520

## Bug reports, suggestions, and update status

Users can report bugs or suggestions from the **Feedback** button in the website.

The feedback panel can:

- create a formatted bug report
- create a formatted suggestion
- copy the report text
- open a prefilled GitHub issue
- show public update status from `feedback-status.json`

Status labels used by the project:

- `planned` = accepted but not built yet
- `investigating` = being checked
- `fixed` = bug fixed
- `done` = feature/request completed
- `changed` = implemented differently from the original suggestion
- `not doing` = intentionally not planned

To notify users about fixes or changed implementations, edit `feedback-status.json`, change the `version`, and push the update.

## Official feedback status

Bug reports and suggestions may have public discussion on GitHub Issues.

Only maintainer-controlled project updates are official:

- issue labels/status set by the repository maintainer
- commits pushed by the repository maintainer
- `feedback-status.json`
- the website **Status / updates** panel

If another user comments on an issue, that is discussion only.

## Public reports and voting

GTNH Atlas uses public GitHub Issues for bug reports and suggestions.

The website includes a **Reports / votes** tab that can:

- list public bug reports
- list public suggestions
- search report titles, labels, body text, area, and status
- filter open/closed reports
- sort by priority
- sort by most liked
- show GitHub thumbs-up counts
- open the report on GitHub

Voting uses GitHub reactions:

- open a report
- click the `👍` reaction on GitHub
- reports with more `👍` reactions are treated as higher priority

Official answers still come from maintainer labels, commits, and `feedback-status.json`.


## Search name

Public name: **GTNH Atlas**

Search terms supported in title, description, and body text:

- GTNH recipe search
- GTNH material calculator
- GTNH planner
- GTNH NEI-style recipe search
- GregTech New Horizons recipe planner
- gtnh-flow export
