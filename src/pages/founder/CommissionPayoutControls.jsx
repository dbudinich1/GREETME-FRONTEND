// src/pages/founder/CommissionPayoutControls.jsx
//
// MANUAL commission payout controls for ONE ledger row (founder decision 2026-10-07 #12).
// The founder pays commission by hand, outside Greet-Me, and records it here:
//   pending --Approve--> approved --Record payment--> paid
// Nothing here moves money. Each step has an in-page confirmation (no browser dialogs); the server's
// returned totals and entry replace what is on screen (never applied optimistically).
//
// The server is the authority (founder-only, ETag-conditional, refuses reversed entries): this only decides which
// button is worth offering.
import { useState } from "react";
import { salesAdminErrorMessage } from "../../api/salesAdmin.js";

const note = { fontSize: ".78rem", color: "var(--text-secondary)", margin: ".3rem 0 0" };
const todayIso = () => new Date().toISOString().slice(0, 10);

/** True when this row is a reversal, or some other row reverses it: nothing may be approved or paid on it. */
export function isReversedRow(entry, reversedIds) {
  if (!entry) return true;
  if (entry.reversalOf || entry.status === "reversed") return true;
  if (Number(entry.salespersonCommissionMinor) <= 0) return true;
  return reversedIds instanceof Set && reversedIds.has(entry.id);
}

export default function CommissionPayoutControls({ api, salespersonId, entry, reversedIds, onDone }) {
  const [step, setStep] = useState(null);      // null | "approve" | "pay"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(todayIso());
  const [payNote, setPayNote] = useState("");

  const canApprove = typeof api.approveCommission === "function";
  const canPay = typeof api.recordCommissionPayment === "function";
  const reversed = isReversedRow(entry, reversedIds);

  if (entry.status === "paid") {
    return (
      <p style={note} data-testid="fcc-payout-paid">
        Paid by hand{entry.paidOn ? ` on ${entry.paidOn}` : ""}{entry.paymentReference ? ` · ref ${entry.paymentReference}` : ""}
      </p>
    );
  }
  if (entry.status !== "pending" && entry.status !== "approved") return null;
  if (reversed) {
    return entry.reversalOf || entry.status === "reversed" ? null : (
      <p style={note} data-testid="fcc-payout-reversed">Reversed by a refund or dispute. It cannot be approved or paid.</p>
    );
  }
  const isPending = entry.status === "pending";
  if ((isPending && !canApprove) || (!isPending && !canPay)) return null;

  async function run() {
    if (busy) return;
    setBusy(true); setError(null);
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
        <button type="button" className="btn-secondary" style={{ padding: ".25rem .7rem" }}
          data-testid={isPending ? "fcc-approve" : "fcc-record-payment"} onClick={() => { setError(null); setStep(isPending ? "approve" : "pay"); }}>
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
          Approve this commission? Approving does not pay anyone. You pay it yourself, then record the payment here.
        </p>
      ) : (
        <>
          <p style={{ fontSize: ".84rem", margin: "0 0 .5rem" }}>
            Record that you already paid this commission by hand. Greet Me does not send any money.
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
      {error ? <p data-testid="fcc-payout-error" style={{ color: "var(--warning)", fontSize: ".84rem", margin: ".5rem 0 0" }}>{error}</p> : null}
      <div style={{ display: "flex", gap: ".5rem", marginTop: ".6rem" }}>
        <button type="button" className="btn-primary" data-testid="fcc-payout-go"
          disabled={busy || (step === "pay" && (reference.trim() === "" || !paidOn))} onClick={run}>
          {busy ? "Saving…" : step === "approve" ? "Confirm approval" : "Confirm payment recorded"}
        </button>
        <button type="button" className="btn-secondary" data-testid="fcc-payout-cancel" disabled={busy}
          onClick={() => { setStep(null); setError(null); }}>Cancel</button>
      </div>
    </div>
  );
}
