// src/components/importWizard/wizard.test.mjs — Run: node --test src/components/importWizard/wizard.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODES, corporateContext, commitTarget, canSelectFile, commitDecision, STEPS } from "./wizardModel.js";

const WIZ = readFileSync(new URL("./ContactImportWizard.jsx", import.meta.url), "utf8");
const memb = (arr) => ({ ok: true, data: { memberships: arr } });
const A = (id, role = "admin") => ({ corporateOrganizationId: id, role, status: "active" });

test("commit targets: personal writes; corporate needs org; demo never writes / never uses a user id", () => {
  assert.deepEqual(commitTarget(MODES.PERSONAL), { kind: "personal", write: true });
  assert.deepEqual(commitTarget(MODES.CORPORATE, { orgId: "corp_org_1" }), { kind: "corporate", orgId: "corp_org_1", write: true });
  assert.deepEqual(commitTarget(MODES.CORPORATE, {}), { kind: "corporate", orgId: null, write: false });
  const demo = commitTarget(MODES.DEMO, { orgId: "x" });
  assert.equal(demo.write, false);
  assert.equal("orgId" in demo, false); // demo carries no org id at all
});

test("canSelectFile: personal/demo always; corporate requires resolved active org", () => {
  assert.equal(canSelectFile(MODES.PERSONAL, null), true);
  assert.equal(canSelectFile(MODES.DEMO, null), true);
  assert.equal(canSelectFile(MODES.CORPORATE, { phase: "select_org" }), false);
  assert.equal(canSelectFile(MODES.CORPORATE, { phase: "ready" }), true);
});

test("corporateContext delegates to Phase A5 resolution (zero/one/many)", () => {
  assert.equal(corporateContext(memb([])).phase, "no_org");
  const one = corporateContext(memb([A("corp_org_1")]));
  assert.equal(one.phase, "ready");
  assert.equal(one.selectedOrgId, "corp_org_1");
  assert.equal(corporateContext(memb([A("corp_org_1"), A("corp_org_2")])).phase, "select_org");
  assert.equal(corporateContext({ dormant: true }).phase, "dormant");
});

test("commit decisions: demo blocked, corporate gated, personal allowed", () => {
  const plan = { toCreate: [{}], toUpdate: [] };
  assert.equal(commitDecision(MODES.DEMO, plan).reason, "demo_no_write");
  assert.equal(commitDecision(MODES.CORPORATE, plan, {}).reason, "org_required");
  assert.equal(commitDecision(MODES.CORPORATE, plan, { orgId: "corp_org_1" }).reason, "corporate_endpoint_pending");
  assert.equal(commitDecision(MODES.PERSONAL, plan).allowed, true);
  assert.equal(commitDecision(MODES.PERSONAL, { toCreate: [] }).reason, "nothing_to_import");
});

test("wizard has the ordered steps", () => {
  assert.deepEqual(STEPS, ["mode", "context", "upload", "map", "preview", "commit", "summary"]);
});

// ---- source-scan invariants ----
test("org context never comes from user.id / useAuth", () => {
  assert.ok(!/user\??\.id/.test(WIZ), "must not read user.id");
  assert.ok(!/useAuth/.test(WIZ), "must not derive org from useAuth");
});

test("demo mode is send-safe and isolated (no send/gift/notify wiring; no real mix)", () => {
  assert.match(WIZ, /assertNoRealMix/);                 // never mixes demo + real
  assert.ok(!/\.send\(|sendGreeting|sendGift|notify\(|\/api\/[^"']*send/.test(WIZ), "no send/gift/notify calls");
  assert.match(WIZ, /DEMO DATA — NOT SENT/);            // clear labeling
});

test("no gift/payment/fundraising imports; personal ownership via existing endpoint", () => {
  assert.ok(!/\b(import|from)\b[^\n]*(gift|fundrais|payment|stripe|merch|pricing|checkout)/i.test(WIZ));
  assert.match(WIZ, /api\.importContacts/);             // personal → user's own collection
  assert.match(WIZ, /corporate_endpoint_pending/);      // corporate write gated (backend gap)
});

test("does not import or modify the locked Recipients page (Contacts.jsx)", () => {
  assert.ok(!/pages\/Contacts|CSVImport/.test(WIZ), "must not touch the locked Recipients import path");
});
