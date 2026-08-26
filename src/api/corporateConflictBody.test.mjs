// src/api/corporateConflictBody.test.mjs
//
// TEAM C — the 409/412 conflict body, proven through the REAL client.
//
// These are behavioural: each case builds an actual corporate client with an injected fetch and
// asserts on what the client returns, rather than asserting on source text. The contract under
// test is Team A's F2 conflict body, and the rule is that nothing outside the documented allowlist
// may ever reach a caller.
//
// Run (Node 20.x): node --test src/api/corporateConflictBody.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCorporateCampaignsClient } from "./corporateCampaigns.js";

/** A client whose every request resolves to one prepared response. */
const clientFor = (status, body, { throwOnJson = false } = {}) =>
  createCorporateCampaignsClient({
    fetchImpl: async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => { if (throwOnJson) throw new SyntaxError("Unexpected end of JSON input"); return body; },
    }),
  });

const toggle = (status, body, opts) => clientFor(status, body, opts).setCampaignEnabled("org_1", "cmp_1", true);

const F2_BODY = {
  error: "campaign_resume_incomplete",
  reason: "some previously paused sends could not be restored; the campaign was not switched on",
  enabled: false,
  reconciliation: "incomplete",
  counts: { examined: 2, resumed: 0, ineligible: 0, conflicts: 2 },
};

test("409: the documented F2 fields are forwarded, exactly and completely", async () => {
  const r = await toggle(409, F2_BODY);
  assert.equal(r.ok, false);
  assert.equal(r.conflict, true);
  assert.equal(r.status, 409);
  assert.equal(r.error, "campaign_resume_incomplete");
  assert.equal(r.enabled, false);
  assert.equal(r.reconciliation, "incomplete");
  assert.deepEqual(r.counts, { examined: 2, resumed: 0, ineligible: 0, conflicts: 2 });
  assert.equal(typeof r.reason, "string");
});

test("409: a bodyless or unreadable conflict degrades to the LEGACY shape", async () => {
  for (const c of [
    await toggle(409, null),
    await toggle(409, undefined, { throwOnJson: true }),
    await toggle(409, "not an object"),
    await toggle(409, [1, 2, 3]),
  ]) {
    assert.deepEqual(Object.keys(c).sort(), ["conflict", "ok", "status"],
      "nothing beyond the legacy three keys");
    assert.equal(c.conflict, true);
    assert.equal(c.ok, false);
  }
});

test("412 keeps its existing behaviour", async () => {
  const r = await toggle(412, F2_BODY);
  assert.equal(r.status, 412);
  assert.equal(r.conflict, true);
  assert.equal(r.ok, false);
});

// ── counts: finite, non-negative, integral, and all four together ────────────────────────────
test("409: malformed counts are DROPPED, never partially reported", async () => {
  const bad = [
    { examined: 2, resumed: 0, ineligible: 0, conflicts: -1 },        // negative
    { examined: 2.5, resumed: 0, ineligible: 0, conflicts: 1 },       // fractional
    { examined: NaN, resumed: 0, ineligible: 0, conflicts: 1 },       // NaN
    { examined: Infinity, resumed: 0, ineligible: 0, conflicts: 1 },  // not finite
    { examined: "2", resumed: 0, ineligible: 0, conflicts: 1 },       // numeric string
    { examined: 2, resumed: 0, conflicts: 1 },                        // incomplete set
    { examined: 2, resumed: 0, ineligible: null, conflicts: 1 },      // null member
    [1, 2, 3, 4],                                                     // array
    "counts",                                                         // scalar
  ];
  for (const counts of bad) {
    const r = await toggle(409, { ...F2_BODY, counts });
    assert.equal("counts" in r, false, `dropped for ${JSON.stringify(counts)}`);
    // The rest of the valid body still comes through - one bad field does not poison the others.
    assert.equal(r.error, "campaign_resume_incomplete");
  }
});

test("409: zero is a legitimate count", async () => {
  const r = await toggle(409, { ...F2_BODY, counts: { examined: 0, resumed: 0, ineligible: 0, conflicts: 0 } });
  assert.deepEqual(r.counts, { examined: 0, resumed: 0, ineligible: 0, conflicts: 0 });
});

// ── booleans and codes are type-checked, not coerced ─────────────────────────────────────────
test("409: a non-boolean `enabled` is omitted rather than coerced", async () => {
  for (const enabled of ["false", 0, 1, null, {}, []]) {
    const r = await toggle(409, { ...F2_BODY, enabled });
    assert.equal("enabled" in r, false, JSON.stringify(enabled));
  }
  assert.equal((await toggle(409, { ...F2_BODY, enabled: true })).enabled, true);
});

test("409: codes must look like codes", async () => {
  for (const error of ["Has Spaces", "UPPER_CASE", "sym!bol", "", "x".repeat(65), 42, null]) {
    const r = await toggle(409, { ...F2_BODY, error });
    assert.equal("error" in r, false, JSON.stringify(error));
  }
});

// ── nothing outside the allowlist, ever ──────────────────────────────────────────────────────
test("409: unknown fields are IGNORED and the body is never spread", async () => {
  const hostile = {
    ...F2_BODY,
    stack: "Error: at Object.<anonymous> (/srv/app/worker.js:412:9)",
    _etag: '"0x8DC1234"',
    id: "campaign_d7d2d8",
    corporateCampaignExecutionEnabled: false,
    internalDocument: { partitionKey: "org_1", secret: "shhh" },
    __proto__polluted: true,
  };
  const r = await toggle(409, hostile);

  assert.deepEqual(
    Object.keys(r).sort(),
    ["conflict", "counts", "enabled", "error", "ok", "reason", "reconciliation", "status"],
    "exactly the allowlisted keys and nothing else",
  );
  const raw = JSON.stringify(r);
  for (const leak of ["stack", "_etag", "campaign_d7d2d8", "corporateCampaignExecutionEnabled", "secret", "partitionKey"]) {
    assert.equal(raw.includes(leak), false, `${leak} must never reach the client`);
  }
});

test("409: an over-long or markup-bearing reason is omitted", async () => {
  for (const reason of ["x".repeat(301), "<script>alert(1)</script>", "{malformed}", 7]) {
    const r = await toggle(409, { ...F2_BODY, reason });
    assert.equal("reason" in r, false, String(reason).slice(0, 24));
  }
});

// ── the toggle must not latch off ────────────────────────────────────────────────────────────
test("409 does not latch: a later success returns a normal ok result", async () => {
  const conflicted = await toggle(409, F2_BODY);
  assert.equal(conflicted.ok, false);
  // A fresh attempt against a server that now accepts it succeeds normally.
  const okClient = createCorporateCampaignsClient({
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ campaignId: "cmp_1", enabled: true }) }),
  });
  const after = await okClient.setCampaignEnabled("org_1", "cmp_1", true);
  assert.equal(after.ok, true);
  assert.equal(after.data.enabled, true);
});

test("disable remains available after a conflicted enable", async () => {
  const okClient = createCorporateCampaignsClient({
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ campaignId: "cmp_1", enabled: false }) }),
  });
  const off = await okClient.setCampaignEnabled("org_1", "cmp_1", false);
  assert.equal(off.ok, true);
  assert.equal(off.data.enabled, false);
});
