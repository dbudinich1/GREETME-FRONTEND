// src/components/recipientsPracticeView.browser.test.mjs
//
// BROWSER-LEVEL tests for the real Recipients Practice View. The shipped RecipientsPracticeView.jsx is
// esbuild-transformed and mounted with react-dom/client into jsdom (it has NO side-effect imports —
// only pure model modules). Proves the banner/badge copy, the absence of every production action, the
// exit confirmation, the empty state, the detail view, keyboard focus, and that Exit never mutates.
// Run: node --test src/components/recipientsPracticeView.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__practiceview.bundle.mjs");
let React, createRoot, PracticeView, act;

before(async () => {
  writeFileSync(join(__dirname, ".__pv-entry.jsx"), `export { default as PracticeView } from "./RecipientsPracticeView.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__pv-entry.jsx")],
    outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  rmSync(join(__dirname, ".__pv-entry.jsx"), { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ PracticeView } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(join(__dirname, ".__pv-entry.jsx"), { force: true }); } catch { /* ignore */ } });

const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const all = (t) => [...document.querySelectorAll(`[data-testid="${t}"]`)];
const txt = () => document.body.textContent;
const click = (el) => el.dispatchEvent(new window.Event("click", { bubbles: true }));
const CONTACTS = [
  { name: "Ada Lovelace", email: "ada@example.com", relationship: "colleague", relationshipCategory: "professional", relationshipCloseness: "greetme_worthy", recipientType: "employee", company: "Demo Corp", birthday: "1990-05-14", shippingAddress: { line1: "1 Main St", city: "Reno", state: "NV", zip: "89501", country: "USA" } },
  { name: "Morgan Doe", email: "morgan@example.com", relationship: "", recipientType: "" },
];
async function mount(props) {
  document.body.innerHTML = "";
  const c = document.createElement("div"); document.body.appendChild(c);
  const state = { exited: 0, wizard: 0 };
  await act(async () => { createRoot(c).render(React.createElement(PracticeView, { status: "active", contacts: CONTACTS, onExit: () => state.exited++, onReturnToWizard: () => state.wizard++, ...props })); });
  return state;
}

test("banner shows the exact approved temporary-data copy (screen-reader available, not color-only)", async () => {
  await mount();
  const banner = tid("practice-banner");
  assert.ok(banner && banner.getAttribute("role") === "region" && banner.getAttribute("aria-label"), "banner is a labeled region");
  assert.match(txt(), /Test Drive — Practice Contacts/);
  assert.match(tid("practice-primary-copy").textContent, /These fictional contacts exist only in this Test Drive\. They have not been added to your account and cannot trigger greetings, gifts, schedules, messages, or payments\./);
  assert.match(tid("practice-cleanup-copy").textContent, /They will be automatically removed when you exit Test Drive, log out, or your session ends\./);
  assert.match(tid("practice-exit").textContent, /Exit and Remove Practice Contacts/);
  assert.match(tid("practice-return-wizard").textContent, /Return to Test Drive/);
});
test("every practice card carries a Practice Contact badge + safe explanatory action text", async () => {
  await mount();
  const cards = all("practice-card");
  assert.equal(cards.length, 2);
  for (const card of cards) assert.match(card.textContent, /Practice Contact/);
  for (const note of all("practice-actions-note")) assert.match(note.textContent, /Practice only — sending, scheduling, gifting, and automation are unavailable\./);
});
test("NO production actions exist (no Send / Schedule / gift / Edit / Delete controls)", async () => {
  await mount();
  const body = txt();
  for (const forbidden of ["Send Greet-Me", "Schedule", "Arrange gift", "Purchase", "Checkout", "Delete recipient", "Edit recipient"]) {
    assert.ok(!body.includes(forbidden), `practice view must not show "${forbidden}"`);
  }
  // no button reachable that would send/schedule/edit/delete
  const btns = [...document.querySelectorAll("button")].map((b) => b.textContent);
  assert.ok(!btns.some((t) => /send|schedule|gift|purchase|checkout|edit recipient|delete recipient/i.test(t)), "no production action button");
});
test("blank optional relationship displays truthfully", async () => {
  await mount();
  assert.match(txt(), /Relationship not provided/);
});
test("exit confirmation uses the exact approved copy; Exit clears via onExit (never a production delete)", async () => {
  const state = await mount();
  const exitBtn = tid("practice-exit");
  assert.equal(exitBtn.tagName, "BUTTON");
  exitBtn.focus(); assert.equal(document.activeElement, exitBtn, "exit is keyboard-focusable");
  await act(async () => click(exitBtn));
  const dlg = tid("practice-exit-confirm");
  assert.ok(dlg && dlg.getAttribute("role") === "dialog");
  assert.match(txt(), /Exit Test Drive\?/);
  assert.match(txt(), /All practice contacts will be removed from this session\. Your real recipients will not be changed\./);
  assert.match(tid("practice-exit-confirm-yes").textContent, /Exit and Remove/);
  assert.match(tid("practice-exit-confirm-no").textContent, /Keep Test Drive Open/);
  await act(async () => click(tid("practice-exit-confirm-yes")));
  assert.equal(state.exited, 1, "onExit invoked (cleanup handled by the caller; no production delete here)");
});
test("Keep Test Drive Open dismisses the confirmation without exiting", async () => {
  const state = await mount();
  await act(async () => click(tid("practice-exit")));
  await act(async () => click(tid("practice-exit-confirm-no")));
  assert.equal(tid("practice-exit-confirm"), null, "confirmation dismissed");
  assert.equal(state.exited, 0, "did not exit");
});
test("read-only detail view repeats the practice notice; no route into production Edit", async () => {
  await mount();
  await act(async () => click(all("practice-view-details")[0]));
  assert.ok(tid("practice-detail"));
  assert.match(tid("practice-detail-note").textContent, /Practice Contact — fictional data, not saved to your account\./);
  assert.ok(!/Edit Recipient/i.test(txt()), "no production Edit Recipient affordance");
});
test("empty state shows the approved copy + wizard/exit actions", async () => {
  await mount({ status: "empty", contacts: [] });
  assert.ok(tid("practice-empty"));
  assert.match(txt(), /No practice contacts are currently loaded\./);
  assert.ok(tid("practice-empty-wizard") && tid("practice-empty-exit"));
  assert.equal(all("practice-card").length, 0);
});
test("session expiration auto-exits (deterministic cleanup, no confirmation)", async () => {
  const state = await mount();
  await act(async () => { window.dispatchEvent(new window.Event("auth:session-expired")); });
  assert.equal(state.exited, 1, "session-expired triggered onExit without a dialog");
});
