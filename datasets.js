export const DATASET_STORAGE_KEY = "gtnh_atlas_dataset_v1";
export function validateManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.datasets) || !manifest.datasets.length) throw new Error("Unsupported recipe dataset manifest.");
  const ids = new Set();
  for (const dataset of manifest.datasets) {
    if (!/^[a-z0-9][a-z0-9.-]+$/.test(dataset.id) || ids.has(dataset.id)) throw new Error("Duplicate or invalid dataset ID.");
    ids.add(dataset.id);
    if (dataset.available && (dataset.format !== 5 || !/^[a-f0-9]{64}$/.test(dataset.sha256 || "") || !/^[a-f0-9]{64}$/.test(dataset.uncompressedSha256 || "") ||
      !dataset.packVersion || !/^[a-f0-9]{40}$/.test(dataset.sourceRevision || "") || !dataset.source || !dataset.dataUrl || !dataset.atlasUrl)) throw new Error(`Dataset ${dataset.id} lacks verified provenance, supported format, or checksums.`);
    if (dataset.available && [dataset.dataUrl, dataset.atlasUrl].some(path => /^(?:\/|[a-z]+:)|\.\./i.test(path))) throw new Error("Datasets must use local relative asset paths.");
  }
  if (!manifest.datasets.some(dataset => dataset.id === manifest.default && dataset.available)) throw new Error("The default recipe dataset is unavailable.");
  return manifest;
}
export function selectDataset(manifest, selection) {
  const dataset = manifest.datasets.find(entry => entry.id === (selection || manifest.default));
  if (!dataset) throw new Error("Unknown recipe dataset. Use the bundled dataset to recover.");
  if (!dataset.available) throw new Error(`${dataset.label} is unavailable: ${dataset.reason}`);
  return dataset;
}
export async function loadDatasetSelection() {
  const response = await fetch("data/manifest.json");
  if (!response.ok) throw new Error(`Recipe dataset manifest could not load (HTTP ${response.status}).`);
  const manifest = validateManifest(await response.json());
  let stored; try { stored = localStorage.getItem(DATASET_STORAGE_KEY); } catch { /* Session-only selection remains possible. */ }
  const selected = new URLSearchParams(location.search).get("dataset") || stored;
  const dataset = selectDataset(manifest, selected);
  window.GTNH_DATASETS = { manifest, active: dataset,
    select(id) {
      selectDataset(manifest, id);
      try { localStorage.setItem(DATASET_STORAGE_KEY, id); } catch { /* URL preserves selection. */ }
      const url = new URL(location.href); url.searchParams.set("dataset", id); location.assign(url);
    }
  };
  document.documentElement.style.setProperty("--atlas-image", `url("${dataset.atlasUrl}")`);
  window.dispatchEvent(new Event("gtnh-dataset-selected"));
  return dataset;
}
export async function verifyDatasetBuffer(buffer, dataset) {
  const format = new DataView(buffer).getInt32(0, true);
  if (format !== dataset.format) throw new Error(`Unsupported data version: ${format} (Required: ${dataset.format}).`);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
  if (hash !== dataset.uncompressedSha256) throw new Error("Recipe database checksum does not match the selected version. Retry loading or restore the correct dataset files.");
}
