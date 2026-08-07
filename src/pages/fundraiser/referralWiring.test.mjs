// src/pages/fundraiser/referralWiring.test.mjs — Run: node --test src/pages/fundraiser/referralWiring.test.mjs
// Source-scan proof that the public route + Checkout carrier are wired exactly per the locked contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const App = readFileSync(join(src, "App.jsx"), "utf8");
const Checkout = readFileSync(join(src, "pages/Checkout.jsx"), "utf8");

test("public HashRouter route /f/:token is registered (lazy, outside protected routes)", () => {
  assert.match(App, /lazy\(\(\) => import\("\.\/pages\/fundraiser\/FundraiserReferralLanding"\)\)/);
  assert.match(App, /<Route path="\/f\/:token"/);
  // it is placed among the Public Routes, before the "Protected Routes" section
  const idxRoute = App.indexOf('path="/f/:token"');
  const idxProtectedSection = App.indexOf("Protected Routes");
  assert.ok(idxRoute > 0, "/f/:token route present");
  assert.ok(idxProtectedSection > 0 && idxRoute < idxProtectedSection, "/f/:token must be a public route (before the Protected Routes section)");
});

test("Checkout attaches fundraiserAttributionToken via the carrier — flag-gated, subscription AND merch", () => {
  assert.match(Checkout, /import \{ fundraiserCheckoutField, clearToken as clearFundraiserToken \} from '\.\/fundraiser\/attributionCarrier\.js'/);
  assert.match(Checkout, /import \{ isFundraiserUiEnabled \} from '\.\.\/config\/fundraiserGate\.js'/);
  // existing subscription wiring — unchanged
  assert.match(Checkout, /\.\.\.fundraiserCheckoutField\(\{ purchaseType: item\.purchaseType \|\| 'subscription', flagEnabled: isFundraiserUiEnabled\(\) \}\)/);
  // NEW: merch payload uses the SAME helper + field name + same flag gate
  assert.match(Checkout, /\.\.\.fundraiserCheckoutField\(\{ purchaseType: 'merch', flagEnabled: isFundraiserUiEnabled\(\) \}\)/);
  assert.match(Checkout, /clearFundraiserToken\(\)/);
});

test("Founder v2 pricing wiring is preserved — this slice does not touch price maps or fallback", () => {
  // the Founder v2 price wiring (getCurrentPriceMap) and stale-priceId refresh remain intact
  assert.match(Checkout, /import \{ getCurrentPriceMap, personalPlans \} from '\.\.\/config\/plans'/);
  assert.match(Checkout, /getCurrentPriceMap\(\)/);
  assert.match(Checkout, /CART_STALE/);
});

test("Checkout never hard-codes the fundraiser token or identity fields into the request", () => {
  // the ONLY fundraiser key in the request comes from the carrier fragment (no literal identity fields)
  assert.ok(!/organizationId|campaignId|participantId|economicsVersion/.test(Checkout), "no fundraiser identity fields in Checkout");
  // no direct sessionStorage read of the attribution key in Checkout (carrier owns it)
  assert.ok(!/greetme_fundraiser_attribution/.test(Checkout), "Checkout must go through the carrier utility, not raw sessionStorage");
});

test("token is cleared ONLY on a successfully created session — never merely because fetch resolved", () => {
  // the success predicate requires a non-empty redirect url
  assert.match(Checkout, /checkoutSessionCreated = \(data\) => !!\(data && typeof data\.url === 'string' && data\.url\.length > 0\)/);
  // the ONLY clear call is guarded by that predicate, immediately before the redirect
  assert.match(Checkout, /if \(checkoutSessionCreated\(data\)\) clearFundraiserToken\(\);\s*\n\s*window\.location\.href = data\.url;/);
  // there is exactly ONE clearFundraiserToken() call site, and it is the guarded one
  assert.equal((Checkout.match(/clearFundraiserToken\(\)/g) || []).length, 1, "exactly one (guarded) clear call");
  // no bare clear immediately after the api.post(...) resolves
  assert.ok(!/\}\);\s*\n\s*clearFundraiserToken\(\);/.test(Checkout), "no unguarded clear right after api.post");
  // the credit-not-applied early-return path does NOT clear (retry preserves attribution)
  const creditBlock = (Checkout.match(/if \(creditAmount > 0[\s\S]*?return;/) || [""])[0];
  assert.ok(!/clearFundraiserToken/.test(creditBlock), "credit-failure retry path must not clear");
  // the catch(error) block does NOT clear (network/non-2xx retries preserve attribution)
  const catchBlock = (Checkout.match(/catch \(error\) \{[\s\S]*?\}/) || [""])[0];
  assert.ok(!/clearFundraiserToken/.test(catchBlock), "catch/error path must not clear");
});
