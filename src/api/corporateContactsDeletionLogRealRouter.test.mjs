// Proves the FE deletion-history client against the REAL backend router (routes/corporateContactsRoutes.js
// createCorporateContactsRouter, branch sprint/closeout-t3-permanent-delete) over real HTTP, with a fake store:
// delete a contact through DELETE, then read the log through the FE client and check that only date/category/count come back.
// The backend worktree is machine-specific: set CORP_CONTACTS_BE_DIR (default C:/1_GREET-ME/cs-be-delete);
// absent -> skipped, or a hard failure when CI is set.
// Run (Node 20.x): node --test src/api/corporateContactsDeletionLogRealRouter.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createCorporateContactsClient } from "./corporateContacts.js";

const BE = process.env.CORP_CONTACTS_BE_DIR || "C:/1_GREET-ME/cs-be-delete";
const have = fs.existsSync(path.join(BE, "routes", "corporateContactsRoutes.js")) && fs.existsSync(path.join(BE, "node_modules", "express"));
if (!have && process.env.CI) throw new Error(`backend worktree not found at ${BE}`);
const skip = have ? false : `backend worktree not found at ${BE}`;

const ORG = "corp_org_real";
function container(seed) {
  const store = new Map();
  const k = (pk, id) => `${pk}::${id}`;
  for (const d of seed) store.set(k(d.userId, d.id), d);
  return {
    all: () => [...store.values()],
    item(id, pk) {
      return {
        async read() { return { resource: store.get(k(pk, id)) || undefined }; },
        async replace(doc) { store.set(k(pk, id), doc); return { resource: doc }; },
        async delete() { store.delete(k(pk, id)); return {}; },
      };
    },
    items: {
      async create(doc, opts) {
        const pk = (opts && opts.partitionKey) || doc.userId;
        if (store.has(k(pk, doc.id))) { const e = new Error("conflict"); e.code = 409; throw e; }
        store.set(k(pk, doc.id), doc); return { resource: doc };
      },
      query(spec) {
        return {
          async fetchAll() {
            const p = {}; for (const x of spec.parameters || []) p[x.name] = x.value;
            const org = p["@org"] !== undefined ? p["@org"] : p["@pk"];
            return { resources: [...store.values()].filter((d) => d.userId === org
              && (p["@scope"] === undefined || d.contactScope === p["@scope"])
              && (p["@rt"] === undefined || d.recordType === p["@rt"])
              && (p["@email"] === undefined || String(d.email || "").toLowerCase() === p["@email"])) };
          },
        };
      },
    },
  };
}
const CORP = (over) => ({
  id: "ct_1", userId: ORG, recordType: "corporate_contact", contactScope: "corporate", corporateOrganizationId: ORG,
  corporateContactType: "employee", name: "Ada Lovelace", email: "ada@x.co", phone: "555-1234", notes: "secret note", occasions: [], ...over,
});

let server, base, store, role = "owner", enabled = true;

before(async () => {
  if (skip) return;
  const req = createRequire(path.join(BE, "package.json"));
  const express = req("express");
  const mod = await import(pathToFileURL(path.join(BE, "routes", "corporateContactsRoutes.js")).href);
  const { default: realRequireAuth } = await import(pathToFileURL(path.join(BE, "middleware", "requireAuth.js")).href);
  store = container([CORP({}), CORP({ id: "ct_2", name: "Grace Hopper", email: "grace@x.co", corporateContactType: "client" })]);
  const router = mod.createCorporateContactsRouter({
    isEnabled: () => enabled,
    resolveMemberships: async () => [{ corporateOrganizationId: ORG, role, status: "active" }],
    getContainer: async () => store,
  });
  // Only the Cosmos-backed JWT lookup is replaced; every other handler on each route is the real one.
  for (const layer of router.stack) {
    if (!layer.route) continue;
    for (const l of layer.route.stack) if (l.handle === realRequireAuth) l.handle = (rq, rs, next) => { rq.user = { id: "u1" }; next(); };
  }
  const app = express();
  app.use(express.json());
  app.use("/api/corporate-contacts", router);
  await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise((r) => server.close(r)); });

const client = () => createCorporateContactsClient({ fetchImpl: fetch, getToken: () => "tok", apiBase: base });

test("delete via the real router, then the FE client reads the log: date, category and count only", { skip }, async () => {
  const c = client();
  assert.equal((await c.listDeletionLog(ORG)).entries.length, 0, "empty before any delete");
  assert.equal((await c.deleteContact(ORG, "ct_1")).ok, true);
  assert.equal((await c.deleteContact(ORG, "ct_2")).ok, true);
  const r = await c.listDeletionLog(ORG);
  assert.equal(r.ok, true);
  assert.equal(r.entries.length, 2);
  for (const e of r.entries) {
    assert.deepEqual(Object.keys(e).sort(), ["category", "count", "date"]);
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(e.count, 1);
  }
  assert.deepEqual(r.entries.map((e) => e.category).sort(), ["client", "employee"]);
  const blob = JSON.stringify(r);
  for (const pii of ["Ada", "Lovelace", "ada@x.co", "555-1234", "secret note", "Grace", "grace@x.co", "ct_1", "ct_2", "u1"]) assert.ok(!blob.includes(pii), `${pii} must not reach the client`);
  assert.equal((await c.deleteContact(ORG, "ct_1")).notFound, true, "the contact is really gone");
});

test("the raw wire shape is { ok, data:{ entries } } and the client hides the history for non-owners and when the flag is off", { skip }, async () => {
  const raw = await (await fetch(`${base}/api/corporate-contacts/organizations/${ORG}/deletion-log?limit=5`)).json();
  assert.equal(raw.ok, true);
  assert.ok(Array.isArray(raw.data.entries));
  role = "viewer";
  const viewer = await client().listDeletionLog(ORG);
  assert.equal(viewer.ok, false);
  assert.equal(viewer.unauthorized, true, "403 -> history hidden");
  role = "owner"; enabled = false;
  const off = await client().listDeletionLog(ORG);
  assert.equal(off.ok, false);
  assert.equal(off.dormant, true, "503 -> history hidden");
  enabled = true;
});
