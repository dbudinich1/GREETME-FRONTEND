// src/components/importWizard/ContactImportWizard.jsx
//
// TEAM A — Greet-Me Import Wizard. Screen 1 has two first-level paths (Personal / Business). Each
// path mirrors the other: a premium three-tile category selector (Screen 2) → a structured Upload
// Options screen (upload-your-own OR a zero-mutation Test Drive). Personal categories
// (Family/Friends/Professional) are UI context only — never a persisted relationship or a business
// type. Business categories (Employees/Clients/Vendors) auto-apply their canonical recipientType.
// Real Business import is dormant/fail-closed: choosing a real Business CSV shows the truthful dormant
// state BEFORE any read or write. Heavy logic lives in tested pure models (importCore / completionModel
// / recipientTypeModel / reviewModel). This component orchestrates and never modifies the locked
// Recipients page or adds backend routes.

import { useCallback, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import Papa from "papaparse";
import api from "../../api/api";
import {
  checkFileLimits, checkRowCount, autoMapHeaders, processRow, detectDuplicates,
  buildPlan, looksLikeZip,
} from "../../import/importCore.js";
import { assertNoRealMix } from "../../import/demoData.js";
import { MODES, existingEmailsFromResponse, classifyCommitOutcome, withOccasionDates } from "./wizardModel.js";
import { RELATIONSHIP_CATEGORIES, CLOSENESS_OPTIONS } from "../../import/completionModel.js";
import { RECIPIENT_TYPE_OPTIONS } from "../../import/recipientTypeModel.js";
import { normalizeEmail } from "../../import/importCore.js";
import {
  buildReview, buildReviewPayload, freshReviewState, paginate,
  setGroup, setRelation, setCloseness, setName, setEmail, setBirthday, leaveRelationshipBlank,
  chooseAudience, skipContact, markCommitted, setCommitErrors, addExistingEmails,
  relationsForGroup, AUDIENCE_CHOICES, REVIEW_BUCKET, relationLabelFor,
} from "../../import/reviewModel.js";
import { sampleContactsFor, sampleCsvFor, loadSampleWorkspace, saveSampleWorkspace, clearSampleWorkspace, detectPracticeCsv, stripPracticeMarker } from "../../import/sampleWorkspace.js";
import { templateCsv, templateFileBase } from "../../import/templateModel.js";
import { templateXlsx, templatePracticeXlsx, practiceFileBase, XLSX_MIME } from "../../import/xlsxTemplate.js";
import { recommendedDefaults, applyRecommendedDefaults, undoRecommendedDefaults } from "../../import/safeDefaults.js";
import { corporateAddressStatus } from "../../import/corporateAddressStatus.js";
import CorporateImportFlow from "./CorporateImportFlow.jsx";
import { showManualToast } from "../../utils/notify";
import { COMMS_CATEGORIES } from "../../utils/commsCatalog";

const PURPLE = "linear-gradient(135deg,#6d74ee,#764ba2)";
const card = { background: "#fff", border: "1px solid rgba(27,24,48,.1)", borderRadius: 14, padding: 18 };
const btn = (bg, fg = "#fff") => ({ background: bg, color: fg, border: bg === "transparent" ? "1px solid rgba(27,24,48,.15)" : "none", borderRadius: 11, padding: "10px 16px", fontWeight: 700, fontSize: ".85rem", cursor: "pointer" });
// Real calendar date for the age gate (never guessed). computeContactErrors needs it (audit F1).
const todayIso = () => new Date().toISOString().slice(0, 10);
// Business sample kinds auto-apply a recipientType; personal kinds (individual/family/friend/
// professional) never do. This decides the business/personal split for a Test Drive + reload restore.
const BUSINESS_KINDS = new Set(["employee", "client", "vendor", "mixed"]);
const isBusinessKind = (k) => BUSINESS_KINDS.has(k);
// Rebuild wizard-shaped rows from persisted (payload-shaped) sample contacts so a same-session reload
// restores the individual sample directly into the combined preview.
function rehydrateSampleRows(contacts) {
  return (contacts || []).map((c, i) => ({
    contact: { fullName: c.name || "", email: c.email || "", relationship: c.relationship || "", recipientType: c.recipientType || "" },
    index: i, demo: true, __raw: c.birthday ? { B: c.birthday } : {}, __map: c.birthday ? { birthday: "B" } : {},
  }));
}
// Translate a backend per-row import error into first-time-user language (no raw error strings shown).
function friendlyCommitError(raw) {
  const s = String(raw || "");
  if (/already exists/i.test(s)) return "Already in your recipient list—we'll skip this contact.";
  if (/limit|cap/i.test(s)) return "Your recipient limit was reached.";
  return "This contact couldn't be added. You can try again.";
}

export default function ContactImportWizard() {
  const navigate = useNavigate();
  // SLICE E5 - back to where the reader actually came from.
  //
  // /dashboard/contacts is the PERSONAL recipients page. Someone who arrived from a corporate
  // contact tile and imported employees would be returned to a list their import did not touch,
  // and would reasonably conclude the import had failed. When the visit began on the corporate
  // dashboard, the way back leads there.
  // Whether this visit began on the corporate dashboard, so the way back leads there rather than
  // to the personal contacts page the wizard otherwise returns to.
  const [cameFromCorporateDashboard, setCameFromCorporateDashboard] = useState(false);
  const returnToRecipients = useCallback(
    () => navigate(cameFromCorporateDashboard ? "/dashboard/campaigns" : "/dashboard/contacts"),
    [navigate, cameFromCorporateDashboard],
  );
  const [mode, setMode] = useState(null);
  const [rows, setRows] = useState(null);       // full deduped rows for the Review surface
  const [plan, setPlan] = useState(null);       // accounting (skipped/invalid) only
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Business recipient TYPE selection (null = individual ownership, no type gate).
  const [recipientKind, setRecipientKind] = useState(null);
  // Session-scoped Sample/Practice Workspace (never persisted to backend).
  const [sample, setSample] = useState(false);
  const [sampleContacts, setSampleContacts] = useState([]);
  // Real Business CSV attempt while organization import is dormant → truthful gated state (no read/write).
  const [bizDormant, setBizDormant] = useState(false);
  // Slice 2B-1: a genuine Corporate workbook → a READ-ONLY, COMMIT-FREE delivery-address preview
  // (normalized rows + address exception badges). No API call, no write — corporate import stays dormant.
  const [corporatePreview, setCorporatePreview] = useState(null);   // { items:[{index,contact,valid,errors,address,addressStatus}], kindLabel } | null
  // A marked Practice CSV chosen through the NORMAL uploader → a gate before Test Drive (no production path).
  const [practiceDetected, setPracticeDetected] = useState(null);   // { fields, rows } | null
  // A workbook with MULTIPLE eligible worksheets → the user must pick exactly one before mapping.
  const [worksheetChoice, setWorksheetChoice] = useState(null);     // { source, format, sheets:[{name,rowCount,fields,rows}] } | null
  // Presentation-only state for the UX-reference upload layout: whether the Test Drive modal is open,
  // and which format the single template-download button currently targets. Neither touches parsing,
  // validation, or commit — both are read by the same existing downloadTemplate/downloadPracticeXlsx/
  // downloadSampleCsv/onUploadPracticeCsv/trySample handlers used before this pass.
  const [testDriveOpen, setTestDriveOpen] = useState(false);
  const [tplFmt, setTplFmt] = useState("xlsx");
  // Partial real-import outcome ({added, failed}) — keeps the user on the combined screen (never a
  // false "complete success"). null = no partial result to show.
  const [partial, setPartial] = useState(null);
  // Entry navigation: "path" = Screen 1 (Personal/Business), "group" = Screen 2 Personal category,
  // "bizgroup" = Screen 2 Business category. personalGroup/recipientKind carry the chosen category.
  // A Personal category is UI CONTEXT ONLY — it NEVER becomes relationship data, a structured category,
  // or a business type; it only tailors the upload heading + which Practice CSV loads.
  const [entryView, setEntryView] = useState("path");
  const [personalGroup, setPersonalGroup] = useState(null);
  // The single Review state (relationship/audience choices, removals, description default). It is
  // reset — never carried — whenever a new file/kind/path is chosen.
  const [reviewState, setReviewState] = useState(() => freshReviewState({ business: false, kind: null }));
  const resetReview = (business, kind, existingEmails = []) => setReviewState(freshReviewState({ business, kind, existingEmails, todayIso: todayIso() }));

  // Restore a same-session sample on mount (non-secret session-scoped; a NEW login never restores an
  // old sample). Individual/Personal → rehydrate straight into the combined preview (no separate list);
  // Business → keep its own terminal list. Clear the sample on session expiry.
  useEffect(() => {
    const { contacts, kind } = loadSampleWorkspace();
    if (contacts.length) {
      setSample(true);
      if (kind && isBusinessKind(kind)) {
        setRecipientKind(kind); setMode(MODES.CORPORATE);
        setSampleContacts(contacts);                         // Business practice — its own terminal list
      } else {
        setRecipientKind(null); setMode(MODES.PERSONAL);
        setReviewState(freshReviewState({ business: false, kind: null, existingEmails: [], todayIso: todayIso() }));
        setRows(rehydrateSampleRows(contacts));              // Personal practice — combined preview
      }
    }
    // SLICE E5 - ENTRY FROM THE CORPORATE DASHBOARD.
    //
    // The tiles link here as ?mode=corporate&category=employee. Until now the wizard ignored both
    // and opened on its generic first screen, so "Add Employee" and "Import" landed somewhere that
    // had forgotten which tile was pressed.
    //
    // Only ever SKIPS AHEAD - it selects a path the reader already chose by pressing a labelled
    // button, and every on-screen control (Change category, Start over) still works from there.
    // A category outside the known set is ignored rather than guessed at.
    try {
      const q = new URLSearchParams(typeof window !== "undefined" ? (window.location.search || "") : "");
      const hash = typeof window !== "undefined" ? String(window.location.hash || "") : "";
      const hq = hash.includes("?") ? new URLSearchParams(hash.slice(hash.indexOf("?") + 1)) : null;
      const get = (k) => q.get(k) || (hq && hq.get(k)) || null;
      if (get("mode") === "corporate" && !contacts.length) {
        setCameFromCorporateDashboard(true);
        const category = String(get("category") || "").toLowerCase();
        if (isBusinessKind(category)) {
          setMode(MODES.CORPORATE);
          setRecipientKind(category);
          setEntryView("path");
          setReviewState(freshReviewState({ business: true, kind: category, existingEmails: [], todayIso: todayIso() }));
        } else {
          setEntryView("bizgroup");   // corporate, but no usable category - start at the chooser
        }
      }
    } catch { /* a host without a URL is simply the ordinary entry */ }

    const onExpire = () => { clearSampleWorkspace(); setSample(false); setSampleContacts([]); setRows(null); };
    if (typeof window !== "undefined") window.addEventListener("auth:session-expired", onExpire);
    return () => { if (typeof window !== "undefined") window.removeEventListener("auth:session-expired", onExpire); };
  }, []);

  // Persist the PERSONAL practice live (session-scoped only) so a same-session reload restores the
  // combined preview. Never a backend call. Business practice persists via its own commit path.
  useEffect(() => {
    if (sample && mode !== MODES.CORPORATE && !recipientKind && Array.isArray(rows)) {
      try { saveSampleWorkspace(buildReviewPayload(rows, reviewState), "individual"); } catch { /* ignore */ }
    }
  }, [sample, mode, recipientKind, rows, reviewState]);

  const pickMode = useCallback((m) => {
    setMode(m); setRows(null); setPlan(null); setSummary(null); setError(null); setPartial(null); setRecipientKind(null); setSample(false); setBizDormant(false);
    resetReview(m === MODES.CORPORATE, null);
  }, []);

  function ingest(records, existingEmails = [], business = false, kind = null) {
    const capped = checkRowCount(records.length);
    if (!capped.ok) { setError(`Too many rows (max ${capped.max}).`); return; }
    setPartial(null);                                    // a fresh file clears any prior partial result
    // Retain the raw row + mapping so the commit can transmit the birthday column. Pass a REAL
    // calendar date so importCore's age gate is active (audit F1 — a blank date is never used). The
    // review re-runs the same validator, so both layers agree.
    const today = todayIso();
    const processed = records.map((r, i) => ({ ...processRow(r.__raw || r, r.__map || {}, { todayIso: today }), index: i, __raw: r.__raw || r, __map: r.__map || {} }));
    const deduped = detectDuplicates(processed, existingEmails);
    setRows(deduped);                                   // Review shows EVERY row; buckets are exclusive
    setPlan(buildPlan(deduped, { duplicateStrategy: "skip" }));
    // The review owns validation + dedup: it needs the existing recipients + today's date in context.
    setReviewState(freshReviewState({ business, kind, existingEmails, todayIso: today }));
  }

  // Validate + parse an uploaded file. CSV → the existing Papa parser; .xlsx/.xls → the LAZY-LOADED
  // workbook reader (SheetJS is code-split into its own chunk, absent from the main bundle, and loads
  // only here on first Excel selection). Never trusts the extension — content is validated. Resolves
  // one of: null (a user error was set) | {kind:"rows",fields,rows} | {kind:"sheets",format,sheets}
  // (multiple eligible worksheets → the user picks one). Never throws.
  const parseFile = (file) => new Promise((resolve) => {
    setError(null);
    const name = String((file && file.name) || "");
    const lower = name.toLowerCase();
    if (/\.xlsm$/.test(lower)) { setError("Macro-enabled workbooks (.xlsm) aren’t supported. Save as .xlsx and upload again."); return resolve(null); }
    const lim = checkFileLimits(file);
    if (!lim.ok) {
      setError(lim.error === "file_too_large" ? "This file is too large (max 5 MB)."
        : lim.error === "unsupported_extension" ? "Unsupported file type. Upload an .xlsx, .xls, or .csv file."
        : `File rejected: ${lim.error}.`);
      return resolve(null);
    }
    if (/\.csv$/.test(lower)) {
      file.slice(0, 8).arrayBuffer().then((buf) => {
        if (looksLikeZip(new Uint8Array(buf))) { setError("This file looks like an Excel workbook, not a CSV. Rename it to .xlsx or upload a genuine CSV."); return resolve(null); }
        Papa.parse(file, { header: true, skipEmptyLines: true,
          complete: (out) => resolve({ kind: "rows", fields: (out.meta && out.meta.fields) || [], rows: out.data || [] }),
          error: () => { setError("Could not parse the file."); resolve(null); } });
      }).catch(() => { setError("Could not read the file."); resolve(null); });
      return;
    }
    if (/\.(xlsx|xls)$/.test(lower)) {
      file.arrayBuffer().then(async (buf) => {
        const mod = await import("../../import/xlsxReader.js");        // dynamic → SheetJS code-split (never eager)
        const res = await mod.readWorkbookBytes(new Uint8Array(buf), name);
        if (!res.ok) { setError(mod.readerMessage(res.error)); return resolve(null); }
        if (res.needsSelection) return resolve({ kind: "sheets", format: res.format, sheets: res.eligible });
        const only = res.eligible[0];
        resolve({ kind: "rows", fields: only.fields, rows: only.rows });
      }).catch(() => { setError("Could not read the file."); resolve(null); });
      return;
    }
    setError("Unsupported file type. Upload an .xlsx, .xls, or .csv file.");
    resolve(null);
  });

  // Ingest a PRACTICE upload → Test Drive. Sets the practice boundary (sample=true) BEFORE any review, so a
  // production commit path is structurally unreachable. Strips the marker column (never a contact field /
  // payload value). NEVER calls api.getContacts or api.importContacts.
  const ingestPracticeUpload = (fields, rawRows) => {
    const { fields: cleanFields, rows: cleanRows } = stripPracticeMarker(fields, rawRows);
    const capped = checkRowCount(cleanRows.length);
    if (!capped.ok) { setError(`Too many rows (max ${capped.max}).`); return; }
    const today = todayIso();
    const { mapping } = autoMapHeaders(cleanFields);
    const business = mode === MODES.CORPORATE;
    const kind = business ? recipientKind : null;          // recipientType is path-derived; personal → ""
    const processed = cleanRows.map((raw, i) => ({ ...processRow(raw, mapping, { todayIso: today }), index: i, demo: true, __raw: raw, __map: mapping }));
    setSample(true); setError(null); setSummary(null); setSampleContacts([]); setPartial(null); setBizDormant(false); setPracticeDetected(null);
    setReviewState(freshReviewState({ business, kind, existingEmails: [], todayIso: today }));
    const deduped = detectDuplicates(processed, []);
    setRows(deduped); setPlan(buildPlan(deduped, { duplicateStrategy: "skip" }));
  };

  // After parsing yields concrete rows, route by source (Excel and CSV converge here identically):
  //   practice → always Test Drive; personal → practice-defense then real import (loads existing
  //   recipients, fail-closed); business → practice-defense then the truthful dormant state.
  const routeParsedRows = useCallback(async (source, fields, rows) => {
    if (source === "practice") { ingestPracticeUpload(fields, rows); return; }
    // Practice-file defense: a marked Practice file (CSV or workbook) never reaches production commit.
    const det = detectPracticeCsv(fields, rows);
    if (det.marked) {
      if (!det.valid) { setError("This practice file is invalid — its practice marker is malformed. Download a fresh practice file and try again."); return; }
      setPracticeDetected({ fields, rows });               // gate → Continue in Test Drive (no production path)
      return;
    }
    if (source === "business") {
      // Slice 2B-1: build a READ-ONLY, COMMIT-FREE preview of the corporate workbook. Same shared
      // normalization the future commit (2B-2) would submit — but NO API call, NO write, NO order.
      const { mapping } = autoMapHeaders(fields);
      const today = todayIso();
      const items = rows.map((raw, i) => {
        const p = processRow(raw, mapping, { todayIso: today });
        // SLICE E5 - the occasion dates travel with the contact. buildCorporatePayload transmits
        // `item.contact` verbatim, so a field absent here never reaches the server at all - which
        // is exactly why corporate birthdays were being dropped silently.
        const contact = withOccasionDates(p.contact, raw, mapping);
        return { index: i, contact, valid: p.valid, errors: p.errors, address: contact.shippingAddress || null, addressStatus: corporateAddressStatus(contact.shippingAddress) };
      });
      setError(null); setBizDormant(false);
      const kindLabel = recipientKind ? recipientKind[0].toUpperCase() + recipientKind.slice(1) : "Corporate";
      setCorporatePreview({ items, kindLabel });
      return;
    }
    // Ordinary Personal import: load EXISTING recipients so an already-present email previews as a
    // duplicate. FAIL CLOSED if the lookup fails (never proceed with an empty existing-email list).
    setBusy(true);
    let resp; try { resp = await api.getContacts(); } catch { resp = { ok: false }; }
    setBusy(false);
    const ex = existingEmailsFromResponse(resp);
    if (!ex.ok) { setError("Couldn't load your existing recipients, so duplicates can't be checked. Please try again."); return; }
    const { mapping } = autoMapHeaders(fields);
    const data = rows.map((raw) => ({ __raw: raw, __map: mapping }));
    ingest(data, ex.emails, false, null);
  }, [mode, recipientKind]);

  // Multiple eligible worksheets → the user picks EXACTLY ONE (worksheets are never merged), then we
  // route that sheet's rows by the original upload source.
  const chooseWorksheet = useCallback((sheetName) => {
    setWorksheetChoice((wc) => {
      if (wc) { const s = wc.sheets.find((x) => x.name === sheetName); if (s) routeParsedRows(wc.source, s.fields, s.rows); }
      return null;
    });
  }, [routeParsedRows]);
  const cancelWorksheet = () => { setWorksheetChoice(null); setError(null); };

  // Dedicated "Upload Practice CSV" control (inside Test Drive Option 1) — ALWAYS enters Test Drive.
  const onUploadPracticeCsv = useCallback(async (file) => {
    const p = await parseFile(file);
    if (!p) return;
    if (p.kind === "sheets") { setWorksheetChoice({ source: "practice", format: p.format, sheets: p.sheets }); return; }
    routeParsedRows("practice", p.fields, p.rows);
  }, [routeParsedRows]);

  const onFile = useCallback(async (file) => {
    const p = await parseFile(file);
    if (!p) return;
    if (p.kind === "sheets") { setWorksheetChoice({ source: "personal", format: p.format, sheets: p.sheets }); return; }
    routeParsedRows("personal", p.fields, p.rows);
  }, [routeParsedRows]);

  // BUSINESS "Choose a file". A marked Practice file → Test Drive. A genuine (unmarked) business file →
  // the truthful dormant state; it never reaches a parse-to-commit or any write.
  const onBusinessRealFile = useCallback(async (file) => {
    const p = await parseFile(file);
    if (!p) return;
    if (p.kind === "sheets") { setWorksheetChoice({ source: "business", format: p.format, sheets: p.sheets }); return; }
    routeParsedRows("business", p.fields, p.rows);
  }, [routeParsedRows]);

  const commitPersonal = useCallback(async () => {
    if (mode !== MODES.PERSONAL) return;
    // Only the READY rows are sent; ADDED (already-committed) rows are excluded, so a partial retry can
    // never submit a row twice. Individual/business recipientType boundary enforced in the payload.
    const contacts = buildReviewPayload(rows, reviewState);
    if (!contacts.length) return;
    setBusy(true); setError(null);
    let res;
    // Preserve the thrown status (api.request throws Error{status} on 403/429/5xx) so the outcome
    // classifier can distinguish failures and message them correctly.
    try { res = await api.importContacts(contacts); } catch (e) { res = { ok: false, status: e && e.status, error: String(e && e.message) }; }
    setBusy(false);
    // FAIL CLOSED: never treat a non-2xx / {ok:false} / network / thrown / empty body as success.
    const outcome = classifyCommitOutcome(res);
    if (outcome.status !== "success") { setError(outcome.message); return; }   // zero-success → stay, plain error

    // Split the recognized results body into added vs per-row failures.
    const s = outcome.summary;
    const errs = Array.isArray(s.errors) ? s.errors : [];
    const failed = new Map();                                   // normalized email → plain retry message
    for (const er of errs) {
      const em = normalizeEmail((er && er.contact && er.contact.email) || (er && er.email) || "");
      if (em) failed.set(em, friendlyCommitError(er && er.error));
    }
    const addedEmails = contacts.map((c) => normalizeEmail(c.email)).filter((em) => em && !failed.has(em));

    if (failed.size === 0) {
      // FULL success → go straight to the actual Recipients page with a truthful toast. No result screen.
      try { showManualToast("Added ✓", `${addedEmails.length} contact${addedEmails.length === 1 ? "" : "s"} added successfully.`, COMMS_CATEGORIES.PROFILE); } catch { /* ignore */ }
      returnToRecipients();
      return;
    }
    // PARTIAL → stay on the combined screen. Mark added rows (ADDED, never re-sent); "already exists"
    // failures read as already-in-list; other failures stay Ready with a plain retry note.
    const alreadyExisting = [];
    const retryMap = {};
    for (const [em, msg] of failed) { if (/already exists/i.test((errs.find((x) => normalizeEmail((x.contact && x.contact.email) || x.email) === em) || {}).error || "")) alreadyExisting.push(em); else retryMap[em] = msg; }
    setReviewState((st) => setCommitErrors(addExistingEmails(markCommitted(st, addedEmails), alreadyExisting), retryMap));
    setPartial({ added: addedEmails.length, failed: failed.size });
  }, [mode, rows, reviewState, returnToRecipients]);

  // "Start Test Drive" — load fictional data for a category into a SESSION-SCOPED Practice Workspace
  // and run the exact same Review flow. NEVER touches a backend endpoint. kind ∈ individual/family/
  // friend/professional (personal) or employee/client/vendor/mixed (business).
  const trySample = useCallback((kind) => {
    setSample(true); setError(null); setSummary(null); setSampleContacts([]); setPartial(null); setBizDormant(false);
    const business = isBusinessKind(kind);
    const rk = business ? kind : null;                         // personal categories persist NO type
    setRecipientKind(rk);
    setReviewState(freshReviewState({ business, kind: rk, existingEmails: [], todayIso: todayIso() }));
    const ds = sampleContactsFor(kind);
    assertNoRealMix(ds);
    const processed = ds.map((c, i) => ({ contact: c, errors: [], warnings: [], valid: true, duplicate: null, index: i, demo: true, __raw: {}, __map: {} }));
    setRows(processed); setPlan(buildPlan(processed, { duplicateStrategy: "skip" }));
  }, []);

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  const downloadSampleCsv = useCallback((kind) => {
    try { triggerDownload(new Blob([sampleCsvFor(kind)], { type: "text/csv;charset=utf-8" }), `greetme-practice-${kind}.csv`); }
    catch { setError("Could not generate the practice file."); }
  }, []);
  // Practice EXCEL workbook — the same guided .xlsx structure + dropdowns, PLUS fictional Sample rows and
  // the authoritative practice marker column. Uploading it (here or via "Choose a file") always opens Test
  // Drive. It is NEVER a production import (the marker forces the practice boundary before review).
  const downloadPracticeXlsx = useCallback((kind) => {
    try {
      const contacts = sampleContactsFor(kind);
      triggerDownload(new Blob([templatePracticeXlsx(kind, { contacts, generatedUtc: new Date().toISOString().slice(0, 10) })], { type: XLSX_MIME }), `${practiceFileBase(kind)}.xlsx`);
    } catch { setError("Could not generate the practice workbook."); }
  }, []);
  // Blank, category-specific template (Excel recommended). A blank template is NOT a Practice CSV —
  // it carries only headers, no fictional/production rows.
  const downloadTemplate = useCallback((kind, fmt) => {
    try {
      const base = templateFileBase(kind);   // greetme-<kind>-contacts-template-v2
      if (fmt === "xlsx") triggerDownload(new Blob([templateXlsx(kind, { generatedUtc: new Date().toISOString().slice(0, 10) })], { type: XLSX_MIME }), `${base}.xlsx`);
      else triggerDownload(new Blob([templateCsv(kind)], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
    } catch { setError("Could not generate the template file."); }
  }, []);

  // BUSINESS practice terminal step ("View X practice recipients"): build the practice recipients and
  // persist ONLY to the session-scoped Practice Workspace — never a backend mutation. (Personal
  // practice is already terminal on the combined screen and does not use this path.)
  const commitSample = useCallback(() => {
    if (!sample) return;
    try { assertNoRealMix((rows || []).map((r) => r.contact)); } catch (e) { setError(String(e && e.message)); return; }
    const built = buildReviewPayload(rows, reviewState);
    saveSampleWorkspace(built, recipientKind || "mixed");
    setSampleContacts(built); setRows(null); setPlan(null);
    setSummary({ sampleWorkspace: true, count: built.length });
  }, [sample, rows, reviewState, recipientKind]);

  // "View Practice Contacts in Recipients" — persist the session-scoped practice workspace (NEVER a
  // backend write) and open the Recipients page in explicit Practice View. No api.importContacts, no
  // Cosmos write, and never the production list without the practice marker.
  const viewPracticeInRecipients = useCallback(() => {
    if (!sample) return;
    try {
      assertNoRealMix((rows || []).map((r) => r.contact));
      const built = buildReviewPayload(rows, reviewState);
      saveSampleWorkspace(built, recipientKind || "individual");
      navigate("/dashboard/contacts?practice=1");
    } catch (e) { setError(String(e && e.message)); }
  }, [sample, rows, reviewState, recipientKind, navigate]);

  const commitCorporate = useCallback(() => {
    if (mode !== MODES.CORPORATE) return;
    // Corporate import backend is dormant/fail-closed — NEVER writes, never enables a campaign,
    // occasion, schedule, queue, worker, gift, or send. Truthful gated state.
    setBizDormant(true);
  }, [mode]);

  // START OVER — clears ALL selection/parse/edit/result state (and the session-scoped practice
  // workspace) and returns to Screen 1 (Personal/Business). Never touches production contacts.
  const startOver = () => {
    clearSampleWorkspace();
    setMode(null); setRecipientKind(null);
    setSample(false); setSampleContacts([]); setRows(null); setPlan(null); setSummary(null); setPartial(null); setBizDormant(false); setPracticeDetected(null); setWorksheetChoice(null); setCorporatePreview(null);
    setError(null); setBusy(false); setReviewState(freshReviewState({ business: false, kind: null }));
    setEntryView("path"); setPersonalGroup(null);        // back to Screen 1, no stale category context
  };
  const exitSample = () => { clearSampleWorkspace(); setSample(false); setSampleContacts([]); setMode(null); setRecipientKind(null); setRows(null); setPlan(null); setSummary(null); setPartial(null); setBizDormant(false); setPracticeDetected(null); setWorksheetChoice(null); setCorporatePreview(null); setError(null); };
  const deleteAllSample = exitSample;   // both clear the session-scoped practice data
  // From a PERSONAL practice, swap to a real Personal upload (clears the practice, keeps the path).
  const uploadOwnFromSample = () => { clearSampleWorkspace(); setSample(false); setSampleContacts([]); setRows(null); setPlan(null); setError(null); setPartial(null); setMode(MODES.PERSONAL); resetReview(false, null); };
  // Screen 2 (Personal): choose a category → store context only, then continue to the Personal upload
  // options screen (mode = personal). Never persists a relationship or a business type.
  const choosePersonalGroup = (group) => { setPersonalGroup(group); setEntryView("path"); pickMode(MODES.PERSONAL); };
  // Screen 2 (Business): choose a category → set its canonical recipientType + business ownership, then
  // continue to the Business upload options screen. No membership call (import is dormant by design).
  const chooseBusinessGroup = (kind) => {
    setMode(MODES.CORPORATE); setRecipientKind(kind); setEntryView("path");
    setRows(null); setPlan(null); setSummary(null); setPartial(null); setError(null); setSample(false); setBizDormant(false); setCorporatePreview(null);
    resetReview(true, kind);
  };
  const backToPath = () => { setEntryView("path"); setPersonalGroup(null); };   // Screen 2 → Screen 1
  const changePersonalGroup = () => { setMode(null); setRows(null); setPlan(null); setSummary(null); setPartial(null); setError(null); setBizDormant(false); setPracticeDetected(null); setWorksheetChoice(null); setCorporatePreview(null); setEntryView("group"); };   // upload → Screen 2 (Personal)
  const changeBusinessGroup = () => { setMode(null); setRecipientKind(null); setRows(null); setPlan(null); setSummary(null); setPartial(null); setError(null); setBizDormant(false); setPracticeDetected(null); setWorksheetChoice(null); setCorporatePreview(null); setEntryView("bizgroup"); };   // upload → Screen 2 (Business)

  // ---------- render ----------
  // Session-scoped Practice Recipients (completed or resumed) — read-only presentation.
  if (sample && sampleContacts.length > 0 && !rows) {
    return <SampleRecipientsView contacts={sampleContacts} onDeleteAll={deleteAllSample} onExit={exitSample} onReturn={returnToRecipients} />;
  }
  // Canonical entry — Screen 1 (two premium paths) and Screen 2 (Personal or Business category tiles).
  if (!mode && !sample) {
    // SCREEN 2 — Personal category (Family / Friends / Professional).
    if (entryView === "group") {
      return (
        <Shell eyebrow="PERSONAL RELATIONSHIPS">
          <h2 className="gmiw-heading">Who Are You Importing?</h2>
          <div className="gmiw-panels gmiw-panels--three" data-testid="group-panels">
            {PERSONAL_GROUPS.map((g) => {
              const Icon = g.Icon;
              return (
                <button
                  type="button" className="gmiw-panel" data-testid={`panel-${g.value}`} key={g.value}
                  aria-label={`${g.title} — ${g.copy}`} onClick={() => choosePersonalGroup(g.value)}
                >
                  <span className={`gmiw-medallion ${g.medallion}`} aria-hidden="true"><Icon /></span>
                  <span className="gmiw-panel-title">{g.title}</span>
                  <span className="gmiw-panel-copy">{g.copy}</span>
                  <span className="gmiw-cta">{g.cta}</span>
                </button>
              );
            })}
          </div>
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <button type="button" data-testid="back-to-path" style={{ ...btn("transparent", "#5a3fb0"), background: "rgba(255,255,255,.7)" }} onClick={backToPath}>← Back to Personal or Business</button>
          </div>
        </Shell>
      );
    }
    // SCREEN 2 — Business category (Employees / Clients / Vendors). Mirrors the Personal selector.
    if (entryView === "bizgroup") {
      return (
        <Shell eyebrow="BUSINESS RELATIONSHIPS">
          <h2 className="gmiw-heading">Who Are You Importing?</h2>
          <div className="gmiw-panels gmiw-panels--three" data-testid="biz-panels">
            {BUSINESS_GROUPS.map((g) => {
              const Icon = g.Icon;
              return (
                <button
                  type="button" className="gmiw-panel" data-testid={`panel-${g.value}`} key={g.value}
                  aria-label={`${g.title} — ${g.copy}`} onClick={() => chooseBusinessGroup(g.value)}
                >
                  <span className={`gmiw-medallion ${g.medallion}`} aria-hidden="true"><Icon /></span>
                  <span className="gmiw-panel-title">{g.title}</span>
                  <span className="gmiw-panel-copy">{g.copy}</span>
                  <span className="gmiw-cta">{g.cta}</span>
                </button>
              );
            })}
          </div>
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <button type="button" data-testid="back-to-path" style={{ ...btn("transparent", "#5a3fb0"), background: "rgba(255,255,255,.7)" }} onClick={backToPath}>← Back to Personal or Business</button>
          </div>
        </Shell>
      );
    }
    // SCREEN 1 — Import path (Personal / Business).
    return (
      <Shell>
        <h2 className="gmiw-heading">Import Those Important to You</h2>
        <div className="gmiw-panels" data-testid="path-panels">
          <button
            type="button" className="gmiw-panel" data-testid="panel-personal"
            aria-label="Personal Relationships — Family, friends, and whoever is important to you"
            onClick={() => setEntryView("group")}
          >
            <span className="gmiw-medallion" aria-hidden="true"><HeartIcon /></span>
            <span className="gmiw-panel-title">Personal Relationships</span>
            <span className="gmiw-panel-copy">Family, friends, and whoever is important to you.</span>
            <span className="gmiw-cta">CHOOSE PERSONAL →</span>
          </button>
          <button
            type="button" className="gmiw-panel" data-testid="panel-business"
            aria-label="Business Relationships — Employees, clients, vendors, and professional contacts"
            onClick={() => setEntryView("bizgroup")}
          >
            <span className="gmiw-medallion gmiw-medallion--plum" aria-hidden="true"><BriefcaseIcon /></span>
            <span className="gmiw-panel-title">Business Relationships</span>
            <span className="gmiw-panel-copy">Employees, clients, vendors, and professional contacts.</span>
            <span className="gmiw-cta">CHOOSE BUSINESS →</span>
          </button>
        </div>
        <p className="gmiw-footer">You can return and choose a different path at any time.</p>
      </Shell>
    );
  }

  const business = mode === MODES.CORPORATE;

  // Slice 2B-2B: a genuine Corporate workbook drives the commit flow — preview → confirm + authorized
  // organization selection → authenticated commit (dormant endpoint → truthful 503) → deterministic
  // reconciliation → results summary (stays put). Practice/Test Drive can never reach here (!sample)
  // and CorporateImportFlow additionally fail-closed-guards every network call on `sample`. Personal
  // review is untouched. Commit uses the dedicated corporate client — NOT the Personal api helper.
  if (business && corporatePreview && !sample) {
    return (
      <Shell back={startOver}>
        <CorporateImportFlow items={corporatePreview.items} kindLabel={corporatePreview.kindLabel} sample={sample} onStartOver={startOver} />
      </Shell>
    );
  }

  // BUSINESS real import is dormant — a truthful, usable gated state reached from a real Business-upload
  // attempt (never a blank screen, no vague future promise, never implies data was saved).
  if (business && bizDormant && !sample) {
    return (
      <Shell back={startOver}>
        <Empty title="Organization import is currently turned off" body="This feature isn't accepting imports right now, and nothing has been saved. Your personal recipient list is ready to use." />
        <div data-testid="biz-dormant" style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
          <button style={btn("transparent", "#1b1830")} onClick={() => setBizDormant(false)}>Back to upload options</button>
          <button style={btn(PURPLE)} onClick={() => { setBizDormant(false); trySample(recipientKind); }}>Start Test Drive instead</button>
          <button style={btn("transparent", "#1b1830")} onClick={returnToRecipients}>Return to Recipients</button>
        </div>
      </Shell>
    );
  }

  // Upload Options / Test Drive UI — Personal or Business. Both share the same structured screen.
  const activeGroupMeta = business
    ? (BUSINESS_GROUPS.find((g) => g.value === recipientKind) || null)
    : (PERSONAL_GROUPS.find((g) => g.value === personalGroup) || null);
  const kindLabel = business && activeGroupMeta ? activeGroupMeta.title : undefined;
  // Category-appropriate Practice CSV / Test Drive dataset (personal categories carry no type).
  const templateKind = business ? (recipientKind || "employee") : (personalGroup || "individual");
  const onCommit = sample ? commitSample : (business ? commitCorporate : commitPersonal);
  const onRealFile = business ? onBusinessRealFile : onFile;
  const changeGroup = business ? changeBusinessGroup : changePersonalGroup;
  // Personal practice is terminal on the combined screen — it carries its own action bar (no commit CTA,
  // no separate "View recipients" screen). Business practice keeps its existing commit path.
  const sampleActions = (sample && !business) ? {
    onUploadOwn: uploadOwnFromSample,
    onDownloadCsv: () => downloadSampleCsv(templateKind),
    onDelete: deleteAllSample,
    onExit: exitSample,
  } : null;
  return (
    <Shell back={startOver}>
      {sample && <SampleBanner />}
      {error && <div role="alert" style={{ ...card, borderColor: "rgba(214,69,69,.4)", background: "rgba(214,69,69,.08)", color: "#8a1f1f", marginBottom: 12 }}>{error}</div>}

      {/* NORMAL-UPLOADER DEFENSE — a marked Practice CSV chosen through "Choose a CSV file" is forced into
          Test Drive. The ONLY continuation is Test Drive (no production import). */}
      {!rows && !summary && practiceDetected && (
        <div className="gmiw-upload">
          <div className="gmiw-upsec gmiw-practice" data-testid="practice-detected" role="alert">
            <span className="gmiw-badge">Safe practice mode</span>
            <h3>Greet-Me Practice CSV detected</h3>
            <p>This file contains fictional practice contacts. It will open in Test Drive, and nothing will be saved or sent.</p>
            <div className="gmiw-practice-cta">
              <button data-testid="continue-in-testdrive" style={btn(PURPLE)} onClick={() => ingestPracticeUpload(practiceDetected.fields, practiceDetected.rows)}>Continue in Test Drive</button>
              <button data-testid="practice-detected-cancel" style={btn("transparent", "#1b1830")} onClick={() => setPracticeDetected(null)}>Choose a different file</button>
            </div>
          </div>
        </div>
      )}

      {/* Worksheet selector — a workbook with multiple eligible sheets. Safe metadata only (name +
          approximate populated-row count). Picking one routes THAT sheet only; sheets are never merged. */}
      {!rows && !summary && !practiceDetected && worksheetChoice && (
        <div className="gmiw-upload">
          <div className="gmiw-upsec" data-testid="worksheet-select">
            <h3>Choose a worksheet</h3>
            <p>This workbook has more than one sheet of contacts. Pick the one to import — only that sheet is used, and nothing is combined. Instructions, Lists, and Reference sheets and hidden or empty sheets are skipped.</p>
            <div className="gmiw-ws-list">
              {worksheetChoice.sheets.map((s) => (
                <button key={s.name} data-testid="worksheet-option" className="gmiw-ws-option" onClick={() => chooseWorksheet(s.name)}>
                  <b>{s.name}</b>
                  <span>{s.rowCount} row{s.rowCount === 1 ? "" : "s"}</span>
                </button>
              ))}
            </div>
            <button data-testid="worksheet-cancel" style={btn("transparent", "#1b1830")} onClick={cancelWorksheet}>Choose a different file</button>
          </div>
        </div>
      )}

      {/* Structured Upload Options — upload-your-own (OR) a zero-mutation Test Drive. */}
      {!rows && !summary && !practiceDetected && !worksheetChoice && (
        <div className="gmiw-upload">
          {activeGroupMeta && (
            <div data-testid="upload-context" style={{ ...card, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10, padding: "12px 16px" }}>
              <span aria-hidden="true" />
              <b style={{ fontFamily: "Georgia,serif", fontSize: "1.05rem", textAlign: "center", overflowWrap: "anywhere" }}>{activeGroupMeta.uploadHeading}</b>
              <button data-testid="change-group" style={{ ...btn("transparent", "#4a3fb0"), padding: "4px 10px", fontSize: ".78rem", justifySelf: "end" }} onClick={changeGroup}>Change</button>
            </div>
          )}
          {/* Two-column layout (UX reference): Upload card + Test Drive trigger card. Same handlers
              as before this pass — onRealFile / trySample / downloadPracticeXlsx / downloadSampleCsv /
              onUploadPracticeCsv are unchanged; only the presentation (side-by-side cards + a modal
              instead of a full inline section) moved. */}
          <div className="gmiw-uxref-grid">
            <section className="gmiw-upsec gmiw-upsec--center" data-testid="upload-section">
              <h3 style={{ textAlign: "center" }}>Upload your contacts</h3>
              <p style={{ textAlign: "center" }}>Upload an Excel or CSV file to add your contacts. You'll review everything before importing.</p>
              <label className="gmiw-choose" data-testid="choose-csv">
                Choose a file
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onRealFile(e.target.files[0])} />
              </label>
            </section>
            <button type="button" className="gmiw-testdrive-card" data-testid="open-testdrive-modal" onClick={() => setTestDriveOpen(true)}>
              <span className="gmiw-medallion" aria-hidden="true" style={{ width: 56, height: 56 }}><CarIcon /></span>
              <span className="gmiw-testdrive-label">TEST DRIVE WIZARD</span>
              <p>Try the full import with a fictional sample list — nothing is saved.</p>
            </button>
          </div>

          {/* Template Library callout — links to the standalone browsing page (unchanged route). */}
          <Link to="/dashboard/templates" className="gmiw-tpl-library-callout" data-testid="template-library-link">
            <span>Browse the full <b>Template Library</b> — every category's blank template and sample in one place.</span>
            <span>Open →</span>
          </Link>

          {/* Blank, category-specific template (NOT the populated Practice CSV) — one format toggle,
              one download button, same downloadTemplate(kind, fmt) handler as before this pass. */}
          <section className="gmiw-upsec gmiw-upsec--center gmiw-tpl-panel" data-testid="template-block">
            <h4 style={{ textAlign: "center" }} data-testid="template-heading">{TEMPLATE_HEADING[templateKind] || "Need a file to fill out?"}</h4>
            <p style={{ textAlign: "center" }}>Download the template, complete it, and upload it here.</p>
            <div className="gmiw-fmt-toggle" role="group" aria-label="File format">
              <button type="button" data-testid="template-fmt-xlsx" className={tplFmt === "xlsx" ? "active" : ""} onClick={() => setTplFmt("xlsx")}>Excel (.xlsx)</button>
              <button type="button" data-testid="template-fmt-csv" className={tplFmt === "csv" ? "active" : ""} onClick={() => setTplFmt("csv")}>CSV (.csv)</button>
            </div>
            <div className="gmiw-tpl-dl-wrap">
              <button data-testid="download-template-btn" className="gmiw-tpl-dl-btn" style={btn(PURPLE)} onClick={() => downloadTemplate(templateKind, tplFmt)}>
                Download {activeGroupMeta ? activeGroupMeta.title : "contact"} template ({tplFmt === "xlsx" ? "Excel" : "CSV"})
              </button>
            </div>
            <div className="gmiw-tpl-finePrint">
              <p className="gmiw-tpl-note" data-testid="template-version-note">Version 2 — includes guided Type, Relation, and Description dropdowns in Excel.</p>
              <p className="gmiw-tpl-note" data-testid="excel-recommend-note">Guided Excel Template — recommended; includes guided dropdowns and instructions.</p>
              <p className="gmiw-tpl-note" data-testid="csv-disclosure">Basic CSV Template — compatibility option; CSV files do not contain dropdowns, formatting, or workbook instructions.</p>
            </div>
          </section>

          <TestDriveModal
            open={testDriveOpen} onClose={() => setTestDriveOpen(false)} kindLabel={activeGroupMeta ? activeGroupMeta.title : "contact"}
            onDownloadSample={() => downloadPracticeXlsx(templateKind)}
            onDownloadSampleCsv={() => downloadSampleCsv(templateKind)}
            onUploadSample={(file) => { setTestDriveOpen(false); onUploadPracticeCsv(file); }}
            onStartInstant={() => { setTestDriveOpen(false); trySample(templateKind); }}
          />
        </div>
      )}

      {/* Combined Review/Preview — the ONLY screen after the upload/practice choice for Personal.
          Real success navigates straight to Recipients; there is no wizard result/list screen. */}
      {rows && !summary && (
        <ReviewScreen
          rows={rows} state={reviewState} setState={setReviewState}
          business={business} kindLabel={kindLabel} demo={sample} busy={busy}
          partial={partial} sampleActions={sampleActions} defaultsPath={templateKind}
          onCommit={onCommit} onStartOver={startOver} onViewPractice={viewPracticeInRecipients}
        />
      )}
    </Shell>
  );
}

// ---- small presentational helpers ----
const sub = { fontSize: ".8rem", color: "#605c78", marginTop: 4 };
const muted = { color: "#605c78" };
const selStyle = { padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(27,24,48,.18)", fontSize: ".82rem", background: "#fff" };

function Shell({ children, back, eyebrow = "A PREMIUM GREET-ME EXPERIENCE" }) {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 12 }}>
      <PremiumStyles />
      <div className="gmiw-underlay">
        <div className="gmiw-surface">
          <header className="gmiw-banner">
            <span className="gmiw-wand" data-testid="wand-icon" aria-hidden="true"><WandSparkles /></span>
            <div className="gmiw-eyebrow">{eyebrow}</div>
            <h1 className="gmiw-title">Greet-Me™ Import Wizard</h1>
            <div className="gmiw-tagline">Forget Them Not!</div>
          </header>
          {back && <button style={{ ...btn("transparent", "#5a3fb0"), marginTop: 16, background: "rgba(255,255,255,.7)" }} onClick={back}>← Start over</button>}
          <div style={{ marginTop: 4 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// ---- Premium Screen-1 visuals (scoped CSS for real hover/focus/active + responsive stacking) ----
function PremiumStyles() {
  return (
    <style>{`
      .gmiw-underlay{ position:relative; overflow:hidden; border-radius:30px; padding:22px;
        background:linear-gradient(135deg,#f3e8fb 0%,#fceef6 46%,#efeafc 100%);
        box-shadow:0 34px 80px -34px rgba(96,52,148,.5); }
      .gmiw-underlay::before{ content:""; position:absolute; width:240px; height:240px; border-radius:50%;
        background:radial-gradient(circle,rgba(206,142,222,.35),transparent 70%); top:-84px; right:-56px; }
      .gmiw-underlay::after{ content:""; position:absolute; width:220px; height:220px; border-radius:50%;
        background:radial-gradient(circle,rgba(255,206,168,.30),transparent 70%); bottom:-70px; left:-50px; }
      .gmiw-surface{ position:relative; z-index:1; background:rgba(255,255,255,.85); border-radius:22px; padding:24px; }
      .gmiw-banner{ position:relative; text-align:center; color:#fff; border-radius:20px; padding:26px 60px;
        background:linear-gradient(135deg,#6d74ee,#764ba2); box-shadow:0 16px 34px -16px rgba(84,42,124,.65); }
      .gmiw-wand{ position:absolute; left:26px; top:50%; transform:translateY(-50%); display:inline-flex; }
      .gmiw-eyebrow{ font-size:.68rem; letter-spacing:.24em; font-weight:800; color:#f2dca6; }
      .gmiw-title{ margin:.35rem 0 0; font-family:Georgia,'Times New Roman',serif; font-weight:600; font-size:1.95rem; letter-spacing:.01em; text-wrap:balance; }
      .gmiw-tagline{ margin-top:.25rem; font-family:Georgia,serif; font-style:italic; font-size:1.05rem; color:#f5e7cb; }
      .gmiw-heading{ text-align:center; font-family:Georgia,'Times New Roman',serif; font-weight:600; color:#382a52;
        font-size:1.95rem; margin:28px 0 22px; text-wrap:balance; }
      /* CONTAINER-responsive (not viewport-responsive): columns collapse based on the tile's ACTUAL
         available width, so a narrow content area (e.g. the wizard shown in a half-screen window /
         dashboard) stacks correctly even when window.innerWidth is wide. The min(100%, Npx) floor is
         essential — it lets a single track shrink below Npx instead of overflowing the container. */
      .gmiw-panels{ display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap:22px; align-items:stretch; }
      .gmiw-panels--three{ grid-template-columns:repeat(auto-fit, minmax(min(100%, 240px), 1fr)); }
      .gmiw-panel{ display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:12px;
        box-sizing:border-box; width:100%; min-width:0;   /* fill the track; allow shrink below content min-width (no overflow) */
        min-height:230px; height:auto; padding:32px 24px; cursor:pointer; color:#2c2140; font-family:inherit; border-radius:24px;
        border:2px solid #b98fd6; background:linear-gradient(160deg,#f7f0ff 0%,#fdeef7 100%);
        box-shadow:0 14px 30px -18px rgba(120,60,160,.55); transition:transform .12s ease, box-shadow .12s ease, border-color .12s ease; }
      .gmiw-panel:hover{ transform:translateY(-3px); border-color:#8a4fbf; box-shadow:0 22px 44px -18px rgba(120,60,160,.62); }
      .gmiw-panel:focus-visible{ outline:3px solid #6d74ee; outline-offset:3px; }
      .gmiw-panel:active{ transform:translateY(-1px) scale(.995); box-shadow:0 12px 24px -16px rgba(120,60,160,.6); }
      .gmiw-medallion{ width:78px; height:78px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff;
        background:radial-gradient(circle at 32% 30%,#8a5fd0,#5b3a9e); box-shadow:0 10px 20px -8px rgba(70,30,120,.7); }
      .gmiw-medallion--plum{ background:radial-gradient(circle at 32% 30%,#a552a3,#6d2d6d); }
      .gmiw-medallion--rose{ background:radial-gradient(circle at 32% 30%,#cf6aa2,#8e2f66); }
      /* All tile text: never exceed the tile's inner width, and wrap (incl. long single tokens) so
         nothing runs past the tile border. Copy keeps a readability cap that is never wider than the tile. */
      .gmiw-panel-title{ font-size:1.28rem; font-weight:800; letter-spacing:-.01em; max-width:100%; overflow-wrap:anywhere; }
      .gmiw-panel-copy{ color:#5a5170; font-size:.95rem; max-width:min(30ch, 100%); line-height:1.5; white-space:normal; overflow-wrap:anywhere; }
      .gmiw-cta{ margin-top:4px; font-weight:800; letter-spacing:.09em; font-size:.82rem; color:#6b3fa0; max-width:100%; overflow-wrap:anywhere; }
      .gmiw-footer{ text-align:center; color:#6b6580; font-size:.86rem; margin:22px 0 2px; }
      /* Structured Upload Options — sections ALWAYS stacked vertically (never side by side), each fully
         contained (min-width:0 + border-box + wrap) so nothing overflows a narrow container. */
      .gmiw-upload{ display:grid; gap:16px; margin-top:16px; }
      .gmiw-upsec{ box-sizing:border-box; width:100%; min-width:0; display:grid; gap:10px; border-radius:16px;
        padding:22px 20px; background:rgba(255,255,255,.92); border:1px solid rgba(27,24,48,.1); }
      .gmiw-optlabel{ justify-self:start; font-size:.68rem; font-weight:800; letter-spacing:.18em; color:#8a7fb5; text-transform:uppercase; }
      .gmiw-upsec h3{ margin:0; font-family:Georgia,'Times New Roman',serif; font-weight:600; font-size:1.2rem; color:#332a52; text-wrap:balance; max-width:100%; overflow-wrap:anywhere; }
      .gmiw-upsec p{ margin:0; color:#5a5170; font-size:.9rem; line-height:1.5; max-width:60ch; overflow-wrap:anywhere; }
      .gmiw-choose{ display:inline-flex; align-items:center; justify-content:center; text-align:center; justify-self:center;
        box-sizing:border-box; max-width:100%; cursor:pointer; overflow-wrap:anywhere;
        background:linear-gradient(135deg,#6d74ee,#764ba2); color:#fff; border-radius:12px; padding:13px 20px; font-weight:800; font-size:.95rem; }
      .gmiw-choose:focus-within{ outline:3px solid #6d74ee; outline-offset:3px; }
      .gmiw-or{ display:flex; align-items:center; gap:14px; color:#6b6580; font-weight:800; letter-spacing:.18em; font-size:.78rem; }
      .gmiw-or::before, .gmiw-or::after{ content:""; flex:1 1 0; min-width:0; height:1px; background:rgba(27,24,48,.16); }
      .gmiw-or span{ flex:0 0 auto; }
      .gmiw-practice{ background:linear-gradient(160deg,#f7f0ff 0%,#fdeef7 100%); border-color:#e6d5f2; }
      .gmiw-badge{ justify-self:start; box-sizing:border-box; max-width:100%; overflow-wrap:anywhere;
        background:rgba(214,145,16,.14); color:#8a5410; border:1px solid rgba(214,145,16,.35); border-radius:999px; padding:4px 12px; font-weight:800; font-size:.72rem; letter-spacing:.05em; }
      .gmiw-practice ul{ margin:2px 0 0; padding-left:18px; color:#5a5170; font-size:.86rem; line-height:1.5; display:grid; gap:4px; }
      .gmiw-practice li{ max-width:100%; overflow-wrap:anywhere; }
      .gmiw-practice-cta{ display:flex; gap:10px; flex-wrap:wrap; margin-top:4px; }
      /* Two numbered Test Drive choice tiles inside the practice container (stacked, each self-contained) */
      .gmiw-tdtile{ box-sizing:border-box; width:100%; min-width:0; display:grid; gap:7px; border:1px solid #e3d4f0; border-radius:12px;
        padding:16px 18px; background:rgba(255,255,255,.72); }
      .gmiw-tdtile h4{ margin:0; font-family:Georgia,'Times New Roman',serif; font-weight:600; font-size:1.05rem; color:#332a52; text-wrap:balance; max-width:100%; overflow-wrap:anywhere; }
      .gmiw-tdtile p{ margin:0; color:#5a5170; font-size:.86rem; line-height:1.5; max-width:60ch; overflow-wrap:anywhere; }
      .gmiw-tdtile button{ justify-self:start; max-width:100%; overflow-wrap:anywhere; margin-top:3px; }
      .gmiw-tdtile-cta{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:3px; }
      .gmiw-choose--sm{ margin-top:0; padding:10px 16px; font-size:.85rem; background:linear-gradient(135deg,#6d74ee,#764ba2); }
      .gmiw-or--inner{ margin:2px 0; font-size:.72rem; }
      .gmiw-ws-list{ display:grid; gap:8px; margin-top:4px; }
      .gmiw-ws-option{ display:flex; justify-content:space-between; align-items:center; gap:12px; width:100%; text-align:left; padding:12px 16px; border:1px solid #d7d0ea; border-radius:10px; background:#fbfaff; cursor:pointer; }
      .gmiw-ws-option:hover{ border-color:#764ba2; background:#f3effc; }
      .gmiw-ws-option b{ font-size:.95rem; color:#332a52; overflow-wrap:anywhere; }
      .gmiw-ws-option span{ flex:none; font-size:.8rem; color:#6a5f86; font-variant-numeric:tabular-nums; }
      @media (max-width:640px){ .gmiw-tdtile button{ width:100%; } }
      .gmiw-template{ margin-top:14px; padding-top:14px; border-top:1px dashed rgba(27,24,48,.15); display:grid; gap:8px; min-width:0; }
      .gmiw-template h4{ margin:0; font-family:Georgia,'Times New Roman',serif; font-weight:600; font-size:1rem; color:#332a52; max-width:100%; overflow-wrap:anywhere; }
      .gmiw-template p{ margin:0; }
      .gmiw-tpl-note{ font-size:.78rem; color:#6b6580; }
      .gmiw-template-cta{ display:flex; gap:10px; flex-wrap:wrap; margin-top:2px; }
      /* Recommended safe-defaults notice on the Review screen */
      .gmiw-defaults{ box-sizing:border-box; width:100%; min-width:0; border:1px solid rgba(109,116,238,.35); background:rgba(109,116,238,.07); border-radius:12px; padding:14px 16px; display:grid; gap:6px; }
      .gmiw-defaults b{ font-size:.95rem; color:#3a2f6e; overflow-wrap:anywhere; }
      .gmiw-defaults p{ margin:0; color:#5a5170; font-size:.84rem; line-height:1.5; max-width:70ch; overflow-wrap:anywhere; }
      .gmiw-defaults-cta{ display:flex; gap:10px; flex-wrap:wrap; margin-top:4px; align-items:center; }
      @media (max-width:640px){ .gmiw-template-cta button, .gmiw-defaults-cta button{ width:100%; } }
      @media (max-width:640px){
        .gmiw-underlay{ padding:14px; border-radius:22px; } .gmiw-surface{ padding:16px; }
        .gmiw-banner{ padding:22px 20px; } .gmiw-wand{ display:none; }
        .gmiw-title{ font-size:1.5rem; } .gmiw-heading{ font-size:1.5rem; margin:22px 0 18px; }
        .gmiw-panels, .gmiw-panels--three{ grid-template-columns:1fr; } .gmiw-panel{ min-height:0; padding:26px 20px; }
        .gmiw-choose{ width:100%; } .gmiw-practice-cta{ flex-direction:column; } .gmiw-practice-cta button{ width:100%; }
      }
      /* UX-reference upload layout (visual/layout only — same handlers as before this pass) */
      .gmiw-uxref-grid{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:16px; align-items:stretch; }
      @media (max-width:640px){ .gmiw-uxref-grid{ grid-template-columns:1fr; } }
      .gmiw-testdrive-card{ box-sizing:border-box; width:100%; min-width:0; display:flex; flex-direction:column;
        align-items:center; justify-content:center; text-align:center; gap:8px; cursor:pointer; font-family:inherit;
        border-radius:16px; border:1.5px solid #b98fd6; background:linear-gradient(160deg,#f7f0ff 0%,#fdeef7 100%);
        padding:22px 20px; box-shadow:0 10px 24px -16px rgba(120,60,160,.5); transition:transform .12s ease, box-shadow .12s ease; }
      .gmiw-testdrive-card:hover{ transform:translateY(-2px); box-shadow:0 16px 32px -16px rgba(120,60,160,.6); }
      .gmiw-testdrive-card:focus-visible{ outline:3px solid #6d74ee; outline-offset:3px; }
      .gmiw-testdrive-label{ font-weight:800; letter-spacing:.08em; font-size:.92rem; color:#6b3fa0; }
      .gmiw-testdrive-card p{ margin:0; color:#5a5170; font-size:.86rem; line-height:1.4; max-width:min(26ch, 100%); overflow-wrap:anywhere; white-space:normal; }
      .gmiw-tpl-library-callout{ display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;
        text-decoration:none; color:#332a52; background:rgba(109,116,238,.07); border:1px solid rgba(109,116,238,.3);
        border-radius:14px; padding:12px 16px; font-size:.88rem; }
      .gmiw-tpl-library-callout:hover{ border-color:#6d74ee; background:rgba(109,116,238,.12); }
      .gmiw-tpl-library-callout b{ color:#4a3fb0; }
      .gmiw-tpl-library-callout span:first-child{ min-width:0; overflow-wrap:anywhere; }
      .gmiw-tpl-library-callout span:last-child{ flex-shrink:0; font-weight:800; font-size:.8rem; color:#4a3fb0; }
      /* Upload/Template panels — center all content (heading, copy, controls) within the card. */
      .gmiw-upsec--center{ justify-items:center; text-align:center; }
      .gmiw-tpl-panel{ align-content:center; }
      /* Format toggle — a compact, self-sized pill (never stretches to the row width); both options
         share identical height/width/padding so neither control reads as "more important". */
      .gmiw-fmt-toggle{ display:inline-flex; justify-self:center; width:fit-content; border:1px solid rgba(27,24,48,.15);
        border-radius:999px; padding:2px; margin:4px 0 10px; }
      .gmiw-fmt-toggle button{ border:none; border-radius:999px; padding:6px 14px; min-width:112px; height:36px;
        display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box;
        font-size:.8rem; font-weight:700; cursor:pointer; background:transparent; color:#1b1830; }
      .gmiw-fmt-toggle button.active{ background:linear-gradient(135deg,#6d74ee,#764ba2); color:#fff; }
      @media (max-width:640px){ .gmiw-fmt-toggle button{ min-width:96px; } }
      /* Download CTA — centered, width bounded so it never spans edge-to-edge on a wide card. */
      .gmiw-tpl-dl-wrap{ display:flex; justify-content:center; width:100%; }
      .gmiw-tpl-dl-btn{ width:min(340px, 100%); }
      /* Fine print — the truthful Excel/CSV disclosures, grouped and de-emphasized as one small block
         rather than three separate loud paragraphs (reduces visual noise without removing disclosure). */
      .gmiw-tpl-finePrint{ display:grid; gap:3px; margin-top:2px; }
      .gmiw-tpl-finePrint .gmiw-tpl-note{ font-size:.72rem; color:#8a8698; line-height:1.4; }
      /* Test Drive modal — compact, centered, fits the viewport without internal scrolling at normal
         desktop sizes; the two primary actions sit side by side on desktop, stack on mobile. */
      .gmiw-modal-overlay{ position:fixed; inset:0; background:rgba(30,20,50,.45); display:flex; align-items:center; justify-content:center; padding:16px; z-index:60; }
      .gmiw-modal{ position:relative; background:#fff; border-radius:20px; max-width:420px; width:100%; padding:22px 22px 18px;
        box-shadow:0 30px 70px -30px rgba(50,20,90,.55); max-height:calc(100vh - 32px); overflow-y:auto; text-align:center; }
      .gmiw-modal-close{ position:absolute; top:12px; right:12px; border:none; background:transparent; font-size:1.3rem; line-height:1; cursor:pointer; color:#6b6580; padding:4px; }
      .gmiw-modal-title{ display:flex; align-items:center; justify-content:center; gap:7px; margin:4px 0 8px; font-family:Georgia,serif; font-size:1.18rem; color:#2c2140; }
      .gmiw-modal-badge{ display:inline-flex; align-items:center; gap:5px; background:rgba(214,145,16,.14); color:#8a5410;
        border:1px solid rgba(214,145,16,.35); border-radius:999px; padding:3px 10px; font-weight:800; font-size:.7rem; margin-bottom:14px; }
      .gmiw-modal-steps{ margin:0 0 16px; padding:0; list-style:none; display:grid; gap:6px; color:#4a4663; font-size:.83rem; line-height:1.4; text-align:left; }
      .gmiw-modal-steps li{ display:flex; gap:6px; }
      .gmiw-modal-steps b{ color:#2c2140; flex-shrink:0; }
      .gmiw-modal-cta{ display:flex; flex-direction:column; gap:10px; align-items:stretch; }
      .gmiw-modal-primary-row{ display:flex; gap:8px; }
      .gmiw-modal-primary-row button, .gmiw-modal-primary-row label{ flex:1 1 0; min-width:0; white-space:normal; }
      .gmiw-modal-secondary-row{ display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap; }
      .gmiw-modal-link{ font-size:.78rem; font-weight:700; color:#4a3fb0; background:none; border:none; cursor:pointer; text-decoration:underline; padding:2px; white-space:normal; }
      .gmiw-modal-sep{ color:#c4bdd6; font-size:.78rem; }
      @media (max-width:640px){ .gmiw-modal-primary-row{ flex-direction:column; } .gmiw-modal-cta button, .gmiw-modal-cta label{ width:100%; box-sizing:border-box; }
        .gmiw-modal-secondary-row{ flex-direction:column; gap:6px; } .gmiw-modal-sep{ display:none; } }
      /* ---- Review screen — centered white card, summary counts, clean contact table ---- */
      .gmiw-review-shell{ display:flex; justify-content:center; }
      .gmiw-review-card{ box-sizing:border-box; width:100%; max-width:760px; background:#fff; border-radius:20px;
        border:1px solid rgba(27,24,48,.08); box-shadow:0 20px 50px -30px rgba(50,20,90,.35); padding:26px 26px 22px;
        display:grid; gap:16px; }
      .gmiw-review-heading{ margin:0; text-align:center; font-family:Georgia,serif; font-size:1.4rem; color:#2c2140; }
      .gmiw-review-subtitle{ margin:0; text-align:center; color:#605c78; font-size:.88rem; line-height:1.5; }
      .gmiw-review-summary{ display:flex; justify-content:center; gap:10px; flex-wrap:wrap; }
      .gmiw-review-stat{ box-sizing:border-box; min-width:96px; text-align:center; border-radius:12px; padding:10px 16px;
        background:rgba(109,116,238,.07); border:1px solid rgba(109,116,238,.18); }
      .gmiw-review-stat b{ display:block; font-size:1.2rem; color:#2c2140; }
      .gmiw-review-stat span{ font-size:.72rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#6b6580; }
      .gmiw-review-stat--ready{ background:rgba(31,157,107,.09); border-color:rgba(31,157,107,.25); }
      .gmiw-review-stat--ready b{ color:#1f7a57; }
      .gmiw-review-stat--needsinfo{ background:rgba(214,69,69,.08); border-color:rgba(214,69,69,.25); }
      .gmiw-review-stat--needsinfo b{ color:#a3241a; }
      .gmiw-review-note{ text-align:center; font-size:.8rem; color:#605c78; }
      .gmiw-review-partial{ box-sizing:border-box; border-radius:12px; padding:14px 16px; text-align:center;
        border:1px solid rgba(31,157,107,.45); background:rgba(31,157,107,.06); color:#1f7a57; }
      .gmiw-review-partial b{ font-size:.95rem; }
      .gmiw-review-table-block{ display:grid; gap:8px; }
      .gmiw-review-table-head{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
      .gmiw-review-table-head b{ font-size:.9rem; color:#2c2140; }
      .gmiw-review-table-wrap{ overflow-x:auto; border:1px solid #eee; border-radius:12px; }
      .gmiw-review-table{ width:100%; border-collapse:collapse; font-size:.82rem; }
      .gmiw-review-table th{ text-align:left; font-size:.68rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase;
        color:#8a7fb5; padding:10px 12px; background:#faf9fd; border-bottom:1px solid #eee; white-space:nowrap; }
      .gmiw-review-table td{ padding:9px 12px; border-bottom:1px solid #f4f4f7; color:#332a52; vertical-align:middle; }
      .gmiw-review-table tr:last-child td{ border-bottom:none; }
      .gmiw-review-td-name{ font-weight:700; }
      .gmiw-review-row--ok{ background:rgba(31,157,107,.04); }
      .gmiw-review-row--needsinfo{ background:rgba(214,69,69,.06); }
      .gmiw-review-pill{ display:inline-block; border-radius:999px; padding:3px 10px; font-size:.72rem; font-weight:800; white-space:nowrap; }
      .gmiw-review-edit-link{ background:none; border:none; cursor:pointer; color:#4a3fb0; font-weight:700; font-size:.78rem; text-decoration:underline; padding:2px; white-space:nowrap; }
      .gmiw-review-edit-dash{ color:#c4bdd6; }
      .gmiw-review-warning{ box-sizing:border-box; border-radius:14px; padding:16px; border:1px solid rgba(214,145,16,.45); background:rgba(214,145,16,.06); }
      .gmiw-review-warning > b{ font-size:.95rem; color:#7a5410; }
      .gmiw-review-practice{ box-sizing:border-box; border-radius:14px; padding:16px; display:grid; gap:8px;
        border:1px solid rgba(214,145,16,.4); background:rgba(214,145,16,.06); }
      .gmiw-review-actions{ display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; padding-top:4px; border-top:1px solid #f0eef7; }
      .gmiw-review-actions-primary{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; justify-content:flex-end; }
      @media (max-width:640px){
        .gmiw-review-card{ padding:20px 16px 18px; border-radius:16px; }
        /* Mailing Address + Type hide first on narrow screens — Name/Email/Status/Edit stay visible without horizontal scroll */
        .gmiw-review-table th:nth-child(3), .gmiw-review-table td:nth-child(3),
        .gmiw-review-table th:nth-child(4), .gmiw-review-table td:nth-child(4){ display:none; }
        .gmiw-review-table{ font-size:.76rem; }
        .gmiw-review-table th, .gmiw-review-table td{ padding:8px 6px; }
        .gmiw-review-td-name{ max-width:84px; overflow-wrap:anywhere; }
        .gmiw-review-table td:nth-child(2){ max-width:108px; overflow-wrap:anywhere; }
        .gmiw-review-pill{ padding:2px 7px; font-size:.64rem; white-space:normal; }
        .gmiw-review-edit-link{ font-size:.7rem; }
        .gmiw-review-actions{ flex-direction:column; align-items:stretch; }
        .gmiw-review-actions-primary{ justify-content:flex-start; }
      }
    `}</style>
  );
}
function WandSparkles({ size = 34, stroke = "#f2dca6" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="wand and sparkles">
      <path d="M4 20l9.5-9.5" />
      <path d="M13 6.5l4.5 4.5" />
      <path d="M17 3l.9 2.1L20 6l-2.1.9L17 9l-.9-2.1L14 6l2.1-.9z" fill={stroke} stroke="none" />
      <path d="M7 4l.5 1.3L8.8 5.8 7.5 6.3 7 7.6 6.5 6.3 5.2 5.8 6.5 5.3z" fill="#fff" stroke="none" opacity=".9" />
      <path d="M20 15l.4 1.1 1.1.4-1.1.4-.4 1.1-.4-1.1-1.1-.4 1.1-.4z" fill="#fff" stroke="none" opacity=".9" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="#fff" role="img" aria-hidden="true">
      <path d="M12 21s-7.5-4.9-10-9.2C.4 8.7 1.9 5 5.3 5c2 0 3.4 1.2 4.2 2.4C10.3 6.2 11.7 5 13.7 5c3.4 0 4.9 3.7 3.3 6.8C19.5 16.1 12 21 12 21z" />
    </svg>
  );
}
function BriefcaseIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" role="img" aria-hidden="true">
      <rect x="3" y="7.5" width="18" height="12" rx="2.2" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" role="img" aria-hidden="true">
      <path d="M3 11l9-7 9 7" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" />
    </svg>
  );
}
// Business medallion icons: Employees = people/team, Clients = handshake/relationship, Vendors = package.
function PeopleIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-hidden="true">
      <circle cx="9" cy="8" r="3" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M17.5 14.3A6.5 6.5 0 0 1 21.5 20" />
    </svg>
  );
}
function HandshakeIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" role="img" aria-hidden="true">
      <path d="M11 6.5 8.5 9a2 2 0 0 0 0 2.8l.2.2a2 2 0 0 0 2.8 0L13 10.5" />
      <path d="m13 10.5 2.5 2.5a2 2 0 0 1 0 2.8l-.2.2a2 2 0 0 1-2.8 0l-2-2" />
      <path d="M3 8.5 6.5 5H10l3 3" /><path d="M21 8.5 17.5 5H14" /><path d="M3 8.5v6M21 8.5v6" />
    </svg>
  );
}
function PackageIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-hidden="true">
      <path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v8" /><path d="M7.5 5.5 16.5 10.5" />
    </svg>
  );
}
// Screen 2 — Personal categories. `value` is UI context only (never a persisted relationship or a
// recipientType). `uploadHeading` tailors the upload screen; nothing here invents data.
const PERSONAL_GROUPS = [
  { value: "family", title: "Family", copy: "Parents, children, siblings, and extended family.", cta: "CHOOSE FAMILY →", medallion: "", Icon: HomeIcon, uploadHeading: "Import Family Contacts" },
  { value: "friend", title: "Friends", copy: "Best friends, neighbors, teammates, and classmates.", cta: "CHOOSE FRIENDS →", medallion: "gmiw-medallion--rose", Icon: HeartIcon, uploadHeading: "Import Friend Contacts" },
  { value: "professional", title: "Professional", copy: "Colleagues, mentors, and work connections important to you.", cta: "CHOOSE PROFESSIONAL →", medallion: "gmiw-medallion--plum", Icon: BriefcaseIcon, uploadHeading: "Import Professional Contacts" },
];
// Screen 2 — Business categories. `value` is the canonical recipientType (employee/client/vendor),
// auto-applied to that path's records. The mixed/combined-list capability stays in the pure model
// (recipientTypeModel), NOT on this three-choice entry surface.
const BUSINESS_GROUPS = [
  { value: "employee", title: "Employees", copy: "Employees, personnel, departments, and workplace contacts.", cta: "CHOOSE EMPLOYEES →", medallion: "", Icon: PeopleIcon, uploadHeading: "Import Employee Contacts" },
  { value: "client", title: "Clients", copy: "Clients, customers, companies, and important customer contacts.", cta: "CHOOSE CLIENTS →", medallion: "gmiw-medallion--rose", Icon: HandshakeIcon, uploadHeading: "Import Client Contacts" },
  { value: "vendor", title: "Vendors", copy: "Vendors, suppliers, service providers, and business partners.", cta: "CHOOSE VENDORS →", medallion: "gmiw-medallion--plum", Icon: PackageIcon, uploadHeading: "Import Vendor Contacts" },
];
// Category-specific template-panel copy (display copy only — keyed by templateKind, which already
// derives from personalGroup/recipientKind, so both update automatically when the category changes).
const TEMPLATE_HEADING = {
  family: "Need a Family Import Template?",
  friend: "Need a Friend Import Template?",
  professional: "Need a Professional Import Template?",
  employee: "Need an Employee Import Template?",
  client: "Need a Client Import Template?",
  vendor: "Need a Vendor Import Template?",
};
function Empty({ title, body }) {
  return <div style={{ ...card, textAlign: "center" }}><h3 style={{ margin: "0 0 6px", fontFamily: "Georgia,serif" }}>{title}</h3><p style={muted}>{body}</p></div>;
}
function CarIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" role="img" aria-hidden="true">
      <path d="M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11" />
      <rect x="3" y="11" width="18" height="6" rx="2" />
      <circle cx="7.5" cy="17.5" r="1.6" /><circle cx="16.5" cy="17.5" r="1.6" />
    </svg>
  );
}
// Test Drive modal — presentation shell only. Every action calls the SAME handlers the inline Test
// Drive section used before this UX pass (downloadPracticeXlsx / downloadSampleCsv / onUploadPracticeCsv
// / trySample, passed down as props); no parsing, validation, or commit logic lives here.
function TestDriveModal({ open, onClose, kindLabel, onDownloadSample, onDownloadSampleCsv, onUploadSample, onStartInstant }) {
  if (!open) return null;
  return (
    <div className="gmiw-modal-overlay" role="presentation" onClick={onClose}>
      <div className="gmiw-modal" role="dialog" aria-modal="true" aria-label="Test Drive Wizard" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="gmiw-modal-close" aria-label="Close" data-testid="td-modal-close" onClick={onClose}>×</button>
        <h3 className="gmiw-modal-title">
          <span aria-hidden="true" className="gmiw-modal-wand"><WandSparkles size={20} stroke="#6d74ee" /></span> Test Drive Wizard
        </h3>
        <span className="gmiw-modal-badge">🛡 Safe practice mode</span>
        <ol className="gmiw-modal-steps">
          <li><b>1.</b> Download the sample {kindLabel} list (Excel).</li>
          <li><b>2.</b> Upload it here to preview the mapping.</li>
          <li><b>3.</b> Review how it gets applied — nothing is saved or sent.</li>
        </ol>
        <div className="gmiw-modal-cta">
          <div className="gmiw-modal-primary-row">
            <button type="button" data-testid="td-modal-download" style={btn(PURPLE)} onClick={onDownloadSample}>⬇ Download sample list</button>
            <label style={{ ...btn("transparent", "#4a3fb0"), border: "1.5px solid #4a3fb0", textAlign: "center", cursor: "pointer" }} data-testid="td-modal-upload">
              ⬆ Upload sample to preview
              <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onUploadSample(e.target.files[0])} />
            </label>
          </div>
          <div className="gmiw-modal-secondary-row">
            <button type="button" data-testid="td-modal-csv" className="gmiw-modal-link" onClick={onDownloadSampleCsv}>
              Download sample as CSV
            </button>
            <span className="gmiw-modal-sep" aria-hidden="true">·</span>
            <button type="button" data-testid="td-modal-instant" className="gmiw-modal-link" onClick={onStartInstant}>Load sample instantly</button>
          </div>
        </div>
      </div>
    </div>
  );
}
// ============================================================================
// ReviewScreen — CONFIRMATION-FIRST. A clean file shows "Your contacts are ready" + one primary
// "Add X contacts". Genuine blockers (missing name/email, under-13, unknown Universal audience) get a
// plain-language "quick fix" list; a blocked row never stops the valid ones. Relationship details are
// OPTIONAL and opened only on request. No mandatory walkthrough, no overlapping queues, no taxonomy in
// the normal path. Ready previews are bounded/paginated (audit F5).
// ============================================================================
const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" };
const inp = { ...selStyle, width: "100%" };
const linkBtn = { ...btn("transparent", "#4a3fb0"), padding: "4px 10px", fontSize: ".76rem" };
const PREVIEW_N = 6;          // small confirmation preview
const DETAILS_BATCH = 25;     // optional-relationship editor page size

export function ReviewScreen({ rows, state, setState, business, kindLabel, demo, busy, partial, sampleActions, defaultsPath, onCommit, onStartOver, onViewPractice }) {
  const review = buildReview(rows, state);
  const { buckets, counts, importCount, importEnabled } = review;
  const [view, setView] = useState("confirm");   // "confirm" | "details"
  const [seeAll, setSeeAll] = useState(false);
  const [confPage, setConfPage] = useState(0);
  const [detPage, setDetPage] = useState(0);
  // Opt-in recommended (safe) defaults — never applied without an explicit click; Undo restores exactly.
  const [dfltUndo, setDfltUndo] = useState(null);
  const [dfltApplied, setDfltApplied] = useState(0);
  const [dfltDismissed, setDfltDismissed] = useState(false);
  const isSample = !!demo;
  const isIndividualSample = !!sampleActions;      // personal practice → terminal action bar, no commit CTA
  const dflt = recommendedDefaults(rows, state, defaultsPath);
  const applyDefaults = () => { const res = applyRecommendedDefaults(state, dflt.indices, dflt.def); setState(res.state); setDfltUndo(res.undo); setDfltApplied(res.appliedCount); };
  const undoDefaults = () => { const u = dfltUndo; setDfltUndo(null); setDfltApplied(0); if (u) setState((s) => undoRecommendedDefaults(s, u)); };

  const bind = (fn) => (i, v) => setState((s) => fn(s, i, v));
  const on = {
    name: bind(setName), email: bind(setEmail), birthday: bind(setBirthday),
    group: bind(setGroup), relation: bind(setRelation), closeness: bind(setCloseness),
    audience: bind(chooseAudience), skip: (i) => setState((s) => skipContact(s, i)),
    leaveBlank: (i) => setState((s) => leaveRelationshipBlank(s, i)),
  };
  const openDetails = () => setView("details");

  if (view === "details") {
    return <DetailsView editable={buckets.ready} page={detPage} setPage={setDetPage} on={on}
      onDone={() => { setView("confirm"); setDetPage(0); }} onStartOver={onStartOver} />;
  }

  const blockers = [...buckets.needsFix, ...buckets.invalidExcluded];
  // Every non-blocker contact appears once, as a recipient-style card, with its state.
  const shown = [...buckets.ready, ...buckets.added, ...buckets.alreadyInList, ...buckets.willSkip];
  // The table shows every contact — blockers first, so they're visible before "See all" is toggled.
  const allRows = [...blockers, ...shown];
  const heading = isSample ? "Preview your practice contacts" : "Review your contacts";
  const supporting = isSample
    ? "This is how these contacts would appear in your recipient list. Nothing has been saved or sent."
    : "We matched your file's columns automatically — review and confirm below.";
  const preview = seeAll
    ? paginate(allRows, confPage, DETAILS_BATCH)
    : { slice: allRows.slice(0, PREVIEW_N), pages: 1, page: 0, total: allRows.length };
  const contactByIndex = new Map(rows.map((r) => [r.index, r.contact]));

  return (
    <div data-testid="confirm-screen" className="gmiw-review-shell">
      <div className="gmiw-review-card">
        <h2 className="gmiw-review-heading">{heading}</h2>
        <p className="gmiw-review-subtitle">{supporting}</p>

        {/* Summary counts — total / ready / needs info */}
        <div className="gmiw-review-summary" data-testid="review-summary">
          <div className="gmiw-review-stat"><b>{counts.total}</b><span>Total</span></div>
          <div className="gmiw-review-stat gmiw-review-stat--ready"><b>{importCount}</b><span>Ready</span></div>
          <div className="gmiw-review-stat gmiw-review-stat--needsinfo"><b>{blockers.length}</b><span>Needs Info</span></div>
        </div>
        {counts.alreadyInList > 0 && <div className="gmiw-review-note">{counts.alreadyInList} already in your recipient list—we'll skip {counts.alreadyInList === 1 ? "this contact" : "them"}.</div>}
        {counts.willSkip > 0 && <div className="gmiw-review-note">{counts.willSkip} won't be added.</div>}

        {/* Opt-in recommended safe defaults — compact notice; never applied silently. */}
        {dfltApplied > 0 ? (
          <div className="gmiw-defaults" data-testid="defaults-applied">
            <b>Recommended settings applied to {dfltApplied} contact{dfltApplied === 1 ? "" : "s"}.</b>
            <div className="gmiw-defaults-cta">
              <button data-testid="undo-defaults" style={btn("transparent", "#8a1f1f")} onClick={undoDefaults}>Undo</button>
            </div>
          </div>
        ) : (dflt.available && !dfltDismissed) ? (
          <div className="gmiw-defaults" data-testid="defaults-notice">
            <b>Recommended settings are available</b>
            <p>We can apply conservative relationship settings to contacts with missing details. Existing CSV values and any changes you make will always take priority.</p>
            <p style={{ fontWeight: 700, color: "#3a2f6e" }}>Apply recommended settings to {dflt.count} contact{dflt.count === 1 ? "" : "s"}</p>
            <div className="gmiw-defaults-cta">
              <button data-testid="apply-defaults" style={btn(PURPLE)} onClick={applyDefaults}>Apply recommended settings</button>
              <button data-testid="review-individually" style={btn("transparent", "#4a3fb0")} onClick={() => setDfltDismissed(true)}>Review individually</button>
            </div>
          </div>
        ) : null}

        {/* Partial real import — truthful, never a false 'complete success' */}
        {partial && (
          <div data-testid="partial" className="gmiw-review-partial">
            <b>{partial.added} contact{partial.added === 1 ? " was" : "s were"} added. {partial.failed} could not be added.</b>
            <div className="gmiw-review-note">Added contacts won't be submitted again. Fix the ones below and add them when you're ready.</div>
          </div>
        )}

        {/* Clean table — every contact, one row each: Name / Email / Type / Mailing Address / Status / Edit */}
        {allRows.length > 0 && (
          <div className="gmiw-review-table-block">
            <div className="gmiw-review-table-head">
              <b>Your contacts</b>
              {allRows.length > PREVIEW_N && <button style={linkBtn} onClick={() => { setSeeAll((v) => !v); setConfPage(0); }}>{seeAll ? "Show less" : `See all ${allRows.length}`}</button>}
            </div>
            <div className="gmiw-review-table-wrap">
              <table className="gmiw-review-table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Type</th><th>Mailing Address</th><th>Status</th><th>Edit</th></tr>
                </thead>
                <tbody>
                  {preview.slice.map((it) => (
                    <ReviewTableRow key={it.index} it={it} business={business}
                      contact={contactByIndex.get(it.index)} onAddRelationship={openDetails} />
                  ))}
                </tbody>
              </table>
            </div>
            {seeAll && preview.pages > 1 && <Pager page={preview.page} pages={preview.pages} onPage={setConfPage} />}
          </div>
        )}

        {/* Warning panel — genuine blockers only, with the actual fix controls */}
        {blockers.length > 0 && (
          <div data-testid="quickfix" className="gmiw-review-warning">
            <b>{blockers.length} contact{blockers.length === 1 ? "" : "s"} need a quick fix before they can be added.</b>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {blockers.map((it) => <QuickFixRow key={it.index} it={it} on={on} />)}
            </div>
          </div>
        )}

        {/* Read-only Test Drive notice + primary CTA — view the fictional contacts in Recipients (Practice View) */}
        {isSample && (
          <div data-testid="practice-cta-block" className="gmiw-review-practice">
            <button data-testid="view-practice-recipients" style={btn(PURPLE)} onClick={onViewPractice}>View Practice Contacts in Recipients</button>
            <p data-testid="practice-cta-note" className="gmiw-review-note">See how the fictional contacts will look in your Recipients page. They exist only during this Test Drive and will be automatically removed when you exit Test Drive or log out.</p>
          </div>
        )}

        {/* Actions — clean, aligned: secondary on the left, primary group on the right */}
        <div className="gmiw-review-actions">
          <button data-testid="startover" style={btn("transparent", "#1b1830")} onClick={onStartOver}>Start over</button>
          <div className="gmiw-review-actions-primary">
            {counts.ready > 0 && <button data-testid="details-cta" style={btn("transparent", "#4a3fb0")} onClick={openDetails}>Add relationship details first</button>}
            {isIndividualSample ? (
              <>
                <button data-testid="sample-upload-own" style={btn("transparent", "#1b1830")} onClick={sampleActions.onUploadOwn}>Upload my own CSV</button>
                <button data-testid="sample-download" style={btn("transparent", "#1b1830")} onClick={sampleActions.onDownloadCsv}>Download Practice CSV</button>
                <button data-testid="sample-delete" style={btn("transparent", "#8a1f1f")} onClick={sampleActions.onDelete}>Delete practice contacts</button>
                <button data-testid="sample-exit" style={btn("transparent", "#1b1830")} onClick={sampleActions.onExit}>Exit Test Drive</button>
              </>
            ) : isSample ? (
              <button data-testid="sample-exit" style={btn("transparent", "#1b1830")} onClick={onStartOver}>Exit Test Drive</button>
            ) : (
              <button data-testid="add-cta" style={btn(PURPLE)} disabled={busy || !importEnabled} onClick={onCommit}>{busy ? "Adding…" : `Add ${importCount} contact${importCount === 1 ? "" : "s"}`}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// A single blocked contact with a plain-language reason and the one control that unblocks it. The
// component switches on `fixField` (a field name), never on an internal validation code.
// Status-icon + missing-field badge colors (visual language only — matches the founder's UX
// reference: amber warning triangle for a row needing a fix, a red pill naming the missing field).
// FIXABLE fields already come from importCore's real error codes (see FIXABLE above); no new
// validation is introduced here, only how an existing blocker is displayed.
const FIX_FIELD_BADGE = { email: "EMAIL", name: "NAME", birthday: "BIRTHDAY", audience: "TYPE" };
function QuickFixRow({ it, on }) {
  return (
    <div id={`gmiw-qf-${it.index}`} style={{ border: "1px solid #f0e6cf", borderRadius: 10, padding: 10, display: "grid", gap: 6 }}>
      <div style={{ ...rowStyle }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span aria-hidden="true" style={{ color: "#b8791b", fontSize: "1rem", lineHeight: 1, flexShrink: 0 }}>⚠</span>
          <b style={{ fontSize: ".88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name || "This contact"}</b>
          {it.fixField && FIX_FIELD_BADGE[it.fixField] && (
            <span style={{ fontSize: ".64rem", fontWeight: 800, letterSpacing: ".03em", color: "#fff", background: "#c0392b", borderRadius: 5, padding: "1px 6px", flexShrink: 0 }}>
              {FIX_FIELD_BADGE[it.fixField]}
            </span>
          )}
        </span>
        <button data-testid="dont-add" style={{ ...linkBtn, color: "#8a1f1f" }} onClick={() => on.skip(it.index)}>Don't add this contact</button>
      </div>
      <div style={{ fontSize: ".78rem", color: "#b8791b" }}>{it.blockerMessage}</div>
      {it.fixField === "name" && <input data-testid="fix-name-input" value={it.name} placeholder="Full name" onChange={(e) => on.name(it.index, e.target.value)} style={inp} />}
      {it.fixField === "email" && <input data-testid="fix-email-input" value={it.email} placeholder="name@example.com" onChange={(e) => on.email(it.index, e.target.value)} style={inp} />}
      {it.fixField === "birthday" && (
        <label style={{ display: "grid", gap: 3 }}>
          <span style={{ fontSize: ".72rem", color: "#4a4663" }}>Correct the birthday if it was a typo</span>
          <input data-testid="fix-birthday-input" value={it.birthday} placeholder="YYYY-MM-DD" onChange={(e) => on.birthday(it.index, e.target.value)} style={inp} />
        </label>
      )}
      {it.fixField === "audience" && (
        <select data-testid="fix-audience-select" value="" onChange={(e) => on.audience(it.index, e.target.value)} style={inp}>
          <option value="">Choose…</option>
          {AUDIENCE_CHOICES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      )}
    </div>
  );
}

// Per-row status pill — green Ready/Added, soft-red Needs Info, neutral for already-in-list/skip.
const STATUS_META = {
  needs_fix: { t: "Needs Info", fg: "#a3241a", bg: "rgba(214,69,69,.12)" },
  invalid_excluded: { t: "Needs Info", fg: "#a3241a", bg: "rgba(214,69,69,.12)" },
  ready: { t: "Ready", fg: "#1f7a57", bg: "rgba(31,157,107,.12)" },
  added: { t: "Added ✓", fg: "#1f7a57", bg: "rgba(31,157,107,.12)" },
  already_in_list: { t: "Already in your list", fg: "#605c78", bg: "rgba(96,92,120,.08)" },
  will_skip: { t: "Won't be added", fg: "#605c78", bg: "rgba(96,92,120,.08)" },
};
// One-line mailing-address summary for the review table. Address is always optional — never blocks.
function mailingAddressLabel(contact) {
  const a = contact && contact.shippingAddress;
  if (!a) return "—";
  const cityState = [a.city, a.state].filter(Boolean).join(", ");
  return cityState || a.line1 || a.country || "—";
}
// Truthful about a missing relationship (Morgan Doe rule) and its state. Green/Ready or Added rows
// read clean; a Needs Info row is soft-red and its Edit control scrolls to the SAME QuickFixRow fix
// control the warning panel already renders below (no new edit path — this only reveals it faster).
function ReviewTableRow({ it, business, contact, onAddRelationship }) {
  const typeLabel = business
    ? (it.audience ? (RECIPIENT_TYPE_OPTIONS.find((o) => o.value === it.audience) || {}).label || "—" : "—")
    : (it.relationProvided ? it.groupLabel : "—");
  const status = STATUS_META[it.bucket] || STATUS_META.will_skip;
  const needsInfo = it.bucket === "needs_fix" || it.bucket === "invalid_excluded";
  const canAddRelationship = it.bucket === "ready" && !business && !it.relationProvided;
  const scrollToFix = () => {
    const el = document.getElementById(`gmiw-qf-${it.index}`);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return (
    <tr className={needsInfo ? "gmiw-review-row--needsinfo" : "gmiw-review-row--ok"}>
      <td className="gmiw-review-td-name">{it.name || "This contact"}</td>
      <td>{it.email || "—"}</td>
      <td>{typeLabel}</td>
      <td>{mailingAddressLabel(contact)}</td>
      <td><span className="gmiw-review-pill" style={{ color: status.fg, background: status.bg }}>{status.t}</span></td>
      <td>
        {needsInfo ? (
          <button className="gmiw-review-edit-link" onClick={scrollToFix}>Fix ↓</button>
        ) : canAddRelationship ? (
          <button className="gmiw-review-edit-link" onClick={onAddRelationship}>Add relationship</button>
        ) : (
          <span className="gmiw-review-edit-dash" aria-hidden="true">—</span>
        )}
      </td>
    </tr>
  );
}

// Optional relationship editor — opened only from "Add relationship details first". Paginated (F5),
// edits preserved across pages (they live in review state, not this view).
function DetailsView({ editable, page, setPage, on, onDone, onStartOver }) {
  const pg = paginate(editable, page, DETAILS_BATCH);
  return (
    <div data-testid="details-screen" style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <h2 style={{ margin: 0, fontFamily: "Georgia,serif", fontSize: "1.2rem" }}>Add relationship details</h2>
        <p style={{ ...sub, marginTop: 4 }}>Optional — this helps Greet-Me personalize each greeting. You can leave any of them blank.</p>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {pg.slice.map((it) => <DetailRow key={it.index} it={it} on={on} />)}
      </div>
      {pg.pages > 1 && <Pager page={pg.page} pages={pg.pages} onPage={setPage} />}
      <div style={{ ...rowStyle }}>
        <button style={btn("transparent", "#1b1830")} onClick={onStartOver}>Start over</button>
        <button data-testid="details-done" style={btn(PURPLE)} onClick={onDone}>Done</button>
      </div>
    </div>
  );
}

function DetailRow({ it, on }) {
  return (
    <div style={{ ...card, padding: 14, display: "grid", gap: 8 }}>
      <div><b style={{ fontSize: ".9rem" }}>{it.name}</b> <span style={sub}>· {it.email}</span></div>
      {!it.relationProvided && !it.relationUnrecognizedRaw && <div style={{ fontSize: ".78rem", color: "#a08a5a" }}>Relationship not provided (optional).</div>}
      {it.relationUnrecognizedRaw && <div style={{ fontSize: ".78rem", color: "#7a5410" }}>We didn't recognize “{it.rawRel}.” You can add the relationship now or leave it blank.</div>}
      <RelationshipControls it={it} on={on} />
    </div>
  );
}

// The three canonical ContactForm controls with first-time-user helper text (exact labels).
function RelationshipControls({ it, on }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <Field label="Relationship group" help="Is this person family, a friend, or a professional contact?">
        <select data-testid="group-select" value={it.group} onChange={(e) => on.group(it.index, e.target.value)} style={inp}>
          <option value="">Select a group</option>
          {RELATIONSHIP_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Field>
      <Field label="Relationship" help="Choose the specific relationship.">
        <select data-testid="relation-select" value={it.relation} disabled={!it.group} onChange={(e) => on.relation(it.index, e.target.value)} style={inp}>
          <option value="">Select relationship</option>
          {relationsForGroup(it.group).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </Field>
      <Field label="How close are you?" help="This helps Greet-Me personalize the greeting.">
        <select data-testid="closeness-select" value={it.closeness} onChange={(e) => on.closeness(it.index, e.target.value)} style={inp}>
          {CLOSENESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <div style={{ fontSize: ".72rem", color: "#8a8698" }}>Greet-Me Worthy — A thoughtful standard greeting suitable for most relationships.</div>
    </div>
  );
}

function Field({ label, help, children }) {
  return (
    <label style={{ display: "grid", gap: 3 }}>
      <span style={{ fontSize: ".76rem", color: "#4a4663", fontWeight: 600 }}>{label}</span>
      {children}
      {help && <span style={{ fontSize: ".72rem", color: "#8a8698" }}>{help}</span>}
    </label>
  );
}

function Pager({ page, pages, onPage }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center" }}>
      <button style={btn("transparent", "#1b1830")} disabled={page <= 0} onClick={() => onPage(page - 1)}>← Prev</button>
      <span style={sub}>Page {page + 1} of {pages}</span>
      <button style={btn("transparent", "#1b1830")} disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next →</button>
    </div>
  );
}

function SampleBanner() {
  return (
    <div style={{ ...card, marginBottom: 12, borderColor: "rgba(214,145,16,.4)", background: "rgba(214,145,16,.08)" }}>
      <b>Safe practice mode — Nothing will be saved or sent</b>
      <div style={{ fontSize: ".82rem", color: "#7a5410", marginTop: 2 }}>Fictional data on reserved <code>example.com</code> domains. No import, schedule, worker, gift, payment, email, voice, or animation call is ever made.</div>
    </div>
  );
}

// Read-only Practice Recipients presentation — session-scoped data only; edits/deletes never touch prod.
function SampleRecipientsView({ contacts, onDeleteAll, onExit, onReturn }) {
  const typeLabel = (v) => (RECIPIENT_TYPE_OPTIONS.find((o) => o.value === v) || {}).label || "";
  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div style={{ ...card, marginBottom: 12, borderColor: "rgba(214,145,16,.4)", background: "rgba(214,145,16,.08)" }}>
        <b>Safe practice mode — nothing has been saved or sent</b>
        <div style={{ fontSize: ".82rem", color: "#7a5410", marginTop: 2 }}>These practice recipients live only in this browser session — never saved to your account, never sent anything.</div>
      </div>
      <div style={card}>
        <b style={{ fontSize: ".95rem", fontFamily: "Georgia,serif" }}>Practice Recipients · {contacts.length}</b>
        <div style={{ maxHeight: 340, overflow: "auto", border: "1px solid #eee", borderRadius: 10, marginTop: 8 }}>
          {contacts.map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 12px", borderTop: i ? "1px solid #f4f4f7" : "none", fontSize: ".82rem" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || "—"} · <span style={{ color: "#605c78" }}>{c.email || "—"}</span></span>
              <span style={{ color: "#605c78", flexShrink: 0 }}>{c.recipientType ? typeLabel(c.recipientType) : (relationLabelFor(c.relationship) || "—")}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button style={btn("transparent", "#8a1f1f")} onClick={onDeleteAll}>Delete practice contacts</button>
          <button style={btn("transparent", "#1b1830")} onClick={onExit}>Exit Test Drive</button>
          <button style={btn(PURPLE)} onClick={onReturn}>Return to Recipients</button>
        </div>
      </div>
    </div>
  );
}
