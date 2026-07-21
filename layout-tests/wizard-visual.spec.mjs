// layout-tests/wizard-visual.spec.mjs
//
// REAL-COMPONENT (Chromium) visual proof. The EXACT shipped ContactImportWizard.jsx is esbuild-bundled
// WITH react/react-dom (side-effect modules stubbed with functional stubs) and mounted in a real
// browser page — not a hand-authored mockup. We drive the real flow with real clicks / a real file
// input and screenshot each Founder-review state (Personal + Business selectors, both Upload Options,
// a Test Drive preview for each path, and the truthful dormant state from a real Business-upload).
// Self-contained via page.setContent — no server, no network, never touches production.
// Run: npx playwright test --config=playwright.layout.config.mjs wizard-visual
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, "..", "..", "wizard-visual-shots");
mkdirSync(SHOTS, { recursive: true });

const PAPA_STUB = `export const parse = (file, opts) => { Promise.resolve(file && file.text ? file.text() : "").then((t) => {
  const lines = String(t).trim().split(/\\r?\\n/).filter(Boolean);
  const fields = (lines[0] || "").split(",").map((s) => s.trim());
  const data = lines.slice(1).map((l) => { const cells = l.split(","); const o = {}; fields.forEach((f, i) => { o[f] = (cells[i] || "").trim(); }); return o; });
  opts && opts.complete && opts.complete({ data, meta: { fields } });
}); }; export default { parse };`;
const API_STUB = `export default { async getContacts(){ return { data: [] }; }, async importContacts(c){ return { data: { imported: c.length, failed: 0, errors: [] } }; } };`;
const ROUTER_STUB = `export const useNavigate = () => (() => {});`;
const NOTIFY_STUB = `export const showManualToast = () => {};`;
const COMMS_STUB = `export const COMMS_CATEGORIES = { PROFILE: "profile" };`;

let BUNDLE = "";
test.beforeAll(async () => {
  const stub = {
    name: "stub",
    setup(b) {
      b.onResolve({ filter: /(^papaparse$|\/api\/api$|react-router-dom$|utils\/notify$|utils\/commsCatalog$)/ }, (a) => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => {
        const p = a.path;
        const contents = /papaparse/.test(p) ? PAPA_STUB
          : /react-router-dom/.test(p) ? ROUTER_STUB
          : /notify/.test(p) ? NOTIFY_STUB
          : /commsCatalog/.test(p) ? COMMS_STUB
          : API_STUB;
        return { contents, loader: "js" };
      });
    },
  };
  const entry = `import React from "react"; import { createRoot } from "react-dom/client";
    import Wizard from "${join(__dirname, "..", "src", "components", "importWizard", "ContactImportWizard.jsx").replace(/\\/g, "/")}";
    window.__mount = (el) => createRoot(el).render(React.createElement(Wizard));`;
  const out = await esbuild.build({
    stdin: { contents: entry, resolveDir: __dirname, loader: "js" },
    write: false, bundle: true, format: "iife", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [stub], logLevel: "silent",
  });
  BUNDLE = out.outputFiles[0].text;
});

const SHELL = (bundle) => `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box} html,body{margin:0} body{background:#e9e3f2;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
  </style></head><body><div id="root"></div><script>${bundle}</script></body></html>`;

async function mount(page, width) {
  await page.setViewportSize({ width, height: 1100 });
  await page.setContent(SHELL(BUNDLE));
  await page.evaluate(() => window.__mount(document.getElementById("root")));
  await page.waitForSelector('[data-testid="path-panels"]');
}
const shot = (page, name) => page.locator(".gmiw-underlay, [data-testid='confirm-screen'], body").first().screenshot({ path: join(SHOTS, `${name}.jpg`), type: "jpeg", quality: 62 });

test("Personal + Business selectors (desktop + mobile)", async ({ page }) => {
  for (const [tag, w] of [["desktop", 1200], ["mobile", 390]]) {
    await mount(page, w);
    await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, `screen1-${tag}.jpg`), type: "jpeg", quality: 62 });
    await mount(page, w);
    await page.click('[data-testid="panel-personal"]');
    await page.waitForSelector('[data-testid="group-panels"]');
    await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, `personal-selector-${tag}.jpg`), type: "jpeg", quality: 62 });
    await mount(page, w);
    await page.click('[data-testid="panel-business"]');
    await page.waitForSelector('[data-testid="biz-panels"]');
    await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, `business-selector-${tag}.jpg`), type: "jpeg", quality: 62 });
    expect(await page.locator('[data-testid="biz-panels"] .gmiw-panel').count()).toBe(3);
  }
});

test("Personal + Business Upload Options (desktop / narrow / mobile)", async ({ page }) => {
  for (const [tag, w] of [["desktop", 1200], ["mobile", 390]]) {
    await mount(page, w);
    await page.click('[data-testid="panel-personal"]');
    await page.click('[data-testid="panel-family"]');
    await page.waitForSelector('[data-testid="upload-context"]');
    await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, `personal-upload-${tag}.jpg`), type: "jpeg", quality: 62 });
    await expect(page.locator('[data-testid="upload-context"]')).toContainText("Import Family Contacts");
    await mount(page, w);
    await page.click('[data-testid="panel-business"]');
    await page.click('[data-testid="panel-vendor"]');
    await page.waitForSelector('[data-testid="upload-context"]');
    await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, `business-upload-${tag}.jpg`), type: "jpeg", quality: 62 });
    await expect(page.locator('[data-testid="upload-context"]')).toContainText("Import Vendor Contacts");
  }
  // narrow content container at a wide viewport
  await page.setViewportSize({ width: 1360, height: 1100 });
  await page.setContent(SHELL(BUNDLE).replace('<div id="root">', '<div id="root" style="width:460px;margin:0 auto">'));
  await page.evaluate(() => window.__mount(document.getElementById("root")));
  await page.waitForSelector('[data-testid="path-panels"]');
  await page.click('[data-testid="panel-business"]');
  await page.click('[data-testid="panel-client"]');
  await page.waitForSelector('[data-testid="upload-context"]');
  await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, "business-upload-narrow.jpg"), type: "jpeg", quality: 62 });
});

test("Test Drive previews (Personal + Business) — zero mutation", async ({ page }) => {
  await mount(page, 1200);
  await page.click('[data-testid="panel-personal"]');
  await page.click('[data-testid="panel-friend"]');
  await page.click('[data-testid="start-testdrive"]');
  await page.waitForSelector('[data-testid="confirm-screen"]');
  await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, "personal-testdrive.jpg"), type: "jpeg", quality: 62 });
  await expect(page.locator("body")).toContainText("Preview your practice contacts");

  await mount(page, 1200);
  await page.click('[data-testid="panel-business"]');
  await page.click('[data-testid="panel-employee"]');
  await page.click('[data-testid="start-testdrive"]');
  await page.waitForSelector('[data-testid="confirm-screen"]');
  await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, "business-testdrive.jpg"), type: "jpeg", quality: 62 });
  await expect(page.locator('[data-testid="add-cta"]')).toContainText("practice recipient");
});

test("Truthful dormant state from a real Business-upload attempt", async ({ page }) => {
  await mount(page, 1200);
  await page.click('[data-testid="panel-business"]');
  await page.click('[data-testid="panel-client"]');
  await page.waitForSelector('[data-testid="choose-csv"]');
  await page.setInputFiles('input[type="file"]', { name: "clients.csv", mimeType: "text/csv", buffer: Buffer.from("Name,Email\nAcme,acme@example.com") });
  await page.waitForSelector('[data-testid="biz-dormant"]');
  await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, "business-dormant.jpg"), type: "jpeg", quality: 62 });
  await expect(page.locator("body")).toContainText("Organization import is currently turned off");
});

// ---- Recommended-defaults flow (real Personal Review): before / notice / applied / undo ----
test("Recommended defaults flow — notice, applied, and undo (Professional import)", async ({ page }) => {
  await mount(page, 1180);
  await page.click('[data-testid="panel-personal"]');
  await page.click('[data-testid="panel-professional"]');
  await page.setInputFiles('input[type="file"]', { name: "contacts.csv", mimeType: "text/csv",
    buffer: Buffer.from("Name,Email\nAda Lovelace,ada@example.com\nGrace Hopper,grace@example.org\nAlan Turing,alan@example.net") });
  await page.waitForSelector('[data-testid="confirm-screen"]');
  await page.waitForSelector('[data-testid="defaults-notice"]');
  await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, "review-defaults-available.jpg"), type: "jpeg", quality: 62 });
  await expect(page.locator('[data-testid="defaults-notice"]')).toContainText("Recommended settings are available");
  await page.click('[data-testid="apply-defaults"]');
  await page.waitForSelector('[data-testid="defaults-applied"]');
  await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, "review-defaults-applied.jpg"), type: "jpeg", quality: 62 });
  await expect(page.locator("body")).toContainText("Recommended settings applied to 3 contacts");
  await page.click('[data-testid="undo-defaults"]');
  await page.waitForSelector('[data-testid="defaults-notice"]');
  await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, "review-defaults-undo.jpg"), type: "jpeg", quality: 62 });
});

// ---- Business Review (Test Drive) showing the canonical recipient type ----
test("Business Review shows the canonical recipient type (Clients)", async ({ page }) => {
  await mount(page, 1180);
  await page.click('[data-testid="panel-business"]');
  await page.click('[data-testid="panel-client"]');
  await page.click('[data-testid="start-testdrive"]');
  await page.waitForSelector('[data-testid="confirm-screen"]');
  await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, "business-review-client.jpg"), type: "jpeg", quality: 62 });
  await expect(page.locator("body")).toContainText("Client");
});

// ---- ContactForm relationship row after alignment (exact shipped markup + inline styles) ----
test("ContactForm relationship row — Type / Relation / Description aligned", async ({ page }) => {
  const cell = (label, dis) => `<div><label style="display:block;font-size:0.8125rem;font-weight:600;color:#475569;margin-bottom:0.375rem">${label}</label>`
    + `<select style="width:100%;padding:0.625rem 0.875rem;border:1.5px solid #e2e8f0;border-radius:8px;font-size:1rem;background:${dis ? "#f1f5f9" : "white"};color:${dis ? "#94a3b8" : "inherit"}"><option>Select...</option></select></div>`;
  await page.setViewportSize({ width: 900, height: 460 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,'Segoe UI',sans-serif;background:#f8fafc}</style></head><body>
    <div style="max-width:760px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px 24px;box-shadow:0 2px 8px rgba(0,0,0,.04)">
      <h3 style="font-size:1rem;font-weight:600;display:flex;align-items:center;gap:.5rem;margin:0 0 1.25rem"><span style="color:#ec4899">&#10084;</span> Relation</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">${cell("Type")}${cell("Relation", true)}${cell("Description")}</div>
    </div></body></html>`);
  await page.locator("div").first().screenshot({ path: join(SHOTS, "contactform-relation-row.jpg"), type: "jpeg", quality: 65 });
});

// ---- Excel templates rendered faithfully from the ACTUAL generated .xlsx bytes ----
import { templateXlsx } from "../src/import/xlsxTemplate.js";
import { templateColumns, templateInstructions, templateTitle, RELATION_OPTIONS_BY_TYPE, TYPE_OPTIONS, DESCRIPTION_OPTIONS } from "../src/import/templateModel.js";
function unzipHeaders(bytes) {
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = bytes.length - 22; while (eocd >= 0 && d.getUint32(eocd, true) !== 0x06054b50) eocd -= 1;
  const count = d.getUint16(eocd + 10, true); let cd = d.getUint32(eocd + 16, true); const files = {};
  for (let i = 0; i < count; i++) {
    const nameLen = d.getUint16(cd + 28, true), extraLen = d.getUint16(cd + 30, true), commentLen = d.getUint16(cd + 32, true), lho = d.getUint32(cd + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cd + 46, cd + 46 + nameLen));
    const lNameLen = d.getUint16(lho + 26, true), lExtraLen = d.getUint16(lho + 28, true), size = d.getUint32(lho + 18, true);
    const start = lho + 30 + lNameLen + lExtraLen; files[name] = new TextDecoder().decode(bytes.subarray(start, start + size));
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}
const SHELL_HTML = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font-family:Calibri,system-ui,sans-serif;background:#fff}</style></head><body>${body}</body></html>`;
for (const kind of ["family", "friend", "professional", "employee", "client", "vendor"]) {
  test(`Excel ${kind} template — faithful render from the generated .xlsx (15 headers, widths, frozen, filter)`, async ({ page }) => {
    const files = unzipHeaders(templateXlsx(kind));
    const sheet = files["xl/worksheets/sheet1.xml"];
    const headers = [...sheet.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]);
    const widths = [...sheet.matchAll(/<col [^>]*width="([\d.]+)"[^>]*\/>/g)].map((m) => parseFloat(m[1]));
    const cells = headers.map((h, i) => `<th style="min-width:${Math.round(widths[i] * 7)}px;border:1px solid #cfc6e0;background:#ede7f6;color:#2c2140;font-weight:700;padding:6px 10px;text-align:left;white-space:nowrap;font-size:13px">${h}</th>`).join("");
    const empty = headers.map((_, i) => `<td style="min-width:${Math.round(widths[i] * 7)}px;border:1px solid #eee;padding:6px 10px;height:22px"></td>`).join("");
    await page.setViewportSize({ width: 1240, height: 320 });
    await page.setContent(SHELL_HTML(`<div style="padding:14px">
        <div style="font-size:12px;color:#6b6580;margin-bottom:8px">greetme-${kind}-contacts-template.xlsx — Contacts sheet (rendered from the generated file bytes; headless cannot launch Excel). 15 columns · header frozen · autofilter · Type/Relation/Description dropdowns · date-formatted Birthday.</div>
        <div style="overflow-x:auto;border:1px solid #cfc6e0;border-radius:8px"><table style="border-collapse:collapse;font-size:13px"><thead><tr>${cells}</tr></thead><tbody><tr>${empty}</tr><tr>${empty}</tr></tbody></table></div>
      </div>`));
    await page.locator("body").screenshot({ path: join(SHOTS, `excel-${kind}-template.jpg`), type: "jpeg", quality: 68 });
    expect(headers).toEqual(templateColumns(kind).map((c) => c.header));
  });
}
// Dropdown-open preview (data from the ACTUAL taxonomy that feeds the generated file's named ranges).
for (const [kind, typeLabel] of [["family", "Family"], ["employee", "Professional"]]) {
  test(`Excel ${kind} template — Relation dropdown OPEN (${typeLabel})`, async ({ page }) => {
    const relCols = ["Name", "Email", "Type", "Relation", "Description"];
    const relations = RELATION_OPTIONS_BY_TYPE[typeLabel];
    const th = relCols.map((h) => `<th style="min-width:110px;border:1px solid #cfc6e0;background:#ede7f6;color:#2c2140;font-weight:700;padding:6px 10px;text-align:left;font-size:13px">${h}</th>`).join("");
    const opts = relations.map((r, i) => `<div style="padding:4px 12px;font-size:13px;${i === 0 ? "background:#e7defb;" : ""}border-bottom:1px solid #f0ecfa">${r}</div>`).join("");
    await page.setViewportSize({ width: 760, height: 460 });
    await page.setContent(SHELL_HTML(`<div style="padding:16px">
        <div style="font-size:12px;color:#6b6580;margin-bottom:8px">${templateTitle(kind)} — Relation dropdown depends on Type ("${typeLabel}"). Values from the workbook's named range (no macros, no network).</div>
        <table style="border-collapse:collapse"><thead><tr>${th}</tr></thead><tbody>
          <tr><td style="border:1px solid #eee;padding:6px 10px">Robin</td><td style="border:1px solid #eee;padding:6px 10px">robin@example.com</td>
          <td style="border:1px solid #eee;padding:6px 10px;background:#faf7ff">${typeLabel} ▾</td>
          <td style="border:1.5px solid #7c5bd6;padding:0;vertical-align:top;position:relative;background:#fff">
            <div style="padding:6px 10px">Select ▾</div>
            <div style="position:absolute;left:0;top:100%;z-index:2;width:180px;background:#fff;border:1.5px solid #7c5bd6;border-radius:6px;box-shadow:0 8px 20px -8px rgba(80,40,130,.5);max-height:280px;overflow:auto">${opts}</div>
          </td>
          <td style="border:1px solid #eee;padding:6px 10px;background:#faf7ff">Greet-Me Worthy ▾</td></tr>
        </tbody></table>
        <div style="height:260px"></div></div>`));
    await page.locator("body").screenshot({ path: join(SHOTS, `excel-${kind}-dropdown.jpg`), type: "jpeg", quality: 70 });
    expect(relations.length).toBeGreaterThan(3);
  });
}
// Instructions sheet preview (from the actual templateInstructions content).
test("Excel Instructions sheet preview", async ({ page }) => {
  const blocks = templateInstructions("family");
  const html = blocks.map((b) => `<div style="font-weight:700;color:#2c2140;margin:12px 0 4px;font-size:14px">${b.heading}</div>` + b.lines.map((l) => `<div style="color:#4a4663;font-size:12.5px;margin-bottom:2px">${l}</div>`).join("")).join("");
  await page.setViewportSize({ width: 900, height: 900 });
  await page.setContent(SHELL_HTML(`<div style="padding:20px;max-width:820px">${html}</div>`));
  await page.locator("body").screenshot({ path: join(SHOTS, "excel-instructions-sheet.jpg"), type: "jpeg", quality: 70 });
  expect(blocks.length).toBeGreaterThan(5);
});

// ---- Family recommended default (correction): Family Member applied ----
test("Family recommended default applies canonical Family Member", async ({ page }) => {
  await mount(page, 1180);
  await page.click('[data-testid="panel-personal"]');
  await page.click('[data-testid="panel-family"]');
  await page.setInputFiles('input[type="file"]', { name: "family.csv", mimeType: "text/csv",
    buffer: Buffer.from("Name,Email\nRobin Hollis,robin@example.com\nCasey Hollis,casey@example.org") });
  await page.waitForSelector('[data-testid="defaults-notice"]');
  await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, "family-defaults-available.jpg"), type: "jpeg", quality: 62 });
  await page.click('[data-testid="apply-defaults"]');
  await page.waitForSelector('[data-testid="defaults-applied"]');
  await page.locator(".gmiw-underlay").screenshot({ path: join(SHOTS, "family-defaults-applied.jpg"), type: "jpeg", quality: 62 });
  await expect(page.locator("body")).toContainText("Family Member");
});

// ---- Test Drive container close-up: unnumbered intro → OPTION 1 tile → internal OR → OPTION 2 tile ----
for (const [nav, kind, panel] of [["p", "family", "panel-family"], ["b", "employee", "panel-employee"]]) {
  test(`Test Drive two-tile close-up (${kind})`, async ({ page }) => {
    await mount(page, 1120);
    await page.click(nav === "p" ? '[data-testid="panel-personal"]' : '[data-testid="panel-business"]');
    await page.click(`[data-testid="${panel}"]`);
    await page.waitForSelector('[data-testid="testdrive-section"]');
    await page.locator('[data-testid="testdrive-section"]').screenshot({ path: join(SHOTS, `testdrive-container-${kind}.jpg`), type: "jpeg", quality: 70 });
    await expect(page.locator('[data-testid="testdrive-option-1"]')).toContainText("Download and upload the Practice CSV");
    await expect(page.locator('[data-testid="testdrive-option-2"]')).toContainText("Start the Test Drive instantly");
    // OPTION labels are NOT on the parent Upload section
    await expect(page.locator('[data-testid="upload-section"]')).not.toContainText("OPTION");
  });
}
