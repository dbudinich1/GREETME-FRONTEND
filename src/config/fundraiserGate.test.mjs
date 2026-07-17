// fundraiserGate.test.mjs — TEAM B. Run: node --test src/config/fundraiserGate.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { isFundraiserUiEnabled } from "./fundraiserGate.js";

test("gate defaults to FALSE when VITE_FUNDRAISER_ENABLED is absent (dark)", () => {
  // In a plain node context import.meta.env is undefined ⇒ the gate must fail closed to false.
  assert.equal(isFundraiserUiEnabled(), false);
});
