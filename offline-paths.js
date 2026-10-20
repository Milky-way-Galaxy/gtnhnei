export const ICON_CACHE = "gtnh-atlas-offline-icons-v1";
export const SHELL_PREFIX = "gtnh-atlas-shell-";
export function iconCacheKey(dataset, base) {
  const url = new URL(dataset.atlasUrl, base);
  url.search = `atlas=${dataset.atlasSha256}`; url.hash = "";
  return url.href;
}
