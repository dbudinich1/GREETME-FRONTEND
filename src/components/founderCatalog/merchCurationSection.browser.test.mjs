// src/components/founderCatalog/merchCurationSection.browser.test.mjs
//
// The Merch (Printful) section of the Manage Catalog drawer: the real component, bundled and
// mounted in jsdom with an injected client. Same harness as the sibling founder suites.
//
// Run (Node 20.x): node --test src/components/founderCatalog/merchCurationSection.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__merch.bundle.mjs");
const ENTRY = join(__dirname, ".__merch.entry.jsx");
let React, createRoot, act, Drawer, window;

before(async () => {
  writeFileSync(ENTRY, `export { default as Drawer } from "./ManageCatalogDrawer.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Drawer } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const CASE_ID = 431624305;
const MUG_ID = 431622804;

const item = (syncProductId, curation = {}, name = "Product") => ({
  syncProductId,
  supplier: "printful",
  vendorAuthoritative: {
    name, imageUrl: null, priceCentsMin: 2900, priceCentsMax: 2900,
    variantCount: 16, fulfillmentSource: "printful",
  },
  curation: {
    displayEnabled: true, greetMeCategories: ["tech"], brandable: true,
    featuredRank: null, state: "active", ...curation,
  },
  hasOverlay: false,
  etag: "etag-1",
});

function client(over = {}) {
  const calls = [];
  const base = {
    calls,
    listItems: async () => ({ ok: true, items: [] }),
    listProviders: async () => ({ ok: true, providers: [] }),
    listMerch: async () => {
      calls.push(["listMerch"]);
      return {
        ok: true, overlayState: "empty", writesEnabled: true,
        items: [item(CASE_ID, {}, "MagSafe case"), item(MUG_ID, { greetMeCategories: [] }, "White mug")],
      };
    },
    patchMerch: async (id, patch, etag) => {
      calls.push(["patchMerch", id, patch, etag]);
      return { ok: true, item: { ...item(id), curation: { ...item(id).curation, ...patch }, etag: "etag-2" } };
    },
    merchLifecycle: async (id, action, etag) => {
      calls.push(["merchLifecycle", id, action, etag]);
      const state = action === "retire" ? "retired" : "active";
      return { ok: true, item: { ...item(id), curation: { ...item(id).curation, state, displayEnabled: false }, etag: "etag-3" } };
    },
  };
  return { ...base, ...over, calls };
}

let root;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); }); await flush(); };
const check = async (el, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked").set.call(el, value);
    el.dispatchEvent(new window.Event("click", { bubbles: true }));
    el.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  await flush();
};

async function openMerch(c) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Drawer, { open: true, onClose: () => {}, client: c })); });
  await flush();
  const tab = [...document.querySelectorAll("button")].find((b) => /Merch \(Printful\)/.test(b.textContent));
  await click(tab);
  await flush();
}

// ══ presentation ═══════════════════════════════════════════════════════════════════════════════

test("30a · the merch section lists the products with supplier and server-authoritative facts", async () => {
  const c = client();
  await openMerch(c);
  assert.ok(tid("merch-section"), "section renders");
  assert.ok(tid(`merch-item-${CASE_ID}`));
  assert.ok(tid(`merch-item-${MUG_ID}`));
  const auth = tid(`merch-authoritative-${CASE_ID}`).textContent;
  assert.match(auth, /\$29\.00/, "price shown");
  assert.match(auth, /16 variants/);
  assert.match(auth, /set by Printful/, "marked server-authoritative");
  assert.match(tid("merch-section").textContent, /live supplier/i);
});

test("30b · price, name and variant count are shown but have no input control", async () => {
  await openMerch(client());
  for (const t of ["merch-price", "merch-name", "merch-variantcount", "merch-syncvariant"]) {
    assert.equal(tid(`${t}-${CASE_ID}`), null, `${t} must not be editable`);
  }
  assert.ok(tid(`merch-visible-${CASE_ID}`), "visibility IS editable");
  assert.ok(tid(`merch-brandable-${CASE_ID}`), "brandable IS editable");
  assert.ok(tid(`merch-rank-${CASE_ID}`), "rank IS editable");
});

test("30c · the Brandable control is labelled 'Show under Brandable Goods'", async () => {
  await openMerch(client());
  assert.match(tid("merch-section").textContent, /Show under Brandable Goods/);
});

// ══ save / cancel / conflict ═══════════════════════════════════════════════════════════════════

test("30d · Save sends only presentation fields, with If-Match", async () => {
  const c = client();
  await openMerch(c);
  await check(tid(`merch-brandable-${CASE_ID}`), false);
  await click(tid(`merch-save-${CASE_ID}`));
  const call = c.calls.find((x) => x[0] === "patchMerch");
  assert.ok(call, "a patch was sent");
  assert.deepEqual(Object.keys(call[2]).sort(),
    ["brandable", "displayEnabled", "featuredRank", "greetMeCategories"]);
  assert.equal(call[3], "etag-1", "the ETag travels as If-Match");
  for (const forbidden of ["priceCentsMin", "name", "syncVariantId", "variantCount"]) {
    assert.equal(forbidden in call[2], false, `${forbidden} must never be sent`);
  }
});

test("30e · Cancel restores the last saved state and disables Save", async () => {
  const c = client();
  await openMerch(c);
  await check(tid(`merch-brandable-${CASE_ID}`), false);
  assert.equal(tid(`merch-save-${CASE_ID}`).disabled, false, "dirty ⇒ Save enabled");
  await click(tid(`merch-cancel-${CASE_ID}`));
  assert.equal(tid(`merch-brandable-${CASE_ID}`).checked, true, "reverted");
  assert.equal(tid(`merch-save-${CASE_ID}`).disabled, true, "clean ⇒ Save disabled");
});

test("30f · a 409 conflict states that nothing was overwritten", async () => {
  const err = Object.assign(new Error("conflict"), { data: { error: "etag_conflict" } });
  const c = client({ patchMerch: async () => { throw err; } });
  await openMerch(c);
  await check(tid(`merch-brandable-${CASE_ID}`), false);
  await click(tid(`merch-save-${CASE_ID}`));
  assert.match(tid("merch-notice").textContent, /nothing was overwritten/i);
});

test("30g · a visible non-brandable product with no category is refused before any request", async () => {
  const c = client();
  await openMerch(c);
  // The mug has no categories; unchecking Brandable leaves it with nowhere to appear.
  await check(tid(`merch-brandable-${MUG_ID}`), false);
  await click(tid(`merch-save-${MUG_ID}`));
  assert.match(tid("merch-notice").textContent, /Brandable Goods or at least one category/i);
  assert.equal(c.calls.some((x) => x[0] === "patchMerch"), false, "no request was made");
});

// ══ lifecycle ══════════════════════════════════════════════════════════════════════════════════

test("30h · Retire calls the retire action; Restore appears once retired", async () => {
  const c = client();
  await openMerch(c);
  await click(tid(`merch-retire-${MUG_ID}`));
  assert.deepEqual(c.calls.find((x) => x[0] === "merchLifecycle").slice(0, 3),
    ["merchLifecycle", MUG_ID, "retire"]);
  assert.ok(tid(`merch-restore-${MUG_ID}`), "Restore replaces Retire");
  assert.match(tid(`merch-status-${MUG_ID}`).textContent, /Retired/);
});

test("30i · Restore reports that the product comes back hidden", async () => {
  const c = client({
    listMerch: async () => ({
      ok: true, overlayState: "present", writesEnabled: true,
      items: [item(MUG_ID, { state: "retired", displayEnabled: false }, "White mug")],
    }),
  });
  await openMerch(c);
  await click(tid(`merch-restore-${MUG_ID}`));
  assert.match(tid("merch-notice").textContent, /hidden until you show it/i);
});

// ══ unavailable / writes disabled ══════════════════════════════════════════════════════════════

test("30j · an unavailable overlay shows a banner and says the storefront is unaffected", async () => {
  const c = client({
    listMerch: async () => ({ ok: true, overlayState: "unavailable", writesEnabled: true, items: [item(CASE_ID)] }),
  });
  await openMerch(c);
  assert.ok(tid("merch-unavailable-banner"));
  assert.match(tid("merch-unavailable-banner").textContent, /storefront is unaffected/i);
});

test("23 · writes disabled shows a banner and disables every control, reads still render", async () => {
  const c = client({
    listMerch: async () => ({ ok: true, overlayState: "present", writesEnabled: false, items: [item(CASE_ID)] }),
  });
  await openMerch(c);
  assert.ok(tid("merch-writes-disabled"));
  assert.match(tid("merch-writes-disabled").textContent, /still applied to the storefront/i);
  assert.equal(tid(`merch-visible-${CASE_ID}`).disabled, true);
  assert.equal(tid(`merch-brandable-${CASE_ID}`).disabled, true);
  assert.equal(tid(`merch-retire-${CASE_ID}`).disabled, true);
  assert.ok(tid(`merch-item-${CASE_ID}`), "the product still renders — reads are unaffected");
});

test("30k · loading and error states are distinct and never imply zero products", async () => {
  let resolve;
  const gate = new Promise((r) => { resolve = r; });
  const c = client({ listMerch: async () => { await gate; return { ok: true, overlayState: "empty", writesEnabled: true, items: [] }; } });
  await openMerch(c);
  assert.ok(tid("merch-loading"), "a loading state, not an empty list");
  await act(async () => { resolve(); await flush(); });

  const bad = client({ listMerch: async () => { throw new Error("boom"); } });
  await openMerch(bad);
  assert.ok(tid("merch-error"));
  assert.equal(tid("merch-error").getAttribute("role"), "alert");
});

// ══ accessibility and layout ═══════════════════════════════════════════════════════════════════

test("30l · controls are labelled and the save status is announced politely", async () => {
  const c = client();
  await openMerch(c);
  assert.equal(tid(`merch-rank-${CASE_ID}`).getAttribute("aria-label"), "Featured rank");
  assert.equal(tid(`merch-visible-${CASE_ID}`).getAttribute("aria-checked"), "true");
  await check(tid(`merch-brandable-${CASE_ID}`), false);
  await click(tid(`merch-save-${CASE_ID}`));
  assert.equal(tid("merch-notice").getAttribute("aria-live"), "polite");
});

test("31 · the section uses no fixed pixel width that could force horizontal overflow", async () => {
  await openMerch(client());
  const section = tid("merch-section");
  assert.equal(/width:\s*\d{3,}px/.test(section.getAttribute("style") || ""), false);
  const list = tid("merch-item-list");
  assert.match(list.getAttribute("style") || "", /grid/, "single-column grid, wraps on mobile");
  assert.equal(/min-width/.test(list.getAttribute("style") || ""), false);
});

// ══ boundaries ═════════════════════════════════════════════════════════════════════════════════

test("28/29 · the section offers no delete, import, bulk or browse, and no occasion control", async () => {
  const c = client();
  await openMerch(c);
  const text = tid("merch-section").textContent;
  for (const word of [/delete/i, /import/i, /bulk/i, /browse/i, /occasion/i]) {
    assert.equal(word.test(text), false, `${word} must not appear`);
  }
  assert.equal(tid(`merch-occasion-${CASE_ID}`), null);
  await click(tid(`merch-retire-${MUG_ID}`));
  for (const [name] of c.calls) {
    assert.equal(/delete|import|bulk|browse|sync/i.test(name), false, `${name} is not permitted`);
  }
});
