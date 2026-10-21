/* === GTNH NEI extras clean v30 === */
(() => {
  "use strict";

  const LUNA_TRIGGER = "lunaloves.";
  const LUNA_ITEM = "lunaloves. Statue";

  const lunaInputs = [
    ["Stargate Base", "64"],
    ["Stargate Ring Block", "64"],
    ["Microprocessor", "2.1B"],
    ["Super Tank", "1"],
    ["Neutronium Plate", "32"],
    ["Wetware Mainframe", "64"],
    ["Infinity Catalyst", "16"],
    ["Naquadah Alloy Plate", "64"],
    ["Gravi Star", "8"],
  ];

  let lunaBackArmed = false;

  function esc(x) {
    return String(x ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function toast(text) {
    let el = document.getElementById("lunaToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "lunaToast";
      el.setAttribute("role", "status");
      el.className = "lunaToast";
      document.body.appendChild(el);
    }
    const modal = document.getElementById("lunaEggOverlay");
    (modal?.open ? modal : document.body).appendChild(el);
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 1500);
  }

  function hydrateIcon(el, name) {
    const api = window.GTNHNEI_ICON_API;
    if (!api || typeof api.setIconByName !== "function") {
      el.textContent = fallback(name);
      el.classList.add("lunaIconFallback");
      return false;
    }

    const ok = api.setIconByName(el, name);
    if (!ok) {
      el.textContent = fallback(name);
      el.classList.add("lunaIconFallback");
      return false;
    }

    el.classList.remove("lunaIconFallback");
    return true;
  }

  function fallback(name) {
    const words = String(name || "?").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "?";
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.slice(0, 2).map(w => w[0]).join("").toUpperCase();
  }

  function slot(name, amount) {
    return `
      <button class="lunaSlot" type="button" data-luna-name="${esc(name)}" data-gtnh-icon="${esc(name)}" aria-label="${esc(amount)} × ${esc(name)}" title="${esc(name)}">
        <span class="lunaIcon" aria-hidden="true"></span>
        <span class="lunaAmount">${esc(amount)}</span>
      </button>
    `;
  }

  function createOverlay() {
    if (document.getElementById("lunaEggOverlay")) return;

    const overlay = document.createElement("dialog");
    overlay.id = "lunaEggOverlay";
    overlay.setAttribute("aria-labelledby", "lunaTitle");
    overlay.innerHTML = `
      <section class="lunaPanel">
        <header class="lunaHeader">
          <button id="lunaClose" class="lunaClose" type="button" aria-label="Close Luna Easter egg" autofocus>×</button>
          <span class="lunaBadge">Secret found · Easter egg</span>
          <h2 id="lunaTitle">lunaloves. Statue</h2>
          <p>A sacred statue for <span class="lunaPink">lunaloves.</span></p>
        </header>

        <div class="lunaBody">
        <p class="lunaFiction">A fictional tribute recipe, just for fun. Not available in GTNH or used by the planner.</p>
        <div class="lunaInfo">
          <b>lunaloves.</b>
          <span>Discord&nbsp; @lunaloves.</span>
          <span>ID&nbsp; 1148017991108284538</span>
        </div>

        <div class="lunaMachine">
          <div class="lunaMachineTop">
            <div class="lunaMachineIconBox">
              <span class="lunaIcon lunaMachineIcon" data-gtnh-icon="Assembler"></span>
            </div>
            <div>
              <h3>Assembler</h3>
              <p>No recipe conflicts • still not enough circuits</p>
            </div>
          </div>

          <div class="lunaStats">
            <span>UXV</span>
            <span>2,147,483,647 EU/t</span>
            <span>16A</span>
            <span>69h 42m</span>
          </div>

          <div class="lunaSectionTitle">Input</div>
          <p class="lunaHint">Tap an ingredient for recipes; double-tap or right-click for uses. Hold to copy its name.</p>
          <div class="lunaGrid">
            ${lunaInputs.map(([name, amount]) => slot(name, amount)).join("")}
          </div>

          <div class="lunaArrow">➜</div>

          <div class="lunaSectionTitle">Output</div>
          <button class="lunaOutput" type="button" aria-label="lunaloves. Statue" data-luna-name="${esc(LUNA_ITEM)}">
            <span class="lunaAvatarWrap">
              <img id="lunaAvatarImg" src="assets/easter/luna.png" alt="lunaloves. avatar">
            </span>
            <span class="lunaAmount">1</span>
          </button>

          <h3 class="lunaOutputName">lunaloves. Statue</h3>
          <p class="lunaDesc">A sacred statue for <span class="lunaPink">lunaloves.</span></p>

          <button id="lunaAssemble" class="lunaCopy lunaAssemble" type="button">Assemble statue ♡</button>
          <p id="lunaAssemblyStatus" class="lunaDesc" role="status">All imaginary ingredients supplied. Ready when you are.</p>
          <div class="lunaActions"><button id="lunaCopyRecipe" class="lunaCopy" type="button">Copy joke recipe</button>
          <button id="lunaShare" class="lunaCopy" type="button">Copy secret link</button></div>
        </div>
        </div>
      </section>
    `;

    document.body.appendChild(overlay);

    document.getElementById("lunaClose")?.addEventListener("click", closeLuna);
    overlay.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const buttons = [...overlay.querySelectorAll("button:not(:disabled)")];
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    overlay.addEventListener("click", event => {
      const r = overlay.getBoundingClientRect();
      if (event.target === overlay && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) closeLuna();
    });

    document.getElementById("lunaAssemble").addEventListener("click", event => {
      const assembled = overlay.classList.toggle("assembled");
      event.currentTarget.textContent = assembled ? "Reset assembly" : "Assemble statue ♡";
      document.getElementById("lunaAssemblyStatus").textContent = assembled
        ? "Statue assembled! (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄) No real EU or materials consumed."
        : "All imaginary ingredients supplied. Ready when you are.";
    });
    document.getElementById("lunaShare").addEventListener("click", async () => {
      const url = new URL(location.href);
      url.search = ""; url.hash = ""; url.searchParams.set("lunaloves", "1");
      try { await navigator.clipboard.writeText(url.href); toast("Secret link copied ♡"); }
      catch { toast("Copy failed. Open this page with ?lunaloves=1 to share."); }
    });

    document.getElementById("lunaCopyRecipe")?.addEventListener("click", async () => {
      const text =
`FICTIONAL EASTER EGG — not a GTNH recipe
lunaloves. Statue
Machine: Assembler
Tier: UXV
EU/t: 2,147,483,647
Amperage: 16A
Duration: 69h 42m
Discord: @lunaloves.
ID: 1148017991108284538

Inputs:
64x Stargate Base
64x Stargate Ring Block
2.1B Microprocessor
1x Super Tank
32x Neutronium Plate
64x Wetware Mainframe
16x Infinity Catalyst
64x Naquadah Alloy Plate
8x Gravi Star

Output:
1x lunaloves. Statue`;

      try {
        await navigator.clipboard.writeText(text);
        toast("Recipe copied.");
      } catch {
        toast("Copy failed.");
      }
    });

    installSlotControls(overlay);
    hydrateAllIcons(overlay);
    window.addEventListener("gtnhnei-icons-ready", () => hydrateAllIcons(overlay));
  }

  function hydrateAllIcons(root) {
    root.querySelectorAll("[data-gtnh-icon]").forEach(el => {
      const name = el.getAttribute("data-gtnh-icon");
      const icon = el.classList.contains("lunaIcon") ? el : el.querySelector(".lunaIcon");
      if (icon) hydrateIcon(icon, name);
    });
  }

  function openLuna() {
    createOverlay();
    const ov = document.getElementById("lunaEggOverlay");
    if (!ov.open) ov.showModal();
    hydrateAllIcons(ov);
  }

  function closeLuna() {
    document.getElementById("lunaEggOverlay")?.close();
  }

  function getLunaName(target) {
    const el = target.closest("[data-luna-name]");
    return el ? el.getAttribute("data-luna-name") : "";
  }

  function openRecipe(name) {
    if (name === LUNA_ITEM) {
      toast("Recipe: lunaloves. Statue");
      return;
    }

    const ok = window.GTNHNEI_MAIN_API?.recipe?.(name);
    if (ok) {
      closeLuna();
      lunaBackArmed = true;
    } else {
      toast("No recipe: " + name);
    }
  }

  function openUsage(name) {
    if (name === LUNA_ITEM) {
      toast("Usage: infinite usage.");
      return;
    }

    const ok = window.GTNHNEI_MAIN_API?.usage?.(name);
    if (ok) {
      closeLuna();
      lunaBackArmed = true;
    } else {
      toast("No usage: " + name);
    }
  }

  async function copyName(name) {
    try {
      await navigator.clipboard.writeText(name);
      toast("Copied: " + name);
    } catch {
      toast("Copy failed.");
    }
  }

  function installSlotControls(root) {
    let holdTimer = null;
    let held = false;
    let tapCount = 0;
    let tapTimer = null;
    let lastName = "";

    root.addEventListener("close", () => {
      clearTimeout(holdTimer); clearTimeout(tapTimer); tapCount = 0; held = false;
    });

    root.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      const name = getLunaName(event.target);
      if (!name) return;

      held = false;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        held = true;
        copyName(name);
      }, 650);
    }, true);

    root.addEventListener("pointerup", () => clearTimeout(holdTimer), true);
    root.addEventListener("pointercancel", () => clearTimeout(holdTimer), true);

    root.addEventListener("click", event => {
      const name = getLunaName(event.target);
      if (!name) return;

      event.preventDefault();
      event.stopPropagation();

      if (held) {
        held = false;
        return;
      }

      if (name !== lastName) {
        tapCount = 0;
        lastName = name;
      }

      tapCount++;
      clearTimeout(tapTimer);

      tapTimer = setTimeout(() => {
        const count = tapCount;
        tapCount = 0;
        if (count >= 2) openUsage(name);
        else openRecipe(name);
      }, 250);
    }, true);

    root.addEventListener("contextmenu", event => {
      const name = getLunaName(event.target);
      if (!name) return;

      event.preventDefault();
      event.stopPropagation();
      openUsage(name);
    }, true);
  }

  function installSearchTrigger() {
    const search = document.getElementById("search");
    if (!search) return;

    let lastOpen = 0;

    search.addEventListener("input", () => {
      const raw = String(search.value || "").trim();
      const q = raw.toLowerCase();

      if (q.startsWith("iconcheck ")) {
        const term = raw.slice("iconcheck ".length).trim();
        if (window.GTNHNEI_DEBUG_ICONS) window.GTNHNEI_DEBUG_ICONS(term);
        else toast("Icon check not ready yet.");
        return;
      }

      if (q === LUNA_TRIGGER && Date.now() - lastOpen > 800) {
        lastOpen = Date.now();
        openLuna();
      }
    });
  }


  function installBackReturn() {
    // If Luna opened a normal recipe/usage page, the FIRST site-back click returns to Luna.
    // But if the user clicks deeper into normal NEI after that, disable Luna return so back works normally.
    document.addEventListener("click", event => {
      if (!lunaBackArmed) return;

      const isBack = !!event.target.closest("#navBack");
      const luna = document.getElementById("lunaEggOverlay");
      const insideLuna = luna && luna.contains(event.target);

      if (!isBack && !insideLuna) {
        setTimeout(() => {
          lunaBackArmed = false;
        }, 0);
      }
    }, true);

    document.addEventListener("click", event => {
      if (!lunaBackArmed) return;

      const btn = event.target.closest("#navBack");
      if (!btn) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      openLuna();
      lunaBackArmed = false;
    }, true);
  }


  function init() {
    installSearchTrigger();
    installBackReturn();

    const params = new URLSearchParams(location.search);
    if (params.get("lunaloves") === "1") {
      setTimeout(openLuna, 700);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.GTNHNEIExtras = {
    openLunaStatue: openLuna,
    closeLunaStatue: closeLuna,
  };
})();
