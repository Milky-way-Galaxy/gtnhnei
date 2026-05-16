/* === GTNH Workbench safe Favorites v1 === */
(() => {
  "use strict";

  if (window.__GTNH_SAFE_FAVORITES_V1__) return;
  window.__GTNH_SAFE_FAVORITES_V1__ = true;

  const KEY = "gtnhnei_favorites_v1";

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function cleanName(s) {
    return String(s || "").trim();
  }

  function compact(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function toast(text) {
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
    el._timer = setTimeout(() => el.classList.remove("show"), 1600);
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.filter(x => cleanName(x?.name)).map(x => ({
        name: cleanName(x.name),
        addedAt: Number(x.addedAt || Date.now())
      }));
    } catch {
      return [];
    }
  }

  function save(arr) {
    const out = [];
    const seen = new Set();

    for (const x of arr || []) {
      const name = cleanName(x?.name || x);
      if (!name) continue;

      const k = compact(name);
      if (seen.has(k)) continue;

      seen.add(k);
      out.push({
        name,
        addedAt: Number(x?.addedAt || Date.now())
      });
    }

    localStorage.setItem(KEY, JSON.stringify(out));
    updateCount();
    return out;
  }

  function add(name) {
    name = cleanName(name);
    if (!name) {
      toast("Nothing to favorite.");
      return;
    }

    const arr = load();
    if (!arr.some(x => compact(x.name) === compact(name))) {
      arr.unshift({ name, addedAt: Date.now() });
      save(arr);
    }

    render();
    toast("Favorited: " + name);
  }

  function remove(name) {
    save(load().filter(x => compact(x.name) !== compact(name)));
    render();
    toast("Removed: " + name);
  }

  function getSearchText() {
    return cleanName(
      document.querySelector("#search")?.value ||
      document.querySelector("input[type='search']")?.value ||
      ""
    );
  }

  function openNei(name, mode) {
    close();

    setTimeout(() => {
      try {
        if (mode === "usage") {
          if (window.GTNHNEI_MAIN_API?.usage?.(name)) return;
        } else {
          if (window.GTNHNEI_MAIN_API?.recipe?.(name)) return;
        }

        toast("NEI API not ready.");
      } catch (err) {
        console.warn("Favorite open failed:", err);
        toast("Open failed.");
      }
    }, 50);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied: " + text);
    } catch {
      toast("Copy failed.");
    }
  }

  function ensureOverlay() {
    let ov = document.getElementById("gtnhFavOverlay");
    if (ov) return ov;

    ov = document.createElement("div");
    ov.id = "gtnhFavOverlay";
    ov.innerHTML = `
      <div class="gtnhFavPanel" role="dialog" aria-modal="true" aria-label="Favorites">
        <div class="gtnhFavHead">
          <div>
            <h2>Favorites</h2>
            <p>Saved GTNH items/fluids. Safe version: no slot-scanning.</p>
          </div>
          <button class="gtnhFavClose" type="button" aria-label="Close favorites">×</button>
        </div>

        <div class="gtnhFavTools">
          <input id="gtnhFavManual" placeholder="Item/fluid name, e.g. microprocessor">
          <button id="gtnhFavAddManual" type="button">Add</button>
          <button id="gtnhFavAddSearch" type="button">Add search text</button>
          <button id="gtnhFavExport" type="button">Export</button>
          <button id="gtnhFavImport" type="button">Import</button>
          <button id="gtnhFavClear" type="button">Clear</button>
          <input id="gtnhFavFile" type="file" accept="application/json,.json" hidden>
        </div>

        <div id="gtnhFavList" class="gtnhFavList"></div>
      </div>
    `;

    document.body.appendChild(ov);

    ov.querySelector(".gtnhFavClose").addEventListener("click", close);
    ov.addEventListener("click", e => {
      if (e.target === ov) close();
    });

    ov.querySelector("#gtnhFavAddManual").addEventListener("click", () => {
      add(ov.querySelector("#gtnhFavManual").value);
      ov.querySelector("#gtnhFavManual").value = "";
    });

    ov.querySelector("#gtnhFavManual").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        ov.querySelector("#gtnhFavAddManual").click();
      }
    });

    ov.querySelector("#gtnhFavAddSearch").addEventListener("click", () => add(getSearchText()));
    ov.querySelector("#gtnhFavExport").addEventListener("click", exportFavs);
    ov.querySelector("#gtnhFavImport").addEventListener("click", () => ov.querySelector("#gtnhFavFile").click());
    ov.querySelector("#gtnhFavFile").addEventListener("change", importFavs);

    ov.querySelector("#gtnhFavClear").addEventListener("click", () => {
      if (!confirm("Clear all favorites?")) return;
      save([]);
      render();
      toast("Favorites cleared.");
    });

    return ov;
  }

  function open() {
    const ov = ensureOverlay();
    render();
    ov.classList.add("show");
    setTimeout(() => ov.querySelector("#gtnhFavManual")?.focus?.(), 80);
  }

  function close() {
    document.getElementById("gtnhFavOverlay")?.classList.remove("show");
  }

  function render() {
    const list = document.getElementById("gtnhFavList");
    if (!list) return;

    const favs = load().sort((a, b) => b.addedAt - a.addedAt);

    if (!favs.length) {
      list.innerHTML = `<div class="gtnhFavEmpty">No favorites yet. Add the current search text or type an item/fluid name.</div>`;
      return;
    }

    list.innerHTML = favs.map(x => `
      <div class="gtnhFavRow">
        <div>
          <div class="gtnhFavName">★ ${esc(x.name)}</div>
          <div class="gtnhFavMeta">Saved ${esc(new Date(x.addedAt).toLocaleString())}</div>
        </div>
        <div class="gtnhFavActions">
          <button type="button" data-r="${esc(x.name)}">Recipe</button>
          <button type="button" data-u="${esc(x.name)}">Usage</button>
          <button type="button" data-c="${esc(x.name)}">Copy</button>
          <button type="button" class="gtnhFavRemove" data-x="${esc(x.name)}">Remove</button>
        </div>
      </div>
    `).join("");

    list.querySelectorAll("[data-r]").forEach(b => b.addEventListener("click", () => openNei(b.dataset.r, "recipe")));
    list.querySelectorAll("[data-u]").forEach(b => b.addEventListener("click", () => openNei(b.dataset.u, "usage")));
    list.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", () => copyText(b.dataset.c)));
    list.querySelectorAll("[data-x]").forEach(b => b.addEventListener("click", () => remove(b.dataset.x)));
  }

  function exportFavs() {
    const text = JSON.stringify({
      app: "GTNH Workbench",
      type: "favorites",
      version: 1,
      exportedAt: new Date().toISOString(),
      favorites: load()
    }, null, 2);

    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gtnh_workbench_favorites.json";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }

  async function importFavs(e) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    try {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data.favorites;
      if (!Array.isArray(incoming)) throw new Error("bad file");

      save([...incoming, ...load()]);
      render();
      toast("Favorites imported.");
    } catch {
      toast("Import failed.");
    }
  }

  function updateCount() {
    const btn = document.getElementById("toolFav");
    if (!btn) return;

    let badge = document.getElementById("toolFavCount");
    if (!badge) {
      badge = document.createElement("span");
      badge.id = "toolFavCount";
      badge.style.marginLeft = "6px";
      badge.style.opacity = "0.7";
      btn.appendChild(badge);
    }

    badge.textContent = String(load().length);
  }

  function interceptTopButton() {
    document.addEventListener("click", e => {
      const btn = e.target.closest?.("#toolFav");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      open();
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateCount);
  } else {
    updateCount();
  }

  interceptTopButton();

  window.GTNH_FAVORITES = { open, close, add, remove, list: load };
})();
