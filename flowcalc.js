/* === GTNH WORKBENCH BUILT-IN GTNH-FLOW v1 === */
(() => {
  if (window.__GTNH_WORKBENCH_FLOWCALC_V1__) return;
  window.__GTNH_WORKBENCH_FLOWCALC_V1__ = true;

  let lastYaml = "";
  let lastSvg = "";

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
    el._timer = setTimeout(() => el.classList.remove("show"), 1600);
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
        machine: "machine"
      };
    }

    if (!api?.ready) {
      return {
        ok: false,
        target,
        yaml: "# gtnh-flow export API is not ready yet. Wait for item data to load.\n",
        input: {},
        output: {},
        machine: "machine"
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
        machine: "machine"
      };
    }
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

  function amountLabel(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v || 1);
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.00$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.00$/, "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(2).replace(/\.00$/, "") + "k";
    return String(n);
  }

  function makeSvg(result) {
    const inputs = Object.entries(result.input || {});
    const outputs = Object.entries(result.output || {});

    const rowH = 54;
    const leftRows = Math.max(inputs.length, 1);
    const rightRows = Math.max(outputs.length, 1);
    const h = Math.max(260, 130 + Math.max(leftRows, rightRows) * rowH);
    const w = 980;

    const machineX = 405;
    const machineY = h / 2 - 42;

    function node(x, y, title, sub, cls = "") {
      return `
        <g class="flowNode ${cls}">
          <rect x="${x}" y="${y}" width="230" height="44" rx="14"></rect>
          <text x="${x + 14}" y="${y + 19}" class="flowTitle">${esc(title)}</text>
          <text x="${x + 14}" y="${y + 36}" class="flowSub">${esc(sub)}</text>
        </g>
      `;
    }

    function inputNodes() {
      if (!inputs.length) return node(40, h / 2 - 22, "No parsed input", "parser missed I/O", "warn");

      return inputs.map(([name, amount], i) => {
        const y = 70 + i * rowH;
        return node(40, y, name, amountLabel(amount), "");
      }).join("");
    }

    function outputNodes() {
      if (!outputs.length) return node(710, h / 2 - 22, "No parsed output", "parser missed I/O", "warn");

      return outputs.map(([name, amount], i) => {
        const y = 70 + i * rowH;
        return node(710, y, name, amountLabel(amount), "");
      }).join("");
    }

    function lines() {
      const inYs = inputs.length ? inputs.map((_, i) => 70 + i * rowH + 22) : [h / 2];
      const outYs = outputs.length ? outputs.map((_, i) => 70 + i * rowH + 22) : [h / 2];

      return [
        ...inYs.map(y => `<path class="flowLine" d="M270 ${y} C330 ${y}, 330 ${h / 2}, 405 ${h / 2}"></path>`),
        ...outYs.map(y => `<path class="flowLine" d="M575 ${h / 2} C650 ${h / 2}, 650 ${y}, 710 ${y}"></path>`)
      ].join("");
    }

    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="gtnhFlowSvg">
  <defs>
    <style>
      .bg{fill:#07111f}
      .flowLine{fill:none;stroke:#67e8f9;stroke-width:3;stroke-opacity:.55}
      .flowNode rect{fill:#0f2138;stroke:#2d4567;stroke-width:2}
      .flowNode.warn rect{stroke:#f59e0b}
      .machine rect{fill:#142a45;stroke:#f472b6}
      .flowTitle{fill:#eaf2ff;font:bold 16px system-ui, sans-serif}
      .flowSub{fill:#9fb0c8;font:13px system-ui, sans-serif}
      .caption{fill:#7dd3fc;font:bold 18px system-ui, sans-serif}
    </style>
  </defs>
  <rect class="bg" x="0" y="0" width="${w}" height="${h}" rx="20"></rect>
  <text class="caption" x="40" y="35">gtnh-flow draft: ${esc(result.target || getTarget())}</text>
  ${lines()}
  ${inputNodes()}
  ${node(machineX, machineY, result.machine || "Machine", `${result.tier || "LV"} · ${result.eut || 0} EU/t · ${result.dur || 1}s`, "machine")}
  ${outputNodes()}
</svg>`;
  }

  function renderFlowPanel() {
    const panel = ensurePanel();
    const out = codeOut();
    if (!panel || !out) {
      toast("gtnh-flow panel not ready.");
      return;
    }

    const result = buildYamlResult();
    lastYaml = result.yaml || "# YAML export failed.\n";
    lastSvg = makeSvg(result);

    out.style.display = "none";
    panel.style.display = "block";

    panel.innerHTML = `
      <div class="gtnhFlowHeader">
        <div>
          <div class="gtnhFlowTitle">gtnh-flow preview</div>
          <div class="gtnhFlowSub">
            Static browser preview. Export YAML for real local gtnh-flow.
          </div>
        </div>
      </div>

      <div class="gtnhFlowSvgWrap">
        ${lastSvg}
      </div>

      <div class="gtnhFlowActions">
        <button type="button" id="gtnhFlowCopyYaml">Copy YAML</button>
        <button type="button" id="gtnhFlowDownloadYaml">Download YAML</button>
        <button type="button" id="gtnhFlowDownloadSvg">Download SVG</button>
      </div>

      <details class="gtnhFlowDetails">
        <summary>YAML draft</summary>
        <pre>${esc(lastYaml)}</pre>
      </details>
    `;

    panel.querySelector("#gtnhFlowCopyYaml")?.addEventListener("click", copyYaml);
    panel.querySelector("#gtnhFlowDownloadYaml")?.addEventListener("click", downloadYaml);
    panel.querySelector("#gtnhFlowDownloadSvg")?.addEventListener("click", downloadSvg);

    toast("gtnh-flow preview generated.");
  }

  async function copyYaml() {
    if (!lastYaml) renderYamlOnly();

    try {
      await navigator.clipboard.writeText(lastYaml);
      toast("Copied YAML.");
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
    if (!lastYaml) renderYamlOnly();
    downloadText(`gtnh-flow_${fileSafe(getTarget())}.yaml`, lastYaml, "text/yaml;charset=utf-8");
    toast("Downloaded YAML.");
  }

  function downloadSvg() {
    if (!lastSvg) renderFlowPanel();
    downloadText(`gtnh-flow_${fileSafe(getTarget())}.svg`, lastSvg, "image/svg+xml;charset=utf-8");
    toast("Downloaded SVG.");
  }

  function activateButton(btn) {
    const row = btn?.parentElement;
    if (!row) return;

    [...row.querySelectorAll("button")].forEach(b => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    });
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

  const installTimer = setInterval(ensureFlowButton, 400);
  window.addEventListener("load", ensureFlowButton);
  window.addEventListener("resize", ensureFlowButton);

  window.GTNH_FLOWCALC = {
    renderYamlOnly,
    renderFlowPanel,
    copyYaml,
    downloadYaml,
    downloadSvg
  };
})();
