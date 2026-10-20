import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";

const root = resolve(import.meta.dirname, "..");
const html = await readFile(resolve(root, "index.html"), "utf8");
const files = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
  .map(match => match[1].split("?")[0])
  .filter(path => !/^[a-z]+:/i.test(path));
const checked = new Set();
async function check(path) {
  await access(path);
  if (!path.endsWith(".js") || checked.has(path)) return;
  checked.add(path);
  execFileSync(process.execPath, ["--check", path], { stdio: "pipe" });
  const code = await readFile(path, "utf8");
  for (const [, dependency] of code.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) {
    await check(resolve(dirname(path), dependency.split("?")[0]));
  }
}
for (const file of files) await check(resolve(root, file));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "Static HTML IDs must be unique");
const manifest = JSON.parse(await readFile(resolve(root, "data/manifest.json"), "utf8"));
for (const dataset of manifest.datasets.filter(value=>value.available)) {
  await access(resolve(root, dataset.dataUrl));
  await access(resolve(root, dataset.atlasUrl));
}
console.log(`Static site valid: ${files.length} local assets, ${checked.size} JavaScript modules/scripts. No bundling needed for GitHub Pages.`);
