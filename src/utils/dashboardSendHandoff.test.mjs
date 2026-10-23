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

test("the send flow's occasions: its own five, Season's Greetings, and the Recipients page's list; nothing outside them", () => {
  assert.deepEqual(SEND_OCCASION_OPTIONS, ["Birthday", "Anniversary", "Thank You", "Congratulations", "Just Because", "Season's Greetings",
    "Graduation", "New Year's Day", "Valentine's Day", "Mother's Day", "Father's Day", "Thanksgiving", "Christmas", "Easter",
    "Rosh Hashanah", "Hanukkah", "Passover", "Eid al-Fitr", "Eid al-Adha", "Ramadan"]);
  for (const absent of ["Sympathy", "Engagement", "Wedding", "Baby", "Get Well"]) assert.equal(SEND_OCCASION_OPTIONS.includes(absent), false, absent);
});

test("greeting keys: a Recipients-list occasion uses the Occasion Scheduler's own identifier (the key a scheduled send uses); Season's Greetings is the generic 'holiday'", () => {
  assert.equal(SEND_OCCASION_KEY_OVERRIDES["Season's Greetings"], "holiday", "never Christmas or another specific holiday");
  for (const [label, key] of [["Christmas", "christmas"], ["Mother's Day", "mothers_day"], ["New Year's Day", "new_year"], ["Valentine's Day", "valentines"], ["Easter", "easter"], ["Hanukkah", "hanukkah"], ["Eid al-Fitr", "eid_al_fitr"], ["Graduation", "graduation"], ["Birthday", "birthday"]]) {
    assert.equal(SEND_OCCASION_KEY_OVERRIDES[label], key, label);
  }
  for (const l of ["Thank You", "Congratulations", "Just Because", "Baby"]) assert.equal(SEND_OCCASION_KEY_OVERRIDES[l], undefined, `${l} keeps the shared normaliser`);
});

test("matchSendOccasion returns the page's own option, case-insensitively, or '' for anything else", () => {
  assert.equal(matchSendOccasion("birthday"), "Birthday");
  assert.equal(matchSendOccasion("Season's Greetings"), "Season's Greetings");
  assert.equal(matchSendOccasion("mothers_day"), "Mother's Day", "a scheduler identifier (reminder links) finds its option");
  assert.equal(matchSendOccasion("Hanukkah"), "Hanukkah");
  assert.equal(matchSendOccasion("Wedding"), "", "not on the Recipients list: no prefill");
  assert.equal(matchSendOccasion("getwell"), "");
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

test("Report 135: dashboardGiftPlaceEntry keeps the recipient and the send page's own occasion; anything missing means the chooser", async () => {
  const { dashboardGiftPlaceEntry } = await import("./dashboardSendHandoff.js");
  const q = (s) => new URLSearchParams(s);
  assert.deepEqual(dashboardGiftPlaceEntry(q("contactId=c1&occasion=Birthday&from=dashboard&gift=choose")), { contactId: "c1", occasion: "Birthday" });
  assert.deepEqual(dashboardGiftPlaceEntry(q("contactId=c1&occasion=Birthday&gift=choose&entry=k9x")), { contactId: "c1", occasion: "Birthday", entry: "k9x" }, "the one-time press marker is kept");
  assert.deepEqual(dashboardGiftPlaceEntry(q("contactId=c1&occasion=mothers_day&gift=choose")), { contactId: "c1", occasion: "Mother's Day" }, "a scheduler identifier maps to the page's label");
  assert.equal(dashboardGiftPlaceEntry(q("contactId=c1&gift=choose")), null, "no occasion");
  assert.equal(dashboardGiftPlaceEntry(q("occasion=Birthday&gift=choose")), null, "no recipient");
  assert.equal(dashboardGiftPlaceEntry(q("contactId=c1&occasion=Hanukkah%20Party&gift=choose")), null, "not one of the page's occasions");
  assert.equal(dashboardGiftPlaceEntry(q("contactId=c1&occasion=Birthday&gift=choose&giftType=qrcash")), null, "the QR Cash entry is its own");
  assert.equal(dashboardGiftPlaceEntry(q("contactId=c1&occasion=Birthday")), null, "no gift request");
});

// Report 136: the one-time "open the QR Cash tab" marker for the dashboard's Add a gift on its QR Cash slide.
import { writeGiftPlaceTab, takeGiftPlaceTab, GIFT_PLACE_TAB_KEY } from "./dashboardSendHandoff.js";
const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };

test("Gift Place tab marker: opens the QR Cash tab once, only for the same entry", () => {
  const s = memStore();
  writeGiftPlaceTab(s, "e1", "qrcash");
  assert.equal(takeGiftPlaceTab(s, "e2"), null, "another entry never opens it");
  writeGiftPlaceTab(s, "e1", "qrcash");
  assert.equal(takeGiftPlaceTab(s, "e1"), "qrcash");
  assert.equal(takeGiftPlaceTab(s, "e1"), null, "read once");
  assert.equal(s.getItem(GIFT_PLACE_TAB_KEY), null);
});

test("Gift Place tab marker: only QR Cash, only with an entry, and not after 30 minutes", () => {
  const s = memStore();
  writeGiftPlaceTab(s, "e1", "flowers");
  assert.equal(s.getItem(GIFT_PLACE_TAB_KEY), null, "no other tab is stored");
  writeGiftPlaceTab(s, "", "qrcash");
  assert.equal(s.getItem(GIFT_PLACE_TAB_KEY), null, "no entry, no marker");
  s.setItem(GIFT_PLACE_TAB_KEY, JSON.stringify({ entry: "e1", tab: "qrcash", at: Date.now() - 31 * 60 * 1000 }));
  assert.equal(takeGiftPlaceTab(s, "e1"), null, "stale");
  assert.equal(takeGiftPlaceTab(null, "e1"), null);
});
