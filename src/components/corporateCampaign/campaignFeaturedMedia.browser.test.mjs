// LANE 3 — For Business → Campaign → Message → Featured Spread, mounted for real (CampaignCard with
// an INJECTED fake client; no network). Proves: no Organization Default control, the four choices,
// the campaign's explicit choice saves and reloads, an unsavable choice is never sent, and Preview My
// Card makes no client call and offers only this campaign's audience.
// Run (Node 20.x): node --test src/components/corporateCampaign/campaignFeaturedMedia.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
// CLEAN_SCRATCH: scratch files carry this process id in their name; all are removed on exit.
import { readdirSync as __scratchLs, rmSync as __scratchRm } from "node:fs";
process.on("exit", () => { try { for (const n of __scratchLs(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) __scratchRm(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const ENTRY = join(__dirname, `.__cfm.${process.pid}.entry.jsx`);
const BUNDLE = join(__dirname, `.__cfm.${process.pid}.bundle.mjs`);

let React, createRoot, act, CampaignCard, dom;

const CONTACTS = [
  { id: "e1", name: "Ana Employee", corporateContactType: "employee" },
  { id: "e2", name: "Ben Employee", corporateContactType: "employee" },
  { id: "cl1", name: "Cara Client", corporateContactType: "client" },
];
const ORG_DEFAULT_CONFIG = {
  animatedMessageEnabled: true, animationImageSource: "organization_default", animationImageRef: null,
  corporateVideoEnabled: false, corporateVideoRef: null, additionalImagesEnabled: false, additionalImageRefs: [],
};

const calls = [];
const net = [];
const fakeClient = new Proxy({
  updateFeaturedSpread: (...a) => { calls.push(["updateFeaturedSpread", ...a]); return Promise.resolve({ ok: true, data: {} }); },
}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === "then") return undefined;
    return (...a) => { calls.push([String(k), ...a]); return Promise.resolve({ ok: true, data: {} }); };
  },
});

before(async () => {
  writeFileSync(ENTRY, `export { default as CampaignCard } from "./CampaignCard.jsx";`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty", ".png": "dataurl", ".jpg": "dataurl", ".jpeg": "dataurl", ".svg": "dataurl" },
    external: ["react", "react-dom", "react-dom/client", "react-router-dom"],
    define: { "import.meta.env": "{}" },
    logLevel: "silent",
  });
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event;
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only global */ }
  globalThis.MouseEvent = dom.window.MouseEvent; globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.Audio = dom.window.Audio = class { play() { return Promise.resolve(); } pause() {} load() {} };
  dom.window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  dom.window.HTMLMediaElement.prototype.pause = function () {};
  dom.window.HTMLMediaElement.prototype.load = function () {};
  globalThis.localStorage = dom.window.localStorage;
  dom.window.matchMedia = (q) => ({ matches: /reduce/.test(q), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  dom.window.document.fonts = { ready: Promise.resolve() };
  globalThis.fetch = dom.window.fetch = (...a) => { net.push(a); return Promise.reject(new Error("no network")); };
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ CampaignCard } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { for (const f of [ENTRY, BUNDLE, BUNDLE.replace(/\.mjs$/, ".css")]) { try { rmSync(f); } catch { /* gone */ } } });

let root;
async function mount(el) {
  if (root) { await act(async () => { root.unmount(); }); }
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(el); });
  return { q: (s) => document.querySelector(s), qa: (s) => [...document.querySelectorAll(s)], tid: (t) => document.querySelector(`[data-testid="${t}"]`) };
}
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); };
const campaign = (over = {}) => ({
  campaignId: "cmp_1", name: "Q4 Client Appreciation", approvalStatus: "draft", lockStatus: "unlocked",
  audienceRefs: ["e1", "cl1"], deliveryConfig: { scheduleMode: null, status: "not_configured" }, ...over,
});
const cardEl = (over = {}, props = {}) => React.createElement(CampaignCard, {
  campaign: campaign(over), contacts: CONTACTS, orgId: "org1", client: fakeClient,
  isOwner: true, busy: false, onAfterMutate: async () => {}, expanded: true, onToggleExpanded: () => {}, ...props,
});
const P = "c-cmp_1-spread";

test("Message tab: no Organization Default control, four featured-media choices", async () => {
  const s = await mount(cardEl({ featuredSpreadConfig: ORG_DEFAULT_CONFIG }));
  const tab = s.tid("tab-message-cmp_1");
  assert.ok(tab.querySelector('[data-testid="selector-spread-cmp_1"]'), "the Featured Spread section stays in Message");
  assert.doesNotMatch(tab.textContent, /Organization Default|Customize This Campaign|Use Organization Default|Restore Default/);
  assert.equal(s.q(`#c-cmp_1-spread-organization_default`), null);
  assert.equal(s.q(`#c-cmp_1-spread-customize`), null);
  assert.deepEqual(s.qa(`[name="${P}-fm-mode-group"]`).map((r) => r.value), ["animate", "static", "video", "none"]);
  assert.equal(s.q(`#${P}-fm-mode-none`).checked, true, "an org-default campaign reads as No featured media: nothing inherited");
  assert.match(s.tid(`${P}-featured-saved`).textContent, /earlier organization photo-and-voice setting/);
});

test("campaign explicit choice: save No featured media sends { featuredSpreadConfig } and reloads as that choice", async () => {
  calls.length = 0;
  const s = await mount(cardEl({ featuredSpreadConfig: ORG_DEFAULT_CONFIG }));
  const save = s.tid(`${P}-featured-save`);
  assert.equal(save.disabled, false, "the explicit choice can be saved over the retired setting");
  await click(save);
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  const c = calls.find((x) => x[0] === "updateFeaturedSpread");
  assert.ok(c, "saved through the existing featured-spread API");
  assert.deepEqual(c.slice(1, 3), ["org1", "cmp_1"]);
  const body = c[3];
  assert.deepEqual(Object.keys(body), ["featuredSpreadConfig"]);
  assert.equal(body.featuredSpreadConfig.animatedMessageEnabled, false);
  // reload with what the server would now hold
  const r = await mount(cardEl({ featuredSpreadConfig: body.featuredSpreadConfig }));
  assert.equal(r.q(`#${P}-fm-mode-none`).checked, true);
  assert.match(r.tid(`${P}-featured-saved`).textContent, /Saved for this campaign: No featured media/);
  // Report 146: the saved choice promises nothing about sent cards (verified: delivery uses the owner's frozen media).
  assert.match(r.tid(`${P}-featured-delivery-note`).textContent, /Sent campaign cards don't use this choice yet: they still show the account owner's photo and voice\./);
  assert.equal(r.tid(`${P}-featured-save`).disabled, true, "nothing to save until the choice changes");
});

test("an unsavable choice is never sent; its reason is shown", async () => {
  calls.length = 0;
  const s = await mount(cardEl({ featuredSpreadConfig: { ...ORG_DEFAULT_CONFIG, animatedMessageEnabled: false } }));
  for (const mode of ["animate", "static", "video"]) {
    await act(async () => { s.q(`#${P}-fm-mode-${mode}`).click(); });
    assert.equal(s.tid(`${P}-featured-save`).disabled, true, mode);
    assert.match(s.tid(`${P}-featured-save-reason`).textContent, /can be previewed here but not saved/, mode);
  }
  await click(s.tid(`${P}-featured-save`));
  assert.equal(calls.filter((x) => x[0] === "updateFeaturedSpread").length, 0);
});

test("a locked campaign cannot change its featured media", async () => {
  const s = await mount(cardEl({ lockStatus: "locked", approvalStatus: "approved", featuredSpreadConfig: ORG_DEFAULT_CONFIG }));
  assert.equal(s.q(`#${P}-fm-mode-video`).disabled, true);
  assert.equal(s.tid(`${P}-featured-save`).disabled, true);
  assert.ok(s.tid(`${P}-featured-locked`));
});

test("Preview My Card: no client call, no request, and only this campaign's audience", async () => {
  const s = await mount(cardEl({ featuredSpreadConfig: ORG_DEFAULT_CONFIG }));
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  calls.length = 0; net.length = 0; // the card's own mount-time catalog read is not the preview's
  await act(async () => { s.q(`#${P}-fm-mode-video`).click(); });
  await click(s.tid(`${P}-fm-preview-open`));
  assert.ok(s.tid(`${P}-fm-preview`), "the existing card renders in the preview");
  assert.ok(document.querySelector(".gc-container"), "GreetingCard mounted");
  const options = [...s.tid(`${P}-fm-preview-recipient`).querySelectorAll("option")].map((o) => o.value);
  assert.deepEqual(options, ["e1", "cl1"], "the campaign's audience only (Ben is not in it)");
  await click(s.tid(`${P}-fm-preview-close`));
  assert.equal(calls.length, 0, JSON.stringify(calls.map((c) => c[0])));
  assert.equal(net.length, 0);
});
