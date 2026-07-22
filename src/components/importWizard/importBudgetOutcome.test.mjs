// src/components/importWizard/importBudgetOutcome.test.mjs — A2 outcome classification.
// The wizard must show a truthful, actionable message for an over-budget stop and must keep every
// existing non-2xx / partial / success outcome unchanged (fail closed — never false success).
// Run: node --test src/components/importWizard/importBudgetOutcome.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCommitOutcome, overBudgetMessage, IMPORT_MAX_COMMITTABLE } from "./wizardModel.js";
import { IMPORT_MAX_COMMITTABLE as CORE_MAX } from "../../import/importCore.js";

test("IMPORT_MAX_COMMITTABLE mirrors importCore (drift lock)", () => {
  assert.equal(IMPORT_MAX_COMMITTABLE, CORE_MAX);
  assert.equal(IMPORT_MAX_COMMITTABLE, 500);
});

test("over-budget → specific truthful limit message (never generic, never success)", () => {
  const out = classifyCommitOutcome({ ok: false, overBudget: true, max: 500, requested: 640, data: { imported: 0, failed: 640, errors: [] } });
  assert.equal(out.status, "error");
  assert.match(out.message, /up to 500 contacts per hour/);
  assert.match(out.message, /640/);
  assert.match(out.message, /split/i);
});

test("overBudgetMessage without a count still states the limit and remedy", () => {
  const m = overBudgetMessage({ max: 500 });
  assert.match(m, /up to 500 contacts per hour/);
  assert.match(m, /separate hours/);
});

test("403 preserved → recipient/import limit message", () => {
  assert.equal(classifyCommitOutcome({ ok: false, status: 403 }).message, "Recipient/import limit reached.");
});

test("429 preserved → too-many-requests message", () => {
  assert.equal(classifyCommitOutcome({ ok: false, status: 429 }).message, "Too many requests. Please wait and try again.");
});

test("other non-2xx preserved → generic failure (fail closed)", () => {
  assert.equal(classifyCommitOutcome({ ok: false, status: 500 }).status, "error");
  assert.equal(classifyCommitOutcome({ ok: false, status: 0 }).status, "error");
});

test("recognized 2xx results body → success summary (unchanged)", () => {
  const out = classifyCommitOutcome({ ok: true, data: { imported: 3, failed: 0, errors: [] } });
  assert.equal(out.status, "success");
  assert.equal(out.summary.added, 3);
});

test("empty 2xx body → fail closed generic (unchanged)", () => {
  assert.equal(classifyCommitOutcome({ ok: true, data: {} }).status, "error");
});
