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

import {
  CONTACT_CATEGORIES,
  bucketContactsByCategory,
  contactTotalsLabel,
  unclassifiedNotice,
} from "./corporateDashboardModel.js";
import "./premiumDashboard.css";

export default function ContactTiles({ contacts, loading = false, onManage, onAddCategory, onSelectIndividual }) {
  const bucket = bucketContactsByCategory(contacts);
  const notice = unclassifiedNotice(bucket);

  return (
    <section className="gcd-panel" data-testid="contact-tiles-panel" aria-labelledby="gcd-contacts-head">
      <div className="gcd-panel-head">
        <div>
          <h2 className="gcd-panel-title" id="gcd-contacts-head">Contacts</h2>
          <p className="gcd-panel-note">Who your campaigns can reach. Categories come from how each contact was imported.</p>
        </div>
      </div>

      <div style={{ padding: "18px 20px 20px" }}>
        <div className="gcd-tiles" data-testid="contact-tiles">
          {CONTACT_CATEGORIES.map((cat) => {
            const rows = bucket.byCategory[cat.key];
            const recent = rows.slice(0, 2).map((c) => c.name).join(", ");
            return (
              <article className="gcd-tile" key={cat.key} data-testid={`tile-${cat.key}`} aria-labelledby={`tile-${cat.key}-name`}>
                <h3 className="gcd-tile-name" id={`tile-${cat.key}-name`}>{cat.label}</h3>
                <span className="gcd-tile-count" data-testid={`tile-${cat.key}-count`}>
                  {loading ? "—" : bucket.counts[cat.key]}
                </span>
                <p className="gcd-tile-desc">{cat.description}</p>
                <p className="gcd-tile-recent" data-testid={`tile-${cat.key}-recent`}>
                  {rows.length === 0
                    ? "No contacts in this category yet."
                    : `Most recent: ${recent}${rows.length > 2 ? ` +${rows.length - 2} more` : ""}`}
                </p>
                <div className="gcd-tile-actions">
                  <button type="button" className="gcd-btn" data-testid={`tile-${cat.key}-manage`}
                    onClick={() => onManage && onManage(cat.key)}>
                    Manage
                  </button>
                  {/* Opens the EXISTING import wizard with this category preselected — never a second form. */}
                  <button type="button" className="gcd-btn gcd-btn--primary" data-testid={`tile-${cat.key}-add`}
                    onClick={() => onAddCategory && onAddCategory(cat.key)}>
                    {`Add ${cat.label.replace(/s$/, "")}`}
                  </button>
                </div>
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
