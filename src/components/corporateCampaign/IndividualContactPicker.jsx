// src/components/corporateCampaign/IndividualContactPicker.jsx
//
// TEAM A — SLICE D: individual contact selection, on top of whatever the category bubbles chose.
//
// This is the ONLY route by which an unclassified contact can enter an audience. A category bubble
// cannot reach one — that is the point — so without this surface those contacts would be
// unreachable rather than merely uncategorised. Each row shows a small neutral descriptor
// ("Unclassified"), never a guessed category.
//
// Selection is a set of ids, so a contact already chosen by a category and then chosen again here
// stays a single ref. Saving PUTs the deduplicated list through the EXISTING audience endpoint.

import { useMemo, useState } from "react";
import { contactCategoryLabel, contactCategoryAbbr } from "./corporateDashboardModel.js";
import "./premiumDashboard.css";

export default function IndividualContactPicker({ contacts, orgId, campaign, client, onClose, onSaved }) {
  const initial = useMemo(
    () => new Set(Array.isArray(campaign && campaign.audienceRefs) ? campaign.audienceRefs : []),
    [campaign]
  );
  const [selected, setSelected] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const list = Array.isArray(contacts) ? contacts : [];

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);          // a Set, so a contact can never be added twice
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!campaign) return;
    setSaving(true); setMessage(null);
    const res = await client.setAudience(orgId, campaign.campaignId, [...selected]);
    setSaving(false);
    // Never report success the server did not confirm.
    if (!res || res.ok !== true) {
      setMessage("That didn’t save. Please try again.");
      return;
    }
    if (onSaved) await onSaved();
  }

  return (
    <div className="gcd-panel" data-testid="individual-picker" role="dialog" aria-label="Select individual contacts" aria-modal="false">
      <div className="gcd-panel-head">
        <div>
          <h2 className="gcd-panel-title">Select Individual Contacts</h2>
          <p className="gcd-panel-note">Add or remove specific people, on top of any categories you chose.</p>
        </div>
        <button type="button" className="gcd-btn" data-testid="picker-close" onClick={onClose}>Close</button>
      </div>

      <div className="gcd-scroll" style={{ maxHeight: "42vh" }}>
        {list.length === 0 ? (
          <p className="gcd-empty" data-testid="picker-empty">No corporate contacts are available to select yet.</p>
        ) : (
          <div className="gcd-bubbles" role="group" aria-label="Contacts">
            {list.map((c) => (
              <label key={c.id} className="gcd-bubble" htmlFor={`pick-${c.id}`} data-testid={`pick-${c.id}`}
                style={{ flexBasis: "100%" }}>
                <input id={`pick-${c.id}`} type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <span className="gcd-dot" aria-hidden="true" />
                <span className="gcd-bubble-text">
                  <span className="gcd-bubble-label">
                    {/* SLICE E5 - the tag, on the ONE list that genuinely mixes categories. The
                        full descriptor stays directly beneath it, so the tag never has to be
                        decoded and an unclassified row still reads as unclassified. */}
                    <span className={`gcd-abbr gcd-abbr--${c.corporateContactType || "none"}`}
                      data-testid={`pick-${c.id}-abbr`} title={contactCategoryLabel(c)} aria-hidden="true">
                      {contactCategoryAbbr(c)}
                    </span>
                    {c.name}
                  </span>
                  {/* Neutral descriptor. An unclassified contact is never labelled Employee. */}
                  <span className="gcd-bubble-note" data-testid={`pick-${c.id}-category`}>{contactCategoryLabel(c)}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="gcd-footer" style={{ padding: "0 20px 18px", marginTop: 0 }}>
        <button type="button" className="gcd-btn gcd-btn--primary" data-testid="picker-save" disabled={saving} onClick={save}>
          {saving ? "Saving…" : `Save ${selected.size} selected`}
        </button>
        {message ? <p className="gcd-msg" role="status" data-testid="picker-msg">{message}</p> : null}
      </div>
    </div>
  );
}
