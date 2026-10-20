import { fetchDatabase } from "./data-loader.js";
import { verifyDatasetBuffer, selectDataset } from "./datasets.js";
import { loadRepository, yieldToBrowser } from "./repository-loader.js";
import { RecipeCatalog } from "./recipe-data.js";
import { compareRecipes } from "./recipe-compare.js";
const esc=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;");
const value=number=>number===null||number===undefined?"unknown":String(number);
let dialog, context, controller, sequence=0, result;
const shown={};
function recipeText(recipe) {
  return [`${recipe.machine} [${recipe.id}]`,`${value(recipe.durationTicks===null?null:recipe.durationTicks/20)} s · ${value(recipe.eut)} EU/t · ${value(recipe.voltage)} V × ${value(recipe.amperage)} A`,
    `Circuit conflicts: ${value(recipe.circuitConflicts)} · Special value: ${value(recipe.specialValue)}`,
    ...["inputs","outputs"].flatMap(key=>["",key.toUpperCase(),...recipe[key].map(io=>`${io.amount} ${io.unit} ${io.name} [${io.id}]${io.amount===0?" (non-consumed tool)":""}${io.probability!==1?` (${io.probability*100}% chance)`:""}${recipe.shapeless?"":` · slot ${io.slot}`}`)]),
    "", "METADATA",...recipe.metadata.map(entry=>`${entry.key}: ${entry.value}`)].join("\n");
}
function appendRows(kind) {
  const list=dialog.querySelector(`[data-compare-list="${kind}"]`), entries=result[kind], start=shown[kind]||0, end=Math.min(start+50,entries.length);
  const rows=entries.slice(start,end).map((entry,index)=>{
    const recipe=entry.after||entry, before=entry.before;
    return `<details data-compare-kind="${kind}" data-compare-index="${start+index}"><summary>${esc(recipe.machine)} · ${value(recipe.durationTicks===null?null:recipe.durationTicks/20)} s · ${value(recipe.eut)} EU/t<small>${esc(recipe.id)}${before&&before.id!==recipe.id?` · previously ${esc(before.id)}`:""}</small></summary><div data-compare-detail></div></details>`;
  }).join("");
  list.insertAdjacentHTML("beforeend",rows);shown[kind]=end;
  const more=dialog.querySelector(`[data-compare-more="${kind}"]`);more.hidden=end>=entries.length;more.textContent=`Show ${Math.min(50,entries.length-end)} more`;
}
function renderResults(other, missing) {
  const body=dialog.querySelector("#versionCompareResults");
  body.innerHTML=`<p>${esc(context.catalog.dataset.label)} → ${esc(other.label)} · ${context.mode==="consumption"?"usage":"production"} recipes.</p>${missing?"<p>This exact good ID is absent from the comparison dataset. Names are not used as substitutes.</p>":""}<p id="versionCompareSummary">${result.unchanged.length} unchanged · ${result.modified.length} modified · ${result.removed.length} removed · ${result.added.length} added</p><p>Base inputs, outputs, slots for shaped recipes, timing, power and metadata are compared by exact good IDs. Modified means a unique match with the same ingredient/output identities. Ambiguous alternatives remain added/removed; machine availability and specialized bonuses are not compared.</p>${["modified","added","removed","unchanged"].map(kind=>`<section><h3>${kind[0].toUpperCase()+kind.slice(1)} (${result[kind].length})</h3><div data-compare-list="${kind}"></div><button type="button" data-compare-more="${kind}"></button></section>`).join("")}`;
  for(const kind of ["modified","added","removed","unchanged"]) {shown[kind]=0;appendRows(kind);}
  dialog.querySelector("#versionCompareDownload").disabled=false;
}
async function compare() {
  const current=++sequence;controller?.abort();controller=new AbortController();
  const signal=controller.signal, status=dialog.querySelector("#versionCompareStatus"), button=dialog.querySelector("#versionCompareRun");
  button.disabled=true;result=null;dialog.querySelector("#versionCompareDownload").disabled=true;dialog.querySelector("#versionCompareResults").replaceChildren();
  try {
    const other=selectDataset(window.GTNH_DATASETS.manifest,dialog.querySelector("#versionCompareDataset").value);
    status.textContent=`Loading ${other.label} for comparison…`;
    const buffer=await fetchDatabase(({received,total})=>{if(current===sequence)status.textContent=`Downloading ${other.label}: ${(received/1000000).toFixed(1)}${total?` / ${(total/1000000).toFixed(1)}`:""} MB…`;},other.dataUrl,{signal});
    await verifyDatasetBuffer(buffer,other);signal.throwIfAborted();status.textContent="Indexing comparison data…";
    const repository=await loadRepository(buffer,{yieldControl:yieldToBrowser,signal,publish:false});
    if(repository.items.length!==other.items||repository.fluids.length!==other.fluids||repository.recipes.length!==other.recipes)throw new Error("Comparison dataset record counts do not match its manifest.");
    // No shared current repository or full name index is published for this view.
    const catalog=new RecipeCatalog(repository,other,{deferIndexes:true}), good=repository.GetById(context.id);
    const before=context.catalog.recipes(context.catalog.resolve(context.id),context.mode), after=good?catalog.recipes(good,context.mode):[];
    signal.throwIfAborted();if(current!==sequence)return;
    result=compareRecipes(before,after);renderResults(other,!good);status.textContent="Comparison complete. Your active recipe dataset and saved plans are unchanged.";
  } catch(error) {if(current===sequence&&!signal.aborted)status.textContent=`Comparison failed: ${error.message} You can retry.`;}
  finally {if(current===sequence)button.disabled=false;}
}
function ensure() {
  if(dialog)return;
  dialog=document.createElement("dialog");dialog.id="versionCompareDialog";dialog.setAttribute("aria-labelledby","versionCompareTitle");
  dialog.innerHTML='<header><h2 id="versionCompareTitle">Compare recipe versions</h2><button type="button" id="versionCompareClose" aria-label="Close version comparison">×</button></header><p id="versionCompareGood"></p><label for="versionCompareDataset">Compare active recipes to<select id="versionCompareDataset"></select></label><p>The selected database downloads on request. Comparison does not switch your active version.</p><div class="versionCompareActions"><button type="button" id="versionCompareRun">Load dataset and compare</button><button type="button" id="versionCompareDownload" disabled>Download comparison JSON</button></div><p id="versionCompareStatus" role="status" aria-live="polite"></p><div id="versionCompareResults"></div>';
  document.body.appendChild(dialog);
  dialog.querySelector("#versionCompareClose").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>{sequence++;controller?.abort();controller=null;context=null;result=null;dialog.querySelector("#versionCompareResults").replaceChildren();});
  dialog.querySelector("#versionCompareRun").addEventListener("click",compare);
  dialog.querySelector("#versionCompareDataset").addEventListener("change",()=>{sequence++;controller?.abort();result=null;dialog.querySelector("#versionCompareRun").disabled=false;dialog.querySelector("#versionCompareDownload").disabled=true;dialog.querySelector("#versionCompareResults").replaceChildren();dialog.querySelector("#versionCompareStatus").textContent="Choose Load dataset and compare to begin.";});
  dialog.addEventListener("click",event=>{const more=event.target.closest("[data-compare-more]");if(more&&result){appendRows(more.dataset.compareMore);if(more.hidden)dialog.querySelector(`[data-compare-list="${more.dataset.compareMore}"] details:last-child summary`)?.focus();}});
  dialog.addEventListener("toggle",event=>{
    const row=event.target, slot=row.querySelector?.("[data-compare-detail]");if(!row.open||!row.dataset.compareKind||!result||!slot||slot.children.length)return;
    const entry=result[row.dataset.compareKind][Number(row.dataset.compareIndex)];
    slot.innerHTML=entry.before?`<div class="versionComparePair"><section><h4>${esc(context.catalog.dataset.label)}</h4><pre>${esc(recipeText(entry.before))}</pre></section><section><h4>${esc(dialog.querySelector("#versionCompareDataset").selectedOptions[0].textContent)}</h4><pre>${esc(recipeText(entry.after))}</pre></section></div>`:`<pre>${esc(recipeText(entry))}</pre>`;
  },true);
  dialog.querySelector("#versionCompareDownload").addEventListener("click",()=>{
    if(!result)return;const other=selectDataset(window.GTNH_DATASETS.manifest,dialog.querySelector("#versionCompareDataset").value);
    const text=JSON.stringify({format:"gtnh-atlas-comparison",schemaVersion:1,before:{id:context.catalog.dataset.id,sha256:context.catalog.dataset.sha256},after:{id:other.id,sha256:other.sha256},good:context.id,mode:context.mode,result},null,2);
    const url=URL.createObjectURL(new Blob([text],{type:"application/json"})),anchor=document.createElement("a");anchor.href=url;anchor.download="gtnh-atlas-recipe-comparison.json";anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
}
export function openVersionComparison(catalog,id,mode="production") {
  ensure();context={catalog,id,mode};result=null;
  const available=window.GTNH_DATASETS.manifest.datasets.filter(entry=>entry.available&&entry.id!==catalog.dataset.id);
  dialog.querySelector("#versionCompareGood").textContent=`${catalog.resolve(id)?.name||id} [${id}] · Active: ${catalog.dataset.label}`;
  dialog.querySelector("#versionCompareDataset").innerHTML=available.map(entry=>`<option value="${esc(entry.id)}">${esc(entry.label)}</option>`).join("");
  dialog.querySelector("#versionCompareRun").disabled=!available.length;dialog.querySelector("#versionCompareDownload").disabled=true;
  dialog.querySelector("#versionCompareStatus").textContent=available.length?"Choose Load dataset and compare to begin.":"No other verified dataset is installed.";
  dialog.showModal();
}
