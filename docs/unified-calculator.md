# One calculator, guided production plans

The toolbar's **Calculator** opens one workspace with **Basic** and **Factory**
modes. Both use the same calculation engine and the same current draft. Mode
changes retain outputs, routes, stock, profiles and exports. Basic mode shows a
notice when additional factory settings still contribute to the results.

## Choose a product without remembering its name

Choose **item / fluid from NEI** to browse the active version's icons. Search
partial words, use `@mod`, filter items/fluids and mods, or choose Favorites or
Recent. Only 60 results render per page. Arrow keys move between icons and Enter
selects one. Escape returns to the calculator without replacing its target.

Selection fills the exact item/fluid ID, displays its name and icon, and selects
native item units or litres. The same picker fills inventory and additional
factory outputs. Exact duplicate names remain distinct IDs; a missing recipe
does not make an item disappear unless **Has recipes** is selected.

The text field remains available for names and IDs. An exact fluid entered there
automatically replaces incompatible item units with litres. Importing the NEI
search also uses the picker when the text does not identify one exact product.

## Previous drafts and integrations

Existing Planner drafts open with their original settings in Factory mode. A
previous Material Calculator draft is offered separately, or opened in Basic
when no Planner draft exists. Its runs become recipe batches, its explicit
fractional semantics remain fractional, and route indexes map to exact IDs only
inside the original dataset. Missing targets, routes and ignored names are
flagged rather than guessed. Original legacy storage remains available for backup.

Loading the old Calculator draft first backs up the current workspace. **Restore
workspace before import** also works after reload when browser storage is
available. Invalid unfinished quantities must be corrected before that backup.
Storage failure leaves session calculations visible and offers a JSON reminder.

The existing `GTNH_CALC` API remains, with optional `open({mode: "basic"})`,
`open({mode: "factory"})` and `setMode(mode)`. `GTNH_MATCALC` and its legacy dialog
remain available to existing integrations; they no longer have a separate toolbar
entry. Both continue to use the shared production engine.

## Route previews and diagnostics

**Compare production routes → Preview effect on full plan** recalculates the
candidate with the current depth, supplied boundaries, inventory and profiles.
It shows changes in exact required materials and known energy/power. It does not
save the candidate; **Use this route** applies it. Unknown stages and assumptions
remain visible. Comparison cards still rank base-step metrics, not a global optimum.

**Plan checks** identifies route decisions, circular paths, unknown timing/power,
recipe conditions and external/depth supplies. Review buttons focus the relevant
dependency; supplied boundaries remain included in the material ledger.
Missing production entries can download exact versioned coverage details as JSON
without sending anything to GitHub. Gathered resources may legitimately lack
manufacturing recipes; the report records coverage rather than inventing one.

## Guided steady-state balancing

Factory → **Recycling and material balance** offers an opt-in method for continuous
rates with guaranteed selected recipes. It begins at full dependency depth.
Declare external feedstocks and select the routes you intend to use. A guaranteed
co-product from an already selected recipe can provide another internal good.

The engine solves the material equations for unique, finite, nonnegative recipe
execution rates and checks their conservation residual. It supports up to 128
selected recipes and 256 internal goods. It does not optimize route combinations
or choose an arbitrary circulation rate. Singular, inconsistent, negative,
chance-dependent or incomplete selections remain blocked. Their displayed
quantities are explicitly recursive boundary estimates; executable recycling
YAML is withheld. Total jobs retain recursive batch semantics.

Every closed loop needs a positive declaration of actual circulating stock in at
least one participating form before balancing. This is **additional** stock,
separate from per-machine reusable tool/container reserves, and is not multiplied
by operating duration. The engine does **not** prove the declared quantity is
sufficient or schedule startup, transport, machine warmup or batch buffers.

The real regression is a Tetranitromethane Chemical Reactor returning an empty
cell to an Ethenone cell-filling recipe. At 2,000 L/s it consumes 8,000 L/s Nitric
Acid and 1,000 L/s Ethenone, uses 24 base reactors and one canner, and reports
2,880.8 average / 2,881 installed EU/t. Empty cells are circulating stock, not a
recurring manufactured input. Programmed circuits still provision each reactor.

| Dataset | Chemical Reactor recipe | Cell-filling recipe |
| --- | --- | --- |
| 2.8.0 | `r~-5WYqt_OOQOL1KobhH2Etg==` | `r~9HnaZz-0MLGhv9LG6kwENw==` |
| 2.9.0 | `r~1jyMrKp6Mnu8UAcnQIeCKw==` | `r~7StCimUbPLGtBT0vdXAQRw==` |

These are distinct snapshot records. 2.8.0 uses `f:dreamcraft:nitricacid` and calls
the filler Fluid Canner; 2.9.0 uses `f:gregtech:nitricacid` and calls it Canner.

Plans using the new method export as **format 4**. Formats 1–3 remain readable
and keep their recursive numerical behavior; they cannot claim steady-state
semantics. JSON/sharing/named plans preserve mode, routes and circulating stock.
Materials, machine and supply CSVs label balance status. Balanced YAML retains
base recipe values, without applying machine-profile overclocks a second time.
All executable YAML entries disable gtnh-flow's automatic overclocking and machine
bonuses, preserving those base values. Its voltage table starts at LV, so an ULV
recipe explicitly uses LV supply with its original EU/t and duration unchanged;
the export records its native ULV tier in a comment.

## Verification and remaining coverage

Validation uses both real datasets, original pinned Java machine references and
desktop/mobile browser tests against the exact staged Pages artifact. Firefox
print checks separate real screen activation from emulated print-layout checks.
Physical phones, physical printing and Safari are not established by these tests.
Current release results are recorded in [PR #14](https://github.com/Milky-way-Galaxy/gtnhnei/pull/14).
The opt-in real Python/Viz check also covers returned cells using
`ATLAS_SMOKE_SCENARIO=cell-loop ATLAS_SMOKE_DATASET=gtnh-2.8.0 npm run smoke:flow`
(or `gtnh-2.9.0`). It downloads external runtime packages; the default smoke
scenario retains the two-output/byproduct factory regression.

No recipe binaries or icon atlases were changed. GTNH 2.8.4 still lacks a verified
export; NASA Workbench construction remains missing from both installed snapshots.
See [dataset provenance](datasets.md) and [machine calculation limits](machine-models.md).
