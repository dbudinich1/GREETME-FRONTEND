// src/pages/founder/salespersonReferralEmptyState.browser.test.mjs
//
// TEAM C — the referral override must not describe an arrangement that does not exist.
//
// With no referring salesperson, the page used to show an override of 5% and a status of Active.
// Both were inert — saving sent referral: null and no override entry could be created — but a
// founder reading the panel could not tell an unset default from a live 5% arrangement. These
// tests hold the display to what a save would actually send.
//
// Same harness as the sibling B2/B3 suites: the REAL page, bundled with esbuild and mounted in
// jsdom with an injected api client. No network, no backend, no production data.
//
// Run (Node 20.x): node --test src/pages/founder/salespersonReferralEmptyState.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__ref.bundle.mjs");
const ENTRY = join(__dirname, ".__ref.entry.jsx");
let React, createRoot, act, Page, window;

before(async () => {
  writeFileSync(ENTRY, `export { default as Page } from "./SalespersonControlCenter.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Page } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const FOUNDER = { userId: "u1", plan: "founder" };

const ROSTER = [
  { salespersonId: "sp1", displayName: "Kat Alvarez" },
  { salespersonId: "sp-uncle-roo", displayName: "Uncle Roo" },
];

/** A salesperson record. `compensation`/`referral` default to null — the legacy shape. */
function person({ compensation = null, referral = null } = {}) {
  return {
    salespersonId: "sp1", displayName: "Kat Alvarez", email: "", status: "active",
    referralSlug: "", tokenVersion: 1, compensation, referral, compensationVersion: 1,
  };
}

function api(record = person(), over = {}) {
  const calls = [];
  const base = {
    calls,
    list: async () => { calls.push(["list"]); return { ok: true, status: 200, data: { ok: true, salespeople: ROSTER } }; },
    read: async (id) => { calls.push(["read", id]); return { ok: true, status: 200, data: { ok: true, salesperson: record } }; },
    create: async () => ({ ok: true, status: 201, data: { ok: true } }),
    setReferralSlug: async () => ({ ok: true, status: 200, data: { ok: true, salesperson: record } }),
    removeReferralSlug: async () => ({ ok: true, status: 200, data: { ok: true, salesperson: record } }),
    rotateToken: async () => ({ ok: true, status: 200, data: { ok: true, salesperson: record } }),
    setStatus: async () => ({ ok: true, status: 200, data: { ok: true, salesperson: record } }),
    setCompensation: async (id, body) => {
      calls.push(["setCompensation", id, body]);
      return { ok: true, status: 200, data: { ok: true, salesperson: record } };
    },
  };
  return { ...base, ...over, calls };
}

let root;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); }); await flush(); };
const setVal = (el, v) => {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};

async function open(a) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Page, { api: a, user: FOUNDER })); });
  await flush();
  await click(tid("fcc-row-sp1"));
}

/** Any call that could change server state. Reads are list/read only. */
const writes = (a) => a.calls.filter((c) => !["list", "read"].includes(c[0]));

// ══ A · NO REFERRING SALESPERSON ═══════════════════════════════════════════════════════════════

test("1 · a record with referral:null shows no override percentage", async () => {
  const a = api(person());
  await open(a);
  assert.equal(tid("fcc-referrer").value, "", "referrer is None");
  assert.equal(tid("fcc-override-rate").value, "", "the override field is blank, not 5");
  assert.equal(/\b5\b/.test(tid("fcc-override-rate").value), false, "no 5 is displayed anywhere in it");
  assert.equal(tid("fcc-override-rate").disabled, true, "and it stays disabled");
});

test("2 · a record with referral:null shows no Active override status", async () => {
  await open(api(person()));
  assert.equal(tid("fcc-override-status"), null, "the override status control is absent entirely");
  const panel = tid("fcc-detail").textContent;
  assert.equal(/Override status/i.test(panel), false, "and its label is gone with it");
});

test("3 · opening a record with no referrer performs no write request", async () => {
  const a = api(person());
  await open(a);
  assert.deepEqual(writes(a), [], "reads only — nothing is saved by looking");
  assert.equal(a.calls.some((c) => c[0] === "setCompensation"), false);
});

test("4 · saving with None sends referral: null", async () => {
  const a = api(person());
  await open(a);
  await click(tid("fcc-comp-save"));
  const call = a.calls.find((c) => c[0] === "setCompensation");
  assert.ok(call, "a save was attempted");
  assert.equal(call[2].referral, null, "referral is null, so no override can be created");
  assert.deepEqual(call[2].compensation, { year_1: 2500, year_2: 1500, year_3_plus: 1000 },
    "and the default schedule is unchanged");
});

// ══ B · REFERRER SELECTED ══════════════════════════════════════════════════════════════════════

test("5 · selecting a referrer reveals and enables the override controls", async () => {
  const a = api(person());
  await open(a);
  assert.equal(tid("fcc-override-status"), null, "hidden to begin with");
  setVal(tid("fcc-referrer"), "sp-uncle-roo");
  await flush();
  assert.equal(tid("fcc-override-rate").disabled, false, "the percentage becomes editable");
  assert.ok(tid("fcc-override-status"), "the status control appears");
  assert.equal(tid("fcc-override-status").value, "active");
});

test("6 · a newly selected referrer keeps the existing 5% default", async () => {
  const a = api(person());
  await open(a);
  setVal(tid("fcc-referrer"), "sp-uncle-roo");
  await flush();
  assert.equal(tid("fcc-override-rate").value, "5", "the established default is preserved");

  await click(tid("fcc-comp-save"));
  const call = a.calls.find((c) => c[0] === "setCompensation");
  assert.deepEqual(call[2].referral,
    { referrerSalespersonId: "sp-uncle-roo", overrideRateBps: 500, status: "active" },
    "and it still serialises as 500 bps");
});

// ══ C · EXISTING CONFIGURED REFERRALS ══════════════════════════════════════════════════════════

test("7 · an existing 5% active referral renders as 5 and Active", async () => {
  // The Kat/Dana shape: 20/10/10 with a 5% active override to Uncle Roo. Fixture only — no
  // production record is read, written or contacted by this test.
  const a = api(person({
    compensation: { year_1: 2000, year_2: 1000, year_3_plus: 1000 },
    referral: { referrerSalespersonId: "sp-uncle-roo", overrideRateBps: 500, status: "active" },
  }));
  await open(a);
  assert.equal(tid("fcc-rate-y1").value, "20");
  assert.equal(tid("fcc-rate-y2").value, "10");
  assert.equal(tid("fcc-rate-y3").value, "10");
  assert.equal(tid("fcc-referrer").value, "sp-uncle-roo");
  assert.equal(tid("fcc-override-rate").value, "5", "the configured override is shown");
  assert.equal(tid("fcc-override-rate").disabled, false);
  assert.ok(tid("fcc-override-status"), "the status is shown");
  assert.equal(tid("fcc-override-status").value, "active", "and reads Active");
});

test("11 · custom 20/10/10 terms round-trip unchanged", async () => {
  const a = api(person({
    compensation: { year_1: 2000, year_2: 1000, year_3_plus: 1000 },
    referral: { referrerSalespersonId: "sp-uncle-roo", overrideRateBps: 500, status: "active" },
  }));
  await open(a);
  await click(tid("fcc-comp-save"));
  const call = a.calls.find((c) => c[0] === "setCompensation");
  assert.deepEqual(call[2].compensation, { year_1: 2000, year_2: 1000, year_3_plus: 1000 });
  assert.deepEqual(call[2].referral,
    { referrerSalespersonId: "sp-uncle-roo", overrideRateBps: 500, status: "active" });
});

// ══ D · REMOVING A REFERRER ════════════════════════════════════════════════════════════════════

test("8 · changing an existing referrer back to None hides the stale override", async () => {
  const a = api(person({
    compensation: { year_1: 2000, year_2: 1000, year_3_plus: 1000 },
    referral: { referrerSalespersonId: "sp-uncle-roo", overrideRateBps: 500, status: "active" },
  }));
  await open(a);
  assert.equal(tid("fcc-override-rate").value, "5");

  setVal(tid("fcc-referrer"), "");
  await flush();
  assert.equal(tid("fcc-override-rate").value, "", "the percentage blanks immediately");
  assert.equal(tid("fcc-override-rate").disabled, true);
  assert.equal(tid("fcc-override-status"), null, "the Active status is gone");
  assert.equal(/Override status/i.test(tid("fcc-detail").textContent), false);
});

test("9 · saving after removing the referrer sends referral: null", async () => {
  const a = api(person({
    compensation: { year_1: 2000, year_2: 1000, year_3_plus: 1000 },
    referral: { referrerSalespersonId: "sp-uncle-roo", overrideRateBps: 500, status: "active" },
  }));
  await open(a);
  setVal(tid("fcc-referrer"), "");
  await flush();
  await click(tid("fcc-comp-save"));
  const call = a.calls.find((c) => c[0] === "setCompensation");
  assert.equal(call[2].referral, null, "no override is created");
  assert.deepEqual(call[2].compensation, { year_1: 2000, year_2: 1000, year_3_plus: 1000 },
    "and the direct terms are untouched by removing a referrer");
});

// ══ UNCHANGED BEHAVIOUR ════════════════════════════════════════════════════════════════════════

test("10 · the default 25 / 15 / 10 schedule still prefills a record with no terms", async () => {
  await open(api(person()));
  assert.equal(tid("fcc-rate-y1").value, "25");
  assert.equal(tid("fcc-rate-y2").value, "15");
  assert.equal(tid("fcc-rate-y3").value, "10");
});

test("13 · Reset to default restores 25 / 15 / 10 and clears the referrer", async () => {
  const a = api(person({
    compensation: { year_1: 2000, year_2: 1000, year_3_plus: 1000 },
    referral: { referrerSalespersonId: "sp-uncle-roo", overrideRateBps: 500, status: "active" },
  }));
  await open(a);
  await click(tid("fcc-comp-default"));
  assert.equal(tid("fcc-rate-y1").value, "25");
  assert.equal(tid("fcc-rate-y2").value, "15");
  assert.equal(tid("fcc-rate-y3").value, "10");
  assert.equal(tid("fcc-referrer").value, "", "reset also clears the referrer");
  assert.equal(tid("fcc-override-status"), null, "so the override status is hidden again");
  assert.equal(tid("fcc-override-rate").value, "", "and the percentage is blank");
});

test("12 · no cutover endpoint or action is reachable from this page", async () => {
  const a = api(person());
  await open(a);
  setVal(tid("fcc-referrer"), "sp-uncle-roo"); await flush();
  await click(tid("fcc-comp-save"));
  for (const [name] of a.calls) {
    assert.equal(/cutover/i.test(name), false, `${name} must not be a cutover call`);
  }
  assert.equal(/cutover/i.test(tid("fcc-detail").textContent), false, "and nothing offers one");
});

test("14 · the pre-existing salesperson controls are all still present", async () => {
  await open(api(person()));
  for (const t of ["fcc-slug-input", "fcc-slug-save", "fcc-rotate", "fcc-comp-save", "fcc-comp-default",
    "fcc-rate-y1", "fcc-rate-y2", "fcc-rate-y3", "fcc-referrer", "fcc-override-rate"]) {
    assert.ok(tid(t), `${t} is still rendered`);
  }
});
