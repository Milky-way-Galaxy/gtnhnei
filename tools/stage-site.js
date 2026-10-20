import { readFile, mkdir, rm, copyFile, readdir, lstat, writeFile } from "node:fs/promises";
import { resolve, dirname, posix } from "node:path";
import { pathToFileURL } from "node:url";
import { SHELL_FILES, BUILD_ID } from "../offline-manifest.js";
const root = resolve(import.meta.dirname, "..");
export async function stageSite() {
  const target = resolve(root, "_site"), files = new Set([...SHELL_FILES, "service-worker.js", "offline-manifest.js", "robots.txt", "sitemap.xml", "sitemap_index.xml", "sitemap.txt", "feedback-status.json", "README.md"]);
  const manifest = JSON.parse(await readFile(resolve(root, "data/manifest.json"), "utf8"));
  for (const dataset of manifest.datasets.filter(dataset => dataset.available)) { files.add(dataset.dataUrl); files.add(dataset.atlasUrl); }
  const directories = new Set(["licenses", "docs", ...manifest.datasets.filter(dataset => dataset.available).map(dataset => dirname(dataset.dataUrl))]);
  for (const dir of directories) for (const file of await readdir(resolve(root, dir))) if (/\.(txt|md)$/.test(file)) files.add(`${dir}/${file}`);
  await rm(target, { recursive: true, force: true }); await mkdir(target, { recursive: true });
  let bytes = 0;
  for (const file of files) {
    const source = resolve(root, file), output = resolve(target, file), stat = await lstat(source);
    if (!source.startsWith(root + "/") || !output.startsWith(target + "/") || !stat.isFile() || stat.isSymbolicLink()) throw new Error(`Invalid public asset: ${file}`);
    await mkdir(dirname(output), { recursive: true });
    // The manifest is cache-key data, not executable imports. Its shell paths
    // stay canonical; the worker normalizes incoming versioned asset requests.
    if (file.endsWith(".js") && file !== "offline-manifest.js" || file === "index.html") {
      let content = await readFile(source, "utf8");
      const versioned = value => {
        const path = value.split("?")[0];
        if (/^(?:[a-z]+:|\/|#)/i.test(path) || !/\.(?:js|css|zip)$/.test(path)) return value;
        const relative = posix.normalize(posix.join(posix.dirname(file), path));
        return files.has(relative) ? `${path}?v=${BUILD_ID}` : value;
      };
      if (file === "index.html") {
        content = content.replace(/((?:src|href)=")([^"#]+)(")/g, (all, before, value, after) => before + versioned(value) + after)
          .replace('name="atlas-build" content="development"', `name="atlas-build" content="${BUILD_ID}"`);
      } else {
        // All local module imports and worker/package URLs share one revision.
        // Remote runtimes and runtime-selected dataset URLs retain their own
        // provenance and integrity checks.
        content = content.replace(/(["'])([^"'\s]+)\1/g, (all, quote, value) => quote + versioned(value) + quote);
      }
      await writeFile(output, content);
    } else await copyFile(source, output);
    bytes += stat.size;
  }
  await writeFile(resolve(target, ".nojekyll"), "");
  console.log(`Staged ${files.size} public assets (${(bytes / 1000000).toFixed(1)} MB). Tests, dependencies and workspace files excluded.`);
  return { target, files: [...files], bytes };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await stageSite();
