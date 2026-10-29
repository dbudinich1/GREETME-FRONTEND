// src/components/corporateCampaign/corporateGiftPlaceModel.test.mjs
// LANE 4 (2026-10-28) — the pure corporate Gift Place model. Run: node --test <this file>
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  corporateGiftPlaceTabs, corporateTabContent, qrCashTabState, giftPlaceChoicePatch, initialCorporateTab,
  selectedGiftPlaceId, isCorporateSupportedSelector, fromCorporateCatalogItem, CORPORATE_UNSUPPORTED_CATEGORIES,
  CORPORATE_GIFT_ACTION_LABEL, QR_CASH_TAB,
} from "./corporateGiftPlaceModel.js";
import { SELECTOR_ROW } from "../../pages/merchSelection.js";
import { SELECTOR_TO_GIFT_TYPE, GIFT_ACTION_LABELS } from "../../pages/giftPlaceViewModel.js";
import { PROVIDER_FUNDABLE_GIFT_TYPES, describeCampaignPlan, selectorSummaries, giftBoxSelectionLabel } from "./corporateDashboardModel.js";

const BOX = { providerProductId: "box-a", title: "Roasted & Toasted", priceCents: 7800, variantNames: ["Dark"], greetMeCategories: ["tech"] };

test("every Gift Place selector is represented, in the Gift Place's order, with QR Cash beside Gift Cards", () => {
  const ids = corporateGiftPlaceTabs().map((t) => t.id);
  const expected = SELECTOR_ROW.flatMap((s) => (s.id === "gift_cards" ? [s.id, QR_CASH_TAB] : [s.id]));
  assert.deepEqual(ids, expected);
});

test("the unsupported set is exactly the categories the live backend cannot fund for a campaign", () => {
  // BE f5297c8: CORPORATE_FUNDABLE_GIFT_TYPES = ["gift_boxes"]; flowers / gift_cards / merch are refused.
  assert.deepEqual([...PROVIDER_FUNDABLE_GIFT_TYPES], ["gift_boxes"]);
  assert.deepEqual(Object.keys(CORPORATE_UNSUPPORTED_CATEGORIES).sort(), ["brandable_goods", "flowers", "gift_cards"]);
  assert.equal(SELECTOR_TO_GIFT_TYPE.flowers, "flowers", "Flowers routes to a type a campaign cannot fund");
  for (const t of corporateGiftPlaceTabs()) {
    assert.equal(t.supported, isCorporateSupportedSelector(t.id));
    if (!t.supported) assert.match(t.reason, /can't be sent by a campaign yet\./);
  }
});

test("the action label is the individual Gift Place's 'Select Gift'", () => {
  assert.equal(CORPORATE_GIFT_ACTION_LABEL, GIFT_ACTION_LABELS.greeting);
});

test("tab content: unsupported offers no cards; categories use the Gift Place selection rule", () => {
  assert.equal(corporateTabContent("flowers", [BOX]).kind, "unsupported");
  assert.equal(corporateTabContent("flowers", [BOX]).cards, undefined);
  assert.deepEqual(corporateTabContent("tech", [BOX]).cards.map((c) => c.id), ["box-a"]);
  assert.deepEqual(corporateTabContent("gift_baskets", [BOX]).cards, []);
  assert.deepEqual(corporateTabContent("view_all", [BOX, { title: "no id" }]).cards.map((c) => c.id), ["box-a"]);
  assert.equal(corporateTabContent(QR_CASH_TAB, [BOX]).kind, "qrcash");
});

test("a projected card carries NO price (as Send now: the quote is the authority); chip names its category", () => {
  const c = fromCorporateCatalogItem(BOX);
  assert.equal(c.priceLabel, "");
  assert.equal(c.priceMinor, 7800, "ordering only");
  assert.equal(c.chip, "Tech");
  assert.equal(fromCorporateCatalogItem({ providerProductId: "x" }).priceLabel, "");
});

test("a choice patches ONLY the gift fields; the same box keeps its options, another clears them", () => {
  const draft = { giftType: "gift_boxes", product: BOX, variants: ["Dark"], categories: ["employee"], occasionType: "birthday", tierCents: 5000 };
  assert.deepEqual(giftPlaceChoicePatch(draft, { giftType: "gift_boxes", product: BOX }), { giftType: "gift_boxes", product: BOX, variants: ["Dark"] });
  const other = { providerProductId: "box-b" };
  assert.deepEqual(giftPlaceChoicePatch(draft, { giftType: "gift_boxes", product: other }), { giftType: "gift_boxes", product: other, variants: [] });
  assert.deepEqual(giftPlaceChoicePatch(draft, { giftType: QR_CASH_TAB }), { giftType: "qrcash" });
  assert.deepEqual(giftPlaceChoicePatch(draft, { giftType: "flowers", product: BOX }), {}, "an unsupported type changes nothing");
  assert.deepEqual(giftPlaceChoicePatch(draft, { giftType: "gift_boxes", product: {} }), {}, "no product, no change");
});

test("QR Cash tab state follows the same rule as the Gift Options bubble", () => {
  assert.equal(qrCashTabState({ scheduleMode: "campaign_date", qrCashAvailable: true }).selectable, true);
  assert.match(qrCashTabState({ scheduleMode: "contact_saved_date", qrCashAvailable: true }).reason, /one campaign date/);
  assert.match(qrCashTabState({ scheduleMode: "campaign_date", qrCashAvailable: false }).reason, /isn't available for campaigns yet/);
});

test("initial tab and selected id", () => {
  assert.equal(initialCorporateTab({ giftType: "qrcash" }), QR_CASH_TAB);
  assert.equal(initialCorporateTab({ giftType: "none" }), "view_all");
  assert.equal(selectedGiftPlaceId({ giftType: "gift_boxes", product: BOX }), "box-a");
  assert.equal(selectedGiftPlaceId({ giftType: "curated", product: BOX }), null);
});

test("Overview and selector summary name a gift box (previously 'No gift'); other gifts unchanged", () => {
  const gift = (draft) => describeCampaignPlan({ draft }).find((r) => r.key === "gift").value;
  assert.equal(gift({ giftType: "gift_boxes", product: BOX, variants: ["Dark"] }), "Gift box: Roasted & Toasted (Dark) — one for each person.");
  assert.equal(gift({ giftType: "gift_boxes", product: null }), "Gift box — choose one from the Gift Place.");
  assert.equal(gift({ giftType: "none" }), "No gift — the greeting on its own.");
  assert.equal(gift({ giftType: "curated", tierCents: 2500 }), "Let Greet-Me™ select, up to $25 per person.");
  const sum = selectorSummaries({ draft: { giftType: "gift_boxes", product: BOX, variants: [] } }).find((r) => r.key === "gift").value;
  assert.equal(sum, giftBoxSelectionLabel(BOX, []));
});
