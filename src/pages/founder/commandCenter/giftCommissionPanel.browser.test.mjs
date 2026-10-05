// Gift commission panel (founder-only settings). The real component is bundled into jsdom with an injected api.
// Proves: nothing is written on open/edit/cancel/go-back; a write happens only after the explicit confirm step and sends the exact
// body; QR Cash / Smart Card / flowers cannot be selected; validation blocks the confirm step; history shows; error codes map to
// plain words; 403 is handled; the OFF banner is shown; no payout/approve controls; gating when the api lacks the reads.
// Run (Node 20.x): node --test src/pages/founder/commandCenter/giftCommissionPanel.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readdirSync as __ls, rmSync as __rm } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
process.on("exit", () => { try { for (const n of __ls(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) __rm(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const ENTRY = join(__dirname, `.__gcp.${process.pid}.jsx`);
const BUNDLE = join(__dirname, `.__gcp.${process.pid}.bundle.mjs`);
let React, createRoot, act, window, Panel;

before(async () => {
  writeFileSync(ENTRY, `export { default as Panel } from "./GiftCommissionPanel.jsx";\n`);
  await esbuild.build({ entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser", jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty" }, external: ["react", "react-dom", "react-dom/client"], define: { "import.meta.env": "{}" } });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event;
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window = dom.window;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Panel } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const flush = async () => { await act(async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); await flush(); };
const submit = async (form) => { await act(async () => { form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); }); await flush(); };
const setValue = async (el, value) => { await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, value); el.dispatchEvent(new window.Event("input", { bubbles: true })); }); };
async function mount(api) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  await act(async () => { createRoot(host).render(React.createElement(Panel, { api, salespersonId: "sp_a", now: () => new Date("2026-10-03T12:00:00Z") })); });
  await flush();
}
const CURRENT = { enabled: true, rateBps: 2000, duration: { mode: "months_from_first_gift", months: 12 }, eligibleTypes: ["gift_boxes"], effectiveFrom: "2026-09-01T00:00:00.000Z", setBy: "founder-1", setAt: "2026-09-01T00:00:00.000Z" };
const HISTORY = [{ enabled: true, rateBps: 1000, duration: { mode: "first_gift_only" }, eligibleTypes: ["gift_boxes"], effectiveFrom: "2026-06-01T00:00:00.000Z", setBy: "founder-1", setAt: "2026-06-01T00:00:00.000Z" }];
function fakeApi({ gc = { current: CURRENT, history: HISTORY }, readRes, writeRes } = {}) {
  const calls = [];
  return {
    calls,
    giftCommission: (id) => { calls.push(["GET", id]); return Promise.resolve(readRes || { ok: true, status: 200, data: { ok: true, giftCommission: gc } }); },
    setGiftCommission: (id, body) => { calls.push(["PUT", id, body]); return Promise.resolve(writeRes || { ok: true, status: 200, data: { ok: true } }); },
  };
}
const writes = (api) => api.calls.filter((c) => c[0] === "PUT");

test("shows current terms, plain summary, never-earn list, OFF banner, history; reads only", async () => {
  const api = fakeApi(); await mount(api);
  assert.equal(tid("cc-giftcomm-summary").textContent, "Earns 20% of Greet-Me's margin on gift boxes for 12 months starting 2026-09-01.");
  assert.equal(tid("cc-giftcomm-rate").textContent, "20%");
  assert.match(tid("cc-giftcomm-setby").textContent, /2026-09-01 by account founder-1/);
  assert.match(tid("cc-giftcomm-banner").textContent, /OFF platform-wide/); assert.match(tid("cc-giftcomm-banner").textContent, /payouts are off/);
  assert.match(tid("cc-giftcomm-never-qrcash").textContent, /never earns/); assert.match(tid("cc-giftcomm-never-gift_cards").textContent, /Smart Card/);
  assert.match(tid("cc-giftcomm-flowers-note").textContent, /20% florist share; florist payment is verified before approval/); assert.match(tid("cc-giftcomm-merch-note").textContent, /mark-up is off/);
  assert.equal(document.querySelectorAll('[data-testid="cc-giftcomm-history-row"]').length, 1);
  assert.match(tid("cc-giftcomm-history").textContent, /10%.*first gift only/);
  assert.deepEqual(api.calls.map((c) => c[0]), ["GET"], "only a read on open");
  for (const b of document.querySelectorAll("button")) assert.doesNotMatch(b.textContent, /approve|\bpay\b|payout|export|mark paid/i);
  assert.doesNotMatch(document.body.textContent, /year_|enabled:|rateBps/);
});

test("unset terms: plain message, nothing accrues", async () => {
  await mount(fakeApi({ gc: { current: null, history: [] } }));
  assert.ok(tid("cc-giftcomm-unset")); assert.ok(tid("cc-giftcomm-history-empty"));
  assert.match(tid("cc-giftcomm-summary").textContent, /off/);
});

test("open, edit, cancel and go-back never write", async () => {
  const api = fakeApi(); await mount(api);
  await click(tid("cc-giftcomm-edit")); assert.ok(tid("cc-giftcomm-form"));
  await click(tid("cc-giftcomm-cancel")); assert.equal(tid("cc-giftcomm-form"), null);
  await click(tid("cc-giftcomm-edit")); await submit(tid("cc-giftcomm-form"));
  assert.ok(tid("cc-giftcomm-confirm"), "review opens the confirm step");
  await click(tid("cc-giftcomm-confirm-back")); assert.ok(tid("cc-giftcomm-form"));
  await submit(tid("cc-giftcomm-form")); await click(tid("cc-giftcomm-confirm-cancel"));
  assert.equal(writes(api).length, 0, "no write without confirm");
});

test("QR Cash and Smart Card are unselectable; flowers is selectable", async () => {
  await mount(fakeApi()); await click(tid("cc-giftcomm-edit"));
  assert.equal(tid("cc-giftcomm-f-type-flowers").disabled, false);
  for (const id of ["qrcash", "gift_cards"]) { assert.equal(tid(`cc-giftcomm-f-type-${id}`).disabled, true, id); assert.equal(tid(`cc-giftcomm-f-type-${id}`).checked, false); }
  assert.equal(tid("cc-giftcomm-f-type-gift_boxes").disabled, false); assert.equal(tid("cc-giftcomm-f-type-merch").disabled, false);
  assert.match(document.body.textContent, /Never earns/);
});

test("validation blocks the confirm step", async () => {
  const api = fakeApi({ gc: { current: null, history: [] } }); await mount(api);
  await click(tid("cc-giftcomm-edit")); await submit(tid("cc-giftcomm-form"));
  assert.ok(tid("cc-giftcomm-err-rate")); assert.ok(tid("cc-giftcomm-err-types")); assert.equal(tid("cc-giftcomm-confirm"), null);
  await setValue(tid("cc-giftcomm-f-rate"), "150"); await submit(tid("cc-giftcomm-form")); assert.match(tid("cc-giftcomm-err-rate").textContent, /between 0 and 100/);
  await setValue(tid("cc-giftcomm-f-rate"), "20"); await click(tid("cc-giftcomm-f-type-gift_boxes"));
  await setValue(tid("cc-giftcomm-f-start"), "2026-10-01"); await submit(tid("cc-giftcomm-form")); assert.match(tid("cc-giftcomm-err-start").textContent, /cannot be in the past/);
  assert.equal(writes(api).length, 0);
});

test("explicit confirm: exact body, 'future sales only' wording, one PUT, then reload", async () => {
  const api = fakeApi({ gc: { current: null, history: [] } }); await mount(api);
  await click(tid("cc-giftcomm-edit"));
  await setValue(tid("cc-giftcomm-f-rate"), "15");
  await click(tid("cc-giftcomm-f-mode-months_from_first_gift")); await setValue(tid("cc-giftcomm-f-months"), "6");
  await click(tid("cc-giftcomm-f-type-gift_boxes"));
  await setValue(tid("cc-giftcomm-f-start"), "2026-11-01");
  await submit(tid("cc-giftcomm-form"));
  assert.equal(tid("cc-giftcomm-confirm-summary").textContent, "Earns 15% of Greet-Me's margin on gift boxes for 6 months starting 2026-11-01.");
  assert.match(tid("cc-giftcomm-confirm-note").textContent, /future sales only/);
  assert.equal(writes(api).length, 0, "the review step does not write");
  await click(tid("cc-giftcomm-confirm-go"));
  assert.deepEqual(writes(api), [["PUT", "sp_a", { enabled: true, rateBps: 1500, duration: { mode: "months_from_first_gift", months: 6 }, eligibleTypes: ["gift_boxes"], effectiveFrom: "2026-11-01T00:00:00.000Z" }]]);
  assert.match(tid("cc-giftcomm-saved").textContent, /future sales only/);
  assert.equal(api.calls.filter((c) => c[0] === "GET").length, 2, "reloaded after save");
});

test("server refusals map to plain words and keep the form open", async () => {
  for (const [reason, re] of [["rate_out_of_range", /between 0 and 100/], ["ineligible_type", /never do/], ["effective_from_in_the_past", /future sales only/]]) {
    const api = fakeApi({ gc: { current: null, history: [] }, writeRes: { ok: false, status: 400, data: { ok: false, reason } } }); await mount(api);
    await click(tid("cc-giftcomm-edit")); await setValue(tid("cc-giftcomm-f-rate"), "10"); await click(tid("cc-giftcomm-f-type-gift_boxes"));
    await submit(tid("cc-giftcomm-form")); await click(tid("cc-giftcomm-confirm-go"));
    assert.match(tid("cc-giftcomm-form-error").textContent, re, reason); assert.doesNotMatch(tid("cc-giftcomm-form-error").textContent, /_/);
    assert.ok(tid("cc-giftcomm-form"));
  }
  const api403 = fakeApi({ gc: { current: null, history: [] }, writeRes: { ok: false, status: 403, data: null } }); await mount(api403);
  await click(tid("cc-giftcomm-edit")); await setValue(tid("cc-giftcomm-f-rate"), "10"); await click(tid("cc-giftcomm-f-type-gift_boxes"));
  await submit(tid("cc-giftcomm-form")); await click(tid("cc-giftcomm-confirm-go"));
  assert.match(tid("cc-giftcomm-form-error").textContent, /founder account/);
});

test("read 403 / failure handled: plain message, no form, no crash", async () => {
  await mount(fakeApi({ readRes: { ok: false, status: 403, data: null } }));
  assert.match(tid("cc-giftcomm-error").textContent, /founder account/); assert.equal(tid("cc-giftcomm-edit"), null); assert.equal(tid("cc-giftcomm-retry"), null);
  await mount(fakeApi({ readRes: { ok: false, status: 500, data: null } }));
  assert.ok(tid("cc-giftcomm-error")); assert.ok(tid("cc-giftcomm-retry"));
});

test("api without the reads renders nothing (panel is gated)", async () => {
  await mount({}); assert.equal(document.body.textContent.trim(), "");
});

test("round trip: Change terms then Save keeps stored flowers (and every stored type); the PUT sends exactly what is ticked", async () => {
  const gc = { current: { ...CURRENT, eligibleTypes: ["gift_boxes", "flowers", "merch"] }, history: [] };
  const api = fakeApi({ gc }); await mount(api);
  await click(tid("cc-giftcomm-edit"));
  for (const id of ["gift_boxes", "flowers", "merch"]) assert.equal(tid(`cc-giftcomm-f-type-${id}`).checked, true, `${id} pre-selected`);
  assert.equal(tid("cc-giftcomm-removal-warning"), null);
  await submit(tid("cc-giftcomm-form"));
  assert.equal(tid("cc-giftcomm-confirm-removal"), null);
  assert.match(tid("cc-giftcomm-confirm-summary").textContent, /gift boxes, merch and flowers|gift boxes, flowers and merch/);
  await click(tid("cc-giftcomm-confirm-go"));
  assert.deepEqual(writes(api)[0][2].eligibleTypes, ["gift_boxes", "flowers", "merch"]);
});

test("unticking a stored type warns on the form and again on the confirm step, and the PUT omits only that type", async () => {
  const gc = { current: { ...CURRENT, eligibleTypes: ["gift_boxes", "flowers"] }, history: [] };
  const api = fakeApi({ gc }); await mount(api);
  await click(tid("cc-giftcomm-edit"));
  await click(tid("cc-giftcomm-f-type-flowers"));
  assert.match(tid("cc-giftcomm-removal-warning").textContent, /removing Flowers/);
  await submit(tid("cc-giftcomm-form"));
  assert.match(tid("cc-giftcomm-confirm-removal").textContent, /Removing from the types that earn: Flowers/);
  assert.equal(writes(api).length, 0);
  await click(tid("cc-giftcomm-confirm-go"));
  assert.deepEqual(writes(api)[0][2].eligibleTypes, ["gift_boxes"]);
});
