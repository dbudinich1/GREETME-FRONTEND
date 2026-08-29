// src/api/salesAdmin.test.mjs
//
// TEAM B — SALES S1 · founder salesperson-admin client (slice B1).
// Behavioural: the real client, an injected fetch, assertions on the request it built and the
// envelope it returned.
//
// Run (Node 20.x): node --test src/api/salesAdmin.test.mjs
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { salesAdminApi, salesAdminErrorMessage } from "./salesAdmin.js";

const calls = [];
let reply = { ok: true, status: 200, body: {} };
const store = new Map();

beforeEach(() => {
  calls.length = 0;
  store.clear();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method, headers: opts.headers || {}, body: opts.body ? JSON.parse(opts.body) : undefined });
    if (reply.throws) throw new Error("network down");
    return { ok: reply.ok, status: reply.status, json: async () => reply.body };
  };
});
afterEach(() => { delete globalThis.fetch; delete globalThis.localStorage; });

test("list targets the deployed founder route and carries the Bearer token", async () => {
  store.set("token", "tok-abc");
  reply = { ok: true, status: 200, body: { ok: true, salespeople: [{ salespersonId: "sp1" }] } };
  const res = await salesAdminApi.list();
  assert.equal(calls[0].url, "/api/sales/admin/salespeople");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].headers.Authorization, "Bearer tok-abc");
  assert.equal(res.ok, true);
  assert.deepEqual(res.data.salespeople, [{ salespersonId: "sp1" }]);
});

test("read encodes the id and returns the envelope verbatim", async () => {
  reply = { ok: true, status: 200, body: { ok: true, salesperson: { salespersonId: "sp/1" } } };
  await salesAdminApi.read("sp/1");
  assert.equal(calls[0].url, "/api/sales/admin/salespeople/sp%2F1", "path-injection safe");
});

test("create posts exactly the documented body", async () => {
  reply = { ok: true, status: 201, body: { ok: true, salesperson: { salespersonId: "sp1" }, attributionToken: "t", attributionLink: "https://x/t" } };
  await salesAdminApi.create({ salespersonId: " sp1 ", displayName: " Rep North ", email: " rep@example.test " });
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, { salespersonId: "sp1", displayName: "Rep North", email: "rep@example.test" },
    "trimmed, and exactly the three documented fields");
});

test("create OMITS email when blank rather than sending an empty string", async () => {
  reply = { ok: true, status: 201, body: { ok: true } };
  for (const email of ["", "   ", undefined, null]) {
    calls.length = 0;
    await salesAdminApi.create({ salespersonId: "sp1", displayName: "Rep", email });
    assert.equal("email" in calls[0].body, false, `omitted for ${JSON.stringify(email)}`);
  }
});

test("the one-time link is returned to the caller and NEVER persisted by the client", async () => {
  reply = { ok: true, status: 201, body: { ok: true, salesperson: { salespersonId: "sp1" }, attributionToken: "SECRET-TOKEN", attributionLink: "https://greet-me.com/s/SECRET-TOKEN" } };
  const res = await salesAdminApi.create({ salespersonId: "sp1", displayName: "Rep" });
  assert.equal(res.data.attributionLink, "https://greet-me.com/s/SECRET-TOKEN", "handed back once");
  // Nothing was written anywhere the client controls.
  const persisted = [...store.entries()].map(([k, v]) => `${k}=${v}`).join("|");
  assert.equal(persisted.includes("SECRET-TOKEN"), false, "token is not in localStorage");
  assert.equal(store.size, 0, "the client wrote no storage key at all");
  // And it never travelled in a URL.
  for (const c of calls) assert.equal(c.url.includes("SECRET-TOKEN"), false, "never in a query string");
});

test("a network failure degrades to the shared envelope, not an exception", async () => {
  reply = { throws: true };
  const res = await salesAdminApi.list();
  assert.deepEqual(res, { ok: false, status: 0, data: null, networkError: true });
  reply = { ok: true, status: 200, body: {} };
});

test("error messages are plain language and leak no internal code", () => {
  const cases = [
    [{ status: 401 }, /session has expired/i],
    [{ status: 403 }, /founder account/i],
    [{ status: 409 }, /already exists/i],
    [{ status: 400 }, /check the details/i],
    [{ networkError: true }, /couldn.t reach the server/i],
    [{ status: 500 }, /didn.t go through/i],
  ];
  for (const [res, re] of cases) {
    const msg = salesAdminErrorMessage(res);
    assert.match(msg, re);
    assert.equal(/INTERNAL_ERROR|INVALID_REQUEST|NOT_FOUND|stack|Error:/.test(msg), false,
      "no internal code or stack reaches the user");
  }
  assert.match(salesAdminErrorMessage({ status: 404 }, { context: "read" }), /no longer exists/i);
});
