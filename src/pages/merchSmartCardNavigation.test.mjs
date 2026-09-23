// src/pages/merchSmartCardNavigation.test.mjs
//
// A production BUG, found and fixed 2026-09-22: "gifts/smart-card" is registered in App.jsx as a
// NESTED, RELATIVE child route under "/dashboard" — its real, effective path is
// /dashboard/gifts/smart-card, not /gifts/smart-card. Merch.jsx's "View Smart Card options"
// button called navigate('/gifts/smart-card') — an ABSOLUTE path matching no registered route at
// all. React Router fell through to App.jsx's catch-all ("*" -> <Navigate to="/" replace />),
// which for an authenticated founder bounces through Landing's own auth-redirect back to
// /dashboard — experienced as the button "reloading" the gifts dashboard instead of opening the
// Smart Card page.
//
// THIS TEST PROVES THE FIX STRUCTURALLY, cross-referencing the two source files directly rather
// than hand-typing an expected path that could itself drift from App.jsx's real route tree —
// exactly the class of mistake that caused the bug in the first place. If either file changes
// without the other, this test fails.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_SRC = readFileSync(path.join(DIR, "..", "App.jsx"), "utf8");
const MERCH_SRC = readFileSync(path.join(DIR, "Merch.jsx"), "utf8");

/** The exact, real route path App.jsx registers for the Smart Card page, derived from its own
 * source — never hand-typed. Fails loudly (a clear message, not a false pass) if the route is
 * ever renamed or moved. */
function registeredSmartCardPath() {
  // The dashboard wrapper Route and the nested gifts/smart-card Route, in the order App.jsx
  // actually declares them.
  const dashboardOpen = APP_SRC.indexOf('path="/dashboard"');
  assert.ok(dashboardOpen !== -1, "App.jsx must still declare the /dashboard Route");
  const dashboardClose = APP_SRC.indexOf("</Route>", dashboardOpen);
  const dashboardBlock = APP_SRC.slice(dashboardOpen, dashboardClose);

  const m = /<Route\s+path="([^"]*gifts\/smart-card[^"]*)"\s+element=\{<PrezzeeSmartCard/.exec(dashboardBlock);
  assert.ok(m, "App.jsx's /dashboard block must still declare a gifts/smart-card child Route for <PrezzeeSmartCard>");
  const childPath = m[1];
  // A NESTED child Route's `path` prop is relative to its parent — React Router does not accept
  // a leading slash on a child path, so this must be a bare relative segment, never absolute.
  assert.ok(!childPath.startsWith("/"), `the nested route's own path prop must be relative, not absolute: "${childPath}"`);
  return `/dashboard/${childPath}`;
}

test("Merch.jsx's Smart Card button navigates to the ACTUAL registered route, not a guessed absolute path", () => {
  const realPath = registeredSmartCardPath();
  assert.equal(realPath, "/dashboard/gifts/smart-card", "sanity: the route this test derived is the expected one");

  const navCall = /navigate\(['"]([^'"]*gifts\/smart-card[^'"]*)['"]\)/.exec(MERCH_SRC);
  assert.ok(navCall, "Merch.jsx must call navigate() with a gifts/smart-card path");
  assert.equal(navCall[1], realPath,
    "Merch.jsx must navigate to the SAME path App.jsx actually registers — a mismatch here is exactly the 2026-09-22 production bug");
});

test("the OLD, broken absolute path no longer appears anywhere in Merch.jsx", () => {
  assert.equal(MERCH_SRC.includes("navigate('/gifts/smart-card')"), false,
    "the unprefixed absolute path matched no route at all and must not be reintroduced");
});
