// src/import/demoData.js
//
// TEAM A — Corporate Learning Mode. Optional fictional employee/client lists for a corporate
// user to explore the wizard safely. HARD isolation guarantees:
//   • Every record uses a RESERVED fictional domain (example.com/.org/.net — RFC 2606).
//   • Demo records are tagged demo:true and NEVER mixed with real contacts.
//   • Demo mode NEVER sends email/SMS/greetings/gifts/animations/notifications, and NEVER
//     touches billing, attribution, reporting, or production campaign metrics.
//   • Reset + Exit are first-class. Real-data import requires explicit confirmation.
// Pure data + guards. No network, no persistence side-effects here.

export const DEMO_DOMAIN_RE = /@example\.(com|org|net)$/i;
export const isReservedDemoEmail = (email) => DEMO_DOMAIN_RE.test(String(email || "").trim());

// Demo mode is send-safe by construction — this constant is the single source of truth the
// UI/guards read; it can never be flipped true.
export const DEMO_SENDS_ALLOWED = false;

// Fictional employees (reserved domain, no real people).
// `relationship` values are intentionally mixed so the sample exercises the completion flow:
// deterministic ("colleague"/"co-worker"→Professional·Colleague), an unknown value that needs one
// bulk mapping ("work bud"), and blanks that stay "optional details missing".
export const DEMO_EMPLOYEES = Object.freeze([
  { fullName: "Ada Lovelace", email: "ada@example.com", relationship: "colleague", recipientType: "employee", department: "Engineering", company: "Demo Corp" },
  { fullName: "Alan Turing", email: "alan@example.com", relationship: "co-worker", recipientType: "employee", department: "Research", company: "Demo Corp" },
  { fullName: "Grace Hopper", email: "grace@example.com", relationship: "work bud", recipientType: "employee", department: "Engineering", company: "Demo Corp" },
  { fullName: "Katherine Johnson", email: "katherine@example.com", relationship: "work bud", recipientType: "employee", department: "Analytics", company: "Demo Corp" },
  { fullName: "Mae Jemison", email: "mae@example.com", relationship: "", recipientType: "employee", department: "Operations", company: "Demo Corp" },
  { fullName: "Hedy Lamarr", email: "hedy@example.com", relationship: "mentor", recipientType: "employee", department: "Product", company: "Demo Corp" },
].map(Object.freeze));

// Fictional clients (reserved domain).
export const DEMO_CLIENTS = Object.freeze([
  { fullName: "Riverstone Bakery", email: "hello@example.org", relationship: "client", recipientType: "client", company: "Riverstone Bakery" },
  { fullName: "Northwind Traders", email: "accounts@example.org", relationship: "client", recipientType: "client", company: "Northwind Traders" },
  { fullName: "Blue Yonder Airlines", email: "care@example.net", relationship: "vendor", recipientType: "client", company: "Blue Yonder Airlines" },
  { fullName: "Contoso Ltd", email: "team@example.com", relationship: "key account", recipientType: "client", company: "Contoso Ltd" },
  { fullName: "Fabrikam Inc", email: "partners@example.org", relationship: "", recipientType: "client", company: "Fabrikam Inc" },
  { fullName: "Tailspin Toys", email: "orders@example.net", relationship: "client", recipientType: "client", company: "Tailspin Toys" },
].map(Object.freeze));

// Fictional vendors (reserved domains); includes a "supplier" synonym + a blank type.
export const DEMO_VENDORS = Object.freeze([
  { fullName: "Acme Print Co", email: "print@example.com", relationship: "vendor", recipientType: "vendor", company: "Acme Print Co" },
  { fullName: "Skyline Catering", email: "events@example.org", relationship: "vendor", recipientType: "vendor", company: "Skyline Catering" },
  { fullName: "Beacon IT Services", email: "support@example.net", relationship: "supplier", recipientType: "supplier", company: "Beacon IT Services" },
  { fullName: "Harbor Logistics", email: "ops@example.com", relationship: "", recipientType: "vendor", company: "Harbor Logistics" },
].map(Object.freeze));

// Fictional PERSONAL recipients (for the personal sample) — deterministic + unknown relationships.
export const DEMO_PERSONAL = Object.freeze([
  { fullName: "Sam Rivera", email: "sam@example.com", relationship: "best friend", recipientType: "" },
  { fullName: "Jordan Lee", email: "jordan@example.org", relationship: "sibling", recipientType: "" },
  { fullName: "Taylor Kim", email: "taylor@example.net", relationship: "bestie", recipientType: "" },
  { fullName: "Morgan Doe", email: "morgan@example.com", relationship: "", recipientType: "" },
].map(Object.freeze));

// Fictional PERSONAL practice sets, one per Personal category (Family / Friends / Professional). The
// selected Personal path is UI CONTEXT ONLY: these carry NO relationship classification and NO
// recipientType — a personal record never inherits a relationship/business type merely because a
// category tile was chosen. Distinct fictional names on reserved domains make each download
// category-appropriate without inventing data.
export const DEMO_FAMILY = Object.freeze([
  { fullName: "Robin Hollis", email: "robin@example.com", relationship: "", recipientType: "" },
  { fullName: "Casey Hollis", email: "casey@example.org", relationship: "", recipientType: "" },
  { fullName: "Dana Hollis", email: "dana@example.net", relationship: "", recipientType: "" },
  { fullName: "Jamie Hollis", email: "jamie@example.com", relationship: "", recipientType: "" },
].map(Object.freeze));
export const DEMO_FRIENDS = Object.freeze([
  { fullName: "Alex Marsh", email: "alex@example.com", relationship: "", recipientType: "" },
  { fullName: "Sky Nguyen", email: "sky@example.org", relationship: "", recipientType: "" },
  { fullName: "Remy Park", email: "remy@example.net", relationship: "", recipientType: "" },
  { fullName: "Toni Vega", email: "toni@example.com", relationship: "", recipientType: "" },
].map(Object.freeze));
export const DEMO_PROFESSIONAL = Object.freeze([
  { fullName: "Lee Cortez", email: "lee@example.com", relationship: "", recipientType: "" },
  { fullName: "Sam Okafor", email: "sam.o@example.org", relationship: "", recipientType: "" },
  { fullName: "Priya Raman", email: "priya@example.net", relationship: "", recipientType: "" },
  { fullName: "Chris Wald", email: "chris@example.com", relationship: "", recipientType: "" },
].map(Object.freeze));

// Fictional MIXED list — a recipientType column with recognized synonyms + one unknown ("contractor").
export const DEMO_MIXED = Object.freeze([
  { fullName: "Ada Lovelace", email: "ada2@example.com", relationship: "colleague", recipientType: "Employee", company: "Demo Corp" },
  { fullName: "Riverstone Bakery", email: "hello2@example.org", relationship: "client", recipientType: "customer", company: "Riverstone Bakery" },
  { fullName: "Acme Print Co", email: "print2@example.com", relationship: "vendor", recipientType: "supplier", company: "Acme Print Co" },
  { fullName: "Pat Contractor", email: "pat@example.net", relationship: "", recipientType: "contractor", company: "Freelance" },
].map(Object.freeze));

export function demoDataset(kind) {
  const map = {
    employees: DEMO_EMPLOYEES, clients: DEMO_CLIENTS, vendors: DEMO_VENDORS, personal: DEMO_PERSONAL, mixed: DEMO_MIXED,
    family: DEMO_FAMILY, friends: DEMO_FRIENDS, professional: DEMO_PROFESSIONAL,
  };
  const base = map[kind] || DEMO_EMPLOYEES;
  return base.map((c) => ({ ...c, demo: true, source: "demo" }));
}

// Every demo record must carry the demo tag AND a reserved domain — enforced, not assumed.
export function assertDemoIntegrity(records = []) {
  for (const r of records) {
    if (r.demo !== true) throw new Error("demo_record_untagged");
    if (!isReservedDemoEmail(r.email)) throw new Error("demo_record_non_reserved_domain");
  }
  return true;
}

// Guard against ever mixing demo + real records in one collection.
export function assertNoRealMix(records = []) {
  const anyDemo = records.some((r) => r && r.demo === true);
  const anyReal = records.some((r) => r && r.demo !== true);
  if (anyDemo && anyReal) throw new Error("demo_real_mix_forbidden");
  return true;
}

// Send/side-effect gate: demo mode always returns false — nothing may go out.
export function demoModeAllowsSend() { return DEMO_SENDS_ALLOWED === true; }

// Reset returns a fresh, un-mutated dataset (undo of any in-session demo edits).
export function resetDemoData(kind) { return demoDataset(kind); }

// Exiting demo mode yields an empty real-data context — demo records are dropped, never
// carried into real import.
export function exitDemoMode() { return { mode: "real", records: [], requiresConfirmation: true }; }
