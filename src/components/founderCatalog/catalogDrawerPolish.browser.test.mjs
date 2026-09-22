// src/components/founderCatalog/catalogDrawerPolish.browser.test.mjs
//
// FOUNDER ADDENDUM 2026-09-21 — the curated-product workflow, made Founder-ready.
//
// The REAL drawer, esbuild-bundled into jsdom with an INJECTED client. No network, no vendor, no
// backend. A NEW FILE on purpose: manageCatalogDrawer.browser.test.mjs is the existing Checkpoint 2
// proof and stays untouched.
//
// WHAT THIS PROVES is polish, not new capability: every action here already existed in the API.
// The two safety claims that matter are asserted anyway — a dormant provider is never requested,
// and nothing the form sends can publish anything.
//
// Run: node --test src/components/founderCatalog/catalogDrawerPolish.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import {
  lifecycleBadge, formatMoney, previewImageUrl,
  validateProductForm, buildProductPayload, dollarsToCents, emptyProductForm,
  LAUNCH_PRODUCT_SOURCE, LAUNCH_PRODUCT_SOURCES,
} from "./catalogDrawerModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__mcdp.entry.jsx");
const BUNDLE = join(__dirname, ".__mcdp.bundle.mjs");

let React, createRoot, act, ManageCatalogDrawer, dom, root, reactRoot;

const ITEM = (over = {}) => ({
  id: "gm-prov-e1",
  internal: { source: "prov", vendor: "prov", externalProductId: "e1" },
  vendorAuthoritative: {
    title: "Vendor Mug", description: "", images: [{ url: "https://vendor.example/mug.png" }],
    priceCents: 2500, currency: "USD", available: true, variants: [], syncedAt: "2026-09-05T00:00:00.000Z",
  },
  curation: { greetMeCategories: [], brandable: false, featuredRank: null, overrides: { title: null, description: null, imageUrl: null } },
  lifecycle: { state: "draft", displayEnabled: false, curatedAt: null, curatedBy: null, lastPublishedAt: null, lastPublishedBy: null },
  display: { title: "Vendor Mug", imageUrl: null },
  etag: '"e1"',
  ...over,
});

const PROVIDERS = [
  { providerId: LAUNCH_PRODUCT_SOURCE, label: "Gift Boxes", enabled: false, orderPlacementAllowed: false, browseAvailable: false, reason: "provider_disabled", launchBlockerIds: [] },
  // 2026-09-22: the second entry in LAUNCH_PRODUCT_SOURCES — enabled, but genuinely has no
  // browsable catalog (the real posture), mirroring routes/founderCatalogRoutes.js's own
  // "no_browsable_catalog" reason.
  { providerId: "prezzee", label: "Gift Cards", enabled: true, orderPlacementAllowed: false, browseAvailable: false, reason: "no_browsable_catalog", launchBlockerIds: [] },
];

function clientStub(over = {}) {
  const calls = { list: 0, providers: 0, browse: 0, created: [], lifecycle: [] };
  return {
    calls,
    listItems: async () => { calls.list++; return { ok: true, items: [ITEM()] }; },
    listProviders: async () => { calls.providers++; return { ok: true, providers: PROVIDERS }; },
    // A booby trap, kept from the existing suite: a dormant provider must never be requested.
    browseProvider: async () => { calls.browse++; throw new Error("VENDOR BROWSE REQUESTED WHILE DORMANT"); },
    patchItem: async (vendor, id, patch) => ({ ok: true, item: ITEM({ curation: { ...ITEM().curation, ...patch } }) }),
    lifecycle: async (vendor, id, action) => { calls.lifecycle.push({ vendor, id, action }); return { ok: true, item: ITEM() }; },
    createDraft: async (body) => { calls.created.push(body); return { ok: true, item: ITEM({ display: { title: body.snapshot.title, imageUrl: null } }) }; },
    ...over,
  };
}

before(async () => {
  writeFileSync(ENTRY, `export { default as ManageCatalogDrawer } from "./ManageCatalogDrawer.jsx";`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty" },
    define: { "import.meta.env": JSON.stringify({ VITE_API_BASE: "" }) },
    external: ["react", "react-dom", "react-dom/client"],
    logLevel: "silent",
  });
  dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://app.test/dashboard/gifts" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent; globalThis.getComputedStyle = dom.window.getComputedStyle;
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only */ }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ ManageCatalogDrawer } = await import(pathToFileURL(BUNDLE).href));
  root = document.getElementById("root");
});

after(() => {
  for (const f of [ENTRY, BUNDLE, BUNDLE.replace(/\.mjs$/, ".css")]) {
    try { rmSync(f); } catch { /* already gone */ }
  }
});

async function mount(props) {
  if (reactRoot) { await act(async () => reactRoot.unmount()); reactRoot = null; }
  root.innerHTML = "";
  await act(async () => {
    reactRoot = createRoot(root);
    reactRoot.render(React.createElement(ManageCatalogDrawer, props));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
}
const q = (sel) => root.querySelector(sel);
const tid = (t) => root.querySelector(`[data-testid="${t}"]`);
const clickEl = async (el) => { await act(async () => el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))); };
const setValue = async (el, v) => {
  await act(async () => {
    const proto = el.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype
      : el.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype
        : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
};

async function openAddForm(client = clientStub()) {
  await mount({ open: true, onClose() {}, client });
  await clickEl(tid("add-product"));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  return client;
}

// ══ 1. A CLEAN AND OBVIOUS ADD ACTION ═══════════════════════════════════════════════════════
test("the Add Product action is present, labelled, and toggles the form", async () => {
  const client = clientStub();
  await mount({ open: true, onClose() {}, client });

  const add = tid("add-product");
  assert.ok(add, "the action exists");
  assert.match(add.textContent, /Add Goody Product/);
  assert.equal(add.getAttribute("aria-expanded"), "false");
  assert.equal(tid("add-product-form"), null, "the form is closed until asked for");

  await clickEl(add);
  assert.ok(tid("add-product-form"), "the form opens");
  assert.equal(tid("add-product").getAttribute("aria-expanded"), "true");

  await clickEl(tid("add-product"));
  assert.equal(tid("add-product-form"), null, "and closes again");
});

test("the provider is chosen only from the small, explicit launch set — never an open picker", async () => {
  const client = await openAddForm();
  assert.ok(client.calls.providers >= 1, "provider metadata was read from our own backend");
  assert.equal(client.calls.browse, 0, "no vendor browse was requested");

  // 2026-09-22: with two launch sources configured (LAUNCH_PRODUCT_SOURCES), the control is now a
  // <select> limited to exactly that set — not an open picker across the whole registry, and
  // still not a free-text field.
  const source = tid("apf-source");
  assert.equal(source.tagName, "SELECT", "with more than one launch source, this is a select, not a fixed label");
  assert.equal(source.value, LAUNCH_PRODUCT_SOURCE, "defaults to the first configured launch source");
  const optionValues = [...source.options].map((o) => o.value);
  assert.deepEqual(optionValues, [...LAUNCH_PRODUCT_SOURCES], "the options are EXACTLY the launch set, nothing more");
  assert.match(source.selectedOptions[0].textContent, /Gift Boxes/, "the LABEL comes from our backend, not from the component");
});

// ══ 2. LABELS AND VALIDATION ════════════════════════════════════════════════════════════════
test("every field carries a real label, associated with its control", async () => {
  await openAddForm();
  for (const id of ["apf-external-id", "apf-title", "apf-description", "apf-price", "apf-currency", "apf-image", "apf-variants"]) {
    const el = tid(id);
    assert.ok(el, `${id} exists`);
    const label = root.querySelector(`label[for="${el.id}"]`);
    assert.ok(label, `${id} has a <label for>`);
    assert.ok(label.textContent.trim().length > 2, `${id}'s label says something`);
  }
});

test("an empty save is REFUSED locally, names every missing field, and sends nothing", async () => {
  const client = await openAddForm();
  await clickEl(tid("apf-save"));

  assert.equal(client.calls.created.length, 0, "nothing was sent to the server");
  for (const err of ["apf-err-external-id", "apf-err-title", "apf-err-price"]) {
    assert.ok(tid(err), `${err} is shown`);
  }
  assert.match(tid("apf-err-external-id").textContent, /product ID/i);
});

test("a malformed price is refused with guidance, not a silent coercion", async () => {
  const client = await openAddForm();
  await setValue(tid("apf-external-id"), "e9");
  await setValue(tid("apf-title"), "Test Box");
  for (const bad of ["abc", "78.999", "-5", "0"]) {
    await setValue(tid("apf-price"), bad);
    await clickEl(tid("apf-save"));
    assert.ok(tid("apf-err-price"), `"${bad}" is refused`);
    assert.equal(client.calls.created.length, 0);
  }
});

test("an http image URL is refused — a preview must not be mixed content", async () => {
  const client = await openAddForm();
  await setValue(tid("apf-image"), "http://insecure.example/x.png");
  await clickEl(tid("apf-save"));
  assert.ok(tid("apf-err-image"));
  assert.equal(client.calls.created.length, 0);
});

// ══ 3 & 4 & 5. CATEGORIES, IMAGE PREVIEW, MONEY ═════════════════════════════════════════════
test("the existing Greet-Me category selectors are used, unchanged", async () => {
  await mount({ open: true, onClose() {}, client: clientStub() });
  // The same storable ids the model already published — this polish adds no category vocabulary.
  for (const id of ["gift_cards", "gift_baskets", "flowers", "americana", "faith_and_inspiration", "tech", "apparel"]) {
    assert.ok(tid(`cat-gm-prov-e1-${id}`), `${id} selector present`);
  }
});

test("a valid image URL renders a preview in the form", async () => {
  await openAddForm();
  assert.equal(tid("apf-image-preview"), null, "nothing to preview yet");
  await setValue(tid("apf-image"), "https://vendor.example/box.png");
  const img = tid("apf-image-preview");
  assert.ok(img, "the preview appears");
  assert.equal(img.getAttribute("src"), "https://vendor.example/box.png");
  assert.ok(img.getAttribute("alt"), "and it is described for assistive technology");
});

test("a stored record shows its image and its price WITH the currency", async () => {
  await mount({ open: true, onClose() {}, client: clientStub() });
  assert.equal(tid("image-gm-prov-e1").getAttribute("src"), "https://vendor.example/mug.png");
  assert.equal(tid("price-gm-prov-e1").textContent, "$25.00 USD");
});

test("money formatting is honest about a non-dollar currency, and about nothing at all", () => {
  assert.equal(formatMoney(7800, "USD"), "$78.00 USD");
  assert.equal(formatMoney(7800, "CAD"), "78.00 CAD");
  assert.equal(formatMoney(7800, ""), "$78.00 USD");
  assert.equal(formatMoney(null), "—", "an unknown price is never rendered as $0.00");
  assert.equal(formatMoney(undefined), "—");
});

// ══ 6. LIFECYCLE BADGES ═════════════════════════════════════════════════════════════════════
test("the four lifecycle badges read exactly as specified", () => {
  assert.equal(lifecycleBadge({ state: "draft", displayEnabled: false }).label, "DRAFT — NOT VISIBLE TO CUSTOMERS");
  assert.equal(lifecycleBadge({ state: "available", displayEnabled: true }).label, "PUBLISHED");
  assert.equal(lifecycleBadge({ state: "draft", displayEnabled: false, lastPublishedAt: "2026-09-01" }).label, "UNPUBLISHED");
  assert.equal(lifecycleBadge({ state: "retired", displayEnabled: false }).label, "RETIRED");
  // A retired record is also displayEnabled:false — retirement must win over "unpublished".
  assert.equal(lifecycleBadge({ state: "retired", displayEnabled: false, lastPublishedAt: "2026-09-01" }).label, "RETIRED");
  assert.equal(lifecycleBadge(undefined).label, "DRAFT — NOT VISIBLE TO CUSTOMERS", "unknown is the safest label");
});

test("the badge renders on the record, and says customers cannot see a draft", async () => {
  await mount({ open: true, onClose() {}, client: clientStub() });
  const badge = tid("badge-gm-prov-e1");
  assert.ok(badge);
  assert.match(badge.textContent, /DRAFT — NOT VISIBLE TO CUSTOMERS/);
  assert.match(badge.getAttribute("title"), /customers cannot see/i);
});

// ══ 7. ACTIONS ══════════════════════════════════════════════════════════════════════════════
test("Save and Cancel are both present, and Cancel discards without sending", async () => {
  const client = await openAddForm();
  assert.match(tid("apf-save").textContent, /Save as draft/);
  assert.match(tid("apf-cancel").textContent, /Cancel/);
  await setValue(tid("apf-title"), "Abandoned");
  await clickEl(tid("apf-cancel"));
  assert.equal(tid("add-product-form"), null, "the form closed");
  assert.equal(client.calls.created.length, 0, "and nothing was sent");
});

test("the lifecycle actions already supported are still offered for a draft", async () => {
  await mount({ open: true, onClose() {}, client: clientStub() });
  assert.ok(tid("publish-gm-prov-e1"), "Publish");
  assert.ok(tid("retire-gm-prov-e1"), "Retire");
  assert.equal(tid("unpublish-gm-prov-e1"), null, "Unpublish is absent for an unpublished record");
  assert.equal(tid("reactivate-gm-prov-e1"), null, "Reactivate is absent for a non-retired record");
});

// ══ 8. SUCCESS AND ERROR FEEDBACK ═══════════════════════════════════════════════════════════
test("a successful save confirms it, and says the record is NOT visible to customers", async () => {
  const client = await openAddForm();
  await setValue(tid("apf-external-id"), "e9");
  await setValue(tid("apf-title"), "Roasted Box");
  await setValue(tid("apf-price"), "78.00");
  await clickEl(tid("apf-save"));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });

  assert.equal(client.calls.created.length, 1, "exactly one record — this is not a bulk tool");
  const sent = client.calls.created[0];
  assert.equal(sent.source, LAUNCH_PRODUCT_SOURCE, "always filed under the launch provider");
  assert.equal(sent.externalProductId, "e9");
  assert.equal(sent.snapshot.priceCents, 7800, "dollars were converted to whole cents");
  // Lifecycle is server-owned: the form cannot carry it even by mistake.
  for (const forbidden of ["available", "displayEnabled", "state"]) {
    assert.equal(forbidden in sent, false, `the body must not carry ${forbidden}`);
    assert.equal(forbidden in sent.snapshot, false, `the snapshot must not carry ${forbidden}`);
  }

  const ok = tid("drawer-success");
  assert.ok(ok, "a success banner is shown");
  assert.match(ok.textContent, /Roasted Box/);
  assert.match(ok.textContent, /Customers cannot see it/i);
  assert.equal(tid("add-product-form"), null, "and the form closed");
});

test("a server refusal is shown in the founder's words, and the form data survives", async () => {
  const client = clientStub({
    createDraft: async () => { const e = new Error("nope"); e.body = { error: "SOURCE_NOT_PERMITTED" }; throw e; },
  });
  await openAddForm(client);
  await setValue(tid("apf-external-id"), "e9");
  await setValue(tid("apf-title"), "Roasted Box");
  await setValue(tid("apf-price"), "78.00");
  await clickEl(tid("apf-save"));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });

  const notice = tid("drawer-notice");
  assert.ok(notice, "the refusal is shown");
  assert.ok(tid("add-product-form"), "the form stayed open so the work is not lost");
  assert.equal(tid("apf-title").value, "Roasted Box", "and the typed values survived");
});

test("a lifecycle action confirms what it DID, in customer-visibility terms", async () => {
  const client = clientStub();
  await mount({ open: true, onClose() {}, client });
  await clickEl(tid("publish-gm-prov-e1"));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  const ok = tid("drawer-success");
  assert.ok(ok);
  assert.match(ok.textContent, /visible to customers/i);
});

// ══ 9. RESPONSIVE ═══════════════════════════════════════════════════════════════════════════
test("the layout survives a phone width: the panel fits and the toolbar wraps", async () => {
  await mount({ open: true, onClose() {}, client: clientStub() });
  const drawer = q('[data-testid="manage-catalog-drawer"]');
  // The panel is width-capped by min(), so it can never exceed the viewport on a phone.
  assert.match(drawer.getAttribute("style"), /min\(560px, 100%\)/);
  assert.match(drawer.getAttribute("style"), /max-width: 100%/);

  const toolbar = tid("add-product").parentElement;
  assert.match(toolbar.getAttribute("style"), /flex-wrap: wrap/, "the action and search wrap rather than overflow");
  const search = root.querySelector('input[type="search"]');
  assert.match(search.getAttribute("style"), /min-width: 0/, "the search field may shrink");
});

// ══ 10. NOTHING OUTSIDE THIS WORKFLOW ═══════════════════════════════════════════════════════
test("no new capability: the payload matches the EXISTING create contract exactly", () => {
  const form = { ...emptyProductForm(), externalProductId: "e9", title: "T", priceDollars: "78.00", currency: "usd", variants: "A, B" };
  assert.equal(validateProductForm(form).ok, true);
  const body = buildProductPayload(form);
  assert.deepEqual(Object.keys(body).sort(), ["externalProductId", "snapshot", "source"]);
  assert.equal(body.source, LAUNCH_PRODUCT_SOURCE);
  assert.deepEqual(Object.keys(body.snapshot).sort(), ["currency", "description", "images", "priceCents", "title", "variants"]);
  assert.deepEqual(body.snapshot.variants, ["A", "B"]);
  assert.equal(body.snapshot.currency, "USD");
});

test("dollars convert to cents exactly, or refuse", () => {
  assert.equal(dollarsToCents("78"), 7800);
  assert.equal(dollarsToCents("78.5"), 7850);
  assert.equal(dollarsToCents("0.07"), 7);
  for (const bad of ["", "abc", "78.999", "-1", null, undefined]) {
    assert.equal(dollarsToCents(bad), null, String(bad));
  }
});

test("the preview prefers a founder override, then the vendor image, then nothing", () => {
  assert.equal(previewImageUrl(ITEM()), "https://vendor.example/mug.png");
  const overridden = ITEM({ curation: { ...ITEM().curation, overrides: { title: null, description: null, imageUrl: "https://greet.me/own.png" } } });
  assert.equal(previewImageUrl(overridden), "https://greet.me/own.png");
  assert.equal(previewImageUrl(ITEM({ vendorAuthoritative: { ...ITEM().vendorAuthoritative, images: [] } })), null);
  assert.equal(previewImageUrl(null), null);
});

// ══ RENDERED EVIDENCE ═══════════════════════════════════════════════════════════════════════
//
// The four states the Founder asked to see, written out as real rendered HTML from the real
// component. Offline: the client is injected, so nothing is contacted and nothing is published.
test("EVIDENCE: writes the four required screenshots", async () => {
  const { mkdirSync, writeFileSync: write } = await import("node:fs");
  const DIR = "C:/1_GREET-ME/reports/catalog-evidence";
  // The drawer styles itself with CSS custom properties supplied by the app shell; they are
  // declared here so the evidence renders in the real palette rather than as unstyled boxes.
  const VARS = `:root{--bg-primary:#fff;--bg-secondary:#f9fafb;--border:#e5e7eb;--primary:#6b3a2a;
    --text-secondary:#4b5563;--text-tertiary:#9ca3af;--radius-md:8px;--radius-lg:12px}
    body{margin:0;background:#f3f4f6;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
    .shot{position:relative!important;inset:auto!important;margin:0 auto;box-shadow:0 2px 12px rgba(0,0,0,.12)}`;
  const shot = (name, note, width) => {
    const drawer = q('[data-testid="manage-catalog-drawer"]').cloneNode(true);
    drawer.setAttribute("class", "shot");
    write(`${DIR}/${name}.html`,
      `<!doctype html><meta charset="utf-8"><title>${name}</title><style>${VARS}</style>`
      + `<body><div style="width:${width}px;margin:0 auto;padding:16px">`
      + `<p style="font:12px system-ui;color:#555">${note} — rendered offline from the real component; injected client, no network.</p>`
      + drawer.outerHTML + `</div></body>`);
  };

  try { mkdirSync(DIR, { recursive: true }); } catch { /* evidence is a convenience */ }

  const client = clientStub();
  // 1 — the empty form
  await openAddForm(client);
  shot("01-add-product-form-empty", "1. Empty Add Goody Product form", 620);

  // 2 — the completed form, with an image preview
  await setValue(tid("apf-external-id"), "00074668-8ba1-4f0a-9d3c-4a7c3f5e1b22");
  await setValue(tid("apf-title"), "Roasted & Toasted Coffee Box");
  await setValue(tid("apf-description"), "Small-batch beans, ground to order.");
  await setValue(tid("apf-price"), "78.00");
  await setValue(tid("apf-image"), "https://vendor.example/roasted-box.png");
  await setValue(tid("apf-variants"), "Dark Roast, Medium Roast");
  shot("02-add-product-form-completed", "2. Completed draft form", 620);

  // 3 — saved, with the visibility warning on the record and the success confirmation
  await clickEl(tid("apf-save"));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.ok(tid("drawer-success"), "the save confirmed");
  assert.match(tid("badge-gm-prov-e1").textContent, /NOT VISIBLE TO CUSTOMERS/);
  shot("03-saved-draft-visibility-warning", "3. Saved draft with its visibility warning", 620);

  // 4 — the existing category assignment, one category applied
  await clickEl(tid("cat-gm-prov-e1-gift_baskets"));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  shot("04-category-assignment", "4. Existing Greet-Me category assignment", 620);

  // And the same drawer at phone width, since the layout claim should be visible too.
  shot("05-phone-width", "5. Phone width (390px)", 390);
});
