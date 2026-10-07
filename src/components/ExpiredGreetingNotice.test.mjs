// Expired-greeting state (HTTP 410 GREETING_EXPIRED): new 30-day copy, optional claim links.
// Run (Node 20.x): node --test src/components/ExpiredGreetingNotice.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__egn.bundle.mjs");

async function load() {
  await esbuild.build({
    entryPoints: [join(__dirname, "ExpiredGreetingNotice.jsx")],
    bundle: true, format: "esm", platform: "node", outfile: BUNDLE, jsx: "automatic", logLevel: "silent",
    external: ["react", "react/jsx-runtime"],
  });
  return import(pathToFileURL(BUNDLE).href + "?t=" + Date.now());
}

test("expired notice: copy, and links only when the 410 body supplies them", async () => {
  try {
    const React = (await import("react")).default;
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { default: Notice } = await load();
    const html = (claim) => renderToStaticMarkup(React.createElement(Notice, { claim }));

    const none = html(null);
    assert.ok(none.includes("This greeting was available for 30 days and is no longer available."));
    assert.ok(!none.includes("Claim your"));

    const both = html({ giftClaimUrl: "https://app.example/#/gift/tok123", courtesyCreditCode: "CC 9" });
    assert.ok(both.includes('href="https://app.example/#/gift/tok123"'));
    assert.ok(both.includes("Claim your gift"));
    assert.ok(both.includes('href="/#/claim-credit/CC%209"'));
    assert.ok(both.includes("Claim your $5 credit"));

    const giftOnly = html({ giftClaimUrl: "https://x/g", courtesyCreditCode: null });
    assert.ok(giftOnly.includes("Claim your gift") && !giftOnly.includes("Claim your $5 credit"));
    const creditOnly = html({ giftClaimUrl: null, courtesyCreditCode: "AB1" });
    assert.ok(!creditOnly.includes("Claim your gift") && creditOnly.includes("Claim your $5 credit"));
  } finally {
    try { rmSync(BUNDLE); } catch {}
  }
});

test("PublicGreetingCard keeps the 410 body and uses the notice", () => {
  const src = readFileSync(join(__dirname, "../pages/PublicGreetingCard.jsx"), "utf8");
  assert.match(src, /setExpiredClaim\(err\?\.data\?\.claim \|\| null\)/);
  assert.match(src, /<ExpiredGreetingNotice claim=\{expiredClaim\} \/>/);
  const api = readFileSync(join(__dirname, "../api/api.js"), "utf8");
  assert.match(api, /error\.data = data;/);
});
