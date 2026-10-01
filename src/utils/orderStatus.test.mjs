// src/utils/orderStatus.test.mjs — W42 status semantics. Run (Node 20): node --test src/utils/orderStatus.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { giftOrderStatusLabel, giftOrderTrackingHref, giftStatusBadgeStyle, GIFT_KIND_TEXT, STATUS_UNAVAILABLE } from "./orderStatus.js";

const S = (kind, label) => ({ kind, label });

test("every documented kind keeps the authoritative backend label", () => {
  const labels = {
    processing: "Payment received - confirming your order",
    submitted: "Flower order submitted",
    shipped: "On its way",
    awaiting_recipient: "Waiting for recipient to claim",
    completed: "Paid out to recipient",
    issue: "We hit a snag - we're on it",
    canceled: "Cancelled",
    expired: "Expired unclaimed",
    delivered: "Delivered",
  };
  for (const [kind, label] of Object.entries(labels)) assert.equal(giftOrderStatusLabel(S(kind, label)), label, kind);
});

test("canceled/expired/awaiting_recipient with a 'delivery' label keep the label (not past tense)", () => {
  assert.equal(giftOrderStatusLabel(S("canceled", "Delivery canceled")), "Delivery canceled");
  assert.equal(giftOrderStatusLabel(S("expired", "Delivery window expired")), "Delivery window expired");
  assert.equal(giftOrderStatusLabel(S("awaiting_recipient", "Waiting for delivery details")), "Waiting for delivery details");
  assert.equal(giftOrderStatusLabel(S("issue", "Delivery problem - we're on it")), "Delivery problem - we're on it");
});

test("a label asserting past-tense delivery under another kind becomes that kind's own plain text, never 'Processing'", () => {
  const cases = {
    shipped: "Shipped", canceled: "Canceled", expired: "Expired", issue: "Needs attention", completed: "Completed",
    awaiting_recipient: "Waiting for recipient", submitted: "Submitted", processing: "Processing",
  };
  for (const [kind, text] of Object.entries(cases)) {
    assert.equal(giftOrderStatusLabel(S(kind, "Delivered to doorstep")), text, kind);
    assert.equal(giftOrderStatusLabel(S(kind, "Your gift was DELIVERED")), text, kind);
  }
  assert.notEqual(giftOrderStatusLabel(S("canceled", "Delivered")), "Processing");
});

test("'Delivered' is shown only for kind delivered", () => {
  assert.equal(giftOrderStatusLabel(S("delivered", "Delivered")), "Delivered");
  assert.equal(giftOrderStatusLabel(S("delivered", "Delivered on Oct 1")), "Delivered on Oct 1");
  for (const kind of Object.keys(GIFT_KIND_TEXT).filter((k) => k !== "delivered")) {
    assert.doesNotMatch(giftOrderStatusLabel(S(kind, "Delivered")), /delivered/i, kind);
  }
});

test("unknown kind or missing/blank label is 'Status unavailable' (no invented state)", () => {
  assert.equal(STATUS_UNAVAILABLE, "Status unavailable");
  for (const status of [S("teleported", "Arrived"), S("", "Something"), S(undefined, "Something"), S("processing", ""), S("processing", "   "), S("processing", undefined), S("shipped", null), {}, null, undefined]) {
    assert.equal(giftOrderStatusLabel(status), STATUS_UNAVAILABLE, JSON.stringify(status));
  }
  assert.equal(giftOrderStatusLabel(S("__proto__", "x")), STATUS_UNAVAILABLE);
  assert.equal(giftOrderStatusLabel(S("toString", "x")), STATUS_UNAVAILABLE);
});

test("badge styles: documented kinds are distinct from neutral where meaningful; unknown is neutral", () => {
  const neutral = giftStatusBadgeStyle("nonsense");
  assert.deepEqual(giftStatusBadgeStyle(undefined), neutral);
  assert.deepEqual(giftStatusBadgeStyle("canceled"), neutral);
  assert.deepEqual(giftStatusBadgeStyle("expired"), neutral);
  for (const k of ["processing", "submitted", "shipped", "delivered", "completed", "awaiting_recipient", "issue"]) {
    assert.notDeepEqual(giftStatusBadgeStyle(k), neutral, k);
  }
  assert.notDeepEqual(giftStatusBadgeStyle("awaiting_recipient"), giftStatusBadgeStyle("processing"));
  assert.notDeepEqual(giftStatusBadgeStyle("submitted"), neutral);
});

test("tracking link only when available, https and parseable", () => {
  assert.equal(giftOrderTrackingHref({ available: true, trackingUrl: "https://t.example/1" }), "https://t.example/1");
  assert.equal(giftOrderTrackingHref({ available: false, trackingUrl: "https://t.example/1" }), null);
  assert.equal(giftOrderTrackingHref({ available: true, trackingUrl: "http://t.example/1" }), null);
  assert.equal(giftOrderTrackingHref({ available: true, trackingUrl: "javascript:alert(1)" }), null);
  assert.equal(giftOrderTrackingHref({ available: true, trackingUrl: null }), null);
  assert.equal(giftOrderTrackingHref(null), null);
});

test("MerchOrders uses these helpers and keeps merch fallback untouched", () => {
  const src = fs.readFileSync(new URL("../pages/MerchOrders.jsx", import.meta.url), "utf8");
  assert.match(src, /from "\.\.\/utils\/orderStatus"/);
  assert.match(src, /giftStatusBadgeStyle\(kind\)/);
  assert.match(src, /o\.statusLabel \|\| "Processing"/, "merch behavior deliberately unchanged");
});
