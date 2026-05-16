/* === GTNH WORKBENCH LIVE GTNH-FLOW GRAPHVIZ v1 === */
(() => {
  "use strict";

  if (window.__GTNH_WORKBENCH_LIVE_FLOW_V1__) return;
  window.__GTNH_WORKBENCH_LIVE_FLOW_V1__ = true;

  let lastYaml = "";
  let lastDot = "";
  let lastSvg = "";
  let vizPromise = null;

  const VIZ_URL = "https://cdn.jsdelivr.net/npm/@viz-js/viz@3.27.0/+esm";

  function overlay() {
    return document.getElementById("gtnhCalcOverlay");
  }

  function state() {
    try {
      return window.GTNH_CALC?.getState?.() || {};
    } catch {
      return {};
    }
  }

  function getTarget() {
    const st = state();
    return String(
      st.target ||
      document.getElementById("calcTarget")?.value ||
      document.querySelector("[name='target']")?.value ||
      ""
    ).trim();
  }

  function getRouteIndex(target) {
    const st = state();
    const key = String(target || "").toLowerCase();
    const locked =
      st.lockedRoutes?.[key] ??
      st.lockedRoutes?.[String(target || "")] ??
      0;

    const n = Number(locked);
    return Number.isFinite(n) ? n : 0;
  }

  function toast(text) {
    let el = document.getElementById("gtnhCalcToast");

    if (!el) {
      el = document.createElement("div");
      el.id = "gtnhCalcToast";
      el.className = "gtnhCalcToast";
      document.body.appendChild(el);
    }

    el.textContent = text;
    el.classList.add("show");

    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 1700);
  }

  function codeOut() {
    return (
      document.getElementById("calcCodeOut") ||
      overlay()?.querySelector("textarea") ||
      overlay()?.querySelector("pre")
    );
  }

  function setCodeOut(text) {
    const out = codeOut();
    if (!out) return false;

    out.style.display = "";

    if ("value" in out) out.value = text;
    else out.textContent = text;

    return true;
  }

  function escHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function escDot(s) {
    return String(s ?? "")
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"')
      .replace(/\r?\n/g, "\\n");
  }

  function fileSafe(s) {
    return String(s || "target")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "target";
  }

  function amountLabel(v) {
    const raw = String(v ?? "").replace(/,/g, "").trim();
    const n = Number(raw);

    if (!Number.isFinite(n)) return String(v ?? "");

    if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.00$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.00$/, "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(2).replace(/\.00$/, "") + "k";

    return String(n);
  }

  function buildYamlResult() {
    const api = window.GTNHNEI_FLOW_EXPORT_API;
    const target = getTarget();

    if (!target) {
      return {
        ok: false,
        target: "",
        yaml: "# No target selected.\n",
        input: {},
        output: {},
        machine: "machine",
        tier: "?",
        eut: "?",
        dur: "?"
      };
    }

    if (!api?.ready) {
      return {
        ok: false,
        target,
        yaml: "# gtnh-flow export API is not ready yet.\n# Wait for item data to load.\n",
        input: {},
        output: {},
        machine: "machine",
        tier: "?",
        eut: "?",
        dur: "?"
      };
    }

    const routeIndex = getRouteIndex(target);
    const st = state();

    try {
      return api.yamlForRecipe(target, routeIndex, {
        targetAmount: st.targetAmount || st.amount || 1
      });
    } catch (err) {
      return {
        ok: false,
        target,
        yaml: `# YAML export crashed.\n# ${String(err?.message || err)}\n`,
        input: {},
        output: {},
        machine: "machine",
        tier: "?",
        eut: "?",
        dur: "?"
      };
    }
  }

  function ensureFlowButton() {
    const ov = overlay();
    if (!ov) return;

    if (document.getElementById("gtnhFlowCalcTab")) return;

    const yamlBtn = [...ov.querySelectorAll("button")]
      .find(b => String(b.textContent || "").trim().toLowerCase() === "yaml");

    if (!yamlBtn?.parentElement) return;

    const btn = document.createElement("button");
    btn.id = "gtnhFlowCalcTab";
    btn.type = "button";
    btn.textContent = "gtnh-flow";

    yamlBtn.parentElement.insertBefore(btn, yamlBtn.nextSibling);
  }

  function ensurePanel() {
    const ov = overlay();
    if (!ov) return null;

    let panel = document.getElementById("gtnhFlowCalcPanel");
    if (panel) return panel;

    const out = codeOut();
    if (!out?.parentElement) return null;

    panel = document.createElement("div");
    panel.id = "gtnhFlowCalcPanel";
    panel.className = "gtnhFlowCalcPanel";
    panel.style.display = "none";

    out.parentElement.appendChild(panel);
    return panel;
  }

  function hideFlowPanel() {
    const panel = document.getElementById("gtnhFlowCalcPanel");
    if (panel) panel.style.display = "none";

    const out = codeOut();
    if (out) out.style.display = "";
  }

  function activateButton(btn) {
    const row = btn?.parentElement;
    if (!row) return;

    [...row.querySelectorAll("button")].forEach(b => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    });
  }

  function renderYamlOnly() {
    hideFlowPanel();

    const result = buildYamlResult();
    lastYaml = result.yaml || "# YAML export failed.\n";

    setCodeOut(lastYaml);
    renameDownloadButton("Download YAML");

    toast(result.ok ? "YAML draft generated." : "YAML warning. Check output.");
  }

  function renameDownloadButton(text) {
    const ov = overlay();
    if (!ov) return;

    const btn = [...ov.querySelectorAll("button")]
      .find(b => /download/i.test(String(b.textContent || "")));

    if (btn) btn.textContent = text;
  }

  function slug(prefix, name, i = "") {
    return `${prefix}_${name}_${i}`
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "") || `${prefix}_${i}`;
  }

  function resultToDot(result) {
    const input = Object.entries(result.input || {});
    const output = Object.entries(result.output || {});

    const machineName = result.machine || "Machine";
    const target = result.target || getTarget() || "target";

    const machineId = "machine_main";

    const tier = result.tier || "?";
    const eut = result.eut ?? "?";
    const dur = result.dur ?? "?";

    let dot = `digraph GTNHFlow {
  graph [
    rankdir=LR,
    bgcolor="#030914",
    pad="0.35",
    nodesep="0.52",
    ranksep="0.92",
    splines=true,
    outputorder=edgesfirst,
    label="gtnh-flow: ${escDot(target)}",
    labelloc=t,
    fontname="Arial",
    fontsize=26,
    fontcolor="#7dd3fc"
  ];

  node [
    shape=box,
    style="rounded,filled",
    fontname="Arial",
    fontsize=18,
    margin="0.16,0.10",
    penwidth=2,
    fontcolor="#eaf2ff"
  ];

  edge [
    penwidth=3,
    arrowsize=0.8,
    color="#67e8f9",
    fontname="Arial",
    fontsize=13,
    fontcolor="#aebbd2"
  ];

  "${machineId}" [
    label="${escDot(machineName)}\\n${escDot(tier)} · ${escDot(eut)} EU/t · ${escDot(dur)}s",
    fillcolor="#142845",
    color="#fb8ccf",
    penwidth=3
  ];

`;

    if (!input.length) {
      dot += `  "no_input" [label="No parsed input\\ncheck YAML/export parser", fillcolor="#241526", color="#f59e0b"];\n`;
      dot += `  "no_input" -> "${machineId}" [color="#f59e0b"];\n`;
    } else {
      input.forEach(([name, amount], i) => {
        const id = slug("in", name, i);
        dot += `  "${id}" [label="${escDot(name)}\\n${escDot(amountLabel(amount))}", fillcolor="#0f253f", color="#3f668a"];\n`;
        dot += `  "${id}" -> "${machineId}" [label="${escDot(amountLabel(amount))}", color="#67e8f9"];\n`;
      });
    }

    if (!output.length) {
      dot += `  "no_output" [label="No parsed output\\ncheck YAML/export parser", fillcolor="#241526", color="#f59e0b"];\n`;
      dot += `  "${machineId}" -> "no_output" [color="#f59e0b"];\n`;
    } else {
      output.forEach(([name, amount], i) => {
        const id = slug("out", name, i);
        dot += `  "${id}" [label="${escDot(name)}\\n${escDot(amountLabel(amount))}", fillcolor="#102b24", color="#5eead4"];\n`;
        dot += `  "${machineId}" -> "${id}" [label="${escDot(amountLabel(amount))}", color="#5eead4"];\n`;
      });
    }

    dot += `}\n`;
    return dot;
  }

  async function getViz() {
    if (!vizPromise) {
      vizPromise = import(VIZ_URL).then(mod => mod.instance());
    }

    return vizPromise;
  }

  async function renderDotToSvg(dot) {
    const viz = await getViz();
    const svgEl = viz.renderSVGElement(dot);

    svgEl.classList.add("gtnhFlowSvgLive");
    svgEl.setAttribute("role", "img");
    svgEl.setAttribute("aria-label", "gtnh-flow Graphviz SVG");

    return svgEl;
  }

  async function renderFlowPanel() {
    const panel = ensurePanel();
    const out = codeOut();

    if (!panel || !out) {
      toast("gtnh-flow panel not ready.");
      return;
    }

    const result = buildYamlResult();
    lastYaml = result.yaml || "# YAML export failed.\n";
    lastDot = resultToDot(result);
    lastSvg = "";

    out.style.display = "none";
    panel.style.display = "block";

    panel.innerHTML = `
      <div class="gtnhFlowLiveBox">
        <div class="gtnhFlowLiveHead">
          <div>
            <h3>gtnh-flow</h3>
            <p>Live Graphviz SVG generated inside the website.</p>
          </div>
          <span class="gtnhFlowLiveBadge">${result.ok ? "live" : "warning"}</span>
        </div>

        <div class="gtnhFlowLiveActions">
          <button type="button" id="gtnhFlowCopyYaml">Copy YAML</button>
          <button type="button" id="gtnhFlowDownloadYaml">Download YAML</button>
          <button type="button" id="gtnhFlowDownloadSvg">Download SVG</button>
          <button type="button" id="gtnhFlowCopyDot">Copy DOT</button>
          <button type="button" id="gtnhFlowRerender">Re-render</button>
        </div>

        <div id="gtnhFlowLiveStatus" class="gtnhFlowLiveStatus">
          Loading Graphviz WASM...
        </div>

        <div id="gtnhFlowLiveViewer" class="gtnhFlowLiveViewer"></div>

        <details class="gtnhFlowYamlDetails">
          <summary>YAML used for this graph</summary>
          <pre>${escHtml(lastYaml)}</pre>
        </details>
      </div>
    `;

    panel.querySelector("#gtnhFlowCopyYaml")?.addEventListener("click", copyYaml);
    panel.querySelector("#gtnhFlowDownloadYaml")?.addEventListener("click", downloadYaml);
    panel.querySelector("#gtnhFlowDownloadSvg")?.addEventListener("click", downloadSvg);
    panel.querySelector("#gtnhFlowCopyDot")?.addEventListener("click", copyDot);
    panel.querySelector("#gtnhFlowRerender")?.addEventListener("click", renderFlowPanel);

    const status = panel.querySelector("#gtnhFlowLiveStatus");
    const viewer = panel.querySelector("#gtnhFlowLiveViewer");

    try {
      const svgEl = await renderDotToSvg(lastDot);

      viewer.innerHTML = "";
      viewer.appendChild(svgEl);

      lastSvg = new XMLSerializer().serializeToString(svgEl);

      status.textContent = result.ok
        ? "Rendered live SVG."
        : "Rendered with warnings. Check YAML/export parser.";

      status.classList.toggle("warn", !result.ok);

      toast("gtnh-flow SVG rendered.");
    } catch (err) {
      console.error(err);

      status.textContent = "Graphviz render failed.";
      status.classList.add("warn");

      viewer.innerHTML = `
        <pre class="gtnhFlowError">${escHtml(String(err?.stack || err))}</pre>
      `;

      toast("gtnh-flow render failed.");
    }
  }

  async function copyYaml() {
    if (!lastYaml) {
      const result = buildYamlResult();
      lastYaml = result.yaml || "";
    }

    try {
      await navigator.clipboard.writeText(lastYaml);
      toast("Copied YAML.");
    } catch {
      toast("Copy failed.");
    }
  }

  async function copyDot() {
    if (!lastDot) {
      const result = buildYamlResult();
      lastDot = resultToDot(result);
    }

    try {
      await navigator.clipboard.writeText(lastDot);
      toast("Copied DOT.");
    } catch {
      toast("Copy failed.");
    }
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

  function downloadYaml() {
    if (!lastYaml) {
      const result = buildYamlResult();
      lastYaml = result.yaml || "";
    }

    downloadText(
      `gtnh-flow_${fileSafe(getTarget())}.yaml`,
      lastYaml,
      "text/yaml;charset=utf-8"
    );

    toast("Downloaded YAML.");
  }

  function downloadSvg() {
    if (!lastSvg) {
      toast("Render SVG first.");
      return;
    }

    downloadText(
      `gtnh-flow_${fileSafe(getTarget())}.svg`,
      lastSvg,
      "image/svg+xml;charset=utf-8"
    );

    toast("Downloaded SVG.");
  }

  document.addEventListener("click", event => {
    const btn = event.target?.closest?.("button, a");
    if (!btn) return;

    const ov = overlay();
    if (!ov || !ov.contains(btn)) return;

    const txt = String(btn.textContent || "").trim().toLowerCase();
    const href = String(btn.getAttribute?.("href") || "");

    if (href.includes("flow.html")) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      renderFlowPanel();
      return;
    }

    if (txt === "yaml") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      activateButton(btn);
      setTimeout(renderYamlOnly, 0);
      return;
    }

    if (txt === "gtnh-flow") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      activateButton(btn);
      setTimeout(renderFlowPanel, 0);
      return;
    }
  }, true);

  const installTimer = setInterval(() => {
    ensureFlowButton();

    if (document.getElementById("gtnhFlowCalcTab")) {
      clearInterval(installTimer);
    }
  }, 400);

  window.addEventListener("load", ensureFlowButton);
  window.addEventListener("resize", ensureFlowButton);

  window.GTNH_FLOWCALC = {
    renderYamlOnly,
    renderFlowPanel,
    copyYaml,
    copyDot,
    downloadYaml,
    downloadSvg
  };
})();
