// src/components/importWizard/templateLibraryCard.browser.test.mjs
//
// Founder revision 2026-10-02: the Template Library cards must not show internal import-mapping field
// identifiers (the template's column headers / field keys) to customers. The REAL TemplateLibrary page and
// TemplateLibraryCard are esbuild-bundled and mounted into jsdom (the established pattern). The downloaded
// files are NOT changed: their column headers are required by the import, and this test pins that too.
//
// Run (Node 20.x): node --test src/components/importWizard/templateLibraryCard.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__tlc.entry.jsx");
const BUNDLE = join(__dirname, ".__tlc.bundle.mjs");

let React, createRoot, act, M, dom;

// Every internal identifier that must not be visible: the real column headers, plus the canonical field keys
// they map to (templateModel.js RELATIONSHIP_COLUMNS) and the version tag used in file names.
const FIELD_KEYS = ["relationshipCategory", "relationship", "relationshipCloseness", "recipientType", "mappedField", "fieldKey", "columnKey"];

before(async () => {
  writeFileSync(ENTRY, `
export { default as TemplateLibrary } from "../../pages/TemplateLibrary.jsx";
export { default as TemplateLibraryCard } from "./TemplateLibraryCard.jsx";
export { templateHeaders, templateCsv, TEMPLATE_KINDS } from "../../import/templateModel.js";
export { MemoryRouter } from "react-router-dom";
`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".png": "dataurl", ".css": "empty" },
    external: ["react", "react-dom", "react-dom/client"],
  });
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event;
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only global */ }
  globalThis.MouseEvent = dom.window.MouseEvent; globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
after(() => { for (const f of [ENTRY, BUNDLE]) { try { rmSync(f); } catch { /* gone */ } } });

async function mount(el) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => { createRoot(host).render(el); });
  return host;
}
const page = () => mount(React.createElement(M.MemoryRouter, null, React.createElement(M.TemplateLibrary)));

// All text a customer can perceive: rendered text plus every title / aria-label / alt / placeholder / value.
function perceivable(host) {
  const bits = [host.textContent];
  for (const el of host.querySelectorAll("*")) {
    for (const a of ["title", "aria-label", "alt", "placeholder", "aria-description"]) if (el.getAttribute(a)) bits.push(el.getAttribute(a));
  }
  return bits.join(" \n ");
}

test("the real Template Library page shows no column-header or mapping-key identifiers anywhere a customer can see or hear", async () => {
  const host = await page();
  const headers = [...new Set(M.TEMPLATE_KINDS.flatMap((k) => M.templateHeaders(k)))];
  assert.ok(headers.length >= 10, "sanity: the template really has many internal column headers");
  const seen = perceivable(host);
  for (const k of FIELD_KEYS) assert.ok(!seen.includes(k), `field key "${k}" must not be visible`);
  // distinctive headers must not appear as words at all
  for (const h of ["Address Line 1", "Address Line 2", "State/Province", "Postal/ZIP Code", "Birthday", "Company", "Department", "Relation", "Description"]) {
    assert.ok(!new RegExp(`(^|[^A-Za-z])${h.replace(/[/]/g, "\\/")}([^A-Za-z]|$)`).test(seen), `column header "${h}" must not be visible`);
  }
  // no element may render a bare header as its entire text (that is what the old chips did)
  for (const el of host.querySelectorAll("*")) {
    if (el.children.length === 0) assert.ok(!headers.includes(el.textContent.trim()), `no chip/element may be just the header "${el.textContent.trim()}"`);
  }
});

test("every card keeps its plain description, kind label and the download controls (data-testid values unchanged)", async () => {
  const host = await page();
  for (const k of M.TEMPLATE_KINDS) {
    const card = host.querySelector(`[data-testid="template-library-card-${k}"]`);
    assert.ok(card, `card ${k}`);
    assert.match(card.textContent, /Personal|Business/);
    assert.ok(card.querySelector("p").textContent.length > 20, "plain-language description kept");
    for (const id of [`tpl-lib-download-blank-${k}`, `tpl-lib-download-sample-${k}`, `tpl-lib-fmt-xlsx-${k}`, `tpl-lib-fmt-csv-${k}`]) {
      assert.ok(card.querySelector(`[data-testid="${id}"]`), `${id} present`);
    }
    assert.match(card.textContent, /Download blank/);
    assert.match(card.textContent, /Download sample/);
  }
});

test("the downloaded templates are unchanged: the import's column headers are still in the file", async () => {
  for (const k of M.TEMPLATE_KINDS) {
    const firstLine = M.templateCsv(k).split(/\r?\n/).find((l) => l.trim() && !l.startsWith("#")) || "";
    for (const h of ["Name", "Email", "Type", "Relation", "Description", "Birthday"]) {
      assert.ok(firstLine.includes(h), `${k} template file must still contain column "${h}"`);
    }
  }
});
