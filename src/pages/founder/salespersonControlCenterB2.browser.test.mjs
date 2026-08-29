// src/pages/founder/salespersonControlCenterB2.browser.test.mjs
//
// TEAM B — SALES S1 · B2: vanity alias, token rotation, disable / reactivate.
// The real page, bundled and mounted in jsdom with an injected client.
//
// Run (Node 20.x): node --test src/pages/founder/salespersonControlCenterB2.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__b2.bundle.mjs");
const ENTRY = join(__dirname, ".__b2.entry.jsx");
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
const ROTATED = "https://greet-me.com/s/NEW-ROTATED-TOKEN";

function api(over = {}) {
  const calls = [];
  const base = {
    calls,
    list: async () => { calls.push(["list"]); return { ok: true, status: 200, data: { ok: true, salespeople: [{ salespersonId: "sp1", displayName: "Rep North" }] } }; },
    read: async (id) => { calls.push(["read", id]); return { ok: true, status: 200, data: { ok: true, salesperson: { salespersonId: id, displayName: "Rep North", email: "", status: "active", referralSlug: "" } } }; },
    create: async () => ({ ok: true, status: 201, data: { ok: true } }),
    setReferralSlug: async (id, slug) => { calls.push(["setReferralSlug", id, slug]); return { ok: true, status: 200, data: { ok: true, salesperson: { salespersonId: id, displayName: "Rep North", status: "active", referralSlug: slug }, publicReferralLink: `https://greet-me.com/r/${slug}` } }; },
    removeReferralSlug: async (id) => { calls.push(["removeReferralSlug", id]); return { ok: true, status: 200, data: { ok: true, salesperson: { salespersonId: id, displayName: "Rep North", status: "active", referralSlug: "" }, publicReferralLink: null } }; },
    rotateToken: async (id) => { calls.push(["rotateToken", id]); return { ok: true, status: 200, data: { ok: true, salesperson: { salespersonId: id, displayName: "Rep North", status: "active", referralSlug: "" }, attributionToken: "NEW-ROTATED-TOKEN", attributionLink: ROTATED } }; },
    setStatus: async (id, status) => { calls.push(["setStatus", id, status]); return { ok: true, status: 200, data: { ok: true, salesperson: { salespersonId: id, displayName: "Rep North", status, referralSlug: "" } } }; },
  };
  return { ...base, ...over, calls };
}

let root;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
async function open(a, detail = true) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Page, { api: a, user: FOUNDER })); });
  await flush();
  if (detail) { await click(tid("fcc-row-sp1")); }
}
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); }); await flush(); };
const setVal = (el, v) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, v);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const writes = (a) => a.calls.filter((c) => ["setReferralSlug", "removeReferralSlug", "rotateToken", "setStatus"].includes(c[0]));

// ══ vanity alias ════════════════════════════════════════════════════════════════════════════
test("assigning a vanity URL sends the trimmed slug and shows the public link", async () => {
  const a = api();
  await open(a);
  setVal(tid("fcc-slug-input"), "  rep-north  ");
  await flush();
  await click(tid("fcc-slug-save"));
  assert.deepEqual(a.calls.find((c) => c[0] === "setReferralSlug"), ["setReferralSlug", "sp1", "  rep-north  "],
    "the page passes the raw value; the client trims it");
  // CONTRACT CORRECTION: the displayed link is reconstructed from the CURRENT ORIGIN plus the
  // NORMALIZED stored slug — one source of truth. The old expectation echoed the API's
  // publicReferralLink verbatim, which is why it carried literal spaces from the untrimmed input.
  assert.equal(tid("fcc-public-link").textContent, "http://localhost/rep-north",
    "origin + normalized slug, not the API echo");
});

test("replacing an existing slug offers Replace, and removal is a separate explicit action", async () => {
  const a = api({ read: async (id) => ({ ok: true, status: 200, data: { ok: true, salesperson: { salespersonId: id, displayName: "Rep North", status: "active", referralSlug: "old-slug" } , publicReferralLink: "https://greet-me.com/r/old-slug" } }) });
  await open(a);
  assert.equal(tid("fcc-slug-save").textContent, "Replace", "labelled Replace when one already exists");
  assert.ok(tid("fcc-slug-remove"), "Remove is offered separately");

  await click(tid("fcc-slug-remove"));
  assert.deepEqual(a.calls.find((c) => c[0] === "removeReferralSlug"), ["removeReferralSlug", "sp1"]);
  assert.equal(tid("fcc-public-link"), null, "the public link disappears once removed");
});

test("the vanity section states that the opaque link is separate", async () => {
  await open(api());
  const section = tid("fcc-detail").textContent;
  assert.match(section, /opaque attribution link is separate/i);
});

test("a taken or reserved slug is reported truthfully, with no raw code", async () => {
  for (const [reason, re] of [["SLUG_TAKEN", /already taken/i], ["slug_reserved", /reserved/i]]) {
    const a = api({ setReferralSlug: async () => ({ ok: false, status: 409, data: { ok: false, code: "INVALID_REQUEST", reason } }) });
    await open(a);
    setVal(tid("fcc-slug-input"), "taken"); await flush();
    await click(tid("fcc-slug-save"));
    assert.match(tid("fcc-message").textContent, re);
    assert.equal(/INVALID_REQUEST|slug_/.test(tid("fcc-message").textContent), false, "no machine code shown");
  }
});

test("a malformed slug is rejected in plain language", async () => {
  const a = api({ setReferralSlug: async () => ({ ok: false, status: 400, data: { ok: false, code: "INVALID_REQUEST", reason: "slug_invalid_characters" } }) });
  await open(a);
  setVal(tid("fcc-slug-input"), "bad slug!"); await flush();
  await click(tid("fcc-slug-save"));
  assert.match(tid("fcc-message").textContent, /isn’t valid|letters, numbers and hyphens/i);
  assert.equal(/slug_invalid_characters/.test(document.body.textContent), false);
});

test("an empty slug cannot be submitted as an assignment", async () => {
  await open(api());
  assert.equal(tid("fcc-slug-save").disabled, true, "Assign is disabled while the field is empty");
});

// ══ rotation ════════════════════════════════════════════════════════════════════════════════
test("rotation requires confirmation, warns that the old link dies, and can be cancelled", async () => {
  const a = api();
  await open(a);
  await click(tid("fcc-rotate"));
  const dlg = tid("fcc-confirm");
  assert.ok(dlg, "a confirmation dialog opens");
  assert.equal(dlg.getAttribute("role"), "dialog");
  assert.equal(dlg.getAttribute("aria-modal"), "true");
  assert.match(dlg.textContent, /Rep North/, "the dialog names the salesperson");
  assert.match(tid("fcc-confirm-body").textContent, /stops working immediately|cannot be recovered/i,
    "the destructive consequence is stated");
  assert.equal(writes(a).length, 0, "nothing has been requested yet");

  await click(tid("fcc-confirm-cancel"));
  assert.equal(tid("fcc-confirm"), null, "dismissed");
  assert.equal(writes(a).length, 0, "cancelling issues ZERO requests");
});

test("Escape dismisses the confirmation without any request", async () => {
  const a = api();
  await open(a);
  await click(tid("fcc-rotate"));
  await act(async () => { tid("fcc-confirm").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  await flush();
  assert.equal(tid("fcc-confirm"), null);
  assert.equal(writes(a).length, 0);
});

test("confirmed rotation shows the replacement link ONCE and never persists it", async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const a = api();
  await open(a);
  await click(tid("fcc-rotate"));
  await click(tid("fcc-confirm-go"));

  assert.deepEqual(a.calls.find((c) => c[0] === "rotateToken"), ["rotateToken", "sp1"]);
  const panel = tid("fcc-issued-link");
  assert.ok(panel, "the replacement link is shown");
  assert.equal(tid("fcc-issued-link-value").textContent, ROTATED);
  assert.match(panel.textContent, /previous link is now invalid/i, "and the old one is declared dead");

  assert.equal(store.size, 0, "nothing written to storage");
  assert.equal(window.location.search.includes("NEW-ROTATED"), false, "never in a URL");

  await click(tid("fcc-dismiss-link"));
  assert.equal(tid("fcc-issued-link"), null);
  assert.equal(document.body.textContent.includes("NEW-ROTATED-TOKEN"), false, "no residue after dismissal");
  delete globalThis.localStorage;
});

test("a REMOUNT cannot reproduce a rotated link", async () => {
  const a = api();
  await open(a);
  await click(tid("fcc-rotate"));
  await click(tid("fcc-confirm-go"));
  assert.ok(tid("fcc-issued-link"));
  await open(a);                                   // refreshed page
  assert.equal(tid("fcc-issued-link"), null);
  assert.equal(document.body.textContent.includes("NEW-ROTATED-TOKEN"), false);
});

// ══ disable / reactivate ════════════════════════════════════════════════════════════════════
test("disable confirms first, then adopts the SERVER status — never optimistically", async () => {
  const a = api();
  await open(a);
  await click(tid("fcc-disable"));
  assert.match(tid("fcc-confirm-body").textContent, /New attribution stops/i);
  assert.equal(writes(a).length, 0, "no write before confirmation");
  assert.equal(tid("fcc-detail-status").textContent, "active", "status unchanged while pending");

  await click(tid("fcc-confirm-go"));
  assert.deepEqual(a.calls.find((c) => c[0] === "setStatus"), ["setStatus", "sp1", "inactive"]);
  assert.equal(tid("fcc-detail-status").textContent, "inactive", "adopted from the response");
  assert.ok(tid("fcc-reactivate"), "the action flips to Reactivate");
});

test("cancelling disable changes nothing", async () => {
  const a = api();
  await open(a);
  await click(tid("fcc-disable"));
  await click(tid("fcc-confirm-cancel"));
  assert.equal(writes(a).length, 0);
  assert.equal(tid("fcc-detail-status").textContent, "active");
});

test("reactivate confirms and sends active", async () => {
  const a = api({ read: async (id) => ({ ok: true, status: 200, data: { ok: true, salesperson: { salespersonId: id, displayName: "Rep North", status: "inactive", referralSlug: "" } } }) });
  await open(a);
  assert.ok(tid("fcc-reactivate"));
  await click(tid("fcc-reactivate"));
  assert.match(tid("fcc-confirm-body").textContent, /resumes/i);
  await click(tid("fcc-confirm-go"));
  assert.deepEqual(a.calls.find((c) => c[0] === "setStatus"), ["setStatus", "sp1", "active"]);
});

test("a failed status change leaves the prior status and reports plainly", async () => {
  const a = api({ setStatus: async () => ({ ok: false, status: 403, data: { ok: false, code: "INTERNAL_ERROR" } }) });
  await open(a);
  await click(tid("fcc-disable"));
  await click(tid("fcc-confirm-go"));
  assert.equal(tid("fcc-detail-status").textContent, "active", "status is NOT changed on failure");
  assert.match(tid("fcc-message").textContent, /founder account/i);
  assert.equal(/INTERNAL_ERROR/.test(document.body.textContent), false);
});

test("401 and network failure fail closed with plain language", async () => {
  for (const [res, re] of [
    [{ ok: false, status: 401, data: null }, /session has expired/i],
    [{ ok: false, status: 0, data: null, networkError: true }, /couldn.t reach the server/i],
  ]) {
    const a = api({ rotateToken: async () => res });
    await open(a);
    await click(tid("fcc-rotate"));
    await click(tid("fcc-confirm-go"));
    assert.match(tid("fcc-message").textContent, re);
    assert.equal(tid("fcc-issued-link"), null, "no link is invented on failure");
  }
});

// ══ source guarantees ═══════════════════════════════════════════════════════════════════════
test("the page never persists or logs a token, and never requests a historical one", () => {
  const src = readFileSync(new URL("./SalespersonControlCenter.jsx", import.meta.url), "utf8");
  assert.equal(/localStorage\.setItem|sessionStorage\.setItem/.test(src), false);
  assert.equal(/console\.(log|info|warn|error)\s*\(/.test(src), false);
  const client = readFileSync(new URL("../../api/salesAdmin.js", import.meta.url), "utf8");
  // There is no endpoint that returns an existing token, and the client must not invent one.
  assert.equal(/getToken\s*:|readToken|fetchToken|attributionToken\s*:/.test(client), false,
    "no call that would retrieve a historical token");
});
