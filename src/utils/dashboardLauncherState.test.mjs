// src/utils/dashboardLauncherState.test.mjs
// Run (Node 20.x): node --test src/utils/dashboardLauncherState.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { saveLauncherState, readLauncherState, clearLauncherState, LAUNCHER_STATE_KEY, LAUNCHER_STATE_MAX_AGE_MS } from "./dashboardLauncherState.js";

function memStorage({ maxChars = Infinity } = {}) {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (String(v).length > maxChars) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => m.delete(k), _m: m,
  };
}
const CHOICES = { mode: "occasion", occasions: ["Birthday", "Anniversary"], audience: "one", picks: ["c1"], excluded: [], words: "Hi", memoryPhotos: ["data:image/png;base64," + "A".repeat(5000)], gift: null, whoDone: true, persDone: false, rows: { "c1:Anniversary": { type: "anniversary", date: "2026-06-20", gift: null } }, groupDefaultGift: null, datesOpen: true };

test("kept for the same account, read back exactly", () => {
  const s = memStorage();
  assert.equal(saveLauncherState(s, "u1", CHOICES, 1000), "all");
  const r = readLauncherState(s, "u1", 2000);
  for (const k of Object.keys(CHOICES)) assert.deepEqual(r[k], CHOICES[k], k);
});

test("never restored for another account, without an account, after two hours, or from a future time", () => {
  const s = memStorage();
  saveLauncherState(s, "u1", CHOICES, 1000);
  assert.equal(readLauncherState(s, "u2", 2000), null, "another account");
  assert.equal(readLauncherState(s, null, 2000), null, "no account");
  assert.equal(readLauncherState(s, "u1", 1000 + LAUNCHER_STATE_MAX_AGE_MS + 1), null, "too old");
  assert.equal(readLauncherState(s, "u1", 500), null, "clock went backwards");
  assert.equal(saveLauncherState(s, null, CHOICES), "none", "nothing kept without an account");
});

test("photos too large for the device: the other choices are kept without them, and that is reported", () => {
  const s = memStorage({ maxChars: 3000 });
  assert.equal(saveLauncherState(s, "u1", CHOICES, 1000), "without_photos");
  const r = readLauncherState(s, "u1", 2000);
  assert.deepEqual(r.memoryPhotos, []); assert.equal(r.photosDropped, 1);
  assert.deepEqual(r.occasions, ["Birthday", "Anniversary"]);
});

test("cleared after use; unreadable data is ignored", () => {
  const s = memStorage();
  saveLauncherState(s, "u1", CHOICES, 1000);
  clearLauncherState(s);
  assert.equal(s.getItem(LAUNCHER_STATE_KEY), null);
  s.setItem(LAUNCHER_STATE_KEY, "{not json");
  assert.equal(readLauncherState(s, "u1", 2000), null);
});
