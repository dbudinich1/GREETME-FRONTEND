// src/components/corporateCampaign/greetingAutomationCreate.browser.test.mjs
//
// D2 — BROWSER-LEVEL tests for the Corporate Campaign Dashboard READY phase: the create form
// (required name + optional type) and server-derived detail navigation. The real
// GreetingAutomationCampaigns.jsx is esbuild-transformed and mounted into jsdom with an INJECTED
// fake client (no network). Proves: create posts { name, campaignType } (not empty {}); submit is
// blocked until a name is entered; cancel makes no write; an entered type is displayed; selecting a
// campaign navigates to detail (capability is server-derived, no crash).
//
// Run (Node 20.x): node --test src/components/corporateCampaign/greetingAutomationCreate.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__gac_create.bundle.mjs");
let React, createRoot, Surface, act, window;

before(async () => {
  writeFileSync(join(__dirname, ".__gacc.jsx"), `export { default as Surface } from "./GreetingAutomationCampaigns.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__gacc.jsx")],
    outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  rmSync(join(__dirname, ".__gacc.jsx"), { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Surface } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(join(__dirname, ".__gacc.jsx"), { force: true }); } catch { /* ignore */ } });

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const txt = () => document.body.textContent;
function setValue(el, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, value);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
}
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); }); await flush(); };
// jsdom performs no implicit form submission on button click (a real browser does), so drive the
// form's submit event directly — React's onSubmit (guarded by canCreate) runs the create.
const submitForm = async () => { await act(async () => { tid("create-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); }); await flush(); };

let root;
async function mount(props) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Surface, props)); });
  await flush();
}

// Fake client: one active org; campaign list configurable; create/read/readiness recorded.
function fakeClient({ campaigns = [] } = {}) {
  const calls = { listMemberships: 0, listCampaigns: 0, createCampaign: [], readCampaign: [], readReadiness: [] };
  return {
    calls,
    listMemberships: async () => { calls.listMemberships++; return { ok: true, data: { memberships: [{ corporateOrganizationId: "org_1", role: "owner", status: "active" }] } }; },
    listCampaigns: async () => { calls.listCampaigns++; return { ok: true, data: { campaigns } }; },
    createCampaign: async (orgId, body) => { calls.createCampaign.push({ orgId, body }); return { ok: true, data: { campaign: { campaignId: "camp_new", ...body } } }; },
    readCampaign: async (o, c) => { calls.readCampaign.push([o, c]); return { ok: true, data: { campaign: { campaignId: c, name: "Existing", campaignType: "Holiday" } } }; },
    readReadiness: async (o, c) => { calls.readReadiness.push([o, c]); return { ok: true, data: {} }; },
    updateFeaturedSpread: async () => ({ ok: true }), approve: async () => ({ ok: true }),
    lock: async () => ({ ok: true }), unlock: async () => ({ ok: true }),
  };
}

test("empty ready state offers Create; opening shows the form with submit disabled until a name is entered", async () => {
  const c = fakeClient({ campaigns: [] });
  await mount({ client: c });
  assert.ok(tid("open-create"), "Create action is offered");
  assert.equal(tid("create-form"), null, "form is not shown until opened");
  await click(tid("open-create"));
  assert.ok(tid("create-form"), "form opens");
  assert.equal(tid("create-submit").disabled, true, "submit disabled with empty name");
  assert.equal(c.calls.createCampaign.length, 0);
});

test("entering a name enables submit; create posts { name } (NOT empty {}) and reloads", async () => {
  const c = fakeClient({ campaigns: [] });
  await mount({ client: c });
  await click(tid("open-create"));
  await act(async () => { setValue(tid("create-name"), "Q4 Client Appreciation"); }); await flush();
  assert.equal(tid("create-submit").disabled, false, "submit enabled once named");
  const listBefore = c.calls.listCampaigns;
  await submitForm();
  assert.equal(c.calls.createCampaign.length, 1, "exactly one create");
  assert.deepEqual(c.calls.createCampaign[0].body, { name: "Q4 Client Appreciation" }, "posts name only, no empty {}, no type");
  assert.equal(tid("create-form"), null, "form closes after success");
  assert.ok(c.calls.listCampaigns > listBefore, "list reloaded after create");
});

test("optional type is included when provided", async () => {
  const c = fakeClient({ campaigns: [] });
  await mount({ client: c });
  await click(tid("open-create"));
  await act(async () => { setValue(tid("create-name"), "Winter Cards"); setValue(tid("create-type"), "Holiday"); }); await flush();
  await submitForm();
  assert.deepEqual(c.calls.createCampaign[0].body, { name: "Winter Cards", campaignType: "Holiday" });
});

test("whitespace-only name keeps submit disabled and posts nothing", async () => {
  const c = fakeClient({ campaigns: [] });
  await mount({ client: c });
  await click(tid("open-create"));
  await act(async () => { setValue(tid("create-name"), "   "); }); await flush();
  assert.equal(tid("create-submit").disabled, true);
  assert.equal(c.calls.createCampaign.length, 0);
});

test("cancel closes the form and makes no write", async () => {
  const c = fakeClient({ campaigns: [] });
  await mount({ client: c });
  await click(tid("open-create"));
  await act(async () => { setValue(tid("create-name"), "Discarded"); }); await flush();
  await click(tid("create-cancel"));
  assert.equal(tid("create-form"), null, "form closed");
  assert.equal(c.calls.createCampaign.length, 0, "no write on cancel");
});

test("existing campaign shows its type and navigates to detail (server-derived capability, no crash)", async () => {
  const c = fakeClient({ campaigns: [{ campaignId: "camp_1", name: "Existing", campaignType: "Holiday" }] });
  await mount({ client: c });
  assert.ok(txt().includes("Existing"), "campaign name shown");
  assert.ok(txt().includes("Holiday"), "entered type is displayed");
  const row = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Existing"));
  await click(row);
  assert.ok(c.calls.readCampaign.length >= 1, "navigated into detail (readCampaign called)");
});