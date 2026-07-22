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

test("Checkout attaches fundraiserAttributionToken via the carrier — flag-gated, subscription-only", () => {
  assert.match(Checkout, /import \{ fundraiserCheckoutField, clearToken as clearFundraiserToken \} from '\.\/fundraiser\/attributionCarrier\.js'/);
  assert.match(Checkout, /import \{ isFundraiserUiEnabled \} from '\.\.\/config\/fundraiserGate\.js'/);
  assert.match(Checkout, /\.\.\.fundraiserCheckoutField\(\{ purchaseType: item\.purchaseType \|\| 'subscription', flagEnabled: isFundraiserUiEnabled\(\) \}\)/);
  assert.match(Checkout, /clearFundraiserToken\(\)/);
});

test("Checkout never hard-codes the fundraiser token or identity fields into the request", () => {
  // the ONLY fundraiser key in the request comes from the carrier fragment (no literal identity fields)
  assert.ok(!/organizationId|campaignId|participantId|economicsVersion/.test(Checkout), "no fundraiser identity fields in Checkout");
  // no direct sessionStorage read of the attribution key in Checkout (carrier owns it)
  assert.ok(!/greetme_fundraiser_attribution/.test(Checkout), "Checkout must go through the carrier utility, not raw sessionStorage");
});
