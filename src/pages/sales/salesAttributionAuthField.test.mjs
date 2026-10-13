// src/pages/sales/salesAttributionAuthField.test.mjs — SALES-ATTR-B register/login carry the held code.
//
// The localStorage carrier cannot cross browser profiles or devices, so register and login now send
// the held referral code and the server records the durable pending attribution right then.
//
// Run (Node 20.x): node --test src/pages/sales/salesAttributionAuthField.test.mjs

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

class MemStore {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
  get length() { return this.m.size; }
}
class ThrowingStore {
  getItem() { throw new Error("SecurityError"); }
  setItem() { throw new Error("QuotaExceededError"); }
  removeItem() { throw new Error("SecurityError"); }
}

globalThis.sessionStorage = new MemStore();
globalThis.localStorage = new MemStore();

const { captureToken, readToken, salesAuthField, SALES_ATTRIBUTION_KEY } = await import("./salesAttributionCarrier.js");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUTH = readFileSync(path.join(HERE, "..", "..", "context", "AuthContext.jsx"), "utf8").replace(/\r\n/g, "\n");

const TOKEN = "T".repeat(43);
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  globalThis.sessionStorage = new MemStore();
  globalThis.localStorage = new MemStore();
});

test("a held code yields { salesAttributionCode } and does NOT clear the carrier", () => {
  assert.equal(captureToken(TOKEN), true);
  assert.deepEqual(salesAuthField(), { salesAttributionCode: TOKEN });
  assert.equal(readToken(), TOKEN, "carrier retained; the clear stays at checkout");
});

test("a held vanity slug is sent the same way", () => {
  assert.equal(captureToken("samplerep"), true);
  assert.deepEqual(salesAuthField(), { salesAttributionCode: "samplerep" });
});

test("no held code, an expired code, or blocked storage → {} (field omitted)", () => {
  assert.deepEqual(salesAuthField(), {});
  globalThis.localStorage.setItem(SALES_ATTRIBUTION_KEY,
    JSON.stringify({ code: TOKEN, capturedAt: new Date(Date.now() - 31 * DAY).toISOString() }));
  assert.deepEqual(salesAuthField(), {});
  globalThis.localStorage = new ThrowingStore();
  globalThis.sessionStorage = new ThrowingStore();
  assert.deepEqual(salesAuthField(), {});
});

test("the serialized auth bodies include the field only when held", () => {
  const body = (extra) => JSON.parse(JSON.stringify({ email: "a@b.co", password: "p", ...extra }));
  assert.equal("salesAttributionCode" in body(salesAuthField()), false);
  captureToken(TOKEN);
  assert.equal(body(salesAuthField()).salesAttributionCode, TOKEN);
});

test("AuthContext register AND login both spread salesAuthField() into the request body", () => {
  assert.match(AUTH, /import \{ salesAuthField \} from '\.\.\/pages\/sales\/salesAttributionCarrier\.js';/);
  const login = AUTH.slice(AUTH.indexOf("const login = async"), AUTH.indexOf("const register = async"));
  const register = AUTH.slice(AUTH.indexOf("const register = async"), AUTH.indexOf("const logout = "));
  assert.match(login, /\/api\/auth\/login/);
  assert.match(login, /body: JSON\.stringify\(\{ email, password, \.\.\.salesAuthField\(\) \}\)/);
  assert.match(register, /\/api\/auth\/register/);
  assert.match(register, /body: JSON\.stringify\(\{ name, email, password, \.\.\.salesAuthField\(\) \}\)/);
  // Register/login never clear the sales carrier.
  assert.equal(/clearToken as clearSales|salesAttributionCarrier\.js';[\s\S]*clearToken\(/.test(login + register), false);
});
