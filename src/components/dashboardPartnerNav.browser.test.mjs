// src/components/dashboardPartnerNav.browser.test.mjs
//
// TEAM B (PARTNER-READINESS B3 — CORRECTION) — RENDERED-COMPONENT coverage of the partner
// navigation entry. The REAL DashboardLayout is esbuild-transformed and mounted into jsdom with the
// REAL useFundraiserPartnerAccess hook and the REAL fundraiserApi client running over a controllable
// global fetch. Only ambient collaborators (router, auth provider, icons, widgets, services) are
// stubbed — the navigation logic and access lifecycle under test are genuine.
//
// Proves ACTUAL React behaviour, not source text: the auth-transition probe, the no-repeat-probe
// guarantee, immediate hiding on auth loss, stale-response suppression, the full visibility matrix,
// desktop + mobile parity, the untouched founder entry, and unchanged personal navigation.
//
// Run under the SUPPORTED runtime (package.json engines: node 20.x):
//   node --test src/components/dashboardPartnerNav.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__navlayout.bundle.mjs");
let React, createRoot, act, DashboardLayout;

// ── stubs for ambient collaborators (never for the code under test) ──
// react-router-dom's NavLink accepts FUNCTION-valued style/className ({ isActive }) => ...; the stub
// resolves them exactly as the real component does, and renders children the same way.
const ROUTER_STUB = `
import React from "react";
export const NavLink = ({ to, children, style, className, ...rest }) => {
  const s = typeof style === "function" ? style({ isActive: false, isPending: false }) : style;
  const c = typeof className === "function" ? className({ isActive: false, isPending: false }) : className;
  const kids = typeof children === "function" ? children({ isActive: false, isPending: false }) : children;
  return React.createElement("a", { href: to, "data-nav": to, style: s, className: c, ...rest }, kids);
};
export const Outlet = () => null;
export const useNavigate = () => (() => {});
export const useLocation = () => ({ pathname: "/dashboard" });
`;
// Auth provider stub: runtime-controllable via globalThis.__auth = { user, loading }.
const AUTH_STUB = `
export const useAuth = () => {
  const a = globalThis.__auth || { user: null, loading: false };
  return { user: a.user, loading: !!a.loading, isAuthenticated: !!a.user, logout: () => {} };
};
export const AuthContext = {};
`;
const GATE_STUB = `export const isFundraiserUiEnabled = () => !!globalThis.__flag;`;
// lucide-react: every named icon import resolves to a no-op component.
const ICONS_STUB = `
import React from "react";
const I = () => null;
export const Gift = I, ShoppingBag = I, Settings = I, LogOut = I, Users = I, ShoppingCart = I,
  Film = I, X = I, Image = I, QrCode = I;
export default { };
`;
const NULLCOMP_STUB = `const N = () => null; export default N;`;
const GUIDED_STUB = `const N = () => null; export default N; export const shouldShowGuidedSetupForUser = () => false;`;
const ACCOUNTSTATE_HOOK_STUB = `export const useAccountState = () => ({ isAuthenticated: !!(globalThis.__auth && globalThis.__auth.user), isSubscribed: true, isOnboardingComplete: true });`;
const API_STUB = `export default { getHeartsBalance: async () => ({ balance: 0 }) };`;
const CART_STUB = `export default { getCount: () => 0 };`;
const CREDITS_STUB = `export default { getCount: () => 0 };`;

function stubPlugin() {
  const map = [
    [/^react-router-dom$/, ROUTER_STUB, "rr"],
    [/context[\\/]AuthContext$/, AUTH_STUB, "auth"],
    [/fundraiserGate\.js$/, GATE_STUB, "gate"],
    [/^lucide-react$/, ICONS_STUB, "icons"],
    [/GreetMeLogo$/, NULLCOMP_STUB, "logo"],
    [/NotificationBell$/, NULLCOMP_STUB, "bell"],
    [/GuidedSetupFlow$/, GUIDED_STUB, "guided"],
    [/hooks[\\/]useAccountState$/, ACCOUNTSTATE_HOOK_STUB, "acct"],
    [/api[\\/]api$/, API_STUB, "api"],
    [/cartService$/, CART_STUB, "cart"],
    [/imageCreditsService$/, CREDITS_STUB, "credits"],
  ];
  return { name: "stub", setup(b) {
    for (const [filter, contents, ns] of map) {
      b.onResolve({ filter }, (a) => ({ path: a.path, namespace: ns }));
      b.onLoad({ filter: /.*/, namespace: ns }, () => ({ contents, loader: "js" }));
    }
  } };
}

before(async () => {
  writeFileSync(join(__dirname, ".__navlayout.jsx"), `export { default as DashboardLayout } from "./DashboardLayout.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__navlayout.jsx")], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [stubPlugin()], logLevel: "silent",
  });
  rmSync(join(__dirname, ".__navlayout.jsx"), { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.localStorage = window.localStorage;
  globalThis.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => window.clearTimeout(id);
  // NOTE: do NOT assign globalThis.performance = window.performance — jsdom's Performance delegates
  // to the global, so aliasing it onto itself recurses until the stack overflows. Node's native
  // performance is already present and is what the component's rAF count-up uses.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ DashboardLayout } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

// ── controllable fetch (counts ONLY fundraiser partner-org calls) ──
let partnerCalls = 0;
function installFetch(next) {
  partnerCalls = 0;
  globalThis.__nextResponse = next;
  globalThis.fetch = (url) => {
    const u = String(url);
    if (u.includes("/api/fundraiser/partner/orgs")) {
      partnerCalls++;
      const r = globalThis.__nextResponse;
      if (r === "pending") return new Promise(() => {});
      if (r instanceof Error) return Promise.reject(r);
      return Promise.resolve({ ok: r.ok, status: r.status, json: async () => r.data });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  };
}

const ORGS = (n) => ({ organizations: Array.from({ length: n }, (_, i) => ({ organizationId: `org_${i}`, name: `Org ${i}`, status: "approved" })) });
const OK = (n) => ({ ok: true, status: 200, data: ORGS(n) });
const STATUS = (s, data = {}) => ({ ok: s >= 200 && s < 300, status: s, data });

const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

async function mount({ flag = true, user = { id: "u1", email: "p@x.com" }, loading = false, next = OK(1) } = {}) {
  installFetch(next);
  globalThis.__flag = flag;
  globalThis.__auth = { user, loading };
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(DashboardLayout)); });
  await settle();
  return { root, host };
}
async function rerender(root) { await act(async () => { root.render(React.createElement(DashboardLayout)); }); await settle(); }

// Every rendered link carrying this href, across BOTH nav consumers (mobile drawer + desktop bar).
const partnerLinks = () => [...document.querySelectorAll('[data-nav="/dashboard/fundraiser"]')];
const founderLinks = () => [...document.querySelectorAll('[data-nav="/dashboard/fundraiser/admin"]')];
const labelsOf = (sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent.trim());

// ── lifecycle: the corrected defect ──

test("B3fix: unauthenticated at mount, then authenticated ⇒ exactly ONE probe and the entry appears", async () => {
  const { root } = await mount({ user: null, next: OK(1) });
  assert.equal(partnerCalls, 0, "no request while unauthenticated");
  assert.equal(partnerLinks().length, 0, "hidden while unauthenticated");

  globalThis.__auth = { user: { id: "u1" }, loading: false };
  await rerender(root);

  assert.equal(partnerCalls, 1, "exactly one probe on the auth transition");
  assert.ok(partnerLinks().length >= 1, "entry appears after the qualifying response");
});

test("B3fix: auth still loading ⇒ no probe; entry hidden until readiness", async () => {
  const { root } = await mount({ user: null, loading: true, next: OK(1) });
  assert.equal(partnerCalls, 0, "no request while auth is initializing");
  assert.equal(partnerLinks().length, 0);

  globalThis.__auth = { user: { id: "u1" }, loading: false };
  await rerender(root);
  assert.equal(partnerCalls, 1);
  assert.ok(partnerLinks().length >= 1);
});

test("B3fix: repeated rerenders after authentication do NOT repeat the probe", async () => {
  const { root } = await mount({ next: OK(1) });
  assert.equal(partnerCalls, 1);
  for (let i = 0; i < 4; i++) await rerender(root);
  assert.equal(partnerCalls, 1, "still exactly one probe after four rerenders");
  assert.ok(partnerLinks().length >= 1, "and it stays visible");
});

test("B3fix: authenticated ⇒ unauthenticated hides the entry immediately", async () => {
  const { root } = await mount({ next: OK(1) });
  assert.ok(partnerLinks().length >= 1);

  globalThis.__auth = { user: null, loading: false };
  await act(async () => { root.render(React.createElement(DashboardLayout)); }); // no settle: same render pass
  assert.equal(partnerLinks().length, 0, "hidden in the same render, without waiting for an effect");
});

test("B3fix: a stale in-flight response cannot restore visibility after logout", async () => {
  let release;
  installFetch("pending");
  globalThis.fetch = (url) => {
    if (String(url).includes("/api/fundraiser/partner/orgs")) {
      partnerCalls++;
      return new Promise((res) => { release = () => res({ ok: true, status: 200, json: async () => ORGS(1) }); });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  };
  globalThis.__flag = true; globalThis.__auth = { user: { id: "u1" }, loading: false };
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(DashboardLayout)); });
  await settle();
  assert.equal(partnerLinks().length, 0, "still pending ⇒ not yet visible");

  // Log out while the probe is in flight, THEN let the stale response land.
  globalThis.__auth = { user: null, loading: false };
  await rerender(root);
  await act(async () => { release(); await new Promise((r) => setTimeout(r, 0)); });
  await settle();
  assert.equal(partnerLinks().length, 0, "the superseded response must NOT reveal the entry");
});

test("B3fix: a later authentication may probe again for the NEW session", async () => {
  const { root } = await mount({ next: OK(1) });
  assert.equal(partnerCalls, 1);
  globalThis.__auth = { user: null, loading: false };
  await rerender(root);
  assert.equal(partnerLinks().length, 0);

  globalThis.__nextResponse = OK(2);
  globalThis.__auth = { user: { id: "u2" }, loading: false };
  await rerender(root);
  assert.equal(partnerCalls, 2, "one probe per qualified session");
  assert.ok(partnerLinks().length >= 1);
});

test("B3fix: the new session never inherits the previous session's answer", async () => {
  const { root } = await mount({ next: OK(1) });
  assert.ok(partnerLinks().length >= 1, "session 1 qualified");

  globalThis.__auth = { user: null, loading: false };
  await rerender(root);

  // Session 2 is NOT a partner — its probe stays pending, so nothing may be shown meanwhile.
  globalThis.__nextResponse = "pending";
  globalThis.__auth = { user: { id: "u2" }, loading: false };
  await rerender(root);
  assert.equal(partnerLinks().length, 0, "no stale carry-over from the previous session");
});

// ── visibility matrix (rendered) ──

test("B3fix: qualified partner administrator renders 'Greet-Me Fundraise' at /dashboard/fundraiser", async () => {
  await mount({ next: OK(1) });
  const links = partnerLinks();
  assert.ok(links.length >= 1);
  assert.equal(links[0].getAttribute("href"), "/dashboard/fundraiser");
  assert.ok(links.some((l) => l.textContent.includes("Greet-Me Fundraise")), "exact label rendered");
});

test("B3fix: multi-organization partner also sees it", async () => {
  await mount({ next: OK(3) });
  assert.ok(partnerLinks().length >= 1);
});

test("B3fix: founder with no administered organization (200 empty) stays hidden", async () => {
  await mount({ next: STATUS(200, { organizations: [] }) });
  assert.equal(partnerLinks().length, 0);
});

test("B3fix: ordinary user (403), 401, 503, malformed and network failure all stay hidden", async () => {
  for (const next of [
    STATUS(403, { code: "NO_FUNDRAISER_ROLE" }),
    STATUS(401, { code: "AUTH_REQUIRED" }),
    STATUS(503, { disabled: true }),
    STATUS(200, { organizations: null }),
    STATUS(200, {}),
    STATUS(200, { organizations: "nope" }),
    new Error("network down"),
  ]) {
    await mount({ next });
    assert.equal(partnerLinks().length, 0, `must stay hidden for ${JSON.stringify(next.status ?? "network")}`);
  }
});

test("B3fix: flag disabled ⇒ hidden AND zero fundraiser requests", async () => {
  await mount({ flag: false, next: OK(1) });
  assert.equal(partnerCalls, 0, "no request while the gate is off");
  assert.equal(partnerLinks().length, 0);
});

test("B3fix: unmount during an in-flight request performs no post-unmount update", async () => {
  const warnings = [];
  const origErr = console.error;
  console.error = (...a) => { warnings.push(a.join(" ")); };
  try {
    let release;
    partnerCalls = 0;
    globalThis.fetch = (url) => {
      if (String(url).includes("/api/fundraiser/partner/orgs")) {
        partnerCalls++;
        return new Promise((res) => { release = () => res({ ok: true, status: 200, json: async () => ORGS(1) }); });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    };
    globalThis.__flag = true; globalThis.__auth = { user: { id: "u1" }, loading: false };
    document.body.innerHTML = "";
    const host = document.createElement("div"); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(React.createElement(DashboardLayout)); });
    await settle();
    await act(async () => { root.unmount(); });          // unmount mid-flight
    await act(async () => { release(); await new Promise((r) => setTimeout(r, 0)); });
    assert.ok(!warnings.some((w) => /unmounted component|not wrapped in act/i.test(w)), `no post-unmount warning; saw: ${warnings.join(" | ")}`);
  } finally { console.error = origErr; }
});

// ── surrounding navigation must be untouched ──

test("B3fix: the founder 'Fundraising' entry is unchanged and independent of partner status", async () => {
  // Founder (plan) who administers NO organization: partner entry hidden, founder entry shown.
  await mount({ user: { id: "f1", plan: "founder" }, next: STATUS(200, { organizations: [] }) });
  assert.equal(partnerLinks().length, 0, "founder does not get the partner entry");
  const f = founderLinks();
  assert.ok(f.length >= 1, "founder admin entry still rendered");
  assert.equal(f[0].getAttribute("href"), "/dashboard/fundraiser/admin");
  assert.ok(f.some((l) => l.textContent.includes("Fundraising")));
});

test("B3fix: a non-founder never sees the founder administration entry", async () => {
  await mount({ next: OK(1) });
  assert.equal(founderLinks().length, 0, "partner admin must not see Founder Admin");
  assert.ok(partnerLinks().length >= 1);
});

test("B3fix: desktop AND mobile consumers both reflect the shared navigation result", async () => {
  // The two consumers are MUTUALLY EXCLUSIVE by design: the desktop bar renders under
  // {!isNarrow} (DashboardLayout:884) and the mobile drawer under {isNarrow && mobileMenuOpen}
  // (:692). So each is asserted in its own mode — proving one shared array drives both.
  const openDrawer = async () => {
    window.innerWidth = 500;
    await act(async () => { window.dispatchEvent(new Event("resize")); });
    const hamburger = document.querySelector("button");
    assert.ok(hamburger, "hamburger control renders at narrow width");
    await act(async () => { hamburger.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
    await settle();
  };
  try {
    // QUALIFIED — desktop
    await mount({ next: OK(1) });
    assert.equal(partnerLinks().length, 1, "desktop bar shows the entry");
    // QUALIFIED — mobile drawer
    await openDrawer();
    assert.equal(partnerLinks().length, 1, "mobile drawer shows the same entry");
    assert.equal(partnerLinks()[0].getAttribute("href"), "/dashboard/fundraiser");

    // UNQUALIFIED — absent from both
    window.innerWidth = 1024;
    await mount({ next: STATUS(403, {}) });
    assert.equal(partnerLinks().length, 0, "absent from the desktop bar");
    await openDrawer();
    assert.equal(partnerLinks().length, 0, "absent from the mobile drawer");
  } finally {
    window.innerWidth = 1024; // never leak the viewport into later tests
    await act(async () => { window.dispatchEvent(new Event("resize")); });
  }
});

test("B3fix: existing personal navigation entries are unchanged in presence and order", async () => {
  await mount({ next: OK(1) });
  const expected = ["/dashboard", "/dashboard/contacts", "/pricing", "/dashboard/gifts", "/dashboard/rewards", "/dashboard/hero", "/business"];
  for (const href of expected) {
    assert.ok(document.querySelector(`[data-nav="${href}"]`), `personal nav entry ${href} must still render`);
  }
  // Order within a single consumer (the desktop bar is the last rendered tree).
  const all = [...document.querySelectorAll("[data-nav]")].map((e) => e.getAttribute("data-nav"));
  const firstIdx = expected.map((h) => all.indexOf(h));
  assert.deepEqual(firstIdx, [...firstIdx].sort((a, b) => a - b), "personal navigation order preserved");
  assert.ok(all.indexOf("/dashboard/fundraiser") > all.indexOf("/business"), "partner entry stays in its existing position after For Business");
});

test("B3fix: the nested Corporate Campaign Dashboard child is untouched", async () => {
  // The child renders only once its submenu is opened (DashboardLayout:970) — open it for real.
  await mount({ next: OK(1) });
  assert.ok(document.querySelector('[data-nav="/business"]'), "For Business parent still rendered");
  const caret = document.querySelector('button[aria-label="Open For Business menu"]');
  assert.ok(caret, "the For Business caret control still exists");
  await act(async () => { caret.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  await settle();
  assert.ok(document.querySelector('[data-nav="/dashboard/campaigns"]'), "nested Corporate Campaign Dashboard child intact");
});
