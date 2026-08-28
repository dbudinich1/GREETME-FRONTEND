// src/pages/sales/SalesReferralLanding.jsx
//
// TEAM B (SALES S1) — PUBLIC salesperson referral landing at /#/s/:token.
//
// This is the page that removes the JSON dead end: a prospect who opens a
// salesperson's link lands on an ordinary, usable Greet-Me welcome and continues
// into the normal sign-up journey. They never see, copy, or re-enter a token.
//
// It authenticates nobody, decodes nothing, derives no salesperson identity, and
// calls NO private API. It exposes no salesperson name, email, commission rate
// or earnings — a visitor cannot tell whose link they followed. A missing or
// malformed token fails safely: nothing is captured, no attributed journey
// begins, and the visitor still gets a working page.

import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { captureToken, isValidTokenSyntax, readToken, replaceRetiredIncumbent } from "./salesAttributionCarrier.js";
import { isTokenStillValid } from "./salesAttributionResolve.js";

const wrap = { minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 };
const card = { maxWidth: 460, width: "100%", background: "#fffdf8", border: "1px solid #e7e0d4", borderRadius: 14, padding: "28px 26px", textAlign: "center", fontFamily: "Georgia, serif" };
const btn = { display: "inline-block", marginTop: 18, padding: "12px 22px", borderRadius: 10, border: "none", background: "#6b3a2a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "1rem" };
const muted = { color: "#6a5f86", fontSize: ".92rem", lineHeight: 1.6 };
const link = { display: "inline-block", marginTop: 14, color: "#6b3a2a", fontSize: ".9rem" };

/**
 * `code` is supplied when this page is reached by a CLEAN vanity path (https://greet-me.com/alex),
 * where there is no route parameter to read because the alias lives in the pathname rather than
 * the hash. Everything downstream is identical: the same carrier, the same first-touch rule, the
 * same welcome, and the SAME router — this component is always mounted inside the application's
 * HashRouter, because its hooks require one. The visitor cannot tell which form of link they
 * followed, which is the point.
 */
export default function SalesReferralLanding({ code = null }) {
  const params = useParams();
  const token = code ?? params.token;
  const navigate = useNavigate();

  useEffect(() => {
    // FIRST TOUCH. Fail-safe: only a syntactically valid opaque token is preserved, and an
    // existing referral is never destroyed by a later visit.
    const adopted = captureToken(token);
    if (adopted || !isValidTokenSyntax(token)) return undefined;

    // Someone else's referral is already carried. It keeps the credit — UNLESS the server says
    // that first token is no longer live, which is the only condition that lets this one take
    // over. Entirely non-blocking: the page has already rendered, and any indeterminate answer
    // (dormant, offline, unreadable) leaves the first referral untouched.
    const incumbent = readToken();
    let alive = true;
    (async () => {
      const stillValid = await isTokenStillValid(incumbent);
      if (alive && stillValid === false) replaceRetiredIncumbent(token, { incumbentValid: false });
    })();
    return () => { alive = false; };
  }, [token]);

  const valid = isValidTokenSyntax(token);

  return (
    <div style={wrap} data-testid="sales-referral-landing">
      <div style={card}>
        <h1 style={{ margin: "0 0 10px", fontSize: "1.5rem", color: "#332a52" }}>Welcome to Greet-Me</h1>
        {valid ? (
          <>
            <p style={muted} data-testid="sales-referral-welcome">
              Thanks for stopping by. Continue to get started with Greet-Me.
            </p>
            <button style={btn} data-testid="sales-referral-continue" onClick={() => navigate("/register")}>
              Continue
            </button>
            <a href="/#/pricing" style={link} data-testid="sales-referral-pricing">See plans</a>
          </>
        ) : (
          <p style={muted} data-testid="sales-referral-invalid">
            This link isn’t valid. You can still explore Greet-Me from the home page.
          </p>
        )}
      </div>
    </div>
  );
}
