// Gift commission "subscription schedule" option + collapsible commission sections. jsdom, real components, injected api.
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
const ENTRY = join(__dirname, `.__gcs.${process.pid}.jsx`);
const BUNDLE = join(__dirname, `.__gcs.${process.pid}.bundle.mjs`);
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
const SCHED_CURRENT = { enabled: true, rateSource: "customer_schedule", rateBps: null, duration: { mode: "ongoing" }, eligibleTypes: ["gift_boxes", "flowers"], effectiveFrom: "2026-10-01T00:00:00.000Z", setBy: "founder-1", setAt: "2026-10-01T00:00:00.000Z" };
function fakeApi({ gc = { current: null, history: [] }, writeRes } = {}) {
  const calls = [];
  return {
    calls,
    giftCommission: (id) => { calls.push(["GET", id]); return Promise.resolve({ ok: true, status: 200, data: { ok: true, giftCommission: gc } }); },
    setGiftCommission: (id, body) => { calls.push(["PUT", id, body]); return Promise.resolve(writeRes || { ok: true, status: 200, data: { ok: true } }); },
  };
}
const writes = (api) => api.calls.filter((c) => c[0] === "PUT");
/** The panel inside its collapsible section, wired exactly as the Control Center wires it. */
async function mountInSection(api, { compensation = SCHEDULE } = {}) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  function Harness() {
    const [summary, setSummary] = React.useState(null);
    return React.createElement(Section, { id: "gift", title: "Gift commission", summary: summary || "Loading…" },
      React.createElement(Panel, { api, salespersonId: "sp_a", now: () => new Date("2026-10-19T12:00:00Z"), compensation, embedded: true, onSummary: setSummary }));
  }
  await act(async () => { createRoot(host).render(React.createElement(Harness)); });
  await flush();
}

test("collapsed by default; the head shows the SAVED summary; the panel's own heading is not duplicated", async () => {
  await mountInSection(fakeApi({ gc: { current: SCHED_CURRENT, history: [] } }));
  const det = tid("fcc-commission-gift");
  assert.equal(det.tagName, "DETAILS"); assert.equal(det.open, false, "collapsed by default");
  assert.equal(tid("fcc-commission-gift-summary").textContent, "Subscription schedule (20% / 10% / 10%) · ongoing · gift boxes and flowers");
  assert.equal(det.querySelectorAll("h3").length, 0, "embedded: the section title is the only heading");
  assert.match(tid("cc-giftcomm-rate").textContent, /Each customer's subscription schedule \(new customers: 20% \/ 10% \/ 10%\)/);
  assert.match(tid("cc-giftcomm-summary").textContent, /Year 1, Year 2 or Year 3\+, counted from the customer's own start date/);
});

test("collapsed summary for fixed / off / unset terms", async () => {
  await mountInSection(fakeApi({ gc: { current: { enabled: true, rateBps: 1500, duration: { mode: "first_gift_only" }, eligibleTypes: ["gift_boxes"], effectiveFrom: "2026-10-01T00:00:00.000Z" }, history: [] } }));
  assert.equal(tid("fcc-commission-gift-summary").textContent, "15% of margin · first gift only · gift boxes");
  await mountInSection(fakeApi({ gc: { current: { enabled: false, rateBps: 0, duration: { mode: "ongoing" }, eligibleTypes: [] }, history: [] } }));
  assert.equal(tid("fcc-commission-gift-summary").textContent, "Off: nothing accrues");
  await mountInSection(fakeApi());
  assert.equal(tid("fcc-commission-gift-summary").textContent, "Not set: nothing accrues");
});

test("choosing the subscription schedule: no rate field, saved schedule shown read-only, exact body has no rateBps", async () => {
  const api = fakeApi(); await mountInSection(api);
  await click(tid("cc-giftcomm-edit"));
  assert.ok(tid("cc-giftcomm-f-rate"), "fixed is the default for a new setting");
  await click(tid("cc-giftcomm-f-source-customer_schedule"));
  assert.equal(tid("cc-giftcomm-f-rate"), null, "no percentage to enter twice");
  assert.equal(tid("cc-giftcomm-schedule-rates").textContent, "20% / 10% / 10%");
  assert.match(tid("cc-giftcomm-schedule-info").textContent, /No override is paid on gifts/);
  assert.ok(tid("cc-giftcomm-schedule-duration-hint"), "hint while the duration is not Ongoing");
  await click(tid("cc-giftcomm-f-mode-ongoing"));
  assert.equal(tid("cc-giftcomm-schedule-duration-hint"), null);
  await click(tid("cc-giftcomm-f-type-gift_boxes"));
  await submit(tid("cc-giftcomm-form"));
  assert.match(tid("cc-giftcomm-confirm-summary").textContent, /subscription commission rate for their current year/);
  assert.equal(writes(api).length, 0, "nothing written before confirm");
  await click(tid("cc-giftcomm-confirm-go"));
  assert.deepEqual(writes(api), [["PUT", "sp_a", { enabled: true, rateSource: "customer_schedule", duration: { mode: "ongoing" }, eligibleTypes: ["gift_boxes"] }]]);
});

test("the fixed option's body is unchanged (no rateSource key)", async () => {
  const api = fakeApi(); await mountInSection(api);
  await click(tid("cc-giftcomm-edit"));
  await setValue(tid("cc-giftcomm-f-rate"), "15"); await click(tid("cc-giftcomm-f-type-gift_boxes"));
  await submit(tid("cc-giftcomm-form")); await click(tid("cc-giftcomm-confirm-go"));
  assert.deepEqual(writes(api)[0][2], { enabled: true, rateBps: 1500, duration: { mode: "first_gift_only" }, eligibleTypes: ["gift_boxes"] });
});

test("no saved subscription schedule: a plain warning that gifts earn nothing until terms are saved", async () => {
  await mountInSection(fakeApi(), { compensation: null });
  await click(tid("cc-giftcomm-edit")); await click(tid("cc-giftcomm-f-source-customer_schedule"));
  assert.match(tid("cc-giftcomm-schedule-missing").textContent, /no subscription commission terms saved/);
  assert.equal(tid("cc-giftcomm-schedule-rates"), null);
});

test("editing an existing schedule setting pre-selects the schedule and keeps the stored types", async () => {
  const api = fakeApi({ gc: { current: SCHED_CURRENT, history: [] } }); await mountInSection(api);
  await click(tid("cc-giftcomm-edit"));
  assert.equal(tid("cc-giftcomm-f-source-customer_schedule").checked, true);
  assert.equal(tid("cc-giftcomm-f-type-flowers").checked, true);
  await submit(tid("cc-giftcomm-form")); await click(tid("cc-giftcomm-confirm-go"));
  assert.deepEqual(writes(api)[0][2], { enabled: true, rateSource: "customer_schedule", duration: { mode: "ongoing" }, eligibleTypes: ["gift_boxes", "flowers"] });
});
