// src/pages/sendGreetingFlowersWiring.test.mjs
//
// THE SEND-PAGE WIRING FOR A GIFT-PLACE GIFT, asserted against the real source of SendGreeting.jsx.
//
// WHY THIS FILE IS SOURCE-BASED. SendGreeting.jsx is a ~2,900-line page wired to the auth context,
// the shared API client, the cart, the router and the draft service. Mounting it would mean standing
// up five stubs whose fidelity is itself unproven, and the properties below are not about rendering —
// they are about WHICH CALL IS WIRED TO WHICH HANDLER, and about the boolean that decides whether a
// send carries a gift at all. Those are structural claims, and the established way to make them
// executable here is to read the file. The `includeGift` test does not match prose: it EXTRACTS the
// expression and evaluates it for every gift type the selector can produce.
//
// The interaction itself is proven by mounting real components in
// src/components/providerCheckout/sendFlowFlowers.browser.test.mjs.
//
// Run (Node 20.x):
//   node --test src/pages/sendGreetingFlowersWiring.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, "SendGreeting.jsx"), "utf8");

/** Comments explain what the page deliberately does NOT do; guards must read the code. */
const codeOnly = (s) => s.split("\n").map((l) => l.split("//")[0]).join("\n");
const CODE = codeOnly(SRC);

/** Every gift type the one-time selector can put into `giftSettings.type`. */
const SELECTABLE = ["none", "qrcash", "curated", "marketplace", "flowers"];
/** The ones whose send carries a Greet-Me gift the client can name up front. */
const CLAIMABLE_UP_FRONT = new Set(["qrcash", "curated", "marketplace"]);

const block = (startNeedle, endNeedle, label) => {
  const a = SRC.indexOf(startNeedle);
  assert.ok(a > -1, `${label}: start not found`);
  const b = SRC.indexOf(endNeedle, a);
  assert.ok(b > a, `${label}: end not found`);
  return SRC.slice(a, b);
};

// ===========================================================================
// The boolean that decides whether a send carries a gift
// ===========================================================================

test("includeGift is evaluated, and flowers is excluded UNTIL the provider has accepted", () => {
  // `includeGift` promises the backend that a validated gift record will be attached, and
  // resolveOutboundGift refuses the WHOLE SEND when it cannot build one. At the moment this payload
  // is built the flower order has not been placed, so there is no record and no claim token: the flag
  // must be false. It is set later, in handleFlowerOrderAccepted, and only with a token the SERVER
  // minted — which is the next test.
  const match = SRC.match(/includeGift:\s*Boolean\(([\s\S]*?)\),\s*\r?\n/);
  assert.ok(match, "the includeGift expression must be findable in the page source");

  const decide = new Function("giftSettings", `return Boolean(${match[1]});`);
  for (const type of SELECTABLE) {
    assert.equal(decide({ type }), CLAIMABLE_UP_FRONT.has(type), `includeGift for '${type}'`);
  }
  assert.equal(decide({ type: "flowers" }), false,
    "a flower send must not promise a gift record before the order exists");
  assert.equal(decide(undefined), false);
  assert.equal(decide({}), false);
});

test("the gift is attached by the SERVER's token, and by nothing else", () => {
  // REWRITTEN with the two-phase link. The payload is built in dispatchFlowerGreeting, which is only
  // reachable with a token the backend proved LINKED — so "attaches nothing without a token" is now a
  // property of the call graph rather than a ternary.
  const accepted = block("const handleFlowerOrderAccepted", "/**", "accepted handler");
  assert.match(accepted, /result\.giftClaimToken/, "the token comes from the accepted RESULT");

  const dispatch = block("const dispatchFlowerGreeting", "/**", "dispatch");
  assert.match(dispatch, /includeGift: true/);
  assert.match(dispatch, /gift: \{ type: 'flowers', claimToken: giftClaimToken \}/);
  // ONLY the type and the token travel. Everything the recipient is told is rebuilt server-side, so
  // no product, price or provider may be sent from this browser.
  const giftObject = dispatch.slice(dispatch.indexOf("gift: {"), dispatch.indexOf("}", dispatch.indexOf("gift: {")) + 1);
  for (const f of ["name", "price", "priceMinor", "provider", "providerOrderId", "itemSummary"]) {
    assert.equal(giftObject.includes(f), false, `the gift payload must not carry ${f}`);
  }
});

test("the accepted handler gates on ACCEPTED and latches at exactly one send", () => {
  const handler = block("const handleFlowerOrderAccepted", "// SAFE RETRY", "accepted handler");

  assert.match(handler, /if \(result\?\.status !== CHECKOUT_STATUS\.ACCEPTED\) return;/);
  const guardAt = handler.indexOf("if (flowerSendStarted.current) return;");
  const setAt = handler.indexOf("flowerSendStarted.current = true;");
  assert.ok(guardAt > -1 && setAt > guardAt, "the latch must be checked before it is set");
  assert.ok(setAt < handler.indexOf("executeGreetingSend"), "the latch closes before the send starts");

  // Released only when a human opens a fresh checkout — never by the handler itself.
  const opener = block("const handleReviewFlowersCheckout", "// THE ONE PLACE", "review handler");
  assert.match(opener, /flowerSendStarted\.current = false;/);
  assert.equal(/flowerSendStarted\.current = false/.test(handler), false,
    "the accepted handler must never re-arm itself");
});


test("every state setter the flowers path calls actually exists", () => {
  // THIS TEST EXISTS BECAUSE THE BUG DID. Reshaping the flow replaced `flowerOrder` with two other
  // pieces of state, and a `setFlowerOrder(null)` reset survived the rename — a ReferenceError the
  // moment a sender pressed Continue. Vite builds it happily; only static analysis sees it.
  //
  // So the setters called anywhere in the flowers handlers are checked against the setters the
  // component actually declares.
  const declared = new Set(
    [...SRC.matchAll(/const \[\s*\w+\s*,\s*(set\w+)\s*\]\s*=\s*useState/g)].map((m) => m[1]),
  );
  assert.ok(declared.size > 10, "the component's useState declarations must be findable");

  const region = SRC.slice(
    SRC.indexOf("const handleReviewFlowersCheckout"),
    SRC.indexOf("// QR Cash fresh-charge path"),
  );
  const called = new Set([...region.matchAll(/\b(set[A-Z]\w*)\s*\(/g)].map((m) => m[1]));
  assert.ok(called.size > 0, "the flowers handlers must call at least one setter");

  for (const setter of called) {
    assert.ok(declared.has(setter), `${setter}() is called but never declared with useState`);
  }
});

// ===========================================================================
// One dispatcher, one send
// ===========================================================================

test("executeGreetingSend remains the SOLE dispatcher — this flow adds no send call site", () => {
  // THREE pre-existing call sites, unchanged: executeGreetingSend itself, the editor's own send, and
  // the verification-checkpoint retry. Pinned so that a fourth — what a parallel flow looks like in
  // this file — fails here.
  const sendCalls = SRC.match(/api\.sendGreeting\(/g) || [];
  assert.equal(sendCalls.length, 3, "no new api.sendGreeting call site");

  // The flower paths reach the dispatcher through dispatchFlowerGreeting; the greeting-only retry
  // calls it directly. None of them touches the API itself.
  for (const name of ["dispatchFlowerGreeting", "handleRetryGreetingOnly"]) {
    const body = block(`const ${name}`, "\n  };", name);
    assert.match(body, /executeGreetingSend\(/, `${name} dispatches through the sole dispatcher`);
    assert.equal(/api\.sendGreeting/.test(body), false, `${name} must not call the API directly`);
  }
  for (const name of ["handleFlowerOrderAccepted", "handleRetryGiftLink"]) {
    const body = block(`const ${name}`, "\n  };", name);
    assert.equal(/executeGreetingSend\(/.test(body), false,
      `${name} must dispatch only through dispatchFlowerGreeting`);
    assert.equal(/api\.sendGreeting/.test(body), false, `${name} must not call the API directly`);
  }
});


// ===========================================================================
// The gift link: accepted and charged, but not yet attached
// ===========================================================================

test("an accepted order with NO gift token must not send the greeting", () => {
  // THE CORRECTION. Sending here would be permanent: a sent Greet-Me can never be given a gift
  // afterwards, so a recoverable bookkeeping failure would become a charged parcel the recipient is
  // never told about.
  // COMMENTS STRIPPED. The handler explains at length WHY it does not dispatch, naming the dispatch
  // in order to say where the latch lives instead — scanning prose would find that mention and read
  // it as a call.
  const handler = codeOnly(block("const handleFlowerOrderAccepted", "\n  };", "accepted handler"));

  // The early return happens BEFORE any dispatch.
  const guardAt = handler.indexOf("if (!giftClaimToken) {");
  const dispatchAt = handler.indexOf("dispatchFlowerGreeting");
  assert.ok(guardAt > -1, "the no-token branch must exist");
  assert.ok(dispatchAt > guardAt, "and must return before the dispatch");
  assert.match(handler.slice(guardAt, dispatchAt), /return;/, "it returns rather than falling through");

  // It HOLDS the accepted attempt rather than discarding it.
  assert.match(handler, /setPendingGiftLink\(\{/);
  assert.match(handler, /const attemptId = result\?\.checkout\?\.attemptId/,
    "the attempt id comes from the SERVER's accepted evidence");
  // AND IT IS PERSISTED, so a refresh does not lose the only handle on a charged order.
  assert.match(handler, /persistPendingGiftLink\(\{/);
  // And it does not claim a confirmed gift.
  assert.equal(/setGiftConfirmedForSend\(true\)/.test(handler), false,
    "an unattached gift must not be reported as confirmed");
});

test("executeGreetingSend for flowers happens in exactly ONE place, gated on a token", () => {
  // Both callers — the straight-through path and the retry — go through one dispatch, and each
  // supplies a token it has already proven non-empty.
  const dispatch = block("const dispatchFlowerGreeting", "/**", "dispatch");
  assert.match(dispatch, /await executeGreetingSend\(payload\)/);
  assert.match(dispatch, /gift: \{ type: 'flowers', claimToken: giftClaimToken \}/);
  assert.match(dispatch, /includeGift: true/);

  // THE LATCH LIVES IN THE DISPATCH, not in the accepted handler. That is what leaves it open for a
  // retry: an accepted order whose link failed has not sent, so its one send must still be available.
  const guardAt = dispatch.indexOf("if (flowerSendStarted.current) return;");
  const setAt = dispatch.indexOf("flowerSendStarted.current = true;");
  assert.ok(guardAt > -1 && setAt > guardAt, "checked before it is set");
  assert.ok(setAt < dispatch.indexOf("executeGreetingSend"), "and closed before the send");

  const accepted = block("const handleFlowerOrderAccepted", "/**", "accepted handler");
  assert.equal(/flowerSendStarted\.current = true/.test(accepted), false,
    "the accepted handler must not latch, or a failed link would block its own retry");

  // THREE callers, one declaration: the straight-through path after payment, the in-session link
  // retry, and the remount recovery's onLinked. Each is reached only with a token the backend proved
  // linked, and all three funnel into the one latched dispatch.
  assert.equal((CODE.match(/await dispatchFlowerGreeting\(/g) || []).length, 3, "exactly three callers");
  assert.equal((CODE.match(/const dispatchFlowerGreeting = /g) || []).length, 1, "one declaration");
});

test("the retry replays the SAME accepted attempt and can never reach the provider", () => {
  const retry = block("const handleRetryGiftLink", "\n  };", "gift link retry");

  assert.match(retry, /retryGiftLink\(\{/);
  assert.match(retry, /attemptId: pendingGiftLink\.attemptId/,
    "the SAME attempt, never a new one");
  // Only a LINKED token resumes the send.
  assert.match(retry, /if \(!token\) return;/);
  assert.match(retry, /dispatchFlowerGreeting\(greetingData, token\)/);
  // It must not construct an attempt, return anyone to payment, or touch the provider.
  for (const forbidden of [
    "prepareCheckout", "submitCheckout", "tokenize", "placeOrder", "fetchTokenizationConfig",
    "setIsFlowersCheckoutOpen(true)", "paymentToken", "paymentBinding",
  ]) {
    assert.equal(retry.includes(forbidden), false, `the retry must never ${forbidden}`);
  }
  // And it cannot run twice at once.
  assert.match(retry, /if \(!pendingGiftLink\?\.attemptId \|\| retryingGiftLink\) return;/);
});

test("the pending-link panel shows the approved words and offers only a link retry", () => {
  assert.match(CODE, /\{pendingGiftLink && \(/);
  const panel = block('data-testid="gift-link-pending"', "</div>", "pending panel");
  assert.match(panel, /Your flower order is confirmed, but we&rsquo;re still attaching it to your Greet-Me\./);
  assert.match(panel, /Please try again\./);
  assert.match(panel, /data-testid="retry-gift-link"/);
  assert.match(panel, /onClick=\{handleRetryGiftLink\}/);
  // No provider name, no order number, and no second checkout offered.
  for (const forbidden of ["Florist", "florist", "providerOrderId", "order number", "Pay", "checkout"]) {
    assert.equal(panel.includes(forbidden), false, `the panel must not mention ${forbidden}`);
  }
});

test("the ordinary send confirmation cannot appear while the gift is unlinked", () => {
  // It is gated on a COMPLETED job, and a job only exists once executeGreetingSend has run — which
  // the unlinked path never reaches.
  assert.match(CODE, /if \(jobStatus === 'completed'\) \{/);
  assert.match(SRC, /Your Greet-Me has been sent/);
  const accepted = block("const handleFlowerOrderAccepted", "/**", "accepted handler");
  const noToken = accepted.slice(accepted.indexOf("if (!giftClaimToken) {"));
  assert.equal(/executeGreetingSend/.test(noToken.slice(0, noToken.indexOf("}"))), false,
    "the unlinked branch dispatches nothing, so no job and no confirmation can exist");
});

test("a fresh checkout clears the pending link, so one order cannot inherit another's state", () => {
  const opener = block("const handleReviewFlowersCheckout", "// THE ONE PLACE", "review handler");
  assert.match(opener, /setPendingGiftLink\(null\)/);
  assert.match(opener, /setGiftConfirmedForSend\(false\)/);
  assert.match(opener, /setConfirmedGiftPayload\(null\)/);
  assert.match(opener, /flowerSendStarted\.current = false;/);
});

// ===========================================================================
// Safe retry: a greeting retry is never a provider retry
// ===========================================================================

test("the retry re-sends the GREETING only, and cannot touch the provider", () => {
  const retry = block("const handleRetryGreetingOnly", "\n  };", "retry handler");

  // It replays the one payload that already carries the confirmed gift's claim token, so the same
  // gift reference and the same surprise announcement survive.
  assert.match(retry, /confirmedGiftPayload/);
  assert.match(retry, /executeGreetingSend\(confirmedGiftPayload\)/);
  // NEVER a provider action of any kind.
  for (const forbidden of [
    "setIsFlowersCheckoutOpen", "prepareCheckout", "submitCheckout", "tokenize",
    "placeOrder", "fetchTokenizationConfig", "ProviderCheckoutModal",
  ]) {
    assert.equal(retry.includes(forbidden), false, `the retry must never ${forbidden}`);
  }
  // And it cannot run twice at once.
  assert.match(retry, /if \(sending\) return;/);
});

test("the retry offer appears only when a gift is confirmed AND the greeting failed", () => {
  assert.match(CODE, /\{confirmedGiftPayload && errors\.submit \?/);
  const panel = block('data-testid="gift-confirmed-send-failed"', "data-testid=\"retry-greeting-only\"", "retry panel");
  assert.match(panel, /Your gift is confirmed, but your Greet-Me could not be sent\./);
  assert.match(SRC, /Retry your Greet-Me/);
  // The ordinary error path is untouched for every other failure.
  assert.match(CODE, /errors\.submit && <Alert type="error" message=\{errors\.submit\} \/>/);
});

// ===========================================================================
// Cancel, failure and ambiguity
// ===========================================================================

test("closing the checkout releases the parked greeting and touches no draft state", () => {
  const close = block("const handleFlowersCheckoutClose", "\n  };", "close handler");
  assert.match(close, /setIsFlowersCheckoutOpen\(false\)/);
  assert.match(close, /setPendingGreetingData\(null\)/);
  for (const forbidden of ["setFormData", "setGiftSettings", "setMemoryPhotos", "setDefaultPhoto", "cartService"]) {
    assert.equal(close.includes(forbidden), false, `closing must not touch ${forbidden}`);
  }
  assert.equal(/executeGreetingSend/.test(close), false, "and must not send");
  // THE ANNOUNCEMENT FLAG CAN ONLY BE TURNED ON BY AN ACCEPTED ORDER. Two call sites exist and that
  // is deliberate — the accepted handler sets it from the server's token, and opening a fresh
  // checkout clears it — so what is asserted is the DIRECTION of each, not their number.
  const setters = [...CODE.matchAll(/setGiftConfirmedForSend\((.*?)\);/g)].map((m) => m[1]);
  assert.ok(setters.length >= 1, "the flag must be set somewhere");
  const truthy = setters.filter((a) => a !== "false");
  assert.deepEqual(truthy, ["true"], "exactly one place turns the recipient announcement on");
  // And that one place is the dispatch, which is unreachable without a token the backend proved
  // linked — so the announcement cannot be shown for a gift that is not attached.
  const dispatch = block("const dispatchFlowerGreeting", "/**", "dispatch");
  assert.match(dispatch, /setGiftConfirmedForSend\(true\)/);
  const accepted = block("const handleFlowerOrderAccepted", "/**", "accepted");
  assert.equal(/setGiftConfirmedForSend\(true\)/.test(accepted), false,
    "the accepted handler must not claim a confirmed gift on its own");
  // And a fresh checkout clears both the flag and any retry payload left from a previous attempt.
  const opener = block("const handleReviewFlowersCheckout", "// THE ONE PLACE", "review handler");
  assert.match(opener, /setGiftConfirmedForSend\(false\)/);
  assert.match(opener, /setConfirmedGiftPayload\(null\)/);
});

// ===========================================================================
// The cadence: one destination, no second preservation path, ordinary confirmation
// ===========================================================================

test("the Gift Place is ONE destination, reached through the existing return-to-greeting mechanism", () => {
  assert.match(CODE, /if \(type === 'marketplace' \|\| type === 'merch'\) \{/);
  assert.match(CODE, /navigate\('\/dashboard\/gifts\?returnTo=send&giftType=marketplace'\)/);
  // ONE MECHANISM, one key, two pre-existing callers: the media library and the Gift Place. Both
  // write the same `sendGreetingState` blob and both are restored by the same effect, so this packet
  // introduced no second preservation path — it reused the one that was already there.
  assert.equal((CODE.match(/sessionStorage\.setItem\('sendGreetingState'/g) || []).length, 2,
    "the preservation mechanism must stay single, however many callers use it");
  assert.match(CODE, /sessionStorage\.getItem\('sendGreetingState'\)/);
  // The decision screen carries no catalogue of its own any more.
  assert.equal(/flowersCatalogue/.test(CODE), false);
  assert.equal(/ProviderCheckoutEntry/.test(CODE), false);
});

test("checkout is mounted as an embedded step, bound to the greeting's recipient", () => {
  const mount = block("<ProviderCheckoutModal", "/>", "checkout mount");
  assert.match(mount, /giftType="flowers"/);
  assert.match(mount, /onAccepted=\{handleFlowerOrderAccepted\}/);
  // The binding that lets the backend attach the order to THIS greeting and refuse any other.
  assert.match(mount, /contactId=\{formData\.contactId \|\| null\}/);
  assert.match(mount, /isOpen=\{isFlowersCheckoutOpen\}/);
});

test("the final screen is the ordinary Greet-Me confirmation, plus one line about the gift", () => {
  assert.match(SRC, /Your Greet-Me has been sent/);
  const line = block('data-testid="send-gift-confirmed"', "</p>", "gift confirmation line");
  assert.match(line, /Your selected gift is confirmed\./);
  // NO order number, NO provider, NO delivery claim — the sender's order history holds the reference,
  // and this provider publishes no delivery status to Greet-Me at all.
  for (const forbidden of ["providerOrderId", "order number", "Florist", "florist", "delivered",
    "tracking", "on its way", "arriving", "shipped"]) {
    assert.equal(line.includes(forbidden), false, `the confirmation must not mention ${forbidden}`);
  }
  // It renders only beside the sent-greeting screen, so it can never appear alone.
  assert.match(CODE, /\{giftConfirmedForSend && \(/);
});

test("the selected-gift summary is one shape, projected through the shared Gift Place view model", () => {
  const summary = block("const selectedGiftSummary", "// Check if in demo mode", "summary");
  assert.match(summary, /fromProviderProduct\(giftSettings\.flowersProduct\)/,
    "the same projection the Gift Place card used, so the two screens cannot describe it differently");
  assert.match(CODE, /data-testid="selected-gift-summary"/);
  assert.match(CODE, /data-testid="selected-gift-name"/);
  assert.match(CODE, /data-testid="selected-gift-price"/);
  // Change Gift reopens the decision screen rather than a second surface of its own.
  assert.match(CODE, /data-testid="selected-gift-change"/);
  assert.match(CODE, /onClick=\{\(\) => setIsGiftModalOpen\(true\)\}/);
});

test("nothing in the flowers path navigates, resets context, or writes a resume draft", () => {
  // THE CADENCE REQUIREMENT. The marketplace path snapshots the draft and leaves for Stripe; the
  // flower path must not, because it never leaves. A refresh therefore loses a pending checkout
  // rather than resuming one — the safe direction: nothing was ordered and nothing is sent.
  const region = SRC.slice(
    SRC.indexOf("const handleReviewFlowersCheckout"),
    SRC.indexOf("// QR Cash fresh-charge path"),
  );
  assert.ok(region.length > 200, "the flowers handlers must be found as a contiguous region");
  for (const h of ["handleFlowerOrderAccepted", "handleRetryGreetingOnly", "handleFlowersCheckoutClose"]) {
    assert.ok(region.includes(h), `${h} is inside the region under test`);
  }
  for (const f of ["navigate(", "writeResumeDraft", "sessionStorage", "localStorage"]) {
    assert.equal(region.includes(f), false, `the flowers path must not use ${f}`);
  }
});
