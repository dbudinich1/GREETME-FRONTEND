// src/api/corporateContacts.test.mjs — Run: node --test src/api/corporateContacts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCorporateContactsClient, sanitizeOrganizations, isRecognizedOrganizationsBody,
  campaignsContainingContact, deleteWarningLine } from "./corporateContacts.js";

const jsonRes = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const client = (fetchImpl) => createCorporateContactsClient({ fetchImpl, getToken: () => "tok", apiBase: "" });

// ---------- listOrganizations ----------
test("listOrganizations sends GET with bearer token to the corporate-contacts endpoint", async () => {
  let seen = null;
  const c = client(async (url, opts) => { seen = { url, opts }; return jsonRes(200, { ok: true, data: { organizations: [] } }); });
  await c.listOrganizations();
  assert.match(seen.url, /\/api\/corporate-contacts\/organizations$/);
  assert.equal(seen.opts.method, "GET");
  assert.equal(seen.opts.headers.Authorization, "Bearer tok");
});

test("listOrganizations returns sanitized orgs on 200", async () => {
  const c = client(async () => jsonRes(200, { ok: true, data: { organizations: [{ corporateOrganizationId: "o1", role: "admin" }, { corporateOrganizationId: "o2", role: "owner", name: "Acme" }] } }));
  const r = await c.listOrganizations();
  assert.equal(r.ok, true);
  assert.deepEqual(r.organizations, [{ corporateOrganizationId: "o1", role: "admin" }, { corporateOrganizationId: "o2", role: "owner", name: "Acme" }]);
});

test("listOrganizations: dormant 503 → { dormant, reason } (NOT empty org list)", async () => {
  const c = client(async () => jsonRes(503, { disabled: true, reason: "corporate_import_disabled" }));
  const r = await c.listOrganizations();
  assert.equal(r.dormant, true);
  assert.equal(r.reason, "corporate_import_disabled");
  assert.equal(r.ok, false);
});

test("listOrganizations: 401/403 → unauthorized (no org data)", async () => {
  for (const s of [401, 403]) {
    const r = await client(async () => jsonRes(s, {})).listOrganizations();
    assert.equal(r.unauthorized, true);
    assert.equal(r.status, s);
  }
});

test("listOrganizations: network failure → networkError (safe, read-only)", async () => {
  const c = client(async () => { throw new Error("down"); });
  const r = await c.listOrganizations();
  assert.equal(r.networkError, true);
  assert.equal(r.status, 0);
});

test("listOrganizations: malformed 200 body → { malformed } (fail closed, no orgs)", async () => {
  const c = client(async () => jsonRes(200, { ok: true, data: { nope: 1 } }));
  const r = await c.listOrganizations();
  assert.equal(r.ok, false);
  assert.equal(r.malformed, true);
});

test("sanitizeOrganizations drops malformed + duplicate entries; keeps name only if non-empty string", () => {
  const out = sanitizeOrganizations({ data: { organizations: [
    { corporateOrganizationId: "o1", role: "admin" },
    { corporateOrganizationId: "o1", role: "owner" },      // duplicate id → dropped
    { corporateOrganizationId: "", role: "admin" },        // no id → dropped
    { corporateOrganizationId: "o2", role: "" },           // no role → dropped
    { corporateOrganizationId: "o3", role: "admin", name: "  A  " },
    { role: "admin" },                                     // no id → dropped
  ] } });
  assert.deepEqual(out, [{ corporateOrganizationId: "o1", role: "admin" }, { corporateOrganizationId: "o3", role: "admin", name: "A" }]);
});

test("isRecognizedOrganizationsBody guards ok:true + data.organizations array", () => {
  assert.equal(isRecognizedOrganizationsBody({ ok: true, data: { organizations: [] } }), true);
  assert.equal(isRecognizedOrganizationsBody({ ok: true, data: {} }), false);
  assert.equal(isRecognizedOrganizationsBody({ data: { organizations: [] } }), false);
});

// ---------- importContacts ----------
test("importContacts POSTs the envelope to the authorized org path (org id from bootstrap only)", async () => {
  let seen = null;
  const c = client(async (url, opts) => { seen = { url, opts }; return jsonRes(200, { ok: true, data: { added: 1, updated: 0, merged: 0, skipped: 0, failed: 0, total: 1, rows: [{ index: 0, status: "created" }] } }); });
  const r = await c.importContacts("corp_org_1", { contacts: [{ email: "a@corp.co" }], duplicateStrategy: "skip" });
  assert.match(seen.url, /\/api\/corporate-contacts\/organizations\/corp_org_1\/contacts\/import$/);
  assert.equal(seen.opts.method, "POST");
  assert.equal(JSON.parse(seen.opts.body).duplicateStrategy, "skip");
  assert.equal(r.ok, true);
  assert.equal(r.data.added, 1);
});

test("importContacts: missing org id → 400 missing_org, and NEVER calls fetch", async () => {
  let called = 0;
  const c = client(async () => { called++; return jsonRes(200, {}); });
  const r = await c.importContacts("", { contacts: [] });
  assert.equal(r.status, 400);
  assert.equal(r.error, "missing_org");
  assert.equal(called, 0);
});

test("importContacts: dormant 503 → { dormant }", async () => {
  const r = await client(async () => jsonRes(503, { disabled: true, reason: "corporate_import_disabled" })).importContacts("o1", {});
  assert.equal(r.dormant, true);
});

test("importContacts: 400/413/429/500 surface status + safe code, ok:false", async () => {
  for (const [s, code] of [[400, "invalid_payload"], [413, "payload_too_large"], [429, undefined], [500, undefined]]) {
    const r = await client(async () => jsonRes(s, code ? { error: code } : {})).importContacts("o1", {});
    assert.equal(r.ok, false);
    assert.equal(r.status, s);
  }
});

test("importContacts: network failure on a mutation → INDETERMINATE (never a safe resubmit)", async () => {
  const r = await client(async () => { throw new Error("timeout"); }).importContacts("o1", {});
  assert.equal(r.indeterminate, true);
  assert.equal(r.aborted, undefined);
});

test("importContacts: abort → { aborted } (server may have received it)", async () => {
  const r = await client(async () => { const e = new Error("aborted"); e.name = "AbortError"; throw e; }).importContacts("o1", {});
  assert.equal(r.aborted, true);
});

test("importContacts forwards the abort signal to fetch", async () => {
  let seenSignal;
  const c = client(async (url, opts) => { seenSignal = opts.signal; return jsonRes(200, { ok: true, data: { added: 0, updated: 0, merged: 0, skipped: 0, failed: 0, total: 0, rows: [] } }); });
  const ctrl = { signal: { aborted: false } };
  await c.importContacts("o1", {}, { signal: ctrl.signal });
  assert.equal(seenSignal, ctrl.signal);
});

// ---------- SLICE E7: single-record writes ----------
// Added ALONGSIDE listOrganizations/importContacts, on the same router and the same dormancy flag.

test("E7: each write uses the right method and path, with ids encoded", async () => {
  const seen = [];
  const c = client(async (url, opts) => { seen.push({ url, ...opts }); return jsonRes(200, { ok: true, data: {} }); });
  await c.createContact("org 1", { name: "Ada" });
  await c.updateContact("o1", "ct/1", { name: "Ada L" });
  await c.deleteContact("o1", "ct/1");

  assert.equal(seen[0].method, "POST");
  assert.match(seen[0].url, /\/api\/corporate-contacts\/organizations\/org%201\/contacts$/);
  assert.equal(seen[1].method, "PATCH");
  assert.match(seen[1].url, /\/contacts\/ct%2F1$/, "a slash in an id must not become a path segment");
  assert.equal(seen[2].method, "DELETE");
  assert.equal(seen[2].body, undefined, "a delete carries no body");
  for (const s2 of seen) assert.equal(s2.headers.Authorization, "Bearer tok");
});

test("E7: a missing org or contact id never reaches the network", async () => {
  let called = 0;
  const c = client(async () => { called++; return jsonRes(200, {}); });
  assert.equal((await c.createContact("", {})).error, "missing_org");
  assert.equal((await c.updateContact("o1", "", {})).error, "missing_org");
  assert.equal((await c.deleteContact("", "ct_1")).error, "missing_org");
  assert.equal(called, 0);
});

test("E7: the writes share this router's refusal vocabulary", async () => {
  const dormant = await client(async () => jsonRes(503, { reason: "corporate_import_disabled" })).deleteContact("o1", "c1");
  assert.equal(dormant.dormant, true);
  assert.equal(dormant.reason, "corporate_import_disabled");
  for (const st of [401, 403]) {
    assert.equal((await client(async () => jsonRes(st, {})).createContact("o1", {})).unauthorized, true);
  }
});

test("E7: 404 is its own answer, not a generic failure", async () => {
  // The server returns 404 rather than 403 for a record outside the organization, so existence
  // elsewhere cannot be probed. "Already gone" and "not yours" need different words on screen.
  const r = await client(async () => jsonRes(404, { error: "contact_not_found" })).updateContact("o1", "c1", {});
  assert.equal(r.notFound, true);
  assert.equal(r.ok, false);
});

test("E7: a duplicate email is a conflict, and validation reasons come through", async () => {
  assert.equal((await client(async () => jsonRes(409, {})).createContact("o1", {})).conflict, true);
  const bad = await client(async () => jsonRes(400, { error: "valid_email_required" })).createContact("o1", {});
  assert.equal(bad.error, "valid_email_required");
});

test("E7: a write that never returned is INDETERMINATE, never a silent success", async () => {
  const r = await client(async () => { throw new Error("timeout"); }).deleteContact("o1", "c1");
  assert.equal(r.indeterminate, true);
  assert.equal(r.ok, false);
});

// ---------- the delete warning ----------
const CAMPAIGNS = [
  { campaignId: "c1", name: "VIP", audienceRefs: ["e1", "e2"] },
  { campaignId: "c2", name: "Birthdays", audienceRefs: ["e1"] },
  { campaignId: "c3", name: "Retired", enabled: false, audienceRefs: ["e1"] },
];

test("E7: the warning names every campaign still addressed to this contact", () => {
  assert.deepEqual(campaignsContainingContact(CAMPAIGNS, "e1"), ["VIP", "Birthdays"]);
  assert.deepEqual(campaignsContainingContact(CAMPAIGNS, "e2"), ["VIP"]);
  assert.deepEqual(campaignsContainingContact(CAMPAIGNS, "nobody"), []);
  assert.equal(campaignsContainingContact(CAMPAIGNS, "e1").includes("Retired"), false, "one that cannot send is no reason to hesitate");
});

test("E7: the warning reads as a sentence at one, two and three campaigns", () => {
  assert.equal(deleteWarningLine("Ada", ["VIP"]), "Ada is in VIP.");
  assert.equal(deleteWarningLine("Ada", ["VIP", "Birthdays"]), "Ada is in VIP and Birthdays.");
  assert.equal(deleteWarningLine("Ada", ["VIP", "B", "C"]), "Ada is in VIP, B and C.");
  assert.equal(deleteWarningLine("", ["VIP"]), "This contact is in VIP.");
});

test("E7: no campaigns, no warning — one that always warns teaches nothing", () => {
  assert.equal(deleteWarningLine("Ada", []), null);
  assert.equal(deleteWarningLine("Ada", null), null);
});
