// fundraiserApi.test.mjs — TEAM B. Run: node --test src/api/fundraiserApi.test.mjs
// Proves client-auth safety (bearer token ONLY, no client role/org) + fail-closed state mapping.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fundraiserApi, stateFor } from "./fundraiserApi.js";

let calls = [];
let nextResponse = null;
const origFetch = globalThis.fetch;
const origLS = globalThis.localStorage;

beforeEach(() => {
  calls = [];
  globalThis.localStorage = { _s: { token: "TESTTOKEN" }, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = v; } };
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", headers: opts.headers || {}, body: opts.body });
    if (nextResponse instanceof Error) throw nextResponse;
    return nextResponse;
  };
});
afterEach(() => { globalThis.fetch = origFetch; globalThis.localStorage = origLS; nextResponse = null; });

function resp(status, body, { malformed = false } = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => { if (malformed) throw new Error("bad json"); return body; } };
}

test("requests carry ONLY the bearer token — no client role/org/authority header", async () => {
  nextResponse = resp(200, { dashboard: "founder_admin" });
  await fundraiserApi.founder.overview();
  const h = calls[0].headers;
  assert.equal(h.Authorization, "Bearer TESTTOKEN");
  // no fabricated authority headers
  for (const k of Object.keys(h)) assert.ok(!/role|org|admin|founder|partner|capab/i.test(k), `unexpected header ${k}`);
  assert.equal("x-role" in h, false);
});

test("no token ⇒ no Authorization header (still no role claim)", async () => {
  globalThis.localStorage = { getItem: () => null };
  nextResponse = resp(200, {});
  await fundraiserApi.founder.overview();
  assert.equal("Authorization" in calls[0].headers, false);
});

test("POST sends JSON body + Content-Type + bearer only; body has no role/org authority", async () => {
  nextResponse = resp(200, { organizationId: "o1" });
  await fundraiserApi.founder.createOrganization({ legalName: "X", orgType: "school" });
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers["Content-Type"], "application/json");
  assert.equal(calls[0].headers.Authorization, "Bearer TESTTOKEN");
  const sent = JSON.parse(calls[0].body);
  assert.equal("role" in sent, false); assert.equal("capabilities" in sent, false);
});

test("stateFor maps statuses to truthful states; failures fail closed (no fabricated success)", async () => {
  assert.equal(stateFor({ ok: true, status: 200 }), "ok");
  assert.equal(stateFor({ ok: false, status: 401 }), "signin");
  assert.equal(stateFor({ ok: false, status: 403 }), "forbidden");
  assert.equal(stateFor({ ok: false, status: 503 }), "dormant");
  assert.equal(stateFor({ ok: false, status: 500 }), "error");
  assert.equal(stateFor({ networkError: true, status: 0 }), "error");
});

test("network error fails closed (ok:false, networkError)", async () => {
  nextResponse = new Error("ECONNREFUSED");
  const r = await fundraiserApi.partner.overview("org_a");
  assert.equal(r.ok, false);
  assert.equal(r.networkError, true);
  assert.equal(stateFor(r), "error");
});

test("malformed JSON on 200 ⇒ data null (caller must fail closed, no fabricated dashboard)", async () => {
  nextResponse = resp(200, null, { malformed: true });
  const r = await fundraiserApi.founder.overview();
  assert.equal(r.ok, true);
  assert.equal(r.data, null); // dashboards treat missing shape as error (fail closed)
});

test("partner overview requests exactly the org in the route (no arbitrary org switch here)", async () => {
  nextResponse = resp(200, { dashboard: "partner_admin" });
  await fundraiserApi.partner.overview("org_authorized");
  assert.match(calls[0].url, /\/api\/fundraiser\/partner\/orgs\/org_authorized\/overview$/);
});
