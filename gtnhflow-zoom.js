/* === GTNH Flow Viewer Zoom/Pan v1 === */
(() => {
  "use strict";

  if (window.__GTNH_FLOW_ZOOM_V1__) return;
  window.__GTNH_FLOW_ZOOM_V1__ = true;

  const VIEWER_SELECTORS = [
    ".gtnhFlowBrowserViewer",
    ".realPyFlowViewer",
    "#gtnhFlowBrowserViewer",
    "#realPyFlowViewer"
  ];

  const MIN_SCALE = 0.08;
  const MAX_SCALE = 4.0;
  const STEP = 1.22;

  const viewerState = new WeakMap();

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function allViewers() {
    const out = [];
    const seen = new Set();

    for (const sel of VIEWER_SELECTORS) {
      for (const el of document.querySelectorAll(sel)) {
        if (!seen.has(el)) {
          seen.add(el);
          out.push(el);
        }
      }
    }

    return out;
  }

  function findSvg(viewer) {
    return viewer.querySelector("svg");
  }

  function isPlaceholderOnly(viewer) {
    return !findSvg(viewer);
  }

  function getSvgLogicalSize(svg) {
    if (!svg) return { width: 1000, height: 700 };

    const vb = svg.viewBox?.baseVal;
    if (vb && vb.width > 0 && vb.height > 0) {
      return {
        width: vb.width,
        height: vb.height
      };
    }

    const widthAttr = parseFloat(svg.getAttribute("width") || "");
    const heightAttr = parseFloat(svg.getAttribute("height") || "");

    if (Number.isFinite(widthAttr) && widthAttr > 0 && Number.isFinite(heightAttr) && heightAttr > 0) {
      return {
        width: widthAttr,
        height: heightAttr
      };
    }

    try {
      const box = svg.getBBox();
      if (box.width > 0 && box.height > 0) {
        return {
          width: box.width,
          height: box.height
        };
      }
    } catch {}

    const rect = svg.getBoundingClientRect();
    return {
      width: Math.max(1000, rect.width || 1000),
      height: Math.max(700, rect.height || 700)
    };
  }

  function getStage(viewer) {
    let stage = viewer.querySelector(":scope > .gtnhFlowZoomStage");

    if (stage) return stage;

    const svg = findSvg(viewer);
    if (!svg) return null;

    stage = document.createElement("div");
    stage.className = "gtnhFlowZoomStage";

    const parent = svg.parentNode;
    parent.insertBefore(stage, svg);
    stage.appendChild(svg);

    return stage;
  }

  function ensureHud(viewer) {
    let hud = viewer.querySelector(":scope > .gtnhFlowZoomHud");

    if (hud) return hud;

    hud = document.createElement("div");
    hud.className = "gtnhFlowZoomHud";

    hud.innerHTML = `
      <button type="button" data-flow-zoom="out" title="Zoom out">−</button>
      <button type="button" data-flow-zoom="in" title="Zoom in">+</button>
      <button type="button" data-flow-zoom="fit" title="Fit diagram to viewer">Fit</button>
      <button type="button" data-flow-zoom="reset" title="Reset zoom to 100%">100%</button>
      <button type="button" data-flow-zoom="full" title="Fullscreen viewer">Full</button>
      <span class="gtnhFlowZoomReadout">100%</span>
    `;

    viewer.insertBefore(hud, viewer.firstChild);

    hud.addEventListener("click", event => {
      const btn = event.target.closest("button[data-flow-zoom]");
      if (!btn) return;

      event.preventDefault();
      event.stopPropagation();

      const action = btn.dataset.flowZoom;
      const st = getState(viewer);

      if (action === "out") {
        zoomAtCenter(viewer, st.scale / STEP);
      } else if (action === "in") {
        zoomAtCenter(viewer, st.scale * STEP);
      } else if (action === "fit") {
        fitToViewer(viewer);
      } else if (action === "reset") {
        zoomAtCenter(viewer, 1);
      } else if (action === "full") {
        toggleFullscreen(viewer);
      }
    });

    return hud;
  }

  function ensureHint(viewer) {
    let hint = viewer.querySelector(":scope > .gtnhFlowZoomHint");
    if (hint) return hint;

    hint = document.createElement("div");
    hint.className = "gtnhFlowZoomHint";
    hint.textContent = "Drag to pan • pinch/Ctrl+wheel to zoom";

    viewer.appendChild(hint);

    return hint;
  }

  function getState(viewer) {
    let st = viewerState.get(viewer);

    if (!st) {
      st = {
        scale: 1,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        scrollStartX: 0,
        scrollStartY: 0,
        pointers: new Map(),
        pinchStartDist: 0,
        pinchStartScale: 1,
        lastTap: 0,
        fittedOnce: false
      };

      viewerState.set(viewer, st);
    }

    return st;
  }

  function updateReadout(viewer) {
    const st = getState(viewer);
    const readout = viewer.querySelector(".gtnhFlowZoomReadout");

    if (readout) {
      readout.textContent = `${Math.round(st.scale * 100)}%`;
    }
  }

  function applyScale(viewer) {
    const st = getState(viewer);
    const stage = getStage(viewer);
    const svg = findSvg(viewer);

    if (!stage || !svg) return;

    const size = getSvgLogicalSize(svg);

    stage.style.width = `${Math.max(1, size.width * st.scale)}px`;
    stage.style.height = `${Math.max(1, size.height * st.scale)}px`;
    stage.style.transform = `scale(${st.scale})`;

    svg.style.width = `${size.width}px`;
    svg.style.height = `${size.height}px`;

    updateReadout(viewer);
  }

  function setScaleKeepPoint(viewer, nextScale, clientX, clientY) {
    const st = getState(viewer);
    const oldScale = st.scale;
    nextScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);

    if (!Number.isFinite(nextScale) || Math.abs(nextScale - oldScale) < 0.0001) return;

    const rect = viewer.getBoundingClientRect();

    const x = clientX - rect.left + viewer.scrollLeft;
    const y = clientY - rect.top + viewer.scrollTop;

    const logicalX = x / oldScale;
    const logicalY = y / oldScale;

    st.scale = nextScale;
    applyScale(viewer);

    viewer.scrollLeft = logicalX * nextScale - (clientX - rect.left);
    viewer.scrollTop = logicalY * nextScale - (clientY - rect.top);
  }

  function zoomAtCenter(viewer, nextScale) {
    const rect = viewer.getBoundingClientRect();
    setScaleKeepPoint(viewer, nextScale, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function fitToViewer(viewer) {
    const st = getState(viewer);
    const svg = findSvg(viewer);

    if (!svg) return;

    const size = getSvgLogicalSize(svg);

    const availableW = Math.max(120, viewer.clientWidth - 24);
    const availableH = Math.max(120, viewer.clientHeight - 72);

    const scaleX = availableW / size.width;
    const scaleY = availableH / size.height;

    const next = clamp(Math.min(scaleX, scaleY) * 0.96, MIN_SCALE, 1.4);

    st.scale = next;
    applyScale(viewer);

    viewer.scrollLeft = Math.max(0, (size.width * next - viewer.clientWidth) / 2);
    viewer.scrollTop = Math.max(0, (size.height * next - viewer.clientHeight) / 2);
  }

  function toggleFullscreen(viewer) {
    viewer.classList.toggle("gtnhFlowZoomFullscreen");

    const btn = viewer.querySelector('[data-flow-zoom="full"]');
    if (btn) {
      btn.textContent = viewer.classList.contains("gtnhFlowZoomFullscreen") ? "Exit" : "Full";
    }

    setTimeout(() => fitToViewer(viewer), 80);
  }

  function distance(a, b) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function midpoint(a, b) {
    return {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2
    };
  }

  function attachEvents(viewer) {
    if (viewer.dataset.gtnhFlowZoomEvents === "1") return;
    viewer.dataset.gtnhFlowZoomEvents = "1";

    viewer.addEventListener("wheel", event => {
      if (!event.ctrlKey && !event.metaKey) return;

      event.preventDefault();

      const st = getState(viewer);
      const factor = event.deltaY > 0 ? 1 / STEP : STEP;

      setScaleKeepPoint(viewer, st.scale * factor, event.clientX, event.clientY);
    }, { passive: false });

    viewer.addEventListener("pointerdown", event => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      if (event.target.closest?.(".gtnhFlowZoomHud")) return;

      const st = getState(viewer);

      viewer.setPointerCapture?.(event.pointerId);
      st.pointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY
      });

      if (st.pointers.size === 1) {
        st.dragging = true;
        st.dragStartX = event.clientX;
        st.dragStartY = event.clientY;
        st.scrollStartX = viewer.scrollLeft;
        st.scrollStartY = viewer.scrollTop;
        viewer.classList.add("gtnhFlowZoomDragging");
      }

      if (st.pointers.size === 2) {
        const pts = [...st.pointers.values()];
        st.pinchStartDist = distance(pts[0], pts[1]);
        st.pinchStartScale = st.scale;
        st.dragging = false;
        viewer.classList.remove("gtnhFlowZoomDragging");
      }
    });

    viewer.addEventListener("pointermove", event => {
      const st = getState(viewer);

      if (!st.pointers.has(event.pointerId)) return;

      st.pointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY
      });

      if (st.pointers.size === 2) {
        event.preventDefault();

        const pts = [...st.pointers.values()];
        const d = distance(pts[0], pts[1]);
        const mid = midpoint(pts[0], pts[1]);

        if (st.pinchStartDist > 0) {
          const next = st.pinchStartScale * (d / st.pinchStartDist);
          setScaleKeepPoint(viewer, next, mid.x, mid.y);
        }

        return;
      }

      if (!st.dragging) return;

      event.preventDefault();

      const dx = event.clientX - st.dragStartX;
      const dy = event.clientY - st.dragStartY;

      viewer.scrollLeft = st.scrollStartX - dx;
      viewer.scrollTop = st.scrollStartY - dy;
    });

    function pointerEnd(event) {
      const st = getState(viewer);

      st.pointers.delete(event.pointerId);

      if (st.pointers.size === 0) {
        st.dragging = false;
        viewer.classList.remove("gtnhFlowZoomDragging");

        const now = Date.now();
        if (now - st.lastTap < 280 && event.pointerType !== "mouse") {
          fitToViewer(viewer);
        }
        st.lastTap = now;
      }

      if (st.pointers.size === 1) {
        const pt = [...st.pointers.values()][0];
        st.dragging = true;
        st.dragStartX = pt.clientX;
        st.dragStartY = pt.clientY;
        st.scrollStartX = viewer.scrollLeft;
        st.scrollStartY = viewer.scrollTop;
        viewer.classList.add("gtnhFlowZoomDragging");
      }
    }

    viewer.addEventListener("pointerup", pointerEnd);
    viewer.addEventListener("pointercancel", pointerEnd);
    viewer.addEventListener("pointerleave", event => {
      if (event.pointerType === "mouse") {
        const st = getState(viewer);
        st.dragging = false;
        st.pointers.clear();
        viewer.classList.remove("gtnhFlowZoomDragging");
      }
    });
  }

  function patchViewer(viewer) {
    if (!viewer || viewer.dataset.gtnhFlowZoomPatched === "1") {
      if (viewer && !isPlaceholderOnly(viewer)) {
        getStage(viewer);
        applyScale(viewer);
      }
      return;
    }

    viewer.dataset.gtnhFlowZoomPatched = "1";
    viewer.classList.add("gtnhFlowZoomReady");

    ensureHud(viewer);
    ensureHint(viewer);
    attachEvents(viewer);

    if (isPlaceholderOnly(viewer)) {
      return;
    }

    getStage(viewer);
    applyScale(viewer);

    const st = getState(viewer);
    if (!st.fittedOnce) {
      st.fittedOnce = true;
      setTimeout(() => fitToViewer(viewer), 80);
    }
  }

  function patchAll() {
    for (const viewer of allViewers()) {
      patchViewer(viewer);
    }
  }

  function observeViewerContent(viewer) {
    if (!viewer || viewer.dataset.gtnhFlowZoomObserved === "1") return;

    viewer.dataset.gtnhFlowZoomObserved = "1";

    const mo = new MutationObserver(() => {
      clearTimeout(viewer.__gtnhFlowZoomTimer);
      viewer.__gtnhFlowZoomTimer = setTimeout(() => {
        viewer.dataset.gtnhFlowZoomPatched = "";
        patchViewer(viewer);
      }, 80);
    });

    mo.observe(viewer, {
      childList: true,
      subtree: false
    });
  }

  function observeAll() {
    for (const viewer of allViewers()) {
      observeViewerContent(viewer);
    }
  }

  function start() {
    patchAll();
    observeAll();

    const bodyObserver = new MutationObserver(() => {
      clearTimeout(window.__gtnhFlowZoomBodyTimer);
      window.__gtnhFlowZoomBodyTimer = setTimeout(() => {
        patchAll();
        observeAll();
      }, 100);
    });

    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener("resize", () => {
      for (const viewer of allViewers()) {
        applyScale(viewer);
      }
    });

    window.GTNH_FLOW_ZOOM = {
      patchAll,
      fitAll() {
        for (const viewer of allViewers()) fitToViewer(viewer);
      },
      resetAll() {
        for (const viewer of allViewers()) zoomAtCenter(viewer, 1);
      },
      zoomOutAll() {
        for (const viewer of allViewers()) {
          const st = getState(viewer);
          zoomAtCenter(viewer, st.scale / STEP);
        }
      },
      zoomInAll() {
        for (const viewer of allViewers()) {
          const st = getState(viewer);
          zoomAtCenter(viewer, st.scale * STEP);
        }
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
