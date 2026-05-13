/* === GTNH tools horizontal strip v2: proper help modal === */
(() => {
  "use strict";

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
    el._timer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function openFlow() {
    location.href = "flow.html";
  }

  function openCalculator() {
    if (window.GTNH_CALC?.open) {
      window.GTNH_CALC.open();
    } else {
      smallHint("Calculator is still loading.");
    }
  }

  function openFavorites() {
    smallHint("Favorites are next: star items, then open them from this button.");
  }

  function createHelpModal() {
    if (document.getElementById("gtnhHelpOverlay")) return;

    const ov = document.createElement("div");
    ov.id = "gtnhHelpOverlay";
    ov.className = "gtnhHelpOverlay";

    ov.innerHTML = `
      <section class="gtnhHelpPanel" role="dialog" aria-label="GTNH NEI help">
        <div class="gtnhHelpHead">
          <div>
            <h2>GTNH NEI Controls</h2>
            <p>Recipe search, calculator planning, and flow diagrams.</p>
          </div>
          <button type="button" class="gtnhHelpClose" id="gtnhHelpClose">×</button>
        </div>

        <div class="gtnhHelpGrid">
          <article class="gtnhHelpCard">
            <h3>NEI</h3>
            <p><b>Tap / left click</b> opens the recipe.</p>
            <p><b>Double tap / right click</b> opens usage.</p>
            <p><b>Long press</b> will open the item menu later.</p>
          </article>

          <article class="gtnhHelpCard">
            <h3>Calculator</h3>
            <p>Pick a target item or fluid.</p>
            <p>If there are multiple recipes, choose the route.</p>
            <p>Set target amount or machine count.</p>
          </article>

          <article class="gtnhHelpCard">
            <h3>Flow</h3>
            <p>Flow will show generated factory diagrams.</p>
            <p>Export SVG / YAML later.</p>
            <p>Useful for things like epichlorohydrin lines.</p>
          </article>

          <article class="gtnhHelpCard">
            <h3>Versions</h3>
            <p><b>GTNH 2.8.x</b> is active.</p>
            <p>Older databases like 2.7.x need their own data files before they can work.</p>
          </article>
        </div>

        <div class="gtnhHelpFooter">
          <button type="button" id="gtnhHelpStart">Start</button>
          <button type="button" id="gtnhHelpEveryTime">Show every visit</button>
          <button type="button" id="gtnhHelpNever">Don’t auto-open</button>
        </div>
      </section>
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

    ov.addEventListener("click", e => {
      if (e.target === ov) close();
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
    drop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 215)) + "px";
    drop.style.top = Math.min(r.bottom + 6, window.innerHeight - 160) + "px";
    drop.classList.toggle("show");
  }

  function install() {
    if (!document.getElementById("gtnhToolStrip")) {
      const strip = document.createElement("nav");
      strip.id = "gtnhToolStrip";
      strip.className = "gtnhToolStrip";
      strip.innerHTML = `
        <button class="gtnhToolBtn active" id="toolNei" type="button">NEI ▼</button>
        <button class="gtnhToolBtn" id="toolCalc" type="button">Calculator</button>
        <button class="gtnhToolBtn" id="toolFlow" type="button">Flow</button>
        <button class="gtnhToolBtn" id="toolFav" type="button">Favorites</button>
        <button class="gtnhToolBtn" id="toolHelp" type="button">Help</button>
        <button class="gtnhToolBtn disabled" id="toolDb" type="button">GTNH 2.8.x</button>
      `;

      const header = document.querySelector("header") || document.body.firstElementChild;
      if (header && header.parentNode) {
        header.parentNode.insertBefore(strip, header.nextSibling);
      } else {
        document.body.insertBefore(strip, document.body.firstChild);
      }
    }

    document.getElementById("toolNei")?.addEventListener("click", e => showNeiDropdown(e.currentTarget));
    document.getElementById("toolCalc")?.addEventListener("click", openCalculator);
    document.getElementById("toolFlow")?.addEventListener("click", openFlow);
    document.getElementById("toolFav")?.addEventListener("click", openFavorites);
    document.getElementById("toolHelp")?.addEventListener("click", showHelp);
    document.getElementById("toolDb")?.addEventListener("click", e => showNeiDropdown(e.currentTarget));

    document.addEventListener("click", event => {
      const drop = document.getElementById("gtnhNeiDrop");
      if (!drop) return;
      if (
        event.target.closest("#gtnhNeiDrop") ||
        event.target.closest("#toolNei") ||
        event.target.closest("#toolDb")
      ) return;
      drop.classList.remove("show");
    }, true);

    createHelpModal();

    const seen = localStorage.getItem("gtnhnei_help_seen");
    if (!seen || seen === "always") {
      setTimeout(showHelp, 550);
    } else {
      setTimeout(() => {
        smallHint("Help is now in the top bar. NEI • Calculator • Flow • Favorites");
      }, 700);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
