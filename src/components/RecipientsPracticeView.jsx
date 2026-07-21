// src/components/RecipientsPracticeView.jsx
//
// TEAM A — Recipients PRACTICE VIEW. A temporary, read-only view state that renders the session-scoped
// Test Drive practice contacts inside the normal Recipients layout so a user can see how contacts will
// look after a genuine import — WITHOUT creating production records. It never fetches, mixes, or mutates
// production recipients, and exposes NO production actions (send/schedule/gift/edit/delete/API). Practice
// data lives only in sessionStorage (`greetme_sample_workspace`) + React memory and is removed on Exit,
// logout, or session end. Fictional/test data only.

import { useState, useEffect } from "react";
import { relationLabelFor } from "../import/reviewModel.js";
import { CLOSENESS_OPTIONS } from "../import/completionModel.js";
import { RECIPIENT_TYPE_OPTIONS } from "../import/recipientTypeModel.js";

const AMBER = "#8a5410";
const closenessLabel = (v) => (CLOSENESS_OPTIONS.find((o) => o.value === v) || {}).label || "";
const typeLabel = (v) => (RECIPIENT_TYPE_OPTIONS.find((o) => o.value === v) || {}).label || "";
function initials(name) { const p = String(name || "").trim().split(/\s+/); return ((p[0] || "")[0] || "?").toUpperCase() + ((p[1] || "")[0] || "").toUpperCase(); }
function addressSummary(a) {
  if (!a) return "";
  return [a.line1, a.city, a.state, a.zip].filter(Boolean).join(", ");
}

export default function RecipientsPracticeView({ status, contacts = [], onExit, onReturnToWizard, isMobile }) {
  const [confirmExit, setConfirmExit] = useState(false);
  const [detail, setDetail] = useState(null);   // a practice contact for the read-only detail view

  // Session end / expiration → clear Practice View immediately (no confirmation). Exit is deterministic.
  useEffect(() => {
    const onExpire = () => onExit && onExit();
    if (typeof window !== "undefined") window.addEventListener("auth:session-expired", onExpire);
    return () => { if (typeof window !== "undefined") window.removeEventListener("auth:session-expired", onExpire); };
  }, [onExit]);

  const bannerBg = "linear-gradient(135deg,#fff4e0,#fde9d4)";
  const badge = (text, extra = {}) => (
    <span style={{ display: "inline-block", background: "rgba(214,145,16,.14)", color: AMBER, border: "1px solid rgba(214,145,16,.4)", borderRadius: 9999, padding: "2px 10px", fontSize: "0.6875rem", fontWeight: 700, ...extra }}>{text}</span>
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: isMobile ? "12px" : "20px" }}>
      {/* Persistent, screen-reader-available banner. Practice status is conveyed by TEXT + badge, not color alone. */}
      <section role="region" aria-label="Test Drive practice contacts notice" data-testid="practice-banner"
        style={{ position: "sticky", top: 0, zIndex: 5, background: bannerBg, border: "2px solid rgba(214,145,16,.5)", borderRadius: 16, padding: isMobile ? "16px" : "18px 22px", marginBottom: 18, boxShadow: "0 10px 26px -16px rgba(160,110,20,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {badge("Test Drive")}
          <h2 style={{ margin: 0, fontFamily: "Georgia,serif", fontSize: isMobile ? "1.15rem" : "1.3rem", color: "#5a3a08" }}>Test Drive — Practice Contacts</h2>
        </div>
        <p style={{ margin: "8px 0 0", color: "#6b4a12", fontSize: "0.9rem", lineHeight: 1.5 }} data-testid="practice-primary-copy">
          These fictional contacts exist only in this Test Drive. They have not been added to your account and cannot trigger greetings, gifts, schedules, messages, or payments.
        </p>
        <p style={{ margin: "6px 0 0", color: "#7a5a22", fontSize: "0.84rem", lineHeight: 1.5 }} data-testid="practice-cleanup-copy">
          They will be automatically removed when you exit Test Drive, log out, or your session ends.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button type="button" data-testid="practice-exit" onClick={() => setConfirmExit(true)}
            style={{ background: "#6b3a2a", color: "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>Exit and Remove Practice Contacts</button>
          <button type="button" data-testid="practice-return-wizard" onClick={onReturnToWizard}
            style={{ background: "transparent", color: "#6b4a12", border: "1px solid rgba(214,145,16,.5)", borderRadius: 11, padding: "10px 18px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>Return to Test Drive</button>
        </div>
      </section>

      {status === "empty" ? (
        <div data-testid="practice-empty" style={{ background: "#fff", border: "1px solid rgba(27,24,48,.1)", borderRadius: 14, padding: 28, textAlign: "center" }}>
          <p style={{ margin: 0, color: "#605c78", fontSize: "0.95rem" }}>No practice contacts are currently loaded.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
            <button type="button" data-testid="practice-empty-wizard" onClick={onReturnToWizard} style={{ background: "#6b3a2a", color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }}>Return to the Import Wizard</button>
            <button type="button" data-testid="practice-empty-exit" onClick={() => setConfirmExit(true)} style={{ background: "transparent", color: "#1b1830", border: "1px solid rgba(27,24,48,.15)", borderRadius: 11, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }}>Exit Test Drive</button>
          </div>
        </div>
      ) : (
        <div data-testid="practice-list" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
          {contacts.map((c, i) => {
            const rel = c.relationship ? (relationLabelFor(c.relationship) || c.relationship) : "";
            const grad = ["#b07515", "#6f4310"];
            return (
              <div key={`practice-${i}`} data-testid="practice-card" style={{ background: "#fffdf8", border: "1px solid rgba(214,145,16,.35)", borderRadius: 14, padding: 16, display: "grid", gap: 8, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div aria-hidden="true" style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg,${grad[0]},${grad[1]})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>{initials(c.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "#2c2140", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || "—"}</div>
                    <div style={{ color: "#605c78", fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email || "—"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  {badge("Practice Contact")}
                  {c.recipientType && <span style={{ fontSize: "0.72rem", color: "#605c78" }}>{typeLabel(c.recipientType)}</span>}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#5a5170" }}>
                  {rel ? <>Relationship: <b>{rel}</b>{c.relationshipCloseness ? ` · ${closenessLabel(c.relationshipCloseness)}` : ""}</> : "Relationship not provided"}
                </div>
                {c.birthday && <div style={{ fontSize: "0.78rem", color: "#605c78" }}>Birthday: {c.birthday}</div>}
                {(c.company || c.department) && <div style={{ fontSize: "0.78rem", color: "#605c78" }}>{[c.company, c.department].filter(Boolean).join(" · ")}</div>}
                {addressSummary(c.shippingAddress) && <div style={{ fontSize: "0.78rem", color: "#605c78", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{addressSummary(c.shippingAddress)}</div>}
                {/* Where production actions normally appear — safe explanatory text, not empty space. No prod handlers. */}
                <div data-testid="practice-actions-note" style={{ marginTop: 4, paddingTop: 8, borderTop: "1px dashed rgba(214,145,16,.3)", fontSize: "0.74rem", color: AMBER }}>
                  Practice only — sending, scheduling, gifting, and automation are unavailable.
                </div>
                <button type="button" data-testid="practice-view-details" onClick={() => setDetail(c)} style={{ justifySelf: "start", background: "transparent", color: "#6b4a12", border: "1px solid rgba(214,145,16,.4)", borderRadius: 9, padding: "5px 12px", fontSize: "0.76rem", fontWeight: 700, cursor: "pointer" }}>View practice details</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Read-only practice detail — never routes into the production Edit Recipient form. */}
      {detail && (
        <div role="dialog" aria-modal="true" aria-label="Practice contact details" data-testid="practice-detail" style={{ position: "fixed", inset: 0, background: "rgba(20,14,30,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40, padding: 16 }} onClick={() => setDetail(null)}>
          <div style={{ background: "#fffdf8", borderRadius: 16, padding: 22, maxWidth: 460, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 8 }}>{badge("Practice Contact")}</div>
            <h3 style={{ margin: "0 0 2px", fontFamily: "Georgia,serif" }}>{detail.name || "—"}</h3>
            <p style={{ margin: "0 0 10px", fontSize: "0.8rem", color: AMBER }} data-testid="practice-detail-note">Practice Contact — fictional data, not saved to your account.</p>
            <div style={{ display: "grid", gap: 4, fontSize: "0.84rem", color: "#4a4663" }}>
              <div>Email: {detail.email || "—"}</div>
              <div>Relationship: {detail.relationship ? (relationLabelFor(detail.relationship) || detail.relationship) : "Relationship not provided"}</div>
              {detail.relationshipCloseness && <div>Description: {closenessLabel(detail.relationshipCloseness)}</div>}
              {detail.birthday && <div>Birthday: {detail.birthday}</div>}
              {(detail.company || detail.department) && <div>{[detail.company, detail.department].filter(Boolean).join(" · ")}</div>}
              {addressSummary(detail.shippingAddress) && <div>Address: {addressSummary(detail.shippingAddress)}</div>}
            </div>
            <button type="button" onClick={() => setDetail(null)} style={{ marginTop: 16, background: "#6b3a2a", color: "#fff", border: "none", borderRadius: 11, padding: "9px 16px", fontWeight: 700, cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}

      {/* Exit confirmation — exact approved copy. Never calls a production delete endpoint. */}
      {confirmExit && (
        <div role="dialog" aria-modal="true" aria-label="Exit Test Drive" data-testid="practice-exit-confirm" style={{ position: "fixed", inset: 0, background: "rgba(20,14,30,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 420, width: "100%" }}>
            <h3 style={{ margin: "0 0 8px", fontFamily: "Georgia,serif" }}>Exit Test Drive?</h3>
            <p style={{ margin: 0, color: "#4a4663", fontSize: "0.9rem", lineHeight: 1.5 }}>All practice contacts will be removed from this session. Your real recipients will not be changed.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <button type="button" data-testid="practice-exit-confirm-yes" onClick={() => { setConfirmExit(false); onExit && onExit(); }} style={{ background: "#6b3a2a", color: "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>Exit and Remove</button>
              <button type="button" data-testid="practice-exit-confirm-no" onClick={() => setConfirmExit(false)} style={{ background: "transparent", color: "#1b1830", border: "1px solid rgba(27,24,48,.15)", borderRadius: 11, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>Keep Test Drive Open</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
