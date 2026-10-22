// Anchored menus shared by navigation and recipe actions. Native popovers escape
// clipped app surfaces; older browsers use the same hidden/fixed menu fallback.
let activeMenu;
export function createPopupMenu(trigger, { id, label, populate }) {
  const menu = document.createElement("div");
  menu.id = id; menu.className = "atlasMenu"; menu.role = "menu";
  menu.setAttribute("aria-label", label); menu.hidden = true;
  const native = typeof menu.showPopover === "function";
  if (native) menu.setAttribute("popover", "auto");
  document.body.appendChild(menu);
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-controls", id); trigger.setAttribute("aria-expanded", "false");
  let opened = false;
  const items = () => [...menu.querySelectorAll('[role^="menuitem"]')].filter(item => !item.disabled && item.getAttribute("aria-disabled") !== "true" && !item.hidden);
  function focusItem(item) {
    if (!item) return;
    item.focus({ preventScroll: true });
    const bounds = menu.getBoundingClientRect(), row = item.getBoundingClientRect();
    if (row.top < bounds.top + 4) menu.scrollTop -= bounds.top + 4 - row.top;
    else if (row.bottom > bounds.bottom - 4) menu.scrollTop += row.bottom - bounds.bottom + 4;
  }
  function position() {
    if (!opened) return;
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
    const r = trigger.getBoundingClientRect(), gap = 6, edge = 8;
    const below = top + height - r.bottom - gap - edge, above = r.top - top - gap - edge;
    const upwards = below < Math.min(240, above);
    menu.style.maxWidth = `${Math.max(0, width - edge * 2)}px`;
    menu.style.maxHeight = `${Math.max(44, Math.min(480, upwards ? above : below))}px`;
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(left + edge, Math.min(r.left, left + width - bounds.width - edge))}px`;
    menu.style.top = `${upwards ? Math.max(top + edge, r.top - gap - bounds.height) : r.bottom + gap}px`;
    if (menu.contains(document.activeElement)) focusItem(document.activeElement);
  }
  function closed() {
    opened = false; menu.hidden = true; trigger.setAttribute("aria-expanded", "false");
    if (activeMenu === api) activeMenu = undefined;
  }
  function close(returnFocus = false) {
    if (!opened) return;
    if (native && menu.matches(":popover-open")) menu.hidePopover();
    closed();
    if (returnFocus) trigger.focus({ preventScroll: true });
  }
  function open(last = false) {
    activeMenu?.close();
    populate?.(menu, api);
    menu.querySelectorAll('[role^="menuitem"]').forEach(item => { item.tabIndex = -1; });
    opened = true; activeMenu = api; menu.hidden = false; menu.scrollTop = 0;
    trigger.setAttribute("aria-expanded", "true");
    if (native) menu.showPopover();
    position();
    const choices = items();
    focusItem(last ? choices.at(-1) : menu.querySelector('[aria-checked="true"]:not(:disabled)') || choices[0]);
  }
  const api = { element: menu, open, close, destroy() { close(); controller.abort(); menu.remove(); } };
  const controller = new AbortController(), listen = (node, event, handler) => node.addEventListener(event, handler, { signal: controller.signal });
  listen(trigger, "click", () => opened ? close() : open());
  listen(trigger, "keydown", event => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault(); open(event.key === "ArrowUp");
  });
  listen(menu, "keydown", event => {
    const choices = items(), current = choices.indexOf(document.activeElement);
    let index;
    if (event.key === "ArrowDown") index = (current + 1) % choices.length;
    if (event.key === "ArrowUp") index = (current - 1 + choices.length) % choices.length;
    if (event.key === "Home") index = 0;
    if (event.key === "End") index = choices.length - 1;
    if (index !== undefined) { event.preventDefault(); focusItem(choices[index]); }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
    if (event.key === "Tab") { close(true); /* Continue Tab navigation from the trigger. */ }
  });
  listen(document, "pointerdown", event => { if (opened && !menu.contains(event.target) && !trigger.contains(event.target)) close(); });
  listen(menu, "toggle", event => { if (event.newState === "closed" && opened) closed(); });
  listen(window, "resize", position);
  if (window.visualViewport) { listen(window.visualViewport, "resize", position); listen(window.visualViewport, "scroll", position); }
  return api;
}
