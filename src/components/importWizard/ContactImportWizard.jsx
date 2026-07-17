// src/components/importWizard/ContactImportWizard.jsx
//
// TEAM A — Contact Import Wizard. One elegant surface for THREE contexts:
//   • Personal      → imports into the authenticated user's personal recipient collection.
//   • Corporate     → requires an active corporate membership (Phase A5 resolution); explicit
//                     organization selection when multiple; never treats the user id as an org id.
//   • Learning Demo → optional fictional employee/client data; clearly labeled, isolated, and
//                     send-safe (never emails/gifts/notifies; never mixes with real contacts).
// Heavy logic lives in the tested import core; this component orchestrates. It does NOT modify
// the locked Recipients page and adds no backend routes.

import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import api from "../../api/api";
import { createCorporateCampaignsClient } from "../../api/corporateCampaigns.js";
import {
  checkFileLimits, checkRowCount, autoMapHeaders, processRow, detectDuplicates,
  buildPlan, looksLikeZip,
} from "../../import/importCore.js";
import { demoDataset, assertNoRealMix } from "../../import/demoData.js";
import { MODES, corporateContext, corporateRoute, existingEmailsFromResponse, classifyImportSummary, classifyCommitOutcome } from "./wizardModel.js";
import { RELATIONSHIP_CATEGORIES, RELATIONS_BY_CATEGORY, CLOSENESS_OPTIONS, ROW_STATE, buildCompletionSummary, buildCompletedImportContacts } from "../../import/completionModel.js";
import { RECIPIENT_KINDS, RECIPIENT_TYPE_OPTIONS, resolveRecipientTypeForRow, buildRecipientTypeSummary, applyRecipientTypes } from "../../import/recipientTypeModel.js";

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
  const [rows, setRows] = useState(null);       // processed+deduped rows for preview
  const [plan, setPlan] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Adaptive-completion flow: preview → complete (fill missing) → review → commit.
  const [stage, setStage] = useState("preview");
  // Corporate/sample recipient TYPE selection (null = personal ownership, no type gate).
  const [recipientKind, setRecipientKind] = useState(null);
  // Greet-Me Worthy is the canonical default Description (import never carries a closeness column,
  // so it is always preselected; the user may change it). typeMappings/rowTypeOverrides drive the
  // Mixed-List recipient-type completion.
  const FRESH_COMPLETION = { descriptionDefault: "greetme_worthy", relationshipMappings: {}, rowOverrides: {}, typeMappings: {}, rowTypeOverrides: {} };
  const [completion, setCompletion] = useState(FRESH_COMPLETION);
  const resetCompletion = () => { setStage("preview"); setCompletion(FRESH_COMPLETION); };

  const ctx = useMemo(() => (mode === MODES.CORPORATE ? corporateContext(membershipResult, selectedOrgId) : null), [mode, membershipResult, selectedOrgId]);
  const orgId = ctx && ctx.selectedOrgId;

  const pickMode = useCallback(async (m) => {
    setMode(m); setRows(null); setPlan(null); setSummary(null); setError(null); setSelectedOrgId(null); setRecipientKind(null); resetCompletion();
    if (m === MODES.CORPORATE) {
      setBusy(true);
      const res = await client.listMemberships();
      setBusy(false);
      setMembershipResult(res);
    }
  }, [client]);

  function ingest(records, existingEmails = []) {
    const capped = checkRowCount(records.length);
    if (!capped.ok) { setError(`Too many rows (max ${capped.max}).`); return; }
    // Retain the raw row + mapping so the commit can transmit the birthday column (the processed
    // contact omits birthday — it's used only for the minor check inside the import core).
    const processed = records.map((r, i) => ({ ...processRow(r.__raw || r, r.__map || IDENTITY_MAP(records), { todayIso: undefined }), index: i, __raw: r.__raw || r, __map: r.__map || {} }));
    const deduped = detectDuplicates(processed, existingEmails);
    setRows(deduped);
    setPlan(buildPlan(deduped, { duplicateStrategy: "skip" }));
    resetCompletion();   // a fresh file starts the completion flow over
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
    // a duplicate (skipped) rather than entering toCreate and failing at commit. FAIL CLOSED — if
    // the lookup fails we do NOT proceed with an empty existing-email list (that would re-open the
    // preview↔commit mismatch). Corporate/demo do not dedup against the personal collection.
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
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (out) => {
        const headers = (out.meta && out.meta.fields) || [];
        const { mapping } = autoMapHeaders(headers);
        const data = (out.data || []).map((raw) => ({ __raw: raw, __map: mapping }));
        ingest(data, existingEmails);
      },
      error: () => setError("Could not parse the file."),
    });
  }, [mode]);

  const loadDemo = useCallback((kind) => {
    const ds = demoDataset(kind);          // tagged demo:true, reserved domains
    assertNoRealMix(ds);                    // never mixed with real records
    const processed = ds.map((c, i) => ({ contact: c, errors: [], warnings: [], valid: true, duplicate: null, index: i, demo: true }));
    setRows(processed);
    setPlan(buildPlan(processed, { duplicateStrategy: "skip" }));
  }, []);

  const commitPersonal = useCallback(async () => {
    if (mode !== MODES.PERSONAL) return;
    setBusy(true); setError(null);
    // Personal ownership: import into the authenticated user's own collection. Transmit every
    // recognized mapped field (incl. birthday) so the existing importer derives the manual-shape
    // occasion and it flows into contacts.occasions[] → scheduler like a manually-added recipient.
    // Build the completed payload, then stamp recipientType (single-type auto-apply; Mixed resolves
    // per row). Personal ownership keeps whatever the CSV carried.
    const contacts = applyRecipientTypes(
      buildCompletedImportContacts(plan.toCreate, completion),
      plan.toCreate,
      { kind: recipientKind, typeMappings: completion.typeMappings, rowTypeOverrides: completion.rowTypeOverrides },
    );
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
  }, [mode, plan, completion, recipientKind]);

  // recipientKind → sample dataset key.
  const DATASET_FOR_KIND = { personal: "personal", employee: "employees", client: "clients", vendor: "vendors", mixed: "mixed" };
  const pickRecipientKind = useCallback((kind) => {
    setRecipientKind(kind); setRows(null); setPlan(null); setSummary(null); setError(null); resetCompletion();
    if (mode === MODES.DEMO) loadDemo(DATASET_FOR_KIND[kind] || "employees");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, loadDemo]);

  const commitDemo = useCallback(() => {
    if (mode !== MODES.DEMO) return;
    // SAMPLE / DEMO NEVER writes: no api.importContacts, no corporate endpoint, no persistence,
    // no schedules / queues / greetings / gifts / deliveries. Re-assert isolation, then finish
    // with a "Sample complete" summary computed purely from local state.
    try { assertNoRealMix((rows || []).map((r) => r.contact)); } catch (e) { setError(String(e && e.message)); return; }
    setSummary({ demo: true, count: plan.toCreate.length });
  }, [mode, rows, plan]);

  const commitCorporate = useCallback(() => {
    if (mode !== MODES.CORPORATE) return;
    // Corporate import backend is dormant/fail-closed — NEVER writes, never enables a campaign,
    // occasion, schedule, queue, worker, gift, or send. Truthful gated state (no vague promises,
    // never implies data was saved).
    setError("Organization import isn't available yet. Your selections are complete and will import once organization import is turned on.");
  }, [mode]);

  const backToTypeSelector = () => { setRecipientKind(null); setRows(null); setPlan(null); setSummary(null); setError(null); resetCompletion(); };

  // ---------- render ----------
  if (!mode) {
    return (
      <Shell>
        <h2 style={{ fontFamily: "Georgia,serif", fontSize: "1.1rem", margin: "0 0 12px" }}>How would you like to import?</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <button style={{ ...card, textAlign: "left", cursor: "pointer" }} onClick={() => pickMode(MODES.PERSONAL)}><b>My Recipient List</b><div style={sub}>Import friends, family, colleagues, clients, and other people you personally want to remember.</div></button>
          <button style={{ ...card, textAlign: "left", cursor: "pointer" }} onClick={() => pickMode(MODES.CORPORATE)}><b>Organization Contacts</b><div style={sub}>Import employees, clients, vendors, departments, important dates, and other organization-managed recipient data.</div></button>
          <button style={{ ...card, textAlign: "left", cursor: "pointer" }} onClick={() => pickMode(MODES.DEMO)}><b>Try a Sample Import</b><div style={sub}>Explore the wizard using fictional contacts. Nothing is saved or sent.</div></button>
        </div>
      </Shell>
    );
  }

  if (mode === MODES.CORPORATE) {
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
            <button style={btn("transparent", "#1b1830")} onClick={() => pickMode(MODES.DEMO)}>Explore Sample Import</button>
            <button style={btn("transparent", "#1b1830")} onClick={returnToRecipients}>Return to Recipients</button>
          </div>
        </Shell>
      );
    }
    if (route === "ineligible") {
      // Authenticated but not an active org member → the existing Business/membership entry.
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

  // Recipient-type selector — authorized Organization Contacts, and Sample mode (which also lets
  // you sample the personal flow). Personal mode skips this (recipientKind stays null).
  if ((mode === MODES.CORPORATE || mode === MODES.DEMO) && !recipientKind) {
    const kinds = mode === MODES.DEMO
      ? [{ value: "personal", label: "My Recipient List", blurb: "Sample importing people into a personal recipient list." }, ...RECIPIENT_KINDS]
      : RECIPIENT_KINDS;
    return (
      <Shell back={() => setMode(null)}>
        {mode === MODES.DEMO && <SampleBanner />}
        <h3 style={{ margin: "0 0 4px", fontFamily: "Georgia,serif" }}>Who are you importing?</h3>
        <p style={{ ...sub, marginTop: 0 }}>{mode === MODES.DEMO ? "Pick a sample list to explore — nothing is ever saved or sent." : "Choose a recipient type. A single type is applied automatically — no type column required."}</p>
        <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
          {kinds.map((k) => (
            <button key={k.value} style={{ ...card, textAlign: "left", cursor: "pointer" }} onClick={() => pickRecipientKind(k.value)}>
              <b>{k.label}</b><div style={sub}>{k.blurb}</div>
            </button>
          ))}
        </div>
        <RecoveryActions onStartOver={() => setMode(null)} onReturn={returnToRecipients} />
      </Shell>
    );
  }

  // Import UI (My Recipient List, Organization Contacts [type chosen], or Try a Sample Import)
  const isDemo = mode === MODES.DEMO;
  const kindLabel = (RECIPIENT_KINDS.find((k) => k.value === recipientKind) || {}).label;
  const onCommit = isDemo ? commitDemo : (mode === MODES.CORPORATE ? commitCorporate : commitPersonal);
  return (
    <Shell back={() => setMode(null)}>
      {mode === MODES.CORPORATE && <div style={{ ...card, marginBottom: 12, fontSize: ".82rem" }}>Organization <b style={{ fontFamily: "monospace" }}>{orgId}</b>{kindLabel ? <> · <b>{kindLabel}</b></> : null}</div>}
      {isDemo && <SampleBanner />}
      {error && <div role="alert" style={{ ...card, borderColor: "rgba(214,69,69,.4)", background: "rgba(214,69,69,.08)", color: "#8a1f1f", marginBottom: 12 }}>{error}</div>}

      {/* Entry — CSV upload (demo loads its sample dataset when a type is picked) */}
      {!rows && !summary && (
        <label style={{ ...card, display: "block", textAlign: "center", cursor: "pointer", borderStyle: "dashed" }}>
          <b>Choose a .csv file{kindLabel ? ` · ${kindLabel}` : ""}</b><div style={sub}>Up to 5 MB / 5,000 rows. Only Name + a valid email are required. Columns are auto-mapped; you'll complete details before anything imports.</div>
          <input type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
        </label>
      )}

      {/* Adaptive completion flow — shared by personal, organization, and sample. */}
      {rows && !summary && (
        <PersonalCompletionFlow
          toCreate={plan.toCreate} skipped={plan.toSkip.length} invalid={plan.invalid.length}
          stage={stage} setStage={setStage} completion={completion} setCompletion={setCompletion}
          busy={busy} demo={isDemo} recipientKind={recipientKind} onCommit={onCommit}
        />
      )}

      {summary && summary.demo && (
        <DemoSummary count={summary.count}
          onStartOver={() => pickRecipientKind(recipientKind)}
          onTryAnother={backToTypeSelector}
          onReturnOptions={() => setMode(null)}
          onReturn={returnToRecipients} />
      )}
      {summary && !summary.demo && (
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
const IDENTITY_MAP = () => ({}); // demo/pre-processed rows carry their own map

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
// Personal adaptive-completion flow: preview → complete missing info → review → commit.
// Minimum CSV requirement is Name + valid email; everything else is completed here in bulk,
// never asking the same mapping question twice, and never guessing a description/closeness.
// ============================================================================
const selStyle = { padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(27,24,48,.18)", fontSize: ".82rem", background: "#fff" };

function PersonalCompletionFlow({ toCreate, skipped, invalid, stage, setStage, completion, setCompletion, busy, onCommit, demo = false, recipientKind = null }) {
  const cs = buildCompletionSummary(toCreate, completion);
  const n = toCreate.length;
  if (stage === "preview") {
    return (<>
      <PreviewLite toCreate={toCreate} skipped={skipped} invalid={invalid} cs={cs} />
      <FlowButtons right={<button style={btn(PURPLE)} disabled={n === 0} onClick={() => setStage("complete")}>Continue to details →</button>} />
    </>);
  }
  if (stage === "complete") {
    return (<>
      <CompletionStep cs={cs} completion={completion} setCompletion={setCompletion} toCreate={toCreate} recipientKind={recipientKind} />
      <FlowButtons
        left={<button style={btn("transparent", "#1b1830")} onClick={() => setStage("preview")}>← Back</button>}
        right={<button style={btn(PURPLE)} onClick={() => setStage("review")}>Review &amp; {demo ? "finish" : "import"} →</button>} />
    </>);
  }
  const finishLabel = demo ? `Finish sample (${n})` : (busy ? "Importing…" : `Import ${n} contact(s)`);
  return (<>
    <ReviewStep cs={cs} demo={demo} toCreate={toCreate} completion={completion} recipientKind={recipientKind} />
    <FlowButtons
      left={<button style={btn("transparent", "#1b1830")} disabled={busy} onClick={() => setStage("complete")}>← Back to details</button>}
      right={<button style={btn(PURPLE)} disabled={busy || n === 0} onClick={onCommit}>{finishLabel}</button>} />
  </>);
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

function DemoSummary({ count, onStartOver, onTryAnother, onReturnOptions, onReturn }) {
  return (
    <div style={{ ...card, textAlign: "center" }}>
      <div style={{ display: "inline-block", fontFamily: "monospace", fontSize: ".62rem", color: "#bd7a10", background: "rgba(214,145,16,.15)", border: "1px solid rgba(214,145,16,.4)", borderRadius: 6, padding: "2px 8px", marginBottom: 8 }}>SAMPLE — NOTHING WAS SAVED</div>
      <div style={{ fontSize: "1.6rem" }}>🧪</div>
      <h3 style={{ fontFamily: "Georgia,serif", margin: "6px 0" }}>Sample complete</h3>
      <p style={muted}>{count} sample recipient(s) were completed. Nothing was saved, sent, scheduled, or delivered.</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button style={btn(PURPLE)} onClick={onStartOver}>Start Over</button>
        <button style={btn("transparent", "#1b1830")} onClick={onTryAnother}>Try Another List Type</button>
        <button style={btn("transparent", "#1b1830")} onClick={onReturnOptions}>Return to Import Options</button>
        <button style={btn("transparent", "#1b1830")} onClick={onReturn}>Return to Recipients</button>
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

function FlowButtons({ left, right }) {
  return <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>{left || <span />}{right}</div>;
}

function StateChips({ cs }) {
  const chip = (label, count, c) => (
    <div style={{ ...card, padding: "10px 14px", flex: "1 1 150px", borderColor: c.b, background: c.bg }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: c.fg }}>{count}</div>
      <div style={{ fontSize: ".76rem", color: "#4a4663" }}>{label}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {chip("Ready", cs.counts.ready, { b: "rgba(31,157,107,.35)", bg: "rgba(31,157,107,.08)", fg: "#1f9d6b" })}
      {chip("Needs a quick choice", cs.counts.needs_choice, { b: "rgba(214,145,16,.4)", bg: "rgba(214,145,16,.1)", fg: "#bd7a10" })}
      {chip("Optional details missing", cs.counts.optional_missing, { b: "rgba(27,24,48,.14)", bg: "rgba(27,24,48,.03)", fg: "#605c78" })}
    </div>
  );
}

function PreviewLite({ toCreate, skipped, invalid, cs }) {
  return (
    <div style={{ ...card, display: "grid", gap: 12 }}>
      <div style={{ fontSize: ".85rem" }}><b>{toCreate.length}</b> to import · <b>{skipped}</b> already in your recipients (skipped) · <b>{invalid}</b> invalid</div>
      <StateChips cs={cs} />
      <p style={sub}>Only a Name and a valid email are required. Next you'll fill any missing relationship details in bulk — you won't be asked the same question twice, and nothing is guessed.</p>
    </div>
  );
}

function TypeRelationPicker({ value = {}, onChange }) {
  const category = value.category || "", relation = value.relation || "";
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <select value={category} onChange={(e) => onChange(e.target.value, "")} style={selStyle}>
        <option value="">Type…</option>
        {RELATIONSHIP_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      <select value={relation} onChange={(e) => onChange(category, e.target.value)} disabled={!category} style={selStyle}>
        <option value="">Relation…</option>
        {(RELATIONS_BY_CATEGORY[category] || []).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
    </div>
  );
}

function CompletionStep({ cs, completion, setCompletion, toCreate = [], recipientKind = null }) {
  const [q, setQ] = useState("");
  const setDefault = (v) => setCompletion((c) => ({ ...c, descriptionDefault: v || null }));
  const setMapping = (key, category, relation) => setCompletion((c) => ({ ...c, relationshipMappings: { ...c.relationshipMappings, [key]: { category, relation } } }));
  const setOverride = (index, patch) => setCompletion((c) => ({ ...c, rowOverrides: { ...c.rowOverrides, [index]: { ...(c.rowOverrides[index] || {}), ...patch } } }));
  const setTypeMapping = (key, type) => setCompletion((c) => ({ ...c, typeMappings: { ...c.typeMappings, [key]: type } }));
  const setRowType = (index, type) => setCompletion((c) => ({ ...c, rowTypeOverrides: { ...c.rowTypeOverrides, [index]: type } }));

  const typeState = { kind: recipientKind, typeMappings: completion.typeMappings, rowTypeOverrides: completion.rowTypeOverrides };
  const tsum = buildRecipientTypeSummary(toCreate, typeState);
  const showTypeMap = recipientKind === "mixed" && tsum.uniqueUnknownTypes.length > 0;
  const showRelMap = cs.uniqueUnmappedValues.length > 0;

  const unresolved = cs.rows.filter((r) => r.state === ROW_STATE.NEEDS_CHOICE);
  const t = q.trim().toLowerCase();
  const filtered = t ? unresolved.filter((r) => (r.raw || "").toLowerCase().includes(t) || String(r.index + 1).includes(t)) : unresolved;

  // Sequential section numbering — sections show/hide but numbers stay 1, 2, 3, …
  let n = 0; const num = () => ++n;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <StateChips cs={cs} />

      {showTypeMap && (
        <div style={card}>
          <b style={{ fontSize: ".9rem" }}>{num()} · Map recipient types ({tsum.uniqueUnknownTypes.length})</b>
          <p style={sub}>This mixed list has recipient types we don't recognize. Set each once — recognized values (employee/client/vendor) are applied automatically; unknown values are never guessed.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {tsum.uniqueUnknownTypes.map((u) => (
              <div key={u.key} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "monospace", fontSize: ".8rem", minWidth: 130 }}>“{u.raw}” <span style={{ color: "#605c78" }}>×{u.count}</span></span>
                <select value={completion.typeMappings[u.key] || ""} onChange={(e) => setTypeMapping(u.key, e.target.value)} style={selStyle}>
                  <option value="">Recipient type…</option>
                  {RECIPIENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={card}>
        <b style={{ fontSize: ".9rem" }}>{num()} · Relationship description (applies to everyone)</b>
        <p style={sub}>One default description for all imported recipients — override individuals below. This is never guessed.</p>
        <select value={completion.descriptionDefault || ""} onChange={(e) => setDefault(e.target.value)} style={selStyle}>
          <option value="">Select a default…</option>
          {CLOSENESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {showRelMap && (
        <div style={card}>
          <b style={{ fontSize: ".9rem" }}>{num()} · Map unrecognized relationships ({cs.uniqueUnmappedValues.length})</b>
          <p style={sub}>Set each unique value once — it applies to every matching contact.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {cs.uniqueUnmappedValues.map((u) => (
              <div key={u.key} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "monospace", fontSize: ".8rem", minWidth: 130 }}>“{u.raw}” <span style={{ color: "#605c78" }}>×{u.count}</span></span>
                <TypeRelationPicker value={completion.relationshipMappings[u.key]} onChange={(cat, rel) => setMapping(u.key, cat, rel)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={card}>
        <b style={{ fontSize: ".9rem" }}>{num()} · Individual exceptions {cs.unresolvedCount > 0 ? `— ${cs.unresolvedCount} unresolved` : "— all resolved"}</b>
        <input placeholder="Search unresolved by value or row #…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...selStyle, marginTop: 6, width: "100%" }} />
        <div style={{ maxHeight: 240, overflow: "auto", marginTop: 8, display: "grid", gap: 8 }}>
          {filtered.length === 0 && <p style={sub}>{cs.unresolvedCount === 0 ? "Everything is resolved — ready to review." : "No unresolved rows match your search."}</p>}
          {filtered.map((r) => {
            const ov = completion.rowOverrides[r.index] || {};
            return (
              <div key={r.index} style={{ border: "1px solid #eee", borderRadius: 10, padding: 8, display: "grid", gap: 6 }}>
                <div style={{ fontSize: ".8rem" }}>Row {r.index + 1} · raw “{r.raw || "—"}”</div>
                <TypeRelationPicker value={{ category: r.category, relation: r.relation }} onChange={(cat, rel) => setOverride(r.index, { category: cat, relation: rel })} />
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <select value={ov.closeness || ""} onChange={(e) => setOverride(r.index, { closeness: e.target.value })} style={selStyle}>
                    <option value="">Description (use default)…</option>
                    {CLOSENESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {recipientKind === "mixed" && (
                    <select value={completion.rowTypeOverrides[r.index] || ""} onChange={(e) => setRowType(r.index, e.target.value)} style={selStyle}>
                      <option value="">Recipient type…</option>
                      {RECIPIENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                  <label style={{ fontSize: ".76rem", display: "flex", gap: 4, alignItems: "center" }}>
                    <input type="checkbox" checked={!!ov.skipRelationship} onChange={(e) => setOverride(r.index, { skipRelationship: e.target.checked })} /> Import without a relationship
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function relLabel(category, relation) {
  return ((RELATIONS_BY_CATEGORY[category] || []).find((r) => r.value === relation) || {}).label || "—";
}
function StateBadge({ state }) {
  const m = {
    [ROW_STATE.READY]: { t: "Ready", c: "#1f9d6b" },
    [ROW_STATE.NEEDS_CHOICE]: { t: "Needs choice", c: "#bd7a10" },
    [ROW_STATE.OPTIONAL_MISSING]: { t: "Optional", c: "#605c78" },
  }[state] || { t: state, c: "#605c78" };
  return <span style={{ fontSize: ".7rem", color: m.c, fontWeight: 700, flexShrink: 0 }}>{m.t}</span>;
}
function ReviewStep({ cs, demo = false, toCreate = [], completion = {}, recipientKind = null }) {
  const catLabel = (v) => (RELATIONSHIP_CATEGORIES.find((c) => c.value === v) || {}).label || "";
  const closeLabel = (v) => (CLOSENESS_OPTIONS.find((c) => c.value === v) || {}).label || "";
  const typeLabel = (v) => (RECIPIENT_TYPE_OPTIONS.find((o) => o.value === v) || {}).label || "";
  const kindLabel = (RECIPIENT_KINDS.find((k) => k.value === recipientKind) || {}).label;
  const typeState = { kind: recipientKind, typeMappings: completion.typeMappings, rowTypeOverrides: completion.rowTypeOverrides };
  const showType = recipientKind && recipientKind !== "personal";
  return (
    <div style={{ ...card, display: "grid", gap: 12 }}>
      <b style={{ fontSize: ".9rem" }}>{demo ? "Sample review" : "Final review"} · {cs.total} recipient(s){kindLabel && showType ? ` · ${kindLabel}` : ""}</b>
      <StateChips cs={cs} />
      {cs.unresolvedCount > 0 && <p style={{ ...sub, color: "#bd7a10" }}>{cs.unresolvedCount} recipient(s) {demo ? "would import" : "will import"} without a complete relationship — {demo ? "this is only a sample." : "finish them anytime in Edit Recipient."} Nothing is guessed.</p>}
      <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid #eee", borderRadius: 10 }}>
        {cs.rows.map((r, i) => {
          const rt = showType ? resolveRecipientTypeForRow(toCreate[i], typeState) : "";
          return (
            <div key={r.index} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 12px", borderTop: i ? "1px solid #f4f4f7" : "none", fontSize: ".8rem" }}>
              <span style={{ flexShrink: 0 }}>Row {r.index + 1}{showType ? ` · ${rt ? typeLabel(rt) : "type unset"}` : ""}</span>
              <span style={{ color: "#605c78", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.category ? `${catLabel(r.category)} · ${relLabel(r.category, r.relation)}` : "No relationship"}
                {r.closeness ? ` · ${closeLabel(r.closeness)}` : ""}
              </span>
              <StateBadge state={r.state} />
            </div>
          );
        })}
      </div>
    </div>
  );
}