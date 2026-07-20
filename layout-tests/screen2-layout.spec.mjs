// layout-tests/screen2-layout.spec.mjs
//
// REAL-BROWSER (Chromium) geometry proof for the shared premium Wizard tile presentation on BOTH
// Screen 1 (Personal / Business) and Screen 2 (Family / Friends / Professional). jsdom cannot measure
// painted layout, so this renders the EXACT shipped gmiw CSS (extracted from ContactImportWizard.jsx)
// with the real tile markup and asserts, per tile, that title/description/CTA are fully contained —
// at eight viewport widths AND, critically, in a NARROW CONTENT CONTAINER at a WIDE viewport (the
// Founder's "browser at half a desktop" case, which viewport-based breakpoints miss). A regression
// fixture renders the previously-deployed CSS and proves this test detects the Founder's clipping.
//
// Self-contained via page.setContent — no server, no network, never touches production.
// Run: npx playwright test --config=playwright.layout.config.mjs
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = readFileSync(new URL("../src/components/importWizard/ContactImportWizard.jsx", import.meta.url), "utf8");
const CSS_AFTER = SRC.match(/<style>\{`([\s\S]*?)`\}<\/style>/)[1];
// Reconstruct the PREVIOUSLY-DEPLOYED CSS by reverting exactly the containment declarations this fix
// changed — so the regression fixture reflects what the Founder actually saw.
const CSS_BEFORE = CSS_AFTER
  .replace("grid-template-columns:repeat(auto-fit, minmax(min(100%, 300px), 1fr))", "grid-template-columns:1fr 1fr")
  .replace("grid-template-columns:repeat(auto-fit, minmax(min(100%, 240px), 1fr))", "grid-template-columns:repeat(auto-fit, minmax(240px, 1fr))")
  .replace("box-sizing:border-box; width:100%; min-width:0;", "min-width:0;")
  .replace("min-height:230px; height:auto;", "min-height:230px;")
  .replace("letter-spacing:-.01em; max-width:100%; overflow-wrap:anywhere; }", "letter-spacing:-.01em; }")
  .replace("max-width:min(30ch, 100%); line-height:1.5; white-space:normal; overflow-wrap:anywhere;", "max-width:min(28ch, 100%); line-height:1.5; overflow-wrap:break-word;")
  .replace("color:#6b3fa0; max-width:100%; overflow-wrap:anywhere; }", "color:#6b3fa0; }");

const SHOTS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "screen2-shots");
mkdirSync(SHOTS, { recursive: true });

const panel = (t, c, cta) => `<button type="button" class="gmiw-panel"><span class="gmiw-medallion"></span><span class="gmiw-panel-title">${t}</span><span class="gmiw-panel-copy">${c}</span><span class="gmiw-cta">${cta}</span></button>`;
const TILES1 = [
  ["Personal Relationships", "Family, friends, and whoever is important to you.", "CHOOSE PERSONAL →"],
  ["Business Relationships", "Employees, clients, vendors, and professional contacts.", "CHOOSE BUSINESS →"],
];
const TILES2 = [
  ["Family", "Parents, children, siblings, and extended family.", "CHOOSE FAMILY →"],
  ["Friends", "Best friends, neighbors, teammates, and classmates.", "CHOOSE FRIENDS →"],
  ["Professional", "Colleagues, mentors, and work connections important to you.", "CHOOSE PROFESSIONAL →"],
];
// wrap = "max-width:900px" (normal) or "width:NNNpx" (constrained content area / half-screen)
function pageFor(css, { screen, wrap }) {
  const tiles = screen === 1 ? TILES1 : TILES2;
  const panelsClass = screen === 1 ? "gmiw-panels" : "gmiw-panels gmiw-panels--three";
  const eyebrow = screen === 1 ? "A PREMIUM GREET-ME EXPERIENCE" : "PERSONAL RELATIONSHIPS";
  const heading = screen === 1 ? "Import Those Important to You" : "Who Are You Importing?";
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0}body{background:#e9e3f2;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}${css}</style></head><body>
    <div style="${wrap};margin:0 auto;padding:12px">
      <div class="gmiw-underlay" id="underlay"><div class="gmiw-surface">
        <header class="gmiw-banner"><div class="gmiw-eyebrow">${eyebrow}</div><h1 class="gmiw-title">Greet-Me™ Import Wizard</h1><div class="gmiw-tagline">Forget Them Not!</div></header>
        <h2 class="gmiw-heading">${heading}</h2>
        <div class="${panelsClass}" id="panels">${tiles.map((t) => panel(...t)).join("")}</div>
      </div></div>
    </div></body></html>`;
}

async function measure(page) {
  return page.evaluate(() => {
    const u = document.getElementById("underlay").getBoundingClientRect();
    const R = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
    const tiles = [...document.querySelectorAll(".gmiw-panel")].map((p) => {
      const parts = {};
      for (const [k, sel] of [["title", ".gmiw-panel-title"], ["copy", ".gmiw-panel-copy"], ["cta", ".gmiw-cta"]]) {
        const el = p.querySelector(sel);
        parts[k] = { rect: R(el), sw: el.scrollWidth, cw: el.clientWidth, ws: getComputedStyle(el).whiteSpace };
      }
      return { rect: R(p), sw: p.scrollWidth, cw: p.clientWidth, sh: p.scrollHeight, ch: p.clientHeight, parts };
    });
    return {
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      u, tiles,
    };
  });
}

function assertContained(g, w, label) {
  expect(g.pageOverflow, `[${label}] no horizontal page scroll @${w}`).toBeLessThanOrEqual(1);
  for (const t of g.tiles) {
    expect(t.sw, `[${label}] tile no horizontal overflow @${w}`).toBeLessThanOrEqual(t.cw + 1);
    expect(t.sh, `[${label}] tile no vertical clip (grows to fit) @${w}`).toBeLessThanOrEqual(t.ch + 1);
    expect(t.rect.left, `[${label}] tile left in underlay @${w}`).toBeGreaterThanOrEqual(g.u.left - 0.5);
    expect(t.rect.right, `[${label}] tile right in underlay @${w}`).toBeLessThanOrEqual(g.u.right + 0.5);
    expect(t.rect.bottom, `[${label}] tile bottom in underlay @${w}`).toBeLessThanOrEqual(g.u.bottom + 0.5);
    for (const k of ["title", "copy", "cta"]) {
      const p = t.parts[k];
      expect(p.sw, `[${label}] ${k} not truncated @${w}`).toBeLessThanOrEqual(p.cw + 1);
      expect(p.rect.left, `[${label}] ${k} inside tile L @${w}`).toBeGreaterThanOrEqual(t.rect.left - 0.5);
      expect(p.rect.right, `[${label}] ${k} inside tile R @${w}`).toBeLessThanOrEqual(t.rect.right + 0.5);
    }
    expect(t.parts.copy.ws, `[${label}] description wraps (white-space normal) @${w}`).not.toBe("nowrap");
  }
  for (let i = 0; i < g.tiles.length; i++) for (let j = i + 1; j < g.tiles.length; j++) {
    const a = g.tiles[i].rect, b = g.tiles[j].rect;
    const xo = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const yo = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    expect(xo > 1 && yo > 1, `[${label}] tiles ${i}/${j} don't overlap @${w}`).toBe(false);
  }
}

const WIDTHS = [1440, 1200, 1024, 900, 768, 640, 480, 375];

for (const screen of [1, 2]) {
  test(`AFTER Screen ${screen}: tiles fully contain title/copy/CTA at every viewport width`, async ({ page }) => {
    const expectCopy = (screen === 1 ? TILES1 : TILES2).flatMap((t) => [t[0], t[1], t[2]]);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 1100 });
      await page.setContent(pageFor(CSS_AFTER, { screen, wrap: "max-width:900px" }));
      const g = await measure(page);
      await page.locator("#underlay").screenshot({ path: join(SHOTS, `s${screen}-after-${w}.jpg`), type: "jpeg", quality: 55 });
      assertContained(g, w, `S${screen}`);
      const body = await page.locator("body").innerText();
      for (const s of expectCopy) expect(body, `exact copy present @${w}`).toContain(s);
      if (screen === 2) expect(body).not.toContain("partners");
    }
  });
}

// THE FOUNDER'S CASE: wide viewport, but a NARROW content container (half-screen / dashboard chrome).
const CONSTRAINED = [640, 560, 480, 420, 360];
for (const screen of [1, 2]) {
  test(`AFTER Screen ${screen}: contained in a NARROW container at a WIDE viewport (Founder half-screen)`, async ({ page }) => {
    await page.setViewportSize({ width: 1360, height: 1100 });
    for (const cw of CONSTRAINED) {
      await page.setContent(pageFor(CSS_AFTER, { screen, wrap: `width:${cw}px` }));
      const g = await measure(page);
      await page.locator("#underlay").screenshot({ path: join(SHOTS, `s${screen}-after-container-${cw}.jpg`), type: "jpeg", quality: 55 });
      assertContained(g, `container${cw}`, `S${screen}-narrow`);
    }
  });
}

test("REGRESSION: the previously-deployed CSS clips in a narrow container (Founder's finding) — proves the test detects it", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 1100 });
  let anyDefect = false;
  for (const screen of [1, 2]) {
    for (const cw of [520, 460, 400]) {
      await page.setContent(pageFor(CSS_BEFORE, { screen, wrap: `width:${cw}px` }));
      const g = await measure(page);
      await page.locator("#underlay").screenshot({ path: join(SHOTS, `s${screen}-before-container-${cw}.jpg`), type: "jpeg", quality: 55 });
      const tileOverflow = g.tiles.some((t) => t.sw > t.cw + 1 || t.rect.right > g.u.right + 1);
      const textOverflow = g.tiles.some((t) => ["title", "copy", "cta"].some((k) => t.parts[k].sw > t.parts[k].cw + 1 || t.parts[k].rect.right > t.rect.right + 1));
      if (tileOverflow || textOverflow || g.pageOverflow > 1) anyDefect = true;
    }
  }
  expect(anyDefect, "deployed CSS overflows a tile/its text in a narrow container").toBe(true);
});

// ---- Business category selector (Employees / Clients / Vendors) — mirrors the Personal Screen 2 ----
const TILESB = [
  ["Employees", "Employees, personnel, departments, and workplace contacts.", "CHOOSE EMPLOYEES →"],
  ["Clients", "Clients, customers, companies, and important customer contacts.", "CHOOSE CLIENTS →"],
  ["Vendors", "Vendors, suppliers, service providers, and business partners.", "CHOOSE VENDORS →"],
];
function pageBiz(css, wrap) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0}body{background:#e9e3f2;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}${css}</style></head><body>
    <div style="${wrap};margin:0 auto;padding:12px">
      <div class="gmiw-underlay" id="underlay"><div class="gmiw-surface">
        <header class="gmiw-banner"><div class="gmiw-eyebrow">BUSINESS RELATIONSHIPS</div><h1 class="gmiw-title">Greet-Me™ Import Wizard</h1><div class="gmiw-tagline">Forget Them Not!</div></header>
        <h2 class="gmiw-heading">Who Are You Importing?</h2>
        <div class="gmiw-panels gmiw-panels--three" id="panels">${TILESB.map((t) => panel(...t)).join("")}</div>
      </div></div>
    </div></body></html>`;
}
test("Business selector tiles fully contain title/copy/CTA at every width AND in a narrow container", async ({ page }) => {
  const expectCopy = TILESB.flatMap((t) => [t[0], t[1], t[2]]);
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 1100 });
    await page.setContent(pageBiz(CSS_AFTER, "max-width:900px"));
    const g = await measure(page);
    await page.locator("#underlay").screenshot({ path: join(SHOTS, `biz-after-${w}.jpg`), type: "jpeg", quality: 55 });
    assertContained(g, w, "Biz");
    const body = await page.locator("body").innerText();
    for (const s of expectCopy) expect(body, `exact business copy @${w}`).toContain(s);
  }
  await page.setViewportSize({ width: 1360, height: 1100 });
  for (const cw of CONSTRAINED) {
    await page.setContent(pageBiz(CSS_AFTER, `width:${cw}px`));
    const g = await measure(page);
    await page.locator("#underlay").screenshot({ path: join(SHOTS, `biz-after-container-${cw}.jpg`), type: "jpeg", quality: 55 });
    assertContained(g, `container${cw}`, "Biz-narrow");
  }
});

// ---- Upload Options screen (all six categories) — canonical heading + stacked sections + OR divider ----
const CARD = "background:#fff;border:1px solid rgba(27,24,48,.1);border-radius:14px;padding:18px";
function pageUpload(css, heading, wrap) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0}body{background:#e9e3f2;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}${css}</style></head><body>
    <div style="${wrap};margin:0 auto;padding:12px">
      <div class="gmiw-underlay" id="underlay"><div class="gmiw-surface">
        <header class="gmiw-banner"><div class="gmiw-eyebrow">A PREMIUM GREET-ME EXPERIENCE</div><h1 class="gmiw-title">Greet-Me™ Import Wizard</h1><div class="gmiw-tagline">Forget Them Not!</div></header>
        <div class="gmiw-upload" id="upload">
          <div id="ctx" style="${CARD};display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px">
            <b id="uploadheading" style="font-family:Georgia,serif;font-size:1.05rem">${heading}</b>
            <button style="background:transparent;border:1px solid rgba(27,24,48,.15);color:#4a3fb0;border-radius:11px;padding:4px 10px;font-weight:700;font-size:.78rem">Change</button>
          </div>
          <section class="gmiw-upsec" id="sec1">
            <h3>Upload your contacts</h3>
            <p>Choose your own CSV file. Only a name and valid email are required; you can review everything before importing.</p>
            <label class="gmiw-choose">Choose a CSV file</label>
          </section>
          <div class="gmiw-or" id="ordiv"><span>OR</span></div>
          <section class="gmiw-upsec gmiw-practice" id="sec2">
            <span class="gmiw-badge">Safe practice mode</span>
            <h3>Test Drive the Import Wizard</h3>
            <p>See the complete import process using fictional contacts. Nothing will be saved or sent.</p>
            <ul><li>Download the Practice CSV and upload it yourself.</li><li>Start test drive instantly with the Practice CSV already loaded.</li></ul>
            <div class="gmiw-practice-cta"><button style="background:transparent;border:1px solid rgba(27,24,48,.15);color:#1b1830;border-radius:11px;padding:10px 16px;font-weight:700;font-size:.85rem">Download Practice CSV</button><button style="background:linear-gradient(135deg,#6d74ee,#764ba2);color:#fff;border:none;border-radius:11px;padding:10px 16px;font-weight:700;font-size:.85rem">Start Test Drive</button></div>
          </section>
        </div>
      </div></div>
    </div></body></html>`;
}
const UPLOAD_HEADINGS = {
  family: "Import Family Contacts", friend: "Import Friend Contacts", professional: "Import Professional Contacts",
  employee: "Import Employee Contacts", client: "Import Client Contacts", vendor: "Import Vendor Contacts",
};
test("Upload Options: six canonical headings + stacked sections + OR divider fit cleanly (desktop/mobile/narrow)", async ({ page }) => {
  for (const [g, heading] of Object.entries(UPLOAD_HEADINGS)) {
    for (const [tag, vp, wrap] of [["desktop", 1200, "max-width:900px"], ["mobile", 390, "max-width:900px"], ["narrow", 1360, "width:460px"]]) {
      await page.setViewportSize({ width: vp, height: 1000 });
      await page.setContent(pageUpload(CSS_AFTER, heading, wrap));
      const m = await page.evaluate(() => {
        const u = document.getElementById("underlay").getBoundingClientRect();
        const h = document.getElementById("uploadheading"); const hr = h.getBoundingClientRect();
        const ctx = document.getElementById("ctx").getBoundingClientRect();
        const up = document.getElementById("upload");
        const orr = document.getElementById("ordiv"); const od = orr.getBoundingClientRect();
        const s1 = document.getElementById("sec1").getBoundingClientRect();
        const s2 = document.getElementById("sec2").getBoundingClientRect();
        return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          sw: h.scrollWidth, cw: h.clientWidth, text: h.innerText, hRight: hr.right,
          ctxL: ctx.left, ctxR: ctx.right, uL: u.left, uR: u.right,
          upSw: up.scrollWidth, upCw: up.clientWidth,
          orText: orr.innerText.trim(), orL: od.left, orR: od.right,
          s1Bottom: s1.bottom, s2Top: s2.top, s1L: s1.left, s2L: s2.left };
      });
      await page.locator("#underlay").screenshot({ path: join(SHOTS, `upload-${g}-${tag}.jpg`), type: "jpeg", quality: 60 });
      expect(m.text, `exact heading ${g}`).toBe(heading);
      expect(m.sw, `heading not clipped ${g}/${tag}`).toBeLessThanOrEqual(m.cw + 1);
      expect(m.over, `no horizontal scroll ${g}/${tag}`).toBeLessThanOrEqual(1);
      expect(m.upSw, `upload column no horizontal overflow ${g}/${tag}`).toBeLessThanOrEqual(m.upCw + 1);
      expect(m.ctxL, `context in underlay L ${g}/${tag}`).toBeGreaterThanOrEqual(m.uL - 0.5);
      expect(m.ctxR, `context in underlay R ${g}/${tag}`).toBeLessThanOrEqual(m.uR + 0.5);
      expect(m.hRight, `heading inside its card ${g}/${tag}`).toBeLessThanOrEqual(m.ctxR + 0.5);
      // OR divider: visible text, contained in the underlay
      expect(m.orText, `divider is the 'OR' text ${g}/${tag}`).toBe("OR");
      expect(m.orL, `divider in underlay L ${g}/${tag}`).toBeGreaterThanOrEqual(m.uL - 0.5);
      expect(m.orR, `divider in underlay R ${g}/${tag}`).toBeLessThanOrEqual(m.uR + 0.5);
      // sections are STACKED vertically (not side by side) at every width
      expect(m.s2Top, `Test Drive section below Upload section ${g}/${tag}`).toBeGreaterThanOrEqual(m.s1Bottom - 0.5);
      expect(Math.abs(m.s1L - m.s2L), `sections share the same left edge (stacked) ${g}/${tag}`).toBeLessThanOrEqual(1);
    }
  }
});

// ---- Upload Options template block + recommended-defaults notice: contained + wrapping ----
function pageOptionsPlus(css, wrap) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0}body{background:#e9e3f2;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}${css}</style></head><body>
    <div style="${wrap};margin:0 auto;padding:12px">
      <div class="gmiw-underlay" id="underlay"><div class="gmiw-surface">
        <div class="gmiw-upload" id="upload">
          <section class="gmiw-upsec" id="sec1">
            <h3>Upload your contacts</h3>
            <label class="gmiw-choose">Choose a CSV file</label>
            <div class="gmiw-template" id="tpl">
              <h4>Need a file to fill out?</h4>
              <p>Download a blank template with the right columns for this contact type, complete it, then upload it here.</p>
              <div class="gmiw-template-cta" id="tplcta"><button style="padding:10px 16px">Download Excel Template</button><button style="padding:10px 16px">Download CSV Template</button></div>
            </div>
          </section>
          <div class="gmiw-defaults" id="dflt">
            <b>Recommended settings are available</b>
            <p>We can apply conservative relationship settings to contacts with missing details. Existing CSV values and any changes you make will always take priority.</p>
            <p style="font-weight:700">Apply recommended settings to 12 contacts</p>
            <div class="gmiw-defaults-cta" id="dfltcta"><button style="padding:10px 16px">Apply recommended settings</button><button style="padding:10px 16px">Review individually</button></div>
          </div>
        </div>
      </div></div>
    </div></body></html>`;
}
test("Template block + defaults notice fit and wrap cleanly (desktop/narrow/mobile)", async ({ page }) => {
  for (const [tag, vp, wrap] of [["desktop", 1200, "max-width:900px"], ["mobile", 390, "max-width:900px"], ["narrow", 1360, "width:380px"]]) {
    await page.setViewportSize({ width: vp, height: 1000 });
    await page.setContent(pageOptionsPlus(CSS_AFTER, wrap));
    const m = await page.evaluate(() => {
      const u = document.getElementById("underlay").getBoundingClientRect();
      const rect = (id) => document.getElementById(id).getBoundingClientRect();
      const sw = (id) => { const e = document.getElementById(id); return { sw: e.scrollWidth, cw: e.clientWidth }; };
      return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        uL: u.left, uR: u.right, tpl: rect("tpl"), dflt: rect("dflt"), tplSw: sw("tpl"), dfltSw: sw("dflt"), upSw: sw("upload") };
    });
    await page.locator("#underlay").screenshot({ path: join(SHOTS, `options-plus-${tag}.jpg`), type: "jpeg", quality: 60 });
    expect(m.over, `no horizontal scroll ${tag}`).toBeLessThanOrEqual(1);
    expect(m.upSw.sw, `upload column no overflow ${tag}`).toBeLessThanOrEqual(m.upSw.cw + 1);
    expect(m.tplSw.sw, `template block no overflow ${tag}`).toBeLessThanOrEqual(m.tplSw.cw + 1);
    expect(m.dfltSw.sw, `defaults notice no overflow ${tag}`).toBeLessThanOrEqual(m.dfltSw.cw + 1);
    expect(m.tpl.left, `template in underlay L ${tag}`).toBeGreaterThanOrEqual(m.uL - 0.5);
    expect(m.tpl.right, `template in underlay R ${tag}`).toBeLessThanOrEqual(m.uR + 0.5);
    expect(m.dflt.right, `defaults in underlay R ${tag}`).toBeLessThanOrEqual(m.uR + 0.5);
  }
});

// ---- ContactForm relationship row: Type / Relation / Description align on desktop, stack on mobile ----
function pageRelationRow(cols) {
  const cell = (id, label) => `<div id="${id}"><label style="display:block;font-size:0.8125rem;font-weight:600;color:#555;margin-bottom:0.375rem">${label}</label><select id="${id}-s" style="width:100%;padding:0.625rem 0.875rem;border:1.5px solid #ccc;border-radius:8px;font-size:1rem;font-family:inherit"><option>Select...</option></select></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0}body{font-family:system-ui,sans-serif}</style></head><body>
    <div style="max-width:900px;margin:0 auto;padding:12px">
      <div style="display:grid;grid-template-columns:${cols === 3 ? "1fr 1fr 1fr" : "1fr"};gap:1rem">
        ${cell("c0", "Type")}${cell("c1", "Relation")}${cell("c2", "Description")}
      </div>
    </div></body></html>`;
}
test("Relation controls align on the same baseline (desktop) and stack cleanly (mobile)", async ({ page }) => {
  // Desktop: 3 columns → the three selects share the same top (aligned baseline)
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.setContent(pageRelationRow(3));
  const tops = await page.evaluate(() => ["c0-s", "c1-s", "c2-s"].map((id) => document.getElementById(id).getBoundingClientRect().top));
  expect(Math.max(...tops) - Math.min(...tops), "selects aligned on one baseline").toBeLessThanOrEqual(1);
  // Mobile: single column, order Type → Relation → Description, no horizontal overflow
  await page.setViewportSize({ width: 380, height: 900 });
  await page.setContent(pageRelationRow(1));
  const stacked = await page.evaluate(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect();
    return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      t0: r("c0").top, t1: r("c1").top, t2: r("c2").top, l0: r("c0").left, l1: r("c1").left, l2: r("c2").left };
  });
  expect(stacked.over, "no horizontal overflow on mobile").toBeLessThanOrEqual(1);
  expect(stacked.t1, "Relation below Type").toBeGreaterThan(stacked.t0);
  expect(stacked.t2, "Description below Relation").toBeGreaterThan(stacked.t1);
  expect(Math.abs(stacked.l0 - stacked.l1) + Math.abs(stacked.l1 - stacked.l2), "stacked controls share a left edge").toBeLessThanOrEqual(1);
});
