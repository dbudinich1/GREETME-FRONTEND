// src/utils/myOrders.test.mjs - the pure rules behind the one-list "Your Orders" page. Run: node --test src/utils/myOrders.test.mjs (Node 20)
import test from "node:test";
import assert from "node:assert/strict";
import { categoryLabel, rowFromHistory, rowFromLegacyMerch, rowFromLegacyFlower, sortNewest, loadMyOrders, NOTE_TEXT } from "./myOrders.js";

test("type chips: the five providers and curated have plain names; an unrecognised type is just 'Gift'", () => {
  assert.deepEqual(["merch", "flowers", "gift_boxes", "qrcash", "gift_cards", "curated", "mystery"].map(categoryLabel), ["Branded Goods", "Flowers", "Gift box", "QR Cash", "Gift card", "Curated gift", "Gift"]);
  assert.equal(categoryLabel("gift_box"), "Gift box");
});

test("a history row keeps the backend's status, tracking, reference and support as they are", () => {
  const r = rowFromHistory({ orderRef: "ord_0123456789abcdef", source: "flowers", category: "flowers", createdAt: "2026-09-29T12:00:00.000Z", itemSummary: "X", status: { kind: "submitted", label: "Flower order submitted" }, tracking: { available: false }, providerReference: "559781630", requestedDeliveryDate: "2026-10-14", support: true, amountCents: 100 });
  assert.deepEqual([r.status.kind, r.providerReference, r.requestedDeliveryDate, r.support, r.shortRef, r.amountCents], ["submitted", "559781630", "2026-10-14", true, "89abcdef", 100]);
  assert.equal(rowFromHistory({ orderRef: "ord_1", amountCents: "5" }).amountCents, null, "an amount that is not a number is not shown");
});

test("legacy merch: unknown or missing status is 'unknown' with support (never processing); exact 'Refunded' is its own kind; first package wins", () => {
  assert.equal(rowFromLegacyMerch({ id: "a", statusKind: undefined, statusLabel: undefined }).status.kind, "unknown");
  assert.equal(rowFromLegacyMerch({ id: "a", statusKind: "weird", statusLabel: "x" }).status.kind, "unknown");
  assert.equal(rowFromLegacyMerch({ id: "a", statusKind: "weird" }).support, true);
  assert.equal(rowFromLegacyMerch({ id: "a", statusKind: "canceled", statusLabel: "Refunded" }).status.kind, "refunded");
  assert.equal(rowFromLegacyMerch({ id: "a", statusKind: "canceled", statusLabel: "Cancelled" }).status.kind, "canceled");
  assert.equal(rowFromLegacyMerch({ id: "a", statusKind: "shipped", statusLabel: "Shipped" }).support, false);
  const t = rowFromLegacyMerch({ id: "a", statusKind: "shipped", statusLabel: "Shipped", packages: [{ carrier: "A", trackingUrl: "https://a.example/1" }, { carrier: "B", trackingUrl: "https://b.example/2" }] }).tracking;
  assert.equal(t.trackingUrl, "https://a.example/1");
});

test("legacy flower: always 'submitted', never tracking, always Get Help", () => {
  const r = rowFromLegacyFlower({ id: "gpc_1", submittedAt: "2026-09-20T00:00:00.000Z", orderReference: "55", status: { label: "Flower order submitted" } });
  assert.deepEqual([r.status.kind, r.tracking.available, r.support, r.providerReference, r.category], ["submitted", false, true, "55", "flowers"]);
});

test("sortNewest: newest first, undated last, ties keep their order", () => {
  const rows = [{ k: "b", createdAt: "2026-01-01T00:00:00Z" }, { k: "none", createdAt: null }, { k: "a", createdAt: "2026-02-01T00:00:00Z" }, { k: "b2", createdAt: "2026-01-01T00:00:00Z" }];
  assert.deepEqual(sortNewest(rows).map((r) => r.k), ["a", "b", "b2", "none"]);
});

test("loadMyOrders: history first and alone; on failure the two older reads, each independent, with a note per unreadable source; all three failing is 'failed'", async () => {
  const ok = (orders) => async () => ({ ok: true, orders });
  const bad = async () => { throw new Error("down"); };
  const calls = [];
  const spy = (name, fn) => async () => { calls.push(name); return fn(); };
  const hist = await loadMyOrders({ getOrderHistory: spy("history", ok([{ orderRef: "ord_1", createdAt: "2026-01-01T00:00:00Z", status: { kind: "processing", label: "p" } }])), getMerchOrders: spy("merch", bad), getFlowerOrders: spy("flowers", bad) });
  assert.deepEqual([hist.rows.length, hist.notes, hist.failed, calls], [1, [], false, ["history"]]);
  const fb = await loadMyOrders({ getOrderHistory: bad, getMerchOrders: ok([{ id: "m", paidAt: "2026-01-02T00:00:00Z" }]), getFlowerOrders: bad });
  assert.deepEqual([fb.rows.length, fb.notes, fb.failed], [1, ["gift", "flower"], false]);
  const none = await loadMyOrders({ getOrderHistory: bad, getMerchOrders: bad, getFlowerOrders: bad });
  assert.deepEqual([none.rows.length, none.failed], [0, true]);
  const shape = await loadMyOrders({ getOrderHistory: async () => ({ ok: false }), getMerchOrders: ok([]), getFlowerOrders: ok([]) });
  assert.deepEqual([shape.notes, shape.failed], [["gift"], false]);
  assert.ok(NOTE_TEXT.gift && NOTE_TEXT.merch && NOTE_TEXT.flower);
});
