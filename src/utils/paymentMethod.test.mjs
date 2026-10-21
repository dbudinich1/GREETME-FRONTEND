// src/utils/paymentMethod.test.mjs — Run (Node 20.x): node --test src/utils/paymentMethod.test.mjs
// The payment-method page's pure rules: the card line, the status-failure copy, the replace flow over the EXISTING W07
// card endpoints, and the sign-in return (honoured only for this page).
import { test } from "node:test";
import assert from "node:assert/strict";
import { brandLabel, savedCardLine, statusErrorCopy, replaceSavedCard, loginReturnPath, PAYMENT_METHOD_PATH } from "./paymentMethod.js";

test("card line: brand, last 4, expiry; none -> null", () => {
  assert.equal(savedCardLine({ present: true, brand: "visa", last4: "4242", expMonth: 3, expYear: 2031 }), "Visa ending 4242 · expires 03/2031");
  assert.equal(savedCardLine({ present: true, brand: "amex", last4: "0005" }), "American Express ending 0005");
  assert.equal(savedCardLine({ present: true }), "Card");
  assert.equal(savedCardLine({ present: false, last4: "4242" }), null);
  assert.equal(savedCardLine(null), null);
  assert.equal(brandLabel("cartes_bancaires"), "Cartes_bancaires");
});

test("status failure copy: switched off vs anything else", () => {
  assert.equal(statusErrorCopy({ code: "SCHEDULED_QRCASH_DISABLED" }), "Saved cards for Auto-Gift aren’t available yet.");
  assert.equal(statusErrorCopy({ status: 502 }), "We couldn’t load your saved card just now. Please try again.");
});

test("replace: setup -> confirm -> complete, in that order, with the server's consent wording version", async () => {
  const calls = [];
  const api = {
    setupQrCashCard: async () => { calls.push("setup"); return { clientSecret: "cs", setupIntentId: "seti", consentWordingVersion: "v-card" }; },
    completeQrCashCard: async (b) => { calls.push(["complete", b]); return { ok: true, card: { present: true, last4: "4444" } }; },
  };
  const res = await replaceSavedCard({ api, confirm: async (s) => { calls.push(["confirm", s]); return { setupIntent: { id: "seti", status: "succeeded" } }; } });
  assert.deepEqual(res, { ok: true, card: { present: true, last4: "4444" } });
  assert.deepEqual(calls, ["setup", ["confirm", "cs"], ["complete", { setupIntentId: "seti", consentAccepted: true, consentWordingVersion: "v-card" }]]);
});

test("replace failures never call complete after an unconfirmed setup", async () => {
  let completed = 0;
  const api = { setupQrCashCard: async () => ({ clientSecret: "cs", setupIntentId: "seti" }), completeQrCashCard: async () => { completed += 1; return {}; } };
  assert.deepEqual(await replaceSavedCard({ api, confirm: async () => ({ error: { message: "no" } }) }), { ok: false, error: "setup-unconfirmed" });
  assert.deepEqual(await replaceSavedCard({ api, confirm: async () => { throw new Error("x"); } }), { ok: false, error: "setup-unconfirmed" });
  assert.equal(completed, 0);
  assert.deepEqual(await replaceSavedCard({ api: { setupQrCashCard: async () => { throw new Error("503"); } }, confirm: async () => null }), { ok: false, error: "unavailable" });
  assert.deepEqual(await replaceSavedCard({ api: { setupQrCashCard: async () => ({}) }, confirm: async () => null }), { ok: false, error: "unavailable" });
  assert.deepEqual(await replaceSavedCard({ api: { ...api, completeQrCashCard: async () => { throw new Error("x"); } }, confirm: async () => ({ setupIntent: { id: "s", status: "succeeded" } }) }), { ok: false, error: "unavailable" });
});

test("sign-in return: only the payment-method page", () => {
  assert.equal(PAYMENT_METHOD_PATH, "/dashboard/payment-method");
  assert.equal(loginReturnPath("/dashboard/payment-method"), "/dashboard/payment-method");
  assert.equal(loginReturnPath("/dashboard/payment-method?from=email"), "/dashboard/payment-method?from=email");
  for (const p of [undefined, null, "", "/dashboard", "/dashboard/contacts", "https://evil.example/dashboard/payment-method", "/dashboard/payment-methodx", "//evil"]) assert.equal(loginReturnPath(p), null, String(p));
});

test("a save the server did not confirm never reads as saved (network drop / 401 / 404 answer {ok:false}; no card)", async () => {
  const confirm = async () => ({ setupIntent: { id: "seti", status: "succeeded" } });
  const mk = (complete) => ({ setupQrCashCard: async () => ({ ok: true, clientSecret: "cs", setupIntentId: "seti", consentWordingVersion: "w07-card-v1" }), completeQrCashCard: complete });
  for (const answer of [{ ok: false }, { ok: false, code: "NETWORK" }, { ok: true }, null, undefined]) {
    assert.deepEqual(await replaceSavedCard({ api: mk(async () => answer), confirm }), { ok: false, error: "unavailable" }, JSON.stringify(answer));
  }
  const card = { present: true, last4: "4242" };
  assert.deepEqual(await replaceSavedCard({ api: mk(async () => ({ ok: true, card })), confirm }), { ok: true, card });
});
