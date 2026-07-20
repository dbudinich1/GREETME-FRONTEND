// src/import/templateModel.js
//
// TEAM A — canonical BLANK import-template definitions (single source of truth for both the CSV and the
// Excel generators, and for the Upload Options UI). Header-only: NO fictional or production contact
// rows are ever emitted here. Pure, framework-free, Node-testable. A blank template is NOT a Practice
// CSV — the Practice CSV (Test Drive) carries fictional data; these carry only column headers.
//
// Columns map 1:1 to the existing canonical import contract (see importCore ALIASES) and, for address,
// to the canonical contact `shippingAddress { line1, line2, city, state, zip, country }` shape.

export const TEMPLATE_KINDS = Object.freeze(["family", "friend", "professional", "employee", "client", "vendor"]);
const BUSINESS = new Set(["employee", "client", "vendor"]);
export const isBusinessTemplateKind = (k) => BUSINESS.has(k);

// Column = user-facing header + Excel width (chars) + optional cell format ("date" | "text").
const CORE = [
  { header: "Name", width: 22 },
  { header: "Email", width: 28 },
  { header: "Phone", width: 16 },
];
const RECIPIENT_TYPE = { header: "Recipient Type", width: 16 };
const RELATION = [
  { header: "Relationship Group", width: 18 },
  { header: "Relationship", width: 16 },
  { header: "Closeness", width: 20 },
];
const OCCASION = [{ header: "Birthday", width: 14, format: "date" }];
const PROFESSIONAL = [
  { header: "Company", width: 22 },
  { header: "Department", width: 18 },
];
// Address maps to canonical shippingAddress { line1, line2, city, state, zip, country }.
const ADDRESS = [
  { header: "Address Line 1", width: 26 },
  { header: "Address Line 2", width: 22 },
  { header: "City", width: 16 },
  { header: "State/Province", width: 16 },
  { header: "Postal/ZIP Code", width: 16 },
  { header: "Country", width: 16 },
];
const NOTES = [{ header: "Notes", width: 32 }];

// Canonical, stable column order. Business templates additionally carry Recipient Type (after Phone).
export function templateColumns(kind) {
  return [
    ...CORE,
    ...(isBusinessTemplateKind(kind) ? [RECIPIENT_TYPE] : []),
    ...RELATION, ...OCCASION, ...PROFESSIONAL, ...ADDRESS, ...NOTES,
  ];
}
export function templateHeaders(kind) { return templateColumns(kind).map((c) => c.header); }
export function templateFileBase(kind) { return `greetme-${kind}-contacts-template`; }

// Canonical controlled values (for the Instructions sheet) — exact taxonomy, never invented.
export const CONTROLLED = Object.freeze({
  relationshipGroup: ["family", "friend", "professional"],
  closeness: ["Inner Circle", "Greet-Me Worthy", "You Gotta Do What Ya Gotta Do"],
  recipientType: ["employee", "client", "vendor"],
});

// Recommended default for a path, in plain words.
const DEFAULT_WORDS = {
  family: "Family group · Family Member · Greet-Me Worthy",
  friend: "Friend group · Acquaintance · Greet-Me Worthy",
  professional: "Professional group · Colleague · Greet-Me Worthy",
  employee: "Recipient Type employee · Professional · Employee · Greet-Me Worthy",
  client: "Recipient Type client · Professional · Client · Greet-Me Worthy",
  vendor: "Recipient Type vendor · Professional · Vendor · Greet-Me Worthy",
};

// RFC-4180 escaping. No formula-trigger prefixes are ever emitted (headers are plain words).
function csvEscape(s) {
  const v = String(s == null ? "" : s);
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
// CSV template: a single header row, CRLF-terminated, UTF-8. Zero data rows.
export function templateCsv(kind) {
  return templateHeaders(kind).map(csvEscape).join(",") + "\r\n";
}

// Instructions content (array of {heading, lines}) rendered onto the Excel Instructions sheet and
// available to tests. Explains required fields, controlled values, defaults, per-row overrides, address.
export function templateInstructions(kind) {
  const business = isBusinessTemplateKind(kind);
  const label = { family: "Family", friend: "Friend", professional: "Professional", employee: "Employee", client: "Client", vendor: "Vendor" }[kind];
  return [
    { heading: `Greet-Me — ${label} contacts template`, lines: [
      "Fill in the Contacts sheet, one contact per row, then upload it in the Import Wizard.",
      "This template contains no example contacts — every row you add is your own.",
    ] },
    { heading: "Required fields", lines: [
      "Name and Email are required for every contact. Everything else is optional.",
      "A contact is never blocked because optional fields (including the address) are empty.",
    ] },
    { heading: "Relationship (optional, controlled values)", lines: [
      `Relationship Group: ${CONTROLLED.relationshipGroup.join(", ")}.`,
      "Relationship: a specific role within the group (e.g. professional → colleague, mentor, client).",
      `Closeness: ${CONTROLLED.closeness.join(" · ")}.`,
      "Leave all three blank to import without a relationship — you can add it later.",
    ] },
    { heading: "Recommended defaults (opt-in)", lines: [
      `For this list: ${DEFAULT_WORDS[kind]}.`,
      "Defaults are only ever applied when you choose to in Review. Your file values always win.",
    ] },
    ...(business ? [{ heading: "Recipient Type (per-row override)", lines: [
      `This list defaults every contact to "${kind}".`,
      `You may set Recipient Type per row to one of: ${CONTROLLED.recipientType.join(", ")}.`,
      "An unrecognized value is flagged for review during import — it is never guessed.",
    ] }] : [{ heading: "This is a Personal list", lines: [
      "Personal contacts never carry a business Recipient Type; that column is intentionally absent.",
    ] }]),
    { heading: "Shipping address (optional)", lines: [
      "Address Line 1/2, City, State/Province, Postal/ZIP Code, Country map to the contact's shipping address.",
      "Providing an address only stores it for later — it never arranges, schedules, or pays for a gift.",
    ] },
    { heading: "Dates", lines: [
      "Birthday is a full date. The Birthday column is date-formatted; enter e.g. 1990-05-14.",
    ] },
  ];
}
