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
import Papa from "papaparse";
import api from "../../api/api";
import { createCorporateCampaignsClient } from "../../api/corporateCampaigns.js";
import {
  checkFileLimits, checkRowCount, autoMapHeaders, processRow, detectDuplicates,
  buildPlan, looksLikeZip,
} from "../../import/importCore.js";
import { demoDataset, resetDemoData, assertNoRealMix } from "../../import/demoData.js";
import { MODES, corporateContext, commitDecision, existingEmailsFromResponse, classifyImportSummary, classifyCommitOutcome } from "./wizardModel.js";
import { RELATIONSHIP_CATEGORIES, RELATIONS_BY_CATEGORY, CLOSENESS_OPTIONS, ROW_STATE, buildCompletionSummary, buildCompletedImportContacts } from "../../import/completionModel.js";

const PURPLE = "linear-gradient(135deg,#6d74ee,#764ba2)";
const card = { background: "#fff", border: "1px solid rgba(27,24,48,.1)", borderRadius: 14, padding: 18 };
const btn = (bg, fg = "#fff") => ({ background: bg, color: fg, border: bg === "transparent" ? "1px solid rgba(27,24,48,.15)" : "none", borderRadius: 11, padding: "10px 16px", fontWeight: 700, fontSize: ".85rem", cursor: "pointer" });

export default function ContactImportWizard() {
  const client = useMemo(() => createCorporateCampaignsClient(), []);
  const [mode, setMode] = useState(null);
  const [membershipResult, setMembershipResult] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [demoConfirmedReal, setDemoConfirmedReal] = useState(false);
  const [rows, setRows] = useState(null);       // processed+deduped rows for preview
  const [plan, setPlan] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Personal adaptive-completion flow: preview → complete (fill missing) → review → commit.
  const [stage, setStage] = useState("preview");
  const [completion, setCompletion] = useState({ descriptionDefault: null, relationshipMappings: {}, rowOverrides: {} });
  const resetCompletion = () => { setStage("preview"); setCompletion({ descriptionDefault: null, relationshipMappings: {}, rowOverrides: {} }); };

  const ctx = useMemo(() => (mode === MODES.CORPORATE ? corporateContext(membershipResult, selectedOrgId) : null), [mode, membershipResult, selectedOrgId]);
  const orgId = ctx && ctx.selectedOrgId;

  const pickMode = useCallback(async (m) => {
    setMode(m); setRows(null); setPlan(null); setSummary(null); setError(null); setSelectedOrgId(null); setDemoConfirmedReal(false); resetCompletion();
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

  const decision = plan ? commitDecision(mode, plan, { orgId }) : { allowed: false, reason: "no_plan" };

  const commitPersonal = useCallback(async () => {
    if (mode !== MODES.PERSONAL) return;
    setBusy(true); setError(null);
    // Personal ownership: import into the authenticated user's own collection. Transmit every
    // recognized mapped field (incl. birthday) so the existing importer derives the manual-shape
    // occasion and it flows into contacts.occasions[] → scheduler like a manually-added recipient.
    const contacts = buildCompletedImportContacts(plan.toCreate, completion);
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
  }, [mode, plan, completion]);

  // ---------- render ----------
  if (!mode) {
    return (
      <Shell>
        <h2 style={{ fontFamily: "Georgia,serif", fontSize: "1.1rem", margin: "0 0 12px" }}>Who are you importing?</h2>
        <div style={{ display: "grid", gap: 12 }}>
          <button style={{ ...card, textAlign: "left", cursor: "pointer" }} onClick={() => pickMode(MODES.PERSONAL)}><b>Personal contacts</b><div style={sub}>Into your own recipient list. No organization needed.</div></button>
          <button style={{ ...card, textAlign: "left", cursor: "pointer" }} onClick={() => pickMode(MODES.CORPORATE)}><b>Corporate contacts</b><div style={sub}>Into your organization (requires an active membership).</div></button>
          <button style={{ ...card, textAlign: "left", cursor: "pointer" }} onClick={() => pickMode(MODES.DEMO)}><b>Corporate Learning Mode — Demo Data</b><div style={sub}>Explore with fictional employees/clients. Nothing is ever sent.</div></button>
        </div>
      </Shell>
    );
  }

  if (mode === MODES.CORPORATE) {
    if (busy && !membershipResult) return <Shell><p style={muted}>Loading your organizations…</p></Shell>;
    if (ctx.phase === "dormant") return null; // feature off → hidden
    if (ctx.phase === "unauthorized" || ctx.phase === "error") return <Shell back={() => setMode(null)}><p style={muted}>You don't have access to corporate import right now.</p></Shell>;
    if (ctx.phase === "no_org") return <Shell back={() => setMode(null)}><Empty title="No corporate organization" body="Your account isn't an active member of a corporate organization." /></Shell>;
    if (ctx.phase === "select_org") {
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
    // ready → fall through to import UI (org resolved)
  }

  if (mode === MODES.DEMO && !demoConfirmedReal) {
    return (
      <Shell back={() => setMode(null)}>
        <div style={{ ...card, borderColor: "rgba(214,145,16,.4)", background: "rgba(214,145,16,.08)" }}>
          <b>Demo Data — nothing is ever sent</b>
          <p style={{ fontSize: ".85rem", color: "#7a5410", margin: "6px 0 0" }}>
            Every record is fictional (reserved <code>example.com</code> domains). No email, SMS, greetings, gifts, animations, or notifications go out, and demo records never mix with your real contacts.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button style={btn(PURPLE)} onClick={() => loadDemo("employees")}>Load demo employees</button>
          <button style={btn(PURPLE)} onClick={() => loadDemo("clients")}>Load demo clients</button>
          <button style={btn("transparent", "#1b1830")} onClick={() => { setRows(resetDemoData("employees") && null); setPlan(null); }}>Reset Demo Data</button>
          <button style={btn("transparent", "#1b1830")} onClick={() => setMode(null)}>Exit Demo Mode</button>
        </div>
        {rows && <Preview rows={rows} plan={plan} demo />}
      </Shell>
    );
  }

  // Import UI (personal, corporate-ready, or demo-confirmed)
  return (
    <Shell back={() => setMode(null)}>
      {mode === MODES.CORPORATE && <div style={{ ...card, marginBottom: 12, fontSize: ".82rem" }}>Importing into organization <b style={{ fontFamily: "monospace" }}>{orgId}</b></div>}
      {error && <div role="alert" style={{ ...card, borderColor: "rgba(214,69,69,.4)", background: "rgba(214,69,69,.08)", color: "#8a1f1f", marginBottom: 12 }}>{error}</div>}
      {!rows && !summary && (
        <label style={{ ...card, display: "block", textAlign: "center", cursor: "pointer", borderStyle: "dashed" }}>
          <b>Choose a .csv file</b><div style={sub}>Up to 5 MB / 5,000 rows. Columns are auto-mapped; you'll preview before anything imports.</div>
          <input type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
        </label>
      )}
      {rows && !summary && mode === MODES.PERSONAL && (
        <PersonalCompletionFlow
          toCreate={plan.toCreate} skipped={plan.toSkip.length} invalid={plan.invalid.length}
          stage={stage} setStage={setStage} completion={completion} setCompletion={setCompletion}
          busy={busy} onCommit={commitPersonal}
        />
      )}
      {rows && !summary && mode !== MODES.PERSONAL && (
        <>
          <Preview rows={rows} plan={plan} demo={mode === MODES.DEMO} />
          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
            <button style={{ ...btn(PURPLE), opacity: decision.allowed ? 1 : .5 }} disabled={!decision.allowed || busy} onClick={commitPersonal}>
              {busy ? "Importing…" : `Import ${plan.toCreate.length} contact(s)`}
            </button>
            {!decision.allowed && <span style={{ fontSize: ".8rem", color: "#7a5410" }}>{commitReasonText(decision.reason)}</span>}
          </div>
        </>
      )}
      {summary && <ImportSummary summary={summary} />}
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
function Preview({ rows, plan, demo }) {
  const invalid = rows.filter((r) => !r.valid).length;
  const dups = rows.filter((r) => r.duplicate).length;
  return (
    <div style={card}>
      {demo && <div style={{ display: "inline-block", fontFamily: "monospace", fontSize: ".62rem", color: "#bd7a10", background: "rgba(214,145,16,.15)", border: "1px solid rgba(214,145,16,.4)", borderRadius: 6, padding: "2px 8px", marginBottom: 8 }}>DEMO DATA — NOT SENT</div>}
      <div style={{ fontSize: ".85rem", marginBottom: 8 }}>
        <b>{plan.toCreate.length}</b> to import · <b>{plan.toSkip.length}</b> duplicate(s) skipped · <b>{invalid}</b> invalid
      </div>
      <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid rgba(27,24,48,.08)", borderRadius: 10 }}>
        {rows.slice(0, 50).map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 12px", borderTop: i ? "1px solid #f1f2f6" : "none", fontSize: ".8rem" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.contact.fullName || "—"} · {r.contact.email || "—"}</span>
            <span style={{ flexShrink: 0, color: r.valid ? (r.duplicate ? "#bd7a10" : "#1f9d6b") : "#d64545" }}>
              {r.valid ? (r.duplicate || "ok") : r.errors.join(", ")}
            </span>
          </div>
        ))}
      </div>
      {dups + invalid > 0 && <p style={{ ...sub, marginTop: 8 }}>Only valid, non-duplicate rows are imported. Fix your file and re-upload to include the rest.</p>}
    </div>
  );
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
function commitReasonText(reason) {
  return ({
    demo_no_write: "Demo mode never writes real data.",
    nothing_to_import: "No valid, non-duplicate rows to import.",
    org_required: "Select an organization first.",
    corporate_endpoint_pending: "Corporate contact import endpoint is not yet available (backend pending).",
    no_plan: "",
  })[reason] || "";
}

// ============================================================================
// Personal adaptive-completion flow: preview → complete missing info → review → commit.
// Minimum CSV requirement is Name + valid email; everything else is completed here in bulk,
// never asking the same mapping question twice, and never guessing a description/closeness.
// ============================================================================
const selStyle = { padding: "7px 10px", borderRadius: 9, border: "1px solid rgba(27,24,48,.18)", fontSize: ".82rem", background: "#fff" };

function PersonalCompletionFlow({ toCreate, skipped, invalid, stage, setStage, completion, setCompletion, busy, onCommit }) {
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
      <CompletionStep cs={cs} completion={completion} setCompletion={setCompletion} />
      <FlowButtons
        left={<button style={btn("transparent", "#1b1830")} onClick={() => setStage("preview")}>← Back</button>}
        right={<button style={btn(PURPLE)} onClick={() => setStage("review")}>Review &amp; import →</button>} />
    </>);
  }
  return (<>
    <ReviewStep cs={cs} />
    <FlowButtons
      left={<button style={btn("transparent", "#1b1830")} disabled={busy} onClick={() => setStage("complete")}>← Back to details</button>}
      right={<button style={btn(PURPLE)} disabled={busy || n === 0} onClick={onCommit}>{busy ? "Importing…" : `Import ${n} contact(s)`}</button>} />
  </>);
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

function CompletionStep({ cs, completion, setCompletion }) {
  const [q, setQ] = useState("");
  const setDefault = (v) => setCompletion((c) => ({ ...c, descriptionDefault: v || null }));
  const setMapping = (key, category, relation) => setCompletion((c) => ({ ...c, relationshipMappings: { ...c.relationshipMappings, [key]: { category, relation } } }));
  const setOverride = (index, patch) => setCompletion((c) => ({ ...c, rowOverrides: { ...c.rowOverrides, [index]: { ...(c.rowOverrides[index] || {}), ...patch } } }));

  const unresolved = cs.rows.filter((r) => r.state === ROW_STATE.NEEDS_CHOICE);
  const t = q.trim().toLowerCase();
  const filtered = t ? unresolved.filter((r) => (r.raw || "").toLowerCase().includes(t) || String(r.index + 1).includes(t)) : unresolved;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <StateChips cs={cs} />

      <div style={card}>
        <b style={{ fontSize: ".9rem" }}>1 · Relationship description (applies to everyone)</b>
        <p style={sub}>Pick one default description for all imported recipients — override individuals below. This is never guessed.</p>
        <select value={completion.descriptionDefault || ""} onChange={(e) => setDefault(e.target.value)} style={selStyle}>
          <option value="">Select a default…</option>
          {CLOSENESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {cs.uniqueUnmappedValues.length > 0 && (
        <div style={card}>
          <b style={{ fontSize: ".9rem" }}>2 · Map unrecognized relationships ({cs.uniqueUnmappedValues.length})</b>
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
        <b style={{ fontSize: ".9rem" }}>3 · Individual exceptions {cs.unresolvedCount > 0 ? `— ${cs.unresolvedCount} unresolved` : "— all resolved"}</b>
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
function ReviewStep({ cs }) {
  const catLabel = (v) => (RELATIONSHIP_CATEGORIES.find((c) => c.value === v) || {}).label || "";
  const closeLabel = (v) => (CLOSENESS_OPTIONS.find((c) => c.value === v) || {}).label || "";
  return (
    <div style={{ ...card, display: "grid", gap: 12 }}>
      <b style={{ fontSize: ".9rem" }}>Final review · {cs.total} recipient(s)</b>
      <StateChips cs={cs} />
      {cs.unresolvedCount > 0 && <p style={{ ...sub, color: "#bd7a10" }}>{cs.unresolvedCount} recipient(s) will import without a complete relationship — finish them anytime in Edit Recipient. Nothing is guessed.</p>}
      <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid #eee", borderRadius: 10 }}>
        {cs.rows.map((r, i) => (
          <div key={r.index} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 12px", borderTop: i ? "1px solid #f4f4f7" : "none", fontSize: ".8rem" }}>
            <span style={{ flexShrink: 0 }}>Row {r.index + 1}</span>
            <span style={{ color: "#605c78", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.category ? `${catLabel(r.category)} · ${relLabel(r.category, r.relation)}` : "No relationship"}
              {r.closeness ? ` · ${closeLabel(r.closeness)}` : ""}
            </span>
            <StateBadge state={r.state} />
          </div>
        ))}
      </div>
    </div>
  );
}