// src/pages/founder/salespersonControlCenterB3.browser.test.mjs
//
// TEAM B — SALES S1 · B3: read-only reporting (summary, health, ledger, pending, controls).
// The real page, bundled and mounted in jsdom with an injected client.
//
// Run (Node 20.x): node --test src/pages/founder/salespersonControlCenterB3.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__b3.bundle.mjs");
const ENTRY = join(__dirname, ".__b3.entry.jsx");
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
const ORDINARY = { userId: "u2", plan: "unforgettable" };

const SUMMARY = {
  salespersonId: "sp1", displayName: "Rep North", status: "active", linkStatus: "active",
  originatedDirectCustomers: 4, originatedFundraiserPartners: 1,
  originalPaidConversions: 3, recurringPaidTransactions: 7, entryCount: 10,
  eligibleRevenueMinor: 123456, pendingCommissionMinor: 2500,
  approvedCommissionMinor: 1000, paidCommissionMinor: 750, reversedCommissionMinor: -250,
};
const HEALTH = { referralsValidated: 12, conversions: 3, lostBeforeConversion: 9 };
const ENTRIES = [
  { id: "led_1", status: "approved", salespersonCommissionMinor: 1000, currency: "USD", effectiveAt: "2026-08-01T00:00:00.000Z" },
  { id: "led_2", status: "pending", salespersonCommissionMinor: 2500, currency: "USD", effectiveAt: "2026-08-14T00:00:00.000Z" },
];
const CONTROLS = { path: "salesperson_attribution", referralPublicLive: false, attributionLive: false };

function api(over = {}) {
  const calls = [];
  const base = {
    list: async () => { calls.push(["list"]); return { ok: true, status: 200, data: { ok: true, salespeople: [{ salespersonId: "sp1", displayName: "Rep North" }] } }; },
    read: async (id) => { calls.push(["read", id]); return { ok: true, status: 200, data: { ok: true, salesperson: { salespersonId: id, displayName: "Rep North", status: "active", referralSlug: "" } } }; },
    create: async () => ({ ok: true, status: 201, data: { ok: true } }),
    setReferralSlug: async () => ({ ok: true, status: 200, data: { ok: true, salesperson: {}, publicReferralLink: null } }),
    removeReferralSlug: async () => ({ ok: true, status: 200, data: { ok: true, salesperson: {}, publicReferralLink: null } }),
    rotateToken: async () => ({ ok: true, status: 200, data: { ok: true, salesperson: {}, attributionLink: "x" } }),
    setStatus: async () => ({ ok: true, status: 200, data: { ok: true, salesperson: {} } }),
    summary: async (id) => { calls.push(["summary", id]); return { ok: true, status: 200, data: { ok: true, summary: SUMMARY } }; },
    attributionHealth: async (id) => { calls.push(["attributionHealth", id]); return { ok: true, status: 200, data: { ok: true, attributionHealth: HEALTH, controls: CONTROLS } }; },
    ledger: async (id) => { calls.push(["ledger", id]); return { ok: true, status: 200, data: { ok: true, entries: ENTRIES } }; },
    pendingForUser: async (uid) => { calls.push(["pendingForUser", uid]); return { ok: true, status: 200, data: { ok: true, pending: { userId: uid, status: "pending" } } }; },
    controls: async () => { calls.push(["controls"]); return { ok: true, status: 200, data: { ok: true, controls: CONTROLS } }; },
  };
  return { ...base, ...over, calls };
}

let root;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); }); await flush(); };
const setVal = (el, v) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, v);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};
async function open(a, user = FOUNDER, withDetail = true) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Page, { api: a, user })); });
  await flush();
  if (withDetail && tid("fcc-row-sp1")) { await click(tid("fcc-row-sp1")); await flush(); }
}

// ══ founder gate ════════════════════════════════════════════════════════════════════════════
test("an ordinary user issues ZERO reporting requests", async () => {
  const a = api();
  await open(a, ORDINARY, false);
  assert.ok(tid("fcc-denied"));
  assert.equal(a.calls.length, 0, "no list, summary, health, ledger, pending or controls call");
});

// ══ summary ═════════════════════════════════════════════════════════════════════════════════
test("the summary renders the server's own figures", async () => {
  const a = api();
  await open(a);
  const s = tid("fcc-summary");
  assert.ok(s, "summary renders");
  assert.deepEqual(a.calls.filter((c) => c[0] === "summary"), [["summary", "sp1"]]);
  assert.match(s.textContent, /Direct customers/);
  assert.match(s.textContent, /4/);
  assert.match(s.textContent, /123,456/, "eligible revenue printed as given");
});

test("money is shown in MINOR UNITS and never silently converted or given a guessed currency", async () => {
  const a = api();
  await open(a);
  const s = tid("fcc-summary").textContent;
  assert.match(s, /123,456 \(minor units\)/, "unit is named explicitly");
  // 123456 minor units must NOT appear as a converted 1,234.56 with an invented symbol.
  assert.equal(/\$1,234\.56|1,234\.56/.test(s), false, "no silent division by 100");
  assert.equal(/\$/.test(s), false, "no currency symbol the summary never supplied");
});

test("a missing numeric field renders an em dash, not zero", async () => {
  const a = api({ summary: async () => ({ ok: true, status: 200, data: { ok: true, summary: { ...SUMMARY, pendingCommissionMinor: null } } }) });
  await open(a);
  assert.match(tid("fcc-summary").textContent, /—/, "absent is shown as absent");
});

// ══ empty vs failure ════════════════════════════════════════════════════════════════════════
test("an EMPTY ledger is clearly different from a FAILED ledger request", async () => {
  const empty = api({ ledger: async () => ({ ok: true, status: 200, data: { ok: true, entries: [] } }) });
  await open(empty);
  assert.ok(tid("fcc-ledger-empty"), "empty state");
  assert.match(tid("fcc-ledger-empty").textContent, /No commission entries yet/i);
  assert.equal(tid("fcc-ledger-error"), null);

  const failed = api({ ledger: async () => ({ ok: false, status: 500, data: { ok: false, code: "INTERNAL_ERROR" } }) });
  await open(failed);
  assert.ok(tid("fcc-ledger-error"), "failure state");
  assert.equal(tid("fcc-ledger-empty"), null, "a failure is NEVER shown as 'no entries'");
  assert.equal(/INTERNAL_ERROR/.test(document.body.textContent), false, "no raw code");
});

test("summary and health failures are reported independently of the ledger", async () => {
  const a = api({
    summary: async () => ({ ok: false, status: 500, data: null }),
    attributionHealth: async () => ({ ok: false, status: 404, data: null }),
  });
  await open(a);
  assert.ok(tid("fcc-summary-error"), "summary failure surfaced");
  assert.ok(tid("fcc-health-error"), "health failure surfaced");
  assert.ok(tid("fcc-ledger"), "the ledger still renders — one failure does not blank the rest");
});

// ══ ledger fidelity ═════════════════════════════════════════════════════════════════════════
test("ledger rows preserve id, status, amount, currency and timestamp, and invent no total", async () => {
  const a = api();
  await open(a);
  const rows = document.querySelectorAll('[data-testid^="fcc-ledger-row-"]');
  assert.equal(rows.length, 2, "one row per entry, nothing merged");
  const first = rows[0].textContent;
  assert.match(first, /led_1/, "identifier preserved");
  assert.match(first, /approved/, "status preserved");
  assert.match(first, /1,000 USD \(minor units\)/, "amount with the entry's OWN currency");
  assert.match(first, /2026-08-01T00:00:00\.000Z/, "timestamp preserved verbatim");
  // No fabricated aggregate anywhere in the ledger block.
  const block = tid("fcc-ledger").textContent;
  assert.equal(/Total|Sum|Subtotal/i.test(block), false, "no invented totals");
});

// ══ pending lookup ══════════════════════════════════════════════════════════════════════════
test("pending attribution is NEVER fetched in the background — it needs a deliberate id", async () => {
  const a = api();
  await open(a);
  assert.equal(a.calls.filter((c) => c[0] === "pendingForUser").length, 0,
    "no enumeration on load");
  assert.equal(tid("fcc-pending-go").disabled, true, "the control is inert with an empty field");

  setVal(tid("fcc-pending-input"), "  user-42  ");
  await flush();
  await click(tid("fcc-pending-go"));
  assert.deepEqual(a.calls.find((c) => c[0] === "pendingForUser"), ["pendingForUser", "user-42"],
    "exactly the id the founder typed, trimmed");
  assert.match(tid("fcc-pending-value").textContent, /user-42/);
});

test("a user with no pending attribution reads as none, not as an error", async () => {
  const a = api({ pendingForUser: async () => ({ ok: true, status: 200, data: { ok: true, pending: null } }) });
  await open(a);
  setVal(tid("fcc-pending-input"), "user-x"); await flush();
  await click(tid("fcc-pending-go"));
  assert.ok(tid("fcc-pending-none"));
  assert.equal(tid("fcc-pending-error"), null);
});

test("a failed pending lookup reads as an error, not as none", async () => {
  const a = api({ pendingForUser: async () => ({ ok: false, status: 0, data: null, networkError: true }) });
  await open(a);
  setVal(tid("fcc-pending-input"), "user-x"); await flush();
  await click(tid("fcc-pending-go"));
  assert.ok(tid("fcc-pending-error"));
  assert.match(tid("fcc-pending-error").textContent, /couldn.t reach the server/i);
  assert.equal(tid("fcc-pending-none"), null);
});

// ══ controls ════════════════════════════════════════════════════════════════════════════════
test("controls are shown truthfully, labelled read-only, with no toggle", async () => {
  const a = api();
  await open(a);
  const c = tid("fcc-controls");
  assert.ok(c);
  assert.match(c.textContent, /read-only/i);
  assert.match(c.textContent, /Referral link live:\s*false/i, "the real value, not a friendly fiction");
  assert.match(c.textContent, /Attribution live:\s*false/i);
  assert.equal(c.querySelector("input,button,select"), null, "no control that could change a flag");
});

// ══ failure handling ════════════════════════════════════════════════════════════════════════
test("401 / 403 / 404 are plain language everywhere, with no internal codes", async () => {
  for (const [status, re] of [[401, /session has expired/i], [403, /founder account/i], [404, /no longer exists/i]]) {
    const a = api({ summary: async () => ({ ok: false, status, data: { ok: false, code: "NOT_FOUND" } }) });
    await open(a);
    assert.match(tid("fcc-summary-error").textContent, re, `status ${status}`);
    assert.equal(/NOT_FOUND|INTERNAL_ERROR/.test(document.body.textContent), false);
  }
});

test("malformed reporting payloads do not crash the surface", async () => {
  const a = api({
    summary: async () => ({ ok: true, status: 200, data: { ok: true, summary: null } }),
    ledger: async () => ({ ok: true, status: 200, data: { ok: true, entries: "not-an-array" } }),
    attributionHealth: async () => ({ ok: true, status: 200, data: { ok: true } }),
  });
  await open(a);
  assert.ok(tid("fcc-report"), "the page still renders");
  assert.equal(tid("fcc-summary"), null, "no summary invented from null");
  assert.equal(tid("fcc-ledger"), null, "a non-array is not rendered as rows");
});

// ══ B1 / B2 preserved ═══════════════════════════════════════════════════════════════════════
test("B1 and B2 behaviour survive: create form, rotate confirmation, status controls", async () => {
  const a = api();
  await open(a);
  assert.ok(tid("fcc-create-form"), "B1 create form intact");
  assert.ok(tid("fcc-slug-input"), "B2 vanity control intact");
  await click(tid("fcc-rotate"));
  assert.ok(tid("fcc-confirm"), "B2 destructive confirmation intact");
  assert.equal(a.calls.filter((c) => c[0] === "rotateToken").length, 0, "still confirms before acting");
});

// ══ source guarantees ═══════════════════════════════════════════════════════════════════════
test("reporting is never logged or persisted, and no historical token is requested", () => {
  const src = readFileSync(new URL("./SalespersonControlCenter.jsx", import.meta.url), "utf8");
  assert.equal(/localStorage\.setItem|sessionStorage\.setItem/.test(src), false, "nothing persisted");
  assert.equal(/console\.(log|info|warn|error)\s*\(/.test(src), false, "nothing logged");
  const client = readFileSync(new URL("../../api/salesAdmin.js", import.meta.url), "utf8");
  // Every B3 endpoint is a GET; none returns or requests an existing token.
  for (const m of ["summary:", "attributionHealth:", "ledger:", "pendingForUser:", "controls:"]) {
    assert.ok(client.includes(m), `${m} present`);
  }
  assert.equal(/rotate[^)]*token[^)]*get\(/i.test(client), false, "no token read path");
});
