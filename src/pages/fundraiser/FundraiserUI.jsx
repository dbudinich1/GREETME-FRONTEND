// src/pages/fundraiser/FundraiserUI.jsx
// TEAM B — shared, self-contained UI atoms + truthful state views for the fundraising dashboards.
import React from "react";

export const box = { background: "#fff", border: "1px solid #e6e2da", borderRadius: 10, padding: 20, margin: "12px 0" };
export const h = { margin: "0 0 12px", fontFamily: "Georgia, serif", color: "#4a3f35" };
export const btn = { background: "#6b3a2a", color: "#fff", border: 0, borderRadius: 6, padding: "8px 14px", cursor: "pointer", font: "inherit" };
export const btnGhost = { ...btn, background: "transparent", color: "#6b3a2a", border: "1px solid #6b3a2a" };
export const pageWrap = { maxWidth: 1040, margin: "0 auto", padding: 24, color: "#3b332b" };

export function Stat({ label, value }) {
  return (
    <div style={{ border: "1px solid #ece7df", borderRadius: 8, padding: "12px 16px", minWidth: 130 }}>
      <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#8a7c6c" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#4a3f35" }}>{value}</div>
    </div>
  );
}

// Truthful state screens — no fabricated data.
export function StateView({ state, onRetry }) {
  const map = {
    loading: { t: "Loading…", d: "Fetching the latest data." },
    signin: { t: "Please sign in", d: "This dashboard requires an authenticated Greet-Me account." },
    forbidden: { t: "No access", d: "Your account does not have fundraising access for this organization." },
    dormant: { t: "Fundraising is not currently enabled", d: "The fundraising platform is dormant. Please check back once it is activated." },
    error: { t: "Something went wrong", d: "We couldn't load this dashboard. Please try again." },
  };
  const m = map[state] || map.error;
  return (
    <div style={{ ...box, textAlign: "center", padding: 40 }}>
      <h2 style={h}>{m.t}</h2>
      <p style={{ color: "#7b6a59" }}>{m.d}</p>
      {onRetry && state !== "signin" && state !== "forbidden" ? <button style={btn} onClick={onRetry}>Retry</button> : null}
    </div>
  );
}

export function Empty({ children }) {
  return <div style={{ ...box, textAlign: "center", color: "#8a7c6c" }}>{children}</div>;
}

export function HeldBadge({ children = "Held" }) {
  return <span style={{ background: "#f0e9df", border: "1px solid #d8cdbb", borderRadius: 999, padding: "2px 10px", fontSize: 12, color: "#8a7c6c" }}>{children}</span>;
}
