// src/components/corporateCampaign/AudienceSection.jsx
//
// TEAM D — CORP-3 association bridge (frontend selection surface). Reads the org's corporate
// contacts (the existing shared pool), lets an authorized user SELECT which are associated with a
// campaign (audienceRefs), persists via PUT, reloads, and displays the audience truthfully.
//
// STRICT BOUNDARY: select + display only. Creates/edits/deletes/imports NO contact, stores contacts
// nowhere, writes no occasions[]/autoSend/automation field, and uses NO language implying a campaign
// will send. Duplicate selections are impossible (a Set); the server re-verifies ownership + dedups.
// Server-derived + dormant-safe: while the feature is dormant every call returns 503 and this renders
// nothing (it only ever mounts inside the already server-gated campaign detail surface).

import { useCallback, useEffect, useMemo, useState } from "react";
import { writeResultMessage } from "./campaignSurfaceModel.js";

const PURPLE = "linear-gradient(135deg, #6d74ee 0%, #764ba2 100%)";
const btn = (bg, fg = "#fff") => ({ background: bg, color: fg, border: bg === "transparent" ? "1px solid rgba(27,24,48,.15)" : "none", borderRadius: 11, padding: "9px 15px", fontWeight: 700, fontSize: ".8rem", cursor: "pointer" });

export default function AudienceSection({ orgId, campaignId, client }) {
  const [audience, setAudience] = useState(null); // { count, contacts:[{id,name}], unresolved:[id] }
  const [dormant, setDormant] = useState(false);
  const [pool, setPool] = useState(null);         // [{id,name}] when picking
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const loadAudience = useCallback(async () => {
    const res = await client.readAudience(orgId, campaignId);
    if (res.dormant) { setDormant(true); return; }
    if (res.unauthorized) { setAudience(null); setMessage("You don't have access to this campaign's audience."); return; }
    if (res.ok) { setAudience(res.data || { count: 0, contacts: [], unresolved: [] }); }
  }, [client, orgId, campaignId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAudience();
  }, [loadAudience]);

  async function openPicker() {
    setMessage(null);
    const res = await client.listOrgContacts(orgId);
    if (res.dormant) { setDormant(true); return; }
    if (res.unauthorized) { setMessage("You don't have access to these contacts."); return; }
    if (!res.ok) { setMessage("Couldn't load contacts. Please try again."); return; }
    setPool((res.data && res.data.contacts) || []);
    // Start from the CURRENTLY-RESOLVED refs only — stale/unresolved ones self-heal (dropped) on save.
    setSelected(new Set((audience && audience.contacts ? audience.contacts : []).map((c) => c.id)));
    setPicking(true);
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev); // Set → a contact can never be associated twice
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    setBusy(true); setMessage(null);
    const res = await client.setAudience(orgId, campaignId, [...selected]);
    setBusy(false);
    if (res.conflict) { setMessage("This campaign changed in another session. Refresh and try again."); return; }
    if (res.unauthorized) { setMessage("You don't have access to change this audience."); return; }
    if (!res.ok) { setMessage(writeResultMessage(res) || "Some selected contacts aren't in this organization. Refresh and try again."); return; }
    setPicking(false); setPool(null);
    await loadAudience();
  }

  const names = useMemo(() => (audience && audience.contacts ? audience.contacts.map((c) => c.name) : []), [audience]);
  if (dormant) return null;

  return (
    <section data-testid="audience-section" style={{ background: "#fff", border: "1px solid rgba(27,24,48,.1)", borderRadius: 14, padding: 18, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.05rem", margin: 0 }}>Audience</h2>
        {!picking && (
          <button data-testid="audience-manage" onClick={openPicker} style={btn(PURPLE)}>Manage audience</button>
        )}
      </div>

      {message && (
        <div role="alert" style={{ margin: "10px 0 0", padding: "10px 14px", borderRadius: 10, background: "rgba(214,145,16,.12)", border: "1px solid rgba(214,145,16,.4)", color: "#7a5410", fontSize: ".85rem" }}>{message}</div>
      )}

      {!picking && (
        audience === null ? (
          <p style={{ color: "#605c78", fontSize: ".85rem", marginTop: 10 }}>Loading audience…</p>
        ) : (
          <div style={{ marginTop: 10 }}>
            <p data-testid="audience-count" style={{ color: "#1b1830", fontSize: ".9rem", margin: "0 0 8px" }}>
              <b>{audience.count}</b> {audience.count === 1 ? "contact" : "contacts"} selected
            </p>
            {names.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {names.map((n, i) => (
                  <span key={i} style={{ fontSize: ".8rem", background: "rgba(109,92,240,.1)", color: "#4a3fb0", borderRadius: 999, padding: "3px 10px" }}>{n}</span>
                ))}
              </div>
            )}
            {audience.count === 0 && (
              <p style={{ color: "#605c78", fontSize: ".82rem", margin: 0 }}>No contacts are associated with this campaign yet.</p>
            )}
            {audience.unresolved && audience.unresolved.length > 0 && (
              <p data-testid="audience-unresolved" style={{ color: "#7a5410", fontSize: ".78rem", marginTop: 8 }}>
                {audience.unresolved.length} previously selected {audience.unresolved.length === 1 ? "contact is" : "contacts are"} no longer available and will be removed the next time you save.
              </p>
            )}
          </div>
        )
      )}

      {picking && (
        <div data-testid="audience-picker" style={{ marginTop: 12 }}>
          {(pool || []).length === 0 ? (
            <p data-testid="audience-empty-pool" style={{ color: "#605c78", fontSize: ".85rem" }}>No corporate contacts are available to select yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto", padding: 2 }}>
              {pool.map((cn) => (
                <label key={cn.id} data-testid="audience-option" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: ".85rem", background: "#faf9fd", border: "1px solid rgba(27,24,48,.1)", borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>
                  <input type="checkbox" checked={selected.has(cn.id)} onChange={() => toggle(cn.id)} />
                  <span>{cn.name}</span>
                </label>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button data-testid="audience-save" onClick={save} disabled={busy} style={btn("#1f9d6b")}>{busy ? "Saving…" : "Save audience"}</button>
            <button data-testid="audience-cancel" onClick={() => { setPicking(false); setPool(null); setMessage(null); }} style={btn("transparent", "#1b1830")}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
