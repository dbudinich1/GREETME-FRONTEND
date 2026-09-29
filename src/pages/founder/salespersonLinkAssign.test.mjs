// src/pages/founder/salespersonLinkAssign.test.mjs
//
// Pure state model for the "link this salesperson's own Greet-Me account" panel. No DOM, no
// network. Mirrors src/pages/fundraiser/partnerAdminAssign.test.mjs's own conventions.
// Run: node --test src/pages/founder/salespersonLinkAssign.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { STATES, resolveOutcome, LINK_STATES, linkOutcome, linkMessageFor, canLink } from "./salespersonLinkAssign.js";

const env = (status, data, extra = {}) => ({ ok: status >= 200 && status < 300, status, data, ...extra });
const ACCOUNT = { userId: "8687052f-64cb-4e05-a49d-16e38605af27", email: "rarerudy@gmail.com", emailVerified: true, isFounder: false };

// ── resolveOutcome is reused verbatim from partnerAdminAssign.js — a smoke check, not a re-audit ──

test("resolveOutcome (reused) still maps a well-formed 200 to RESOLVED", () => {
  const out = resolveOutcome(env(200, ACCOUNT));
  assert.equal(out.state, STATES.RESOLVED);
  assert.deepEqual(out.account, ACCOUNT);
});

// ── linkOutcome ──

test("linkOutcome: 200 ⇒ LINKED", () => {
  const out = linkOutcome(env(200, { ok: true, salesperson: { salespersonId: "sp-1", linkedUserId: ACCOUNT.userId } }));
  assert.equal(out.state, LINK_STATES.LINKED);
  assert.equal(out.reason, null);
});

test("linkOutcome: 400 ⇒ LINK_FAILED/invalid_user, 404 ⇒ salesperson_not_found, 409 ⇒ already_linked, 403 ⇒ forbidden", () => {
  assert.deepEqual(linkOutcome(env(400, {})), { state: LINK_STATES.LINK_FAILED, reason: "invalid_user" });
  assert.deepEqual(linkOutcome(env(404, {})), { state: LINK_STATES.LINK_FAILED, reason: "salesperson_not_found" });
  assert.deepEqual(linkOutcome(env(409, { reason: "USER_ALREADY_LINKED" })), { state: LINK_STATES.LINK_FAILED, reason: "already_linked" });
  assert.deepEqual(linkOutcome(env(403, {})), { state: LINK_STATES.LINK_FAILED, reason: "forbidden" });
});

test("linkOutcome: network failure and unexpected statuses fail closed to service_failure", () => {
  assert.deepEqual(linkOutcome({ ok: false, status: 0, data: null, networkError: true }), { state: LINK_STATES.LINK_FAILED, reason: "service_failure" });
  assert.deepEqual(linkOutcome(env(500, {})), { state: LINK_STATES.LINK_FAILED, reason: "service_failure" });
  assert.deepEqual(linkOutcome(env(503, {})), { state: LINK_STATES.LINK_FAILED, reason: "service_failure" });
  assert.deepEqual(linkOutcome(null), { state: LINK_STATES.LINK_FAILED, reason: "service_failure" });
  assert.deepEqual(linkOutcome(undefined), { state: LINK_STATES.LINK_FAILED, reason: "service_failure" });
});

// ── linkMessageFor — never claims success on a failure ──

test("linkMessageFor: every LINK_FAILED reason gets its own truthful sentence", () => {
  const reasons = ["invalid_user", "salesperson_not_found", "already_linked", "forbidden", "service_failure", "something_new"];
  const seen = new Set();
  for (const r of reasons) {
    const msg = linkMessageFor(LINK_STATES.LINK_FAILED, r);
    assert.equal(typeof msg, "string");
    assert.ok(msg.length > 0);
    assert.ok(!/succe|linked\.$/i.test(msg) || r === "already_linked", `must not claim success for reason=${r}: "${msg}"`);
    seen.add(msg);
  }
  // Distinct reasons should mostly produce distinct copy (not everything collapsed to one string).
  assert.ok(seen.size >= 4);
});

test("linkMessageFor: LINKED and UNLINKED are the only states that claim success", () => {
  assert.equal(linkMessageFor(LINK_STATES.LINKED, null), "Account linked.");
  assert.equal(linkMessageFor(LINK_STATES.UNLINKED, null), "Account unlinked.");
});

// ── canLink — no founder exclusion, unlike canAssign ──

test("canLink: true only for a RESOLVED state with a real userId", () => {
  assert.equal(canLink(STATES.RESOLVED, ACCOUNT), true);
  assert.equal(canLink(STATES.RESOLVED, { ...ACCOUNT, userId: "" }), false);
  assert.equal(canLink(STATES.RESOLVED, null), false);
  assert.equal(canLink(STATES.EMPTY, ACCOUNT), false);
  assert.equal(canLink(STATES.AMBIGUOUS, ACCOUNT), false);
});

test("canLink: unlike canAssign, a resolved FOUNDER account is still linkable", () => {
  assert.equal(canLink(STATES.RESOLVED, { ...ACCOUNT, isFounder: true }), true);
});
