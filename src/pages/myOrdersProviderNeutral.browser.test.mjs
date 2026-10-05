// src/pages/myOrdersProviderNeutral.browser.test.mjs
//
// The scenarios of the founder-approved Surface 11 review, mounted against the REAL "Your Orders" page (MerchOrders.jsx) with the
// backend's real response shapes (harness: myOrdersTestHarness.mjs; router, icons and api client are the only stubs):
// one dated list newest first with a type on every row and filters; every provider (Branded Goods/Printful, Florist One, Goody, QR Cash,
// curated, Prezzee only when activated); honest status incl. refunded/unknown/expired; tracking only where real; Florist One reference,
// requested date and support; loading / empty / error / Try again / partial failure; the 50-per-type cap note; no preview-only header.
//
// Run: node --test src/pages/myOrdersProviderNeutral.browser.test.mjs   (Node 20)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHarness, ROWS, FULL, history, LEGACY_MERCH, LEGACY_FLOWER } from "./myOrdersTestHarness.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
let H;
before(async () => { H = await createHarness("neutral"); });
after(() => H.cleanup());

const status = (r, s) => r.rowWith(s).querySelector('[data-testid="order-status"]').textContent;

test("everything: ONE list, 14 rows, newest first, a type on every row; the old three section headings are gone", async () => {
  const r = await H.render({ history: history(FULL) });
  assert.equal(r.rows().length, 14);
  assert.equal(r.all("order-type").length, 14);
  assert.deepEqual([...new Set(r.all("order-type").map((e) => e.textContent))].sort(), ["Branded Goods", "Flowers", "Gift", "Gift box", "QR Cash", "Curated gift"].sort());
  assert.ok(r.rows()[0].textContent.includes("Embroidered cap"), "newest (30 Sep) first");
  assert.ok(r.rows()[13].textContent.includes("QR Cash gift"), "oldest (20 Jul QR Cash, expired) last");
  const t = r.text();
  for (const old of ["Gift Orders", "Flower Orders"]) assert.ok(!t.includes(old), `no separate "${old}" section`);
  assert.deepEqual(r.calls(), ["history"], "the combined read is the only read when it works");
  await r.unmount();
});

test("honest statuses: refunded, unknown, expired, issue, waiting for recipient, paid out - the backend's own words", async () => {
  const r = await H.render({ history: history(FULL) });
  assert.equal(status(r, "Water bottle"), "Refunded");
  assert.equal(r.rowWith("Water bottle").getAttribute("data-kind"), "refunded");
  assert.equal(status(r, "Notebook set"), "Status unavailable - contact support");
  assert.equal(status(r, "Jo Fixture"), "Status unavailable - contact support");
  assert.equal(r.rowWith("Jo Fixture").querySelector('[data-testid="order-type"]').textContent, "Gift");
  assert.equal(status(r, "Spa Gift Box"), "We hit a snag - we are on it");
  assert.equal(status(r, "Gale Fixture"), "Expired after 30 days unclaimed");
  assert.equal(status(r, "Eli Fixture"), "Waiting for recipient to claim");
  assert.equal(status(r, "Fran Fixture"), "Paid out to recipient");
  for (const s of ["Notebook set", "Jo Fixture", "Spa Gift Box"]) assert.ok(r.rowWith(s).querySelector('[data-testid="order-support"]'), `Get Help on ${s}`);
  await r.unmount();
});

test("'Delivered' only with proof: exactly one row says it", async () => {
  const r = await H.render({ history: history(FULL) });
  const said = r.all("order-status").map((e) => e.textContent).filter((s) => /delivered/i.test(s));
  assert.deepEqual(said, ["Delivered"]);
  assert.equal(r.rows().filter((x) => x.getAttribute("data-kind") === "delivered").length, 1);
  await r.unmount();
});

test("tracking only where real: two https links; carrier + number as text without a link; never for flowers, QR Cash or cards", async () => {
  const r = await H.render({ history: history(FULL) });
  const links = r.all("order-track");
  assert.equal(links.length, 2);
  for (const a of links) { assert.match(a.getAttribute("href"), /^https:\/\//); assert.match(a.getAttribute("rel"), /noopener/); }
  assert.equal(r.rowWith("Coffee Lover").querySelector('[data-testid="order-carrier"]').textContent, "FedEx 794600000000");
  assert.equal(r.rowWith("Coffee Lover").querySelector('[data-testid="order-track"]'), null);
  for (const s of ["Eli Fixture", "Fran Fixture", "Gale Fixture", "Spring Garden"]) assert.equal(r.rowWith(s).querySelector('[data-testid="order-track"]'), null, s);
  await r.unmount();
});

test("Florist One: reference, requested delivery date (footer), submitted date up top, 'tracking is not available', Get Help", async () => {
  const r = await H.render({ history: history(FULL) });
  const f = r.rowWith("Spring Garden Bouquet");
  assert.equal(f.querySelector('[data-testid="order-type"]').textContent, "Flowers");
  assert.equal(f.querySelector('[data-testid="order-ref"]').textContent, "Order Reference 559781630");
  assert.match(f.querySelector('[data-testid="order-requested"]').textContent, /Requested delivery: Oct 14, 2026/);
  assert.match(f.textContent, /Sep 29, 2026/, "leads with the submitted date");
  assert.match(f.querySelector('[data-testid="order-no-tracking"]').textContent, /tracking is not available/);
  assert.equal(f.querySelector('[data-testid="order-status"]').textContent, "Flower order submitted");
  assert.match(f.querySelector('[data-testid="order-support"]').getAttribute("href"), /^mailto:support@greet-me\.com\?subject=Flowers%20order%20559781630/);
  assert.doesNotMatch(f.textContent, /shipped|on its way|delivered/i);
  await r.unmount();
});

test("QR Cash shows what was charged (gift plus fee) as the amount", async () => {
  const r = await H.render({ history: history(["qrAwaiting"]) });
  assert.match(r.text(), /\$27\.74/);
  await r.unmount();
});

test("filters: each type shows only its own rows and All restores the list; filter buttons exist only for types present", async () => {
  const r = await H.render({ history: history(FULL) });
  assert.equal(r.tid("orders-filter-gift-card"), null);
  await r.click(r.tid("orders-filter-flowers"));
  assert.equal(r.rows().length, 1);
  await r.click(r.tid("orders-filter-qr-cash"));
  assert.equal(r.rows().length, 3);
  await r.click(r.tid("orders-filter-gift-box"));
  assert.equal(r.rows().length, 4);
  await r.click(r.tid("orders-filter-all"));
  assert.equal(r.rows().length, 14);
  await r.unmount();
});

test("Prezzee is dormant: no gift-card row, filter or placeholder until activated; activated, it is one 'Gift card' row with no voucher or PIN", async () => {
  const dormant = await H.render({ history: history(FULL) });
  assert.ok(!dormant.text().includes("Gift card"));
  assert.ok(!/coming soon/i.test(dormant.text()));
  assert.equal(dormant.tid("orders-filter-gift-card"), null);
  await dormant.unmount();
  const on = await H.render({ history: history([...FULL, "cardReady"]) });
  assert.equal(on.rows().length, 15);
  const c = on.rowWith("Smart Card $50");
  assert.equal(c.querySelector('[data-testid="order-type"]').textContent, "Gift card");
  assert.equal(c.querySelector('[data-testid="order-status"]').textContent, "Ready for recipient");
  assert.doesNotMatch(c.textContent, /voucher|PIN|https?:/i);
  await on.unmount();
});

test("corporate-funded gifts are ordinary gifts of the owner: no corporate marker is invented", async () => {
  const r = await H.render({ history: history(FULL) });
  assert.doesNotMatch(r.text(), /corporate|business|paid by/i);
  await r.unmount();
});

test("loading, empty, error and Try again", async () => {
  const loading = await H.render({ history: "never", merch: "never", flowers: "never" });
  assert.ok(loading.tid("orders-loading"));
  assert.match(loading.text(), /Loading your orders/);
  await loading.unmount();

  const empty = await H.render({ history: history([]) });
  assert.ok(empty.tid("orders-empty"));
  assert.match(empty.text(), /No orders yet/);
  await empty.click([...empty.host.querySelectorAll("button")].find((b) => /Browse the American Gift Place/.test(b.textContent)));
  assert.deepEqual(empty.navigated(), ["/dashboard/merch"]);
  await empty.unmount();

  const err = await H.render({ history: "fail", merch: "fail", flowers: "fail" });
  assert.ok(err.tid("orders-error"));
  assert.match(err.text(), /couldn.t load your orders/);
  assert.equal(err.rows().length, 0);
  await err.unmount();

  // Try again: the combined read fails once, then works
  const retry = await H.render({ history: (n) => (n === 1 ? "fail" : history(FULL)), merch: "fail", flowers: "fail" });
  assert.ok(retry.tid("orders-error"));
  await retry.click(retry.tid("orders-retry"));
  assert.equal(retry.rows().length, 14);
  assert.equal(retry.tid("orders-error"), null);
  await retry.unmount();
});

test("one source failing does not hide the others (combined read down: merch and flowers still show, the gift note and Try again appear)", async () => {
  const r = await H.render({ history: "fail", merch: { ok: true, orders: [LEGACY_MERCH({ id: "m1" })] }, flowers: { ok: true, orders: [LEGACY_FLOWER()] } });
  assert.equal(r.rows().length, 2);
  assert.match(r.tid("orders-note-gift").textContent, /couldn.t load your gift orders/);
  assert.ok(r.tid("orders-retry"));
  assert.deepEqual(r.calls().sort(), ["flowers", "history", "merch"]);
  const retry = await H.render({ history: (n) => (n === 1 ? "fail" : history(["merchProcessing", "flowers", "qrAwaiting"])), merch: { ok: true, orders: [LEGACY_MERCH({ id: "m1" })] }, flowers: { ok: true, orders: [] } });
  assert.equal(retry.rows().length, 1);
  await retry.click(retry.tid("orders-retry"));
  assert.equal(retry.rows().length, 3, "after Try again the full list replaces the fallback");
  assert.equal(retry.tid("orders-notes"), null);
  await retry.unmount();
  await r.unmount();
});

test("a capped list says so (older orders are not listed here yet); no paging control", async () => {
  const r = await H.render({ history: history(FULL, { truncated: true }) });
  assert.match(r.tid("orders-truncated").textContent, /Older orders are not listed here yet/);
  assert.ok(![...r.host.querySelectorAll("button")].some((b) => /older|more|next|page/i.test(b.textContent)));
  await r.unmount();
});

test("a rejected status shape from the server never throws: a row without status reads 'Status unavailable'", async () => {
  const bad = { ...ROWS.merchProcessing, orderRef: "ord_0000000000000555", status: undefined };
  const r = await H.render({ history: { ok: true, orders: [bad], truncated: false } });
  assert.equal(r.tid("order-status").textContent, "Status unavailable");
  await r.unmount();
});

test("source: three existing reads only, no preview-only header or shim, route and nav unchanged, copy says Branded Goods not merch", () => {
  const page = readFileSync(join(__dirname, "MerchOrders.jsx"), "utf8");
  const util = readFileSync(join(__dirname, "..", "utils", "myOrders.js"), "utf8");
  assert.match(util, /api\.getOrderHistory\(\)/); assert.match(util, /api\.getMerchOrders\(\)/); assert.match(util, /api\.getFlowerOrders\(\)/);
  for (const s of [page, util]) { assert.doesNotMatch(s, /x-preview-pane|__s11|surface11/); assert.doesNotMatch(s, /fetch\(/); }
  const app = readFileSync(join(__dirname, "..", "App.jsx"), "utf8");
  assert.match(app, /merch\/orders/);
  const layout = readFileSync(join(__dirname, "..", "components", "DashboardLayout.jsx"), "utf8");
  assert.match(layout, /merch\/orders/);
  assert.doesNotMatch(page, /Greet-Me merch\b|place a merch order|Browse Merch/i);
});
