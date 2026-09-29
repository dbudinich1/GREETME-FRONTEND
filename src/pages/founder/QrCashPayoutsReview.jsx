// src/pages/founder/QrCashPayoutsReview.jsx — TEAM 5 (2026-09-29).
//
// A read-only detail list of unresolved QR Cash payouts, linked from Founder Central Command's
// "Review Payouts" action. Deliberately read-only: no founder-authenticated action exists
// anywhere in this codebase to mark a payout resolved today (only an internal, admin-key-gated
// route does that — routes/giftRoutes.js#admin/fulfill, which is Team 1's canonical territory
// and is NOT exposed here). This page cannot execute or resolve a payout; it can only show what
// is currently unresolved, using the same authoritative data the summary card already reads.

import { useEffect, useState } from "react";
import { isFounder } from "../../utils/accountState.js";
import { founderCommandApi } from "../../api/founderCommand.js";

function readUser() {
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}

function money(cents) {
  return Number.isFinite(cents) ? `$${(cents / 100).toFixed(2)}` : "—";
}

export default function QrCashPayoutsReview({ user: injectedUser } = {}) {
  const user = injectedUser !== undefined ? injectedUser : readUser();
  const founder = isFounder(user);
  const [state, setState] = useState({ loading: true, payouts: null, error: null });

  useEffect(() => {
    if (!founder) return undefined;
    let alive = true;
    (async () => {
      const res = await founderCommandApi.qrCashPayoutList();
      if (!alive) return;
      if (res.ok && res.data && res.data.ok) {
        setState({ loading: false, payouts: res.data.payouts, error: null });
      } else {
        setState({ loading: false, payouts: null, error: "Couldn't load unresolved payouts." });
      }
    })();
    return () => { alive = false; };
  }, [founder]);

  if (!founder) {
    return (
      <div style={{ padding: "2rem" }} data-testid="qr-cash-review-denied">
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Not available</h1>
        <p style={{ marginTop: ".5rem", color: "#605c78" }}>This area is limited to the founder account.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }} data-testid="qr-cash-payouts-review">
      <a href="#/dashboard/founder/command" style={{ fontSize: ".85rem", color: "#4F2D7F" }}>
        ← Founder Central Command
      </a>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.3rem", margin: "10px 0 4px" }}>
        Unresolved QR Cash Payouts
      </h1>
      <p style={{ color: "#605c78", fontSize: ".85rem", margin: "0 0 16px" }}>
        Read-only. Resolving a payout still requires the existing internal tool — nothing here can mark one complete.
      </p>

      {state.loading ? (
        <p data-testid="qr-cash-review-loading">Loading…</p>
      ) : state.error ? (
        <p data-testid="qr-cash-review-error" style={{ color: "#b3261e" }}>{state.error}</p>
      ) : state.payouts.length === 0 ? (
        <p data-testid="qr-cash-review-empty">No unresolved QR Cash payouts.</p>
      ) : (
        <table data-testid="qr-cash-review-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: ".85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(27,24,48,.15)" }}>
              <th style={{ padding: "8px 6px" }}>Recipient</th>
              <th style={{ padding: "8px 6px" }}>Amount</th>
              <th style={{ padding: "8px 6px" }}>Claimed</th>
              <th style={{ padding: "8px 6px" }}>Flagged</th>
            </tr>
          </thead>
          <tbody>
            {state.payouts.map((p) => (
              <tr key={p.id} data-testid={`qr-cash-review-row-${p.id}`} style={{ borderBottom: "1px solid rgba(27,24,48,.06)" }}>
                <td style={{ padding: "8px 6px" }}>{p.recipientName || "—"}</td>
                <td style={{ padding: "8px 6px" }}>{money(p.giftAmountCents)}</td>
                <td style={{ padding: "8px 6px" }}>{p.claimedAt ? new Date(p.claimedAt).toLocaleDateString() : "—"}</td>
                <td style={{ padding: "8px 6px" }}>{p.flagged ? "Yes" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
