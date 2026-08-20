// src/api/corporateCampaigns.test.mjs — Team A corporate campaign API client.
// Run: node --test src/api/corporateCampaigns.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCorporateCampaignsClient, DORMANT_REASON, EXECUTION_DORMANT_REASON } from "./corporateCampaigns.js";

function stub(responses) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, method: opts.method, headers: opts.headers, body: opts.body });
    const next = responses.shift() || { status: 200, json: {} };
    if (next.throw) throw new Error("network");
    return {
      status: next.status,
      ok: next.status >= 200 && next.status < 300,
      json: async () => next.json,
    };
  };
  return { fetchImpl, calls };
}
const mk = (responses, token = "t") => {
  const s = stub(responses);
  return { client: createCorporateCampaignsClient({ fetchImpl: s.fetchImpl, getToken: () => token, apiBase: "" }), calls: s.calls };
};

test("dormant 503 → { dormant:true } with no leaked data", async () => {
  const { client } = mk([{ status: 503, json: { disabled: true, reason: DORMANT_REASON } }]);
  const r = await client.listCampaigns("org1");
  assert.equal(r.ok, false);
  assert.equal(r.dormant, true);
  assert.equal(r.reason, DORMANT_REASON);
  assert.equal(r.data, undefined);
});

test("401/403 → unauthorized, never surfaces org data", async () => {
  for (const status of [401, 403]) {
    const { client } = mk([{ status, json: { secret: "org-data" } }]);
    const r = await client.readCampaign("org1", "c1");
    assert.equal(r.unauthorized, true);
    assert.equal(r.data, undefined);
  }
});

test("409/412 → conflict (refresh/retry)", async () => {
  for (const status of [409, 412]) {
    const { client } = mk([{ status, json: {} }]);
    const r = await client.approve("org1", "c1");
    assert.equal(r.conflict, true);
    assert.equal(r.ok, false);
  }
});

test("2xx → ok + data", async () => {
  const { client } = mk([{ status: 200, json: { campaigns: [{ campaignId: "c1" }] } }]);
  const r = await client.listCampaigns("org1");
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.campaigns, [{ campaignId: "c1" }]);
});

test("network error → { networkError:true }", async () => {
  const { client } = mk([{ throw: true }]);
  const r = await client.listCampaigns("org1");
  assert.equal(r.networkError, true);
});

test("each endpoint hits the correct method + org-scoped path", async () => {
  const { client, calls } = mk(Array(8).fill({ status: 200, json: {} }));
  await client.listCampaigns("org1");
  await client.createCampaign("org1", { x: 1 });
  await client.readCampaign("org1", "c1");
  await client.updateFeaturedSpread("org1", "c1", { featuredSpreadConfig: {} });
  await client.readReadiness("org1", "c1");
  await client.approve("org1", "c1");
  await client.lock("org1", "c1", {});
  await client.unlock("org1", "c1");
  const sig = calls.map((c) => `${c.method} ${c.url}`);
  assert.deepEqual(sig, [
    "GET /api/corporate-campaigns/organizations/org1/campaigns",
    "POST /api/corporate-campaigns/organizations/org1/campaigns",
    "GET /api/corporate-campaigns/organizations/org1/campaigns/c1",
    "PATCH /api/corporate-campaigns/organizations/org1/campaigns/c1/featured-spread",
    "GET /api/corporate-campaigns/organizations/org1/campaigns/c1/readiness",
    "POST /api/corporate-campaigns/organizations/org1/campaigns/c1/approve",
    "POST /api/corporate-campaigns/organizations/org1/campaigns/c1/lock",
    "POST /api/corporate-campaigns/organizations/org1/campaigns/c1/unlock",
  ]);
  // Never touches any gift/fundraising/competing route.
  assert.ok(sig.every((s) => s.includes("/api/corporate-campaigns/")));
});

test("listMemberships hits the non-org-scoped /memberships endpoint", async () => {
  const { client, calls } = mk([{ status: 200, json: { memberships: [{ corporateOrganizationId: "corp_org_1", role: "admin", status: "active" }] } }]);
  const r = await client.listMemberships();
  assert.equal(r.ok, true);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, "/api/corporate-campaigns/memberships");
});

test("memberships: 503 → dormant; 401/403 → unauthorized with no data", async () => {
  assert.equal((await mk([{ status: 503, json: { disabled: true } }]).client.listMemberships()).dormant, true);
  for (const status of [401, 403]) {
    const r = await mk([{ status, json: { memberships: [{ corporateOrganizationId: "leak" }] } }]).client.listMemberships();
    assert.equal(r.unauthorized, true);
    assert.equal(r.data, undefined);
  }
});

test("Authorization header set only when a token exists", async () => {
  const s1 = mk([{ status: 200, json: {} }], "tok");
  await s1.client.listCampaigns("org1");
  assert.equal(s1.calls[0].headers.Authorization, "Bearer tok");
  const s2 = mk([{ status: 200, json: {} }], null);
  await s2.client.readCampaign("org1", "c1");
  assert.equal(s2.calls[0].headers.Authorization, undefined);
});

test("throws if no fetch is available (no silent global dependency)", () => {
  assert.throws(() => createCorporateCampaignsClient({ fetchImpl: null }));
});

// CORP-3 association bridge client methods — method, path, and body.
test("listOrgContacts → GET /organizations/{org}/contacts", async () => {
  const { client, calls } = mk([{ status: 200, json: { contacts: [], count: 0 } }]);
  const r = await client.listOrgContacts("org 1");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, "/api/corporate-campaigns/organizations/org%201/contacts");
  assert.equal(r.ok, true);
});

test("readAudience → GET .../campaigns/{id}/audience", async () => {
  const { client, calls } = mk([{ status: 200, json: { count: 0, contacts: [], unresolved: [] } }]);
  await client.readAudience("o", "c");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, "/api/corporate-campaigns/organizations/o/campaigns/c/audience");
});

test("setAudience → PUT .../audience with { audienceRefs }", async () => {
  const { client, calls } = mk([{ status: 200, json: { audienceRefs: ["c1"], count: 1, contacts: [{ id: "c1", name: "A" }], unresolved: [] } }]);
  const r = await client.setAudience("o", "c", ["c1", "c1"]);
  assert.equal(calls[0].method, "PUT");
  assert.equal(calls[0].url, "/api/corporate-campaigns/organizations/o/campaigns/c/audience");
  assert.deepEqual(JSON.parse(calls[0].body), { audienceRefs: ["c1", "c1"] }); // server dedups/verifies
  assert.equal(r.ok, true);
});

// ══ SLICE E3 — two different 503s must stay distinguishable ══════════════════════════════════
//
// Before this slice the client stamped EVERY 503 with DORMANT_REASON and discarded the server's
// own answer, so "the whole surface is switched off" and "the surface is live but runs may not be
// authorized" arrived identically. They have different causes and different remedies.

test("E3: the server's own 503 reason is preserved, not overwritten", async () => {
  const { client } = mk([{ status: 503, json: { disabled: true, reason: "corporate_campaign_execution_disabled" } }]);
  const r = await client.schedule("o1", "c1");
  assert.equal(r.ok, false);
  assert.equal(r.dormant, true);
  assert.equal(r.status, 503);
  assert.equal(r.reason, "corporate_campaign_execution_disabled");
  assert.notEqual(r.reason, DORMANT_REASON, "the management default must not have been stamped over it");
  assert.equal(r.reason, EXECUTION_DORMANT_REASON);
});

test("E3: management dormancy still reports the management reason", async () => {
  const { client } = mk([{ status: 503, json: { disabled: true, reason: "campaign_featured_spread_disabled" } }]);
  const r = await client.listCampaigns("o1");
  assert.equal(r.dormant, true);
  assert.equal(r.reason, DORMANT_REASON);
  assert.notEqual(r.reason, EXECUTION_DORMANT_REASON);
});

test("E3: the two dormancy reasons are distinct values, not aliases", () => {
  assert.equal(DORMANT_REASON, "campaign_featured_spread_disabled");
  assert.equal(EXECUTION_DORMANT_REASON, "corporate_campaign_execution_disabled");
  assert.notEqual(DORMANT_REASON, EXECUTION_DORMANT_REASON);
});

test("E3: a 503 with no usable reason falls back to the conservative management default", async () => {
  // An older server, an empty body, or a non-JSON body. Never invent a reason.
  for (const json of [{ disabled: true }, {}, { reason: "" }, { reason: 123 }, { reason: null }]) {
    const { client } = mk([{ status: 503, json }]);
    const r = await client.listCampaigns("o1");
    assert.equal(r.dormant, true, JSON.stringify(json));
    assert.equal(r.reason, DORMANT_REASON, JSON.stringify(json));
  }
});

test("E3: a 503 still leaks no organization data, whichever reason it carries", async () => {
  const { client } = mk([{ status: 503, json: { disabled: true, reason: "corporate_campaign_execution_disabled", campaigns: [{ campaignId: "leak" }] } }]);
  const r = await client.listCampaigns("o1");
  assert.equal(r.ok, false);
  assert.equal(r.data, undefined, "no payload is surfaced from a dormant response");
  assert.equal("campaigns" in r, false);
});

test("E3: executionAvailability rides through on a successful list, untouched", async () => {
  const { client } = mk([{ status: 200, json: {
    campaigns: [{ campaignId: "c1" }],
    viewerAuthorization: { isCurrentOrganizationOwner: true },
    executionAvailability: { canAuthorizeRun: false, reason: "corporate_campaign_execution_disabled" },
  } }]);
  const r = await client.listCampaigns("o1");
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.executionAvailability, { canAuthorizeRun: false, reason: "corporate_campaign_execution_disabled" });
});
