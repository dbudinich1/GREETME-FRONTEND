// src/hooks/useFundraiserPartnerAccess.test.mjs
//
// TEAM B (PARTNER-READINESS B3) — partner-navigation visibility.
//
// PURE tests: the decision and the probe lifecycle are exported as React-free functions, so every
// required behaviour is provable without a DOM. That matters on this runtime — every
// *.browser.test.mjs suite in this repository currently fails on Node 25 with
// "Cannot set property navigator of #<Object> which has only a getter" (jsdom cannot install its
// navigator), so jsdom-rendered assertions would be unverifiable here. Keeping the logic pure keeps
// the proof real.
//
// Run: node --test src/hooks/useFundraiserPartnerAccess.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decidePartnerAccess,
  shouldProbePartnerAccess,
  runPartnerAccessProbe,
} from "./useFundraiserPartnerAccess.js";

// Envelope shape produced by src/api/fundraiserApi.js req(): { ok, status, data, networkError? }
const res = (status, data, extra = {}) => ({ ok: status >= 200 && status < 300, status, data, ...extra });
const ORGS = (n) => ({ organizations: Array.from({ length: n }, (_, i) => ({ organizationId: `org_${i}`, name: `Org ${i}`, status: "approved" })) });

// ── qualification: only an explicit 200 with >= 1 organization ──

test("B3: qualified partner administrator (200 + 1 org) ⇒ visible", () => {
  assert.equal(decidePartnerAccess(res(200, ORGS(1))), true);
});

test("B3: partner administering several organizations ⇒ visible", () => {
  assert.equal(decidePartnerAccess(res(200, ORGS(3))), true);
});

test("B3: founder returning 200 with NO partner organizations ⇒ hidden", () => {
  // A founder is never in adminUserIds, so /partner/orgs answers 200 with an empty list.
  assert.equal(decidePartnerAccess(res(200, { organizations: [] })), false);
});

test("B3: ordinary authenticated user (403 NO_FUNDRAISER_ROLE) ⇒ hidden", () => {
  assert.equal(decidePartnerAccess(res(403, { error: "forbidden", code: "NO_FUNDRAISER_ROLE" })), false);
});

test("B3: unauthenticated (401) ⇒ hidden", () => {
  assert.equal(decidePartnerAccess(res(401, { code: "AUTH_REQUIRED" })), false);
});

test("B3: dormant framework (503) ⇒ hidden", () => {
  assert.equal(decidePartnerAccess(res(503, { disabled: true })), false);
});

test("B3: network failure ⇒ hidden", () => {
  assert.equal(decidePartnerAccess({ ok: false, status: 0, data: null, networkError: true }), false);
});

test("B3: malformed responses fail closed", () => {
  for (const body of [null, undefined, {}, { organizations: null }, { organizations: "many" }, { organizations: {} }, { organizations: 3 }, { orgs: [{}] }]) {
    assert.equal(decidePartnerAccess(res(200, body)), false, `body ${JSON.stringify(body)} must fail closed`);
  }
  // 200-with-no-envelope, and a non-200 that nonetheless carries organizations
  assert.equal(decidePartnerAccess(undefined), false);
  assert.equal(decidePartnerAccess(null), false);
  assert.equal(decidePartnerAccess(res(500, ORGS(2))), false);
  assert.equal(decidePartnerAccess({ ok: true, status: 204, data: ORGS(1) }), false, "only 200 qualifies");
});

// ── gating: no request at all when unqualified ──

test("B3: flag disabled ⇒ no probe permitted", () => {
  assert.equal(shouldProbePartnerAccess({ enabled: false, isAuthenticated: true }), false);
});

test("B3: unauthenticated ⇒ no probe permitted", () => {
  assert.equal(shouldProbePartnerAccess({ enabled: true, isAuthenticated: false }), false);
});

test("B3: only enabled AND authenticated permits a probe", () => {
  assert.equal(shouldProbePartnerAccess({ enabled: true, isAuthenticated: true }), true);
  for (const c of [{ enabled: undefined, isAuthenticated: true }, { enabled: true, isAuthenticated: undefined }, {}]) {
    assert.equal(shouldProbePartnerAccess(c), false);
  }
});

test("B3: flag disabled ⇒ ZERO fundraiser requests issued", async () => {
  let calls = 0;
  const applied = [];
  const out = await runPartnerAccessProbe({
    enabled: false, isAuthenticated: true,
    fetchOrgs: async () => { calls++; return res(200, ORGS(1)); },
    apply: (v) => applied.push(v),
  });
  assert.equal(calls, 0, "no network call while the gate is off");
  assert.equal(out.probed, false);
  assert.deepEqual(applied, [], "no state update either");
});

test("B3: unauthenticated ⇒ ZERO fundraiser requests issued", async () => {
  let calls = 0;
  await runPartnerAccessProbe({
    enabled: true, isAuthenticated: false,
    fetchOrgs: async () => { calls++; return res(200, ORGS(1)); },
    apply: () => {},
  });
  assert.equal(calls, 0);
});

// ── lifecycle ──

test("B3: the probe issues exactly ONE request per invocation", async () => {
  let calls = 0;
  const applied = [];
  await runPartnerAccessProbe({
    enabled: true, isAuthenticated: true,
    fetchOrgs: async () => { calls++; return res(200, ORGS(1)); },
    apply: (v) => applied.push(v),
  });
  assert.equal(calls, 1, "exactly one call — not one per render");
  assert.deepEqual(applied, [true], "exactly one state update");
});

test("B3: unmount during the request ⇒ NO state update is applied", async () => {
  let active = true;
  const applied = [];
  const out = await runPartnerAccessProbe({
    enabled: true, isAuthenticated: true,
    fetchOrgs: async () => { active = false; return res(200, ORGS(1)); }, // unmount mid-flight
    apply: (v) => applied.push(v),
    isActive: () => active,
  });
  assert.deepEqual(applied, [], "no setState after unmount (no React warning possible)");
  assert.equal(out.applied, false);
  assert.equal(out.reason, "unmounted");
  assert.equal(out.access, true, "the decision was still computed correctly — it was simply not applied");
});

test("B3: a thrown client error fails closed without leaking", async () => {
  const applied = [];
  const out = await runPartnerAccessProbe({
    enabled: true, isAuthenticated: true,
    fetchOrgs: async () => { throw new Error("boom"); },
    apply: (v) => applied.push(v),
  });
  assert.deepEqual(applied, [false], "explicitly false, never true");
  assert.equal(out.access, false);
  assert.equal(out.reason, "threw");
});

test("B3: a throw AFTER unmount applies nothing", async () => {
  let active = true;
  const applied = [];
  await runPartnerAccessProbe({
    enabled: true, isAuthenticated: true,
    fetchOrgs: async () => { active = false; throw new Error("boom"); },
    apply: (v) => applied.push(v),
    isActive: () => active,
  });
  assert.deepEqual(applied, []);
});

test("B3: every non-qualifying response applies exactly false", async () => {
  for (const r of [res(401, {}), res(403, {}), res(503, {}), res(200, { organizations: [] }), { ok: false, status: 0, networkError: true, data: null }]) {
    const applied = [];
    await runPartnerAccessProbe({
      enabled: true, isAuthenticated: true,
      fetchOrgs: async () => r,
      apply: (v) => applied.push(v),
    });
    assert.deepEqual(applied, [false], `status ${r.status} must apply false`);
  }
});

// ── contract guards ──

test("B3: the decision reads ONLY the server envelope — no client role is consulted", () => {
  // A body asserting founder/admin/partner roles must not influence the outcome.
  const hostile = res(200, { organizations: [], role: "partner_admin", isPartnerAdmin: true, plan: "founder", tier: "founder", adminUserIds: ["x"] });
  assert.equal(decidePartnerAccess(hostile), false, "client-asserted role fields grant nothing");
  assert.equal(decidePartnerAccess(res(403, { role: "partner_admin", isPartnerAdmin: true })), false);
});

test("B3: decision is pure — the input envelope is not mutated", () => {
  const r = res(200, ORGS(2));
  const snapshot = JSON.stringify(r);
  decidePartnerAccess(r);
  assert.equal(JSON.stringify(r), snapshot);
});

test("B3: the target route and label are exactly the existing ones", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../components/DashboardLayout.jsx", import.meta.url), "utf8");

  // Partner entry: gated on the flag AND the server-derived signal; exact label and route.
  assert.match(
    src,
    /isFundraiserUiEnabled\(\)\s*&&\s*isPartnerAdmin\s*\?\s*\[\{\s*name:\s*'Greet-Me Fundraise',\s*path:\s*'\/dashboard\/fundraiser',/,
    "partner entry must be flag + isPartnerAdmin, labelled 'Greet-Me Fundraise', routed to /dashboard/fundraiser"
  );
  // The partner entry must NOT be gated on the founder predicate any more.
  assert.ok(
    !/isFounder\(user\)\s*\?\s*\[\{\s*name:\s*'Greet-Me Fundraise'/.test(src),
    "partner entry must no longer be founder-gated"
  );
  // Founder administration entry UNCHANGED — still founder-gated, same label and route.
  assert.match(
    src,
    /isFundraiserUiEnabled\(\)\s*&&\s*isFounder\(user\)\s*\?\s*\[\{\s*name:\s*'Fundraising',\s*path:\s*'\/dashboard\/fundraiser\/admin',/,
    "founder admin entry must remain isFounder-gated at /dashboard/fundraiser/admin"
  );
});

test("B3: existing personal navigation entries are unchanged in label and order", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../components/DashboardLayout.jsx", import.meta.url), "utf8");
  const block = src.slice(src.indexOf("const navigation = ["), src.indexOf("];", src.indexOf("const navigation = [")));
  const names = [...block.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(names, [
    "Home",
    "Recipients",
    "Plans & Pricing",
    "Greet-Me Gifts",
    "❤️ Hearts Hub",
    "🥇 Greet-Me™ Hero™",
    "For Business",
    "Corporate Campaign Dashboard", // nested child of For Business
    "Greet-Me Fundraise",
    "Fundraising",
  ], "personal navigation entries, order, and the nested child are untouched");
});

test("B3: a single shared navigation array still feeds both desktop and mobile", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../components/DashboardLayout.jsx", import.meta.url), "utf8");
  assert.equal((src.match(/const navigation = \[/g) || []).length, 1, "exactly one navigation definition");
  assert.equal((src.match(/navigation\.map\(/g) || []).length, 2, "two consumers: mobile drawer + desktop bar");
});

test("B3: no persistent cache is introduced", async () => {
  const { readFileSync } = await import("node:fs");
  const raw = readFileSync(new URL("./useFundraiserPartnerAccess.js", import.meta.url), "utf8");
  // Strip block and line comments so prose describing the guarantee cannot satisfy (or trip) it —
  // only executable code is inspected.
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const banned of ["sessionStorage", "localStorage", "document.cookie", "indexedDB"]) {
    assert.ok(!code.includes(banned), `the hook must not use ${banned} in code`);
  }
  // And the DashboardLayout wiring must not persist it either.
  const layoutRaw = readFileSync(new URL("../components/DashboardLayout.jsx", import.meta.url), "utf8");
  const b3Line = layoutRaw.split("\n").find((l) => l.includes("useFundraiserPartnerAccess("));
  assert.ok(b3Line && !/Storage/.test(b3Line), "the layout wiring introduces no storage");
});

test("B3: the hook reuses the existing fundraiser API client and endpoint", async () => {
  const { readFileSync } = await import("node:fs");
  const hook = readFileSync(new URL("./useFundraiserPartnerAccess.js", import.meta.url), "utf8");
  assert.ok(hook.includes('from "../api/fundraiserApi.js"'), "imports the existing client");
  assert.ok(hook.includes("fundraiserApi.partner.myOrganizations()"), "calls the existing partner endpoint");
  const api = readFileSync(new URL("../api/fundraiserApi.js", import.meta.url), "utf8");
  assert.ok(api.includes('myOrganizations: () => get("/api/fundraiser/partner/orgs")'), "endpoint is GET /api/fundraiser/partner/orgs");
});

test("B3: the effect runs once per mount (empty dependency list)", async () => {
  const { readFileSync } = await import("node:fs");
  const hook = readFileSync(new URL("./useFundraiserPartnerAccess.js", import.meta.url), "utf8");
  assert.match(hook, /\}, \[\]\); \/\/ once per mount/, "useEffect must carry an empty dependency array");
  assert.match(hook, /return \(\) => \{ active = false; \};/, "cleanup must mark the probe inactive");
});
