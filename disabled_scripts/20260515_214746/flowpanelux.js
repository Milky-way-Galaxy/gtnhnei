/* === GTNH Workbench gtnh-flow panel UX v1 === */
(() => {
  if (window.__GTNH_FLOW_PANEL_UX_V1__) return;
  window.__GTNH_FLOW_PANEL_UX_V1__ = true;

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function panels() {
    return [
      document.getElementById("gtnhFlowRealPanel"),
      document.getElementById("gtnhFlowCalcPanel"),
      ...document.querySelectorAll(".gtnhFlowCalcPanel")
    ].filter(Boolean);
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
    el._timer = setTimeout(() => el.classList.remove("show"), 1300);
  }

  function centerGraph(wrap) {
    if (!wrap) return;
    wrap.scrollLeft = Math.max(0, (wrap.scrollWidth - wrap.clientWidth) / 2);
  }

  function enhancePanel(panel) {
    if (!panel || panel.dataset.flowUxDone === "1") return;

    const wrap = panel.querySelector(".gtnhFlowSvgWrap");
    if (!wrap) return;

    panel.dataset.flowUxDone = "1";

    let oldHead = panel.querySelector(".gtnhFlowHeader");
    if (oldHead) oldHead.classList.add("gtnhFlowUxHead");

    if (!oldHead) {
      oldHead = document.createElement("div");
      oldHead.className = "gtnhFlowUxHead";
      oldHead.innerHTML = `
        <div>
          <div class="gtnhFlowUxTitle">gtnh-flow</div>
          <div class="gtnhFlowUxSub">Browser preview. Export YAML/SVG for local gtnh-flow.</div>
        </div>
      `;
      panel.insertBefore(oldHead, panel.firstChild);
    }

    let tools = oldHead.querySelector(".gtnhFlowUxTools");
    if (!tools) {
      tools = document.createElement("div");
      tools.className = "gtnhFlowUxTools";
      tools.innerHTML = `
        <button type="button" data-flow-fit>Fit</button>
        <button type="button" data-flow-100>100%</button>
        <button type="button" data-flow-center>Center</button>
      `;
      oldHead.appendChild(tools);
    }

    tools.querySelector("[data-flow-fit]")?.addEventListener("click", () => {
      wrap.classList.add("gtnhFlowFit");
      wrap.scrollLeft = 0;
      toast("Fit view.");
    });

    tools.querySelector("[data-flow-100]")?.addEventListener("click", () => {
      wrap.classList.remove("gtnhFlowFit");
      requestAnimationFrame(() => centerGraph(wrap));
      toast("100% view.");
    });

    tools.querySelector("[data-flow-center]")?.addEventListener("click", () => {
      centerGraph(wrap);
      toast("Centered.");
    });

    requestAnimationFrame(() => centerGraph(wrap));
  }

  function scan() {
    for (const p of panels()) {
      if (visible(p)) enhancePanel(p);
    }
  }

  const mo = new MutationObserver(scan);
  mo.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("load", scan);
  window.addEventListener("resize", scan);
  setInterval(scan, 900);
})();
