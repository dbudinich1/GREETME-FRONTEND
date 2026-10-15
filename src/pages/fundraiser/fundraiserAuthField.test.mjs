// src/pages/fundraiser/fundraiserAuthField.test.mjs — F-1: register/login carry the held fundraiser token.
//
// Mandatory email verification opens a NEW TAB with an empty sessionStorage, so the per-tab carrier
// alone loses the supporter's attribution. Register and login now send the held token (flag-gated
// exactly like Checkout) and the server records a durable pending attribution right then.
//
// Run (Node 20.x): node --test src/pages/fundraiser/fundraiserAuthField.test.mjs

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
class ThrowingStore {
  getItem() { throw new Error("SecurityError"); }
  setItem() { throw new Error("QuotaExceededError"); }
  removeItem() { throw new Error("SecurityError"); }
}
beforeEach(() => { globalThis.sessionStorage = fakeStorage(); });

const { captureToken, readToken, fundraiserAuthField, FUNDRAISER_ATTRIBUTION_KEY } = await import("./attributionCarrier.js");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUTH = readFileSync(path.join(HERE, "..", "..", "context", "AuthContext.jsx"), "utf8").replace(/\r\n/g, "\n");
const TOK = "ftk_ABCdef012345_-";

test("gate ON + held token ⇒ { fundraiserAttributionToken } and the carrier is NOT cleared", () => {
  assert.equal(captureToken(TOK), true);
  assert.deepEqual(fundraiserAuthField({ flagEnabled: true }), { fundraiserAttributionToken: TOK });
  assert.equal(readToken(), TOK, "carrier retained; the clear stays at the checkout success boundary");
});

test("gate OFF ⇒ {} even with a held token (dormant: never submitted)", () => {
  captureToken(TOK);
  assert.deepEqual(fundraiserAuthField({ flagEnabled: false }), {});
  assert.deepEqual(fundraiserAuthField(), {});
  assert.deepEqual(fundraiserAuthField({ flagEnabled: "true" }), {}, "only a strict boolean true opens it");
});

test("no token, a corrupted stored value, or blocked storage ⇒ {} (field omitted)", () => {
  assert.deepEqual(fundraiserAuthField({ flagEnabled: true }), {});
  sessionStorage.setItem(FUNDRAISER_ATTRIBUTION_KEY, "garbage");
  assert.deepEqual(fundraiserAuthField({ flagEnabled: true }), {});
  globalThis.sessionStorage = new ThrowingStore();
  assert.deepEqual(fundraiserAuthField({ flagEnabled: true }), {});
});

test("the fragment carries ONLY the opaque token", () => {
  captureToken(TOK);
  assert.deepEqual(Object.keys(fundraiserAuthField({ flagEnabled: true })), ["fundraiserAttributionToken"]);
});

test("serialized register/login bodies include the field only when gate on AND token held", () => {
  const body = (extra) => JSON.parse(JSON.stringify({ email: "a@b.co", password: "p", ...extra }));
  assert.equal("fundraiserAttributionToken" in body(fundraiserAuthField({ flagEnabled: true })), false);
  captureToken(TOK);
  assert.equal("fundraiserAttributionToken" in body(fundraiserAuthField({ flagEnabled: false })), false);
  assert.equal(body(fundraiserAuthField({ flagEnabled: true })).fundraiserAttributionToken, TOK);
});

test("AuthContext register AND login spread fundraiserAuthField gated by isFundraiserUiEnabled()", () => {
  assert.match(AUTH, /import \{ fundraiserAuthField \} from '\.\.\/pages\/fundraiser\/attributionCarrier\.js';/);
  assert.match(AUTH, /import \{ isFundraiserUiEnabled \} from '\.\.\/config\/fundraiserGate\.js';/);
  const login = AUTH.slice(AUTH.indexOf("const login = async"), AUTH.indexOf("const register = async"));
  const register = AUTH.slice(AUTH.indexOf("const register = async"), AUTH.indexOf("const logout = "));
  const FIELD = /\.\.\.fundraiserAuthField\(\{ flagEnabled: isFundraiserUiEnabled\(\) \}\)/;
  assert.match(login, /\/api\/auth\/login/);
  assert.match(login, FIELD);
  assert.match(register, /\/api\/auth\/register/);
  assert.match(register, FIELD);
  // the sales field is still sent, unchanged and independent
  assert.match(login, /\.\.\.salesAuthField\(\)/);
  assert.match(register, /\.\.\.salesAuthField\(\)/);
  // register/login never clear the fundraiser carrier (only logout and checkout success do)
  assert.equal(/clearFundraiserToken\(\)/.test(login + register), false);
});
