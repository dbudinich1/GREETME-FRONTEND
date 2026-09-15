// src/components/giftPlace/giftCardImageFit.browser.test.mjs
//
// THE WHOLE PRODUCT IS SHOWN, IN EVERY CATEGORY — mounted, and asserted from the real DOM.
//
// The Gift Place painted every product photo with `background: url(...) center/cover no-repeat`.
// `cover` scales the image until the frame is covered and discards the overflow. Printful mockups are
// near-square so they survived it; a Florist One arrangement is TALLER THAN WIDE — the provider ships
// its own size as free text, '14"w x 20"h' being the convention — and a portrait photo scaled to cover
// a landscape frame loses roughly half its height, taking the top of the blooms and the base of the
// vase with it.
//
// WHY THESE ARE REAL ASSERTIONS AND THE OLD ONES COULD NOT BE. jsdom's CSS parser DROPS the
// `background` shorthand — proven below, in the first test, rather than asserted on trust — so while
// the frame used the shorthand its wiring could only be checked by reading the source file. The fix is
// written as four longhand properties, which jsdom does expose, so every claim here is read back out
// of the mounted DOM.
//
// Both painted surfaces are covered: the catalogue card and the uniform "Added to Cart!" confirmation.
//
// NO NETWORK, no provider call, no order, no payment, no greeting. Image URLs are synthetic and are
// never fetched — a background-image is not loaded by jsdom.
//
// Run (Node 20.x):
//   node --test src/components/giftPlace/giftCardImageFit.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__gcif.bundle.mjs");
const ENTRY = join(__dirname, ".__gcif.entry.jsx");

let React, createRoot, act, window;
let GiftProductCard, GiftProductGrid, AddToCartModal;

// A FLOWER: portrait, on the provider's own dimension convention.
const FLOWER = Object.freeze({
  id: "T18-1A",
  source: "provider",
  name: "Sunlit Rose Bouquet",
  description: "A dozen roses, hand-arranged.",
  imageUrl: "https://images.test/rose-portrait.jpg",
  priceLabel: "$64.99",
  priceMinor: 6499,
});

// A MERCH product: near-square, the category that looked fine under `cover`. It must receive the
// IDENTICAL treatment — the founder's rule is one frame for every category.
const MERCH = Object.freeze({
  id: "431624815",
  source: "catalog",
  name: "White glossy mug",
  description: "11oz.",
  imageUrl: "https://images.test/mug-square.jpg",
  priceLabel: "$24.00",
  priceMinor: 2400,
});

const NO_IMAGE = Object.freeze({
  id: "NOPIC-1",
  source: "catalog",
  name: "Unphotographed thing",
  description: "",
  imageUrl: null,
  priceLabel: "$10.00",
  priceMinor: 1000,
});

before(async () => {
  // NOTHING IS STUBBED. Both components are presentational — they import only lucide icons and the
  // real `getHoverHandlers`, which is side-effect-free and reads `window.matchMedia` lazily inside the
  // call (provided below). So the code under test here is the shipped code, unmodified.
  writeFileSync(ENTRY,
    'export { GiftProductCard, GiftProductGrid } from "./GiftProductCard.jsx";\n'
    + 'export { default as AddToCartModal } from "../AddToCartModal.jsx";\n');

  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty" },
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });

  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
    { url: "http://localhost/dashboard/gifts" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.localStorage = window.localStorage;
  globalThis.sessionStorage = window.sessionStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {} });

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ GiftProductCard, GiftProductGrid, AddToCartModal } = await import(pathToFileURL(BUNDLE).href));
});

after(() => {
  for (const f of [BUNDLE, ENTRY]) { try { rmSync(f, { force: true }); } catch { /* best effort */ } }
});

/** Mount an element, hand back its host, and always unmount. */
async function mount(element) {
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(element); });
  return {
    host,
    async unmount() {
      await act(async () => { root.unmount(); });
      host.remove();
    },
  };
}

const frameOf = (host, id) => host.querySelector(`[data-testid="gift-card-image-${id}"]`);

/** The four facts that together mean "the whole picture, centred, undistorted, on a neutral ground". */
function assertContained(el, what) {
  assert.ok(el, `${what}: the image frame must exist`);
  assert.equal(el.style.backgroundSize, "contain",
    `${what}: backgroundSize must be 'contain' — 'cover' is what cropped the arrangement`);
  assert.equal(el.style.backgroundPosition, "center", `${what}: the image must be centred in its frame`);
  assert.equal(el.style.backgroundRepeat, "no-repeat", `${what}: the image must not tile`);
  assert.ok(el.style.backgroundColor, `${what}: the letterbox must be filled with a neutral colour`);
  // NOTHING THAT WOULD DISTORT. `fill`/`stretch`/explicit 100% 100% all change the aspect ratio;
  // `cover` crops. None may appear on a product frame.
  assert.doesNotMatch(el.style.backgroundSize, /cover|fill|stretch|100%\s+100%/,
    `${what}: the image must be neither cropped nor stretched`);
}

test("1. jsdom really does drop the `background` shorthand — the premise of this file", async () => {
  // Asserted, not assumed. This is WHY the fix uses longhand and why these tests can read the DOM.
  const probe = window.document.createElement("div");
  probe.style.background = "url(https://images.test/x.jpg) center/cover no-repeat";
  assert.equal(probe.style.background, "",
    "if jsdom ever starts parsing the shorthand, this file's rationale should be revisited");
  probe.style.backgroundSize = "contain";
  assert.equal(probe.style.backgroundSize, "contain", "the longhand form is readable, which is the point");
});

test("2. a FLOWER card shows the entire arrangement — contained, not cropped", async () => {
  const m = await mount(React.createElement(GiftProductCard,
    { card: FLOWER, actionLabel: "Select Gift", onAction: () => {} }));
  try {
    const frame = frameOf(m.host, FLOWER.id);
    assertContained(frame, "flower card");
    // And it is the flower's OWN photograph.
    assert.match(frame.style.backgroundImage, /rose-portrait\.jpg/,
      "the frame paints the product's own imageUrl");
  } finally { await m.unmount(); }
});

test("3. MERCH gets the identical treatment — one frame for every category", async () => {
  const flower = await mount(React.createElement(GiftProductCard,
    { card: FLOWER, actionLabel: "Select Gift", onAction: () => {} }));
  const merch = await mount(React.createElement(GiftProductCard,
    { card: MERCH, actionLabel: "Add to Cart", onAction: () => {} }));
  try {
    const f = frameOf(flower.host, FLOWER.id);
    const g = frameOf(merch.host, MERCH.id);
    assertContained(f, "flower card");
    assertContained(g, "merch card");

    // UNIFORMLY SIZED — the founder's rule. Same height, same width basis, same padding, so a grid
    // row cannot go ragged and no category gets a bigger picture than another.
    assert.equal(f.style.height, g.style.height, "every category's frame must be the same height");
    assert.equal(f.style.width, g.style.width, "every category's frame must be the same width");
    assert.equal(f.style.padding, g.style.padding, "every category's frame must have the same padding");
    assert.equal(f.style.backgroundSize, g.style.backgroundSize, "and the same fit behaviour");
  } finally { await merch.unmount(); await flower.unmount(); }
});

test("4. the frame is uniform within each layout mode, and stays a fixed box", async () => {
  const wide = await mount(React.createElement(GiftProductCard,
    { card: FLOWER, actionLabel: "Select Gift", onAction: () => {}, isNarrow: false }));
  const narrow = await mount(React.createElement(GiftProductCard,
    { card: FLOWER, actionLabel: "Select Gift", onAction: () => {}, isNarrow: true }));
  try {
    const w = frameOf(wide.host, FLOWER.id);
    const n = frameOf(narrow.host, FLOWER.id);
    assertContained(w, "wide frame");
    assertContained(n, "narrow frame");
    // A real, fixed frame in both modes — containment must not be achieved by letting the box collapse
    // or grow to the image.
    assert.match(w.style.height, /^\d+px$/, "the wide frame is a fixed pixel height");
    assert.match(n.style.height, /^\d+px$/, "the narrow frame is a fixed pixel height");
    assert.equal(w.style.width, "100%", "the frame spans its card");
    assert.equal(n.style.width, "100%", "the frame spans its card");
    // Padding must be inside the fixed box, never adding to it.
    assert.equal(w.style.boxSizing, "border-box", "padding must not enlarge the frame");
    assert.equal(n.style.boxSizing, "border-box", "padding must not enlarge the frame");
  } finally { await narrow.unmount(); await wide.unmount(); }
});

test("5. a card with NO photograph keeps its gradient placeholder, unchanged", async () => {
  const m = await mount(React.createElement(GiftProductCard,
    { card: NO_IMAGE, actionLabel: "Add to Cart", onAction: () => {} }));
  try {
    const frame = frameOf(m.host, NO_IMAGE.id);
    assert.ok(frame, "the frame still exists — an imageless card is never a shorter card");
    // A CSS gradient is itself a background-image, so jsdom reports the placeholder here. What must be
    // absent is a product photograph: no url() of any kind.
    assert.doesNotMatch(frame.style.backgroundImage, /url\(/, "no product photograph is painted");
    assert.match(frame.style.backgroundImage, /linear-gradient/, "the gradient placeholder is painted");
    assert.match(frame.textContent, /🎁/, "the placeholder glyph still shows");
    // Same frame size as a photographed card, which is the whole reason the placeholder exists.
    const other = await mount(React.createElement(GiftProductCard,
      { card: FLOWER, actionLabel: "Add to Cart", onAction: () => {} }));
    try {
      assert.equal(frame.style.height, frameOf(other.host, FLOWER.id).style.height,
        "an imageless card keeps the identical frame height");
    } finally { await other.unmount(); }
  } finally { await m.unmount(); }
});

test("6. a whole GRID of mixed categories is uniform end to end", async () => {
  const m = await mount(React.createElement(GiftProductGrid, {
    cards: [FLOWER, MERCH, NO_IMAGE], state: "ready", actionLabel: "Add to Cart", onAction: () => {},
  }));
  try {
    const frames = [FLOWER, MERCH, NO_IMAGE].map((c) => frameOf(m.host, c.id));
    assert.equal(frames.filter(Boolean).length, 3, "all three cards rendered");
    const heights = new Set(frames.map((f) => f.style.height));
    assert.equal(heights.size, 1, `every frame in the grid is the same height, got ${[...heights]}`);
    // The two photographed ones are both contained; neither is cropped.
    assertContained(frames[0], "grid flower");
    assertContained(frames[1], "grid merch");
  } finally { await m.unmount(); }
});

test("7. the uniform confirmation shows the whole arrangement too", async () => {
  const m = await mount(React.createElement(AddToCartModal, {
    isOpen: true,
    onClose: () => {},
    item: { name: FLOWER.name, price: 64.99, imageUrl: FLOWER.imageUrl, giftType: "flowers" },
    onContinueShopping: () => {},
    onGoToCheckout: () => {},
    showGoToCheckout: false,
  }));
  try {
    const img = m.host.querySelector('[data-testid="cart-modal-item-image"]');
    assertContained(img, "confirmation image");
    assert.match(img.style.backgroundImage, /rose-portrait\.jpg/,
      "the confirmation paints the item's own imageUrl");
    assert.equal(img.getAttribute("aria-hidden"), "true", "still decorative, not announced");
    assert.equal(img.style.boxSizing, "border-box", "padding must not enlarge the confirmation image");
  } finally { await m.unmount(); }
});

test("8. the confirmation still renders name and price, and still omits the image when none is given",
  async () => {
    const withImg = await mount(React.createElement(AddToCartModal, {
      isOpen: true, onClose: () => {},
      item: { name: MERCH.name, price: 24, imageUrl: MERCH.imageUrl },
      onContinueShopping: () => {}, onGoToCheckout: () => {},
    }));
    try {
      const body = withImg.host.textContent;
      assert.match(body, /White glossy mug/, "the name is confirmed");
      assert.match(body, /24\.00/, "the price is confirmed");
      assertContained(withImg.host.querySelector('[data-testid="cart-modal-item-image"]'),
        "merch confirmation image");
    } finally { await withImg.unmount(); }

    // A caller that supplies no picture renders exactly what it rendered before the image existed.
    const noImg = await mount(React.createElement(AddToCartModal, {
      isOpen: true, onClose: () => {},
      item: { name: MERCH.name, price: 24 },
      onContinueShopping: () => {}, onGoToCheckout: () => {},
    }));
    try {
      assert.equal(noImg.host.querySelector('[data-testid="cart-modal-item-image"]'), null,
        "no image element when the caller supplies no imageUrl");
      assert.match(noImg.host.textContent, /White glossy mug/, "the name still renders");
    } finally { await noImg.unmount(); }
  });
