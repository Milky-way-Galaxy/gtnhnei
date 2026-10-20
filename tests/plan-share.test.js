import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { createPlanLink, readPlanLink } from "../plan-share.js";
import { normalizePlannerState } from "../planner-state.js";
const dataset = { id: "gtnh-2.8.0", sha256: "a".repeat(64) };
const state = normalizePlannerState({
  target: "i:IC2:itemCellEmpty:0",
  amount: 2,
  unit: "stacks",
  routeChoices: { "f:water": "r~CaseSensitive==" },
  additionalTargets: [{ target: "f:water", amount: 1000, unit: "L" }],
  settings: { reuseByproducts: true },
});
const packed = (text) => "#plan=v1." + gzipSync(text).toString("base64url");
test("shared factory links round trip exact IDs, routes and settings at a GitHub Pages subpath", async () => {
  const link = new URL(
    await createPlanLink(
      state,
      dataset,
      "https://example.com/gtnhnei/?item=old&view=usage#old",
    ),
  );
  assert.equal(link.pathname, "/gtnhnei/");
  assert.equal(link.search, "?dataset=gtnh-2.8.0");
  assert.ok(link.hash.startsWith("#plan=v1."));
  assert.deepEqual(await readPlanLink(link.hash, dataset), state);
});
test("shared links reject incompatible datasets/checksums and unsupported codecs", async () => {
  const link = new URL(
    await createPlanLink(state, dataset, "https://example.com/gtnhnei/"),
  );
  await assert.rejects(
    readPlanLink(link.hash, { ...dataset, id: "gtnh-2.9.0" }),
    /different recipe dataset/,
  );
  await assert.rejects(
    readPlanLink(link.hash, { ...dataset, sha256: "b".repeat(64) }),
    /different recipe dataset/,
  );
  await assert.rejects(readPlanLink("#plan=v2.abc", dataset), /version/);
  assert.equal(await readPlanLink("#ordinary-anchor", dataset), null);
  await assert.rejects(
    readPlanLink(
      packed(
        JSON.stringify({
          format: "gtnh-atlas-plan",
          schemaVersion: 1,
          dataset: { id: dataset.id },
          settings: state,
        }),
      ),
      dataset,
    ),
    /missing.*checksum/,
  );
  await assert.rejects(
    createPlanLink(state, { id: dataset.id }, "https://example.com/"),
    /verified recipe dataset/,
  );
});
test("invalid, oversized and expansion-bomb links fail with an actionable error", async () => {
  for (const hash of [
    "#plan=v1.",
    "#plan=v1.%3Cbad%3E",
    "#plan=v1.badgzip",
    "#plan=v1." + "a".repeat(24001),
    packed(" ".repeat(2000001)),
    packed(JSON.stringify({ target: "Water", amount: 1 })),
  ]) {
    await assert.rejects(readPlanLink(hash, dataset), /invalid|decoded|large/);
  }
});
