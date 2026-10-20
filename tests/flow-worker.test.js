import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync(new URL("../gtnhflow-pyodide-worker.js", import.meta.url), "utf8");
function worker(failFirst = false) {
  const messages = [], globals = new Map();
  let boots = 0, active = 0, maximum = 0;
  const runtime = { loadPackage: async () => {}, unpackArchive: () => {}, globals: { set: (key,value) => globals.set(key,value) },
    runPythonAsync: async code => {
      if (code.trim().startsWith("run_gtnh_flow_yaml(")) {
        maximum = Math.max(maximum, ++active);
        const yaml = globals.get("BROWSER_YAML_TEXT");
        await new Promise(resolve => setTimeout(resolve, 5));
        active--; return `digraph { "${yaml}" }`;
      }
    }
  };
  const self = { postMessage: value => messages.push(value), loadPyodide: async () => {
    if (++boots === 1 && failFirst) throw new Error("network unavailable");
    return runtime;
  } };
  const context = vm.createContext({ self, importScripts: () => {}, fetch: async url => {
    assert.equal(url, "vendor/gtnh-flow-browser.zip?v=20261020");
    return new Response(new Uint8Array([1,2,3]));
  } });
  vm.runInContext(source, context);
  return { messages, run: id => self.onmessage({ data: { type: "render", id, yaml: `request-${id}` } }),
    done: () => vm.runInContext("renderQueue",context), boots: () => boots, maximum: () => maximum };
}
test("Python worker serializes renders and preserves request IDs and YAML isolation", async () => {
  const target = worker(); target.run(1); target.run(2); await target.done();
  assert.equal(target.maximum(),1);
  assert.deepEqual(target.messages.filter(message=>message.type === "dot").map(message=>({id:message.id,dot:message.dot})), [
    {id:1,dot:'digraph { "request-1" }'}, {id:2,dot:'digraph { "request-2" }'}]);
  assert.equal(target.boots(),1);
});
test("a failed Python runtime initialization can be retried", async () => {
  const target = worker(true); target.run(1); await target.done(); target.run(2); await target.done();
  assert.equal(target.boots(),2);
  assert.equal(target.messages.filter(message=>message.type === "error").length,1);
  assert.equal(target.messages.find(message=>message.type === "dot").id,2);
});
