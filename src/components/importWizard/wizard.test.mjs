// src/components/importWizard/wizard.test.mjs — Run: node --test src/components/importWizard/wizard.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODES, corporateContext, commitTarget, canSelectFile, commitDecision, STEPS, buildPersonalImportContacts,
  extractContactsArray, normalizeExistingEmails, existingEmailsFromResponse, classifyImportSummary } from "./wizardModel.js";
import { autoMapHeaders, processRow, detectDuplicates, buildPlan } from "../../import/importCore.js";

const WIZ = readFileSync(new URL("./ContactImportWizard.jsx", import.meta.url), "utf8");

// Mirror the wizard's personal preview pipeline (raw rows + existing emails → dedup → plan → payload).
function preview(rawRows, existingEmails = []) {
  const headers = Object.keys(rawRows[0] || {});
  const { mapping } = autoMapHeaders(headers);
  const processed = rawRows.map((raw, i) => ({ ...processRow(raw, mapping, {}), index: i, __raw: raw, __map: mapping }));
  const deduped = detectDuplicates(processed, existingEmails);
  const plan = buildPlan(deduped, { duplicateStrategy: "skip" });
  return { deduped, plan, payload: buildPersonalImportContacts(plan.toCreate) };
}
const memb = (arr) => ({ ok: true, data: { memberships: arr } });
const A = (id, role = "admin") => ({ corporateOrganizationId: id, role, status: "active" });

test("commit targets: personal writes; corporate needs org; demo never writes / never uses a user id", () => {
  assert.deepEqual(commitTarget(MODES.PERSONAL), { kind: "personal", write: true });
  assert.deepEqual(commitTarget(MODES.CORPORATE, { orgId: "corp_org_1" }), { kind: "corporate", orgId: "corp_org_1", write: true });
  assert.deepEqual(commitTarget(MODES.CORPORATE, {}), { kind: "corporate", orgId: null, write: false });
  const demo = commitTarget(MODES.DEMO, { orgId: "x" });
  assert.equal(demo.write, false);
  assert.equal("orgId" in demo, false); // demo carries no org id at all
});

test("canSelectFile: personal/demo always; corporate requires resolved active org", () => {
  assert.equal(canSelectFile(MODES.PERSONAL, null), true);
  assert.equal(canSelectFile(MODES.DEMO, null), true);
  assert.equal(canSelectFile(MODES.CORPORATE, { phase: "select_org" }), false);
  assert.equal(canSelectFile(MODES.CORPORATE, { phase: "ready" }), true);
});

test("corporateContext delegates to Phase A5 resolution (zero/one/many)", () => {
  assert.equal(corporateContext(memb([])).phase, "no_org");
  const one = corporateContext(memb([A("corp_org_1")]));
  assert.equal(one.phase, "ready");
  assert.equal(one.selectedOrgId, "corp_org_1");
  assert.equal(corporateContext(memb([A("corp_org_1"), A("corp_org_2")])).phase, "select_org");
  assert.equal(corporateContext({ dormant: true }).phase, "dormant");
});

test("commit decisions: demo blocked, corporate gated, personal allowed", () => {
  const plan = { toCreate: [{}], toUpdate: [] };
  assert.equal(commitDecision(MODES.DEMO, plan).reason, "demo_no_write");
  assert.equal(commitDecision(MODES.CORPORATE, plan, {}).reason, "org_required");
  assert.equal(commitDecision(MODES.CORPORATE, plan, { orgId: "corp_org_1" }).reason, "corporate_endpoint_pending");
  assert.equal(commitDecision(MODES.PERSONAL, plan).allowed, true);
  assert.equal(commitDecision(MODES.PERSONAL, { toCreate: [] }).reason, "nothing_to_import");
});

test("wizard has the ordered steps", () => {
  assert.deepEqual(STEPS, ["mode", "context", "upload", "map", "preview", "commit", "summary"]);
});

test("buildPersonalImportContacts transmits every recognized field INCLUDING birthday", () => {
  const rows = [{
    contact: { fullName: "Ada Lovelace", email: "ada@x.co", phone: "+15551112222", relationship: "Friend", company: "Acme", department: "Eng", recipientType: "employee", consent: "yes", source: "csv", notes: "vip" },
    __raw: { Name: "Ada Lovelace", Email: "ada@x.co", DOB: "1990-05-14" },
    __map: { fullName: "Name", email: "Email", birthday: "DOB" },
  }];
  const [c] = buildPersonalImportContacts(rows);
  assert.equal(c.name, "Ada Lovelace");       // name comes from processed fullName
  assert.equal(c.email, "ada@x.co");
  assert.equal(c.phone, "+15551112222");
  assert.equal(c.company, "Acme");
  assert.equal(c.department, "Eng");
  assert.equal(c.recipientType, "employee");
  assert.equal(c.consent, "yes");
  assert.equal(c.source, "csv");
  assert.equal(c.notes, "vip");
  assert.equal(c.birthday, "1990-05-14");      // birthday reaches the payload (raw mapped column)
});

test("buildPersonalImportContacts omits birthday when no birthday column is mapped", () => {
  const rows = [{ contact: { fullName: "Bob", email: "bob@x.co" }, __raw: { Name: "Bob", Email: "bob@x.co" }, __map: { fullName: "Name", email: "Email" } }];
  const [c] = buildPersonalImportContacts(rows);
  assert.equal("birthday" in c, false);        // never fabricates a birthday
  assert.equal(c.name, "Bob");
});

test("wizard commit uses the shared builder (no ad-hoc field allow-list)", () => {
  assert.match(WIZ, /buildPersonalImportContacts\(plan\.toCreate\)/); // birthday-carrying commit path
  assert.ok(!/name: r\.contact\.fullName, email: r\.contact\.email, relationship/.test(WIZ), "old 3-field mapping removed");
});

// ---- existing-recipient awareness (preview↔persistence consistency) ----
test("existing account email → duplicate + skipped + excluded from payload; new email stays importable", () => {
  const existing = normalizeExistingEmails([{ email: "  ADA@X.co " }]); // already in the user's Recipients
  const { deduped, plan, payload } = preview([
    { Name: "Ada", Email: "ada@x.co", Birthday: "1990-11-01" },  // already present
    { Name: "New", Email: "new@x.co", Birthday: "1992-03-04" },  // genuinely new
  ], existing);
  assert.equal(deduped[0].duplicate, "existing_record");                          // previews as already-present
  assert.ok(plan.toSkip.some((r) => r.contact.email === "ada@x.co"));             // skipped
  assert.ok(!plan.toCreate.some((r) => r.contact.email === "ada@x.co"));          // NOT in toCreate
  assert.ok(!payload.some((p) => p.email === "ada@x.co"));                        // excluded from POST payload
  assert.ok(plan.toCreate.some((r) => r.contact.email === "new@x.co"));           // new remains importable
  assert.ok(payload.some((p) => p.email === "new@x.co" && p.birthday === "1992-03-04")); // fresh keeps full birthday
});

test("repeat import cannot reach the commit stage as a NEW contact", () => {
  const existing = normalizeExistingEmails([{ email: "dup@x.co" }]);
  const { plan, payload } = preview([{ Name: "Dup", Email: "dup@x.co", Birthday: "1990-11-01" }], existing);
  assert.equal(plan.toCreate.length, 0);      // nothing new to create
  assert.equal(payload.length, 0);            // nothing is POSTed → cannot be committed as a new contact
});

test("existing-email normalization is case-insensitive and whitespace-safe", () => {
  assert.deepEqual(normalizeExistingEmails([{ email: "  ADA@X.co " }, { email: "ada@x.co" }, { email: "" }, { email: null }, {}]), ["ada@x.co"]);
  // and it actually matches a differently-cased/spaced row
  const { deduped } = preview([{ Name: "A", Email: " Ada@X.CO " }], ["ada@x.co"]);
  assert.equal(deduped[0].duplicate, "existing_record");
});

test("failure to load existing contacts FAILS CLOSED (never treated as zero existing)", () => {
  assert.equal(existingEmailsFromResponse({ ok: false, status: 401 }).ok, false);              // auth
  assert.equal(existingEmailsFromResponse({ ok: false, status: 0, networkError: true }).ok, false); // network
  assert.equal(existingEmailsFromResponse(null).ok, false);                                     // no body
  assert.equal(existingEmailsFromResponse({ nope: 1 }).ok, false);                              // unrecognized shape
  assert.equal(extractContactsArray({ nope: 1 }), null);
  // a genuine empty account is a SUCCESS with no emails (must NOT fail closed)
  assert.deepEqual(existingEmailsFromResponse({ data: [] }), { ok: true, emails: [] });
  assert.deepEqual(existingEmailsFromResponse({ data: [{ email: "A@B.co" }] }), { ok: true, emails: ["a@b.co"] });
});

test("commit summary: 'Email already exists' shows as already-present, not needs-attention", () => {
  const c = classifyImportSummary({ added: 0, updated: 0, skipped: 0, failed: 1, errors: [{ contact: {}, error: "Email already exists" }] });
  assert.equal(c.alreadyPresent, 1);
  assert.equal(c.needsAttention, 0);
  const c2 = classifyImportSummary({ added: 1, failed: 2, errors: [{ error: "Email already exists" }, { error: "Invalid email address" }] });
  assert.equal(c2.added, 1);
  assert.equal(c2.alreadyPresent, 1);   // one already-present
  assert.equal(c2.needsAttention, 1);   // one genuine failure still surfaced
});

test("wizard loads existing recipients for personal preview and FAILS CLOSED on lookup error", () => {
  assert.match(WIZ, /api\.getContacts\(\)/);                     // loads existing recipients
  assert.match(WIZ, /existingEmailsFromResponse/);
  assert.match(WIZ, /ingest\(data, existingEmails\)/);           // feeds dedup
  assert.match(WIZ, /Couldn't load your existing recipients/);   // fail-closed preview error
  assert.match(WIZ, /classifyImportSummary/);                    // truthful summary
  assert.match(WIZ, /already in your recipients/);
});

// ---- source-scan invariants ----
test("org context never comes from user.id / useAuth", () => {
  assert.ok(!/user\??\.id/.test(WIZ), "must not read user.id");
  assert.ok(!/useAuth/.test(WIZ), "must not derive org from useAuth");
});

test("demo mode is send-safe and isolated (no send/gift/notify wiring; no real mix)", () => {
  assert.match(WIZ, /assertNoRealMix/);                 // never mixes demo + real
  assert.ok(!/\.send\(|sendGreeting|sendGift|notify\(|\/api\/[^"']*send/.test(WIZ), "no send/gift/notify calls");
  assert.match(WIZ, /DEMO DATA — NOT SENT/);            // clear labeling
});

test("no gift/payment/fundraising imports; personal ownership via existing endpoint", () => {
  assert.ok(!/\b(import|from)\b[^\n]*(gift|fundrais|payment|stripe|merch|pricing|checkout)/i.test(WIZ));
  assert.match(WIZ, /api\.importContacts/);             // personal → user's own collection
  assert.match(WIZ, /corporate_endpoint_pending/);      // corporate write gated (backend gap)
});

test("does not import or modify the locked Recipients page (Contacts.jsx)", () => {
  assert.ok(!/pages\/Contacts|CSVImport/.test(WIZ), "must not touch the locked Recipients import path");
});
