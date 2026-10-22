import {test,expect} from "@playwright/test";
const item="f:gregtech:liquid_epichlorhydrin";
test.beforeEach(async({page})=>page.addInitScript(()=>localStorage.setItem("gtnhnei_help_seen","1")));
for(const [dataset,recipe] of [["gtnh-2.8.0","r~7CR1mklsMhyejhfODug_QQ=="],["gtnh-2.9.0","r~RgUYVgBcPJmt4u3DO2ZYIg=="]]) {
 test(`${dataset} links open an exact authentic recipe and can restore its full item list`,async({page})=>{
  await page.goto(`./?dataset=${dataset}&item=${encodeURIComponent(item)}&recipe=${encodeURIComponent(recipe)}`);
  await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
  await expect(page.locator("#recipePage .recipe")).toHaveCount(1);await expect(page.locator("#recipePage .recipe")).toHaveAttribute("data-recipe-id",recipe);
  await expect(page.locator(".recipeLinkNotice")).toContainText("Showing the linked recipe");
  const href=await page.locator("[data-recipe-link]").getAttribute("href"),url=new URL(href);
  expect(url.searchParams.get("dataset")).toBe(dataset);expect(url.searchParams.get("recipe")).toBe(recipe);
  await page.locator("#showAllLinkedRecipes").click();
  // Recipe cards render in chunks. A completed click does not mean that the
  // asynchronous list rebuild has attached its first batch yet.
  await expect(page.locator("#recipePage .recipe").nth(1)).toBeAttached();
  await page.locator(`[data-plan-recipe="${recipe}"]`).click();
  expect(await page.evaluate(id=>window.GTNH_CALC.getState().routeChoices[id],item)).toBe(recipe);
  expect(await page.evaluate(()=>window.GTNH_CALC.getPlan().knownEnergy)).toBe(19200);
 });
}
test("absent recipe links recover and item links strip unrelated private plan fragments",async({page})=>{
 await page.goto(`./?item=${encodeURIComponent(item)}&recipe=absent&ref=old#plan=invalid`);
 await expect(page.locator('#bootLoader[data-state="ready"]')).toBeAttached();
 await expect(page.locator(".recipeLinkNotice")).toContainText("absent for this item and version");await expect(page.locator("#recipePage .recipe").nth(1)).toBeAttached();
 const itemHref=await page.locator("#itemPermalink").getAttribute("href"),recipeHref=await page.locator("[data-recipe-link]").first().getAttribute("href");
 for(const href of [itemHref,recipeHref]) {const url=new URL(href);expect(url.hash).toBe("");expect(url.searchParams.has("ref")).toBe(false);}
 expect(new URL(itemHref).searchParams.has("recipe")).toBe(false);
});
