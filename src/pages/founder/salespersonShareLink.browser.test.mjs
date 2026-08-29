// src/pages/founder/salespersonShareLink.browser.test.mjs
//
// TEAM B — the shareable salesperson link.
//
// The production defect: the page showed only the slug-edit field, because the full URL was taken
// from `publicReferralLink` — a field the API returns on two MUTATION responses and never on a
// page load. A founder who simply opened Rudy's record saw no link at all.
//
// The link is now RECONSTRUCTED from the stored slug plus the current origin, so it is present on
// first render and survives a refresh. These tests prove that, and prove the reconstruction never
// becomes a second source of truth that can disagree with the server.
//
// Run (Node 20.x): node --test src/pages/founder/salespersonShareLink.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__link.bundle.mjs");
const ENTRY = join(__dirname, ".__link.entry.jsx");
let React, createRoot, act, Page, window;

const ORIGIN = "https://greet-me.com";

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
  globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Page } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const FOUNDER = { userId: "u1", plan: "founder" };
const ORDINARY = { userId: "u2", plan: "unforgettable" };

/** A client whose read returns Rudy WITH a slug and deliberately WITHOUT publicReferralLink. */
function api(over = {}) {
  const calls = [];
  const base = {
    list: async () => { calls.push(["list"]); return { ok: true, status: 200, data: { ok: true, salespeople: [{ salespersonId: "rudy", displayName: "Rudy" }] } }; },
    // NOTE: no publicReferralLink anywhere in this response — that is the production shape.
    read: async (id) => { calls.push(["read", id]); return { ok: true, status: 200, data: { ok: true, salesperson: { salespersonId: id, displayName: "Rudy", status: "active", referralSlug: "rudy" } } }; },
    create: async () => ({ ok: true, status: 201, data: { ok: true } }),
    setReferralSlug: async (id, slug) => { calls.push(["setReferralSlug", id, slug]); return { ok: true, status: 200, data: { ok: true, salesperson: { salespersonId: id, displayName: "Rudy", status: "active", referralSlug: String(slug).trim() } } }; },
    removeReferralSlug: async (id) => { calls.push(["removeReferralSlug", id]); return { ok: true, status: 200, data: { ok: true, salesperson: { salespersonId: id, displayName: "Rudy", status: "active", referralSlug: "" } } }; },
    rotateToken: async () => ({ ok: true, status: 200, data: { ok: true, salesperson: {}, attributionLink: "x" } }),
    setStatus: async () => ({ ok: true, status: 200, data: { ok: true, salesperson: {} } }),
    summary: async () => ({ ok: true, status: 200, data: { ok: true, summary: null } }),
    attributionHealth: async () => ({ ok: true, status: 200, data: { ok: true } }),
    ledger: async () => ({ ok: true, status: 200, data: { ok: true, entries: [] } }),
    pendingForUser: async () => ({ ok: true, status: 200, data: { ok: true, pending: null } }),
    controls: async () => ({ ok: true, status: 200, data: { ok: true, controls: {} } }),
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
async function open(a, { user = FOUNDER, origin = ORIGIN, detail = true } = {}) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Page, { api: a, user, origin })); });
  await flush();
  if (detail && tid("fcc-row-rudy")) { await click(tid("fcc-row-rudy")); await flush(); }
}

// ══ the defect itself ═══════════════════════════════════════════════════════════════════════
test("a stored slug displays the FULL link even though the API returned no publicReferralLink", async () => {
  const a = api();
  await open(a);
  const el = tid("fcc-public-link");
  assert.ok(el, "the link is displayed at all — this is the production defect");
  assert.equal(el.textContent, "https://greet-me.com/rudy", "reconstructed exactly");
  assert.match(tid("fcc-detail").textContent, /Shareable salesperson link/, "under a clear heading");
  assert.ok(tid("fcc-copy-share"), "a Copy link control is offered");
});

test("the URL is selectable, and the slug-edit field is still present alongside it", async () => {
  await open(api());
  assert.equal(tid("fcc-public-link").style.userSelect, "all", "selectable for manual copying");
  assert.ok(tid("fcc-slug-input"), "the edit field is not replaced by the display");
});

test("a REMOUNT reconstructs the link — nothing was remembered", async () => {
  const a = api();
  await open(a);
  assert.equal(tid("fcc-public-link").textContent, "https://greet-me.com/rudy");
  await open(a);                                     // refreshed page
  assert.equal(tid("fcc-public-link").textContent, "https://greet-me.com/rudy",
    "present again on a fresh mount, because it is derived rather than stored");
});

test("a non-production origin still produces a usable link", async () => {
  await open(api(), { origin: "http://localhost:5173" });
  assert.equal(tid("fcc-public-link").textContent, "http://localhost:5173/rudy");
});

test("a trailing slash on the origin does not double up", async () => {
  await open(api(), { origin: "https://greet-me.com/" });
  assert.equal(tid("fcc-public-link").textContent, "https://greet-me.com/rudy");
});

test("no slug means no link block at all", async () => {
  const a = api({ read: async (id) => ({ ok: true, status: 200, data: { ok: true, salesperson: { salespersonId: id, displayName: "Rudy", status: "active", referralSlug: "" } } }) });
  await open(a);
  assert.equal(tid("fcc-public-link"), null);
  assert.equal(tid("fcc-copy-share"), null);
});

// ══ copy ════════════════════════════════════════════════════════════════════════════════════
test("Copy link writes the EXACT displayed URL", async () => {
  let copied = null;
  globalThis.navigator = { clipboard: { writeText: async (t) => { copied = t; } } };
  await open(api());
  await click(tid("fcc-copy-share"));
  assert.equal(copied, "https://greet-me.com/rudy", "byte-for-byte what is on screen");
  assert.equal(tid("fcc-copy-share").textContent, "Copied");
  globalThis.navigator = window.navigator;
});

test("a denied clipboard leaves the URL visible and says so", async () => {
  globalThis.navigator = { clipboard: { writeText: async () => { throw new Error("denied"); } } };
  await open(api());
  await click(tid("fcc-copy-share"));
  assert.equal(tid("fcc-public-link").textContent, "https://greet-me.com/rudy", "still selectable on screen");
  assert.match(tid("fcc-message").textContent, /select the link above/i);
  globalThis.navigator = window.navigator;
});

// ══ server is the only source of truth ══════════════════════════════════════════════════════
test("replacement updates the link only AFTER the server confirms", async () => {
  const a = api();
  await open(a);
  setVal(tid("fcc-slug-input"), "rudy-2");
  await flush();
  assert.equal(tid("fcc-public-link").textContent, "https://greet-me.com/rudy",
    "typing alone changes nothing — the link still shows the confirmed slug");
  await click(tid("fcc-slug-save"));
  assert.equal(tid("fcc-public-link").textContent, "https://greet-me.com/rudy-2", "updated from the response");
});

test("removal hides the link only AFTER the server confirms", async () => {
  const a = api();
  await open(a);
  assert.ok(tid("fcc-public-link"));
  await click(tid("fcc-slug-remove"));
  assert.equal(tid("fcc-public-link"), null, "hidden once the server confirmed the removal");
});

test("a FAILED replacement preserves the last server-confirmed link", async () => {
  const a = api({ setReferralSlug: async () => ({ ok: false, status: 409, data: { ok: false, reason: "SLUG_TAKEN" } }) });
  await open(a);
  setVal(tid("fcc-slug-input"), "taken"); await flush();
  await click(tid("fcc-slug-save"));
  assert.equal(tid("fcc-public-link").textContent, "https://greet-me.com/rudy", "unchanged on failure");
  assert.match(tid("fcc-message").textContent, /already taken/i);
});

test("a FAILED removal preserves the link", async () => {
  const a = api({ removeReferralSlug: async () => ({ ok: false, status: 500, data: null }) });
  await open(a);
  await click(tid("fcc-slug-remove"));
  assert.ok(tid("fcc-public-link"), "still shown");
  assert.equal(tid("fcc-public-link").textContent, "https://greet-me.com/rudy");
});

// ══ security ════════════════════════════════════════════════════════════════════════════════
test("nothing is written to browser storage, and no opaque token appears", async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const a = api();
  await open(a);
  await click(tid("fcc-copy-share"));
  assert.equal(store.size, 0, "the reconstructed URL is never persisted");
  // A vanity link is public by nature; the opaque attribution token must not appear anywhere.
  assert.equal(/attributionToken|\/s\//.test(document.body.textContent), false, "no opaque token on the page");
  delete globalThis.localStorage;
});

test("the ordinary-user gate is untouched — zero requests", async () => {
  const a = api();
  await open(a, { user: ORDINARY, detail: false });
  assert.ok(tid("fcc-denied"));
  assert.equal(a.calls.length, 0);
  assert.equal(tid("fcc-public-link"), null);
});

test("the page neither persists the link nor reads a token", () => {
  const src = readFileSync(new URL("./SalespersonControlCenter.jsx", import.meta.url), "utf8");
  assert.equal(/localStorage\.setItem|sessionStorage\.setItem|document\.cookie/.test(src), false);
  assert.equal(/console\.(log|info|warn|error)\s*\(/.test(src), false);
  // The link is built from the slug, never from a token.
  assert.match(src, /function shareableLink\(/);
  assert.equal(/shareableLink\([^)]*token/i.test(src), false, "the token is never an input to the link");
});
