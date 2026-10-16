// partnerCampaigns.browser.test.mjs — Report 87 A7: the partner screens built from the approved rev 6 layout.
//
// RENDERED coverage: the REAL PartnerFundraisingDashboard (and the REAL ParticipantQrCode) is esbuild-
// transformed and mounted in jsdom with the REAL fundraiserApi client over a controllable global fetch. Only
// react-router-dom (useParams) and the flag gate are stubbed.
//
// Run under the supported runtime (engines: node 20.x):
//   node --test src/pages/fundraiser/partnerCampaigns.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readdirSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
process.on("exit", () => { try { for (const n of readdirSync(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) rmSync(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const BUNDLE = join(__dirname, `.__partnerp1.${process.pid}.bundle.mjs`);
let React, createRoot, act, Partner, window;

before(async () => {
  const map = [
    [/^react-router-dom$/, "export const useParams = () => ({ organizationId: globalThis.__org });", "rr"],
    [/fundraiserGate\.js$/, "export const isFundraiserUiEnabled = () => !!globalThis.__flag;", "gate"],
  ];
  const stub = { name: "stub", setup(b) {
    for (const [filter, contents, ns] of map) {
      b.onResolve({ filter }, (a) => ({ path: a.path, namespace: ns }));
      b.onLoad({ filter: /.*/, namespace: ns }, () => ({ contents, loader: "js" }));
    }
  } };
  const entry = join(__dirname, `.__partnerp1.${process.pid}.jsx`);
  writeFileSync(entry, `export { default as Partner } from "./PartnerFundraisingDashboard.jsx";\n`);
  await esbuild.build({
    entryPoints: [entry], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "qrcode"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, plugins: [stub], logLevel: "silent",
  });
  rmSync(entry, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  try { globalThis.navigator = window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.HTMLElement = window.HTMLElement; globalThis.Event = window.Event; globalThis.MouseEvent = window.MouseEvent;
  globalThis.localStorage = window.localStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Partner } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

const P = "/api/fundraiser/partner";
const CAMPAIGNS = [
  { campaignId: "cmp_1", organizationId: "org_1", title: "Fall Drive", status: "active", goalCents: 250000 },
  { campaignId: "cmp_2", organizationId: "org_1", title: "Spring Drive", status: "draft", goalCents: null },
];
const ROWS = [
  { participantId: "m1", attributionId: "a1", campaignId: "cmp_1", displayName: "Ava M.", referralCode: "AVA-1", status: "active", visits: 4, scans: 2, conversions: 1 },
  { participantId: "m2", attributionId: "a2", campaignId: "cmp_1", displayName: "Ben T.", referralCode: "BEN-2", status: "removed", visits: 1, scans: 0, conversions: 0 },
];
const YEAR_TERMS = { versionId: "ev1", kind: "year_rates", basis: "ENSR", yearRates: { year_1: 20, year_2: 15, year_3_plus: 10 }, activatedAt: "2026-11-01T00:00:00.000Z" };

let calls = [];
function installFetch(fn) {
  calls = [];
  globalThis.fetch = (url, opts = {}) => {
    const u = new URL(String(url), "http://x");
    const method = opts.method || "GET";
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ path: u.pathname, search: u.search, method, body });
    const r = fn(method, u.pathname, u.searchParams, body) || { status: 404, data: {} };
    return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.data });
  };
}
function routes(over = {}) {
  return (m, p, q, b) => {
    if (over.handle) { const r = over.handle(m, p, q, b); if (r) return r; }
    if (m === "GET" && p === `${P}/orgs`) return { status: 200, data: { organizations: [{ organizationId: "org_1", name: "Hillcrest Boosters", status: "approved" }] } };
    if (m === "GET" && p === `${P}/orgs/org_1/overview`) {
      const cid = q.get("campaignId");
      const rows = cid ? ROWS.filter((r) => r.campaignId === cid) : ROWS;
      return { status: 200, data: { dashboard: "partner_admin", organizationStatus: "approved", campaigns: CAMPAIGNS, participants: rows, totals: cid === "cmp_2" ? { visits: 0, scans: 0, conversions: 0 } : { visits: 5, scans: 2, conversions: 1 } } };
    }
    if (m === "GET" && p === `${P}/orgs/org_1/campaigns`) return { status: 200, data: over.campaigns || CAMPAIGNS };
    if (m === "GET" && p === `${P}/orgs/org_1/terms`) return { status: 200, data: { terms: over.terms === undefined ? YEAR_TERMS : over.terms } };
    if (m === "GET" && /\/participants\/m1\/links$/.test(p)) return { status: 200, data: { attributionId: "a1", referralCode: "AVA-1", referralLink: "https://greet-me.com/#/f/ftk_real", qrPayload: "https://greet-me.com/#/f/ftk_real", tokenVersion: 1, status: "active" } };
    if (m === "POST") return { status: 201, data: { ok: true } };
    return null;
  };
}

const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const text = () => document.body.textContent;
async function click(el) { assert.ok(el, "element to click exists"); await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await settle(); }
async function setValue(el, value) {
  assert.ok(el, "input exists");
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  await act(async () => { el.dispatchEvent(new window.Event("input", { bubbles: true })); });
}
async function submit(form) { await act(async () => { form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); }); await settle(); }
let root = null;
async function mount(fn, { flag = true, org = "org_1" } = {}) {
  if (root) { await act(async () => root.unmount()); root = null; }
  installFetch(fn); globalThis.__flag = flag; globalThis.__org = org;
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Partner)); });
  await settle();
}
const posts = () => calls.filter((c) => c.method === "POST");
function assertNoSampleContent() {
  assert.equal(document.querySelector("[data-tag]"), null, "no review change tags");
  for (const s of ["SAMPLE", "Sample", "Works today", "Needs engineering", "Financial engineering", "Permission:", "Layout:"]) {
    assert.ok(!text().includes(s), `product text must not contain "${s}"`);
  }
}

test("gate off ⇒ dormant and zero requests", async () => {
  await mount(routes(), { flag: false });
  assert.equal(calls.length, 0);
  assert.match(text(), /Fundraising is not currently enabled/);
});

test("403 from the server ⇒ truthful no-access state (access control unchanged)", async () => {
  await mount((m, p) => (p.endsWith("/overview") ? { status: 403, data: {} } : null));
  assert.match(text(), /No access/);
  assert.equal(posts().length, 0);
});

test("home: organization name, real counts, understated read-only agreement line, campaign cards", async () => {
  await mount(routes());
  assert.match(document.querySelector("h1").textContent, /Hillcrest Boosters/);
  assert.match(text(), /Fundraising · Partner administrator/);
  assert.match($("agreement").textContent, /Your agreement: Year 1 20% · Year 2 15% · Year 3\+ 10% of qualifying purchases from supporters who join through your links\./);
  assert.equal($("agreement-details"), null);
  await click($("agreement-toggle"));
  assert.match($("agreement-details").textContent, /To change anything in your agreement, contact Greet-Me\./);
  const cards = $("partner-campaigns").textContent;
  assert.match(cards, /Fall Drive.*Active.*1 participants · 1 supporters · goal \$2,500\.00/);
  assert.match(cards, /Spring Drive.*Draft.*0 participants · 0 supporters/);
  assert.ok(!/Ben T\./.test(text()), "removed participants are not shown");
  assertNoSampleContent();
  assert.ok(!document.querySelector("input[placeholder='Campaign ID']"), "a campaign ID is never typed");
});

test("terms not set ⇒ truthful agreement line", async () => {
  await mount(routes({ terms: null }));
  assert.match($("agreement").textContent, /your partner share hasn’t been set yet/);
});

test("empty: no campaigns yet", async () => {
  await mount(routes({ campaigns: [] }));
  assert.match($("partner-campaigns").textContent, /No campaigns yet\./);
});

test("new campaign: validation, then POST with title and goal in cents; created as a draft", async () => {
  await mount(routes());
  await click($("new-campaign-btn"));
  await submit($("new-campaign"));
  assert.match(text(), /Enter a campaign name\./);
  await setValue($("nc-title"), "Winter Drive");
  await setValue($("nc-goal"), "$1,200.50");
  await submit($("new-campaign"));
  const p = posts().find((c) => c.path === `${P}/orgs/org_1/campaigns`);
  assert.deepEqual(p.body, { title: "Winter Drive", goalCents: 120050 });
  assert.match($("created").textContent, /“Winter Drive” was created as a draft\./);
});

test("new campaign created without terms (termsIssue) ⇒ the notice says it can't start yet", async () => {
  await mount(routes({ handle: (m, p) => (m === "POST" && p.endsWith("/campaigns") ? { status: 201, data: { campaignId: "cmp_9", termsIssue: { code: "NO_ORG_TERMS" } } } : null) }));
  await click($("new-campaign-btn"));
  await setValue($("nc-title"), "Winter Drive");
  await submit($("new-campaign"));
  assert.match($("created").textContent, /“Winter Drive” was created as a draft\. It can’t start until your partner share is in place; contact Greet-Me\./);
});

test("new campaign refused (ORG_NOT_ACTIVE) ⇒ plain message, no code shown", async () => {
  await mount(routes({ handle: (m, p) => (m === "POST" && p.endsWith("/campaigns") ? { status: 409, data: { code: "ORG_NOT_ACTIVE" } } : null) }));
  await click($("new-campaign-btn"));
  await setValue($("nc-title"), "X");
  await submit($("new-campaign"));
  assert.match($("nc-error").textContent, /isn’t active/);
  assert.ok(!text().includes("ORG_NOT_ACTIVE"));
});

test("draft campaign: Start posts { status: active }; TERMS_NOT_ACTIVE is explained", async () => {
  await mount(routes({ handle: (m, p) => (m === "POST" && p.endsWith("/cmp_2/status") ? { status: 409, data: { code: "TERMS_NOT_ACTIVE" } } : null) }));
  await click($("manage-cmp_2"));
  assert.match($("campaign-page").textContent, /Goal: none set/);
  await click($("status-active"));
  assert.deepEqual(posts().find((c) => c.path === `${P}/orgs/org_1/campaigns/cmp_2/status`).body, { status: "active" });
  assert.match($("campaign-error").textContent, /can’t go ahead until the partner share is in place/);
});

test("active campaign: Pause posts; Close needs confirmation and Keep it open sends nothing", async () => {
  await mount(routes());
  await click($("manage-cmp_1"));
  await click($("status-paused"));
  assert.deepEqual(posts().at(-1).body, { status: "paused" });
  const before = posts().length;
  await click($("status-close"));
  assert.match($("close-confirm").textContent, /A closed campaign can’t be reopened/);
  await click([...document.querySelectorAll("button")].find((b) => b.textContent === "Keep it open"));
  assert.equal(posts().length, before);
  await click($("status-close")); await click($("close-yes"));
  assert.deepEqual(posts().at(-1).body, { status: "closed" });
});

test("participants inside the campaign: add, paste, Link and QR from the server", async () => {
  await mount(routes());
  await click($("manage-cmp_1"));
  assert.match($("participants").textContent, /Ava M\..*4 visits · 2 scans · 1 supporters/);
  await setValue($("p-name"), "Cara L.");
  await submit($("p-name").closest("form"));
  assert.deepEqual(posts().find((c) => c.path === `${P}/orgs/org_1/participants`).body, { campaignId: "cmp_1", displayName: "Cara L." });
  await setValue($("p-bulk"), "Dee\n\nEli \n");
  await submit($("p-bulk").closest("form"));
  assert.deepEqual(posts().find((c) => c.path === `${P}/orgs/org_1/participants/import`).body, { campaignId: "cmp_1", rows: [{ displayName: "Dee" }, { displayName: "Eli" }] });
  await click($("qr-m1"));
  assert.ok(calls.some((c) => c.method === "GET" && c.path === `${P}/orgs/org_1/participants/m1/links`));
  assert.match($("participant-link").textContent, /https:\/\/greet-me\.com\/#\/f\/ftk_real/);
  assertNoSampleContent();
});

test("no pay or payout control on the partner screens", async () => {
  await mount(routes());
  const scan = () => [...document.querySelectorAll("button")].map((b) => b.textContent).filter((t) => /pay/i.test(t));
  assert.deepEqual(scan(), []);
  await click($("manage-cmp_1"));
  assert.deepEqual(scan(), []);
});
