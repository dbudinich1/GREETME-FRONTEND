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
import { STATES, resolveOutcome, assignOutcome, messageFor } from "./partnerAdminAssign.js";
// Held org-salesperson field (eb9e450): the existing founder-only salesperson client.
import { salesAdminApi } from "../../api/salesAdmin.js";
import {
  money, isoDate, validateYearRates, buildYearRatesRule, dateToUtcInstant, termsLine,
  activeTermsFromHistories, partnerStatus, lastEndedInterval, failureText, totalsByKey, quarterlyRows, BRANDED_GOODS_NOT_CALCULATED,
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

// ── Register (save, not active) ───────────────────────────────────────────────────────────────
// Three steps. The partner share is set from the partner's page once it has a campaign: terms are
// kept per campaign (Report 87 C2), and a campaign can only exist once the partner is active.
const STEPS = ["Organization", "Partner administrator", "Review and save"];
function Register({ salespeople, onSaved, onCancel }) {
  const [step, setStep] = useState(0);
  const [org, setOrg] = useState({ legalName: "", orgType: "school", salespersonId: "" });
  const [email, setEmail] = useState("");
  const [found, setFound] = useState(null);
  const [findError, setFindError] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [saved, setSaved] = useState(null);
  const spName = (id) => { const s = salespeople.find((x) => x.salespersonId === id); return s ? (s.displayName || s.salespersonId) : "None"; };

  const next = () => {
    const e = {};
    if (step === 0 && !org.legalName.trim()) e.legalName = "Enter the organization’s legal name.";
    if (step === 1 && !found) { setFindError("Find the partner administrator’s account first."); return; }
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(step + 1);
  };

  async function save() {
    if (busy || !found) return;
    setBusy(true); setMessage(null);
    // `salespersonId` is sent ONLY when one was chosen; "None" sends exactly { legalName, orgType }.
    const body = { legalName: org.legalName.trim(), orgType: org.orgType };
    if (org.salespersonId) body.salespersonId = org.salespersonId;
    const created = await fundraiserApi.founder.createOrganization(body);
    if (stateFor(created) !== "ok" || !created.data || !created.data.organizationId) {
      setBusy(false); setMessage(`The partner was not saved. ${failureText(created)}`); return;
    }
    const assigned = assignOutcome(await fundraiserApi.founder.assignPartnerAdmin(created.data.organizationId, found.userId));
    setBusy(false);
    setSaved({ name: created.data.legalName || body.legalName, adminAssigned: assigned.state === STATES.ASSIGNED });
    if (onSaved) onSaved();
  }

  if (saved) {
    return (
      <div style={box} data-testid="register-saved">
        <h2 style={h}>Partner saved, not active yet</h2>
        <p>{saved.name} is set up{saved.adminAssigned ? " with its administrator" : ""}. Nothing is live: its administrator can’t open a partner dashboard and no sales count until you activate it from the partner’s page.</p>
        {!saved.adminAssigned ? <p data-testid="register-admin-failed" style={{ ...err, fontSize: ".9rem" }}>The administrator could not be assigned. Assign them from the partner’s page.</p> : null}
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
        <div data-testid="step-review" style={{ maxWidth: 560 }}>
          <table style={{ fontSize: 14, borderCollapse: "collapse" }}><tbody>
            {[["Organization", `${org.legalName.trim()} (${typeLabel(org.orgType)})`], ["Salesperson", org.salespersonId ? spName(org.salespersonId) : "None"],
              ["Partner administrator", found ? found.email : ""]].map(([a, b]) => (
              <tr key={a}><td style={{ padding: "4px 14px 4px 0", color: "#8a7c6c" }}>{a}</td><td style={{ padding: "4px 0", fontWeight: 600, overflowWrap: "anywhere" }}>{b}</td></tr>
            ))}
          </tbody></table>
          <p style={{ ...help, marginTop: 10 }}>Saving does not activate the partner. You activate it separately from its page when you’re ready.</p>
          <p style={help}>You set the partner share from the partner’s page once it is active and has a campaign.</p>
          {message ? <p data-testid="register-error" role="status" style={err}>{message}</p> : null}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        {step > 0 ? <button type="button" style={btnGhost} onClick={() => { setErrors({}); setStep(step - 1); }}>Back</button> : null}
        {step < 2 ? <button type="button" style={btn} data-testid="r-next" onClick={next}>Continue</button>
          : <button type="button" style={btn} data-testid="r-save" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save partner (not active yet)"}</button>}
        <button type="button" style={btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── Partner page: Overview ─────────────────────────────────────────────────────────────────────
const SUSPEND_WARNING = "Suspending stops this organization fundraising immediately: its public referral links stop resolving, " +
  "new checkout attribution is refused, and its partner administrators lose access. Existing records are kept and payouts remain held. Reinstating undoes it.";

function ReasonAction({ testid, title, warning, confirmText, danger, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <div role="dialog" aria-label={title} data-testid={testid} style={{ background: danger ? "#fef2f2" : "#f8fafc", border: `1px solid ${danger ? "#fecaca" : "#e2e8f0"}`, borderRadius: 8, padding: 10, marginTop: 8 }}>
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

function Activation({ p, status, onChanged }) {
  const [mode, setMode] = useState(null); // activate | suspend | end | reinstate
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const adminAssigned = Array.isArray(p.adminUserIds) && p.adminUserIds.length > 0;
  const checks = [["Organization saved", true], ["Partner administrator assigned", adminAssigned]];
  const ready = checks.every(([, v]) => v);
  const name = p.legalName || p.organizationId;

  async function run(call) {
    setBusy(true); setMessage(null);
    const res = await call();
    setBusy(false);
    if (stateFor(res) !== "ok") { const m = failureText(res); setMessage(m); return m; }
    setMode(null);
    await onChanged();
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
              onConfirm={(why) => run(() => fundraiserApi.founder.suspendOrganization(p.organizationId, why))} onCancel={() => setMode(null)} />
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
              onConfirm={(why) => run(() => fundraiserApi.founder.reinstateOrganization(p.organizationId, why))} onCancel={() => setMode(null)} />
          ) : null}
        </div>
      ) : (
        <p>Status: {String(p.status || "unknown")}</p>
      )}
      {message ? <p data-testid="activation-error" role="status" style={err}>{message}</p> : null}
    </div>
  );
}

function Relationship({ p, salespeople, onChanged }) {
  const [assigning, setAssigning] = useState(false);
  const [email, setEmail] = useState("");
  const [found, setFound] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const count = Array.isArray(p.adminUserIds) ? p.adminUserIds.length : 0;
  const rows = [["Type", typeLabel(p.orgType)], ["Partner administrator", count > 0 ? `${count} assigned` : "Not assigned"]];
  // The salesperson is shown only when the server's record carries the field; never guessed.
  if (Object.prototype.hasOwnProperty.call(p, "originationSalespersonId")) {
    const id = p.originationSalespersonId;
    const s = id ? salespeople.find((x) => x.salespersonId === id) : null;
    rows.push(["Salesperson", id ? (s && s.displayName ? s.displayName : id) : "None"]);
  }
  async function assign() {
    if (!found) { setError("Find the partner administrator’s account first."); return; }
    setBusy(true);
    const out = assignOutcome(await fundraiserApi.founder.assignPartnerAdmin(p.organizationId, found.userId));
    setBusy(false);
    if (out.state !== STATES.ASSIGNED) { setError(messageFor(out.state, out.reason)); return; }
    setAssigning(false); setFound(null); setEmail("");
    await onChanged();
  }
  return (
    <div style={box} data-testid="relationship">
      <h3 style={{ ...h, fontSize: 17 }}>Relationship</h3>
      <table style={{ fontSize: 14, borderCollapse: "collapse" }}><tbody>
        {rows.map(([a, b]) => (
          <tr key={a}><td style={{ padding: "4px 14px 4px 0", color: "#8a7c6c" }}>{a}</td><td style={{ padding: "4px 0", fontWeight: 600, overflowWrap: "anywhere" }}>{b}</td></tr>
        ))}
      </tbody></table>
      {count === 0 ? (!assigning ? (
        <button type="button" style={{ ...btnGhost, marginTop: 10 }} data-testid="assign-admin" onClick={() => setAssigning(true)}>Assign administrator</button>
      ) : (
        <div style={{ marginTop: 12, maxWidth: 520 }}>
          <AdminFinder email={email} setEmail={setEmail} found={found} setFound={setFound} error={error} setError={setError} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" style={btn} data-testid="assign-admin-yes" disabled={busy || !found} onClick={assign}>{busy ? "Assigning…" : "Assign administrator"}</button>
            <button type="button" style={btnGhost} onClick={() => { setAssigning(false); setError(null); }}>Cancel</button>
          </div>
        </div>
      )) : null}
    </div>
  );
}

function PartnerShare({ p, status, extras, onChanged }) {
  const [changing, setChanging] = useState(false);
  const [terms, setTerms] = useState({ y1: "", y2: "", y3: "" });
  const [from, setFrom] = useState("");
  const [treatments, setTreatments] = useState(EMPTY_TREATMENTS);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const active = extras && extras.activeTerms;
  const campaigns = (extras && extras.campaigns) || [];
  const canSet = status === "active";

  function cancel() { setChanging(false); setErrors({}); setMessage(null); setTerms({ y1: "", y2: "", y3: "" }); setFrom(""); setTreatments(EMPTY_TREATMENTS()); setReason(""); }

  async function save() {
    if (busy) return;
    const v = validateYearRates(terms);
    const e = { ...v.errors };
    const at = dateToUtcInstant(from);
    if (!at.ok) e.from = at.error;
    for (const k of Object.keys(TREATMENTS)) if (!TREATMENTS[k].includes(treatments[k])) e[k] = "Choose a treatment.";
    if (!reason.trim()) e.reason = "Say why these terms are being set.";
    setErrors(e); setMessage(null);
    if (Object.keys(e).length > 0) return; // zero requests while incomplete
    const rules = buildYearRatesRule(v.yearRates);
    const why = reason.trim();
    setBusy(true);
    if (active) {
      // Terms already in force ⇒ the existing org-wide change moves every campaign together.
      const r = await fundraiserApi.founder.changeOrganizationRate(p.organizationId, { rules, treatments: { ...treatments }, effectiveFrom: at.iso, reason: why });
      setBusy(false);
      if (stateFor(r) !== "ok") { setMessage(failureText(r)); return; }
    } else {
      // First terms: kept on the partner's campaigns (existing draft → approve → activate per campaign).
      const targets = campaigns.filter((c) => c && c.status !== "closed");
      if (targets.length === 0) { setBusy(false); setMessage("Add a campaign first (Campaigns tab). The partner share is kept on the partner’s campaigns; later campaigns receive it automatically."); return; }
      let done = 0;
      for (const c of targets) {
        const d = await fundraiserApi.founder.draftEconomics({ organizationId: p.organizationId, campaignId: c.campaignId, rules, treatments: { ...treatments } });
        const dId = d && d.data && (d.data.id || d.data.versionId);
        const a = stateFor(d) === "ok" && dId ? await fundraiserApi.founder.approveEconomics(p.organizationId, dId, why) : d;
        const aId = a && a.data && (a.data.id || a.data.versionId);
        const act = stateFor(a) === "ok" && aId ? await fundraiserApi.founder.activateEconomics(p.organizationId, aId, { effectiveFrom: at.iso, activationReason: why }) : a;
        if (stateFor(act) !== "ok") {
          setBusy(false);
          setMessage(`${failureText(act)} The partner share is in place on ${done} of ${targets.length} campaigns.`);
          await onChanged();
          return;
        }
        done += 1;
      }
      setBusy(false);
    }
    cancel();
    await onChanged();
  }

  return (
    <div style={box} data-testid="partner-share">
      <h3 style={{ ...h, fontSize: 17 }}>Partner share</h3>
      {extras && extras.error ? <p style={err}>This information couldn’t be loaded.</p> : (
        <p style={{ margin: 0, fontSize: 15 }} data-testid="terms-line"><strong>{active ? termsLine(active.rules) : "Not set"}</strong>{active && active.effectiveFrom ? ` · takes effect ${isoDate(active.effectiveFrom)}` : ""}</p>
      )}
      <p style={help}>Each customer’s Year 1 starts at their first qualifying purchase through this partner.</p>
      {!canSet ? <p style={help} data-testid="terms-after-activation">You set the partner share once the partner is active and has a campaign.</p> : null}
      {canSet && !changing ? (
        <button type="button" style={{ ...btnGhost, marginTop: 10 }} onClick={() => setChanging(true)} data-testid="change-terms">{active ? "Change terms" : "Set terms"}</button>
      ) : null}
      {canSet && changing ? (
        <div style={{ marginTop: 12 }}>
          <TermsForm value={terms} onChange={(x) => { setTerms(x); setErrors({}); }} effectiveFrom={from} onEffectiveFrom={(x) => { setFrom(x); setErrors({}); }} errors={errors} />
          <fieldset data-testid="terms-treatments" style={{ border: "1px solid #e6e2da", borderRadius: 8, padding: ".6rem", margin: "12px 0 0" }}>
            <legend style={{ fontSize: ".85rem", fontWeight: 700 }}>Treatments</legend>
            {Object.entries(TREATMENTS).map(([key, allowed]) => (
              <label key={key} style={{ display: "block", margin: ".3rem 0", fontSize: ".85rem" }}>
                {TREATMENT_FIELD_LABELS[key]}{" "}
                <select data-testid={`terms-${key}`} value={treatments[key]} onChange={(ev) => { setTreatments({ ...treatments, [key]: ev.target.value }); setErrors({}); }} style={{ ...input, padding: 4 }}>
                  <option value="">Choose…</option>
                  {allowed.map((a) => <option key={a} value={a}>{TREATMENT_VALUE_LABELS[a]}</option>)}
                </select>
                {errors[key] ? <span style={{ color: "#b00" }}> {errors[key]}</span> : null}
              </label>
            ))}
          </fieldset>
          <div style={{ marginTop: 12 }}>
            <label htmlFor="terms-reason" style={label}>Reason (required &mdash; it is recorded in the audit history)</label>
            <input id="terms-reason" data-testid="terms-reason" value={reason} onChange={(e) => { setReason(e.target.value); setErrors({}); }} style={{ ...input, width: "100%", maxWidth: 420 }} />
            {errors.reason ? <p style={err}>{errors.reason}</p> : null}
          </div>
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

// ── Partner page: Campaigns tab ───────────────────────────────────────────────────────────────
function CampaignsTab({ p, status, extras, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [e, setE] = useState("");
  const [busy, setBusy] = useState(false);
  const list = (extras && extras.campaigns) || [];
  async function add(ev) {
    ev.preventDefault();
    if (!title.trim()) { setE("Enter a campaign name."); return; }
    setBusy(true);
    const r = await fundraiserApi.founder.createCampaign({ organizationId: p.organizationId, title: title.trim() });
    setBusy(false);
    if (stateFor(r) !== "ok") { setE(failureText(r)); return; }
    setTitle(""); setAdding(false);
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
      {extras && extras.error ? <p style={err}>This information couldn’t be loaded.</p>
        : list.length === 0 ? <Empty>No campaigns yet.</Empty> : (
          <div style={{ ...scrollX, marginTop: 10 }}><table style={table}>
            <thead><tr><th style={th}>Campaign</th><th style={th}>Status</th></tr></thead>
            <tbody>{list.map((c) => (
              <tr key={c.campaignId}><td style={td}>{c.title || c.campaignId}</td><td style={td}><Chip s={c.status} /></td></tr>
            ))}</tbody>
          </table></div>
        )}
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
  const orgId = p.organizationId;
  useEffect(() => {
    let alive = true;
    (async () => {
      const [pt, lt, byCampaign, byQuarter, qg] = await Promise.all([
        fundraiserApi.founder.participantTotals(orgId),
        fundraiserApi.founder.ledgerTotals(orgId),
        fundraiserApi.founder.reportTotals({ groupBy: "campaign", organizationId: orgId }),
        fundraiserApi.founder.reportTotals({ groupBy: "quarter", organizationId: orgId }),
        fundraiserApi.founder.quarterlyGross(orgId),
      ]);
      if (!alive) return;
      setData({
        counts: stateFor(pt) === "ok" && stateFor(lt) === "ok" ? { participants: pt.data && pt.data.participants, ledger: lt.data || {} } : null,
        byCampaign: stateFor(byCampaign) === "ok" ? totalsByKey(byCampaign.data) : null,
        byQuarter: stateFor(byQuarter) === "ok" && byQuarter.data && Array.isArray(byQuarter.data.rows) ? byQuarter.data.rows : null,
        quarterly: stateFor(qg) === "ok" ? quarterlyRows(qg.data, orgId) : null,
      });
    })();
    return () => { alive = false; };
  }, [orgId]);
  const campaigns = (extras && extras.campaigns) || [];
  const unavailable = <p style={err} data-testid="report-unavailable">This information couldn’t be loaded.</p>;
  if (data.loading) return <div style={box}><StateView state="loading" /></div>;
  const n = (v) => (typeof v === "number" ? v : 0);
  return (
    <>
      <div style={box} data-testid="panel-reports">
        <p style={{ fontSize: 14, margin: "0 0 10px" }}>{p.legalName || p.organizationId}</p>
        <h3 style={{ ...h, fontSize: 17 }}>Organization activity</h3>
        {data.counts ? (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Stat label="Participants" value={n(data.counts.participants)} />
            <Stat label="New supporters" value={n(data.counts.ledger.conversions)} />
            <Stat label="Renewals" value={n(data.counts.ledger.renewals)} />
            <Stat label="Refunds" value={n(data.counts.ledger.refunds)} />
          </div>
        ) : unavailable}
        <h4 style={{ margin: "16px 0 6px" }}>By campaign</h4>
        {campaigns.length === 0 ? <Empty>No campaigns yet.</Empty> : data.byCampaign === null ? unavailable : (
          <div style={scrollX}><table style={table} data-testid="report-by-campaign">
            <thead><tr><th style={th}>Campaign</th><th style={th}>Status</th><th style={th}>Partner share recorded</th><th style={th}>Reversed</th><th style={th}>Net</th></tr></thead>
            <tbody>{campaigns.map((c) => (
              <tr key={c.campaignId}><td style={td}>{c.title || c.campaignId}</td><td style={td}><Chip s={c.status} /></td><AmountCells row={data.byCampaign.get(String(c.campaignId))} /></tr>
            ))}</tbody>
          </table></div>
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
    </>
  );
}

const TABS = [["overview", "Overview"], ["campaigns", "Campaigns"], ["reports", "Reports & Analytics"]];

function PartnerPage({ p, extras, salespeople, onBack, onChanged }) {
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
          <Activation key={`${p.organizationId}:${p.status}:${status}`} p={p} status={status} onChanged={onChanged} />
          <Relationship p={p} salespeople={salespeople} onChanged={onChanged} />
          <PartnerShare p={p} status={status} extras={extras} onChanged={onChanged} />
        </>
      ) : null}
      {tab === "campaigns" ? <CampaignsTab p={p} status={status} extras={extras} onChanged={onChanged} /> : null}
      {tab === "reports" ? <ReportsTab p={p} extras={extras} /> : null}
    </>
  );
}

// Campaigns and terms in force for one organization. A failed read is reported, never invented.
async function readExtras(org) {
  if (org.status === "applied") return { campaigns: [], activeTerms: null };
  const cmp = await fundraiserApi.founder.campaigns(org.organizationId);
  if (stateFor(cmp) !== "ok" || !Array.isArray(cmp.data)) return { error: true, campaigns: [], activeTerms: null };
  const hist = await Promise.all(cmp.data.map((c) => fundraiserApi.founder.economicsHistory(c.campaignId)));
  const lists = hist.map((x) => (stateFor(x) === "ok" && Array.isArray(x.data) ? x.data : null));
  return { campaigns: cmp.data, activeTerms: activeTermsFromHistories(lists.filter(Boolean)), historyIncomplete: lists.some((l) => l === null) };
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
    if (stateFor(list) !== "ok" || !Array.isArray(list.data)) { setOrgsError(true); return; }
    setOrgsError(false);
    setOrgs(list.data);
    await loadExtras(list.data);
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

  const refreshAll = useCallback(async () => {
    const ov = await fundraiserApi.founder.overview();
    if (stateFor(ov) === "ok" && ov.data && ov.data.organizations) setOverview(ov.data);
    await refreshOrgs();
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
                      <td style={{ ...td, fontSize: 13 }}>{!x ? "…" : x.error ? "—" : (x.activeTerms ? termsLine(x.activeTerms.rules) : "Not set")}</td>
                      <td style={td}>{!x ? "…" : x.error ? "—" : x.campaigns.length}</td>
                      <td style={{ ...td, textAlign: "right" }}><button type="button" style={btnGhost} data-testid={`open-${o.organizationId}`} onClick={() => { setOpenId(o.organizationId); setScreen("detail"); }}>Open</button></td>
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
