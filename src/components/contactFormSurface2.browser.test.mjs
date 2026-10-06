// src/components/contactFormSurface2.browser.test.mjs
//
// PRODUCTION proof of the founder-approved Surface 2 behaviors, against the REAL ContactForm component
// (esbuild-bundled and mounted with react-dom/client into jsdom; same technique as
// importWizard/reviewScreen.browser.test.mjs). Only side-effect modules are stubbed (router, api,
// auth context, toasts). No preview fixtures, no network, no backend.
//
// Run: node --test src/components/contactFormSurface2.browser.test.mjs   (Node 20)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__contactform.bundle.mjs");
const ENTRY = join(__dirname, ".__contactform.entry.jsx");
let React, createRoot, ContactForm, act;

const ROUTER_STUB = `export const useNavigate = () => ((p) => { globalThis.__nav = p; });`;
const AUTH_STUB = `export const useAuth = () => ({ user: { id: "u1", photoUrl: "https://example.test/me.jpg" } });`;
const NOTIFY_STUB = `export const showManualToast = (...a) => { (globalThis.__toasts || (globalThis.__toasts = [])).push(a); };`;
const API_STUB = `export default new Proxy({}, { get: () => async () => { throw new Error("network is not available in this test"); } });`;

before(async () => {
  const stub = {
    name: "stub",
    setup(b) {
      b.onResolve({ filter: /(^react-router-dom$|\/api\/api$|\/utils\/notify$|\/context\/AuthContext$)/ }, (a) => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
        contents: /react-router-dom/.test(a.path) ? ROUTER_STUB : /notify/.test(a.path) ? NOTIFY_STUB : /AuthContext/.test(a.path) ? AUTH_STUB : API_STUB,
        loader: "js",
      }));
    },
  };
  writeFileSync(ENTRY, `export { default as ContactForm } from "./ContactForm.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [stub], logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  globalThis.HTMLElement = window.HTMLElement; globalThis.Event = window.Event;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.localStorage = window.localStorage; globalThis.sessionStorage = window.sessionStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = () => {};

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ ContactForm } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const txt = () => document.body.textContent;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const click = (el) => act(async () => { el.click(); });
const tick = async (id, on = true) => { const el = document.getElementById(id); if (el.checked !== on) await click(el); };
function setValue(el, value) {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}
async function mount(contact = null) {
  globalThis.__submitted = null; globalThis.__cancelled = false;
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch { /* ignore */ }
  document.body.innerHTML = "";
  const c = document.createElement("div"); document.body.appendChild(c);
  await act(async () => {
    createRoot(c).render(React.createElement(ContactForm, {
      contact, onSubmit: async (d) => { globalThis.__submitted = d; }, onCancel: () => { globalThis.__cancelled = true; },
    }));
  });
  await flush();
}
const openScheduler = async () => { if (tid("special-occasions-toggle").getAttribute("aria-expanded") !== "true") await click(tid("special-occasions-toggle")); };
const submit = async () => { await click(document.querySelector('button[type="submit"]')); await flush(); };

// ---------------------------------------------------------------------------------------------
test("Occasion Scheduler header: title, subtext, festive icons, collapsed by default with a caret toggle", async () => {
  await mount();
  assert.equal(tid("special-occasions-heading").textContent, "Occasion Scheduler");
  assert.equal(tid("scheduler-subtext").textContent, "Schedule the love!");
  assert.equal(tid("scheduler-festive-icons").querySelectorAll("svg").length, 3);
  assert.equal(tid("special-occasions-toggle").getAttribute("aria-expanded"), "false");
  assert.ok(!txt().includes("Personal Occasions"), "section body is collapsed");
  await click(tid("special-occasions-toggle"));
  assert.equal(tid("special-occasions-toggle").getAttribute("aria-expanded"), "true");
  assert.ok(txt().includes("Personal Occasions"));
  await click(tid("special-occasions-toggle"));
  assert.equal(tid("special-occasions-toggle").getAttribute("aria-expanded"), "false");
});

test("Moments heading: founder text, one heading, no optional/memory subscript", async () => {
  await mount();
  assert.equal(tid("moments-heading").textContent, "MOMENTS : ADD IMAGES TO MAKE YOUR GREET-ME UNFORGETTABLE");
  assert.ok(!/Optional|Memory Photos|photos? added/i.test(tid("moments-heading").parentElement.textContent));
  // collapsed by default; opening shows the approved copy and the Profile Photo label, with no invented count
  assert.ok(!txt().includes("Add images below"));
  await click(tid("moments-heading"));
  assert.ok(txt().includes("Add images below. These images will be presented inside your sent Greet-Me."));
  assert.ok(txt().includes("Profile Photo") && !txt().includes("Default Photo"));
  assert.ok(!/Add up to \d+ images/.test(txt()));
});

test("Relationship Context heading replaces Relation; cultural section is not rendered", async () => {
  await mount();
  assert.ok(txt().includes("Relationship Context"));
  assert.ok(!/Cultural & Personal Context|Cultural \/ Heritage|Faith \/ Observance/.test(txt()));
});

test("occasion card opens fully when ticked (date + gift row, no extra click, no Gift & Delivery label); unticking collapses it", async () => {
  await mount(); await openScheduler();
  assert.equal(tid("add-gift-row-birthday"), null, "nothing before the occasion is ticked");
  await tick("occasion-birthday");
  assert.ok(tid("add-gift-row-birthday"), "gift row visible immediately");
  assert.ok(document.querySelector('#occasion-birthday').closest("div").parentElement.querySelector('input[type="date"]'), "date field visible");
  assert.ok(!txt().includes("Gift & Delivery") && !tid("gift-delivery-heading"));
  assert.ok(!txt().includes("No gift (optional)"));
  await tick("occasion-birthday", false);
  assert.equal(tid("add-gift-row-birthday"), null);
});

test("Add gift: unchecked by default, selector disabled until ticked, keeps every mode, no None entry", async () => {
  await mount(); await openScheduler(); await tick("occasion-birthday");
  const cb = tid("add-gift-birthday"), sel = tid("gift-selector-birthday");
  assert.equal(cb.checked, false);
  assert.equal(sel.disabled, true);
  await click(cb);
  assert.equal(tid("add-gift-birthday").checked, true);
  assert.equal(tid("gift-selector-birthday").disabled, false);
  const opts = [...tid("gift-selector-birthday").options].map((o) => [o.value, o.textContent]);
  assert.deepEqual(opts.map((o) => o[0]), ["", "qrcash", "merch", "curated", "marketplace"]);
  assert.ok(opts.some(([v, t]) => v === "curated" && t === "Let Greet-Me select a gift"));
  assert.ok(opts.every(([v]) => v !== "none"));
  // choosing "Let Greet-Me select a gift" shows the $25..$150 budget selector (existing behavior)
  await act(async () => setValue(tid("gift-selector-birthday"), "curated"));
  const budget = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "150"));
  assert.deepEqual([...budget.options].map((o) => o.value), ["25", "50", "75", "100", "150"]);
  // Browse Marketplace exposes the existing Choose Item flow
  await act(async () => setValue(tid("gift-selector-birthday"), "marketplace"));
  assert.ok([...document.querySelectorAll("button")].some((b) => /Choose Item/.test(b.textContent)));
});

test("no-gift data parity: never ticking, or ticking then unticking, yields exactly the old 'None' data", async () => {
  // (a) never ticked: no entry written (same as the old default None)
  await mount(); await openScheduler(); await tick("occasion-birthday");
  await act(async () => setValue(document.querySelector('input[name="name"]'), "Avery Fixture"));
  await act(async () => setValue(document.querySelector('input[name="email"]'), "avery@example.test"));
  await act(async () => setValue(document.querySelector('input[type="date"]'), "2026-11-14"));
  await submit();
  assert.ok(globalThis.__submitted, "form submitted");
  assert.equal(globalThis.__submitted.occasionGiftSettings?.birthday, undefined, "no entry == old default None");
  // (b) tick, choose a mode, untick: the entry is {type:'none'} like picking None in the old dropdown
  await mount(); await openScheduler(); await tick("occasion-birthday");
  await click(tid("add-gift-birthday"));
  await act(async () => setValue(tid("gift-selector-birthday"), "qrcash"));
  await click(tid("add-gift-birthday"));   // untick
  assert.equal(tid("gift-selector-birthday").disabled, true);
  await act(async () => setValue(document.querySelector('input[name="name"]'), "Avery Fixture"));
  await act(async () => setValue(document.querySelector('input[name="email"]'), "avery@example.test"));
  await act(async () => setValue(document.querySelector('input[type="date"]'), "2026-11-14"));
  await submit();
  const entry = globalThis.__submitted.occasionGiftSettings.birthday;
  assert.equal(entry.type, "none");
  assert.deepEqual(Object.keys(entry).filter((k) => !["type", "autoGift", "maxSpend", "qrAmount", "amount", "customAmount"].includes(k)), [], "shape unchanged: only existing keys");
});

test("annual-repeat subscript: now under Enable Auto-Gift - only when a gift is added, Auto-Gift is ticked and the occasion repeats yearly (Graduation is one-time)", async () => {
  const autoBoxes = () => [...document.querySelectorAll("label")].filter((l) => /Enable Auto-Gift/.test(l.textContent)).map((l) => l.querySelector('input[type="checkbox"]'));
  await mount(); await openScheduler(); await tick("occasion-birthday"); await tick("occasion-graduation");
  assert.equal(tid("add-gift-repeat-birthday"), null, "no claim until a gift is added");
  await click(tid("add-gift-birthday"));
  await act(async () => setValue(tid("gift-selector-birthday"), "marketplace")); // the Enable Auto-Gift control appears once a gift type is chosen
  assert.equal(tid("add-gift-repeat-birthday"), null, "a gift alone is not enough: the sentence belongs to Auto-Gift");
  const [birthdayBox] = autoBoxes();
  await click(birthdayBox);
  assert.equal(tid("add-gift-repeat-birthday").textContent, "Your greeting sends automatically each year and repeats.");
  assert.ok(tid("add-gift-repeat-birthday").closest("div").textContent.includes("Enable Auto-Gift"), "it sits with the Enable Auto-Gift control");
  await click(tid("add-gift-graduation"));
  await act(async () => setValue(tid("gift-selector-graduation"), "marketplace"));
  await click(autoBoxes()[1]);
  assert.equal(tid("add-gift-repeat-graduation"), null, "one-time occasion makes no repeat claim");
  await click(tid("add-gift-birthday"));
  assert.equal(tid("add-gift-repeat-birthday"), null, "unticked: claim gone");
});

test("banner: new copy, centered with an icon on each side, informational (no button), below the scheduler and above the footer", async () => {
  await mount();
  const b = tid("gift-banner");
  assert.ok(b.textContent.includes("Remember to Include a gift"));
  assert.ok(b.textContent.includes("Complete the moment with a thoughtful gift from the Greet-Me Gift Place.") && !b.textContent.includes("select one for you"));
  assert.equal(b.querySelectorAll('[data-testid="cinematic-gift-icon"]').length, 2);
  assert.equal(b.querySelectorAll("button, a").length, 0);
  assert.ok(!txt().includes("Gifts are configured per occasion"));
  const order = [...document.querySelectorAll('[data-testid="special-occasions-toggle"], [data-testid="gift-banner"], [data-testid="contact-form-footer"]')].map((e) => e.getAttribute("data-testid"));
  assert.deepEqual(order, ["special-occasions-toggle", "gift-banner", "contact-form-footer"]);
  assert.ok(![...document.querySelectorAll("button")].some((x) => /^\s*Add Gift\s*$/i.test(x.textContent)), "no second Add Gift button");
});

test("footer: outside the cards, Cancel left / SAVE right; add and edit both say SAVE (W07 revision: no \"Update Recipient\")", async () => {
  await mount();
  const foot = tid("contact-form-footer");
  const btns = [...foot.querySelectorAll("button")].map((x) => x.textContent.trim());
  assert.deepEqual(btns, ["Cancel", "SAVE"]);
  assert.equal(foot.parentElement.tagName, "FORM");
  await click([...foot.querySelectorAll("button")][0]);
  assert.equal(globalThis.__cancelled, true);
  await mount({ id: "c1", name: "Edit Me", email: "edit@example.test", occasions: [], occasionGiftSettings: {} });
  assert.deepEqual([...tid("contact-form-footer").querySelectorAll("button")].map((x) => x.textContent.trim()), ["Cancel", "SAVE"]);
});

test("cultural context passes through unchanged on update (stored values never blanked)", async () => {
  const stored = { heritage: ["Irish", "Italian"], faith: "Catholic", preferCulturalGifts: true };
  await mount({ id: "c2", name: "Pat Stored", email: "pat@example.test", occasions: [], occasionGiftSettings: {}, culturalContext: stored });
  await act(async () => setValue(document.querySelector('input[name="name"]'), "Pat Renamed"));
  await submit();
  assert.ok(globalThis.__submitted, "update submitted");
  assert.equal(globalThis.__submitted.name, "Pat Renamed");
  assert.deepEqual(globalThis.__submitted.culturalContext, stored);
  // and a brand-new contact still carries the (empty) default shape rather than omitting the field
  await mount();
  await act(async () => setValue(document.querySelector('input[name="name"]'), "New Person"));
  await act(async () => setValue(document.querySelector('input[name="email"]'), "new@example.test"));
  await submit();
  assert.deepEqual(globalThis.__submitted.culturalContext, { heritage: [], faith: null, preferCulturalGifts: false });
});

test("uniform spacing tokens and the unchanged Friend relation (W06 not applied)", async () => {
  await mount();
  const form = document.querySelector("form.gm-cf");
  assert.equal(form.style.getPropertyValue("--gm-section-gap"), "1.5rem");
  assert.equal(form.style.getPropertyValue("--gm-inner-gap"), "1rem");
  // W06 not applied: with Type = Friend the Relation list still offers "Friend" (taxonomyLock parity with the Import Wizard)
  await act(async () => setValue(document.querySelector('select[name="relationshipCategory"]'), "friend"));
  const rel = document.querySelector('select[name="relationship"]');
  assert.ok([...rel.options].some((o) => o.value === "friend" && o.textContent === "Friend"));
});
