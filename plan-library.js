import { importPlan, serializePlan } from "./planner-state.js";
const LIMIT = 3000000;
export const libraryKey = (dataset) =>
  `gtnh_atlas_plan_library_v1:${dataset.id}:${dataset.sha256 || "unverified"}`;
const title = (value) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100)
    throw new Error("Use a plan name from 1–100 characters.");
  return value.trim();
};
export class PlanLibrary {
  constructor(storage, dataset) {
    this.storage = storage;
    this.dataset = dataset;
    this.key = libraryKey(dataset);
  }
  read() {
    let text;
    try {
      text = this.storage.getItem(this.key);
    } catch {
      throw new Error(
        "Saved plans storage is unavailable. JSON export still works.",
      );
    }
    if (text === null) return [];
    try {
      if (text.length > LIMIT) throw new Error();
      const data = JSON.parse(text);
      if (
        data.format !== "gtnh-atlas-library" ||
        data.schemaVersion !== 1 ||
        !Array.isArray(data.plans) ||
        data.plans.length > 100
      )
        throw new Error();
      const ids = new Set();
      return data.plans.map((entry) => {
        if (
          !entry ||
          typeof entry.id !== "string" ||
          !/^[a-z0-9-]{1,80}$/i.test(entry.id) ||
          ids.has(entry.id) ||
          !Number.isFinite(Date.parse(entry.updatedAt)) ||
          typeof entry.plan !== "string"
        )
          throw new Error();
        ids.add(entry.id);
        const name = title(entry.name);
        importPlan(entry.plan, this.dataset);
        return {
          id: entry.id,
          name,
          updatedAt: entry.updatedAt,
          plan: entry.plan,
        };
      });
    } catch {
      throw new Error(
        "Saved plan library is invalid or incompatible. Existing stored data was retained; export a JSON plan while resolving it.",
      );
    }
  }
  write(plans) {
    if (plans.length > 100)
      throw new Error(
        "The library holds up to 100 plans for this dataset. Export or delete an older plan first.",
      );
    const text = JSON.stringify({
      format: "gtnh-atlas-library",
      schemaVersion: 1,
      plans,
    });
    if (text.length > LIMIT)
      throw new Error(
        "Saved plans exceed the 3 MB library limit. Export or delete an older plan first.",
      );
    try {
      this.storage.setItem(this.key, text);
    } catch {
      throw new Error(
        "Could not save the library. Storage may be full or blocked; existing plans were retained. Export JSON to preserve this plan.",
      );
    }
  }
  save(name, state, id = null) {
    const plans = this.read(),
      existing = id ? plans.findIndex((entry) => entry.id === id) : -1;
    if (id && existing < 0)
      throw new Error("The selected saved plan no longer exists.");
    const entry = {
      id: id || crypto.randomUUID(),
      name: title(name),
      updatedAt: new Date().toISOString(),
      plan: serializePlan(state, this.dataset),
    };
    if (existing >= 0) plans[existing] = entry;
    else plans.push(entry);
    this.write(plans);
    return entry;
  }
  load(id) {
    const entry = this.read().find((entry) => entry.id === id);
    if (!entry) throw new Error("Select a saved plan first.");
    return importPlan(entry.plan, this.dataset);
  }
  remove(id) {
    const plans = this.read(),
      entry = plans.find((value) => value.id === id);
    if (!entry) throw new Error("Select a saved plan first.");
    this.write(plans.filter((value) => value.id !== id));
    return entry;
  }
  restore(entry) {
    const plans = this.read();
    if (plans.some((value) => value.id === entry.id))
      throw new Error("That saved plan already exists.");
    importPlan(entry.plan, this.dataset);
    this.write([...plans, entry]);
  }
}
