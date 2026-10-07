// src/pages/merchOrderStatus.browser.test.mjs
//
// RENDERED-COMPONENT coverage of how the provider-neutral "Your Orders" page (MerchOrders.jsx, W42) displays STATUS - the
// property this file has always protected, now for the one-list page. The REAL page is mounted in jsdom (harness: myOrdersTestHarness.mjs);
// only router, icons and api client are stubbed, answering with the backend's own shapes.
//
// Proves: the backend label is shown as it is and no competing status vocabulary exists in the client; a refunded order is NOT styled as
// cancelled; an unknown or missing status is honest ("Status unavailable" with Get Help, never "Processing"); raw internal states and
// vendor statuses never reach the DOM; long labels stay readable at 320px; tracking is a link only when it is https; "Delivered" only
// with proof. Both the combined-history path and the legacy fallback path (history unavailable) are covered.
//
// Run: node --test src/pages/merchOrderStatus.browser.test.mjs   (Node 20)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHarness, ROWS, history, LEGACY_MERCH } from "./myOrdersTestHarness.mjs";

let H;
before(async () => { H = await createHarness("status"); });
after(() => H.cleanup());

const hist = (rows) => ({ ok: true, count: rows.length, truncated: false, orders: rows });
const row = (o) => ({ ...ROWS.merchProcessing, orderRef: "ord_0000000000000999", ...o });

test("every supported backend label renders exactly as provided (combined history)", async () => {
  const labels = [
    ["processing", "Payment received — preparing your order"], ["processing", "Order placed with our print partner"],
    ["processing", "Approved — production scheduled"], ["processing", "Being made"], ["shipped", "Shipped"],
    ["issue", "We hit a snag — we're on it"], ["canceled", "Cancelled"], ["refunded", "Refunded"],
  ];
  for (const [kind, label] of labels) {
    const r = await H.render({ history: hist([row({ status: { kind, label } })]) });
    assert.equal(r.tid("order-status").textContent, label, `"${label}" must render verbatim`);
    await r.unmount();
  }
});

test("the backend label always wins; no 'Processing' appears when the label says something else", async () => {
  const r = await H.render({ history: hist([row({ status: { kind: "processing", label: "Being made" } })]) });
  assert.ok(r.text().includes("Being made"));
  assert.ok(!r.text().includes("Processing"));
  await r.unmount();
});

test("a missing or blank label is honest: 'Status unavailable', never blank, never undefined/null, never 'Processing'", async () => {
  for (const label of [undefined, null, "", "   "]) {
    const r = await H.render({ history: hist([row({ status: { kind: "processing", label } })]) });
    assert.equal(r.tid("order-status").textContent, "Status unavailable");
    assert.ok(!r.text().includes("undefined") && !r.text().includes("null"));
    assert.ok(!r.text().includes("Processing"), "no invented Processing");
    await r.unmount();
  }
  // the legacy fallback (history unavailable) is just as honest about a merch order with no label or kind
  const legacy = LEGACY_MERCH({ statusKind: undefined, statusLabel: undefined });
  const r = await H.render({ history: "fail", merch: { ok: true, orders: [legacy] } });
  assert.equal(r.rowWith("White glossy mug").querySelector('[data-testid="order-status"]').textContent, "Status unavailable");
  assert.ok(r.rowWith("White glossy mug").querySelector('[data-testid="order-support"]'), "Get Help is offered");
  assert.ok(!r.text().includes("Processing"));
  await r.unmount();
});

test("an UNKNOWN status is shown plainly with Get Help, in a neutral badge (not the 'processing' look)", async () => {
  const r = await H.render({ history: history(["merchUnknown", "merchProcessing"]) });
  const u = r.rowWith("Notebook set");
  assert.equal(u.querySelector('[data-testid="order-status"]').textContent, "Status unavailable - contact support");
  assert.ok(u.querySelector('[data-testid="order-support"]'));
  const style = (el) => el.querySelector('[data-testid="order-status"]').getAttribute("style");
  assert.notEqual(style(u), style(r.rowWith("Embroidered cap")), "unknown does not look like processing");
  await r.unmount();
});

test("a REFUNDED order is not styled as cancelled (its own kind and badge), on both paths", async () => {
  const badge = (r, s) => r.rowWith(s).querySelector('[data-testid="order-status"]').getAttribute("style");
  const r = await H.render({ history: hist([row({ itemSummary: "Refunded thing", status: { kind: "refunded", label: "Refunded" } }), row({ orderRef: "ord_0000000000000998", itemSummary: "Cancelled thing", status: { kind: "canceled", label: "Cancelled" } })]) });
  assert.equal(r.rowWith("Refunded thing").getAttribute("data-kind"), "refunded");
  assert.notEqual(badge(r, "Refunded thing"), badge(r, "Cancelled thing"));
  await r.unmount();
  // legacy fallback: the old endpoint collapses a refund into "canceled" with the label "Refunded"; the badge stays the refunded one
  const l = await H.render({ history: "fail", merch: { ok: true, orders: [LEGACY_MERCH({ id: "a1", itemSummary: "Legacy refunded", statusKind: "canceled", statusLabel: "Refunded" }), LEGACY_MERCH({ id: "b2", itemSummary: "Legacy cancelled", statusKind: "canceled", statusLabel: "Cancelled" })] } });
  assert.equal(l.rowWith("Legacy refunded").getAttribute("data-kind"), "refunded");
  assert.equal(l.rowWith("Legacy cancelled").getAttribute("data-kind"), "canceled");
  assert.notEqual(badge(l, "Legacy refunded"), badge(l, "Legacy cancelled"));
  await l.unmount();
});

test("raw internal states and vendor statuses never reach the DOM", async () => {
  const hostile = {
    state: "fulfillment_placed", printfulStatus: "inprocess", printfulOrderId: 171449412,
    retailReconciliationError: "retail reconciliation failed (subtotal_mismatch)", lastFailureReason: "Printful order submit error 400",
    claimToken: "tok_secret", voucherUrl: "https://v.example/x", giftPin: "9988", paymentIntentId: "pi_123",
  };
  const r = await H.render({ history: hist([row({ ...hostile, status: { kind: "processing", label: "Being made" } })]) });
  for (const banned of ["fulfillment_placed", "fulfillment_pending", "pending_fulfillment", "fulfillment_failed", "inprocess", "printful", "Printful", "171449412", "reconciliation", "subtotal_mismatch", "tok_secret", "v.example", "9988", "pi_123"]) {
    assert.ok(!r.html().includes(banned), `"${banned}" must not render`);
  }
  assert.ok(r.text().includes("Being made"));
  await r.unmount();
  const l = await H.render({ history: "fail", merch: { ok: true, orders: [LEGACY_MERCH({ ...hostile, statusLabel: "Being made" })] } });
  for (const banned of ["fulfillment_placed", "inprocess", "Printful", "171449412", "subtotal_mismatch", "400"]) assert.ok(!l.text().includes(banned), `legacy: "${banned}"`);
  await l.unmount();
});

test("the page contains no competing status vocabulary of its own", async () => {
  const r = await H.render({ history: hist([row({ status: { kind: "shipped", label: "Shipped" } })]) });
  assert.ok(!r.text().includes("Order received — processing"));
  assert.ok(!/delivered/i.test(r.text()), "a shipped order never says delivered");
  await r.unmount();
});

test("the longest label renders complete and unclipped at a narrow width", async () => {
  const longest = "Payment received — preparing your order";
  const r = await H.render({ history: hist([row({ status: { kind: "processing", label: longest } })]) }, { width: 320 });
  const badge = r.tid("order-status");
  assert.equal(badge.textContent, longest);
  const css = badge.getAttribute("style") || "";
  assert.ok(!/text-overflow\s*:\s*ellipsis/i.test(css) && !/white-space\s*:\s*nowrap/i.test(css) && !/overflow\s*:\s*hidden/i.test(css) && !/\bmax-width\s*:/i.test(css));
  await r.unmount();
});

test("tracking: an https link opens safely; an http or script link is never linked; carrier and number show as text without a link", async () => {
  const r = await H.render({ history: history(["merchShipped", "boxShipped"]) });
  const link = r.rowWith("Logo mug").querySelector('[data-testid="order-track"]');
  assert.equal(link.getAttribute("href"), "https://www.ups.com/track?tracknum=1Z999AA10123456784");
  assert.equal(link.getAttribute("rel"), "noopener noreferrer");
  assert.equal(link.getAttribute("target"), "_blank");
  assert.equal(r.rowWith("Coffee Lover").querySelector('[data-testid="order-track"]'), null);
  assert.equal(r.rowWith("Coffee Lover").querySelector('[data-testid="order-carrier"]').textContent, "FedEx 794600000000");
  await r.unmount();
  const bad = await H.render({ history: hist([row({ status: { kind: "shipped", label: "Shipped" }, tracking: { available: true, carrier: "X", trackingNumber: "1", trackingUrl: "javascript:alert(1)" } }), row({ orderRef: "ord_0000000000000997", itemSummary: "Plain http", status: { kind: "shipped", label: "Shipped" }, tracking: { available: true, carrier: "Y", trackingNumber: "2", trackingUrl: "http://t.example/2" } })]) });
  assert.equal(bad.all("order-track").length, 0);
  assert.ok(!bad.html().includes("javascript:"));
  await bad.unmount();
});

test("legacy fallback keeps the existing tracking display: the first package link, safe rel", async () => {
  const l = await H.render({ history: "fail", merch: { ok: true, orders: [LEGACY_MERCH({ statusKind: "shipped", statusLabel: "Shipped", shippedAt: "2026-08-20T00:00:00.000Z", packages: [{ carrier: "DHLGLOBALMAIL", trackingNumber: "TRK123", trackingUrl: "https://myorders.co/tracking/82735098/", shippedAt: "2026-08-20T00:00:00.000Z" }] })] } });
  assert.ok(l.text().includes("Shipped"));
  assert.ok(l.html().includes("https://myorders.co/tracking/82735098/"));
  assert.ok(l.html().includes('rel="noopener noreferrer"'));
  assert.ok(l.text().includes("Track with DHLGLOBALMAIL"));
  await l.unmount();
});

test("'Delivered' appears only for a row with proof (kind delivered), whatever the label says elsewhere", async () => {
  const r = await H.render({ history: history(["boxDelivered", "boxShipped", "merchShipped", "flowers"]) });
  const delivered = r.rows().filter((x) => /Delivered/.test(x.querySelector('[data-testid="order-status"]').textContent));
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].getAttribute("data-kind"), "delivered");
  await r.unmount();
  // a label that CLAIMS delivery under another kind is not trusted
  const liar = await H.render({ history: hist([row({ status: { kind: "processing", label: "Delivered to your door" } })]) });
  assert.ok(!/Delivered/.test(liar.tid("order-status").textContent));
  await liar.unmount();
});

test("existing order details still render: item summary and total", async () => {
  const r = await H.render({ history: hist([row({ itemSummary: "White glossy mug — 15 oz", amountCents: 4499, status: { kind: "processing", label: "Approved — production scheduled" } })]) });
  assert.ok(r.text().includes("White glossy mug"));
  assert.ok(r.text().includes("44.99"));
  await r.unmount();
});

// ---- Release 2 (2026-10-07): truthful refunded gift orders and held merchandise ----------------------------------------
test("Release 2: held merchandise renders 'not yet sent for printing' with its own badge and Get Help, never 'processing'", async () => {
  const r = await H.render({ history: hist([
    row({ itemSummary: "Held tee", status: { kind: "on_hold", label: "Payment received — not yet sent for printing" }, support: true }),
    row({ orderRef: "ord_0000000000000996", itemSummary: "Failed tee", status: { kind: "issue", label: "Not yet sent for printing — please contact support" }, support: true }),
    row({ orderRef: "ord_0000000000000995", itemSummary: "Moving tee", status: { kind: "processing", label: "Being made" } }),
  ]) });
  const held = r.rowWith("Held tee");
  assert.equal(held.querySelector('[data-testid="order-status"]').textContent, "Payment received — not yet sent for printing");
  assert.equal(held.getAttribute("data-kind"), "on_hold");
  assert.ok(held.querySelector('[data-testid="order-support"]'), "Get Help is offered on a held order");
  const style = (s) => r.rowWith(s).querySelector('[data-testid="order-status"]').getAttribute("style");
  assert.notEqual(style("Held tee"), style("Moving tee"), "held does not look like an order in progress");
  assert.equal(r.rowWith("Failed tee").querySelector('[data-testid="order-status"]').textContent, "Not yet sent for printing — please contact support");
  assert.ok(r.rowWith("Failed tee").querySelector('[data-testid="order-support"]'));
  assert.equal(r.rowWith("Moving tee").querySelector('[data-testid="order-status"]').textContent, "Being made", "normal progress unchanged");
  assert.ok(!/processing/i.test(held.textContent + r.rowWith("Failed tee").textContent));
  await r.unmount();
});

test("Release 2: a refunded Prezzee gift card shows Refunded (refunded badge); a partial refund keeps its real status", async () => {
  const card = (o) => ({ ...ROWS.cardReady, ...o });
  const r = await H.render({ history: hist([
    card({ itemSummary: "Gift card", status: { kind: "refunded", label: "Refunded" } }),
    card({ orderRef: "ord_0000000000000994", itemSummary: "Partly refunded card", status: { kind: "completed", label: "Gift card ready for recipient — partially refunded" } }),
  ]) });
  const full = r.rowWith("Gift card for");
  assert.equal(full.querySelector('[data-testid="order-status"]').textContent, "Refunded");
  assert.equal(full.getAttribute("data-kind"), "refunded");
  assert.ok(!/ready for recipient/i.test(full.textContent), "a refunded card never still says ready");
  assert.equal(r.rowWith("Partly refunded card").querySelector('[data-testid="order-status"]').textContent, "Gift card ready for recipient — partially refunded");
  await r.unmount();
});

test("Release 2: legacy fallback shows the held label verbatim (old endpoint keeps its four kinds)", async () => {
  const l = await H.render({ history: "fail", merch: { ok: true, orders: [LEGACY_MERCH({ itemSummary: "Legacy held", statusKind: "processing", statusLabel: "Payment received — not yet sent for printing" })] } });
  assert.equal(l.rowWith("Legacy held").querySelector('[data-testid="order-status"]').textContent, "Payment received — not yet sent for printing");
  await l.unmount();
});
