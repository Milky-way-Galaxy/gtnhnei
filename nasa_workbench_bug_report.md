## Bug report

**Title:** Missing NASA Workbench rocket crafting recipes  
**Area:** Data / recipe  
**Severity:** Medium  
**Source:** Discord user report  

## Description

Some recipes are missing from GTNH Workbench. Reported example: rocket crafting recipes that are made in the NASA Workbench.

Discord report text:

> some recipes arent there like rocket crafting recipes which are done in nasa workbench

## Expected

Rocket crafting recipes made in the NASA Workbench should be searchable and should appear in production/usage results when relevant.

## Actual

The recipes do not appear, or the website cannot show them as proper recipe routes.

## Suspected cause

The current recipe data/parser may not expose or handle NASA Workbench recipe types.

## Needed verification

- Exact missing rocket/item name
- GTNH version
- Whether the recipe exists in NEI but not in GTNH Workbench
- Whether the recipe is missing from `data/data.bin` or only not rendered by the UI
