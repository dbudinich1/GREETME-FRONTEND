// src/components/importWizard/ContactImportWizard.jsx
//
// TEAM A — Contact Import Wizard. Two first-level paths (Individual / Business), then the canonical
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
import { MODES, corporateContext, corporateRoute, existingEmailsFromResponse, classifyImportSummary, classifyCommitOutcome } from "./wizardModel.js";
import { RELATIONSHIP_CATEGORIES, CLOSENESS_OPTIONS } from "../../import/completionModel.js";
import { RECIPIENT_KINDS, RECIPIENT_TYPE_OPTIONS } from "../../import/recipientTypeModel.js";
import {
  buildReview, buildReviewPayload, freshReviewState, paginate,
  setGroup, setRelation, setCloseness, setName, setEmail, setBirthday, leaveRelationshipBlank,
  chooseAudience, skipContact, relationsForGroup, AUDIENCE_CHOICES, REVIEW_BUCKET, relationLabelFor,
} from "../../import/reviewModel.js";
import { sampleContactsFor, sampleCsvFor, loadSampleWorkspace, saveSampleWorkspace, clearSampleWorkspace } from "../../import/sampleWorkspace.js";

const PURPLE = "linear-gradient(135deg,#6d74ee,#764ba2)";
const card = { background: "#fff", border: "1px solid rgba(27,24,48,.1)", borderRadius: 14, padding: 18 };
const btn = (bg, fg = "#fff") => ({ background: bg, color: fg, border: bg === "transparent" ? "1px solid rgba(27,24,48,.15)" : "none", borderRadius: 11, padding: "10px 16px", fontWeight: 700, fontSize: ".85rem", cursor: "pointer" });
// Real calendar date for the age gate (never guessed). computeContactErrors needs it (audit F1).
const todayIso = () => new Date().toISOString().slice(0, 10);

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
  // The single Review state (relationship/audience choices, removals, description default). It is
  // reset — never carried — whenever a new file/kind/path is chosen.
  const [reviewState, setReviewState] = useState(() => freshReviewState({ business: false, kind: null }));
  const resetReview = (business, kind, existingEmails = []) => setReviewState(freshReviewState({ business, kind, existingEmails, todayIso: todayIso() }));

  // Restore a same-session sample on mount (non-secret session-scoped; a NEW login never restores an
  // old sample). Clear the sample on session expiry — do not rely on logout alone.
  useEffect(() => {
    const existing = loadSampleWorkspace();
    if (existing.length) { setSample(true); setSampleContacts(existing); }
    const onExpire = () => { clearSampleWorkspace(); setSample(false); setSampleContacts([]); };
    if (typeof window !== "undefined") window.addEventListener("auth:session-expired", onExpire);
    return () => { if (typeof window !== "undefined") window.removeEventListener("auth:session-expired", onExpire); };
  }, []);

  const ctx = useMemo(() => (mode === MODES.CORPORATE ? corporateContext(membershipResult, selectedOrgId) : null), [mode, membershipResult, selectedOrgId]);
  const orgId = ctx && ctx.selectedOrgId;

  const pickMode = useCallback(async (m) => {
    setMode(m); setRows(null); setPlan(null); setSummary(null); setError(null); setSelectedOrgId(null); setRecipientKind(null); setSample(false);
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
    setBusy(true); setError(null);
    // Personal ownership: import into the authenticated user's own collection. buildReviewPayload
    // transmits every recognized mapped field (incl. birthday) for the READY rows only, with the
    // Individual/business recipientType boundary enforced (Individual → recipientType stripped).
    const contacts = buildReviewPayload(rows, reviewState);
    let res;
    // Preserve the thrown status (api.request throws Error{status} on 403/429/5xx) so the outcome
    // classifier can distinguish failures and message them correctly.
    try { res = await api.importContacts(contacts); } catch (e) { res = { ok: false, status: e && e.status, error: String(e && e.message) }; }
    setBusy(false);
    // FAIL CLOSED: only render a success summary for a recognized successful results body. Any
    // non-2xx / {ok:false} / network / thrown / empty-or-malformed 2xx becomes a clear error and
    // NEVER "Import complete — 0 added".
    const outcome = classifyCommitOutcome(res);
    if (outcome.status !== "success") { setError(outcome.message); return; }
    setSummary(outcome.summary);
  }, [mode, rows, reviewState]);

  const pickRecipientKind = useCallback((kind) => {
    setRecipientKind(kind); setRows(null); setPlan(null); setSummary(null); setError(null); resetReview(true, kind);
  }, []);

  // "Try the sample" — load fictional data for a kind into a SESSION-SCOPED Sample Workspace and run
  // the exact same Review flow. NEVER touches a backend endpoint. kind ∈ individual/employee/client/
  // vendor/mixed (mixed = Universal List).
  const trySample = useCallback((kind) => {
    setSample(true); setError(null); setSummary(null); setSampleContacts([]);
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

  // Finish a sample: build the completed recipients and persist ONLY to the session-scoped Sample
  // Workspace (sessionStorage) — never POST to contacts/import or any backend mutation endpoint.
  const commitSample = useCallback(() => {
    if (!sample) return;
    try { assertNoRealMix((rows || []).map((r) => r.contact)); } catch (e) { setError(String(e && e.message)); return; }
    const built = buildReviewPayload(rows, reviewState);
    saveSampleWorkspace(built);
    setSampleContacts(built); setRows(null); setPlan(null);
    setSummary({ sampleWorkspace: true, count: built.length });
  }, [sample, rows, reviewState]);

  const commitCorporate = useCallback(() => {
    if (mode !== MODES.CORPORATE) return;
    // Corporate import backend is dormant/fail-closed — NEVER writes, never enables a campaign,
    // occasion, schedule, queue, worker, gift, or send. Truthful gated state.
    setError("Organization import isn't available yet. Your selections are complete and will import once organization import is turned on.");
  }, [mode]);

  const backToTypeSelector = () => { setRecipientKind(null); setRows(null); setPlan(null); setSummary(null); setError(null); resetReview(true, null); };
  // START OVER (root-cause fix): the old handler reset rows/reviewState but never cleared `mode`,
  // `recipientKind`, or `sample`. The entry screen is gated on `!mode && !sample`, so Start Over could
  // never reach the Individual/Business selection — it fell through to the same mode's Upload screen
  // (and from a sample, a stuck mode-less-but-sample state). This clears ALL selection/parse/edit/
  // result state and returns to the selection screen. It does NOT delete a saved Sample Workspace —
  // that stays reachable and is only removed by the explicit "Delete all sample contacts".
  const startOver = () => {
    setMode(null); setRecipientKind(null); setMembershipResult(null); setSelectedOrgId(null);
    setSample(false); setSampleContacts([]); setRows(null); setPlan(null); setSummary(null);
    setError(null); setBusy(false); setReviewState(freshReviewState({ business: false, kind: null }));
  };
  const exitSample = () => { clearSampleWorkspace(); setSample(false); setSampleContacts([]); setMode(null); setRecipientKind(null); setRows(null); setPlan(null); setSummary(null); setError(null); };
  const deleteAllSample = exitSample;   // both clear the session-scoped sample data

  // ---------- render ----------
  // Session-scoped Sample Recipients (completed or resumed) — read-only presentation.
  if (sample && sampleContacts.length > 0 && !rows) {
    return <SampleRecipientsView contacts={sampleContacts} onDeleteAll={deleteAllSample} onExit={exitSample} onReturn={returnToRecipients} />;
  }
  // Canonical entry — EXACTLY two primary paths. Sample/template actions live inside each path.
  if (!mode && !sample) {
    return (
      <Shell>
        <h2 style={{ fontFamily: "Georgia,serif", fontSize: "1.1rem", margin: "0 0 12px" }}>How would you like to import?</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <button style={{ ...card, textAlign: "left", cursor: "pointer" }} onClick={() => pickMode(MODES.PERSONAL)}><b>Individual</b><div style={sub}>Import family, friends, and other people you personally want to remember.</div></button>
          <button style={{ ...card, textAlign: "left", cursor: "pointer" }} onClick={() => pickMode(MODES.CORPORATE)}><b>Business</b><div style={sub}>Import employees, clients, vendors, or a mixed organization list.</div></button>
        </div>
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
  const onCommit = sample ? commitSample : (business ? commitCorporate : commitPersonal);
  return (
    <Shell back={startOver}>
      {business && !sample && <div style={{ ...card, marginBottom: 12, fontSize: ".82rem" }}>Organization <b style={{ fontFamily: "monospace" }}>{orgId}</b>{kindLabel ? <> · <b>{kindLabel}</b></> : null}</div>}
      {sample && <SampleBanner />}
      {error && <div role="alert" style={{ ...card, borderColor: "rgba(214,69,69,.4)", background: "rgba(214,69,69,.08)", color: "#8a1f1f", marginBottom: 12 }}>{error}</div>}

      {/* Entry — CSV upload + downloadable sample CSV + "Try the sample" (inside every path). */}
      {!rows && !summary && (
        <div style={{ display: "grid", gap: 12 }}>
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

      {/* Upload lands DIRECTLY here — one plain-language Review surface, no defaults intermediary. */}
      {rows && !summary && (
        <ReviewScreen
          rows={rows} state={reviewState} setState={setReviewState}
          business={business} kindLabel={kindLabel} demo={sample} busy={busy}
          onCommit={onCommit} onStartOver={startOver}
        />
      )}

      {summary && !summary.sampleWorkspace && (
        <>
          <ImportSummary summary={summary} />
          {recipientKind
            ? <ListActions onPick={pickRecipientKind} onReturn={backToTypeSelector} onReturnRecipients={returnToRecipients} />
            : <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
                <button style={btn("transparent", "#1b1830")} onClick={startOver}>Start over</button>
                <button style={btn(PURPLE)} onClick={returnToRecipients}>Return to Recipients</button>
              </div>}
        </>
      )}
    </Shell>
  );
}

// ---- small presentational helpers ----
const sub = { fontSize: ".8rem", color: "#605c78", marginTop: 4 };
const muted = { color: "#605c78" };
const selStyle = { padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(27,24,48,.18)", fontSize: ".82rem", background: "#fff" };

function Shell({ children, back }) {
  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <header style={{ background: PURPLE, color: "#fff", borderRadius: 18, padding: "22px 24px", marginBottom: 18 }}>
        <div style={{ fontFamily: "monospace", fontSize: ".7rem", letterSpacing: ".14em", opacity: .85, textTransform: "uppercase" }}>Import</div>
        <h1 style={{ margin: "6px 0 0", fontSize: "1.5rem" }}>Contact Import Wizard</h1>
      </header>
      {back && <button style={{ ...btn("transparent", "#4a3fb0"), marginBottom: 12 }} onClick={back}>← Start over</button>}
      {children}
    </div>
  );
}
function Empty({ title, body }) {
  return <div style={{ ...card, textAlign: "center" }}><h3 style={{ margin: "0 0 6px", fontFamily: "Georgia,serif" }}>{title}</h3><p style={muted}>{body}</p></div>;
}
function ImportSummary({ summary }) {
  // "Email already exists" is not a failure to act on — surface it truthfully as already-present.
  const c = classifyImportSummary(summary);
  const parts = [`${c.added} added`];
  if (c.updated) parts.push(`${c.updated} updated`);
  if (c.skipped) parts.push(`${c.skipped} skipped`);
  if (c.alreadyPresent) parts.push(`${c.alreadyPresent} already in your recipients`);
  if (c.needsAttention) parts.push(`${c.needsAttention} needs attention`);
  return (
    <div style={{ ...card, textAlign: "center" }}>
      <div style={{ fontSize: "1.6rem" }}>✅</div>
      <h3 style={{ fontFamily: "Georgia,serif", margin: "6px 0" }}>Import complete</h3>
      <p style={muted}>{parts.join(" · ")}</p>
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

export function ReviewScreen({ rows, state, setState, business, kindLabel, demo, busy, onCommit, onStartOver }) {
  const review = buildReview(rows, state);
  const { buckets, counts, importCount, importEnabled } = review;
  const [view, setView] = useState("confirm");   // "confirm" | "details"
  const [seeAll, setSeeAll] = useState(false);
  const [confPage, setConfPage] = useState(0);
  const [detPage, setDetPage] = useState(0);

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
  const primaryLabel = demo
    ? `View ${importCount} sample recipient${importCount === 1 ? "" : "s"}`
    : busy ? "Adding…" : business
      ? `Continue with ${importCount} contact${importCount === 1 ? "" : "s"}`
      : `Add ${importCount} contact${importCount === 1 ? "" : "s"}`;

  const preview = seeAll
    ? paginate(buckets.ready, confPage, DETAILS_BATCH)
    : { slice: buckets.ready.slice(0, PREVIEW_N), pages: 1, page: 0, total: buckets.ready.length };

  return (
    <div data-testid="confirm-screen" style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <h2 style={{ margin: 0, fontFamily: "Georgia,serif", fontSize: "1.3rem" }}>{importCount > 0 ? "Your contacts are ready" : "Let's fix a couple of things"}</h2>
        {importCount > 0 && <div style={{ fontSize: "1.05rem", color: "#1f9d6b", fontWeight: 700, marginTop: 4 }}>{importCount} contact{importCount === 1 ? "" : "s"} ready to add</div>}
        <p style={{ ...sub, marginTop: 4 }}>Everything can be edited later.</p>
        <div style={{ display: "grid", gap: 2, marginTop: 2 }}>
          {counts.alreadyInList > 0 && <div style={sub}>{counts.alreadyInList} already in your list—we'll skip {counts.alreadyInList === 1 ? "it" : "them"}.</div>}
          {counts.willSkip > 0 && <div style={sub}>{counts.willSkip} won't be added.</div>}
        </div>
      </div>

      {/* Quick fix — genuine blockers only */}
      {blockers.length > 0 && (
        <div data-testid="quickfix" style={{ ...card, borderColor: "rgba(214,145,16,.45)" }}>
          <b style={{ fontSize: ".95rem" }}>{blockers.length} contact{blockers.length === 1 ? "" : "s"} need a quick fix before they can be added.</b>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {blockers.map((it) => <QuickFixRow key={it.index} it={it} on={on} />)}
          </div>
        </div>
      )}

      {/* Bounded preview of ready contacts */}
      {buckets.ready.length > 0 && (
        <div style={card}>
          <div style={{ ...rowStyle, marginBottom: 6 }}>
            <b style={{ fontSize: ".9rem" }}>{seeAll ? "All ready contacts" : "A quick look"}</b>
            {buckets.ready.length > PREVIEW_N && <button style={linkBtn} onClick={() => { setSeeAll((v) => !v); setConfPage(0); }}>{seeAll ? "Show less" : `See all ${buckets.ready.length}`}</button>}
          </div>
          <div style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
            {preview.slice.map((it, i) => <ReadyPreviewRow key={it.index} it={it} business={business} first={i === 0} onAddRelationship={openDetails} />)}
          </div>
          {seeAll && preview.pages > 1 && <Pager page={preview.page} pages={preview.pages} onPage={setConfPage} />}
        </div>
      )}

      {/* Actions — one clear primary */}
      <div style={{ ...rowStyle }}>
        <button data-testid="startover" style={btn("transparent", "#1b1830")} onClick={onStartOver}>Start over</button>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {counts.ready > 0 && <button data-testid="details-cta" style={btn("transparent", "#4a3fb0")} onClick={openDetails}>Add relationship details first</button>}
          <button data-testid="add-cta" style={btn(PURPLE)} disabled={busy || !importEnabled} onClick={onCommit}>{primaryLabel}</button>
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

// One row of the ready preview. Truthful about a missing relationship (Morgan Doe rule).
function ReadyPreviewRow({ it, business, first, onAddRelationship }) {
  const rel = business
    ? (it.audience ? (RECIPIENT_TYPE_OPTIONS.find((o) => o.value === it.audience) || {}).label || "" : "")
    : (it.relationProvided ? it.relationLabel : "Relationship not provided (optional)");
  return (
    <div style={{ ...rowStyle, padding: "8px 12px", borderTop: first ? "none" : "1px solid #f4f4f7", fontSize: ".82rem" }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}><b>{it.name}</b> <span style={{ color: "#605c78" }}>· {it.email}</span></span>
      <span style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <span style={{ color: (business || it.relationProvided) ? "#605c78" : "#a08a5a" }}>{it.birthday ? it.birthday + " · " : ""}{rel}</span>
        {!business && !it.relationProvided && <button style={linkBtn} onClick={onAddRelationship}>Add relationship</button>}
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

function ListActions({ onPick, onReturn, onReturnRecipients }) {
  return (
    <div style={{ ...card, marginTop: 12 }}>
      <b style={{ fontSize: ".85rem" }}>Import another list</b>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button style={btn("transparent", "#1b1830")} onClick={() => onPick("employee")}>Import Another Employee List</button>
        <button style={btn("transparent", "#1b1830")} onClick={() => onPick("client")}>Import Another Client List</button>
        <button style={btn("transparent", "#1b1830")} onClick={() => onPick("vendor")}>Import Another Vendor List</button>
        <button style={btn("transparent", "#1b1830")} onClick={() => onPick("mixed")}>Import a Mixed List</button>
        <button style={btn(PURPLE)} onClick={onReturn}>Return to Organization Contacts</button>
        <button style={btn("transparent", "#1b1830")} onClick={onReturnRecipients}>Return to Recipients</button>
      </div>
    </div>
  );
}
