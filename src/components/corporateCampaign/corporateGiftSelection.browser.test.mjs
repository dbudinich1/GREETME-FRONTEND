// src/components/corporateCampaign/corporateGiftSelection.browser.test.mjs
//
// LANE 4 (2026-10-28) — CORPORATE GIFT SELECTION, browser-level. The real CampaignCard (with the Gift Place picker
// it now opens) is esbuild-bundled and mounted into jsdom with an INJECTED fake client. Every catalog answer is a
// fixture: no network, no provider, nothing published, nothing charged.
//
// Proves: entering / cancelling / returning from the Gift Place keeps the campaign's recipients, occasion,
// schedule and gift; the chosen gift reads the same in the Gift tab and the Overview; categories a campaign cannot
// fulfil are flagged and offer nothing; only the missing details are asked for afterwards; and the existing Save
// (delivery config) and Schedule & Payment surfaces are unchanged.
//
// Run: node --test src/components/corporateCampaign/corporateGiftSelection.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readdirSync as __scratchLs, rmSync as __scratchRm } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
process.on("exit", () => { try { for (const n of __scratchLs(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) __scratchRm(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const ENTRY = join(__dirname, `.__cgs.${process.pid}.entry.jsx`);
const BUNDLE = join(__dirname, `.__cgs.${process.pid}.bundle.mjs`);

let React, createRoot, act, CampaignCard, dom;

const CONTACTS = [
  { id: "e1", name: "Ana Employee", corporateContactType: "employee" },
  { id: "e2", name: "Ben Employee", corporateContactType: "employee" },
  { id: "c1", name: "Cara Client", corporateContactType: "client" },
];

// Shaped exactly as the server's toSelectableProduct projects an organization catalog item.
const BOX_A = {
  catalogItemId: "gm-a", provider: "prov", providerProductId: "box-a", title: "Roasted & Toasted", description: "A coffee box.",
  imageUrl: null, priceCents: 7800, currency: "USD", variantNames: ["Dark Roast", "Medium Roast"], greetMeCategories: ["gift_baskets"],
};
const BOX_B = {
  catalogItemId: "gm-b", provider: "prov", providerProductId: "box-b", title: "Desk Gadget Kit", description: "A tech box.",
  imageUrl: null, priceCents: 5200, currency: "USD", variantNames: [], greetMeCategories: ["tech"],
};

let calls = [];
let catalogResponse;
const withCatalog = (items) => { catalogResponse = { ok: true, status: 200, data: { giftType: "gift_boxes", provider: "prov", items } }; };
const fakeClient = {
  listGiftCatalog: (...a) => { calls.push(["listGiftCatalog", ...a]); return Promise.resolve(catalogResponse); },
  updateDeliveryConfig: (...a) => { calls.push(["updateDeliveryConfig", ...a]); return Promise.resolve({ ok: true, data: {} }); },
  setAudience: (...a) => { calls.push(["setAudience", ...a]); return Promise.resolve({ ok: true, data: {} }); },
  schedule: (...a) => { calls.push(["schedule", ...a]); return Promise.resolve({ ok: true, data: {} }); },
  activate: (...a) => { calls.push(["activate", ...a]); return Promise.resolve({ ok: true, data: {} }); },
  approve: () => Promise.resolve({ ok: true, data: {} }),
  lock: () => Promise.resolve({ ok: true, data: {} }),
  unlock: () => Promise.resolve({ ok: true, data: {} }),
  setCampaignEnabled: () => Promise.resolve({ ok: true, data: {} }),
  renameCampaign: (...a) => Promise.resolve({ ok: true, data: { name: a[2] } }),
  readCampaign: () => Promise.resolve({ ok: true, data: {} }),
  updateFeaturedSpread: () => Promise.resolve({ ok: true, data: {} }),
  readReadiness: () => Promise.resolve({ ok: true, data: {} }),
};

before(async () => {
  writeFileSync(ENTRY, `export { default as CampaignCard } from "./CampaignCard.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty", ".png": "empty", ".jpg": "empty" },
    external: ["react", "react-dom", "react-dom/client", "react-router-dom"],
    define: { "import.meta.env": "{}" },
  });
  dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event;
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only on Node 21+ */ }
  globalThis.MouseEvent = dom.window.MouseEvent; globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  CampaignCard = (await import(pathToFileURL(BUNDLE).href)).CampaignCard;
});
after(() => { for (const f of [ENTRY, BUNDLE, BUNDLE.replace(/\.mjs$/, ".css")]) { try { rmSync(f); } catch { /* gone */ } } });

async function mount(el) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(el); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return {
    host, root,
    q: (sel) => host.querySelector(sel), qa: (sel) => [...host.querySelectorAll(sel)],
    tid: (t) => host.querySelector(`[data-testid="${t}"]`), text: () => host.textContent,
    unmount: async () => { await act(async () => root.unmount()); host.remove(); },
  };
}
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); };
const setValue = async (el, v) => { await act(async () => {
  const proto = el.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
  el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}); };
const esc = async () => { await act(async () => { document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); }); };

const campaign = (over = {}) => ({
  campaignId: "cmp_1", name: "Q4 Client Appreciation", approvalStatus: "draft", lockStatus: "unlocked",
  audienceRefs: ["e1", "e2"],
  deliveryConfig: { scheduleMode: "campaign_date", scheduledForUtc: "2026-12-15T14:00:00.000Z", timeZone: "America/New_York", status: "configured" },
  ...over,
});
const cardEl = (over = {}) => React.createElement(CampaignCard, {
  campaign: campaign(over), contacts: CONTACTS, orgId: "org1", client: fakeClient, isOwner: true, busy: false,
  onAfterMutate: async () => {}, expanded: true, onToggleExpanded: () => {}, todayIso: "2026-10-28",
});

const ID = "cmp_1";
const overviewGift = (s) => s.tid(`card-info-gift-${ID}`).textContent;
const selectedGift = (s) => s.tid(`card-gift-selected-${ID}`).textContent;
const audienceTotal = (s) => s.tid(`card-audience-total-${ID}`).textContent;
const giftRadio = (s, v) => s.q(`[data-testid="c-${ID}-gift"] input[value="${v}"]`);
const openGiftTab = async (s) => click(s.tid(`card-tab-gift-${ID}`));
const openPicker = async (s) => { await openGiftTab(s); await click(s.tid(`card-browse-gifts-${ID}`)); };
const writes = () => calls.filter(([m]) => m === "updateDeliveryConfig" || m === "setAudience" || m === "schedule" || m === "activate");

// ── ENTER ─────────────────────────────────────────────────────────────────────────────────────────
test("entering the Gift Place from a campaign keeps the campaign's context in view and writes nothing", async () => {
  calls = []; withCatalog([BOX_A, BOX_B]);
  const s = await mount(cardEl());
  await openPicker(s);
  const picker = s.tid(`corp-gp-picker-${ID}`);
  assert.ok(picker, "the Gift Place opens inside the campaign's Gift tab");
  assert.match(s.tid(`corp-gp-for-${ID}`).textContent, /Q4 Client Appreciation/);
  assert.equal(s.tid(`corp-gp-context-who-${ID}`).textContent, "2 contacts");
  assert.match(s.tid(`corp-gp-context-when-${ID}`).textContent, /15 December/);
  assert.equal(s.tid(`corp-gp-context-gift-${ID}`).textContent, "No gift — the greeting on its own.");
  assert.equal(s.tid(`selector-gift-${ID}`).hidden, true, "Gift Options stay mounted (hidden) underneath");
  assert.ok(s.tid(`card-modal-sub-${ID}`), "still inside the same campaign dialog");
  assert.deepEqual(writes(), [], "opening the Gift Place writes nothing");
  await s.unmount();
});

test("the tab row is the individual Gift Place's row (QR Cash beside Gift Cards); unsupported categories are flagged", async () => {
  withCatalog([BOX_A, BOX_B]);
  const s = await mount(cardEl());
  await openPicker(s);
  const tabs = s.qa(`[data-testid="corp-gp-tabs-${ID}"] [role="tab"]`);
  assert.deepEqual(tabs.map((t) => t.getAttribute("data-testid").replace(`corp-gp-tab-`, "").replace(`-${ID}`, "")),
    ["brandable_goods", "gift_cards", "qrcash", "gift_baskets", "flowers", "americana", "faith_and_inspiration", "tech", "view_all"]);
  const unsupported = tabs.filter((t) => t.getAttribute("data-supported") === "false").map((t) => t.textContent);
  assert.deepEqual(unsupported.map((t) => t.split(" · ")[0]), ["Branded Goods", "Gift Cards", "Flowers"]);
  assert.ok(unsupported.every((t) => /not for campaigns/.test(t)), "flagged in words, not colour alone");
  assert.equal(s.tid(`corp-gp-content-${ID}`).getAttribute("data-tab"), "view_all", "opens on every gift a campaign can send");
  await s.unmount();
});

test("an unsupported category says why and offers nothing to choose", async () => {
  withCatalog([BOX_A, BOX_B]);
  const s = await mount(cardEl());
  await openPicker(s);
  for (const [id, re] of [["flowers", /Flowers can't be sent by a campaign yet/], ["gift_cards", /Gift cards can't be sent by a campaign yet/], ["brandable_goods", /Branded Goods can't be sent by a campaign yet/]]) {
    await click(s.tid(`corp-gp-tab-${id}-${ID}`));
    assert.match(s.tid(`corp-gp-unsupported-${ID}`).textContent, re);
    assert.equal(s.qa(`[data-testid^="gift-card-action-"]`).length, 0, `${id}: no product is selectable`);
  }
  assert.equal(giftRadio(s, "none").checked, true, "browsing an unsupported category changed nothing");
  await s.unmount();
});

test("categories use the Gift Place's own selection rule over the organization's catalog", async () => {
  withCatalog([BOX_A, BOX_B]);
  const s = await mount(cardEl());
  await openPicker(s);
  const ids = () => s.qa(`[data-testid^="gift-card-action-"]`).map((b) => b.getAttribute("data-testid").replace("gift-card-action-", ""));
  assert.deepEqual(ids(), ["box-a", "box-b"], "View All");
  assert.equal(s.tid("gift-card-price-box-a").textContent, "", "no price is introduced on a campaign gift card");
  assert.equal(/\$78|\$52/.test(s.tid(`corp-gp-picker-${ID}`).textContent), false);
  await click(s.tid(`corp-gp-tab-gift_baskets-${ID}`)); assert.deepEqual(ids(), ["box-a"]);
  await click(s.tid(`corp-gp-tab-tech-${ID}`)); assert.deepEqual(ids(), ["box-b"]);
  await click(s.tid(`corp-gp-tab-americana-${ID}`));
  assert.match(s.tid(`corp-gp-empty-${ID}`).textContent, /No gift boxes in Americana are published for campaigns yet/);
  assert.equal(s.tid(`gift-card-action-box-b`), null);
  await s.unmount();
});

// ── CANCEL ────────────────────────────────────────────────────────────────────────────────────────
test("Back to the campaign (and Escape) returns with recipients, occasion and gift exactly as they were", async () => {
  calls = []; withCatalog([BOX_A, BOX_B]);
  const s = await mount(cardEl({
    deliveryConfig: { scheduleMode: "contact_saved_date", occasionType: "anniversary", timeZone: "America/Chicago", status: "configured",
      defaultGift: { type: "curated", maxSpendCents: 5000 } },
  }));
  // Unsaved edits first: add the client category, change the occasion.
  await click(s.tid(`card-tab-recipients-${ID}`));
  await click(s.q(`#c-${ID}-aud-client`));
  assert.match(audienceTotal(s), /^3 contacts/);
  await click(s.tid(`card-tab-schedule-${ID}`));
  await setValue(s.tid(`card-occasion-${ID}`), "birthday");

  await openPicker(s);
  assert.equal(s.tid(`corp-gp-context-who-${ID}`).textContent, "3 contacts", "the picker sees the unsaved audience");
  assert.match(s.tid(`corp-gp-context-when-${ID}`).textContent, /birthday/);
  await click(s.tid(`corp-gp-tab-gift_baskets-${ID}`));
  await click(s.tid(`corp-gp-cancel-${ID}`));
  assert.equal(s.tid(`corp-gp-picker-${ID}`), null, "closed");
  assert.equal(giftRadio(s, "curated").checked, true, "gift unchanged");
  assert.equal(s.tid(`card-tier-${ID}`).value, "5000", "spend limit unchanged");
  assert.match(audienceTotal(s), /^3 contacts/, "unsaved recipients kept");
  assert.equal(s.tid(`card-occasion-${ID}`).value, "birthday", "unsaved occasion kept");
  assert.equal(s.tid(`card-tz-${ID}`).value, "America/Chicago");

  // Escape leaves the Gift Place first — the dialog stays open.
  await click(s.tid(`card-browse-gifts-${ID}`));
  await esc();
  assert.equal(s.tid(`corp-gp-picker-${ID}`), null, "Escape closed only the Gift Place");
  assert.ok(s.tid(`card-close-${ID}`), "the campaign dialog is still open");
  assert.deepEqual(writes(), [], "cancelling wrote nothing");
  await s.unmount();
});

// ── CHOOSE + RETURN ──────────────────────────────────────────────────────────────────────────────
test("choosing a gift box returns to the Gift tab with it selected; only its missing option is asked for", async () => {
  calls = []; withCatalog([BOX_A, BOX_B]);
  const s = await mount(cardEl());
  await click(s.tid(`card-tab-recipients-${ID}`));
  await click(s.q(`#c-${ID}-aud-client`));
  await openPicker(s);
  await click(s.tid("gift-card-action-box-a"));
  assert.equal(s.tid(`corp-gp-picker-${ID}`), null, "returned to the Gift tab");
  assert.equal(s.tid(`selector-gift-${ID}`).hidden, false);
  assert.equal(giftRadio(s, "gift_boxes").checked, true);
  assert.equal(s.q(`[data-testid="c-${ID}-giftbox"] input:checked`).value, "box-a", "the existing gift-box control holds it");
  assert.ok(s.tid(`card-giftbox-variants-${ID}`), "its published options are offered (the one thing still to decide)");
  assert.equal(s.tid(`card-giftbox-note-${ID}`), null, "no 'choose a gift box' prompt: that is already answered");
  assert.equal(s.tid(`card-qrcash-${ID}`), null, "nothing unrelated is asked");
  assert.match(audienceTotal(s), /^3 contacts/, "recipients kept across the round trip");
  assert.match(s.tid(`card-when-${ID}`) ? s.tid(`card-when-${ID}`).value : "", /^2026-12-15/, "schedule kept");
  assert.deepEqual(writes(), [], "staged in the draft only — nothing saved until Save");
  await s.unmount();
});

test("the chosen gift reads the same in the Gift tab, the Gift Place and the Overview", async () => {
  withCatalog([BOX_A, BOX_B]);
  const s = await mount(cardEl());
  await openPicker(s);
  await click(s.tid("gift-card-action-box-a"));
  await click(s.q(`#c-${ID}-gb-v-Dark\\ Roast`));
  const expected = "Gift box: Roasted & Toasted (Dark Roast) — one for each person.";
  assert.equal(selectedGift(s), expected);
  assert.equal(overviewGift(s), expected, "Overview tab says the same");
  await click(s.tid(`card-browse-gifts-${ID}`));
  assert.equal(s.tid(`corp-gp-context-gift-${ID}`).textContent, expected, "and so does the Gift Place");
  const sel = s.tid("gift-card-action-box-a");
  assert.match(sel.textContent, /Selected/, "the chosen card is marked selected");
  // Re-choosing the SAME box keeps its options; a different box clears them.
  await click(sel);
  assert.equal(selectedGift(s), expected);
  await click(s.tid(`card-browse-gifts-${ID}`));
  await click(s.tid("gift-card-action-box-b"));
  assert.equal(selectedGift(s), "Gift box: Desk Gadget Kit — one for each person.");
  assert.equal(overviewGift(s), "Gift box: Desk Gadget Kit — one for each person.");
  await s.unmount();
});

test("a SAVED gift-box campaign shows its box on the Overview (it used to read 'No gift')", async () => {
  withCatalog([BOX_A]);
  const s = await mount(cardEl({
    deliveryConfig: { scheduleMode: "campaign_date", scheduledForUtc: "2026-12-15T14:00:00.000Z", status: "configured",
      defaultGift: { type: "gift_boxes", maxSpendCents: 2500, product: BOX_A, variants: ["Medium Roast"] } },
  }));
  assert.equal(overviewGift(s), "Gift box: Roasted & Toasted (Medium Roast) — one for each person.");
  await openGiftTab(s);
  assert.equal(selectedGift(s), overviewGift(s));
  await s.unmount();
});

test("Save after a Gift Place choice uses the existing delivery-config save, unchanged", async () => {
  calls = []; withCatalog([BOX_A, BOX_B]);
  const s = await mount(cardEl());
  await openPicker(s);
  await click(s.tid("gift-card-action-box-b"));
  await click(s.tid(`act-save-${ID}`));
  const put = calls.find(([m]) => m === "updateDeliveryConfig");
  assert.ok(put, "saved through updateDeliveryConfig");
  const body = put[3];
  assert.equal(body.defaultGift.type, "gift_boxes");
  assert.equal(body.defaultGift.product.providerProductId, "box-b");
  assert.deepEqual(body.defaultGift.variants, []);
  assert.equal(body.defaultGift.maxSpendCents, 2500, "the existing spend tier, untouched");
  assert.equal(body.scheduleMode, "campaign_date");
  assert.equal(calls.some(([m]) => m === "setAudience"), false, "audience not rewritten: it did not change");
  assert.equal(calls.some(([m]) => m === "schedule" || m === "activate"), false, "no scheduling, funding or send");
  await s.unmount();
});

// ── QR CASH ──────────────────────────────────────────────────────────────────────────────────────
test("QR Cash from the Gift Place: chosen on a campaign date, then only the amount is asked for", async () => {
  withCatalog([BOX_A]);
  const s = await mount(cardEl());
  await openPicker(s);
  await click(s.tid(`corp-gp-tab-qrcash-${ID}`));
  await click(s.tid(`corp-gp-choose-qrcash-${ID}`));
  assert.equal(giftRadio(s, "qrcash").checked, true);
  assert.ok(s.tid(`card-qrcash-amount-${ID}`), "the existing amount field is the one thing asked");
  assert.match(s.tid(`card-qrcash-blocked-${ID}`).textContent, /Enter a QR Cash amount from \$5 to \$100/);
  assert.equal(overviewGift(s), "QR Cash™ — enter an amount from $5 to $100.");
  assert.equal(selectedGift(s), overviewGift(s));
  await s.unmount();
});

test("QR Cash cannot be chosen for a campaign that sends on each contact's own date — and says why", async () => {
  withCatalog([BOX_A]);
  const s = await mount(cardEl({ deliveryConfig: { scheduleMode: "contact_saved_date", occasionType: "birthday", status: "configured" } }));
  await openPicker(s);
  await click(s.tid(`corp-gp-tab-qrcash-${ID}`));
  assert.equal(s.tid(`corp-gp-choose-qrcash-${ID}`).disabled, true);
  assert.match(s.tid(`corp-gp-qrcash-reason-${ID}`).textContent, /sent once, on one campaign date/);
  await s.unmount();
});

// ── LOCKED / EMPTY / PAYMENT ─────────────────────────────────────────────────────────────────────
test("a locked campaign keeps its gift: the Gift Place entry is disabled with its reason", async () => {
  withCatalog([BOX_A]);
  const s = await mount(cardEl({ lockStatus: "locked", approvalStatus: "approved" }));
  await openGiftTab(s);
  assert.equal(s.tid(`card-browse-gifts-${ID}`).disabled, true);
  assert.match(s.tid(`card-browse-gifts-reason-${ID}`).textContent, /Unlock the campaign to change its gift/);
  await s.unmount();
});

test("with no published gift boxes (or a refused catalog) the Gift Place offers no product", async () => {
  for (const res of [{ ok: true, status: 200, data: { items: [] } }, { ok: false, dormant: true, status: 503 }]) {
    catalogResponse = res;
    const s = await mount(cardEl());
    await openPicker(s);
    assert.match(s.tid(`corp-gp-empty-${ID}`).textContent, /No gift boxes are published for campaigns yet/);
    assert.equal(s.qa(`[data-testid^="gift-card-action-"]`).length, 0);
    await s.unmount();
  }
});

test("the Schedule & Payment tab is untouched by a Gift Place choice", async () => {
  withCatalog([BOX_A]);
  const s = await mount(cardEl());
  await click(s.tid(`card-tab-schedule-${ID}`));
  const before = s.tid(`tab-schedule-${ID}`).innerHTML;
  await openPicker(s);
  await click(s.tid(`corp-gp-cancel-${ID}`));
  await click(s.tid(`card-tab-schedule-${ID}`));
  assert.equal(s.tid(`tab-schedule-${ID}`).innerHTML, before, "byte-identical after entering and cancelling");
  assert.ok(s.tid(`card-payment-summary-${ID}`), "the payment summary is still there");
  await s.unmount();
});
