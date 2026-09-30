// src/components/corporateCampaign/IndividualContactPicker.jsx
//
// TEAM A — SLICE D: individual contact selection, on top of whatever the category bubbles chose.
//
// This is the ONLY route by which an unclassified contact can enter an audience. A category bubble
// cannot reach one — that is the point — so without this surface those contacts would be
// unreachable rather than merely uncategorised. Each row shows a small neutral descriptor
// ("Unclassified"), never a guessed category.
//
// TEAM 5 (2026-09-29) — this used to write straight to the server (client.setAudience) the moment
// its own Save was clicked, independent of whatever the campaign's OWN edit buffer held. That let a
// reader lose an unsaved category-checkbox change with no warning: the picker's write updated the
// server, the dashboard refetched, and the campaign's local draft resynced to the new persisted
// value, silently discarding anything not yet committed. Selection here now stages into the SAME
// edit buffer everything else in the campaign modal already uses — `onSave` hands the id array back
// to the caller (CampaignCard), which folds it into `draft.individualRefs`. Nothing is sent to the
// server until the campaign modal's own Save is pressed, exactly like every other field on the card.

import { useState } from "react";
import { contactCategoryLabel, contactCategoryAbbr } from "./corporateDashboardModel.js";
import "./premiumDashboard.css";

export default function IndividualContactPicker({ contacts, initialSelected, onClose, onSave }) {
  const [selected, setSelected] = useState(() => new Set(Array.isArray(initialSelected) ? initialSelected : []));

  const list = Array.isArray(contacts) ? contacts : [];

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);          // a Set, so a contact can never be added twice
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function save() {
    onSave([...selected]);
  }

  return (
    // TEAM 5 — no `role="dialog"`/`aria-modal`: this now renders in-flow inside the campaign
    // modal's own Recipients tab, not as a second overlay, so it is not itself a dialog.
    <div className="gcd-panel" data-testid="individual-picker" aria-label="Select individual contacts">
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
        <button type="button" className="gcd-btn gcd-btn--primary" data-testid="picker-save" onClick={save}>
          {`Use ${selected.size} selected`}
        </button>
        <p className="gcd-wcard-note" data-testid="picker-stage-note">
          Applied to this campaign's unsaved changes — press Save on the campaign to commit it.
        </p>
      </div>
    </div>
  );
}
