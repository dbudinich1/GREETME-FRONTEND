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
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import api from "../../api/api";
import {
  checkFileLimits, checkRowCount, autoMapHeaders, processRow, detectDuplicates,
  buildPlan, looksLikeZip,
} from "../../import/importCore.js";
import { assertNoRealMix } from "../../import/demoData.js";
import { MODES, existingEmailsFromResponse, classifyCommitOutcome } from "./wizardModel.js";
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
import { templateXlsx, XLSX_MIME } from "../../import/xlsxTemplate.js";
import { recommendedDefaults, applyRecommendedDefaults, undoRecommendedDefaults } from "../../import/safeDefaults.js";
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
  const returnToRecipients = useCallback(() => navigate("/dashboard/contacts"), [navigate]);
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
  // A marked Practice CSV chosen through the NORMAL uploader → a gate before Test Drive (no production path).
  const [practiceDetected, setPracticeDetected] = useState(null);   // { fields, rows } | null
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

  // Validate + parse a CSV to { fields, rows } (never trusts the extension: rejects a spoofed XLSX/ZIP).
  // Resolves null (and sets a user error) on any rejection — never throws.
  const parseCsvFile = (file) => new Promise((resolve) => {
    setError(null);
    const lim = checkFileLimits(file);
    if (!lim.ok) { setError(`File rejected: ${lim.error}.`); return resolve(null); }
    if (!/\.csv$/i.test(file.name)) { setError("Unsupported format. Only CSV (.csv) is supported — XLSX is not accepted."); return resolve(null); }
    file.slice(0, 8).arrayBuffer().then((buf) => {
      if (looksLikeZip(new Uint8Array(buf))) { setError("This file looks like an XLSX/ZIP, not a CSV. Only genuine CSV is supported."); return resolve(null); }
      Papa.parse(file, { header: true, skipEmptyLines: true,
        complete: (out) => resolve({ fields: (out.meta && out.meta.fields) || [], rows: out.data || [] }),
        error: () => { setError("Could not parse the file."); resolve(null); } });
    }).catch(() => { setError("Could not read the file."); resolve(null); });
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

  // Dedicated "Upload Practice CSV" control (inside Test Drive Option 1) — ALWAYS enters Test Drive.
  const onUploadPracticeCsv = useCallback(async (file) => {
    const parsed = await parseCsvFile(file);
    if (parsed) ingestPracticeUpload(parsed.fields, parsed.rows);
  }, [mode, recipientKind]);

  const onFile = useCallback(async (file) => {
    const parsed = await parseCsvFile(file);
    if (!parsed) return;
    // Practice-file defense: a marked Practice CSV never reaches the production review/commit path.
    const det = detectPracticeCsv(parsed.fields, parsed.rows);
    if (det.marked) {
      if (!det.valid) { setError("This Practice CSV is invalid — its practice marker is malformed. Download a fresh Practice CSV and try again."); return; }
      setPracticeDetected({ fields: parsed.fields, rows: parsed.rows });   // gate → Continue in Test Drive
      return;
    }
    // Ordinary Personal import: load EXISTING recipients so an already-present email previews as a
    // duplicate. FAIL CLOSED if the lookup fails (never proceed with an empty existing-email list).
    setBusy(true);
    let resp; try { resp = await api.getContacts(); } catch { resp = { ok: false }; }
    setBusy(false);
    const ex = existingEmailsFromResponse(resp);
    if (!ex.ok) { setError("Couldn't load your existing recipients, so duplicates can't be checked. Please try again."); return; }
    const { mapping } = autoMapHeaders(parsed.fields);
    const data = parsed.rows.map((raw) => ({ __raw: raw, __map: mapping }));
    ingest(data, ex.emails, false, null);
  }, [mode, recipientKind]);

  // BUSINESS "Choose a CSV file". A marked Practice CSV → Test Drive (read only to classify). A genuine
  // (unmarked) business CSV → the truthful dormant state; it never reaches a parse-to-commit or any write.
  const onBusinessRealFile = useCallback(async (file) => {
    const parsed = await parseCsvFile(file);
    if (!parsed) return;
    const det = detectPracticeCsv(parsed.fields, parsed.rows);
    if (det.marked) {
      if (!det.valid) { setError("This Practice CSV is invalid — its practice marker is malformed. Download a fresh Practice CSV and try again."); return; }
      setPracticeDetected({ fields: parsed.fields, rows: parsed.rows });
      return;
    }
    setError(null); setBizDormant(true);                   // genuine business CSV → dormant/fail-closed (no write)
  }, [mode, recipientKind]);

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
    setSample(false); setSampleContacts([]); setRows(null); setPlan(null); setSummary(null); setPartial(null); setBizDormant(false); setPracticeDetected(null);
    setError(null); setBusy(false); setReviewState(freshReviewState({ business: false, kind: null }));
    setEntryView("path"); setPersonalGroup(null);        // back to Screen 1, no stale category context
  };
  const exitSample = () => { clearSampleWorkspace(); setSample(false); setSampleContacts([]); setMode(null); setRecipientKind(null); setRows(null); setPlan(null); setSummary(null); setPartial(null); setBizDormant(false); setPracticeDetected(null); setError(null); };
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
    setRows(null); setPlan(null); setSummary(null); setPartial(null); setError(null); setSample(false); setBizDormant(false);
    resetReview(true, kind);
  };
  const backToPath = () => { setEntryView("path"); setPersonalGroup(null); };   // Screen 2 → Screen 1
  const changePersonalGroup = () => { setMode(null); setRows(null); setPlan(null); setSummary(null); setPartial(null); setError(null); setBizDormant(false); setPracticeDetected(null); setEntryView("group"); };   // upload → Screen 2 (Personal)
  const changeBusinessGroup = () => { setMode(null); setRecipientKind(null); setRows(null); setPlan(null); setSummary(null); setPartial(null); setError(null); setBizDormant(false); setPracticeDetected(null); setEntryView("bizgroup"); };   // upload → Screen 2 (Business)

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

      {/* Structured Upload Options — upload-your-own (OR) a zero-mutation Test Drive. */}
      {!rows && !summary && !practiceDetected && (
        <div className="gmiw-upload">
          {activeGroupMeta && (
            <div data-testid="upload-context" style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 16px" }}>
              <b style={{ fontFamily: "Georgia,serif", fontSize: "1.05rem" }}>{activeGroupMeta.uploadHeading}</b>
              <button data-testid="change-group" style={{ ...btn("transparent", "#4a3fb0"), padding: "4px 10px", fontSize: ".78rem" }} onClick={changeGroup}>Change</button>
            </div>
          )}
          {/* NORMAL UPLOAD — unnumbered. Blank templates stay associated with normal upload. */}
          <section className="gmiw-upsec" data-testid="upload-section">
            <h3>Upload your contacts</h3>
            <p>Choose your own CSV file. Only a name and valid email are required. You can review and edit everything as needed before importing, and you can edit or update recipients at any time in the future.</p>
            <label className="gmiw-choose" data-testid="choose-csv">
              Choose a CSV file
              <input type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onRealFile(e.target.files[0])} />
            </label>
            {/* Blank, category-specific templates (NOT the populated Practice CSV). Excel is recommended. */}
            <div className="gmiw-template" data-testid="template-block">
              <h4>Need a file to fill out?</h4>
              <p>Download a blank template with the right columns for this contact type, complete it, then upload it here.</p>
              <p className="gmiw-tpl-note" data-testid="template-version-note">Version 2 — includes guided Type, Relation, and Description dropdowns in Excel.</p>
              <div className="gmiw-template-cta">
                <button data-testid="download-excel-template" style={btn(PURPLE)} onClick={() => downloadTemplate(templateKind, "xlsx")}>Download Excel Template</button>
                <button data-testid="download-csv-template" style={btn("transparent", "#1b1830")} onClick={() => downloadTemplate(templateKind, "csv")}>Download CSV Template</button>
              </div>
              <p className="gmiw-tpl-note" data-testid="csv-disclosure">CSV templates contain the same columns but cannot include Excel dropdown controls or formatting.</p>
            </div>
          </section>
          {/* PAGE-LEVEL DIVIDER between normal upload and Safe practice mode — non-interactive text */}
          <div className="gmiw-or" data-testid="upload-or"><span>OR</span></div>
          {/* SAFE PRACTICE MODE — unnumbered intro, then TWO numbered choice tiles inside the container */}
          <section className="gmiw-upsec gmiw-practice" data-testid="testdrive-section">
            <span className="gmiw-badge">Safe practice mode</span>
            <h3>Test Drive the Import Wizard</h3>
            <p>See the complete import process using fictional contacts. Nothing will be saved or sent.</p>
            {/* OPTION 1 tile — Download then Upload the Practice CSV. Both stay inside this Test Drive tile;
                the dedicated Upload always enters Test Drive (never a production import). */}
            <div className="gmiw-tdtile" data-testid="testdrive-option-1">
              <span className="gmiw-optlabel" data-testid="td-option-1-label">OPTION 1</span>
              <h4>Download and upload the Practice CSV</h4>
              <p>Download the Practice CSV, review or complete it, then upload it yourself to experience the complete import process.</p>
              <div className="gmiw-tdtile-cta">
                <button data-testid="download-practice" style={btn("transparent", "#1b1830")} onClick={() => downloadSampleCsv(templateKind)}>Download Practice CSV</button>
                <label className="gmiw-choose gmiw-choose--sm" data-testid="upload-practice">
                  Upload Practice CSV
                  <input type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onUploadPracticeCsv(e.target.files[0])} />
                </label>
              </div>
            </div>
            {/* INTERNAL divider between the two Test Drive choice tiles */}
            <div className="gmiw-or gmiw-or--inner" data-testid="testdrive-or"><span>OR</span></div>
            {/* OPTION 2 tile — load fictional data → Test Drive review (zero mutation) */}
            <div className="gmiw-tdtile" data-testid="testdrive-option-2">
              <span className="gmiw-optlabel" data-testid="td-option-2-label">OPTION 2</span>
              <h4>Start the Test Drive instantly</h4>
              <p>Start with the Practice CSV already loaded and proceed directly to the Test Drive review.</p>
              <button data-testid="start-testdrive" style={btn(PURPLE)} onClick={() => trySample(templateKind)}>Start Test Drive</button>
            </div>
          </section>
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
      .gmiw-choose{ display:inline-flex; align-items:center; justify-content:center; text-align:center; justify-self:start;
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
    `}</style>
  );
}
function WandSparkles() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#f2dca6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="wand and sparkles">
      <path d="M4 20l9.5-9.5" />
      <path d="M13 6.5l4.5 4.5" />
      <path d="M17 3l.9 2.1L20 6l-2.1.9L17 9l-.9-2.1L14 6l2.1-.9z" fill="#f2dca6" stroke="none" />
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
function Empty({ title, body }) {
  return <div style={{ ...card, textAlign: "center" }}><h3 style={{ margin: "0 0 6px", fontFamily: "Georgia,serif" }}>{title}</h3><p style={muted}>{body}</p></div>;
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
  const heading = isSample ? "Preview your practice contacts" : "Review your contacts";
  const supporting = isSample
    ? "This is how these contacts would appear in your recipient list. Nothing has been saved or sent."
    : "Check the contacts below, make any changes you want, then add them to your recipient list.";
  const preview = seeAll
    ? paginate(shown, confPage, DETAILS_BATCH)
    : { slice: shown.slice(0, PREVIEW_N), pages: 1, page: 0, total: shown.length };

  return (
    <div data-testid="confirm-screen" style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <h2 style={{ margin: 0, fontFamily: "Georgia,serif", fontSize: "1.3rem" }}>{heading}</h2>
        <p style={{ ...sub, marginTop: 4 }}>{supporting}</p>
        <div style={{ display: "grid", gap: 2, marginTop: 4 }}>
          {!isSample && importCount > 0 && <div style={{ fontSize: ".98rem", color: "#1f9d6b", fontWeight: 700 }}>{importCount} contact{importCount === 1 ? "" : "s"} ready to add</div>}
          {counts.alreadyInList > 0 && <div style={sub}>{counts.alreadyInList} already in your recipient list—we'll skip {counts.alreadyInList === 1 ? "this contact" : "them"}.</div>}
          {counts.willSkip > 0 && <div style={sub}>{counts.willSkip} won't be added.</div>}
        </div>
      </div>

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
        <div data-testid="partial" style={{ ...card, borderColor: "rgba(31,157,107,.45)", background: "rgba(31,157,107,.06)" }}>
          <b style={{ fontSize: ".95rem", color: "#1f7a57" }}>{partial.added} contact{partial.added === 1 ? " was" : "s were"} added. {partial.failed} could not be added.</b>
          <div style={{ ...sub, marginTop: 3 }}>Added contacts won't be submitted again. Fix the ones below and add them when you're ready.</div>
        </div>
      )}

      {/* Quick fix — genuine blockers only */}
      {blockers.length > 0 && (
        <div data-testid="quickfix" style={{ ...card, borderColor: "rgba(214,145,16,.45)" }}>
          <b style={{ fontSize: ".95rem" }}>{blockers.length} contact{blockers.length === 1 ? "" : "s"} need a quick fix before they can be added.</b>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {blockers.map((it) => <QuickFixRow key={it.index} it={it} on={on} />)}
          </div>
        </div>
      )}

      {/* Recipient-style preview (bounded/paginated) — one card per contact, with its state */}
      {shown.length > 0 && (
        <div style={card}>
          <div style={{ ...rowStyle, marginBottom: 6 }}>
            <b style={{ fontSize: ".9rem" }}>Your contacts</b>
            {shown.length > PREVIEW_N && <button style={linkBtn} onClick={() => { setSeeAll((v) => !v); setConfPage(0); }}>{seeAll ? "Show less" : `See all ${shown.length}`}</button>}
          </div>
          <div style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
            {preview.slice.map((it, i) => <ReadyPreviewRow key={it.index} it={it} business={business} first={i === 0} onAddRelationship={openDetails} />)}
          </div>
          {seeAll && preview.pages > 1 && <Pager page={preview.page} pages={preview.pages} onPage={setConfPage} />}
        </div>
      )}

      {/* Primary Test Drive CTA — view the fictional contacts in the normal Recipients page (Practice View) */}
      {isSample && (
        <div data-testid="practice-cta-block" style={{ ...card, borderColor: "rgba(214,145,16,.4)", background: "rgba(214,145,16,.06)", display: "grid", gap: 8 }}>
          <button data-testid="view-practice-recipients" style={btn(PURPLE)} onClick={onViewPractice}>View Practice Contacts in Recipients</button>
          <p data-testid="practice-cta-note" style={{ margin: 0, fontSize: ".8rem", color: "#7a5410", lineHeight: 1.5 }}>See how the fictional contacts will look in your Recipients page. They exist only during this Test Drive and will be automatically removed when you exit Test Drive or log out.</p>
        </div>
      )}

      {/* Actions */}
      <div style={{ ...rowStyle }}>
        <button data-testid="startover" style={btn("transparent", "#1b1830")} onClick={onStartOver}>Start over</button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
  );
}

// A single blocked contact with a plain-language reason and the one control that unblocks it. The
// component switches on `fixField` (a field name), never on an internal validation code.
function QuickFixRow({ it, on }) {
  return (
    <div style={{ border: "1px solid #f0e6cf", borderRadius: 10, padding: 10, display: "grid", gap: 6 }}>
      <div style={{ ...rowStyle }}>
        <b style={{ fontSize: ".88rem" }}>{it.name || "This contact"}</b>
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

// Per-contact state label for the recipient-style preview.
const STATE_LABEL = {
  added: { t: "Added ✓", c: "#1f7a57" },
  already_in_list: { t: "Already in your list", c: "#605c78" },
  will_skip: { t: "Won't be added", c: "#605c78" },
};
// One recipient-style card. Truthful about a missing relationship (Morgan Doe rule) and its state.
function ReadyPreviewRow({ it, business, first, onAddRelationship }) {
  const rel = business
    ? (it.audience ? (RECIPIENT_TYPE_OPTIONS.find((o) => o.value === it.audience) || {}).label || "" : "")
    : (it.relationProvided ? it.relationLabel : "Relationship not provided (optional)");
  const state = STATE_LABEL[it.bucket];
  const editable = it.bucket === "ready";
  return (
    <div style={{ ...rowStyle, padding: "8px 12px", borderTop: first ? "none" : "1px solid #f4f4f7", fontSize: ".82rem" }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
        <b>{it.name}</b> <span style={{ color: "#605c78" }}>· {it.email}</span>
        {it.retryNote && <span style={{ color: "#b8791b" }}> · {it.retryNote}</span>}
      </span>
      <span style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {state && <span style={{ color: state.c, fontWeight: 700 }}>{state.t}</span>}
        <span style={{ color: (business || it.relationProvided) ? "#605c78" : "#a08a5a" }}>{it.birthday ? it.birthday + " · " : ""}{rel}</span>
        {editable && !business && !it.relationProvided && <button style={linkBtn} onClick={onAddRelationship}>Add relationship</button>}
      </span>
    </div>
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
