// src/api/thankYouSendRequestId.test.mjs — Team 4 growth-loops verification, 2026-09-29.
//
// Proves Required Test #3 (Thank-You submission is idempotent) has the wire-level ingredient it
// depends on: api.submitThankYouGreeting actually forwards the caller's sendRequestId to the
// backend's GATE B idempotency key (services/send/sendRequestIdentity.js on the backend side),
// rather than silently dropping it the way the pre-fix version did.
//
// Run (Node 18+): node --test src/api/thankYouSendRequestId.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

test("submitThankYouGreeting forwards sendRequestId in the POST body", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, jobId: "job_thankyou_1" }),
    };
  };

  const { default: api } = await import("./api.js");

  const sendRequestId = "11111111-2222-4333-8444-555555555555";
  await api.submitThankYouGreeting({
    recipientName: "Original Sender",
    recipientEmail: "sender@example.com",
    tone: "warm",
    script: "Thank you so much!",
    sourceJobId: "job_original_1",
    sendRequestId,
  });

  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.sendRequestId, sendRequestId, "sendRequestId must reach the request body verbatim");
  assert.equal(body.sourceJobId, "job_original_1");
  assert.equal(body.occasionKey, "thank-you");
});

test("submitThankYouGreeting sends the SAME sendRequestId across a retried attempt", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(options);
    return { ok: true, status: 200, json: async () => ({ ok: true, jobId: "job_thankyou_2" }) };
  };

  const { default: api } = await import("./api.js");

  // Mirrors ThankYouFlow.jsx: one id minted once, reused on every send attempt for the
  // same composed thank-you (a failed first attempt followed by a user-initiated retry).
  const sendRequestId = "99999999-8888-4777-8666-555555555555";
  const payload = {
    recipientName: "Original Sender",
    recipientEmail: "sender@example.com",
    tone: "warm",
    script: "Thanks again!",
    sourceJobId: "job_original_2",
    sendRequestId,
  };

  await api.submitThankYouGreeting(payload);
  await api.submitThankYouGreeting(payload); // simulated retry, same id

  assert.equal(calls.length, 2);
  const first = JSON.parse(calls[0].body).sendRequestId;
  const second = JSON.parse(calls[1].body).sendRequestId;
  assert.equal(first, sendRequestId);
  assert.equal(second, sendRequestId);
  assert.equal(first, second, "retrying the same composed thank-you must reuse one stable id");
});
