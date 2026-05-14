/* === GTNH-FLOW FORCE REAL YAML v3 === */
(() => {
  if (window.__GTNH_FLOW_FORCE_REAL_YAML_V3__) return;
  window.__GTNH_FLOW_FORCE_REAL_YAML_V3__ = true;

  let lastYaml = "";
  let lastSvg = "";

  function compact(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function cleanName(raw) {
    let s = String(raw || "").trim();

    s = s.replace(/^\s*x\s*\d+(?:\.\d+)?[kmb]?\s+/i, "");
    s = s.replace(/^\s*L\s+/i, "");
    s = s.replace(/^\s*Fluid\s*:\s*/i, "");
    s = s.replace(/^\s*Item\s*:\s*/i, "");
    s = s.replace(/\s+/g, " ").trim();

    return s;
  }

  function flowName(raw) {
    return cleanName(raw).toLowerCase();
  }

  function yamlScalar(v) {
    if (typeof v === "number") return String(v);
    const s = String(v ?? "");
    if (/^[a-zA-Z0-9_ .+\-()[\]\/]+$/.test(s)) return s;
    return JSON.stringify(s);
  }

  function yamlMap(label, map) {
    const entries = Object.entries(map || {}).filter(([k]) => cleanName(k));
    if (!entries.length) return `  ${label}: {}`;

    return [
      `  ${label}:`,
      ...entries.map(([k, v]) => `    ${yamlScalar(flowName(k))}: ${yamlScalar(v)}`)
    ].join("\n");
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
    return String(
      st.target ||
      document.getElementById("calcTarget")?.value ||
      document.querySelector("[name='target']")?.value ||
      ""
    ).trim();
  }

  function getRouteIndex(target) {
    const st = getState();
    const key = String(target || "").toLowerCase();

    const locked =
      st.lockedRoutes?.[key] ??
      st.lockedRoutes?.[String(target || "")] ??
      0;

    const n = Number(locked);
    return Number.isFinite(n) ? n : 0;
  }

  function parseMapFromYaml(yaml, label) {
    const out = {};
    const lines = String(yaml || "").split(/\r?\n/);
    let inside = false;

    for (const line of lines) {
      if (/^\s+[IO]\s*:\s*/.test(line)) {
        inside = new RegExp("^\\s+" + label + "\\s*:").test(line);
        continue;
      }

      if (inside) {
        if (/^\s{2}\S/.test(line) && !/^\s{4}/.test(line)) break;

        const m = line.match(/^\s{4}(.+?)\s*:\s*(.+?)\s*$/);
        if (m) out[m[1].trim()] = parseValue(m[2].trim());
      }
    }

    return out;
  }

  function parseValue(v) {
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : v;
  }

  function splitMixedIoByTarget(I, O, target) {
    const keys = Object.keys(I || {});
    if (!keys.length) return { I, O };

    const outAlready = Object.keys(O || {}).length > 0;
    if (outAlready) return { I, O };

    const targetCompact = compact(target);
    const hitIndex = keys.findIndex(k => compact(k).includes(targetCompact) || targetCompact.includes(compact(k)));

    if (hitIndex < 0) return { I, O };

    const newI = {};
    const newO = {};

    keys.forEach((k, idx) => {
      if (idx >= hitIndex) newO[k] = I[k];
      else newI[k] = I[k];
    });

    return { I: newI, O: newO };
  }

  function guessDurationSeconds(fallback = 1) {
    const text = String(document.querySelector("#gtnhCalcOverlay")?.innerText || document.body.innerText || "");

    const matches = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*s\b/gi)]
      .map(m => Number(m[1]))
      .filter(n => Number.isFinite(n) && n > 0);

    if (matches.length) return matches[0];

    return fallback;
  }

  function buildRealYaml() {
    const target = getTarget();
    const api = window.GTNHNEI_FLOW_EXPORT_API;

    if (!target) {
      return {
        ok: false,
        target: "",
        machine: "machine",
        tier: "LV",
        eut: 0,
        dur: 1,
        I: {},
        O: {},
        yaml: "# No target selected.\n"
      };
    }

    if (!api?.ready || typeof api.yamlForRecipe !== "function") {
      return {
        ok: false,
        target,
        machine: "machine",
        tier: "LV",
        eut: 0,
        dur: 1,
        I: {},
        O: {},
        yaml: "# gtnh-flow export API is not ready yet. Wait for data load, then press YAML again.\n"
      };
    }

    let r;
    try {
      r = api.yamlForRecipe(target, getRouteIndex(target), {});
    } catch (err) {
      return {
        ok: false,
        target,
        machine: "machine",
        tier: "LV",
        eut: 0,
        dur: 1,
        I: {},
        O: {},
        yaml: `# YAML export crashed.\n# ${String(err?.message || err)}\n`
      };
    }

    let I = r.input || r.I || parseMapFromYaml(r.yaml, "I") || {};
    let O = r.output || r.O || parseMapFromYaml(r.yaml, "O") || {};

    ({ I, O } = splitMixedIoByTarget(I, O, target));

    const machine = String(r.machine || "machine");
    const tier = String(r.tier || "LV");
    const eut = Number.isFinite(Number(r.eut)) ? Number(r.eut) : 0;

    let dur = Number(r.dur);
    if (!Number.isFinite(dur) || dur <= 1) dur = guessDurationSeconds(1);

    const yaml =
`# GTNH Workbench -> gtnh-flow draft
# Target: ${target}
# Route: ${getRouteIndex(target) + 1}
# Machine: ${machine}
# Check names once before running factory_graph.py.

- m: ${yamlScalar(machine.toLowerCase())}
  tier: ${yamlScalar(tier)}
${yamlMap("I", I)}
${yamlMap("O", O)}
  eut: ${yamlScalar(eut)}
  dur: ${yamlScalar(dur)}
  number: 1
`;

    return {
      ok: true,
      target,
      machine,
      tier,
      eut,
      dur,
      I,
      O,
      yaml
    };
  }

  function codeBox() {
    return (
      document.getElementById("calcCodeOut") ||
      document.querySelector("#gtnhCalcOverlay textarea") ||
      document.querySelector("#gtnhCalcOverlay pre")
    );
  }

  function setCode(text) {
    const box = codeBox();
    if (!box) return false;

    const panel = document.getElementById("gtnhFlowRealPanel");
    if (panel) panel.style.display = "none";

    box.style.display = "";
    if ("value" in box) box.value = text;
    else box.textContent = text;

    return true;
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
    el._timer = setTimeout(() => el.classList.remove("show"), 1500);
  }

  function renderYaml() {
    const r = buildRealYaml();
    lastYaml = r.yaml;
    setCode(lastYaml);
    toast("gtnh-flow YAML generated.");
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function amountLabel(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v || 1);
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.00$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.00$/, "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(2).replace(/\.00$/, "") + "k";
    return String(n);
  }

  function makeSvg(r) {
    const ins = Object.entries(r.I || {});
    const outs = Object.entries(r.O || {});
    const rows = Math.max(ins.length, outs.length, 1);
    const h = Math.max(280, 100 + rows * 58);
    const w = 1020;

    function node(x, y, title, sub, cls = "") {
      return `
        <g class="flowNode ${cls}">
          <rect x="${x}" y="${y}" width="250" height="46" rx="14"></rect>
          <text x="${x + 14}" y="${y + 20}" class="flowTitle">${esc(title)}</text>
          <text x="${x + 14}" y="${y + 38}" class="flowSub">${esc(sub)}</text>
        </g>`;
    }

    const machineY = h / 2 - 23;

    const inSvg = ins.length
      ? ins.map(([n, a], i) => node(35, 64 + i * 58, flowName(n), amountLabel(a))).join("")
      : node(35, machineY, "no input parsed", "check YAML", "warn");

    const outSvg = outs.length
      ? outs.map(([n, a], i) => node(740, 64 + i * 58, flowName(n), amountLabel(a))).join("")
      : node(740, machineY, "no output parsed", "check YAML", "warn");

    const inYs = ins.length ? ins.map((_, i) => 64 + i * 58 + 23) : [h / 2];
    const outYs = outs.length ? outs.map((_, i) => 64 + i * 58 + 23) : [h / 2];

    const lines = [
      ...inYs.map(y => `<path class="flowLine" d="M285 ${y} C350 ${y}, 370 ${h / 2}, 430 ${h / 2}"></path>`),
      ...outYs.map(y => `<path class="flowLine" d="M590 ${h / 2} C650 ${h / 2}, 675 ${y}, 740 ${y}"></path>`)
    ].join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" class="gtnhFlowSvg">
      <defs>
        <style>
          .bg{fill:#07111f}
          .flowLine{fill:none;stroke:#67e8f9;stroke-width:3;stroke-opacity:.55}
          .flowNode rect{fill:#0f2138;stroke:#2d4567;stroke-width:2}
          .flowNode.warn rect{stroke:#f59e0b}
          .machine rect{fill:#142a45;stroke:#f472b6;stroke-width:2}
          .flowTitle{fill:#eaf2ff;font:bold 15px system-ui,sans-serif}
          .flowSub{fill:#9fb0c8;font:13px system-ui,sans-serif}
          .caption{fill:#7dd3fc;font:bold 18px system-ui,sans-serif}
        </style>
      </defs>
      <rect class="bg" width="${w}" height="${h}" rx="20"></rect>
      <text class="caption" x="35" y="34">gtnh-flow: ${esc(r.target)}</text>
      ${lines}
      ${inSvg}
      ${node(430, machineY, r.machine, `${r.tier} · ${r.eut} EU/t · ${r.dur}s`, "machine")}
      ${outSvg}
    </svg>`;
  }

  function ensurePanel() {
    const box = codeBox();
    if (!box?.parentElement) return null;

    let panel = document.getElementById("gtnhFlowRealPanel");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "gtnhFlowRealPanel";
    panel.className = "gtnhFlowCalcPanel";
    box.parentElement.appendChild(panel);
    return panel;
  }

  function fileSafe(s) {
    return String(s || "target")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "target";
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

  async function copyYaml() {
    if (!lastYaml) renderYaml();

    try {
      await navigator.clipboard.writeText(lastYaml);
      toast("Copied YAML.");
    } catch {
      toast("Copy failed.");
    }
  }

  function downloadYaml() {
    if (!lastYaml) renderYaml();
    downloadText(`gtnh-flow_${fileSafe(getTarget())}.yaml`, lastYaml, "text/yaml;charset=utf-8");
  }

  function downloadSvg() {
    if (!lastSvg) renderFlow();
    downloadText(`gtnh-flow_${fileSafe(getTarget())}.svg`, lastSvg, "image/svg+xml;charset=utf-8");
  }

  function renderFlow() {
    const r = buildRealYaml();
    lastYaml = r.yaml;
    lastSvg = makeSvg(r);

    const box = codeBox();
    const panel = ensurePanel();
    if (!box || !panel) {
      toast("gtnh-flow panel not ready.");
      return;
    }

    box.style.display = "none";
    panel.style.display = "block";

    panel.innerHTML = `
      <div class="gtnhFlowHeader">
        <div>
          <div class="gtnhFlowTitle">gtnh-flow</div>
          <div class="gtnhFlowSub">Browser preview. Export YAML/SVG from here.</div>
        </div>
      </div>
      <div class="gtnhFlowSvgWrap">${lastSvg}</div>
      <div class="gtnhFlowActions">
        <button type="button" id="gtnhFlowCopyYaml">Copy YAML</button>
        <button type="button" id="gtnhFlowDownloadYaml">Download YAML</button>
        <button type="button" id="gtnhFlowDownloadSvg">Download SVG</button>
      </div>
      <details class="gtnhFlowDetails">
        <summary>YAML</summary>
        <pre>${esc(lastYaml)}</pre>
      </details>
    `;

    panel.querySelector("#gtnhFlowCopyYaml")?.addEventListener("click", copyYaml);
    panel.querySelector("#gtnhFlowDownloadYaml")?.addEventListener("click", downloadYaml);
    panel.querySelector("#gtnhFlowDownloadSvg")?.addEventListener("click", downloadSvg);

    toast("gtnh-flow preview generated.");
  }

  function ensureButtonName() {
    const ov = document.getElementById("gtnhCalcOverlay");
    if (!ov) return;

    [...ov.querySelectorAll("button, a")].forEach(el => {
      const t = String(el.textContent || "").trim().toLowerCase();
      const href = String(el.getAttribute?.("href") || "");

      if (t === "flow" || t === "diagram" || t === "gtnh flow" || href.includes("flow.html")) {
        el.textContent = "gtnh-flow";
        if (el.tagName === "A") el.setAttribute("href", "#gtnh-flow");
      }
    });
  }

  function activate(btn) {
    const row = btn?.parentElement;
    if (!row) return;

    [...row.querySelectorAll("button")].forEach(b => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    });
  }

  function isYaml(el) {
    return String(el?.textContent || "").trim().toLowerCase() === "yaml";
  }

  function isFlow(el) {
    const t = String(el?.textContent || "").trim().toLowerCase();
    const href = String(el?.getAttribute?.("href") || "");
    return t === "gtnh-flow" || t === "flow" || t === "diagram" || href.includes("flow.html");
  }

  document.addEventListener("click", event => {
    const btn = event.target?.closest?.("button, a");
    if (!btn) return;

    const ov = document.getElementById("gtnhCalcOverlay");
    if (!ov || !ov.contains(btn)) return;

    if (isYaml(btn)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      activate(btn);
      renderYaml();
      return;
    }

    if (isFlow(btn)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      activate(btn);
      renderFlow();
      return;
    }

    const txt = String(btn.textContent || "").trim().toLowerCase();

    if (txt === "copy" && lastYaml) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      copyYaml();
      return;
    }

    if (txt.includes("download yaml") && lastYaml) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      downloadYaml();
    }
  }, true);

  document.addEventListener("pointerdown", event => {
    const a = event.target?.closest?.("a[href*='flow.html']");
    if (!a) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    renderFlow();
  }, true);

  setInterval(ensureButtonName, 500);
  window.addEventListener("load", ensureButtonName);

  window.GTNH_FLOW_REAL = {
    buildRealYaml,
    renderYaml,
    renderFlow,
    copyYaml,
    downloadYaml,
    downloadSvg
  };
})();
