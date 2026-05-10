import { GetScrollbarWidth, voltageTier, formatAmount, CoilTierNames, TIER_MV, getFusionTierByStartupCost } from "./utils.js";
import { Goods, Fluid, Item, Repository, Recipe, RecipeType, RecipeIoType, OreDict } from "./repository.js";
import { SearchQuery } from "./searchQuery.js";
import { ShowTooltip } from "./tooltip.js";
const repository = Repository.current;
const nei = document.getElementById("nei");
const neiScrollBox = nei.querySelector("#nei-scroll");
const neiContent = nei.querySelector("#nei-content");
const searchBox = nei.querySelector("#nei-search");
const neiTabs = nei.querySelector("#nei-tabs");
const neiBack = nei.querySelector("#nei-back");
const neiClose = nei.querySelector("#nei-close");
const elementSize = 36;
let currentGoods = null;
document.addEventListener("keydown", (event) => {
    if (nei.classList.contains("hidden"))
        return;
    // Handle Escape key
    if (event.key === "Escape") {
        if (searchBox.value == "") {
            HideNei();
        }
        else {
            searchBox.value = "";
            SearchChanged();
        }
        return;
    }
    if (event.key === "Backspace" && document.activeElement !== searchBox) {
        Back();
        return;
    }
    // Only handle printable characters
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && searchBox.value == "") {
        if (document.activeElement !== searchBox) {
            searchBox.focus();
        }
    }
});
searchBox.addEventListener("input", SearchChanged);
neiScrollBox.addEventListener("scroll", UpdateVisibleItems);
neiBack.addEventListener("click", Back);
neiClose.addEventListener("click", HideNei);
let unitWidth = 0, unitHeight = 0;
let scrollWidth = GetScrollbarWidth();
window.addEventListener("resize", Resize);
class ItemAllocator {
    CalculateWidth() { return 1; }
    CalculateHeight(obj) { return 1; }
    BuildRowDom(elements, elementWidth, elementHeight, rowY) {
        var dom = [];
        const isSelectingGoods = (showNeiCallback === null || showNeiCallback === void 0 ? void 0 : showNeiCallback.onSelectGoods) != null;
        const selectGoodsAction = isSelectingGoods ? ' data-action="select"' : "";
        const gridWidth = elements.length * 36;
        dom.push(`<div class="nei-items-row icon-grid" style="--grid-pixel-width:${gridWidth}px; --grid-pixel-height:36px; top:${elementSize * rowY}px">`);
        for (var i = 0; i < elements.length; i++) {
            var elem = elements[i];
            const gridX = (i % elements.length) * 36 + 2;
            const gridY = Math.floor(i / elements.length) * 36 + 2;
            dom.push(`<item-icon class="item-icon-grid" style="--grid-x:${gridX}px; --grid-y:${gridY}px" data-id="${elem.id}"${selectGoodsAction}></item-icon>`);
        }
        dom.push(`</div>`);
        return dom.join("");
    }
}
class NeiRecipeTypeInfo extends Array {
    constructor(type) {
        super();
        this.type = type;
        this.dimensions = type.dimensions;
        this.allocator = new RecipeTypeAllocator();
    }
    CalculateWidth() {
        var dims = this.dimensions;
        return Math.max(dims[0], dims[2]) + Math.max(dims[4], dims[6]) + 3;
    }
    CalculateHeight(recipe) {
        var dims = this.dimensions;
        var h = Math.max(dims[1] + dims[3], dims[5] + dims[7], 2) + 1;
        var gtRecipe = recipe.gtRecipe;
        if (gtRecipe != null) {
            h++;
            h += Math.ceil(gtRecipe.metadata.length / 2);
        }
        return h;
    }
    BuildRecipeItemGrid(dom, items, index, type, dimensionOffset) {
        var dimX = this.dimensions[dimensionOffset];
        if (dimX == 0)
            return index;
        var dimY = this.dimensions[dimensionOffset + 1];
        var count = dimX * dimY;
        const gridWidth = dimX * 36;
        const gridHeight = dimY * 36;
        dom.push(`<div class="icon-grid" style="--grid-pixel-width:${gridWidth}px; --grid-pixel-height:${gridHeight}px">`);
        for (; index < items.length; index++) {
            var item = items[index];
            if (item.type > type)
                break;
            if (item.slot >= count)
                continue;
            var goods = item.goods;
            const gridX = (item.slot % dimX) * 36 + 2;
            const gridY = Math.floor(item.slot / dimX) * 36 + 2;
            var iconAttrs = `class="item-icon-grid" style="--grid-x:${gridX}px; --grid-y:${gridY}px" data-id="${goods.id}"`;
            var amountText = formatAmount(item.amount);
            var isFluid = goods instanceof Fluid;
            var isGoods = goods instanceof Goods;
            if (isFluid || item.amount != 1)
                iconAttrs += ` data-amount="${amountText}"`;
            dom.push(`<item-icon ${iconAttrs}>`);
            if (item.probability < 1 && (type == RecipeIoType.ItemOutput || type == RecipeIoType.FluidOutput))
                dom.push(`<span class="probability">${Math.round(item.probability * 100)}%</span>`);
            dom.push(`</item-icon>`);
        }
        dom.push(`</div>`);
        return index;
    }
    BuildRecipeIoDom(dom, items, index, item, fluid, dimensionOffset) {
        dom.push(`<div class = "nei-recipe-items">`);
        index = this.BuildRecipeItemGrid(dom, items, index, item, dimensionOffset);
        index = this.BuildRecipeItemGrid(dom, items, index, fluid, dimensionOffset + 2);
        dom.push(`</div>`);
        return index;
    }
    FormatCircuitConflicts(circuitConflicts) {
        if (circuitConflicts === 0) {
            return "No recipe conflicts";
        }
        const conflictingCircuits = [];
        let n = circuitConflicts;
        while (n !== 0) {
            // Get position of rightmost set bit
            const pos = Math.log2(n & -n);
            conflictingCircuits.push(pos);
            // Remove rightmost set bit
            n = n & (n - 1);
        }
        if (conflictingCircuits.length === 1) {
            return `Recipe conflicts on circuit #${conflictingCircuits[0]}`;
        }
        return `Recipe conflicts on circuits #${conflictingCircuits.join(", #")}`;
    }
    BuildRowDom(elements, elementWidth, elementHeight, rowY, overrideIo) {
        let dom = [];
        const canSelectRecipe = (showNeiCallback === null || showNeiCallback === void 0 ? void 0 : showNeiCallback.onSelectRecipe) != null;
        for (let i = 0; i < elements.length; i++) {
            let recipe = elements[i];
            let recipeItems = overrideIo ? overrideIo : recipe.items;
            dom.push(`<div class="nei-recipe-box" style="left:${Math.round(i * elementWidth * elementSize)}px; top:${rowY * elementSize}px; width:${Math.round(elementWidth * elementSize)}px; height:${elementHeight * elementSize}px">`);
            dom.push(`<div class="nei-recipe-io">`);
            let index = this.BuildRecipeIoDom(dom, recipeItems, 0, RecipeIoType.OreDictInput, RecipeIoType.FluidInput, 0);
            dom.push(`<div class="arrow-container">`);
            dom.push(`<div class="arrow"></div>`);
            if (canSelectRecipe) {
                dom.push(`<button class="select-recipe-btn" data-recipe="${recipe.objectOffset}">+</button>`);
            }
            dom.push(`</div>`);
            this.BuildRecipeIoDom(dom, recipeItems, index, RecipeIoType.ItemOutput, RecipeIoType.FluidOutput, 4);
            dom.push(`</div>`);
            if (recipe.gtRecipe != null) {
                dom.push(`<span>${voltageTier[recipe.gtRecipe.voltageTier].name} • ${recipe.gtRecipe.durationSeconds}s`);
                if (recipe.gtRecipe.amperage != 1)
                    dom.push(` • ${recipe.gtRecipe.amperage}A`);
                dom.push(`</span><span class="text-small">${formatAmount(recipe.gtRecipe.voltage)}v • ${formatAmount(recipe.gtRecipe.voltage * recipe.gtRecipe.amperage * recipe.gtRecipe.durationTicks)}eu</span>`);
                for (const metadata of recipe.gtRecipe.metadata) {
                    let str = MetadataToString(metadata, recipe);
                    if (str != null) {
                        dom.push(`<span class="text-small">${str}</span>`);
                    }
                }
                dom.push(`<span class="text-small">${this.FormatCircuitConflicts(recipe.gtRecipe.circuitConflicts)}</span>`);
            }
            dom.push(`</div>`);
        }
        return dom.join("");
    }
}
const FuelTypeNames = ["Diesel", "Gas", "Hot", "Dense Steam", "Plasma", "Magic"];
function DisplayHeatRequired(heat, recipe) {
    var _a;
    let rawTier = Math.min(13, Math.max(0, (heat - 1800) / 900));
    let tier = Math.ceil(rawTier);
    if (tier > 0 && recipe.recipeType.name === "Blast Furnace") {
        let ebfTierSkip = TIER_MV + Math.ceil((rawTier - tier + 1) * 9);
        if (ebfTierSkip <= recipe.gtRecipe.voltageTier + 2) {
            if (recipe.gtRecipe.voltageTier >= ebfTierSkip)
                return "Heat: " + heat + "K (Volc " + CoilTierNames[tier] + " / EBF " + CoilTierNames[tier - 1] + ")";
            return "Heat: " + heat + "K (Volc " + CoilTierNames[tier] + " / " + ((_a = voltageTier[ebfTierSkip]) === null || _a === void 0 ? void 0 : _a.name) + " EBF " + CoilTierNames[tier - 1] + ")";
        }
    }
    return "Heat: " + heat + "K (" + CoilTierNames[tier] + ")";
}
function DisplayFusionTier(euToStart) {
    let tier = getFusionTierByStartupCost(euToStart);
    return "To start: " + formatAmount(euToStart) + " EU (T" + tier + ")";
}
function DisplayNkeRange(nke) {
    let min = nke % 10000;
    let max = Math.floor(nke / 10000);
    return "Kinetic energy: " + min + " - " + max + " MeV";
}
function MetadataToString(metadata, recipe) {
    switch (metadata.key) {
        case "low_gravity": return metadata.value == 1 ? "Requires low gravity" : null;
        case "cleanroom": return metadata.value == 1 ? "Requires cleanroom" : null;
        case "fuel_type": return `Fuel type: ${FuelTypeNames[metadata.value]}`;
        case "fuel_value": return `Fuel value: ${formatAmount(metadata.value)} EU/L`;
        case "fusion_threshold": return DisplayFusionTier(metadata.value);
        case "fog_plasma_multistep": return metadata.value == 1 ? "Multi-step plasma" : "Single-step plasma";
        case "fog_plasma_tier": return `Plasma tier: ${metadata.value}`;
        case "pcb_factory_tier":
        case "nano_forge_tier": return `Requires tier ${metadata.value}`;
        case "GLASS": return "Glass tier: " + voltageTier[metadata.value - 1].name;
        case "qft_focus_tier": return "QFT focus tier: " + metadata.value;
        case "recycle": return metadata.value == 1 ? "Recycle recipe" : null;
        case "coil_heat": return DisplayHeatRequired(metadata.value, recipe);
        case "nke_range": return DisplayNkeRange(metadata.value);
        default: return `${metadata.key}: ${formatAmount(metadata.value)}`;
    }
}
class RecipeTypeAllocator {
    CalculateWidth() { return -1; }
    CalculateHeight(obj) { return 1; }
    BuildRowDom(elements, elementWidth, elementHeight, rowY) {
        let single = elements[0];
        let dom = [];
        dom.push(`<div class="nei-recipe-type" style="top:${rowY * elementSize}px; width:${elementWidth * elementSize}px">`);
        for (let block of single.singleblocks) {
            if (block)
                dom.push(`<item-icon data-id="${block.id}"></item-icon>`);
        }
        for (let block of single.multiblocks) {
            dom.push(`<item-icon data-id="${block.id}"></item-icon>`);
        }
        dom.push(`<span class="nei-recipe-type-name">${single.name}</span>`);
        dom.push(`</div>`);
        return dom.join("");
    }
}
let itemAllocator = new ItemAllocator();
var FillNeiAllItems = function (grid, search) {
    var allocator = grid.BeginAllocation(itemAllocator);
    FillNeiItemsWith(allocator, search, Repository.current.fluids, Fluid);
    FillNeiItemsWith(allocator, search, Repository.current.items, Item);
};
function FillNeiItemsWith(grid, search, arr, proto) {
    var len = arr.length;
    for (var i = 0; i < len; i++) {
        var element = repository.GetObjectIfMatchingSearch(search, arr[i], proto);
        if (element !== null)
            grid.Add(element);
    }
}
var FillNeiAllRecipes = function (grid, search, recipes) {
    for (const recipeType of allRecipeTypes) {
        var list = recipes[recipeType.name];
        if (list.length > 0) {
            {
                let allocator = grid.BeginAllocation(list.allocator);
                allocator.Add(recipeType);
            }
            {
                let allocator = grid.BeginAllocation(list);
                for (let i = 0; i < list.length; i++) {
                    if (search == null || repository.IsObjectMatchingSearch(list[i], search))
                        allocator.Add(list[i]);
                }
            }
        }
    }
};
function FillNeiSpecificRecipes(recipeType) {
    return function (grid, search, recipes) {
        var list = recipes[recipeType.name];
        let allocator = grid.BeginAllocation(list);
        for (let i = 0; i < list.length; i++)
            if (search == null || repository.IsObjectMatchingSearch(list[i], search))
                allocator.Add(list[i]);
    };
}
function SearchChanged() {
    search = searchBox.value === "" ? null : new SearchQuery(searchBox.value);
    if (search !== null && (search.words.length === 0 && search.mod === null))
        search = null;
    RefreshNeiContents();
}
const mapRecipeTypeToRecipeList = {};
let allRecipeTypes;
let filler = FillNeiAllItems;
let search = null;
let neiHistory = [];
{
    let allRecipeTypePointers = repository.recipeTypes;
    allRecipeTypes = new Array(allRecipeTypePointers.length);
    for (var i = 0; i < allRecipeTypePointers.length; i++) {
        var recipeType = repository.GetObject(allRecipeTypePointers[i], RecipeType);
        mapRecipeTypeToRecipeList[recipeType.name] = new NeiRecipeTypeInfo(recipeType);
        allRecipeTypes[i] = recipeType;
    }
}
export var ShowNeiMode;
(function (ShowNeiMode) {
    ShowNeiMode[ShowNeiMode["Production"] = 0] = "Production";
    ShowNeiMode[ShowNeiMode["Consumption"] = 1] = "Consumption";
})(ShowNeiMode || (ShowNeiMode = {}));
let currentMode = ShowNeiMode.Production;
export var ShowNeiContext;
(function (ShowNeiContext) {
    ShowNeiContext[ShowNeiContext["None"] = 0] = "None";
    ShowNeiContext[ShowNeiContext["Click"] = 1] = "Click";
    ShowNeiContext[ShowNeiContext["SelectRecipe"] = 2] = "SelectRecipe";
    ShowNeiContext[ShowNeiContext["SelectGoods"] = 3] = "SelectGoods";
})(ShowNeiContext || (ShowNeiContext = {}));
let showNeiCallback = null;
export function HideNei() {
    nei.classList.add("hidden");
    showNeiCallback = null;
    currentGoods = null;
}
export function NeiSelect(goods) {
    console.log("ShowNei select (Goods): ", goods);
    if (showNeiCallback != null && showNeiCallback.onSelectGoods) {
        showNeiCallback.onSelectGoods(goods);
    }
    HideNei();
}
function AddToSet(set, goods, mode) {
    let list = mode == ShowNeiMode.Production ? goods.production : goods.consumption;
    for (var i = 0; i < list.length; i++)
        set.add(repository.GetObject(list[i], Recipe));
}
function GetAllOreDictRecipes(set, goods, mode) {
    for (var i = 0; i < goods.items.length; i++) {
        AddToSet(set, goods.items[i], mode);
    }
}
function GetAllFluidRecipes(set, goods, mode) {
    AddToSet(set, goods, mode);
    let containers = goods.containers;
    for (var i = 0; i < containers.length; i++) {
        var container = repository.GetObject(repository.items[containers[i]], Item);
        AddToSet(set, container, mode);
    }
}
function Back() {
    const last = neiHistory.pop();
    if (last)
        ShowNeiInternal(last.goods, last.mode, last.tabIndex);
}
export function ShowNei(goods, mode, callback = null) {
    console.log("ShowNei", goods, mode, callback);
    if (callback != null) {
        showNeiCallback = callback;
        neiHistory.length = 0;
    }
    else {
        if (!nei.classList.contains("hidden"))
            neiHistory.push({ goods: currentGoods, mode: currentMode, tabIndex: activeTabIndex });
    }
    nei.classList.remove("hidden");
    ShowNeiInternal(goods, mode);
}
function ShowNeiInternal(goods, mode, tabIndex = -1) {
    currentGoods = goods;
    currentMode = mode;
    let recipes = new Set();
    if (goods instanceof OreDict) {
        GetAllOreDictRecipes(recipes, goods, mode);
    }
    else if (goods instanceof Fluid) {
        GetAllFluidRecipes(recipes, goods, mode);
    }
    else if (goods instanceof Item && goods.container) {
        GetAllFluidRecipes(recipes, goods.container.fluid, mode);
    }
    else if (goods instanceof Goods) {
        AddToSet(recipes, goods, mode);
    }
    // Clear all recipe lists first
    for (const recipeType of allRecipeTypes) {
        mapRecipeTypeToRecipeList[recipeType.name].length = 0;
    }
    // Fill recipe lists
    for (var recipe of recipes) {
        var recipeType = recipe.recipeType;
        var list = mapRecipeTypeToRecipeList[recipeType.name];
        list.push(recipe);
    }
    search = null;
    searchBox.value = "";
    // Update tab visibility
    updateTabVisibility();
    neiBack.style.display = neiHistory.length > 0 ? "" : "none";
    const newTabIndex = tabIndex === -1 ? (goods === null ? 0 : 1) : tabIndex;
    switchTab(newTabIndex);
    Resize();
}
class NeiGridRow {
    constructor() {
        this.y = 0;
        this.height = 1;
        this.elementWidth = 1;
        this.elements = [];
        this.allocator = null;
    }
    Clear(y, allocator, elementWidth) {
        this.allocator = allocator;
        this.y = y;
        this.height = 1;
        this.elementWidth = elementWidth;
        this.elements.length = 0;
    }
    Add(element, height) {
        this.elements.push(element);
        if (height > this.height)
            this.height = height;
    }
}
class NeiGrid {
    constructor() {
        this.rows = [];
        this.rowCount = 0;
        this.width = 1;
        this.height = 0;
        this.allocator = null;
        this.currentRow = null;
        this.elementWidth = 1;
        this.elementsPerRow = 1;
    }
    Clear(width) {
        this.rowCount = 0;
        this.width = width;
        this.height = 0;
        this.currentRow = null;
        this.allocator = null;
        this.elementWidth = 1;
        this.elementsPerRow = 1;
    }
    BeginAllocation(allocator) {
        this.FinishRow();
        this.allocator = allocator;
        this.elementWidth = allocator.CalculateWidth();
        if (this.elementWidth == -1)
            this.elementWidth = this.width;
        this.elementsPerRow = Math.max(1, Math.trunc(this.width / this.elementWidth));
        //this.elementWidth = this.width / this.elementsPerRow;
        return this;
    }
    FinishRow() {
        if (this.currentRow === null)
            return;
        this.height = this.currentRow.y + this.currentRow.height;
        this.currentRow = null;
    }
    NextRow() {
        this.FinishRow();
        var row = this.rows[this.rowCount];
        if (row === undefined)
            this.rows[this.rowCount] = row = new NeiGridRow();
        row.Clear(this.height, this.allocator, this.elementWidth);
        this.currentRow = row;
        this.rowCount++;
        return row;
    }
    Add(element) {
        var _a, _b;
        var row = this.currentRow;
        if (row === null || row.elements.length >= this.elementsPerRow)
            row = this.NextRow();
        var height = (_b = (_a = this.allocator) === null || _a === void 0 ? void 0 : _a.CalculateHeight(element)) !== null && _b !== void 0 ? _b : 1;
        if (row.height < height)
            row.height = height;
        row.elements.push(element);
    }
}
function Resize() {
    var newUnitWidth = Math.round((window.innerWidth - 30 - scrollWidth) / elementSize);
    var newUnitHeight = Math.round((window.innerHeight - 120) / elementSize);
    var widthRemainder = window.innerWidth - newUnitWidth;
    if (newUnitWidth !== unitWidth || newUnitHeight !== unitHeight) {
        unitWidth = newUnitWidth;
        unitHeight = newUnitHeight;
        var windowWidth = unitWidth * elementSize + scrollWidth;
        var windowHeight = unitHeight * elementSize;
        if ((window.innerWidth - windowWidth) % 2 == 1)
            windowWidth++;
        if ((window.innerWidth - windowHeight) % 2 == 1)
            windowHeight++;
        neiScrollBox.style.width = `${windowWidth}px`;
        neiScrollBox.style.height = `${windowHeight}px`;
    }
    RefreshNeiContents();
}
let grid = new NeiGrid();
let maxVisibleRow = 0;
function RefreshNeiContents() {
    grid.Clear(unitWidth);
    filler(grid, search, mapRecipeTypeToRecipeList);
    grid.FinishRow();
    neiContent.style.minHeight = `${grid.height * elementSize}px`;
    maxVisibleRow = 0;
    neiContent.innerHTML = "";
    UpdateVisibleItems();
}
function UpdateVisibleItems() {
    var top = Math.floor(neiScrollBox.scrollTop / elementSize);
    var bottom = top + unitHeight + 1;
    for (var i = maxVisibleRow; i < grid.rowCount; i++) {
        var row = grid.rows[i];
        if (row.y >= bottom)
            return;
        FillDomWithGridRow(row);
        maxVisibleRow = i + 1;
    }
}
function FillDomWithGridRow(row) {
    var allocator = row.allocator;
    if (allocator == null)
        return;
    var dom = allocator.BuildRowDom(row.elements, row.elementWidth, row.height, row.y);
    neiContent.insertAdjacentHTML("beforeend", dom);
}
const tabs = [
    {
        name: "All Items",
        filler: FillNeiAllItems,
        iconId: repository.GetObject(repository.service[0], Item).iconId,
        isVisible: () => true // Always visible
    },
    {
        name: "All Recipes",
        filler: FillNeiAllRecipes,
        iconId: repository.GetObject(repository.service[1], Item).iconId,
        isVisible: () => currentGoods !== null // Visible only when viewing recipes
    }
];
// Add tabs for each recipe type
allRecipeTypes.forEach(recipeType => {
    tabs.push({
        name: recipeType.name,
        filler: FillNeiSpecificRecipes(recipeType),
        iconId: recipeType.defaultCrafter.iconId,
        isVisible: () => mapRecipeTypeToRecipeList[recipeType.name].length > 0
    });
});
let activeTabIndex = 0;
function createTabs() {
    var _a;
    neiTabs.innerHTML = '';
    tabs.forEach((tab, index) => {
        const tabElement = document.createElement('div');
        tabElement.className = 'panel-tab';
        const iconId = tab.iconId;
        const ix = iconId % 256;
        const iy = Math.floor(iconId / 256);
        tabElement.innerHTML = `<icon class="icon" style="--pos-x:${ix * -32}px; --pos-y:${iy * -32}px"></icon>`;
        tabElement.addEventListener('click', () => switchTab(index));
        tabElement.addEventListener('mouseenter', () => ShowTooltip(tabElement, { header: tab.name }));
        neiTabs.appendChild(tabElement);
    });
    // Set initial active tab
    (_a = neiTabs.children[0]) === null || _a === void 0 ? void 0 : _a.classList.add('active');
}
function updateTabVisibility() {
    tabs.forEach((tab, index) => {
        const tabElement = neiTabs.children[index];
        if (tabElement) {
            tabElement.style.display = tab.isVisible() ? '' : 'none';
        }
    });
}
function switchTab(index) {
    var _a, _b;
    if (index === activeTabIndex)
        return;
    // Update active state
    (_a = neiTabs.children[activeTabIndex]) === null || _a === void 0 ? void 0 : _a.classList.remove('active');
    (_b = neiTabs.children[index]) === null || _b === void 0 ? void 0 : _b.classList.add('active');
    activeTabIndex = index;
    // Update filler and refresh content
    filler = tabs[index].filler;
    RefreshNeiContents();
}
export function GetSingleRecipeDom(recipe, overrideIo) {
    let recipeType = recipe.recipeType;
    let builder = mapRecipeTypeToRecipeList[recipeType.name];
    let width = builder.CalculateWidth();
    let height = builder.CalculateHeight(recipe);
    let dom = builder.BuildRowDom([recipe], width, height, 0, overrideIo);
    return dom;
}
// Initialize tabs
createTabs();
// Add global click handler for recipe selection
neiContent.addEventListener("click", (event) => {
    const target = event.target;
    const selectButton = target.closest(".select-recipe-btn");
    if (selectButton && (showNeiCallback === null || showNeiCallback === void 0 ? void 0 : showNeiCallback.onSelectRecipe)) {
        const recipeOffset = parseInt(selectButton.getAttribute("data-recipe") || "0");
        const recipe = repository.GetObject(recipeOffset, Recipe);
        console.log("ShowNei result (Recipe): ", recipe.id, recipe);
        showNeiCallback.onSelectRecipe(recipe);
        HideNei();
    }
});
//# sourceMappingURL=nei.js.map