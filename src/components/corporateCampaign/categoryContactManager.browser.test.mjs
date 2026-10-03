// SURFACE 8 - BROWSER-LEVEL proof of category-scoped Manage: the real ContactTiles + CategoryContactManager are
// esbuild-bundled and mounted in jsdom with INJECTED fake clients (no network).
// Run (Node 20.x): node --test src/components/corporateCampaign/categoryContactManager.browser.test.mjs
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
// CLEAN_SCRATCH: scratch files carry this process id in their name, so concurrent suites cannot collide; all are removed on exit.
import { readdirSync as __scratchLs, rmSync as __scratchRm } from "node:fs";
process.on("exit", () => { try { for (const n of __scratchLs(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) __scratchRm(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const ENTRY = join(__dirname, `.__ccm.${process.pid}.entry.jsx`);
const BUNDLE = join(__dirname, `.__ccm.${process.pid}.bundle.mjs`);

let React, createRoot, act, ContactTiles, dom;

before(async () => {
  writeFileSync(ENTRY, `export { default as ContactTiles } from "./ContactTiles.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty" },
    external: ["react", "react-dom", "react-dom/client", "react-router-dom"],
    define: { "import.meta.env": "{}" },
  });
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event; globalThis.MouseEvent = dom.window.MouseEvent;
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ ContactTiles } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { for (const f of [ENTRY, BUNDLE]) { try { rmSync(f, { force: true }); } catch { /* gone */ } } });

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); await flush(); };
const setValue = async (el, v) => { await act(async () => {
  const proto = el.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
  el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}); };
const submit = async (form) => { await act(async () => { form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); }); await flush(); };

const FULL = () => [
  { id: "e1", name: "Bob Smith", email: "bob@x.co", phone: "555-0101", company: "Co", department: "Sales", notes: "n", corporateContactType: "employee",
    occasions: [{ type: "birthday", date: "1988-06-12" }], shippingAddress: { line1: "1 Main", line2: "", city: "Newark", state: "NJ", zip: "07102", country: "United States" } },
  { id: "e2", name: "Tommy Nguyen", email: "", corporateContactType: "employee", occasions: [], shippingAddress: null },
  { id: "c1", name: "Dana Lee", email: "dana@acme.co", corporateContactType: "client", occasions: [], shippingAddress: null },
  { id: "v1", name: "Ana Ruiz", email: "ana@nw.co", corporateContactType: "vendor", occasions: [], shippingAddress: null },
];

function setup({ canWrite = true, campaigns = [], failWith = null, log = undefined } = {}) {
  const store = { contacts: FULL() };
  const calls = [];
  const writes = {
    createContact: async (org, body) => { calls.push(["create", org, body]); if (failWith) return failWith; store.contacts.push({ id: `n${store.contacts.length}`, ...body, shippingAddress: body.shippingAddress }); return { ok: true }; },
    updateContact: async (org, id, body) => { calls.push(["update", org, id, body]); if (failWith) return failWith; store.contacts = store.contacts.map((c) => (c.id === id ? { ...c, ...body } : c)); return { ok: true }; },
    deleteContact: async (org, id) => { calls.push(["delete", org, id]); store.contacts = store.contacts.filter((c) => c.id !== id); return { ok: true }; },
    ...(log === undefined ? {} : { listDeletionLog: async (org) => { calls.push(["log", org]); return log; } }),
  };
  return { store, calls, writes, campaigns, canWrite };
}

const mounted = [];
afterEach(async () => { while (mounted.length) { const { root, host } = mounted.pop(); await act(async () => { root.unmount(); }); host.remove(); } });

async function mount(h) {
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  const render = () => root.render(React.createElement(ContactTiles, {
    contacts: h.store.contacts.map((c) => ({ id: c.id, name: c.name, corporateContactType: c.corporateContactType })),
    onAddCategory: (k) => { h.calls.push(["import", k]); },
    manager: { contacts: h.store.contacts, orgId: "org1", writes: h.writes, campaigns: h.campaigns, canWrite: h.canWrite, reload: async () => { render(); } },
  }));
  await act(async () => { render(); });
  return { host, tid: (t) => host.querySelector(`[data-testid="${t}"]`), qa: (s) => [...host.querySelectorAll(s)] };
}

test("tile Ready / Needs info come from name + email only (no birthday or address needed)", async () => {
  const s = await mount(setup());
  assert.equal(s.tid("tile-employee-ready").textContent.trim(), "1", "Bob is Ready; Tommy has no email");
  assert.equal(s.tid("tile-employee-needs-info").textContent.trim(), "1");
  assert.equal(s.tid("tile-client-ready").textContent.trim(), "1", "Dana: name + email, no birthday, no address, still Ready");
});

test("Manage opens only that category's list with search, a Ready badge and the address row note", async () => {
  const s = await mount(setup());
  await click(s.tid("tile-employee-manage"));
  assert.ok(s.tid("manage-employee"));
  assert.equal(s.tid("manage-client"), null, "only the opened category");
  assert.equal(s.tid("manage-row-c1"), null, "a client does not appear under Employees");
  assert.equal(s.tid("manage-ready-e1").dataset.ready, "yes");
  assert.equal(s.tid("manage-ready-e2").dataset.ready, "no");
  assert.equal(s.tid("manage-address-e1").textContent, "Address on file");
  assert.equal(s.tid("manage-address-e2").textContent, "No address yet");
  await setValue(s.tid("manage-search"), "tom");
  assert.deepEqual(s.qa('[data-testid^="manage-row-"]').map((e) => e.dataset.testid), ["manage-row-e2"]);
});

test("Add contact: category fixed by the tile, optional address with advisory, validation, then one POST", async () => {
  const h = setup(); const s = await mount(h);
  await click(s.tid("tile-vendor-manage"));
  await click(s.tid("manage-vendor-add"));
  assert.equal(s.tid("manage-add-category").textContent, "Vendors");
  assert.equal(s.tid("manage-add-form").querySelector("select"), null, "no category choice in the form");
  assert.match(s.tid("manage-add-address-advisory").textContent, /needed to send a physical gift/);
  await submit(s.tid("manage-add-form"));
  assert.ok(s.tid("manage-add-error-name") && s.tid("manage-add-error-email"), "name and email are required");
  assert.equal(s.tid("manage-add-error-line1"), null, "an empty address is never an error");
  assert.equal(h.calls.filter((c) => c[0] === "create").length, 0, "nothing sent while invalid");
  await setValue(s.tid("manage-add-name"), "Rae Vendor");
  await setValue(s.tid("manage-add-email"), "BOB@x.co");
  await submit(s.tid("manage-add-form"));
  assert.equal(s.tid("manage-add-error-email").textContent, "Someone with that email is already here.", "duplicate across categories");
  await setValue(s.tid("manage-add-email"), "rae@v.co");
  await submit(s.tid("manage-add-form"));
  const creates = h.calls.filter((c) => c[0] === "create");
  assert.equal(creates.length, 1);
  assert.equal(creates[0][2].corporateContactType, "vendor");
  assert.equal(creates[0][2].shippingAddress, null, "no address typed -> none sent");
  assert.ok(s.tid("manage-row-n4"), "the new row is listed");
  assert.equal(s.tid("manage-ready-n4").dataset.ready, "yes");
});

test("the tile's Add button adds a single contact right there (no import); Import stays available inside Manage", async () => {
  const h = setup(); const s = await mount(h);
  await click(s.tid("tile-client-add"));
  assert.ok(s.tid("manage-add-form"), "the add form opens");
  assert.equal(h.calls.filter((c) => c[0] === "import").length, 0, "no import was started");
  await click(s.tid("manage-client-import"));
  assert.deepEqual(h.calls.filter((c) => c[0] === "import"), [["import", "client"]]);
});

test("Edit shows the SAME field set as Add, pre-filled from the full record, and PATCHes every field incl. address", async () => {
  const h = setup(); const s = await mount(h);
  await click(s.tid("tile-employee-manage"));
  await click(s.tid("manage-add-employee") || s.tid("manage-employee-add"));
  const keys = (form, prefix) => [...form.querySelectorAll(`[data-testid^="${prefix}-"]`)].map((e) => e.dataset.testid.replace(`${prefix}-`, "")).filter((k) => !/^(error-|address-advisory|save|cancel|category)/.test(k)).sort();
  const addKeys = keys(s.tid("manage-add-form"), "manage-add");
  await click(s.tid("manage-add-cancel"));
  await click(s.tid("manage-edit-e1"));
  const editKeys = keys(s.tid("manage-edit-form"), "manage-edit");
  assert.deepEqual(editKeys, addKeys, "Add and Edit expose exactly the same fields");
  assert.equal(s.tid("manage-edit-email").value, "bob@x.co");
  assert.equal(s.tid("manage-edit-phone").value, "555-0101");
  assert.equal(s.tid("manage-edit-birthday").value, "1988-06-12");
  assert.equal(s.tid("manage-edit-line1").value, "1 Main");
  await setValue(s.tid("manage-edit-department"), "Partnerships");
  await setValue(s.tid("manage-edit-city"), "Hoboken");
  await submit(s.tid("manage-edit-form"));
  const upd = h.calls.find((c) => c[0] === "update");
  assert.equal(upd[2], "e1");
  assert.equal(upd[3].department, "Partnerships");
  assert.equal(upd[3].shippingAddress.city, "Hoboken");
  assert.equal(upd[3].occasions[0].date, "1988-06-12");
});

const dlg = (s) => s.tid("manage-remove-confirm");
const keydown = async (el, key) => { await act(async () => { el.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true })); }); await flush(); };

test("Remove is a permanent delete: nothing is sent until 'Delete permanently'; the dialog warns about campaigns; Cancel has focus", async () => {
  const h = setup({ campaigns: [{ name: "Birthdays", enabled: true, audienceRefs: ["e1"] }] }); const s = await mount(h);
  await click(s.tid("tile-employee-manage"));
  await click(s.tid("manage-remove-e1"));
  assert.ok(dlg(s), "a confirmation dialog opens");
  assert.equal(h.calls.filter((c) => c[0] === "delete").length, 0, "opening the dialog sends nothing");
  const text = dlg(s).textContent;
  assert.match(text, /Continuing will delete this contact permanently\. Are you sure you want to delete this contact\?/);
  assert.doesNotMatch(text, /archiv|restore/i);
  assert.match(s.tid("manage-remove-records-note").textContent, /Records of gifts already sent keep the delivery details they were fulfilled with./);
  assert.match(s.tid("manage-remove-warning").textContent, /Bob Smith is in Birthdays\./);
  assert.equal(s.tid("manage-remove-no").textContent.trim(), "Cancel");
  assert.equal(s.tid("manage-remove-yes").textContent.trim(), "Delete permanently");
  assert.equal(document.activeElement, s.tid("manage-remove-no"), "Cancel is the default focus");
  await click(s.tid("manage-remove-yes"));
  assert.deepEqual(h.calls.filter((c) => c[0] === "delete"), [["delete", "org1", "e1"]]);
  assert.equal(s.tid("manage-row-e1"), null);
  assert.match(s.tid("manage-message").textContent, /deleted permanently/);
});

test("Cancel and Escape send no DELETE and close the dialog", async () => {
  const h = setup(); const s = await mount(h);
  await click(s.tid("tile-employee-manage"));
  await click(s.tid("manage-remove-e1"));
  await click(s.tid("manage-remove-no"));
  assert.equal(dlg(s), null);
  await click(s.tid("manage-remove-e1"));
  await keydown(dlg(s), "Escape");
  assert.equal(dlg(s), null, "Escape closes");
  assert.equal(h.calls.filter((c) => c[0] === "delete").length, 0, "Cancel/Escape never send a DELETE");
  assert.ok(s.tid("manage-row-e1"), "the contact is still there");
});

test("an 'email_archived' answer from an older server is just a generic failure: no Restore offer exists", async () => {
  const h = setup({ failWith: { ok: false, conflict: true, status: 409, error: "email_archived", contactId: "gone1" } }); const s = await mount(h);
  await click(s.tid("tile-vendor-manage"));
  await click(s.tid("manage-vendor-add"));
  await setValue(s.tid("manage-add-name"), "Old Friend");
  await setValue(s.tid("manage-add-email"), "old@friend.co");
  await submit(s.tid("manage-add-form"));
  assert.equal(s.tid("manage-restore"), null);
  assert.doesNotMatch(s.tid("manage-message").textContent, /restore|archiv|removed earlier/i);
});

test("Deletion history shows only date, category and count - never personal data - and stays hidden without the endpoint", async () => {
  const log = { ok: true, entries: [
    { deletedAt: "2026-10-02T14:00:00.000Z", category: "employee", count: 2, name: "Bob Smith", email: "bob@x.co", contactId: "e1", deletedByUserId: "u9" },
    { date: "2026-09-30", corporateContactType: "client", name: "Dana Lee", email: "dana@acme.co" },
  ] };
  const h = setup({ log }); const s = await mount(h);
  await click(s.tid("tile-employee-manage"));
  assert.ok(s.tid("manage-history-toggle"));
  assert.equal(s.tid("manage-history"), null, "collapsed until asked");
  await click(s.tid("manage-history-toggle"));
  const rows = s.qa('[data-testid="manage-history-row"]').map((r) => [...r.querySelectorAll("td")].map((t) => t.textContent));
  assert.deepEqual(rows, [["2026-10-02", "employee", "2"], ["2026-09-30", "client", "1"]]);
  const html = s.tid("manage-history").outerHTML;
  for (const pii of ["Bob", "bob@x.co", "Dana", "dana@acme.co", "e1", "u9"]) assert.ok(!html.includes(pii), `history must not render ${pii}`);
  const none = await mount(setup({ log: { ok: false, unavailable: true, status: 404 } }));
  await click(none.tid("tile-employee-manage"));
  assert.equal(none.tid("manage-history-toggle"), null, "gated behind the response");
  const noFn = await mount(setup());
  await click(noFn.tid("tile-employee-manage"));
  assert.equal(noFn.tid("manage-history-toggle"), null);
});

test("without the management read (a non-owner), the tiles still show Ready / Needs info from the roster\u2019s own ready flag - never the email", async () => {
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host); mounted.push({ root, host });
  await act(async () => { root.render(React.createElement(ContactTiles, { contacts: [
    { id: "e1", name: "A", corporateContactType: "employee", ready: true },
    { id: "e2", name: "B", corporateContactType: "employee", ready: false },
    { id: "c1", name: "C", corporateContactType: "client", ready: true },
  ], manager: null })); });
  const v = (t) => host.querySelector(`[data-testid="${t}"]`).textContent.trim();
  assert.equal(v("tile-employee-ready"), "1");
  assert.equal(v("tile-employee-needs-info"), "1");
  assert.equal(v("tile-client-ready"), "1");
  assert.equal(v("tile-vendor-ready"), "0");
});

test("a non-owner sees the list but no Add / Edit / Remove; without the management read the tile falls back to the read-only roster", async () => {
  const s = await mount(setup({ canWrite: false }));
  await click(s.tid("tile-employee-manage"));
  assert.ok(s.tid("manage-row-e1"));
  assert.equal(s.tid("manage-employee-add"), null);
  assert.equal(s.tid("manage-edit-e1"), null);
  assert.equal(s.tid("manage-remove-e1"), null);
  const host = document.createElement("div"); document.body.appendChild(host);
  const root2 = createRoot(host); mounted.push({ root: root2, host });
  await act(async () => { root2.render(React.createElement(ContactTiles, { contacts: [{ id: "e1", name: "Bob", corporateContactType: "employee" }], manager: null })); });
  await click(host.querySelector('[data-testid="tile-employee-manage"]'));
  assert.ok(host.querySelector('[data-testid="tile-employee-roster"]'), "read-only roster as before");
  assert.equal(host.querySelector('[data-testid="tile-employee-ready"]').textContent.trim(), "—");
});
