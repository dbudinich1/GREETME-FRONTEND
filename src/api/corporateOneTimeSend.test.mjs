// SURFACE 8 - transport tests for the one-time send client. Run (Node 20): node --test src/api/corporateOneTimeSend.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createOneTimeSendClient } from "./corporateOneTimeSend.js";

const reply = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const make = (impl) => { const calls = []; const c = createOneTimeSendClient({ fetchImpl: async (u, o) => { calls.push([u, o]); return impl(u, o); }, getToken: () => "tok", apiBase: "" }); return { c, calls }; };
const PV = { recipients: { count: 2, list: [], blocked: [] }, plan: { required: 2, available: 5, shortfall: 0 }, gift: { type: "none" }, canSend: true, blockers: [] };

test("preview posts to the preview route with the bearer token and returns the server's review", async () => {
  const { c, calls } = make(reply(200, PV));
  const r = await c.preview("org 1", { recipients: { category: "client" } });
  assert.equal(r.ok, true);
  assert.equal(r.preview.plan.required, 2);
  assert.equal(calls[0][0], "/api/corporate-campaigns/organizations/org%201/one-time-sends/preview");
  assert.equal(calls[0][1].method, "POST");
  assert.equal(calls[0][1].headers.Authorization, "Bearer tok");
});

test("preview: malformed body, dormant, unauthorized and missing endpoint are reported, never thrown", async () => {
  assert.equal((await make(reply(200, { nope: 1 })).c.preview("o", {})).malformed, true);
  assert.equal((await make(reply(503, { disabled: true })).c.preview("o", {})).dormant, true);
  assert.equal((await make(reply(403, {})).c.preview("o", {})).unauthorized, true);
  assert.equal((await make(reply(404, {})).c.preview("o", {})).notAvailable, true);
  assert.equal((await make(async () => { throw new Error("offline"); }).c.preview("o", {})).networkError, true);
});

test("send: success keeps only the allowlisted result fields and flags a replay", async () => {
  const { c } = make(reply(200, { sendId: "s1", stage: "scheduled", recipientCount: 3, chargedTotalCents: 500, featuredSpreadIncluded: false, alreadySubmitted: true, secret: "x" }));
  const r = await c.send("o", { idempotencyKey: "k" });
  assert.equal(r.ok, true);
  assert.equal(r.replay, true);
  assert.deepEqual(r.result, { sendId: "s1", stage: "scheduled", recipientCount: 3, chargedTotalCents: 500, featuredSpreadIncluded: false });
});

test("send: a plan shortfall keeps its code and numbers (the shared client would have dropped them)", async () => {
  const { c } = make(reply(409, { error: "plan_shortfall", message: "m", details: { required: 5, available: 3, shortfall: 2 } }));
  const r = await c.send("o", {});
  assert.equal(r.ok, false);
  assert.equal(r.error, "plan_shortfall");
  assert.deepEqual(r.details, { required: 5, available: 3, shortfall: 2 });
});

test("send: a request that never returned is INDETERMINATE (retry with the same key), not a failure", async () => {
  const r = await make(async () => { throw new Error("socket"); }).c.send("o", {});
  assert.equal(r.ok, false);
  assert.equal(r.indeterminate, true);
});

test("send: unsafe error codes are dropped, not shown", async () => {
  const r = await make(reply(400, { error: "<script>alert(1)</script>" })).c.send("o", {});
  assert.equal(r.error, "HTTP_400");
});

test("status (founder 2026-10-28): 'send_not_found' proves no send was recorded for this key; a missing route stays notAvailable; the payment field passes through", async () => {
  const c404 = createOneTimeSendClient({ fetchImpl: reply(404, { error: "send_not_found" }), getToken: () => "t", apiBase: "" });
  assert.deepEqual(await c404.status("org1", "campaign_ot_x"), { ok: true, status: 404, result: { notFound: true } });
  const cRoute = createOneTimeSendClient({ fetchImpl: reply(404, { error: "Not Found" }), getToken: () => "t", apiBase: "" });
  assert.equal((await cRoute.status("org1", "campaign_ot_x")).notAvailable, true);
  const cOk = createOneTimeSendClient({ fetchImpl: reply(200, { stage: "created", payment: { state: "confirmed", resolved: true } }), getToken: () => "t", apiBase: "" });
  assert.deepEqual((await cOk.status("org1", "campaign_ot_x")).result.payment, { state: "confirmed", resolved: true });
});
