// SURFACE 8 - pure tests for the one-time send model. Run (Node 20): node --test src/components/corporateCampaign/oneTimeSendModel.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPreviewRequest, buildSendRequest, newIdempotencyKey, planLine, blockerText, notReadyText, giftPayload, totalLine, canConfirm, money,
  FINAL_BUTTON_LABEL, FINAL_NOTE, TOP_UP_HREF, UPGRADE_HREF,
} from "./oneTimeSendModel.js";

test("recipients are exactly ONE of a category or a single contact", () => {
  assert.deepEqual(buildPreviewRequest({ who: "category", category: "client", contactId: "ignored" }).recipients, { category: "client" });
  assert.deepEqual(buildPreviewRequest({ who: "single", category: "client", contactId: "c9" }).recipients, { contactId: "c9" });
});

test("the send body carries what the owner reviewed: the count and, for a paid gift, the exact total", () => {
  const req = buildPreviewRequest({ who: "category", category: "vendor", gift: { type: "curated", maxSpendCents: 5000 }, excludeFeaturedSpread: true });
  const free = buildSendRequest(req, { recipients: { count: 3 }, gift: { requiresPayment: false, totalCents: null } }, "key-1");
  assert.equal(free.expectedRecipientCount, 3);
  assert.equal("expectedTotalCents" in free, false);
  assert.equal(free.excludeFeaturedSpread, true);
  assert.equal(free.idempotencyKey, "key-1");
  const paid = buildSendRequest(req, { recipients: { count: 2 }, gift: { requiresPayment: true, totalCents: 12345 } }, "key-2");
  assert.equal(paid.expectedTotalCents, 12345);
});

test("no approve / lock / schedule field exists in any request", () => {
  const body = buildSendRequest(buildPreviewRequest({ who: "category", category: "client" }), { recipients: { count: 1 }, gift: {} }, "k");
  for (const k of Object.keys(body)) assert.ok(["recipients", "gift", "excludeFeaturedSpread", "skipNotReady", "idempotencyKey", "expectedRecipientCount"].includes(k), k);
});

test("plan line: one Greet-Me per person; when short it says how many and that nothing is sent", () => {
  const ok = planLine({ required: 3, available: 10, shortfall: 0 });
  assert.equal(ok.short, false);
  assert.match(ok.text, /uses 3 Greet-Mes from your plan \(one per person\)\. You have 10\./);
  const short = planLine({ required: 5, available: 3, shortfall: 2 });
  assert.equal(short.short, true);
  assert.match(short.text, /You are 2 short, so nothing will be sent\./);
  assert.match(planLine({ required: 1, available: 4, shortfall: 0 }).text, /uses 1 Greet-Me from/);
  assert.ok(TOP_UP_HREF && UPGRADE_HREF);
});

test("the confirm is final and says so; there is no cancel wording", () => {
  assert.match(FINAL_BUTTON_LABEL, /final/);
  assert.match(FINAL_NOTE, /cannot be cancelled/);
  assert.equal(canConfirm({ canSend: true }, { busy: false }), true);
  assert.equal(canConfirm({ canSend: false }, { busy: false }), false);
  assert.equal(canConfirm({ canSend: true }, { busy: true }), false);
  assert.equal(canConfirm(null, { busy: false }), false);
});

test("gift: none sends null; curated sends the canonical shape; the total line names the saved card and the moment of sending", () => {
  assert.equal(giftPayload("none", 2500), null);
  assert.deepEqual(giftPayload("curated", 5000), { type: "curated", maxSpendCents: 5000 });
  assert.equal(totalLine({ requiresPayment: false, totalCents: null }), null);
  assert.match(totalLine({ requiresPayment: true, totalCents: 4999 }), /^\$49\.99 will be charged to your saved card at the moment of sending\.$/);
  assert.equal(money(1250), "$12.50");
});

test("blocker and not-ready wording, with a generic fallback and a unique idempotency key", () => {
  assert.match(blockerText("needs_default_photo"), /profile photo/);
  assert.match(blockerText("needs_authorized_voice"), /voice/);
  assert.match(blockerText("corporate_campaign_execution_disabled"), /isn’t switched on/);
  assert.match(blockerText("something_new"), /can’t be sent yet/);
  assert.equal(notReadyText({ reason: "missing_recipient_email" }), "no email address");
  const a = newIdempotencyKey(); const b = newIdempotencyKey();
  assert.notEqual(a, b);
  assert.match(a, /^onetime-[A-Za-z0-9._:-]{8,}$/);
});
