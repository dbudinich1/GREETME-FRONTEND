// src/components/phoneHeaderAccountMenu.browser.test.mjs
//
// Report 136 (founder, 2026-10-23) — on phones the header's user icon moves into the hamburger menu, keeping its
// account actions, and the header shows the full Greet-Me logo (the 'small' size, wordmark included) at every phone
// width. Desktop keeps the user icon and its dropdown. The REAL DashboardLayout is esbuild-transformed and mounted
// into jsdom; only ambient collaborators (router, auth, icons, widgets, services) are stubbed, as in
// dashboardPartnerNav.browser.test.mjs.
//
// Run under the SUPPORTED runtime (package.json engines: node 20.x):
//   node --test src/components/phoneHeaderAccountMenu.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__phonehdr.bundle.mjs");
let React, createRoot, act, DashboardLayout;

const ROUTER_STUB = `
import React from "react";
export const NavLink = ({ to, children, style, className, ...rest }) => {
  const s = typeof style === "function" ? style({ isActive: false, isPending: false }) : style;
  const c = typeof className === "function" ? className({ isActive: false, isPending: false }) : className;
  const kids = typeof children === "function" ? children({ isActive: false, isPending: false }) : children;
  return React.createElement("a", { href: to, "data-nav": to, style: s, className: c, ...rest }, kids);
};
export const Outlet = () => null;
export const useNavigate = () => ((path) => { globalThis.__navs.push(path); });
export const useLocation = () => ({ pathname: "/dashboard" });
`;
const AUTH_STUB = `
export const useAuth = () => ({ user: globalThis.__user, loading: false, isAuthenticated: true, logout: () => { globalThis.__logouts++; } });
export const AuthContext = {};
`;
const GATE_STUB = `export const isFundraiserUiEnabled = () => false;`;
const ICONS_STUB = `
import React from "react";
const I = () => null;
export const Gift = I, ShoppingBag = I, Settings = I, LogOut = I, Users = I, ShoppingCart = I,
  Film = I, X = I, Image = I, QrCode = I;
export default { };
`;
// The logo stub records the size it is given, so the header's choice of size is observable.
const LOGO_STUB = `import React from "react"; export default function L({ size }) { return React.createElement("span", { "data-logo-size": size }); }`;
const NULLCOMP_STUB = `const N = () => null; export default N;`;
const GUIDED_STUB = `const N = () => null; export default N; export const shouldShowGuidedSetupForUser = () => false;`;
const ACCOUNTSTATE_HOOK_STUB = `export const useAccountState = () => ({ isAuthenticated: true, isSubscribed: true, isOnboardingComplete: true });`;
const API_STUB = `export default { getHeartsBalance: async () => ({ balance: 0 }) };`;
const COUNT_STUB = `export default { getCount: () => 0 };`;

function stubPlugin() {
  const map = [
    [/^react-router-dom$/, ROUTER_STUB, "rr"],
    [/context[\\/]AuthContext$/, AUTH_STUB, "auth"],
    [/fundraiserGate\.js$/, GATE_STUB, "gate"],
    [/^lucide-react$/, ICONS_STUB, "icons"],
    [/GreetMeLogo$/, LOGO_STUB, "logo"],
    [/NotificationBell$/, NULLCOMP_STUB, "bell"],
    [/GuidedSetupFlow$/, GUIDED_STUB, "guided"],
    [/hooks[\\/]useAccountState$/, ACCOUNTSTATE_HOOK_STUB, "acct"],
    [/api[\\/]api$/, API_STUB, "api"],
    [/cartService$/, COUNT_STUB, "cart"],
    [/imageCreditsService$/, COUNT_STUB, "credits"],
  ];
  return { name: "stub", setup(b) {
    for (const [filter, contents, ns] of map) {
      b.onResolve({ filter }, (a) => ({ path: a.path, namespace: ns }));
      b.onLoad({ filter: /.*/, namespace: ns }, () => ({ contents, loader: "js" }));
    }
  } };
}

before(async () => {
  writeFileSync(join(__dirname, ".__phonehdr.jsx"), `export { default as DashboardLayout } from "./DashboardLayout.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__phonehdr.jsx")], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [stubPlugin()], logLevel: "silent",
  });
  rmSync(join(__dirname, ".__phonehdr.jsx"), { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.localStorage = window.localStorage;
  globalThis.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => window.clearTimeout(id);
  globalThis.fetch = () => Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ DashboardLayout } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await settle(); };

async function mount(width) {
  window.innerWidth = width;
  globalThis.__navs = []; globalThis.__logouts = 0;
  globalThis.__user = { id: "u1", name: "Margaret Lane", email: "margaret@example.com" };
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(DashboardLayout)); });
  await settle();
  return root;
}

const header = () => document.querySelector("header");
const userIcon = () => [...header().querySelectorAll("button")].find((b) => b.title === "Margaret Lane");
const logoSize = () => header().querySelector("[data-logo-size]").getAttribute("data-logo-size");
const hamburger = () => header().querySelector("button");
const drawer = () => [...document.querySelectorAll("div")].find((d) => d.style.zIndex === "60");
const buttonIn = (scope, label) => [...scope.querySelectorAll("button")].find((b) => b.textContent.trim() === label);
const ACCOUNT = [["Media Library", "/dashboard/media"], ["My Orders", "/dashboard/merch/orders"], ["Settings", "/dashboard/settings"]];

test("desktop: the header keeps the user icon and its dropdown (Media Library, My Orders, Settings, Logout) and the large logo", async () => {
  await mount(1440);
  assert.equal(logoSize(), "large"); // walkthrough 2026-10-24 compact header (was "xlarge")
  assert.ok(userIcon(), "user icon in the desktop header");
  assert.equal(userIcon().textContent.trim(), "M");
  for (const [label, path] of ACCOUNT) {
    globalThis.__navs = [];
    await click(userIcon());
    await click(buttonIn(header(), label));
    assert.deepEqual(globalThis.__navs, [path], `${label} opens ${path}`);
    assert.equal(buttonIn(header(), label), undefined, "dropdown closed");
  }
  await click(userIcon());
  assert.ok(buttonIn(header(), "Logout"), "Logout in the desktop dropdown");
});

for (const width of [320, 340, 359, 360, 375, 390, 430]) {
  test(`phone ${width}px: no user icon in the header; the full logo (small, with wordmark) is shown`, async () => {
    await mount(width);
    assert.equal(userIcon(), undefined, "no user icon in the phone header");
    assert.equal(logoSize(), "small", "the full logo, never the G mark alone");
  });
}

test("phone: the hamburger menu carries the user icon, name, email and every account action", async () => {
  await mount(390);
  await click(hamburger());
  const d = drawer();
  assert.ok(d, "menu open");
  const avatar = [...d.querySelectorAll("span")].find((s) => s.title === "Margaret Lane");
  assert.ok(avatar, "the user icon is in the menu");
  assert.equal(avatar.textContent.trim(), "M");
  assert.match(d.textContent, /Welcome, Margaret!/);
  assert.match(d.textContent, /margaret@example\.com/);
  for (const label of ["Media Library", "My Orders", "Settings", "Logout"]) assert.ok(buttonIn(d, label), `${label} in the menu`);
});

for (const [label, path] of ACCOUNT) {
  test(`phone: ${label} in the hamburger menu opens ${path} and closes the menu`, async () => {
    await mount(375);
    await click(hamburger());
    await click(buttonIn(drawer(), label));
    assert.deepEqual(globalThis.__navs, [path]);
    assert.equal(drawer(), undefined, "menu closed");
  });
}

test("phone: Logout in the hamburger menu logs out and opens the login page", async () => {
  await mount(320);
  await click(hamburger());
  await click(buttonIn(drawer(), "Logout"));
  assert.equal(globalThis.__logouts, 1);
  assert.deepEqual(globalThis.__navs, ["/login"]);
});

test("resizing from desktop to phone removes the user icon; back to desktop restores it", async () => {
  await mount(1440);
  assert.ok(userIcon());
  window.innerWidth = 360; await act(async () => { window.dispatchEvent(new Event("resize")); }); await settle();
  assert.equal(userIcon(), undefined);
  assert.equal(logoSize(), "small");
  window.innerWidth = 1440; await act(async () => { window.dispatchEvent(new Event("resize")); }); await settle();
  assert.ok(userIcon());
  assert.equal(logoSize(), "large"); // walkthrough 2026-10-24 compact header (was "xlarge")
});
