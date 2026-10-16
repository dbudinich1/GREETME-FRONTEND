// src/components/guidedSetupFundraisersExclusion.browser.test.mjs
//
// Report 87 A7 — founder rule (Q7): the Hearts welcome popup (GuidedSetupFlow) must NOT show on the
// public Fundraisers page, and nothing else changes. RENDERED coverage: the REAL DashboardLayout is
// esbuild-transformed and mounted in jsdom; only ambient collaborators are stubbed (same harness as
// dashboardPartnerNav.browser.test.mjs). The gate decision (shouldShowGuidedSetupForUser) is driven
// by the test, so the ONLY variable is the route.
//
// Run under the supported runtime (engines: node 20.x):
//   node --test src/components/guidedSetupFundraisersExclusion.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { isGuidedSetupExcludedRoute } from "./guidedSetupRouteExclusion.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, `.__guidedx.${process.pid}.bundle.mjs`);
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
export const useLocation = () => ({ pathname: globalThis.__path || "/dashboard" });
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
// The REAL gate decision is replaced by a controllable one so the test isolates the ROUTE exclusion:
// whenever the gate says "show", only the route may suppress the popup.
const GUIDED_STUB = `import React from "react"; const G = () => React.createElement("div", { "data-testid": "guided-setup" }, "Welcome"); export default G; export const shouldShowGuidedSetupForUser = () => !!globalThis.__showGuided;`;
const ACCOUNTSTATE_HOOK_STUB = `export const useAccountState = () => ({ isAuthenticated: !!(globalThis.__auth && globalThis.__auth.user), isSubscribed: false, isOnboardingComplete: false });`;
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
  const entry = join(__dirname, `.__guidedx.${process.pid}.jsx`);
  writeFileSync(entry, `export { default as DashboardLayout } from "./DashboardLayout.jsx";
`);
  await esbuild.build({
    entryPoints: [entry], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [stubPlugin()], logLevel: "silent",
  });
  rmSync(entry, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  try { globalThis.navigator = window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.localStorage = window.localStorage;
  globalThis.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => window.clearTimeout(id);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ DashboardLayout } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

async function mountAt(path, { show = true, user = null } = {}) {
  globalThis.fetch = () => Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
  globalThis.__flag = true; globalThis.__auth = { user, loading: false };
  globalThis.__path = path; globalThis.__showGuided = show;
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(DashboardLayout)); });
  await settle();
  const shown = !!document.querySelector('[data-testid="guided-setup"]');
  await act(async () => root.unmount());
  return shown;
}

test("the welcome popup is NOT shown on the public Fundraisers page (signed out)", async () => {
  assert.equal(await mountAt("/fundraisers"), false);
});

test("the welcome popup is NOT shown on the public Fundraisers page (signed in, gate says show)", async () => {
  assert.equal(await mountAt("/fundraisers", { user: { id: "u1" } }), false);
});

test("another DashboardLayout page is unchanged: For Business still shows the popup when the gate says show", async () => {
  assert.equal(await mountAt("/business"), true);
  assert.equal(await mountAt("/pricing"), true);
  assert.equal(await mountAt("/dashboard", { user: { id: "u1" } }), true);
});

test("the gate is still the gate everywhere: when it says no, no page shows the popup", async () => {
  assert.equal(await mountAt("/business", { show: false }), false);
  assert.equal(await mountAt("/fundraisers", { show: false }), false);
});

test("the exclusion is route-specific: only /fundraisers (and its trailing-slash form) is excluded", () => {
  assert.equal(isGuidedSetupExcludedRoute("/fundraisers"), true);
  assert.equal(isGuidedSetupExcludedRoute("/fundraisers/"), true);
  for (const p of ["/", "/business", "/pricing", "/dashboard", "/dashboard/fundraiser", "/fundraisers-x", "/f/abc", "", undefined, null]) {
    assert.equal(isGuidedSetupExcludedRoute(p), false, String(p));
  }
});

test("the gate helper and the Hearts rules are untouched by this change (source check)", () => {
  const layout = readFileSync(join(__dirname, "DashboardLayout.jsx"), "utf8");
  assert.match(layout, /useState\(\(\) => shouldShowGuidedSetupForUser\(accountState\)\)/, "initial gate unchanged");
  assert.match(layout, /showOnboarding && !isGuidedSetupExcludedRoute\(location\.pathname\) && \(/, "route exclusion at the render site only");
});
