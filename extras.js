/* =========================================================
   GTNH NEI Extras v6
   lunaloves. hidden NEI-style cursed recipe.
   Uses real GTNH atlas icons when possible.
   ========================================================= */

(() => {
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
    el._timer = setTimeout(() => {
      el.classList.remove("show");
    }, 2600);
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function shortFallback(name) {
    const words = String(name || "?")
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) return "?";
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();

    return words.slice(0, 2).map(w => w[0]).join("").toUpperCase();
  }

  function slot(name, amount = "", note = "") {
    return `
      <div class="lunaRecipeSlot lunaClickableItem" data-luna-name="${esc(name)}" data-gtnh-icon="${esc(name)}" title="${esc(name)}${note ? " • " + esc(note) : ""}">
        <div class="lunaRealIcon">${esc(shortFallback(name))}</div>
        ${amount ? `<div class="lunaRecipeAmount">${esc(amount)}</div>` : ""}
      </div>
    `;
  }

  function hydrateIcons(root) {
    const api = window.GTNHNEI_ICON_API;
    let successCount = 0;

    root.querySelectorAll("[data-gtnh-icon]").forEach(slotEl => {
      const name = slotEl.getAttribute("data-gtnh-icon");
      const iconEl = slotEl.querySelector(".lunaRealIcon");
      if (!iconEl) return;

      let ok = false;

      if (api && typeof api.setIconByName === "function") {
        ok = api.setIconByName(iconEl, name);
      }

      if (ok) {
        successCount++;
        iconEl.classList.remove("lunaIconFallback");
      } else {
        iconEl.classList.add("lunaIconFallback");
        iconEl.textContent = shortFallback(name);
      }
    });

    return successCount;
  }

  function hydrateIconsRetry(root) {
    let tries = 0;

    const run = () => {
      tries++;
      const count = hydrateIcons(root);

      if (count > 0 || tries >= 25) return;
      setTimeout(run, 250);
    };

    run();
    window.addEventListener("gtnhnei-icons-ready", () => hydrateIcons(root), { once: true });
  }

  function createEgg() {
    if (document.getElementById("lunaEggOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "lunaEggOverlay";

    overlay.innerHTML = `
      <div class="lunaEggCard lunaRecipeCard" role="dialog" aria-modal="true">
        <div class="lunaEggTop">
          <div>
            <div class="lunaEggTitle">lunaloves. Statue</div>
            <div class="lunaEggSub">
              A sacred statue for <span class="lunaPink">lunaloves.</span>
            </div>
          </div>
          <button class="lunaEggClose" id="lunaEggClose" type="button">×</button>
        </div>

        <div class="lunaDiscordBox">
          <div><b>lunaloves.</b></div>
          <div><b>Discord</b> @lunaloves.</div>
          <div><b>ID</b> 1148017991108284538</div>
        </div>

        <div class="lunaRecipeMachine">
          <div class="lunaMachineHeader">
            <div class="lunaMachineIcon" data-gtnh-icon="Assembler">
              <div class="lunaRealIcon lunaMachineRealIcon lunaIconFallback" data-luna-machine-icon="Assembler Table">ASM</div>
            </div>
            <div>
              <div class="lunaMachineName">Assembler</div>
              <div class="lunaMachineSub">No recipe conflicts • still not enough circuits</div>
            </div>
          </div>

          <div class="lunaRecipeBadges">
            <span>UXV</span>
            <span>2,147,483,647 EU/t</span>
            <span>16A</span>
            <span>69h 42m</span>
          </div>

          <div class="lunaRecipeBody">
            <div class="lunaRecipeSide">
              <div class="lunaRecipeLabel">Input</div>

              <div class="lunaRecipeGrid">
                ${slot("Stargate Base", "64")}
                ${slot("Stargate Ring Block", "64")}
                ${slot("Microprocessor", "2.1B")}

                ${slot("Super Tank", "1")}
                ${slot("Neutronium Plate", "32")}
                ${slot("Wetware Mainframe", "64")}

                ${slot("Infinity Catalyst", "16")}
                ${slot("Naquadah Alloy Plate", "64")}
                ${slot("Gravi Star", "8")}
              </div>
            </div>

            <div class="lunaRecipeArrow">➜</div>

            <div class="lunaRecipeSide lunaOutputSide">
              <div class="lunaRecipeLabel">Output</div>

              <div class="lunaOutputSlot lunaClickableItem" data-luna-name="lunaloves. Statue">
                <img id="lunaAvatarImg" src="assets/easter/lunaloves.png" alt="lunaloves. avatar">
                <div class="lunaAvatarFallback">PFP missing</div>
                <div class="lunaRecipeAmount">1</div>
              </div>

              <div class="lunaOutputName">lunaloves. Statue</div>
              <div class="lunaItemDesc">A sacred statue for <span class="lunaPink">lunaloves.</span></div>
              <div class="lunaOutputActions">
                <button id="lunaCopyRecipe" type="button">Copy recipe</button>
              </div>
            </div>
          </div>
        </div>
</div>
</div>
    `;

    document.body.appendChild(overlay);
    hydrateIconsRetry(overlay);

    const img = document.getElementById("lunaAvatarImg");
    const fallback = overlay.querySelector(".lunaAvatarFallback");

    img.addEventListener("error", () => {
      img.style.display = "none";
      fallback.style.display = "grid";
      toast("Missing assets/easter/lunaloves.png");
    });

    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeEgg();
    });

    document.getElementById("lunaEggClose").addEventListener("click", closeEgg);

    document.getElementById("lunaCopyRecipe")?.addEventListener("click", async () => {
      const text =
`lunaloves. Statue
Machine: Assembler
Tier: UXV
EU/t: 2,147,483,647
Amperage: 16A
Duration: 69h 42m

Requested by: lunaloves.
Discord: @lunaloves.
ID: 1148017991108284538

Inputs:
64x Stargate Base
64x Stargate Ring Block
2,199,023,255,552x Microprocessor
1x Super Tank of Pure Confusion
32x Neutronium Plate
64x Wetware Mainframe
16x Infinity Catalyst
64x Naquadah Alloy Plate
8x Gravistar

Output:
1x lunaloves. Statue`;

      try {
        await navigator.clipboard.writeText(text);
        toast("Recipe copied.");
      } catch {
        toast("Copy failed. Blame AE2.");
      }
    });

    document.getElementById("lunaBlessStatue")?.addEventListener("click", () => {
      toast("Statue blessed. TPS unchanged.");
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeEgg();
    });
  }

  function openEgg() {
    createEgg();
    const overlay = document.getElementById("lunaEggOverlay");
    overlay.classList.add("show");

    // Force icon hydration after the main GTNH data/API is ready.
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (typeof hydrateIcons === "function") hydrateIcons(overlay);

      const ok = overlay.querySelector('[data-gtnh-icon-ok="1"], .lunaRealIcon[data-gtnh-icon-ok="1"]');
      if (ok || tries >= 30) clearInterval(timer);
    }, 250);
  }

  function closeEgg() {
    const overlay = document.getElementById("lunaEggOverlay");
    if (overlay) overlay.classList.remove("show");
  }

  function setupSearchSecret() {
    const search = document.getElementById("search");
    if (!search) return;

    let lastOpen = 0;

    search.addEventListener("input", () => {
      const raw = String(search.value || "").trim();
      const q = raw.toLowerCase();

      if (q.startsWith("icondebug ")) {
        const term = raw.slice("icondebug ".length).trim();
        if (window.GTNHNEI_DEBUG_ICONS) {
          window.GTNHNEI_DEBUG_ICONS(term);
        } else {
          toast("Icon debug not ready yet. Wait for data load.");
        }
        return;
      }

      const commands = new Set(["lunaloves."]);

      if (commands.has(q) && Date.now() - lastOpen > 900) {
        lastOpen = Date.now();
        openEgg();
      }
    });
  }

  function setupTitleTapSecret() {
    const title = document.querySelector(".title") || document.querySelector("h1");
    if (!title) return;

    let taps = 0;
    let timer = null;

    title.style.cursor = "pointer";
    title.title = "GTNH NEI";

    title.addEventListener("click", () => {
      taps++;

      clearTimeout(timer);
      timer = setTimeout(() => {
        taps = 0;
      }, 1200);

      if (taps === 4) toast("Extreme crafting noises...");
      if (taps >= 7) {
        taps = 0;
        openEgg();
      }
    });
  }

  function setupQuerySecret() {
    const params = new URLSearchParams(location.search);

    if (
      params.get("lunaloves") === "1" ||
      params.get("statue") === "lunaloves"
    ) {
      setTimeout(openEgg, 500);
    }
  }

  function setupHelpOnce() {
    if (localStorage.getItem("gtnhnei_help_seen_v6") === "1") return;

    const help = document.createElement("div");
    help.id = "extrasHelp";
    help.textContent = "Tips: tap = recipe • double tap = usage • hold = copy • one stupid secret exists.";
    document.body.appendChild(help);

    help.classList.add("show");

    setTimeout(() => {
      help.classList.remove("show");
      localStorage.setItem("gtnhnei_help_seen_v6", "1");
    }, 4200);
  }

  function init() {
    setupHelpOnce();
    setupSearchSecret();
    // setupTitleTapSecret(); // disabled: exact lunaloves search only
    setupQuerySecret();

    window.GTNHNEIExtras = {
      openLunaStatue: openEgg,
      closeLunaStatue: closeEgg
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();










/* === lunaloves final v26 === */
(() => {
  if (window.__LUNA_FINAL_V26__) return;
  window.__LUNA_FINAL_V26__ = true;

  let lunaBackArmed = false;

  function overlay() {
    return document.getElementById("lunaEggOverlay");
  }

  function input() {
    return document.querySelector("input[type='search'], input");
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
    el._timer = setTimeout(() => el.classList.remove("show"), 1400);
  }

  function showLuna() {
    const ov = overlay();
    if (!ov) return;

    ov.classList.add("show");

    const q = input();
    if (q) {
      q.value = "lunaloves.";
      q.dispatchEvent(new Event("input", { bubbles: true }));
    }

    lunaBackArmed = false;
  }

  function hideLuna() {
    const ov = overlay();
    if (ov) ov.classList.remove("show");
  }

  function getName(target) {
    const slot = target.closest(".lunaClickableItem");
    return slot ? slot.dataset.lunaName : "";
  }

  async function copyName(name) {
    try {
      await navigator.clipboard.writeText(name);
      toast("Copied: " + name);
    } catch {
      toast("Copy failed.");
    }
  }

  function armBack() {
    lunaBackArmed = true;
  }

  function recipe(name) {
    if (name === "lunaloves. Statue") {
      toast("Recipe: lunaloves. Statue");
      return;
    }

    const ok = window.GTNHNEI_MAIN_API?.recipe?.(name);
    if (ok) {
      hideLuna();
      armBack();
    } else {
      toast("No recipe: " + name);
    }
  }

  function usage(name) {
    if (name === "lunaloves. Statue") {
      toast("Usage: infinite usage.");
      return;
    }

    const ok = window.GTNHNEI_MAIN_API?.usage?.(name);
    if (ok) {
      hideLuna();
      armBack();
    } else {
      toast("No usage: " + name);
    }
  }

  // Real website back arrow.
  document.addEventListener("click", event => {
    if (!lunaBackArmed) return;

    const btn = event.target.closest("#navBack, button, [role='button']");
    if (!btn) return;

    if (btn.id !== "navBack") return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    showLuna();
  }, true);

  let holdTimer = null;
  let held = false;
  let tapTimer = null;
  let tapCount = 0;
  let lastName = "";

  document.addEventListener("pointerdown", event => {
    const name = getName(event.target);
    if (!name) return;

    held = false;
    clearTimeout(holdTimer);

    holdTimer = setTimeout(() => {
      held = true;
      copyName(name);
    }, 650);
  }, true);

  document.addEventListener("pointerup", () => clearTimeout(holdTimer), true);
  document.addEventListener("pointercancel", () => clearTimeout(holdTimer), true);

  document.addEventListener("click", event => {
    const name = getName(event.target);
    if (!name) return;

    event.preventDefault();
    event.stopPropagation();

    if (held) {
      held = false;
      return;
    }

    if (lastName !== name) {
      tapCount = 0;
      lastName = name;
    }

    tapCount++;
    clearTimeout(tapTimer);

    tapTimer = setTimeout(() => {
      const count = tapCount;
      tapCount = 0;
      if (count >= 2) usage(name);
      else recipe(name);
    }, 240);
  }, true);

  document.addEventListener("contextmenu", event => {
    const name = getName(event.target);
    if (!name) return;

    event.preventDefault();
    event.stopPropagation();

    usage(name);
  }, true);

  function hydrateMachineIcon() {
    for (const el of document.querySelectorAll(".lunaMachineRealIcon")) {
      if (el.dataset.gtnhIconOk === "1") continue;

      for (const name of ["Assembler", "Advanced Assembler", "Assembly Line"]) {
        try {
          const ok = window.GTNHNEI_ICON_API?.setIconByName?.(el, name);
          if (ok) {
            el.classList.remove("lunaIconFallback");
            el.dataset.lunaMachineIconName = name;
            break;
          }
        } catch {}
      }
    }
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    hydrateMachineIcon();
    if (tries >= 40) clearInterval(timer);
  }, 250);
})();
