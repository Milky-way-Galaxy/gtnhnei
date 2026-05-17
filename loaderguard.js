/* === GTNH Atlas loader guard v1 === */
(() => {
  const start = Date.now();

  function findLoaderText() {
    const all = [...document.querySelectorAll("body *")];
    return all.find(el => /fetching data\/data\.bin/i.test(el.textContent || ""));
  }

  function showFail(reason) {
    const el = findLoaderText();
    if (!el) return;

    el.innerHTML = `
      <div style="color:#ffb4c8;font-weight:900">Load is taking too long.</div>
      <div style="margin-top:8px;color:#cbd5e1;font-size:0.9em">
        ${reason}<br>
        Check <b>data/data.bin</b>, server logs, and browser console.
      </div>
    `;
  }

  setTimeout(() => {
    const stillLoading = findLoaderText();
    const hasGrid = document.querySelector("#grid .slot, .slot, #recipePage .recipeCard");

    if (stillLoading && !hasGrid) {
      showFail("Probably stuck during fetch, gzip decompression, or Repository.load().");
      console.warn("[GTNH Atlas] Loader still active after", Date.now() - start, "ms");
    }
  }, 25000);
})();
