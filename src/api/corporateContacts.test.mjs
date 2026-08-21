// src/api/corporateContacts.test.mjs — Run: node --test src/api/corporateContacts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createCorporateContactsClient,
  campaignsContainingContact,
  deleteWarningLine,
  CONTACTS_DORMANT_REASON,
} from "./corporateContacts.js";

const res = (status, body) => ({
  status, ok: status >= 200 && status < 300,
  json: async () => { if (body === undefined) throw new Error("no body"); return body; },
});

function recorder(reply = () => res(200, { ok: true, data: {} })) {
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({ url, ...opts }); return reply(calls.length); };
  return { calls, client: createCorporateContactsClient({ fetchImpl, getToken: () => "t0k", apiBase: "" }) };
}

// ══ the base path, which is the whole reason this client exists ══════════════════════════════
test("it targets /api/corporate-contacts, NOT the campaigns router", () => {
  // The corporate surface is two routers at two bases, behind two different dormancy flags. The
  // READ of a contact list lives on /api/corporate-campaigns; these writes do not.
  const src = readFileSync(new URL("./corporateContacts.js", import.meta.url), "utf8");
  assert.match(src, /\/api\/corporate-contacts/);
  assert.equal(/\/api\/corporate-campaigns\$\{/.test(src), false, "it must not borrow the campaigns base");
});

test("each write uses the right method and path, with the id encoded", async () => {
  const { calls, client } = recorder();
  await client.createContact("org 1", { name: "Ada" });
  await client.updateContact("org_1", "ct/1", { name: "Ada L" });
  await client.deleteContact("org_1", "ct/1");

  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].url, /\/api\/corporate-contacts\/organizations\/org%201\/contacts$/, "org id encoded");
  assert.equal(JSON.parse(calls[0].body).name, "Ada");

  assert.equal(calls[1].method, "PATCH");
  assert.match(calls[1].url, /\/contacts\/ct%2F1$/, "contact id encoded — a slash must not become a path");

  assert.equal(calls[2].method, "DELETE");
  assert.equal(calls[2].body, undefined, "a delete carries no body");
});

test("the token rides on every write", async () => {
  const { calls, client } = recorder();
  await client.createContact("org_1", {});
  assert.equal(calls[0].headers.Authorization, "Bearer t0k");
});

// ══ how refusals are reported ════════════════════════════════════════════════════════════════
test("a dormant router is reported as dormant, with the server's own reason", async () => {
  const { client } = recorder(() => res(503, { reason: "corporate_import_disabled" }));
  const out = await client.deleteContact("org_1", "ct_1");
  assert.equal(out.dormant, true);
  assert.equal(out.reason, CONTACTS_DORMANT_REASON);
});

test("an unreadable 503 body keeps the conservative default rather than inventing one", async () => {
  const { client } = recorder(() => res(503, undefined));
  const out = await client.deleteContact("org_1", "ct_1");
  assert.equal(out.dormant, true);
  assert.equal(out.reason, CONTACTS_DORMANT_REASON);
});

test("404 is its own answer, not folded into a generic failure", async () => {
  // The server returns 404 rather than 403 for a record outside the organization, so that the
  // difference cannot be used to probe which ids exist. The client keeps that distinction.
  const { client } = recorder(() => res(404, { ok: false, error: "contact_not_found" }));
  const out = await client.updateContact("org_1", "ct_1", { name: "X" });
  assert.equal(out.notFound, true);
  assert.equal(out.ok, false);
});

test("a duplicate email is a conflict, and auth failures are auth failures", async () => {
  const dupe = await recorder(() => res(409, { error: "email_already_exists" })).client.createContact("o", {});
  assert.equal(dupe.conflict, true);
  for (const status of [401, 403]) {
    const out = await recorder(() => res(status, {})).client.createContact("o", {});
    assert.equal(out.unauthorized, true);
  }
});

test("a validation refusal carries the server's reason through", async () => {
  const { client } = recorder(() => res(400, { ok: false, error: "valid_email_required" }));
  const out = await client.createContact("org_1", { name: "A" });
  assert.equal(out.ok, false);
  assert.equal(out.error, "valid_email_required");
});

test("a network failure never presents as success", async () => {
  const client = createCorporateContactsClient({ fetchImpl: async () => { throw new Error("offline"); }, getToken: () => null });
  const out = await client.deleteContact("org_1", "ct_1");
  assert.deepEqual(out, { ok: false, networkError: true, status: 0 });
});

// ══ the delete warning ═══════════════════════════════════════════════════════════════════════
const CAMPAIGNS = [
  { campaignId: "c1", name: "VIP", audienceRefs: ["e1", "e2"] },
  { campaignId: "c2", name: "Birthdays", audienceRefs: ["e1"] },
  { campaignId: "c3", name: "Retired", enabled: false, audienceRefs: ["e1"] },
  { campaignId: "c4", name: "Vendors", audienceRefs: ["v1"] },
];

test("the warning names every campaign still addressed to this contact", () => {
  assert.deepEqual(campaignsContainingContact(CAMPAIGNS, "e1"), ["VIP", "Birthdays"]);
  assert.deepEqual(campaignsContainingContact(CAMPAIGNS, "e2"), ["VIP"]);
  assert.deepEqual(campaignsContainingContact(CAMPAIGNS, "nobody"), []);
});

test("a switched-off campaign is not a reason to hesitate", () => {
  // Same rule as the overlap warning: one that cannot send is not worth warning about.
  assert.equal(campaignsContainingContact(CAMPAIGNS, "e1").includes("Retired"), false);
});

test("the warning reads as a sentence at one, two and three campaigns", () => {
  assert.equal(deleteWarningLine("Ada", ["VIP"]), "Ada is in VIP.");
  assert.equal(deleteWarningLine("Ada", ["VIP", "Birthdays"]), "Ada is in VIP and Birthdays.");
  assert.equal(deleteWarningLine("Ada", ["VIP", "Birthdays", "Holidays"]), "Ada is in VIP, Birthdays and Holidays.");
});

test("no campaigns, no warning — a confirmation that always warns teaches nothing", () => {
  assert.equal(deleteWarningLine("Ada", []), null);
  assert.equal(deleteWarningLine("Ada", null), null);
});

test("a missing name still produces a usable sentence", () => {
  assert.equal(deleteWarningLine("", ["VIP"]), "This contact is in VIP.");
});

test("it warns, and cannot block", () => {
  // Deleting someone who is in a campaign is a legitimate thing to want. The server does not
  // cascade and this does not refuse — being surprised afterwards is the only failure mode here.
  const src = readFileSync(new URL("./corporateContacts.js", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(/throw|reject|blocked|forbid/i.test(code.split("campaignsContainingContact")[1] || ""), false);
});
