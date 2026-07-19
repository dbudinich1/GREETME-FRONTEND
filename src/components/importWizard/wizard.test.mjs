// src/components/importWizard/wizard.test.mjs — Run: node --test src/components/importWizard/wizard.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODES, corporateContext, commitTarget, canSelectFile, commitDecision, STEPS, buildPersonalImportContacts,
  extractContactsArray, normalizeExistingEmails, existingEmailsFromResponse, classifyImportSummary,
  classifyCommitOutcome, commitMessageForStatus, COMMIT_MESSAGES, corporateRoute } from "./wizardModel.js";
import { autoMapHeaders, processRow, detectDuplicates, buildPlan } from "../../import/importCore.js";
import { buildReview, buildReviewPayload, freshReviewState, setEmail, chooseAudience, REVIEW_BUCKET } from "../../import/reviewModel.js";

const WIZ = readFileSync(new URL("./ContactImportWizard.jsx", import.meta.url), "utf8");
const TODAY = "2026-07-18";

function preview(rawRows, existingEmails = []) {
  const headers = Object.keys(rawRows[0] || {});
  const { mapping } = autoMapHeaders(headers);
  const processed = rawRows.map((raw, i) => ({ ...processRow(raw, mapping, { todayIso: TODAY }), index: i, __raw: raw, __map: mapping }));
  const deduped = detectDuplicates(processed, existingEmails);
  const plan = buildPlan(deduped, { duplicateStrategy: "skip" });
  return { deduped, plan, payload: buildPersonalImportContacts(plan.toCreate) };
}
const memb = (arr) => ({ ok: true, data: { memberships: arr } });
const A = (id, role = "admin") => ({ corporateOrganizationId: id, role, status: "active" });

// ---- wizardModel (unchanged) ----
test("commit targets: personal writes; corporate needs org; demo never writes / never uses a user id", () => {
  assert.deepEqual(commitTarget(MODES.PERSONAL), { kind: "personal", write: true });
  assert.deepEqual(commitTarget(MODES.CORPORATE, { orgId: "corp_org_1" }), { kind: "corporate", orgId: "corp_org_1", write: true });
  assert.deepEqual(commitTarget(MODES.CORPORATE, {}), { kind: "corporate", orgId: null, write: false });
  const demo = commitTarget(MODES.DEMO, { orgId: "x" });
  assert.equal(demo.write, false);
  assert.equal("orgId" in demo, false);
});
test("canSelectFile: personal/demo always; corporate requires resolved active org", () => {
  assert.equal(canSelectFile(MODES.PERSONAL, null), true);
  assert.equal(canSelectFile(MODES.DEMO, null), true);
  assert.equal(canSelectFile(MODES.CORPORATE, { phase: "select_org" }), false);
  assert.equal(canSelectFile(MODES.CORPORATE, { phase: "ready" }), true);
});
test("corporateContext delegates to Phase A5 resolution", () => {
  assert.equal(corporateContext(memb([])).phase, "no_org");
  assert.equal(corporateContext(memb([A("corp_org_1")])).phase, "ready");
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
  const rows = [{ contact: { fullName: "Ada Lovelace", email: "ada@x.co", phone: "+15551112222" }, __raw: { Name: "Ada Lovelace", Email: "ada@x.co", DOB: "1990-05-14" }, __map: { fullName: "Name", email: "Email", birthday: "DOB" } }];
  const [c] = buildPersonalImportContacts(rows);
  assert.equal(c.name, "Ada Lovelace"); assert.equal(c.birthday, "1990-05-14");
});

// ---- CONFIRMATION-FIRST surface (Individual two-screen flow) ----
test("upload lands on a confirmation, not a walkthrough/decision funnel", () => {
  assert.match(WIZ, /ReviewScreen/);
  assert.match(WIZ, /Review your contacts/);              // real heading
  assert.match(WIZ, /Preview your sample contacts/);      // sample heading
  assert.match(WIZ, /confirm-screen/);
  // the mandatory walkthrough + defaults funnel + prior framing are gone
  for (const gone of ["Defaults were applied", "DecisionScreen", "AttentionCard", "need your attention",
    "Save &amp; next", "Contact {progress", "needing review", "StateChips"]) {
    assert.ok(!WIZ.includes(gone), `removed artifact must be gone: ${gone}`);
  }
});
test("Individual two-screen flow: real primary 'Add X'; individual sample = terminal action bar; no wizard result screen", () => {
  assert.match(WIZ, /Add \$\{importCount\} contact/);      // real primary
  assert.match(WIZ, /add-cta/);
  assert.match(WIZ, /details-cta/);                        // quiet optional relationship CTA
  assert.match(WIZ, /Add relationship details first/);
  // individual sample is terminal on the combined screen (action bar, NO commit/View CTA there)
  assert.match(WIZ, /sample-upload-own/);
  assert.match(WIZ, /Upload my own CSV/);
  assert.match(WIZ, /sample-delete/);
  assert.match(WIZ, /sample-exit/);
  assert.match(WIZ, /isIndividualSample/);
  // real full success navigates straight to Recipients with a truthful toast — NO result/list screen
  assert.match(WIZ, /added successfully\./);
  assert.match(WIZ, /showManualToast\(/);
  assert.match(WIZ, /returnToRecipients\(\);\s*\n\s*return;/);   // navigate then stop
  assert.ok(!/function ImportSummary/.test(WIZ), "dead Individual result screen removed");
  assert.ok(!/function ListActions/.test(WIZ), "dead ListActions removed");
  // "View X sample recipients" survives ONLY for the Business sample path (unchanged)
  assert.match(WIZ, /View \{importCount\} sample recipient/);
});
test("partial real import stays on the combined screen; added rows can't be re-submitted", () => {
  assert.match(WIZ, /setPartial\(/);
  assert.match(WIZ, /data-testid="partial"/);
  assert.match(WIZ, /could not be added/);
  assert.match(WIZ, /markCommitted\(/);                    // added emails → ADDED bucket (excluded)
  assert.match(WIZ, /setCommitErrors\(/);
  assert.match(WIZ, /if \(!contacts\.length\) return;/);   // never POST an empty payload
});
test("genuine blockers only: quick-fix area with plain messages + Don't add", () => {
  assert.match(WIZ, /quickfix/);
  assert.match(WIZ, /need a quick fix before they can be added/);
  assert.match(WIZ, /Don't add this contact/);
  assert.match(WIZ, /QuickFixRow/);
  assert.match(WIZ, /fix-email-input/);
  assert.match(WIZ, /fix-birthday-input/);
  assert.match(WIZ, /fix-audience-select/);
});
test("optional relationship editor uses the three canonical controls + helper text", () => {
  assert.match(WIZ, /details-screen/);
  assert.match(WIZ, /Relationship group/);
  assert.match(WIZ, /Is this person family, a friend, or a professional contact\?/);
  assert.match(WIZ, /Choose the specific relationship\./);
  assert.match(WIZ, /How close are you\?/);
  assert.match(WIZ, /This helps Greet-Me personalize the greeting\./);
  assert.match(WIZ, /A thoughtful standard greeting suitable for most relationships\./);
  assert.match(WIZ, /Relationship not provided \(optional\)/);   // Morgan Doe rule
});
test("no internal taxonomy/status vocabulary leaks into the UI copy", () => {
  // Forbidden as VISIBLE COPY. (Data-field access like `c.recipientType` is fine; payload keys live in
  // the model.) The component must not compare or display internal validation codes.
  for (const jargon of ["relationshipCategory", "relationshipProfile", "relationshipCloseness",
    "Optional details missing", "Needs attention", "minor_blocked", "needs_audience", "blockerCode ==="]) {
    assert.ok(!WIZ.includes(jargon), `UI must not surface: ${jargon}`);
  }
});

// ---- audit fixes wired in the container ----
test("F1: processRow is called with a real date (never todayIso: undefined)", () => {
  assert.ok(!/todayIso:\s*undefined/.test(WIZ), "the age gate must never be disabled");
  assert.match(WIZ, /processRow\([^)]*\{ todayIso: today \}/);
  assert.match(WIZ, /todayIso = \(\) => new Date\(\)/);
  assert.match(WIZ, /freshReviewState\(\{ business, kind, existingEmails, todayIso: today \}\)/);
});
test("Start Over fully resets to the selection screen (mode/kind/sample cleared)", () => {
  const fn = (WIZ.match(/const startOver = \(\) => \{[\s\S]*?\};/) || [""])[0];
  for (const clr of ["setMode(null)", "setRecipientKind(null)", "setSample(false)", "setRows(null)", "freshReviewState"]) {
    assert.ok(fn.includes(clr), `startOver must ${clr}`);
  }
  assert.match(WIZ, /back=\{startOver\}/);                 // header wired to full reset
  assert.match(WIZ, /onStartOver=\{startOver\}/);
});
test("wizard commit builds the ready-only payload; no old 3-field mapping", () => {
  assert.match(WIZ, /buildReviewPayload\(rows, reviewState\)/);
  assert.ok(!/buildCompletedImportContacts\(/.test(WIZ));
});

// ---- end-to-end pipeline through the new model ----
test("end-to-end: buckets exclusive, minor blocked, inline email edit re-dedups", () => {
  const raw = [
    { Name: "Ada", Email: "ada@x.co", Relationship: "sibling", DOB: "1990-05-14" },  // ready
    { Name: "Kid", Email: "kid@x.co", DOB: "2018-01-01" },                            // minor → needs fix
    { Name: "", Email: "no@x.co" },                                                   // needs a name
  ];
  const { mapping } = autoMapHeaders(Object.keys(raw[0]).concat("DOB"));
  const rows = raw.map((r, i) => ({ ...processRow(r, mapping, { todayIso: TODAY }), index: i, __raw: r, __map: mapping }));
  const deduped = detectDuplicates(rows, []);
  const st = freshReviewState({ existingEmails: ["taken@x.co"], todayIso: TODAY });
  const rev = buildReview(deduped, st);
  const sum = rev.counts.ready + rev.counts.needsFix + rev.counts.alreadyInList + rev.counts.willSkip + rev.counts.invalidExcluded;
  assert.equal(sum, rev.counts.total);
  assert.equal(rev.counts.ready, 1);
  assert.equal(rev.counts.needsFix, 2);
  assert.equal(buildReviewPayload(deduped, st).length, 1);           // valid row imports while blockers remain
  // inline edit an email to an existing recipient → moves out of ready
  const st2 = setEmail(freshReviewState({ existingEmails: ["ada@x.co"], todayIso: TODAY }), 0, "ada@x.co");
  assert.equal(buildReview(deduped, st2).items[0].bucket, REVIEW_BUCKET.ALREADY_IN_LIST);
});
test("Universal unknown audience is a required fix; single-type kinds are auto", () => {
  const uni = [{ contact: { fullName: "A", email: "a@x.co", recipientType: "contractor" }, index: 0, __raw: {}, __map: {} }];
  const rev = buildReview(uni, freshReviewState({ business: true, kind: "mixed", todayIso: TODAY }));
  assert.equal(rev.items[0].bucket, REVIEW_BUCKET.NEEDS_FIX);
  const s = chooseAudience(freshReviewState({ business: true, kind: "mixed", todayIso: TODAY }), 0, "client");
  assert.equal(buildReview(uni, s).items[0].bucket, REVIEW_BUCKET.READY);
  const emp = buildReview([{ contact: { fullName: "A", email: "a@x.co", recipientType: "" }, index: 0, __raw: {}, __map: {} }], freshReviewState({ business: true, kind: "employee", todayIso: TODAY }));
  assert.equal(emp.items[0].bucket, REVIEW_BUCKET.READY);
  assert.equal(emp.items[0].audience, "employee");
});

// ---- existing-recipient awareness + fail-closed (unchanged model behavior) ----
test("existing account email → duplicate + skipped + excluded from payload", () => {
  const existing = normalizeExistingEmails([{ email: "  ADA@X.co " }]);
  const { deduped, plan, payload } = preview([
    { Name: "Ada", Email: "ada@x.co", Birthday: "1990-11-01" },
    { Name: "New", Email: "new@x.co", Birthday: "1992-03-04" },
  ], existing);
  assert.equal(deduped[0].duplicate, "existing_record");
  assert.ok(!payload.some((p) => p.email === "ada@x.co"));
  // the confirmation surface also excludes it
  const rev = buildReview(deduped, freshReviewState({ existingEmails: existing, todayIso: TODAY }));
  assert.equal(rev.items.find((i) => i.email === "ada@x.co").bucket, REVIEW_BUCKET.ALREADY_IN_LIST);
});
test("failure to load existing contacts FAILS CLOSED", () => {
  assert.equal(existingEmailsFromResponse({ ok: false, status: 401 }).ok, false);
  assert.equal(existingEmailsFromResponse(null).ok, false);
  assert.equal(extractContactsArray({ nope: 1 }), null);
  assert.deepEqual(existingEmailsFromResponse({ data: [] }), { ok: true, emails: [] });
});
test("commit summary: 'Email already exists' shows as already-present", () => {
  const c = classifyImportSummary({ failed: 1, errors: [{ error: "Email already exists" }] });
  assert.equal(c.alreadyPresent, 1); assert.equal(c.needsAttention, 0);
});
test("wizard loads existing recipients and FAILS CLOSED on lookup error", () => {
  assert.match(WIZ, /api\.getContacts\(\)/);
  assert.match(WIZ, /existingEmailsFromResponse/);
  assert.match(WIZ, /Couldn't load your existing recipients/);
});
test("classifyCommitOutcome: only a recognized results body is a success; else fail closed", () => {
  assert.equal(classifyCommitOutcome({ ok: true, data: { imported: 1, errors: [] } }).status, "success");
  for (const s of [400, 401, 403, 429, 500, undefined]) assert.equal(classifyCommitOutcome({ ok: false, status: s }).status, "error");
  assert.equal(classifyCommitOutcome({}).status, "error");
  assert.equal(classifyCommitOutcome({ ok: false, status: 403 }).message, "Recipient/import limit reached.");
  assert.equal(commitMessageForStatus(999), COMMIT_MESSAGES.generic);
});
test("commitPersonal wiring: preserves thrown status, fail-closed", () => {
  assert.match(WIZ, /catch \(e\) \{ res = \{ ok: false, status: e && e\.status/);
  assert.match(WIZ, /classifyCommitOutcome\(res\)/);
  assert.match(WIZ, /if \(outcome\.status !== "success"\) \{ setError\(outcome\.message\); return; \}/);
});

// ---- entry, corporate, sample invariants ----
test("org context never comes from user.id / useAuth", () => {
  assert.ok(!/user\??\.id/.test(WIZ));
  assert.ok(!/useAuth/.test(WIZ));
});
test("Screen 1: two premium path panels; Personal opens Screen 2, Business keeps the existing route", () => {
  assert.match(WIZ, /panel-personal[\s\S]*?onClick=\{\(\) => setEntryView\("group"\)\}/);       // Personal → Screen 2
  assert.match(WIZ, /panel-business[\s\S]*?onClick=\{\(\) => pickMode\(MODES\.CORPORATE\)\}/);   // Business → existing flow
  assert.equal((WIZ.match(/data-testid="panel-(personal|business)"/g) || []).length, 2);
  // entering the Individual flow still goes through the unchanged pickMode(PERSONAL) — only via Screen 2
  assert.match(WIZ, /choosePersonalGroup = \(group\) => \{[\s\S]*?pickMode\(MODES\.PERSONAL\)/);
});
test("Business has the four recipient types; dormant corporate is truthful", () => {
  assert.match(WIZ, /Employees \/ Personnel/);
  assert.match(WIZ, /Universal List/);
  assert.match(WIZ, /RECIPIENT_KINDS\.map/);
  assert.match(WIZ, /Organization import is currently turned off/);
  assert.ok(!/coming soon/i.test(WIZ));
});
test("corporateRoute maps every phase", () => {
  assert.equal(corporateRoute({ phase: "dormant" }), "dormant");
  assert.equal(corporateRoute({ phase: "ready" }), "ready");
  assert.equal(corporateRoute({ phase: "no_org" }), "ineligible");
  assert.equal(corporateRoute(null), "error");
});
test("no gift/payment/fundraising imports; personal ownership via existing endpoint", () => {
  assert.ok(!/^import[^\n]*(gift|fundrais|payment|stripe|merch|pricing|checkout)/im.test(WIZ));
  assert.match(WIZ, /api\.importContacts/);
  assert.match(WIZ, /commitCorporate/);
});
test("does not import or modify the locked Recipients page (Contacts.jsx)", () => {
  assert.ok(!/pages\/Contacts|CSVImport/.test(WIZ));
});
test("Sample Workspace: session-scoped, zero API mutations, cleanup", () => {
  assert.match(WIZ, /trySample/);
  assert.match(WIZ, /saveSampleWorkspace/);
  assert.match(WIZ, /clearSampleWorkspace/);
  assert.match(WIZ, /SampleRecipientsView/);
  assert.match(WIZ, /Sample Mode — Nothing will be saved or sent/);
  assert.match(WIZ, /Delete all sample contacts/);
  assert.match(WIZ, /Exit Sample Mode/);
  assert.match(WIZ, /auth:session-expired/);
  assert.equal((WIZ.match(/api\.importContacts\(/g) || []).length, 1);
  assert.match(WIZ, /sample \? commitSample :/);
  const fn = (WIZ.match(/const commitSample = useCallback\(\(\) => \{[\s\S]*?\}, \[sample/) || [""])[0];
  assert.ok(fn.length > 0 && !/api\./.test(fn) && /saveSampleWorkspace\(/.test(fn), "commitSample: no API, sessionStorage only");
});

// ---- Screen 1 premium visual refinement (path-selection only; no mechanics) ----
test("premium banner: branded title + tagline + eyebrow + wand; old IMPORT eyebrow removed", () => {
  assert.match(WIZ, /Greet-Me™ Import Wizard/);                       // 1
  assert.match(WIZ, /Forget Them Not!/);                              // 2
  assert.match(WIZ, /A PREMIUM GREET-ME EXPERIENCE/);                 // 5
  assert.match(WIZ, /wand-icon/);                                     // 4
  assert.match(WIZ, /function WandSparkles/);
  assert.ok(!/>Contact Import Wizard</.test(WIZ), "old banner title element removed");
  // the old monospace uppercase "Import" eyebrow div is gone (3)
  assert.ok(!/letterSpacing: "\.14em"[^}]*\}\}>Import<\/div>/.test(WIZ));
  assert.ok(!/>Import<\/div>/.test(WIZ), "small IMPORT eyebrow removed");
});
test("main heading + no explanatory subscript", () => {
  assert.match(WIZ, /Import Those Important to You/);                 // 6
  assert.ok(!/How would you like to import\?/.test(WIZ), "old heading removed");
  assert.ok(!/Choose the path that best describes/.test(WIZ), "no explanatory subscript");  // 7
});
test("exact panel copy (Personal + Business) + CTAs + footer", () => {
  assert.match(WIZ, /Personal Relationships/);                       // 9
  assert.match(WIZ, /Family, friends, and whoever is important to you\./);
  assert.match(WIZ, /CHOOSE PERSONAL →/);
  assert.match(WIZ, /Business Relationships/);                       // 10
  assert.match(WIZ, /Employees, clients, vendors, and professional contacts\./);
  assert.match(WIZ, /CHOOSE BUSINESS →/);
  assert.match(WIZ, /You can return and choose a different path at any time\./);   // footer
});
test("premium underlay + panel visuals + accessible/interactive styles present", () => {
  assert.match(WIZ, /gmiw-underlay/);                                // colored underlay
  assert.match(WIZ, /gmiw-surface/);                                 // inner content surface
  assert.match(WIZ, /grid-template-columns:1fr 1fr/);                // side-by-side on desktop
  assert.match(WIZ, /@media \(max-width:640px\)[\s\S]*?grid-template-columns:1fr;/);  // stacks on mobile
  assert.match(WIZ, /\.gmiw-panel:focus-visible\{ outline:/);        // visible focus
  assert.match(WIZ, /\.gmiw-panel:hover/);
  assert.match(WIZ, /\.gmiw-panel:active/);
  assert.match(WIZ, /gmiw-medallion/);                               // circular medallion
  assert.match(WIZ, /function HeartIcon/);
  assert.match(WIZ, /function BriefcaseIcon/);
});
test("panels are semantic buttons with full accessible names", () => {
  assert.match(WIZ, /type="button" className="gmiw-panel" data-testid="panel-personal"/);
  assert.match(WIZ, /aria-label="Personal Relationships — Family, friends, and whoever is important to you"/);
  assert.match(WIZ, /aria-label="Business Relationships — Employees, clients, vendors, and professional contacts"/);
});
test("no wizard mechanics changed by the visual screen (still one importer, dedup, fail-closed intact)", () => {
  assert.equal((WIZ.match(/api\.importContacts\(/g) || []).length, 1);
  assert.match(WIZ, /classifyCommitOutcome\(res\)/);
  assert.match(WIZ, /existingEmailsFromResponse/);
  assert.match(WIZ, /buildReviewPayload\(rows, reviewState\)/);
});

// ---- Screen 2 — Personal relationship group (Family / Friends / Professional) ----
test("Screen 2 banner + heading exact copy", () => {
  assert.match(WIZ, /eyebrow="PERSONAL RELATIONSHIPS"/);
  assert.match(WIZ, /Who Are You Importing\?/);
  // reuses the same premium banner/underlay language (Greet-Me title + tagline live in Shell)
  assert.match(WIZ, /entryView === "group"/);
});
test("Screen 2 has EXACTLY Family, Friends, Professional with exact copy + CTAs", () => {
  assert.match(WIZ, /value: "family", title: "Family", copy: "Parents, children, siblings, partners, and extended family\.", cta: "CHOOSE FAMILY →"/);
  assert.match(WIZ, /value: "friend", title: "Friends", copy: "Best friends, neighbors, teammates, and classmates\.", cta: "CHOOSE FRIENDS →"/);
  assert.match(WIZ, /value: "professional", title: "Professional", copy: "Colleagues, mentors, and work connections important to you\.", cta: "CHOOSE PROFESSIONAL →"/);
  assert.equal((WIZ.match(/value: "(family|friend|professional)",/g) || []).length, 3);
  assert.match(WIZ, /gmiw-panels--three/);                       // three side-by-side on desktop
  assert.match(WIZ, /Icon: HomeIcon/); assert.match(WIZ, /Icon: HeartIcon/); assert.match(WIZ, /Icon: BriefcaseIcon/);
});
test("Screen 2 selection stores context only (no invented data) and enters the unchanged Individual flow", () => {
  // choosePersonalGroup sets context + pickMode(PERSONAL); it does NOT set a relationship or recipientType
  assert.match(WIZ, /choosePersonalGroup = \(group\) => \{ setPersonalGroup\(group\); setEntryView\("path"\); pickMode\(MODES\.PERSONAL\); \}/);
  assert.ok(!/setPersonalGroup[\s\S]{0,80}relationshipCategory/.test(WIZ), "group never becomes a relationship category");
  // personalGroup is not threaded into the payload/model (context only)
  assert.ok(!/freshReviewState\([^)]*personalGroup/.test(WIZ));
  assert.ok(!/buildReviewPayload\([^)]*personalGroup/.test(WIZ));
});
test("Screen 2 Back + upload Change + Start-Over clear/route correctly", () => {
  assert.match(WIZ, /← Back to Personal or Business/);
  assert.match(WIZ, /backToPath = \(\) => \{ setEntryView\("path"\); setPersonalGroup\(null\); \}/);
  assert.match(WIZ, /change-group/);
  assert.match(WIZ, /changePersonalGroup = \(\) => \{[\s\S]*?setEntryView\("group"\)/);
  assert.match(WIZ, /setEntryView\("path"\); setPersonalGroup\(null\);\s*\/\/ back to Screen 1/);   // startOver clears context
});
test("upload screen reflects the chosen Personal group + Change link (no upload/review redesign)", () => {
  assert.match(WIZ, /upload-context/);
  assert.match(WIZ, /Import Family Contacts/);
  assert.match(WIZ, /Import Friends/);
  assert.match(WIZ, /Import Professional Relationships/);
  assert.match(WIZ, /personalGroupMeta && \(/);
});
test("Personal Professional stays Individual (recipientType blank) — never the Business Wizard", () => {
  // Professional group → pickMode(PERSONAL) (individual), so applyRecipientTypes/boundary keeps recipientType ""
  const payload = buildReviewPayload([{ contact: { fullName: "P", email: "p@x.co", recipientType: "vendor" }, index: 0, __raw: {}, __map: {} }],
    freshReviewState({ business: false, kind: null, todayIso: TODAY }));
  assert.equal(payload[0].recipientType, "");
});
