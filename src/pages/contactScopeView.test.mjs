// src/pages/contactScopeView.test.mjs — Run: node --test src/pages/contactScopeView.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  VIEW_SCOPE,
  canUseBusinessView,
  businessOrganizations,
  effectiveScope,
  CORPORATE_TYPE_FILTERS,
  filterByCorporateType,
  corporateTypeCounts,
  BUSINESS_READ_ONLY_NOTICE,
  contactsFromCorporateResponse,
} from "./contactScopeView.js";

const ok = (memberships) => ({ ok: true, data: { memberships } });
const ACTIVE = [{ corporateOrganizationId: "org_1", role: "owner", status: "active" }];

// ══ who may see the Business view ════════════════════════════════════════════════════════════
test("an active membership opens the Business view", () => {
  assert.equal(canUseBusinessView(ok(ACTIVE)), true);
  assert.deepEqual(businessOrganizations(ok(ACTIVE)), [{ corporateOrganizationId: "org_1", role: "owner" }]);
});

test("no membership, no Business view — and nothing else grants it", () => {
  assert.equal(canUseBusinessView(ok([])), false);
  assert.equal(canUseBusinessView(ok([{ corporateOrganizationId: "org_1", status: "invited" }])), false, "an invitation is not access");
  assert.equal(canUseBusinessView(ok([{ corporateOrganizationId: "org_1", status: "suspended" }])), false);
  assert.equal(canUseBusinessView(ok([{ status: "active" }])), false, "a membership with no organization reaches nothing");
});

test("it fails closed on every unhappy response", () => {
  for (const res of [null, undefined, {}, { ok: false }, { ok: true }, { dormant: true }, { unauthorized: true },
    { ok: true, data: {} }, { ok: true, data: { memberships: null } }, { ok: "true", data: { memberships: ACTIVE } }]) {
    assert.equal(canUseBusinessView(res), false, JSON.stringify(res));
    assert.deepEqual(businessOrganizations(res), []);
  }
});

test("subscription tier is never consulted — membership is the only signal", () => {
  // Billing state moves for reasons that have nothing to do with data ownership: a declined card
  // or a downgrade must not re-interpret an existing roster.
  const src = readFileSync(new URL("./contactScopeView.js", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const term of [/subscription/i, /\bplan\b/i, /\btier\b/i, /billing/i, /stripe/i]) {
    assert.equal(term.test(code), false, `must not read ${term}`);
  }
});

// ══ losing access while looking at it ════════════════════════════════════════════════════════
test("a viewer whose access disappears is returned to Personal", () => {
  assert.equal(effectiveScope(VIEW_SCOPE.BUSINESS, ok(ACTIVE)), VIEW_SCOPE.BUSINESS);
  // Membership revoked mid-session: better the personal list than a business list that cannot load.
  assert.equal(effectiveScope(VIEW_SCOPE.BUSINESS, ok([])), VIEW_SCOPE.PERSONAL);
  assert.equal(effectiveScope(VIEW_SCOPE.BUSINESS, { ok: false }), VIEW_SCOPE.PERSONAL);
});

test("anything that is not exactly BUSINESS is Personal", () => {
  for (const req of [null, undefined, "", "corporate", "Business", "personal", 1, true]) {
    assert.equal(effectiveScope(req, ok(ACTIVE)), VIEW_SCOPE.PERSONAL, JSON.stringify(req));
  }
});

// ══ the type filter ══════════════════════════════════════════════════════════════════════════
const ROSTER = [
  { id: "e1", name: "Ann", corporateContactType: "employee" },
  { id: "e2", name: "Bo", corporateContactType: "employee" },
  { id: "c1", name: "Cy", corporateContactType: "client" },
  { id: "v1", name: "Di", corporateContactType: "vendor" },
  { id: "u1", name: "Ed", corporateContactType: null },
];

test("the filter offers All plus the three types, each with its tag", () => {
  assert.deepEqual(CORPORATE_TYPE_FILTERS.map((f) => f.key), ["all", "employee", "client", "vendor"]);
  assert.deepEqual(CORPORATE_TYPE_FILTERS.filter((f) => f.abbr).map((f) => f.abbr), ["EMP", "CLI", "VND"]);
});

test("filtering shows exactly that type", () => {
  assert.deepEqual(filterByCorporateType(ROSTER, "employee").map((c) => c.id), ["e1", "e2"]);
  assert.deepEqual(filterByCorporateType(ROSTER, "client").map((c) => c.id), ["c1"]);
  assert.equal(filterByCorporateType(ROSTER, "all").length, 5);
});

test("an unclassified contact belongs to no category, and is never folded into one", () => {
  // The same rule the campaign audience bubbles follow: nobody is reached by a category they were
  // never assigned to.
  for (const key of ["employee", "client", "vendor"]) {
    assert.equal(filterByCorporateType(ROSTER, key).some((c) => c.id === "u1"), false, key);
  }
  assert.equal(filterByCorporateType(ROSTER, "all").some((c) => c.id === "u1"), true, "but All really means all");
});

test("an unrecognised filter hides nobody rather than emptying the page", () => {
  assert.equal(filterByCorporateType(ROSTER, "partner").length, 5);
  assert.equal(filterByCorporateType(null, "employee").length, 0);
});

test("each control can say how many it would show, and the parts add up", () => {
  const n = corporateTypeCounts(ROSTER);
  assert.deepEqual(n, { all: 5, employee: 2, client: 1, vendor: 1 });
  assert.equal(n.employee + n.client + n.vendor + 1, n.all, "the unclassified one is the difference");
});

// ══ read-only, stated out loud ═══════════════════════════════════════════════════════════════
test("the read-only notice names the one action that actually exists", () => {
  // There is no single-record write path for a corporate contact: the backend exposes a list
  // endpoint and a bulk import, and nothing else. Import is therefore the honest instruction.
  assert.match(BUSINESS_READ_ONLY_NOTICE.text, /import/i);
  assert.match(BUSINESS_READ_ONLY_NOTICE.text, /re-import updates/i, "correcting someone is possible, and says so");
  assert.match(BUSINESS_READ_ONLY_NOTICE.actionPath, /^\/dashboard\/import-wizard\?mode=corporate/);
});

// ══ reading the response ═════════════════════════════════════════════════════════════════════
test("the corporate roster is read fail-closed", () => {
  assert.deepEqual(contactsFromCorporateResponse({ ok: true, data: { contacts: ROSTER } }).map((c) => c.id),
    ["e1", "e2", "c1", "v1", "u1"]);
  assert.deepEqual(contactsFromCorporateResponse({ ok: true, data: ROSTER }).length, 5, "a bare array is tolerated");
  for (const bad of [null, {}, { ok: false, data: { contacts: ROSTER } }, { dormant: true }, { ok: true, data: null }]) {
    assert.deepEqual(contactsFromCorporateResponse(bad), [], JSON.stringify(bad));
  }
});

// ══ the boundary this slice must not weaken ══════════════════════════════════════════════════
test("the view never tries to make one query serve both scopes", () => {
  // services/contactScope.js is emphatic: PERSONAL_SCOPE_SQL admits only an absent scope or
  // exactly "personal", and "not corporate" is NOT equivalent to "personal". One page, two
  // endpoints — this module chooses between them and never blends them.
  const raw = readFileSync(new URL("./contactScopeView.js", import.meta.url), "utf8");
  // Strip BOTH comment forms: the file explains at length why it does not merge the two scopes,
  // and prose describing the trap must not read as the trap itself.
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(/contactScope\s*[!=]==?\s*["']personal["']/.test(code), false, "it must not re-implement the personal predicate");
  assert.equal(/concat\(|merge/i.test(code), false, "and never concatenates two rosters");
});

// ══ the page honours the boundary ════════════════════════════════════════════════════════════
const PAGE = readFileSync(new URL("./Contacts.jsx", import.meta.url), "utf8");

test("the Business view offers no personal write control", () => {
  // Add, Edit and Delete all call the PERSONAL endpoints. In the Business view they would either
  // write to a different list than the one on screen (Add), or hit a boundary that fails closed by
  // design and looks like a bug (Edit/Delete). All three are gated on the scope.
  for (const guard of [
    /\{!isBusiness \? \(\s*<button\s+data-testid="add-recipient"/,
    /\{!isBusiness \? \(\s*<>\s*<button\s+onClick=\{\(\) => openEditModal\(contact\)\}/,
  ]) {
    assert.match(PAGE, guard, String(guard));
  }
});

test("the page chooses between two endpoints and never blends them", () => {
  // The personal list keeps its own fail-closed predicate server-side; the corporate roster is
  // read through the corporate client. Two sources, chosen between.
  assert.match(PAGE, /listOrgContacts\(businessOrgId\)/, "the corporate roster has its own endpoint");
  assert.match(PAGE, /isBusiness \? filterByCorporateType\(businessContacts, typeFilter\) : recipients/,
    "the list is selected, not concatenated");
  assert.equal(/recipients\.concat|\[\.\.\.recipients,\s*\.\.\.businessContacts\]/.test(PAGE), false,
    "the two rosters are never combined");
});

test("the toggle is gated on membership, and nothing else", () => {
  assert.match(PAGE, /businessAvailable \? \(/, "hidden entirely without an active membership");
  assert.match(PAGE, /canUseBusinessView\(membershipResult\)/);
  const code = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(/subscription|tier|billing/i.test(code), false, "billing never decides what data is shown");
});
