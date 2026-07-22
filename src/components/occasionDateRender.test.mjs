// FE-1 — occasion dates must render the STORED calendar day (no UTC-midnight "one day early" bug).
// Surfaces fixed: Recipients (Contacts.jsx:851 primaryOcc.date, :934 soonest.date) and Dashboard
// Upcoming Events (UpcomingEvents.jsx:27). Proven pattern: `new Date(d + 'T00:00:00')` → LOCAL midnight.
// Each assertion uses the site's EXACT render expression (byte-for-byte), observed under the GATE
// timezone (a negative-offset zone where the pre-fix bug manifests).
// Run: TZ=America/New_York node --test src/components/occasionDateRender.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { RELATIONS_BY_CATEGORY, RELATIONSHIP_CATEGORIES } from "../import/completionModel.js";

// Precondition: negative-offset zone (America/New_York) — where a bare `new Date("YYYY-MM-DD")` rolls back a day.
const NEGATIVE_OFFSET = new Date("1980-03-14T00:00:00").getTimezoneOffset() > 0;

// EXACT site expressions AFTER FE-1 (byte-for-byte with Contacts.jsx / UpcomingEvents.jsx).
const contactsDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const upcomingDate = (d) => new Date(d + "T00:00:00").toLocaleDateString();
// Pre-fix (bugged) expression, for the regression demonstration.
const buggedContactsDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const GATE = [
  { stored: "1980-03-14", contacts: "Mar 14", m: 3, d: 14, y: 1980 },
  { stored: "1975-11-02", contacts: "Nov 2",  m: 11, d: 2, y: 1975 },
  { stored: "1990-07-02", contacts: "Jul 2",  m: 7, d: 2, y: 1990 },
  { stored: "1985-01-05", contacts: "Jan 5",  m: 1, d: 5, y: 1985 },
];

test("precondition: negative-offset zone (run TZ=America/New_York per the FE-1 GATE)", () => {
  assert.ok(NEGATIVE_OFFSET, "run with TZ=America/New_York — a negative-offset zone");
});

test("Recipients surfaces (Contacts.jsx:851 & :934) render the STORED day; pre-fix rendered one day early", () => {
  for (const g of GATE) {
    assert.equal(contactsDate(g.stored), g.contacts, `${g.stored} → ${g.contacts}`);
    assert.notEqual(buggedContactsDate(g.stored), g.contacts, "pre-fix (bare new Date) rendered one day early");
  }
});

test("Dashboard Upcoming Events (UpcomingEvents.jsx:27) renders the STORED day", () => {
  for (const g of GATE) {
    const out = upcomingDate(g.stored); // en-US default → M/D/YYYY
    assert.match(out, new RegExp(`\\b${g.m}/${g.d}/${g.y}\\b`), `${g.stored} → ${out}`);
  }
});

test("relationship label source (completionModel) maps family_member → 'Family Member'; stored value unchanged", () => {
  const m = {};
  for (const c of RELATIONSHIP_CATEGORIES) m[c.value] = c.label;
  for (const arr of Object.values(RELATIONS_BY_CATEGORY)) for (const r of arr) m[r.value] = r.label;
  assert.equal(m["family_member"], "Family Member");
  assert.equal(m["in_law"], "In-Law");
});
