// Gift commission SIMPLE view (founder 2026-10-19): mirrors the Subscription commission section. jsdom, real components, injected api.
// Proves: the schedule option sends NO rate (no duplicate rate entry) and the exact body; the fixed option's body is unchanged;
// the saved schedule is shown read-only; a missing schedule is warned about; the collapsed summary reports SAVED terms only.
// Run (Node 20.x): node --test src/pages/founder/commandCenter/giftCommissionSchedule.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readdirSync as __ls, rmSync as __rm } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
process.on("exit", () => { try { for (const n of __ls(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) __rm(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const ENTRY = join(__dirname, `.__gcsimple.${process.pid}.jsx`);
const BUNDLE = join(__dirname, `.__gcsimple.${process.pid}.bundle.mjs`);
let React, createRoot, act, window, Panel, Section;

before(async () => {
  writeFileSync(ENTRY, `export { default as Panel } from "./GiftCommissionPanel.jsx";
export { default as Section } from "./CommissionSection.jsx";\n`);
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
  ({ Panel, Section } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const flush = async () => { await act(async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); await flush(); };
const submit = async (form) => { await act(async () => { form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); }); await flush(); };
const setValue = async (el, value) => { await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, value); el.dispatchEvent(new window.Event("input", { bubbles: true })); }); };

const SCHEDULE = { year_1: 2000, year_2: 1000, year_3_plus: 1000 };
function fakeApi(gc) {
  const calls = [];
  return {
    calls,
    giftCommission: (id) => { calls.push(["GET", id]); return Promise.resolve({ ok: true, status: 200, data: { ok: true, giftCommission: gc } }); },
    setGiftCommission: (id, body) => { calls.push(["PUT", id, body]); return Promise.resolve({ ok: true, status: 200, data: { ok: true } }); },
  };
}
const writes = (api) => api.calls.filter((c) => c[0] === "PUT");
async function mountSimple(api, { compensation = SCHEDULE } = {}) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  await act(async () => { createRoot(host).render(React.createElement(Panel, { api, salespersonId: "sp_a", compensation, embedded: true, simple: true })); });
  await flush();
}
const ON = { current: { enabled: true, rateSource: "customer_schedule", rateBps: null, duration: { mode: "ongoing" }, eligibleTypes: ["gift_boxes", "flowers"], effectiveFrom: "2026-10-01T00:00:00.000Z" }, history: [] };

test("mirrors the Subscription section: inherited Year 1 / 2 / 3+ boxes (read-only), Disable checkbox, Save; excluded items kept; no extra controls", async () => {
  await mountSimple(fakeApi(ON));
  assert.deepEqual(["year_1", "year_2", "year_3_plus"].map((k) => tid(`cc-giftcomm-inherited-${k}`).value), ["20", "10", "10"]);
  for (const k of ["year_1", "year_2", "year_3_plus"]) { assert.equal(tid(`cc-giftcomm-inherited-${k}`).readOnly, true); assert.equal(tid(`cc-giftcomm-inherited-${k}`).disabled, true); }
  assert.match(tid("cc-giftcomm-f-disable").parentElement.textContent, /Disable gift commission/);
  assert.equal(tid("cc-giftcomm-f-disable").checked, false);
  assert.equal(tid("cc-giftcomm-save").textContent, "Save");
  assert.ok(tid("cc-giftcomm-never-qrcash")); assert.ok(tid("cc-giftcomm-never-gift_cards")); assert.ok(tid("cc-giftcomm-flowers-note")); assert.ok(tid("cc-giftcomm-merch-note"));
  for (const gone of ["cc-giftcomm-edit", "cc-giftcomm-banner", "cc-giftcomm-f-rate", "cc-giftcomm-f-source-fixed", "cc-giftcomm-f-mode-ongoing", "cc-giftcomm-f-type-gift_boxes", "cc-giftcomm-history", "cc-giftcomm-history-empty", "cc-giftcomm-review"]) {
    assert.equal(tid(gone), null, `${gone} is not in the simple view`);
  }
  assert.deepEqual([...document.querySelectorAll("button")].map((b) => b.textContent), ["Save"], "the only button is Save");
});

test("Save (Disable unticked) inherits the rates: ongoing, the saved gift types kept; nothing is written before Save", async () => {
  const api = fakeApi(ON); await mountSimple(api);
  assert.equal(writes(api).length, 0, "opening writes nothing");
  await click(tid("cc-giftcomm-save"));
  assert.deepEqual(writes(api), [["PUT", "sp_a", { enabled: true, rateSource: "customer_schedule", duration: { mode: "ongoing" }, eligibleTypes: ["gift_boxes", "flowers"] }]]);
  assert.match(tid("cc-giftcomm-saved").textContent, /future gift sales only/);
});

test("with nothing saved before, Save turns gift commission on for every type that can earn (never QR Cash or Smart Card)", async () => {
  const api = fakeApi({ current: null, history: [] }); await mountSimple(api);
  await click(tid("cc-giftcomm-save"));
  assert.deepEqual(writes(api)[0][2].eligibleTypes, ["gift_boxes", "merch", "flowers"]);
  assert.equal(writes(api)[0][2].eligibleTypes.some((t) => t === "qrcash" || t === "gift_cards"), false);
});

test("Disable ticked + Save sends enabled:false; a saved-off setting opens with the box ticked", async () => {
  const api = fakeApi(ON); await mountSimple(api);
  await click(tid("cc-giftcomm-f-disable"));
  await click(tid("cc-giftcomm-save"));
  assert.deepEqual(writes(api)[0][2], { enabled: false });
  assert.match(tid("cc-giftcomm-saved").textContent, /disabled/);
  await mountSimple(fakeApi({ current: { enabled: false, rateBps: 0, duration: { mode: "ongoing" }, eligibleTypes: [] }, history: [] }));
  assert.equal(tid("cc-giftcomm-f-disable").checked, true);
});

test("no saved subscription rates: blank inherited boxes and a plain warning", async () => {
  await mountSimple(fakeApi(ON), { compensation: null });
  assert.deepEqual(["year_1", "year_2", "year_3_plus"].map((k) => tid(`cc-giftcomm-inherited-${k}`).value), ["", "", ""]);
  assert.match(tid("cc-giftcomm-schedule-missing").textContent, /gifts earn nothing/);
});
