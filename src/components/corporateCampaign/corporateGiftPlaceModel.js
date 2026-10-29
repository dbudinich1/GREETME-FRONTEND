// src/components/corporateCampaign/corporateGiftPlaceModel.js
//
// LANE 4 (2026-10-28) — CORPORATE GIFT SELECTION: the Gift Place, browsed from a campaign.
//
// The individual Gift Place's own vocabulary and rules are REUSED, not copied: the selector row and the one
// selection rule (pages/merchSelection.js), the card projection shape and the "Select Gift" action label
// (pages/giftPlaceViewModel.js). What this module adds is the one corporate difference: WHICH of those categories
// a campaign can actually fulfil. That answer is not a preference held here — it mirrors the live backend:
//
//   services/corporateCampaign/deliveryConfig.js  CORPORATE_AUTOMATABLE_GIFT_TYPES = ["curated", ...CORPORATE_FUNDABLE_GIFT_TYPES]
//   services/providers/registry.js                CORPORATE_FUNDABLE_GIFT_TYPES  = ["gift_boxes"]  (BE f5297c8, evaluated)
//     flowers     — provider declares taxKnownBeforeCharge = false  → refused (delivery_config_interactive_funding_required)
//     gift_cards  — provider declares no getAuthoritativeQuote      → refused (same code)
//     merch       — interactively funded (deliveryConfig INTERACTIVELY_FUNDED) → refused
//   services/corporateCampaign/corporateCampaignService.js listSelectableGiftProducts — the org catalog lists ONLY a
//     corporate-fundable provider's published products, each carrying its Gift Place greetMeCategories.
//
// So a Gift Place category is browsable for a campaign through the gift boxes the organization's catalog publishes
// into it, and Flowers, Gift Cards and Branded Goods are shown — never hidden, never selectable — with the reason.
// Pure: no React, no network. Unit-testable under `node --test`.

import { SELECTOR_ROW, BRANDABLE, VIEW_ALL, selectProducts } from "../../pages/merchSelection.js";
import { GIFT_ACTION_LABELS, GIFT_SOURCES } from "../../pages/giftPlaceViewModel.js";
import {
  PROVIDER_GIFT_OPTION, selectedProductId, giftOptionState, isProviderFundableGiftType,
} from "./corporateDashboardModel.js";

/** The QR Cash tab, which the Gift Place shows beside Gift Cards. A gift type, not a catalogue category. */
export const QR_CASH_TAB = "qrcash";

/** "Select Gift" — the individual Gift Place's own action label when choosing a gift for a greeting. */
export const CORPORATE_GIFT_ACTION_LABEL = GIFT_ACTION_LABELS.greeting;

// The Gift Place categories a campaign CANNOT fulfil, each with the specific reason (customer words, no vendor
// names). Every other selector is fulfilled through gift boxes.
export const CORPORATE_UNSUPPORTED_CATEGORIES = Object.freeze({
  [BRANDABLE]: "Branded Goods can't be sent by a campaign yet. Each order needs a person to check out.",
  gift_cards: "Gift cards can't be sent by a campaign yet. Their final cost can't be confirmed before the card is charged.",
  flowers: "Flowers can't be sent by a campaign yet. Their final cost, including tax, isn't known before the card is charged.",
});

export const CORPORATE_GIFT_PLACE_NOTE =
  "A campaign can send gift boxes and QR Cash™. Flowers, gift cards and Branded Goods can't be sent by a campaign yet.";

/** Is this Gift Place selector one a campaign can fulfil? (QR Cash has its own rule: see qrCashTabState.) */
export function isCorporateSupportedSelector(id) {
  if (id === QR_CASH_TAB) return true;
  if (!SELECTOR_ROW.some((s) => s.id === id)) return false;
  return !Object.prototype.hasOwnProperty.call(CORPORATE_UNSUPPORTED_CATEGORIES, id);
}

/**
 * The Gift Place tab row in the Gift Place's own order (QR Cash beside Gift Cards), each carrying whether a
 * campaign can fulfil it and, if not, why.
 */
export function corporateGiftPlaceTabs() {
  const out = [];
  for (const sel of SELECTOR_ROW) {
    const reason = CORPORATE_UNSUPPORTED_CATEGORIES[sel.id] || null;
    out.push(Object.freeze({ id: sel.id, label: sel.label, kind: sel.kind, supported: !reason, reason }));
    if (sel.id === "gift_cards") {
      out.push(Object.freeze({ id: QR_CASH_TAB, label: "QR Cash™", kind: "gift_type", supported: true, reason: null }));
    }
  }
  return Object.freeze(out);
}

const CATEGORY_LABEL = Object.freeze(Object.fromEntries(SELECTOR_ROW.map((s) => [s.id, s.label])));

/**
 * Project an organization catalog item (the server's toSelectableProduct shape) into the Gift Place card shape.
 * NO PRICE is shown: like the Send now gift-box step (Report 142), a campaign gift box carries no list price — each
 * person's cost (shipping and tax included) comes from the server's quote at review/funding, and the catalog's stored
 * figure is not what the individual Gift Place shows for the same box. `priceMinor` is kept for ordering only.
 */
export function fromCorporateCatalogItem(item) {
  const id = selectedProductId(item);
  if (!id) return null;
  return Object.freeze({
    id,
    source: GIFT_SOURCES.PROVIDER,
    name: String(item.title || id),
    description: String(item.description || "").trim(),
    imageUrl: item.imageUrl || null,
    priceLabel: "",
    priceMinor: Number.isInteger(item.priceCents) ? item.priceCents : null,
    chip: chipForCategories(item.greetMeCategories),
  });
}

function chipForCategories(cats) {
  const first = (Array.isArray(cats) ? cats : []).find((c) => CATEGORY_LABEL[c] && !CORPORATE_UNSUPPORTED_CATEGORIES[c]);
  return first ? CATEGORY_LABEL[first] : PROVIDER_GIFT_OPTION.label;
}

/**
 * What one tab shows, from the organization's published catalog. Uses the individual Gift Place's ONE selection
 * rule, so a gift box appears under exactly the categories it does there (View All shows every one).
 *
 * kind: "unsupported" (with reason) | "qrcash" | "products" (cards may be empty).
 */
export function corporateTabContent(tabId, items) {
  if (tabId === QR_CASH_TAB) return { kind: "qrcash" };
  const reason = CORPORATE_UNSUPPORTED_CATEGORIES[tabId];
  if (reason) return { kind: "unsupported", reason };
  const all = Array.isArray(items) ? items : [];
  const chosen = tabId === VIEW_ALL ? all : selectProducts(all, tabId);
  return { kind: "products", cards: chosen.map(fromCorporateCatalogItem).filter(Boolean), itemsById: new Map(chosen.map((i) => [selectedProductId(i), i])) };
}

/** Whether QR Cash can be chosen for this campaign right now, and why not. Same rule as the Gift Options bubble. */
export function qrCashTabState({ scheduleMode = null, qrCashAvailable } = {}) {
  const st = qrCashAvailable === undefined ? giftOptionState("qrcash", { scheduleMode }) : giftOptionState("qrcash", { scheduleMode, qrCashAvailable });
  if (st.selectable) return { selectable: true, reason: null };
  if (scheduleMode && scheduleMode !== "campaign_date") {
    return { selectable: false, reason: "QR Cash™ is sent once, on one campaign date, so it can't go with a campaign that sends on each contact's own date." };
  }
  return { selectable: false, reason: "QR Cash™ isn't available for campaigns yet." };
}

/** The tab the picker opens on: QR Cash if that is the draft's gift, otherwise View All (every gift a campaign can send). */
export function initialCorporateTab(draft) {
  return draft && draft.giftType === "qrcash" ? QR_CASH_TAB : VIEW_ALL;
}

/**
 * The draft patch for a choice made in the Gift Place. Only the gift fields change; the campaign's audience,
 * occasion, schedule, time zone and spend limit are never touched. Re-choosing the SAME box keeps its options; a
 * different box clears them (a label published for one box means nothing on another), exactly as the Gift tab does.
 */
export function giftPlaceChoicePatch(draft, choice) {
  const d = draft || {};
  if (choice && choice.giftType === QR_CASH_TAB) return { giftType: "qrcash" };
  if (choice && isProviderFundableGiftType(choice.giftType) && selectedProductId(choice.product)) {
    const same = isProviderFundableGiftType(d.giftType) && selectedProductId(d.product) === selectedProductId(choice.product);
    return { giftType: choice.giftType, product: choice.product, variants: same && Array.isArray(d.variants) ? d.variants : [] };
  }
  return {};
}

/** The selected card id in the picker: the draft's gift box, if it carries one. */
export function selectedGiftPlaceId(draft) {
  return draft && isProviderFundableGiftType(draft.giftType) ? selectedProductId(draft.product) || null : null;
}
