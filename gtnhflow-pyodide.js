/* === GTNH Workbench real gtnh-flow browser integration v1 === */
(() => {
  "use strict";

  if (window.__GTNH_REAL_PYODIDE_FLOW_V1__) return;
  window.__GTNH_REAL_PYODIDE_FLOW_V1__ = true;

  const VIZ_URL = "https://cdn.jsdelivr.net/npm/@viz-js/viz@3.27.0/+esm";

  let worker = null;
  let vizPromise = null;
  let lastYaml = "";
  let lastDot = "";
  let lastSvg = "";

  function root() {
    return (
      document.getElementById("gtnhCalcOverlay") ||
      document.querySelector(".gtnhCalcOverlay") ||
      document.body
    );
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function fileSafe(s) {
    return String(s || "target")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "target";
  }

  function toast(text) {
    let el = document.getElementById("gtnhSmallHint") || document.getElementById("gtnhCalcToast");

    if (!el) {
      el = document.createElement("div");
      el.id = "gtnhSmallHint";
      el.className = "gtnhSmallHint";
      document.body.appendChild(el);
    }

    el.textContent = text;
    el.classList.add("show");

    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function getState() {
    try {
      return window.GTNH_CALC?.getState?.() || {};
    } catch {
      return {};
    }
  }

  function getTarget() {
    const st = getState();

    const candidates = [
      st.target,
      st.targetName,
      st.item,
      document.getElementById("calcTarget")?.value,
      document.querySelector("[name='target']")?.value,
      document.querySelector("input[placeholder*='Target' i]")?.value,
      document.querySelector("input[placeholder*='item' i]")?.value,
      document.querySelector("input[placeholder*='fluid' i]")?.value
    ];

    for (const x of candidates) {
      const s = String(x || "").trim();
      if (s) return s;
    }

    return "epichlorohydrin";
  }

  function getRouteIndex(target) {
    const st = getState();
    const key = String(target || "").toLowerCase();

    const n = Number(
      st.lockedRoutes?.[key] ??
      st.lockedRoutes?.[String(target || "")] ??
      st.routeIndex ??
      0
    );

    return Number.isFinite(n) ? n : 0;
  }

  function findYamlFromUI() {
    const r = root();

    const fields = [
      ...r.querySelectorAll("textarea"),
      ...r.querySelectorAll("pre")
    ];

    for (const el of fields) {
      const txt = "value" in el ? el.value : el.textContent;
      if (/-\s*m:\s*/i.test(txt || "")) return txt;
    }

    return "";
  }

  function makeYamlForCurrentTarget() {
    const target = getTarget();

    try {
      const api = window.GTNHNEI_FLOW_EXPORT_API;

      if (api?.yamlForRecipe) {
        const st = getState();
        const result = api.yamlForRecipe(target, getRouteIndex(target), {
          targetAmount: st.targetAmount || st.amount || 1
        });

        if (result?.yaml) return result.yaml;
      }
    } catch (err) {
      console.warn("[real gtnh-flow] YAML API failed:", err);
    }

    const fromUi = findYamlFromUI();
    if (fromUi) return fromUi;

    return `# No YAML found.
# Build tree first, then open Code / Export -> gtnh-flow.
`;
  }

  function ensureWorker() {
    if (worker) return worker;

    worker = new Worker("gtnhflow-pyodide-worker.js?v=" + Date.now());

    worker.addEventListener("message", async (event) => {
      const msg = event.data || {};

      if (msg.type === "status") {
        setStatus(msg.text || "Working...");
        return;
      }

      if (msg.type === "error") {
        setStatus("real gtnh-flow failed.", true);
        setViewer(`<pre class="realPyFlowError">${esc(msg.text || "unknown error")}</pre>`);
        toast("real gtnh-flow failed.");
        return;
      }

      if (msg.type === "dot") {
        lastDot = msg.dot || "";

        setStatus("Rendering Graphviz SVG with Viz.js...");

        try {
          const viz = await getViz();
          const svgEl = viz.renderSVGElement(lastDot);

          svgEl.classList.add("realPyFlowSvg");

          lastSvg = new XMLSerializer().serializeToString(svgEl);

          const viewer = document.getElementById("realPyFlowViewer");
          if (viewer) {
            viewer.innerHTML = "";
            viewer.appendChild(svgEl);
          }

          setStatus("Rendered real gtnh-flow DOT -> SVG.");
          toast("real gtnh-flow rendered.");
        } catch (err) {
          setStatus("Viz.js render failed.", true);
          setViewer(`<pre class="realPyFlowError">${esc(String(err?.stack || err))}</pre>`);
        }
      }
    });

    return worker;
  }

  async function getViz() {
    if (!vizPromise) {
      vizPromise = import(VIZ_URL).then(mod => mod.instance());
    }

    return vizPromise;
  }

  function setStatus(text, warn = false) {
    const el = document.getElementById("realPyFlowStatus");
    if (!el) return;

    el.textContent = text;
    el.classList.toggle("warn", !!warn);
  }

  function setViewer(html) {
    const el = document.getElementById("realPyFlowViewer");
    if (el) el.innerHTML = html;
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");

    a.href = URL.createObjectURL(blob);
    a.download = filename;

    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  function findPanelParent() {
    const r = root();

    const candidates = [...r.querySelectorAll("div, section, article")]
      .filter(el => {
        const t = el.innerText || "";
        return (
          /Browser preview\. Export YAML\/SVG from here/i.test(t) ||
          /gtnh-flow:\s*/i.test(t) ||
          /Copy YAML[\s\S]*Download SVG/i.test(t) ||
          /Live Graphviz SVG generated/i.test(t)
        );
      })
      .sort((a, b) => (a.innerText || "").length - (b.innerText || "").length);

    if (candidates[0]?.parentElement) return candidates[0].parentElement;

    const area = r.querySelector("textarea") || r.querySelector("pre");
    if (area?.parentElement) return area.parentElement;

    return r;
  }

  function hideOldFlowStuff() {
    const r = root();

    [...r.querySelectorAll("div, section, article, textarea, pre")].forEach(el => {
      const t = "value" in el ? el.value : el.innerText || el.textContent || "";

      if (
        /Browser preview\. Export YAML\/SVG from here/i.test(t) ||
        /Live Graphviz SVG generated/i.test(t) ||
        /gtnh-flow:\s*/i.test(t) ||
        /-\s*m:\s*/i.test(t)
      ) {
        if (el.id !== "realPyFlowPanel" && !el.closest("#realPyFlowPanel")) {
          el.style.display = "none";
        }
      }
    });
  }

  function ensurePanel() {
    let panel = document.getElementById("realPyFlowPanel");
    if (panel) return panel;

    const parent = findPanelParent();

    panel = document.createElement("div");
    panel.id = "realPyFlowPanel";
    panel.className = "realPyFlowPanel";

    parent.appendChild(panel);

    return panel;
  }

  function showPanel() {
    hideOldFlowStuff();

    const panel = ensurePanel();
    panel.style.display = "block";

    panel.innerHTML = `
      <div class="realPyFlowBox">
        <div class="realPyFlowHead">
          <div>
            <h3>gtnh-flow</h3>
            <p>Actual OrderedSet86/gtnh-flow Python running in-browser through Pyodide, then Graphviz SVG rendered by Viz.js.</p>
          </div>
          <span class="realPyFlowBadge">real</span>
        </div>

        <div class="realPyFlowActions">
          <button type="button" id="realPyFlowRun">Run real gtnh-flow</button>
          <button type="button" id="realPyFlowCopyYaml">Copy YAML</button>
          <button type="button" id="realPyFlowCopyDot">Copy DOT</button>
          <button type="button" id="realPyFlowDownloadSvg">Download SVG</button>
          <button type="button" id="realPyFlowDownloadYaml">Download YAML</button>
        </div>

        <div id="realPyFlowStatus" class="realPyFlowStatus">
          Ready. Press “Run real gtnh-flow”.
        </div>

        <div id="realPyFlowViewer" class="realPyFlowViewer">
          <div class="realPyFlowPlaceholder">
            This will load Python + real gtnh-flow. First run can take a while on mobile.
          </div>
        </div>

        <details class="realPyFlowDetails">
          <summary>YAML sent to gtnh-flow</summary>
          <pre id="realPyFlowYamlPre"></pre>
        </details>
      </div>
    `;

    panel.querySelector("#realPyFlowRun").addEventListener("click", runRealFlow);

    panel.querySelector("#realPyFlowCopyYaml").addEventListener("click", async () => {
      if (!lastYaml) lastYaml = makeYamlForCurrentTarget();
      await navigator.clipboard.writeText(lastYaml);
      toast("Copied YAML.");
    });

    panel.querySelector("#realPyFlowCopyDot").addEventListener("click", async () => {
      await navigator.clipboard.writeText(lastDot || "");
      toast(lastDot ? "Copied DOT." : "No DOT yet.");
    });

    panel.querySelector("#realPyFlowDownloadSvg").addEventListener("click", () => {
      if (!lastSvg) {
        toast("No SVG yet.");
        return;
      }

      downloadText(
        `real_gtnh-flow_${fileSafe(getTarget())}.svg`,
        lastSvg,
        "image/svg+xml;charset=utf-8"
      );
    });

    panel.querySelector("#realPyFlowDownloadYaml").addEventListener("click", () => {
      if (!lastYaml) lastYaml = makeYamlForCurrentTarget();

      downloadText(
        `real_gtnh-flow_${fileSafe(getTarget())}.yaml`,
        lastYaml,
        "text/yaml;charset=utf-8"
      );
    });

    runRealFlow();
  }

  function runRealFlow() {
    lastYaml = makeYamlForCurrentTarget();
    lastDot = "";
    lastSvg = "";

    const pre = document.getElementById("realPyFlowYamlPre");
    if (pre) pre.textContent = lastYaml;

    setViewer(`<div class="realPyFlowPlaceholder">Running real gtnh-flow...</div>`);
    setStatus("Starting real gtnh-flow Python worker...");

    ensureWorker().postMessage({
      type: "render",
      yaml: lastYaml
    });
  }

  function isGtnhFlowButton(el) {
    const txt = String(el?.textContent || "").trim().toLowerCase();
    const href = String(el?.getAttribute?.("href") || "").toLowerCase();

    return txt === "gtnh-flow" || txt === "flow" || href.includes("flow.html");
  }

  function renameFlow() {
    [...document.querySelectorAll("button, a")].forEach(el => {
      if (String(el.textContent || "").trim() === "Flow") {
        el.textContent = "gtnh-flow";
      }
    });
  }

  window.addEventListener("click", event => {
    const btn = event.target?.closest?.("button, a");
    if (!btn) return;

    if (!isGtnhFlowButton(btn)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    renameFlow();
    setTimeout(showPanel, 0);
  }, true);

  const mo = new MutationObserver(() => {
    clearTimeout(window.__realPyFlowRenameTimer);
    window.__realPyFlowRenameTimer = setTimeout(renameFlow, 80);
  });

  function start() {
    renameFlow();
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.GTNH_REAL_PYODIDE_FLOW = {
    showPanel,
    runRealFlow
  };
})();
