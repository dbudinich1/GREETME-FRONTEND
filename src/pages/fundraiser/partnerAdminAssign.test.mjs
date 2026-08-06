// src/pages/fundraiser/partnerAdminAssign.test.mjs
//
// TEAM B (P2) — pure state model for the partner-administrator panel. No DOM, no network.
// Run: node --test src/pages/fundraiser/partnerAdminAssign.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { STATES, resolveOutcome, assignOutcome, messageFor, canAssign, isAssigned } from "./partnerAdminAssign.js";

const env = (status, data, extra = {}) => ({ ok: status >= 200 && status < 300, status, data, ...extra });
const ACCOUNT = { userId: "84ffe4c4-f4e4-4bbc-b0fd-23e385f34927", email: "info@njmediationservice.com", emailVerified: true, isFounder: false };

// ── resolve ──

test("P2: a well-formed 200 ⇒ RESOLVED carrying only the four approved fields", () => {
  const out = resolveOutcome(env(200, ACCOUNT));
  assert.equal(out.state, STATES.RESOLVED);
  assert.deepEqual(Object.keys(out.account).sort(), ["email", "emailVerified", "isFounder", "userId"]);
  assert.deepEqual(out.account, ACCOUNT);
});

test("P2: extra fields in the response are discarded, never carried into the UI", () => {
  const out = resolveOutcome(env(200, { ...ACCOUNT, passwordHash: "SECRET", name: "Person", plan: "founder", tier: "founder" }));
  assert.deepEqual(Object.keys(out.account).sort(), ["email", "emailVerified", "isFounder", "userId"]);
  assert.ok(!JSON.stringify(out).includes("SECRET"));
  assert.ok(!JSON.stringify(out).includes("Person"));
  assert.equal(out.account.isFounder, false, "isFounder comes from the approved field, not a stray plan/tier");
});

test("P2: 400 ⇒ INVALID_EMAIL, 404 ⇒ NOT_FOUND, 409 ⇒ AMBIGUOUS", () => {
  assert.equal(resolveOutcome(env(400, { code: "INVALID_EMAIL" })).state, STATES.INVALID_EMAIL);
  assert.equal(resolveOutcome(env(404, { code: "USER_NOT_FOUND" })).state, STATES.NOT_FOUND);
  assert.equal(resolveOutcome(env(409, { code: "EMAIL_AMBIGUOUS" })).state, STATES.AMBIGUOUS);
  for (const s of [400, 404, 409]) assert.equal(resolveOutcome(env(s, {})).account, null, "no account on a failure");
});

test("P2: network failure, 401/403/500/503 ⇒ SERVICE_FAILURE (never a false success)", () => {
  assert.equal(resolveOutcome({ ok: false, status: 0, data: null, networkError: true }).state, STATES.SERVICE_FAILURE);
  for (const s of [401, 403, 500, 502, 503]) assert.equal(resolveOutcome(env(s, {})).state, STATES.SERVICE_FAILURE, `status ${s}`);
  assert.equal(resolveOutcome(null).state, STATES.SERVICE_FAILURE);
  assert.equal(resolveOutcome(undefined).state, STATES.SERVICE_FAILURE);
});

test("P2: a malformed 200 fails closed — a resolved account MUST carry a userId", () => {
  for (const d of [null, undefined, {}, { userId: "" }, { userId: "   " }, { userId: 123 }, { email: "a@b.co" }, []]) {
    const out = resolveOutcome(env(200, d));
    assert.equal(out.state, STATES.SERVICE_FAILURE, `body ${JSON.stringify(d)} must fail closed`);
    assert.equal(out.account, null);
  }
});

test("P2: emailVerified and isFounder are coerced strictly", () => {
  const a = resolveOutcome(env(200, { userId: "u1", email: "a@b.co", emailVerified: "yes", isFounder: 1 })).account;
  assert.equal(a.emailVerified, false, "only a strict true counts");
  assert.equal(a.isFounder, false);
  const b = resolveOutcome(env(200, { userId: "u1", email: "a@b.co", emailVerified: true, isFounder: true })).account;
  assert.equal(b.emailVerified, true);
  assert.equal(b.isFounder, true);
});

// ── assign ──

test("P2: assignment outcomes map to truthful states", () => {
  assert.deepEqual(assignOutcome(env(200, {})), { state: STATES.ASSIGNED, reason: null });
  assert.deepEqual(assignOutcome(env(400, {})), { state: STATES.ASSIGN_FAILED, reason: "invalid_user_id" });
  assert.deepEqual(assignOutcome(env(404, {})), { state: STATES.ASSIGN_FAILED, reason: "user_not_found" });
  assert.deepEqual(assignOutcome(env(409, {})), { state: STATES.ASSIGN_FAILED, reason: "user_is_founder" });
  assert.deepEqual(assignOutcome(env(403, {})), { state: STATES.ASSIGN_FAILED, reason: "forbidden" });
  assert.deepEqual(assignOutcome(env(503, {})), { state: STATES.ASSIGN_FAILED, reason: "dormant" });
  assert.deepEqual(assignOutcome({ ok: false, status: 0, networkError: true }), { state: STATES.ASSIGN_FAILED, reason: "service_failure" });
  assert.equal(assignOutcome(env(500, {})).state, STATES.ASSIGN_FAILED);
});

test("P2: no failure message ever claims success", () => {
  for (const s of [STATES.INVALID_EMAIL, STATES.NOT_FOUND, STATES.AMBIGUOUS, STATES.SERVICE_FAILURE]) {
    const m = messageFor(s);
    assert.ok(m.length > 0);
    assert.ok(!/assigned\.|success/i.test(m), `"${m}" must not read as success`);
  }
  for (const r of ["invalid_user_id", "user_not_found", "user_is_founder", "forbidden", "dormant", "other"]) {
    const m = messageFor(STATES.ASSIGN_FAILED, r);
    assert.ok(m.length > 0);
    assert.ok(!/^Administrator assigned/.test(m));
  }
  assert.equal(messageFor(STATES.ASSIGNED), "Administrator assigned.");
});

test("P2: every failure message states that nothing changed, or names the blocking condition", () => {
  const nothingChanged = [
    messageFor(STATES.SERVICE_FAILURE),
    messageFor(STATES.ASSIGN_FAILED, "invalid_user_id"),
    messageFor(STATES.ASSIGN_FAILED, "user_not_found"),
    messageFor(STATES.ASSIGN_FAILED, "forbidden"),
    messageFor(STATES.ASSIGN_FAILED, "dormant"),
    messageFor(STATES.ASSIGN_FAILED, "other"),
  ];
  for (const m of nothingChanged) assert.match(m, /Nothing was changed\./, `"${m}"`);
  assert.match(messageFor(STATES.ASSIGN_FAILED, "user_is_founder"), /founder account/i);
});

// ── gating + read-back ──

test("P2: assignment is offered ONLY for a resolved, non-founder account", () => {
  assert.equal(canAssign(STATES.RESOLVED, ACCOUNT), true);
  assert.equal(canAssign(STATES.RESOLVED, { ...ACCOUNT, isFounder: true }), false, "founder blocked client-side too");
  assert.equal(canAssign(STATES.RESOLVED, { ...ACCOUNT, userId: "" }), false);
  assert.equal(canAssign(STATES.RESOLVED, null), false);
  for (const s of [STATES.EMPTY, STATES.RESOLVING, STATES.INVALID_EMAIL, STATES.NOT_FOUND, STATES.AMBIGUOUS, STATES.SERVICE_FAILURE, STATES.ASSIGNING, STATES.ASSIGNED, STATES.ASSIGN_FAILED]) {
    assert.equal(canAssign(s, ACCOUNT), false, `must not offer assignment in ${s}`);
  }
});

test("P2: read-back reflects the organization's real adminUserIds", () => {
  assert.equal(isAssigned({ adminUserIds: [ACCOUNT.userId] }, ACCOUNT.userId), true);
  assert.equal(isAssigned({ adminUserIds: ["someone_else"] }, ACCOUNT.userId), false);
  assert.equal(isAssigned({ adminUserIds: [] }, ACCOUNT.userId), false);
  assert.equal(isAssigned({}, ACCOUNT.userId), false);
  assert.equal(isAssigned(null, ACCOUNT.userId), false);
  assert.equal(isAssigned({ adminUserIds: [ACCOUNT.userId] }, ""), false);
});

test("P2: all ten required panel states exist and are distinct", () => {
  const vals = Object.values(STATES);
  assert.equal(vals.length, 10);
  assert.equal(new Set(vals).size, 10);
  for (const k of ["EMPTY", "RESOLVING", "RESOLVED", "INVALID_EMAIL", "NOT_FOUND", "AMBIGUOUS", "SERVICE_FAILURE", "ASSIGNING", "ASSIGNED", "ASSIGN_FAILED"]) {
    assert.ok(STATES[k], `missing state ${k}`);
  }
});

test("P2: the client method posts the email in the BODY, never in the URL", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../../api/fundraiserApi.js", import.meta.url), "utf8");
  assert.match(src, /resolveUserByEmail: \(email\) => post\("\/api\/fundraiser\/admin\/users\/resolve", \{ email \}\)/, "must POST with the email in the body");
  assert.ok(!/users\/resolve\?[^"]*email/.test(src), "the email must never appear in a query string");
  assert.ok(!/users\/resolve\/\$\{/.test(src), "the email must never appear in the path");
});
