// Founder User Guide: tile + page. Real components are bundled into jsdom with an injected api (no network).
// Proves: the top-level tile is reachable and its link resolves to a registered route; the page lists the 20 manifest files grouped by
// view and format (full + four areas); size/updated shown; Open/Download request a FRESH link per click; HTML opens in a new tab
// (about:blank tab, opener nulled, then pointed at the link; blocked => a target=_blank rel="noopener noreferrer" fallback link) and is
// never embedded (no iframe, no fetch-and-inject); no token ever appears in a URL; empty / not-configured / 403 / error+retry states.
// Run (Node 20.x): node --test src/pages/founder/commandCenter/userGuide.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync, readdirSync as __ls, rmSync as __rm } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
process.on("exit", () => { try { for (const n of __ls(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) __rm(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const ENTRY = join(__dirname, `.__ug.${process.pid}.jsx`);
const BUNDLE = join(__dirname, `.__ug.${process.pid}.bundle.mjs`);
let React, createRoot, act, window, M;

before(async () => {
  writeFileSync(ENTRY, [`export { default as Command } from "../FounderCentralCommand.jsx";`, `export { default as Page } from "./UserGuidePage.jsx";`].join("\n"));
  await esbuild.build({ entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser", jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty" }, external: ["react", "react-dom", "react-dom/client", "react-router-dom"], define: { "import.meta.env": "{}" } });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event;
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window = dom.window;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const flush = async () => { await act(async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); await flush(); };
async function mount(Comp, props) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  await act(async () => { createRoot(host).render(React.createElement(Comp, props)); });
  await flush();
}
const ok = (data) => Promise.resolve({ ok: true, status: 200, data });
const FOUNDER = { plan: "founder" };

const AREAS = ["full", "customer-app", "business-tools", "emails-recipient", "founder-command-center"];
function manifest({ configured = true, published = () => true } = {}) {
  const files = [];
  for (const view of ["desktop", "mobile"]) for (const area of AREAS) for (const format of ["pdf", "html"]) {
    const id = `${view}-${area}-${format}`; const a = configured && published(id);
    files.push({ id, title: id, area, areaLabel: area, view, format, contentType: format === "pdf" ? "application/pdf" : "text/html", available: a, sizeBytes: a ? 18234567 : null, updatedAt: a ? "2026-10-06T12:00:00.000Z" : null });
  }
  return { ok: true, configured, files };
}
function fakeApi({ list, fileUrl } = {}) {
  const calls = [];
  return {
    calls,
    list: () => { calls.push(["list"]); return list ? list() : ok(manifest()); },
    fileUrl: (id, disposition) => { calls.push(["fileUrl", id, disposition]); return fileUrl ? fileUrl(id, disposition) : ok({ ok: true, url: `https://acct.blob.core.windows.net/user-guide/${id}?sig=abc&se=2026`, expiresInSeconds: 300, filename: `greet-me-guide-${id}`, disposition }); },
  };
}
function fakeWindowOpen() {
  const opened = [];
  const fn = (url, target) => { const w = { url, target, opener: "app", closed: false, navigated: null, location: { replace(u) { w.navigated = u; } }, close() { w.closed = true; } }; opened.push(w); return w; };
  fn.opened = opened; return fn;
}

const APP = readFileSync(join(__dirname, "..", "..", "..", "App.jsx"), "utf8");
const ROUTES = [...APP.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]);

test("Central Command home: top-level User Guide tile beside Contacts; link resolves to a registered route", async () => {
  const props = { user: FOUNDER, qrCashApi: { qrCashPayoutSummary: () => ok({ ok: true, unresolvedCount: 0 }) }, fundraiserOverviewApi: { overview: () => ok({}), organizations: () => ok([]) }, salesApi: { list: () => ok({ salespeople: [] }) }, catalogApi: { listProviders: () => ok({ providers: [] }) }, contactsApi: { list: () => ok({ contacts: [], counts: { total: 1, followUpDue: 0 } }) }, userGuideApi: fakeApi({ list: () => ok(manifest({ published: (id) => id.startsWith("desktop-full")})) }) };
  await mount(M.Command, props);
  assert.ok(tid("fcc-card-contacts")); assert.ok(tid("fcc-card-user-guide"));
  assert.equal(tid("fcc-user-guide-count").textContent, "2 of 20");
  const href = tid("fcc-user-guide-open").getAttribute("href");
  assert.equal(href, "#/dashboard/founder/user-guide");
  assert.ok(ROUTES.includes("founder/user-guide"), "route registered");
  // not duplicated inside a hub view
  await mount(M.Command, { ...props, view: "sales" }); assert.equal(tid("fcc-card-user-guide"), null);
});

test("tile states: not published, 403 (no link), error keeps the link", async () => {
  const base = (userGuideApi) => ({ user: FOUNDER, qrCashApi: { qrCashPayoutSummary: () => ok({ ok: true, unresolvedCount: 0 }) }, fundraiserOverviewApi: { overview: () => ok({}), organizations: () => ok([]) }, salesApi: { list: () => ok({ salespeople: [] }) }, catalogApi: { listProviders: () => ok({ providers: [] }) }, contactsApi: { list: () => ok({ contacts: [], counts: { total: 0, followUpDue: 0 } }) }, userGuideApi });
  await mount(M.Command, base(fakeApi({ list: () => ok(manifest({ configured: false })) })));
  assert.match(tid("fcc-user-guide-empty").textContent, /Guides are not published yet/); assert.ok(tid("fcc-user-guide-open"));
  await mount(M.Command, base(fakeApi({ list: () => Promise.resolve({ ok: false, status: 403, data: null }) })));
  assert.match(tid("fcc-user-guide-unavailable").textContent, /not available on this account/); assert.equal(tid("fcc-user-guide-open"), null);
  await mount(M.Command, base(fakeApi({ list: () => Promise.resolve({ ok: false, status: 500, data: null }) })));
  assert.ok(tid("fcc-user-guide-open")); assert.equal(tid("fcc-user-guide-count"), null);
});

test("page lists all 20 files grouped by view, area and format, with size and updated; breadcrumb back", async () => {
  await mount(M.Page, { user: FOUNDER, api: fakeApi(), windowOpen: fakeWindowOpen() });
  assert.ok(tid("ug-view-desktop") && tid("ug-view-mobile"));
  for (const v of ["desktop", "mobile"]) for (const a of AREAS) for (const f of ["pdf", "html"]) assert.ok(tid(`ug-cell-${v}-${a}-${f}`), `${v}/${a}/${f}`);
  assert.equal(document.querySelectorAll('[data-testid^="ug-open-"]').length, 20);
  assert.equal(document.querySelectorAll('[data-testid^="ug-download-"]').length, 20);
  assert.match(tid("ug-meta-desktop-full-pdf").textContent, /17 MB, updated 2026-10-06/);
  assert.match(document.body.textContent, /Full set/); assert.match(document.body.textContent, /Business, corporate and fundraiser tools/); assert.match(document.body.textContent, /Emails and recipient experience/);
  assert.equal(tid("cc-back-command").getAttribute("href"), "#/dashboard/founder/command");
  assert.equal(document.querySelector("iframe"), null, "never embedded");
});

test("partially published: unpublished files say so and have no actions", async () => {
  await mount(M.Page, { user: FOUNDER, api: fakeApi({ list: () => ok(manifest({ published: (id) => id === "desktop-full-pdf" })) }), windowOpen: fakeWindowOpen() });
  assert.ok(tid("ug-open-desktop-full-pdf")); assert.equal(tid("ug-open-desktop-full-html"), null);
  assert.match(tid("ug-na-desktop-full-html").textContent, /Not published yet/);
});

test("HTML Open: fresh link per click, new tab, opener nulled, never embedded; token never in a URL", async () => {
  localStorage_set("tok-SECRET-123");
  const api = fakeApi(); const wo = fakeWindowOpen();
  await mount(M.Page, { user: FOUNDER, api, windowOpen: wo });
  await click(tid("ug-open-desktop-full-html"));
  assert.equal(wo.opened.length, 1); const w = wo.opened[0];
  assert.equal(w.target, "_blank"); assert.equal(w.opener, null, "opener cut so the guide cannot reach the app");
  assert.equal(w.url, "about:blank", "the tab is opened inside the click, before the async link request");
  assert.match(w.navigated, /^https:\/\/acct\.blob\.core\.windows\.net\/user-guide\/desktop-full-html\?/);
  assert.deepEqual(api.calls.filter((c) => c[0] === "fileUrl"), [["fileUrl", "desktop-full-html", "inline"]]);
  await click(tid("ug-open-desktop-full-html"));
  assert.equal(api.calls.filter((c) => c[0] === "fileUrl").length, 2, "a fresh link is requested on every click");
  assert.equal(document.querySelector("iframe"), null);
  for (const u of [w.url, w.navigated, ...[...document.querySelectorAll("a")].map((a) => a.getAttribute("href") || "")]) assert.doesNotMatch(u, /tok-SECRET-123|token=|access_token|Bearer/i);
  for (const c of api.calls) assert.doesNotMatch(JSON.stringify(c), /tok-SECRET-123/);
});

test("popup blocked: a target=_blank rel=noopener noreferrer fallback link is offered", async () => {
  const api = fakeApi();
  await mount(M.Page, { user: FOUNDER, api, windowOpen: () => null });
  await click(tid("ug-open-mobile-customer-app-html"));
  const a = tid("ug-fallback-link-mobile-customer-app-html");
  assert.ok(a); assert.equal(a.getAttribute("target"), "_blank"); assert.equal(a.getAttribute("rel"), "noopener noreferrer");
  assert.match(a.getAttribute("href"), /^https:\/\//);
});

test("Download asks for an attachment link and clicks a noopener anchor without leaving the page", async () => {
  const api = fakeApi(); const clicked = [];
  const orig = window.HTMLAnchorElement.prototype.click;
  window.HTMLAnchorElement.prototype.click = function () { clicked.push({ href: this.href, rel: this.rel, download: this.download }); };
  try {
    await mount(M.Page, { user: FOUNDER, api, windowOpen: fakeWindowOpen() });
    await click(tid("ug-download-desktop-full-pdf"));
  } finally { window.HTMLAnchorElement.prototype.click = orig; }
  assert.deepEqual(api.calls.filter((c) => c[0] === "fileUrl"), [["fileUrl", "desktop-full-pdf", "attachment"]]);
  assert.equal(clicked.length, 1); assert.match(clicked[0].href, /^https:\/\/acct\.blob/); assert.equal(clicked[0].rel, "noopener noreferrer");
  assert.equal(window.location.href, "https://app.test/", "this page did not navigate");
});

test("link request failures show a plain message and close the blank tab", async () => {
  for (const [status, re] of [[404, /not published yet/], [409, /not set up yet/], [429, /Too many requests/], [503, /temporarily unavailable/], [403, /not available on this account/]]) {
    const wo = fakeWindowOpen();
    await mount(M.Page, { user: FOUNDER, api: fakeApi({ fileUrl: () => Promise.resolve({ ok: false, status, data: { ok: false, code: "X_CODE" } }) }), windowOpen: wo });
    await click(tid("ug-open-desktop-full-html"));
    assert.match(tid("ug-message").textContent, re, String(status)); assert.doesNotMatch(tid("ug-message").textContent, /X_CODE/);
    assert.equal(wo.opened[0].closed, true, "no stray blank tab");
  }
  const wo = fakeWindowOpen();
  await mount(M.Page, { user: FOUNDER, api: fakeApi({ fileUrl: () => ok({ ok: true, url: "http://insecure.example/x" }) }), windowOpen: wo });
  await click(tid("ug-open-desktop-full-html")); assert.equal(wo.opened[0].navigated, null, "a non-https link is never opened"); assert.equal(wo.opened[0].closed, true);
});

test("states: empty, not configured, 403, error with retry, loading; non-founder makes no request", async () => {
  await mount(M.Page, { user: FOUNDER, api: fakeApi({ list: () => ok(manifest({ published: () => false })) }) });
  assert.match(tid("ug-empty").textContent, /Guides are not published yet/); assert.equal(tid("ug-groups"), null);
  await mount(M.Page, { user: FOUNDER, api: fakeApi({ list: () => ok(manifest({ configured: false })) }) });
  assert.match(tid("ug-empty").textContent, /not set up yet/);
  await mount(M.Page, { user: FOUNDER, api: fakeApi({ list: () => Promise.resolve({ ok: false, status: 403, data: null }) }) });
  assert.match(tid("ug-error").textContent, /not available on this account/); assert.equal(tid("ug-retry"), null);
  let n = 0;
  const flaky = fakeApi({ list: () => (++n === 1 ? Promise.resolve({ ok: false, status: 500, data: null }) : ok(manifest())) });
  await mount(M.Page, { user: FOUNDER, api: flaky });
  assert.ok(tid("ug-error")); await click(tid("ug-retry")); assert.ok(tid("ug-groups"), "retry loads the list");
  await mount(M.Page, { user: FOUNDER, api: fakeApi({ list: () => new Promise(() => {}) }) });
  assert.ok(tid("ug-loading"));
  const denied = fakeApi(); await mount(M.Page, { user: { plan: "free" }, api: denied });
  assert.ok(tid("ug-denied")); assert.equal(denied.calls.length, 0);
});

test("no dead clicks: every in-app link on the tile page and the User Guide page resolves; actions are buttons only", async () => {
  await mount(M.Page, { user: FOUNDER, api: fakeApi() });
  for (const a of document.querySelectorAll('a[href^="#/"]')) {
    const p = a.getAttribute("href").replace(/^#\/dashboard\//, "");
    assert.ok(ROUTES.some((r) => new RegExp(`^${r.replace(/:[^/]+/g, "[^/]+")}$`).test(p)), a.getAttribute("href"));
  }
  for (const b of document.querySelectorAll("button")) assert.doesNotMatch(b.textContent, /approve|\bpay\b|delete|upload/i);
});

function localStorage_set(v) { try { window.localStorage.setItem("token", v); } catch { /* ignore */ } }
