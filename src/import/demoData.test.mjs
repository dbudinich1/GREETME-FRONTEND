// src/import/demoData.test.mjs — Run: node --test src/import/demoData.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_EMPLOYEES, DEMO_CLIENTS, demoDataset, isReservedDemoEmail, DEMO_SENDS_ALLOWED,
  assertDemoIntegrity, assertNoRealMix, demoModeAllowsSend, resetDemoData, exitDemoMode,
} from "./demoData.js";

test("every demo record uses a reserved fictional domain (example.com/.org/.net)", () => {
  for (const r of [...DEMO_EMPLOYEES, ...DEMO_CLIENTS]) {
    assert.ok(isReservedDemoEmail(r.email), `non-reserved: ${r.email}`);
  }
  assert.equal(isReservedDemoEmail("real@gmail.com"), false);
});

test("demoDataset tags every record demo:true + source demo, labeled clearly", () => {
  const emp = demoDataset("employees");
  assert.ok(emp.length > 0);
  assert.ok(emp.every((r) => r.demo === true && r.source === "demo" && r.recipientType === "employee"));
  const cli = demoDataset("clients");
  assert.ok(cli.every((r) => r.demo === true && r.recipientType === "client"));
  assertDemoIntegrity(emp);
  assertDemoIntegrity(cli);
});

test("integrity guard rejects untagged or non-reserved demo records", () => {
  assert.throws(() => assertDemoIntegrity([{ email: "a@example.com" }]), /untagged/);
  assert.throws(() => assertDemoIntegrity([{ demo: true, email: "a@gmail.com" }]), /non_reserved/);
});

test("demo and real records may never be mixed", () => {
  assert.throws(() => assertNoRealMix([{ demo: true }, { demo: false }]), /mix_forbidden/);
  assert.doesNotThrow(() => assertNoRealMix(demoDataset("employees")));
  assert.doesNotThrow(() => assertNoRealMix([{ demo: false }, { demo: false }]));
});

test("demo mode never allows sends (constant cannot be true)", () => {
  assert.equal(DEMO_SENDS_ALLOWED, false);
  assert.equal(demoModeAllowsSend(), false);
});

test("reset returns a fresh dataset; exit drops demo + requires confirmation for real import", () => {
  const a = resetDemoData("employees");
  a[0].fullName = "MUTATED";
  const b = resetDemoData("employees");
  assert.notEqual(b[0].fullName, "MUTATED"); // reset is un-mutated
  const exit = exitDemoMode();
  assert.equal(exit.mode, "real");
  assert.deepEqual(exit.records, []);
  assert.equal(exit.requiresConfirmation, true);
});
