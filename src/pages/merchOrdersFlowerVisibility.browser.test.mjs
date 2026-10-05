// src/pages/merchOrdersFlowerVisibility.browser.test.mjs
//
// FLOWER (Florist One) visibility on the provider-neutral "Your Orders" page (MerchOrders.jsx, W42). The REAL page is mounted in
// jsdom (harness: myOrdersTestHarness.mjs); only router, icons and api client are stubbed.
//
// Protects what this file has always protected: a flower order is visible even when the customer has NO other orders (a flowers-only
// customer sees their flower orders and never "No orders yet"), it shows the honest fixed status, its order reference, the requested
// delivery date, "Shipment tracking is not available" and Get Help, never renders a tracking link, never fabricates a date or $0.00,
// and a failing read never blanks the page or hides the other orders. Covers the combined-history path and the legacy fallback.
//
// Run: node --test src/pages/merchOrdersFlowerVisibility.browser.test.mjs   (Node 20)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHarness, ROWS, history, LEGACY_FLOWER, LEGACY_MERCH } from "./myOrdersTestHarness.mjs";

let H;
before(async () => { H = await createHarness("flowers"); });
after(() => H.cleanup());

const flowerRow = (o = {}) => ({ ...ROWS.flowers, ...o });
const hist = (rows) => ({ ok: true, count: rows.length, truncated: false, orders: rows });

test("no flower orders: no flower row and no flower wording at all", async () => {
  const r = await H.render({ history: history(["merchProcessing"]) });
  assert.equal(r.text().includes("Flowers"), false);
  assert.equal(r.text().includes("flower"), false);
  await r.unmount();
});

test("a real flower order renders with the honest status, summary, recipient, reference, requested date and amount", async () => {
  const r = await H.render({ history: hist([flowerRow()]) });
  const text = r.text();
  assert.match(text, /Flower order submitted/);
  assert.match(text, /Spring Garden Bouquet for Dana Lee/);
  assert.match(text, /Order Reference 559781630/);
  assert.match(text, /\$64\.99/);
  assert.match(text, /Requested delivery: Oct 14, 2026/);
  assert.match(text, /Shipment tracking is not available/);
  assert.match(text, /Get Help with This Order/);
  assert.equal(r.tid("order-type").textContent, "Flowers");
  await r.unmount();
});

test("a flower order never renders a tracking link or button, and never claims shipped or delivered", async () => {
  const r = await H.render({ history: hist([flowerRow()]) });
  assert.equal(r.html().includes("Track "), false);
  assert.equal(r.all("order-track").length, 0);
  assert.equal(/href="https?:\/\//.test(r.html()), false, "no outbound tracking URL for a flower order");
  assert.doesNotMatch(r.text(), /shipped|on its way|delivered(?! )/i);
  await r.unmount();
});

test("a flowers-only customer sees their flower orders and NEVER 'No orders yet'", async () => {
  for (const script of [
    { history: hist([flowerRow()]) },                                                                 // combined history
    { history: "fail", merch: { ok: true, orders: [] }, flowers: { ok: true, orders: [LEGACY_FLOWER()] } }, // legacy fallback
  ]) {
    const r = await H.render(script);
    assert.equal(r.rows().length, 1);
    assert.equal(r.text().includes("No orders yet"), false);
    assert.equal(r.tid("orders-empty"), null);
    assert.match(r.text(), /Flowers/);
    await r.unmount();
  }
});

test("an order with no requested delivery date still shows the honest no-tracking copy, without fabricating a date", async () => {
  const r = await H.render({ history: hist([flowerRow({ requestedDeliveryDate: null })]) });
  assert.match(r.text(), /Shipment tracking is not available/);
  assert.equal(r.text().includes("Requested delivery:"), false);
  await r.unmount();
});

test("an order with no amount available renders without fabricating $0.00", async () => {
  const r = await H.render({ history: hist([flowerRow({ amountCents: null })]) });
  assert.match(r.text(), /Flower order submitted/);
  assert.equal(r.text().includes("$0.00"), false);
  await r.unmount();
});

test("legacy fallback: a flower order from GET /api/gifts/flower-orders renders the same honest row", async () => {
  const r = await H.render({ history: "fail", merch: { ok: true, orders: [] }, flowers: { ok: true, orders: [LEGACY_FLOWER()] } });
  const t = r.text();
  assert.match(t, /Flower order submitted/);
  assert.match(t, /Flowers for Dana Rivers/);
  assert.match(t, /Order Reference 559781630/);
  assert.match(t, /\$84\.99/);
  assert.match(t, /Requested delivery: Sep 25, 2026/);
  assert.match(t, /Get Help with This Order/);
  assert.equal(r.all("order-track").length, 0);
  assert.equal(r.tid("order-note-gift") !== null || r.tid("orders-note-gift") !== null, true, "and it says the gift orders could not be loaded");
  await r.unmount();
});

test("a failing read shows a quiet inline notice and Try again - never a blank page, never the other orders hidden", async () => {
  // combined read down: merch + flowers still load, and the gift read is named
  const r = await H.render({ history: "fail", merch: { ok: true, orders: [LEGACY_MERCH()] }, flowers: { ok: true, orders: [LEGACY_FLOWER()] } });
  assert.equal(r.rows().length, 2);
  assert.match(r.text(), /couldn.t load your gift orders/i);
  assert.ok(r.tid("orders-retry"));
  assert.equal(r.tid("orders-error"), null, "not the full error box");
  await r.unmount();
  // the flower read down too: its own notice, merch still shown
  const f = await H.render({ history: "fail", merch: { ok: true, orders: [LEGACY_MERCH()] }, flowers: "fail" });
  assert.match(f.text(), /couldn.t load your flower orders/i);
  assert.equal(f.rows().length, 1);
  assert.match(f.text(), /White glossy mug/);
  await f.unmount();
});

test("the existing merch order is unaffected by a present flower order", async () => {
  const r = await H.render({ history: history(["merchProcessing", "flowers"]) });
  assert.match(r.text(), /Embroidered cap/);
  assert.match(r.text(), /Spring Garden Bouquet for Dana Lee/);
  await r.unmount();
});
