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
export const DEMO_EMPLOYEES = Object.freeze([
  { fullName: "Ada Lovelace", email: "ada@example.com", recipientType: "employee", department: "Engineering", company: "Demo Corp" },
  { fullName: "Alan Turing", email: "alan@example.com", recipientType: "employee", department: "Research", company: "Demo Corp" },
  { fullName: "Grace Hopper", email: "grace@example.com", recipientType: "employee", department: "Engineering", company: "Demo Corp" },
  { fullName: "Katherine Johnson", email: "katherine@example.com", recipientType: "employee", department: "Analytics", company: "Demo Corp" },
  { fullName: "Mae Jemison", email: "mae@example.com", recipientType: "employee", department: "Operations", company: "Demo Corp" },
  { fullName: "Hedy Lamarr", email: "hedy@example.com", recipientType: "employee", department: "Product", company: "Demo Corp" },
].map(Object.freeze));

// Fictional clients (reserved domain).
export const DEMO_CLIENTS = Object.freeze([
  { fullName: "Riverstone Bakery", email: "hello@example.org", recipientType: "client", company: "Riverstone Bakery" },
  { fullName: "Northwind Traders", email: "accounts@example.org", recipientType: "client", company: "Northwind Traders" },
  { fullName: "Blue Yonder Airlines", email: "care@example.net", recipientType: "client", company: "Blue Yonder Airlines" },
  { fullName: "Contoso Ltd", email: "team@example.com", recipientType: "client", company: "Contoso Ltd" },
  { fullName: "Fabrikam Inc", email: "partners@example.org", recipientType: "client", company: "Fabrikam Inc" },
  { fullName: "Tailspin Toys", email: "orders@example.net", recipientType: "client", company: "Tailspin Toys" },
].map(Object.freeze));

export function demoDataset(kind) {
  const base = kind === "clients" ? DEMO_CLIENTS : DEMO_EMPLOYEES;
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
