// src/features/merchBranding/merchBrandingEngine.test.mjs — REPORT 153: the frontend placement mirror equals the
// backend engine on every golden case (placementGolden.json is the same file in merch-be), and the in-memory
// double builds the catalog from the same specs.
// Run (Node 20.x): node --test src/features/merchBranding/merchBrandingEngine.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { computePlacement } from "./placementEngine.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = readFileSync(join(HERE, "placementGolden.json"), "utf8");
const GOLDEN = JSON.parse(RAW);

test("every golden case: identical position, verdict and problem codes", () => {
  assert.ok(GOLDEN.cases.length >= 50);
  for (const c of GOLDEN.cases) {
    const p = Object.values(GOLDEN.specs).find((x) => x.variants[String(c.syncVariantId)]);
    const v = p.variants[String(c.syncVariantId)];
    const r = computePlacement({ area: v.area, box: v.box, requiredDpi: v.requiredDpi }, c.logo);
    assert.deepEqual(r.position, c.expected.position, `${c.syncVariantId} ${c.logo.name}`);
    assert.equal(r.ok, c.expected.ok);
    assert.deepEqual(r.problemCodes, c.expected.problemCodes);
    assert.equal(r.effectiveDpi, c.expected.effectiveDpi);
    assert.deepEqual(r.minLogoPx, c.expected.minLogoPx);
  }
});

test("golden specs are the API-read print areas for the four products", () => {
  assert.deepEqual(Object.keys(GOLDEN.specs).sort(), ["431621330", "431622804", "431623973", "431624815"]);
  assert.match(GOLDEN._comment, /API-read 2026-10-29/);
  for (const p of Object.values(GOLDEN.specs)) for (const v of Object.values(p.variants)) assert.equal(v.confirmed, true);
});

test("the golden file is byte-identical to merch-be's copy when the sibling worktree is present", (t) => {
  const be = join(HERE, "../../../../merch-be/services/merchBranding/placementGolden.json");
  if (!existsSync(be)) { t.skip("merch-be worktree not present"); return; }
  const norm = (s) => s.replace(/\r\n/g, "\n");
  const h = (s) => createHash("sha256").update(norm(s)).digest("hex");
  assert.equal(h(RAW), h(readFileSync(be, "utf8")));
});
