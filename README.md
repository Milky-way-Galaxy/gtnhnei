# GTNH Workbench

A mobile-friendly GregTech: New Horizons recipe workbench.

Live site:

https://milky-way-galaxy.github.io/gtnhnei/

GTNH Workbench is built for quick recipe lookup, usage lookup, route planning, material calculation, favorites, and gtnh-flow export/diagram work.

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
