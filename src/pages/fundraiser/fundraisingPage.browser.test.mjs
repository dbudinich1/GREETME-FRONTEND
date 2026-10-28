// src/pages/fundraiser/fundraisingPage.browser.test.mjs
// The dashboard's Fundraisers page ("Greet-Me for Organizations", founder handoff 2026-10-28), mounted for real in jsdom.
// Only the edges are stubbed: the API client (contactSales answers set per test), the fundraiser gate, the sample
// viewer (a marker component), its media check and the toast. Nothing is sent, charged or ordered.
// Run (Node 20): node --test src/pages/fundraiser/fundraisingPage.browser.test.mjs
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const ENTRY = join(__dirname, `.__frp.${PID}.entry.jsx`);
const BUNDLE = join(__dirname, `.__frp.${PID}.bundle.mjs`);
let React, createRoot, act, M, window;

const STUBS = {
  api: `export const __calls = []; export const __responses = {};
    export default { contactSales: async (body) => { __calls.push(body); const r = __responses.contactSales; const out = typeof r === "function" ? await r(body, __calls.length) : r; if (out instanceof Error) throw out; return out; } };`,
  gate: `export const isFundraiserUiEnabled = () => globalThis.__gate !== false;`,
  overlay: `import React from "react"; export default function S({ onClose }) { return React.createElement("div", { "data-testid": "sample-overlay" }, React.createElement("button", { "data-testid": "sample-close", onClick: onClose }, "Close")); }`,
  media: `export default function useSampleMediaAvailable() { return globalThis.__media || "available"; }`,
  notify: `export const __toasts = []; export const showManualToast = (t, b) => { __toasts.push([t, b]); };`,
};

before(async () => {
  writeFileSync(ENTRY, [
    'export { default as Page } from "./FundraisersPublic.jsx";',
    'export { MemoryRouter } from "react-router-dom";',
    'export { __calls, __responses } from "../../api/api";',
    'export { __toasts } from "../../utils/notify";',
  ].join("\n"));
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react-router-dom"],
    loader: { ".css": "empty", ".png": "dataurl", ".svg": "dataurl", ".jpg": "dataurl" },
    plugins: [{ name: "stub", setup(b) {
      const map = [[/api\/api(\.js)?$/, "api"], [/fundraiserGate\.js$/, "gate"], [/SampleGreetingOverlay\.jsx$/, "overlay"], [/useSampleMediaAvailable\.js$/, "media"], [/utils\/notify(\.js)?$/, "notify"]];
      for (const [filter, ns] of map) {
        b.onResolve({ filter }, () => ({ path: ns, namespace: ns }));
        b.onLoad({ filter: /.*/, namespace: ns }, () => ({ contents: STUBS[ns], loader: "js", resolveDir: __dirname }));
      }
    } }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/fundraisers" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  Object.assign(globalThis, { HTMLElement: window.HTMLElement, Event: window.Event, MouseEvent: window.MouseEvent, KeyboardEvent: window.KeyboardEvent, getComputedStyle: window.getComputedStyle });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async () => { throw new Error("no test may make a network request"); };
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
after(() => { for (const f of [ENTRY, BUNDLE]) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });
beforeEach(() => { M.__calls.length = 0; M.__toasts.length = 0; delete M.__responses.contactSales; globalThis.__gate = true; globalThis.__media = "available"; document.body.innerHTML = ""; document.body.style.overflow = ""; });

const flush = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const tids = (t) => [...document.querySelectorAll(`[data-testid="${t}"]`)];
const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
const click = async (el) => { assert.ok(el, "control must exist"); await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); await flush(); };
const setVal = async (el, v) => {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v); el.dispatchEvent(new window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
};
async function mount() {
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(M.MemoryRouter, null, React.createElement(M.Page))); });
  await flush();
  return { root, unmount: () => act(() => root.unmount()) };
}
const fill = async (over = {}) => {
  const f = { name: "Jordan Ellis", organization: "Riverside High Boosters", email: "jordan@riverside.org", ...over };
  await setVal(document.getElementById("frp-inq-name"), f.name);
  await setVal(document.getElementById("frp-inq-organization"), f.organization);
  await setVal(document.getElementById("frp-inq-email"), f.email);
  if (f.orgType) await setVal(document.getElementById("frp-inq-orgType"), f.orgType);
  if (f.message !== undefined) await setVal(document.getElementById("frp-inq-message"), f.message);
};
const submit = async () => { await act(async () => { document.querySelector('[data-testid="frp-inquiry"] form').dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); }); await flush(); };

test("the sections render inside the page in the reference order: Hero, Bridge, Possibilities, Growth, Supporter, How It Works, Who It's For, Closing", async () => {
  const m = await mount();
  try {
    const order = [...document.querySelectorAll('[data-testid="fundraising-page"] > section')].map((s) => s.getAttribute("data-testid"));
    assert.deepEqual(order, ["frp-hero", "frp-bridge", "frp-possibilities", "frp-growth", "frp-supporter", "frp-how", "frp-who", "frp-closing"]);
    assert.match(text(tid("frp-hero")), /Build more than a fundraiser\.\s*Build a growing source of support\./);
    assert.equal(document.querySelector("header"), null, "no copy of the prototype's static header (the dashboard's own navigation is used)");
  } finally { await m.unmount(); }
});

test("earnings stay tied to qualifying subscriptions and the agreement: no rates, amounts, guarantees or payout promises", async () => {
  const m = await mount();
  try {
    const t = [...tid("fundraising-page").querySelectorAll("section")].map(text).join(" ");
    assert.doesNotMatch(t, /\d+\s?%|\$\s?\d|per cent|percent|guarantee|commission rate|you will earn|payout/i);
    assert.match(t, /qualifying subscriptions/); assert.match(t, /fundraising agreement/);
    assert.match(t, /These are possible uses of organizational earnings, not benefits automatically provided by Greet-Me\./);
    assert.match(t, /Imagery on this page is representative placeholder art/);
  } finally { await m.unmount(); }
});

test("every 'Let’s Grow Together' and 'Start the conversation' opens the organization inquiry form", async () => {
  const m = await mount();
  try {
    const opens = [...tids("frp-grow"), tid("frp-start-conversation")];
    assert.equal(tids("frp-grow").length, 2, "hero and closing");
    for (const b of opens) {
      await click(b);
      assert.ok(tid("frp-inquiry"), "the form opens");
      assert.match(text(tid("frp-inquiry")), /Tell us about your organization\./);
      for (const id of ["name", "organization", "orgType", "email", "message"]) assert.ok(document.getElementById(`frp-inq-${id}`), id);
      await click(tid("frp-inquiry-close"));
      assert.equal(tid("frp-inquiry"), null, "closes");
    }
  } finally { await m.unmount(); }
});

test("inquiry validation: name, organization and email are required; nothing is sent until they are", async () => {
  const m = await mount();
  try {
    await click(tids("frp-grow")[0]);
    await submit();
    assert.equal(M.__calls.length, 0, "no request");
    assert.match(text(tid("frp-inquiry-error")), /Please add your name, your organization and an email we can reply to\./);
    for (const id of ["name", "organization", "email"]) assert.equal(document.getElementById(`frp-inq-${id}`).getAttribute("aria-invalid"), "true", id);
    await fill({ email: "not-an-email" });
    await submit();
    assert.equal(M.__calls.length, 0);
    assert.match(text(tid("frp-inquiry")), /Please enter a valid email address\./);
  } finally { await m.unmount(); }
});

test("inquiry received: the exact body goes to the existing contact route (source fundraiser, type carried), and only a real received:true shows success", async () => {
  M.__responses.contactSales = { status: 200, body: { ok: true, received: true } };
  const m = await mount();
  try {
    await click(tids("frp-grow")[1]);
    await fill({ orgType: "Arts programs", message: "Instruments for the spring production." });
    await submit();
    assert.deepEqual(M.__calls[0], {
      name: "Jordan Ellis", email: "jordan@riverside.org", organization: "Riverside High Boosters",
      message: "Organization type: Arts programs\n\nInstruments for the spring production.",
      source: "fundraiser", pageContext: "Fundraising page: Arts programs", website: "",
    });
    assert.ok(tid("frp-inquiry-sent"));
    assert.match(text(tid("frp-inquiry-sent")), /Jordan, your inquiry has been received\./);
    assert.match(text(tid("frp-inquiry-sent")), /We have your note about Riverside High Boosters\./);
  } finally { await m.unmount(); }
});

test("message left empty: the type alone is sent (the route's 5-character minimum is met)", async () => {
  M.__responses.contactSales = { status: 200, body: { ok: true, received: true } };
  const m = await mount();
  try {
    await click(tids("frp-grow")[0]);
    await fill();
    await submit();
    assert.equal(M.__calls[0].message, "Organization type: Schools");
    assert.ok(tid("frp-inquiry-sent"));
  } finally { await m.unmount(); }
});

test("recoverable failures: a 200 without received, a 502, a 429 and a network failure each show a failure, keep what was typed, and a retry can succeed", async () => {
  for (const bad of [{ status: 200, body: { ok: true } }, { status: 502, body: { ok: false, code: "CONTACT_SALES_SEND_FAILED" } }, { status: 429, body: null }, { networkError: true }]) {
    M.__calls.length = 0;
    M.__responses.contactSales = (_b, n) => (n === 1 ? bad : { status: 200, body: { ok: true, received: true } });
    const m = await mount();
    try {
      await click(tids("frp-grow")[0]);
      await fill({ message: "Uniforms" });
      await submit();
      assert.equal(tid("frp-inquiry-sent"), null, `${JSON.stringify(bad)}: never success`);
      assert.ok(tid("frp-inquiry-error"), "a visible failure");
      assert.match(text(tid("frp-inquiry-error")), /info@greet-me\.com/, "with the fallback address");
      assert.equal(document.getElementById("frp-inq-name").value, "Jordan Ellis", "what was typed is kept");
      assert.equal(document.getElementById("frp-inq-message").value, "Uniforms");
      await submit();
      assert.ok(tid("frp-inquiry-sent"), "retry succeeds");
      assert.equal(M.__calls.length, 2);
    } finally { await m.unmount(); }
  }
});

test("a duplicate is told it was already received; a 400 marks the named field", async () => {
  M.__responses.contactSales = { status: 200, body: { ok: true, received: true, duplicate: true } };
  let m = await mount();
  try {
    await click(tids("frp-grow")[0]); await fill(); await submit();
    assert.ok(tid("frp-inquiry-duplicate"));
    assert.match(text(tid("frp-inquiry-duplicate")), /We already have this inquiry\./);
  } finally { await m.unmount(); }
  M.__responses.contactSales = { status: 400, body: { ok: false, code: "CONTACT_SALES_INVALID", field: "email" } };
  m = await mount();
  try {
    await click(tids("frp-grow")[0]); await fill(); await submit();
    assert.equal(document.getElementById("frp-inq-email").getAttribute("aria-invalid"), "true");
    assert.equal(tid("frp-inquiry-sent"), null);
  } finally { await m.unmount(); }
});

test("while sending, the button says so and a second submit sends nothing more", async () => {
  M.__responses.contactSales = () => new Promise(() => {}); // never answers
  const m = await mount();
  try {
    await click(tids("frp-grow")[0]); await fill(); await submit();
    assert.equal(text(tid("frp-inquiry-submit")), "Sending…");
    assert.equal(tid("frp-inquiry-submit").disabled, true);
    await submit();
    assert.equal(M.__calls.length, 1);
  } finally { await m.unmount(); }
});

test("organization choices: each button switches the description and uses, with aria-pressed showing the active one", async () => {
  const m = await mount();
  try {
    const panel = () => text(tid("frp-org-panel"));
    assert.match(panel(), /^Schoolss*Classrooms, clubs and campuses/);
    assert.equal(tid("frp-org-schools").getAttribute("aria-pressed"), "true");
    for (const [key, label, use] of [["teams", "Sports teams", "Team travel and overnight trips"], ["alumni", "Alumni associations", "Reunions and homecoming events"], ["nonprofits", "Nonprofits", "A recurring source that steadies the year"]]) {
      await click(tid(`frp-org-${key}`));
      assert.equal(tid(`frp-org-${key}`).getAttribute("aria-pressed"), "true", key);
      assert.equal(document.querySelectorAll('.frp-chip[aria-pressed="true"]').length, 1, "one active");
      assert.ok(panel().startsWith(label), label);
      assert.ok(panel().includes(use), use);
      assert.equal(tid(`frp-org-${key}`).tagName, "BUTTON", "keyboard-operable buttons");
    }
  } finally { await m.unmount(); }
});

test("'See the Greet-Me Experience' (hero and closing) opens the existing sample viewer; while its video is unchecked or missing it says so instead", async () => {
  let m = await mount();
  try {
    assert.equal(tids("frp-experience").length, 2);
    for (const b of tids("frp-experience")) {
      await click(b);
      assert.ok(tid("sample-overlay"), "the existing sample opens");
      await click(tid("sample-close"));
      assert.equal(tid("sample-overlay"), null);
    }
  } finally { await m.unmount(); }
  globalThis.__media = "missing";
  m = await mount();
  try {
    await click(tids("frp-experience")[0]);
    assert.equal(tid("sample-overlay"), null, "never an empty viewer");
    assert.deepEqual(M.__toasts.at(-1)[0], "Sample Greet-Me not ready");
  } finally { await m.unmount(); }
});

test("the fundraiser gate still decides: off ⇒ the existing 'not available' page, no fundraising content", async () => {
  globalThis.__gate = false;
  const m = await mount();
  try {
    assert.equal(tid("fundraising-page"), null);
    assert.equal(tid("fundraisers-public"), null);
  } finally { await m.unmount(); }
});
