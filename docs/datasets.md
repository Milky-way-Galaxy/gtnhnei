# Dataset provenance and version coverage

`data/manifest.json` is the version registry. Only entries with supported binary
format, matching assets, checksums and upstream provenance may be selected.
Loading verifies SHA-256 of decompressed data and record counts before exposing
recipe APIs. Plans store dataset ID and compressed file checksum. Switching data
reloads the page, so repository instances, cached objects and routes cannot mix.
Planner, maker and material settings are scoped to datasets, preserving the old
keys for the bundled version.

## Verified installed dataset: GTNH 2.8.0

The existing files exactly match the authoritative upstream export:

- Source: https://github.com/ShadowTheAge/gtnh-data/tree/6d35153688de5ae8e02807b942099618de1d9276
- Branch: `2.8.0-v5`; commit message: `Data format v5 includes metadata`.
- `data.bin` Git blob: `b1d2a893b744f94a74b0e481a210c9aa4ae92374`.
- `atlas.webp` Git blob: `375b307c70f1199910170e4eac7c87d25eda8dfd`.
- Both blob IDs match the files already tracked in Atlas. They were not relabeled
  from a guessed version. The former ambiguous `2.8.x` badge is now `2.8.0`.
- Binary format 5; 41,091 items, 1,542 fluids, 190,080 recipes.

## Investigated gaps (2026-10-19)

- **2.8.4:** official pack release exists at
  https://github.com/GTNewHorizons/GT-New-Horizons-Modpack/releases/tag/2.8.4.
  No matching compatible recipe export has been verified. Selection is disabled;
  it never uses 2.8.0 data as a substitute.
- **2.7.4:** the authentic upstream archive at
  https://shadowtheage.github.io/gtnh-2.7.4/ serves binary format 3. It needs a
  separately validated parser adapter and matched atlas before integration.
- **2.9.0:** upstream branch `2.9.0-v7`, commit
  `d200440ea31d0357068a294d7312acf1146de909`, contains format 7 data. Current upstream
  source also uses format 7. A format-5 parser must not consume it.
- Upstream `2.8.0-v6` changes the data format and adds localization files; it is
  not a separate pack release and must not be presented as 2.8.4.

## Authentic extraction

Use the actual requested GTNH installation, including its configs and mod set.
Upstream instructions: https://github.com/ShadowTheAge/gtnh/blob/main/export/README.md.
Build https://github.com/ShadowTheAge/nesql-exporter, follow its required runtime
setup (including the BugTorch compatibility instructions), export in the correct
pack instance, and process `.minecraft/nesql` with the matching C# exporter.
Choose an exporter/parser format together; do not patch a version integer.

Record the exact pack release, mods/config revision, exporter source revision,
source URL, extraction date, data and atlas hashes, binary format and counts.
Add a manifest entry only after parser, real-recipe and browser validation. Future
entries must have their own local asset paths and checksums. Do not overwrite the
bundled files to add a second version.

The upstream data repository has no license and explains the Minecraft/mod asset
copyright provenance. Atlas already includes these exact files. New distributions
must review the upstream notice and retain attribution; no additional third-party
dataset is redistributed by this change.
