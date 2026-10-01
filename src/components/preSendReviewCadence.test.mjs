// Run: node --test src/components/preSendReviewCadence.test.mjs
// W04: the review shows the occasion separately from the cadence ("Birthday · One-time send")
// and never implies the immediate composer is scheduled or recurring. Source-structure test
// (the modal is not mountable under node --test in this codebase).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "PreSendReviewModal.jsx"), "utf8");

test("occasion and cadence render as separate elements", () => {
  assert.match(SRC, /data-testid="review-occasion">\{occasionLabel \|\| 'Just Because'\}<\/span>/);
  assert.match(SRC, /data-testid="review-cadence"> &middot; One-time send<\/span>/);
});

test("the modal never calls the immediate composer scheduled or recurring", () => {
  const visible = SRC.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(visible, /Repeats|recurring|Scheduled for|Schedule the/i);
});

