// src/components/importWizard/wizard.test.mjs — Run: node --test src/components/importWizard/wizard.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODES, corporateContext, commitTarget, canSelectFile, commitDecision, STEPS, buildPersonalImportContacts,
  extractContactsArray, normalizeExistingEmails, existingEmailsFromResponse, classifyImportSummary,
  classifyCommitOutcome, commitMessageForStatus, COMMIT_MESSAGES, corporateRoute } from "./wizardModel.js";
import { autoMapHeaders, processRow, detectDuplicates, buildPlan } from "../../import/importCore.js";
import { buildReview, buildReviewPayload, freshReviewState, chooseAudience, REVIEW_STATUS } from "../../import/reviewModel.js";

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
  assert.equal(c.birthday, "1990-05-14");      // birthday reaches the payload (raw mapped column)
});

test("buildPersonalImportContacts omits birthday when no birthday column is mapped", () => {
  const rows = [{ contact: { fullName: "Bob", email: "bob@x.co" }, __raw: { Name: "Bob", Email: "bob@x.co" }, __map: { fullName: "Name", email: "Email" } }];
  const [c] = buildPersonalImportContacts(rows);
  assert.equal("birthday" in c, false);        // never fabricates a birthday
  assert.equal(c.name, "Bob");
});

// ---- the redesigned single Review surface (no defaults intermediary) ----
test("upload lands DIRECTLY on one Review surface — the defaults/decision funnel is gone", () => {
  assert.match(WIZ, /ReviewScreen/);
  assert.match(WIZ, /Review your contacts/);
  assert.match(WIZ, /rows && !summary/);                 // rows → Review (no intermediate stage state)
  // the old defaults-first / multi-step completion funnel is fully removed
  for (const gone of ["DecisionScreen", "Defaults were applied", "Review and change", "CompletionStep",
    "ReviewStep", "TypeRelationPicker", "StateChips", "PersonalCompletionFlow", "Search unresolved",
    "Needs a quick choice", "Optional details missing", 'stage === "decision"', 'setStage']) {
    assert.ok(!WIZ.includes(gone), `removed funnel artifact must be gone: ${gone}`);
  }
});

test("wizard commit builds the Review payload (ready rows only, boundary-enforced)", () => {
  assert.match(WIZ, /buildReviewPayload\(rows, reviewState\)/);       // completed commit path
  assert.ok(!/buildCompletedImportContacts\(/.test(WIZ), "payload building moved into reviewModel");
  assert.ok(!/name: r\.contact\.fullName, email: r\.contact\.email, relationship/.test(WIZ), "old 3-field mapping removed");
});

test("Review surface wires the plain-language controls (relationship / audience / advanced / remove)", () => {
  assert.match(WIZ, /ReviewRow/);
  assert.match(WIZ, /RelationshipLine/);
  assert.match(WIZ, /How do you know this person\?/);     // optional individual relationship control
  assert.match(WIZ, /Leave blank/);                       // valid relationship choice
  assert.match(WIZ, /AudiencePicker/);                    // universal required choice
  assert.match(WIZ, /We couldn't tell whether this contact is an employee, client, or vendor/);
  assert.match(WIZ, /AdvancedOptions/);                   // changeable defaults are collapsed
  assert.match(WIZ, /chooseRelationship|chooseAudience/); // pure updaters dispatched from controls
  assert.match(WIZ, /removeRow/);                         // remove a contact from this import
});

test("Review status + summary use plain language, not internal counters", () => {
  assert.match(WIZ, /\} ready`/);                       // "<n> contact(s) ready"
  assert.match(WIZ, /a required choice/);
  assert.match(WIZ, /will be skipped/);
  assert.match(WIZ, /Needs a name/);
  assert.match(WIZ, /Needs a valid email/);
  // finishing a sample says "View sample recipients" and never implies a production import
  assert.match(WIZ, /View sample recipients/);
});

// full wizard data path: processed rows → buildReview → buildReviewPayload behaves as the UI relies on.
test("end-to-end review pipeline: statuses, gate, and payload match the UI contract", () => {
  const raw = [
    { Name: "Ada", Email: "ada@x.co", Relationship: "sibling" },   // ready, recognized
    { Name: "Taylor", Email: "taylor@x.co", Relationship: "bestie" }, // ready, unrecognized (blank, not blocked)
    { Name: "", Email: "no@x.co" },                                 // needs a name
  ];
  const { mapping } = autoMapHeaders(Object.keys(raw[0]));
  const rows = raw.map((r, i) => ({ ...processRow(r, mapping, {}), index: i, __raw: r, __map: mapping }));
  const deduped = detectDuplicates(rows, []);
  const state = freshReviewState({ business: false, kind: null });
  const rev = buildReview(deduped, state);
  assert.equal(rev.summary.ready, 2);
  assert.equal(rev.summary.needsChoice, 0);              // blank relationship is never a required choice
  assert.equal(rev.importEnabled, true);
  const payload = buildReviewPayload(deduped, state);
  assert.equal(payload.length, 2);                        // the invalid-name row is excluded
  assert.equal(payload.every((p) => p.relationshipCloseness === "greetme_worthy"), true);
  assert.equal(payload.every((p) => p.recipientType === ""), true);   // individual carries no business type
});

test("Universal required-choice gate flows through the pure model the UI dispatches", () => {
  const rows = [
    { contact: { fullName: "A", email: "a@x.co", recipientType: "contractor" }, index: 0, __raw: {}, __map: {}, duplicate: null },
    { contact: { fullName: "B", email: "b@x.co", recipientType: "Employee" }, index: 1, __raw: {}, __map: {}, duplicate: null },
  ];
  let s = freshReviewState({ business: true, kind: "mixed" });
  assert.equal(buildReview(rows, s).importEnabled, false);        // one unknown audience blocks
  s = chooseAudience(s, 0, "skip");
  const rev = buildReview(rows, s);
  assert.equal(rev.items[0].status, REVIEW_STATUS.SKIPPED);
  assert.equal(rev.importEnabled, true);                          // resolved-or-skipped → enabled
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
  // and the Review surface excludes the duplicate from the import too
  const rev = buildReview(deduped, freshReviewState({ business: false, kind: null }));
  assert.equal(rev.items.find((i) => i.email === "ada@x.co").status, REVIEW_STATUS.DUPLICATE);
  assert.equal(buildReviewPayload(deduped, freshReviewState({})).some((p) => p.email === "ada@x.co"), false);
});

test("existing-email normalization is case-insensitive and whitespace-safe", () => {
  assert.deepEqual(normalizeExistingEmails([{ email: "  ADA@X.co " }, { email: "ada@x.co" }, { email: "" }, { email: null }, {}]), ["ada@x.co"]);
  const { deduped } = preview([{ Name: "A", Email: " Ada@X.CO " }], ["ada@x.co"]);
  assert.equal(deduped[0].duplicate, "existing_record");
});

test("failure to load existing contacts FAILS CLOSED (never treated as zero existing)", () => {
  assert.equal(existingEmailsFromResponse({ ok: false, status: 401 }).ok, false);              // auth
  assert.equal(existingEmailsFromResponse({ ok: false, status: 0, networkError: true }).ok, false); // network
  assert.equal(existingEmailsFromResponse(null).ok, false);                                     // no body
  assert.equal(existingEmailsFromResponse({ nope: 1 }).ok, false);                              // unrecognized shape
  assert.equal(extractContactsArray({ nope: 1 }), null);
  assert.deepEqual(existingEmailsFromResponse({ data: [] }), { ok: true, emails: [] });
  assert.deepEqual(existingEmailsFromResponse({ data: [{ email: "A@B.co" }] }), { ok: true, emails: ["a@b.co"] });
});

test("commit summary: 'Email already exists' shows as already-present, not needs-attention", () => {
  const c = classifyImportSummary({ added: 0, updated: 0, skipped: 0, failed: 1, errors: [{ contact: {}, error: "Email already exists" }] });
  assert.equal(c.alreadyPresent, 1);
  assert.equal(c.needsAttention, 0);
  const c2 = classifyImportSummary({ added: 1, failed: 2, errors: [{ error: "Email already exists" }, { error: "Invalid email address" }] });
  assert.equal(c2.added, 1);
  assert.equal(c2.alreadyPresent, 1);
  assert.equal(c2.needsAttention, 1);
});

test("wizard loads existing recipients for personal preview and FAILS CLOSED on lookup error", () => {
  assert.match(WIZ, /api\.getContacts\(\)/);                     // loads existing recipients
  assert.match(WIZ, /existingEmailsFromResponse/);
  assert.match(WIZ, /ingest\(data, existingEmails/);             // feeds dedup
  assert.match(WIZ, /Couldn't load your existing recipients/);   // fail-closed preview error
  assert.match(WIZ, /classifyImportSummary/);                    // truthful summary
  assert.match(WIZ, /already in your recipients/);
});

// ---- commit-outcome FAIL CLOSED (no more "Import complete — 0 added" on failure) ----
test("classifyCommitOutcome: only a recognized results body is a success", () => {
  const ok = classifyCommitOutcome({ ok: true, data: { imported: 1, failed: 0, errors: [] } });
  assert.equal(ok.status, "success");
  assert.equal(ok.summary.added, 1);
  const okZero = classifyCommitOutcome({ ok: true, data: { imported: 0, failed: 0, skipped: 1, errors: [] } });
  assert.equal(okZero.status, "success");
  assert.equal(classifyCommitOutcome({ data: { errors: [{ error: "x" }] } }).status, "success");
});

test("classifyCommitOutcome FAILS CLOSED for every failed/unrecognized response", () => {
  assert.equal(classifyCommitOutcome({ ok: false, status: 401 }).status, "error");
  assert.equal(classifyCommitOutcome({ ok: false, status: 404 }).status, "error");
  assert.equal(classifyCommitOutcome({ ok: false, status: 0, networkError: true }).status, "error");
  for (const s of [400, 403, 409, 429, 500, 502, 503, undefined]) {
    assert.equal(classifyCommitOutcome({ ok: false, status: s, error: "x" }).status, "error", `status ${s} must fail closed`);
  }
  assert.equal(classifyCommitOutcome({}).status, "error");
  assert.equal(classifyCommitOutcome({ ok: true }).status, "error");
  assert.equal(classifyCommitOutcome({ data: { foo: 1 } }).status, "error");
  assert.equal(classifyCommitOutcome(null).status, "error");
  assert.equal(classifyCommitOutcome(undefined).status, "error");
});

test("classifyCommitOutcome status-specific messages (401/403/429/other)", () => {
  assert.equal(classifyCommitOutcome({ ok: false, status: 401 }).message, "Your session expired. Please sign in again.");
  assert.equal(classifyCommitOutcome({ ok: false, status: 403 }).message, "Recipient/import limit reached.");
  assert.equal(classifyCommitOutcome({ ok: false, status: 429 }).message, "Too many requests. Please wait and try again.");
  assert.equal(classifyCommitOutcome({ ok: false, status: 500 }).message, "Import failed. Please try again.");
  assert.equal(commitMessageForStatus(403), COMMIT_MESSAGES[403]);
  assert.equal(commitMessageForStatus(999), COMMIT_MESSAGES.generic);
});

test("the exact production case (403) never renders a success summary", () => {
  const outcome = classifyCommitOutcome({ ok: false, status: 403, error: "Access denied" });
  assert.equal(outcome.status, "error");
  assert.equal(outcome.message, "Recipient/import limit reached.");
  assert.ok(!("summary" in outcome));
});

test("commitPersonal wiring: preserves thrown status, fail-closed via classifyCommitOutcome", () => {
  assert.match(WIZ, /catch \(e\) \{ res = \{ ok: false, status: e && e\.status/);   // status preserved
  assert.match(WIZ, /classifyCommitOutcome\(res\)/);                                 // decision layer used
  assert.match(WIZ, /if \(outcome\.status !== "success"\) \{ setError\(outcome\.message\); return; \}/); // fail closed
  assert.match(WIZ, /setSummary\(outcome\.summary\)/);                               // summary only on success
  assert.ok(!/setSummary\(summarizeImport\(res/.test(WIZ), "old unconditional summarize removed");
  assert.ok(!/res\.status === 403/.test(WIZ), "dead 403 guard removed");
});

// ---- source-scan invariants ----
test("org context never comes from user.id / useAuth", () => {
  assert.ok(!/user\??\.id/.test(WIZ), "must not read user.id");
  assert.ok(!/useAuth/.test(WIZ), "must not derive org from useAuth");
});

test("sample mode is send-safe and isolated (no send/gift/notify wiring; no real mix)", () => {
  assert.match(WIZ, /assertNoRealMix/);                 // never mixes demo + real
  assert.ok(!/\.send\(|sendGreeting|sendGift|notify\(|\/api\/[^"']*send/.test(WIZ), "no send/gift/notify calls");
  assert.match(WIZ, /Sample Mode — Nothing will be saved or sent/); // persistent sample indicator
});

test("no gift/payment/fundraising module imports; personal ownership via existing endpoint", () => {
  assert.ok(!/^import[^\n]*(gift|fundrais|payment|stripe|merch|pricing|checkout)/im.test(WIZ));
  assert.match(WIZ, /api\.importContacts/);             // personal → user's own collection
  assert.match(WIZ, /commitCorporate/);                 // corporate commit is gated (never writes)
});

test("does not import or modify the locked Recipients page (Contacts.jsx)", () => {
  assert.ok(!/pages\/Contacts|CSVImport/.test(WIZ), "must not touch the locked Recipients import path");
});

// ---- canonical entry CTAs + corporate routing + sample mode ----
test("corporateRoute maps every phase (dormant/ready/ineligible/select_org/loading/error)", () => {
  assert.equal(corporateRoute({ phase: "loading" }), "loading");
  assert.equal(corporateRoute({ phase: "dormant" }), "dormant");
  assert.equal(corporateRoute({ phase: "ready" }), "ready");
  assert.equal(corporateRoute({ phase: "select_org" }), "select_org");
  assert.equal(corporateRoute({ phase: "no_org" }), "ineligible");
  assert.equal(corporateRoute({ phase: "unauthorized" }), "ineligible");
  assert.equal(corporateRoute({ phase: "error" }), "error");
  assert.equal(corporateRoute(null), "error");
});

test("entry contains EXACTLY two primary paths: Individual and Business (keyboard/pointer buttons)", () => {
  assert.match(WIZ, /pickMode\(MODES\.PERSONAL\)\}><b>Individual<\/b>/);
  assert.match(WIZ, /Import family, friends, and other people you personally want to remember/);
  assert.match(WIZ, /pickMode\(MODES\.CORPORATE\)\}><b>Business<\/b>/);
  assert.match(WIZ, /Import employees, clients, vendors, or a mixed organization list/);
  assert.equal((WIZ.match(/onClick=\{\(\) => pickMode\(MODES\.(PERSONAL|CORPORATE)\)\}/g) || []).length, 2);
  assert.ok(!/Try a Sample Import/.test(WIZ), "Sample must not be a third entry user-type");
});

test("Individual entry has no business-only language; Business has the four recipient types", () => {
  assert.ok(!/<b>Individual<\/b><div style=\{sub\}>[^<]*(employee|vendor|campaign)/i.test(WIZ));
  assert.match(WIZ, /Employees \/ Personnel/);
  assert.match(WIZ, /Universal List/);
  assert.match(WIZ, /RECIPIENT_KINDS\.map/);
});

test("dormant corporate state is truthful, recoverable, and never 'coming soon'", () => {
  assert.match(WIZ, /Organization import is currently turned off/);
  assert.ok(!/coming soon/i.test(WIZ), "must not say 'coming soon'");
  assert.match(WIZ, /Return to Import Options/);
  assert.match(WIZ, /Explore Sample Import/);
  assert.match(WIZ, /navigate\("\/business"\)/);
});

test("Sample Workspace: session-scoped, zero API mutations, cleanup + Sample Recipients", () => {
  assert.match(WIZ, /trySample/);
  assert.match(WIZ, /downloadSampleCsv/);
  assert.match(WIZ, /Download Greet-Me sample CSV/);
  assert.match(WIZ, /Try the sample/);
  assert.match(WIZ, /saveSampleWorkspace/);              // sessionStorage only
  assert.match(WIZ, /clearSampleWorkspace/);             // cleanup
  assert.match(WIZ, /SampleRecipientsView/);             // routes to Sample Recipients
  assert.match(WIZ, /Sample Mode — nothing has been saved or sent/);   // persistent banner
  assert.match(WIZ, /Delete all sample contacts/);
  assert.match(WIZ, /Exit Sample Mode/);
  assert.match(WIZ, /auth:session-expired/);             // clears sample on session expiry
  // sample cannot escape into a live commit: exactly ONE api.importContacts CALL (commitPersonal).
  assert.equal((WIZ.match(/api\.importContacts\(/g) || []).length, 1);
  assert.match(WIZ, /sample \? commitSample :/);         // sample → commitSample (never the importer)
  const fn = (WIZ.match(/const commitSample = useCallback\(\(\) => \{[\s\S]*?\}, \[sample/) || [""])[0];
  assert.ok(fn.length > 0 && !/api\./.test(fn) && /saveSampleWorkspace\(/.test(fn), "commitSample: no API, sessionStorage only");
});

test("Greet-Me Worthy is the default Description applied without friction", () => {
  // the default lives in the review model (freshReviewState) and reaches the payload with no interaction
  assert.equal(buildReviewPayload([{ contact: { fullName: "A", email: "a@x.co" }, index: 0, __raw: {}, __map: {}, duplicate: null }],
    freshReviewState({})).at(0).relationshipCloseness, "greetme_worthy");
});
