import { Item, Fluid, OreDict, Recipe, RecipeIoType } from "./dist/repository.js";

export const compactName = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const tierName = voltage => ["ULV", "LV", "MV", "HV", "EV", "IV", "LuV", "ZPM", "UV", "UHV", "UEV", "UIV", "UMV", "UXV", "MAX"]
  [Math.min(14, Math.max(0, Math.ceil(Math.log(Math.max(8, voltage) / 8) / Math.log(4))))];

// A calculation never obtains numbers from HTML, translated names, or YAML.
export class RecipeCatalog {
  constructor(repository, dataset = { id: "legacy", label: "Bundled data (version unverified)" }, { deferIndexes = false } = {}) {
    this.repository = repository;
    this.dataset = dataset;
    this.goods = [...repository.items].map(ptr => repository.GetObject(ptr, Item))
      .concat([...repository.fluids].map(ptr => repository.GetObject(ptr, Fluid)));
    this.byName = new Map();
    this.byCompact = new Map();
    this.recipeCache = new Map();
    if (!deferIndexes) for (const good of this.goods) this.indexGood(good);
  }
  indexGood(good) {
      const name = (good.name || good.id).toLowerCase();
      const matches = this.byName.get(name) || [];
      matches.push(good);
      this.byName.set(name, matches);
      if (!this.byCompact.has(compactName(name))) this.byCompact.set(compactName(name), good);
  }
  static async build(repository, dataset, yieldControl) {
    const catalog = new RecipeCatalog(repository, dataset, { deferIndexes: true });
    for (let offset = 0; offset < catalog.goods.length; offset += 2000) {
      for (const good of catalog.goods.slice(offset, offset + 2000)) catalog.indexGood(good);
      await yieldControl();
    }
    return catalog;
  }
  describe(good) {
    return { id: good.id, name: good.name || good.id, type: good instanceof Fluid ? "fluid" : good instanceof OreDict ? "ore" : "item",
      unit: good instanceof Fluid ? "L" : "items", iconId: good.iconId ?? null, mod: good.mod ?? "",
      alternatives: good instanceof OreDict ? good.items.map(item => ({ id: item.id, name: item.name })) : undefined };
  }
  matches(query) { return this.byName.get(String(query).trim().toLowerCase()) || []; }
  resolve(query) {
    const raw = String(query || "").trim();
    const byId = this.repository.GetById(raw);
    if (byId && !(byId instanceof Recipe)) return byId;
    const matches = this.matches(raw);
    return matches.length === 1 ? matches[0] : null;
  }
  findCompatible(query) {
    return this.resolve(query) || this.matches(query)[0] || this.byCompact.get(compactName(query)) ||
      this.goods.find(good => (good.name || "").toLowerCase().includes(String(query).toLowerCase()));
  }
  recipes(good, mode = "production") {
    return [...(good[mode] || [])].map(ptr => this.recipe(this.repository.GetObject(ptr, Recipe)));
  }
  recipe(raw) {
    if (this.recipeCache.has(raw.id)) return this.recipeCache.get(raw.id);
    const inputs = [], outputs = [];
    for (const io of raw.items) {
      const entry = { ...this.describe(io.goods), amount: io.amount, probability: io.probability, slot: io.slot };
      ([RecipeIoType.ItemOutput, RecipeIoType.FluidOutput].includes(io.type) ? outputs : inputs).push(entry);
    }
    const gt = raw.gtRecipe;
    const recipe = { id: raw.id, datasetId: this.dataset.id, machine: raw.recipeType.name,
      durationTicks: gt?.durationTicks > 0 ? gt.durationTicks : null,
      voltage: gt ? gt.voltage : null, amperage: gt ? gt.amperage : null,
      eut: gt && gt.voltage >= 0 && gt.amperage > 0 ? gt.voltage * gt.amperage : null,
      tier: gt ? tierName(gt.voltage) : null, inputs, outputs,
      crafters: [...raw.recipeType.singleblocks, ...raw.recipeType.multiblocks].filter(Boolean).map(good => ({ id: good.id, name: good.name })),
      metadata: gt ? gt.metadata.map(value => ({ key: value.key, value: value.value })) : [] };
    this.recipeCache.set(raw.id, recipe);
    return recipe;
  }
}
