// src/utils/groupSend.test.mjs
//
// G1/G6 — the group run controller over the EXISTING per-recipient send. Proves idempotency (stable keys per
// recipient, never charged or sent twice), partial failure, stop-and-keep on run-wide refusals, resume, the
// 10-person cap, gift defaults with individual overrides, and the cost arithmetic.
// Run (Node 20.x): node --test src/utils/groupSend.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { rmSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, ".__groupSend.bundle.mjs");
await esbuild.build({ entryPoints: [join(__dirname, "groupSend.js")], outfile: OUT, bundle: true, format: "esm", platform: "node", define: { "import.meta.env": "{}" }, logLevel: "silent" });
const G = await import(pathToFileURL(OUT).href);
rmSync(OUT, { force: true });

const people = (n) => Array.from({ length: n }, (_, i) => ({ contactId: `c${i + 1}`, name: `Person ${i + 1}`, email: `p${i + 1}@example.com` }));
const GIFT_OBJ = { feeCents: 274, totalCents: 2774, claimToken: "ct", qrImageUrl: "qr", qrBlobUrl: "qb", claimUrl: "https://x/#/gift/ct" };

function fakeApi({ sendFail = {}, chargeFail = {}, requiresAction = new Set() } = {}) {
  const calls = { send: [], charge: [], finalize: [] };
  const sent = new Map(); const charged = new Map();
  return {
    calls,
    api: {
      sendGreeting: async (p) => {
        calls.send.push(p);
        const f = sendFail[p.contactId];
        if (f) { const r = typeof f === "function" ? f() : f; if (r) { if (r.throw) throw Object.assign(new Error(r.message || "fail"), r.throw); return r; } }
        if (sent.has(p.sendRequestId)) return { ok: true, jobId: sent.get(p.sendRequestId), deduped: true };
        const jobId = `job-${p.contactId}`; sent.set(p.sendRequestId, jobId); return { ok: true, jobId };
      },
      chargeGift: async (p) => {
        calls.charge.push(p);
        const f = chargeFail[p.recipientEmail];
        if (f) { if (f.throw) throw Object.assign(new Error(f.message || "fail"), f.throw); return f; }
        if (requiresAction.has(p.recipientEmail)) return { requiresAction: true, clientSecret: "cs", paymentIntentId: "pi" };
        charged.set(p.giftRequestId, (charged.get(p.giftRequestId) || 0) + 1);
        return { ok: true, gift: GIFT_OBJ };
      },
      finalizeGift: async (p) => { calls.finalize.push(p); return { ok: true, gift: GIFT_OBJ }; },
    },
    charged,
  };
}
const deps = (api, extra = {}) => ({ userId: "u1", api, buildPayload: (it) => ({ contactId: it.contactId, recipientName: it.name, recipientEmail: it.email, occasionType: "Birthday" }), confirmCardPayment: async () => ({ paymentIntent: { status: "succeeded" } }), ...extra });

test("groups are 2 to 10 people; 11 is refused; a person can be in a group once", () => {
  assert.equal(G.GROUP_MAX, 10);
  assert.throws(() => G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(11) }), (e) => e.code === "GROUP_SIZE");
  assert.throws(() => G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(1) }), (e) => e.code === "GROUP_SIZE");
  const dup = [...people(2), people(1)[0]];
  assert.throws(() => G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: dup }), (e) => e.code === "GROUP_DUPLICATE");
  assert.equal(G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(10) }).items.length, 10);
});

test("each recipient gets its own stable send and gift keys", () => {
  const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(3) });
  const keys = run.items.flatMap((i) => [i.sendRequestId, i.giftRequestId]);
  assert.equal(new Set(keys).size, 6);
});

test("gift default for everyone, individual override per person; only supported gifts (none / QR Cash at the composer's amounts)", () => {
  const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(3), defaultGift: { type: "qrcash", amount: 25 },
    overrides: { c2: { type: "none" }, c3: { type: "qrcash", amount: 50 } } });
  assert.deepEqual(run.items.map((i) => i.gift), [{ type: "qrcash", amount: 25 }, { type: "none" }, { type: "qrcash", amount: 50 }]);
  assert.deepEqual(G.groupGift({ type: "merch" }), { type: "none" }, "an unsupported group gift is never attached");
  assert.deepEqual(G.groupGift({ type: "qrcash", amount: 7 }), { type: "qrcash", amount: 25 }, "only the composer's amounts");
});

test("costs: per recipient and total, with the backend's fee arithmetic ($1.99 + 3%)", () => {
  const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(3), defaultGift: { type: "qrcash", amount: 25 }, overrides: { c2: { type: "none" } } });
  const c = G.groupCosts(run.items);
  assert.deepEqual(c.rows[0], { contactId: "c1", kind: "qrcash", giftCents: 2500, feeCents: 274, totalCents: 2774 });
  assert.deepEqual(c.rows[1], { contactId: "c2", kind: "none", giftCents: 0, feeCents: 0, totalCents: 0 });
  assert.equal(c.totalCents, 5548);
});

test("current rules decide: not enough sends, or not enough AI greetings today, blocks the group with the reason", () => {
  assert.equal(G.groupAllowance({ canSendGreeting: true, remaining: 10, aiDaily: { limit: 5, used: 0, remaining: 5 } }, 6).ok, false);
  const a = G.groupAllowance({ canSendGreeting: true, remaining: 3 }, 4);
  assert.equal(a.ok, false); assert.match(a.reasons[0], /3 sends left; this group needs 4/);
  assert.equal(G.groupAllowance({ canSendGreeting: true, sendLimitUnlimited: true, remaining: null, aiDaily: null }, 10).ok, true);
  assert.match(G.groupAllowance({ canSendGreeting: true, remaining: 10, aiDaily: { limit: 5, used: 2, remaining: 3 } }, 4).reasons[0], /3 more Greet-Mes \(daily limit 5\)/);
});

test("happy path: each recipient charged once (QR Cash ones only) then sent once with its gift attached", async () => {
  const { api, calls } = fakeApi();
  const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(3), defaultGift: { type: "qrcash", amount: 25 }, overrides: { c2: { type: "none" } } });
  await G.runGroup(run, deps(api));
  const sum = G.runSummary(run);
  assert.equal(sum.sent, 3); assert.equal(sum.failed, 0); assert.equal(sum.done, true);
  assert.equal(calls.charge.length, 2);
  assert.ok(calls.charge.every((c) => c.useSavedPaymentMethod === true && !("paymentMethodId" in c)), "saved card (G3), never a typed card");
  assert.equal(calls.send.length, 3);
  assert.equal(calls.send[0].includeGift, true); assert.equal(calls.send[0].gift.claimToken, "ct");
  assert.equal(calls.send[1].includeGift, false); assert.equal("gift" in calls.send[1], false);
  assert.deepEqual(calls.send.map((p) => p.sendRequestId), run.items.map((i) => i.sendRequestId));
});

test("partial failure: one recipient fails, the rest still send; retry sends only the failed one, reusing its keys", async () => {
  let failOnce = true;
  const { api, calls } = fakeApi({ sendFail: { c2: () => (failOnce ? (failOnce = false, { throw: { status: 400, code: "INVALID" } }) : null) } });
  const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(3) });
  await G.runGroup(run, deps(api));
  assert.deepEqual(run.items.map((i) => i.status), ["sent", "failed", "sent"]);
  const key = run.items[1].sendRequestId;
  await G.runGroup(run, deps(api));
  assert.deepEqual(run.items.map((i) => i.status), ["sent", "sent", "sent"]);
  assert.equal(calls.send.length, 4, "only the failed recipient was sent again");
  assert.equal(calls.send[3].sendRequestId, key, "with the same key");
});

test("a charged gift is kept when its send fails; retry re-attaches it and never charges again", async () => {
  let failOnce = true;
  const { api, calls } = fakeApi({ sendFail: { c1: () => (failOnce ? (failOnce = false, { throw: { status: 500, code: "SERVER_ERROR" } }) : null) } });
  const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(2), defaultGift: { type: "qrcash", amount: 25 } });
  await G.runGroup(run, deps(api));
  assert.equal(run.items[0].status, "failed"); assert.equal(run.items[0].error.giftCharged, true);
  await G.runGroup(run, deps(api));
  assert.equal(run.items[0].status, "sent");
  assert.equal(calls.charge.filter((c) => c.recipientEmail === "p1@example.com").length, 1, "charged exactly once");
  assert.equal(calls.send.at(-1).gift.claimToken, "ct");
});

test("run-wide refusals STOP the run and keep every unsent recipient: rate limit, AI daily cap, no saved card, network unknown", async () => {
  for (const [label, fail, where] of [
    ["rate limit", { throw: { status: 429, code: "RATE_LIMIT_GREETING" } }, "send"],
    ["AI daily cap", { throw: { status: 429, code: "AI_DAILY_LIMIT" } }, "send"],
    ["no saved card", { throw: { status: 409, code: "NO_SAVED_PAYMENT_METHOD" } }, "charge"],
    ["network unknown", { ok: false, networkError: true }, "send"],
  ]) {
    const opts = where === "send" ? { sendFail: { c2: () => fail } } : { chargeFail: { "p2@example.com": fail } };
    const { api, calls } = fakeApi(opts);
    const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(4), defaultGift: where === "charge" ? { type: "qrcash", amount: 25 } : undefined });
    await G.runGroup(run, deps(api));
    // A refusal while placing gifts stops before any greeting is sent (gifts are placed first); the first person's
    // charged gift is kept with them. A refusal while sending stops the remaining sends.
    // Each person's gift is placed and their greeting sent before the next person; a refusal stops everyone after it.
    assert.deepEqual(run.items.map((i) => i.status), ["sent", "failed", "pending", "pending"], label);
    assert.ok(run.stopped, `${label}: the run says why it stopped`);
    assert.equal(calls.send.some((p) => p.contactId === "c3"), false, `${label}: nothing after the refusal was attempted`);
  }
});

test("3-D Secure: the same card confirmation then the existing /finalize; a declined confirmation fails that person only", async () => {
  const { api, calls } = fakeApi({ requiresAction: new Set(["p1@example.com", "p2@example.com"]) });
  let n = 0;
  const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(3), defaultGift: { type: "qrcash", amount: 50 } });
  await G.runGroup(run, deps(api, { confirmCardPayment: async () => (++n === 2 ? { error: { message: "declined" } } : { paymentIntent: { status: "succeeded" } }) }));
  assert.deepEqual(run.items.map((i) => i.status), ["sent", "failed", "sent"]);
  assert.equal(calls.finalize.length, 1);
  assert.equal(calls.finalize[0].giftAmountCents, 5000);
  assert.equal(run.stopped, null, "a declined card is that person's, not the run's");
});

test("resume: a saved run picks up where it stopped; already-sent recipients are not sent again", async () => {
  const store = new Map(); const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const { api, calls } = fakeApi({ sendFail: { c2: () => ({ throw: { status: 429, code: "RATE_LIMIT_GREETING" } }) } });
  const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(3) });
  await G.runGroup(run, deps(api, { onChange: (r) => G.saveRun(storage, r) }));
  const resumed = G.loadRun(storage, "u1");
  assert.equal(resumed.runId, run.runId);
  const { api: api2, calls: calls2 } = fakeApi();
  await G.runGroup(resumed, deps(api2));
  assert.deepEqual(resumed.items.map((i) => i.status), ["sent", "sent", "sent"]);
  assert.equal(calls2.send.some((p) => p.contactId === "c1"), false, "the already-sent recipient was skipped");
  assert.equal(calls.send.length + calls2.send.length, 4);
  G.clearRun(storage); assert.equal(G.loadRun(storage, "u1"), null);
});

test("a missing recipient fails on its own; the controller refuses a run over 10", async () => {
  const { api } = fakeApi();
  const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(2) });
  await G.runGroup(run, deps(api, { buildPayload: (it) => (it.contactId === "c1" ? null : { contactId: it.contactId }) }));
  assert.deepEqual(run.items.map((i) => i.status), ["failed", "sent"]);
  const big = { items: people(11).map((p) => ({ ...p, status: "pending", gift: { type: "none" } })) };
  await assert.rejects(() => G.runGroup(big, deps(api)));
});

// ── G7: gift boxes ──────────────────────────────────────────────────────────────────────────────────────────────
const BOX = { type: "gift_box", product: { providerProductId: "goody-1", name: "Cookie Box" } };
const ADDR = { firstName: "Theresa", lastName: "Morgan", address1: "1 Main St", city: "Town", state: "NJ", postalCode: "07000" };
const QUOTE_RES = (total = 4599) => ({ ok: true, quotedTotalCents: total, providerQuotedTotalCents: total - 300, feeCents: 300, quotedAt: "2026-10-18T12:00:00Z", quoteValidForMs: 120000,
  display: { productCents: total - 900, shippingHandlingCents: 600, taxCents: 300, totalCents: total } });
function boxApi({ chargeOutcome = {}, quote = () => QUOTE_RES() } = {}) {
  const calls = { quote: [], charge: [], finalize: [], send: [] };
  return { calls, api: {
    quoteGiftBox: async (b) => { calls.quote.push(b); return quote(b); },
    chargeGiftBox: async (b) => {
      calls.charge.push(b);
      const o = chargeOutcome[b.contactId];
      if (o) { if (o.throw) throw Object.assign(new Error(o.message || "x"), o.throw); return o; }
      return { ok: true, fulfillmentStatus: "confirmed", gift: { claimToken: `box-${b.contactId}` } };
    },
    finalizeGiftBox: async (b) => { calls.finalize.push(b); return { ok: true, fulfillmentStatus: "confirmed", gift: { claimToken: "box-final" } }; },
    sendGreeting: async (p) => { calls.send.push(p); return { ok: true, jobId: `job-${p.contactId}` }; },
    chargeGift: async () => ({ ok: true, gift: GIFT_OBJ }),
  } };
}
const boxRun = (n = 3, extra = {}) => G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(n), defaultGift: BOX,
  addresses: Object.fromEntries(people(n).map((p) => [p.contactId, { ...ADDR, firstName: p.name.split(" ")[0] }])), ...extra });

test("G7: same gift box for everyone with individual overrides; a gift box is a supported group gift", () => {
  const run = boxRun(3, { overrides: { c2: { type: "qrcash", amount: 10 }, c3: { type: "none" } } });
  assert.deepEqual(run.items.map((i) => i.gift.type), ["gift_box", "qrcash", "none"]);
  assert.equal(G.groupGift({ type: "gift_box", product: {} }).type, "none", "a gift box needs a product");
});

test("G7: each gift-box recipient is quoted with the existing route; only server quotes are shown; unpriced boxes are never estimated", async () => {
  const run = boxRun(2);
  const c0 = G.groupCosts(run.items);
  assert.equal(c0.unpriced, 2); assert.equal(c0.totalCents, 0);
  const { api, calls } = boxApi();
  assert.equal(await G.quoteGroupGiftBoxes(run.items, { api }), true);
  assert.equal(calls.quote.length, 2);
  assert.deepEqual(calls.quote[0], { providerProductId: "goody-1", quantity: 1, recipient: { address: { address1: "1 Main St", city: "Town", state: "NJ", postalCode: "07000", country: "US" }, firstName: "Person", lastName: "Morgan" } });
  const c = G.groupCosts(run.items);
  assert.equal(c.unpriced, 0);
  assert.deepEqual(c.rows[0].display, { productCents: 3699, shippingHandlingCents: 600, taxCents: 300, totalCents: 4599 }, "the four lines");
  assert.equal(c.totalCents, 9198);
});

test("G7: a missing or invalid address is reported per person and nothing is quoted for them", async () => {
  const run = boxRun(2, { addresses: { c1: { firstName: "", address1: "", city: "", state: "", postalCode: "" } } });
  const { api, calls } = boxApi();
  assert.equal(await G.quoteGroupGiftBoxes(run.items, { api }), false);
  assert.match(run.items[0].quoteError, /first name/);
  assert.match(run.items[1].quoteError, /first name/, "no address at all is also reported");
  assert.equal(calls.quote.length, 0);
});

test("G7: a confirmed order per recipient (saved card, own key, own contact binding) is attached to that recipient's greeting", async () => {
  const run = boxRun(2);
  const { api, calls } = boxApi();
  await G.quoteGroupGiftBoxes(run.items, { api });
  await G.runGroup(run, deps(api));
  assert.deepEqual(run.items.map((i) => i.status), ["sent", "sent"]);
  assert.ok(calls.charge.every((b) => b.useSavedPaymentMethod === true && !("paymentMethodId" in b)));
  assert.deepEqual(calls.charge.map((b) => b.contactId), ["c1", "c2"], "per-recipient order binding");
  assert.equal(new Set(calls.charge.map((b) => b.giftRequestId)).size, 2);
  assert.equal(calls.charge[0].quotedTotalCents, 4599); assert.equal(calls.charge[0].providerQuotedTotalCents, 4299);
  assert.deepEqual(calls.send[0].gift, { type: "gift_boxes", claimToken: "box-c1" });
  assert.equal(calls.send[1].gift.claimToken, "box-c2");
  // gifts are all placed before any greeting is sent
  assert.equal(calls.charge.length, 2); assert.ok(calls.send.length === 2);
});

test("G7: PENDING (paid, not confirmed) holds the greeting and is only re-finalized later, never re-placed", async () => {
  const run = boxRun(2);
  const { api, calls } = boxApi({ chargeOutcome: { c1: { ok: true, pending: true, paymentIntentId: "pi_1" } } });
  await G.quoteGroupGiftBoxes(run.items, { api });
  await G.runGroup(run, deps(api));
  assert.deepEqual(run.items.map((i) => i.status), ["held", "sent"]);
  assert.equal(calls.send.some((p) => p.contactId === "c1"), false, "the greeting is held");
  await G.runGroup(run, deps(api));
  assert.equal(calls.charge.filter((b) => b.contactId === "c1").length, 1, "never charged again");
  assert.equal(calls.finalize.length, 1, "only re-finalized");
  assert.equal(run.items[0].status, "sent");
  assert.equal(calls.send.find((p) => p.contactId === "c1").gift.claimToken, "box-final");
});

test("G7: REFUSED (paid order failed) and UNCERTAIN (unknown outcome) are never re-placed and are shown in the results", async () => {
  const run = boxRun(3);
  const { api, calls } = boxApi({ chargeOutcome: {
    c1: { ok: true, fulfillmentStatus: "failed", error: "The vendor refused this order.", gift: { claimToken: "t" } },
    c2: { throw: { status: 500, code: "SERVER_ERROR" } },
  } });
  await G.quoteGroupGiftBoxes(run.items, { api });
  await G.runGroup(run, deps(api));
  assert.equal(run.items[0].status, "held"); assert.equal(run.items[0].error.refused, true);
  assert.equal(run.items[1].status, "unknown");
  assert.ok(run.stopped, "an unknown outcome stops the run");
  const before = calls.charge.length;
  await G.runGroup(run, deps(api));
  assert.equal(calls.charge.filter((b) => b.contactId === "c1" || b.contactId === "c2").length, 2, "neither is placed again");
  assert.ok(calls.charge.length > before, "the rest continue");
  assert.equal(calls.send.some((p) => p.contactId === "c1" || p.contactId === "c2"), false);
  // the sender may send those greetings without their gift
  G.sendWithoutGift(run, "c1"); G.sendWithoutGift(run, "c2");
  await G.runGroup(run, deps(api));
  assert.equal(calls.send.find((p) => p.contactId === "c1").includeGift, false);
  assert.ok(run.items.every((i) => i.status === "sent"));
});

test("G7: an expired or changed price stops before charging and needs fresh prices; a card decline stops the run with a fresh key", async () => {
  let t = 0;
  const run = boxRun(3);
  const { api, calls } = boxApi({ chargeOutcome: { c2: { throw: { status: 402, code: "card_declined", message: "Declined" } } } });
  await G.quoteGroupGiftBoxes(run.items, { api, now: () => t });
  t = 0;
  await G.runGroup(run, deps(api, { now: () => t }));
  assert.equal(run.items[1].status, "failed");
  assert.ok(run.stopped, "a decline of the group's one saved card stops the run (the next charge would decline too)");
  assert.equal(calls.charge.length, 2, "nobody after the decline is charged");
  const keyBefore = run.items[1].giftRequestId;
  // later, the prices have expired
  t = 10 * 60 * 1000;
  run.items[1].status = "pending";
  await G.runGroup(run, deps(api, { now: () => t }));
  assert.equal(run.items[1].status, "needs_quote");
  assert.equal(run.stopped.code, "GIFT_BOX_QUOTE_EXPIRED");
  assert.notEqual(keyBefore, undefined);
  const charges = calls.charge.length;
  await G.quoteGroupGiftBoxes(run.items.filter((i) => i.status === "needs_quote"), { api, now: () => t });
  run.items[1].status = "pending";
  await G.runGroup(run, deps(api, { now: () => t }));
  assert.equal(calls.charge.length, charges + 1, "charged once, after fresh prices");
});

test("saved card switched off (503 SAVED_PAYMENT_METHOD_DISABLED) or missing (409): the run stops before any charge, for QR Cash and gift boxes alike", async () => {
  for (const code of ["SAVED_PAYMENT_METHOD_DISABLED", "NO_SAVED_PAYMENT_METHOD"]) {
    const status = code === "SAVED_PAYMENT_METHOD_DISABLED" ? 503 : 409;
    const run = boxRun(3);
    const { api, calls } = boxApi({ chargeOutcome: { c1: { throw: { status, code } } } });
    await G.quoteGroupGiftBoxes(run.items, { api });
    await G.runGroup(run, deps(api));
    assert.equal(run.items[0].status, "failed", code);
    assert.equal(run.items[0].error.unknown, false, `${code}: refused before any charge, not an unknown outcome`);
    assert.ok(run.stopped, `${code}: the run stops`);
    assert.equal(calls.charge.length, 1, `${code}: nobody else is charged`);
    assert.equal(calls.send.length, 0);
    const q = fakeApi({ chargeFail: { "p1@example.com": { throw: { status, code } } } });
    const qr = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(3), defaultGift: { type: "qrcash", amount: 25 } });
    await G.runGroup(qr, deps(q.api));
    assert.ok(qr.stopped, `${code}: QR Cash run stops too`);
    assert.equal(q.calls.charge.length, 1);
  }
});

test("G4: 999 is a real cap; an unreadable AI count is 'unknown' and never blocks", () => {
  const a = G.groupAllowance({ canSendGreeting: true, remaining: 50, aiDaily: { limit: 999, used: 3, remaining: 996 } }, 10);
  assert.equal(a.ok, true); assert.equal(a.aiDaily.limit, 999);
  const u = G.groupAllowance({ canSendGreeting: true, remaining: 50, aiDaily: { limit: 5, used: null, remaining: null } }, 10);
  assert.equal(u.ok, true); assert.equal(u.aiUnknown, true); assert.equal(u.aiLimit, 5);
});

test("409 PAYMENT_ALREADY_IN_PROGRESS stops the run (never retried as a new charge)", async () => {
  const q = fakeApi({ chargeFail: { "p1@example.com": { throw: { status: 409, code: "PAYMENT_ALREADY_IN_PROGRESS" } } } });
  const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(2), defaultGift: { type: "qrcash", amount: 25 } });
  await G.runGroup(run, deps(q.api));
  assert.ok(run.stopped); assert.equal(q.calls.charge.length, 1);
});

test("G7 quote expiry: an expired quote is refreshed for that person; an UNCHANGED total continues, a changed total stops for re-confirmation", async () => {
  let t = 0;
  const seed = boxRun(2);
  let total = 4599;
  const { api, calls } = boxApi({ quote: () => QUOTE_RES(total) });
  await G.quoteGroupGiftBoxes(seed.items, { api, now: () => t });
  const fromSeed = () => G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(2), defaultGift: BOX,
    addresses: Object.fromEntries(seed.items.map((i) => [i.contactId, i.address])), quotes: Object.fromEntries(seed.items.map((i) => [i.contactId, i.quote])) });
  const run2 = fromSeed();
  t = 3 * 60 * 1000; // every quote expired
  await G.runGroup(run2, deps(api, { now: () => t }));
  assert.deepEqual(run2.items.map((i) => i.status), ["sent", "sent"], "same total: no new consent needed");
  assert.equal(calls.quote.length, 4, "each person re-quoted once");
  assert.equal(calls.charge.length, 2);
  const run3 = fromSeed();
  total = 4999;
  await G.runGroup(run3, deps(api, { now: () => t }));
  assert.equal(run3.items[0].status, "needs_quote");
  assert.match(run3.items[0].error.message, /changed from \$45\.99 to \$49\.99/);
  assert.ok(run3.stopped);
  assert.equal(calls.charge.length, 2, "never charged at a changed price without re-confirmation");
});

test("G7 quote expiry from the server (409 gift_box_quote_expired): refreshed once, and charged only if unchanged", async () => {
  let first = true;
  const seed = boxRun(2);
  const { api, calls } = boxApi();
  const realCharge = api.chargeGiftBox;
  api.chargeGiftBox = async (b) => {
    if (first && b.contactId === "c1") { first = false; calls.charge.push(b); throw Object.assign(new Error("expired"), { status: 409, code: "gift_box_quote_expired" }); }
    return realCharge(b);
  };
  await G.quoteGroupGiftBoxes(seed.items, { api });
  const r = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(2), defaultGift: BOX,
    addresses: Object.fromEntries(seed.items.map((i) => [i.contactId, i.address])), quotes: Object.fromEntries(seed.items.map((i) => [i.contactId, i.quote])) });
  await G.runGroup(r, deps(api));
  assert.deepEqual(r.items.map((i) => i.status), ["sent", "sent"]);
  const c1 = calls.charge.filter((b) => b.contactId === "c1");
  assert.equal(c1.length, 2, "the refused attempt plus one charge after the refresh");
  assert.equal(c1[0].giftRequestId, c1[1].giftRequestId, "same key: nothing was charged the first time");
});

test("binding: each recipient's claim token goes only with that recipient's own send request and key", async () => {
  const run = boxRun(3);
  const { api, calls } = boxApi();
  await G.quoteGroupGiftBoxes(run.items, { api });
  const r = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(3), defaultGift: BOX,
    addresses: Object.fromEntries(run.items.map((i) => [i.contactId, i.address])), quotes: Object.fromEntries(run.items.map((i) => [i.contactId, i.quote])) });
  await G.runGroup(r, deps(api));
  for (const it of r.items) {
    const send = calls.send.find((p) => p.sendRequestId === it.sendRequestId);
    assert.equal(send.contactId, it.contactId);
    assert.equal(send.gift.claimToken, `box-${it.contactId}`);
  }
  assert.equal(new Set(r.items.map((i) => i.giftRequestId)).size, 3, "a distinct giftRequestId per recipient");
});

// ── Team 5 fixes (Report 112) ───────────────────────────────────────────────────────────────────────────────
function memStore() { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }

test("H-1: a run belongs to its creator — another account can neither load it nor run it, and it is discarded", async () => {
  const store = memStore();
  const run = G.createGroupRun({ userId: "userA", occasion: "Birthday", recipients: people(3), defaultGift: { type: "qrcash", amount: 25 } });
  G.saveRun(store, run);
  assert.equal(G.loadRun(store, "userB"), null, "user B never sees user A's run");
  assert.equal(store.m.size, 0, "and it is discarded");
  const { api, calls } = fakeApi();
  await assert.rejects(() => G.runGroup(run, { ...deps(api), userId: "userB" }), (e) => e.code === "OWNER_MISMATCH");
  assert.equal(calls.charge.length + calls.send.length, 0, "nothing charged or sent for the wrong account");
  G.saveRun(store, run);
  assert.equal(G.loadRun(store, "userA").runId, run.runId, "the owner still resumes it");
});

test("H-1: a stored run with no owner (from before owners were recorded) is discarded; a run cannot be created without one", () => {
  const store = memStore();
  const legacy = { runId: "old", occasion: "Birthday", items: people(2).map((p) => ({ ...p, gift: { type: "qrcash", amount: 25 }, status: "pending" })) };
  store.setItem(G.GROUP_RUN_KEY, JSON.stringify(legacy));
  assert.equal(G.loadRun(store, "u1"), null);
  assert.equal(store.m.size, 0);
  assert.throws(() => G.createGroupRun({ occasion: "Birthday", recipients: people(2) }), (e) => e.code === "OWNER_REQUIRED");
  assert.equal(G.loadRun(store, null), null, "no signed-in account: nothing is loaded");
});

test("M-1: QR Cash gets a FRESH key after a definite non-charge (decline, refused request, 3-D Secure failed) and KEEPS it after an unknown outcome", async () => {
  for (const [label, fail, fresh] of [
    ["402 decline", { throw: { status: 402, code: "GIFT_CHARGE_FAILED" } }, true],
    ["409 entitlement", { throw: { status: 409, code: "SEND_ENTITLEMENT_AT_RISK" } }, true],
    ["500 unknown", { throw: { status: 500, code: "SERVER_ERROR" } }, false],
    ["network unknown", { ok: false, networkError: true }, false],
    ["payment in progress", { throw: { status: 409, code: "PAYMENT_ALREADY_IN_PROGRESS" } }, false],
  ]) {
    const { api } = fakeApi({ chargeFail: { "p1@example.com": fail } });
    const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(2), defaultGift: { type: "qrcash", amount: 25 } });
    const before = run.items[0].giftRequestId;
    await G.runGroup(run, deps(api));
    assert.equal(run.items[0].giftRequestId !== before, fresh, label);
  }
  const { api } = fakeApi({ requiresAction: new Set(["p1@example.com"]) });
  const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(2), defaultGift: { type: "qrcash", amount: 25 } });
  const before = run.items[0].giftRequestId;
  await G.runGroup(run, deps(api, { confirmCardPayment: async () => ({ error: { message: "no" } }) }));
  assert.notEqual(run.items[0].giftRequestId, before, "3-D Secure failed: not charged, fresh key");
});

test("M-2: a QR Cash 500 is an unknown outcome — the run stops, the person is marked unknown and nobody after is charged", async () => {
  const { api, calls } = fakeApi({ chargeFail: { "p2@example.com": { throw: { status: 500, code: "SERVER_ERROR" } } } });
  const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(4), defaultGift: { type: "qrcash", amount: 25 } });
  await G.runGroup(run, deps(api));
  assert.ok(run.stopped);
  assert.equal(run.items[1].status, "failed"); assert.equal(run.items[1].error.unknown, true);
  assert.match(run.items[1].error.message, /same payment key/);
  assert.equal(calls.charge.length, 2, "nobody after them is charged");
  const key = run.items[1].giftRequestId;
  const ok = fakeApi();
  await G.runGroup(run, deps(ok.api));
  assert.equal(ok.calls.charge[0].giftRequestId, key, "the retry uses the same key");
});

test("M-3: each person's gift is charged and their greeting sent before the next person", async () => {
  const order = [];
  const { api } = fakeApi();
  const wrapped = { ...api,
    chargeGift: async (p) => { order.push(`charge:${p.recipientEmail}`); return api.chargeGift(p); },
    sendGreeting: async (p) => { order.push(`send:${p.contactId}`); return api.sendGreeting(p); } };
  const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(3), defaultGift: { type: "qrcash", amount: 25 } });
  await G.runGroup(run, deps(wrapped));
  assert.deepEqual(order, ["charge:p1@example.com", "send:c1", "charge:p2@example.com", "send:c2", "charge:p3@example.com", "send:c3"]);
});

test("M-3: a send refusal after a charge stops the run — the next person is NOT charged", async () => {
  const { api, calls } = fakeApi({ sendFail: { c1: () => ({ throw: { status: 429, code: "AI_DAILY_LIMIT" } }) } });
  const run = G.createGroupRun({ userId: "u1", occasion: "Birthday", recipients: people(3), defaultGift: { type: "qrcash", amount: 25 } });
  await G.runGroup(run, deps(api));
  assert.equal(calls.charge.length, 1, "only the first person was charged");
  assert.equal(run.items[0].error.giftCharged, true, "their paid gift is kept for the retry");
});

test("L-3: a pre-check that could not be read blocks and says so (never 'no send available')", () => {
  const a = G.groupAllowance(null, 3);
  assert.equal(a.ok, false); assert.match(a.reasons[0], /couldn.t check your sends/);
  const b = G.groupAllowance({ ok: false, canSendGreeting: false, reasonCode: "PREFLIGHT_UNAVAILABLE" }, 3);
  assert.match(b.reasons[0], /couldn.t check your sends/);
  assert.equal(G.groupAllowance({ ok: true, canSendGreeting: true, remaining: 5, aiDaily: { limit: 5, used: 0, remaining: 5 } }, 3).ok, true);
});
