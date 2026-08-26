// tokenExposure.test.mjs — SALES S1 pre-activation.
//
// The referral token in /#/s/<TOKEN> is a BEARER COMPENSATION INSTRUMENT: whoever holds it can
// attribute purchases to a salesperson. These proofs cover every browser-side surface it could
// otherwise leak through — analytics, the address bar, history, and the carrier module itself.
//
// They live in the FRONTEND repository because the files they assert on do. An earlier draft
// asserted the same things from the backend suite through a sibling-directory relative path; it
// passed locally and would have failed in backend CI, where that directory does not exist.
//
// Run: node --test src/pages/sales/tokenExposure.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, "..", "..", "..");
const readRepo = (rel) => readFileSync(path.join(REPO, rel), "utf8");

const codeOnly = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

// A realistic token: 43-char base64url, exactly what the backend issues.
const TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";

// ── ANALYTICS ───────────────────────────────────────────────────────────────

test("1 · GA4 sends no automatic page_view, so it can never capture the landing URL", () => {
  const html = readRepo("index.html");
  assert.match(html, /send_page_view:\s*false/,
    "GA4's default page_view would send page_location including the #/s/<token> fragment");
  assert.match(html, /gtag\('config',\s*'G-SNPWGHVBL1',\s*\{/,
    "the config call must carry options, not just the measurement id");
});

test("2 · every page_location GA4 receives is sanitised at the source", () => {
  const html = readRepo("index.html");
  assert.match(html, /page_location:\s*window\.__gmStripSensitiveFragment\(window\.location\.href\)/);
  // The sanitiser is defined BEFORE it is used, and before the gtag config call.
  const def = html.indexOf("window.__gmStripSensitiveFragment =");
  const use = html.indexOf("page_location: window.__gmStripSensitiveFragment");
  assert.ok(def > 0 && def < use, "the sanitiser is defined before the config that uses it");
});

test("3 · the sanitiser actually strips the token — evaluated, not assumed", () => {
  const html = readRepo("index.html");
  const from = html.indexOf("window.__gmStripSensitiveFragment = function");
  const body = html.slice(from);
  const fnSrc = body.slice(body.indexOf("function"), body.indexOf("};") + 1);
  // eslint-disable-next-line no-new-func
  const strip = new Function(`return (${fnSrc})`)();

  assert.equal(strip(`https://greet-me.com/#/s/${TOKEN}`), "https://greet-me.com/#/s/redacted");
  assert.equal(strip(`https://greet-me.com/#/s/${TOKEN}?utm=x`).includes(TOKEN), false,
    "a query string after the fragment must not smuggle it through");
  assert.equal(strip(`https://greet-me.com/#/s/${TOKEN}/extra`).includes(TOKEN), false);
  // Unrelated routes are untouched — the sanitiser must not blunt ordinary analytics.
  for (const url of [
    "https://greet-me.com/",
    "https://greet-me.com/#/pricing",
    "https://greet-me.com/#/f/sometoken",
    "https://greet-me.com/#/dashboard",
  ]) assert.equal(strip(url), url, url);
  // Never throws, whatever it is handed.
  for (const bad of [null, undefined, 42, {}, []]) {
    assert.equal(typeof strip(bad), "string", JSON.stringify(bad));
  }
});

test("4 · no analytics call anywhere sends a raw location or the token", () => {
  const code = codeOnly(readRepo("src/utils/analyticsEvents.js"));
  assert.equal(/location\.href|document\.URL|window\.location\b(?!\.\w)/.test(code), false,
    "an event helper must not ship a raw URL to analytics");
  const register = codeOnly(readRepo("src/pages/Register.jsx"));
  const gtagCalls = register.match(/gtag\([^;]*\)/gs) || [];
  for (const c of gtagCalls) {
    assert.equal(/location|href|token/i.test(c), false, `gtag call leaks a location: ${c.slice(0, 80)}`);
  }
});

// ── ADDRESS BAR AND HISTORY ─────────────────────────────────────────────────

test("5 · the landing scrubs the token from the address bar, AFTER capturing it", () => {
  const src = readRepo("src/pages/sales/SalesReferralLanding.jsx");
  const capture = src.indexOf("captureToken(raw)");
  const scrub = src.indexOf("scrubTokenFromAddressBar()");
  assert.ok(capture > 0, "the token is captured");
  assert.ok(scrub > capture, "…and only then does the address bar change, so nothing is lost");
});

test("6 · the scrub uses replaceState, adds no history entry, and is fail-safe", async () => {
  const carrier = readRepo("src/pages/sales/salesAttributionCarrier.js");
  assert.match(carrier, /history\.replaceState/, "replaceState — never pushState");
  assert.equal(/history\.pushState/.test(carrier), false, "pushState would leave the token in history");

  const { scrubTokenFromAddressBar } = await import("./salesAttributionCarrier.js");

  // No window at all (SSR / test env) ⇒ false, never a throw.
  const hadWindow = "window" in globalThis;
  if (!hadWindow) assert.equal(scrubTokenFromAddressBar(), false, "no window ⇒ safe no-op");

  // With a fake window, the token is replaced and the rest of the URL preserved.
  const calls = [];
  const fake = {
    location: { pathname: "/", search: "?a=1", hash: `#/s/${TOKEN}` },
    history: { replaceState: (_s, _t, url) => calls.push(url) },
  };
  const prev = globalThis.window;
  globalThis.window = fake;
  try {
    assert.equal(scrubTokenFromAddressBar(), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0], "/?a=1#/s/redacted");
    assert.equal(calls[0].includes(TOKEN), false, "the token is gone from the address bar");

    // Idempotent: running again on an already-scrubbed URL changes nothing.
    fake.location.hash = "#/s/redacted";
    assert.equal(scrubTokenFromAddressBar(), false);
    assert.equal(calls.length, 1);

    // A non-referral route is never rewritten.
    fake.location.hash = "#/pricing";
    assert.equal(scrubTokenFromAddressBar(), false);
    assert.equal(calls.length, 1);

    // A throwing history API degrades to false rather than breaking the landing page.
    fake.location.hash = `#/s/${TOKEN}`;
    fake.history.replaceState = () => { throw new Error("blocked"); };
    assert.equal(scrubTokenFromAddressBar(), false, "a failed scrub must never break the page");
  } finally {
    if (prev === undefined) delete globalThis.window; else globalThis.window = prev;
  }
});

// ── THE CARRIER AND THE CLAIM ───────────────────────────────────────────────

test("7 · the carrier module still makes NO network request", () => {
  const code = codeOnly(readRepo("src/pages/sales/salesAttributionCarrier.js"));
  assert.equal(/fetch\(|axios|XMLHttpRequest|navigator\.sendBeacon/.test(code), false,
    "binding is server-side; the browser is never an authority on attribution");
});

test("8 · the claim sends no body and cannot name a salesperson or a timestamp", () => {
  const api = readRepo("src/api/api.js");
  const fn = api.slice(api.indexOf("export async function claimSalesAttribution"));
  const body = fn.slice(0, fn.indexOf(String.fromCharCode(10) + "}"));
  assert.match(body, /credentials:\s*"include"/, "the sealed HttpOnly cookie is the only input");
  assert.match(body, /method:\s*"POST"/);
  assert.equal(/body:/.test(body), false, "no request body at all");
  // The ONLY credential it sends is the ordinary JWT session token in the Authorization header —
  // that is required to identify the user. What it must never send is anything that would let the
  // browser NAME the attribution: a salesperson, a referral token, or a timestamp.
  assert.match(body, /Authorization: `Bearer \$\{token\}`/, "the JWT identifies the user");
  for (const forbidden of ["salespersonId", "validatedAt", "tokenHash", "salesAttributionToken", "SALES_ATTRIBUTION_KEY"]) {
    assert.equal(body.includes(forbidden), false, `the claim must not send ${forbidden}`);
  }
  // It never reads the referral carrier at all.
  assert.equal(/readToken\(|greetme_sales_attribution/.test(body), false,
    "the claim must not read the referral carrier — the sealed cookie is the only input");
});

test("9 · the claim is fire-and-forget at both auth call sites and cannot block the user", () => {
  for (const f of ["src/pages/Register.jsx", "src/pages/Login.jsx"]) {
    const src = readRepo(f);
    assert.match(src, /claimSalesAttribution\(\)/, `${f} promotes the hand-off`);
    // Never awaited — an attribution call must not delay a redirect or a sign-in.
    assert.equal(/await\s+claimSalesAttribution/.test(src), false, `${f} must not await the claim`);
  }
  // Only fires on a successful auth.
  const login = readRepo("src/pages/Login.jsx");
  assert.match(login, /if \(result\?\.success\) claimSalesAttribution\(\);/);
});

test("10 · the landing exposes no salesperson identity, rate or earnings, and decodes nothing", () => {
  const code = codeOnly(readRepo("src/pages/sales/SalesReferralLanding.jsx"));
  for (const forbidden of ["salespersonId", "commission", "earnings", "rateBps", "percent"]) {
    assert.equal(code.includes(forbidden), false, `the landing must not reference ${forbidden}`);
  }
  assert.equal(/atob\(|JSON\.parse\(token|decode/i.test(code), false, "the token is never decoded");

  // CORRECTED INVARIANT. The landing DOES call the server now — it must, because the sealed
  // cookie can only be issued after server-side validation, and the previous "calls no API"
  // rule meant the real browser journey could never obtain one. The rule is now stricter and
  // more useful: it may call EXACTLY ONE endpoint, through the canonical API client, and it
  // must never construct a request itself.
  assert.equal(/fetch\(|axios|XMLHttpRequest/.test(code), false,
    "the landing must not build its own request — it uses the canonical API client");
  const src = readRepo("src/pages/sales/SalesReferralLanding.jsx");
  assert.match(src, /import \{ resolveSalesReferral \} from "\.\.\/\.\.\/api\/api"/);
  assert.match(src, /resolveSalesReferral\(raw\)/, "it calls the validation client");
  // Exactly one API import, and it is that one.
  const apiImports = (src.match(/from "\.\.\/\.\.\/api\/api"/g) || []).length;
  assert.equal(apiImports, 1, "exactly one API surface is imported");
  assert.equal(/claimSalesAttribution|adminApi|contactsApi/.test(src), false,
    "the landing touches no other API surface");
});

test("11 · the token reaches the server ONLY in a POST body — never a URL", () => {
  const api = readRepo("src/api/api.js");
  const fn = api.slice(api.indexOf("export async function resolveSalesReferral"));
  const body = fn.slice(0, fn.indexOf(String.fromCharCode(10) + "}"));

  // The URL is a fixed path with no interpolation of the token.
  assert.match(body, /fetch\(`\$\{API_BASE\}\/api\/sales\/attribution\/resolve`/);
  assert.equal(/\/api\/sales\/t\//.test(body), false, "the retired path route must not be used");
  // Assert on the fetch TARGET, not the whole body — `?.` optional chaining also contains "?".
  const urlArg = body.slice(body.indexOf("fetch("), body.indexOf(",", body.indexOf("fetch(")));
  assert.equal(/\?|encodeURIComponent|searchParams|\$\{token\}/.test(urlArg), false,
    `the request URL must carry no query string and no token: ${urlArg}`);
  // The token travels in the body.
  assert.match(body, /method:\s*"POST"/);
  assert.match(body, /body:\s*JSON\.stringify\(\{ token \}\)/);
  assert.match(body, /credentials:\s*"include"/, "so the browser stores the Set-Cookie");
  // Nothing anywhere in the frontend still targets the retired GET route.
  for (const f of ["src/pages/sales/SalesReferralLanding.jsx", "src/api/api.js", "src/App.jsx"]) {
    assert.equal(readRepo(f).includes("/api/sales/t/"), false, `${f} must not reference the retired route`);
  }
});

test("12 · the landing renders four truthful states and blames the visitor for none of them", () => {
  const src = readRepo("src/pages/sales/SalesReferralLanding.jsx");
  for (const id of ["sales-referral-validating", "sales-referral-welcome",
    "sales-referral-invalid", "sales-referral-unavailable"]) {
    assert.ok(src.includes(id), `missing state: ${id}`);
  }
  // "Unavailable" must be truthfully distinct from "your link is bad".
  const unavailable = src.slice(src.indexOf("sales-referral-unavailable"), src.indexOf("sales-referral-unavailable") + 400);
  assert.match(unavailable, /temporarily unavailable/i);
  assert.equal(/isn.t valid/i.test(unavailable), false, "a disabled program must not be reported as a bad link");
  // The address is scrubbed BEFORE the network call.
  const scrub = src.indexOf("scrubTokenFromAddressBar()");
  const call = src.indexOf("resolveSalesReferral(raw)");
  assert.ok(scrub > 0 && call > scrub, "the address is clean before any request leaves the browser");
});
