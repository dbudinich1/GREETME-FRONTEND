// src/components/corporateCampaign/audienceSection.browser.test.mjs
//
// CORP-3 — BROWSER-LEVEL tests for the audience selection surface. AudienceSection.jsx is
// esbuild-transformed and mounted into jsdom with an INJECTED fake client (no network). Proves:
// truthful count/names, the picker lists the org pool with current selection pre-checked, saving
// PUTs the selected ids, duplicates are impossible, unresolved/stale refs surface truthfully, empty
// pool is honest, a rejected save shows a message and never fakes success, and NO send/deliver/
// schedule language appears. Run (Node 20.x): node --test src/components/corporateCampaign/audienceSection.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__aud.bundle.mjs");
let React, createRoot, Section, act, window;

before(async () => {
  writeFileSync(join(__dirname, ".__aud.jsx"), `export { default as Section } from "./AudienceSection.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__aud.jsx")], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  rmSync(join(__dirname, ".__aud.jsx"), { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document; globalThis.navigator = window.navigator;
  globalThis.HTMLElement = window.HTMLElement; globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Section } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(join(__dirname, ".__aud.jsx"), { force: true }); } catch { /* ignore */ } });

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const tidAll = (t) => [...document.querySelectorAll(`[data-testid="${t}"]`)];
const txt = () => document.body.textContent;
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); }); await flush(); };
const toggleCheckbox = async (label) => { await act(async () => { label.querySelector("input").click(); }); await flush(); };

let root;
async function mount(client) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Section, { orgId: "org_1", campaignId: "camp_1", client })); });
  await flush();
}

// Fake client backed by an in-memory audience the PUT actually mutates (so reload reflects saves).
function fakeClient({ pool = [], initialRefs = [] } = {}) {
  const byId = new Map(pool.map((c) => [c.id, c]));
  let refs = [...initialRefs];
  const calls = { setAudience: [] };
  const resolve = () => {
    const uniq = [...new Set(refs)];
    const contacts = uniq.filter((id) => byId.has(id)).map((id) => byId.get(id));
    const unresolved = uniq.filter((id) => !byId.has(id));
    return { count: contacts.length, contacts, unresolved };
  };
  return {
    calls,
    readAudience: async () => ({ ok: true, data: resolve() }),
    listOrgContacts: async () => ({ ok: true, data: { contacts: pool, count: pool.length } }),
    setAudience: async (o, c, next) => { calls.setAudience.push(next); refs = [...new Set(next)].filter((id) => byId.has(id)); return { ok: true, data: resolve() }; },
  };
}

const POOL = [{ id: "c1", name: "Alice" }, { id: "c2", name: "Bob" }, { id: "c3", name: "Carol" }];

test("renders truthful count + names of the current audience", async () => {
  await mount(fakeClient({ pool: POOL, initialRefs: ["c1", "c2"] }));
  assert.ok(tid("audience-section"));
  assert.match(tid("audience-count").textContent, /2 contacts selected/);
  assert.ok(txt().includes("Alice") && txt().includes("Bob"));
});

test("Manage opens a picker listing the org pool with current selection pre-checked", async () => {
  await mount(fakeClient({ pool: POOL, initialRefs: ["c1"] }));
  await click(tid("audience-manage"));
  assert.ok(tid("audience-picker"));
  assert.equal(tidAll("audience-option").length, 3);
  const checked = tidAll("audience-option").filter((l) => l.querySelector("input").checked).map((l) => l.textContent.trim());
  assert.deepEqual(checked, ["Alice"]);
});

test("selecting contacts and saving PUTs the chosen ids; reload reflects them", async () => {
  const c = fakeClient({ pool: POOL, initialRefs: [] });
  await mount(c);
  await click(tid("audience-manage"));
  const opt = (name) => tidAll("audience-option").find((l) => l.textContent.includes(name));
  await toggleCheckbox(opt("Alice"));
  await toggleCheckbox(opt("Carol"));
  await click(tid("audience-save"));
  assert.equal(c.calls.setAudience.length, 1);
  assert.deepEqual([...c.calls.setAudience[0]].sort(), ["c1", "c3"]);
  assert.match(tid("audience-count").textContent, /2 contacts selected/);
  assert.ok(txt().includes("Alice") && txt().includes("Carol"));
});

test("a contact cannot be associated twice (toggling on/off then on yields one id)", async () => {
  const c = fakeClient({ pool: POOL, initialRefs: [] });
  await mount(c);
  await click(tid("audience-manage"));
  const alice = () => tidAll("audience-option").find((l) => l.textContent.includes("Alice"));
  await toggleCheckbox(alice()); // on
  await toggleCheckbox(alice()); // off
  await toggleCheckbox(alice()); // on
  await click(tid("audience-save"));
  assert.deepEqual(c.calls.setAudience[0], ["c1"]); // exactly one, never duplicated
});

test("unresolved/stale refs are surfaced truthfully, never as a name", async () => {
  await mount(fakeClient({ pool: POOL, initialRefs: ["c1", "ghost"] }));
  assert.match(tid("audience-count").textContent, /1 contact selected/);
  assert.ok(tid("audience-unresolved"));
  assert.ok(!txt().includes("ghost"));
});

test("empty pool is honest and offers no import/create action", async () => {
  await mount(fakeClient({ pool: [], initialRefs: [] }));
  await click(tid("audience-manage"));
  assert.ok(tid("audience-empty-pool"));
  assert.ok(/no corporate contacts are available/i.test(txt()));
});

test("a rejected save shows a message and does NOT fake success", async () => {
  const c = fakeClient({ pool: POOL, initialRefs: [] });
  c.setAudience = async () => ({ ok: false, unauthorized: true, status: 403 }); // e.g. server ownership rejection
  await mount(c);
  await click(tid("audience-manage"));
  await toggleCheckbox(tidAll("audience-option")[0]);
  await click(tid("audience-save"));
  assert.ok(tid("audience-picker"), "picker stays open so the user can correct");
  assert.ok(/access/i.test(txt()), "a truthful message is shown");
});

test("no send / deliver / schedule language anywhere in the audience surface", async () => {
  await mount(fakeClient({ pool: POOL, initialRefs: ["c1"] }));
  await click(tid("audience-manage"));
  const body = txt().toLowerCase();
  for (const forbidden of ["will send", "send to", "deliver", "delivery", "schedule", "will be sent", "sends "]) {
    assert.ok(!body.includes(forbidden), `must not imply sending: "${forbidden}"`);
  }
});
