// src/utils/addRecipientEntry.test.mjs — the one Add Recipient entry/return contract (lane 1, 2026-10-28).
// Run (Node 20): node --test src/utils/addRecipientEntry.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addRecipientEntry, readAddRecipientReturn, safeRecipientId, sendReturnPath, readAddedContactId,
  noteAddedRecipientForDashboard, picksWithAddedRecipient,
} from "./addRecipientEntry.js";
import { saveLauncherState, readLauncherState, LAUNCHER_STATE_KEY } from "./dashboardLauncherState.js";

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test("every entry opens the same Recipients dialog; only known return targets are carried", () => {
  assert.deepEqual(addRecipientEntry(), { to: "/dashboard/contacts", opts: { state: { openAddRecipient: true } } });
  assert.deepEqual(addRecipientEntry("dashboard").opts.state, { openAddRecipient: true, returnTo: "dashboard" });
  assert.deepEqual(addRecipientEntry("send").opts.state, { openAddRecipient: true, returnTo: "send" });
  assert.deepEqual(addRecipientEntry("https://evil.test").opts.state, { openAddRecipient: true });
  assert.equal(readAddRecipientReturn({ returnTo: "send" }), "send");
  assert.equal(readAddRecipientReturn({ returnTo: "dashboard" }), "dashboard");
  assert.equal(readAddRecipientReturn({ returnTo: "/elsewhere" }), null);
  assert.equal(readAddRecipientReturn(null), null);
});

test("ids: only plain server ids pass; the send return URL carries one", () => {
  assert.equal(safeRecipientId("abc-123_X"), "abc-123_X");
  assert.equal(safeRecipientId(42), "42");
  for (const bad of ["", "a b", "<x>", "a&b=c", null, undefined, {}, "x".repeat(101)]) assert.equal(safeRecipientId(bad), null, String(bad));
  assert.equal(sendReturnPath(), "/dashboard/send?returnTo=send");
  assert.equal(sendReturnPath("new-1"), "/dashboard/send?returnTo=send&addedContactId=new-1");
  assert.equal(sendReturnPath("<bad>"), "/dashboard/send?returnTo=send");
  assert.equal(readAddedContactId("?returnTo=send&addedContactId=new-1"), "new-1");
  assert.equal(readAddedContactId("?returnTo=send&addedContactId=%3Cx%3E"), null);
  assert.equal(readAddedContactId(""), null);
});

test("the added id is written only into this account's current launcher snapshot", () => {
  const s = mem();
  assert.equal(noteAddedRecipientForDashboard(s, "u1", "new-1"), false, "no snapshot: nothing written");
  assert.equal(s.getItem(LAUNCHER_STATE_KEY), null);
  saveLauncherState(s, "u1", { picks: ["c1"], occasions: ["Birthday"] });
  assert.equal(noteAddedRecipientForDashboard(s, "u2", "new-1"), false, "another account's snapshot is untouched");
  assert.equal(noteAddedRecipientForDashboard(s, "u1", "<bad>"), false);
  assert.equal(noteAddedRecipientForDashboard(s, "u1", "new-1"), true);
  const snap = readLauncherState(s, "u1");
  assert.equal(snap.addedRecipientId, "new-1");
  assert.deepEqual(snap.picks, ["c1"], "kept choices unchanged");
});

test("Home selects the new person only where its own rules allow", () => {
  const base = { picks: ["c1"], audience: "one", occasions: ["Birthday"], addedId: "new-1", max: 10 };
  assert.deepEqual(picksWithAddedRecipient(base), ["c1", "new-1"]);
  assert.deepEqual(picksWithAddedRecipient({ ...base, picks: [] }), ["new-1"]);
  assert.deepEqual(picksWithAddedRecipient({ ...base, addedId: null }), ["c1"]);
  assert.deepEqual(picksWithAddedRecipient({ ...base, picks: ["new-1"] }), ["new-1"], "never twice");
  assert.deepEqual(picksWithAddedRecipient({ ...base, audience: "family" }), ["c1"], "a group audience is left as chosen");
  assert.deepEqual(picksWithAddedRecipient({ ...base, occasions: ["Birthday", "Anniversary"] }), ["c1"], "several occasions: one person only");
  assert.deepEqual(picksWithAddedRecipient({ ...base, occasions: ["Birthday", "Anniversary"], picks: [] }), ["new-1"]);
  assert.deepEqual(picksWithAddedRecipient({ ...base, picks: Array.from({ length: 10 }, (_, i) => `p${i}`) }).length, 10, "group limit");
  assert.deepEqual(picksWithAddedRecipient({ ...base, picks: "junk" }), ["new-1"]);
});
