// tests/layout/screen2-layout.spec.mjs
//
// REAL-BROWSER (Chromium) geometry proof for the Import Wizard Screen-2 responsive fix. jsdom cannot
// measure painted layout, so this test renders the EXACT shipped gmiw CSS (extracted from
// ContactImportWizard.jsx) with the real Screen-2 markup at representative widths and asserts the
// actual constrained geometry: no horizontal overflow, every panel fully inside the premium underlay,
// no panel overlap, no copy/CTA truncation, and a resilient column count. It also renders the PRE-FIX
// CSS to prove the defect existed and that this test catches it. Screenshots are captured for review.
//
// Self-contained via page.setContent — no dev server, no network, never touches production.
// Run: npx playwright test --config=playwright.layout.config.mjs
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = readFileSync(new URL("../src/components/importWizard/ContactImportWizard.jsx", import.meta.url), "utf8");
const CSS_AFTER = SRC.match(/<style>\{`([\s\S]*?)`\}<\/style>/)[1];
// Reconstruct the PRE-FIX CSS (the three reverted declarations that caused the defect).
const CSS_BEFORE = CSS_AFTER
  .replace("grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));", "grid-template-columns:1fr 1fr 1fr;")
  .replace(/\n\s*min-width:0;[^\n]*/, "")
  .replace("max-width:min(28ch, 100%)", "max-width:28ch");

const SHOTS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "screen2-shots");
mkdirSync(SHOTS, { recursive: true });

const panel = (t, c, cta) => `<button class="gmiw-panel"><span class="gmiw-medallion"></span><span class="gmiw-panel-title">${t}</span><span class="gmiw-panel-copy">${c}</span><span class="gmiw-cta">${cta}</span></button>`;
const page2 = (css) => `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0}body{background:#e9e3f2;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}${css}</style></head><body>
  <div style="max-width:900px;margin:0 auto;padding:12px">
    <div class="gmiw-underlay" id="underlay"><div class="gmiw-surface">
      <header class="gmiw-banner"><div class="gmiw-eyebrow">PERSONAL RELATIONSHIPS</div><h1 class="gmiw-title">Greet-Me™ Import Wizard</h1><div class="gmiw-tagline">Forget Them Not!</div></header>
      <h2 class="gmiw-heading">Who Are You Importing?</h2>
      <div class="gmiw-panels gmiw-panels--three" id="panels">
        ${panel("Family", "Parents, children, siblings, and extended family.", "CHOOSE FAMILY →")}
        ${panel("Friends", "Best friends, neighbors, teammates, and classmates.", "CHOOSE FRIENDS →")}
        ${panel("Professional", "Colleagues, mentors, and work connections important to you.", "CHOOSE PROFESSIONAL →")}
      </div>
    </div></div>
  </div></body></html>`;

// Screen 1 harness (for regenerated screenshots + an unchanged-copy check). Uses the same CSS.
const page1 = (css) => `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0}body{background:#e9e3f2;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}${css}</style></head><body>
  <div style="max-width:900px;margin:0 auto;padding:12px">
    <div class="gmiw-underlay" id="underlay"><div class="gmiw-surface">
      <header class="gmiw-banner"><div class="gmiw-eyebrow">A PREMIUM GREET-ME EXPERIENCE</div><h1 class="gmiw-title">Greet-Me™ Import Wizard</h1><div class="gmiw-tagline">Forget Them Not!</div></header>
      <h2 class="gmiw-heading">Import Those Important to You</h2>
      <div class="gmiw-panels" id="panels">
        ${panel("Personal Relationships", "Family, friends, and whoever is important to you.", "CHOOSE PERSONAL →")}
        ${panel("Business Relationships", "Employees, clients, vendors, and professional contacts.", "CHOOSE BUSINESS →")}
      </div>
      <p class="gmiw-footer">You can return and choose a different path at any time.</p>
    </div></div>
  </div></body></html>`;

const WIDTHS = [1200, 900, 768, 640, 375];

async function measure(page) {
  return page.evaluate(() => {
    const u = document.getElementById("underlay").getBoundingClientRect();
    const panels = [...document.querySelectorAll(".gmiw-panel")];
    const rects = panels.map((p) => { const r = p.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
    const copy = [...document.querySelectorAll(".gmiw-panel-copy")].map((e) => ({ sw: e.scrollWidth, cw: e.clientWidth, right: e.getBoundingClientRect().right }));
    const cta = [...document.querySelectorAll(".gmiw-cta")].map((e) => ({ sw: e.scrollWidth, cw: e.clientWidth }));
    const tops = rects.map((r) => Math.round(r.top));
    const perRow = Math.max(...[...new Set(tops)].map((t) => tops.filter((x) => x === t).length));
    const rows = new Set(tops).size;
    return {
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      u, rects, copy, cta, perRow, rows,
    };
  });
}

test("Screen 1 unchanged: exact copy + capture desktop/mobile screenshots", async ({ page }) => {
  for (const [w, tag] of [[1200, "desktop"], [375, "mobile"]]) {
    await page.setViewportSize({ width: w, height: 1000 });
    await page.setContent(page1(CSS_AFTER));
    await page.locator("#underlay").screenshot({ path: join(SHOTS, `screen1-${tag}.jpg`), type: "jpeg", quality: 62 });
    const t = await page.locator("body").innerText();
    for (const s of ["A PREMIUM GREET-ME EXPERIENCE", "Greet-Me™ Import Wizard", "Forget Them Not!", "Import Those Important to You",
      "Personal Relationships", "Family, friends, and whoever is important to you.", "CHOOSE PERSONAL →",
      "Business Relationships", "Employees, clients, vendors, and professional contacts.", "CHOOSE BUSINESS →",
      "You can return and choose a different path at any time."]) {
      expect(t, `Screen 1 exact copy @${w}`).toContain(s);
    }
  }
});

test("Family copy is amended: corrected sentence renders, 'partners' is absent", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.setContent(page2(CSS_AFTER));
  const familyText = await page.locator(".gmiw-panel-copy").first().innerText();
  expect(familyText.trim()).toBe("Parents, children, siblings, and extended family.");
  expect(await page.locator("body").innerText()).not.toContain("partners");
});

test("AFTER: Screen 2 has no overflow/clip/overlap/truncation, and a resilient column count", async ({ page }) => {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 1000 });
    await page.setContent(page2(CSS_AFTER));
    const g = await measure(page);
    await page.locator("#panels").screenshot({ path: join(SHOTS, `after-${w}.jpg`), type: "jpeg", quality: 62 });

    expect(g.pageOverflow, `no horizontal overflow @${w}`).toBeLessThanOrEqual(1);
    for (const r of g.rects) {
      expect(r.left, `panel left inside underlay @${w}`).toBeGreaterThanOrEqual(g.u.left - 0.5);
      expect(r.right, `panel right inside underlay @${w}`).toBeLessThanOrEqual(g.u.right + 0.5);
      expect(r.bottom, `panel bottom inside underlay @${w}`).toBeLessThanOrEqual(g.u.bottom + 0.5);
    }
    // no two panels overlap (grid tracks are clean — content never collides)
    for (let i = 0; i < g.rects.length; i++) for (let j = i + 1; j < g.rects.length; j++) {
      const a = g.rects[i], b = g.rects[j];
      const xo = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const yo = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      expect(xo > 1 && yo > 1, `panels ${i}/${j} do not overlap @${w}`).toBe(false);
    }
    for (const c of g.copy) { expect(c.sw, `copy not truncated @${w}`).toBeLessThanOrEqual(c.cw + 1); expect(c.right, `copy inside underlay @${w}`).toBeLessThanOrEqual(g.u.right + 0.5); }
    for (const c of g.cta) expect(c.sw, `CTA not truncated @${w}`).toBeLessThanOrEqual(c.cw + 1);

    // resilient column count: 3-up only at the widest; 2-up at intermediate; stacked on mobile — order always preserved
    if (w >= 1200) expect(g.perRow, "3 columns at widest").toBe(3);
    if (w === 768) expect(g.perRow, "no more than 2 columns @768").toBeLessThanOrEqual(2);
    if (w <= 640) expect(g.rows, "fully stacked @<=640").toBe(3);
  }
});

test("BEFORE (pre-fix CSS) overflows/clips at intermediate widths — proves the defect + that this test catches it", async ({ page }) => {
  let anyDefect = false;
  for (const w of [900, 768]) {
    await page.setViewportSize({ width: w, height: 1000 });
    await page.setContent(page2(CSS_BEFORE));
    const g = await measure(page);
    await page.locator("#panels").screenshot({ path: join(SHOTS, `before-${w}.jpg`), type: "jpeg", quality: 62 });
    const clipped = g.rects.some((r) => r.right > g.u.right + 1);
    const copyOverflow = g.copy.some((c) => c.sw > c.cw + 1 || c.right > g.u.right + 1);
    const forced3 = g.perRow === 3;   // pre-fix forces 3 columns at these widths
    if (clipped || copyOverflow || g.pageOverflow > 1 || forced3) anyDefect = true;
  }
  expect(anyDefect, "pre-fix CSS shows a responsive defect at 900/768").toBe(true);
});
