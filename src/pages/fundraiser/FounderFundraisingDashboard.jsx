// src/pages/fundraiser/FounderFundraisingDashboard.jsx
//
// Founder fundraising administration — the APPROVED rev 6 layout (Report 77 rev 6, Report 87 A7).
// Partners overview · Register a partner (saved, not active) · the partner's page (Overview: activation,
// relationship, partner share; Campaigns; Reports & Analytics).
//
// Every figure comes from the backend, which enforces founder-only access server-side; no client role
// grants anything. The review preview's SAMPLE example panels and change tags are NOT part of this
// product screen. Payouts stay manual: there is no pay or payout control here. Dark while the
// fundraiser gate is off (no request is made).
import { useCallback, useEffect, useState } from "react";
import { fundraiserApi, stateFor } from "../../api/fundraiserApi.js";
import { isFundraiserUiEnabled } from "../../config/fundraiserGate.js";
import { pageWrap, box, h, btn, btnGhost, Stat, StateView, Empty } from "./FundraiserUI.jsx";
import Chip from "./FundraiserChip.jsx";
import { STATES, resolveOutcome, assignOutcome, messageFor, canAssign, isAssigned } from "./partnerAdminAssign.js";
import { payoutOnlyLine } from "./partnerEarningsCopy.js";
// Held org-salesperson field (eb9e450): the existing founder-only salesperson client.
import { salesAdminApi } from "../../api/salesAdmin.js";
import {
  money, isoDate, validateYearRates, buildYearRatesRule, dateToUtcInstant, termsLine,
  activeTermsFromHistories, partnerTermsRules, createdWithoutTerms, countsByCampaign, pendingTermsComplete, partnerStatus, lastEndedInterval, failureText, totalsByKey, quarterlyRows, BRANDED_GOODS_NOT_CALCULATED,
} from "./fundraiserP1Model.js";

const input = { padding: 8, borderRadius: 6, border: "1px solid #d8cdbb", font: "inherit", boxSizing: "border-box" };
const label = { display: "block", fontSize: ".85rem", fontWeight: 700, margin: "0 0 4px" };
const help = { fontSize: ".8rem", color: "#5b4f42", margin: "4px 0 0" };
const scrollX = { overflowX: "auto" };
const table = { width: "100%", borderCollapse: "collapse", minWidth: 520 };
const th = { textAlign: "left", color: "#8a7c6c", fontSize: 13, padding: "0 8px 6px 0", fontWeight: 600 };
const td = { padding: "8px 8px 8px 0", borderTop: "1px solid #f0ebe3", verticalAlign: "top" };
const err = { color: "#b00", fontSize: ".8rem", margin: "4px 0 0" };

const ORG_TYPES = [["school", "School"], ["athletic", "Athletic"], ["youth", "Youth"], ["community", "Community"], ["nonprofit", "Nonprofit"], ["other", "Other"]];
const typeLabel = (v) => (ORG_TYPES.find(([k]) => k === v) || [v, v ? String(v) : "—"])[1];

// Treatments: copied from the backend validator (economicsState.js TREATMENT_ENUMS). The server still
// requires every one to be chosen before terms can be approved; nothing is preselected here.
const TREATMENTS = Object.freeze({
  onboardingFeeTreatment: ["excluded_retained", "excluded_waived"],
  veteransContributionTreatment: ["excluded", "contribute_from_platform_share_only"],
  discountTreatment: ["ineligible", "eligible_on_net", "eligible_on_gross"],
  taxTreatment: ["excluded_from_base"],
  processorFeeTreatment: ["net_of_processor", "gross_absorbed_by_platform"],
});
const TREATMENT_FIELD_LABELS = Object.freeze({
  onboardingFeeTreatment: "Onboarding fee", veteransContributionTreatment: "Veterans contribution",
  discountTreatment: "Discounts", taxTreatment: "Tax", processorFeeTreatment: "Payment processor fees",
});
const TREATMENT_VALUE_LABELS = Object.freeze({
  excluded_retained: "Excluded from sharing; Greet-Me retains it",
  excluded_waived: "Excluded from sharing; fee waived",
  excluded: "Excluded",
  contribute_from_platform_share_only: "Contributed from Greet-Me’s share only",
  ineligible: "Not eligible for sharing",
  eligible_on_net: "Eligible, calculated on the net amount",
  eligible_on_gross: "Eligible, calculated on the gross amount",
  excluded_from_base: "Excluded from the base",
  net_of_processor: "Deducted before sharing (net of processor fees)",
  gross_absorbed_by_platform: "Not deducted; Greet-Me absorbs them (gross)",
});
const EMPTY_TREATMENTS = () => Object.fromEntries(Object.keys(TREATMENTS).map((k) => [k, ""]));

// ── Terms form (Year 1 / Year 2 / Year 3+) — rule text only; no example panels ────────────────────
export function TermsForm({ value, onChange, effectiveFrom, onEffectiveFrom, errors = {} }) {
  const field = (k, text) => (
    <div style={{ flex: "1 1 120px", minWidth: 110 }}>
      <label htmlFor={`t-${k}`} style={label}>{text}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input id={`t-${k}`} data-testid={`terms-${k}`} value={value[k]} inputMode="decimal" placeholder="—"
          onChange={(e) => onChange({ ...value, [k]: e.target.value })} style={{ ...input, width: 80 }} />
        <span>%</span>
      </div>
      {errors[k] ? <p style={err}>{errors[k]}</p> : null}
    </div>
  );
  return (
    <div data-testid="terms-form">
      <p style={{ ...help, margin: "0 0 10px" }}>
        The partner’s share of qualifying purchases from customers who join through its links: subscriptions and Branded Goods, each on its own approved base. The partner share comes off first; a salesperson’s commission is calculated on what remains.
      </p>
      <p data-testid="terms-bases" style={{ ...help, margin: "0 0 10px" }}>
        These percentages apply to qualifying subscriptions and qualifying Branded Goods purchases, on the same customer clock. Each uses its own base: subscriptions the amount salesperson commissions use (what the customer paid, minus tax, minus the one-time platform fee on the first checkout); Branded Goods Greet-Me’s margin (the item price, minus any Hearts Gift Credit used on the item, minus what Printful charges for the item, minus the payment processing fee; shipping passes through, and any difference between what the customer paid for shipping and what Printful charged counts).
      </p>
      <p data-testid="terms-branded-status" style={{ ...help, margin: "0 0 10px" }}>{BRANDED_GOODS_NOT_CALCULATED}</p>
      <p data-testid="terms-gifts" style={{ ...help, margin: "0 0 10px" }}>
        Not included: flowers, Goody gift boxes, corporate funded gifts and Shopify gift orders. QR Cash and Smart Cards never earn a partner share.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{field("y1", "Year 1 partner share")}{field("y2", "Year 2 partner share")}{field("y3", "Year 3+ partner share")}</div>
      <p style={help}>0–100, up to 2 decimal places. No percentage is filled in for you.</p>
      <p data-testid="terms-clock" style={{ ...help, marginTop: 8 }}>
        Each customer has their own clock with this partner. Year 1 starts at their first qualifying paid purchase through the partner, a subscription or a Branded Goods order, and lasts 12 months; then Year 2; then Year 3+, which continues while the partnership is active. Cancelling and coming back, or joining another of the partner’s campaigns, doesn’t restart the clock. A refunded first purchase still sets the start date.
      </p>
      <div style={{ marginTop: 12 }}>
        <label htmlFor="t-from" style={label}>Terms take effect</label>
        <input id="t-from" type="date" data-testid="terms-from" value={effectiveFrom} onChange={(e) => onEffectiveFrom(e.target.value)} style={{ ...input, width: 180 }} />
        {errors.from ? <p style={err}>{errors.from}</p> : null}
        <p style={help}>Takes effect at 00:00 UTC on this date.</p>
        <p style={help}>Sales before this date earn no partner share under these terms. Existing customers keep their original start date: a customer whose first purchase was 18 months earlier starts in Year 2, not Year 1. Earlier terms and recorded earnings are never rewritten.</p>
      </div>
    </div>
  );
}

// ── Partner administrator lookup (exact email; founder-only server-side) ──────────────────────────
function AdminFinder({ email, setEmail, found, setFound, error, setError }) {
  const [busy, setBusy] = useState(false);
  async function find() {
    setError(null); setFound(null);
    if (!email.trim()) { setError("Find the partner administrator’s account first."); return; }
    setBusy(true);
    const out = resolveOutcome(await fundraiserApi.founder.resolveUserByEmail(email.trim()));
    setBusy(false);
    if (out.state !== STATES.RESOLVED) { setError(messageFor(out.state)); return; }
    if (out.account.isFounder) { setError("A platform founder cannot be a partner administrator."); return; }
    setFound(out.account);
  }
  return (
    <div data-testid="admin-finder">
      <label htmlFor="r-email" style={label}>Partner administrator’s email</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input id="r-email" data-testid="r-email" type="email" value={email}
          onChange={(e) => { setEmail(e.target.value); setFound(null); setError(null); }} style={{ ...input, flex: "1 1 220px" }} />
        <button type="button" style={btn} data-testid="r-find" disabled={busy} onClick={find}>{busy ? "Finding…" : "Find account"}</button>
      </div>
      {found ? <p data-testid="r-found" style={{ background: "#ecfdf3", border: "1px solid #bbf7d0", borderRadius: 6, padding: "6px 10px", fontSize: 13.5 }}>Found: {found.email}. They become this partner’s administrator; they get access when you activate the partner.</p> : null}
      {error ? <p data-testid="r-email-error" style={err}>{error}</p> : null}
      <p style={help}>The person must already have a Greet-Me account.</p>
    </div>
  );
}

// ── Partner share entry (Year 1 / 2 / 3+, treatments, reason) — used by Register and the partner page ──
const EMPTY_ENTRY = () => ({ terms: { y1: "", y2: "", y3: "" }, from: "", treatments: EMPTY_TREATMENTS(), reason: "" });

/** Validate an entry the way the server will. Returns { ok, errors, rules, treatments, effectiveFrom, reason }. */
function checkEntry(entry) {
  const v = validateYearRates(entry.terms);
  const errors = { ...v.errors };
  const at = dateToUtcInstant(entry.from);
  if (!at.ok) errors.from = at.error;
  for (const k of Object.keys(TREATMENTS)) if (!TREATMENTS[k].includes(entry.treatments[k])) errors[k] = "Choose a treatment.";
  if (!entry.reason.trim()) errors.reason = "Say why these terms are being set.";
  const ok = Object.keys(errors).length === 0;
  return ok ? { ok, errors, rules: buildYearRatesRule(v.yearRates), treatments: { ...entry.treatments }, effectiveFrom: at.iso, reason: entry.reason.trim() } : { ok, errors };
}

function TermsEntry({ entry, setEntry, errors, setErrors }) {
  const upd = (patch) => { setEntry({ ...entry, ...patch }); setErrors({}); };
  return (
    <>
      <TermsForm value={entry.terms} onChange={(x) => upd({ terms: x })} effectiveFrom={entry.from} onEffectiveFrom={(x) => upd({ from: x })} errors={errors} />
      <fieldset data-testid="terms-treatments" style={{ border: "1px solid #e6e2da", borderRadius: 8, padding: ".6rem", margin: "12px 0 0" }}>
        <legend style={{ fontSize: ".85rem", fontWeight: 700 }}>Treatments</legend>
        {Object.entries(TREATMENTS).map(([key, allowed]) => (
          <label key={key} style={{ display: "block", margin: ".3rem 0", fontSize: ".85rem" }}>
            {TREATMENT_FIELD_LABELS[key]}{" "}
            <select data-testid={`terms-${key}`} value={entry.treatments[key]} onChange={(ev) => upd({ treatments: { ...entry.treatments, [key]: ev.target.value } })} style={{ ...input, padding: 4 }}>
              <option value="">Choose…</option>
              {allowed.map((x) => <option key={x} value={x}>{TREATMENT_VALUE_LABELS[x]}</option>)}
            </select>
            {errors[key] ? <span style={{ color: "#b00" }}> {errors[key]}</span> : null}
          </label>
        ))}
      </fieldset>
      <div style={{ marginTop: 12 }}>
        <label htmlFor="terms-reason" style={label}>Reason (required &mdash; it is recorded in the audit history)</label>
        <input id="terms-reason" data-testid="terms-reason" value={entry.reason} onChange={(e) => upd({ reason: e.target.value })} style={{ ...input, width: "100%", maxWidth: 420 }} />
        {errors.reason ? <p style={err}>{errors.reason}</p> : null}
      </div>
    </>
  );
}

/** ADDENDUM 1 — organization-level terms: draft → approve → activate. Returns null on success, else the failed response. */
async function saveOrgTerms(organizationId, c) {
  const d = await fundraiserApi.founder.draftOrgTerms(organizationId, { rules: c.rules, treatments: c.treatments });
  const dv = d && d.data && (d.data.version || d.data);
  const dId = dv && (dv.id || dv.versionId);
  if (stateFor(d) !== "ok") return d;
  if (!dId) return { ok: false, status: 500, data: null };
  const a = await fundraiserApi.founder.approveOrgTerms(organizationId, dId, c.reason);
  if (stateFor(a) !== "ok") return a;
  const av = a.data && (a.data.version || a.data);
  const aId = (av && (av.id || av.versionId)) || dId;
  const act = await fundraiserApi.founder.activateOrgTerms(organizationId, aId, { effectiveFrom: c.effectiveFrom, activationReason: c.reason });
  return stateFor(act) === "ok" ? null : act;
}

// ── Register (save, not active) — the approved rev 6 four steps ─────────────────────────────────
const STEPS = ["Organization", "Partner administrator", "Partner share", "Review and save"];
function Register({ salespeople, onSaved, onCancel }) {
  const [step, setStep] = useState(0);
  const [org, setOrg] = useState({ legalName: "", orgType: "school", salespersonId: "" });
  const [email, setEmail] = useState("");
  const [found, setFound] = useState(null);
  const [findError, setFindError] = useState(null);
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [saved, setSaved] = useState(null);
  const spName = (id) => { const s = salespeople.find((x) => x.salespersonId === id); return s ? (s.displayName || s.salespersonId) : "None"; };
  const checked = step >= 3 ? checkEntry(entry) : null;

  const next = () => {
    const e = {};
    if (step === 0 && !org.legalName.trim()) e.legalName = "Enter the organization’s legal name.";
    if (step === 1 && !found) { setFindError("Find the partner administrator’s account first."); return; }
    if (step === 2) { const c = checkEntry(entry); if (!c.ok) Object.assign(e, c.errors); }
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(step + 1);
  };

  async function save() {
    const c = checkEntry(entry);
    if (busy || !found || !c.ok) return;
    setBusy(true); setMessage(null);
    // `salespersonId` is sent ONLY when one was chosen; "None" sends exactly { legalName, orgType }.
    const body = { legalName: org.legalName.trim(), orgType: org.orgType };
    if (org.salespersonId) body.salespersonId = org.salespersonId;
    const created = await fundraiserApi.founder.createOrganization(body);
    if (stateFor(created) !== "ok" || !created.data || !created.data.organizationId) {
      setBusy(false); setMessage(`The partner was not saved. ${failureText(created)}`); return;
    }
    const orgId = created.data.organizationId;
    const assigned = assignOutcome(await fundraiserApi.founder.assignPartnerAdmin(orgId, found.userId));
    const termsFail = await saveOrgTerms(orgId, c);
    setBusy(false);
    setSaved({ name: created.data.legalName || body.legalName, adminAssigned: assigned.state === STATES.ASSIGNED, termsSaved: termsFail === null, termsError: termsFail ? failureText(termsFail) : null });
    if (onSaved) onSaved();
  }

  if (saved) {
    const all = saved.adminAssigned && saved.termsSaved;
    return (
      <div style={box} data-testid="register-saved">
        <h2 style={h}>Partner saved, not active yet</h2>
        <p>{all ? `${saved.name} is set up with its administrator and terms.` : `${saved.name} is saved.`} Nothing is live: its administrator can’t open a partner dashboard and no sales count until you activate it from the partner’s page.</p>
        {!saved.adminAssigned ? <p data-testid="register-admin-failed" style={{ ...err, fontSize: ".9rem" }}>The administrator could not be assigned. Assign them from the partner’s page.</p> : null}
        {!saved.termsSaved ? <p data-testid="register-terms-failed" style={{ ...err, fontSize: ".9rem" }}>The partner share could not be saved. {saved.termsError} Set it from the partner’s page.</p> : null}
        <button type="button" style={btn} onClick={onCancel}>Back to partners</button>
      </div>
    );
  }
  return (
    <div style={box} data-testid="register">
      <h2 style={h}>Register a partner</h2>
      <ol aria-label="Steps" style={{ display: "flex", flexWrap: "wrap", gap: 6, listStyle: "none", padding: 0, margin: "0 0 14px" }}>
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}
            style={{ fontSize: 12.5, padding: "4px 10px", borderRadius: 14, border: "1px solid #d8cdbb",
              background: i === step ? "#6b3a2a" : i < step ? "#f3ede4" : "#fff", color: i === step ? "#fff" : "#4a3f35" }}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div data-testid="step-org" style={{ maxWidth: 520 }}>
          <label htmlFor="r-name" style={label}>Legal name</label>
          <input id="r-name" data-testid="r-name" value={org.legalName} onChange={(e) => { setOrg({ ...org, legalName: e.target.value }); setErrors({}); }} placeholder="Exact legal name" style={{ ...input, width: "100%" }} />
          {errors.legalName ? <p style={err}>{errors.legalName}</p> : null}
          <label htmlFor="r-type" style={{ ...label, marginTop: 12 }}>Type</label>
          <select id="r-type" data-testid="r-type" value={org.orgType} onChange={(e) => setOrg({ ...org, orgType: e.target.value })} style={{ ...input, width: "100%" }}>
            {ORG_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <label htmlFor="r-sp" style={{ ...label, marginTop: 12 }}>Salesperson who brought in this partner (optional)</label>
          {/* Active salespeople only (the server refuses an inactive one). A failed read leaves just "None". */}
          <select id="r-sp" data-testid="org-salesperson" value={org.salespersonId} onChange={(e) => setOrg({ ...org, salespersonId: e.target.value })} style={{ ...input, width: "100%" }}>
            <option value="">None</option>
            {salespeople.map((s) => <option key={s.salespersonId} value={s.salespersonId}>{s.displayName ? `${s.displayName} (${s.salespersonId})` : s.salespersonId}</option>)}
          </select>
          <p style={help}>Can only be set now, and can’t be changed later. Their commission clock starts when you activate the partner.</p>
        </div>
      ) : null}

      {step === 1 ? (
        <div data-testid="step-admin" style={{ maxWidth: 520 }}>
          <AdminFinder email={email} setEmail={setEmail} found={found} setFound={setFound} error={findError} setError={setFindError} />
        </div>
      ) : null}

      {step === 2 ? (
        <div data-testid="step-terms">
          <TermsEntry entry={entry} setEntry={setEntry} errors={errors} setErrors={setErrors} />
        </div>
      ) : null}

      {step === 3 ? (
        <div data-testid="step-review" style={{ maxWidth: 560 }}>
          <table style={{ fontSize: 14, borderCollapse: "collapse" }}><tbody>
            {[["Organization", `${org.legalName.trim()} (${typeLabel(org.orgType)})`], ["Salesperson", org.salespersonId ? spName(org.salespersonId) : "None"],
              ["Partner administrator", found ? found.email : ""], ["Partner share", checked && checked.ok ? termsLine(checked.rules) : ""], ["Takes effect", entry.from]].map(([a, b]) => (
              <tr key={a}><td style={{ padding: "4px 14px 4px 0", color: "#8a7c6c" }}>{a}</td><td style={{ padding: "4px 0", fontWeight: 600, overflowWrap: "anywhere" }}>{b}</td></tr>
            ))}
          </tbody></table>
          <p style={{ ...help, marginTop: 10 }}>Saving does not activate the partner. You activate it separately from its page when you’re ready.</p>
          {message ? <p data-testid="register-error" role="status" style={err}>{message}</p> : null}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        {step > 0 ? <button type="button" style={btnGhost} onClick={() => { setErrors({}); setStep(step - 1); }}>Back</button> : null}
        {step < 3 ? <button type="button" style={btn} data-testid="r-next" onClick={next}>Continue</button>
          : <button type="button" style={btn} data-testid="r-save" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save partner (not active yet)"}</button>}
        <button type="button" style={btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── Partner page: Overview ─────────────────────────────────────────────────────────────────────
const CLOSE_WARNING = "Closing stops this organization fundraising in the same way suspension does, and is intended as the " +
  "permanent end of the relationship rather than a pause. Existing records are kept and payouts remain held.";
const SUSPEND_WARNING = "Suspending stops this organization fundraising immediately: its public referral links stop resolving, " +
  "new checkout attribution is refused, and its partner administrators lose access. Existing records are kept and payouts remain held. Reinstating undoes it.";

function ReasonAction({ testid, title, heading, warning, confirmText, danger, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Escape closes the confirmation without sending anything (as the previous founder screen did).
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div role="dialog" aria-label={title} data-testid={testid} style={{ background: danger ? "#fef2f2" : "#f8fafc", border: `1px solid ${danger ? "#fecaca" : "#e2e8f0"}`, borderRadius: 8, padding: 10, marginTop: 8 }}>
      {heading ? <p style={{ margin: "0 0 6px", fontWeight: 700 }}>{heading}</p> : null}
      {warning ? <p style={{ margin: "0 0 8px" }}>{warning}</p> : null}
      <label htmlFor={`${testid}-reason`} style={label}>Reason (required &mdash; it is recorded in the organization&rsquo;s audit history)</label>
      <input id={`${testid}-reason`} data-testid={`${testid}-reason`} value={reason} onChange={(e) => { setReason(e.target.value); setError(null); }} style={{ ...input, width: "100%", maxWidth: 420 }} />
      {error ? <p style={err}>{error}</p> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button type="button" style={danger ? { ...btn, background: "#8a3b25" } : btn} data-testid={`${testid}-yes`} disabled={busy}
          onClick={async () => {
            if (!reason.trim()) { setError("Say why this organization is changing status."); return; }
            setBusy(true); const e = await onConfirm(reason.trim()); setBusy(false);
            if (e) setError(e);
          }}>{busy ? "Working…" : confirmText}</button>
        <button type="button" style={btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function Activation({ p, status, extras, onChanged }) {
  const [mode, setMode] = useState(null); // activate | suspend | end | reinstate
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [notice, setNotice] = useState(null);
  const adminAssigned = Array.isArray(p.adminUserIds) && p.adminUserIds.length > 0;
  const termsSet = !!(extras && (extras.activeTerms || extras.scheduled));
  const checks = [["Organization saved", true], ["Partner administrator assigned", adminAssigned], ["Partner share set", termsSet]];
  const ready = checks.every(([, v]) => v);
  const name = p.legalName || p.organizationId;

  async function run(call, label) {
    setBusy(true); setMessage(null); setNotice(null);
    const res = await call();
    setBusy(false);
    if (stateFor(res) !== "ok") { const m = failureText(res); setMessage(m); return m; }
    setMode(null);
    const refreshed = await onChanged();
    // Adopted only from the server: a FAILED re-read is reported as stale, never invented.
    setNotice({ label: label || null, stale: refreshed === false });
    return null;
  }

  const ended = lastEndedInterval(p);
  const since = isoDate(p.activatedAt || p.approvedAt);
  return (
    <div style={box} data-testid="activation">
      <h3 style={{ ...h, fontSize: 17 }}>Activation</h3>
      {status === "prepared" ? (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 10px" }}>
            {checks.map(([t, v]) => (
              <li key={t} style={{ margin: "4px 0", color: v ? "#166534" : "#92400e" }}>{v ? "✓" : "○"} {t}</li>
            ))}
          </ul>
          {mode !== "activate" ? (
            <button type="button" style={{ ...btn, opacity: ready ? 1 : 0.5 }} disabled={!ready} data-testid="activate" onClick={() => setMode("activate")}>Activate partner</button>
          ) : (
            <div role="dialog" aria-label="Activate partner" data-testid="activate-confirm" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 10 }}>
              <p style={{ margin: "0 0 8px" }}>Activate {name}? Its administrator can then open the partner dashboard and create and start campaigns. Customers who buy through its links from now on count toward its share.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={btn} data-testid="activate-yes" disabled={busy}
                  onClick={() => run(() => fundraiserApi.founder.activateOrganization(p.organizationId))}>{busy ? "Activating…" : "Activate"}</button>
                <button type="button" style={btnGhost} onClick={() => setMode(null)}>Not yet</button>
              </div>
            </div>
          )}
          {!ready ? <p style={help}>Finish the items above to activate.</p> : null}
        </>
      ) : status === "active" ? (
        <>
          <p style={{ margin: "0 0 8px" }} data-testid="active-since">{since ? `Active since ${since}.` : "Active."}</p>
          {mode === null ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" style={btnGhost} data-testid="suspend" onClick={() => setMode("suspend")}>Suspend</button>
              <button type="button" style={{ ...btnGhost, color: "#8a3b25", borderColor: "#8a3b25" }} data-testid="end-partnership" onClick={() => setMode("end")}>End partnership</button>
            </div>
          ) : null}
          {mode === "suspend" ? (
            <ReasonAction testid="suspend-confirm" title="Suspend partner" warning={SUSPEND_WARNING} confirmText="Suspend" danger
              onConfirm={(why) => run(() => fundraiserApi.founder.suspendOrganization(p.organizationId, why), "Suspend")} onCancel={() => setMode(null)} />
          ) : null}
          {mode === "end" ? (
            <div role="dialog" aria-label="End partnership" data-testid="end-confirm" style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10 }}>
              <label htmlFor="end-date" style={label}>Partnership ends on</label>
              <input id="end-date" type="date" data-testid="end-date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ ...input, width: 180 }} />
              <p style={{ margin: "8px 0" }}>From this date no new earnings build up for {name}, on new or existing customers. Amounts already earned stay recorded and owed, subject to the usual refund rules. You can resume it later; customers keep their original clocks, and the ended period earns nothing.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={{ ...btn, background: "#8a3b25", opacity: endDate ? 1 : 0.5 }} disabled={!endDate || busy} data-testid="end-yes"
                  onClick={() => { const at = dateToUtcInstant(endDate); if (!at.ok) { setMessage(at.error); return; } run(() => fundraiserApi.founder.endOrganization(p.organizationId, at.iso)); }}>
                  {busy ? "Ending…" : "End partnership"}
                </button>
                <button type="button" style={btnGhost} onClick={() => setMode(null)}>Keep it</button>
              </div>
            </div>
          ) : null}
        </>
      ) : status === "ended" ? (
        <div data-testid="ended">
          <p style={{ margin: "0 0 8px" }}>Partnership ended{ended ? ` on ${isoDate(ended.endedAt)}` : ""}. No new earnings from that date; amounts already earned stay recorded and owed.</p>
          <button type="button" style={btnGhost} data-testid="resume" disabled={busy}
            onClick={() => run(() => fundraiserApi.founder.resumeOrganization(p.organizationId))}>{busy ? "Resuming…" : "Resume partnership"}</button>
          <p style={help}>Resuming keeps every customer’s original clock. The time it was ended earns nothing.</p>
        </div>
      ) : status === "suspended" || status === "closed" ? (
        <div data-testid={status}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span>{status === "suspended"
              ? "Suspended. Existing customers keep earning, but payouts are held. No new customers are linked while suspended."
              : "Closed."}</span>
            {mode !== "reinstate" ? <button type="button" style={btnGhost} data-testid="reinstate" onClick={() => setMode("reinstate")}>Reinstate</button> : null}
          </div>
          {mode === "reinstate" ? (
            <ReasonAction testid="reinstate-confirm" title="Reinstate partner" confirmText="Reinstate"
              onConfirm={(why) => run(() => fundraiserApi.founder.reinstateOrganization(p.organizationId, why), "Reinstate")} onCancel={() => setMode(null)} />
          ) : null}
        </div>
      ) : (
        <p>Status: {String(p.status || "unknown")}</p>
      )}
      {message ? <p data-testid="activation-error" role="status" style={err}>{message}</p> : null}
      {notice && notice.label ? <p data-testid="orglife-success" style={{ color: "#2f6f4f", margin: "8px 0 0" }}>{notice.label} applied.</p> : null}
      {notice && notice.stale ? <p data-testid="orglife-stale" style={{ ...err, fontSize: ".85rem" }}>The change was applied, but the organization list could not be re-read. Reload to see current state.</p> : null}
      {/* Existing founder control, kept in the least prominent place: close the organization. Same route,
          warning and confirmation wording as the previous founder screen. Not offered once closed. */}
      {["prepared", "active", "ended", "suspended"].includes(status) && mode !== "close" ? (
        <p style={{ margin: "14px 0 0" }}>
          <button type="button" data-testid="orglife-close" onClick={() => setMode("close")}
            style={{ background: "none", border: 0, padding: 0, color: "#8a7c6c", textDecoration: "underline", cursor: "pointer", font: "inherit", fontSize: 13 }}>Close organization</button>
        </p>
      ) : null}
      {mode === "close" ? (
        <ReasonAction testid="close-org-confirm" title="Close organization" heading={`Close ${name}?`} warning={CLOSE_WARNING} confirmText="Yes, close" danger
          onConfirm={(why) => run(() => fundraiserApi.founder.closeOrganization(p.organizationId, why), "Close")} onCancel={() => setMode(null)} />
      ) : null}
    </div>
  );
}

// N6 — the existing partner-administrator panel, restored unchanged (resolve an exact email, review the
// resolver's approved fields, assign, read-back, partner-portal link). Used for the first administrator
// and to add another one. Authorization is entirely server-side (founder-only for both calls).
function partnerPortalUrl() {
  let base = "";
  try { base = window.location.origin; } catch { base = ""; }
  return `${base}/#/dashboard/fundraiser`;
}

function AdminPanel({ organization, onChanged }) {
  const [adminEmail, setAdminEmail] = useState("");
  const [admin, setAdmin] = useState({ state: STATES.EMPTY, account: null, reason: null });
  async function resolveAdmin(e) {
    e.preventDefault();
    setAdmin({ state: STATES.RESOLVING, account: null, reason: null });
    const r = await fundraiserApi.founder.resolveUserByEmail(adminEmail);
    const out = resolveOutcome(r);
    setAdmin({ ...out, reason: null });
  }
  async function assignAdmin() {
    if (!canAssign(admin.state, admin.account)) return;
    const userId = admin.account.userId;
    setAdmin((a) => ({ ...a, state: STATES.ASSIGNING, reason: null }));
    const r = await fundraiserApi.founder.assignPartnerAdmin(organization.organizationId, userId);
    const out = assignOutcome(r);
    setAdmin((a) => ({ ...a, state: out.state, reason: out.reason }));
    // Existing read-back behaviour: re-read the organization list so adminUserIds is truthful.
    if (out.state === STATES.ASSIGNED && onChanged) await onChanged();
  }
  return (
    <div data-testid="admin-panel" style={{ marginTop: 12 }}>
      <p style={{ margin: "0 0 8px", color: "#5b4f42", fontSize: ".9rem" }}>
        Current: {Array.isArray(organization.adminUserIds) && organization.adminUserIds.length > 0
          ? `${organization.adminUserIds.length} assigned`
          : "none assigned"}
      </p>
      <form onSubmit={resolveAdmin} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }} data-testid="admin-resolve-form">
        <input
          type="email"
          placeholder="Administrator email"
          value={adminEmail}
          onChange={(e) => { setAdminEmail(e.target.value); setAdmin({ state: STATES.EMPTY, account: null, reason: null }); }}
          style={{ padding: 8, borderRadius: 6, border: "1px solid #d8cdbb", flex: 1, minWidth: 220 }}
          data-testid="admin-email"
        />
        <button style={btn} type="submit" disabled={admin.state === STATES.RESOLVING || admin.state === STATES.ASSIGNING} data-testid="admin-resolve">
          {admin.state === STATES.RESOLVING ? "Resolving…" : "Resolve"}
        </button>
      </form>

      {admin.state === STATES.RESOLVED && admin.account && (
        <div style={{ border: "1px solid #d8cdbb", borderRadius: 6, padding: 10, marginBottom: 8 }} data-testid="admin-resolved">
          <div><strong>{admin.account.email}</strong></div>
          <div style={{ color: "#5b4f42", fontSize: ".9rem" }}>
            Email verified: <strong data-testid="admin-verified">{admin.account.emailVerified ? "yes" : "no"}</strong>
            {" · "}Founder account: <strong data-testid="admin-isfounder">{admin.account.isFounder ? "yes" : "no"}</strong>
          </div>
          {admin.account.isFounder ? (
            <p style={{ margin: "8px 0 0", color: "#8a3b2a" }} data-testid="admin-founder-block">
              A platform founder cannot be a partner administrator.
            </p>
          ) : (
            <button style={{ ...btn, marginTop: 8 }} onClick={assignAdmin} disabled={!canAssign(admin.state, admin.account)} data-testid="admin-assign">Assign as partner administrator</button>
          )}
        </div>
      )}

      {admin.state === STATES.ASSIGNING && <p style={{ color: "#5b4f42" }} data-testid="admin-assigning">Assigning…</p>}

      {[STATES.INVALID_EMAIL, STATES.NOT_FOUND, STATES.AMBIGUOUS, STATES.SERVICE_FAILURE, STATES.ASSIGNED, STATES.ASSIGN_FAILED].includes(admin.state) && (
        <p style={{ color: admin.state === STATES.ASSIGNED ? "#2f6f4f" : "#8a3b2a", marginTop: 0 }}
          data-testid={admin.state === STATES.ASSIGNED ? "admin-success" : "admin-error"}>{messageFor(admin.state, admin.reason)}</p>
      )}

      {admin.state === STATES.ASSIGNED && admin.account && (
        <p style={{ color: "#5b4f42", fontSize: ".9rem", marginTop: 0 }} data-testid="admin-readback">
          Read-back: {isAssigned(organization, admin.account.userId) ? "present in adminUserIds ✓" : "not yet reflected"}
        </p>
      )}

      {admin.state === STATES.ASSIGNED && admin.account && (
        <p style={{ color: "#5b4f42", fontSize: ".85rem", marginTop: 0 }} data-testid="admin-next-step">
          Direct them to the partner portal to get started:{" "}
          <code data-testid="admin-partner-link">{partnerPortalUrl()}</code>
          <button type="button" style={{ ...btnGhost, marginLeft: 8, padding: "2px 8px", fontSize: ".78rem" }} data-testid="admin-copy-partner-link"
            onClick={async () => { try { await navigator.clipboard.writeText(partnerPortalUrl()); } catch { /* clipboard unavailable — the visible URL above still works */ } }}>
            Copy link
          </button>
        </p>
      )}
    </div>
  );
}

function Relationship({ p, salespeople, onChanged }) {
  const [open, setOpen] = useState(false);
  const count = Array.isArray(p.adminUserIds) ? p.adminUserIds.length : 0;
  const rows = [["Type", typeLabel(p.orgType)], ["Partner administrator", count > 0 ? `${count} assigned` : "Not assigned"]];
  // The salesperson is shown only when the server's record carries the field; never guessed.
  if (Object.prototype.hasOwnProperty.call(p, "originationSalespersonId")) {
    const id = p.originationSalespersonId;
    const s = id ? salespeople.find((x) => x.salespersonId === id) : null;
    rows.push(["Salesperson", id ? (s && s.displayName ? s.displayName : id) : "None"]);
  }
  return (
    <div style={box} data-testid="relationship">
      <h3 style={{ ...h, fontSize: 17 }}>Relationship</h3>
      <table style={{ fontSize: 14, borderCollapse: "collapse" }}><tbody>
        {rows.map(([a, b]) => (
          <tr key={a}><td style={{ padding: "4px 14px 4px 0", color: "#8a7c6c" }}>{a}</td><td style={{ padding: "4px 0", fontWeight: 600, overflowWrap: "anywhere" }}>{b}</td></tr>
        ))}
      </tbody></table>
      <button type="button" style={{ ...btnGhost, marginTop: 10 }} data-testid="admin-panel-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide" : count > 0 ? "Add another administrator" : "Assign administrator"}
      </button>
      {open ? <AdminPanel key={p.organizationId} organization={p} onChanged={onChanged} /> : null}
    </div>
  );
}

// RR1 — finish a saved organization terms version that never became active: approve it if it is still a
// draft, then activate it from the chosen date. Uses only the org-terms routes; nothing is re-entered.
function FinishPendingTerms({ p, pending, canSet, onChanged }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  async function finish() {
    if (busy) return;
    const e = {};
    const at = dateToUtcInstant(from);
    if (!at.ok) e.from = at.error;
    if (!reason.trim()) e.reason = "Say why these terms are being set.";
    setErrors(e); setMessage(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    let res = { ok: true, status: 200 };
    if (pending.status === "draft") res = await fundraiserApi.founder.approveOrgTerms(p.organizationId, pending.versionId, reason.trim());
    if (stateFor(res) === "ok") res = await fundraiserApi.founder.activateOrgTerms(p.organizationId, pending.versionId, { effectiveFrom: at.iso, activationReason: reason.trim() });
    setBusy(false);
    if (stateFor(res) !== "ok") { setMessage(failureText(res)); await onChanged(); return; }
    setOpen(false);
    await onChanged();
  }
  return (
    <div data-testid="terms-pending" style={{ marginTop: 8, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 10px", fontSize: 14 }}>
      <div>Saved, not in place yet: <strong>{termsLine(pending.rules)}</strong></div>
      {canSet && !pending.complete ? (
        <p data-testid="finish-terms-incomplete" style={{ ...help, marginTop: 6 }}>These saved terms are incomplete, so they can’t be put in place. Use Set terms to enter the partner share.</p>
      ) : null}
      {canSet && pending.complete && !open ? <button type="button" style={{ ...btn, marginTop: 8 }} data-testid="finish-terms" onClick={() => setOpen(true)}>Put these terms in place</button> : null}
      {canSet && open ? (
        <div style={{ marginTop: 10 }}>
          <label htmlFor="pending-from" style={label}>Terms take effect</label>
          <input id="pending-from" type="date" data-testid="pending-from" value={from} onChange={(e) => { setFrom(e.target.value); setErrors({}); }} style={{ ...input, width: 180 }} />
          {errors.from ? <p style={err}>{errors.from}</p> : null}
          <p style={help}>Takes effect at 00:00 UTC on this date.</p>
          <label htmlFor="pending-reason" style={{ ...label, marginTop: 10 }}>Reason (required &mdash; it is recorded in the audit history)</label>
          <input id="pending-reason" data-testid="pending-reason" value={reason} onChange={(e) => { setReason(e.target.value); setErrors({}); }} style={{ ...input, width: "100%", maxWidth: 420 }} />
          {errors.reason ? <p style={err}>{errors.reason}</p> : null}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" style={btn} data-testid="finish-terms-yes" disabled={busy} onClick={finish}>{busy ? "Saving…" : "Put these terms in place"}</button>
            <button type="button" style={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : null}
      {message ? <p data-testid="finish-terms-error" role="status" style={err}>{message}</p> : null}
    </div>
  );
}

function PartnerShare({ p, status, extras, onChanged }) {
  const [changing, setChanging] = useState(false);
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const active = extras && extras.activeTerms;
  const canSet = status === "active" || status === "prepared";

  function cancel() { setChanging(false); setErrors({}); setMessage(null); setEntry(EMPTY_ENTRY()); }

  async function save() {
    if (busy) return;
    const c = checkEntry(entry);
    setErrors(c.errors); setMessage(null);
    if (!c.ok) return; // zero requests while incomplete
    setBusy(true);
    let fail = null;
    if (extras && (extras.hasActiveTerms || active)) {
      // N5 / RR1 — an ACTIVE version exists (in force or scheduled), active or not-yet-active partner ⇒
      // the existing org-wide change-rate (it also re-issues the organization terms for later campaigns).
      const r = await fundraiserApi.founder.changeOrganizationRate(p.organizationId, { rules: c.rules, treatments: c.treatments, effectiveFrom: c.effectiveFrom, reason: c.reason });
      if (stateFor(r) !== "ok") fail = r;
    } else {
      // No active version yet ⇒ a new organization terms version, drafted, approved and activated
      // (ADDENDUM 1). An unfinished draft/approved version may stay in history: the server has no route
      // to edit or archive it, and it never blocks this activation.
      fail = await saveOrgTerms(p.organizationId, c);
    }
    setBusy(false);
    if (fail) { setMessage(failureText(fail)); await onChanged(); return; }
    cancel();
    await onChanged();
  }

  return (
    <div style={box} data-testid="partner-share">
      <h3 style={{ ...h, fontSize: 17 }}>Partner share</h3>
      {extras && extras.error ? <p style={err}>This information couldn’t be loaded.</p> : (
        <p style={{ margin: 0, fontSize: 15 }} data-testid="terms-line"><strong>{active ? termsLine(active.rules) : extras && extras.scheduled ? "Not in place yet" : "Not set"}</strong>{active && active.effectiveFrom ? ` · takes effect ${isoDate(active.effectiveFrom)}` : ""}</p>
      )}
      {extras && extras.scheduled ? (
        <p style={{ margin: "6px 0 0", fontSize: 14 }} data-testid="terms-scheduled">Scheduled from {isoDate(extras.scheduled.effectiveFrom)}: {termsLine(extras.scheduled.rules)}</p>
      ) : null}
      {extras && extras.pending && !active && !extras.scheduled ? (
        <FinishPendingTerms p={p} pending={extras.pending} canSet={canSet} onChanged={onChanged} />
      ) : null}
      <p style={help}>Each customer’s Year 1 starts at their first qualifying purchase through this partner.</p>
      {canSet && !changing ? (
        // RC2-5(3) — when a complete saved version is waiting, finishing it is the primary path (filled button
        // above); entering different terms is offered as the secondary path. Same action either way.
        extras && extras.pending && extras.pending.complete && !active && !extras.scheduled ? (
          <p style={{ margin: "10px 0 0", fontSize: 13 }}>
            <button type="button" onClick={() => setChanging(true)} data-testid="change-terms"
              style={{ background: "none", border: 0, padding: 0, color: "#6b3a2a", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>Enter different terms instead</button>
          </p>
        ) : (
          <button type="button" style={{ ...btnGhost, marginTop: 10 }} onClick={() => setChanging(true)} data-testid="change-terms">{active || (extras && extras.scheduled) ? "Change terms" : "Set terms"}</button>
        )
      ) : null}
      {canSet && changing ? (
        <div style={{ marginTop: 12 }}>
          <TermsEntry entry={entry} setEntry={setEntry} errors={errors} setErrors={setErrors} />
          <p style={help}>New terms apply to sales from the new date, for every campaign of this partner. Earlier sales keep the terms they were made under.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" style={btn} data-testid="save-terms" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save new terms"}</button>
            <button type="button" style={btnGhost} onClick={cancel}>Cancel</button>
          </div>
        </div>
      ) : null}
      {message ? <p data-testid="terms-error" role="status" style={err}>{message}</p> : null}
    </div>
  );
}

// The campaign lifecycle is the BACKEND's state machine (lifecycle/campaignService.js ALLOWED),
// copied here so the panel can only ever offer a move the server would accept. Nothing is added:
// there is no "reopen", no "archive", no path out of closed.
const F4_TRANSITIONS = Object.freeze({
  draft: ["active", "closed"],
  active: ["paused", "closed"],
  paused: ["active", "closed"],
  closed: [],
});

/** Targets the server would accept from this status. An unknown status offers nothing. */
function f4AllowedTargets(status) {
  return Object.prototype.hasOwnProperty.call(F4_TRANSITIONS, status) ? F4_TRANSITIONS[status] : [];
}

/**
 * Making a campaign live is the only move that needs economics already in force.
 *
 * This is a FRONTEND safety gate, not a backend guarantee. `setCampaignStatus` does not consult
 * economics at all, so a campaign can be made active server-side with no active economics — the
 * panel simply refuses to be the thing that does it, because an active campaign with no economics
 * accrues attribution against terms nobody agreed. The wording below says "first", not "required",
 * for exactly that reason.
 */
const f4NeedsActiveEconomics = (target) => target === "active";

/** The one sentence each target owes the founder before it is chosen. */
const F4_WARNINGS = Object.freeze({
  active: "Makes this campaign eligible for new fundraiser attribution. The partner share must already be in place. Payouts remain held.",
  paused: "Stops new attribution eligibility until the campaign is made active again. Payouts remain held.",
  closed: "Closing is terminal under the current backend contract: a closed campaign cannot be reopened through this state machine.",
});

/** Failure text for a status change. Machine codes may SELECT a sentence; they never reach the DOM. */
function f4FailureMessage(res) {
  if (!res) return "That didn't go through. The campaign status is unchanged.";
  if (res.networkError) return "Couldn't reach the server. The campaign status is unchanged.";
  const code = res.data && typeof res.data.code === "string" ? res.data.code : "";
  if (code === "BAD_TRANSITION") return "That move is no longer possible from this campaign's current status. Reload to see where it stands.";
  if (code === "NOT_FOUND") return "That campaign no longer exists. Nothing was changed.";
  if (code === "ETAG_MISMATCH") return "This campaign changed while you were reviewing it. Reload and try again.";
  // N11 — the server's own refusals on this route (p1-be-int), never shown as "it changed".
  if (code === "TERMS_NOT_ACTIVE") return "This campaign can’t start until the partner share is in place. The campaign status is unchanged.";
  if (code === "ORG_NOT_ACTIVE" || code === "ORG_NOT_APPROVED") return "This partner isn’t active, so its campaigns can’t be started. The campaign status is unchanged.";
  if (code === "RESERVED_CAMPAIGN_KEY") return "That record is reserved by Greet-Me and can’t be changed here.";
  const byStatus = {
    400: "That status change was rejected. The campaign status is unchanged.",
    401: "Your session has expired. Sign in again. The campaign status is unchanged.",
    403: "This action is limited to the founder account. The campaign status is unchanged.",
    404: "That organization or campaign no longer exists. Nothing was changed.",
    409: "This campaign changed while you were reviewing it. Reload and try again.",
    423: "Campaign status changes are on hold right now. Nothing was changed.",
  };
  return byStatus[res.status] || "That didn't go through. The campaign status is unchanged.";
}

/**
 * F4 — review and change a campaign's lifecycle status.
 *
 * A SEPARATE top-level component, for the reason F3 records: with this state and markup inline,
 * the parent passes the React Compiler's budget and every pre-existing memoization in the file is
 * dropped. It is also the honest shape — this panel owns a reason, a target and a confirmation,
 * and none of that belongs to the dashboard.
 *
 * It receives facts, never decides them. `campaign` is the server's own record (its id AND its
 * current status), and `activeEconomicsVersion` is whatever the economics history confirmed as
 * active — so no local optimism can promote a campaign or its economics.
 */
function FounderCampaignStatusPanel({ organizationId, organizationName, campaign, activeEconomicsVersion, onRefreshCampaigns }) {
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [closeAck, setCloseAck] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [changed, setChanged] = useState(null);
  const [staleList, setStaleList] = useState(false);
  // RR9 — when the server-confirmed status moves, the form is cleared but the success message stays
  // (the panel is no longer remounted on a status change, which used to wipe it).
  const [seenStatus, setSeenStatus] = useState(campaign.status);
  if (seenStatus !== campaign.status) {
    setSeenStatus(campaign.status);
    setTarget(""); setReason(""); setCloseAck(""); setConfirming(false); setError(null); setMessage(null);
  }

  // Escape closes the confirmation without sending anything, whether or not the box holds focus.
  useEffect(() => {
    if (!confirming) return undefined;
    const onKey = (ev) => { if (ev.key === "Escape") setConfirming(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming]);

  const currentStatus = campaign.status;
  const targets = f4AllowedTargets(currentStatus);
  const hasActiveEconomics = Boolean(activeEconomicsVersion);
  const activeEconomicsId = activeEconomicsVersion
    ? (activeEconomicsVersion.id || activeEconomicsVersion.versionId || null) : null;
  // A target is blocked when it is the one move that needs economics already in force.
  const blockedByEconomics = f4NeedsActiveEconomics(target) && !hasActiveEconomics;
  const closeConfirmed = target !== "closed" || closeAck.trim() === campaign.campaignId;

  function openConfirm() {
    setMessage(null);
    if (!targets.includes(target)) { setError("Choose what this campaign should become."); return; }
    if (blockedByEconomics) { setError("The partner share must be in place before this campaign can start."); return; }
    if (reason.trim() === "") { setError("Say why this campaign is changing status."); return; }
    setError(null); setConfirming(true);
  }

  async function commit() {
    if (busy) return;
    // Revalidated AT SEND TIME against the record as it stands now. A control that was legitimate
    // a moment ago is not a licence to send: the campaign, its status, or the economics in force
    // may all have moved while this was being read.
    if (!f4AllowedTargets(campaign.status).includes(target)) {
      setConfirming(false);
      setMessage("That move is no longer possible from this campaign's current status. Reload to see where it stands.");
      return;
    }
    if (f4NeedsActiveEconomics(target) && !hasActiveEconomics) {
      setConfirming(false); setError("The partner share must be in place before this campaign can start."); return;
    }
    const why = reason.trim();
    if (why === "") { setConfirming(false); setError("Say why this campaign is changing status."); return; }
    if (!closeConfirmed) { setConfirming(false); setError("Type the campaign ID to confirm closing."); return; }

    setError(null); setMessage(null); setStaleList(false); setBusy(true);
    const res = await fundraiserApi.founder.setCampaignStatus(
      organizationId, campaign.campaignId, target, why,
    );
    setBusy(false); setConfirming(false);
    if (!res || stateFor(res) !== "ok") { setMessage(f4FailureMessage(res)); return; }
    // Adopted ONLY from the server's answer. If it declined to say, nothing is claimed.
    const c = res.data || {};
    setChanged({ campaignId: c.campaignId || campaign.campaignId, status: c.status || null });
    setReason(""); setCloseAck("");
    // Reconcile the list. A FAILED refresh is reported as stale — it never invents a new status.
    if (onRefreshCampaigns) {
      const ok = await onRefreshCampaigns();
      setStaleList(ok !== true);
    }
  }

  return (
    <section data-testid="f4-panel" style={box}>
      <h2 style={h}>Campaign status</h2>

      <div data-testid="f4-review" style={{ fontSize: ".82rem", background: "#f6f6f6", borderRadius: 8, padding: ".55rem" }}>
        <div>Organization: <span data-testid="f4-review-org">{organizationName}</span></div>
        <div>Campaign: <span data-testid="f4-review-campaign">{campaign.title || campaign.campaignId}</span></div>
        <div>Campaign ID: <span data-testid="f4-review-campaign-id">{campaign.campaignId}</span></div>
        <div>Current status: <span data-testid="f4-review-current">{currentStatus}</span></div>
        <div>Target status: <span data-testid="f4-review-target">{target || "—"}</span></div>
        {f4NeedsActiveEconomics(target) ? (
          <div>Active economics version: <span data-testid="f4-review-economics">{activeEconomicsId || "none"}</span></div>
        ) : null}
        <div>Reason: <span data-testid="f4-review-reason">{reason.trim() || "—"}</span></div>
      </div>

      {targets.length === 0 ? (
        <p data-testid="f4-terminal" style={{ fontSize: ".82rem", color: "#555", margin: ".5rem 0 0" }}>
          This campaign is closed. Closing is terminal under the current backend contract, so there
          is no status change to make.
        </p>
      ) : (
        <>
          <label style={{ display: "block", fontSize: ".8rem", margin: ".5rem 0" }}>
            <span style={{ fontWeight: 700 }}>Change status to</span>
            <select data-testid="f4-target" value={target}
              onChange={(ev) => { setTarget(ev.target.value); setError(null); setCloseAck(""); }}>
              <option value="">Choose a status…</option>
              {targets.map((t) => (
                // The one move that needs economics in force is offered, but not enabled, without
                // them — hiding it would leave the founder guessing why the campaign cannot go live.
                <option key={t} value={t} disabled={f4NeedsActiveEconomics(t) && !hasActiveEconomics}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          {targets.includes("active") && !hasActiveEconomics ? (
            <p data-testid="f4-economics-gate" style={{ fontSize: ".8rem", color: "#b00", margin: ".2rem 0" }}>
              The partner share must be in place before this campaign can start.
            </p>
          ) : null}

          {target && F4_WARNINGS[target] ? (
            <p data-testid="f4-warning" style={{ fontSize: ".8rem", color: "#555", margin: ".2rem 0" }}>
              {F4_WARNINGS[target]}
            </p>
          ) : null}

          <label style={{ display: "block", fontSize: ".8rem" }}>
            Reason for this change
            <textarea data-testid="f4-reason" value={reason} rows={2}
              onChange={(ev) => { setReason(ev.target.value); setError(null); }} />
          </label>

          {target === "closed" ? (
            <label style={{ display: "block", fontSize: ".8rem" }}>
              Closing cannot be undone. Type the campaign ID <strong>{campaign.campaignId}</strong> to confirm.
              <input data-testid="f4-close-ack" value={closeAck}
                onChange={(ev) => { setCloseAck(ev.target.value); setError(null); }} />
            </label>
          ) : null}

          {error ? <p data-testid="f4-error" style={{ color: "#b00", fontSize: ".8rem" }}>{error}</p> : null}

          {!confirming ? (
            <button type="button" data-testid="f4-open" disabled={busy} onClick={openConfirm}>
              Review this status change…
            </button>
          ) : (
            <div data-testid="f4-confirm" role="group" aria-label="Confirm campaign status change"
              style={{ border: "1px solid #b00", borderRadius: 8, padding: ".55rem", marginTop: ".4rem" }}>
              <p data-testid="f4-confirm-text" style={{ fontSize: ".82rem", margin: "0 0 .5rem" }}>
                Move {campaign.title || campaign.campaignId} ({campaign.campaignId}) from{" "}
                <strong>{currentStatus}</strong> to <strong data-testid="f4-confirm-target">{target}</strong>?
                {" "}{F4_WARNINGS[target]}
              </p>
              <button type="button" data-testid="f4-cancel" onClick={() => setConfirming(false)}>Cancel</button>
              <button type="button" data-testid="f4-confirm-go" disabled={busy || !closeConfirmed} onClick={commit}>
                {busy ? "Changing…" : `Change status to ${target}`}
              </button>
            </div>
          )}
        </>
      )}

      {message ? <p data-testid="f4-message" role="status" style={{ color: "#b00", fontSize: ".82rem" }}>{message}</p> : null}
      {changed ? (
        <p data-testid="f4-changed" style={{ fontSize: ".82rem" }}>
          Campaign <strong data-testid="f4-changed-campaign">{changed.campaignId}</strong> is now{" "}
          <strong data-testid="f4-changed-status">{changed.status || "—"}</strong>. Economics terms are
          unchanged and payouts remain held.
        </p>
      ) : null}
      {staleList ? (
        <p data-testid="f4-stale" style={{ fontSize: ".8rem", color: "#b00" }}>
          The campaign list could not be refreshed, so what is shown above may be out of date.
        </p>
      ) : null}
    </section>
  );
}

// ── Partner page: Campaigns tab ───────────────────────────────────────────────────────────────
function CampaignsTab({ p, status, extras, onChanged, onRefreshCampaigns }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [e, setE] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [counts, setCounts] = useState(undefined); // N12 — per-campaign participants / supporters (founder results read)
  const list = (extras && extras.campaigns) || [];
  const listKey = list.map((c) => c.campaignId).join(",");
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fundraiserApi.founder.results(p.organizationId);
      if (alive) setCounts(stateFor(r) === "ok" && Array.isArray(r.data) ? countsByCampaign(r.data) : null);
    })();
    return () => { alive = false; };
  }, [p.organizationId, listKey]);
  async function add(ev) {
    ev.preventDefault();
    if (!title.trim()) { setE("Enter a campaign name."); return; }
    setBusy(true);
    const r = await fundraiserApi.founder.createCampaign({ organizationId: p.organizationId, title: title.trim() });
    setBusy(false);
    if (stateFor(r) !== "ok") { setE(failureText(r)); return; }
    setTitle(""); setAdding(false);
    // ADDENDUM 1 / N4: the server always returns { campaign, termsIssue }; termsIssue.issued === false
    // (and only that) means the campaign was created without terms.
    setNote(createdWithoutTerms(r.data) ? "The campaign was created without terms, so it can’t start until the partner share is in place." : null);
    await onChanged();
  }
  return (
    <div style={box} data-testid="panel-campaigns">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <h3 style={{ ...h, fontSize: 17, margin: 0 }}>Campaigns</h3>
        {!adding && status === "active" ? <button type="button" style={btnGhost} data-testid="founder-add-campaign" onClick={() => setAdding(true)}>Add a campaign</button> : null}
      </div>
      <p style={help}>The partner normally creates and runs its campaigns. Add one here only when needed; it uses the partner’s terms and starts as a draft.</p>
      {adding ? (
        <form onSubmit={add} noValidate style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
          <input aria-label="Campaign name" data-testid="founder-campaign-name" value={title} onChange={(x) => { setTitle(x.target.value); setE(""); }} placeholder="Campaign name" style={{ ...input, flex: "1 1 220px" }} />
          <button type="submit" style={btn} disabled={busy}>{busy ? "Creating…" : "Create draft"}</button>
          <button type="button" style={btnGhost} onClick={() => { setAdding(false); setE(""); }}>Cancel</button>
          {e ? <p data-testid="founder-campaign-error" style={{ ...err, flexBasis: "100%" }}>{e}</p> : null}
        </form>
      ) : null}
      {note ? <p data-testid="founder-campaign-note" role="status" style={err}>{note}</p> : null}
      {extras && extras.error ? <p style={err}>This information couldn’t be loaded.</p>
        : list.length === 0 ? <Empty>No campaigns yet.</Empty> : (
          <div style={{ ...scrollX, marginTop: 10 }}><table style={table}>
            <thead><tr><th style={th}>Campaign</th><th style={th}>Status</th><th style={th}>Participants</th><th style={th}>Supporters</th></tr></thead>
            <tbody>{list.map((c) => {
              const k = counts ? counts.get(String(c.campaignId)) || { participants: 0, conversions: 0 } : null;
              const show = (v) => (counts === undefined ? "…" : k ? v : "—");
              return (
                <tr key={c.campaignId}><td style={td}>{c.title || c.campaignId}</td><td style={td}><Chip s={c.status} /></td>
                  <td style={td}>{show(k && k.participants)}</td><td style={td}>{show(k && k.conversions)}</td></tr>
              );
            })}</tbody>
          </table></div>
        )}
      {list.length > 0 ? <CampaignStatusChooser p={p} campaigns={list} onRefreshCampaigns={onRefreshCampaigns} /> : null}
    </div>
  );
}

// N6 — the existing per-campaign status control (start / pause / close), restored unchanged. A campaign
// is chosen from the server's own list; its economics history is read so activation is gated exactly
// as before (the server also refuses with TERMS_NOT_ACTIVE).
function CampaignStatusChooser({ p, campaigns, onRefreshCampaigns }) {
  const [campaignId, setCampaignId] = useState("");
  const [activeVersion, setActiveVersion] = useState(null);
  const pick = async (id) => {
    setCampaignId(id); setActiveVersion(null);
    if (!id) return;
    const hist = await fundraiserApi.founder.economicsHistory(id);
    const list = stateFor(hist) === "ok" && Array.isArray(hist.data) ? hist.data : [];
    setActiveVersion(list.slice().sort((x, y) => (y?.economicsVersion || 0) - (x?.economicsVersion || 0)).find((v) => v && v.status === "active") || null);
  };
  const campaign = campaigns.find((c) => c.campaignId === campaignId) || null;
  return (
    <div style={{ marginTop: 14 }} data-testid="campaign-status-chooser">
      <label style={{ display: "block", fontSize: ".85rem", color: "#5b4f42" }}>
        Change a campaign’s status{" "}
        <select data-testid="f4-campaign" value={campaignId} onChange={(e) => pick(e.target.value)} style={{ ...input, padding: 4 }}>
          <option value="">Choose a campaign…</option>
          {campaigns.map((c) => <option key={c.campaignId} value={c.campaignId}>{c.title || c.campaignId} ({c.status})</option>)}
        </select>
      </label>
      {campaign ? (
        <FounderCampaignStatusPanel
          key={`${p.organizationId}:${campaign.campaignId}`}
          organizationId={p.organizationId}
          organizationName={p.legalName}
          campaign={campaign}
          activeEconomicsVersion={activeVersion}
          onRefreshCampaigns={onRefreshCampaigns}
        />
      ) : null}
    </div>
  );
}

// ── Partner page: Reports & Analytics tab ─────────────────────────────────────────────────────
function AmountCells({ row }) {
  return (<>
    <td style={td}>{row ? money(row.recordedMinor) : money(0)}</td>
    <td style={td}>{row ? money(row.reversedMinor) : money(0)}</td>
    <td style={td}>{row ? money(row.netMinor) : money(0)}</td>
  </>);
}

function ReportsTab({ p, extras }) {
  const [data, setData] = useState({ loading: true });
  const [campaignId, setCampaignId] = useState(null); // N12 drill-down: organization → campaign → participant
  const orgId = p.organizationId;
  useEffect(() => {
    let alive = true;
    (async () => {
      const [pt, lt, byCampaign, byQuarter, qg, rec, pay, aud, res, ct] = await Promise.all([
        fundraiserApi.founder.participantTotals(orgId),
        fundraiserApi.founder.ledgerTotals(orgId),
        fundraiserApi.founder.reportTotals({ groupBy: "campaign", organizationId: orgId }),
        fundraiserApi.founder.reportTotals({ groupBy: "quarter", organizationId: orgId }),
        fundraiserApi.founder.quarterlyGross(orgId),
        fundraiserApi.founder.reconciliation(orgId),
        fundraiserApi.founder.payoutStatus(orgId),
        fundraiserApi.founder.audit(orgId),
        fundraiserApi.founder.results(orgId),
        fundraiserApi.founder.campaignTotals(orgId),
      ]);
      if (!alive) return;
      setData({
        counts: stateFor(pt) === "ok" && stateFor(lt) === "ok" ? { participants: pt.data && pt.data.participants, ledger: lt.data || {} } : null,
        byCampaign: stateFor(byCampaign) === "ok" ? totalsByKey(byCampaign.data) : null,
        byQuarter: stateFor(byQuarter) === "ok" && byQuarter.data && Array.isArray(byQuarter.data.rows) ? byQuarter.data.rows : null,
        quarterly: stateFor(qg) === "ok" ? quarterlyRows(qg.data, orgId) : null,
        attributionRecords: stateFor(pt) === "ok" && pt.data ? pt.data.attributionRecords : null,
        reconciliation: stateFor(rec) === "ok" ? rec.data : null,
        payout: pay.status === 503 ? { held: true, dormant: true } : (stateFor(pay) === "ok" ? pay.data : null),
        audit: stateFor(aud) === "ok" && Array.isArray(aud.data) ? aud.data : null,
        results: stateFor(res) === "ok" && Array.isArray(res.data) ? res.data : null,
        orgTotals: stateFor(ct) === "ok" && ct.data && ct.data.totals ? ct.data.totals : null,
      });
    })();
    return () => { alive = false; };
  }, [orgId]);
  const campaigns = (extras && extras.campaigns) || [];
  const unavailable = <p style={err} data-testid="report-unavailable">This information couldn’t be loaded.</p>;
  if (data.loading) return <div style={box}><StateView state="loading" /></div>;
  const n = (v) => (typeof v === "number" ? v : 0);
  const perCampaign = data.results ? countsByCampaign(data.results) : null;
  const c = campaignId ? campaigns.find((x) => x.campaignId === campaignId) || null : null;
  const cc = c && perCampaign ? perCampaign.get(String(c.campaignId)) || { participants: 0, visits: 0, scans: 0, conversions: 0 } : null;
  const dash = "\u2014";
  return (
    <>
      <div style={box} data-testid="panel-reports">
        <nav aria-label="Report level" style={{ fontSize: 14, marginBottom: 10 }}>
          <button type="button" data-testid="drill-org" onClick={() => setCampaignId(null)} style={{ background: "none", border: 0, padding: 0, color: c ? "#6b3a2a" : "#3b332b", fontWeight: c ? 400 : 700, cursor: "pointer", textDecoration: c ? "underline" : "none", font: "inherit" }}>{p.legalName || p.organizationId}</button>
          {c ? <> › <strong>{c.title || c.campaignId}</strong></> : null}
        </nav>
        <h3 style={{ ...h, fontSize: 17 }}>{c ? "Campaign" : "Organization"} activity</h3>
        {!c ? (data.counts ? (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }} data-testid="org-tiles">
            <Stat label="Participants" value={n(data.counts.participants)} />
            <Stat label="Visits" value={data.orgTotals ? n(data.orgTotals.visits) : dash} />
            <Stat label="Scans" value={data.orgTotals ? n(data.orgTotals.scans) : dash} />
            <Stat label="New supporters" value={n(data.counts.ledger.conversions)} />
            <Stat label="Renewals" value={n(data.counts.ledger.renewals)} />
            <Stat label="Refunds" value={n(data.counts.ledger.refunds)} />
          </div>
        ) : unavailable) : (cc ? (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }} data-testid="campaign-tiles">
            <Stat label="Participants" value={cc.participants} />
            <Stat label="Visits" value={cc.visits} />
            <Stat label="Scans" value={cc.scans} />
            <Stat label="New supporters" value={cc.conversions} />
          </div>
        ) : unavailable)}
        {!c ? (
          <>
            <h4 style={{ margin: "16px 0 6px" }}>By campaign</h4>
            {campaigns.length === 0 ? <Empty>No campaigns yet.</Empty> : (
              <div style={scrollX}><table style={table} data-testid="report-by-campaign">
                <thead><tr><th style={th}>Campaign</th><th style={th}>Status</th><th style={th}>Visits</th><th style={th}>Scans</th><th style={th}>New supporters</th><th style={th}>Partner share recorded</th><th style={th}>Reversed</th><th style={th}>Net</th><th style={th}></th></tr></thead>
                <tbody>{campaigns.map((x) => {
                  const k = perCampaign ? perCampaign.get(String(x.campaignId)) || { visits: 0, scans: 0, conversions: 0 } : null;
                  const a = data.byCampaign ? data.byCampaign.get(String(x.campaignId)) : undefined;
                  return (
                    <tr key={x.campaignId}><td style={td}>{x.title || x.campaignId}</td><td style={td}><Chip s={x.status} /></td>
                      <td style={td}>{k ? k.visits : dash}</td><td style={td}>{k ? k.scans : dash}</td><td style={td}>{k ? k.conversions : dash}</td>
                      {data.byCampaign ? <AmountCells row={a} /> : <><td style={td}>{dash}</td><td style={td}>{dash}</td><td style={td}>{dash}</td></>}
                      <td style={{ ...td, textAlign: "right" }}><button type="button" style={btnGhost} data-testid={`drill-${x.campaignId}`} onClick={() => setCampaignId(x.campaignId)}>Details</button></td></tr>
                  );
                })}</tbody>
              </table></div>
            )}
            {data.results === null || data.byCampaign === null ? unavailable : null}
          </>
        ) : (
          <>
            <h4 style={{ margin: "16px 0 6px" }}>By participant</h4>
            {data.results === null ? unavailable : (() => {
              const rows = data.results.filter((r) => r && String(r.campaignId) === String(c.campaignId) && r.status !== "removed");
              return rows.length === 0 ? <Empty>No participants yet.</Empty> : (
                <ul data-testid="participant-rows" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {rows.map((m) => (
                    <li key={m.participantId || m.attributionId} style={{ borderTop: "1px solid #f0ebe3", padding: "8px 0" }}>
                      <strong>{m.displayName || m.attributionId}</strong>
                      <div style={{ color: "#8a7c6c", fontSize: 13 }}>{n(m.visits)} visits · {n(m.scans)} scans · {n(m.conversions)} new supporters</div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </>
        )}
      </div>

      <div style={box} data-testid="report-recorded">
        <h3 style={{ ...h, fontSize: 17 }}>Partner share recorded</h3>
        {data.byQuarter === null ? unavailable : data.byQuarter.length === 0 ? <Empty>Nothing recorded yet.</Empty> : (
          <div style={scrollX}><table style={table}>
            <thead><tr><th style={th}>Quarter</th><th style={th}>Recorded</th><th style={th}>Reversed</th><th style={th}>Net</th></tr></thead>
            <tbody>{data.byQuarter.map((r) => (
              <tr key={String(r.key)}><td style={td}>{r.label || r.key}</td><AmountCells row={r} /></tr>
            ))}</tbody>
          </table></div>
        )}
        <p style={help}>Recorded amounts only; nothing here is an estimate. Payouts stay manual.</p>
        <p style={help} data-testid="report-branded-status">{BRANDED_GOODS_NOT_CALCULATED}</p>
      </div>

      <div style={box} data-testid="report-quarterly">
        <h3 style={{ ...h, fontSize: 17 }}>Quarterly qualifying revenue</h3>
        {data.quarterly === null ? unavailable : data.quarterly.rows.length === 0 ? <Empty>No qualifying revenue yet.</Empty> : (
          <div style={scrollX}><table style={table}>
            <thead><tr><th style={th}>Quarter funds settled</th>{data.quarterly.split
              ? <><th style={th}>Subscriptions</th><th style={th}>Branded Goods</th></>
              : <th style={th}>Qualifying revenue</th>}</tr></thead>
            <tbody>{data.quarterly.rows.map((r) => (
              <tr key={r.key}><td style={td}>{r.label}</td>{data.quarterly.split
                ? <><td style={td}>{money(r.subscriptionGrossCents)}</td><td style={td}>{money(r.brandedGoodsGrossCents)}</td></>
                : <td style={td}>{money(r.grossCents)}</td>}</tr>
            ))}</tbody>
          </table></div>
        )}
        <p style={help}>Revenue before the partner share. Payouts stay manual.</p>
      </div>

      <div style={{ ...box, background: "#fafafa" }} data-testid="reports-missing">
        <h3 style={{ ...h, fontSize: 17 }}>Not available yet</h3>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 14 }}>
          <li>Partner share amounts for Branded Goods purchases</li>
          <li>Amounts per participant</li>
          <li>A downloadable payout statement</li>
        </ul>
        <p style={help}>No figures are shown for these, because none are calculated today.</p>
      </div>

      {/* N6 — oversight items from the previous founder screen, restored (least prominent: last). */}
      <div style={box} data-testid="report-oversight">
        <h3 style={{ ...h, fontSize: 17 }}>Oversight</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <Stat label="Attribution records" value={n(data.attributionRecords)} />
        </div>
        <p data-testid="oversight-reconciliation">Reconciliation: {data.reconciliation ? (data.reconciliation.reconciled ? "✓ reconciled" : `drift ${data.reconciliation.driftCount ?? 0}`) : "couldn’t be loaded"}</p>
        {/* RR7 — a failed read is reported as such; 'Payouts have not started yet.' is said only from a real answer. */}
        <p data-testid="oversight-payout">{data.payout ? payoutOnlyLine(data.payout) : "Payout status couldn’t be loaded."}</p>
        <h4 style={{ margin: "12px 0 6px" }}>Audit history</h4>
        {data.audit === null ? unavailable : data.audit.length === 0 ? <Empty>No audit events yet.</Empty> : (
          <ul data-testid="oversight-audit" style={{ margin: 0, paddingLeft: 18, color: "#5b4f42" }}>
            {data.audit.slice(0, 8).map((a) => <li key={a.id}>{a.at} — {a.action} ({a.subjectType})</li>)}
          </ul>
        )}
      </div>
    </>
  );
}

const TABS = [["overview", "Overview"], ["campaigns", "Campaigns"], ["reports", "Reports & Analytics"]];

function PartnerPage({ p, extras, salespeople, onBack, onChanged, onRefreshCampaigns }) {
  const [tab, setTab] = useState("overview");
  const status = partnerStatus(p);
  return (
    <>
      <button type="button" style={btnGhost} onClick={onBack} data-testid="back-partners">← All partners</button>
      <div style={{ ...box, paddingBottom: 12 }} data-testid="partner-detail">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ ...h, margin: 0 }}>{p.legalName || p.organizationId}</h2>
          <Chip s={status} />
        </div>
        <div role="tablist" aria-label="Partner sections" style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", marginTop: 14, borderBottom: "1px solid #e6e2da" }}>
          {TABS.map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} data-testid={`tab-${k}`} onClick={() => setTab(k)}
              style={{ background: "none", border: 0, borderBottom: tab === k ? "3px solid #6b3a2a" : "3px solid transparent", padding: "8px 10px", font: "inherit", fontWeight: tab === k ? 700 : 400, color: tab === k ? "#4a3f35" : "#8a7c6c", cursor: "pointer" }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === "overview" ? (
        <>
          <Activation key={p.organizationId} p={p} status={status} extras={extras} onChanged={onChanged} />
          <Relationship p={p} salespeople={salespeople} onChanged={onChanged} />
          <PartnerShare p={p} status={status} extras={extras} onChanged={onChanged} />
        </>
      ) : null}
      {tab === "campaigns" ? <CampaignsTab p={p} status={status} extras={extras} onChanged={onChanged} onRefreshCampaigns={onRefreshCampaigns} /> : null}
      {tab === "reports" ? <ReportsTab p={p} extras={extras} /> : null}
    </>
  );
}

// Campaigns and terms in force for one organization. A failed read is reported, never invented.
// Terms come from the organization terms read (ADDENDUM 1); organizations created before it fall back
// to the open-window campaign version, the same fallback the server uses.
const isInForce = (t) => !!t && (t.status === undefined || t.status === "active");
async function readExtras(org) {
  const tr = await fundraiserApi.founder.orgTerms(org.organizationId);
  const t = stateFor(tr) === "ok" && tr.data ? tr.data.terms : null;
  const orgTerms = isInForce(t) ? { rules: partnerTermsRules(t), effectiveFrom: t.effectiveFrom } : null;
  // N9 — the founder terms view is { terms: in force, scheduled: future change | null, history }.
  const sv = stateFor(tr) === "ok" && tr.data ? tr.data.scheduled : null;
  const scheduled = sv ? { rules: partnerTermsRules(sv), effectiveFrom: sv.effectiveFrom } : null;
  // RR1 — a DRAFT or APPROVED organization terms version that never became active is "saved, not in
  // place yet". It is finished through the org-terms routes (approve / activate); change-rate is used
  // ONLY when an ACTIVE version exists (in force or scheduled), because the server refuses it otherwise
  // (400 NO_ACTIVE, economicsService.changeOrganizationRate).
  const pending = t && (t.status === "draft" || t.status === "approved") && t.versionId
    ? { versionId: t.versionId, status: t.status, rules: partnerTermsRules(t), complete: pendingTermsComplete(t) } : null;
  const hasActiveOrgTerms = !!orgTerms || !!scheduled;
  if (org.status === "applied") return { campaigns: [], activeTerms: orgTerms, scheduled, pending, hasActiveTerms: hasActiveOrgTerms, error: stateFor(tr) !== "ok" };
  const cmp = await fundraiserApi.founder.campaigns(org.organizationId);
  if (stateFor(cmp) !== "ok" || !Array.isArray(cmp.data)) return { error: true, campaigns: [], activeTerms: orgTerms, scheduled, pending, hasActiveTerms: hasActiveOrgTerms };
  if (orgTerms || scheduled) return { campaigns: cmp.data, activeTerms: orgTerms, scheduled, pending, hasActiveTerms: true };
  const hist = await Promise.all(cmp.data.map((c) => fundraiserApi.founder.economicsHistory(c.campaignId)));
  const lists = hist.map((x) => (stateFor(x) === "ok" && Array.isArray(x.data) ? x.data : null));
  const legacy = activeTermsFromHistories(lists.filter(Boolean));
  return { campaigns: cmp.data, activeTerms: legacy, pending, hasActiveTerms: !!legacy, historyIncomplete: lists.some((l) => l === null) };
}

export default function FounderFundraisingDashboard() {
  const [state, setState] = useState("loading");
  const [overview, setOverview] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [orgsError, setOrgsError] = useState(false);
  const [extras, setExtras] = useState({});
  const [salespeople, setSalespeople] = useState([]);
  const [screen, setScreen] = useState("home");
  const [openId, setOpenId] = useState(null);

  const loadExtras = useCallback(async (list) => {
    const pairs = await Promise.all(list.map(async (o) => [o.organizationId, await readExtras(o)]));
    setExtras(Object.fromEntries(pairs));
  }, []);

  const refreshOrgs = useCallback(async () => {
    const list = await fundraiserApi.founder.organizations();
    if (stateFor(list) !== "ok" || !Array.isArray(list.data)) { setOrgsError(true); return false; }
    setOrgsError(false);
    setOrgs(list.data);
    await loadExtras(list.data);
    return true;
  }, [loadExtras]);

  const load = useCallback(async () => {
    // Gate OFF ⇒ do not issue any fundraiser API request; render the truthful dormant state.
    if (!isFundraiserUiEnabled()) { setState("dormant"); return; }
    setState("loading");
    const ov = await fundraiserApi.founder.overview();
    const s = stateFor(ov);
    if (s !== "ok") { setState(s); return; }
    if (!ov.data || !ov.data.organizations) { setState("error"); return; } // fail closed on malformed
    setOverview(ov.data);
    setState("ok");
    // Active salespeople only (the server refuses an inactive one). A failed read leaves just "None".
    const sp = await salesAdminApi.list();
    const rows = sp && sp.ok && sp.data && Array.isArray(sp.data.salespeople) ? sp.data.salespeople : [];
    setSalespeople(rows.filter((r) => r && r.salespersonId && (r.status ? r.status === "active" : r.active !== false)));
    await refreshOrgs();
  }, [refreshOrgs]);
  useEffect(() => { load(); }, [load]);

  // N6 — re-read one organization's campaigns after a status change. Updates state ONLY when the read
  // succeeded; a failed refresh leaves the last server-confirmed campaigns standing (reported as stale).
  const refreshCampaigns = useCallback(async (organizationId) => {
    const res = await fundraiserApi.founder.campaigns(organizationId);
    if (stateFor(res) !== "ok" || !Array.isArray(res.data)) return false;
    setExtras((x) => ({ ...x, [organizationId]: { ...(x[organizationId] || {}), campaigns: res.data } }));
    return true;
  }, []);

  const refreshAll = useCallback(async () => {
    const ov = await fundraiserApi.founder.overview();
    if (stateFor(ov) === "ok" && ov.data && ov.data.organizations) setOverview(ov.data);
    return refreshOrgs();
  }, [refreshOrgs]);

  if (!isFundraiserUiEnabled()) return <StateView state="dormant" />;
  if (state !== "ok") return <div style={pageWrap}><h1 style={h}>Fundraising partners</h1><StateView state={state} onRetry={load} /></div>;

  const open = orgs.find((o) => o.organizationId === openId) || null;
  const statuses = orgs.map(partnerStatus);
  const conversions = overview && overview.ledger && typeof overview.ledger.conversions === "number" ? overview.ledger.conversions : null;
  return (
    <div style={pageWrap} data-testid="founder-fundraising">
      <h1 style={h}>Fundraising partners</h1>
      {screen === "register" ? <Register salespeople={salespeople} onSaved={refreshAll} onCancel={() => setScreen("home")} /> : null}
      {screen === "detail" && open ? (
        <PartnerPage key={open.organizationId} p={open} extras={extras[open.organizationId]} salespeople={salespeople}
          onRefreshCampaigns={() => refreshCampaigns(open.organizationId)}
          onBack={() => { setScreen("home"); setOpenId(null); }} onChanged={refreshAll} />
      ) : null}
      {screen === "home" || (screen === "detail" && !open) ? (
        <>
          <div style={box} data-testid="founder-overview">
            <h2 style={h}>Overview</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Stat label="Active partners" value={statuses.filter((s) => s === "active").length} />
              <Stat label="Not active yet" value={statuses.filter((s) => s === "prepared").length} />
              <Stat label="Campaigns" value={overview.campaigns ? overview.campaigns.total : 0} />
              {conversions !== null ? <Stat label="New supporters" value={conversions} /> : null}
            </div>
            <p style={help}>Recorded partner amounts are on each partner’s Reports &amp; Analytics tab.</p>
          </div>
          <div style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <h2 style={{ ...h, margin: 0 }}>Partners</h2>
              <button type="button" style={btn} data-testid="register-partner" onClick={() => setScreen("register")}>Register a partner</button>
            </div>
            {orgs.filter((o) => partnerStatus(o) === "prepared").map((o) => (
              <p key={o.organizationId} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px", fontSize: 13.5, margin: "0 0 8px" }}>
                <strong>Ready to activate:</strong> {o.legalName || o.organizationId}.
              </p>
            ))}
            {orgsError ? <p style={err} data-testid="orgs-error">This information couldn’t be loaded.</p>
              : orgs.length === 0 ? <Empty>No partners yet.</Empty> : (
              <div style={scrollX}><table style={table}>
                <thead><tr><th style={th}>Partner</th><th style={th}>Status</th><th style={th}>Partner share</th><th style={th}>Campaigns</th><th style={th}></th></tr></thead>
                <tbody>{orgs.map((o) => {
                  const x = extras[o.organizationId];
                  return (
                    <tr key={o.organizationId}>
                      <td style={td}>{o.legalName || o.organizationId}</td><td style={td}><Chip s={partnerStatus(o)} /></td>
                      <td style={{ ...td, fontSize: 13 }}>{!x ? "…" : x.error ? "—" : x.activeTerms ? termsLine(x.activeTerms.rules)
                        : x.scheduled ? `Scheduled from ${isoDate(x.scheduled.effectiveFrom)}: ${termsLine(x.scheduled.rules)}` : "Not set"}</td>
                      <td style={td}>{!x ? "…" : x.error ? "—" : x.campaigns.length}</td>
                      <td style={{ ...td, textAlign: "right" }}><button type="button" style={btnGhost} data-testid={`open-${o.organizationId}`} onClick={() => { setOpenId(o.organizationId); setScreen("detail"); if (o.status !== "applied") refreshCampaigns(o.organizationId); }}>Open</button></td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
