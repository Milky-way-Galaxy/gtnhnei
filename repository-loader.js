import { Repository } from "./dist/repository.js";

export const yieldToBrowser = () => globalThis.scheduler?.yield ? scheduler.yield() : new Promise(resolve => setTimeout(resolve, 0));
// Keep the existing binary parser and object prototypes. Only schedule its ID
// index construction in chunks, publishing Repository.current after completion.
class ResponsiveRepository extends Repository {
  FillObjectPositionMap(elements) { (this.pendingMaps ||= []).push(elements); }
  FillRecipesRemap(remap) { this.pendingRemap = remap; }
}
export async function loadRepository(buffer, { onProgress = () => {}, yieldControl = yieldToBrowser, signal, publish = true } = {}) {
  const repository = new ResponsiveRepository(buffer);
  const total = repository.pendingMaps.reduce((sum, rows) => sum + rows.length, 0) + repository.pendingRemap.length;
  let completed = 0;
  for (const rows of repository.pendingMaps) {
    for (let offset = 0; offset < rows.length; offset += 4000) {
      signal?.throwIfAborted();
      Repository.prototype.FillObjectPositionMap.call(repository, rows.subarray(offset, offset + 4000));
      completed += Math.min(4000, rows.length - offset);
      onProgress({ completed, total });
      await yieldControl();
    }
  }
  const remap = repository.pendingRemap;
  for (let offset = 0; offset < remap.length; offset += 4000) {
    signal?.throwIfAborted();
    Repository.prototype.FillRecipesRemap.call(repository, remap.subarray(offset, offset + 4000));
    completed += Math.min(4000, remap.length - offset); onProgress({ completed, total }); await yieldControl();
  }
  delete repository.pendingMaps; delete repository.pendingRemap;
  signal?.throwIfAborted();
  if (publish) Repository.current = repository;
  return repository;
}
