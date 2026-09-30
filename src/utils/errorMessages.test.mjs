// src/utils/errorMessages.test.mjs — Run: node --test src/utils/errorMessages.test.mjs
//
// WP-C Fix 2: getErrorMessage()'s DEFAULT fallback now surfaces a real server/caller-provided
// error.message/error.details before falling back to the fully generic copy — but only when it looks
// like real prose, not the `HTTP ${status}` placeholder some call sites fall back to themselves.
//
// errorMessages.js is a plain, dependency-free module — a real unit test, no source-reading needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getErrorMessage } from "./errorMessages.js";
import ERROR_MESSAGES from "./errorMessages.js";

// ===========================================================================
// Unchanged behavior: known codes and status buckets
// ===========================================================================

test("a known error code still returns its specific mapped message, untouched", () => {
  assert.equal(getErrorMessage({ code: "RATE_LIMIT_LOGIN" }), ERROR_MESSAGES.RATE_LIMIT_LOGIN);
  assert.equal(getErrorMessage({ code: "PAYMENT_REQUIRED" }), ERROR_MESSAGES.PAYMENT_REQUIRED);
  assert.equal(getErrorMessage({ code: "VOICE_CLONE_MISSING" }), ERROR_MESSAGES.VOICE_CLONE_MISSING);
});

test("a known code wins even when a real message is also present — the code map is not bypassed", () => {
  assert.equal(
    getErrorMessage({ code: "EMAIL_EXISTS", message: "some unrelated server prose" }),
    ERROR_MESSAGES.EMAIL_EXISTS,
  );
});

test("status 429 with no matching code still returns the generic rate-limit message, even with a real message present", () => {
  assert.equal(getErrorMessage({ status: 429 }), ERROR_MESSAGES.RATE_LIMIT_GENERAL);
  assert.equal(
    getErrorMessage({ status: 429, message: "Too many requests from your account specifically." }),
    ERROR_MESSAGES.RATE_LIMIT_GENERAL,
    "the status-bucket branch runs before the new specific-message fallback and is not overridden by it",
  );
});

test("status >= 500 with no matching code still returns SERVER_ERROR, even with a real message present", () => {
  assert.equal(getErrorMessage({ status: 500 }), ERROR_MESSAGES.SERVER_ERROR);
  assert.equal(getErrorMessage({ status: 503, message: "The upstream provider timed out." }), ERROR_MESSAGES.SERVER_ERROR);
});

// ===========================================================================
// The new behavior: an unknown code with real prose
// ===========================================================================

test("an unknown code WITH a real error.message returns that message", () => {
  assert.equal(
    getErrorMessage({ code: "SOME_CODE_NOT_IN_THE_MAP", message: "Your gift card balance could not be verified." }),
    "Your gift card balance could not be verified.",
  );
});

test("no code at all, but a real error.message, still surfaces it", () => {
  assert.equal(getErrorMessage({ message: "The recipient's address could not be validated." }),
    "The recipient's address could not be validated.");
});

test("error.details is used when error.message is absent", () => {
  assert.equal(getErrorMessage({ details: "Delivery window has already closed." }),
    "Delivery window has already closed.");
});

test("error.message is preferred over error.details when both are present", () => {
  assert.equal(
    getErrorMessage({ message: "Message wins.", details: "Details loses." }),
    "Message wins.",
  );
});

test("a message is trimmed before being surfaced", () => {
  assert.equal(getErrorMessage({ message: "  Leading and trailing whitespace.  " }), "Leading and trailing whitespace.");
});

// ===========================================================================
// Fallback to DEFAULT: no message, an HTTP-placeholder message, or an oversized message
// ===========================================================================

test("an unknown code with no message/details falls back to DEFAULT", () => {
  assert.equal(getErrorMessage({ code: "SOME_CODE_NOT_IN_THE_MAP" }), ERROR_MESSAGES.DEFAULT);
});

test("a whitespace-only message is treated as no message", () => {
  assert.equal(getErrorMessage({ message: "   " }), ERROR_MESSAGES.DEFAULT);
});

test("the api.js HTTP-status placeholder ('HTTP 404', 'HTTP 500', ...) is excluded and falls back to DEFAULT", () => {
  assert.equal(getErrorMessage({ message: "HTTP 404" }), ERROR_MESSAGES.DEFAULT);
  assert.equal(getErrorMessage({ message: "HTTP 500" }), ERROR_MESSAGES.DEFAULT);
  assert.equal(getErrorMessage({ status: 404, message: "HTTP 404" }), ERROR_MESSAGES.DEFAULT);
});

test("a message that merely CONTAINS 'HTTP 500' text but isn't exactly that placeholder is still real prose", () => {
  // The exclusion is `/^HTTP \d+$/` — an exact match — not a substring ban.
  assert.equal(
    getErrorMessage({ message: "The order failed upstream (HTTP 500 from the provider)." }),
    "The order failed upstream (HTTP 500 from the provider).",
  );
});

test("an overlong message (>300 chars) is treated as not-real-prose and falls back to DEFAULT", () => {
  const long = "x".repeat(301);
  assert.equal(getErrorMessage({ message: long }), ERROR_MESSAGES.DEFAULT);
  const atLimit = "x".repeat(300);
  assert.equal(getErrorMessage({ message: atLimit }), atLimit, "exactly 300 chars is still accepted");
});

test("a non-string message/details (object, number) is ignored, not surfaced", () => {
  assert.equal(getErrorMessage({ message: { nested: "object" } }), ERROR_MESSAGES.DEFAULT);
  assert.equal(getErrorMessage({ message: 404 }), ERROR_MESSAGES.DEFAULT);
});

test("no error, or a completely empty error, never throws and falls back to DEFAULT", () => {
  assert.equal(getErrorMessage(undefined), ERROR_MESSAGES.DEFAULT);
  assert.equal(getErrorMessage(null), ERROR_MESSAGES.DEFAULT);
  assert.equal(getErrorMessage({}), ERROR_MESSAGES.DEFAULT);
});
