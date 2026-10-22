// Apply the saved palette before styles paint. This small classic script has no
// imports or data dependency, so changing pack versions also retains the theme.
(() => {
  const key = "gtnh_atlas_theme_v1";
  const themes = Object.freeze([
    Object.freeze({ id: "graphite", label: "Graphite", description: "Charcoal panels and amber accents.", color: "#171819" }),
    Object.freeze({ id: "atlas-classic", label: "Atlas Classic", description: "The previous navy and teal colors.", color: "#0b1320" }),
    Object.freeze({ id: "nei-classic", label: "NEI Classic", description: "Game-style gray recipe panels and beveled slots.", color: "#171819" })
  ]);
  let selected = "graphite";
  try { const saved = localStorage.getItem(key); if (themes.some(theme => theme.id === saved)) selected = saved; } catch { /* Theme remains available for this tab. */ }
  function apply() {
    document.documentElement.dataset.theme = selected;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themes.find(theme => theme.id === selected).color);
  }
  window.GTNH_THEME = Object.freeze({
    themes,
    get current() { return selected; },
    select(id) {
      if (!themes.some(theme => theme.id === id)) throw new RangeError("Unknown Atlas theme.");
      selected = id; apply();
      let persisted = true;
      try { localStorage.setItem(key, id); } catch { persisted = false; }
      window.dispatchEvent(new Event("atlas-theme-changed"));
      return { persisted };
    }
  });
  apply();
})();
