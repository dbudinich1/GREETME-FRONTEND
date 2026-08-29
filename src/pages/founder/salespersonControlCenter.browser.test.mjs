// src/pages/founder/salespersonControlCenter.browser.test.mjs
//
// TEAM B — SALES S1 · the rendered Founder Control Center (slice B1).
// The real page is bundled and mounted in jsdom with an injected client.
//
// Run (Node 20.x): node --test src/pages/founder/salespersonControlCenter.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__fcc.bundle.mjs");
const ENTRY = join(__dirname, ".__fcc.entry.jsx");
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
  globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Page } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

// The REAL predicate (utils/accountState.js): plan === "founder" || tier === "founder".
// An `isFounder: true` field is NOT what the app checks — using one here would have tested a
// gate the product does not have.
const FOUNDER = { userId: "u1", plan: "founder" };
const ORDINARY = { userId: "u2", plan: "unforgettable" };
const LINK = "https://greet-me.com/s/SECRET-TOKEN-XYZ";

function fakeApi(over = {}) {
  const calls = [];
  return {
    calls,
    list: async () => { calls.push(["list"]); return { ok: true, status: 200, data: { ok: true, salespeople: [{ salespersonId: "sp1", displayName: "Rep North" }] } }; },
    read: async (id) => { calls.push(["read", id]); return { ok: true, status: 200, data: { ok: true, salesperson: { salespersonId: id, displayName: "Rep North", email: "", status: "active", referralSlug: "" } } }; },
    create: async (b) => { calls.push(["create", b]); return { ok: true, status: 201, data: { ok: true, salesperson: { salespersonId: b.salespersonId }, attributionToken: "SECRET-TOKEN-XYZ", attributionLink: LINK } }; },
    ...over,
  };
}

let root, host;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
async function mount(props) {
  document.body.innerHTML = "";
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Page, props)); });
  await flush();
}
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const setVal = (el, v) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, v);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); }); await flush(); };
const submit = async () => { await act(async () => { tid("fcc-create-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); }); await flush(); };

// ══ ordinary-user exclusion ═════════════════════════════════════════════════════════════════
test("an ordinary user sees nothing and triggers ZERO requests", async () => {
  const api = fakeApi();
  await mount({ api, user: ORDINARY });
  assert.ok(tid("fcc-denied"), "the denial surface renders");
  assert.equal(tid("founder-control-center"), null, "the control center never mounts");
  assert.equal(api.calls.length, 0, "not one call is issued — it never even reaches a 403");
  for (const t of ["fcc-create-form", "fcc-create-submit", "fcc-issued-link"]) {
    assert.equal(tid(t), null, `${t} is absent`);
  }
});

test("a null / missing user is treated as ordinary", async () => {
  // The last case matters: a forged `isFounder` field must NOT open the surface.
  for (const user of [null, {}, { userId: "u3", plan: "free" }, { userId: "u4", isFounder: true }]) {
    const api = fakeApi();
    await mount({ api, user });
    assert.ok(tid("fcc-denied"));
    assert.equal(api.calls.length, 0);
  }
});

// ══ founder surface ═════════════════════════════════════════════════════════════════════════
test("the founder sees the control center and the list loads", async () => {
  const api = fakeApi();
  await mount({ api, user: FOUNDER });
  assert.ok(tid("founder-control-center"));
  assert.deepEqual(api.calls[0], ["list"]);
  assert.ok(tid("fcc-row-sp1"), "the salesperson is listed");
  assert.match(tid("fcc-row-sp1").textContent, /Rep North/);
});

test("selecting a salesperson reads its detail", async () => {
  const api = fakeApi();
  await mount({ api, user: FOUNDER });
  await click(tid("fcc-row-sp1"));
  assert.deepEqual(api.calls.at(-1), ["read", "sp1"]);
  assert.ok(tid("fcc-detail"));
  assert.equal(tid("fcc-detail-id").textContent, "sp1");
  assert.equal(tid("fcc-detail-status").textContent, "active");
});

test("create requires both identifiers and posts the trimmed body once", async () => {
  const api = fakeApi();
  await mount({ api, user: FOUNDER });
  assert.equal(tid("fcc-create-submit").disabled, true, "disabled until both fields are filled");

  setVal(tid("fcc-input-id"), "  sp2  ");
  await flush();
  assert.equal(tid("fcc-create-submit").disabled, true, "still disabled with only an id");
  setVal(tid("fcc-input-name"), "  Rep South  ");
  await flush();
  assert.equal(tid("fcc-create-submit").disabled, false);

  await submit();
  const created = api.calls.filter((c) => c[0] === "create");
  assert.equal(created.length, 1, "exactly one create");
  assert.equal(created[0][1].salespersonId, "sp2");
  assert.equal(created[0][1].displayName, "Rep South");
});

// ══ the one-time link ═══════════════════════════════════════════════════════════════════════
test("the attribution link is shown ONCE, labelled as such, and never persisted", async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const api = fakeApi();
  await mount({ api, user: FOUNDER });
  setVal(tid("fcc-input-id"), "sp2"); setVal(tid("fcc-input-name"), "Rep South");
  await flush(); await submit();

  const panel = tid("fcc-issued-link");
  assert.ok(panel, "the link panel appears");
  assert.equal(tid("fcc-issued-link-value").textContent, LINK);
  assert.match(panel.textContent, /shown once/i, "the reader is told it will not be shown again");

  // NOT PERSISTED anywhere the page controls.
  assert.equal(store.size, 0, "nothing written to storage");
  const raw = [...store.values()].join("|");
  assert.equal(raw.includes("SECRET-TOKEN-XYZ"), false);
  assert.equal(window.location.search.includes("SECRET"), false, "never placed in a query string");

  // Dismissing removes it from the DOM entirely.
  await click(tid("fcc-dismiss-link"));
  assert.equal(tid("fcc-issued-link"), null, "gone once acknowledged");
  assert.equal(document.body.textContent.includes("SECRET-TOKEN-XYZ"), false, "no residue on the page");
  delete globalThis.localStorage;
});

test("a REMOUNT (the refresh case) cannot reproduce the link", async () => {
  const api = fakeApi();
  await mount({ api, user: FOUNDER });
  setVal(tid("fcc-input-id"), "sp2"); setVal(tid("fcc-input-name"), "Rep South");
  await flush(); await submit();
  assert.ok(tid("fcc-issued-link"), "shown after create");

  await mount({ api, user: FOUNDER });          // fresh mount == refreshed page
  assert.equal(tid("fcc-issued-link"), null, "the link is gone after a refresh");
  assert.equal(document.body.textContent.includes("SECRET-TOKEN-XYZ"), false);
});

// ══ failure handling ════════════════════════════════════════════════════════════════════════
test("401 and 403 are reported in plain language, with no internal code", async () => {
  for (const [status, re] of [[401, /session has expired/i], [403, /founder account/i]]) {
    const api = fakeApi({ list: async () => ({ ok: false, status, data: { ok: false, code: "INTERNAL_ERROR" } }) });
    await mount({ api, user: FOUNDER });
    const msg = tid("fcc-message");
    assert.ok(msg, `a message for ${status}`);
    assert.match(msg.textContent, re);
    assert.equal(/INTERNAL_ERROR|NOT_FOUND|INVALID_REQUEST/.test(msg.textContent), false, "no raw code");
  }
});

test("a duplicate id surfaces the conflict and issues no second create", async () => {
  // Counted locally: overriding `create` replaces the recorded implementation, so the shared
  // `calls` array would never see it.
  let creates = 0;
  const api = fakeApi({ create: async () => { creates += 1; return { ok: false, status: 409, data: { ok: false, code: "INVALID_REQUEST" } }; } });
  await mount({ api, user: FOUNDER });
  setVal(tid("fcc-input-id"), "sp1"); setVal(tid("fcc-input-name"), "Dupe");
  await flush(); await submit();
  assert.match(tid("fcc-message").textContent, /already exists/i);
  assert.equal(tid("fcc-issued-link"), null, "no link is invented on failure");
  assert.equal(creates, 1, "exactly one create attempt");
});

// ══ source-level guarantees ═════════════════════════════════════════════════════════════════
test("the page never writes a token to browser storage", () => {
  const src = readFileSync(new URL("./SalespersonControlCenter.jsx", import.meta.url), "utf8");
  assert.equal(/localStorage\.setItem|sessionStorage\.setItem/.test(src), false,
    "no storage write of any kind in the page");
  assert.equal(/console\.(log|info|warn|error)\s*\(/.test(src), false, "no logging that could carry a token");
});
