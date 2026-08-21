// src/components/importWizard/wizard.test.mjs — Run: node --test src/components/importWizard/wizard.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withOccasionDates } from "./wizardModel.js";
import { MODES, corporateContext, commitTarget, canSelectFile, commitDecision, STEPS, buildPersonalImportContacts,
  extractContactsArray, normalizeExistingEmails, existingEmailsFromResponse, classifyImportSummary,
  classifyCommitOutcome, commitMessageForStatus, COMMIT_MESSAGES, corporateRoute } from "./wizardModel.js";
import { autoMapHeaders, processRow, detectDuplicates, buildPlan, CANONICAL_FIELDS } from "../../import/importCore.js";
import { buildCorporatePayload } from "../../import/corporateCommit.js";
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
  assert.match(WIZ, /Preview your practice contacts/);    // practice heading
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
  // The Test Drive review's primary CTA opens the fictional contacts in the Recipients Practice View
  assert.match(WIZ, /view-practice-recipients/);
  assert.match(WIZ, /View Practice Contacts in Recipients/);
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
test("Screen 1: two premium path panels; Personal opens Screen 2, Business opens its OWN Screen 2", () => {
  assert.match(WIZ, /panel-personal[\s\S]*?onClick=\{\(\) => setEntryView\("group"\)\}/);       // Personal → Screen 2
  assert.match(WIZ, /panel-business[\s\S]*?onClick=\{\(\) => setEntryView\("bizgroup"\)\}/);     // Business → Business Screen 2
  assert.equal((WIZ.match(/data-testid="panel-(personal|business)"/g) || []).length, 2);
  // entering the Individual flow still goes through the unchanged pickMode(PERSONAL) — only via Screen 2
  assert.match(WIZ, /choosePersonalGroup = \(group\) => \{[\s\S]*?pickMode\(MODES\.PERSONAL\)/);
});
test("Business mirrors Personal: Employees/Clients/Vendors tiles; NO Universal List primary tile; dormant is truthful", () => {
  // the three canonical Business tiles (exact copy + CTAs), driven by BUSINESS_GROUPS
  assert.match(WIZ, /value: "employee", title: "Employees", copy: "Employees, personnel, departments, and workplace contacts\.", cta: "CHOOSE EMPLOYEES →"/);
  assert.match(WIZ, /value: "client", title: "Clients", copy: "Clients, customers, companies, and important customer contacts\.", cta: "CHOOSE CLIENTS →"/);
  assert.match(WIZ, /value: "vendor", title: "Vendors", copy: "Vendors, suppliers, service providers, and business partners\.", cta: "CHOOSE VENDORS →"/);
  assert.equal((WIZ.match(/value: "(employee|client|vendor)", title:/g) || []).length, 3);
  assert.match(WIZ, /entryView === "bizgroup"/);
  assert.match(WIZ, /biz-panels/);
  assert.match(WIZ, /eyebrow="BUSINESS RELATIONSHIPS"/);
  // Universal List / the old recipient-type selector are NOT on the entry surface anymore
  assert.ok(!/Universal List/.test(WIZ), "no Universal List primary tile on the Business entry surface");
  assert.ok(!/RECIPIENT_KINDS/.test(WIZ), "old RECIPIENT_KINDS selector removed from the wizard surface");
  assert.ok(!/Employees \/ Personnel/.test(WIZ), "old plain recipient-type list removed");
  // real Business import stays dormant/fail-closed with a truthful state (no "coming soon"). A genuine
  // (unmarked) business CSV → dormant; only a marked Practice CSV goes to Test Drive.
  assert.match(WIZ, /Organization import is currently turned off/);
  assert.match(WIZ, /const onBusinessRealFile = useCallback\(async \(file\) => \{/);
  assert.match(WIZ, /if \(source === "business"\) \{[\s\S]*?setCorporatePreview\(\{ items, kindLabel \}\);[\s\S]*?return;/);   // Slice 2B-1: genuine business file → COMMIT-FREE preview
  assert.match(WIZ, /biz-dormant/);
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
  assert.match(WIZ, /Safe practice mode — Nothing will be saved or sent/);
  assert.match(WIZ, /Delete practice contacts/);
  assert.match(WIZ, /Exit Test Drive/);
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
  assert.match(WIZ, /\.gmiw-panels\{ display:grid; grid-template-columns:repeat\(auto-fit/);   // container-responsive: 2-up on desktop
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
  // Family copy amended: "partners" removed (superseded term). Exact new sentence, nothing substituted.
  assert.match(WIZ, /value: "family", title: "Family", copy: "Parents, children, siblings, and extended family\.", cta: "CHOOSE FAMILY →"/);
  assert.ok(!/Parents, children, siblings, partners/.test(WIZ), "superseded 'partners' Family copy is gone");
  assert.ok(!/partners, and extended family/.test(WIZ), "no 'partners' anywhere in the Family sentence");
  assert.ok(!/(partner|spouse)[^A-Za-z]*and extended family/i.test(WIZ), "no partner/spouse substitution");
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
test("upload screen reflects the chosen category with canonical '...Contacts' headings (Personal + Business)", () => {
  assert.match(WIZ, /upload-context/);
  // canonical Personal headings (source: PERSONAL_GROUPS.uploadHeading)
  assert.match(WIZ, /uploadHeading: "Import Family Contacts"/);
  assert.match(WIZ, /uploadHeading: "Import Friend Contacts"/);
  assert.match(WIZ, /uploadHeading: "Import Professional Contacts"/);
  // canonical Business headings (source: BUSINESS_GROUPS.uploadHeading)
  assert.match(WIZ, /uploadHeading: "Import Employee Contacts"/);
  assert.match(WIZ, /uploadHeading: "Import Client Contacts"/);
  assert.match(WIZ, /uploadHeading: "Import Vendor Contacts"/);
  // the old/inconsistent Personal headings are gone
  assert.ok(!/Import Friends\b/.test(WIZ), "old 'Import Friends' heading removed");
  assert.ok(!/Import Professional Relationships/.test(WIZ), "old 'Import Professional Relationships' heading removed");
  // exactly six heading sources (3 Personal + 3 Business), each rendered once via a single shared site
  assert.equal((WIZ.match(/uploadHeading:/g) || []).length, 6);
  assert.equal((WIZ.match(/activeGroupMeta\.uploadHeading/g) || []).length, 1);
  assert.match(WIZ, /activeGroupMeta && \(/);
});
test("Upload Options: unnumbered Upload/Test-Drive sections; numbering ONLY inside two Test Drive tiles", () => {
  // Normal Upload + Safe practice mode headings carry NO parent OPTION label (numbering moved into the
  // Test Drive tiles, whose testids are td-option-N-label — distinct from the old parent option-N-label).
  assert.ok(!/"option-1-label"/.test(WIZ), "no parent OPTION 1 label on the Upload section");
  assert.ok(!/"option-2-label"/.test(WIZ), "no parent OPTION 2 label on the Test Drive section");
  assert.match(WIZ, /Upload your contacts/);
  assert.match(WIZ, /Upload an Excel or CSV file\. Accepted formats: \.xlsx, \.xls, or \.csv \(\.xlsx recommended[\s\S]*?Only a name and valid email are required\. You can review and edit everything as needed before importing, and you can edit or update recipients at any time in the future\./);
  assert.ok(!/as need be/.test(WIZ), "uses 'as needed', not 'as need be'");
  assert.match(WIZ, /choose-csv/);
  assert.match(WIZ, /data-testid="upload-or"><span>OR<\/span>/);      // page-level divider between upload and practice
  assert.match(WIZ, /Safe practice mode/);
  assert.match(WIZ, /Test Drive the Import Wizard/);
  assert.match(WIZ, /See the complete import process using fictional contacts\. Nothing will be saved or sent\./);
  // the old bullet list is GONE
  assert.ok(!/Download the Practice CSV and upload it yourself\./.test(WIZ), "old bullet 1 removed");
  assert.ok(!/Start test drive instantly with the Practice CSV already loaded\./.test(WIZ), "old bullet 2 removed");
  assert.ok(!/<ul>[\s\S]*?Practice CSV[\s\S]*?<\/ul>/.test(WIZ), "no Practice-CSV bullet list");
  // TWO numbered Test Drive choice tiles inside the practice container, with an internal OR between them
  assert.match(WIZ, /testdrive-option-1[\s\S]*?td-option-1-label[^>]*>OPTION 1[\s\S]*?Download and upload a practice file[\s\S]*?Download Practice Excel Workbook[\s\S]*?Download Practice CSV/);
  assert.match(WIZ, /testdrive-or"><span>OR<\/span>/);
  assert.match(WIZ, /testdrive-option-2[\s\S]*?td-option-2-label[^>]*>OPTION 2[\s\S]*?Start the Test Drive instantly[\s\S]*?Start Test Drive/);
  // OPTION 1 appears only in tile 1, OPTION 2 only in tile 2 (single occurrence each)
  assert.equal((WIZ.match(/>OPTION 1</g) || []).length, 1);
  assert.equal((WIZ.match(/>OPTION 2</g) || []).length, 1);
  assert.match(WIZ, /Download Practice CSV/);
  assert.match(WIZ, /Start Test Drive/);
  // old sample-language is gone from the upload/practice surface (Practice CSV used consistently)
  assert.ok(!/Try the sample/.test(WIZ), "old 'Try the sample' removed");
  assert.ok(!/Download Greet-Me sample CSV/.test(WIZ), "old 'Download Greet-Me sample CSV' removed");
  assert.ok(!/Sample Import/.test(WIZ), "old 'Sample Import' removed");
  assert.ok(!/sample CSV/.test(WIZ), "old 'sample CSV' phrasing removed");
  // downloadable practice file is named for its category
  assert.match(WIZ, /greetme-practice-\$\{kind\}\.csv/);
});
test("Practice CSV / Test Drive dataset is category-appropriate for all six categories", () => {
  // personal categories default to their own template kind (family/friend/professional), business to its type
  assert.match(WIZ, /const templateKind = business \? \(recipientKind \|\| "employee"\) : \(personalGroup \|\| "individual"\)/);
  assert.match(WIZ, /downloadSampleCsv\(templateKind\)/);
  assert.match(WIZ, /trySample\(templateKind\)/);
  // a Personal category NEVER becomes a business kind for the practice split
  assert.match(WIZ, /const isBusinessKind = \(k\) => BUSINESS_KINDS\.has\(k\)/);
  assert.match(WIZ, /const business = isBusinessKind\(kind\)/);       // trySample split
});
test("Business Test Drive is zero mutation; real Business commit is dormant/fail-closed", () => {
  // Test Drive uses the session-scoped practice workspace only — never api.importContacts
  const fn = (WIZ.match(/const trySample = useCallback\(\(kind\) => \{[\s\S]*?\}, \[\]\);/) || [""])[0];
  assert.ok(fn.length > 0 && !/api\./.test(fn), "trySample makes no API call");
  // a genuine (unmarked) business CSV → dormant/fail-closed; the handler classifies practice-vs-real but
  // never calls a production API (no importContacts/getContacts/createContact) and never writes.
  const bf = (WIZ.match(/const onBusinessRealFile = useCallback\(async \(file\) => \{[\s\S]*?\}, \[routeParsedRows\]\);/) || [""])[0];
  assert.ok(bf.length > 0 && !/api\.importContacts|api\.getContacts|api\.createContact|api\.updateContact|api\.deleteContact/.test(bf), "onBusinessRealFile calls no production API");
  assert.match(bf, /routeParsedRows\("business"/);   // classifies then routes to the commit-free preview branch
  const rp = (WIZ.match(/const routeParsedRows = useCallback\(async \(source, fields, rows\) => \{[\s\S]*?\}, \[mode, recipientKind\]\);/) || [""])[0];
  // Slice 2B-1: the business branch builds a READ-ONLY preview (processRow + corporateAddressStatus) — no API, no write
  const bizBranch = (rp.match(/if \(source === "business"\) \{[\s\S]*?setCorporatePreview\(\{ items, kindLabel \}\);[\s\S]*?return;\s*\}/) || [""])[0];
  assert.ok(bizBranch.length > 0, "business branch builds a preview");
  assert.ok(!/api\./.test(bizBranch), "business preview makes NO API call");
  assert.match(WIZ, /onRealFile = business \? onBusinessRealFile : onFile/);
});
test("Upload Options: blank category templates (Excel + CSV) separate from the Practice CSV", () => {
  assert.match(WIZ, /template-block/);
  assert.match(WIZ, /Need a file to fill out\?/);
  assert.match(WIZ, /Download a blank template with the right columns for this contact type/);
  assert.match(WIZ, /download-excel-template/);
  assert.match(WIZ, /download-csv-template/);
  assert.match(WIZ, /Download Guided Excel Template/);   // Slice 2: Excel primary (recommended)
  assert.match(WIZ, /Download Basic CSV Template/);       // Slice 2: CSV secondary (compatibility)
  assert.match(WIZ, /downloadTemplate\(templateKind, "xlsx"\)/);
  assert.match(WIZ, /downloadTemplate\(templateKind, "csv"\)/);
  assert.match(WIZ, /import \{ templateXlsx, templatePracticeXlsx, practiceFileBase, XLSX_MIME \} from "\.\.\/\.\.\/import\/xlsxTemplate\.js"/);
  assert.match(WIZ, /import \{ templateCsv, templateFileBase \} from "\.\.\/\.\.\/import\/templateModel\.js"/);
  // the blank template is NEVER labeled a Practice file, and the practice downloads stay populated + separate
  assert.match(WIZ, /Download Practice CSV/);
  assert.match(WIZ, /Download Practice Excel Workbook/);   // Slice 2 primary practice download
  assert.ok(!/Practice (Excel |CSV )?Template\b|Template[^"]{0,20}Practice CSV/.test(WIZ), "blank template never labeled a Practice file");
});
test("Review screen: OPT-IN recommended defaults notice with apply / review-individually / undo", () => {
  assert.match(WIZ, /import \{ recommendedDefaults, applyRecommendedDefaults, undoRecommendedDefaults \} from "\.\.\/\.\.\/import\/safeDefaults\.js"/);
  assert.match(WIZ, /defaults-notice/);
  assert.match(WIZ, /Recommended settings are available/);
  assert.match(WIZ, /We can apply conservative relationship settings to contacts with missing details\. Existing CSV values and any changes you make will always take priority\./);
  assert.match(WIZ, /Apply recommended settings to \{dflt\.count\} contact/);
  assert.match(WIZ, /apply-defaults/);
  assert.match(WIZ, /review-individually/);
  assert.match(WIZ, /Recommended settings applied to \{dfltApplied\} contact/);
  assert.match(WIZ, /undo-defaults/);
  // never applied silently: application is behind the explicit apply-defaults click
  assert.match(WIZ, /applyRecommendedDefaults\(state, dflt\.indices, dflt\.def\)/);
  assert.match(WIZ, /undoRecommendedDefaults\(s, u\)/);
  assert.match(WIZ, /defaultsPath=\{templateKind\}/);
  // business recipientType is path-derived (no per-row spreadsheet override on the template surface)
  assert.ok(!/designation-differs/.test(WIZ), "per-row recipientType override removed from the template surface");
});
test("Test Drive → Recipients Practice View CTA (session-scoped, no backend write) + V2 template copy", () => {
  // primary CTA + descriptive note on the Test Drive review
  assert.match(WIZ, /View Practice Contacts in Recipients/);
  assert.match(WIZ, /practice-cta-note/);
  assert.match(WIZ, /See how the fictional contacts will look in your Recipients page\. They exist only during this Test Drive and will be automatically removed when you exit Test Drive or log out\./);
  // the handler persists the session workspace and opens ?practice=1 — never api.importContacts / Cosmos
  assert.match(WIZ, /const viewPracticeInRecipients = useCallback/);
  assert.match(WIZ, /saveSampleWorkspace\(built, recipientKind \|\| "individual"\)/);
  assert.match(WIZ, /navigate\("\/dashboard\/contacts\?practice=1"\)/);
  const fn = (WIZ.match(/const viewPracticeInRecipients = useCallback\(\(\) => \{[\s\S]*?\}, \[sample/) || [""])[0];
  assert.ok(fn.length > 0 && !/api\.importContacts|api\.createContact|api\.updateContact|api\.deleteContact/.test(fn), "practice CTA makes no production API call");
  // V2 template UI: version note + CSV disclosure; download uses the V2 base + stamps a UTC date
  assert.match(WIZ, /Version 2 — includes guided Type, Relation, and Description dropdowns in Excel\./);
  assert.match(WIZ, /Guided Excel Template — recommended; includes guided dropdowns and instructions\./);
  assert.match(WIZ, /Basic CSV Template — compatibility option; CSV files do not contain dropdowns, formatting, or workbook instructions\./);
  assert.match(WIZ, /templateXlsx\(kind, \{ generatedUtc: new Date\(\)\.toISOString\(\)\.slice\(0, 10\) \}\)/);
});
test("Manual Practice CSV upload is structurally zero-mutation (dedicated control + normal-uploader defense)", () => {
  assert.match(WIZ, /import \{[^}]*detectPracticeCsv, stripPracticeMarker[^}]*\} from "\.\.\/\.\.\/import\/sampleWorkspace\.js"/);
  // dedicated practice-file upload inside Option 1 (now accepts .xlsx/.xls/.csv, always Test Drive)
  assert.match(WIZ, /upload-practice/);
  assert.match(WIZ, />\s*Upload practice file/);
  assert.match(WIZ, /data-testid="upload-practice"[\s\S]{0,120}accept="\.xlsx,\.xls,\.csv"/);
  assert.match(WIZ, /onUploadPracticeCsv\(e\.target\.files\[0\]\)/);
  // normal uploader defense: detect marker → notice → Continue in Test Drive (no production continuation)
  assert.match(WIZ, /const det = detectPracticeCsv\(fields, rows\)/);   // shared route for CSV + workbook uploads
  assert.match(WIZ, /practice-detected/);
  assert.match(WIZ, /Greet-Me Practice CSV detected/);
  assert.match(WIZ, /This file contains fictional practice contacts\. It will open in Test Drive, and nothing will be saved or sent\./);
  assert.match(WIZ, /continue-in-testdrive/);
  // marked file → practice boundary (sample=true) set in ingest, marker stripped, no getContacts/import
  const ing = (WIZ.match(/const ingestPracticeUpload = \(fields, rawRows\) => \{[\s\S]*?setRows\(deduped\)[\s\S]*?\};/) || [""])[0];
  assert.ok(ing.length > 0, "ingestPracticeUpload present");
  assert.match(ing, /stripPracticeMarker\(fields, rawRows\)/);
  assert.match(ing, /setSample\(true\)/);
  assert.ok(!/api\.getContacts|api\.importContacts/.test(ing), "practice ingest never calls getContacts/importContacts");
  // malformed marker fails closed (shared CSV + workbook message)
  assert.match(WIZ, /This practice file is invalid — its practice marker is malformed/);
});
test("Personal Professional stays Individual (recipientType blank) — never the Business Wizard", () => {
  // Professional group → pickMode(PERSONAL) (individual), so applyRecipientTypes/boundary keeps recipientType ""
  const payload = buildReviewPayload([{ contact: { fullName: "P", email: "p@x.co", recipientType: "vendor" }, index: 0, __raw: {}, __map: {} }],
    freshReviewState({ business: false, kind: null, todayIso: TODAY }));
  assert.equal(payload[0].recipientType, "");
});

// ---- Shared Wizard tile CONTAINMENT fix (root cause: viewport-based breakpoints + fixed/floored
//      grids that ignore the real container width; text with no wrap guard on title/CTA) ----
test("both grids are CONTAINER-responsive (min(100%,Npx) floor); text can't overflow the tile", () => {
  // BOTH Screen 1 and Screen 2 grids collapse on the actual container width, not the viewport
  assert.match(WIZ, /\.gmiw-panels\{ display:grid; grid-template-columns:repeat\(auto-fit, minmax\(min\(100%, 300px\), 1fr\)\);/);
  assert.match(WIZ, /\.gmiw-panels--three\{ grid-template-columns:repeat\(auto-fit, minmax\(min\(100%, 240px\), 1fr\)\); \}/);
  // the min(100%, …) floor is the key fix — a plain minmax(240px…) overflows a narrow container
  assert.ok(!/grid-template-columns:1fr 1fr;/.test(WIZ), "fixed 2-column Screen-1 grid removed");
  assert.ok(!/minmax\(240px, 1fr\)/.test(WIZ), "bare minmax(240px) floor removed (overflowed narrow containers)");
  // tiles fill their track, may shrink, keep padding inside
  assert.match(WIZ, /\.gmiw-panel\{[\s\S]*?box-sizing:border-box; width:100%; min-width:0;/);
  assert.match(WIZ, /min-height:230px; height:auto;/);   // grows vertically instead of a rigid fixed height
  // every text element caps at the tile and wraps (incl. long single tokens)
  assert.match(WIZ, /\.gmiw-panel-title\{[^}]*max-width:100%; overflow-wrap:anywhere;/);
  assert.match(WIZ, /\.gmiw-panel-copy\{[^}]*max-width:min\(30ch, 100%\)[^}]*white-space:normal; overflow-wrap:anywhere;/);
  assert.match(WIZ, /\.gmiw-cta\{[^}]*max-width:100%; overflow-wrap:anywhere;/);
  // no forbidden containment anti-patterns on the shared tile
  assert.ok(!/\.gmiw-panel[^{]*\{[^}]*white-space:nowrap/.test(WIZ), "no white-space:nowrap on tiles");
  assert.ok(!/text-overflow:ellipsis/.test(WIZ), "no ellipsis truncation");
  // mobile stack + source order preserved
  assert.match(WIZ, /@media \(max-width:640px\)[\s\S]*?\.gmiw-panels, \.gmiw-panels--three\{ grid-template-columns:1fr; \}/);
});

// ---- Slice 1: shared workbook reader integration (source-scan; behavior covered in browser + reader suites) ----
test("Excel reader is LAZY-loaded (dynamic import) so SheetJS code-splits out of the main bundle", () => {
  // the reader is reached via dynamic import(); it is never statically imported into the component
  assert.match(WIZ, /await import\(["']\.\.\/\.\.\/import\/xlsxReader\.js["']\)/);
  assert.ok(!/^\s*import\s+[^;]*from\s+["']\.\.\/\.\.\/import\/xlsxReader\.js["']/m.test(WIZ), "xlsxReader must NOT be statically imported");
  assert.ok(!/from ["']xlsx["']/.test(WIZ), "SheetJS (xlsx) must never be imported directly by the component");
});

test("uploader accepts .xlsx/.xls/.csv; the CSV-only claim is gone; .xlsm rejected with a clear message", () => {
  assert.match(WIZ, /accept="\.xlsx,\.xls,\.csv"/);            // the normal uploader
  assert.match(WIZ, /Upload an Excel or CSV file\. Accepted formats: \.xlsx, \.xls, or \.csv/);
  assert.match(WIZ, /\.xlsx recommended/);
  assert.ok(!/Only CSV \(\.csv\) is supported/.test(WIZ), "removed the CSV-only message");
  assert.ok(!/XLSX is not accepted/.test(WIZ), "removed the 'XLSX not accepted' message");
  assert.match(WIZ, /\.xlsm\$/);                               // extension check
  assert.match(WIZ, /Macro-enabled workbooks \(\.xlsm\) aren.t supported/);
});

test("format routing preserves the CSV path and never claims CSV has dropdowns", () => {
  assert.match(WIZ, /Papa\.parse\(file, \{ header: true/);      // CSV still parsed by Papa
  assert.match(WIZ, /\/\\.csv\$\/\.test\(lower\)/);            // csv branch
  assert.match(WIZ, /\/\\.\(xlsx\|xls\)\$\/\.test\(lower\)/);  // workbook branch
  // CSV disclosure remains truthful (no dropdown claim for CSV)
  assert.match(WIZ, /CSV files do not contain dropdowns, formatting, or workbook instructions/);
});

test("worksheet selection: multiple eligible → user picks one; sheets are never merged", () => {
  assert.match(WIZ, /needsSelection/);
  assert.match(WIZ, /setWorksheetChoice\(\{ source: "personal"/);
  assert.match(WIZ, /setWorksheetChoice\(\{ source: "business"/);
  assert.match(WIZ, /setWorksheetChoice\(\{ source: "practice"/);
  assert.match(WIZ, /data-testid="worksheet-select"/);
  assert.match(WIZ, /data-testid="worksheet-option"/);
  // exactly the chosen sheet's rows are routed; no concatenation/merge of multiple sheets
  assert.match(WIZ, /const s = wc\.sheets\.find\(\(x\) => x\.name === sheetName\); if \(s\) routeParsedRows\(wc\.source, s\.fields, s\.rows\)/);
  assert.ok(!/\.flatMap\(|concat\(.*sheets|sheets\.reduce/.test(WIZ), "worksheets are never combined");
});

test("Excel path is READ-ONLY: no production mutation API anywhere near the reader/worksheet flow", () => {
  // the ONLY production write CALL remains commitPersonal → api.importContacts( (unchanged).
  assert.equal((WIZ.match(/api\.importContacts\(/g) || []).length, 1);
  assert.ok(!/api\.createContact|api\.updateContact|api\.deleteContact/.test(WIZ));
  // reader/selection/practice paths never call importContacts
  assert.ok(!/routeParsedRows[\s\S]*?api\.importContacts/.test(WIZ.split("routeParsedRows")[1] || ""));
  // practice/business sources set state only (Test Drive / commit-free preview), never a write
  assert.match(WIZ, /if \(source === "practice"\) \{ ingestPracticeUpload/);
  assert.match(WIZ, /if \(source === "business"\) \{[\s\S]*?setCorporatePreview\(\{ items, kindLabel \}\);[\s\S]*?return;/);
});

test("worksheetChoice is cleared on every reset path (no stale multi-sheet state)", () => {
  for (const fn of ["startOver", "exitSample", "changePersonalGroup", "changeBusinessGroup"]) {
    const body = WIZ.slice(WIZ.indexOf(`const ${fn} = `));
    assert.match(body.slice(0, 400), /setWorksheetChoice\(null\)/, `${fn} clears worksheetChoice`);
  }
});

// ---- Slice 2: guided/practice workbook round-trip UI (source-scan; behavior in generator + browser suites) ----
test("Slice 2: Excel-primary / CSV-secondary download choices with accurate copy", () => {
  // format ORDER: Guided Excel first, Basic CSV second
  const block = WIZ.slice(WIZ.indexOf('data-testid="template-block"'));
  assert.ok(block.indexOf("Download Guided Excel Template") < block.indexOf("Download Basic CSV Template"), "Excel appears before CSV");
  assert.match(WIZ, /Guided Excel Template — recommended; includes guided dropdowns and instructions/);
  // CSV is explicitly described as NOT carrying dropdowns/formatting/instructions (truthful disclosure)
  assert.match(WIZ, /Basic CSV Template — compatibility option; CSV files do not contain dropdowns, formatting, or workbook instructions/);
  assert.match(WIZ, /data-testid="csv-disclosure"[\s\S]{0,120}CSV files do not contain dropdowns/);
});

test("Slice 2: Download Practice Excel Workbook is wired as a primary Test Drive action", () => {
  assert.match(WIZ, /data-testid="download-practice-excel"[\s\S]{0,120}Download Practice Excel Workbook/);
  assert.match(WIZ, /onClick=\{\(\) => downloadPracticeXlsx\(templateKind\)\}/);
  // handler builds a genuine .xlsx from templatePracticeXlsx with fictional Sample contacts + marker
  const h = (WIZ.match(/const downloadPracticeXlsx = useCallback\(\(kind\) => \{[\s\S]*?\}, \[\]\);/) || [""])[0];
  assert.ok(h.length > 0, "downloadPracticeXlsx present");
  assert.match(h, /sampleContactsFor\(kind\)/);
  assert.match(h, /templatePracticeXlsx\(kind, \{ contacts/);
  assert.match(h, /practiceFileBase\(kind\)/);
  assert.match(h, /XLSX_MIME/);
  // it never touches a production API
  assert.ok(!/api\./.test(h), "practice-workbook download makes no API call");
});

test("Slice 2: the dedicated practice upload accepts .xlsx/.xls/.csv and always routes to Test Drive", () => {
  assert.match(WIZ, /data-testid="upload-practice"[\s\S]{0,140}accept="\.xlsx,\.xls,\.csv"/);
  // onUploadPracticeCsv → practice source (always Test Drive), workbooks supported via parseFile
  const u = (WIZ.match(/const onUploadPracticeCsv = useCallback\(async \(file\) => \{[\s\S]*?\}, \[routeParsedRows\]\);/) || [""])[0];
  assert.match(u, /routeParsedRows\("practice"/);
});

// ---- Slice 2B-2B: corporate commit flow wiring (source-scan; behavior in the browser suite) ----
test("Slice 2B-2B: corporate commit flow is wired via CorporateImportFlow (NOT the Personal api helper)", () => {
  assert.match(WIZ, /import CorporateImportFlow from "\.\/CorporateImportFlow\.jsx"/);
  assert.match(WIZ, /import \{ corporateAddressStatus \} from "\.\.\/\.\.\/import\/corporateAddressStatus\.js"/);
  // render early-return delegates to the flow, gated on business + corporatePreview + !sample
  assert.match(WIZ, /if \(business && corporatePreview && !sample\) \{[\s\S]*?<CorporateImportFlow items=\{corporatePreview\.items\}/);
  // sample is threaded so the flow's fail-closed guard sees practice state
  assert.match(WIZ, /<CorporateImportFlow[^>]*sample=\{sample\}/);
  // the WIZARD itself never calls a corporate/personal API for the corporate commit — the flow owns it
  assert.ok(!/api\.importCorporate|api\.importContacts\([^)]*corporate/i.test(WIZ), "wizard does not commit corporate via the Personal api helper");
  // corporatePreview (and thus the flow) is cleared on every reset path (no stale org/preview/results)
  for (const fn of ["startOver", "exitSample", "changePersonalGroup", "changeBusinessGroup", "chooseBusinessGroup"]) {
    const body = WIZ.slice(WIZ.indexOf(`const ${fn} = `));
    assert.match(body.slice(0, 500), /setCorporatePreview\(null\)/, `${fn} clears corporatePreview`);
  }
  // Personal commit still uses the Personal api helper (unchanged) — isolation from the corporate path
  assert.match(WIZ, /const commitPersonal = useCallback\(async \(\) => \{[\s\S]*?api\.importContacts\(contacts\)/);
});

// ══ SLICE E5 — occasion dates survive a CORPORATE import ═════════════════════════════════════
//
// The scheduler matches contacts to campaigns BY OCCASION TYPE, and the corporate importer derives
// occasions[] from these raw columns. Before this, processRow read birthday for age validation and
// left it out of `contact`, while buildCorporatePayload transmits `contact` verbatim — so a
// corporate import silently delivered nobody a birthday, and a Birthdays campaign armed and
// greeted nobody. The hire date had never been recognised at all.

test("E5: hireDate is a recognised column, with the aliases a real spreadsheet uses", () => {
  assert.ok(CANONICAL_FIELDS.includes("hireDate"), "it must be mappable at all");
  for (const header of ["Hire Date", "Start Date", "Date of Hire", "Employment Date", "hiredate"]) {
    const { mapping } = autoMapHeaders(["Name", "Email", header]);
    assert.equal(mapping.hireDate, header, header);
  }
});

test("E5: a hire-date column never steals the birthday column, or vice versa", () => {
  const { mapping } = autoMapHeaders(["Name", "Email", "Birthday", "Hire Date"]);
  assert.equal(mapping.birthday, "Birthday");
  assert.equal(mapping.hireDate, "Hire Date");
});

test("E5: withOccasionDates carries both dates onto the contact, raw", () => {
  const raw = { A: "Ada", B: "ada@x.com", C: "1985-07-08", D: "2019-06-01" };
  const map = { fullName: "A", email: "B", birthday: "C", hireDate: "D" };
  const out = withOccasionDates({ fullName: "Ada", email: "ada@x.com" }, raw, map);
  assert.equal(out.birthday, "1985-07-08");
  assert.equal(out.hireDate, "2019-06-01");
  // Passed through untouched: the server owns parsing, and rejects a bare month-day itself.
  assert.equal(withOccasionDates({}, { C: "06-01" }, { hireDate: "C" }).hireDate, "06-01");
});

test("E5: an absent or blank column adds no key at all", () => {
  // An empty string would read as "this contact has a birthday" on the server side.
  assert.equal("birthday" in withOccasionDates({}, {}, {}), false);
  assert.equal("hireDate" in withOccasionDates({}, { C: "   " }, { hireDate: "C" }), false);
  assert.equal("birthday" in withOccasionDates({}, { C: "" }, { birthday: "C" }), false);
});

test("E5: the dates reach the wire through the corporate payload", () => {
  // The whole chain, because every link in it dropped them before.
  const headers = ["Full Name", "Email", "Birthday", "Hire Date"];
  const { mapping } = autoMapHeaders(headers);
  const raw = { "Full Name": "Ada", "Email": "ada@x.com", "Birthday": "1985-07-08", "Hire Date": "2019-06-01" };
  const p = processRow(raw, mapping, { todayIso: "2026-08-21" });
  assert.equal("birthday" in p.contact, false, "processRow still omits it — transmission is the caller's call");

  const { envelope } = buildCorporatePayload([{ index: 0, contact: withOccasionDates(p.contact, raw, mapping), valid: true }]);
  assert.equal(envelope.contacts[0].birthday, "1985-07-08");
  assert.equal(envelope.contacts[0].hireDate, "2019-06-01");
});

test("E5: the corporate preview attaches the dates, not just the payload builder", () => {
  // buildCorporatePayload transmits item.contact verbatim, so the enrichment has to happen where
  // the item is built or it never happens at all.
  assert.match(WIZ, /withOccasionDates\(p\.contact, raw, mapping\)/);
});

// ══ SLICE E5 — entry from the corporate dashboard ════════════════════════════════════════════
test("E5: the wizard consumes ?mode=corporate&category=", () => {
  // The contact tiles link here with both. Ignoring them meant Add and Import landed on a generic
  // first screen that had forgotten which tile was pressed.
  assert.match(WIZ, /get\("mode"\) === "corporate"/);
  assert.match(WIZ, /isBusinessKind\(category\)/, "an unknown category is never guessed at");
  assert.match(WIZ, /setEntryView\("bizgroup"\)/, "…it opens the chooser instead");
});

test("E5: a corporate visit returns to the corporate dashboard, not the personal one", () => {
  // /dashboard/contacts lists PERSONAL contacts. Returning an employee import there would show a
  // list the import did not touch, which reads as the import having failed.
  assert.match(WIZ, /cameFromCorporateDashboard \? "\/dashboard\/campaigns" : "\/dashboard\/contacts"/);
});
