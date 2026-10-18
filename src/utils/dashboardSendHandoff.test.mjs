// src/utils/dashboardSendHandoff.test.mjs
//
// Dashboard -> send flow hand-off: occasion matching against the send flow's own options, the four approved
// occasions (three held), and the one-shot words/memory-photos hand-off.
// Run (Node 20.x): node --test src/utils/dashboardSendHandoff.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SEND_OCCASION_OPTIONS, SEND_OCCASION_KEY_OVERRIDES, matchSendOccasion, writeDashboardHandoff, takeDashboardHandoff,
  DASHBOARD_HANDOFF_KEY, HANDOFF_MAX_WORDS, HANDOFF_MAX_PHOTOS,
} from "./dashboardSendHandoff.js";

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}

test("the send flow's occasions: the existing five plus the four approved; the three held ones are absent", () => {
  assert.deepEqual(SEND_OCCASION_OPTIONS, ["Birthday", "Anniversary", "Thank You", "Congratulations", "Just Because", "Wedding", "Baby", "Christmas", "Season's Greetings"]);
  for (const held of ["Hanukkah", "Sympathy", "Engagement"]) assert.equal(SEND_OCCASION_OPTIONS.includes(held), false, held);
  assert.deepEqual(SEND_OCCASION_KEY_OVERRIDES, { Baby: "baby", "Season's Greetings": "holiday" });
});

test("matchSendOccasion returns the page's own option, case-insensitively, or '' for anything else", () => {
  assert.equal(matchSendOccasion("birthday"), "Birthday");
  assert.equal(matchSendOccasion("Season's Greetings"), "Season's Greetings");
  assert.equal(matchSendOccasion("mothers_day"), "");
  assert.equal(matchSendOccasion("Hanukkah"), "", "held occasions never prefill");
  assert.equal(matchSendOccasion(null), "");
});

test("hand-off is read once, only for the same recipient and occasion", () => {
  const s = memStorage();
  assert.equal(writeDashboardHandoff(s, { contactId: "c1", occasion: "Birthday", words: "Happy day", memoryPhotos: ["data:a", "data:b"] }, 1000), "all");
  assert.equal(takeDashboardHandoff(s, { contactId: "c2", occasion: "Birthday" }, 2000), null, "another recipient never receives it");
  assert.equal(s.getItem(DASHBOARD_HANDOFF_KEY), null, "and it is removed even on a mismatch");
  writeDashboardHandoff(s, { contactId: "c1", occasion: "Birthday", words: "Happy day", memoryPhotos: ["data:a"] }, 1000);
  assert.deepEqual(takeDashboardHandoff(s, { contactId: "c1", occasion: "Birthday" }, 2000), { words: "Happy day", memoryPhotos: ["data:a"] });
  assert.equal(takeDashboardHandoff(s, { contactId: "c1", occasion: "Birthday" }, 2000), null, "second read: gone");
});

test("a stale hand-off (over 30 minutes) is ignored", () => {
  const s = memStorage();
  writeDashboardHandoff(s, { contactId: "c1", occasion: "Birthday", words: "x" }, 0);
  assert.equal(takeDashboardHandoff(s, { contactId: "c1", occasion: "Birthday" }, 31 * 60 * 1000), null);
});

test("limits match the send flow: 280 characters, 8 memory photos; nothing to carry writes nothing", () => {
  const s = memStorage();
  writeDashboardHandoff(s, { contactId: "c1", occasion: "Baby", words: "w".repeat(400), memoryPhotos: Array.from({ length: 12 }, (_, i) => `data:${i}`) }, 5);
  const h = takeDashboardHandoff(s, { contactId: "c1", occasion: "Baby" }, 6);
  assert.equal(h.words.length, HANDOFF_MAX_WORDS);
  assert.equal(h.memoryPhotos.length, HANDOFF_MAX_PHOTOS);
  writeDashboardHandoff(s, { contactId: "c1", occasion: "Baby", words: "   ", memoryPhotos: [] }, 5);
  assert.equal(s.getItem(DASHBOARD_HANDOFF_KEY), null);
});

test("a full or unavailable storage reports what was not carried instead of pretending", () => {
  const broken = { setItem: () => { throw new Error("QuotaExceeded"); }, removeItem: () => {}, getItem: () => null };
  assert.equal(writeDashboardHandoff(broken, { contactId: "c1", occasion: "Birthday", words: "x" }), "none");
});

test("a failed write never leaves an older hand-off behind", () => {
  const m = new Map([["gm_dashboard_send_handoff_v1", JSON.stringify({ contactId: "c1", occasion: "Birthday", words: "old", memoryPhotos: ["data:old"], at: 1 })]]);
  const full = { getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => m.delete(k), setItem: () => { throw new Error("QuotaExceeded"); } };
  assert.equal(writeDashboardHandoff(full, { contactId: "c1", occasion: "Birthday", words: "", memoryPhotos: ["data:big"] }, 2), "none");
  assert.equal(m.has(DASHBOARD_HANDOFF_KEY), false);
});

test("when the photos do not fit, the words are still carried", () => {
  const m = new Map();
  const tight = { getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => m.delete(k),
    setItem: (k, v) => { if (String(v).length > 200) throw new Error("QuotaExceeded"); m.set(k, String(v)); } };
  assert.equal(writeDashboardHandoff(tight, { contactId: "c1", occasion: "Birthday", words: "Happy day", memoryPhotos: ["data:" + "x".repeat(500)] }, 1), "words");
  assert.deepEqual(takeDashboardHandoff(tight, { contactId: "c1", occasion: "Birthday" }, 2), { words: "Happy day", memoryPhotos: [] });
});
