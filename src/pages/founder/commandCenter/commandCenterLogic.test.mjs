import test from "node:test";
import assert from "node:assert/strict";
import { money, toRow, filterSort, showRank, inactivePeriodsText, readGiftSales, sumGiftSales, STAGE_LABELS } from "./commandCenterLogic.js";

const sp = (id, name, status, rev, direct = 0, override = 0) => ({ salespersonId: id, displayName: name, status, customers: { newInPeriod: 1, total: 2 }, newSubscribers: 1, renewals: 2, revenueMinor: rev, commission: { directMinor: direct, overrideMinor: override } });

test("money: minor units to dollars", () => {
  assert.equal(money(40600), "$406.00"); assert.equal(money(-300), "-$3.00"); assert.equal(money(undefined), "—");
});
test("row: commission is direct + override only; gift sales are a separate informational figure", () => {
  const r = toRow(sp("a", "A", "active", 1000, 300, 50), { count: 4, grossGiftVolumeMinor: 9999 });
  assert.equal(r.commissionMinor, 350);
  assert.equal(r.giftOrders, 4); assert.equal(r.giftGrossMinor, 9999);
  assert.deepEqual(Object.keys(r).filter((k) => /commission/i.test(k)), ["commissionMinor"], "no gift commission field exists");
  assert.equal(toRow(sp("a", "A", "active", 0)).giftOrders, null, "no gift read => null, shown as a dash");
});
test("filter, sort, rank", () => {
  const rows = [toRow(sp("a", "Zed", "active", 100)), toRow(sp("b", "Amy", "inactive", 900)), toRow(sp("c", "Bob", "active", 500))];
  assert.deepEqual(filterSort(rows, { sortKey: "revenue", dir: "desc" }).map((r) => r.salespersonId), ["b", "c", "a"]);
  assert.deepEqual(filterSort(rows, { status: "active", sortKey: "name", dir: "asc" }).map((r) => r.salespersonId), ["c", "a"]);
  assert.equal(filterSort(rows, { q: "am" }).length, 1);
  assert.equal(showRank("revenue", "desc"), true); assert.equal(showRank("name", "desc"), false); assert.equal(showRank("revenue", "asc"), false);
});
test("gift sales envelope: only a well-formed informational result is accepted", () => {
  assert.equal(readGiftSales({ ok: false }).ok, false);
  assert.equal(readGiftSales({ ok: true, data: { giftSales: { count: "x" } } }).ok, false);
  const g = readGiftSales({ ok: true, data: { giftSales: { count: 2, grossGiftVolumeMinor: 500, byType: [] } } });
  assert.deepEqual([g.ok, g.count, g.grossGiftVolumeMinor], [true, 2, 500]);
  assert.deepEqual(sumGiftSales({ a: g, b: { ok: false }, c: g }), { count: 4, gross: 1000, loaded: 2 });
});
test("plain-words stage labels carry no internal state names and no Paid stage", () => {
  assert.deepEqual(Object.values(STAGE_LABELS), ["Waiting for approval", "Approved (not paid out)", "Reversed (refund)"]);
  assert.equal(inactivePeriodsText([{ from: "2026-08-01T00:00:00Z", to: null }])[0], "2026-08-01 to now");
});
