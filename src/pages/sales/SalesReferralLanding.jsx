// src/pages/sales/SalesReferralLanding.jsx
//
// TEAM B (SALES S1) — PUBLIC salesperson referral landing at /#/s/:token.
//
// This is the page that removes the JSON dead end: a prospect who opens a salesperson's link
// lands on an ordinary, usable Greet-Me welcome and continues into the normal sign-up journey.
// They never see, copy, or re-enter a token.
//
// ── WHAT THIS PAGE DOES, IN ORDER ───────────────────────────────────────────
//   1. reads the opaque token from the hash route into an IN-MEMORY variable
//   2. runs the local syntax/shape check (a sanity check, never verification)
//   3. preserves it in the transient carrier
//   4. SCRUBS the address bar to #/s/redacted — before anything can observe the raw value
//   5. asks the SERVER to validate it, with the token in a POST BODY, never in a URL
//
// The server is the only authority: this page derives no salesperson identity, decodes nothing,
// and is told only `valid: true|false`. If the server issues the sealed HttpOnly attribution
// cookie, it does so on that response — and this JavaScript can neither read nor influence it.
//
// Step 4 precedes step 5 deliberately. The address is clean before any network call, so a token
// can never be observed in a referrer, in history, or by an analytics tag mid-flight.

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { captureToken, isValidTokenSyntax, scrubTokenFromAddressBar } from "./salesAttributionCarrier.js";
import { resolveSalesReferral } from "../../api/api";

const wrap = { minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 };
const card = { maxWidth: 460, width: "100%", background: "#fffdf8", border: "1px solid #e7e0d4", borderRadius: 14, padding: "28px 26px", textAlign: "center", fontFamily: "Georgia, serif" };
const btn = { display: "inline-block", marginTop: 18, padding: "12px 22px", borderRadius: 10, border: "none", background: "#6b3a2a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "1rem" };
const muted = { color: "#6a5f86", fontSize: ".92rem", lineHeight: 1.6 };
const link = { display: "inline-block", marginTop: 14, color: "#6b3a2a", fontSize: ".9rem" };

/** Truthful states. Each says exactly what is known, and never more. */
const STATE = Object.freeze({
  VALIDATING: "validating",
  VALID: "valid",
  INVALID: "invalid",
  UNAVAILABLE: "unavailable",
});

export default function SalesReferralLanding() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState(STATE.VALIDATING);

  useEffect(() => {
    let cancelled = false;

    // 1–2 · in-memory only, then the local shape check.
    const raw = typeof token === "string" ? token : null;
    const syntacticallyValid = isValidTokenSyntax(raw);

    // 3 · preserve BEFORE the address changes, so nothing is lost by the scrub.
    captureToken(raw);

    // 4 · the raw value leaves the address bar immediately — before any network call, so it can
    //     never appear in a referrer or be read by an analytics tag mid-flight.
    scrubTokenFromAddressBar();

    if (!syntacticallyValid) {
      setState(STATE.INVALID);
      return () => { cancelled = true; };
    }

    // 5 · the SERVER decides. The token travels in the POST body, never in a URL.
    setState(STATE.VALIDATING);
    resolveSalesReferral(raw).then((res) => {
      if (cancelled) return;
      if (res?.valid) setState(STATE.VALID);
      else if (res?.unavailable) setState(STATE.UNAVAILABLE);
      else setState(STATE.INVALID);
    });

    return () => { cancelled = true; };
  }, [token]);

  return (
    <div style={wrap} data-testid="sales-referral-landing">
      <div style={card}>
        <h1 style={{ margin: "0 0 10px", fontSize: "1.5rem", color: "#332a52" }}>Welcome to Greet-Me</h1>

        {state === STATE.VALIDATING && (
          <p style={muted} data-testid="sales-referral-validating">
            One moment — checking your link.
          </p>
        )}

        {state === STATE.VALID && (
          <>
            <p style={muted} data-testid="sales-referral-welcome">
              Thanks for stopping by. Continue to get started with Greet-Me.
            </p>
            <button style={btn} data-testid="sales-referral-continue" onClick={() => navigate("/register")}>
              Continue
            </button>
            <a href="/#/pricing" style={link} data-testid="sales-referral-pricing">See plans</a>
          </>
        )}

        {state === STATE.INVALID && (
          <p style={muted} data-testid="sales-referral-invalid">
            This link isn’t valid. You can still explore Greet-Me from the home page.
          </p>
        )}

        {/* Truthfully distinct from an invalid link: the program is off or unreachable, and the
            visitor's link may be perfectly good. Never blamed on them. */}
        {state === STATE.UNAVAILABLE && (
          <>
            <p style={muted} data-testid="sales-referral-unavailable">
              Referrals are temporarily unavailable. You can still explore Greet-Me and sign up as usual.
            </p>
            <a href="/#/pricing" style={link} data-testid="sales-referral-pricing">See plans</a>
          </>
        )}
      </div>
    </div>
  );
}
