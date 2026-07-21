// src/import/templateModel.js
//
// TEAM A — canonical BLANK import-template definitions (single source of truth for the CSV + Excel
// generators and the Upload Options UI). Header-only: NO fictional or production contact rows. Pure,
// framework-free, Node-testable. A blank template is NOT a Practice CSV (which carries fictional data).
//
// EXACTLY THREE relationship selectors, matching ContactForm (Type / Relation / Description):
//   Type        → relationshipCategory   (Family | Friend | Professional)
//   Relation    → relationship           (canonical per-Type role, e.g. Family Member, Colleague)
//   Description → relationshipCloseness   (Inner Circle | Greet-Me Worthy | You Gotta Do What Ya Gotta Do)
// There is NO Phone column and NO Recipient Type column: business recipientType is derived from the
// Wizard pathway (Employees→employee, Clients→client, Vendors→vendor), personal → "". Columns are
// identical for all six templates. Dropdown option lists are DERIVED from the canonical completionModel
// vocabulary so they can never diverge from ContactForm (taxonomy-locked).

import { RELATIONS_BY_CATEGORY, RELATIONSHIP_CATEGORIES, CLOSENESS_OPTIONS } from "./completionModel.js";

export const TEMPLATE_KINDS = Object.freeze(["family", "friend", "professional", "employee", "client", "vendor"]);
const BUSINESS = new Set(["employee", "client", "vendor"]);
export const isBusinessTemplateKind = (k) => BUSINESS.has(k);

// The three dropdown-enabled relationship columns (user-facing label → canonical field).
export const RELATIONSHIP_COLUMNS = Object.freeze([
  { header: "Type", field: "relationshipCategory" },
  { header: "Relation", field: "relationship" },
  { header: "Description", field: "relationshipCloseness" },
]);

// Canonical dropdown option lists (labels), derived from the locked taxonomy — never invented.
export const TYPE_OPTIONS = Object.freeze(RELATIONSHIP_CATEGORIES.map((c) => c.label));                 // Family / Friend / Professional
export const DESCRIPTION_OPTIONS = Object.freeze(CLOSENESS_OPTIONS.map((o) => o.label));                // Inner Circle / Greet-Me Worthy / …
// Relation options depend on the selected Type (keyed by the Type LABEL so an Excel INDIRECT dropdown
// can resolve the matching named range). Family includes "Family Member"; no loved_one.
export const RELATION_OPTIONS_BY_TYPE = Object.freeze(Object.fromEntries(
  RELATIONSHIP_CATEGORIES.map((c) => [c.label, Object.freeze(RELATIONS_BY_CATEGORY[c.value].map((r) => r.label))]),
));

// Column = user-facing header + Excel width (chars) + optional cell format ("date"). Identical for
// every template kind (no Phone, no Recipient Type).
const COLUMNS = [
  { header: "Name", width: 22 },
  { header: "Email", width: 28 },
  { header: "Type", width: 16 },
  { header: "Relation", width: 20 },
  { header: "Description", width: 26 },
  { header: "Birthday", width: 14, format: "date" },
  { header: "Company", width: 22 },
  { header: "Department", width: 18 },
  { header: "Address Line 1", width: 26 },
  { header: "Address Line 2", width: 22 },
  { header: "City", width: 16 },
  { header: "State/Province", width: 16 },
  { header: "Postal/ZIP Code", width: 16 },
  { header: "Country", width: 16 },
  { header: "Notes", width: 32 },
];

export function templateColumns(/* kind */) { return COLUMNS.map((c) => ({ ...c })); }
export function templateHeaders(kind) { return templateColumns(kind).map((c) => c.header); }
// Versioned filename (V2) so Excel/Windows can't silently reopen an older identically-named download.
export const TEMPLATE_VERSION = 2;
export function templateFileBase(kind) { return `greetme-${kind}-contacts-template-v${TEMPLATE_VERSION}`; }
const KIND_LABEL = { family: "Family", friend: "Friend", professional: "Professional", employee: "Employee", client: "Client", vendor: "Vendor" };
export function templateTitle(kind) { return `Greet-Me ${KIND_LABEL[kind]} Contacts Template`; }

// Path recipientType (derived; never a spreadsheet column). Personal → "".
export function pathRecipientType(kind) { return isBusinessTemplateKind(kind) ? kind : ""; }

// RFC-4180 escaping. Headers are plain words (never a formula-trigger prefix).
function csvEscape(s) {
  const v = String(s == null ? "" : s);
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
// CSV template: a single header row, CRLF-terminated, UTF-8. Zero data rows. Cannot carry dropdowns.
export function templateCsv(kind) {
  return templateHeaders(kind).map(csvEscape).join(",") + "\r\n";
}

// Recommended opt-in default for a path, in plain words (business recipientType comes from the path).
const DEFAULT_WORDS = {
  family: "Type Family · Relation Family Member · Description Greet-Me Worthy",
  friend: "Type Friend · Relation Acquaintance · Description Greet-Me Worthy",
  professional: "Type Professional · Relation Colleague · Description Greet-Me Worthy",
  employee: "Type Professional · Relation Employee · Description Greet-Me Worthy — recipient type “employee” comes from the Employees list",
  client: "Type Professional · Relation Client · Description Greet-Me Worthy — recipient type “client” comes from the Clients list",
  vendor: "Type Professional · Relation Vendor · Description Greet-Me Worthy — recipient type “vendor” comes from the Vendors list",
};

// Instructions content ({heading, lines}[]) for the Excel Instructions sheet (also test-readable).
// `generatedUtc` (optional) is stamped at download time; the pure default keeps output byte-stable.
export function templateInstructions(kind, { generatedUtc } = {}) {
  const business = isBusinessTemplateKind(kind);
  return [
    { heading: templateTitle(kind), lines: [
      "Fill in the Contacts sheet, one contact per row, then upload it in the Greet-Me Import Wizard.",
      "This template contains no example contacts — every row you add is your own.",
    ] },
    { heading: "Template version", lines: [
      `Template version: ${TEMPLATE_VERSION}`,
      "Generated by: Greet-Me",
      `Template type: ${KIND_LABEL[kind]} Contacts`,
      ...(generatedUtc ? [`Generated: ${generatedUtc} (UTC)`] : []),
      "Version 2 includes guided Type, Relation, and Description dropdowns in the Excel Contacts sheet.",
    ] },
    { heading: "Required fields", lines: [
      "Only Name and a valid Email are required. Everything else is optional.",
      "Relationship fields are optional until you begin filling them in.",
    ] },
    { heading: "Relationship (Type / Relation / Description)", lines: [
      "Type: Choose Family, Friend, or Professional.",
      "Relation: Choose the specific relationship. The available choices depend on Type.",
      "Description: Choose how Greet-Me should prioritize the relationship.",
      `Description values: ${DESCRIPTION_OPTIONS.join(" · ")}.`,
      "Click a cell in the Type, Relation, or Description column to display its dropdown arrow.",
      "The Relation dropdown will remain unavailable or empty until Type is selected.",
      "Leave all three blank to import without a relationship.",
    ] },
    { heading: "Recommended defaults (opt-in)", lines: [
      `For this list: ${DEFAULT_WORDS[kind]}.`,
      "Defaults are only ever applied when you choose to in Review. Your file values and edits always win.",
    ] },
    ...(business ? [{ heading: "Recipient type comes from this list", lines: [
      `Because this is the ${KIND_LABEL[kind]} template, every contact is imported as "${kind}". You do not enter a recipient type in the sheet.`,
    ] }] : [{ heading: "This is a Personal list", lines: [
      "Personal contacts never carry a business recipient type — that concept does not apply here.",
    ] }]),
    { heading: "Shipping address (optional)", lines: [
      "Address Line 1/2, City, State/Province, Postal/ZIP Code, Country map to the contact's shipping address.",
      "Entering an address only stores it for later — it does not purchase, schedule, or automate a gift.",
    ] },
    { heading: "Review & edit", lines: [
      "You can review and edit everything before importing, and you can edit recipients later at any time.",
      "Birthday is a full date; the Birthday column is date-formatted (e.g. 1990-05-14).",
    ] },
    { heading: "Excel vs CSV", lines: [
      "XLSX (Version 2) is the recommended formatted template — it includes the guided Type, Relation, and Description dropdowns, a frozen header, column widths, and validation.",
      "CSV templates contain the same columns but cannot include Excel dropdown controls or formatting. CSV is not a smart template.",
    ] },
    { heading: "Account", lines: [
      "This workbook is generated by Greet-Me and is not connected to any Microsoft, Google, employer, or organizational account. Excel may display the account currently signed into the local Office application.",
    ] },
  ];
}
