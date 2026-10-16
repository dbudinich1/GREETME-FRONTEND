// fundraiserApiP1.test.mjs — Report 87 Part 1 (A7) client functions for the binding API contract.
// Run: node --test src/api/fundraiserApiP1.test.mjs
// Proves each new call hits the contract path with the contract method and body, carries ONLY the
// bearer token (no client role/org authority), and sends nothing the founder/partner did not supply.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fundraiserApi } from "./fundraiserApi.js";

let calls = [];
const origFetch = globalThis.fetch;
const origLS = globalThis.localStorage;
beforeEach(() => {
  calls = [];
  globalThis.localStorage = { getItem: (k) => (k === "token" ? "TESTTOKEN" : null) };
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", headers: opts.headers || {}, body: opts.body === undefined ? undefined : JSON.parse(opts.body) });
    return { ok: true, status: 200, json: async () => ({}) };
  };
});
afterEach(() => { globalThis.fetch = origFetch; globalThis.localStorage = origLS; });

const last = () => calls[calls.length - 1];
function bearerOnly(c) {
  assert.equal(c.headers.Authorization, "Bearer TESTTOKEN");
  for (const k of Object.keys(c.headers)) assert.ok(!/role|org|admin|founder|partner|capab/i.test(k), `unexpected header ${k}`);
}

test("A1 founder activate: POST /admin/organizations/:id/activate with an empty body", async () => {
  await fundraiserApi.founder.activateOrganization("org_1");
  assert.equal(last().method, "POST");
  assert.equal(last().url, "/api/fundraiser/admin/organizations/org_1/activate");
  assert.deepEqual(last().body, {});
  bearerOnly(last());
});

test("A4 founder end / resume: effectiveAt sent only when given", async () => {
  await fundraiserApi.founder.endOrganization("org_1", "2027-01-31T00:00:00.000Z");
  assert.equal(last().url, "/api/fundraiser/admin/organizations/org_1/end");
  assert.deepEqual(last().body, { effectiveAt: "2027-01-31T00:00:00.000Z" });
  await fundraiserApi.founder.endOrganization("org_1");
  assert.deepEqual(last().body, {}, "server default (now) when no date");
  await fundraiserApi.founder.resumeOrganization("org_1");
  assert.equal(last().method, "POST");
  assert.equal(last().url, "/api/fundraiser/admin/organizations/org_1/resume");
  assert.deepEqual(last().body, {});
  bearerOnly(last());
});

test("existing change-rate route: body carries exactly rules, treatments, effectiveFrom, reason", async () => {
  const rules = { kind: "year_rates", basis: "ENSR", yearRates: { year_1: 20, year_2: 15, year_3_plus: 10 } };
  await fundraiserApi.founder.changeOrganizationRate("org_1", { rules, treatments: { taxTreatment: "excluded_from_base" }, effectiveFrom: "2027-01-01T00:00:00.000Z", reason: "r", extra: "dropped" });
  assert.equal(last().url, "/api/fundraiser/admin/organizations/org_1/economics/change-rate");
  assert.deepEqual(Object.keys(last().body).sort(), ["effectiveFrom", "reason", "rules", "treatments"]);
  assert.deepEqual(last().body.rules, rules);
});

test("A5 founder report totals: GET with groupBy and optional organizationId (encoded)", async () => {
  await fundraiserApi.founder.reportTotals({ groupBy: "campaign", organizationId: "org 1" });
  assert.equal(last().method, "GET");
  assert.equal(last().url, "/api/fundraiser/admin/reports/totals?groupBy=campaign&organizationId=org%201");
  await fundraiserApi.founder.reportTotals({ groupBy: "organization" });
  assert.equal(last().url, "/api/fundraiser/admin/reports/totals?groupBy=organization");
  bearerOnly(last());
});

test("existing founder quarterly gross route (A6 split is read from the same response)", async () => {
  await fundraiserApi.founder.quarterlyGross("org_1");
  assert.equal(last().method, "GET");
  assert.equal(last().url, "/api/fundraiser/admin/organizations/org_1/reconciliation/quarterly-gross");
});

test("A2 partner create campaign: POST /partner/orgs/:id/campaigns; the organization stays in the path", async () => {
  await fundraiserApi.partner.createCampaign("org_1", { title: "Fall Drive", goalCents: 250000 });
  assert.equal(last().method, "POST");
  assert.equal(last().url, "/api/fundraiser/partner/orgs/org_1/campaigns");
  assert.deepEqual(last().body, { title: "Fall Drive", goalCents: 250000 });
  assert.equal("organizationId" in last().body, false);
  bearerOnly(last());
});

test("A2 partner campaign status: POST .../campaigns/:cid/status with body { status } only", async () => {
  await fundraiserApi.partner.setCampaignStatus("org_1", "cmp_1", "active");
  assert.equal(last().url, "/api/fundraiser/partner/orgs/org_1/campaigns/cmp_1/status");
  assert.deepEqual(last().body, { status: "active" });
});

test("A9 partner terms (read-only) and A5 partner report totals", async () => {
  await fundraiserApi.partner.terms("org_1");
  assert.equal(last().method, "GET");
  assert.equal(last().url, "/api/fundraiser/partner/orgs/org_1/terms");
  await fundraiserApi.partner.reportTotals("org_1", "quarter");
  assert.equal(last().url, "/api/fundraiser/partner/orgs/org_1/reports/totals?groupBy=quarter");
  bearerOnly(last());
});

test("failures are surfaced, never turned into success", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 409, json: async () => ({ code: "TERMS_NOT_ACTIVE" }) });
  const r = await fundraiserApi.partner.setCampaignStatus("org_1", "cmp_1", "active");
  assert.deepEqual(r, { ok: false, status: 409, data: { code: "TERMS_NOT_ACTIVE" } });
  globalThis.fetch = async () => { throw new Error("down"); };
  const n = await fundraiserApi.founder.activateOrganization("org_1");
  assert.equal(n.ok, false); assert.equal(n.networkError, true);
});
