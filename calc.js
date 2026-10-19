import { installPlanner } from "./planner-ui.js";
installPlanner();

/* === CALCULATOR FRONT ACTION FIX v1 START === */
(() => {
  if (window.__GTNH_CALC_FRONT_ACTION_FIX_V1__) return;
  window.__GTNH_CALC_FRONT_ACTION_FIX_V1__ = true;

  let tapTimer = null;
  let lastTapName = "";
  let lastTapTime = 0;
  let longPressTimer = null;
  let suppressClickUntil = 0;

  function calcOverlay() {
    return document.getElementById("gtnhCalcOverlay");
  }

  function isInCalc(el) {
    const ov = calcOverlay();
    return !!(ov && el && ov.contains(el));
  }

  function clickCloseButton() {
    const ov = calcOverlay();
    if (!ov) return;

    const btn =
      ov.querySelector("#calcClose") ||
      ov.querySelector("[data-calc-close]") ||
      ov.querySelector("[aria-label='Close']") ||
      [...ov.querySelectorAll("button")].find(b => String(b.textContent || "").trim() === "×");

    if (btn) {
      btn.click();
      return;
    }

    // Conservative fallback. Do not set hidden=true because your open() may not undo it.
    ov.classList.remove("show", "open", "active");
    ov.style.display = "none";
  }

  function getSlotName(start) {
    const root = start?.closest?.(".gtnhEmbeddedNeiCard");
    if (!root) return "";

    let el = start;
    while (el && el !== root && el.nodeType === 1) {
      const ds = el.dataset || {};

      const name =
        ds.gtnhIconName ||
        ds.gtnhName ||
        ds.name ||
        ds.itemName ||
        ds.fluidName ||
        el.getAttribute("data-gtnh-icon-name") ||
        el.getAttribute("data-name") ||
        el.getAttribute("aria-label") ||
        el.getAttribute("title");

      if (name && String(name).trim()) {
        return String(name).trim();
      }

      el = el.parentElement;
    }

    return "";
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

  async function copyName(name) {
    try {
      await navigator.clipboard.writeText(name);
      toast("Copied: " + name);
    } catch {
      toast("Copy failed: " + name);
    }
  }

  function ensureReturnPill() {
    let pill = document.getElementById("gtnhCalcReturnPill");
    if (pill) return pill;

    pill = document.createElement("button");
    pill.id = "gtnhCalcReturnPill";
    pill.type = "button";
    pill.textContent = "Back to Calculator";
    pill.addEventListener("click", () => {
      const ov = calcOverlay();
      if (!ov) return;

      ov.classList.remove("gtnhCalcParked");
      ov.style.display = "";
      pill.classList.remove("show");
    });

    document.body.appendChild(pill);
    return pill;
  }

  function parkCalculator() {
    const ov = calcOverlay();
    if (!ov) return;

    ov.classList.add("gtnhCalcParked");
    ov.style.display = "none";

    const pill = ensureReturnPill();
    pill.classList.add("show");
  }

  function openRealNei(name, mode) {
    if (!name) return;

    // Do NOT fully close/reopen calculator. That causes rebuild lag.
    // Park it, open NEI, then let the return pill restore the same calculator DOM/state.
    parkCalculator();

    setTimeout(() => {
      try {
        if (mode === "usage") {
          window.GTNHNEI_MAIN_API?.usage?.(name);
        } else {
          window.GTNHNEI_MAIN_API?.recipe?.(name);
        }
      } catch (err) {
        console.warn("Failed to open NEI:", mode, name, err);
      }
    }, 60);
  }

  function stop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
  }

  // Fix the calculator buttons opening NEI behind the overlay.
  document.addEventListener("click", event => {
    const target = event.target;
    if (!isInCalc(target)) return;

    const recipeBtn = target.closest?.("[data-open-recipe]");
    const usageBtn = target.closest?.("[data-open-usage]");

    if (recipeBtn) {
      stop(event);
      openRealNei(recipeBtn.dataset.openRecipe, "recipe");
      return;
    }

    if (usageBtn) {
      stop(event);
      openRealNei(usageBtn.dataset.openUsage, "usage");
      return;
    }
  }, true);

  // Long press = copy.
  document.addEventListener("pointerdown", event => {
    const target = event.target;
    if (!isInCalc(target)) return;

    const name = getSlotName(target);
    if (!name) return;

    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      suppressClickUntil = Date.now() + 700;
      copyName(name);
    }, 650);
  }, true);

  document.addEventListener("pointerup", () => {
    clearTimeout(longPressTimer);
  }, true);

  document.addEventListener("pointercancel", () => {
    clearTimeout(longPressTimer);
  }, true);

  document.addEventListener("pointermove", () => {
    clearTimeout(longPressTimer);
  }, true);

  // Tap = recipe, double tap = usage.
  document.addEventListener("click", event => {
    const target = event.target;
    if (!isInCalc(target)) return;

    const name = getSlotName(target);
    if (!name) return;

    stop(event);

    if (Date.now() < suppressClickUntil) return;

    const now = Date.now();
    const isDouble = lastTapName === name && now - lastTapTime < 330;

    clearTimeout(tapTimer);

    if (isDouble) {
      lastTapName = "";
      lastTapTime = 0;
      openRealNei(name, "usage");
      return;
    }

    lastTapName = name;
    lastTapTime = now;

    tapTimer = setTimeout(() => {
      openRealNei(name, "recipe");
      lastTapName = "";
      lastTapTime = 0;
    }, 260);
  }, true);

  // Desktop right click = usage.
  document.addEventListener("contextmenu", event => {
    const target = event.target;
    if (!isInCalc(target)) return;

    const name = getSlotName(target);
    if (!name) return;

    stop(event);
    openRealNei(name, "usage");
  }, true);
})();
/* === CALCULATOR FRONT ACTION FIX v1 END === */
