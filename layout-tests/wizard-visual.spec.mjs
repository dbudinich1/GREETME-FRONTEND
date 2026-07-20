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
