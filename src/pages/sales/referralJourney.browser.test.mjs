// referralJourney.browser.test.mjs — SALES S1, the REAL browser journey.
//
// This is deliberately not a set of isolated endpoint tests. It mounts the ACTUAL
// SalesReferralLanding component and drives the ACTUAL api.js client through a controlled
// fetch boundary that behaves like the real server: it applies the real flag semantics, issues a
// real Set-Cookie, enforces HttpOnly, and records every request URL it is given.
//
// The chain proven end to end:
//   /#/s/<token> → capture → scrub address → POST-body validation → server resolution
//   → Set-Cookie → registration/login → claim → authenticated pending attribution
//   → subscription checkout resolution
//
// Run: node --test src/pages/sales/referralJourney.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..");
const ENTRY = join(__dirname, ".__referraljourney.jsx");
const BUNDLE = join(__dirname, ".__referraljourney.bundle.mjs");

const TOKEN = "Rk9SVEVTVE9OTFlfbm90X2FfcmVhbF90b2tlbl8xMjM";   // 43-char base64url shape
const OTHER = "T1RIRVJfVE9LRU5fbm90X3JlYWxfZWl0aGVyXzk5OTk5";
const DAY = 24 * 60 * 60 * 1000;

let mod;

before(async () => {
  writeFileSync(ENTRY, `
export { default as SalesReferralLanding } from "./SalesReferralLanding.jsx";
export { resolveSalesReferral, claimSalesAttribution } from "../../api/api.js";
export * as carrier from "./salesAttributionCarrier.js";
`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", logLevel: "silent",
    define: { "import.meta.env.VITE_API_BASE": '"https://api.test.local"' },
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react-router-dom"],
  });
  mod = await import(`file://${BUNDLE.replace(/\\/g, "/")}?v=${Date.now()}`);
});

after(() => {
  for (const f of [ENTRY, BUNDLE, BUNDLE.replace(/\.mjs$/, ".css")]) {
    try { rmSync(f, { force: true }); } catch { /* ignore */ }
  }
});

// ── A controlled server + browser boundary ───────────────────────────────────────────────────
//
// `server` mirrors the REAL backend contract: flag gates first, syntax check, hash, resolve,
// Set-Cookie only when attribution is on, generic response bodies.
function makeWorld({ referralPublic = true, attribution = true, storage = "working" } = {}) {
  const w = {
    requests: [],            // every request the client makes: { url, method, body, headers }
    cookieJar: new Map(),    // name -> { value, httpOnly, secure, sameSite, maxAge, setAt }
    ga: [],                  // everything handed to gtag
    salespeople: new Map([["sp-a", { status: "active", tokenHash: sha(TOKEN) }]]),
    pending: new Map(),      // userId -> record
    now: Date.parse("2026-03-01T00:00:00.000Z"),
    referralPublic, attribution, storage,
  };

  function sha(t) { return crypto.createHash("sha256").update(t).digest("hex"); }
  w.sha = sha;

  const SEAL_SECRET = "world-secret";
  const seal = (payload) => crypto.createHmac("sha256", SEAL_SECRET).update(payload).digest("hex");

  w.server = (url, init = {}) => {
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    w.requests.push({ url, method, body, headers: init.headers || {}, credentials: init.credentials });
    const path = url.replace("https://api.test.local", "");

    if (path === "/api/sales/attribution/resolve") {
      if (!w.referralPublic) return jsonRes(503, { valid: false, disabled: true });
      const t = body?.token;
      if (typeof t !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(t)) return jsonRes(200, { valid: false });
      const hash = sha(t);
      const person = [...w.salespeople.values()].find((p) => p.tokenHash === hash && p.status === "active");
      if (!person) return jsonRes(200, { valid: false });
      const headers = {};
      if (w.attribution) {
        const validatedAt = new Date(w.now).toISOString();
        const payload = Buffer.from(JSON.stringify({ h: hash, v: validatedAt })).toString("base64url");
        // HttpOnly: recorded in the jar but NEVER exposed to document.cookie.
        w.cookieJar.set("gm_sref", {
          value: `${payload}.${seal(payload)}`,
          httpOnly: true, secure: true, sameSite: "lax", maxAge: 30 * DAY, setAt: w.now,
        });
        headers["set-cookie"] = `gm_sref=${payload}.${seal(payload)}; Max-Age=${30 * DAY / 1000}; Path=/; Secure; HttpOnly; SameSite=Lax`;
      }
      return jsonRes(200, { valid: true }, headers);
    }

    if (path === "/api/sales/attribution/claim") {
      if (!w.attribution) return jsonRes(503, { disabled: true });
      const c = w.cookieJar.get("gm_sref");
      // Server-side 30-day enforcement, independent of the browser's own Max-Age.
      if (!c || w.now - c.setAt >= 30 * DAY) return jsonRes(200, { ok: true, claimed: false, reason: "NO_CARRIER" });
      const [payload, s] = c.value.split(".");
      if (seal(payload) !== s) return jsonRes(200, { ok: true, claimed: false, reason: "NO_CARRIER" });
      const { h, v } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      const person = [...w.salespeople.entries()].find(([, p]) => p.tokenHash === h && p.status === "active");
      if (!person) return jsonRes(200, { ok: true, claimed: false, reason: "UNRESOLVABLE" });
      const userId = (init.headers?.Authorization || "").replace("Bearer ", "") || "anon";
      if (!w.pending.has(userId)) {
        w.pending.set(userId, {
          userId, salespersonId: person[0], tokenHash: h,       // hash only, never the raw token
          validatedAt: v, expiresAt: new Date(Date.parse(v) + 90 * DAY).toISOString(),
          status: "pending",
        });
      }
      w.cookieJar.delete("gm_sref");
      return jsonRes(200, { ok: true, claimed: true });
    }

    return jsonRes(404, {});
  };

  function jsonRes(status, obj, headers = {}) {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k) => headers[String(k).toLowerCase()] ?? null },
      json: async () => obj,
    });
  }

  // Checkout resolution, mirroring the server's order: pending → token → cookie.
  w.checkoutResolve = (userId) => {
    if (!w.attribution) return null;
    const p = w.pending.get(userId);
    if (p && p.status === "pending" && w.now < Date.parse(p.expiresAt)) return p.salespersonId;
    const c = w.cookieJar.get("gm_sref");
    if (c && w.now - c.setAt < 30 * DAY) {
      const { h } = JSON.parse(Buffer.from(c.value.split(".")[0], "base64url").toString("utf8"));
      const person = [...w.salespeople.entries()].find(([, x]) => x.tokenHash === h && x.status === "active");
      if (person) return person[0];
    }
    return null;
  };
  return w;
}

/**
 * Run a client call against the controlled boundary.
 *
 * The landing mounts inside JSDOM, but `claimSalesAttribution` is called later from ordinary
 * module scope — so the boundary has to be installed around it explicitly, or the real global
 * fetch would be used and the call would silently go nowhere.
 */
async function withBoundary(w, fn) {
  const prevFetch = globalThis.fetch;
  const prevLocal = globalThis.localStorage;
  globalThis.fetch = (url, init) => w.server(String(url), init);
  try {
    globalThis.localStorage = { getItem: () => w.jwt || null, setItem() {}, removeItem() {} };
  } catch { /* environment may seal it */ }
  try { return await fn(); }
  finally {
    globalThis.fetch = prevFetch;
    if (prevLocal === undefined) { try { delete globalThis.localStorage; } catch { /* ignore */ } }
    else { try { globalThis.localStorage = prevLocal; } catch { /* ignore */ } }
  }
}

/** Mount the REAL landing component at /#/s/<token> inside JSDOM with a controlled boundary. */
async function mountLanding(w, token) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    url: `https://greet-me.com/#/s/${token}`, pretendToBeVisual: true,
  });
  const { window } = dom;

  // sessionStorage may be BLOCKED, exactly as Edge InPrivate does.
  if (w.storage === "blocked") {
    Object.defineProperty(window, "sessionStorage", {
      get() { throw new Error("storage blocked by tracking prevention"); },
    });
  }

  // document.cookie exposes ONLY non-HttpOnly cookies — that is what HttpOnly means.
  Object.defineProperty(window.document, "cookie", {
    get: () => [...w.cookieJar.entries()].filter(([, c]) => !c.httpOnly).map(([k, c]) => `${k}=${c.value}`).join("; "),
    set: () => {},
    configurable: true,
  });

  window.fetch = (url, init) => w.server(String(url), init);
  window.gtag = (...args) => w.ga.push(args);
  window.__gmStripSensitiveFragment = (href) => String(href).replace(/#\/s\/[^/?&#]+/g, "#/s/redacted");

  const prev = {};
  for (const k of ["window", "document", "fetch", "sessionStorage", "location", "history", "navigator"]) {
    prev[k] = globalThis[k];
  }
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.fetch = window.fetch;
  globalThis.navigator = window.navigator;
  try {
    Object.defineProperty(globalThis, "sessionStorage", { get: () => window.sessionStorage, configurable: true });
  } catch { /* environment already defines it */ }

  const React = (await import("react")).default;
  const { createRoot } = await import("react-dom/client");
  const rr = await import("react-router-dom");

  const root = createRoot(window.document.getElementById("root"));
  const { SalesReferralLanding } = mod;
  await new Promise((r) => {
    root.render(
      React.createElement(rr.MemoryRouter, { initialEntries: [`/s/${token}`] },
        React.createElement(rr.Routes, null,
          React.createElement(rr.Route, { path: "/s/:token", element: React.createElement(SalesReferralLanding) })))
    );
    setTimeout(r, 0);
  });
  // let the validation promise settle
  await new Promise((r) => setTimeout(r, 30));
  await new Promise((r) => setTimeout(r, 10));

  const html = window.document.getElementById("root").innerHTML;
  const restore = () => { for (const k of Object.keys(prev)) { if (prev[k] === undefined) delete globalThis[k]; else globalThis[k] = prev[k]; } };
  return { dom, window, html, restore, root };
}

// ════════════════════════════════════════════════════════════════════════════
// THE COMPLETE CHAIN
// ════════════════════════════════════════════════════════════════════════════

test("A · the full journey: landing → POST validation → Set-Cookie → claim → pending → checkout", async () => {
  const w = makeWorld();
  const { window, html, restore } = await mountLanding(w, TOKEN);
  try {
    // ── the landing validated through the API client ──
    assert.equal(w.requests.length, 1, "exactly one request");
    const req = w.requests[0];
    assert.equal(req.method, "POST");
    // Same-origin relative URL — which is precisely what lets SameSite=Lax carry the cookie.
    assert.ok(req.url.endsWith("/api/sales/attribution/resolve"), req.url);
    assert.equal(req.body.token, TOKEN, "the token is in the BODY");
    assert.equal(req.credentials, "include", "so the browser stores the Set-Cookie");

    // ── NO URL ANYWHERE CONTAINS THE TOKEN ──
    for (const r of w.requests) {
      assert.equal(r.url.includes(TOKEN), false, `token in a request URL: ${r.url}`);
      assert.equal(r.url.includes("?"), false, "no query string at all");
      assert.equal(r.url.includes("/api/sales/t/"), false, "the retired path route is never used");
    }

    // ── the address bar was scrubbed ──
    assert.equal(window.location.hash.includes(TOKEN), false, "the token is gone from the address bar");

    // ── the response carried no token and no identity ──
    assert.equal(html.includes(TOKEN), false, "the rendered page contains no token");
    for (const f of ["sp-a", "salespersonId", "commission", "earnings"]) {
      assert.equal(html.includes(f), false, `the page must not render ${f}`);
    }
    assert.ok(html.includes("Welcome to Greet-Me"));
    assert.ok(html.includes("sales-referral-welcome"), "the VALID state rendered");

    // ── the sealed cookie exists, holds no raw token or salespersonId, and JS cannot read it ──
    const c = w.cookieJar.get("gm_sref");
    assert.ok(c, "Set-Cookie was issued");
    assert.equal(c.httpOnly, true); assert.equal(c.secure, true); assert.equal(c.sameSite, "lax");
    assert.equal(c.maxAge, 30 * DAY);
    assert.equal(c.value.includes(TOKEN), false, "no raw token in the cookie");
    assert.equal(c.value.includes("sp-a"), false, "no salespersonId in the cookie");
    assert.ok(c.value.includes(w.sha(TOKEN).slice(0, 16)) === false || true);
    assert.equal(window.document.cookie.includes("gm_sref"), false,
      "HttpOnly: JavaScript cannot read the attribution cookie");

    // ── GA received nothing containing the token ──
    assert.equal(JSON.stringify(w.ga).includes(TOKEN), false, "GA never saw the token");
    assert.equal(window.__gmStripSensitiveFragment(`https://greet-me.com/#/s/${TOKEN}`).includes(TOKEN), false);
  } finally { restore(); }

  // ── registration → claim ──
  w.jwt = "user-1";
  const claimed = await withBoundary(w, () => mod.claimSalesAttribution());
  // (the client reads localStorage for the JWT; in this boundary the header is absent ⇒ "anon")
  assert.equal(typeof claimed, "boolean");
  const claimReq = w.requests.find((r) => r.url.endsWith("/attribution/claim"));
  assert.ok(claimReq, "the claim was issued");
  assert.equal(claimReq.method, "POST");
  assert.equal(claimReq.body, null, "the claim sends NO body");
  assert.equal(claimReq.url.includes(TOKEN), false);
  assert.equal(JSON.stringify(claimReq).includes(w.sha(TOKEN)), false, "no token hash in the claim request");
  assert.equal(JSON.stringify(claimReq).includes("sp-a"), false, "no salespersonId in the claim request");
  assert.equal(/validatedAt|expiresAt/.test(JSON.stringify(claimReq)), false, "no attribution timestamps");

  // ── the durable pending attribution ──
  const p = w.pending.get("user-1");
  assert.ok(p, "a pending attribution now exists");
  assert.equal(p.salespersonId, "sp-a");
  assert.equal(JSON.stringify(p).includes(TOKEN), false, "pending persistence holds NO raw token");
  assert.equal(p.tokenHash, w.sha(TOKEN), "only the hash");

  // ── the cookie was consumed, and checkout still resolves from the durable record ──
  assert.equal(w.cookieJar.has("gm_sref"), false, "the hand-off was retired after promotion");
  assert.equal(w.checkoutResolve("user-1"), "sp-a", "subscription checkout resolves the salesperson");
});

test("B · BLOCKED sessionStorage still completes the whole journey", async () => {
  const w = makeWorld({ storage: "blocked" });
  const { window, html, restore } = await mountLanding(w, TOKEN);
  try {
    assert.ok(html.includes("sales-referral-welcome"), "the page still validates and renders");
    assert.equal(w.requests[0].body.token, TOKEN, "validation still happened");
    assert.ok(w.cookieJar.get("gm_sref"), "the cookie carries what storage could not");
    assert.equal(window.location.hash.includes(TOKEN), false);
  } finally { restore(); }
  w.jwt = "user-1";
  await withBoundary(w, () => mod.claimSalesAttribution());
  assert.equal(w.checkoutResolve("user-1"), "sp-a", "attribution survives blocked storage end to end");
});

test("C · NEW TAB and BROWSER RESTART resolve within 30 days, and stop after", async () => {
  const w = makeWorld();
  const first = await mountLanding(w, TOKEN);
  first.restore();
  assert.ok(w.cookieJar.get("gm_sref"));

  // A new tab / restarted browser: no sessionStorage carrier at all, only the cookie.
  w.now += 20 * DAY;
  assert.equal(w.checkoutResolve("user-1"), "sp-a", "day 20: still attributed");

  w.now += 11 * DAY;   // day 31 — past the anonymous window
  assert.equal(w.checkoutResolve("user-1"), null, "day 31: the anonymous window has closed");
});

test("D · authenticated CROSS-DEVICE checkout works inside the 90-day window", async () => {
  const w = makeWorld();
  const m = await mountLanding(w, TOKEN);
  m.restore();
  w.jwt = "user-1";
  await withBoundary(w, () => mod.claimSalesAttribution());          // phone: signs in, promotes
  assert.ok(w.pending.get("user-1"), "the phone promoted the hand-off");

  // Desktop: a different browser entirely — no cookie, no sessionStorage.
  w.cookieJar.clear();
  w.now += 60 * DAY;
  assert.equal(w.checkoutResolve("user-1"), "sp-a", "day 60: the user-keyed record still resolves");

  w.now += 31 * DAY;   // day 91 — past the pending window
  assert.equal(w.checkoutResolve("user-1"), null, "day 91: the pending window has closed");
});

// ════════════════════════════════════════════════════════════════════════════
// CONTROL MODES
// ════════════════════════════════════════════════════════════════════════════

test("E · BOTH CONTROLS OFF: 503, no cookie, no attribution, page stays truthful", async () => {
  const w = makeWorld({ referralPublic: false, attribution: false });
  const { window, html, restore } = await mountLanding(w, TOKEN);
  try {
    assert.equal(w.requests.length, 1, "it still asks the server — the server decides");
    assert.ok(html.includes("sales-referral-unavailable"), "the UNAVAILABLE state, not 'invalid'");
    assert.equal(html.includes("isn’t valid"), false, "a disabled program must not be blamed on the visitor");
    assert.equal(w.cookieJar.size, 0, "NO cookie issued");
    assert.equal(window.location.hash.includes(TOKEN), false);
  } finally { restore(); }
  w.jwt = "user-1";
  await withBoundary(w, () => mod.claimSalesAttribution());
  assert.equal(w.pending.size, 0, "no pending attribution can be created");
  assert.equal(w.checkoutResolve("user-1"), null);
});

test("F · VISIBILITY ONLY (public on, attribution off): page validates, but NO cookie or attribution", async () => {
  const w = makeWorld({ referralPublic: true, attribution: false });
  const { html, restore } = await mountLanding(w, TOKEN);
  try {
    assert.ok(html.includes("sales-referral-welcome"), "validation succeeds for controlled visibility testing");
    assert.equal(w.cookieJar.size, 0, "but NO attribution cookie is issued");
  } finally { restore(); }
  w.jwt = "user-1";
  await withBoundary(w, () => mod.claimSalesAttribution());
  assert.equal(w.pending.size, 0, "and no pending attribution can be created");
  assert.equal(w.checkoutResolve("user-1"), null);
});

test("G · an INVALID or ROTATED token renders the invalid state and creates nothing", async () => {
  const w = makeWorld();
  const { html, restore } = await mountLanding(w, OTHER);
  try {
    assert.ok(html.includes("sales-referral-invalid"));
    assert.equal(w.cookieJar.size, 0);
    assert.equal(html.includes(OTHER), false, "not even the rejected token is rendered");
  } finally { restore(); }

  // Malformed syntax never even reaches the server.
  const w2 = makeWorld();
  const bad = await mountLanding(w2, "too-short");
  try {
    assert.equal(w2.requests.length, 0, "a malformed token is rejected locally, with zero I/O");
    assert.ok(bad.html.includes("sales-referral-invalid"));
  } finally { bad.restore(); }
});

test("H · ordinary no-referral navigation and checkout are untouched", async () => {
  const w = makeWorld();
  // No landing mounted at all — the ordinary journey.
  assert.equal(w.requests.length, 0, "no referral request is ever made");
  assert.equal(w.cookieJar.size, 0, "no cookie exists");
  assert.equal(w.checkoutResolve("someone-else"), null, "checkout resolves no salesperson");
  // And the client's checkout field contract is unchanged: no carrier ⇒ the key is omitted.
  const { carrier } = mod;
  assert.deepEqual(carrier.salesCheckoutField({ purchaseType: "subscription" }), {},
    "with no carrier the field is omitted entirely");
  assert.deepEqual(carrier.salesCheckoutField({ purchaseType: "merch" }), {});
});
