// src/api/corporateContacts.test.mjs — Run: node --test src/api/corporateContacts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCorporateContactsClient, sanitizeOrganizations, isRecognizedOrganizationsBody } from "./corporateContacts.js";

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
