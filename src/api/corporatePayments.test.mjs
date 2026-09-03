// src/api/corporatePayments.test.mjs — TEAM I (CONNECTION D).
//
// The client for the corporate saved-card routes. What is proven here is mostly about what does
// NOT happen: no card data is ever sent by this module, no client secret is ever returned by the
// summary path, and a malformed or hostile response body cannot reach the UI.
//
// Run (Node 20.x): node --test src/api/corporatePayments.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createCorporatePaymentsClient, readPaymentMethodSummary, summarizeSetupIntent, PAYMENT_ERRORS,
} from "./corporatePayments.js";

const ORG = "corp_org_a";

function fakeFetch(responses) {
  const calls = [];
  let i = 0;
  const impl = async (url, init) => {
    calls.push({ url, init });
    const r = responses[Math.min(i++, responses.length - 1)];
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      json: async () => {
        if (r.body === undefined) throw new Error("no body");
        return r.body;
      },
    };
  };
  impl.calls = calls;
  return impl;
}

const clientWith = (impl) => createCorporatePaymentsClient({ fetchImpl: impl, getToken: () => "tok", apiBase: "" });

// ── Addressing and auth ──────────────────────────────────────────────────────────────────────

test("D1 · every call is authenticated and addressed to the organization", async () => {
  const impl = fakeFetch([{ status: 200, body: { ok: true, paymentMethod: { ready: false } } }]);
  await clientWith(impl).getPaymentMethod(ORG);
  assert.equal(impl.calls[0].url, `/api/corporate-payments/${ORG}/payment-method`);
  assert.equal(impl.calls[0].init.headers.Authorization, "Bearer tok");
});

test("D2 · the organization id is URL-encoded, never interpolated raw", async () => {
  const impl = fakeFetch([{ status: 200, body: { ok: true, paymentMethod: { ready: false } } }]);
  await clientWith(impl).getPaymentMethod("a/b?c");
  assert.equal(impl.calls[0].url, "/api/corporate-payments/a%2Fb%3Fc/payment-method");
});

test("D3 · a 401 or 403 surfaces NO organization data", async () => {
  for (const status of [401, 403]) {
    const impl = fakeFetch([{ status, body: { secret: "should never be read" } }]);
    const res = await clientWith(impl).getPaymentMethod(ORG);
    assert.equal(res.unauthorized, true);
    assert.equal(res.paymentMethod, undefined);
    assert.equal(res.data, undefined);
  }
});

test("D4 · a 503 is reported as payments-unavailable, distinct from 'no card'", async () => {
  const impl = fakeFetch([{ status: 503, body: { ok: false, error: "payments_unconfigured" } }]);
  const res = await clientWith(impl).createSetupIntent(ORG);
  assert.equal(res.unavailable, true);
  assert.equal(res.error, PAYMENT_ERRORS.PAYMENTS_UNCONFIGURED);
});

test("D5 · a network failure is reported, never mistaken for a missing card", async () => {
  const impl = async () => { throw new Error("offline"); };
  const res = await createCorporatePaymentsClient({ fetchImpl: impl, getToken: () => null }).getPaymentMethod(ORG);
  assert.equal(res.networkError, true);
  assert.equal(res.ok, false);
});

// ── No card data, ever ───────────────────────────────────────────────────────────────────────

test("D6 · NO request this client makes can carry card data", async () => {
  const impl = fakeFetch([
    { status: 201, body: { ok: true, clientSecret: "seti_1_secret_xyz" } },
    { status: 200, body: { ok: true, paymentMethod: { ready: true, brand: "visa", last4: "4242" } } },
  ]);
  const c = clientWith(impl);
  await c.createSetupIntent(ORG);
  await c.completeSetupIntent(ORG, "seti_1");

  for (const call of impl.calls) {
    const body = call.init.body || "";
    assert.doesNotMatch(body, /\b[0-9]{13,19}\b/, "no PAN-shaped digit run may be sent");
    assert.doesNotMatch(body, /cvc|cvv|exp_month|exp_year|expiry/i, "no CVC or expiry field may be sent");
  }
  // The completion request carries the SetupIntent id and nothing else at all.
  assert.equal(impl.calls[1].init.body, JSON.stringify({ setupIntentId: "seti_1" }));
});

test("D7 · summarizeSetupIntent never carries the client secret", () => {
  const summary = summarizeSetupIntent({ ok: true, status: 201, data: { clientSecret: "seti_1_secret_xyz", replacing: true } });
  assert.equal(summary.hasClientSecret, true);
  assert.equal(summary.replacing, true);
  assert.doesNotMatch(JSON.stringify(summary), /secret_xyz/);
});

// ── The strict summary allowlist ─────────────────────────────────────────────────────────────

test("D8 · the summary reads brand and last four, and drops everything else", () => {
  const out = readPaymentMethodSummary({
    ready: true, brand: "visa", last4: "4242",
    authorizedAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z",
    // Anything the server should not be sending is dropped rather than forwarded.
    stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_1", _etag: "e1",
  });
  assert.deepEqual(out, {
    ready: true, status: "saved_card_ready", brand: "visa", last4: "4242",
    authorizedAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z",
  });
  assert.equal(out.stripeCustomerId, undefined);
  assert.equal(out.stripePaymentMethodId, undefined);
});

test("D9 · a malformed last four or brand is DROPPED, never displayed", () => {
  const out = readPaymentMethodSummary({ ready: true, brand: "<script>", last4: "4242424242424242" });
  assert.equal(out.ready, true);
  assert.equal(out.brand, undefined);
  assert.equal(out.last4, undefined);
});

test("D10 · readiness FAILS CLOSED — anything that is not ready:true is card_update_required", () => {
  for (const raw of [null, undefined, {}, { ready: "true" }, { ready: 1 }, [], "ready"]) {
    const out = readPaymentMethodSummary(raw);
    assert.equal(out.ready, false, JSON.stringify(raw));
    assert.equal(out.status, "card_update_required");
  }
});

// ── The four routes, and only those four ─────────────────────────────────────────────────────

test("D11 · the client consumes exactly the four existing routes", async () => {
  const impl = fakeFetch([{ status: 200, body: { ok: true, paymentMethod: { ready: false } } }]);
  const c = clientWith(impl);
  await c.getPaymentMethod(ORG);
  await c.createSetupIntent(ORG);
  await c.replacePaymentMethod(ORG);
  await c.completeSetupIntent(ORG, "seti_1");

  assert.deepEqual(impl.calls.map((x) => `${x.init.method} ${x.url}`), [
    `GET /api/corporate-payments/${ORG}/payment-method`,
    `POST /api/corporate-payments/${ORG}/payment-method/setup-intent`,
    `POST /api/corporate-payments/${ORG}/payment-method/replace`,
    `POST /api/corporate-payments/${ORG}/payment-method/complete`,
  ]);
  assert.equal(Object.keys(c).length, 4, "no fifth operation exists");
});

test("D12 · a non-2xx with a stable code passes the code through; anything else is generic", async () => {
  const withCode = fakeFetch([{ status: 409, body: { ok: false, error: "setup_intent_not_succeeded" } }]);
  const r1 = await clientWith(withCode).completeSetupIntent(ORG, "seti_1");
  assert.equal(r1.error, PAYMENT_ERRORS.SETUP_INTENT_NOT_SUCCEEDED);

  const withProse = fakeFetch([{ status: 500, body: { ok: false, error: "Error: at Object.<anonymous> (/srv/app.js:1)" } }]);
  const r2 = await clientWith(withProse).completeSetupIntent(ORG, "seti_1");
  assert.equal(r2.error, "http_500", "a stack trace is never forwarded as an error code");
});
