// src/components/corporateCampaign/giftBoxPicker.browser.test.mjs
//
// G3/G4 (Founder decision 2026-09-20) — BROWSER-LEVEL proof of the Gift Box picker.
//
// The real CampaignCard is esbuild-bundled and mounted into jsdom with an INJECTED fake client.
// Every catalog response here is a fixture: no network, no provider, no flag is read or changed,
// and nothing is published. That is exactly the offline populated-state evidence the Founder
// authorized, and it is the only way to see a populated picker at all — a provider-backed catalog
// item cannot be published while the provider is dormant, so no real environment can produce one
// before activation.
//
// A NEW FILE on purpose: premiumDashboard.browser.test.mjs belongs to another team's in-flight
// work, and the branch that rewrites this card is preserved untouched.
//
// Run: node --test src/components/corporateCampaign/giftBoxPicker.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync, mkdirSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__gb.entry.jsx");
const BUNDLE = join(__dirname, ".__gb.bundle.mjs");
// Rendered evidence lands OUTSIDE the repository, beside the other closeout reports.
const EVIDENCE_DIR = "C:\\1_GREET-ME\\reports\\g4-evidence";

let React, createRoot, act, CampaignCard, dom;

const CONTACTS = [
  { id: "e1", name: "Ana Employee", corporateContactType: "employee" },
  { id: "e2", name: "Ben Employee", corporateContactType: "employee" },
];

// Two published gift boxes, shaped EXACTLY as the server's toSelectableProduct projects them.
const BOX_A = {
  catalogItemId: "gm-prov-box-a", provider: "prov", providerProductId: "box-a",
  title: "Roasted & Toasted", description: "A coffee box.", imageUrl: null,
  priceCents: 7800, currency: "USD", variantNames: ["Dark Roast", "Medium Roast"], greetMeCategories: [],
};
const BOX_B = {
  catalogItemId: "gm-prov-box-b", provider: "prov", providerProductId: "box-b",
  title: "The Sweet One", description: "A dessert box.", imageUrl: null,
  priceCents: 5200, currency: "USD", variantNames: [], greetMeCategories: [],
};

let calls = [];
let catalogResponse = { ok: true, status: 200, data: { giftType: "gift_boxes", provider: "prov", items: [] } };

const fakeClient = {
  listGiftCatalog: (...a) => { calls.push(["listGiftCatalog", ...a]); return Promise.resolve(catalogResponse); },
  updateDeliveryConfig: (...a) => { calls.push(["updateDeliveryConfig", ...a]); return Promise.resolve({ ok: true, data: {} }); },
  setAudience: (...a) => { calls.push(["setAudience", ...a]); return Promise.resolve({ ok: true, data: {} }); },
  schedule: () => Promise.resolve({ ok: true, data: {} }),
  activate: () => Promise.resolve({ ok: true, data: {} }),
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
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty" },
    external: ["react", "react-dom", "react-dom/client", "react-router-dom"],
  });
  dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event;
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.MouseEvent = dom.window.MouseEvent; globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  const m = await import(pathToFileURL(BUNDLE).href);
  CampaignCard = m.CampaignCard;
});
after(() => {
  for (const f of [ENTRY, BUNDLE, BUNDLE.replace(/\.mjs$/, ".css")]) {
    try { rmSync(f); } catch { /* already gone */ }
  }
});

async function mount(el) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(el); });
  return {
    host, root,
    q: (sel) => host.querySelector(sel),
    qa: (sel) => [...host.querySelectorAll(sel)],
    tid: (t) => host.querySelector(`[data-testid="${t}"]`),
    text: () => host.textContent,
  };
}
const click = async (el) => {
  await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
};

const campaign = (over = {}) => ({
  campaignId: "cmp_1", name: "Q4 Client Appreciation", approvalStatus: "draft", lockStatus: "unlocked",
  audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date", status: "configured" }, ...over,
});
const cardEl = (over = {}, props = {}) => React.createElement(CampaignCard, {
  campaign: campaign(over), contacts: CONTACTS, orgId: "org1", client: fakeClient,
  isOwner: true, busy: false, onOpenIndividualPicker: () => {}, onAfterMutate: async () => {},
  expanded: true, onToggleExpanded: () => {}, ...props,
});

const withCatalog = (items) => {
  catalogResponse = { ok: true, status: 200, data: { giftType: "gift_boxes", provider: "prov", items } };
};
const withRefusal = (refusal) => { catalogResponse = refusal; };

const giftBubbleLabels = (s) =>
  s.qa(`[data-testid="c-cmp_1-gift"] label, [data-testid="c-cmp_1-gift"] .gcd-bubble-label`)
    .map((el) => el.textContent.trim());

// ══ VISIBILITY — the Founder's rule, in both directions ═════════════════════════════════════
test("G3: with NO published gift box, the Gift Box option is not offered at all", async () => {
  calls = []; withCatalog([]);
  const s = await mount(cardEl());
  assert.equal(s.qa(`input[value="gift_boxes"]`).length, 0, "no option, not a disabled one");
  assert.equal(/Gift Box/.test(s.text()), false, "and its name appears nowhere on the card");
  assert.ok(calls.some(([m]) => m === "listGiftCatalog"), "the catalog WAS consulted — absence is a server answer");
});

test("G3: a refusal — dormant, unauthorized or network — offers nothing and never leaks a product", async () => {
  for (const refusal of [
    { ok: false, dormant: true, status: 503, reason: "provider_dormant" },
    { ok: false, unauthorized: true, status: 403 },
    { ok: false, networkError: true, status: 0 },
    { ok: false, status: 500, error: "boom", data: { items: [BOX_A] } },
  ]) {
    calls = []; withRefusal(refusal);
    const s = await mount(cardEl());
    assert.equal(s.qa(`input[value="gift_boxes"]`).length, 0, JSON.stringify(refusal));
    assert.equal(/Roasted & Toasted/.test(s.text()), false, "a refusal body is never rendered as a product");
  }
});

test("G3: with a published gift box, the option appears IMMEDIATELY AFTER the curated option", async () => {
  withCatalog([BOX_A, BOX_B]);
  const s = await mount(cardEl());
  const values = s.qa(`[data-testid="c-cmp_1-gift"] input[type="radio"]`).map((i) => i.value);
  assert.deepEqual(values, ["none", "curated", "gift_boxes", "qrcash", "marketplace"]);
  assert.match(s.text(), /Gift Box/);
  assert.match(s.text(), /Choose one gift box for every recipient in this campaign\./);
});

test("G3: the option is selectable, and the other four gifts keep their existing behaviour", async () => {
  withCatalog([BOX_A]);
  const s = await mount(cardEl());
  const byValue = (v) => s.q(`[data-testid="c-cmp_1-gift"] input[value="${v}"]`);
  assert.equal(byValue("gift_boxes").disabled, false);
  assert.equal(byValue("none").disabled, false, "No gift unchanged");
  assert.equal(byValue("curated").disabled, false, "Curated unchanged");
  assert.equal(byValue("qrcash").disabled, true, "QR Cash still visible and still not automatable");
  assert.equal(byValue("marketplace").disabled, true, "Greet-Me Gifts still visible and still not automatable");
});

// ══ SELECTION — exactly one product, and its published variants ═════════════════════════════
test("G3: choosing the gift box reveals the published products; exactly one can be held", async () => {
  withCatalog([BOX_A, BOX_B]);
  const s = await mount(cardEl());
  await click(s.q(`[data-testid="c-cmp_1-gift"] input[value="gift_boxes"]`));

  const picker = s.tid("card-giftbox-cmp_1");
  assert.ok(picker, "the selection appears inside the existing Gift Options section");
  const radios = s.qa(`[data-testid="c-cmp_1-giftbox"] input[type="radio"]`);
  assert.deepEqual(radios.map((r) => r.value), ["box-a", "box-b"]);
  assert.equal(radios.every((r) => r.name === radios[0].name), true,
    "ONE radio group — a second product cannot be held at the same time");

  await click(radios[0]);
  assert.equal(s.qa(`[data-testid="c-cmp_1-giftbox"] input:checked`).length, 1);
  await click(radios[1]);
  const checked = s.qa(`[data-testid="c-cmp_1-giftbox"] input:checked`);
  assert.equal(checked.length, 1, "still exactly one");
  assert.equal(checked[0].value, "box-b", "the newer choice replaced the older one");
});

test("G3: variants are the ones the catalog published for the CHOSEN product, and swapping clears them", async () => {
  withCatalog([BOX_A, BOX_B]);
  const s = await mount(cardEl());
  await click(s.q(`[data-testid="c-cmp_1-gift"] input[value="gift_boxes"]`));
  await click(s.q(`[data-testid="c-cmp_1-giftbox"] input[value="box-a"]`));

  const boxes = s.qa(`[data-testid="card-giftbox-variants-cmp_1"] input[type="checkbox"]`);
  assert.deepEqual(boxes.map((b) => b.value), ["Dark Roast", "Medium Roast"]);
  await click(boxes[0]);
  assert.equal(s.qa(`[data-testid="card-giftbox-variants-cmp_1"] input:checked`).length, 1);

  // Box B publishes no variants at all: the control is absent, not empty.
  await click(s.q(`[data-testid="c-cmp_1-giftbox"] input[value="box-b"]`));
  assert.equal(s.tid("card-giftbox-variants-cmp_1"), null);
});

// ══ SAVE — through the accepted wire contract, and only when complete ═══════════════════════
test("G3: saving sends the published product and the chosen variants, once", async () => {
  withCatalog([BOX_A]); calls = [];
  const s = await mount(cardEl());
  await click(s.q(`[data-testid="c-cmp_1-gift"] input[value="gift_boxes"]`));
  await click(s.q(`[data-testid="c-cmp_1-giftbox"] input[value="box-a"]`));
  await click(s.q(`[data-testid="card-giftbox-variants-cmp_1"] input[value="Dark Roast"]`));
  await click(s.tid("act-save-cmp_1"));

  const sent = calls.filter(([m]) => m === "updateDeliveryConfig");
  assert.equal(sent.length, 1, "one delivery-config write");
  const body = sent[0][3];
  assert.equal(body.defaultGift.type, "gift_boxes");
  assert.deepEqual(body.defaultGift.product, BOX_A, "the published item, forwarded unrewritten");
  assert.deepEqual(body.defaultGift.variants, ["Dark Roast"]);
  assert.equal(Object.prototype.hasOwnProperty.call(body.defaultGift, "quantity"), false,
    "quantity is decided server-side; the surface never sends one");
  assert.equal(Number.isInteger(body.defaultGift.maxSpendCents), true, "the ceiling the server requires");
});

test("G3: a gift box with NO product chosen cannot be saved, and writes nothing at all", async () => {
  withCatalog([BOX_A]); calls = [];
  const s = await mount(cardEl());
  await click(s.q(`[data-testid="c-cmp_1-gift"] input[value="gift_boxes"]`));
  await click(s.tid("act-save-cmp_1"));
  assert.equal(calls.filter(([m]) => m === "updateDeliveryConfig").length, 0);
  assert.equal(calls.filter(([m]) => m === "setAudience").length, 0, "not even the audience — it stops first");
  assert.match(s.tid("card-giftbox-note-cmp_1").textContent, /choose a gift box/i);
});

test("G3: a STALE selection — published once, retired since — cannot be saved", async () => {
  // The campaign was saved with box A; the catalog now publishes only box B.
  withCatalog([BOX_B]); calls = [];
  const s = await mount(cardEl({
    deliveryConfig: {
      scheduleMode: "campaign_date", status: "configured",
      defaultGift: { type: "gift_boxes", maxSpendCents: 2500, product: BOX_A, variants: ["Dark Roast"] },
    },
  }));
  assert.match(s.tid("card-giftbox-note-cmp_1").textContent, /no longer published/i);

  // Make the draft dirty in an unrelated way, then try to save.
  await click(s.q("#c-cmp_1-aud-employee"));
  await click(s.tid("act-save-cmp_1"));
  assert.equal(calls.filter(([m]) => m === "updateDeliveryConfig").length, 0, "the stale product is never re-sent");
  assert.equal(calls.filter(([m]) => m === "setAudience").length, 0);
});

test("G3: a saved gift box still renders when the catalog is empty — the card never misreports the server", async () => {
  withCatalog([]);
  const s = await mount(cardEl({
    deliveryConfig: {
      scheduleMode: "campaign_date", status: "configured",
      defaultGift: { type: "gift_boxes", maxSpendCents: 2500, product: BOX_A, variants: [] },
    },
  }));
  const chosen = s.q(`[data-testid="c-cmp_1-gift"] input[value="gift_boxes"]`);
  assert.ok(chosen, "the option is shown because the campaign IS configured with it");
  assert.equal(chosen.checked, true);
  assert.match(s.tid("card-giftbox-empty-cmp_1").textContent, /no gift boxes are published/i);
});

// ══ THE OTHER GIFTS ARE UNTOUCHED ═══════════════════════════════════════════════════════════
test("G3: curated still saves exactly as before — no product, no variants", async () => {
  withCatalog([BOX_A]); calls = [];
  const s = await mount(cardEl());
  await click(s.q(`[data-testid="c-cmp_1-gift"] input[value="curated"]`));
  await click(s.tid("act-save-cmp_1"));
  const body = calls.filter(([m]) => m === "updateDeliveryConfig")[0][3];
  assert.deepEqual(Object.keys(body.defaultGift).sort(), ["maxSpendCents", "type"]);
  assert.equal(body.defaultGift.type, "curated");
});

test("G3: choosing No gift after a gift box sends no gift, and no stale product rides along", async () => {
  withCatalog([BOX_A]); calls = [];
  // Persisted as CURATED, so returning to "No gift" is a real change the card can save. (Starting
  // from no gift at all, the same sequence ends exactly where it began and Save stays inert —
  // which is itself correct, and is why the fingerprint ignores a product on a giftless draft.)
  const s = await mount(cardEl({
    deliveryConfig: {
      scheduleMode: "campaign_date", status: "configured",
      defaultGift: { type: "curated", maxSpendCents: 2500 },
    },
  }));
  await click(s.q(`[data-testid="c-cmp_1-gift"] input[value="gift_boxes"]`));
  await click(s.q(`[data-testid="c-cmp_1-giftbox"] input[value="box-a"]`));
  await click(s.q(`[data-testid="c-cmp_1-gift"] input[value="none"]`));
  assert.equal(s.tid("card-giftbox-cmp_1"), null, "the selection is gone from the screen");
  await click(s.tid("act-save-cmp_1"));
  const body = calls.filter(([m]) => m === "updateDeliveryConfig")[0][3];
  assert.equal(body.defaultGift, null);
  assert.equal(JSON.stringify(body).includes("box-a"), false, "the abandoned product is not sent anywhere");
});

test("G3: a locked campaign can read the selection but cannot change it", async () => {
  withCatalog([BOX_A]);
  const s = await mount(cardEl({
    lockStatus: "locked",
    deliveryConfig: {
      scheduleMode: "campaign_date", status: "configured",
      defaultGift: { type: "gift_boxes", maxSpendCents: 2500, product: BOX_A, variants: ["Dark Roast"] },
    },
  }));
  assert.equal(s.q(`[data-testid="c-cmp_1-giftbox"] input[value="box-a"]`).disabled, true);
  for (const b of s.qa(`[data-testid="card-giftbox-variants-cmp_1"] input`)) assert.equal(b.disabled, true);
});

// ══ NO SECOND SYSTEM ════════════════════════════════════════════════════════════════════════
test("G3: the card names no vendor and reaches no provider", async () => {
  const src = readFileSync(new URL("./CampaignCard.jsx", import.meta.url), "utf8");
  for (const banned of [/goody/i, /ongoody/i, /prezzee/i, /florist/i, /api\.|fetch\(/]) {
    assert.equal(banned.test(src), false, `CampaignCard must not contain ${banned}`);
  }
  // Every server read goes through the injected client, which is the accepted API module.
  assert.match(src, /client\.listGiftCatalog\(/);
});

// ══ G4 — RENDERED EVIDENCE, desktop and phone ═══════════════════════════════════════════════
test("G4: renders a populated picker at desktop and phone width, and writes the evidence out", async () => {
  withCatalog([BOX_A, BOX_B]);
  const s = await mount(cardEl());
  await click(s.q(`[data-testid="c-cmp_1-gift"] input[value="gift_boxes"]`));
  await click(s.q(`[data-testid="c-cmp_1-giftbox"] input[value="box-a"]`));
  await click(s.q(`[data-testid="card-giftbox-variants-cmp_1"] input[value="Dark Roast"]`));

  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  const section = s.tid("selector-gift-cmp_1").outerHTML;
  try {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    for (const [name, width] of [["desktop", 1280], ["phone", 390]]) {
      writeFileSync(join(EVIDENCE_DIR, `giftbox-picker-${name}.html`),
        `<!doctype html><meta charset="utf-8"><title>Gift Box picker — ${name} ${width}px</title>`
        + `<style>${css}</style>`
        + `<body style="margin:0;background:#f6f5fb"><div style="width:${width}px;margin:0 auto;padding:16px">`
        + `<p style="font:12px system-ui;color:#555">G4 offline evidence — ${name}, ${width}px. `
        + `Catalog response is a fixture; no provider was contacted and no flag was changed.</p>`
        + section + `</div></body>`);
    }
  } catch { /* evidence is a convenience; its absence must never fail the proof */ }

  // The layout rule the phone width depends on, asserted rather than eyeballed.
  const stack = css.slice(css.indexOf(".gcd-wcard-foot--stack {"), css.indexOf("}", css.indexOf(".gcd-wcard-foot--stack {")));
  assert.match(stack, /flex-direction:\s*column/);
  assert.match(section, /Roasted &amp; Toasted/, "outerHTML escapes the ampersand");
  assert.match(section, /Dark Roast/);
});
