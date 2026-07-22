// src/pages/fundraiser/FundraiserReferralLanding.jsx
//
// TEAM B — PUBLIC referral landing at /#/f/:token. Captures ONLY the opaque participant token into the
// transient checkout carrier and routes the visitor into the ordinary sign-up / subscription journey.
// It authenticates nobody, decodes nothing, derives no organization/campaign/participant identity, and
// exposes no Fundraiser, ledger, economics, or payout data. It calls NO private Fundraiser API. Copy is
// generic — it never invents an organization, campaign, participant, or fundraising claim. A missing or
// malformed token fails safely: nothing is captured and no attributed journey begins.

import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { captureToken, isValidTokenSyntax } from "./attributionCarrier.js";

const wrap = { minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 };
const card = { maxWidth: 460, width: "100%", background: "#fffdf8", border: "1px solid #e7e0d4", borderRadius: 14, padding: "28px 26px", textAlign: "center", fontFamily: "Georgia, serif" };
const btn = { display: "inline-block", marginTop: 18, padding: "12px 22px", borderRadius: 10, border: "none", background: "#6b3a2a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "1rem" };
const muted = { color: "#6a5f86", fontSize: ".92rem", lineHeight: 1.6 };

export default function FundraiserReferralLanding() {
  const { token } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Fail-safe: only a syntactically valid opaque token is preserved; anything else is ignored.
    captureToken(token);
  }, [token]);

  const valid = isValidTokenSyntax(token);

  return (
    <div style={wrap} data-testid="fundraiser-referral-landing">
      <div style={card}>
        <h1 style={{ margin: "0 0 10px", fontSize: "1.5rem", color: "#332a52" }}>Welcome to Greet-Me</h1>
        {valid ? (
          <>
            <p style={muted} data-testid="referral-welcome">
              Thanks for stopping by. Continue to get started with Greet-Me.
            </p>
            <button style={btn} data-testid="referral-continue" onClick={() => navigate("/register")}>
              Continue
            </button>
          </>
        ) : (
          <p style={muted} data-testid="referral-invalid">
            This link isn’t valid. You can still explore Greet-Me from the home page.
          </p>
        )}
      </div>
    </div>
  );
}
