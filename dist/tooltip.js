import { GetSingleRecipeDom } from "./nei.js";
export var currentTooltipElement;
const tooltip = document.getElementById("tooltip");
const tooltipHeader = tooltip.querySelector("#tooltip-header");
const tooltipDebugInfo = tooltip.querySelector("#tooltip-debug");
const tooltipText = tooltip.querySelector("#tooltip-text");
const tooltipAction = tooltip.querySelector("#tooltip-action");
const tooltipMod = tooltip.querySelector("#tooltip-mod");
const tooltipRecipe = tooltip.querySelector("#tooltip-recipe");
let tooltipScrollTarget = 0;
let tooltipScrollCache = new Map();
function OnGlobalScroll(ev) {
    if (!tooltip || tooltip.style.display !== "block")
        return;
    // Scroll inside tooltip instead of page
    tooltipScrollTarget += ev.deltaY;
    tooltipScrollTarget = Math.max(0, Math.min(tooltipScrollTarget, tooltip.scrollHeight - tooltip.clientHeight));
    if (tooltip.scrollTop !== tooltipScrollTarget) {
        tooltip.scrollTop = tooltipScrollTarget;
        ev.preventDefault(); // block normal page scroll
    }
}
export function ShowTooltip(target, data) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    if (data == null)
        return;
    const header = (_c = (_b = (_a = data.goods) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : data.header) !== null && _c !== void 0 ? _c : '';
    const debug = (_e = (_d = data.goods) === null || _d === void 0 ? void 0 : _d.tooltipDebugInfo) !== null && _e !== void 0 ? _e : null;
    const text = (_h = (_g = (_f = data.goods) === null || _f === void 0 ? void 0 : _f.tooltip) !== null && _g !== void 0 ? _g : data.text) !== null && _h !== void 0 ? _h : null;
    const mod = (_k = (_j = data.goods) === null || _j === void 0 ? void 0 : _j.mod) !== null && _k !== void 0 ? _k : null;
    const action = (_l = data.action) !== null && _l !== void 0 ? _l : null;
    const recipe = (_m = data.recipe) !== null && _m !== void 0 ? _m : null;
    const overrideIo = data.overrideIo;
    ShowTooltipRaw(target, header, debug, text, mod, action, recipe, overrideIo);
    target.focus();
    target.addEventListener("mouseleave", () => HideTooltip(target), { once: true });
    if (tooltipScrollCache.has(target)) {
        tooltipScrollTarget = tooltipScrollCache.get(target);
    }
    else {
        tooltipScrollTarget = 0;
    }
    // Override smooth scroll for the initial scroll loaded from cache.
    // Otherwise it scrolls visibly every time.
    tooltip.style.scrollBehavior = 'auto';
    tooltipScrollTarget = Math.max(0, Math.min(tooltipScrollTarget, tooltip.scrollHeight - tooltip.clientHeight));
    tooltip.scrollTop = tooltipScrollTarget;
    tooltip.style.scrollBehavior = 'smooth';
    window.addEventListener("wheel", OnGlobalScroll, { passive: false });
}
function SetTextOptional(element, data, html) {
    if (data === undefined || data === null)
        element.style.display = "none";
    else {
        element.style.display = "block";
        if (html)
            element.innerHTML = data;
        else
            element.textContent = data;
    }
}
function ShowTooltipRaw(target, header, debug, description, mod, action, recipe, overrideIo) {
    tooltip.style.display = "block";
    currentTooltipElement = target;
    SetTextOptional(tooltipHeader, header, true);
    SetTextOptional(tooltipDebugInfo, debug, false);
    SetTextOptional(tooltipText, description, true);
    SetTextOptional(tooltipAction, action, false);
    SetTextOptional(tooltipMod, mod, false);
    tooltipRecipe.style.display = "none";
    if (recipe) {
        tooltipRecipe.style.display = "block";
        tooltipRecipe.innerHTML = GetSingleRecipeDom(recipe, overrideIo);
    }
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const isRightHalf = targetRect.left > window.innerWidth / 2;
    if (isRightHalf) {
        tooltip.style.left = `${targetRect.left - tooltipRect.width}px`;
    }
    else {
        tooltip.style.left = `${targetRect.right}px`;
    }
    if (targetRect.top + tooltipRect.height > window.innerHeight) {
        tooltip.style.top = `${window.innerHeight - tooltipRect.height}px`;
    }
    else {
        tooltip.style.top = `${Math.max(targetRect.top, 0)}px`;
    }
}
export function HideTooltip(target) {
    if (currentTooltipElement !== target)
        return;
    tooltipScrollCache.set(target, tooltipScrollTarget);
    currentTooltipElement = undefined;
    tooltip.style.display = "none";
    window.removeEventListener("wheel", OnGlobalScroll);
}
export function IsHovered(obj) {
    return currentTooltipElement === obj;
}
//# sourceMappingURL=tooltip.js.map