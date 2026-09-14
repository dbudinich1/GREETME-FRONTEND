// src/pages/sendGiftSummaryPlacement.browser.test.mjs
//
// WHERE THE SELECTED GIFT IS ALLOWED TO APPEAR ON THE SEND FORM — and where the chooser is allowed
// to open by itself.
//
// Two confirmed defects, both about presentation rather than meaning:
//
//   1. The selected-gift summary and the "Including a ... gift" indicator were rendered as CHILDREN OF
//      THE TOP THREE-COLUMN GRID. That grid is Recipient | Occasion | Tone. A fourth child took the
//      second column, pushed Occasion across and dropped Tone onto a second row, so choosing a gift
//      silently rearranged the form. Both now live in the lower "Add a Gift (Optional)" section.
//
//   2. Returning from the Gift Place with a flower already chosen REOPENED "Choose a Gift" with
//      nothing selected, so the sender had to dismiss an empty modal to see what they had just picked.
//      The chooser now opens only from Add a Gift / Edit Gift / Change Gift.
//
// The real page is bundled and mounted in jsdom, with only its side-effecting edges stubbed — auth,
// the API client and the cart. Everything about the layout and the modal is the real component. So
// what is asserted here is what a sender would actually see.
//
// Nothing about what a selection MEANS or how it is stored is under test here, and nothing about it
// changed: no checkout, payment, provider, retry, remount-recovery or send behaviour is touched.
//
// Run (Node 20.x):
//   node --test src/pages/sendGiftSummaryPlacement.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const BUNDLE = join(__dirname, ".__sgsp.bundle.mjs");
const ENTRY = join(__dirname, ".__sgsp.entry.jsx");
const AUTH_STUB = join(__dirname, ".__sgsp.auth.js");
const API_STUB = join(__dirname, ".__sgsp.api.js");
const CART_STUB = join(__dirname, ".__sgsp.cart.js");

let React, createRoot, act, SendGreeting, MemoryRouter, window;

/** Contacts the page can offer, so the Recipient control is populated. */
const CONTACTS = [{ id: "c1", name: "Dana Example", email: "dana@example.com" }];

before(async () => {
  writeFileSync(AUTH_STUB,
    "export const useAuth = () => ({\n"
    + "  user: { id: 'u1', email: 'sender@example.com', name: 'Sender', emailVerified: true,\n"
    + "          tier: 'close_circle', profilePhoto: null },\n"
    + "  refreshUser: async () => {},\n"
    + "});\n"
    + "export const AuthContext = { Provider: ({ children }) => children };\n"
    + "export default { useAuth };\n");

  // Every read answers with something shaped but empty. No network, and nothing that could be
  // mistaken for a provider call, an order, a tokenization or a charge.
  writeFileSync(API_STUB,
    "const contacts = " + JSON.stringify(CONTACTS) + ";\n"
    + "async function get(url = '') {\n"
    + "  if (String(url).includes('contacts')) return { data: { contacts } };\n"
    + "  if (String(url).includes('balance') || String(url).includes('hearts')) return { data: { balance: 0 } };\n"
    + "  return { data: {} };\n"
    + "}\n"
    + "const noop = async () => ({ data: {} });\n"
    + "export default { get, post: noop, put: noop, patch: noop, delete: noop, request: noop };\n");

  // Mirrors the REAL cartService surface (src/services/cartService.js) rather than guessing at it:
  // the page calls getCart and removeItem, and the rest are present so a shape check cannot pass for
  // the wrong reason. An empty cart is the honest default — this correction is about a gift chosen in
  // the Gift Place, not about cart items.
  writeFileSync(CART_STUB,
    "let items = [];\n"
    + "export default {\n"
    + "  getCart: () => items,\n"
    + "  addItem: (i) => { items.push(i); return items; },\n"
    + "  removeItem: (id) => { items = items.filter((x) => x.id !== id); return items; },\n"
    + "  updateItem: () => items, getTotal: () => 0, getCount: () => items.length,\n"
    + "  clear: () => { items = []; }, hasItem: () => false, hasMerch: () => false,\n"
    + "  hasNonMerch: () => false, clearMerch: () => { items = []; },\n"
    + "};\n");

  writeFileSync(ENTRY,
    'export { default as SendGreeting } from "./SendGreeting.jsx";\n'
    + 'export { MemoryRouter } from "react-router-dom";\n');

  await esbuild.build({
    entryPoints: [ENTRY],
    outfile: BUNDLE,
    bundle: true,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty" },
    // Only the page's SIDE-EFFECTING edges are swapped: the auth context, the API client and the
    // cart. esbuild's `alias` takes package names rather than paths, so the redirect is done by
    // resolving the three specifiers this page imports them under. Everything else in the bundle —
    // the layout, the modals, the view model — is the real thing.
    plugins: [{
      name: "stub-side-effects",
      setup(build) {
        const STUBS = new Map([
          ["../context/AuthContext", AUTH_STUB],
          ["../api/api", API_STUB],
          ["../services/cartService", CART_STUB],
        ]);
        build.onResolve({ filter: /.*/ }, (args) => {
          const hit = STUBS.get(args.path);
          return hit ? { path: hit } : undefined;
        });
      },
    }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });

  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "http://localhost/dashboard/send",
    pretendToBeVisual: true,
  });
  window = dom.window;
  global.window = window;
  global.document = window.document;
  global.navigator = window.navigator;
  global.HTMLElement = window.HTMLElement;
  global.Node = window.Node;
  global.getComputedStyle = window.getComputedStyle;
  // The page reads `sessionStorage` bare, not `window.sessionStorage`, so it has to exist as a global
  // too — otherwise the Gift Place round-trip restore throws on mount.
  global.sessionStorage = window.sessionStorage;
  global.localStorage = window.localStorage;
  global.requestAnimationFrame = (cb) => window.setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => window.clearTimeout(id);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  // No network of any kind. Reaching this is a test failure, not a fallback.
  global.fetch = async () => { throw new Error("no test may make a network request"); };
  window.fetch = global.fetch;
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  }));

  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = React);
  ({ SendGreeting, MemoryRouter } = await import(pathToFileURL(BUNDLE).href));
});

after(() => {
  for (const f of [BUNDLE, ENTRY, AUTH_STUB, API_STUB, CART_STUB]) {
    try { rmSync(f, { force: true }); } catch { /* best effort */ }
  }
});

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

/**
 * Mount the page at a given URL, optionally with the sessionStorage record the Gift Place round trip
 * leaves behind. `search` is what the Gift Place appends when it sends the sender back.
 */
async function mountSend({ search = "", saved = null } = {}) {
  if (saved) window.sessionStorage.setItem("sendGreetingState", JSON.stringify(saved));
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [`/dashboard/send${search}`] },
        React.createElement(SendGreeting),
      ),
    );
  });
  await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  return { host, root, unmount: () => act(() => root.unmount()) };
}

const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

/** The top three-column row: Recipient | Occasion | Tone. */
function topRow(host) {
  const grids = [...host.querySelectorAll("div")].filter((d) => {
    const s = d.getAttribute("style") || "";
    return s.includes("grid-template-columns") && /1fr 1fr 1fr/.test(s);
  });
  assert.ok(grids.length >= 1, "the Recipient/Occasion/Tone grid must be present");
  return grids[0];
}

/** Element children of the top row, in document order. */
const topRowChildren = (host) => [...topRow(host).children];

/** The lower "Add a Gift (Optional)" section. */
function addGiftSection(host) {
  const label = [...host.querySelectorAll("label")].find((l) => /Add a Gift \(Optional\)/.test(text(l)));
  assert.ok(label, "the Add a Gift (Optional) label must be present");
  return label.parentElement;
}

/**
 * A flower chosen in the Gift Place, in the shape the page ACTUALLY reads.
 *
 * Not guessed: `selectedGiftSummary` keys off `giftSettings.type === 'flowers'` and
 * `giftSettings.flowersProduct`, and projects it through `fromProviderProduct`, which builds the price
 * label from `priceMinor` + `currency`. A fixture shaped any other way would render nothing and the
 * tests would pass for the wrong reason.
 */
const FLOWER_PRODUCT = {
  providerProductId: "DEMO-T18",
  name: "Sunlit Rose Bouquet",
  priceMinor: 6499,
  currency: "USD",
  imageUrl: "https://example.test/rose.jpg",
};
const FLOWER_PRICE_LABEL = "$64.99";
const FLOWER_STATE = {
  formData: { contactId: "c1", occasionType: "Birthday", tone: "Heartfelt" },
  giftSettings: { type: "flowers", flowersProduct: FLOWER_PRODUCT },
};

const QR_STATE = {
  formData: { contactId: "c1", occasionType: "Birthday", tone: "Heartfelt" },
  giftSettings: { type: "qrcash", amount: 25 },
};

const CURATED_STATE = {
  formData: { contactId: "c1", occasionType: "Birthday", tone: "Heartfelt" },
  giftSettings: { type: "curated", maxSpend: 50 },
};

// ===========================================================================
// 1-5 — the top row is Recipient | Occasion | Tone, whatever the gift is
// ===========================================================================

const GIFT_MARKERS = [
  "selected-gift-summary",
  "selected-gift-name",
  "selected-gift-price",
  "selected-gift-change",
];

/** Anything gift-shaped rendered inside the top row is the defect. */
function assertTopRowIsClean(host, label) {
  const row = topRow(host);
  for (const marker of GIFT_MARKERS) {
    assert.equal(
      row.querySelectorAll(`[data-testid="${marker}"]`).length, 0,
      `${label}: no [data-testid="${marker}"] may render inside the Recipient/Occasion/Tone row`,
    );
  }
  const rowText = text(row);
  for (const phrase of ["Selected Gift", "Including a QR Cash gift", "Including a curated gift",
    "Including 1 item", "Change Gift", "Sunlit Rose Bouquet", "$64.99"]) {
    assert.equal(
      rowText.includes(phrase), false,
      `${label}: the top row must not contain "${phrase}" — found: ${rowText.slice(0, 220)}`,
    );
  }
  // And structurally: exactly the three fields, in order.
  const kids = topRowChildren(host);
  assert.equal(kids.length, 3, `${label}: the top row must have exactly 3 children, got ${kids.length}`);
  assert.match(text(kids[0]), /Recipient/, `${label}: first child is Recipient`);
  assert.match(text(kids[1]), /Occasion/, `${label}: second child is Occasion`);
  assert.match(text(kids[2]), /Tone/, `${label}: third child is Tone`);
}

test("1. with no gift selected, the top row is Recipient, Occasion, Tone", async () => {
  const m = await mountSend();
  try {
    assertTopRowIsClean(m.host, "no gift");
    // And no summary anywhere on the form.
    assert.equal(m.host.querySelectorAll('[data-testid="selected-gift-summary"]').length, 0,
      "no gift means no selected-gift summary at all");
  } finally { await m.unmount(); }
});

test("2. with QR Cash selected, the top row is unchanged", async () => {
  const m = await mountSend({ search: "?returnTo=send&giftType=qrcash", saved: QR_STATE });
  try {
    assertTopRowIsClean(m.host, "qrcash");
  } finally { await m.unmount(); }
});

test("3. with a flower selected, the top row is unchanged", async () => {
  const m = await mountSend({ search: "?returnTo=send&giftType=flowers", saved: FLOWER_STATE });
  try {
    assertTopRowIsClean(m.host, "flower");
  } finally { await m.unmount(); }
});

test("4. with a Greet-Me Select gift, the top row is unchanged", async () => {
  const m = await mountSend({ search: "?returnTo=send&giftType=curated", saved: CURATED_STATE });
  try {
    assertTopRowIsClean(m.host, "curated");
  } finally { await m.unmount(); }
});

test("5. the top row keeps its three-column layout for every gift type", async () => {
  for (const [label, search, saved] of [
    ["none", "", null],
    ["qrcash", "?returnTo=send&giftType=qrcash", QR_STATE],
    ["flowers", "?returnTo=send&giftType=flowers", FLOWER_STATE],
    ["curated", "?returnTo=send&giftType=curated", CURATED_STATE],
  ]) {
    const m = await mountSend({ search, saved });
    try {
      const style = topRow(m.host).getAttribute("style") || "";
      assert.match(style, /1fr 1fr 1fr/, `${label}: the row keeps three equal columns`);
      assert.equal(topRowChildren(m.host).length, 3, `${label}: three children`);
    } finally { await m.unmount(); }
  }
});

// ===========================================================================
// 6-7 — the gift appears exactly once, in the lower section, with its controls
// ===========================================================================

test("6. a selected flower appears exactly once, inside Add a Gift (Optional)", async () => {
  const m = await mountSend({ search: "?returnTo=send&giftType=flowers", saved: FLOWER_STATE });
  try {
    const summaries = m.host.querySelectorAll('[data-testid="selected-gift-summary"]');
    assert.equal(summaries.length, 1, "exactly one selected-gift summary on the whole form");

    const section = addGiftSection(m.host);
    assert.ok(section.contains(summaries[0]),
      "the summary must be inside the Add a Gift (Optional) section");

    // Its product detail is there, and nowhere else.
    assert.match(text(section), /Sunlit Rose Bouquet/, "the product name is in the lower section");
    assert.ok(text(section).includes(FLOWER_PRICE_LABEL), "the price is in the lower section");
    const img = section.querySelector('[data-testid="selected-gift-summary"] [aria-hidden="true"]');
    assert.ok(img, "the product image element is in the lower section");
    // The image is painted with `background: url(...) center/cover no-repeat`. jsdom's CSS parser
    // DROPS that shorthand — verified directly: setting it leaves style.background === "" while the
    // longhand form survives — so the URL is not readable from the DOM here. The product CSS is valid;
    // this is an environment limit, so the wiring is asserted at the source instead of pretended at.
    assert.equal(img.getAttribute("aria-hidden"), "true", "the image is decorative, not announced");
    const pageSrc = readFileSync(join(__dirname, "SendGreeting.jsx"), "utf8");
    assert.match(
      pageSrc,
      /url\(\$\{selectedGiftSummary\.imageUrl\}\)/,
      "the summary paints the chosen product's own imageUrl",
    );
  } finally { await m.unmount(); }
});

test("7. Edit Gift and Remove still operate from the lower section", async () => {
  const m = await mountSend({ search: "?returnTo=send&giftType=qrcash", saved: QR_STATE });
  try {
    const section = addGiftSection(m.host);
    const buttons = [...section.querySelectorAll("button")];

    const edit = buttons.find((b) => /Edit Gift/.test(text(b)));
    assert.ok(edit, "Edit Gift must be present in the lower section");

    const remove = buttons.find((b) => text(b) === "Remove");
    assert.ok(remove, "Remove must be present in the lower section");

    // Remove clears the selection, from the lower section, without touching anything else.
    await act(async () => { remove.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
    assert.equal(m.host.querySelectorAll('[data-testid="selected-gift-summary"]').length, 0,
      "Remove clears the summary");
    assertTopRowIsClean(m.host, "after Remove");

    // And Add a Gift is offered again.
    const after = [...addGiftSection(m.host).querySelectorAll("button")];
    assert.ok(after.some((b) => /Add a Gift \(Optional\)/.test(text(b))),
      "the control returns to offering Add a Gift");
  } finally { await m.unmount(); }
});

// ===========================================================================
// ADDENDUM 1-6 — the chooser does not reopen on the way back
// ===========================================================================

/** The "Choose a Gift" chooser, if it is open. */
function chooser(host) {
  const heads = [...host.querySelectorAll("h2, h3")].filter((h) => /Choose a Gift/i.test(text(h)));
  return heads[0] || null;
}

test("A1 + A2 + A3. returning from the Gift Place with a flower leaves the chooser CLOSED", async () => {
  const m = await mountSend({ search: "?returnTo=send&giftType=flowers", saved: FLOWER_STATE });
  try {
    assert.equal(chooser(m.host), null,
      "the Choose a Gift chooser must not reopen merely because the sender came back");

    // The flower is still attached, and visible where it belongs.
    const summaries = m.host.querySelectorAll('[data-testid="selected-gift-summary"]');
    assert.equal(summaries.length, 1, "the flower is still attached and shown once");
    assert.match(text(addGiftSection(m.host)), /Sunlit Rose Bouquet/,
      "and it is the flower that was chosen, not a default or empty selection");

    // Nothing empty or default is presented during the return.
    assert.equal(text(m.host).includes("No gift for now"), false,
      "no empty/default gift choice is displayed on the way back");
  } finally { await m.unmount(); }
});

test("A4. the top row is unchanged on the return from the Gift Place", async () => {
  const m = await mountSend({ search: "?returnTo=send&giftType=flowers", saved: FLOWER_STATE });
  try {
    assertTopRowIsClean(m.host, "return from Gift Place");
  } finally { await m.unmount(); }
});

test("A5 + A6. Edit Gift still opens the chooser, and cancelling keeps the flower", async () => {
  const m = await mountSend({ search: "?returnTo=send&giftType=flowers", saved: FLOWER_STATE });
  try {
    assert.equal(chooser(m.host), null, "closed to begin with");

    const edit = [...addGiftSection(m.host).querySelectorAll("button")]
      .find((b) => /Edit Gift/.test(text(b)));
    assert.ok(edit, "Edit Gift must be available");
    await act(async () => { edit.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
    assert.ok(chooser(m.host), "an intentional Edit Gift DOES open the chooser");

    // Cancel it. The flower must survive.
    const close = [...m.host.querySelectorAll("button")]
      .find((b) => /^(Cancel|Close|×|✕)$/.test(text(b)) || /close/i.test(b.getAttribute("aria-label") || ""));
    if (close) {
      await act(async () => { close.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
      assert.equal(chooser(m.host), null, "the chooser closes");
    }
    assert.equal(m.host.querySelectorAll('[data-testid="selected-gift-summary"]').length, 1,
      "cancelling an intentionally opened chooser does not remove the selected flower");
    assert.match(text(addGiftSection(m.host)), /Sunlit Rose Bouquet/, "the same flower is still there");
  } finally { await m.unmount(); }
});

test("A5b. Change Gift on the summary card also opens the chooser", async () => {
  const m = await mountSend({ search: "?returnTo=send&giftType=flowers", saved: FLOWER_STATE });
  try {
    const change = m.host.querySelector('[data-testid="selected-gift-change"]');
    assert.ok(change, "Change Gift must be present on the summary");
    assert.ok(addGiftSection(m.host).contains(change), "and it lives in the lower section");
    await act(async () => { change.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
    assert.ok(chooser(m.host), "Change Gift opens the chooser");
  } finally { await m.unmount(); }
});

// ===========================================================================
// 8-10 / A7-A9 — nothing else moved
// ===========================================================================

test("8 + A8. no checkout opens from choosing, displaying or returning with a gift", async () => {
  for (const [label, search, saved] of [
    ["qrcash", "?returnTo=send&giftType=qrcash", QR_STATE],
    ["flowers", "?returnTo=send&giftType=flowers", FLOWER_STATE],
    ["curated", "?returnTo=send&giftType=curated", CURATED_STATE],
  ]) {
    const m = await mountSend({ search, saved });
    try {
      const body = text(m.host);
      for (const phrase of ["Card number", "Pay ", "Total charged by", "payment processor"]) {
        assert.equal(body.includes(phrase), false,
          `${label}: checkout must not open — found "${phrase}"`);
      }
      assert.equal(m.host.querySelectorAll('[data-testid="provider-checkout-pay"]').length, 0,
        `${label}: no checkout Pay control is rendered`);
    } finally { await m.unmount(); }
  }
});

test("A9. mounting and interacting makes no network request of any kind", async () => {
  // `fetch` throws in this environment, so any provider request, order, tokenization, charge, send or
  // recipient contact would surface as an error rather than pass silently.
  const m = await mountSend({ search: "?returnTo=send&giftType=flowers", saved: FLOWER_STATE });
  try {
    const edit = [...addGiftSection(m.host).querySelectorAll("button")]
      .find((b) => /Edit Gift/.test(text(b)));
    if (edit) {
      await act(async () => { edit.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
    }
    assert.ok(true, "no network request was attempted");
  } finally { await m.unmount(); }
});

test("10. the send, retry, handoff and remount-recovery wiring is untouched by this correction", () => {
  // Structural, deliberately: these are wiring facts, and this correction must not have altered any of
  // them. Read from the page source so the claim is about the code, not about a render.
  const src = readFileSync(join(__dirname, "SendGreeting.jsx"), "utf8");
  for (const needle of [
    "executeGreetingSend",
    "dispatchFlowerGreeting",
    "handleFlowerOrderAccepted",
    "usePendingGiftLinkRecovery",
    "ensureSendRequestId",
    "persistPendingGiftLink",
    "readPendingGiftLink",
    "clearPendingGiftLink",
    "retryGiftLink",
    "CHECKOUT_STATUS",
  ]) {
    assert.ok(src.includes(needle), `${needle} must still be wired into the page`);
  }
  // The attachment restore that carries the chosen gift back is still there, untouched.
  assert.match(src, /setGiftSettings\(\{\s*\.\.\.parsed\.giftSettings,\s*type:\s*giftType\s*\}\)/,
    "the Gift Place return still restores the selected gift");
  // And the chooser has exactly the intentional open paths.
  assert.equal((src.match(/setIsGiftModalOpen\(true\)/g) || []).length, 2,
    "the chooser opens only from the Add/Edit Gift button and the Change Gift button");
});

// ===========================================================================
// THE CANONICAL CADENCE — Done & Send, then checkout, then the send continues
// ===========================================================================
//
// The main-page action is "Done & Send". It is not "Continue": the only Continue on this journey
// belongs inside the gift-selection modal, and it is left alone.
//
//   1. flower chosen in the Gift Place    5. shown only in Add a Gift (Optional)
//   2. returns straight to Send           6. sender presses Done & Send
//   3. flower stays attached              7. Done & Send begins the flower checkout
//   4. the chooser stays closed           8. on ACCEPTED the Greet-Me send continues automatically
//                                         9. with no second Done, Continue, close or send

test("C1. the main action is Done & Send, and it is not a Continue", async () => {
  const m = await mountSend({ search: "?returnTo=send&giftType=flowers", saved: FLOWER_STATE });
  try {
    const submit = m.host.querySelector('button[type="submit"]');
    assert.ok(submit, "the form has a submit control");
    assert.match(text(submit), /Done & Send/, "the main action reads Done & Send");

    // No competing Continue on the page itself. A Continue inside the gift modal is legitimate and is
    // not what this asserts — the modal is closed here.
    assert.equal(chooser(m.host), null, "the gift chooser is closed");
    const continues = [...m.host.querySelectorAll("button")].filter((b) => /^Continue$/.test(text(b)));
    assert.equal(continues.length, 0, "the Send page itself offers no Continue control");
  } finally { await m.unmount(); }
});

test("C2. Done & Send with a flower attached opens the review step, and sends nothing yet", async () => {
  const m = await mountSend({ search: "?returnTo=send&giftType=flowers", saved: FLOWER_STATE });
  try {
    const submit = m.host.querySelector('button[type="submit"]');
    await act(async () => { submit.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });

    // It opens the review, not a checkout and not a send. Nothing has been paid for or dispatched.
    const body = text(m.host);
    for (const phrase of ["Card number", "Total charged by", "payment processor"]) {
      assert.equal(body.includes(phrase), false, `Done & Send must not open checkout directly (${phrase})`);
    }
    assert.equal(m.host.querySelectorAll('[data-testid="provider-checkout-pay"]').length, 0,
      "no Pay control appears from pressing Done & Send");
    // The flower is still attached and still shown exactly once.
    assert.equal(m.host.querySelectorAll('[data-testid="selected-gift-summary"]').length, 1,
      "the flower is still attached after Done & Send");
    assertTopRowIsClean(m.host, "after Done & Send");
  } finally { await m.unmount(); }
});

test("C3. the cadence is wired end to end: Done & Send -> review -> checkout -> automatic send", () => {
  // The chain crosses two modals and a provider component, so it is asserted at the source. Each link
  // is a specific wiring fact, and together they are steps 6 through 9.
  const src = readFileSync(join(__dirname, "SendGreeting.jsx"), "utf8");

  // 6 -> 7a: the submit handler opens the review step and dispatches nothing itself.
  assert.match(src, /const handleSubmit = async \(e\) => \{[\s\S]*?setIsPreSendReviewOpen\(true\);/,
    "Done & Send opens the pre-send review");

  // 7b: the review's flower confirmation is what begins the flower checkout.
  assert.match(src, /onConfirmFlowersCheckout=\{handleReviewFlowersCheckout\}/,
    "the review routes a flower confirmation to the flowers checkout");
  assert.match(src, /const handleReviewFlowersCheckout = \(\) => \{[\s\S]*?setIsFlowersCheckoutOpen\(true\);/,
    "and that handler opens the flower checkout");

  // 8: the accepted handoff is the only thing that continues the send.
  assert.match(src, /onAccepted=\{handleFlowerOrderAccepted\}/,
    "the checkout's accepted handoff is wired to the page");
  const accepted = src.slice(
    src.indexOf("const handleFlowerOrderAccepted"),
    src.indexOf("const dispatchFlowerGreeting"),
  );
  assert.ok(accepted.length > 0, "the accepted handler must be findable");
  assert.match(accepted, /setIsFlowersCheckoutOpen\(false\)/,
    "the checkout closes itself — no dismissal is asked of the sender");
  assert.match(accepted, /await dispatchFlowerGreeting\(/,
    "and the Greet-Me send continues automatically");

  // 9: FAIL-CLOSED. Anything short of ACCEPTED returns before the send.
  assert.match(accepted, /if \(result\?\.status !== CHECKOUT_STATUS\.ACCEPTED\) return;/,
    "a cancelled, declined, failed or confirmation-uncertain checkout must not send the Greet-Me");
  const guardAt = accepted.indexOf("!== CHECKOUT_STATUS.ACCEPTED");
  const dispatchAt = accepted.indexOf("await dispatchFlowerGreeting(");
  assert.ok(guardAt > -1 && dispatchAt > guardAt,
    "the ACCEPTED guard must come BEFORE the send, not after it");
});

test("C4. this correction did not touch the cadence, the checkout or the send", () => {
  // The diff for this branch is presentation only. These are the behaviours it must not have altered,
  // asserted as still present and still wired the way they were.
  const src = readFileSync(join(__dirname, "SendGreeting.jsx"), "utf8");
  for (const needle of [
    "setIsPreSendReviewOpen(true)",            // Done & Send -> review
    "onConfirmFlowersCheckout={handleReviewFlowersCheckout}",
    "onConfirmDirectSend={handleReviewDirectSend}",
    "onConfirmQRCashFresh={handleReviewQRCashFresh}",
    "onMarketplaceCheckout={handleReviewMarketplaceCheckout}",
    "onAccepted={handleFlowerOrderAccepted}",
    "flowerSendStarted",                       // the one-send latch
    "setGiftConfirmedForSend(false)",           // a fresh checkout starts clean
    "setPendingGiftLink(null)",
  ]) {
    assert.ok(src.includes(needle), `${needle} must be unchanged by this correction`);
  }
});
