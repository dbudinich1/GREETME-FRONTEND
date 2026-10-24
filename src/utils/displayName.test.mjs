// Walkthrough revision 2026-10-24 (founder): the displayed first name starts with a capital letter; the other letters
// are kept exactly as typed.
import test from "node:test";
import assert from "node:assert/strict";
import { capitalizeFirst, displayFirstName } from "./displayName.js";

test("capitalizeFirst: only the first letter changes", () => {
  assert.equal(capitalizeFirst("dan"), "Dan");
  assert.equal(capitalizeFirst("mcKenna"), "McKenna", "the remaining letters are not lowercased");
  assert.equal(capitalizeFirst("DJ"), "DJ");
  assert.equal(capitalizeFirst("élodie"), "Élodie");
  assert.equal(capitalizeFirst("  ana"), "  Ana");
  assert.equal(capitalizeFirst(""), "");
  assert.equal(capitalizeFirst(null), "");
  assert.equal(capitalizeFirst("1st"), "1st");
});

test("displayFirstName: the first word, capitalised", () => {
  assert.equal(displayFirstName("daniel budiansky"), "Daniel");
  assert.equal(displayFirstName("  mary-ann  smith "), "Mary-ann");
  assert.equal(displayFirstName(""), "");
  assert.equal(displayFirstName(undefined), "");
});

test("both places that display the user's first name use it", async () => {
  const { readFileSync } = await import("node:fs");
  const layout = readFileSync(new URL("../components/DashboardLayout.jsx", import.meta.url), "utf8");
  assert.match(layout, /const firstName = capitalizeFirst\(user\?\.name\?\.split\(' '\)\[0\] \|\| user\?\.email\?\.split\('@'\)\[0\] \|\| 'User'\);/);
  const home = readFileSync(new URL("../pages/DashboardHome.jsx", import.meta.url), "utf8");
  assert.match(home, /const firstName = displayFirstName\(user\?\.name\);/);
});

test("navigation: the founder's order, labels, paths and gates (walkthrough 2026-10-24)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../components/DashboardLayout.jsx", import.meta.url), "utf8");
  const start = src.indexOf("const navigation = [");
  const block = src.slice(start, src.indexOf("\n  ];", start));
  const top = [...block.matchAll(/^ {4}(?:\.\.\.\((.*?)\? \[)?\{ name: '([^']+)', path: '([^']+)'/gm)].map((m) => [m[2], m[3], (m[1] || "").trim()]);
  assert.deepEqual(top, [
    ["Home", "/dashboard", ""],
    ["Celebrations", "/dashboard/contacts", ""],
    ["Gift Place", "/dashboard/gifts", ""],
    ["For Business", "/business", ""],
    ["Fundraisers", "/fundraisers", "isFundraiserUiEnabled()"],
    ["Plans & Pricing", "/pricing", ""],
    ["Hero", "/dashboard/hero", ""],
    ["Hearts", "/dashboard/rewards", ""],
    ["Founder Central Command", "/dashboard/founder/command", "isFounder(user)"],
    ["Fundraising", "/dashboard/fundraiser/admin", "isFundraiserUiEnabled() && isFounder(user)"],
    ["Salespeople", "/dashboard/founder/salespeople", "isFounder(user)"],
  ]);
  assert.match(block, /isPartnerAdmin \? \{ children: \[\{ name: 'Partner Dashboard', path: '\/dashboard\/fundraiser' \}\] \}/, "partner child gate unchanged");
});

test("navigation: Home is active only on Home itself, so Gift Place (/dashboard/gifts) is the only active tab there", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../components/DashboardLayout.jsx", import.meta.url), "utf8");
  const tops = [...src.matchAll(/to=\{item\.path\}\s*\n\s*end=\{item\.path === '\/dashboard'\}/g)];
  const all = [...src.matchAll(/to=\{item\.path\}/g)];
  assert.equal(all.length, 3, "desktop link, desktop link with submenu, phone menu link");
  assert.equal(tops.length, all.length, "every top-level nav link ends-matches Home");
});
