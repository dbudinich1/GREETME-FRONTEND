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
const deps = (api, extra = {}) => ({ api, buildPayload: (it) => ({ contactId: it.contactId, recipientName: it.name, recipientEmail: it.email, occasionType: "Birthday" }), confirmCardPayment: async () => ({ paymentIntent: { status: "succeeded" } }), ...extra });

test("groups are 2 to 10 people; 11 is refused; a person can be in a group once", () => {
  assert.equal(G.GROUP_MAX, 10);
  assert.throws(() => G.createGroupRun({ occasion: "Birthday", recipients: people(11) }), (e) => e.code === "GROUP_SIZE");
  assert.throws(() => G.createGroupRun({ occasion: "Birthday", recipients: people(1) }), (e) => e.code === "GROUP_SIZE");
  const dup = [...people(2), people(1)[0]];
  assert.throws(() => G.createGroupRun({ occasion: "Birthday", recipients: dup }), (e) => e.code === "GROUP_DUPLICATE");
  assert.equal(G.createGroupRun({ occasion: "Birthday", recipients: people(10) }).items.length, 10);
});

test("each recipient gets its own stable send and gift keys", () => {
  const run = G.createGroupRun({ occasion: "Birthday", recipients: people(3) });
  const keys = run.items.flatMap((i) => [i.sendRequestId, i.giftRequestId]);
  assert.equal(new Set(keys).size, 6);
});

test("gift default for everyone, individual override per person; only supported gifts (none / QR Cash at the composer's amounts)", () => {
  const run = G.createGroupRun({ occasion: "Birthday", recipients: people(3), defaultGift: { type: "qrcash", amount: 25 },
    overrides: { c2: { type: "none" }, c3: { type: "qrcash", amount: 50 } } });
  assert.deepEqual(run.items.map((i) => i.gift), [{ type: "qrcash", amount: 25 }, { type: "none" }, { type: "qrcash", amount: 50 }]);
  assert.deepEqual(G.groupGift({ type: "merch" }), { type: "none" }, "an unsupported group gift is never attached");
  assert.deepEqual(G.groupGift({ type: "qrcash", amount: 7 }), { type: "qrcash", amount: 25 }, "only the composer's amounts");
});

test("costs: per recipient and total, with the backend's fee arithmetic ($1.99 + 3%)", () => {
  const run = G.createGroupRun({ occasion: "Birthday", recipients: people(3), defaultGift: { type: "qrcash", amount: 25 }, overrides: { c2: { type: "none" } } });
  const c = G.groupCosts(run.items);
  assert.deepEqual(c.rows[0], { contactId: "c1", giftCents: 2500, feeCents: 274, totalCents: 2774 });
  assert.deepEqual(c.rows[1], { contactId: "c2", giftCents: 0, feeCents: 0, totalCents: 0 });
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
  const run = G.createGroupRun({ occasion: "Birthday", recipients: people(3), defaultGift: { type: "qrcash", amount: 25 }, overrides: { c2: { type: "none" } } });
  await G.runGroup(run, deps(api));
  assert.deepEqual(G.runSummary(run), { total: 3, sent: 3, failed: 0, pending: 0, done: true });
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
  const run = G.createGroupRun({ occasion: "Birthday", recipients: people(3) });
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
  const run = G.createGroupRun({ occasion: "Birthday", recipients: people(2), defaultGift: { type: "qrcash", amount: 25 } });
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
    const run = G.createGroupRun({ occasion: "Birthday", recipients: people(4), defaultGift: where === "charge" ? { type: "qrcash", amount: 25 } : undefined });
    await G.runGroup(run, deps(api));
    assert.deepEqual(run.items.map((i) => i.status), ["sent", "failed", "pending", "pending"], label);
    assert.ok(run.stopped, `${label}: the run says why it stopped`);
    assert.equal(calls.send.some((p) => p.contactId === "c3"), false, `${label}: nothing after the refusal was attempted`);
  }
});

test("3-D Secure: the same card confirmation then the existing /finalize; a declined confirmation fails that person only", async () => {
  const { api, calls } = fakeApi({ requiresAction: new Set(["p1@example.com", "p2@example.com"]) });
  let n = 0;
  const run = G.createGroupRun({ occasion: "Birthday", recipients: people(3), defaultGift: { type: "qrcash", amount: 50 } });
  await G.runGroup(run, deps(api, { confirmCardPayment: async () => (++n === 2 ? { error: { message: "declined" } } : { paymentIntent: { status: "succeeded" } }) }));
  assert.deepEqual(run.items.map((i) => i.status), ["sent", "failed", "sent"]);
  assert.equal(calls.finalize.length, 1);
  assert.equal(calls.finalize[0].giftAmountCents, 5000);
  assert.equal(run.stopped, null, "a declined card is that person's, not the run's");
});

test("resume: a saved run picks up where it stopped; already-sent recipients are not sent again", async () => {
  const store = new Map(); const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const { api, calls } = fakeApi({ sendFail: { c2: () => ({ throw: { status: 429, code: "RATE_LIMIT_GREETING" } }) } });
  const run = G.createGroupRun({ occasion: "Birthday", recipients: people(3) });
  await G.runGroup(run, deps(api, { onChange: (r) => G.saveRun(storage, r) }));
  const resumed = G.loadRun(storage);
  assert.equal(resumed.runId, run.runId);
  const { api: api2, calls: calls2 } = fakeApi();
  await G.runGroup(resumed, deps(api2));
  assert.deepEqual(resumed.items.map((i) => i.status), ["sent", "sent", "sent"]);
  assert.equal(calls2.send.some((p) => p.contactId === "c1"), false, "the already-sent recipient was skipped");
  assert.equal(calls.send.length + calls2.send.length, 4);
  G.clearRun(storage); assert.equal(G.loadRun(storage), null);
});

test("a missing recipient fails on its own; the controller refuses a run over 10", async () => {
  const { api } = fakeApi();
  const run = G.createGroupRun({ occasion: "Birthday", recipients: people(2) });
  await G.runGroup(run, deps(api, { buildPayload: (it) => (it.contactId === "c1" ? null : { contactId: it.contactId }) }));
  assert.deepEqual(run.items.map((i) => i.status), ["failed", "sent"]);
  const big = { items: people(11).map((p) => ({ ...p, status: "pending", gift: { type: "none" } })) };
  await assert.rejects(() => G.runGroup(big, deps(api)));
});
