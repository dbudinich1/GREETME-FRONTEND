// src/components/importWizard/ContactImportWizard.jsx
//
// TEAM A — Greet-Me Import Wizard. Two first-level paths (Individual / Business), then the canonical
// low-friction flow: Choose/upload CSV → Review contacts → Import. There is NO separate "defaults
// were applied" decision screen — uploading lands directly on one plain-language Review surface
// (ReviewScreen) built for a first-time, nontechnical user. Heavy logic lives in tested pure models
// (importCore / completionModel / recipientTypeModel / reviewModel). This component orchestrates and
// never modifies the locked Recipients page or adds backend routes.

import { useCallback, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import api from "../../api/api";
import { createCorporateCampaignsClient } from "../../api/corporateCampaigns.js";
import {
  checkFileLimits, checkRowCount, autoMapHeaders, processRow, detectDuplicates,
  buildPlan, looksLikeZip,
} from "../../import/importCore.js";
import { assertNoRealMix } from "../../import/demoData.js";
import { MODES, corporateContext, corporateRoute, existingEmailsFromResponse, classifyCommitOutcome } from "./wizardModel.js";
import { RELATIONSHIP_CATEGORIES, CLOSENESS_OPTIONS } from "../../import/completionModel.js";
import { RECIPIENT_KINDS, RECIPIENT_TYPE_OPTIONS } from "../../import/recipientTypeModel.js";
import { normalizeEmail } from "../../import/importCore.js";
import {
  buildReview, buildReviewPayload, freshReviewState, paginate,
  setGroup, setRelation, setCloseness, setName, setEmail, setBirthday, leaveRelationshipBlank,
  chooseAudience, skipContact, markCommitted, setCommitErrors, addExistingEmails,
  relationsForGroup, AUDIENCE_CHOICES, REVIEW_BUCKET, relationLabelFor,
} from "../../import/reviewModel.js";
import { sampleContactsFor, sampleCsvFor, loadSampleWorkspace, saveSampleWorkspace, clearSampleWorkspace } from "../../import/sampleWorkspace.js";
import { showManualToast } from "../../utils/notify";
import { COMMS_CATEGORIES } from "../../utils/commsCatalog";

const PURPLE = "linear-gradient(135deg,#6d74ee,#764ba2)";
const card = { background: "#fff", border: "1px solid rgba(27,24,48,.1)", borderRadius: 14, padding: 18 };
const btn = (bg, fg = "#fff") => ({ background: bg, color: fg, border: bg === "transparent" ? "1px solid rgba(27,24,48,.15)" : "none", borderRadius: 11, padding: "10px 16px", fontWeight: 700, fontSize: ".85rem", cursor: "pointer" });
// Real calendar date for the age gate (never guessed). computeContactErrors needs it (audit F1).
const todayIso = () => new Date().toISOString().slice(0, 10);
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
  const client = useMemo(() => createCorporateCampaignsClient(), []);
  const navigate = useNavigate();
  const returnToRecipients = useCallback(() => navigate("/dashboard/contacts"), [navigate]);
  const [mode, setMode] = useState(null);
  const [membershipResult, setMembershipResult] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [rows, setRows] = useState(null);       // full deduped rows for the Review surface
  const [plan, setPlan] = useState(null);       // accounting (skipped/invalid) only
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Business recipient TYPE selection (null = individual ownership, no type gate).
  const [recipientKind, setRecipientKind] = useState(null);
  // Session-scoped Sample Workspace (never persisted to backend).
  const [sample, setSample] = useState(false);
  const [sampleContacts, setSampleContacts] = useState([]);
  // Partial real-import outcome ({added, failed}) — keeps the user on the combined screen (never a
  // false "complete success"). null = no partial result to show.
  const [partial, setPartial] = useState(null);
  // Entry navigation: "path" = Screen 1 (Personal/Business), "group" = Screen 2 (Personal group).
  // personalGroup is UI CONTEXT ONLY — it NEVER becomes relationship data, a structured category,
  // or a business type; it only tailors the upload heading (and, later, sample/editor scoping).
  const [entryView, setEntryView] = useState("path");
  const [personalGroup, setPersonalGroup] = useState(null);
  // The single Review state (relationship/audience choices, removals, description default). It is
  // reset — never carried — whenever a new file/kind/path is chosen.
  const [reviewState, setReviewState] = useState(() => freshReviewState({ business: false, kind: null }));
  const resetReview = (business, kind, existingEmails = []) => setReviewState(freshReviewState({ business, kind, existingEmails, todayIso: todayIso() }));

  // Restore a same-session sample on mount (non-secret session-scoped; a NEW login never restores an
  // old sample). Individual → rehydrate straight into the combined preview (no separate list);
  // Business → keep its own terminal list. Clear the sample on session expiry.
  useEffect(() => {
    const { contacts, kind } = loadSampleWorkspace();
    if (contacts.length) {
      setSample(true);
      if (kind && kind !== "individual") {
        setSampleContacts(contacts);                         // Business sample — unchanged presentation
      } else {
        setRecipientKind(null);
        setReviewState(freshReviewState({ business: false, kind: null, existingEmails: [], todayIso: todayIso() }));
        setRows(rehydrateSampleRows(contacts));              // Individual sample — combined preview
      }
    }
    const onExpire = () => { clearSampleWorkspace(); setSample(false); setSampleContacts([]); setRows(null); };
    if (typeof window !== "undefined") window.addEventListener("auth:session-expired", onExpire);
    return () => { if (typeof window !== "undefined") window.removeEventListener("auth:session-expired", onExpire); };
  }, []);

  // Persist the INDIVIDUAL sample live (session-scoped only) so a same-session reload restores the
  // combined preview. Never a backend call. Business sample persists via its own commit path.
  useEffect(() => {
    if (sample && mode !== MODES.CORPORATE && !recipientKind && Array.isArray(rows)) {
      try { saveSampleWorkspace(buildReviewPayload(rows, reviewState), "individual"); } catch { /* ignore */ }
    }
  }, [sample, mode, recipientKind, rows, reviewState]);

  const ctx = useMemo(() => (mode === MODES.CORPORATE ? corporateContext(membershipResult, selectedOrgId) : null), [mode, membershipResult, selectedOrgId]);
  const orgId = ctx && ctx.selectedOrgId;

  const pickMode = useCallback(async (m) => {
    setMode(m); setRows(null); setPlan(null); setSummary(null); setError(null); setPartial(null); setSelectedOrgId(null); setRecipientKind(null); setSample(false);
    resetReview(m === MODES.CORPORATE, null);
    if (m === MODES.CORPORATE) {
      setBusy(true);
      const res = await client.listMemberships();
      setBusy(false);
      setMembershipResult(res);
    }
  }, [client]);

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

  const onFile = useCallback(async (file) => {
    setError(null);
    const lim = checkFileLimits(file);
    if (!lim.ok) { setError(`File rejected: ${lim.error}.`); return; }
    if (!/\.csv$/i.test(file.name)) { setError("Unsupported format. Only CSV (.csv) is supported — XLSX is not accepted."); return; }
    // Content-based check: reject a spoofed XLSX/ZIP even when the extension says .csv. Never
    // trust the extension alone.
    try {
      const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      if (looksLikeZip(head)) { setError("This file looks like an XLSX/ZIP, not a CSV. Only genuine CSV is supported."); return; }
    } catch { setError("Could not read the file."); return; }
    // Personal import: load the user's EXISTING recipients so an already-present email previews as
    // a duplicate (skipped) rather than entering the import and failing at commit. FAIL CLOSED — if
    // the lookup fails we do NOT proceed with an empty existing-email list (that would re-open the
    // preview↔commit mismatch). Corporate/sample do not dedup against the personal collection.
    let existingEmails = [];
    if (mode === MODES.PERSONAL) {
      setBusy(true);
      let resp;
      try { resp = await api.getContacts(); } catch { resp = { ok: false }; }
      setBusy(false);
      const ex = existingEmailsFromResponse(resp);
      if (!ex.ok) { setError("Couldn't load your existing recipients, so duplicates can't be checked. Please try again."); return; }
      existingEmails = ex.emails;
    }
    const business = mode === MODES.CORPORATE;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (out) => {
        const headers = (out.meta && out.meta.fields) || [];
        const { mapping } = autoMapHeaders(headers);
        const data = (out.data || []).map((raw) => ({ __raw: raw, __map: mapping }));
        ingest(data, existingEmails, business, recipientKind);
      },
      error: () => setError("Could not parse the file."),
    });
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

  const pickRecipientKind = useCallback((kind) => {
    setRecipientKind(kind); setRows(null); setPlan(null); setSummary(null); setError(null); resetReview(true, kind);
  }, []);

  // "Try the sample" — load fictional data for a kind into a SESSION-SCOPED Sample Workspace and run
  // the exact same Review flow. NEVER touches a backend endpoint. kind ∈ individual/employee/client/
  // vendor/mixed (mixed = Universal List).
  const trySample = useCallback((kind) => {
    setSample(true); setError(null); setSummary(null); setSampleContacts([]); setPartial(null);
    const business = kind !== "individual";
    const rk = business ? kind : null;
    setRecipientKind(rk);
    setReviewState(freshReviewState({ business, kind: rk, existingEmails: [], todayIso: todayIso() }));
    const ds = sampleContactsFor(kind);
    assertNoRealMix(ds);
    const processed = ds.map((c, i) => ({ contact: c, errors: [], warnings: [], valid: true, duplicate: null, index: i, demo: true, __raw: {}, __map: {} }));
    setRows(processed); setPlan(buildPlan(processed, { duplicateStrategy: "skip" }));
  }, []);

  const downloadSampleCsv = useCallback((kind) => {
    try {
      const blob = new Blob([sampleCsvFor(kind)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `greetme-sample-${kind}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch { setError("Could not generate the sample file."); }
  }, []);

  // BUSINESS sample terminal step ("View X sample recipients"): build the sample recipients and
  // persist ONLY to the session-scoped Sample Workspace — never a backend mutation. (Individual sample
  // is already terminal on the combined screen and does not use this path.)
  const commitSample = useCallback(() => {
    if (!sample) return;
    try { assertNoRealMix((rows || []).map((r) => r.contact)); } catch (e) { setError(String(e && e.message)); return; }
    const built = buildReviewPayload(rows, reviewState);
    saveSampleWorkspace(built, recipientKind || "mixed");
    setSampleContacts(built); setRows(null); setPlan(null);
    setSummary({ sampleWorkspace: true, count: built.length });
  }, [sample, rows, reviewState, recipientKind]);

  const commitCorporate = useCallback(() => {
    if (mode !== MODES.CORPORATE) return;
    // Corporate import backend is dormant/fail-closed — NEVER writes, never enables a campaign,
    // occasion, schedule, queue, worker, gift, or send. Truthful gated state.
    setError("Organization import isn't available yet. Your selections are complete and will import once organization import is turned on.");
  }, [mode]);

  // START OVER — clears ALL selection/parse/edit/result state (and the session-scoped sample workspace)
  // and returns to the Individual/Business selection. Never touches production contacts.
  const startOver = () => {
    clearSampleWorkspace();
    setMode(null); setRecipientKind(null); setMembershipResult(null); setSelectedOrgId(null);
    setSample(false); setSampleContacts([]); setRows(null); setPlan(null); setSummary(null); setPartial(null);
    setError(null); setBusy(false); setReviewState(freshReviewState({ business: false, kind: null }));
    setEntryView("path"); setPersonalGroup(null);        // back to Screen 1, no stale Personal context
  };
  const exitSample = () => { clearSampleWorkspace(); setSample(false); setSampleContacts([]); setMode(null); setRecipientKind(null); setRows(null); setPlan(null); setSummary(null); setPartial(null); setError(null); };
  const deleteAllSample = exitSample;   // both clear the session-scoped sample data
  // From an INDIVIDUAL sample, swap to a real Individual upload (clears the sample, keeps the path).
  const uploadOwnFromSample = () => { clearSampleWorkspace(); setSample(false); setSampleContacts([]); setRows(null); setPlan(null); setError(null); setPartial(null); setMode(MODES.PERSONAL); resetReview(false, null); };
  // Screen 2: choose a Personal relationship GROUP → store context only, then continue to the existing
  // Individual upload/sample screen (mode = personal). Never persists a relationship or a business type.
  const choosePersonalGroup = (group) => { setPersonalGroup(group); setEntryView("path"); pickMode(MODES.PERSONAL); };
  const backToPath = () => { setEntryView("path"); setPersonalGroup(null); };   // Screen 2 → Screen 1
  const changePersonalGroup = () => { setMode(null); setRows(null); setPlan(null); setSummary(null); setPartial(null); setError(null); setEntryView("group"); };   // upload → Screen 2

  // ---------- render ----------
  // Session-scoped Sample Recipients (completed or resumed) — read-only presentation.
  if (sample && sampleContacts.length > 0 && !rows) {
    return <SampleRecipientsView contacts={sampleContacts} onDeleteAll={deleteAllSample} onExit={exitSample} onReturn={returnToRecipients} />;
  }
  // Canonical entry — EXACTLY two primary paths (premium path-selection screen). Routing is unchanged:
  // each whole panel calls pickMode() exactly as the old CTAs did.
  if (!mode && !sample) {
    // SCREEN 2 — Personal relationship group (Family / Friends / Professional).
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
            onClick={() => pickMode(MODES.CORPORATE)}
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

  if (mode === MODES.CORPORATE && !sample) {
    const route = corporateRoute(ctx);
    if ((busy && !membershipResult) || route === "loading") return <Shell back={startOver}><p style={muted}>Checking your organization eligibility…</p></Shell>;
    if (route === "dormant") {
      // Authorized-but-dormant corporate backend — a TRUTHFUL, usable gated state (never a blank
      // screen, no vague future promise, never implies data was saved).
      return (
        <Shell back={startOver}>
          <Empty title="Organization import is currently turned off" body="This feature isn't accepting imports right now, and nothing has been saved. Your personal recipient list is ready to use." />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
            <button style={btn(PURPLE)} onClick={() => setMode(null)}>Return to Import Options</button>
            <button style={btn("transparent", "#1b1830")} onClick={() => trySample("mixed")}>Explore Sample Import</button>
            <button style={btn("transparent", "#1b1830")} onClick={returnToRecipients}>Return to Recipients</button>
          </div>
        </Shell>
      );
    }
    if (route === "ineligible") {
      return (
        <Shell back={startOver}>
          <Empty title="You're not part of an organization yet" body="Organization Contacts import is for members of a Greet-Me for Business organization. Explore Business to get set up." />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
            <button style={btn(PURPLE)} onClick={() => navigate("/business")}>Explore Greet-Me for Business</button>
            <button style={btn("transparent", "#1b1830")} onClick={returnToRecipients}>Return to Recipients</button>
          </div>
        </Shell>
      );
    }
    if (route === "error") {
      return (
        <Shell back={startOver}>
          <Empty title="We couldn't check your organization" body="Something went wrong resolving your organization. Please try again." />
          <RecoveryActions onStartOver={startOver} onReturn={returnToRecipients} />
        </Shell>
      );
    }
    if (route === "select_org") {
      return (
        <Shell back={startOver}>
          <h3 style={{ margin: "0 0 8px" }}>Choose an organization</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {ctx.memberships.map((m) => (
              <button key={m.corporateOrganizationId} style={{ ...card, textAlign: "left", cursor: "pointer", fontFamily: "monospace", fontSize: ".85rem" }} onClick={() => setSelectedOrgId(m.corporateOrganizationId)}>
                {m.corporateOrganizationId}<div style={sub}>Role: {m.role}</div>
              </button>
            ))}
          </div>
        </Shell>
      );
    }
    // route === "ready" → fall through to the recipient-type selector
  }

  // Business recipient-type selector (Employees / Clients / Vendors / Universal List).
  if (mode === MODES.CORPORATE && !sample && !recipientKind) {
    return (
      <Shell back={startOver}>
        <h3 style={{ margin: "0 0 4px", fontFamily: "Georgia,serif" }}>Who are you importing?</h3>
        <p style={{ ...sub, marginTop: 0 }}>A single type is applied automatically — no type column required. Universal List maps a mixed file.</p>
        <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
          {RECIPIENT_KINDS.map((k) => (
            <button key={k.value} style={{ ...card, textAlign: "left", cursor: "pointer" }} onClick={() => pickRecipientKind(k.value)}>
              <b>{k.value === "employee" ? "Employees / Personnel" : k.label}</b><div style={sub}>{k.blurb}</div>
            </button>
          ))}
        </div>
        <RecoveryActions onStartOver={startOver} onReturn={returnToRecipients} />
      </Shell>
    );
  }

  // Import UI — Individual, Business (type chosen), or an active Sample.
  const business = mode === MODES.CORPORATE;
  const kindLabel = (RECIPIENT_KINDS.find((k) => k.value === recipientKind) || {}).label;
  const templateKind = business ? (recipientKind || "employee") : "individual";
  // Personal-group upload context (label only — no data implication).
  const personalGroupMeta = PERSONAL_GROUPS.find((g) => g.value === personalGroup) || null;
  const onCommit = sample ? commitSample : (business ? commitCorporate : commitPersonal);
  // Individual sample is terminal on the combined screen — it carries its own action bar (no commit CTA,
  // no separate "View sample recipients" screen). Business sample keeps its existing commit path.
  const sampleActions = (sample && !business) ? {
    onUploadOwn: uploadOwnFromSample,
    onDownloadCsv: () => downloadSampleCsv("individual"),
    onDelete: deleteAllSample,
    onExit: exitSample,
  } : null;
  return (
    <Shell back={startOver}>
      {business && !sample && <div style={{ ...card, marginBottom: 12, fontSize: ".82rem" }}>Organization <b style={{ fontFamily: "monospace" }}>{orgId}</b>{kindLabel ? <> · <b>{kindLabel}</b></> : null}</div>}
      {sample && <SampleBanner />}
      {error && <div role="alert" style={{ ...card, borderColor: "rgba(214,69,69,.4)", background: "rgba(214,69,69,.08)", color: "#8a1f1f", marginBottom: 12 }}>{error}</div>}

      {/* Entry — CSV upload + downloadable sample CSV + "Try the sample" (inside every path). */}
      {!rows && !summary && (
        <div style={{ display: "grid", gap: 12 }}>
          {!business && personalGroupMeta && (
            <div data-testid="upload-context" style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 16px" }}>
              <b style={{ fontFamily: "Georgia,serif", fontSize: "1.05rem" }}>{personalGroupMeta.uploadHeading}</b>
              <button data-testid="change-group" style={{ ...btn("transparent", "#4a3fb0"), padding: "4px 10px", fontSize: ".78rem" }} onClick={changePersonalGroup}>Change</button>
            </div>
          )}
          <label style={{ ...card, display: "block", textAlign: "center", cursor: "pointer", borderStyle: "dashed" }}>
            <b>Choose a .csv file{kindLabel ? ` · ${kindLabel}` : ""}</b><div style={sub}>Only a name and a valid email are required. Everything else is optional — you can review before importing.</div>
            <input type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button style={btn("transparent", "#1b1830")} onClick={() => downloadSampleCsv(templateKind)}>Download Greet-Me sample CSV</button>
            <button style={btn(PURPLE)} onClick={() => trySample(templateKind)}>Try the sample</button>
          </div>
        </div>
      )}

      {/* Combined Review/Preview — the ONLY screen after the upload/sample choice for Individual.
          Real success navigates straight to Recipients; there is no wizard result/list screen. */}
      {rows && !summary && (
        <ReviewScreen
          rows={rows} state={reviewState} setState={setReviewState}
          business={business} kindLabel={kindLabel} demo={sample} busy={busy}
          partial={partial} sampleActions={sampleActions}
          onCommit={onCommit} onStartOver={startOver}
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
      .gmiw-panels{ display:grid; grid-template-columns:1fr 1fr; gap:22px; align-items:stretch; }
      .gmiw-panels--three{ grid-template-columns:1fr 1fr 1fr; }
      .gmiw-panel{ display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:12px;
        min-height:230px; padding:32px 24px; cursor:pointer; color:#2c2140; font-family:inherit; border-radius:24px;
        border:2px solid #b98fd6; background:linear-gradient(160deg,#f7f0ff 0%,#fdeef7 100%);
        box-shadow:0 14px 30px -18px rgba(120,60,160,.55); transition:transform .12s ease, box-shadow .12s ease, border-color .12s ease; }
      .gmiw-panel:hover{ transform:translateY(-3px); border-color:#8a4fbf; box-shadow:0 22px 44px -18px rgba(120,60,160,.62); }
      .gmiw-panel:focus-visible{ outline:3px solid #6d74ee; outline-offset:3px; }
      .gmiw-panel:active{ transform:translateY(-1px) scale(.995); box-shadow:0 12px 24px -16px rgba(120,60,160,.6); }
      .gmiw-medallion{ width:78px; height:78px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff;
        background:radial-gradient(circle at 32% 30%,#8a5fd0,#5b3a9e); box-shadow:0 10px 20px -8px rgba(70,30,120,.7); }
      .gmiw-medallion--plum{ background:radial-gradient(circle at 32% 30%,#a552a3,#6d2d6d); }
      .gmiw-medallion--rose{ background:radial-gradient(circle at 32% 30%,#cf6aa2,#8e2f66); }
      .gmiw-panel-title{ font-size:1.28rem; font-weight:800; letter-spacing:-.01em; }
      .gmiw-panel-copy{ color:#5a5170; font-size:.95rem; max-width:28ch; line-height:1.5; }
      .gmiw-cta{ margin-top:4px; font-weight:800; letter-spacing:.09em; font-size:.82rem; color:#6b3fa0; }
      .gmiw-footer{ text-align:center; color:#6b6580; font-size:.86rem; margin:22px 0 2px; }
      @media (max-width:640px){
        .gmiw-underlay{ padding:14px; border-radius:22px; } .gmiw-surface{ padding:16px; }
        .gmiw-banner{ padding:22px 20px; } .gmiw-wand{ display:none; }
        .gmiw-title{ font-size:1.5rem; } .gmiw-heading{ font-size:1.5rem; margin:22px 0 18px; }
        .gmiw-panels, .gmiw-panels--three{ grid-template-columns:1fr; } .gmiw-panel{ min-height:0; padding:26px 20px; }
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
// Screen 2 — Personal relationship GROUPS. `value` is UI context only (never a persisted relationship
// or a recipientType). `uploadHeading` tailors the existing upload screen; nothing here invents data.
const PERSONAL_GROUPS = [
  { value: "family", title: "Family", copy: "Parents, children, siblings, partners, and extended family.", cta: "CHOOSE FAMILY →", medallion: "", Icon: HomeIcon, uploadHeading: "Import Family Contacts" },
  { value: "friend", title: "Friends", copy: "Best friends, neighbors, teammates, and classmates.", cta: "CHOOSE FRIENDS →", medallion: "gmiw-medallion--rose", Icon: HeartIcon, uploadHeading: "Import Friends" },
  { value: "professional", title: "Professional", copy: "Colleagues, mentors, and work connections important to you.", cta: "CHOOSE PROFESSIONAL →", medallion: "gmiw-medallion--plum", Icon: BriefcaseIcon, uploadHeading: "Import Professional Relationships" },
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

export function ReviewScreen({ rows, state, setState, business, kindLabel, demo, busy, partial, sampleActions, onCommit, onStartOver }) {
  const review = buildReview(rows, state);
  const { buckets, counts, importCount, importEnabled } = review;
  const [view, setView] = useState("confirm");   // "confirm" | "details"
  const [seeAll, setSeeAll] = useState(false);
  const [confPage, setConfPage] = useState(0);
  const [detPage, setDetPage] = useState(0);
  const isSample = !!demo;
  const isIndividualSample = !!sampleActions;      // individual sample → terminal action bar, no commit CTA

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
  const heading = isSample ? "Preview your sample contacts" : "Review your contacts";
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

      {/* Actions */}
      <div style={{ ...rowStyle }}>
        <button data-testid="startover" style={btn("transparent", "#1b1830")} onClick={onStartOver}>Start over</button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {counts.ready > 0 && <button data-testid="details-cta" style={btn("transparent", "#4a3fb0")} onClick={openDetails}>Add relationship details first</button>}
          {isIndividualSample ? (
            <>
              <button data-testid="sample-upload-own" style={btn("transparent", "#1b1830")} onClick={sampleActions.onUploadOwn}>Upload my own CSV</button>
              <button data-testid="sample-download" style={btn("transparent", "#1b1830")} onClick={sampleActions.onDownloadCsv}>Download sample CSV</button>
              <button data-testid="sample-delete" style={btn("transparent", "#8a1f1f")} onClick={sampleActions.onDelete}>Delete sample contacts</button>
              <button data-testid="sample-exit" style={btn(PURPLE)} onClick={sampleActions.onExit}>Exit Sample Mode</button>
            </>
          ) : isSample ? (
            <button data-testid="add-cta" style={btn(PURPLE)} onClick={onCommit}>View {importCount} sample recipient{importCount === 1 ? "" : "s"}</button>
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
function RecoveryActions({ onStartOver, onReturn }) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
      <button style={btn("transparent", "#1b1830")} onClick={onStartOver}>Start over</button>
      <button style={btn(PURPLE)} onClick={onReturn}>Return to Recipients</button>
    </div>
  );
}

function SampleBanner() {
  return (
    <div style={{ ...card, marginBottom: 12, borderColor: "rgba(214,145,16,.4)", background: "rgba(214,145,16,.08)" }}>
      <b>Sample Mode — Nothing will be saved or sent</b>
      <div style={{ fontSize: ".82rem", color: "#7a5410", marginTop: 2 }}>Fictional data on reserved <code>example.com</code> domains. No import, schedule, worker, gift, payment, email, voice, or animation call is ever made.</div>
    </div>
  );
}

// Read-only Sample Recipients presentation — session-scoped data only; edits/deletes never touch prod.
function SampleRecipientsView({ contacts, onDeleteAll, onExit, onReturn }) {
  const typeLabel = (v) => (RECIPIENT_TYPE_OPTIONS.find((o) => o.value === v) || {}).label || "";
  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div style={{ ...card, marginBottom: 12, borderColor: "rgba(214,145,16,.4)", background: "rgba(214,145,16,.08)" }}>
        <b>Sample Mode — nothing has been saved or sent</b>
        <div style={{ fontSize: ".82rem", color: "#7a5410", marginTop: 2 }}>These sample recipients live only in this browser session — never saved to your account, never sent anything.</div>
      </div>
      <div style={card}>
        <b style={{ fontSize: ".95rem", fontFamily: "Georgia,serif" }}>Sample Recipients · {contacts.length}</b>
        <div style={{ maxHeight: 340, overflow: "auto", border: "1px solid #eee", borderRadius: 10, marginTop: 8 }}>
          {contacts.map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 12px", borderTop: i ? "1px solid #f4f4f7" : "none", fontSize: ".82rem" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || "—"} · <span style={{ color: "#605c78" }}>{c.email || "—"}</span></span>
              <span style={{ color: "#605c78", flexShrink: 0 }}>{c.recipientType ? typeLabel(c.recipientType) : (relationLabelFor(c.relationship) || "—")}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button style={btn("transparent", "#8a1f1f")} onClick={onDeleteAll}>Delete all sample contacts</button>
          <button style={btn("transparent", "#1b1830")} onClick={onExit}>Exit Sample Mode</button>
          <button style={btn(PURPLE)} onClick={onReturn}>Return to Recipients</button>
        </div>
      </div>
    </div>
  );
}
