// src/pages/fundraiser/partnerOrgDiscovery.test.mjs
// TEAM D (B3B) — pure discovery logic + the authenticated-endpoint contract. No DOM.
// Run: node --test src/pages/fundraiser/partnerOrgDiscovery.test.mjs
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { classifyOrganizations, partnerDashboardPath } from "./partnerOrgDiscovery.js";
import { fundraiserApi, stateFor } from "../../api/fundraiserApi.js";

// ---- Pure routing decision ----
test("zero organizations ⇒ empty (no default org)", () => {
  assert.deepEqual(classifyOrganizations([]), { mode: "empty", organizationId: null });
  assert.deepEqual(classifyOrganizations(undefined), { mode: "empty", organizationId: null });
});

test("exactly one organization ⇒ single, carrying that org's id (auto-open)", () => {
  const d = classifyOrganizations([{ organizationId: "org_only", name: "Only Org", status: "approved" }]);
  assert.deepEqual(d, { mode: "single", organizationId: "org_only" });
});

test("multiple organizations ⇒ multiple with NO premature selection", () => {
  const d = classifyOrganizations([
    { organizationId: "org_a", name: "A", status: "approved" },
    { organizationId: "org_b", name: "B", status: "approved" },
  ]);
  assert.equal(d.mode, "multiple");
  assert.equal(d.organizationId, null); // never pick a default
});

test("dashboard path targets the existing org-scoped route (direct-route compatible)", () => {
  assert.equal(partnerDashboardPath("org_x"), "/dashboard/fundraiser/partner/org_x");
});

// ---- Authenticated-endpoint contract (mock fetch; assert no client-supplied identity) ----
let calls;
const origFetch = globalThis.fetch;
const origLS = globalThis.localStorage;
beforeEach(() => {
  calls = [];
  globalThis.localStorage = { _s: { token: "TESTTOKEN" }, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = v; } };
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", headers: opts.headers || {}, body: opts.body });
    return { ok: true, status: 200, json: async () => ({ organizations: [] }) };
  };
});
afterEach(() => { globalThis.fetch = origFetch; globalThis.localStorage = origLS; });

test("discovery uses the authenticated endpoint with the Bearer token and NO client-supplied identity", async () => {
  const r = await fundraiserApi.partner.myOrganizations();
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/fundraiser/partner/orgs"); // exact endpoint, no query, no id in path
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].headers.Authorization, "Bearer TESTTOKEN"); // server-verified auth only
  assert.equal(calls[0].body, undefined); // GET carries no body → no client-asserted org/role/user
  // The request string must not smuggle any identity/authority claim.
  assert.ok(!/organizationId|userId|role|actor|admin/i.test(calls[0].url));
});

test("truthful state mapping for discovery failures (401/403/503/error)", () => {
  assert.equal(stateFor({ ok: false, status: 401 }), "signin");
  assert.equal(stateFor({ ok: false, status: 403 }), "forbidden");
  assert.equal(stateFor({ ok: false, status: 503 }), "dormant");
  assert.equal(stateFor({ ok: false, status: 500 }), "error");
  assert.equal(stateFor({ networkError: true, status: 0 }), "error");
});
