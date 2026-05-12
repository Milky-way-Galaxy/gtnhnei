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
      el.className = "lunaToast";
      document.body.appendChild(el);
    }
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
      <button class="lunaSlot" type="button" data-luna-name="${esc(name)}" data-gtnh-icon="${esc(name)}">
        <span class="lunaIcon" aria-hidden="true"></span>
        <span class="lunaAmount">${esc(amount)}</span>
      </button>
    `;
  }

  function createOverlay() {
    if (document.getElementById("lunaEggOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "lunaEggOverlay";
    overlay.innerHTML = `
      <section class="lunaPanel" role="dialog" aria-label="lunaloves statue">
        <button id="lunaClose" class="lunaClose" type="button" aria-label="Close">×</button>

        <header class="lunaHeader">
          <h2>lunaloves. Statue</h2>
          <p>A sacred statue for <span class="lunaPink">lunaloves.</span></p>
        </header>

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
          <div class="lunaGrid">
            ${lunaInputs.map(([name, amount]) => slot(name, amount)).join("")}
          </div>

          <div class="lunaArrow">➜</div>

          <div class="lunaSectionTitle">Output</div>
          <button class="lunaOutput" type="button" data-luna-name="${esc(LUNA_ITEM)}">
            <span class="lunaAvatarWrap">
              <img id="lunaAvatarImg" src="assets/easter/luna.png" alt="lunaloves. avatar">
            </span>
            <span class="lunaAmount">1</span>
          </button>

          <h3 class="lunaOutputName">lunaloves. Statue</h3>
          <p class="lunaDesc">A sacred statue for <span class="lunaPink">lunaloves.</span></p>

          <button id="lunaCopyRecipe" class="lunaCopy" type="button">Copy recipe</button>
        </div>
      </section>
    `;

    document.body.appendChild(overlay);

    document.getElementById("lunaClose")?.addEventListener("click", closeLuna);
    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeLuna();
    });

    document.getElementById("lunaCopyRecipe")?.addEventListener("click", async () => {
      const text =
`lunaloves. Statue
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
    ov.classList.add("show");
    hydrateAllIcons(ov);
  }

  function closeLuna() {
    document.getElementById("lunaEggOverlay")?.classList.remove("show");
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

    root.addEventListener("pointerdown", event => {
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

      if (q.startsWith("icondebug ")) {
        const term = raw.slice("icondebug ".length).trim();
        if (window.GTNHNEI_DEBUG_ICONS) window.GTNHNEI_DEBUG_ICONS(term);
        else toast("Icon debug not ready yet.");
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


  function installLoader() {
    const loader = document.getElementById("bootLoader");
    if (!loader) return;

    const msg = loader.querySelector(".bootMsg");
    const messages = [
      "Fetching data/data.bin...",
      "Decompressing recipe database...",
      "Building GTNH item index...",
      "Preparing atlas icons...",
      "Almost done..."
    ];

    let i = 0;
    const timer = setInterval(() => {
      if (msg) msg.textContent = messages[i++ % messages.length];
    }, 900);

    function hide() {
      clearInterval(timer);
      loader.classList.add("hide");
      setTimeout(() => loader.remove(), 350);
    }

    window.addEventListener("gtnhnei-icons-ready", () => setTimeout(hide, 300), { once: true });

    const status = document.getElementById("status");
    if (status) {
      const obs = new MutationObserver(() => {
        const t = status.textContent || "";
        if (t.includes("Loaded") || t.includes("Showing")) {
          obs.disconnect();
          setTimeout(hide, 300);
        }
      });
      obs.observe(status, { childList: true, subtree: true, characterData: true });
    }

    setTimeout(() => {
      if (document.body.contains(loader)) hide();
    }, 12000);
  }

  function init() {
    installLoader();
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
