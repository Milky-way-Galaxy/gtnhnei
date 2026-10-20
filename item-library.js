const FORMAT = "gtnh-atlas-item-library";
const MAX_FAVORITES = 500, MAX_RECENT = 100;
export const libraryKey = dataset => `gtnh_atlas_item_library_v1_${dataset.id}`;
export const legacyFavoritesKey = dataset => dataset.id === "gtnh-2.8.0" ? "gtnhnei_favorites_v2" : `gtnhnei_favorites_v2_${dataset.id}`;
const identity = entry => entry.id || `legacy:${entry.name}`;
const unique = entries => [...new Map(entries.map(entry => [identity(entry), entry])).values()];

function validateEntry(entry, recent = false) {
  if (!entry || typeof entry.name !== "string" || !entry.name.trim() || entry.name.length > 2000 ||
    entry.id !== null && (typeof entry.id !== "string" || !/^[if]:/.test(entry.id) || entry.id.length > 3000) ||
    !Number.isFinite(entry.time) || entry.time < 0 || recent && (!entry.id || !["production", "usage"].includes(entry.mode))) {
    throw new Error("Invalid saved item entry.");
  }
  return { id: entry.id, name: entry.name, time: entry.time, ...(recent ? { mode: entry.mode } : {}) };
}
export function validateLibrary(value, dataset, { strictRevision = true } = {}) {
  if (value?.format !== FORMAT || value.schemaVersion !== 1 || value.dataset?.id !== dataset.id ||
    strictRevision && value.dataset?.sha256 !== dataset.sha256) throw new Error("This item library belongs to a different recipe dataset or revision.");
  if (!Array.isArray(value.favorites) || !Array.isArray(value.recent) || value.favorites.length > MAX_FAVORITES || value.recent.length > MAX_RECENT) throw new Error("Item library limits exceeded (500 favorites, 100 recent items).");
  return { format: FORMAT, schemaVersion: 1, dataset: { id: dataset.id, sha256: dataset.sha256 },
    favorites: unique(value.favorites.map(entry => validateEntry(entry))),
    recent: unique(value.recent.map(entry => validateEntry(entry, true))).sort((a, b) => b.time - a.time) };
}

export class ItemLibrary {
  constructor(catalog, storage) { this.catalog = catalog; this.dataset = catalog.dataset; this.storage = storage; }
  empty() { return { format: FORMAT, schemaVersion: 1, dataset: { id: this.dataset.id, sha256: this.dataset.sha256 }, favorites: [], recent: [] }; }
  read() {
    const raw = this.storage.getItem(libraryKey(this.dataset));
    if (raw) {
      try { return validateLibrary(JSON.parse(raw), this.dataset, { strictRevision: false }); }
      catch (error) { throw new Error(`Saved item library could not be read. Export a backup before repairing storage. ${error.message}`); }
    }
    const value = this.empty(), legacy = this.storage.getItem(legacyFavoritesKey(this.dataset));
    if (!legacy) return value;
    let entries;
    try { entries = JSON.parse(legacy); if (!Array.isArray(entries)) throw new Error(); }
    catch { throw new Error("Legacy favorites could not be read. Their original storage has been preserved."); }
    // Only unique exact matches migrate to IDs. Ambiguous or missing names stay
    // visible as legacy entries; we never silently select a fuzzy substitute.
    if (entries.length > MAX_FAVORITES) throw new Error("Legacy favorites exceed the 500-item library limit. Export a backup before editing them.");
    value.favorites = unique(entries.map(entry => {
      const name = String(entry?.name ?? entry ?? "").trim();
      const good = this.catalog.resolve(name);
      return { id: good && /^[if]:/.test(good.id) ? good.id : null, name, time: Number(entry?.addedAt) || 0 };
    }).filter(entry => entry.name));
    return value;
  }
  write(value) {
    const checked = validateLibrary(value, this.dataset);
    this.storage.setItem(libraryKey(this.dataset), JSON.stringify(checked));
    return checked;
  }
  describe(id) {
    const good = this.catalog.resolve(id);
    if (!good || !/^[if]:/.test(good.id)) throw new Error("Choose an exact item or fluid from this dataset.");
    return { id: good.id, name: good.name || good.id, time: Date.now() };
  }
  toggle(id) {
    const entry = this.describe(id), value = this.read(), exists = value.favorites.some(item => item.id === entry.id);
    value.favorites = exists ? value.favorites.filter(item => item.id !== entry.id) : [entry, ...value.favorites];
    this.write(value); return !exists;
  }
  remove(id, name) { const value = this.read(); value.favorites = value.favorites.filter(entry => entry.id !== id || entry.name !== name); return this.write(value); }
  visit(id, mode = "production") {
    const entry = { ...this.describe(id), mode }, value = this.read();
    value.recent = [entry, ...value.recent.filter(item => item.id !== id)].slice(0, MAX_RECENT);
    return this.write(value);
  }
  clearRecent() { const value = this.read(); value.recent = []; return this.write(value); }
  export() { return JSON.stringify(this.read(), null, 2); }
  rawBackup() { return this.storage.getItem(libraryKey(this.dataset)) || this.storage.getItem(legacyFavoritesKey(this.dataset)) || this.export(); }
  import(text) {
    if (typeof text !== "string" || text.length > 2_000_000) throw new Error("Item library file is too large.");
    const incoming = validateLibrary(JSON.parse(text), this.dataset), current = this.read();
    incoming.favorites = unique([...current.favorites, ...incoming.favorites]);
    incoming.recent = unique([...current.recent, ...incoming.recent].sort((a, b) => a.time - b.time)).sort((a, b) => b.time - a.time).slice(0, MAX_RECENT);
    return this.write(incoming);
  }
}
