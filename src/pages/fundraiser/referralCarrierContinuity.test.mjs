// referralCarrierContinuity.test.mjs — TEAM B carrier-continuity lane.
// Run: node --test src/pages/fundraiser/referralCarrierContinuity.test.mjs
// Deterministic source-scan proof of the public landing → carrier → checkout-BOUNDARY wiring, and
// proof that this lane does NOT touch checkout (checkout consumption is a later, separate tier).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const App = readFileSync(join(src, "App.jsx"), "utf8");
const Landing = readFileSync(join(src, "pages/fundraiser/FundraiserReferralLanding.jsx"), "utf8");
const Carrier = readFileSync(join(src, "pages/fundraiser/attributionCarrier.js"), "utf8");
const Checkout = readFileSync(join(src, "pages/Checkout.jsx"), "utf8");

test("public HashRouter route /f/:token is registered, lazy, and PUBLIC (before Protected Routes)", () => {
  assert.match(App, /lazy\(\(\) => import\("\.\/pages\/fundraiser\/FundraiserReferralLanding"\)\)/);
  assert.match(App, /<Route path="\/f\/:token"/);
  const idxRoute = App.indexOf('path="/f/:token"');
  const idxProtected = App.indexOf("Protected Routes");
  assert.ok(idxRoute > 0 && idxProtected > 0 && idxRoute < idxProtected, "/f/:token must be a public route");
});

test("landing captures ONLY the opaque token via the carrier and routes into the ordinary journey", () => {
  assert.match(Landing, /import \{ captureToken, isValidTokenSyntax \} from "\.\/attributionCarrier\.js"/);
  assert.match(Landing, /captureToken\(token\)/);
  assert.match(Landing, /navigate\("\/register"\)/);
  // CODE-usage checks (comment prose is ignored): no private API import, no network call, no identity keys
  assert.ok(!/import[^\n]*from\s+["'][^"']*(fundraiserApi|\/api)/i.test(Landing), "landing must import no private API");
  assert.ok(!/\bfetch\(|\baxios\b|XMLHttpRequest/.test(Landing), "landing must make no network call");
  assert.ok(!/(organizationId|campaignId|participantId|economicsVersion)\s*:/.test(Landing), "landing must construct no identity fields");
});

test("carrier boundary output is flag-gated, subscription-only, token-only (no identity/financial fields)", () => {
  assert.match(Carrier, /export function fundraiserCheckoutField/);
  assert.match(Carrier, /if \(!flagEnabled\) return \{\};/);
  assert.match(Carrier, /if \(purchaseType !== "subscription"\) return \{\};/);
  // the ONLY emitted key is the opaque token
  assert.match(Carrier, /return token \? \{ fundraiserAttributionToken: token \} : \{\}/);
  assert.ok(!/(organizationId|campaignId|participantId|economicsVersion|eligibility)\s*:/.test(Carrier), "carrier must emit only the opaque token");
  // CODE-usage (not comment prose): uses sessionStorage; no localStorage/cookie API calls
  assert.match(Carrier, /sessionStorage/);
  assert.ok(!/\blocalStorage\s*\.\s*(get|set|remove)Item|\blocalStorage\s*\[|document\.cookie/.test(Carrier), "carrier must not use cookies or localStorage");
});

test("THIS LANE does not wire checkout: Checkout.jsx has no fundraiser attribution reference", () => {
  assert.ok(!/fundraiserAttributionToken|attributionCarrier|greetme_fundraiser_attribution|fundraiserCheckoutField/.test(Checkout),
    "Checkout must remain unchanged in the carrier-continuity lane (checkout consumption is a later tier)");
});
