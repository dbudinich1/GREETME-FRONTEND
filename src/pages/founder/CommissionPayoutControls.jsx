// src/pages/founder/CommissionPayoutControls.jsx
//
// MANUAL commission payout controls for ONE ledger row (founder decision 2026-10-07 #12).
// The founder pays commission by hand, outside Greet-Me, and records it here:
//   pending --Approve--> approved --Record payment--> paid
// Nothing here moves money. Each step has an in-page confirmation (no browser dialogs); the server's
// returned totals and entry replace what is on screen (never applied optimistically).
//
// The server is the authority (founder-only, ETag-conditional, refuses an entry with nothing left to pay): this only
// decides which button is worth offering.
//
// PARTIAL REFUNDS (T5 R2 item C): a refund appends a separate negative reversal row and never changes the original.
// What is payable is the NET - the original minus every reversal row pointing at it - exactly as the backend computes
// it in services/sales/commissionPayout.js (netPayable). The ledger API returns raw rows and no net for an unpaid
// entry, so the net is derived here from the reversal rows already on the page (the full ledger for this salesperson).
import { useState } from "react";
import { salesAdminErrorMessage } from "../../api/salesAdmin.js";

const note = { fontSize: ".78rem", color: "var(--text-secondary)", margin: ".3rem 0 0" };
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Same unit rule as the ledger: minor units, currency printed only when the server supplied one. */
function minorUnits(value, currency) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const n = value.toLocaleString("en-US");
  return currency ? `${n} ${currency} (minor units)` : `${n} (minor units)`;
}

/** A reversal row itself: never has a payout control of its own. */
export function isReversalRow(entry) {
  return !entry || Boolean(entry.reversalOf) || entry.status === "reversed";
}

/**
 * Mirror of the backend netPayable(): original commission minus |amount| of every row whose reversalOf is this entry.
 * Returns { originalMinor, reversedMinor, netMinor, reversalCount, payable }.
 */
export function commissionNet(entry, ledgerEntries) {
  const originalMinor = Number(entry && entry.salespersonCommissionMinor);
  const reversals = (Array.isArray(ledgerEntries) ? ledgerEntries : [])
    .filter((r) => r && r.reversalOf && entry && String(r.reversalOf) === String(entry.id));
  const reversedMinor = reversals.reduce((a, r) => a + Math.abs(Number(r.salespersonCommissionMinor) || 0), 0);
  const netMinor = originalMinor - reversedMinor;
  const payable = !isReversalRow(entry) && Number.isSafeInteger(originalMinor) && originalMinor > 0 && netMinor > 0;
  return { originalMinor, reversedMinor, netMinor, reversalCount: reversals.length, payable };
}

export default function CommissionPayoutControls({ api, salespersonId, entry, ledgerEntries, onDone, onLedger }) {
  const [step, setStep] = useState(null);      // null | "approve" | "pay"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(todayIso());
  const [payNote, setPayNote] = useState("");
  // STALE PAGE (T5 R2 follow-up note 1): the ledger is re-read right before Approve / Record payment. `freshRows`
  // holds that re-read so the amount shown is the server's current net; `shownNet` is the net the open confirmation
  // displayed. If the re-read net differs, nothing is sent and the founder must confirm the new amount again.
  const [freshRows, setFreshRows] = useState(null);
  const [shownNet, setShownNet] = useState(null);
  const [changedNotice, setChangedNotice] = useState(null);

  const canApprove = typeof api.approveCommission === "function";
  const canPay = typeof api.recordCommissionPayment === "function";
  if (isReversalRow(entry)) return null;
  const net = commissionNet(entry, freshRows || ledgerEntries);
  const netText = minorUnits(net.netMinor, entry.currency);
  // Shown only when refunds or disputes touched this entry, so an untouched row reads exactly as before.
  // Reversal rows come from refunds AND lost disputes (chargebacks), so the wording names both.
  const netLine = net.reversalCount > 0 ? (
    <p style={note} data-testid="fcc-payout-net">
      Original {minorUnits(net.originalMinor, entry.currency)} {"·"} refunds or disputes {"−"}{minorUnits(net.reversedMinor, entry.currency)}
      {" · "}<strong>Net after refunds or disputes: {net.netMinor > 0 ? netText : minorUnits(0, entry.currency)}</strong>
    </p>
  ) : null;

  if (entry.status === "paid") {
    const paidAmount = typeof entry.paidAmountMinor === "number" && entry.paidAmountMinor !== net.originalMinor
      ? ` · amount ${minorUnits(entry.paidAmountMinor, entry.currency)}` : "";
    return (
      <p style={note} data-testid="fcc-payout-paid">
        Paid by hand{entry.paidOn ? ` on ${entry.paidOn}` : ""}{entry.paymentReference ? ` · ref ${entry.paymentReference}` : ""}{paidAmount}
      </p>
    );
  }
  if (entry.status !== "pending" && entry.status !== "approved") return null;
  if (!net.payable) {
    return (
      <>
        {netLine}
        <p style={note} data-testid="fcc-payout-reversed">
          {net.reversalCount > 0 ? "Fully reversed by refunds or disputes — nothing to pay." : "Nothing to pay on this entry."}
        </p>
      </>
    );
  }
  const isPending = entry.status === "pending";
  if ((isPending && !canApprove) || (!isPending && !canPay)) return netLine;
  const amountClause = net.reversalCount > 0 ? ` The amount to pay is the net after refunds or disputes: ${netText}.` : "";
  const changedLine = changedNotice ? (
    <p data-testid="fcc-payout-changed" style={{ color: "var(--warning)", fontSize: ".84rem", margin: ".4rem 0" }}>{changedNotice}</p>
  ) : null;

  /** Re-read the ledger. Returns true only when this entry's status and net are what the confirmation showed. */
  async function stillAsShown() {
    if (typeof api.ledger !== "function") return true;   // a client without reads: the server still recomputes at write
    const led = await api.ledger(salespersonId);
    const rows = led && led.ok && led.data && Array.isArray(led.data.entries) ? led.data.entries : null;
    if (!rows) { setError("Couldn’t re-check the current amount, so nothing was saved. Try again."); return false; }
    setFreshRows(rows);
    if (typeof onLedger === "function") onLedger(rows);
    const current = rows.find((r) => r && String(r.id) === String(entry.id));
    if (!current || current.status !== entry.status) {
      setStep(null);
      setChangedNotice("This commission changed since the page was loaded, so nothing was saved. Check its latest status before you continue.");
      return false;
    }
    const fresh = commissionNet(current, rows);
    if (!fresh.payable) { setStep(null); return false; }   // the row now renders the "nothing to pay" block
    if (fresh.netMinor !== shownNet) {
      setShownNet(fresh.netMinor);
      setChangedNotice(`The amount changed since this page was loaded, so nothing was saved. The amount to pay is now ${minorUnits(fresh.netMinor, entry.currency)}. Confirm again if that is right.`);
      return false;
    }
    return true;
  }

  async function run() {
    if (busy) return;
    setBusy(true); setError(null); setChangedNotice(null);
    if (!(await stillAsShown())) { setBusy(false); return; }
    const res = isPending
      ? await api.approveCommission(salespersonId, entry.id)
      : await api.recordCommissionPayment(salespersonId, entry.id, { reference: reference.trim(), paidOn, note: payNote.trim() });
    setBusy(false);
    if (!res || !res.ok) { setError(salesAdminErrorMessage(res, { context: "payout" })); return; }
    setStep(null); setReference(""); setPayNote("");
    onDone(res.data || {});
  }

  if (step === null) {
    return (
      <div style={{ marginTop: ".4rem" }}>
        {netLine}
        {changedLine}
        <button type="button" className="btn-secondary" style={{ padding: ".25rem .7rem" }}
          data-testid={isPending ? "fcc-approve" : "fcc-record-payment"}
          onClick={() => { setError(null); setChangedNotice(null); setShownNet(net.netMinor); setStep(isPending ? "approve" : "pay"); }}>
          {isPending ? "Approve" : "Record payment"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: ".5rem", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: ".6rem" }}
      role="group" aria-label={step === "approve" ? "Confirm approval" : "Confirm payment record"} data-testid="fcc-payout-confirm">
      {step === "approve" ? (
        <p style={{ fontSize: ".84rem", margin: 0 }}>
          Approve this commission? Approving does not pay anyone. You pay it yourself, then record the payment here.{amountClause}
        </p>
      ) : (
        <>
          <p style={{ fontSize: ".84rem", margin: "0 0 .5rem" }}>
            Record that you already paid this commission by hand. Greet Me does not send any money.{amountClause}
          </p>
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
            <input data-testid="fcc-pay-reference" aria-label="Payment reference" placeholder="Reference (required)" maxLength={120}
              value={reference} onChange={(ev) => setReference(ev.target.value)} style={{ maxWidth: 220 }} />
            <input data-testid="fcc-pay-date" aria-label="Date paid" type="date" value={paidOn}
              onChange={(ev) => setPaidOn(ev.target.value)} style={{ maxWidth: 170 }} />
            <input data-testid="fcc-pay-note" aria-label="Note (optional)" placeholder="Note (optional)" maxLength={500}
              value={payNote} onChange={(ev) => setPayNote(ev.target.value)} style={{ maxWidth: 260 }} />
          </div>
        </>
      )}
      {changedLine}
      {error ? <p data-testid="fcc-payout-error" style={{ color: "var(--warning)", fontSize: ".84rem", margin: ".5rem 0 0" }}>{error}</p> : null}
      <div style={{ display: "flex", gap: ".5rem", marginTop: ".6rem" }}>
        <button type="button" className="btn-primary" data-testid="fcc-payout-go"
          disabled={busy || (step === "pay" && (reference.trim() === "" || !paidOn))} onClick={run}>
          {busy ? "Saving…" : step === "approve" ? "Confirm approval" : "Confirm payment recorded"}
        </button>
        <button type="button" className="btn-secondary" data-testid="fcc-payout-cancel" disabled={busy}
          onClick={() => { setStep(null); setError(null); setChangedNotice(null); }}>Cancel</button>
      </div>
    </div>
  );
}
