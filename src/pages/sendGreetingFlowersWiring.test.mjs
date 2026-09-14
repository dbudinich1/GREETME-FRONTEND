// src/pages/sendGreetingFlowersWiring.test.mjs
//
// THE SEND-PAGE WIRING FOR FLOWERS, asserted against the real source of SendGreeting.jsx.
//
// WHY THIS FILE IS SOURCE-BASED. SendGreeting.jsx is a 2,800-line page component wired to the auth
// context, the shared API client, the cart, the router and the draft service. Mounting it would mean
// standing up five stubs whose fidelity is itself unproven, and the properties below are not about
// rendering — they are about WHICH CALL IS WIRED TO WHICH HANDLER, and about one boolean expression
// that decides whether every flower send succeeds or fails. Those are structural claims, and the
// established way to make them executable here is to read the file.
//
// The `includeGift` test is NOT a regex match on prose. The expression is extracted from the source
// and EVALUATED, so what passes is the real decision the page makes, for every gift type the
// selector can produce — the same technique the backend integrity suite used before its module
// boundary existed.
//
// The interaction itself — catalogue, review step, handoff, every failure branch — is proven by
// mounting the real components in src/components/providerCheckout/sendFlowFlowers.browser.test.mjs.
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

/** Every gift type the one-time selector can put into `giftSettings.type`. */
const SELECTABLE = ["none", "qrcash", "curated", "merch", "marketplace", "flowers"];
/** The ones whose send carries a validated Greet-Me gift record, and must therefore set the flag. */
const CLAIMABLE = new Set(["qrcash", "curated", "merch", "marketplace"]);

// ===========================================================================
// The one boolean that decides whether a flower send works at all
// ===========================================================================

test("includeGift is true for claimable gifts and FALSE for flowers — evaluated, not matched", () => {
  // THE TRAP THIS CLOSES. `includeGift` promises the backend that a validated gift record will be
  // attached, and resolveOutboundGift refuses the WHOLE SEND when it cannot build one. Flowers never
  // can: the arrangement ships to the recipient's street address from the provider, who is the
  // merchant of record, so there is no claim token and nothing to reveal at /gift/:claimToken. The
  // previous expression was `giftSettings.type !== 'none'`, which would have set the flag for every
  // flower send and turned each one into SEND_GIFT_ERRORS.MALFORMED — "Please re-select your gift" —
  // for a selection that was perfectly valid.
  const match = SRC.match(/includeGift:\s*Boolean\(([\s\S]*?)\),\s*\r?\n/);
  assert.ok(match, "the includeGift expression must be findable in the page source");

  // Evaluate the REAL expression, rather than asserting something about its text.
  const decide = new Function("giftSettings", `return Boolean(${match[1]});`);

  for (const type of SELECTABLE) {
    const actual = decide({ type });
    assert.equal(actual, CLAIMABLE.has(type), `includeGift for '${type}'`);
  }
  assert.equal(decide({ type: "flowers" }), false, "flowers must never promise a Greet-Me gift record");
  // And an absent selection is still no gift, as before.
  assert.equal(decide(undefined), false);
  assert.equal(decide({}), false);
});

test("no gift payload is attached for flowers anywhere on the send path", () => {
  // The flag is half of it. The other half is that nothing builds a `gift: { type: 'flowers' }`
  // object, which the backend resolver would reject just as firmly.
  assert.equal(
    /gift:\s*\{[^}]*type:\s*['"]flowers['"]/.test(SRC), false,
    "no flowers gift object may be built into a send payload",
  );
});

// ===========================================================================
// One dispatcher, one send
// ===========================================================================

test("executeGreetingSend remains the SOLE dispatcher — the flowers path adds no send call site", () => {
  // The page's standing invariant. A second `api.sendGreeting` call site is exactly how a flow ends
  // up sending twice, or sending without the checks executeGreetingSend performs.
  // THREE pre-existing call sites, unchanged by this packet: executeGreetingSend itself, the
  // editor's own send, and the verification-checkpoint retry. The number is pinned so that a fourth
  // — which is what a parallel flow looks like in this file — fails here.
  const sendCalls = SRC.match(/api\.sendGreeting\(/g) || [];
  assert.equal(sendCalls.length, 3,
    "the flowers path must add no api.sendGreeting call site of its own");

  // And the flowers handler goes through the dispatcher, not around it.
  const handler = SRC.match(/const handleFlowerOrderAccepted = async \(result\) => \{([\s\S]*?)\n  \};/);
  assert.ok(handler, "the accepted-order handler must exist");
  assert.match(handler[1], /await executeGreetingSend\(greetingData\)/,
    "the flowers path dispatches through the sole dispatcher");
  assert.equal(/api\.sendGreeting/.test(handler[1]), false,
    "and never calls the API directly");
});

test("the accepted-order handler gates on ACCEPTED and latches at exactly one send", () => {
  const handler = SRC.match(/const handleFlowerOrderAccepted = async \(result\) => \{([\s\S]*?)\n  \};/)[1];

  // GATE. Only the backend's own accepted status may continue, re-checked here even though the
  // checkout already checked it — this is the last point before a greeting announces an order.
  assert.match(handler, /if \(result\?\.status !== CHECKOUT_STATUS\.ACCEPTED\) return;/);
  // LATCH. A ref, and it is read before it is set, so a re-entry during the same tick is refused.
  const guardAt = handler.indexOf("if (flowerSendStarted.current) return;");
  const setAt = handler.indexOf("flowerSendStarted.current = true;");
  assert.ok(guardAt > -1 && setAt > guardAt, "the latch must be checked before it is set");
  // And both happen BEFORE the send.
  assert.ok(setAt < handler.indexOf("executeGreetingSend"), "the latch closes before the send starts");

  // The latch is released only when a human opens a fresh checkout — never by the handler itself.
  const opener = SRC.match(/const handleReviewFlowersCheckout = \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(opener, "the flowers review handler must exist");
  assert.match(opener[1], /flowerSendStarted\.current = false;/,
    "a fresh checkout is the only thing that re-arms the send");
  assert.equal(/flowerSendStarted\.current = false/.test(handler), false,
    "the accepted handler must never re-arm itself");
});

test("the flowers review handler mirrors the proven QR Cash charge-then-send shape", () => {
  // Reuse, not a parallel flow: park the completed greeting, open the payment step, let the success
  // handler dispatch. Same three moves as handleReviewQRCashFresh, which has been in production.
  const opener = SRC.match(/const handleReviewFlowersCheckout = \(\) => \{([\s\S]*?)\n  \};/)[1];
  assert.match(opener, /setPendingGreetingData\(greetingData\)/, "the greeting is parked, not discarded");
  assert.match(opener, /setIsPreSendReviewOpen\(false\)/);
  assert.match(opener, /setIsFlowersCheckoutOpen\(true\)/, "and the payment step opens");
  // It refuses to open without a chosen arrangement, so the checkout is never reached empty.
  assert.match(opener, /if \(!giftSettings\?\.flowersProduct\?\.providerProductId\) return;/);
  // It does not send. The single primary action starts the step; acceptance is what sends.
  assert.equal(/executeGreetingSend/.test(opener), false,
    "the review handler must not dispatch a send of its own");
});

// ===========================================================================
// Failure safety and draft preservation
// ===========================================================================

test("closing the checkout releases the parked greeting and touches no draft state", () => {
  // NOTHING ORDERED, NOTHING SENT. And the DRAFT survives: formData, the chosen arrangement, the
  // photos and the recipient are all owned by state this handler does not write, so the sender can
  // change or remove the gift and send without composing again.
  const close = SRC.match(/const handleFlowersCheckoutClose = \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(close, "the close handler must exist");
  const body = close[1];
  assert.match(body, /setIsFlowersCheckoutOpen\(false\)/);
  assert.match(body, /setPendingGreetingData\(null\)/);

  for (const forbidden of ["setFormData", "setGiftSettings", "setMemoryPhotos", "setDefaultPhoto", "cartService"]) {
    assert.equal(body.includes(forbidden), false, `closing must not touch ${forbidden}`);
  }
  assert.equal(/executeGreetingSend/.test(body), false, "and must not send");
});

test("the checkout is mounted with onAccepted, and the combined confirmation reports both results", () => {
  // The embedded mount. `onAccepted` is what suppresses the checkout's own "Done", so its presence
  // here is also what guarantees the flower order is never shown as finished on its own.
  assert.match(SRC, /<ProviderCheckoutModal[\s\S]{0,400}?onAccepted=\{handleFlowerOrderAccepted\}/,
    "the existing checkout is mounted as an embedded step");
  assert.match(SRC, /giftType="flowers"/);

  // ONE CONFIRMATION, BOTH RESULTS — on the page's existing success screen, not a second one.
  assert.match(SRC, /data-testid="send-flower-order-confirmation"/);
  const confirmation = SRC.match(/data-testid="send-flower-order-confirmation"([\s\S]*?)<\/p>/)[1];
  assert.match(confirmation, /flower order has been accepted/,
    "'accepted' is the furthest the provider lets us go");
  assert.match(confirmation, /flowerOrder\.providerOrderId/, "with the provider's own order number");
  // The provider publishes no delivery, tracking or status feed to Greet-Me.
  for (const claim of ["delivered", "on its way", "tracking", "shipped", "completed"]) {
    assert.equal(new RegExp(claim, "i").test(confirmation), false,
      `the flower line must not claim '${claim}'`);
  }
  // It is only ever rendered beside the sent-greeting screen, so it cannot appear alone.
  assert.match(SRC, /\{flowerOrder && \(/);
});

test("the catalogue is offered in ATTACH mode only, and the provider gate is fail-closed", () => {
  // In the send flow the catalogue reports a choice and opens nothing — the greeting owns the
  // checkout. An `onSelect` is therefore mandatory at this mount site.
  const mount = SRC.match(/<ProviderCheckoutEntry([\s\S]*?)\/>/);
  assert.ok(mount, "the existing catalogue component is reused in the selector");
  assert.match(mount[1], /onSelect=\{/, "attach mode");
  assert.match(mount[1], /selectedProductId=\{giftSettings\?\.flowersProduct\?\.providerProductId/,
    "and the selection is owned by the page, not by the catalogue");

  // Offered only when the provider answered yes. Default false, set only on an explicit `true`.
  assert.match(SRC, /useState\(false\);?\s*$/m);
  assert.match(SRC, /posture\?\.available === true\) setFlowersAvailable\(true\)/,
    "the gate opens only on an explicit yes");
  assert.match(SRC, /flowersCatalogue=\{flowersAvailable \?/,
    "and nothing is offered while it is closed");
});

test("nothing in the flowers path navigates, resets context, or writes a resume draft", () => {
  // THE CADENCE REQUIREMENT. The marketplace path snapshots the draft and leaves for Stripe; flowers
  // must not, because it never leaves. A refresh therefore loses a pending checkout rather than
  // resuming one — which is the safe direction: nothing was ordered and nothing is sent.
  // Scoped to the THREE flowers handlers only. The marketplace handler legitimately navigates, so a
  // wider slice would prove nothing about this path.
  const region = SRC.slice(
    SRC.indexOf("const handleReviewFlowersCheckout"),
    SRC.indexOf("// QR Cash fresh-charge path"),
  );
  assert.ok(region.length > 200, "the flowers handlers must be found as a contiguous region");
  assert.ok(region.includes("handleFlowerOrderAccepted") && region.includes("handleFlowersCheckoutClose"),
    "all three flowers handlers are inside the region under test");
  for (const f of ["navigate(", "writeResumeDraft", "sessionStorage", "localStorage"]) {
    assert.equal(region.includes(f), false, `the flowers path must not use ${f}`);
  }
});
