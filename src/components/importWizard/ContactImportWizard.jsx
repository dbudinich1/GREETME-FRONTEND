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
  buildReview, buildReviewPayload, freshReviewState,
  setGroup, setRelation, setCloseness, setName, setEmail, leaveRelationshipBlank,
  chooseAudience, skipContact, applyToAllMatching, bulkRelationshipGroups,
  nextCard, prevCard, relationsForGroup, AUDIENCE_CHOICES, REVIEW_STATUS, relationLabelFor,
} from "../../import/reviewModel.js";
import { sampleContactsFor, sampleCsvFor, loadSampleWorkspace, saveSampleWorkspace, clearSampleWorkspace } from "../../import/sampleWorkspace.js";

const PURPLE = "linear-gradient(135deg,#6d74ee,#764ba2)";
const card = { background: "#fff", border: "1px solid rgba(27,24,48,.1)", borderRadius: 14, padding: 18 };
const btn = (bg, fg = "#fff") => ({ background: bg, color: fg, border: bg === "transparent" ? "1px solid rgba(27,24,48,.15)" : "none", borderRadius: 11, padding: "10px 16px", fontWeight: 700, fontSize: ".85rem", cursor: "pointer" });

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
  const resetReview = (business, kind) => setReviewState(freshReviewState({ business, kind }));

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
    // Retain the raw row + mapping so the commit can transmit the birthday column (the processed
    // contact omits birthday — it's used only for the minor check inside the import core).
    const processed = records.map((r, i) => ({ ...processRow(r.__raw || r, r.__map || {}, { todayIso: undefined }), index: i, __raw: r.__raw || r, __map: r.__map || {} }));
    const deduped = detectDuplicates(processed, existingEmails);
    setRows(deduped);                                   // Review shows EVERY row (ready/duplicate/invalid)
    setPlan(buildPlan(deduped, { duplicateStrategy: "skip" }));
    resetReview(business, kind);                        // a fresh file starts Review clean
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
    resetReview(business, rk);
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
  const startOver = () => { setRows(null); setPlan(null); setSummary(null); setError(null); resetReview(mode === MODES.CORPORATE, recipientKind); };
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
    if ((busy && !membershipResult) || route === "loading") return <Shell back={() => setMode(null)}><p style={muted}>Checking your organization eligibility…</p></Shell>;
    if (route === "dormant") {
      // Authorized-but-dormant corporate backend — a TRUTHFUL, usable gated state (never a blank
      // screen, no vague future promise, never implies data was saved).
      return (
        <Shell back={() => setMode(null)}>
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
        <Shell back={() => setMode(null)}>
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
        <Shell back={() => setMode(null)}>
          <Empty title="We couldn't check your organization" body="Something went wrong resolving your organization. Please try again." />
          <RecoveryActions onStartOver={() => setMode(null)} onReturn={returnToRecipients} />
        </Shell>
      );
    }
    if (route === "select_org") {
      return (
        <Shell back={() => setMode(null)}>
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
      <Shell back={() => setMode(null)}>
        <h3 style={{ margin: "0 0 4px", fontFamily: "Georgia,serif" }}>Who are you importing?</h3>
        <p style={{ ...sub, marginTop: 0 }}>A single type is applied automatically — no type column required. Universal List maps a mixed file.</p>
        <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
          {RECIPIENT_KINDS.map((k) => (
            <button key={k.value} style={{ ...card, textAlign: "left", cursor: "pointer" }} onClick={() => pickRecipientKind(k.value)}>
              <b>{k.value === "employee" ? "Employees / Personnel" : k.label}</b><div style={sub}>{k.blurb}</div>
            </button>
          ))}
        </div>
        <RecoveryActions onStartOver={() => setMode(null)} onReturn={returnToRecipients} />
      </Shell>
    );
  }

  // Import UI — Individual, Business (type chosen), or an active Sample.
  const business = mode === MODES.CORPORATE;
  const kindLabel = (RECIPIENT_KINDS.find((k) => k.value === recipientKind) || {}).label;
  const templateKind = business ? (recipientKind || "employee") : "individual";
  const onCommit = sample ? commitSample : (business ? commitCorporate : commitPersonal);
  return (
    <Shell back={() => setMode(null)}>
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
          skipped={plan ? plan.toSkip.length : 0} onCommit={onCommit} onStartOver={startOver}
        />
      )}

      {summary && !summary.sampleWorkspace && (
        <>
          <ImportSummary summary={summary} />
          {recipientKind
            ? <ListActions onPick={pickRecipientKind} onReturn={backToTypeSelector} onReturnRecipients={returnToRecipients} />
            : <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
                <button style={btn("transparent", "#1b1830")} onClick={() => setMode(null)}>Start over</button>
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
// ReviewScreen — plain-language LINEAR reconciliation. Attention contacts are walked one card at a
// time (Back / Save & next / Skip / Leave blank), each card carrying the three canonical relationship
// controls. Ready contacts live in a collapsed section below. A resolved card is NEVER unmounted just
// because its status flipped — the attention order is frozen and control values read from state.
// ============================================================================
export function ReviewScreen({ rows, state, setState, business, kindLabel, demo, busy, skipped = 0, onCommit, onStartOver }) {
  const review = buildReview(rows, state);
  const { attention, readySection, summary, importCount, importEnabled } = review;
  const [nav, setNav] = useState(0);
  const [showReady, setShowReady] = useState(false);
  const bulkGroups = bulkRelationshipGroups(rows, state);

  const total = attention.length;
  const active = nav < total ? attention[nav] : null;
  const primary = demo
    ? `View ${importCount} sample recipient${importCount === 1 ? "" : "s"}`
    : (busy ? "Importing…" : (business ? `Continue with ${importCount} contact${importCount === 1 ? "" : "s"}` : `Import ${importCount} contact${importCount === 1 ? "" : "s"}`));

  // per-card dispatchers (bound to the active card's original index)
  const disp = active && {
    name: (v) => setState((s) => setName(s, active.index, v)),
    email: (v) => setState((s) => setEmail(s, active.index, v)),
    group: (v) => setState((s) => setGroup(s, active.index, v)),
    relation: (v) => setState((s) => setRelation(s, active.index, v)),
    closeness: (v) => setState((s) => setCloseness(s, active.index, v)),
    audience: (v) => setState((s) => chooseAudience(s, active.index, v)),
    leaveBlank: () => setState((s) => leaveRelationshipBlank(s, active.index)),
    skip: () => { setState((s) => skipContact(s, active.index)); setNav((n) => nextCard(n, total)); },
    applyAll: (raw, sel) => setState((s) => applyToAllMatching(s, rows, raw, sel)),
  };
  const activeBulk = active ? bulkGroups.find((g) => g.indices.includes(active.index)) : null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <TopSummary summary={summary} skipped={skipped} />

      {active ? (
        <AttentionCard
          key={active.index} it={active} business={business}
          progress={{ n: nav + 1, total }} bulk={activeBulk} disp={disp}
          canBack={nav > 0} onBack={() => setNav(prevCard)} onSaveNext={() => setNav((n) => nextCard(n, total))}
        />
      ) : total > 0 ? (
        <div style={{ ...card, textAlign: "center" }}>
          <b style={{ fontFamily: "Georgia,serif" }}>You've reviewed every highlighted contact.</b>
          <div style={sub}>Import below, or reopen a contact from the ready list to make changes.</div>
        </div>
      ) : (
        <div style={{ ...card, textAlign: "center" }}>
          <b style={{ fontFamily: "Georgia,serif" }}>Nothing needs your attention.</b>
          <div style={sub}>Safe defaults were applied. Import below, or review the ready contacts first.</div>
        </div>
      )}

      <ReadySection items={readySection} open={showReady} onToggle={() => setShowReady((v) => !v)} business={business} setState={setState} />

      <FinalSummary summary={summary} skipped={skipped} importCount={importCount} />

      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <button style={btn("transparent", "#1b1830")} onClick={onStartOver}>Start over</button>
        <button style={btn(PURPLE)} disabled={busy || !importEnabled} onClick={onCommit}>{primary}</button>
      </div>
    </div>
  );
}

// Top: "X contacts need your attention" + supporting copy + the plain breakdown.
function TopSummary({ summary, skipped = 0 }) {
  const alreadyPresent = summary.duplicate + skipped;
  const line = (text, color) => <div style={{ fontSize: ".85rem", color }}>{text}</div>;
  return (
    <div style={{ ...card, display: "grid", gap: 6 }}>
      <h2 style={{ margin: 0, fontFamily: "Georgia,serif", fontSize: "1.15rem" }}>{summary.needAttention} contact{summary.needAttention === 1 ? "" : "s"} need your attention</h2>
      <p style={{ ...sub, marginTop: 0 }}>Review the highlighted contacts below. We filled in safe defaults where possible, and you can change them.</p>
      <div style={{ display: "grid", gap: 3, marginTop: 2 }}>
        {line(`${summary.ready} ready to import`, "#1f9d6b")}
        {summary.willSkip > 0 && line(`${summary.willSkip} will be skipped`, "#605c78")}
        {alreadyPresent > 0 && line(`${alreadyPresent} already in your recipients`, "#605c78")}
      </div>
    </div>
  );
}

// Final state — reflects the actual import outcome.
function FinalSummary({ summary, skipped = 0, importCount }) {
  const alreadyPresent = summary.duplicate + skipped;
  const line = (text, color) => <div style={{ fontSize: ".85rem", color }}>{text}</div>;
  return (
    <div style={{ ...card, display: "grid", gap: 3 }}>
      {line(`${importCount} ready to import`, "#1f9d6b")}
      {summary.willSkip > 0 && line(`${summary.willSkip} skipped`, "#605c78")}
      {alreadyPresent > 0 && line(`${alreadyPresent} already present`, "#605c78")}
      {summary.needsChoice > 0 && line(`${summary.needsChoice} still need a required choice`, "#bd7a10")}
      {summary.needsFix > 0 && line(`${summary.needsFix} still need a name or a valid email`, "#605c78")}
    </div>
  );
}

// The active attention card. All three relationship controls are ALWAYS visible; name/email become
// editable fields when they need fixing; a Universal unknown audience adds one required control above.
function AttentionCard({ it, business, progress, bulk, disp, canBack, onBack, onSaveNext }) {
  const needsName = it.status === REVIEW_STATUS.NEEDS_NAME;
  const needsEmail = it.status === REVIEW_STATUS.NEEDS_EMAIL;
  const universalUnknown = business && it.audienceState === "needs_audience";
  return (
    <div data-testid="attention-card" style={{ ...card, display: "grid", gap: 12, borderColor: "rgba(214,145,16,.45)" }}>
      <div style={{ fontSize: ".74rem", color: "#605c78", fontWeight: 700 }}>Contact {progress.n} of {progress.total} needing review</div>

      {/* Identity — editable when it needs fixing */}
      <div style={{ display: "grid", gap: 6 }}>
        {needsName || it.name === "" ? (
          <label style={{ display: "grid", gap: 3 }}>
            <span style={{ fontSize: ".76rem", color: "#4a4663" }}>Name</span>
            <input data-testid="name-input" value={it.name} onChange={(e) => disp.name(e.target.value)} style={{ ...selStyle, width: "100%" }} placeholder="Full name" />
            {needsName && <span style={{ fontSize: ".74rem", color: "#c0392b" }}>Enter a name.</span>}
          </label>
        ) : <b style={{ fontSize: "1rem" }}>{it.name}</b>}
        {needsEmail ? (
          <label style={{ display: "grid", gap: 3 }}>
            <span style={{ fontSize: ".76rem", color: "#4a4663" }}>Email</span>
            <input data-testid="email-input" value={it.email} onChange={(e) => disp.email(e.target.value)} style={{ ...selStyle, width: "100%" }} placeholder="name@example.com" />
            <span style={{ fontSize: ".74rem", color: "#c0392b" }}>Enter a valid email address.</span>
          </label>
        ) : <div style={sub}>{it.email || "—"}</div>}
        {it.birthday && <div style={sub}>Birthday: {it.birthday}</div>}
      </div>

      {/* Original raw relationship note (unrecognized) */}
      {it.relationUnrecognizedRaw && (
        <div style={{ fontSize: ".8rem", color: "#7a5410" }}>
          Original relationship: “{it.rawRel}”. We didn't recognize this relationship. Review the selections below or leave it blank.
        </div>
      )}

      {/* Universal-List required audience — ABOVE the relationship controls */}
      {business && (it.audienceState === "needs_audience" || it.audienceState === "chosen") && (
        <AudienceControl it={it} onChange={disp.audience} />
      )}

      {/* The three canonical relationship controls — ALWAYS visible */}
      <RelationshipControls it={it} disp={disp} />

      {/* Apply-to-all convenience for a shared unknown raw value (opt-in) */}
      {bulk && bulk.count > 1 && (it.group || it.relation) && (
        <button data-testid="apply-all" style={{ ...btn("transparent", "#4a3fb0"), fontSize: ".78rem" }}
          onClick={() => disp.applyAll(bulk.raw, { group: it.group, relation: it.relation, closeness: it.closeness })}>
          Apply these selections to all {bulk.count} contacts labeled “{bulk.raw}”
        </button>
      )}

      {/* Card actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <button style={btn("transparent", "#1b1830")} disabled={!canBack} onClick={onBack}>← Back</button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!business && <button style={btn("transparent", "#1b1830")} onClick={disp.leaveBlank}>Leave relationship blank</button>}
          <button style={btn("transparent", "#8a1f1f")} onClick={disp.skip}>Skip this contact</button>
          <button data-testid="save-next" style={btn(PURPLE)} disabled={universalUnknown} onClick={onSaveNext}>Save &amp; next →</button>
        </div>
      </div>
    </div>
  );
}

// The three plain-language relationship controls (exact labels), always rendered together.
function RelationshipControls({ it, disp }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ display: "grid", gap: 3 }}>
        <span style={{ fontSize: ".76rem", color: "#4a4663" }}>Relationship group</span>
        <select data-testid="group-select" value={it.group} onChange={(e) => disp.group(e.target.value)} style={{ ...selStyle, minWidth: 220 }}>
          <option value="">Select a group</option>
          {RELATIONSHIP_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
      <label style={{ display: "grid", gap: 3 }}>
        <span style={{ fontSize: ".76rem", color: "#4a4663" }}>Relationship</span>
        <select data-testid="relation-select" value={it.relation} disabled={!it.group} onChange={(e) => disp.relation(e.target.value)} style={{ ...selStyle, minWidth: 220 }}>
          <option value="">Select relationship</option>
          {relationsForGroup(it.group).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>
      <label style={{ display: "grid", gap: 3 }}>
        <span style={{ fontSize: ".76rem", color: "#4a4663" }}>How close are you?</span>
        <select data-testid="closeness-select" value={it.closeness} onChange={(e) => disp.closeness(e.target.value)} style={{ ...selStyle, minWidth: 220 }}>
          {CLOSENESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    </div>
  );
}

// Universal-List audience — plain language, no recipientType terminology.
function AudienceControl({ it, onChange }) {
  return (
    <label style={{ display: "grid", gap: 3 }}>
      <span style={{ fontSize: ".76rem", color: "#7a5410" }}>Which group does this contact belong to? We couldn't tell whether this contact is an employee, client, or vendor.</span>
      <select data-testid="audience-select" value={(it.audienceState === "chosen" && it.audience) || ""} onChange={(e) => onChange(e.target.value)} style={{ ...selStyle, minWidth: 220 }}>
        <option value="">Choose…</option>
        {AUDIENCE_CHOICES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
      </select>
    </label>
  );
}

// Collapsed "X contacts are ready" — expand to see & edit the same three values. Never forced.
function ReadySection({ items, open, onToggle, business, setState }) {
  if (!items.length) return null;
  return (
    <div style={{ ...card, padding: 14 }}>
      <button style={{ ...btn("transparent", "#1f7a57"), fontSize: ".82rem" }} onClick={onToggle}>
        {open ? "▾" : "▸"} {items.length} contact{items.length === 1 ? "" : "s"} {items.length === 1 ? "is" : "are"} ready
      </button>
      {open && (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {items.map((it) => (
            <div key={it.index} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <b style={{ fontSize: ".9rem" }}>{it.name}</b>
                <span style={sub}>{it.email}{business && it.audience ? ` · ${(RECIPIENT_TYPE_OPTIONS.find((o) => o.value === it.audience) || {}).label || it.audience}` : ""}</span>
              </div>
              <RelationshipControls it={it} disp={{
                group: (v) => setState((s) => setGroup(s, it.index, v)),
                relation: (v) => setState((s) => setRelation(s, it.index, v)),
                closeness: (v) => setState((s) => setCloseness(s, it.index, v)),
              }} />
            </div>
          ))}
        </div>
      )}
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
