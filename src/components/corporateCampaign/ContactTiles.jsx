// src/components/corporateCampaign/ContactTiles.jsx
//
// TEAM A — SLICE D: the three corporate contact tiles beneath the campaign viewport.
//
// EXACTLY THREE TILES: Employees, Clients, Vendors. There is no fourth "Unclassified" tile, because
// unclassified is the absence of a category rather than another one.
//
// The arithmetic is shown WHOLE. When some contacts carry no persisted classification, the three
// tile counts will not add up to the organisation's total — so the total line and a compact notice
// state that plainly instead of leaving a reader to notice the gap themselves.
//
// The notice offers the ONE action that genuinely exists: those contacts are still reachable
// through Select Individual Contacts. It does not offer to fix the classification, because nothing
// can — the import wizard classifies contacts it imports; it cannot reclassify one that already
// exists, and pretending otherwise would be a button that lies.

import { useState } from "react";
import {
  CONTACT_CATEGORIES,
  bucketContactsByCategory,
  contactTotalsLabel,
  unclassifiedNotice,
} from "./corporateDashboardModel.js";
import "./premiumDashboard.css";

// Presentation only — a small glyph per category, matching the approved reference. No model
// change: CONTACT_CATEGORIES itself carries no icon, so this stays a purely local lookup.
const TILE_ICONS = {
  employee: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M17.5 14.3A6.5 6.5 0 0 1 21.5 20" />
    </svg>
  ),
  client: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10" width="7" height="11" /><rect x="13" y="4" width="7" height="17" />
      <path d="M7 14h1M7 17h1M16 8h1M16 11h1M16 14h1" />
    </svg>
  ),
  vendor: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v8" />
    </svg>
  ),
};

export default function ContactTiles({ contacts, loading = false, onManage, onAddCategory, onImportAll, onViewAll, onSelectIndividual }) {
  const bucket = bucketContactsByCategory(contacts);
  const notice = unclassifiedNotice(bucket);

  // SLICE E5 - which category has its roster open. One at a time: three open lists would push the
  // campaigns panel off-screen, which is the thing the tiles sit beneath in the first place.
  const [openCategory, setOpenCategory] = useState(null);

  return (
    <section className="gcd-panel" data-testid="contact-tiles-panel" aria-labelledby="gcd-contacts-head">
      <div className="gcd-panel-head">
        <div>
          <h2 className="gcd-panel-title" id="gcd-contacts-head">Contacts</h2>
          <p className="gcd-panel-note">Who your campaigns can reach. Categories come from how each contact was imported.</p>
        </div>
        {/* FOUNDER-APPROVED LAYOUT (2026-09-25) — both reuse existing capability: Import contacts
            is the SAME Import Wizard route "Add <Category>" already uses, just without a category
            preselected; View all is a READ-ONLY combined roster of the SAME `contacts` this panel
            already renders. Neither is a new endpoint or a new workflow. */}
        <div className="gcd-panel-actions">
          {onImportAll ? (
            <button type="button" className="gcd-btn" data-testid="contacts-import-all" onClick={onImportAll}>
              Import contacts
            </button>
          ) : null}
          {onViewAll ? (
            <button type="button" className="gcd-btn" data-testid="contacts-view-all" onClick={onViewAll}>
              View all
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ padding: "18px 20px 20px" }}>
        <div className="gcd-tiles" data-testid="contact-tiles">
          {CONTACT_CATEGORIES.map((cat) => {
            const rows = bucket.byCategory[cat.key];
            const open = openCategory === cat.key;
            return (
              <article className="gcd-tile" key={cat.key} data-testid={`tile-${cat.key}`} aria-labelledby={`tile-${cat.key}-name`}>
                <span className="gcd-tile-icon" aria-hidden="true">{TILE_ICONS[cat.key]}</span>
                <h3 className="gcd-tile-name" id={`tile-${cat.key}-name`}>{cat.label}</h3>
                {/* FOUNDER-APPROVED LAYOUT (2026-09-25) — Total / Ready / Needs info, centered and
                    evenly spaced. Total is the SAME count this tile has always shown (the
                    data-testid is unchanged so premiumDashboard.browser.test.mjs still reads it).
                    Ready / Needs info have NO safely-available source: a contact record here
                    carries only id/name/corporateContactType (see corporateDashboardModel.js) —
                    no email, phone, address, or completeness flag reaches this component, and the
                    only adjacent concept (the import wizard's pre-commit delivery-address-status
                    preview) is advisory, CSV-row-scoped, and never persisted to a saved contact.
                    Rather than invent a number, this reserves the space and shows the same
                    restrained "not yet available" treatment the Payment method section uses. */}
                <div className="gcd-tile-stats" data-testid={`tile-${cat.key}-stats`}>
                  <div className="gcd-tile-stat">
                    <span className="gcd-tile-stat-value" data-testid={`tile-${cat.key}-count`}>
                      {loading ? "—" : bucket.counts[cat.key]}
                    </span>
                    <span className="gcd-tile-stat-label">Total</span>
                  </div>
                  <div className="gcd-tile-stat">
                    <span className="gcd-tile-stat-value gcd-tile-stat-value--muted" data-testid={`tile-${cat.key}-ready`}>—</span>
                    <span className="gcd-tile-stat-label">Ready</span>
                  </div>
                  <div className="gcd-tile-stat">
                    <span className="gcd-tile-stat-value gcd-tile-stat-value--muted" data-testid={`tile-${cat.key}-needs-info`}>—</span>
                    <span className="gcd-tile-stat-label">Needs info</span>
                  </div>
                </div>
                <div className="gcd-tile-actions">
                  {/* FOUNDER-APPROVED LAYOUT (2026-09-25) — full-width, stacked, Manage primary
                      (it is the action a reader reaches for most: everyone already has contacts
                      to review). SLICE E5 - MANAGE shows who is actually in this category, inline.
                      It deliberately does NOT navigate to /dashboard/contacts: that page reads the
                      PERSONAL contact partition, while these live under the organization with
                      contactScope "corporate". Sending a reader there would show them a different
                      roster and let them believe it was this one. Until a corporate contacts page
                      exists, the honest thing this button can do is show the list it already has. */}
                  <button type="button" className="gcd-btn gcd-btn--primary gcd-btn--block" data-testid={`tile-${cat.key}-manage`}
                    aria-expanded={open} aria-controls={`tile-${cat.key}-roster`}
                    onClick={() => { setOpenCategory(open ? null : cat.key); if (onManage) onManage(cat.key); }}>
                    {open ? "Hide" : "Manage"}
                  </button>
                  {/* Opens the EXISTING import wizard with this category preselected — never a second form.
                      A second "Import" button used to sit here running the SAME handler to the SAME
                      route with the same mode and category: two controls, one capability, and a
                      reader left to guess at a difference that did not exist. */}
                  <button type="button" className="gcd-btn gcd-btn--block" data-testid={`tile-${cat.key}-add`}
                    onClick={() => onAddCategory && onAddCategory(cat.key)}>
                    {`Add ${cat.label.replace(/s$/, "")}`}
                  </button>
                </div>

                {open ? (
                  <ul className="gcd-roster" id={`tile-${cat.key}-roster`} data-testid={`tile-${cat.key}-roster`}>
                    {rows.length === 0 ? (
                      <li className="gcd-roster-empty">Nobody in this category yet. Add or import to get started.</li>
                    ) : rows.map((c) => (
                      <li className="gcd-roster-row" key={c.id} data-testid={`roster-${c.id}`}>
                        {/* The tag is a convenience for the eye; the full word rides along for
                            anyone reading with assistive technology or hovering. */}
                        <span className={`gcd-abbr gcd-abbr--${cat.key}`} title={cat.label.replace(/s$/, "")}
                          aria-label={cat.label.replace(/s$/, "")}>{cat.abbr}</span>
                        <span className="gcd-roster-name">{c.name}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>

        <p className="gcd-totals" data-testid="contact-totals">{contactTotalsLabel(bucket)}</p>

        {notice ? (
          <div className="gcd-notice" data-testid="unclassified-notice" role="status">
            <span>{notice.text}</span>
            <button type="button" className="gcd-btn" data-testid="unclassified-select-individual"
              onClick={() => onSelectIndividual && onSelectIndividual()}>
              Select Individual Contacts
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
