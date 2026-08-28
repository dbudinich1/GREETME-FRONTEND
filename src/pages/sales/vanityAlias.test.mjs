// src/pages/sales/vanityAlias.test.mjs — SALES S1 clean salesperson link.
//
// https://greet-me.com/<alias> is the second PUBLIC form of the same referral. These prove the
// browser half: the pathname is recognised before hash routing discards it, the alias reaches the
// existing carrier through the existing first-touch rule, no real page is ever shadowed, and the
// address bar is never rewritten.
//
// Every alias here is FICTIONAL. No production slug appears in this file.
//
// Run (Node 20.x): node --test src/pages/sales/vanityAlias.test.mjs

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

class MemStore {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  get length() { return this.m.size; }
}
globalThis.sessionStorage = new MemStore();

const { readVanityAlias, RESERVED_PATHS } = await import("./vanityAlias.js");
const { captureToken, readToken, salesCheckoutField } = await import("./salesAttributionCarrier.js");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(path.join(HERE, ...p), "utf8").replace(/\r\n/g, "\n");
const APP = read("..", "..", "App.jsx");
const LANDING = read("SalesReferralLanding.jsx");
const CHECKOUT = read("..", "Checkout.jsx");

const TOKEN = "T".repeat(43);
beforeEach(() => { globalThis.sessionStorage = new MemStore(); });

// ── PATHNAME RECOGNITION ────────────────────────────────────────────────────

test("P1 · a single eligible segment is read as an alias", () => {
  for (const [pathname, expected] of [
    ["/alex", "alex"], ["/alex/", "alex"], ["/north-west", "north-west"],
    ["/a1", "a1"], ["/ab", "ab"], [`/${"x".repeat(40)}`, "x".repeat(40)],
  ]) {
    assert.equal(readVanityAlias(pathname), expected, pathname);
  }
});

test("P2 · reserved application paths are NEVER treated as aliases", () => {
  const mustBeReserved = [
    "/", "/login", "/register", "/dashboard", "/pricing", "/legal", "/support", "/admin",
    "/api", "/assets", "/health", "/s", "/f", "/g", "/gift", "/merch", "/fundraiser",
    "/settings", "/profile", "/checkout", "/manifest.json", "/sw.js", "/favicon.ico",
    "/robots.txt", "/logout", "/signup", "/privacy", "/terms",
  ];
  for (const p of mustBeReserved) assert.equal(readVanityAlias(p), null, `${p} must not be an alias`);
});

test("P3 · every real top-level route in App.jsx is reserved", () => {
  // Read the ACTUAL routes rather than trusting a hand-kept list.
  const declared = [...APP.matchAll(/path="\/([^/"*:]+)"/g)].map((m) => m[1]).filter(Boolean);
  assert.ok(declared.length > 10, `expected many routes, found ${declared.length}`);
  for (const seg of new Set(declared)) {
    assert.equal(RESERVED_PATHS.has(seg), true, `App.jsx route "/${seg}" must be reserved`);
    assert.equal(readVanityAlias(`/${seg}`), null, `/${seg} must not resolve as an alias`);
  }
});

test("P4 · nested, malformed and hash paths are refused", () => {
  for (const p of [
    "/alex/extra", "/a", "/-alex", "/alex-", "/al--ex", "/Alex", "/ALEX", "/alex_g",
    "/alex g", "/x".repeat(60), "", "/", "//", "alex", null, undefined, 42, {},
    "/#/s/" + TOKEN,
  ]) {
    assert.equal(readVanityAlias(p), null, `must refuse ${JSON.stringify(p)}`);
  }
});

test("P5 · a percent-encoded segment cannot smuggle a reserved path or a slash", () => {
  assert.equal(readVanityAlias("/%64ashboard"), null, "decodes to 'dashboard' → reserved");
  assert.equal(readVanityAlias("/alex%2Fextra"), null, "decodes to a nested path");
  assert.equal(readVanityAlias("/%2E%2E"), null);
  assert.equal(readVanityAlias("/%ZZ"), null, "malformed encoding fails closed");
});

// ── CARRIER INTEGRATION ─────────────────────────────────────────────────────

test("C1 · an alias enters the EXISTING carrier and the EXISTING checkout field", () => {
  const alias = readVanityAlias("/alex");
  assert.equal(captureToken(alias), true);
  assert.equal(readToken(), "alex");
  const field = salesCheckoutField({ purchaseType: "subscription" });
  assert.deepEqual(Object.keys(field), ["salesAttributionToken"], "one field, unchanged");
  assert.equal(field.salesAttributionToken, "alex");
  assert.equal("salespersonId" in field, false, "the browser never names a salesperson");
});

test("C2 · FIRST TOUCH holds across both forms, in both orders", () => {
  // alias first → token second
  assert.equal(captureToken("alex"), true);
  assert.equal(captureToken(TOKEN), false);
  assert.equal(readToken(), "alex");

  // token first → alias second
  globalThis.sessionStorage = new MemStore();
  assert.equal(captureToken(TOKEN), true);
  assert.equal(captureToken("alex"), false);
  assert.equal(readToken(), TOKEN);

  // alias A first → alias B second
  globalThis.sessionStorage = new MemStore();
  assert.equal(captureToken("alex"), true);
  assert.equal(captureToken("blake"), false);
  assert.equal(readToken(), "alex");
});

test("C3 · an invalid alias creates no carrier and never clears a valid first referral", () => {
  // invalid first → valid alias second
  assert.equal(captureToken("-bad"), false);
  assert.equal(readToken(), null, "nothing was carried");
  assert.equal(captureToken("alex"), true, "the next valid referral may still begin the journey");
  assert.equal(readToken(), "alex");

  // valid alias first → invalid token second
  assert.equal(captureToken("!".repeat(43)), false);
  assert.equal(readToken(), "alex", "the first referral survived");
});

test("C4 · a consumed carrier lets the next valid referral begin a new journey", async () => {
  const { clearToken } = await import("./salesAttributionCarrier.js");
  assert.equal(captureToken("alex"), true);
  clearToken();
  assert.equal(readToken(), null);
  assert.equal(captureToken("blake"), true, "a new journey starts clean");
  assert.equal(readToken(), "blake");
});

// ── RENDERING AND URL ───────────────────────────────────────────────────────

test("R1 · the alias is read BEFORE the router but RENDERED INSIDE it", () => {
  // This test previously asserted the landing was rendered ABOVE <HashRouter> — which was the
  // production defect: useNavigate() throws outside a Router and the page went blank. It now
  // asserts the corrected shape, and the render-level proof lives in
  // vanityLandingRender.browser.test.mjs, which mounts the real App and would catch a regression
  // that no source-string assertion can.
  // Strip comments before slicing: the code COMMENT explaining this fix contains the literal
  // "<HashRouter>", which would truncate the slice before the line under test.
  const src = APP.replace(/\/\*[\s\S]*?\*\//g, "")
    .split(String.fromCharCode(10)).filter((l) => !l.trim().startsWith("//")).join(String.fromCharCode(10));
  const head = src.slice(src.indexOf("export default function App()"), src.indexOf("<HashRouter>"));
  assert.match(head, /currentVanityAlias\(\)/, "the alias is read before the route table");
  assert.equal(/<SalesReferralLanding/.test(head), false,
    "the landing must NOT be rendered above the router");

  const routed = src.slice(src.indexOf("<HashRouter>"), src.indexOf("</HashRouter>"));
  assert.match(routed, /<SalesReferralLanding code=\{vanityAlias\}/, "it renders inside the router");

  // Nothing on the vanity path touches the address bar.
  assert.equal(/history\.(push|replace)|location\.(replace|assign)|window\.location\s*=/.test(head), false,
    "the clean URL must be left exactly as the visitor received it");
});

test("R2 · the landing renders the ordinary welcome and discloses NO salesperson identity", () => {
  // Strip comments first: the file EXPLAINS that it exposes no name, email or commission, and
  // prose describing the guarantee must not read as a breach of it.
  const code = LANDING.replace(/\/\*[\s\S]*?\*\//g, "")
    .split(String.fromCharCode(10)).filter((l) => !l.trim().startsWith("//")).join(String.fromCharCode(10));
  for (const forbidden of [
    /salespersonId/, /displayName/, /\bemail\b/, /commission/, /attributionStatus/,
    /earnings/, /admin/i, /referralSlug/,
  ]) {
    assert.equal(forbidden.test(code), false, `landing must not reference ${forbidden}`);
  }
  assert.match(LANDING, /Welcome to Greet-Me/);
  assert.match(LANDING, /data-testid="sales-referral-landing"/);
});

test("R3 · the existing /#/s/:token route is untouched", () => {
  assert.match(APP, /<Route path="\/s\/:token"/);
  assert.match(LANDING, /useParams\(\)/, "the hash route still supplies its param");
  // The alias path supplies `code`; the hash route still works with no prop at all.
  assert.match(LANDING, /code = null/);
});

test("R4 · checkout still submits ONLY the established carrier field", () => {
  assert.match(CHECKOUT, /\.\.\.salesCheckoutField\(\{ purchaseType: item\.purchaseType \|\| 'subscription' \}\)/);
  assert.equal(/salespersonId/.test(CHECKOUT), false, "checkout never sends a salespersonId");
  assert.equal(/referralSlug|vanityAlias/.test(CHECKOUT), false, "and no second referral field was added");
});

test("R5 · no production identity is hard-coded anywhere in this lane", () => {
  for (const [label, src] of [["App.jsx", APP], ["landing", LANDING], ["alias", read("vanityAlias.js")],
    ["carrier", read("salesAttributionCarrier.js")]]) {
    for (const needle of ["Rudy", "Germany", "sp-rudy"]) {
      assert.equal(src.includes(needle), false, `${label} must not contain "${needle}"`);
    }
  }
  assert.equal(RESERVED_PATHS.has("alex"), false, "an ordinary first-name alias is not reserved");
});
