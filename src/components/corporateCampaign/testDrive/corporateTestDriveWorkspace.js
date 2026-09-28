// src/components/corporateCampaign/testDrive/corporateTestDriveWorkspace.js
//
// TEAM UX — Corporate Dashboard Test Drive. Reads and writes the SAME session-scoped practice
// workspace the Import Wizard already owns (src/import/sampleWorkspace.js: readPracticeView /
// saveSampleWorkspace, sessionStorage key "greetme_sample_workspace", fail-closed session
// discriminator). No new storage key, no new persistence mechanism — this module only converts
// between the Wizard's payload shape (buildReviewPayload output) and the shape the real Corporate
// Dashboard components (ContactTiles / CampaignCard / corporateDashboardModel.js) already expect
// ({ id, name, corporateContactType, ... }), and adds/edits stay inside that same sessionStorage
// record via the EXISTING saveSampleWorkspace() call — never a new API, never a backend write.

import { readPracticeView, saveSampleWorkspace, clearSampleWorkspace } from "../../../import/sampleWorkspace.js";

const BUSINESS_KINDS = new Set(["employee", "client", "vendor"]);

/** Whether the currently-stored practice workspace is a business (Employee/Client/Vendor) kind. */
export function isBusinessPracticeKind(kind) {
  return BUSINESS_KINDS.has(kind);
}

// A stable id per row within one session: position-based, since the wizard's payload shape carries
// no persisted id and order does not change except by appending (addPracticeContact) below.
function withId(contact, i) {
  return { ...contact, id: `practice-${i}` };
}

// Undo withId/corporateContactType-decoration before writing back to the wizard's own storage shape
// (which knows `recipientType`, not `id`/`corporateContactType`).
function toWizardShape(contact) {
  const out = { ...contact };
  delete out.id;
  delete out.corporateContactType;
  return out;
}

/**
 * Read the current practice workspace, shaped for the Corporate Dashboard:
 *   { status, kind, contacts: [{ id, name, corporateContactType, email, shippingAddress, ... }] }
 * `corporateContactType` is read from the SAME `recipientType` the Wizard's business path already
 * pins to the chosen category end-to-end (see reviewModel.js buildReview's audience derivation) —
 * never re-derived or guessed here.
 */
export function readCorporatePracticeWorkspace() {
  const view = readPracticeView();
  const contacts = (view.contacts || []).map((c, i) => withId({ ...c, corporateContactType: c.recipientType || null }, i));
  return { status: view.status, kind: view.kind || null, contacts };
}

/** Persist an edited/extended contact list back into the SAME session-scoped record. */
function persist(contacts, kind) {
  // Strip the display-only `id`/`corporateContactType` back out before saving — the Wizard's stored
  // shape is `recipientType`, not `corporateContactType`; keeping both in sync here, in one place,
  // is what stops the two names from drifting apart.
  const payload = contacts.map(toWizardShape);
  saveSampleWorkspace(payload, kind);
}

/** Update one practice contact's fields in place (name/email/shippingAddress/...). Session-only. */
export function editPracticeContact(id, patch) {
  const { contacts, kind } = readCorporatePracticeWorkspace();
  const next = contacts.map((c) => (c.id === id ? { ...c, ...patch } : c));
  persist(next, kind);
  return next.map((c) => ({ ...c }));
}

/**
 * Add one new fictional practice contact. `corporateContactType` is FORCED to the kind already
 * authoritative for this Test Drive session — the caller cannot pick a different category, which is
 * exactly the category-consistency rule this whole feature exists to enforce.
 */
export function addPracticeContact({ name, email, shippingAddress } = {}) {
  const { contacts, kind } = readCorporatePracticeWorkspace();
  const recipientType = isBusinessPracticeKind(kind) ? kind : "";
  const nextRaw = [
    ...contacts.map(toWizardShape),
    { name: name || "New practice contact", email: email || "", recipientType, shippingAddress: shippingAddress || null },
  ];
  saveSampleWorkspace(nextRaw, kind);
  return readCorporatePracticeWorkspace();
}

export { clearSampleWorkspace };
