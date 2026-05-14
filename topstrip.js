/* === GTNH Workbench top strip v3: no redundant Flow button === */
(() => {
  "use strict";

  if (window.__GTNH_WORKBENCH_TOPSTRIP_V3__) return;
  window.__GTNH_WORKBENCH_TOPSTRIP_V3__ = true;

  function smallHint(text) {
    let el = document.getElementById("gtnhSmallHint");

    if (!el) {
      el = document.createElement("div");
      el.id = "gtnhSmallHint";
      el.className = "gtnhSmallHint";
      document.body.appendChild(el);
    }

    el.textContent = text;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function openCalculator() {
    if (window.GTNH_CALC?.open) {
      window.GTNH_CALC.open();
    } else {
      smallHint("Calculator is still loading.");
    }
  }

  function openFavorites() {
    smallHint("Favorites are not built yet. Use recipe/usage for now.");
  }

  function createHelpModal() {
    if (document.getElementById("gtnhHelpOverlay")) return;

    const ov = document.createElement("div");
    ov.id = "gtnhHelpOverlay";
    ov.className = "gtnhHelpOverlay";

    ov.innerHTML = `
      <div class="gtnhHelpPanel" role="dialog" aria-modal="true" aria-label="GTNH Workbench help">
        <div class="gtnhHelpHead">
          <div>
            <h2>GTNH Workbench</h2>
            <p>NEI search, calculator planning, and gtnh-flow export.</p>
          </div>
          <button id="gtnhHelpClose" class="gtnhHelpClose" type="button" aria-label="Close help">×</button>
        </div>

        <div class="gtnhHelpGrid">
          <section class="gtnhHelpCard">
            <h3>NEI</h3>
            <p><b>Tap / left click</b>: open recipe.</p>
            <p><b>Double tap / right click</b>: open usage.</p>
            <p><b>Hold</b>: copy exact item/fluid name.</p>
          </section>

          <section class="gtnhHelpCard">
            <h3>Calculator</h3>
            <p>Pick a target, choose a route, then build the recipe tree.</p>
            <p>Use route mode when multiple GTNH recipes exist.</p>
          </section>

          <section class="gtnhHelpCard">
            <h3>gtnh-flow</h3>
            <p>Inside Calculator → Code / Export → <b>gtnh-flow</b>.</p>
            <p>Exports YAML/SVG draft. Test serious lines in local gtnh-flow.</p>
          </section>

          <section class="gtnhHelpCard">
            <h3>Database</h3>
            <p><b>GTNH 2.8.x</b> is active.</p>
            <p>Older databases need separate data files before they can work.</p>
          </section>
        </div>

        <div class="gtnhHelpFooter">
          <button id="gtnhHelpStart" type="button">Close</button>
          <button id="gtnhHelpEveryTime" type="button">Show every visit</button>
          <button id="gtnhHelpNever" type="button">Don’t auto-open</button>
        </div>
      </div>
    `;

    document.body.appendChild(ov);

    function close() {
      ov.classList.remove("show");
    }

    document.getElementById("gtnhHelpClose")?.addEventListener("click", close);
    document.getElementById("gtnhHelpStart")?.addEventListener("click", () => {
      localStorage.setItem("gtnhnei_help_seen", "1");
      close();
    });
    document.getElementById("gtnhHelpEveryTime")?.addEventListener("click", () => {
      localStorage.setItem("gtnhnei_help_seen", "always");
      close();
      smallHint("Help will auto-open every visit.");
    });
    document.getElementById("gtnhHelpNever")?.addEventListener("click", () => {
      localStorage.setItem("gtnhnei_help_seen", "1");
      close();
      smallHint("Use Help to open this guide again.");
    });

    ov.addEventListener("click", event => {
      if (event.target === ov) close();
    });
  }

  function showHelp() {
    createHelpModal();
    document.getElementById("gtnhHelpOverlay")?.classList.add("show");
  }

  function showNeiDropdown(anchor) {
    let drop = document.getElementById("gtnhNeiDrop");

    if (!drop) {
      drop = document.createElement("div");
      drop.id = "gtnhNeiDrop";
      drop.className = "gtnhDrop";
      drop.innerHTML = `
        <button type="button" data-ver="2.8.x">✓ GTNH 2.8.x</button>
        <button type="button" data-ver="2.7.x">GTNH 2.7.x — not installed</button>
        <button type="button" data-ver="close">Close</button>
      `;

      document.body.appendChild(drop);

      drop.addEventListener("click", event => {
        const btn = event.target.closest("button");
        if (!btn) return;

        const ver = btn.dataset.ver;

        if (ver === "2.8.x") {
          localStorage.setItem("gtnhnei_database_version", "2.8.x");
          smallHint("Using GTNH 2.8.x database.");
        } else if (ver === "2.7.x") {
          smallHint("2.7.x data is not installed yet.");
        }

        drop.classList.remove("show");
      });
    }

    const r = anchor.getBoundingClientRect();

    drop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 235)) + "px";
    drop.style.top = Math.min(r.bottom + 6, window.innerHeight - 160) + "px";
    drop.classList.toggle("show");
  }

  function install() {
    if (!document.getElementById("gtnhToolStrip")) {
      const strip = document.createElement("nav");
      strip.id = "gtnhToolStrip";
      strip.className = "gtnhToolStrip";
      strip.setAttribute("aria-label", "GTNH Workbench tools");

      strip.innerHTML = `
        <button id="toolNei" class="gtnhToolBtn active" type="button">NEI ▾</button>
        <button id="toolCalc" class="gtnhToolBtn" type="button">Calculator</button>
        <button id="toolFav" class="gtnhToolBtn" type="button">Favorites</button>
        <button id="toolHelp" class="gtnhToolBtn" type="button">Help</button>
        <span id="toolDb" class="gtnhDbBadge" title="Current database: GTNH 2.8.x">DB: GTNH 2.8.x</span>
      `;

      const header = document.querySelector("header") || document.body.firstElementChild;

      if (header && header.parentNode) {
        header.parentNode.insertBefore(strip, header.nextSibling);
      } else {
        document.body.insertBefore(strip, document.body.firstChild);
      }
    }

    document.getElementById("toolNei")?.addEventListener("click", event => showNeiDropdown(event.currentTarget));
    document.getElementById("toolCalc")?.addEventListener("click", openCalculator);
    document.getElementById("toolFav")?.addEventListener("click", openFavorites);
    document.getElementById("toolHelp")?.addEventListener("click", showHelp);

    document.addEventListener("click", event => {
      const drop = document.getElementById("gtnhNeiDrop");
      if (!drop) return;

      if (
        event.target.closest("#gtnhNeiDrop") ||
        event.target.closest("#toolNei")
      ) {
        return;
      }

      drop.classList.remove("show");
    }, true);

    createHelpModal();

    const seen = localStorage.getItem("gtnhnei_help_seen");

    if (seen === "always") {
      setTimeout(showHelp, 550);
    } else if (!seen) {
      setTimeout(() => {
        smallHint("Help is in the top bar. gtnh-flow is inside Calculator → Code / Export.");
      }, 700);
      localStorage.setItem("gtnhnei_help_seen", "1");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
