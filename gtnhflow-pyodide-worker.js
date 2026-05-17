/* === gtnh-flow in browser worker v1 === */

let pyodideReady = null;

async function initPythonRuntime() {
  if (pyodideReady) return pyodideReady;

  pyodideReady = (async () => {
    self.postMessage({ type: "status", text: "Loading Python runtime..." });

    importScripts("https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.js");

    const loadPythonRuntime = self["load" + "Py" + "odide"];
    const pyodide = await loadPythonRuntime({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/"
    });

    self.postMessage({ type: "status", text: "Loading Python packages..." });

    await pyodide.loadPackage(["micropip", "pyyaml", "sympy"]);

    await pyodide.runPythonAsync(`
import micropip
await micropip.install(["termcolor", "graphviz"])
`);

    self.postMessage({ type: "status", text: "Loading gtnh-flow source..." });

    const zipRes = await fetch("vendor/gtnh-flow-browser.zip?v=" + Date.now());

    if (!zipRes.ok) {
      throw new Error("Cannot fetch vendor/gtnh-flow-browser.zip: HTTP " + zipRes.status);
    }

    const zipBuf = await zipRes.arrayBuffer();

    pyodide.unpackArchive(zipBuf, "zip", {
      extractDir: "/home/pyodide"
    });

    await pyodide.runPythonAsync(`
import os, sys, logging
from pathlib import Path

ROOT = Path("/home/pyodide/gtnh-flow-browser")
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))

# Browser monkey patch:
# gtnh-flow uses the Python graphviz package, which normally calls external dot.
# In browser there is no external dot executable, so we capture Digraph.source.
import graphviz

_LAST_DOT = {"source": ""}

def _browser_render(self, filename=None, directory=None, view=False, cleanup=False,
                    format=None, renderer=None, formatter=None, neato_no_op=None,
                    quiet=False, outfile=None, engine=None, raise_if_result_exists=False,
                    overwrite_source=False):
    _LAST_DOT["source"] = self.source
    return "browser-dot-captured"

graphviz.Digraph.render = _browser_render

from src.data.loadMachines import recipesFromConfig
from src.graph._solver import systemOfEquationsSolverGraphGen
import yaml

class BrowserContext:
    def __init__(self):
        self.default_config_path = "config_factory_graph.yaml"
        self.load_graph_config(self.default_config_path)

        self.log = logging.getLogger("gtnh-flow-browser")
        self.log.handlers.clear()
        self.log.setLevel(logging.INFO)

        handler = logging.StreamHandler()
        handler.setLevel(logging.INFO)
        handler.setFormatter(logging.Formatter("%(levelname)s %(message)s"))
        self.log.addHandler(handler)

        self.graph_gen = systemOfEquationsSolverGraphGen

    def load_graph_config(self, config_path):
        with open(config_path, "r") as f:
            self.graph_config = yaml.safe_load(f)

def run_gtnh_flow_yaml(yaml_text: str) -> str:
    ROOT = Path("/home/pyodide/gtnh-flow-browser")
    os.chdir(ROOT)

    project_dir = ROOT / "projects"
    project_dir.mkdir(exist_ok=True)

    project = project_dir / "_browser_workbench.yaml"
    project.write_text(yaml_text, encoding="utf-8")

    ctx = BrowserContext()

    # Browser-safe config.
    ctx.graph_config["VIEW_ON_COMPLETION"] = False
    ctx.graph_config["OUTPUT_FORMAT"] = "svg"

    # Use normal gtnh-flow loader and solver.
    recipes = recipesFromConfig("_browser_workbench.yaml")
    ctx.graph_gen(ctx, "_browser_workbench", recipes, ctx.graph_config)

    dot = _LAST_DOT.get("source", "")

    if not dot.strip():
        raise RuntimeError("gtnh-flow finished but no DOT was captured.")

    return dot
`);

    self.postMessage({ type: "status", text: "gtnh-flow ready." });

    return pyodide;
  })();

  return pyodideReady;
}

self.onmessage = async (event) => {
  const msg = event.data || {};

  try {
    if (msg.type === "render") {
      const pyodide = await initPythonRuntime();

      self.postMessage({ type: "status", text: "Running gtnh-flow solver..." });

      pyodide.globals.set("BROWSER_YAML_TEXT", msg.yaml || "");

      const dot = await pyodide.runPythonAsync(`
run_gtnh_flow_yaml(BROWSER_YAML_TEXT)
`);

      self.postMessage({
        type: "dot",
        dot
      });
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      text: String(err && err.stack ? err.stack : err)
    });
  }
};
