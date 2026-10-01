// src/pages/pairBackendContract.test.mjs
//
// REAL-BACKEND ACCEPTANCE. Response bodies are not hand-written: scripts/gen-pair-backend-shapes.mjs
// runs the integrated backend's OWN code (routes/ordersRoutes.js router + projection builders, and
// the routes/paymentRoutes.js platform-fee-status handler with its real resolvePlatformFee service),
// with only Cosmos/auth faked, and these tests feed the resulting JSON to the FE consumers.
//
// Run (Node 20):  node --test src/pages/pairBackendContract.test.mjs
// Backend dir:    PAIR_BE_DIR (default C:\1_GREET-ME\cs-be-pair). The backend is read-only here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { interpretPlatformFeeStatus, platformFeeFor, formatFeeAmount, FEE_STATE_UNKNOWN } from "../utils/platformFee.js";
import { giftOrderStatusLabel, giftOrderTrackingHref, GIFT_KIND_TEXT } from "../utils/orderStatus.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const feRoot = path.resolve(here, "..", "..");
const BE = process.env.PAIR_BE_DIR || "C:/1_GREET-ME/cs-be-pair";
const OUT = process.env.PAIR_SHAPES_OUT || path.join(feRoot, "tests", "fixtures", "pair-backend-shapes.generated.json");

let shapes = null;
let skipReason = null;
if (!fs.existsSync(path.join(BE, "routes", "ordersRoutes.js"))) {
  skipReason = `pair backend not found at ${BE}`;
} else {
  const env = { ...process.env, PAIR_BE_DIR: BE };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ["--experimental-test-module-mocks", path.join(feRoot, "scripts", "gen-pair-backend-shapes.mjs"), OUT], { encoding: "utf8", env, cwd: feRoot });
  if (r.status !== 0) throw new Error(`shape generator failed (exit ${r.status}):\n${r.stdout}\n${r.stderr}`);
  shapes = JSON.parse(fs.readFileSync(OUT, "utf8"));
}
const t = (name, fn) => test(name, { skip: skipReason || false }, fn);

const refOf = (id) => "ord_" + crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 16);
const CONTRACT_KEYS = ["amountCents", "category", "createdAt", "itemSummary", "orderRef", "providerReference", "recipientName", "requestedDeliveryDate", "source", "status", "support", "tracking"];

// ---- platform-fee-status ------------------------------------------------------------------------
t("platform-fee-status 200 shapes match the contract and drive the fee display correctly", () => {
  const first = shapes.platformFee.firstActivation;
  assert.equal(first.status, 200);
  assert.deepEqual(Object.keys(first.body).sort(), ["business", "consumer", "ok"]);
  assert.deepEqual(first.body.consumer, { feeCents: 499, applies: true, reason: "initial_activation" });
  const st = interpretPlatformFeeStatus(first.body, { authenticated: true });
  assert.equal(formatFeeAmount(platformFeeFor({}, false, st)), "$4.99");

  const ret = shapes.platformFee.returning;
  assert.deepEqual(ret.body.consumer, { feeCents: 0, applies: false, reason: "already_authorized" });
  const st2 = interpretPlatformFeeStatus(ret.body, { authenticated: true });
  assert.equal(platformFeeFor({}, false, st2), 0, "returning subscriber: fee row omitted");
  assert.equal(platformFeeFor({}, true, st2), first.body.business.feeCents / 100, "business keeps the backend's $19.99");
});

t("platform-fee-status failure shapes assert NO amount in the FE", () => {
  const down = shapes.platformFee.historyUnavailable;
  assert.equal(down.status, 503);
  assert.equal(down.body.code, "FEE_HISTORY_UNAVAILABLE");
  assert.equal(down.body.consumer, undefined);
  assert.equal(down.body.business, undefined);
  // api.request throws on >=500 (hook then yields the unknown state); the body itself must also be rejected.
  assert.deepEqual(interpretPlatformFeeStatus(down.body, { authenticated: true }), FEE_STATE_UNKNOWN);
  const anon = shapes.platformFee.unauthenticated;
  assert.equal(anon.status, 401);
  assert.deepEqual(interpretPlatformFeeStatus(anon.body, { authenticated: true }), FEE_STATE_UNKNOWN);
});

// ---- orders/history -------------------------------------------------------------------------------
t("orders/history: every row has the contract keys; query was scoped to the token user", () => {
  const { status, body } = shapes.orders;
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.count, body.orders.length);
  assert.equal(body.count, 7 + 1 + 17, "7 merch + 1 flower + 17 gift fixture rows all projected (none dropped, unknown types shown)");
  for (const o of body.orders) {
    assert.deepEqual(Object.keys(o).sort(), CONTRACT_KEYS);
    assert.deepEqual(Object.keys(o.status).sort(), ["kind", "label"]);
    assert.deepEqual(Object.keys(o.tracking).sort(), ["available", "carrier", "trackingNumber", "trackingUrl"]);
  }
  assert.deepEqual(shapes.rowKeys.queryUsers, ["u1"]);
});

t("orders/history: every status.kind is one the FE knows (no unknown kind reaches 'Status unavailable')", () => {
  for (const o of shapes.orders.body.orders) {
    assert.ok(Object.hasOwn(GIFT_KIND_TEXT, o.status.kind), `unknown kind ${o.status.kind} on ${o.source}/${o.category}`);
    assert.ok(o.status.label && o.status.label.trim(), "every real row carries a label");
  }
  const kinds = new Set(shapes.orders.body.orders.map((o) => o.status.kind));
  for (const k of ["processing", "submitted", "shipped", "delivered", "awaiting_recipient", "completed", "issue", "canceled", "refunded", "expired", "unknown"]) {
    assert.ok(kinds.has(k), `fixture exercises kind ${k}`);
  }
});

t("orders/history: the FE never rewrites a real backend label (it only guards inventions)", () => {
  for (const o of shapes.orders.body.orders.filter((x) => x.source === "gift")) {
    assert.equal(giftOrderStatusLabel(o.status), o.status.label, `${o.category}/${o.status.kind}`);
  }
  const labels = Object.fromEntries(shapes.orders.body.orders.filter((o) => o.source === "gift").map((o) => [o.status.label, o.status.kind]));
  assert.equal(labels["Cancelled"], "canceled");
  assert.equal(labels["Refunded"], "refunded");
  assert.equal(labels["Waiting for recipient to claim"], "awaiting_recipient");
  assert.equal(labels["Expired unclaimed"], "expired");
});

t("orders/history: 'delivered' only for provider-proven delivery (allDelivered); label passes through verbatim", () => {
  const delivered = shapes.orders.body.orders.filter((o) => o.status.kind === "delivered");
  assert.equal(delivered.length, 2, "the two gift-box fixtures whose shipment summary says allDelivered");
  for (const o of delivered) { assert.equal(o.status.label, "Delivered"); assert.equal(giftOrderStatusLabel(o.status), "Delivered"); }
  assert.ok(!shapes.orders.body.orders.some((o) => o.source !== "gift" && o.status.kind === "delivered"), "merch/flowers can never be delivered");
  // In-transit, canceled and refunded provider records are never delivered.
  const notDelivered = shapes.orders.body.orders.filter((o) => o.category === "gift_boxes" && o.status.kind !== "delivered");
  assert.ok(notDelivered.length >= 5);
});

t("orders/history: refunded and unknown kinds are rendered verbatim with the support affordance", () => {
  const refunded = shapes.orders.body.orders.filter((o) => o.status.kind === "refunded");
  assert.ok(refunded.length >= 2, "merch and provider refunds");
  for (const o of refunded) assert.equal(giftOrderStatusLabel(o.status), "Refunded");
  const unknown = shapes.orders.body.orders.filter((o) => o.status.kind === "unknown");
  assert.ok(unknown.length >= 3, "unrecognised merch state, gift type and QR status");
  for (const o of unknown) {
    assert.equal(giftOrderStatusLabel(o.status), "Status unavailable - contact support");
    assert.equal(o.support, true, "unknown always offers support");
  }
});
t("orders/history: tracking is capability-aware (gift = carrier+number only, merch = https link)", () => {
  const gift = shapes.orders.body.orders.filter((o) => o.source === "gift");
  for (const o of gift) assert.equal(giftOrderTrackingHref(o.tracking), null, "gift rows never carry a link");
  const withTracking = gift.filter((o) => o.tracking.available);
  assert.ok(withTracking.length >= 2);
  for (const o of withTracking) assert.ok(o.tracking.carrier && o.tracking.trackingNumber);
  const merchShipped = shapes.orders.body.orders.find((o) => o.source === "merch" && o.status.kind === "shipped");
  assert.equal(giftOrderTrackingHref(merchShipped.tracking), "https://t.example/1Z");
});

t("orders/history: no claim token, voucher secret or provider id leaks into the body", () => {
  const raw = JSON.stringify(shapes.orders.body);
  for (const tok of shapes.rowKeys.giftTokens) assert.ok(!raw.includes(tok), "claim token leaked");
  assert.ok(!raw.includes("CIPHERTEXT-SECRET"));
  assert.ok(!/goody|prezzee|printful/i.test(raw.replace(/gifting partner|print partner/gi, "")), "provider name leaked");
});

t("CONTRACT MISMATCH CHECK: gift-box category value is 'gift_boxes' in code (contract text says 'gift_box')", () => {
  const cats = new Set(shapes.orders.body.orders.map((o) => o.category));
  assert.ok(cats.has("gift_boxes"));
  assert.ok(!cats.has("gift_box"));
  assert.deepEqual([...cats].sort(), ["curated", "flowers", "gift_boxes", "gift_cards", "merch", "qrcash", "weird_type"]);
});
