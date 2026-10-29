// src/components/corporateCampaign/CorporateGiftPlacePicker.jsx
//
// LANE 4 (2026-10-28) — the Gift Place, browsed from a campaign.
//
// The individual Gift Place experience, inside the campaign's own Gift tab: the same category row (in the same
// order, QR Cash beside Gift Cards, a drop-down on phones), the same gallery card and grid
// (components/giftPlace/GiftProductCard.jsx) and the same "Select Gift" action. It opens IN the campaign dialog
// rather than navigating away, so the campaign, its recipients, occasion, schedule and current gift are all still
// on screen underneath and nothing has to be carried across a route and restored.
//
// What it does NOT do: it writes nothing to the server and nothing to the draft by itself. A choice is reported
// to the card (`onChoose`), which stages it into the SAME edit buffer every other control on the card uses —
// Save and Cancel keep their meaning. Back to the campaign (`onCancel`) changes nothing at all.
//
// The products are the organization's published corporate catalog (the card's existing listGiftCatalog read),
// never the individual store's list: a campaign can only send what that catalog publishes. Categories a campaign
// cannot fulfil stay visible and say why (corporateGiftPlaceModel.js); none of their products are offered.

import { useEffect, useState } from "react";
import { GiftProductGrid } from "../giftPlace/GiftProductCard.jsx";
import {
  corporateGiftPlaceTabs, corporateTabContent, qrCashTabState, initialCorporateTab, selectedGiftPlaceId,
  CORPORATE_GIFT_ACTION_LABEL, CORPORATE_GIFT_PLACE_NOTE, QR_CASH_TAB,
} from "./corporateGiftPlaceModel.js";
import { PROVIDER_GIFT_OPTION } from "./corporateDashboardModel.js";

const TABS = corporateGiftPlaceTabs();

function useWidth() {
  const read = () => (typeof window !== "undefined" && Number.isFinite(window.innerWidth) ? window.innerWidth : 1024);
  const [w, setW] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const on = () => setW(read());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

export default function CorporateGiftPlacePicker({
  campaignId, campaignName = "", context = [], items = [], draft = {}, scheduleMode = null,
  onChoose, onCancel,
}) {
  const [tab, setTab] = useState(() => initialCorporateTab(draft));
  const width = useWidth();
  const isMobile = width < 768;
  const isNarrow = width < 420;
  const tid = (s) => `corp-gp-${s}-${campaignId}`;
  const content = corporateTabContent(tab, items);
  const current = TABS.find((t) => t.id === tab) || TABS[0];
  const qr = qrCashTabState({ scheduleMode });
  const selectedId = selectedGiftPlaceId(draft);

  const pill = (t) => {
    const on = t.id === tab;
    return (
      <button key={t.id} type="button" role="tab" aria-selected={on}
        data-testid={tid(`tab-${t.id}`)} data-supported={t.supported ? "true" : "false"}
        title={t.supported ? undefined : t.reason}
        onClick={() => setTab(t.id)}
        style={{
          flexShrink: 0, padding: "0.375rem 0.875rem", borderRadius: 9999, fontSize: "0.8125rem", fontFamily: "inherit",
          fontWeight: on ? 700 : 600, cursor: "pointer", whiteSpace: "nowrap", minHeight: 0,
          border: on ? "1px solid #2C1D46" : (t.supported ? "1px solid transparent" : "1px dashed #b9acd0"),
          background: on ? "#2C1D46" : "transparent",
          color: on ? "#fff" : (t.supported ? "#2C1D46" : "#8a7fa0"),
        }}>
        {t.label}{t.supported ? null : <span style={{ fontWeight: 500, fontSize: "0.6875rem" }}>{" · not for campaigns"}</span>}
      </button>
    );
  };

  return (
    <section className="gcd-wcard" data-testid={tid("picker")} aria-labelledby={tid("title")} style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h4 className="gcd-wcard-title" id={tid("title")} style={{ margin: 0 }}>
            <span className="gcd-wcard-icon" aria-hidden="true">{"\u{1F381}"}</span>
            Gift Place
          </h4>
          <p className="gcd-wcard-note" data-testid={tid("for")} style={{ margin: "4px 0 0", overflowWrap: "anywhere" }}>
            Choosing a gift for <strong>{campaignName || "this campaign"}</strong>
          </p>
        </div>
        <button type="button" className="gcd-btn" data-testid={tid("cancel")} onClick={onCancel}>
          ← Back to the campaign
        </button>
      </div>

      {/* The campaign's own context, kept in view while browsing. Read from the draft; nothing here edits it. */}
      {context.length ? (
        <dl className="gcd-info" data-testid={tid("context")} style={{ marginTop: 10 }}>
          {context.map((row) => (
            <div className="gcd-info-row" key={row.key}>
              <dt className="gcd-info-label">{row.label}</dt>
              <dd className="gcd-info-value" data-testid={tid(`context-${row.key}`)}>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="gcd-wcard-note" data-testid={tid("note")} style={{ margin: "10px 0" }}>{CORPORATE_GIFT_PLACE_NOTE}</p>

      {isMobile ? (
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 10px" }}>
          <span style={{ flex: "none", fontSize: "0.75rem", fontWeight: 700 }}>Show</span>
          <select data-testid={tid("select")} aria-label="Gift category" value={tab} onChange={(e) => setTab(e.target.value)}
            style={{ flex: 1, minWidth: 0, height: "2.25rem", padding: "0 0.625rem", borderRadius: "0.625rem", border: "1px solid #d9cfe9", background: "#fff", color: "#2C1D46", fontSize: "0.9375rem", fontWeight: 700, fontFamily: "inherit" }}>
            {TABS.map((t) => <option key={t.id} value={t.id}>{t.supported ? t.label : `${t.label} — not for campaigns`}</option>)}
          </select>
        </label>
      ) : (
        <div role="tablist" aria-label="Gift Place categories" data-testid={tid("tabs")}
          style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", margin: "0 0 12px" }}>
          {TABS.map(pill)}
        </div>
      )}

      <div data-testid={tid("content")} data-tab={tab} style={{ minWidth: 0 }}>
        {content.kind === "unsupported" ? (
          <div role="status" data-testid={tid("unsupported")}
            style={{ padding: "1.25rem", border: "1px dashed #d9cfe9", borderRadius: 12, color: "#4b4060", fontSize: ".9rem", lineHeight: 1.5 }}>
            <strong style={{ display: "block", marginBottom: 4 }}>{current.label} — not available for campaigns</strong>
            {current.reason}
          </div>
        ) : content.kind === "qrcash" ? (
          <div data-testid={tid("qrcash")} style={{ padding: "1.25rem", border: "1px solid #e7e0f0", borderRadius: 12, fontSize: ".9rem", lineHeight: 1.5 }}>
            <strong style={{ display: "block", marginBottom: 4 }}>QR Cash™ — cash they can scan and spend.</strong>
            The same amount goes to everyone, once, on the campaign date. You enter the amount on the Gift tab.
            <div style={{ marginTop: 12 }}>
              <button type="button" className="gcd-btn gcd-btn--primary" data-testid={tid("choose-qrcash")}
                disabled={!qr.selectable} onClick={() => qr.selectable && onChoose && onChoose({ giftType: QR_CASH_TAB })}>
                {draft.giftType === "qrcash" ? "Keep QR Cash™" : "Choose QR Cash™"}
              </button>
              {qr.reason ? <p className="gcd-reason" role="status" data-testid={tid("qrcash-reason")} style={{ margin: "8px 0 0" }}>{qr.reason}</p> : null}
            </div>
          </div>
        ) : content.cards.length === 0 ? (
          // The org catalog is the only source (fail-closed: a refusal and an empty list read the same).
          <div role="status" data-testid={tid("empty")}
            style={{ padding: "1.25rem", border: "1px dashed #d9cfe9", borderRadius: 12, color: "#4b4060", fontSize: ".9rem", lineHeight: 1.5 }}>
            {tab === "view_all" ? "No gift boxes are published for campaigns yet." : `No gift boxes in ${current.label} are published for campaigns yet.`}
          </div>
        ) : (
          <GiftProductGrid
            cards={content.cards}
            state="ready"
            variant="gallery"
            isNarrow={isNarrow}
            actionLabel={CORPORATE_GIFT_ACTION_LABEL}
            selectedId={selectedId}
            chipFor={(card) => card.chip}
            onAction={(card) => {
              const item = content.itemsById.get(card.id);
              if (item && onChoose) onChoose({ giftType: PROVIDER_GIFT_OPTION.value, product: item });
            }}
          />
        )}
      </div>
    </section>
  );
}
