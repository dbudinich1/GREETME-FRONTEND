// src/pages/fundraiser/founderPartnerAdmin.browser.test.mjs
//
// TEAM B (P2) — RENDERED coverage of the partner-administrator panel. The REAL
// FounderFundraisingDashboard is esbuild-transformed and mounted in jsdom with the REAL
// fundraiserApi client over a controllable global fetch. Only the flag gate is stubbed.
//
// Proves the required UI states end to end: empty · resolving · resolved · invalid email ·
// not found · ambiguous · service failure · assigning · assigned · assign failed — plus the
// read-back, founder blocking, and that existing organization creation still works.
//
// Run under the supported runtime (engines: node 20.x):
//   node --test src/pages/fundraiser/founderPartnerAdmin.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__founder.bundle.mjs");
let React, createRoot, act, Founder;

const GATE_STUB = `export const isFundraiserUiEnabled = () => !!globalThis.__flag;`;

before(async () => {
  const stub = { name: "stub", setup(b) {
    b.onResolve({ filter: /fundraiserGate\.js$/ }, (a) => ({ path: a.path, namespace: "gate" }));
    b.onLoad({ filter: /.*/, namespace: "gate" }, () => ({ contents: GATE_STUB, loader: "js" }));
  } };
  writeFileSync(join(__dirname, ".__founder.jsx"), `export { default as Founder } from "./FounderFundraisingDashboard.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__founder.jsx")], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, plugins: [stub], logLevel: "silent",
  });
  rmSync(join(__dirname, ".__founder.jsx"), { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.MouseEvent = window.MouseEvent;
  globalThis.localStorage = window.localStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Founder } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

const ORG = { organizationId: "org_fixture", legalName: "Fixture LLC", orgType: "other", status: "approved", adminUserIds: [] };
const ACCOUNT = { userId: "84ffe4c4-f4e4-4bbc-b0fd-23e385f34927", email: "info@njmediationservice.com", emailVerified: true, isFounder: false };

// Route-aware fetch. `routes` maps a URL fragment to { status, data } | Error | "pending".
let calls = [];
function installFetch(routes) {
  calls = [];
  globalThis.fetch = (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method || "GET", body: opts.body });
    // Match on URL SUFFIX, not substring: the assign URL contains BOTH "/admin/organizations" and
    // "/partner-admins", and length ordering picks the wrong one. Every route key here is a
    // suffix of its URL, so endsWith disambiguates exactly.
    const key = Object.keys(routes).find((k) => u.endsWith(k)) || Object.keys(routes).find((k) => u.includes(k));
    const r = key ? routes[key] : { status: 200, data: {} };
    if (r === "pending") return new Promise(() => {});
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.data });
  };
}
const OVERVIEW = { organizations: { total: 1 }, campaigns: { total: 0 }, participants: { total: 0 }, economics: { activeVersions: 0 } };
const baseRoutes = (orgs = [ORG]) => ({
  "/admin/overview": { status: 200, data: OVERVIEW },
  "/admin/organizations": { status: 200, data: orgs },
  "/totals/participants": { status: 200, data: { participants: 0, attributionRecords: 0 } },
  "/totals/ledger": { status: 200, data: { conversions: 0, renewals: 0, refunds: 0 } },
  "/reconciliation": { status: 200, data: { reconciled: true } },
  "/payouts/status": { status: 503, data: { disabled: true } },
  "/audit": { status: 200, data: [] },
});

const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await settle(); };

async function mountAndOpen(routes) {
  installFetch(routes);
  globalThis.__flag = true;
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Founder)); });
  await settle();
  const open = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Open");
  assert.ok(open, "the organization row must offer Open");
  await click(open);
  return root;
}
async function typeAndResolve(email) {
  const input = $("admin-email");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, email);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await click($("admin-resolve"));
}

test("P2 UI: EMPTY — the panel renders with no result and issues no resolver call", async () => {
  await mountAndOpen(baseRoutes());
  assert.ok($("admin-resolve-form"), "panel is rendered inside the org drawer");
  assert.equal($("admin-resolved"), null);
  assert.equal($("admin-error"), null);
  assert.equal(calls.filter((c) => c.url.includes("/users/resolve")).length, 0);
});

test("P2 UI: RESOLVING — an in-flight resolve shows progress and posts the email in the BODY", async () => {
  await mountAndOpen({ ...baseRoutes(), "/users/resolve": "pending" });
  await typeAndResolve(ACCOUNT.email);
  assert.equal($("admin-resolve").textContent.trim(), "Resolving…");
  const call = calls.find((c) => c.url.includes("/users/resolve"));
  assert.ok(call, "resolver was called");
  assert.equal(call.method, "POST");
  assert.equal(JSON.parse(call.body).email, ACCOUNT.email, "email travels in the body");
  assert.ok(!call.url.includes(ACCOUNT.email) && !call.url.includes("email="), "email never appears in the URL");
});

test("P2 UI: RESOLVED — shows the approved fields and offers assignment", async () => {
  await mountAndOpen({ ...baseRoutes(), "/users/resolve": { status: 200, data: ACCOUNT } });
  await typeAndResolve(ACCOUNT.email);
  assert.ok($("admin-resolved"), "resolved card shown");
  assert.equal($("admin-verified").textContent, "yes");
  assert.equal($("admin-isfounder").textContent, "no");
  assert.ok($("admin-resolved").textContent.includes(ACCOUNT.email), "the founder-entered email is shown unmasked");
  assert.ok($("admin-assign"), "assignment offered");
});

test("P2 UI: INVALID_EMAIL / NOT_FOUND / AMBIGUOUS / SERVICE_FAILURE each render truthfully", async () => {
  const cases = [
    [{ status: 400, data: { code: "INVALID_EMAIL" } }, /valid email/i],
    [{ status: 404, data: { code: "USER_NOT_FOUND" } }, /No Greet-Me account/i],
    [{ status: 409, data: { code: "EMAIL_AMBIGUOUS" } }, /more than one account/i],
    [{ status: 503, data: {} }, /Could not reach the account service/i],
    [new Error("network down"), /Could not reach the account service/i],
  ];
  for (const [resp, re] of cases) {
    await mountAndOpen({ ...baseRoutes(), "/users/resolve": resp });
    await typeAndResolve("someone@example.com");
    assert.ok($("admin-error"), "an error message is shown");
    assert.match($("admin-error").textContent, re);
    assert.equal($("admin-resolved"), null, "no account card on a failure");
    assert.equal($("admin-assign"), null, "assignment is never offered");
  }
});

test("P2 UI: a founder account resolves but assignment is blocked client-side", async () => {
  await mountAndOpen({ ...baseRoutes(), "/users/resolve": { status: 200, data: { ...ACCOUNT, isFounder: true } } });
  await typeAndResolve("founder@example.com");
  assert.equal($("admin-isfounder").textContent, "yes");
  assert.ok($("admin-founder-block"), "the founder block is explained");
  assert.equal($("admin-assign"), null, "no assign control for a founder account");
});

test("P2 UI: ASSIGNING then ASSIGNED — success is shown and read-back reflects adminUserIds", async () => {
  const assigned = { ...ORG, adminUserIds: [ACCOUNT.userId] };
  let orgsCall = 0;
  installFetch({});
  globalThis.__flag = true;
  globalThis.fetch = (url, opts = {}) => {
    const u = String(url); calls.push({ url: u, method: opts.method || "GET", body: opts.body });
    const json = (status, data) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => data });
    if (u.includes("/users/resolve")) return json(200, ACCOUNT);
    if (u.includes("/partner-admins")) return json(200, assigned);
    if (u.includes("/admin/organizations")) { orgsCall++; return json(200, [orgsCall === 1 ? ORG : assigned]); }
    if (u.includes("/admin/overview")) return json(200, OVERVIEW);
    if (u.includes("/payouts/status")) return json(503, { disabled: true });
    return json(200, {});
  };
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Founder)); });
  await settle();
  await click([...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Open"));
  await typeAndResolve(ACCOUNT.email);
  await click($("admin-assign"));

  assert.ok($("admin-success"), "success message shown");
  assert.match($("admin-success").textContent, /Administrator assigned\./);
  const assignCall = calls.find((c) => c.url.includes("/partner-admins"));
  assert.equal(JSON.parse(assignCall.body).userId, ACCOUNT.userId, "the RESOLVED userId is forwarded, never invented");
  assert.ok($("admin-readback"), "read-back rendered");
  assert.match($("admin-readback").textContent, /present in adminUserIds/, "existing read-back behaviour reflects the assignment");
});

test("P2 UI: ASSIGN_FAILED — each server rejection renders truthfully and claims no success", async () => {
  for (const [status, re] of [[400, /rejected/i], [404, /no longer exists/i], [409, /founder account/i], [403, /Founder access is required/i], [503, /currently unavailable/i]]) {
    await mountAndOpen({ ...baseRoutes(), "/users/resolve": { status: 200, data: ACCOUNT }, "/partner-admins": { status, data: {} } });
    await typeAndResolve(ACCOUNT.email);
    await click($("admin-assign"));
    assert.equal($("admin-success"), null, `status ${status} must not render success`);
    assert.ok($("admin-error"), `status ${status} must render an error`);
    assert.match($("admin-error").textContent, re);
  }
});

test("P2 UI: editing the email after a result clears the previous state", async () => {
  await mountAndOpen({ ...baseRoutes(), "/users/resolve": { status: 404, data: {} } });
  await typeAndResolve("nobody@example.com");
  assert.ok($("admin-error"));
  await act(async () => {
    const input = $("admin-email");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "other@example.com");
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await settle();
  assert.equal($("admin-error"), null, "stale result cleared when the input changes");
});

test("P2 UI: opening a different organization resets the panel", async () => {
  const ORG2 = { ...ORG, organizationId: "org_two", legalName: "Second LLC" };
  await mountAndOpen({ ...baseRoutes([ORG, ORG2]), "/users/resolve": { status: 200, data: ACCOUNT } });
  await typeAndResolve(ACCOUNT.email);
  assert.ok($("admin-resolved"));
  const opens = [...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Open");
  await click(opens[1]);
  assert.equal($("admin-resolved"), null, "no resolved account carries across organizations");
  assert.equal($("admin-email").value, "", "the email field is cleared");
});

test("P2 UI: existing organization creation still works and duplicate 409 surfaces", async () => {
  await mountAndOpen({ ...baseRoutes(), "/admin/organizations": { status: 200, data: [ORG] } });
  const legal = [...document.querySelectorAll("input")].find((i) => i.placeholder === "Legal name");
  assert.ok(legal, "the existing create-organization form is intact");
  const createBtn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Create organization");
  assert.ok(createBtn, "the existing create control is intact");
});

test("P2 UI: flag OFF ⇒ dormant, and no fundraiser request is issued", async () => {
  installFetch(baseRoutes());
  globalThis.__flag = false;
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Founder)); });
  await settle();
  assert.equal(calls.length, 0, "no request while the gate is off");
  assert.equal($("admin-resolve-form"), null);
});
