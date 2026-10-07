// src/utils/browserTimezoneSync.test.mjs
// CL-03 (Release 1 FE): browser timezone sync. Run (Node 20.x): node --test src/utils/browserTimezoneSync.test.mjs

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { syncBrowserTimezone, __resetBrowserTimezoneSyncForTests } from "./browserTimezoneSync.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function fakeSessionStorage() {
  const m = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

beforeEach(() => { fakeSessionStorage(); __resetBrowserTimezoneSyncForTests(); });

const recorder = (impl) => {
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push({ url, options }); return impl ? impl() : { ok: true, json: async () => ({ ok: true, changed: true }) }; };
  return { calls, fetchImpl };
};

test("sends { timezone, source: 'browser' } when timezoneSource is absent or null", async () => {
  const expected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  for (const profile of [{ name: "A" }, { timezoneSource: null, timezone: null }]) {
    __resetBrowserTimezoneSyncForTests();
    const r = recorder();
    await syncBrowserTimezone({ profile, token: "tok", apiBase: "https://api.test", fetchImpl: r.fetchImpl });
    assert.equal(r.calls.length, 1);
    const { url, options } = r.calls[0];
    assert.equal(url, "https://api.test/api/profile/timezone");
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers.Authorization, "Bearer tok");
    assert.deepEqual(JSON.parse(options.body), { timezone: expected, source: "browser" });
  }
});

test("never sends when timezoneSource is present (browser or user)", async () => {
  for (const timezoneSource of ["browser", "user"]) {
    const r = recorder();
    await syncBrowserTimezone({ profile: { timezone: "America/Chicago", timezoneSource }, token: "tok", apiBase: "", fetchImpl: r.fetchImpl });
    assert.equal(r.calls.length, 0);
  }
});

test("does not send without a profile or token (logged-out)", async () => {
  const r = recorder();
  await syncBrowserTimezone({ profile: null, token: "tok", fetchImpl: r.fetchImpl });
  await syncBrowserTimezone({ profile: {}, token: null, fetchImpl: r.fetchImpl });
  assert.equal(r.calls.length, 0);
});

test("not twice per session (repeated profile hydrations send once)", async () => {
  const r = recorder();
  const args = { profile: { timezoneSource: null }, token: "tok", apiBase: "", fetchImpl: r.fetchImpl };
  await syncBrowserTimezone(args);
  await syncBrowserTimezone(args);
  await syncBrowserTimezone(args);
  assert.equal(r.calls.length, 1);
});

test("not twice per session even when sessionStorage is unavailable", async () => {
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
  __resetBrowserTimezoneSyncForTests();
  const r = recorder();
  const args = { profile: {}, token: "tok", apiBase: "", fetchImpl: r.fetchImpl };
  await syncBrowserTimezone(args);
  await syncBrowserTimezone(args);
  assert.equal(r.calls.length, 1);
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, writable: true, value: undefined });
});

test("silent on failure: network rejection, non-ok response and thrown errors never propagate", async () => {
  __resetBrowserTimezoneSyncForTests();
  const rej = await syncBrowserTimezone({ profile: {}, token: "t", fetchImpl: async () => { throw new TypeError("Failed to fetch"); } });
  assert.equal(rej, false);
  __resetBrowserTimezoneSyncForTests();
  await assert.doesNotReject(syncBrowserTimezone({ profile: {}, token: "t", fetchImpl: async () => ({ ok: false, status: 500, json: async () => { throw new Error("x"); } }) }));
  await assert.doesNotReject(syncBrowserTimezone());
});

test("wiring: AuthContext calls it once from the profile hydration, after setUser, never awaited", () => {
  const src = readFileSync(join(__dirname, "..", "context", "AuthContext.jsx"), "utf8");
  assert.ok(src.includes("from '../utils/browserTimezoneSync'"));
  assert.equal((src.match(/syncBrowserTimezone\(/g) || []).length, 1);
  assert.equal(/await\s+syncBrowserTimezone/.test(src), false);
  const hydrate = src.slice(src.indexOf("const fetchAndHydrateProfile"), src.indexOf("const refreshProfile"));
  assert.ok(hydrate.indexOf("setUser(updatedUser)") < hydrate.indexOf("syncBrowserTimezone("));
  assert.ok(hydrate.includes("profile: data.profile"));
});
