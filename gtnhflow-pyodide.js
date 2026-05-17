/* === GTNH Atlas gtnh-flow browser integration v1 === */
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
      console.warn("[gtnh-flow] YAML API failed:", err);
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
        setStatus("gtnh-flow failed.", true);
        setViewer(`<pre class="gtnhFlowBrowserError">${esc(msg.text || "unknown error")}</pre>`);
        toast("gtnh-flow failed.");
        return;
      }

      if (msg.type === "dot") {
        lastDot = msg.dot || "";

        setStatus("Rendering Graphviz SVG with Viz.js...");

        try {
          const viz = await getViz();
          const svgEl = viz.renderSVGElement(lastDot);

          svgEl.classList.add("gtnhFlowBrowserSvg");

          lastSvg = new XMLSerializer().serializeToString(svgEl);

          const viewer = document.getElementById("gtnhFlowBrowserViewer");
          if (viewer) {
            viewer.innerHTML = "";
            viewer.appendChild(svgEl);
          }

          setStatus("Rendered gtnh-flow DOT -> SVG.");
          toast("gtnh-flow rendered.");
        } catch (err) {
          setStatus("Viz.js render failed.", true);
          setViewer(`<pre class="gtnhFlowBrowserError">${esc(String(err?.stack || err))}</pre>`);
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
    const el = document.getElementById("gtnhFlowBrowserStatus");
    if (!el) return;

    el.textContent = text;
    el.classList.toggle("warn", !!warn);
  }

  function setViewer(html) {
    const el = document.getElementById("gtnhFlowBrowserViewer");
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
          /gtnh-flow preview\. Export YAML\/SVG from here/i.test(t) ||
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
        /gtnh-flow preview\. Export YAML\/SVG from here/i.test(t) ||
        /Live Graphviz SVG generated/i.test(t) ||
        /gtnh-flow:\s*/i.test(t) ||
        /-\s*m:\s*/i.test(t)
      ) {
        if (el.id !== "gtnhFlowBrowserPanel" && !el.closest("#gtnhFlowBrowserPanel")) {
          el.style.display = "none";
        }
      }
    });
  }

  function ensurePanel() {
    let panel = document.getElementById("gtnhFlowBrowserPanel");
    if (panel) return panel;

    const parent = findPanelParent();

    panel = document.createElement("div");
    panel.id = "gtnhFlowBrowserPanel";
    panel.className = "gtnhFlowBrowserPanel";

    parent.appendChild(panel);

    return panel;
  }

  function showPanel() {
    hideOldFlowStuff();

    const panel = ensurePanel();
    panel.style.display = "block";

    panel.innerHTML = `
      <div class="gtnhFlowBrowserBox">
        <div class="gtnhFlowBrowserHead">
          <div>
            <h3>gtnh-flow</h3>
            <p>Running gtnh-flow in browser, then Graphviz SVG rendered by Viz.js.</p>
          </div>
          <span class="gtnhFlowBrowserBadge">browser</span>
        </div>

        <div class="gtnhFlowBrowserActions">
          <button type="button" id="gtnhFlowBrowserRun">Run gtnh-flow</button>
          <button type="button" id="gtnhFlowBrowserCopyYaml">Copy YAML</button>
          <button type="button" id="gtnhFlowBrowserCopyDot">Copy DOT</button>
          <button type="button" id="gtnhFlowBrowserDownloadSvg">Download SVG</button>
          <button type="button" id="gtnhFlowBrowserDownloadYaml">Download YAML</button>
        </div>

        <div id="gtnhFlowBrowserStatus" class="gtnhFlowBrowserStatus">
          Ready. Press “Run gtnh-flow”.
        </div>

        <div id="gtnhFlowBrowserViewer" class="gtnhFlowBrowserViewer">
          <div class="gtnhFlowBrowserPlaceholder">
            This will load Python + gtnh-flow. First run can take a while on mobile.
          </div>
        </div>

        <details class="gtnhFlowBrowserDetails">
          <summary>YAML sent to gtnh-flow</summary>
          <pre id="gtnhFlowBrowserYamlPre"></pre>
        </details>
      </div>
    `;

    panel.querySelector("#gtnhFlowBrowserRun").addEventListener("click", runGtnhFlow);

    panel.querySelector("#gtnhFlowBrowserCopyYaml").addEventListener("click", async () => {
      if (!lastYaml) lastYaml = makeYamlForCurrentTarget();
      await navigator.clipboard.writeText(lastYaml);
      toast("Copied YAML.");
    });

    panel.querySelector("#gtnhFlowBrowserCopyDot").addEventListener("click", async () => {
      await navigator.clipboard.writeText(lastDot || "");
      toast(lastDot ? "Copied DOT." : "No DOT yet.");
    });

    panel.querySelector("#gtnhFlowBrowserDownloadSvg").addEventListener("click", () => {
      if (!lastSvg) {
        toast("No SVG yet.");
        return;
      }

      downloadText(
        `gtnh-flow_${fileSafe(getTarget())}.svg`,
        lastSvg,
        "image/svg+xml;charset=utf-8"
      );
    });

    panel.querySelector("#gtnhFlowBrowserDownloadYaml").addEventListener("click", () => {
      if (!lastYaml) lastYaml = makeYamlForCurrentTarget();

      downloadText(
        `gtnh-flow_${fileSafe(getTarget())}.yaml`,
        lastYaml,
        "text/yaml;charset=utf-8"
      );
    });

    runGtnhFlow();
  }

  function runGtnhFlow() {
    lastYaml = makeYamlForCurrentTarget();
    lastDot = "";
    lastSvg = "";

    const pre = document.getElementById("gtnhFlowBrowserYamlPre");
    if (pre) pre.textContent = lastYaml;

    setViewer(`<div class="gtnhFlowBrowserPlaceholder">Running gtnh-flow...</div>`);
    setStatus("Starting gtnh-flow Python worker...");

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
    clearTimeout(window.__gtnhFlowBrowserRenameTimer);
    window.__gtnhFlowBrowserRenameTimer = setTimeout(renameFlow, 80);
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
    runGtnhFlow
  };
})();
