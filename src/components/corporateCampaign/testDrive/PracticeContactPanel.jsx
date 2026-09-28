// src/components/corporateCampaign/testDrive/PracticeContactPanel.jsx
//
// TEAM UX — Corporate Dashboard Test Drive. Contact management for PRACTICE contacts only: a small,
// self-contained panel rendered ABOVE the real (unmodified) Corporate Dashboard. It never imports
// from ContactTiles.jsx/CampaignCard.jsx/GreetingAutomationCampaigns.jsx and is never imported by
// them — this keeps the founder-approved dashboard's own files untouched while still letting the
// founder add/edit a practice contact and see missing-information warnings, per the approved flow.
// Every write here goes through corporateTestDriveWorkspace.js, which only ever touches the SAME
// session-scoped sessionStorage record the Import Wizard already owns — never a backend call.

import { useState } from "react";

const card = { background: "#fffdf8", border: "1px solid rgba(214,145,16,.35)", borderRadius: 14, padding: 16 };
const AMBER = "#8a5410";
const btn = (bg, fg = "#fff") => ({ background: bg, color: fg, border: bg === "transparent" ? "1px solid rgba(27,24,48,.15)" : "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: ".82rem", cursor: "pointer" });

function ContactForm({ initial, categoryLabel, onSave, onCancel }) {
  const [name, setName] = useState((initial && initial.name) || "");
  const [email, setEmail] = useState((initial && initial.email) || "");
  const a = (initial && initial.shippingAddress) || {};
  const [line1, setLine1] = useState(a.line1 || "");
  const [city, setCity] = useState(a.city || "");
  const [state, setStateVal] = useState(a.state || "");
  const [zip, setZip] = useState(a.zip || "");
  const [country, setCountry] = useState(a.country || "");

  const save = () => {
    const shippingAddress = (line1 || city || state || zip || country) ? { line1, line2: "", city, state, zip, country } : null;
    onSave({ name: name.trim(), email: email.trim(), shippingAddress });
  };

  return (
    <div style={{ ...card, marginTop: 10, display: "grid", gap: 8 }} data-testid="practice-contact-form">
      <b style={{ fontSize: ".84rem" }}>{initial ? "Edit practice contact" : `New practice ${categoryLabel}`}</b>
      {!initial && <p style={{ margin: 0, fontSize: ".76rem", color: AMBER }}>Category is fixed to {categoryLabel} for this Test Drive.</p>}
      <label style={{ display: "grid", gap: 3, fontSize: ".78rem" }}>Name
        <input data-testid="practice-form-name" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid rgba(27,24,48,.18)" }} />
      </label>
      <label style={{ display: "grid", gap: 3, fontSize: ".78rem" }}>Email
        <input data-testid="practice-form-email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid rgba(27,24,48,.18)" }} />
      </label>
      <b style={{ fontSize: ".76rem", color: "#4a4663" }}>Mailing address</b>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input data-testid="practice-form-line1" placeholder="Street address" value={line1} onChange={(e) => setLine1(e.target.value)} style={{ gridColumn: "1 / -1", padding: "7px 9px", borderRadius: 8, border: "1px solid rgba(27,24,48,.18)" }} />
        <input data-testid="practice-form-city" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid rgba(27,24,48,.18)" }} />
        <input data-testid="practice-form-state" placeholder="State/Province" value={state} onChange={(e) => setStateVal(e.target.value)} style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid rgba(27,24,48,.18)" }} />
        <input data-testid="practice-form-zip" placeholder="Postal/ZIP code" value={zip} onChange={(e) => setZip(e.target.value)} style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid rgba(27,24,48,.18)" }} />
        <input data-testid="practice-form-country" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} style={{ padding: "7px 9px", borderRadius: 8, border: "1px solid rgba(27,24,48,.18)" }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button type="button" data-testid="practice-form-save" style={btn("#6b3a2a")} onClick={save} disabled={!name.trim()}>Save</button>
        <button type="button" data-testid="practice-form-cancel" style={btn("transparent", "#1b1830")} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/**
 * `contacts` / `warnings` / `categoryLabel` come from the Test Drive wrapper. `onAdd`/`onEdit` are
 * called with the form's values and are expected to persist via corporateTestDriveWorkspace.js and
 * trigger a re-render (the wrapper owns that state, not this component).
 */
export default function PracticeContactPanel({ contacts = [], warnings, categoryLabel, onAdd, onEdit }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const editing = contacts.find((c) => c.id === editingId) || null;

  return (
    <section style={{ ...card, marginBottom: 18 }} data-testid="practice-contact-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <b style={{ fontFamily: "Georgia,serif", fontSize: "1.05rem" }}>Practice contacts</b>
          <p style={{ margin: "2px 0 0", fontSize: ".8rem", color: "#7a5a22" }}>
            Add or edit a fictional contact and see the change reflected below — nothing here is saved to your account.
          </p>
        </div>
        {!adding && !editing && (
          <button type="button" data-testid="practice-add-contact" style={btn("#6b3a2a")} onClick={() => setAdding(true)}>
            Add practice {categoryLabel}
          </button>
        )}
      </div>

      {adding && (
        <ContactForm
          categoryLabel={categoryLabel}
          onSave={(vals) => { onAdd(vals); setAdding(false); }}
          onCancel={() => setAdding(false)}
        />
      )}
      {editing && (
        <ContactForm
          initial={editing}
          categoryLabel={categoryLabel}
          onSave={(vals) => { onEdit(editing.id, vals); setEditingId(null); }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {!adding && !editing && (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 8 }}>
          {contacts.length === 0 ? (
            <li style={{ fontSize: ".82rem", color: "#7a5a22" }}>No practice contacts loaded.</li>
          ) : contacts.map((c) => {
            const w = warnings && warnings.get(c.id);
            return (
              <li key={c.id} data-testid={`practice-contact-row-${c.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 10px", background: "#fff", border: "1px solid rgba(214,145,16,.25)", borderRadius: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "#2c2140" }}>{c.name || "—"}</div>
                  <div style={{ fontSize: ".78rem", color: "#605c78" }}>{c.email || "—"}</div>
                  {w ? (
                    <div data-testid={`practice-warning-${c.id}`} role="status" style={{ marginTop: 4, fontSize: ".76rem", color: "#a3241a" }}>
                      <b>⚠ {w.statusLabel}</b> — {w.message}
                    </div>
                  ) : (
                    <div data-testid={`practice-ready-${c.id}`} style={{ marginTop: 4, fontSize: ".76rem", color: "#1f7a57" }}><b>✓ Campaign Ready</b></div>
                  )}
                </div>
                <button type="button" data-testid={`practice-edit-${c.id}`} style={btn("transparent", "#6b4a12")} onClick={() => setEditingId(c.id)}>Edit Contact</button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
