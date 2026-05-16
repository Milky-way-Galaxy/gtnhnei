import {
  Repository,
  Item,
  Fluid,
  OreDict,
  Recipe,
  RecipeIoType
} from "./dist/repository.js";
import { SearchQuery } from "./dist/searchQuery.js";

const search = document.getElementById("search");
const clear = document.getElementById("clear");
const navBack = document.getElementById("navBack");
const navForward = document.getElementById("navForward");
const status = document.getElementById("status");
const breadcrumb = document.getElementById("breadcrumb");
const machineTabs = document.getElementById("machineTabs");
const grid = document.getElementById("grid");
const recipePage = document.getElementById("recipePage");
const tip = document.getElementById("tip");

let repo;
let allGoods = [];
let allItems = [];
let timer = null;
let tipTimer = null;
let activeTipAnchor = null;
let activeTipObj = null;
let activeTipText = "";

let historyStack = [];
let forwardStack = [];
let currentView = { type: "grid" };

let activeMachine = "All";
let currentRecipes = [];
let currentRecipeGroups = new Map();

const MAX_GRID_TOTAL = 420;
const GRID_PAGE_SIZE = 160;
const RECIPE_PAGE_SIZE = 8;

const machineIconCache = new Map();

let oreAnimTick = 0;
const animatedOreIcons = new Set();

function registerOreIcon(el, obj) {
  if (!(obj instanceof OreDict)) return;
  animatedOreIcons.add({ el, obj });
}

setInterval(() => {
  if (animatedOreIcons.size === 0) return;

  oreAnimTick++;

  for (const entry of Array.from(animatedOreIcons)) {
    if (!entry.el.isConnected) {
      animatedOreIcons.delete(entry);
      continue;
    }

    const items = entry.obj.items;
    if (!items || items.length === 0) continue;

    const shown = items[oreAnimTick % items.length];
    if (shown?.iconId !== undefined) {
      setIcon(entry.el, shown.iconId);
    }
  }
}, 550);

let currentSearchList = [];
let renderedGridCount = 0;

let currentRecipeList = [];
let renderedRecipeCount = 0;

function tierFromEu(eu) {
  const v = Number(eu);
  if (!Number.isFinite(v)) return "?";

  if (v <= 8) return "ULV";
  if (v <= 32) return "LV";
  if (v <= 128) return "MV";
  if (v <= 512) return "HV";
  if (v <= 2048) return "EV";
  if (v <= 8192) return "IV";
  if (v <= 32768) return "LuV";
  if (v <= 131072) return "ZPM";
  if (v <= 524288) return "UV";
  if (v <= 2097152) return "UHV";
  if (v <= 8388608) return "UEV";
  if (v <= 33554432) return "UIV";
  if (v <= 134217728) return "UMV";
  if (v <= 536870912) return "UXV";
  return "MAX+";
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function setIcon(el, iconId) {
  const ix = iconId % 256;
  const iy = Math.floor(iconId / 256);
  el.style.backgroundPosition = `${ix * -32}px ${iy * -32}px`;
}

function displayObj(obj) {
  if (obj instanceof OreDict) return obj.items[0] ?? null;
  return obj;
}

function nameOf(obj) {
  if (!obj) return "unknown";
  if (obj instanceof OreDict) return obj.id;
  return obj.name ?? obj.id ?? "unknown";
}

function typeOf(obj) {
  if (obj instanceof OreDict) return "OreDict";
  if (obj instanceof Fluid) return "Fluid";
  return "Item";
}

function placeTipNearAnchor(anchor, fallbackX = 16, fallbackY = 16) {
  if (!anchor) {
    return { x: fallbackX, y: fallbackY };
  }

  const r = anchor.getBoundingClientRect();

  return {
    x: r.right,
    y: r.top + r.height / 2
  };
}

function positionTip(anchor, fallbackX = 16, fallbackY = 16) {
  tip.style.left = "0px";
  tip.style.top = "0px";

  const margin = 8;
  const offset = 12;
  const rect = tip.getBoundingClientRect();

  const p = placeTipNearAnchor(anchor, fallbackX, fallbackY);

  let left = p.x + offset;
  let top = p.y - rect.height / 2;

  if (left + rect.width > window.innerWidth - margin) {
    const ar = anchor?.getBoundingClientRect?.();
    left = ar ? ar.left - rect.width - offset : fallbackX - rect.width - offset;
  }

  if (top + rect.height > window.innerHeight - margin) {
    top = window.innerHeight - rect.height - margin;
  }

  if (top < margin) {
    top = margin;
  }

  left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin));

  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function showTip(obj, text, x = 16, y = 16, anchor = null) {
  activeTipAnchor = anchor;
  activeTipObj = obj;
  activeTipText = text;

  tip.innerHTML = `
    <div><b>${esc(nameOf(obj))}</b></div>
    <div style="color:#9fb3c8;font-size:12px;margin-top:4px">${typeOf(obj)} • ${esc(obj.mod ?? "unknown")}</div>
    <div style="color:#4cc9f0;font-size:12px;margin-top:4px">${esc(text)}</div>
  `;

  tip.style.display = "block";
  positionTip(anchor, x, y);

  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => {
    tip.style.display = "none";
    activeTipAnchor = null;
    activeTipObj = null;
    activeTipText = "";
  }, 2600);
}

function refreshTipPosition() {
  if (tip.style.display !== "none" && activeTipAnchor) {
    positionTip(activeTipAnchor);
  }
}

window.addEventListener("scroll", refreshTipPosition, true);
window.addEventListener("resize", refreshTipPosition);

async function load() { console.time("GTNH_LOAD_DEBUG_V1_total"); console.log("[GTNH] load start");
  console.time("GTNH_LOAD_DEBUG_V1_fetch"); const res = await fetch("data/data.bin"); console.timeEnd("GTNH_LOAD_DEBUG_V1_fetch"); console.log("[GTNH] fetch status", res.status, res.headers.get("content-length"));
  if (!res.ok) throw new Error("Failed to fetch data/data.bin");

  const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
  console.time("GTNH_LOAD_DEBUG_V1_gzip"); const buffer = await new Response(stream).arrayBuffer(); console.timeEnd("GTNH_LOAD_DEBUG_V1_gzip"); console.log("[GTNH] decompressed bytes", buffer.byteLength);

  console.time("GTNH_LOAD_DEBUG_V1_repo"); repo = Repository.load(buffer); console.timeEnd("GTNH_LOAD_DEBUG_V1_repo"); console.log("[GTNH] repo loaded");

  allGoods = [];
  allItems = [];

  for (const ptr of repo.items) {
    const item = repo.GetObject(ptr, Item);
    if (item) {
      allGoods.push(item);
      allItems.push(item);
    }
  }

  for (const ptr of repo.fluids) {
    const fluid = repo.GetObject(ptr, Fluid);
    if (fluid) allGoods.push(fluid);
  }

  status.textContent = `Loaded ${allGoods.length} items/fluids`;
      installAddonIconApi();
      
renderSearchGrid(false);
}

function updateNav() {
  navBack.disabled = historyStack.length === 0;
  navForward.disabled = forwardStack.length === 0;
}

function pushView(next) {
  historyStack.push(currentView);
  forwardStack = [];
  currentView = next;
  updateNav();
}

function restoreView(view) {
  currentView = view;

  if (view.type === "grid") {
    renderSearchGrid(false);
  } else if (view.type === "recipes") {
    renderRecipes(view.obj, view.mode, false);
  }

  updateNav();
}

function renderSearchGrid(push = true) {
  if (push) pushView({ type: "grid" });
  currentView = { type: "grid" };

  grid.style.display = "grid";
  recipePage.style.display = "none";
  machineTabs.style.display = "none";
  breadcrumb.style.display = "none";

  const q = search.value.trim();

  if (!q) {
    currentSearchList = allGoods.slice(0, MAX_GRID_TOTAL);
    status.textContent = `Showing ${currentSearchList.length} of ${allGoods.length} items/fluids`;
  } else {
    const query = new SearchQuery(q);
    currentSearchList = [];

    for (const obj of allGoods) {
      if (repo.IsObjectMatchingSearch(obj, query)) {
        currentSearchList.push(obj);
        if (currentSearchList.length >= MAX_GRID_TOTAL) break;
      }
    }

    status.textContent = `${currentSearchList.length} result(s), capped at ${MAX_GRID_TOTAL}`;
  }

  grid.innerHTML = "";
  renderedGridCount = 0;

  if (currentSearchList.length === 0) {
    grid.innerHTML = `<div class="empty">No results</div>`;
    updateNav();
    return;
  }

  appendGridItems();
  updateNav();
}

function appendGridItems() {
  if (renderedGridCount >= currentSearchList.length) return;

  const frag = document.createDocumentFragment();
  const end = Math.min(renderedGridCount + GRID_PAGE_SIZE, currentSearchList.length);

  for (let i = renderedGridCount; i < end; i++) {
    const obj = currentSearchList[i];

    const slot = document.createElement("div");
    slot.className = "slot";
    slot.title = nameOf(obj);

    const icon = document.createElement("div");
    icon.className = "icon";
    setIcon(icon, obj.iconId);

    slot.appendChild(icon);
    attachControls(slot, obj);
    frag.appendChild(slot);
  }

  renderedGridCount = end;

  const oldMore = grid.querySelector(".loadMore");
  if (oldMore) oldMore.remove();

  if (renderedGridCount < currentSearchList.length) {
    const more = document.createElement("div");
    more.className = "loadMore";
    more.textContent = `Scroll more to load ${currentSearchList.length - renderedGridCount} more...`;
    frag.appendChild(more);
  }

  grid.appendChild(frag);
}

function recipesFor(obj, mode) {
  const arr = mode === "Production" ? obj.production : obj.consumption;
  const out = [];

  for (const ptr of arr) {
    const recipe = repo.GetObject(ptr, Recipe);
    if (recipe) out.push(recipe);
  }

  return out;
}

function renderRecipes(obj, mode, push = true) {
  if (push) pushView({ type: "recipes", obj, mode });

  currentView = { type: "recipes", obj, mode };
  activeMachine = "All";
  currentRecipes = recipesFor(obj, mode);

  currentRecipeGroups = new Map();
  currentRecipeGroups.set("All", currentRecipes);

  for (const recipe of currentRecipes) {
    const m = recipeMachineName(recipe);
    if (!currentRecipeGroups.has(m)) currentRecipeGroups.set(m, []);
    currentRecipeGroups.get(m).push(recipe);
  }

  grid.style.display = "none";
  recipePage.style.display = "block";
  machineTabs.style.display = "flex";
  breadcrumb.style.display = "block";

  breadcrumb.textContent = `${mode} → ${nameOf(obj)}`;

  renderMachineTabs();
  renderRecipeList();
  updateNav();
}

function recipeMachineName(recipe) {
  return recipe.recipeType?.name ?? "Unknown Machine";
}

function machineRecipeText(recipe) {
  if (!recipe) return "";

  const parts = [];

  function walk(x, depth = 0) {
    if (!x || depth > 2) return;

    if (typeof x === "string") {
      parts.push(x);
      return;
    }

    if (typeof x === "number" || typeof x === "boolean") {
      return;
    }

    if (Array.isArray(x)) {
      for (const v of x.slice(0, 8)) walk(v, depth + 1);
      return;
    }

    if (typeof x === "object") {
      for (const v of Object.values(x).slice(0, 20)) {
        walk(v, depth + 1);
      }
    }
  }

  walk(recipe.recipeType);
  walk(recipe.id);

  return parts.join(" ");
}

function machineModPrefs(machineName, recipe = null) {
  const text = norm(`${machineName} ${machineRecipeText(recipe)}`);
  const prefs = [];

  if (text.includes("forestry")) prefs.push("forestry");
  if (text.includes("gregtech") || text.includes("gt ")) prefs.push("gregtech");
  if (text.includes("minecraft")) prefs.push("minecraft");
  if (text.includes("thaumcraft")) prefs.push("thaumcraft");
  if (text.includes("ender io") || text.includes("enderio")) prefs.push("enderio");
  if (text.includes("applied energistics") || text.includes("ae2")) prefs.push("appliedenergistics2");

  return prefs;
}

function machineCandidates(machineName, recipe = null) {
  const raw = String(machineName ?? "");
  const target = norm(raw);
  const text = norm(`${raw} ${machineRecipeText(recipe)}`);

  const names = new Set();

  function add(x) {
    const n = norm(x);
    if (n) names.add(n);
  }

  add(raw);
  add(raw.replace(/^multiblock\s+/i, ""));
  add(raw.replace(/^large\s+/i, ""));
  add(raw.replace(/\s+recipe$/i, ""));
  add(raw + " Machine");

  /*
    Manual aliases.
    These are intentionally conservative.
    Add exact/common machine names here instead of letting the code guess random outputs.
  */
  const aliases = [
    ["assembly line", [
      "assembly line",
      "advanced assembly line",
      "assembly line machine"
    ]],

    ["assembler", [
      "assembler",
      "assembling machine",
      "basic assembling machine",
      "lv assembling machine",
      "mv assembling machine",
      "hv assembling machine",
      "ev assembling machine"
    ]],

    ["circuit assembler", [
      "circuit assembler",
      "basic circuit assembler",
      "lv circuit assembler",
      "mv circuit assembler",
      "hv circuit assembler"
    ]],

    ["mixer", [
      "mixer",
      "basic mixer",
      "lv mixer",
      "mv mixer",
      "hv mixer"
    ]],

    ["multiblock mixer", [
      "mixer",
      "large mixer"
    ]],

    ["fluid canner", [
      "fluid canner",
      "basic fluid canner",
      "lv fluid canner",
      "mv fluid canner"
    ]],

    ["chemical reactor", [
      "chemical reactor",
      "basic chemical reactor",
      "lv chemical reactor",
      "mv chemical reactor"
    ]],

    ["large chemical reactor", [
      "large chemical reactor",
      "chemical reactor"
    ]],

    ["distillery", [
      "distillery",
      "basic distillery",
      "lv distillery",
      "mv distillery"
    ]],

    ["distillation tower", [
      "distillation tower",
      "distillery"
    ]],

    ["centrifuge", [
      "centrifuge",
      "basic centrifuge",
      "lv centrifuge",
      "mv centrifuge"
    ]],

    ["electrolyzer", [
      "electrolyzer",
      "basic electrolyzer",
      "lv electrolyzer",
      "mv electrolyzer"
    ]],

    ["arc furnace", [
      "arc furnace",
      "electric arc furnace"
    ]],

    ["electric furnace", [
      "electric furnace",
      "furnace"
    ]],

    ["alloy smelter", [
      "alloy smelter"
    ]],

    /*
      Forestry.
      There is no normal 'Forestry Assembler' name in many packs.
      Forestry recipes usually use these machine blocks instead.
    */
    ["forestry assembler", [
      "carpenter",
      "thermionic fabricator",
      "worktable",
      "forestry worktable"
    ]],

    ["carpenter", [
      "carpenter"
    ]],

    ["thermionic fabricator", [
      "thermionic fabricator"
    ]],

    ["squeezer", [
      "squeezer"
    ]],

    ["fermenter", [
      "fermenter"
    ]],

    ["forestry centrifuge", [
      "centrifuge"
    ]],

    ["moistener", [
      "moistener"
    ]],

    ["still", [
      "still"
    ]]
  ];

  for (const [key, vals] of aliases) {
    if (target.includes(key) || text.includes(key)) {
      for (const v of vals) add(v);
    }
  }

  // Generic useful fallbacks.
  if (target.includes("assembly line")) add("assembly line");
  else if (target.includes("assembler")) add("assembling machine");

  if (target.includes("mixer")) add("mixer");
  if (target.includes("canner")) add("fluid canner");
  if (target.includes("reactor")) add("chemical reactor");
  if (target.includes("distillery")) add("distillery");
  if (target.includes("centrifuge")) add("centrifuge");
  if (target.includes("electrolyzer")) add("electrolyzer");
  if (target.includes("compressor")) add("compressor");
  if (target.includes("macerator")) add("macerator");
  if (target.includes("extruder")) add("extruder");
  if (target.includes("furnace")) add("electric furnace");

  return [...names];
}

function machineItemScore(item, candidates, modPrefs) {
  const n = norm(item.name);
  const mod = norm(item.mod ?? "");
  let score = -999999;

  for (const c of candidates) {
    if (!c || c.length < 3) continue;

    let s = -999999;

    if (n === c) {
      s = 10000;
    } else if (n.endsWith(c)) {
      s = 8000;
    } else if (n.includes(c)) {
      s = 5500;
    } else if (c.includes(n) && n.length >= 6) {
      s = 3000;
    }

    if (s < 0) continue;

    // Prefer expected mod.
    for (const pref of modPrefs) {
      if (mod.includes(pref)) s += 1800;
    }

    // Prefer machine-ish names.
    if (
      n.includes("machine") ||
      n.includes("assembler") ||
      n.includes("assembling") ||
      n.includes("assembly line") ||
      n.includes("mixer") ||
      n.includes("canner") ||
      n.includes("reactor") ||
      n.includes("distillery") ||
      n.includes("centrifuge") ||
      n.includes("electrolyzer") ||
      n.includes("compressor") ||
      n.includes("macerator") ||
      n.includes("extruder") ||
      n.includes("furnace") ||
      n.includes("fabricator") ||
      n.includes("carpenter") ||
      n.includes("squeezer") ||
      n.includes("fermenter") ||
      n.includes("moistener") ||
      n.includes("still")
    ) {
      s += 900;
    }

    // Penalize obvious non-machine stuff.
    if (
      n.includes("dust") ||
      n.includes("ingot") ||
      n.includes("plate") ||
      n.includes("cell") ||
      n.includes("fluid") ||
      n.includes("bucket") ||
      n.includes("cover") ||
      n.includes("circuit") ||
      n.includes("wire") ||
      n.includes("cable") ||
      n.includes("pipe")
    ) {
      s -= 2500;
    }

    score = Math.max(score, s);
  }

  return score;
}

function findMachineIcon(machineName, recipe = null) {
  /*
    Correct fast mode:
    The official GTNH calculator uses recipeType.defaultCrafter.iconId.
    No guessing, no scanning all items, no wrong icons.
  */
  const iconId = recipe?.recipeType?.defaultCrafter?.iconId;
  return iconId === undefined ? null : iconId;
}

function renderMachineTabs() {
  const counts = new Map();
  counts.set("All", currentRecipes.length);

  for (const recipe of currentRecipes) {
    const m = recipeMachineName(recipe);
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }

  machineTabs.innerHTML = "";
  const frag = document.createDocumentFragment();

  for (const [name, count] of counts.entries()) {
    const b = document.createElement("button");
    b.className = "tab" + (name === activeMachine ? " active" : "");

    const sampleRecipe = name === "All"
          ? null
          : currentRecipes.find(r => recipeMachineName(r) === name);

        const iconId = findMachineIcon(name, sampleRecipe);

    if (iconId !== null && iconId !== undefined) {
      const ic = document.createElement("span");
      ic.className = "tabIcon";
      setIcon(ic, iconId);
      b.appendChild(ic);
    }

    const t = document.createElement("span");
    t.textContent = `${name} (${count})`;
    b.appendChild(t);

    b.addEventListener("click", () => {
      if (activeMachine === name) return;

      activeMachine = name;

      for (const tab of machineTabs.querySelectorAll(".tab")) {
        tab.classList.remove("active");
      }

      b.classList.add("active");

      recipePage.innerHTML = '<div class="empty">Loading recipes...</div>';

      requestAnimationFrame(() => {
        renderRecipeList();
      });
    });

    frag.appendChild(b);
  }

  machineTabs.appendChild(frag);
}

function renderRecipeList() {
  recipePage.innerHTML = "";

  currentRecipeList = currentRecipeGroups.get(activeMachine) ?? [];

  renderedRecipeCount = 0;

  status.textContent = `${currentView.mode}: ${nameOf(currentView.obj)} — ${currentRecipeList.length}/${currentRecipes.length} recipe(s)`;

  if (currentRecipeList.length === 0) {
    recipePage.innerHTML = `<div class="empty">No recipes in this machine tab.</div>`;
    return;
  }

  requestAnimationFrame(() => appendRecipeCards());
}

function appendRecipeCards() {
  if (renderedRecipeCount >= currentRecipeList.length) return;

  const frag = document.createDocumentFragment();
  const end = Math.min(renderedRecipeCount + RECIPE_PAGE_SIZE, currentRecipeList.length);

  for (let i = renderedRecipeCount; i < end; i++) {
    frag.appendChild(recipeCardNei(currentRecipeList[i]));
  }

  renderedRecipeCount = end;

  const oldMore = recipePage.querySelector(".loadMore");
  if (oldMore) oldMore.remove();

  if (renderedRecipeCount < currentRecipeList.length) {
    const more = document.createElement("div");
    more.className = "loadMore";
    more.textContent = `Scroll more to load ${currentRecipeList.length - renderedRecipeCount} more recipes...`;
    frag.appendChild(more);
  }

  recipePage.appendChild(frag);
}

function openProduction(obj) {
  recipePage.style.display = "block";
  grid.style.display = "none";
  machineTabs.style.display = "none";
  breadcrumb.style.display = "block";
  recipePage.innerHTML = '<div class="empty">Loading recipe...</div>';
  requestAnimationFrame(() => renderRecipes(obj, "Production", true));
}

function openUsage(obj) {
  recipePage.style.display = "block";
  grid.style.display = "none";
  machineTabs.style.display = "none";
  breadcrumb.style.display = "block";
  recipePage.innerHTML = '<div class="empty">Loading usage...</div>';
  requestAnimationFrame(() => renderRecipes(obj, "Usage", true));
}

async function copyExactName(obj, x, y, anchor = null) {
  try {
    await navigator.clipboard.writeText(nameOf(obj));
    showTip(obj, "Copied exact name", x, y, anchor);
  } catch {
    showTip(obj, "Copy failed", x, y, anchor);
  }
}

function attachControls(el, obj) {
  let tapCount = 0;
  let tapTimer = null;
  let holdTimer = null;
  let held = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let lastTouchTime = 0;

  function clearHold() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  function startHold(x, y) {
    held = false;
    moved = false;
    startX = x;
    startY = y;

    clearHold();

    holdTimer = setTimeout(() => {
      held = true;
      copyExactName(obj, startX, startY, el);
    }, 560);
  }

  function moveCheck(x, y) {
    if (Math.abs(x - startX) > 10 || Math.abs(y - startY) > 10) {
      moved = true;
      clearHold();
    }
  }

  el.addEventListener("mouseenter", (event) => {
    showTip(obj, "Left click/tap: recipe • Right click/double tap: usage • Hold: copy", event.clientX, event.clientY, el);
  });

  el.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearHold();
    openUsage(obj);
  });

  // Mouse / PC
  el.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    startHold(event.clientX, event.clientY);
  });

  el.addEventListener("mousemove", (event) => {
    moveCheck(event.clientX, event.clientY);
  });

  el.addEventListener("mouseup", clearHold);
  el.addEventListener("mouseleave", clearHold);

  el.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Ignore Android synthetic click after touch.
    if (Date.now() - lastTouchTime < 700) return;

    if (held) {
      held = false;
      return;
    }

    // PC left click should be instant. Use right click for usage.
    openProduction(obj);
  });

  // Touch / mobile
  el.addEventListener("touchstart", (event) => {
    const t = event.touches[0];
    lastTouchTime = Date.now();

    showTip(obj, "Tap: recipe • Double tap: usage • Hold: copy", t.clientX, t.clientY, el);
    startHold(t.clientX, t.clientY);
  }, { passive: true });

  el.addEventListener("touchmove", (event) => {
    const t = event.touches[0];
    moveCheck(t.clientX, t.clientY);
  }, { passive: true });

  el.addEventListener("touchend", (event) => {
    clearHold();

    if (held) {
      held = false;
      tapCount = 0;
      return;
    }

    if (moved) {
      tapCount = 0;
      return;
    }

    tapCount++;

    if (tapTimer) clearTimeout(tapTimer);

    tapTimer = setTimeout(() => {
      const count = tapCount;
      tapCount = 0;
      tapTimer = null;

      if (count >= 2) {
        openUsage(obj);
      } else {
        openProduction(obj);
      }
    }, 180);
  }, { passive: true });
}

function amountText(io) {
  if (io.goods instanceof Fluid) return `${io.amount} L`;
  if (io.amount === 1) return "";
  return `x${io.amount}`;
}

function ioBox(io) {
  const box = document.createElement("div");
  box.className = "goods";
  box.title = nameOf(io.goods);

  const shown = displayObj(io.goods);
  const icon = document.createElement("div");
  icon.className = "icon";
  if (shown) setIcon(icon, shown.iconId);
  registerOreIcon(icon, io.goods);

  const text = document.createElement("div");
  text.className = "goodsName";

  let extra = "";
  if (io.probability < 1) extra = ` (${Math.round(io.probability * 100)}%)`;

  text.textContent = `${amountText(io)} ${nameOf(io.goods)}${extra}`.trim();

  box.appendChild(icon);
  box.appendChild(text);

  attachControls(box, io.goods);

  return box;
}

function ioRow(recipe, label, types) {
  const block = document.createElement("div");
  block.className = "ioBlock";

  const l = document.createElement("div");
  l.className = "label";
  l.textContent = label;

  const items = document.createElement("div");
  items.className = "ioItems";

  let count = 0;

  for (const io of recipe.items) {
    if (types.includes(io.type)) {
      items.appendChild(ioBox(io));
      count++;
    }
  }

  if (count === 0) {
    const e = document.createElement("div");
    e.className = "goodsName";
    e.textContent = "none";
    items.appendChild(e);
  }

  block.appendChild(l);
  block.appendChild(items);

  return block;
}

function formatDuration(gt) {
  if (!gt) return null;
  const sec = gt.durationSeconds;
  if (sec === undefined || sec === null) return null;
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function recipeCard(recipe) {
  const card = document.createElement("div");
  card.className = "recipe";

  const head = document.createElement("div");
  head.className = "recipeHead";

  const left = document.createElement("div");

  const title = document.createElement("div");
  title.className = "recipeTitle";

  const machineIcon = findMachineIcon(recipeMachineName(recipe), recipe);
  if (machineIcon !== null && machineIcon !== undefined) {
    const ic = document.createElement("span");
    ic.className = "tabIcon";
    setIcon(ic, machineIcon);
    title.appendChild(ic);
  }

  const titleText = document.createElement("span");
  titleText.textContent = recipeMachineName(recipe);
  title.appendChild(titleText);

  const id = document.createElement("div");
  id.className = "recipeId";
  id.textContent = recipe.id ?? "";

  left.appendChild(title);
  left.appendChild(id);

  const badges = document.createElement("div");
  badges.className = "badges";

  if (recipe.gtRecipe) {
    const gt = recipe.gtRecipe;

    const tier = document.createElement("span");
    tier.className = "badge tier";
    tier.textContent = tierFromEu(gt.voltage);
    badges.appendChild(tier);

    const eu = document.createElement("span");
    eu.className = "badge eu";
    eu.textContent = `${gt.voltage ?? "?"} EU/t`;
    badges.appendChild(eu);

    const amp = document.createElement("span");
    amp.className = "badge";
    amp.textContent = `${gt.amperage ?? "?"}A`;
    badges.appendChild(amp);

    const dur = formatDuration(gt);
    if (dur) {
      const time = document.createElement("span");
      time.className = "badge time";
      time.textContent = dur;
      badges.appendChild(time);
    }
  }

  head.appendChild(left);
  head.appendChild(badges);

  card.appendChild(head);

  card.appendChild(ioRow(recipe, "Input", [
    RecipeIoType.ItemInput,
    RecipeIoType.OreDictInput,
    RecipeIoType.FluidInput
  ]));

  card.appendChild(ioRow(recipe, "Output", [
    RecipeIoType.ItemOutput,
    RecipeIoType.FluidOutput
  ]));

  return card;
}

grid.addEventListener("scroll", () => {
  if (currentView.type !== "grid") return;

  const nearBottom = grid.scrollTop + grid.clientHeight > grid.scrollHeight - 260;
  if (nearBottom) appendGridItems();
});

recipePage.addEventListener("scroll", () => {
  if (currentView.type !== "recipes") return;

  const nearBottom = recipePage.scrollTop + recipePage.clientHeight > recipePage.scrollHeight - 320;
  if (nearBottom) appendRecipeCards();
});




function inputItemTypes() {
  return [
    RecipeIoType.ItemInput,
    RecipeIoType.OreDictInput
  ];
}

function inputFluidTypes() {
  return [
    RecipeIoType.FluidInput
  ];
}

function outputItemTypes() {
  return [
    RecipeIoType.ItemOutput
  ];
}

function outputFluidTypes() {
  return [
    RecipeIoType.FluidOutput
  ];
}

function amountShort(io) {
  const amount = Number(io.amount ?? 0);

  if (io.goods instanceof Fluid) {
    if (amount >= 1000000) return `${Math.round(amount / 100000) / 10}M`;
    if (amount >= 1000) return `${Math.round(amount / 100) / 10}k`;
    return String(amount);
  }

  if (amount <= 1) return "";
  return String(amount);
}

function makeEmptySlot() {
  const slot = document.createElement("div");
  slot.className = "neiSlot emptySlot";
  return slot;
}

function makeNeiSlot(io) {
  const slot = document.createElement("div");
  slot.className = "neiSlot";
  slot.title = `${amountText(io)} ${nameOf(io.goods)}`.trim();

  const shown = displayObj(io.goods);
  const icon = document.createElement("div");
  icon.className = "icon";

  if (shown) setIcon(icon, shown.iconId);

  if (typeof registerOreIcon === "function") {
    registerOreIcon(icon, io.goods);
  }

  slot.appendChild(icon);

  const amt = amountShort(io);
  if (amt) {
    const amount = document.createElement("div");
    amount.className = "neiAmount";
    amount.textContent = amt;
    slot.appendChild(amount);
  }

  attachControls(slot, io.goods);
  return slot;
}

function makeSlotGrid(recipe, label, types, dimensionOffset) {
  const dims = recipe.recipeType?.dimensions;
  if (!dims) return null;

  const dimX = Number(dims[dimensionOffset] ?? 0);
  const dimY = Number(dims[dimensionOffset + 1] ?? 0);

  if (dimX <= 0 || dimY <= 0) return null;

  const count = dimX * dimY;
  const bySlot = new Map();

  for (const io of recipe.items) {
    if (!types.includes(io.type)) continue;

    const slot = Number(io.slot ?? -1);
    if (slot < 0 || slot >= count) continue;

    bySlot.set(slot, io);
  }

  if (bySlot.size === 0) return null;

  const wrap = document.createElement("div");
  wrap.className = "neiSubGrid";
  wrap.style.setProperty("--nei-cols", String(dimX));

  if (label) {
    const title = document.createElement("div");
    title.className = "neiGridLabel";
    title.textContent = label;
    wrap.appendChild(title);
  }

  for (let i = 0; i < count; i++) {
    const io = bySlot.get(i);
    wrap.appendChild(io ? makeNeiSlot(io) : makeEmptySlot());
  }

  return wrap;
}

function makeIoSide(recipe, label, itemTypes, fluidTypes, dimensionOffset) {
  const side = document.createElement("div");
  side.className = "neiIoSide";

  const title = document.createElement("div");
  title.className = "neiGridLabel";
  title.textContent = label;
  side.appendChild(title);

  const itemGrid = makeSlotGrid(recipe, "", itemTypes, dimensionOffset);
  const fluidGrid = makeSlotGrid(recipe, "", fluidTypes, dimensionOffset + 2);

  if (itemGrid) side.appendChild(itemGrid);
  if (fluidGrid) side.appendChild(fluidGrid);

  if (!itemGrid && !fluidGrid) {
    side.appendChild(makeEmptySlot());
  }

  return side;
}

function addBadges(recipe, badges) {
  let tierText = "";
  let euText = "";
  let ampText = "";
  let timeText = "";

  if (recipe.gtRecipe) {
    const gt = recipe.gtRecipe;

    tierText = tierFromEu(gt.voltage);
    euText = `${gt.voltage ?? "?"} EU/t`;
    ampText = `${gt.amperage ?? "?"}A`;
    timeText = formatDuration(gt) ?? "";

    const tier = document.createElement("span");
    tier.className = "badge tier";
    tier.textContent = tierText;
    badges.appendChild(tier);

    const eu = document.createElement("span");
    eu.className = "badge eu";
    eu.textContent = euText;
    badges.appendChild(eu);

    const amp = document.createElement("span");
    amp.className = "badge";
    amp.textContent = ampText;
    badges.appendChild(amp);

    if (timeText) {
      const time = document.createElement("span");
      time.className = "badge time";
      time.textContent = timeText;
      badges.appendChild(time);
    }
  }

  return { tierText, euText, ampText, timeText };
}

function recipeCardNei(recipe) {
  const dims = recipe.recipeType?.dimensions;
  const inputItemX = Number(dims?.[0] ?? 0);
  const inputItemY = Number(dims?.[1] ?? 0);

  const card = document.createElement("div");
  card.className = "recipe";

  if (inputItemX >= 7 || inputItemY >= 7) {
    card.classList.add("bigCrafting");
  }

  const head = document.createElement("div");
  head.className = "recipeHead";

  const left = document.createElement("div");

  const title = document.createElement("div");
  title.className = "recipeTitle";

  const machineIcon = findMachineIcon(recipeMachineName(recipe), recipe);
  if (machineIcon !== null && machineIcon !== undefined) {
    const ic = document.createElement("span");
    ic.className = "tabIcon";
    setIcon(ic, machineIcon);
    title.appendChild(ic);
  }

  const titleText = document.createElement("span");
  titleText.textContent = recipeMachineName(recipe);
  title.appendChild(titleText);

  left.appendChild(title);

  const badges = document.createElement("div");
  badges.className = "badges";
  const meta = addBadges(recipe, badges);

  head.appendChild(left);
  head.appendChild(badges);
  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "neiRecipeBody";

  const inputSide = makeIoSide(
    recipe,
    "Input",
    inputItemTypes(),
    inputFluidTypes(),
    0
  );

  const arrowWrap = document.createElement("div");
  arrowWrap.className = "neiArrowBox";

  const arrow = document.createElement("div");
  arrow.className = "neiArrow";
  arrow.textContent = "→";

  const machineLine = document.createElement("div");
  machineLine.className = "neiMachineLine";
  machineLine.textContent = meta.timeText ? `${meta.tierText} • ${meta.timeText}` : meta.tierText;

  const subLine = document.createElement("div");
  subLine.className = "neiSubLine";
  subLine.textContent = meta.euText ? `${meta.ampText} • ${meta.euText}` : "";

  arrowWrap.appendChild(arrow);
  arrowWrap.appendChild(machineLine);
  arrowWrap.appendChild(subLine);

  const outputSide = makeIoSide(
    recipe,
    "Output",
    outputItemTypes(),
    outputFluidTypes(),
    4
  );

  body.appendChild(inputSide);
  body.appendChild(arrowWrap);
  body.appendChild(outputSide);

  card.appendChild(body);
  return card;
}

search.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(() => renderSearchGrid(true), 150);
});

clear.addEventListener("click", () => {
  search.value = "";
  renderSearchGrid(true);
  search.focus();
});

navBack.addEventListener("click", () => {
  if (historyStack.length === 0) return;
  forwardStack.push(currentView);
  const prev = historyStack.pop();
  restoreView(prev);
});

navForward.addEventListener("click", () => {
  if (forwardStack.length === 0) return;
  historyStack.push(currentView);
  const next = forwardStack.pop();
  restoreView(next);
});

load().catch(err => {
  console.error(err);
  status.textContent = "ERROR: " + err.message;
});

// Hide tooltip when tapping/clicking empty space
function hideTip() {
  tip.style.display = "none";
  activeTipAnchor = null;
  activeTipObj = null;
  activeTipText = "";
  clearTimeout(tipTimer);
}

document.addEventListener("pointerdown", (event) => {
  const keepTooltip =
    event.target.closest(".slot") ||
    event.target.closest(".goods") ||
    event.target.closest(".tab") ||
    event.target.closest("button") ||
    event.target.closest("input") ||
    event.target.closest("#tip");

  if (!keepTooltip) {
    hideTip();
  }
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideTip();
  }
});

// Extra tooltip close rule:
// Only item/recipe icons keep tooltip. Search bar, close button, nav buttons,
// tabs, blank space, etc. close the tooltip.
document.addEventListener("pointerdown", (event) => {
  const isItemIcon =
    event.target.closest(".slot") ||
    event.target.closest(".neiSlot") ||
    event.target.closest(".goods");

  if (!isItemIcon && typeof hideTip === "function") {
    hideTip();
  }
}, true);

search.addEventListener("focus", () => {
  if (typeof hideTip === "function") hideTip();
});

clear.addEventListener("pointerdown", () => {
  if (typeof hideTip === "function") hideTip();
}, true);

navBack.addEventListener("pointerdown", () => {
  if (typeof hideTip === "function") hideTip();
}, true);

navForward.addEventListener("pointerdown", () => {
  if (typeof hideTip === "function") hideTip();
}, true);

machineTabs.addEventListener("pointerdown", () => {
  if (typeof hideTip === "function") hideTip();
}, true);






/* === GTNH NEI ADDON ICON API START === */
function installAddonIconApi() {
  try {
    window.GTNHNEI_ICON_API = {
      ready: true,

      findObjectByName(rawName) {
        const q = String(rawName || "").trim();
        const qLower = q.toLowerCase();
        const compact = qLower.replace(/[^a-z0-9]/g, "");

        if (!qLower || !Array.isArray(allGoods)) return null;

        function objName(o) {
          try {
            return String(nameOf(o) || o?.name || o?.id || "").toLowerCase();
          } catch {
            return String(o?.name || o?.id || "").toLowerCase();
          }
        }

        function objCompact(o) {
          return objName(o).replace(/[^a-z0-9]/g, "");
        }

        let obj =
          allGoods.find(o => objName(o) === qLower) ||
          allGoods.find(o => objCompact(o) === compact) ||
          allGoods.find(o => objName(o).includes(qLower)) ||
          allGoods.find(o => objCompact(o).includes(compact));

        // Stronger fallback: use the same GTNH calculator search engine.
        if (!obj && typeof SearchQuery !== "undefined" && repo) {
          try {
            const query = new SearchQuery(q);
            obj = allGoods.find(o => repo.IsObjectMatchingSearch(o, query));
          } catch {}
        }

        return obj || null;
      },

      setIconByName(el, rawName) {
        const obj = this.findObjectByName(rawName);

        if (!obj || obj.iconId === undefined || obj.iconId === null) {
          return false;
        }

        el.classList.add("icon");
        el.textContent = "";

        try {
          setIcon(el, obj.iconId);
          el.dataset.gtnhIconOk = "1";
          el.dataset.gtnhIconName = String(obj.name || obj.id || rawName);
          return true;
        } catch {
          return false;
        }
      }
    };

    window.dispatchEvent(new Event("gtnhnei-icons-ready"));
    console.log("GTNHNEI_ICON_API ready:", allGoods?.length || 0);
  } catch (err) {
    console.warn("Failed to install addon icon API", err);
  }
}
/* === GTNH NEI ADDON ICON API END === */


/* === GTNH NEI ICON DEBUG PANEL START === */
window.addEventListener("gtnhnei-icons-ready", () => {
  window.GTNHNEI_DEBUG_ICONS = function(rawQuery = "microprocessor") {
    const api = window.GTNHNEI_ICON_API;
    if (!api) {
      alert("GTNHNEI_ICON_API missing");
      return [];
    }

    const q = String(rawQuery || "").toLowerCase();
    const results = [];

    try {
      for (const obj of allGoods) {
        let n = "";
        try {
          n = String(nameOf(obj) || obj?.name || obj?.id || "");
        } catch {
          n = String(obj?.name || obj?.id || "");
        }

        if (n.toLowerCase().includes(q)) {
          results.push({
            name: n,
            id: obj?.id,
            iconId: obj?.iconId
          });
        }

        if (results.length >= 40) break;
      }
    } catch (err) {
      alert("check failed: " + err.message);
      return [];
    }

    console.table(results);
    alert(
      "Found " + results.length + " result(s) for: " + rawQuery + "\n\n" +
      results.slice(0, 12).map(x => x.name + " | iconId=" + x.iconId).join("\n")
    );

    return results;
  };
});
/* === GTNH NEI ICON DEBUG PANEL END === */



/* === GTNH NEI ICON API HARD OVERRIDE v10 START === */
(function installIconApiHardOverrideV10() {
  let tries = 0;

  function safeName(o) {
    try {
      if (typeof nameOf === "function") return String(nameOf(o) || o?.name || o?.id || "");
    } catch {}
    return String(o?.name || o?.id || "");
  }

  function compact(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function installNow() {
    tries++;

    try {
      if (
        typeof allGoods === "undefined" ||
        !Array.isArray(allGoods) ||
        allGoods.length === 0 ||
        typeof setIcon !== "function"
      ) {
        return false;
      }

      window.GTNHNEI_ICON_API = {
        ready: true,
        count: allGoods.length,

        findObjectByName(rawName) {
          const q = String(rawName || "").trim();
          const qLower = q.toLowerCase();
          const qCompact = compact(q);

          if (!qLower) return null;

          let obj =
            allGoods.find(o => safeName(o).toLowerCase() === qLower) ||
            allGoods.find(o => compact(safeName(o)) === qCompact) ||
            allGoods.find(o => safeName(o).toLowerCase().includes(qLower)) ||
            allGoods.find(o => compact(safeName(o)).includes(qCompact));

          if (!obj && typeof SearchQuery !== "undefined" && typeof repo !== "undefined" && repo) {
            try {
              const query = new SearchQuery(q);
              obj = allGoods.find(o => repo.IsObjectMatchingSearch(o, query));
            } catch {}
          }

          return obj || null;
        },

        setIconByName(el, rawName) {
          const obj = this.findObjectByName(rawName);

          if (!obj || obj.iconId === undefined || obj.iconId === null) {
            return false;
          }

          el.classList.add("icon");
          el.classList.remove("lunaIconFallback");
          el.textContent = "";

          try {
            setIcon(el, obj.iconId);
            el.dataset.gtnhIconOk = "1";
            el.dataset.gtnhIconName = safeName(obj);
            return true;
          } catch {
            return false;
          }
        }
      };

      window.GTNHNEI_DEBUG_ICONS = function(rawQuery = "") {
        const q = String(rawQuery || "").trim().toLowerCase();
        const qCompact = compact(q);
        const results = [];

        for (const obj of allGoods) {
          const n = safeName(obj);
          const nLower = n.toLowerCase();
          const nCompact = compact(n);

          if (!q || nLower.includes(q) || nCompact.includes(qCompact)) {
            results.push({
              name: n,
              id: obj?.id,
              iconId: obj?.iconId
            });
          }

          if (results.length >= 40) break;
        }

        console.table(results);
        alert(
          "Found " + results.length + " result(s) for: " + rawQuery + "\n\n" +
          results.slice(0, 14).map(x => x.name + " | iconId=" + x.iconId).join("\n")
        );

        return results;
      };

      window.dispatchEvent(new Event("gtnhnei-icons-ready"));
      console.log("GTNHNEI_ICON_API v10 ready:", allGoods.length);
      return true;
    } catch (err) {
      console.warn("GTNHNEI_ICON_API v10 failed:", err);
      return false;
    }
  }

  const timer = setInterval(() => {
    if (installNow() || tries >= 80) {
      clearInterval(timer);
      if (tries >= 80) console.warn("GTNHNEI_ICON_API v10 gave up.");
    }
  }, 250);
})();
 /* === GTNH NEI ICON API HARD OVERRIDE v10 END === */


/* === GTNH NEI MAIN NAV API v17 START === */
(() => {
  if (window.__GTNHNEI_MAIN_NAV_API_V17__) return;
  window.__GTNHNEI_MAIN_NAV_API_V17__ = true;

  function findByNameV17(name) {
    try {
      if (window.GTNHNEI_ICON_API?.findObjectByName) {
        return window.GTNHNEI_ICON_API.findObjectByName(name);
      }
    } catch {}

    try {
      const q = String(name || "").trim().toLowerCase();
      const compact = q.replace(/[^a-z0-9]/g, "");

      function n(o) {
        try {
          return String(nameOf(o) || o?.name || o?.id || "").toLowerCase();
        } catch {
          return String(o?.name || o?.id || "").toLowerCase();
        }
      }

      return (
        allGoods.find(o => n(o) === q) ||
        allGoods.find(o => n(o).replace(/[^a-z0-9]/g, "") === compact) ||
        allGoods.find(o => n(o).includes(q)) ||
        null
      );
    } catch {
      return null;
    }
  }

  window.GTNHNEI_MAIN_API = {
    recipe(name) {
      const obj = findByNameV17(name);
      if (!obj) return false;

      try {
        if (typeof openProduction === "function") {
          openProduction(obj);
          return true;
        }

        if (typeof showRecipes === "function") {
          showRecipes(obj, "Production", true);
          return true;
        }
      } catch {}

      return false;
    },

    usage(name) {
      const obj = findByNameV17(name);
      if (!obj) return false;

      try {
        if (typeof openUsage === "function") {
          openUsage(obj);
          return true;
        }

        if (typeof showRecipes === "function") {
          showRecipes(obj, "Usage", true);
          return true;
        }
      } catch {}

      return false;
    },

    async copy(name) {
      try {
        await navigator.clipboard.writeText(String(name || ""));
        return true;
      } catch {
        return false;
      }
    }
  };

  console.log("GTNHNEI_MAIN_API v17 ready");
})();
 /* === GTNH NEI MAIN NAV API v17 END === */

/* === GTNH NEI MAIN NAV API v17 START === */
(() => {
  if (window.__GTNHNEI_MAIN_NAV_API_V17__) return;
  window.__GTNHNEI_MAIN_NAV_API_V17__ = true;

  function findByNameV17(name) {
    try {
      if (window.GTNHNEI_ICON_API?.findObjectByName) {
        return window.GTNHNEI_ICON_API.findObjectByName(name);
      }
    } catch {}

    try {
      const q = String(name || "").trim().toLowerCase();
      const compact = q.replace(/[^a-z0-9]/g, "");

      function n(o) {
        try {
          return String(nameOf(o) || o?.name || o?.id || "").toLowerCase();
        } catch {
          return String(o?.name || o?.id || "").toLowerCase();
        }
      }

      return (
        allGoods.find(o => n(o) === q) ||
        allGoods.find(o => n(o).replace(/[^a-z0-9]/g, "") === compact) ||
        allGoods.find(o => n(o).includes(q)) ||
        null
      );
    } catch {
      return null;
    }
  }

  window.GTNHNEI_MAIN_API = {
    recipe(name) {
      const obj = findByNameV17(name);
      if (!obj) return false;

      try {
        if (typeof openProduction === "function") {
          openProduction(obj);
          return true;
        }

        if (typeof showRecipes === "function") {
          showRecipes(obj, "Production", true);
          return true;
        }
      } catch {}

      return false;
    },

    usage(name) {
      const obj = findByNameV17(name);
      if (!obj) return false;

      try {
        if (typeof openUsage === "function") {
          openUsage(obj);
          return true;
        }

        if (typeof showRecipes === "function") {
          showRecipes(obj, "Usage", true);
          return true;
        }
      } catch {}

      return false;
    },

    async copy(name) {
      try {
        await navigator.clipboard.writeText(String(name || ""));
        return true;
      } catch {
        return false;
      }
    }
  };

  console.log("GTNHNEI_MAIN_API v17 ready");
})();
 /* === GTNH NEI MAIN NAV API v17 END === */

/* === GTNHNEI DATA API v1 START === */
(() => {
  if (window.__GTNHNEI_DATA_API_V1__) return;
  window.__GTNHNEI_DATA_API_V1__ = true;

  let tries = 0;

  function installDataApi() {
    tries++;

    try {
      if (
        typeof allGoods === "undefined" ||
        !Array.isArray(allGoods) ||
        allGoods.length === 0 ||
        typeof recipesFor !== "function"
      ) {
        return false;
      }

      function compact(s) {
        return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      }

      function objName(o) {
        try {
          if (typeof nameOf === "function") return String(nameOf(o) || o?.name || o?.id || "");
        } catch {}
        return String(o?.name || o?.id || "");
      }

      function objType(o) {
        try {
          if (typeof typeOf === "function") return String(typeOf(o) || "");
        } catch {}
        return String(o?.type || "");
      }

      function findObjectByName(rawName) {
        const q = String(rawName || "").trim();
        const qLower = q.toLowerCase();
        const qCompact = compact(q);

        if (!qLower) return null;

        try {
          if (window.GTNHNEI_ICON_API?.findObjectByName) {
            const viaIconApi = window.GTNHNEI_ICON_API.findObjectByName(q);
            if (viaIconApi) return viaIconApi;
          }
        } catch {}

        try {
          return (
            allGoods.find(o => objName(o).toLowerCase() === qLower) ||
            allGoods.find(o => compact(objName(o)) === qCompact) ||
            allGoods.find(o => objName(o).toLowerCase().includes(qLower)) ||
            allGoods.find(o => compact(objName(o)).includes(qCompact)) ||
            null
          );
        } catch {
          return null;
        }
      }

      function getMachine(recipe) {
        try {
          if (typeof recipeMachineName === "function") {
            const m = recipeMachineName(recipe);
            if (m) return String(m);
          }
        } catch {}

        return String(
          recipe?.machine ||
          recipe?.m ||
          recipe?.machineName ||
          recipe?.map ||
          "Unknown machine"
        );
      }

      function getMachineText(recipe) {
        try {
          if (typeof machineRecipeText === "function") {
            const t = machineRecipeText(recipe);
            if (t) return String(t);
          }
        } catch {}

        return getMachine(recipe);
      }

      function pick(recipe, names) {
        for (const n of names) {
          if (recipe && recipe[n] !== undefined && recipe[n] !== null) return recipe[n];
        }
        return "";
      }

      function smallValue(v, depth = 0) {
        if (depth > 2) return "...";

        if (v === null || v === undefined) return "";
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          return String(v);
        }

        if (Array.isArray(v)) {
          return v.slice(0, 6).map(x => smallValue(x, depth + 1)).filter(Boolean).join(", ");
        }

        if (typeof v === "object") {
          const name = objName(v);
          const amount = pick(v, ["amount", "count", "qty", "n", "size"]);
          if (name) return amount ? `${amount} ${name}` : name;

          return Object.entries(v)
            .slice(0, 6)
            .map(([k, val]) => `${k}: ${smallValue(val, depth + 1)}`)
            .join(", ");
        }

        return String(v);
      }

      function ioGuess(recipe, mode) {
        const inputKeys = [
          "I", "in", "input", "inputs", "itemInputs", "fluidInputs",
          "inputItems", "inputFluids", "ingredients", "consumes"
        ];

        const outputKeys = [
          "O", "out", "output", "outputs", "itemOutputs", "fluidOutputs",
          "outputItems", "outputFluids", "products", "produces"
        ];

        const keys = mode === "input" ? inputKeys : outputKeys;
        const found = [];

        for (const k of keys) {
          if (recipe && recipe[k] !== undefined && recipe[k] !== null) {
            const text = smallValue(recipe[k]);
            if (text) found.push(text);
          }
        }

        return found.join(" | ");
      }

      function recipeSummary(recipe, index = 0) {
        const machine = getMachine(recipe);

        let cardHtml = "";
        try {
          if (typeof recipeCardNei === "function") {
            const node = recipeCardNei(recipe);
            if (node) {
              // Remove buttons from embedded calculator preview.
              // The calculator has its own buttons.
              node.querySelectorAll("button").forEach(b => b.remove());
              cardHtml = node.outerHTML;
            }
          }
        } catch (err) {
          cardHtml = "";
        }

        return {
          index,
          id: String(recipe?.id || recipe?.recipeId || `${machine}:${index}`),
          machine,
          machineText: getMachineText(recipe),
          eut: pick(recipe, ["eut", "EUt", "eu", "EU", "power", "euPerTick"]),
          duration: pick(recipe, ["dur", "duration", "time", "ticks"]),
          tier: pick(recipe, ["tier", "voltage", "voltageTier"]),
          inputText: ioGuess(recipe, "input"),
          outputText: ioGuess(recipe, "output"),
          cardHtml,
          keys: Object.keys(recipe || {}).slice(0, 24)
        };
      }

      function recipeListForName(rawName, mode) {
        const obj = findObjectByName(rawName);
        if (!obj) {
          return {
            ok: false,
            name: String(rawName || ""),
            error: "object-not-found",
            recipes: []
          };
        }

        let list = [];
        try {
          list = recipesFor(obj, mode) || [];
        } catch (err) {
          return {
            ok: false,
            name: objName(obj),
            type: objType(obj),
            iconId: obj?.iconId,
            error: String(err?.message || err),
            recipes: []
          };
        }

        return {
          ok: true,
          name: objName(obj),
          type: objType(obj),
          iconId: obj?.iconId,
          count: list.length,
          recipes: list.map((r, i) => recipeSummary(r, i))
        };
      }

      window.GTNHNEI_DATA_API = {
        ready: true,
        count: allGoods.length,

        find(rawName) {
          const obj = findObjectByName(rawName);
          if (!obj) return null;
          return {
            name: objName(obj),
            type: objType(obj),
            id: obj?.id,
            iconId: obj?.iconId
          };
        },

        production(rawName) {
          return recipeListForName(rawName, "Production");
        },

        usage(rawName) {
          return recipeListForName(rawName, "Usage");
        },

        openRecipe(rawName) {
          return window.GTNHNEI_MAIN_API?.recipe?.(rawName) || false;
        },

        openUsage(rawName) {
          return window.GTNHNEI_MAIN_API?.usage?.(rawName) || false;
        }
      };

      window.dispatchEvent(new Event("gtnhnei-data-api-ready"));
      console.log("GTNHNEI_DATA_API v1 ready:", allGoods.length);
      return true;
    } catch (err) {
      console.warn("GTNHNEI_DATA_API v1 failed:", err);
      return false;
    }
  }

  const timer = setInterval(() => {
    if (installDataApi() || tries >= 80) {
      clearInterval(timer);
      if (tries >= 80) console.warn("GTNHNEI_DATA_API v1 gave up.");
    }
  }, 250);
})();
/* === GTNHNEI DATA API v1 END === */

/* === GTNHNEI LIVE RECIPE CARD API v1 START === */
(() => {
  if (window.__GTNHNEI_LIVE_RECIPE_CARD_API_V1__) return;
  window.__GTNHNEI_LIVE_RECIPE_CARD_API_V1__ = true;

  let tries = 0;

  function installLiveCardApi() {
    tries++;

    try {
      if (
        typeof allGoods === "undefined" ||
        !Array.isArray(allGoods) ||
        allGoods.length === 0 ||
        typeof recipesFor !== "function" ||
        typeof recipeCardNei !== "function"
      ) {
        return false;
      }

      function compact(s) {
        return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      }

      function objName(o) {
        try {
          if (typeof nameOf === "function") return String(nameOf(o) || o?.name || o?.id || "");
        } catch {}
        return String(o?.name || o?.id || "");
      }

      function findObject(rawName) {
        const q = String(rawName || "").trim();
        const qLower = q.toLowerCase();
        const qCompact = compact(q);

        if (!qLower) return null;

        try {
          if (window.GTNHNEI_ICON_API?.findObjectByName) {
            const x = window.GTNHNEI_ICON_API.findObjectByName(q);
            if (x) return x;
          }
        } catch {}

        return (
          allGoods.find(o => objName(o).toLowerCase() === qLower) ||
          allGoods.find(o => compact(objName(o)) === qCompact) ||
          allGoods.find(o => objName(o).toLowerCase().includes(qLower)) ||
          allGoods.find(o => compact(objName(o)).includes(qCompact)) ||
          null
        );
      }

      function getRecipe(rawName, mode, index) {
        const obj = findObject(rawName);
        if (!obj) return null;

        const list = recipesFor(obj, mode) || [];
        return list[Number(index)] || null;
      }

      window.GTNHNEI_LIVE_RECIPE_CARD_API = {
        ready: true,

        mountProduction(rawName, index, mount) {
          const recipe = getRecipe(rawName, "Production", index);
          if (!recipe || !mount) return false;

          const card = recipeCardNei(recipe);
          if (!card) return false;

          mount.replaceChildren(card);
          return true;
        },

        mountUsage(rawName, index, mount) {
          const recipe = getRecipe(rawName, "Usage", index);
          if (!recipe || !mount) return false;

          const card = recipeCardNei(recipe);
          if (!card) return false;

          mount.replaceChildren(card);
          return true;
        }
      };

      window.dispatchEvent(new Event("gtnhnei-live-card-api-ready"));
      console.log("GTNHNEI_LIVE_RECIPE_CARD_API v1 ready");
      return true;
    } catch (err) {
      console.warn("GTNHNEI_LIVE_RECIPE_CARD_API v1 failed:", err);
      return false;
    }
  }

  const timer = setInterval(() => {
    if (installLiveCardApi() || tries >= 80) {
      clearInterval(timer);
      if (tries >= 80) console.warn("GTNHNEI_LIVE_RECIPE_CARD_API v1 gave up.");
    }
  }, 250);
})();
/* === GTNHNEI LIVE RECIPE CARD API v1 END === */

/* === GTNHNEI LIVE RECIPE CARD API v1 START === */
(() => {
  if (window.__GTNHNEI_LIVE_RECIPE_CARD_API_V1__) return;
  window.__GTNHNEI_LIVE_RECIPE_CARD_API_V1__ = true;

  let tries = 0;

  function installLiveCardApi() {
    tries++;

    try {
      if (
        typeof allGoods === "undefined" ||
        !Array.isArray(allGoods) ||
        allGoods.length === 0 ||
        typeof recipesFor !== "function" ||
        typeof recipeCardNei !== "function"
      ) {
        return false;
      }

      function compact(s) {
        return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      }

      function objName(o) {
        try {
          if (typeof nameOf === "function") return String(nameOf(o) || o?.name || o?.id || "");
        } catch {}
        return String(o?.name || o?.id || "");
      }

      function findObject(rawName) {
        const q = String(rawName || "").trim();
        const qLower = q.toLowerCase();
        const qCompact = compact(q);

        if (!qLower) return null;

        try {
          if (window.GTNHNEI_ICON_API?.findObjectByName) {
            const x = window.GTNHNEI_ICON_API.findObjectByName(q);
            if (x) return x;
          }
        } catch {}

        return (
          allGoods.find(o => objName(o).toLowerCase() === qLower) ||
          allGoods.find(o => compact(objName(o)) === qCompact) ||
          allGoods.find(o => objName(o).toLowerCase().includes(qLower)) ||
          allGoods.find(o => compact(objName(o)).includes(qCompact)) ||
          null
        );
      }

      function getRecipe(rawName, mode, index) {
        const obj = findObject(rawName);
        if (!obj) return null;

        const list = recipesFor(obj, mode) || [];
        return list[Number(index)] || null;
      }

      window.GTNHNEI_LIVE_RECIPE_CARD_API = {
        ready: true,

        mountProduction(rawName, index, mount) {
          const recipe = getRecipe(rawName, "Production", index);
          if (!recipe || !mount) return false;

          const card = recipeCardNei(recipe);
          if (!card) return false;

          mount.replaceChildren(card);
          return true;
        },

        mountUsage(rawName, index, mount) {
          const recipe = getRecipe(rawName, "Usage", index);
          if (!recipe || !mount) return false;

          const card = recipeCardNei(recipe);
          if (!card) return false;

          mount.replaceChildren(card);
          return true;
        }
      };

      window.dispatchEvent(new Event("gtnhnei-live-card-api-ready"));
      console.log("GTNHNEI_LIVE_RECIPE_CARD_API v1 ready");
      return true;
    } catch (err) {
      console.warn("GTNHNEI_LIVE_RECIPE_CARD_API v1 failed:", err);
      return false;
    }
  }

  const timer = setInterval(() => {
    if (installLiveCardApi() || tries >= 80) {
      clearInterval(timer);
      if (tries >= 80) console.warn("GTNHNEI_LIVE_RECIPE_CARD_API v1 gave up.");
    }
  }, 250);
})();
/* === GTNHNEI LIVE RECIPE CARD API v1 END === */

/* === GTNH-FLOW YAML EXPORT API v1 START === */
(() => {
  if (window.__GTNHNEI_FLOW_EXPORT_API_V1__) return;
  window.__GTNHNEI_FLOW_EXPORT_API_V1__ = true;

  let tries = 0;

  function installFlowExportApi() {
    tries++;

    try {
      if (
        typeof allGoods === "undefined" ||
        !Array.isArray(allGoods) ||
        allGoods.length === 0 ||
        typeof recipesFor !== "function"
      ) {
        return false;
      }

      function compact(s) {
        return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      }

      function objName(o) {
        try {
          if (typeof nameOf === "function") {
            const n = String(nameOf(o) || "");
            if (n && n !== "[object Object]") return n;
          }
        } catch {}

        return String(o?.name || o?.id || "");
      }

      function findObject(rawName) {
        const q = String(rawName || "").trim();
        const qLower = q.toLowerCase();
        const qCompact = compact(q);

        if (!qLower) return null;

        try {
          if (window.GTNHNEI_ICON_API?.findObjectByName) {
            const viaIcon = window.GTNHNEI_ICON_API.findObjectByName(q);
            if (viaIcon) return viaIcon;
          }
        } catch {}

        return (
          allGoods.find(o => objName(o).toLowerCase() === qLower) ||
          allGoods.find(o => compact(objName(o)) === qCompact) ||
          allGoods.find(o => objName(o).toLowerCase().includes(qLower)) ||
          allGoods.find(o => compact(objName(o)).includes(qCompact)) ||
          null
        );
      }

      function machineName(recipe) {
        try {
          if (typeof recipeMachineName === "function") {
            const m = recipeMachineName(recipe);
            if (m) return String(m);
          }
        } catch {}

        return String(
          recipe?.machine ||
          recipe?.m ||
          recipe?.machineName ||
          recipe?.map ||
          "machine"
        );
      }

      function machineText(recipe) {
        try {
          if (typeof machineRecipeText === "function") {
            const t = machineRecipeText(recipe);
            if (t) return String(t);
          }
        } catch {}

        try {
          const card = typeof recipeCardNei === "function" ? recipeCardNei(recipe) : null;
          if (card) return String(card.textContent || "");
        } catch {}

        return "";
      }

      function parseAmount(raw) {
        if (raw === null || raw === undefined) return 1;
        if (typeof raw === "number" && Number.isFinite(raw)) return raw;

        let s = String(raw).trim().toLowerCase();
        if (!s) return 1;

        s = s.replace(/,/g, "");

        const m = s.match(/([0-9]+(?:\.[0-9]+)?)([kmb])?/i);
        if (!m) return 1;

        let n = Number(m[1]);
        const suffix = (m[2] || "").toLowerCase();

        if (suffix === "k") n *= 1000;
        if (suffix === "m") n *= 1000000;
        if (suffix === "b") n *= 1000000000;

        if (!Number.isFinite(n)) return 1;
        return Math.round(n);
      }

      function ioAmount(io) {
        try {
          if (typeof amountText === "function") {
            const t = amountText(io);
            if (t) return parseAmount(t);
          }
        } catch {}

        return parseAmount(
          io?.amount ??
          io?.count ??
          io?.qty ??
          io?.n ??
          io?.size ??
          io?.stackSize ??
          1
        );
      }

      function ioName(io) {
        const candidates = [
          io?.obj,
          io?.object,
          io?.type,
          io?.item,
          io?.fluid,
          io?.stack,
          io?.ingredient,
          io?.value,
          io
        ];

        for (const c of candidates) {
          if (!c) continue;

          if (typeof c === "string") {
            const s = c.trim();
            if (s && s !== "[object Object]") return s;
          }

          if (typeof c === "object") {
            const n = objName(c).trim();
            if (n && n !== "[object Object]") return n;
          }
        }

        return "";
      }

      function addIo(map, io) {
        const name = ioName(io);
        if (!name) return;

        const amount = ioAmount(io);
        map[name] = (map[name] || 0) + amount;
      }

      function readIo(recipe, side) {
        const map = {};

        const inputFns = [];
        const outputFns = [];

        try { if (typeof inputItemTypes === "function") inputFns.push(inputItemTypes); } catch {}
        try { if (typeof inputFluidTypes === "function") inputFns.push(inputFluidTypes); } catch {}
        try { if (typeof outputItemTypes === "function") outputFns.push(outputItemTypes); } catch {}
        try { if (typeof outputFluidTypes === "function") outputFns.push(outputFluidTypes); } catch {}

        const fns = side === "in" ? inputFns : outputFns;

        for (const fn of fns) {
          try {
            const arr = fn(recipe) || [];
            for (const io of arr) addIo(map, io);
          } catch {}
        }

        return map;
      }

      function parseTier(text) {
        const m = String(text || "").match(/\b(ULV|LV|MV|HV|EV|IV|LuV|ZPM|UV|UHV|UEV|UIV|UMV|UXV|MAX)\b/i);
        return m ? m[1] : "LV";
      }

      function parseEu(text) {
        const m = String(text || "").replace(/,/g, "").match(/([0-9]+(?:\.[0-9]+)?)\s*EU\/t/i);
        return m ? Math.round(Number(m[1])) : 0;
      }

      function parseDur(text) {
        const s = String(text || "").toLowerCase();

        const sec = s.match(/([0-9]+(?:\.[0-9]+)?)\s*s\b/);
        if (sec) return Number(sec[1]);

        const tick = s.match(/([0-9]+(?:\.[0-9]+)?)\s*ticks?\b/);
        if (tick) return Number(tick[1]) / 20;

        return 1;
      }

      function yamlScalar(v) {
        if (typeof v === "number") return String(v);
        const s = String(v ?? "");
        if (/^[a-zA-Z0-9_ .+\-()[\]\/]+$/.test(s)) return s;
        return JSON.stringify(s);
      }

      function yamlMap(name, map) {
        const entries = Object.entries(map || {});
        if (!entries.length) return `  ${name}: {}`;

        return [
          `  ${name}:`,
          ...entries.map(([k, v]) => `    ${yamlScalar(k)}: ${yamlScalar(v)}`)
        ].join("\n");
      }

      function yamlForRecipe(rawName, routeIndex = 0, options = {}) {
        const obj = findObject(rawName);
        if (!obj) {
          return {
            ok: false,
            yaml: "",
            error: `Target not found: ${rawName}`
          };
        }

        const recipes = recipesFor(obj, "Production") || [];
        const recipe = recipes[Number(routeIndex)] || recipes[0];

        if (!recipe) {
          return {
            ok: false,
            yaml:
`# GTNH Workbench -> gtnh-flow draft
# No production recipe found for ${objName(obj)}
# This target may be raw material, loot, ore, or unresolved.

- m: manual
  tier: LV
  I: {}
  O:
    ${yamlScalar(objName(obj))}: ${yamlScalar(options.targetAmount || 1)}
  eut: 0
  dur: 1
  number: 1
`,
            error: "No production recipe found."
          };
        }

        const text = machineText(recipe);
        const m = machineName(recipe).toLowerCase();

        const tier = parseTier(text);
        const eut = parseEu(text);
        const dur = parseDur(text);

        const input = readIo(recipe, "in");
        const output = readIo(recipe, "out");

        const yaml =
`# GTNH Workbench -> gtnh-flow draft
# Target: ${objName(obj)}
# Route: ${Number(routeIndex) + 1}
# Machine: ${machineName(recipe)}
# Check this once with local gtnh-flow. Some GTNH recipe types may still need manual edits.

- m: ${yamlScalar(m)}
  tier: ${yamlScalar(tier)}
${yamlMap("I", input)}
${yamlMap("O", output)}
  eut: ${yamlScalar(eut)}
  dur: ${yamlScalar(dur)}
  number: 1
`;

        return {
          ok: true,
          target: objName(obj),
          routeIndex: Number(routeIndex),
          machine: machineName(recipe),
          tier,
          eut,
          dur,
          input,
          output,
          yaml
        };
      }

      window.GTNHNEI_FLOW_EXPORT_API = {
        ready: true,
        yamlForRecipe,
        yaml(rawName, routeIndex = 0, options = {}) {
          return yamlForRecipe(rawName, routeIndex, options).yaml;
        }
      };

      window.dispatchEvent(new Event("gtnhnei-flow-export-ready"));
      console.log("GTNHNEI_FLOW_EXPORT_API v1 ready");
      return true;
    } catch (err) {
      console.warn("GTNHNEI_FLOW_EXPORT_API v1 failed:", err);
      return false;
    }
  }

  const timer = setInterval(() => {
    if (installFlowExportApi() || tries >= 80) {
      clearInterval(timer);
      if (tries >= 80) console.warn("GTNHNEI_FLOW_EXPORT_API v1 gave up.");
    }
  }, 250);
})();
/* === GTNH-FLOW YAML EXPORT API v1 END === */

/* === GTNH-FLOW YAML EXPORT API v2 START === */
(() => {
  if (window.__GTNHNEI_FLOW_EXPORT_API_V2__) return;
  window.__GTNHNEI_FLOW_EXPORT_API_V2__ = true;

  let tries = 0;

  function installFlowExportApiV2() {
    tries++;

    try {
      if (
        typeof allGoods === "undefined" ||
        !Array.isArray(allGoods) ||
        allGoods.length === 0 ||
        typeof recipesFor !== "function" ||
        typeof recipeCardNei !== "function"
      ) {
        return false;
      }

      function compact(s) {
        return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      }

      function objName(o) {
        try {
          if (typeof nameOf === "function") {
            const n = String(nameOf(o) || "");
            if (n && n !== "[object Object]") return n;
          }
        } catch {}

        return String(o?.name || o?.id || "");
      }

      function findObject(rawName) {
        const q = String(rawName || "").trim();
        const qLower = q.toLowerCase();
        const qCompact = compact(q);

        if (!qLower) return null;

        try {
          if (window.GTNHNEI_ICON_API?.findObjectByName) {
            const viaIcon = window.GTNHNEI_ICON_API.findObjectByName(q);
            if (viaIcon) return viaIcon;
          }
        } catch {}

        return (
          allGoods.find(o => objName(o).toLowerCase() === qLower) ||
          allGoods.find(o => compact(objName(o)) === qCompact) ||
          allGoods.find(o => objName(o).toLowerCase().includes(qLower)) ||
          allGoods.find(o => compact(objName(o)).includes(qCompact)) ||
          null
        );
      }

      function machineName(recipe) {
        try {
          if (typeof recipeMachineName === "function") {
            const m = recipeMachineName(recipe);
            if (m) return String(m);
          }
        } catch {}

        return String(recipe?.machine || recipe?.m || recipe?.machineName || "machine");
      }

      function machineText(recipe) {
        try {
          const card = recipeCardNei(recipe);
          return String(card?.textContent || "");
        } catch {
          return "";
        }
      }

      function parseAmount(raw) {
        let s = String(raw ?? "1").trim().toLowerCase().replace(/,/g, "");
        const m = s.match(/([0-9]+(?:\.[0-9]+)?)([kmb])?/i);
        if (!m) return 1;

        let n = Number(m[1]);
        const suffix = String(m[2] || "").toLowerCase();

        if (suffix === "k") n *= 1000;
        if (suffix === "m") n *= 1000000;
        if (suffix === "b") n *= 1000000000;

        return Number.isFinite(n) ? Math.round(n) : 1;
      }

      function parseTier(text) {
        const m = String(text || "").match(/\b(ULV|LV|MV|HV|EV|IV|LuV|ZPM|UV|UHV|UEV|UIV|UMV|UXV|MAX)\b/i);
        return m ? m[1] : "LV";
      }

      function parseEu(text) {
        const m = String(text || "").replace(/,/g, "").match(/([0-9]+(?:\.[0-9]+)?)\s*EU\/t/i);
        return m ? Math.round(Number(m[1])) : 0;
      }

      function parseDur(text) {
        const s = String(text || "").toLowerCase();

        const h = s.match(/([0-9]+(?:\.[0-9]+)?)\s*h\b/);
        const min = s.match(/([0-9]+(?:\.[0-9]+)?)\s*m\b/);
        const sec = s.match(/([0-9]+(?:\.[0-9]+)?)\s*s\b/);
        const tick = s.match(/([0-9]+(?:\.[0-9]+)?)\s*ticks?\b/);

        let total = 0;
        if (h) total += Number(h[1]) * 3600;
        if (min) total += Number(min[1]) * 60;
        if (sec) total += Number(sec[1]);
        if (total > 0) return total;

        if (tick) return Number(tick[1]) / 20;

        return 1;
      }

      function cleanName(s) {
        s = String(s || "").trim();

        s = s.replace(/\s+/g, " ");
        s = s.replace(/^No recipe:\s*/i, "");
        s = s.replace(/\b\d+(\.\d+)?[kmb]?\b/ig, "").trim();

        if (!s) return "";
        if (/^(input|output|recipe|usage|copy|selected|open nei recipe|open nei usage)$/i.test(s)) return "";
        if (/^\d+$/.test(s)) return "";

        return s;
      }

      function getSlotName(el) {
        const attrs = [
          "data-gtnh-icon-name",
          "data-gtnh-name",
          "data-name",
          "data-item-name",
          "data-fluid-name",
          "title",
          "aria-label",
          "alt"
        ];

        for (const a of attrs) {
          const v = el.getAttribute?.(a);
          const c = cleanName(v);
          if (c) return c;
        }

        const ds = el.dataset || {};
        for (const k of Object.keys(ds)) {
          if (/name/i.test(k)) {
            const c = cleanName(ds[k]);
            if (c) return c;
          }
        }

        const img = el.querySelector?.("img[alt], img[title]");
        if (img) {
          const c = cleanName(img.getAttribute("alt") || img.getAttribute("title"));
          if (c) return c;
        }

        return "";
      }

      function getSlotAmount(el) {
        const text = String(el.textContent || "");
        return parseAmount(text);
      }

      function add(map, name, amount) {
        name = cleanName(name);
        if (!name) return;
        map[name] = (map[name] || 0) + (amount || 1);
      }

      function parseIoFromRenderedCard(recipe) {
        const input = {};
        const output = {};

        const host = document.createElement("div");
        host.style.position = "fixed";
        host.style.left = "-99999px";
        host.style.top = "0";
        host.style.width = "900px";
        host.style.visibility = "hidden";
        host.style.pointerEvents = "none";
        document.body.appendChild(host);

        try {
          const card = recipeCardNei(recipe);
          host.appendChild(card);

          const cardRect = card.getBoundingClientRect();
          const midX = cardRect.left + cardRect.width * 0.56;

          const candidates = [
            ...card.querySelectorAll(
              "[data-gtnh-icon-name], [data-gtnh-name], [data-name], [data-item-name], [data-fluid-name], [title], [aria-label], .neiSlot, .slot, .itemSlot, .recipeSlot, .ioSlot"
            )
          ];

          const seen = new Set();

          for (const el of candidates) {
            if (!(el instanceof HTMLElement)) continue;
            if (seen.has(el)) continue;
            seen.add(el);

            const rect = el.getBoundingClientRect();
            if (rect.width < 10 || rect.height < 10) continue;

            const name = getSlotName(el);
            if (!name) continue;

            if (name.toLowerCase() === machineName(recipe).toLowerCase()) continue;

            const amount = getSlotAmount(el);
            const cx = rect.left + rect.width / 2;

            if (cx < midX) add(input, name, amount);
            else add(output, name, amount);
          }
        } catch (err) {
          console.warn("Rendered-card IO parse failed:", err);
        } finally {
          host.remove();
        }

        return { input, output };
      }

      function yamlScalar(v) {
        if (typeof v === "number") return String(v);
        const s = String(v ?? "");
        if (/^[a-zA-Z0-9_ .+\-()[\]\/]+$/.test(s)) return s;
        return JSON.stringify(s);
      }

      function yamlMap(name, map) {
        const entries = Object.entries(map || {});
        if (!entries.length) return `  ${name}: {}`;

        return [
          `  ${name}:`,
          ...entries.map(([k, v]) => `    ${yamlScalar(k)}: ${yamlScalar(v)}`)
        ].join("\n");
      }

      function yamlForRecipe(rawName, routeIndex = 0, options = {}) {
        const obj = findObject(rawName);
        if (!obj) {
          return {
            ok: false,
            yaml: `# Target not found: ${rawName}\n`,
            error: `Target not found: ${rawName}`
          };
        }

        const recipes = recipesFor(obj, "Production") || [];
        const recipe = recipes[Number(routeIndex)] || recipes[0];

        if (!recipe) {
          return {
            ok: false,
            target: objName(obj),
            yaml:
`# GTNH Workbench -> gtnh-flow draft
# No production recipe found for ${objName(obj)}

- m: manual
  tier: LV
  I: {}
  O:
    ${yamlScalar(objName(obj))}: ${yamlScalar(options.targetAmount || 1)}
  eut: 0
  dur: 1
  number: 1
`,
            error: "No production recipe found."
          };
        }

        const text = machineText(recipe);
        const machine = machineName(recipe);
        const tier = parseTier(text);
        const eut = parseEu(text);
        const dur = parseDur(text);
        const parsed = parseIoFromRenderedCard(recipe);

        const yaml =
`# GTNH Workbench -> gtnh-flow draft
# Target: ${objName(obj)}
# Route: ${Number(routeIndex) + 1}
# Machine: ${machine}
# Draft. Test once with local gtnh-flow.

- m: ${yamlScalar(machine.toLowerCase())}
  tier: ${yamlScalar(tier)}
${yamlMap("I", parsed.input)}
${yamlMap("O", parsed.output)}
  eut: ${yamlScalar(eut)}
  dur: ${yamlScalar(dur)}
  number: 1
`;

        return {
          ok: true,
          target: objName(obj),
          routeIndex: Number(routeIndex),
          machine,
          tier,
          eut,
          dur,
          input: parsed.input,
          output: parsed.output,
          yaml
        };
      }

      window.GTNHNEI_FLOW_EXPORT_API = {
        ready: true,
        version: 2,
        yamlForRecipe,
        yaml(rawName, routeIndex = 0, options = {}) {
          return yamlForRecipe(rawName, routeIndex, options).yaml;
        }
      };

      window.dispatchEvent(new Event("gtnhnei-flow-export-ready"));
      console.log("GTNHNEI_FLOW_EXPORT_API v2 ready");
      return true;
    } catch (err) {
      console.warn("GTNHNEI_FLOW_EXPORT_API v2 failed:", err);
      return false;
    }
  }

  const timer = setInterval(() => {
    if (installFlowExportApiV2() || tries >= 80) {
      clearInterval(timer);
      if (tries >= 80) console.warn("GTNHNEI_FLOW_EXPORT_API v2 gave up.");
    }
  }, 250);
})();
/* === GTNH-FLOW YAML EXPORT API v2 END === */
