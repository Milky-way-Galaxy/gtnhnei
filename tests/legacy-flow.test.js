import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../flowfix.js", import.meta.url), "utf8");
function install(exported) {
  let received;
  const good = { id: "f:test:fluid" };
  const window = { addEventListener() {}, GTNH_CALC: { getState: () => ({ target: good.id }), getPlan: () => ({ root: { recipeId: "r:second" } }) },
    GTNH_CATALOG: { resolve: () => good, recipes: () => [{ id: "r:first" }, { id: "r:second" }] },
    GTNHNEI_FLOW_EXPORT_API: { ready: true, yamlForRecipe: (...args) => { received = args; return exported; } } };
  runInNewContext(source, { window, document: { addEventListener() {} }, setInterval() {} });
  return { build: () => window.GTNH_FLOW_REAL.buildRealYaml(), received: () => received };
}
test("legacy flow preview preserves selected recipe identity and real subsecond timing", () => {
  const yaml = '- m: "test"\n  I: {}\n  O: {"fluid": 1}\n  eut: 30\n  dur: 0.05\n';
  const flow = install({ ok: true, yaml, machine: "test", tier: "LV", dur: 0.05, eut: 30, input: {}, output: { fluid: 1 } });
  const result = flow.build();
  assert.equal(result.ok, true);
  assert.equal(result.dur, 0.05);
  assert.equal(result.yaml, yaml);
  assert.equal(flow.received()[1], 1);
  assert.equal(flow.received()[2].forceRoute, true);
});
test("legacy flow preview propagates unknown recipes without inventing an executable entry", () => {
  const flow = install({ ok: false, error: "Timing unavailable", yaml: "# Timing unknown.\n" });
  const result = flow.build();
  assert.equal(result.ok, false);
  assert.match(result.error, /Timing/);
  assert.equal(result.yaml, "# Timing unknown.\n");
  assert.equal(result.dur, undefined);
  assert.equal(result.eut, undefined);
});
test("legacy flow rejects malformed timing/power instead of guessing from displayed text", () => {
  for (const patch of [{ dur: 0 }, { dur: NaN }, { eut: "" }, { eut: null }]) {
    const result = install({ ok: true, yaml: "- m: invented\n", dur: 1, eut: 30, ...patch }).build();
    assert.equal(result.ok, false);
    assert.ok(!result.yaml.includes("- m:"));
  }
});
