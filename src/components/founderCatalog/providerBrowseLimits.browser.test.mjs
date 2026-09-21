// src/components/founderCatalog/providerBrowseLimits.browser.test.mjs
// Run (Node 20.x): node --test src/components/founderCatalog/providerBrowseLimits.browser.test.mjs
//
// PROVIDER-LEVEL LIMITS IN THE BROWSE PANEL.
//
// A founder curating a catalog is committing Greet-Me to sell the thing they publish. Two of the
// constraints that decide whether that commitment can be met — where the provider delivers, and
// how far ahead it accepts a date — are properties of the PROVIDER and appear nowhere on a product
// row. This file proves they are stated before anything is chosen, and that a provider without
// declared limits prints nothing rather than a comforting guess.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__browselimits.bundle.mjs");
const ENTRY = join(__dirname, ".__browselimits.entry.jsx");
let React, createRoot, act, Panel, window;

const PRODUCTS = [
  {
    providerProductId: "B23-4386", name: "The Red and Lavender Rose Bouquet",
    description: "Rich red roses.", brandName: null,
    imageUrl: "https://example.test/a.jpg", priceCents: 8995, currency: "USD",
    variantNames: [], variantsRequired: false, providerStatus: "active",
    directSendEligible: true, ineligibleReasons: [], restrictedStates: [],
    alreadyInCatalog: false, suggestedCategoryIds: ["flowers"],
  },
];

const client = {
  browseProvider: async () => ({
    ok: true, providerId: "florist_one", persisted: false, start: 0, count: 20,
    total: 1, products: PRODUCTS, totalIsExact: true, nextCursor: null,
    traversal: { complete: true, truncated: false, outcome: "complete", pagesFetched: 1, productsScanned: 1 },
  }),
  addFromProvider: async () => ({ ok: true }),
};

before(async () => {
  writeFileSync(ENTRY, `export { default as Panel } from "./ProviderBrowsePanel.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], bundle: true, format: "esm", outfile: BUNDLE,
    jsx: "automatic", platform: "browser", logLevel: "silent",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "lucide-react"],
  });
  const dom = new JSDOM("<!doctype html><html><body><div id=root></div></body></html>",
    { url: "http://localhost/founder", pretendToBeVisual: true });
  window = dom.window;
  global.window = window; global.document = window.document;
  global.navigator = window.navigator; global.HTMLElement = window.HTMLElement;
  global.Node = window.Node; global.getComputedStyle = window.getComputedStyle;
  global.IS_REACT_ACT_ENVIRONMENT = true;

  React = (await import("react")).default;
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = await import("react"));
  ({ Panel } = await import(pathToFileURL(BUNDLE).href));
});

after(() => {
  for (const f of [BUNDLE, ENTRY]) { try { rmSync(f); } catch { /* already gone */ } }
});

async function render(props) {
  const host = window.document.getElementById("root");
  host.innerHTML = "";
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Panel, props)); });
  await act(async () => {});
  return host;
}

test("the flowers panel states US-only delivery before any product is chosen", async () => {
  const host = await render({ client, providerId: "florist_one", providerLabel: "Flowers" });
  const limits = host.querySelector('[data-testid="browse-limits"]');
  assert.ok(limits, "the limits block must be rendered");
  assert.match(limits.textContent, /United States addresses only/);
});

test("the flowers panel states the 30-day delivery horizon", async () => {
  const host = await render({ client, providerId: "florist_one", providerLabel: "Flowers" });
  const limits = host.querySelector('[data-testid="browse-limits"]');
  assert.match(limits.textContent, /30 days ahead/);
  assert.match(limits.textContent, /checked at checkout/,
    "the per-address check must be stated, so the horizon is not read as a guarantee");
});

test("the flowers panel says plainly that there are no variants", async () => {
  const host = await render({ client, providerId: "florist_one", providerLabel: "Flowers" });
  const limits = host.querySelector('[data-testid="browse-limits"]');
  assert.match(limits.textContent, /no sizes or variants/);
});

test("the limits appear ABOVE the results, not after them", async () => {
  const host = await render({ client, providerId: "florist_one", providerLabel: "Flowers" });
  const limits = host.querySelector('[data-testid="browse-limits"]');
  const results = host.querySelector('[data-testid="browse-results"]');
  assert.ok(limits && results);
  assert.ok(
    limits.compareDocumentPosition(results) & window.Node.DOCUMENT_POSITION_FOLLOWING,
    "a constraint printed after the choice has already been made is not a constraint",
  );
});

test("NO variant selector is rendered for a product with no variants", async () => {
  const host = await render({ client, providerId: "florist_one", providerLabel: "Flowers" });
  assert.equal(host.querySelectorAll("select").length, 0,
    "a selector for options that do not exist would be a promise the provider cannot keep");
  assert.equal(/Options:/.test(host.textContent), false);
});

test("a provider with no declared limits prints nothing rather than a reassuring guess", async () => {
  const host = await render({ client, providerId: "some_other_provider", providerLabel: "Other" });
  assert.equal(host.querySelector('[data-testid="browse-limits"]'), null,
    "silence is honest; an invented limit is not");
});

test("the panel still renders the product and its Add control alongside the limits", async () => {
  const host = await render({ client, providerId: "florist_one", providerLabel: "Flowers" });
  assert.ok(host.querySelector('[data-testid="browse-item-B23-4386"]'));
  assert.ok(host.querySelector('[data-testid="browse-add-B23-4386"]'));
  assert.match(host.textContent, /\$89\.95/);
});
