// src/pages/fundraiser/referralWiring.test.mjs — Run: node --test src/pages/fundraiser/referralWiring.test.mjs
// Source-scan proof that the public route + Checkout carrier + token lifecycle (subscription + merch
// clear-on-success, logout clear) are wired exactly per the locked contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const App = readFileSync(join(src, "App.jsx"), "utf8");
const Checkout = readFileSync(join(src, "pages/Checkout.jsx"), "utf8");
const Auth = readFileSync(join(src, "context/AuthContext.jsx"), "utf8");

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

test("token is cleared ONLY on a successfully created session — subscription AND merch, never merely because fetch resolved", () => {
  // the success predicate requires a non-empty redirect url
  assert.match(Checkout, /checkoutSessionCreated = \(data\) => !!\(data && typeof data\.url === 'string' && data\.url\.length > 0\)/);
  // EVERY clear is guarded by that predicate, immediately before its redirect (subscription + merch)
  const guardedClears = Checkout.match(/if \(checkoutSessionCreated\(data\)\) clearFundraiserToken\(\);\s*\n\s*window\.location\.href = data\.url;/g) || [];
  assert.equal(guardedClears.length, 2, "exactly two guarded clears — subscription and merch success boundaries");
  // there are exactly TWO clearFundraiserToken() call sites in Checkout, and BOTH are the guarded ones
  assert.equal((Checkout.match(/clearFundraiserToken\(\)/g) || []).length, 2, "exactly two (guarded) clear calls");
  // no bare clear immediately after any api.post(...) resolves
  assert.ok(!/\}\);\s*\n\s*clearFundraiserToken\(\);/.test(Checkout), "no unguarded clear right after api.post");
  // the credit-not-applied early-return path does NOT clear (retry preserves attribution)
  const creditBlock = (Checkout.match(/if \(creditAmount > 0[\s\S]*?return;/) || [""])[0];
  assert.ok(!/clearFundraiserToken/.test(creditBlock), "credit-failure retry path must not clear");
  // the catch(error) block(s) do NOT clear (network/non-2xx/throw retries preserve attribution)
  const catchBlocks = Checkout.match(/catch \(error\) \{[\s\S]*?\}/g) || [];
  for (const cb of catchBlocks) assert.ok(!/clearFundraiserToken/.test(cb), "catch/error path must not clear");
});

test("logout ALWAYS clears the fundraiser token via the carrier helper — scoped, no broad storage wipe", () => {
  // AuthContext imports the SAME carrier helper (no second store/helper)
  assert.match(Auth, /import \{ clearToken as clearFundraiserToken \} from '\.\.\/pages\/fundraiser\/attributionCarrier\.js'/);
  // logout invokes the clear, and does so FIRST so later cleanup/navigation failure cannot leave it behind
  const logoutBlock = (Auth.match(/const logout = \(\) => \{[\s\S]*?\n  \};/) || [""])[0];
  assert.ok(/clearFundraiserToken\(\);/.test(logoutBlock), "logout must clear the fundraiser token");
  assert.ok(logoutBlock.indexOf("clearFundraiserToken()") < logoutBlock.indexOf("safeRemove('token')"),
    "fundraiser clear must run before other logout cleanup (robust to later failure)");
  // NO broad storage wipe introduced anywhere in AuthContext
  assert.ok(!/sessionStorage\.clear\(\)/.test(Auth), "must not broadly clear sessionStorage");
  assert.ok(!/localStorage\.clear\(\)/.test(Auth), "must not broadly clear localStorage");
});
